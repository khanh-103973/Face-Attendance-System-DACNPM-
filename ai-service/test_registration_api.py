import base64
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import cv2
from fastapi import HTTPException
import numpy as np
from pydantic import ValidationError

from api import RecognitionEngine, RegistrationRequest
from recognize_faces import load_gallery


class RegistrationTests(unittest.TestCase):
    def payload(self, **changes):
        rng = np.random.default_rng(12)
        images = []
        for _ in range(15):
            frame = rng.integers(70, 220, (112, 112, 3), dtype=np.uint8)
            data = cv2.imencode('.png', frame)[1].tobytes()
            images.append({'content_type': 'image/png', 'data_base64': base64.b64encode(data).decode()})
        return dict(student_id='TEST_ONLY', consent=True, images=images, **changes)

    def engine(self, directory):
        engine = RecognitionEngine.__new__(RecognitionEngine)
        engine.registration_dir = Path(directory) / 'registrations'
        engine.identities, engine.templates = [], np.empty((0, 512), np.float32)
        engine.lock = threading.Lock()
        engine.model = SimpleNamespace(
            det_model=SimpleNamespace(detect=lambda *a, **kw:
                                     (np.array([[0, 0, 112, 112, 0.9]]), np.zeros((1, 5, 2)))),
            models={'recognition': SimpleNamespace(model_file='test.onnx',
                                                   get_feat=lambda image: np.eye(512, dtype=np.float32)[0])})
        return engine

    def test_atomic_save_gallery_refresh_and_safe_reregistration(self):
        with tempfile.TemporaryDirectory() as temp:
            engine = self.engine(temp)
            payload = RegistrationRequest.model_validate(self.payload())
            quality = SimpleNamespace(reasons=[], aligned=np.zeros((112, 112, 3), np.uint8))
            with patch('api.assess_face', return_value=quality):
                self.assertEqual(engine.register(payload)['samples'], 15)
                ids, templates = load_gallery(engine.registration_dir, 'test.onnx')
                self.assertEqual(ids, ['TEST_ONLY'])
                self.assertEqual(templates.shape, (1, 512))
                self.assertEqual(engine.identities, ids)
                original_template = engine.templates.copy()

            # Failed re-registration (quality check failure) must preserve existing registration
            bad_quality = SimpleNamespace(reasons=['DARK: add light'], aligned=None)
            with patch('api.assess_face', return_value=bad_quality):
                with self.assertRaises(HTTPException) as caught:
                    engine.register(payload)
                self.assertEqual(caught.exception.status_code, 422)
            ids_after_fail, templates_after_fail = load_gallery(engine.registration_dir, 'test.onnx')
            self.assertEqual(ids_after_fail, ['TEST_ONLY'])
            np.testing.assert_allclose(templates_after_fail, original_template)
            np.testing.assert_allclose(engine.templates, original_template)

            # Failed re-registration during staging/publish must restore previous bundle and preserve gallery
            with patch('api.assess_face', return_value=quality):
                real_move = __import__('shutil').move
                call_count = {'n': 0}

                def fail_on_publish(src, dst, *args, **kwargs):
                    call_count['n'] += 1
                    if call_count['n'] == 2:
                        raise OSError('Simulated disk error during publish')
                    return real_move(src, dst, *args, **kwargs)

                with patch('shutil.move', side_effect=fail_on_publish):
                    with self.assertRaises(OSError):
                        engine.register(payload)

            self.assertTrue((engine.registration_dir / 'TEST_ONLY' / 'COMPLETE').is_file())
            ids_after_io_error, templates_after_io_error = load_gallery(engine.registration_dir, 'test.onnx')
            self.assertEqual(ids_after_io_error, ['TEST_ONLY'])
            np.testing.assert_allclose(templates_after_io_error, original_template)
            np.testing.assert_allclose(engine.templates, original_template)

            # Successful re-registration updates existing student without duplicating identity
            engine.model.models['recognition'].get_feat = lambda image: np.eye(512, dtype=np.float32)[1]
            with patch('api.assess_face', return_value=quality):
                self.assertEqual(engine.register(payload)['status'], 'registered')
                self.assertEqual(engine.identities, ['TEST_ONLY'])
                self.assertEqual(engine.templates.shape, (1, 512))
                self.assertAlmostEqual(float(engine.templates[0, 1]), 1.0, places=5)
            self.assertFalse(engine.lock.locked())

    def test_failed_quality_or_duplicate_leaves_no_registration(self):
        with tempfile.TemporaryDirectory() as temp:
            engine = self.engine(temp)
            data = self.payload()
            quality = SimpleNamespace(reasons=['DARK'], aligned=None)
            with patch('api.assess_face', return_value=quality):
                with self.assertRaises(HTTPException):
                    engine.register(RegistrationRequest.model_validate(data))
            quality = SimpleNamespace(reasons=[], aligned=np.zeros((112, 112, 3), np.uint8))
            data['images'][1] = data['images'][0]
            with patch('api.assess_face', return_value=quality):
                with self.assertRaises(HTTPException) as caught:
                    engine.register(RegistrationRequest.model_validate(data))
                self.assertEqual(caught.exception.status_code, 422)
            self.assertFalse((engine.registration_dir / 'TEST_ONLY').exists())
            self.assertEqual(engine.identities, [])

    def test_validation(self):
        for field, value in [('student_id', '../escape'), ('consent', False),
                             ('consent', 'true'), ('images', [])]:
            data = self.payload()
            data[field] = value
            with self.assertRaises(ValidationError):
                RegistrationRequest.model_validate(data)


if __name__ == '__main__':
    unittest.main()
