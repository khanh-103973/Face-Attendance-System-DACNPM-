"""Record operator-labeled live trials, without images or embeddings."""
import csv
from datetime import datetime, timezone
from pathlib import Path
import uuid

FIELDS = ['timestamp_utc', 'session', 'split', 'expected', 'candidate',
          'cosine', 'runner_up_cosine', 'raw_prediction', 'stable_prediction',
          'status', 'threshold', 'margin']


class ValidationLog:
    def __init__(self, directory, session, split, expected, threshold, margin):
        Path(directory).mkdir(parents=True, exist_ok=True)
        self.path = Path(directory) / f'{session}_{uuid.uuid4().hex}.csv'
        self.file = self.path.open('x', newline='', encoding='utf-8')
        self.writer = csv.DictWriter(self.file, fieldnames=FIELDS)
        self.writer.writeheader()
        self.fixed = dict(session=session, split=split, expected=expected,
                          threshold=threshold, margin=margin)
        self.count = 0

    def record(self, *, candidate='', cosine='', runner_up_cosine='',
               raw_prediction='', stable_prediction='', status):
        self.writer.writerow(dict(self.fixed,
                                  timestamp_utc=datetime.now(timezone.utc).isoformat(),
                                  candidate=candidate, cosine=cosine,
                                  runner_up_cosine=runner_up_cosine,
                                  raw_prediction=raw_prediction,
                                  stable_prediction=stable_prediction, status=status))
        self.file.flush()
        self.count += 1

    def close(self):
        self.file.close()
