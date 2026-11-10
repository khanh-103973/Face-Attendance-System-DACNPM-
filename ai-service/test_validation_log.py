import csv
from pathlib import Path
import tempfile
import unittest

from validation_log import ValidationLog


class ValidationLogTests(unittest.TestCase):
    def test_rejections_do_not_reuse_previous_score_and_files_do_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            log = ValidationLog(directory, 'day2', 'validation', 'Unknown', 0.5, 0.05)
            log.record(candidate='SV001', cosine=0.7, raw_prediction='SV001', status='evaluated')
            log.record(status='no_face')
            log.close()
            with log.path.open(newline='', encoding='utf-8') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(rows[0]['expected'], 'Unknown')
            self.assertEqual(rows[0]['raw_prediction'], 'SV001')
            self.assertEqual(rows[1]['cosine'], '')
            self.assertEqual(rows[1]['raw_prediction'], '')
            other = ValidationLog(directory, 'day2', 'validation', 'SV001', 0.5, 0.05)
            other.close()
            self.assertNotEqual(log.path, other.path)
            self.assertEqual(len(list(Path(directory).glob('*.csv'))), 2)


if __name__ == '__main__':
    unittest.main()
