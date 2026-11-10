"""HTTP integration checks with real models; no camera, saved photos or accuracy claims."""
from io import BytesIO
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import unittest
from types import SimpleNamespace
import threading
from unittest.mock import patch

import cv2
from insightface.data import get_image
import numpy as np
from PIL import Image
import requests

from api import RecognitionEngine


class EngineTests(unittest.TestCase):
    def test_match_unknown_and_quality_rejection(self):
        engine = RecognitionEngine.__new__(RecognitionEngine)
        engine.threshold, engine.margin = 0.5, 0.05
        engine.lock = threading.Lock()
        engine.identities = ['TEST_ID']
        engine.templates = np.eye(512, dtype=np.float32)[:1]
        vector = engine.templates[0].copy()
        engine.model = SimpleNamespace(
            det_model=SimpleNamespace(detect=lambda *a, **kw:
                                     (np.array([[0, 0, 112, 112, 0.9]]), np.zeros((1, 5, 2)))),
            models={'recognition': SimpleNamespace(get_feat=lambda image: vector)})
        quality = SimpleNamespace(reasons=[], aligned=np.zeros((112, 112, 3), dtype=np.uint8))
        with patch('api.decode_image', return_value=quality.aligned), patch('api.assess_face', return_value=quality):
            result = engine.recognize(b'fake', 'image/png')
            self.assertEqual(result.status, 'matched')
            self.assertEqual(result.student_id, 'TEST_ID')
            vector[:] = 0
            vector[1] = 1
            result = engine.recognize(b'fake', 'image/png')
            self.assertEqual(result.status, 'unknown')
            self.assertIsNone(result.student_id)
            quality.reasons = ['DARK: add light']
            self.assertEqual(engine.recognize(b'fake', 'image/png').status, 'low_quality')
        self.assertFalse(engine.lock.locked())


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}'
        cls.key = secrets.token_hex(32)
        env = dict(os.environ, AI_API_KEY=cls.key, AI_THRESHOLD='0.5')
        cls.server = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'api:app', '--host', '127.0.0.1',
             '--port', str(port), '--no-access-log'], env=env,
            cwd=Path(__file__).resolve().parent,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for _ in range(100):
            try:
                if requests.get(cls.base + '/health', timeout=1).status_code == 200:
                    return
            except requests.RequestException:
                pass
            if cls.server.poll() is not None:
                raise RuntimeError(cls.server.communicate()[0].decode(errors='replace'))
            time.sleep(0.2)
        output = cls.stop_server()
        raise RuntimeError('API did not start within the test timeout: ' + output.decode(errors='replace'))

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        try:
            output, _ = cls.server.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            output, _ = cls.server.communicate()
        return output

    @classmethod
    def tearDownClass(cls):
        cls.stop_server()

    def post(self, body, mime='image/png', key=None):
        return requests.post(self.base + '/recognize', data=body,
                             headers={'Content-Type': mime, 'X-API-Key': key or self.key}, timeout=20)

    def test_health_and_auth(self):
        self.assertTrue(requests.get(self.base + '/health', timeout=3).json()['model_ready'])
        response = requests.post(self.base + '/recognize', data=b'invalid', timeout=3)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.post(b'invalid', key='wrong').status_code, 401)

    def test_invalid_input(self):
        self.assertEqual(self.post(b'invalid', 'application/json').status_code, 415)
        self.assertEqual(self.post(b'').status_code, 400)
        self.assertEqual(self.post(b'not an image').status_code, 400)
        jpeg = cv2.imencode('.jpg', np.zeros((8, 8, 3), np.uint8))[1].tobytes()
        self.assertEqual(self.post(jpeg, 'image/png').status_code, 415)

    def test_registration_auth_and_validation(self):
        response = requests.post(self.base + '/registrations', json={}, timeout=3)
        self.assertEqual(response.status_code, 401)
        response = requests.post(self.base + '/registrations', json={},
                                 headers={'X-API-Key': self.key}, timeout=3)
        self.assertEqual(response.status_code, 422)

    def test_limits(self):
        self.assertEqual(self.post(b'x' * (5 * 1024 * 1024 + 1)).status_code, 413)
        output = BytesIO()
        Image.new('RGB', (4097, 1)).save(output, format='PNG')
        self.assertEqual(self.post(output.getvalue()).status_code, 413)

    def test_no_face_and_multiple_faces(self):
        blank = cv2.imencode('.png', np.zeros((480, 640, 3), np.uint8))[1].tobytes()
        response = self.post(blank)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['status'], 'no_face')
        self.assertIsNone(response.json()['student_id'])
        self.assertFalse(response.json()['attendance_recorded'])
        sample = cv2.imencode('.jpg', get_image('t1'))[1].tobytes()
        response = self.post(sample, 'image/jpeg')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['status'], 'multiple_faces')
        self.assertGreater(response.json()['face_count'], 1)


if __name__ == '__main__':
    unittest.main()
