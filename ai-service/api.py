"""Local AI HTTP service. No camera ownership or attendance writes."""
from contextlib import asynccontextmanager
import argparse
import base64
import binascii
from datetime import datetime, timezone
import hmac
from io import BytesIO
import json
import os
from pathlib import Path
import tempfile
import threading
from typing import Literal

import cv2
from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.security import APIKeyHeader
import numpy as np
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, ValidationError, field_validator
from starlette.concurrency import run_in_threadpool

from face_quality import assess_face
from recognize_faces import load_gallery, match_embedding
from register_face import ROOT, load_model, normalize_embedding, student_id

MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 4096
MAX_REGISTRATION_BYTES = 20 * 1024 * 1024
key_header = APIKeyHeader(name='X-API-Key', auto_error=False)


class RegistrationImage(BaseModel):
    content_type: Literal['image/jpeg', 'image/png']
    data_base64: str = Field(min_length=1, max_length=7 * 1024 * 1024)


class RegistrationRequest(BaseModel):
    student_id: str
    consent: bool = Field(strict=True)
    images: list[RegistrationImage] = Field(min_length=15, max_length=25)

    @field_validator('student_id')
    @classmethod
    def validate_id(cls, value):
        try:
            return student_id(value)
        except argparse.ArgumentTypeError as error:
            raise ValueError(str(error)) from None

    @field_validator('consent')
    @classmethod
    def require_consent(cls, value):
        if not value:
            raise ValueError('Participant consent is required')
        return value


class RecognitionResult(BaseModel):
    status: str
    student_id: str | None = None
    cosine: float | None = None
    face_count: int
    quality_reasons: list[str] = Field(default_factory=list)
    threshold: float
    threshold_calibrated: bool = False
    attendance_recorded: bool = False


def decode_image(data, content_type):
    try:
        with Image.open(BytesIO(data)) as image:
            expected = {'image/jpeg': 'JPEG', 'image/png': 'PNG'}[content_type]
            if image.format != expected:
                raise HTTPException(415, 'Image format does not match Content-Type')
            if not 1 <= image.width <= MAX_SIDE or not 1 <= image.height <= MAX_SIDE:
                raise HTTPException(413, 'Maximum image dimensions: 4096 x 4096')
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(400, 'Invalid or damaged image') from None
    try:
        frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8),
                             cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION)
    except cv2.error:
        frame = None
    if frame is None:
        raise HTTPException(400, 'Cannot decode image')
    return frame


class RecognitionEngine:
    def __init__(self, threshold, margin):
        self.threshold, self.margin = threshold, margin
        self.model = load_model()
        self.registration_dir = ROOT / 'data' / 'registrations'
        if self.registration_dir.exists() and any(self.registration_dir.glob('*/COMPLETE')):
            self.identities, self.templates = load_gallery(
                self.registration_dir, Path(self.model.models['recognition'].model_file).name)
        else:
            self.identities, self.templates = [], np.empty((0, 512), dtype=np.float32)
        self.lock = threading.Lock()

    def recognize(self, data, content_type):
        if not self.lock.acquire(blocking=False):
            raise HTTPException(503, 'AI is busy; retry later', headers={'Retry-After': '1'})
        try:
            frame = decode_image(data, content_type)
            boxes, landmarks = self.model.det_model.detect(frame, max_num=0, metric='default')
            result = dict(face_count=len(boxes), threshold=self.threshold)
            if not len(boxes):
                return RecognitionResult(status='no_face', **result)
            if len(boxes) > 1:
                return RecognitionResult(status='multiple_faces', **result)
            points = landmarks[0] if landmarks is not None else None
            quality = assess_face(frame, boxes[0, :4], points)
            if quality.reasons:
                return RecognitionResult(status='low_quality', quality_reasons=quality.reasons, **result)
            if not self.identities:
                return RecognitionResult(status='gallery_empty', **result)
            vector = self.model.models['recognition'].get_feat(quality.aligned).flatten()
            identity, score = match_embedding(vector, self.identities, self.templates,
                                              self.threshold, self.margin)
            return RecognitionResult(status='matched' if identity else 'unknown',
                                     student_id=identity, cosine=score, **result)
        finally:
            self.lock.release()

    def register(self, payload):
        if not self.lock.acquire(blocking=False):
            raise HTTPException(503, 'AI is busy; retry later', headers={'Retry-After': '1'})
        try:
            destination = self.registration_dir / payload.student_id
            images, vectors = [], []
            seen = set()
            rejection_reasons = []
            for index, item in enumerate(payload.images, 1):
                try:
                    data = base64.b64decode(item.data_base64, validate=True)
                except (binascii.Error, ValueError):
                    rejection_reasons.append(f'Image {index}: invalid base64')
                    continue
                if not data or len(data) > MAX_BYTES:
                    rejection_reasons.append(f'Image {index}: empty or larger than 5 MiB')
                    continue
                # Exact duplicate images are not distinct enrollment samples.
                import hashlib
                digest = hashlib.sha256(data).digest()
                if digest in seen:
                    rejection_reasons.append(f'Image {index}: duplicate image')
                    continue
                seen.add(digest)
                frame = decode_image(data, item.content_type)
                boxes, landmarks = self.model.det_model.detect(frame, max_num=0, metric='default')
                if len(boxes) != 1 or landmarks is None:
                    rejection_reasons.append(f'Image {index}: exactly one face with landmarks required')
                    continue
                quality = assess_face(frame, boxes[0, :4], landmarks[0])
                if quality.reasons:
                    rejection_reasons.append(f'Image {index}: {", ".join(quality.reasons)}')
                    continue
                vector = self.model.models['recognition'].get_feat(quality.aligned).flatten()
                vectors.append(normalize_embedding(vector))
                images.append(quality.aligned.copy())

            if len(vectors) < 15:
                first_reason = rejection_reasons[0] if rejection_reasons else 'Không đủ mẫu ảnh đạt chuẩn'
                raise HTTPException(422, f'Cần tối thiểu 15 ảnh đạt chuẩn (hiện chỉ có {len(vectors)}/{len(payload.images)} đạt). Lý do: {first_reason}')
            template = normalize_embedding(np.stack(vectors).mean(axis=0))
            if payload.student_id in self.identities:
                idx = self.identities.index(payload.student_id)
                new_templates = self.templates.copy()
                new_templates[idx] = template
                new_identities = list(self.identities)
            else:
                new_templates = np.vstack([self.templates, template]) if len(self.templates) > 0 else np.array([template])
                new_identities = self.identities + [payload.student_id]
            self.registration_dir.mkdir(parents=True, exist_ok=True)
            # Write a complete bundle outside the gallery, then atomically publish.
            with tempfile.TemporaryDirectory(prefix='enrollment_', dir=self.registration_dir.parent) as temp:
                staging = Path(temp) / 'bundle'
                staging.mkdir()
                for index, image in enumerate(images, 1):
                    ok, encoded = cv2.imencode('.jpg', image)
                    if not ok:
                        raise RuntimeError('Cannot encode registration image')
                    (staging / f'{index:02d}.jpg').write_bytes(encoded.tobytes())
                np.savez_compressed(staging / 'embeddings.npz', embeddings=np.stack(vectors))
                metadata = dict(student_id=payload.student_id,
                                created_at=datetime.now(timezone.utc).isoformat(),
                                consent_confirmed_by_operator=True, model_pack='buffalo_l',
                                recognition_model=Path(self.model.models['recognition'].model_file).name,
                                insightface_version='2.1', dimensions=512, normalized=True,
                                samples=len(images), image_size=[112, 112])
                (staging / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
                (staging / 'COMPLETE').touch()
                import shutil
                backup = Path(temp) / 'previous_bundle'
                if destination.exists():
                    shutil.move(str(destination), str(backup))
                try:
                    shutil.move(str(staging), str(destination))
                except Exception:
                    if not destination.exists() and backup.exists():
                        shutil.move(str(backup), str(destination))
                    raise
            self.identities, self.templates = new_identities, new_templates
            return {'status': 'registered', 'student_id': payload.student_id,
                    'samples': len(images), 'dimensions': 512}
        finally:
            self.lock.release()


@asynccontextmanager
async def lifespan(app):
    api_key = os.environ.get('AI_API_KEY', '')
    if len(api_key) < 32 or not api_key.isascii():
        raise RuntimeError('Set AI_API_KEY to a private ASCII value of at least 32 characters')
    try:
        threshold = float(os.environ['AI_THRESHOLD'])
        margin = float(os.environ.get('AI_MARGIN', '0.05'))
    except (KeyError, ValueError):
        raise RuntimeError('Set AI_THRESHOLD explicitly (provisional demo value: 0.5)') from None
    if not -1 <= threshold <= 1 or not 0 <= margin <= 2:
        raise RuntimeError('Invalid AI_THRESHOLD or AI_MARGIN')
    app.state.api_key = api_key
    app.state.engine = await run_in_threadpool(RecognitionEngine, threshold, margin)
    try:
        yield
    finally:
        del app.state.engine
        del app.state.api_key


app = FastAPI(title='Face Attendance AI Service', version='0.1.0', lifespan=lifespan)


async def authorize(request: Request, provided: str | None = Security(key_header)):
    if provided is None or not hmac.compare_digest(provided.encode('utf-8'),
                                                   request.app.state.api_key.encode('ascii')):
        raise HTTPException(401, 'Invalid or missing API key')


@app.get('/health')
async def health():
    return {'status': 'ok', 'model_ready': True, 'provider': 'CPUExecutionProvider',
            'threshold_calibrated': False}


@app.post('/recognize', response_model=RecognitionResult,
          dependencies=[Security(authorize)],
          openapi_extra={'requestBody': {'required': True, 'content': {
              mime: {'schema': {'type': 'string', 'format': 'binary'}}
              for mime in ('image/jpeg', 'image/png')}}})
async def recognize(request: Request):
    """Send raw JPEG/PNG bytes, not multipart or JSON. Single-frame result only."""
    content_type = request.headers.get('content-type', '').split(';')[0].strip().lower()
    if content_type not in ('image/jpeg', 'image/png'):
        raise HTTPException(415, 'Send raw image/jpeg or image/png bytes')
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, 'Maximum upload size: 5 MiB')
        data.extend(chunk)
    if not data:
        raise HTTPException(400, 'Empty image body')
    return await run_in_threadpool(request.app.state.engine.recognize, bytes(data), content_type)


@app.get('/registrations', dependencies=[Security(authorize)])
async def list_registrations(request: Request):
    return {'identities': request.app.state.engine.identities}


@app.post('/registrations', status_code=201, dependencies=[Security(authorize)],
          openapi_extra={'requestBody': {'required': True, 'content': {'application/json': {
              'schema': {'type': 'object', 'required': ['student_id', 'consent', 'images'],
                         'properties': {'student_id': {'type': 'string'},
                                        'consent': {'type': 'boolean'},
                                        'images': {'type': 'array', 'minItems': 15, 'maxItems': 25,
                                                   'items': {'type': 'object', 'properties': {
                                                       'content_type': {'enum': ['image/jpeg', 'image/png']},
                                                       'data_base64': {'type': 'string'}}}}}}}}}})
async def register(request: Request):
    """15-25 distinct images, one consenting participant; no training or identity verification."""
    if request.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
        raise HTTPException(415, 'Send application/json')
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_REGISTRATION_BYTES:
            raise HTTPException(413, 'Maximum registration JSON size: 20 MiB')
        body.extend(chunk)
    try:
        payload = RegistrationRequest.model_validate_json(bytes(body))
    except ValidationError as error:
        raise HTTPException(422, [{'loc': item['loc'], 'msg': item['msg'], 'type': item['type']}
                                  for item in error.errors()]) from None
    return await run_in_threadpool(request.app.state.engine.register, payload)
