"""Local, consent-based enrollment using pretrained ArcFace. No training."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import time

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from face_quality import assess_face

ROOT = Path(__file__).resolve().parent
RESERVED = {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1, 10)),
            *(f'LPT{i}' for i in range(1, 10))}


def student_id(value):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,49}', value) or value.upper() in RESERVED:
        raise argparse.ArgumentTypeError('Use 1-50 letters/digits/_/-, starting with a letter/digit.')
    return value


def load_model():
    app = FaceAnalysis(name='buffalo_l', root=str(ROOT / 'models'),
                       allowed_modules=['detection', 'recognition'],
                       providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.5)
    if 'recognition' not in app.models:
        raise RuntimeError('ArcFace recognition model missing')
    return app


def normalize_embedding(value):
    vector = np.asarray(value, dtype=np.float32)
    if vector.shape != (512,) or not np.isfinite(vector).all():
        raise ValueError('Expected a finite 512-dimensional embedding')
    norm = np.linalg.norm(vector)
    if norm < 1e-8:
        raise ValueError('Empty embedding')
    return vector / norm


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--student-id', required=True, type=student_id)
    parser.add_argument('--consent', action='store_true',
                        help='Operator confirms participant consent to local images and embeddings')
    parser.add_argument('--samples', type=int, choices=range(15, 26), default=20)
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--backend', choices=['dshow', 'msmf'], default='dshow')
    args = parser.parse_args()
    if not args.consent:
        parser.error('Participant consent is required. Explain purpose/storage/deletion first, then use --consent.')
    destination = ROOT / 'data' / 'registrations' / args.student_id
    if destination.exists():
        parser.error('Student directory already exists; review it before re-enrolling. Nothing overwritten.')
    try:
        app = load_model()
    except Exception as error:
        print(f'Model initialization failed: {error}')
        return 1
    camera = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW if args.backend == 'dshow' else cv2.CAP_MSMF)
    title = 'Registration - SPACE: capture, Q/Esc: cancel'
    samples, embeddings = [], []
    last_capture = float('-inf')
    message = 'Only one participant. SPACE: capture. Q/Esc: cancel.'
    try:
        if not camera.isOpened():
            raise RuntimeError('Cannot open camera. Close other camera apps or try --backend msmf.')
        print('Verify this is the correct student. Change angle/light slightly between captures.')
        while len(samples) < args.samples:
            ok, frame = camera.read()
            if not ok or frame is None:
                raise RuntimeError('Cannot read camera frame')
            # Detect first, extract embeddings only when the operator captures.
            boxes, landmarks = app.det_model.detect(frame, max_num=0, metric='default')
            quality = None
            if len(boxes) == 1 and landmarks is not None:
                quality = assess_face(frame, boxes[0, :4], landmarks[0])
            display = frame.copy()
            for box in boxes:
                x1, y1, x2, y2 = box[:4].astype(int)
                cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 0), 2)
            status = 'Exactly one face required'
            if quality is not None:
                status = '; '.join(quality.reasons) or 'Quality OK - SPACE to capture'
            for row, text in enumerate((f'Samples: {len(samples)}/{args.samples}', status, message)):
                cv2.putText(display, text, (10, 28 + row * 26), cv2.FONT_HERSHEY_SIMPLEX,
                            0.5, (0, 255, 255), 1)
            cv2.imshow(title, display)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord('q'), ord('Q'), 27) or cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                print('Enrollment cancelled. No samples saved.')
                return 0
            if key != 32:
                continue
            if quality is None or quality.reasons:
                message = 'Rejected: fix quality / number of faces.'
                continue
            if time.monotonic() - last_capture < 0.8:
                message = 'Wait briefly and change pose slightly.'
                continue
            vector = app.models['recognition'].get_feat(quality.aligned).flatten()
            embeddings.append(normalize_embedding(vector))
            samples.append(quality.aligned.copy())
            last_capture = time.monotonic()
            message = 'Captured. Change pose slightly; verify correct participant.'
        # Save only after a complete session; never overwrite an existing student.
        destination.mkdir(parents=True, exist_ok=False)
        for index, image in enumerate(samples, 1):
            if not cv2.imwrite(str(destination / f'{index:02d}.jpg'), image):
                raise RuntimeError('Failed saving image')
        np.savez_compressed(destination / 'embeddings.npz', embeddings=np.stack(embeddings))
        metadata = {
            'student_id': args.student_id, 'created_at': datetime.now(timezone.utc).isoformat(),
            'consent_confirmed_by_operator': True, 'model_pack': 'buffalo_l',
            'recognition_model': Path(app.models['recognition'].model_file).name,
            'insightface_version': '2.1', 'dimensions': 512,
            'normalized': True, 'samples': len(samples), 'image_size': [112, 112],
        }
        (destination / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        # This marker distinguishes complete enrollment from interrupted writes.
        (destination / 'COMPLETE').touch()
        print(f'Saved {len(samples)} images and embeddings to {destination}')
        return 0
    except KeyboardInterrupt:
        print('Interrupted. If saving had started, a directory without COMPLETE is incomplete.')
        return 1
    except Exception as error:
        print(f'Enrollment failed: {error}')
        print('A directory without COMPLETE is incomplete; review before retrying.')
        return 1
    finally:
        camera.release()
        cv2.destroyAllWindows()
        print('Camera released.')


if __name__ == '__main__':
    raise SystemExit(main())
