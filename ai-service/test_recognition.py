"""Matching logic tests using synthetic vectors, not biometric accuracy tests."""
import unittest
import numpy as np
from recognize_faces import match_embedding, StableIdentity


class RecognitionTests(unittest.TestCase):
    def setUp(self):
        self.templates = np.eye(512, dtype=np.float32)[:2]

    def test_match_and_unknown(self):
        self.assertEqual(match_embedding(self.templates[0], ['A', 'B'],
                                         self.templates, 0.5, 0.05)[0], 'A')
        unknown = np.eye(512, dtype=np.float32)[2]
        self.assertIsNone(match_embedding(unknown, ['A', 'B'], self.templates, 0.5, 0.05)[0])

    def test_ambiguous_match(self):
        vector = self.templates[0] + self.templates[1]
        self.assertIsNone(match_embedding(vector, ['A', 'B'], self.templates, 0.5, 0.05)[0])

    def test_single_student_still_rejects_unknown(self):
        self.assertIsNone(match_embedding(self.templates[1], ['A'], self.templates[:1], 0.5, 0.05)[0])

    def test_stability_resets(self):
        state = StableIdentity(3)
        self.assertIsNone(state.update('A'))
        self.assertIsNone(state.update('A'))
        self.assertEqual(state.update('A'), 'A')
        self.assertIsNone(state.update(None))
        self.assertIsNone(state.update('A'))
        self.assertIsNone(state.update('B'))
        self.assertIsNone(state.update('B'))
        self.assertEqual(state.update('B'), 'B')


if __name__ == '__main__':
    unittest.main()
