"""Heuristic quality checks, not recognition confidence or liveness checks."""

from dataclasses import dataclass

import cv2
import numpy as np
from insightface.utils.face_align import norm_crop


@dataclass
class QualityResult:
    reasons: list[str]
    brightness: float | None = None
    sharpness: float | None = None
    aligned: np.ndarray | None = None
    yaw: float | None = None
    pitch: float | None = None
    roll: float | None = None


def assess_face(frame, bbox, landmarks, *, min_size=72,
                min_brightness=25.0, min_sharpness=18.0, max_yaw=38.0):
    """Measure crop quality, blur, brightness, and head pose orientation."""
    height, width = frame.shape[:2]
    box = np.asarray(bbox, dtype=float)
    if box.shape != (4,) or not np.isfinite(box).all():
        return QualityResult(['INVALID BOX'])
    x1, y1, x2, y2 = box
    if x2 <= x1 or y2 <= y1:
        return QualityResult(['INVALID BOX'])
    reasons = []
    if x1 < 0 or y1 < 0 or x2 > width or y2 > height:
        reasons.append('EDGE: move to center')
    if min(x2 - x1, y2 - y1) < min_size:
        reasons.append('SMALL: move closer')
    points = np.asarray(landmarks, dtype=float)
    if points.shape != (5, 2) or not np.isfinite(points).all():
        return QualityResult(reasons + ['INVALID LANDMARKS'])
    if (points[:, 0].min() < 0 or points[:, 0].max() >= width
            or points[:, 1].min() < 0 or points[:, 1].max() >= height
            or np.linalg.norm(points[0] - points[1]) < 5):
        return QualityResult(reasons + ['INVALID LANDMARKS'])

    # 1. Ước lượng góc xoay khuôn mặt (Head Pose Estimation: Yaw, Pitch, Roll)
    dx = points[1, 0] - points[0, 0]
    dy = points[1, 1] - points[0, 1]
    roll = float(np.degrees(np.arctan2(dy, dx)))

    dist_left = abs(points[2, 0] - points[0, 0])
    dist_right = abs(points[1, 0] - points[2, 0])
    total_x = dist_left + dist_right
    yaw = float(((dist_left - dist_right) / total_x) * 90.0) if total_x > 1e-4 else 0.0

    eye_mid_y = (points[0, 1] + points[1, 1]) / 2.0
    mouth_mid_y = (points[3, 1] + points[4, 1]) / 2.0
    nose_y = points[2, 1]
    d_eye = abs(nose_y - eye_mid_y)
    d_mouth = abs(mouth_mid_y - nose_y)
    total_y = d_eye + d_mouth
    pitch = float(((d_eye - d_mouth) / total_y) * 45.0) if total_y > 1e-4 else 0.0

    if max_yaw is not None and abs(yaw) > max_yaw:
        reasons.append('POSE: face offset too large, look closer to center')

    # 2. Căn chỉnh ảnh khuôn mặt thẳng đứng về 112x112
    aligned = norm_crop(frame, points.astype(np.float32), image_size=112)
    gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if brightness < min_brightness:
        reasons.append('DARK: add light')
    if sharpness < min_sharpness:
        reasons.append('BLUR: hold still / focus')
    return QualityResult(reasons, brightness, sharpness, aligned, yaw, pitch, roll)
