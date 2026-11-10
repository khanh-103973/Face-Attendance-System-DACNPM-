"""Manual demo: SPACE sends a frame to Spring Boot and may record attendance."""
import argparse
import getpass
import json

import cv2
import requests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--session-id', type=int, required=True)
    parser.add_argument('--consent', action='store_true')
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--backend', choices=['dshow', 'msmf'], default='dshow')
    args = parser.parse_args()
    if args.session_id < 1 or not args.consent:
        parser.error('Use a positive session ID and --consent after participant agreement')
    base = 'http://127.0.0.1:8080/api'
    password = getpass.getpass('Admin LOGIN password (not database password): ')
    try:
        response = requests.post(base + '/auth/login', json=dict(username='admin', password=password), timeout=10)
        response.raise_for_status()
        token = response.json()['access_token']
    except (requests.RequestException, KeyError, ValueError):
        print('Login failed. Check Backend is running and the admin login password is correct.')
        return 1
    finally:
        password = None
    camera = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW if args.backend == 'dshow' else cv2.CAP_MSMF)
    title = 'Attendance demo - SPACE: submit, Q/Esc: exit'
    try:
        if not camera.isOpened():
            print('Cannot open camera; close other webcam apps or try --backend msmf.')
            return 1
        print('SPACE submits one image. This can save DEMO attendance in PostgreSQL.')
        print('Results appear in this terminal. No webcam image is saved by this client.')
        while True:
            ok, frame = camera.read()
            if not ok or frame is None:
                print('Cannot read camera frame.')
                return 1
            cv2.imshow(title, frame)
            pressed = cv2.waitKey(1) & 0xFF
            if pressed in (ord('q'), ord('Q'), 27) or cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
            if pressed != 32:
                continue
            ok, encoded = cv2.imencode('.jpg', frame)
            if not ok:
                print('Cannot encode frame.')
                continue
            try:
                response = requests.post(f'{base}/attendance-sessions/{args.session_id}/recognize',
                                         data=encoded.tobytes(), headers={'Content-Type': 'image/jpeg',
                                         'Authorization': 'Bearer ' + token}, timeout=(3, 40))
                print(f'HTTP {response.status_code}')
                print(json.dumps(response.json(), indent=2, ensure_ascii=False))
                if response.status_code == 401:
                    print('Token expired/invalid. Exit and restart this program to log in again.')
                if response.status_code == 409:
                    print('Session may be closed. Check the session before trying again.')
            except (requests.RequestException, ValueError) as error:
                print(f'Request failed: {error}. Check both Backend and AI Service.')
    except KeyboardInterrupt:
        pass
    finally:
        camera.release()
        cv2.destroyAllWindows()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
