"""Real temporary PostgreSQL + Spring Boot, fake AI. Never uses the project's database."""
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PG = Path(r'C:\Program Files\PostgreSQL\17\bin')


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def request(url, method='GET', data=None, token=None, image=False):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if data is not None:
        headers['Content-Type'] = 'image/jpeg' if image else 'application/json'
        if not image:
            data = json.dumps(data).encode()
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=40) as result:
            body = result.read()
            return result.status, json.loads(body) if body else None
    except HTTPError as error:
        body = error.read()
        return error.code, json.loads(body) if body else None


def main():
    tools = ROOT / '.tools'
    tools.mkdir(exist_ok=True)
    jar = ROOT / 'backend/target/attendance-backend-0.0.1-SNAPSHOT.jar'
    if not jar.is_file() or not (PG / 'initdb.exe').is_file():
        raise RuntimeError('Build backend jar and install PostgreSQL 17 first')
    state = dict(mode='matched', code='ITEST_STUDENT', calls=0, block=False)
    entered, release = threading.Event(), threading.Event()
    ai_key = secrets.token_hex(32)

    class FakeAi(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            self.rfile.read(int(self.headers.get('Content-Length', 0)))
            if self.headers.get('X-API-Key') != ai_key:
                self.send_response(401)
                self.end_headers()
                return
            state['calls'] += 1
            if state['block']:
                entered.set()
                release.wait(15)
            mode = state['mode']
            result = dict(status=mode, student_id=state['code'] if mode == 'matched' else None,
                          cosine=0.9, threshold=0.5, face_count=1, threshold_calibrated=False)
            self.send_response(503 if mode == 'error' else 200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({} if mode == 'malformed' else result).encode())

    ai = ThreadingHTTPServer(('127.0.0.1', 0), FakeAi)
    threading.Thread(target=ai.serve_forever, daemon=True).start()
    pg_port, backend_port = free_port(), free_port()
    base = f'http://127.0.0.1:{backend_port}/api'
    password = secrets.token_urlsafe(20)
    with tempfile.TemporaryDirectory(prefix='attendance_test_', dir=tools) as temp:
        directory = Path(temp).resolve()
        if directory.parent != tools.resolve():
            raise RuntimeError('Unexpected test directory')
        pgdata = directory / 'pgdata'
        backend = None
        started_pg = False
        try:
            subprocess.run([str(PG / 'initdb.exe'), '-D', str(pgdata), '-A', 'trust',
                            '-U', 'test_owner', '--no-locale', '-E', 'UTF8'],
                           check=True, capture_output=True, timeout=45)
            subprocess.run([str(PG / 'pg_ctl.exe'), '-D', str(pgdata), '-l', str(directory / 'postgres.log'),
                            '-o', f'-h 127.0.0.1 -p {pg_port}', '-w', 'start'],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=45)
            started_pg = True
            env = dict(os.environ, DB_URL=f'jdbc:postgresql://127.0.0.1:{pg_port}/postgres',
                       DB_USERNAME='test_owner', DB_PASSWORD='test-only', SERVER_PORT=str(backend_port),
                       JWT_SECRET_BASE64=__import__('base64').b64encode(secrets.token_bytes(32)).decode(),
                       BOOTSTRAP_ADMIN_PASSWORD=password, AI_API_KEY=ai_key,
                       AI_SERVICE_URL=f'http://127.0.0.1:{ai.server_port}')
            log = (directory / 'backend.log').open('w', encoding='utf-8')
            java_home = os.environ.get('JAVA_HOME')
            java = Path(java_home, 'bin', 'java.exe') if java_home else None
            if not java or not java.is_file():
                java_command = shutil.which('java')
                if not java_command:
                    raise RuntimeError('Java runtime not found; set JAVA_HOME or add java to PATH')
                java = Path(java_command)
            backend = subprocess.Popen([str(java), '-jar', str(jar)], cwd=ROOT / 'backend',
                                       env=env, stdout=log, stderr=subprocess.STDOUT)
            for _ in range(120):
                if backend.poll() is not None:
                    raise RuntimeError('Backend exited: ' + (directory / 'backend.log').read_text(errors='replace')[-5000:])
                try:
                    status, _ = request(base + '/health')
                    if status == 200:
                        status, login = request(base + '/auth/login', 'POST', dict(username='admin', password=password))
                        if status == 200:
                            break
                except (URLError, ConnectionError, TimeoutError):
                    pass
                time.sleep(0.25)
            else:
                raise RuntimeError('Backend readiness timeout')
            token = login['access_token']

            def api(path, method='GET', data=None, image=False):
                return request(base + path, method, data, token, image)

            status, student = api('/students', 'POST', dict(studentCode='ITEST_STUDENT', fullName='Integration Fixture'))
            assert status == 201, student
            status, classroom = api('/classes', 'POST', dict(classCode='ITEST_CLASS', name='Integration Fixture'))
            assert status == 201, classroom
            class_id = classroom['id']
            assert api(f'/classes/{class_id}/students/{student["id"]}', 'PUT')[0] == 204

            def new_session(late=15):
                status, session = api('/attendance-sessions', 'POST',
                                      dict(classId=class_id, title='Integration Fixture', lateAfterMinutes=late))
                assert status == 201, session
                return session['id']

            session_id = new_session()
            assert api('/attendance-sessions', 'POST', dict(classId=class_id, title='Duplicate', lateAfterMinutes=15))[0] == 409
            path = f'/attendance-sessions/{session_id}/recognize'
            for mode in ('unknown', 'no_face', 'low_quality', 'multiple_faces', 'gallery_empty'):
                state['mode'] = mode
                status, result = api(path, 'POST', b'fixture-not-a-real-image', True)
                assert status == 200 and not result['attendanceRecorded'], (status, result)
            state['mode'] = 'error'
            assert api(path, 'POST', b'fixture', True)[0] == 503
            state['mode'] = 'malformed'
            assert api(path, 'POST', b'fixture', True)[0] == 502
            state['mode'], state['code'] = 'matched', 'NOT_REGISTERED_IN_DB'
            assert api(path, 'POST', b'fixture', True)[1]['status'] == 'student_not_found'
            status, outsider = api('/students', 'POST', dict(studentCode='ITEST_OUTSIDE', fullName='Integration Fixture'))
            assert status == 201
            state['code'] = 'ITEST_OUTSIDE'
            assert api(path, 'POST', b'fixture', True)[1]['status'] == 'student_not_in_class'
            status, result = api(f'/attendance-sessions/{session_id}/manual-record', 'POST',
                                 dict(studentCode='ITEST_OUTSIDE', status='PRESENT'))
            assert status == 200 and result['status'] == 'student_not_in_class' and not result['attendanceRecorded']
            state['code'] = 'ITEST_STUDENT'
            with ThreadPoolExecutor(max_workers=6) as pool:
                results = list(pool.map(lambda _: api(path, 'POST', b'fixture', True), range(6)))
            assert all(status == 200 for status, _ in results), results
            assert sum(result['attendanceRecorded'] for _, result in results) == 1, results
            status, records = api(f'/attendance-sessions/{session_id}/records')
            assert status == 200 and records['totalElements'] == 1, records
            assert records['items'][0]['status'] == 'PRESENT'
            assert api(f'/attendance-sessions/{session_id}/close', 'POST')[0] == 200
            calls = state['calls']
            assert api(path, 'POST', b'fixture', True)[0] == 409
            assert state['calls'] == calls
            print('PASS: migrations, database/JPA, session lifecycle, AI failures, membership checks, 6 concurrent requests create 1 record.')

            session_id = new_session()
            state['block'] = True
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(api, f'/attendance-sessions/{session_id}/recognize', 'POST', b'fixture', True)
                assert entered.wait(10)
                assert api(f'/attendance-sessions/{session_id}/close', 'POST')[0] == 200
                release.set()
                assert future.result()[0] == 409
            state['block'] = False
            assert api(f'/attendance-sessions/{session_id}/records')[1]['totalElements'] == 0
            session_id = new_session(0)
            result = api(f'/attendance-sessions/{session_id}/recognize', 'POST', b'fixture', True)
            assert result[0] == 200 and result[1]['record']['status'] == 'LATE', result
            assert api(f'/attendance-sessions/{session_id}/close', 'POST')[0] == 200
            print('PASS: closing during AI inference prevents write; late attendance classified correctly.')

            # Teacher account flow + reopen + manual attendance + report verification
            status, teacher = api('/admin/teachers', 'POST', dict(username='teacher1', password='teacher-pass-123'))
            assert status == 201 and teacher['role'] == 'TEACHER', teacher
            status, t_login = request(base + '/auth/login', 'POST', dict(username='teacher1', password='teacher-pass-123'))
            assert status == 200, t_login
            t_token = t_login['access_token']

            def t_api(path, method='GET', data=None):
                return request(base + path, method, data, t_token, False)

            # Create second class with 3 students and third empty class (0 students)
            s2 = api('/students', 'POST', dict(studentCode='ITEST_S2', fullName='Student Two'))[1]
            s3 = api('/students', 'POST', dict(studentCode='ITEST_S3', fullName='Student Three'))[1]
            s4 = api('/students', 'POST', dict(studentCode='ITEST_S4', fullName='Student Four'))[1]
            class_b = api('/classes', 'POST', dict(classCode='ITEST_CLASS_B', name='Class B (3 students)'))[1]
            class_empty = api('/classes', 'POST', dict(classCode='ITEST_CLASS_EMPTY', name='Empty Class'))[1]
            class_b_id = class_b['id']
            class_empty_id = class_empty['id']
            for st in (s2, s3, s4):
                assert api(f'/classes/{class_b_id}/students/{st["id"]}', 'PUT')[0] == 204

            # Teacher opens session in Class B (3 students), marks 1 student manually, leaves session OPEN
            status, open_sess_b = t_api('/attendance-sessions', 'POST',
                                        dict(classId=class_b_id, title='Buoi 1 Class B', lateAfterMinutes=15))
            assert status == 201 and open_sess_b['closedAt'] is None, open_sess_b
            open_b_id = open_sess_b['id']
            status, m_res = t_api(f'/attendance-sessions/{open_b_id}/manual-record', 'POST',
                                  dict(studentCode='ITEST_S2', status='PRESENT'))
            assert status == 200 and m_res['attendanceRecorded'] and m_res['record']['status'] == 'PRESENT', m_res

            # While open_sess_b is OPEN: 1 present, 2 pending (unrecorded), 0 absent!
            status, rep_b_open = t_api(f'/reports/attendance?classId={class_b_id}')
            assert status == 200, rep_b_open
            assert rep_b_open['totalStudents'] == 3, rep_b_open
            assert rep_b_open['totalAbsent'] == 0 and rep_b_open['absentRate'] == 0.0, rep_b_open
            assert rep_b_open['totalPending'] == 2 and rep_b_open['openSessions'] == 1, rep_b_open
            assert rep_b_open['presentRate'] == 33.3, rep_b_open

            # Teacher closes session -> remaining 2 students become ABSENT (66.7%), then reopens -> back to pending (0% absent), then closes again
            assert t_api(f'/attendance-sessions/{open_b_id}/close', 'POST')[0] == 200
            status, rep_b_closed = t_api(f'/reports/attendance?classId={class_b_id}')
            assert status == 200, rep_b_closed
            assert rep_b_closed['totalAbsent'] == 2 and rep_b_closed['absentRate'] == 66.7, rep_b_closed
            assert rep_b_closed['totalPending'] == 0 and rep_b_closed['closedSessions'] == 1, rep_b_closed

            assert t_api(f'/attendance-sessions/{open_b_id}/reopen', 'POST')[0] == 200
            status, rep_b_reopened = t_api(f'/reports/attendance?classId={class_b_id}')
            assert rep_b_reopened['totalAbsent'] == 0 and rep_b_reopened['totalPending'] == 2, rep_b_reopened
            assert t_api(f'/attendance-sessions/{open_b_id}/close', 'POST')[0] == 200

            # Open a second session in Class B and leave it OPEN with 0 present
            status, open_sess_b2 = t_api('/attendance-sessions', 'POST',
                                         dict(classId=class_b_id, title='Buoi 2 Class B Open', lateAfterMinutes=15))
            assert status == 201, open_sess_b2

            # Empty class report must have totalStudents=0 and 0% rates (must NOT fallback to global students count)
            status, empty_sess = t_api('/attendance-sessions', 'POST',
                                       dict(classId=class_empty_id, title='Buoi 1 Empty', lateAfterMinutes=15))
            assert status == 201, empty_sess
            assert t_api(f'/attendance-sessions/{empty_sess["id"]}/close', 'POST')[0] == 200
            status, rep_empty = t_api(f'/reports/attendance?classId={class_empty_id}')
            assert status == 200, rep_empty
            assert rep_empty['totalStudents'] == 0 and rep_empty['presentRate'] == 0.0 and rep_empty['absentRate'] == 0.0, rep_empty
            assert rep_empty['sessionBars'][0]['totalStudents'] == 0, rep_empty

            # All-classes report: each session uses its own class's student count, never system-wide students count (which is 5 including ITEST_OUTSIDE)
            # Class 1 (size 1) has 3 closed sessions: [1P, 0P (1A), 1L] -> expected=3, P=1, L=1, A=1, Pending=0
            # Class B (size 3) has 1 closed session [1P, 2A] and 1 open session [0P, 3Pending] -> expected=6, P=1, L=0, A=2, Pending=3
            # Empty Class (size 0) has 1 closed session -> expected=0
            # Total expected across all sessions = 3 + 6 + 0 = 9; P=2 (22.2%), L=1 (11.1%), A=3 (33.3%), Pending=3 (33.3%)
            status, rep_all = t_api('/reports/attendance')
            assert status == 200, rep_all
            assert rep_all['totalStudents'] == 4, rep_all  # 4 distinct enrolled students (ITEST_OUTSIDE is not in any class)
            assert rep_all['presentRate'] == 22.2 and rep_all['lateRate'] == 11.1, rep_all
            assert rep_all['absentRate'] == 33.3 and rep_all['pendingRate'] == 33.3, rep_all
            assert rep_all['totalAbsent'] == 3 and rep_all['totalPending'] == 3, rep_all

            # Verify > 100 student pagination across multiple pages
            for idx in range(1, 102):
                st_code, _ = api('/students', 'POST', dict(studentCode=f'PG_STU_{idx:03d}', fullName=f'Paginated Student {idx}'))
                assert st_code == 201
            p0_status, p0 = t_api('/students?page=0&size=100')
            p1_status, p1 = t_api('/students?page=1&size=100')
            assert p0_status == 200 and p1_status == 200
            assert p0['totalElements'] == 106 and len(p0['items']) == 100 and len(p1['items']) == 6, (p0['totalElements'], len(p0['items']), len(p1['items']))
            print('PASS: teacher workflow, session reopen/manual mark, >100 student pagination, and multi-class/empty-class/open-vs-closed report calculations verified.')
        finally:
            release.set()
            if backend is not None:
                backend.terminate()
                try:
                    backend.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    backend.kill()
                    backend.wait()
                log.close()
            if started_pg:
                subprocess.run([str(PG / 'pg_ctl.exe'), '-D', str(pgdata), '-m', 'fast', '-w', 'stop'],
                               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
            ai.shutdown()
            ai.server_close()
    print('Temporary PostgreSQL/backend stopped; project database was not accessed. Fake AI tests do not measure recognition accuracy.')


if __name__ == '__main__':
    main()
