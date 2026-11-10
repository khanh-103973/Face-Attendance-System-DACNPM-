"""Local cosine recognition demo; no attendance records or image capture."""
import argparse
import json
import time

import cv2
import numpy as np

from face_quality import assess_face
from register_face import ROOT, load_model, normalize_embedding, student_id
from validation_log import ValidationLog


def load_gallery(directory, model_file):
    identities, templates = [], []
    if not directory.exists():
        raise ValueError('No registrations found. Run register_face.py first.')
    for folder in sorted(directory.iterdir()):
        if not folder.is_dir():
            continue
        if not (folder / 'COMPLETE').is_file():
            print(f'Skipping incomplete registration: {folder.name}')
            continue
        metadata = json.loads((folder / 'metadata.json').read_text(encoding='utf-8'))
        identifier = student_id(folder.name)
        if (metadata.get('student_id') != identifier
                or metadata.get('model_pack') != 'buffalo_l'
                or metadata.get('recognition_model') != model_file
                or metadata.get('dimensions') != 512
                or metadata.get('normalized') is not True):
            raise ValueError(f'Incompatible registration metadata: {identifier}')
        with np.load(folder / 'embeddings.npz', allow_pickle=False) as archive:
            vectors = archive['embeddings']
        if (vectors.ndim != 2 or vectors.shape[1] != 512
                or not 15 <= len(vectors) <= 25
                or metadata.get('samples') != len(vectors)
                or not np.isfinite(vectors).all()
                or not np.allclose(np.linalg.norm(vectors, axis=1), 1, atol=1e-4)):
            raise ValueError(f'Invalid embedding data: {identifier}')
        # One equally weighted, normalized mean template per student.
        templates.append(normalize_embedding(vectors.mean(axis=0)))
        identities.append(identifier)
    if not templates:
        raise ValueError('No complete compatible registrations found.')
    return identities, np.stack(templates)


def match_embedding(vector, identities, templates, threshold, margin):
    scores = np.clip(templates @ normalize_embedding(vector), -1, 1)
    order = np.argsort(scores)[::-1]
    best = int(order[0])
    score = float(scores[best])
    ambiguous = len(order) > 1 and score - float(scores[order[1]]) < margin
    return (None if score < threshold or ambiguous else identities[best]), score


class StableIdentity:
    def __init__(self, required=3):
        self.required = required
        self.previous = None
        self.count = 0

    def update(self, identity):
        self.count = self.count + 1 if identity is not None and identity == self.previous else 1
        self.previous = identity
        if identity is None:
            self.count = 0
        return identity if self.count >= self.required else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--threshold', type=float, required=True,
                        help='Provisional cosine cutoff; must be calibrated on separate validation data')
    parser.add_argument('--margin', type=float, default=0.05)
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--backend', choices=['dshow', 'msmf'], default='dshow')
    parser.add_argument('--check-gallery', action='store_true', help='Validate data without opening camera')
    parser.add_argument('--expected', help='Operator label: registered student ID or Unknown')
    parser.add_argument('--session', type=student_id, help='Unique collection session, e.g. day2_morning')
    parser.add_argument('--split', choices=['validation', 'test'], default='validation')
    parser.add_argument('--consent', action='store_true', help='Participant agreed to this labeled test')
    args = parser.parse_args()
    if not -1 <= args.threshold <= 1 or not 0 <= args.margin <= 2:
        parser.error('Threshold must be [-1, 1], margin [0, 2]')
    if args.expected and (not args.session or not args.consent):
        parser.error('Labeled trials require --session and --consent')
    try:
        app = load_model()
        from pathlib import Path
        identities, templates = load_gallery(ROOT / 'data' / 'registrations',
                                             Path(app.models['recognition'].model_file).name)
        print(f'Gallery OK: {len(identities)} students, templates {templates.shape}')
        if args.expected and args.expected != 'Unknown' and args.expected not in identities:
            raise ValueError('--expected must be an enrolled ID or the literal Unknown')
        print(f'DEMO threshold={args.threshold}; not calibrated. No attendance is recorded.')
        if args.check_gallery:
            return 0
    except Exception as error:
        print(f'Initialization failed: {error}')
        return 1
    camera = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW if args.backend == 'dshow' else cv2.CAP_MSMF)
    stable = StableIdentity()
    title = 'Cosine recognition demo - Q/Esc: exit'
    log = None
    last_record = float('-inf')
    try:
        if not camera.isOpened():
            raise RuntimeError('Cannot open camera; close other apps or try --backend msmf.')
        if args.expected:
            log = ValidationLog(ROOT / 'data' / 'validation', args.session, args.split,
                                args.expected, args.threshold, args.margin)
            print(f'Expected label: {args.expected}. SPACE records one trial. CSV: {log.path}')
        while True:
            ok, frame = camera.read()
            if not ok or frame is None:
                raise RuntimeError('Cannot read camera frame')
            boxes, landmarks = app.det_model.detect(frame, max_num=0, metric='default')
            label, color = 'No face', (0, 255, 255)
            identity = None
            status = 'no_face'
            candidate, score, runner_up = '', '', ''
            if len(boxes) > 1:
                label = 'One person at a time'
                status = 'multiple_faces'
            elif len(boxes) == 1 and landmarks is not None:
                quality = assess_face(frame, boxes[0, :4], landmarks[0])
                if quality.reasons:
                    label = 'Quality: ' + '; '.join(quality.reasons)
                    status = 'quality_rejected'
                else:
                    vector = app.models['recognition'].get_feat(quality.aligned).flatten()
                    identity, score = match_embedding(vector, identities, templates,
                                                      args.threshold, args.margin)
                    scores = np.clip(templates @ normalize_embedding(vector), -1, 1)
                    order = np.argsort(scores)[::-1]
                    candidate = identities[int(order[0])]
                    runner_up = float(scores[order[1]]) if len(order) > 1 else ''
                    status = 'evaluated'
                    label = f'Unknown | cosine {score:.3f}' if identity is None else f'Checking | cosine {score:.3f}'
                x1, y1, x2, y2 = boxes[0, :4].astype(int)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            elif len(boxes) == 1:
                status, label = 'quality_rejected', 'Missing landmarks'
            confirmed = stable.update(identity)
            if confirmed:
                label, color = f'{confirmed} | cosine {score:.3f}', (0, 255, 0)
            cv2.putText(frame, label, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
            cv2.putText(frame, 'DEMO - uncalibrated threshold - no attendance', (10, 55),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 1)
            if log:
                cv2.putText(frame, f'Expected: {args.expected} | SPACE: record | Saved: {log.count}',
                            (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            cv2.imshow(title, frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord('q'), ord('Q'), 27):
                break
            if log and key == 32 and time.monotonic() - last_record >= 0.8:
                log.record(candidate=candidate, cosine=score, runner_up_cosine=runner_up,
                           raw_prediction=(identity or 'Unknown') if status == 'evaluated' else '',
                           stable_prediction=(confirmed or '') if status == 'evaluated' else '',
                           status=status)
                last_record = time.monotonic()
                print(f'Recorded trial {log.count}: {status}')
            if cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        print(f'Recognition failed: {error}')
        return 1
    finally:
        if log:
            log.close()
            print(f'Saved {log.count} labeled trials: {log.path}')
        camera.release()
        cv2.destroyAllWindows()
        print('Camera released.')


if __name__ == '__main__':
    raise SystemExit(main())
