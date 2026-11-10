"""Deterministic pipeline checks; these do not measure recognition accuracy."""
import unittest

import cv2
import numpy as np
from insightface.utils.face_align import arcface_dst

from face_quality import assess_face


class FaceQualityTests(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(7)
        self.frame = rng.integers(70, 220, (112, 112, 3), dtype=np.uint8)
        self.box = [0, 0, 112, 112]

    def test_alignment_and_blur(self):
        result = assess_face(self.frame, self.box, arcface_dst)
        self.assertEqual(result.aligned.shape, (112, 112, 3))
        self.assertEqual(result.reasons, [])
        blurred = cv2.GaussianBlur(self.frame, (15, 15), 4)
        rejected = assess_face(blurred, self.box, arcface_dst)
        self.assertTrue(any('BLUR' in reason for reason in rejected.reasons))
        self.assertLess(rejected.sharpness, result.sharpness)

    def test_dark_small_and_edge(self):
        dark = np.full_like(self.frame, 10)
        result = assess_face(dark, [-1, 0, 70, 90], arcface_dst)
        for expected in ('DARK', 'SMALL', 'EDGE'):
            self.assertTrue(any(expected in reason for reason in result.reasons))

    def test_invalid_geometry(self):
        for landmarks in (None, np.zeros((5, 2)), np.full((5, 2), np.nan)):
            self.assertIn('INVALID LANDMARKS',
                          assess_face(self.frame, self.box, landmarks).reasons)
        self.assertIn('INVALID BOX',
                      assess_face(self.frame, [30, 20, 10, 10], arcface_dst).reasons)

    def test_pose_offset_message_has_no_fake_degrees(self):
        skewed = arcface_dst.copy()
        skewed[2, 0] = skewed[0, 0] + 1.0  # Nose shifted near left eye -> large horizontal offset ratio
        result = assess_face(self.frame, self.box, skewed)
        pose_reasons = [r for r in result.reasons if r.startswith('POSE:')]
        self.assertEqual(len(pose_reasons), 1)
        self.assertNotIn('deg', pose_reasons[0])
        self.assertNotIn('°', pose_reasons[0])


if __name__ == '__main__':
    unittest.main()
