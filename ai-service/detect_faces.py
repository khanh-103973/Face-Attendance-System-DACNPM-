"""Face detection preview only: no identity matching or image storage."""

import argparse
from pathlib import Path
import time

import cv2
import numpy as np
from insightface.app import FaceAnalysis
from face_quality import assess_face


def load_detector():
    root = Path(__file__).resolve().parent / 'models'
    print('Loading buffalo_l detector on CPU. First run may download model weights.')
    app = FaceAnalysis(name='buffalo_l', root=str(root),
                       allowed_modules=['detection'],
                       providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.5)
    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--backend', choices=['dshow', 'msmf'], default='dshow')
    parser.add_argument('--min-face-size', type=int, default=100)
    parser.add_argument('--min-brightness', type=float, default=50.0)
    parser.add_argument('--min-sharpness', type=float, default=60.0)
    parser.add_argument('--check-model', action='store_true',
                        help='Load model and run a blank frame without opening camera')
    args = parser.parse_args()
    if (args.min_face_size <= 0 or not 0 <= args.min_brightness <= 255
            or not np.isfinite(args.min_sharpness) or args.min_sharpness < 0):
        parser.error('Invalid quality thresholds')
    try:
        app = load_detector()
        if args.check_model:
            faces = app.get(np.zeros((480, 640, 3), dtype=np.uint8))
            if faces:
                raise RuntimeError('Unexpected face detection on a blank frame')
            print(f'Model inference OK; blank frame detections: {len(faces)}')
            from insightface.data import get_image
            sample_faces = app.get(get_image('t1'))
            if not sample_faces or any(face.kps is None for face in sample_faces):
                raise RuntimeError('Bundled sample did not produce faces with landmarks')
            if set(app.models) != {'detection'}:
                raise RuntimeError('Unexpected module enabled')
            print(f'Bundled sample: {len(sample_faces)} faces with landmarks; detection only.')
            return 0
    except Exception as error:
        print(f'Model initialization failed: {error}')
        print('Check network/model download and dependencies. See README.md.')
        return 1

    backend = cv2.CAP_DSHOW if args.backend == 'dshow' else cv2.CAP_MSMF
    camera = cv2.VideoCapture(args.camera, backend)
    title = 'Face Detection - Q/Esc: exit'
    try:
        if not camera.isOpened():
            print('Cannot open camera. Close other camera apps; try --camera 1 or --backend msmf.')
            return 1
        while True:
            ok, frame = camera.read()
            if not ok or frame is None:
                print('Cannot read camera frame. Check camera connection.')
                return 1
            start = time.perf_counter()
            faces = app.get(frame)
            inference_ms = (time.perf_counter() - start) * 1000
            height, width = frame.shape[:2]
            # Evaluate original pixels before drawing annotations.
            qualities = [assess_face(frame, face.bbox, face.kps,
                                     min_size=args.min_face_size,
                                     min_brightness=args.min_brightness,
                                     min_sharpness=args.min_sharpness) for face in faces]
            preview = np.zeros((280, 560, 3), dtype=np.uint8)
            cv2.putText(preview, 'No face', (15, 30), cv2.FONT_HERSHEY_SIMPLEX,
                        0.6, (255, 255, 255), 1)
            if faces:
                selected = max(range(len(faces)), key=lambda i:
                               (faces[i].bbox[2] - faces[i].bbox[0]) *
                               (faces[i].bbox[3] - faces[i].bbox[1]))
                quality = qualities[selected]
                preview[:] = 0
                if quality.aligned is not None:
                    preview[0:224, 0:224] = cv2.resize(quality.aligned, (224, 224))
                labels = quality.reasons or ['QUALITY OK (heuristic)']
                for row, label in enumerate(labels):
                    cv2.putText(preview, label, (230, 25 + row * 24),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
                if quality.brightness is not None:
                    cv2.putText(preview, f'Brightness: {quality.brightness:.1f}  Sharpness: {quality.sharpness:.1f}',
                                (10, 253), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            for face, quality in zip(faces, qualities):
                x1, y1, x2, y2 = face.bbox.astype(int)
                x1, x2 = np.clip([x1, x2], 0, width - 1)
                y1, y2 = np.clip([y1, y2], 0, height - 1)
                color = (0, 165, 255) if quality.reasons else (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                status = 'CHECK' if quality.reasons else 'OK'
                cv2.putText(frame, f'Face {face.det_score:.2f} {status}',
                            (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX,
                            0.6, (0, 255, 0), 2)
                if face.kps is not None:
                    for x, y in face.kps.astype(int):
                        cv2.circle(frame, (x, y), 3, (0, 0, 255), -1)
            cv2.putText(frame, f'Faces: {len(faces)} | CPU inference: {inference_ms:.0f} ms',
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            cv2.imshow(title, frame)
            cv2.imshow('Aligned face - largest face', preview)
            if cv2.waitKey(1) & 0xFF in (ord('q'), ord('Q'), 27):
                break
            if cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
            if cv2.getWindowProperty('Aligned face - largest face', cv2.WND_PROP_VISIBLE) < 1:
                break
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        print(f'Detection failed: {error}')
        return 1
    finally:
        camera.release()
        cv2.destroyAllWindows()
        print('Camera released.')


if __name__ == '__main__':
    raise SystemExit(main())
