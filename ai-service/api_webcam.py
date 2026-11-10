"""Send one live webcam frame to the local API on SPACE. Nothing saved."""
import argparse
import getpass
import json
import os

import cv2
import requests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--backend', choices=['dshow', 'msmf'], default='dshow')
    args = parser.parse_args()
    key = os.environ.get('AI_API_KEY') or getpass.getpass('API key (same as server): ')
    url = 'http://127.0.0.1:8000'
    camera = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW if args.backend == 'dshow' else cv2.CAP_MSMF)
    title = 'API webcam - SPACE: send, Q/Esc: exit'
    try:
        if not camera.isOpened():
            raise RuntimeError('Cannot open camera. Close other camera apps or try --backend msmf.')
        print('SPACE sends one frame; result appears in this terminal. No image is saved.')
        while True:
            ok, frame = camera.read()
            if not ok or frame is None:
                raise RuntimeError('Cannot read camera frame')
            cv2.imshow(title, frame)
            pressed = cv2.waitKey(1) & 0xFF
            if pressed in (ord('q'), ord('Q'), 27) or cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
            if pressed != 32:
                continue
            encoded, image = cv2.imencode('.jpg', frame)
            if not encoded:
                raise RuntimeError('Cannot encode camera frame')
            try:
                response = requests.post(url + '/recognize', data=image.tobytes(),
                                         headers={'X-API-Key': key, 'Content-Type': 'image/jpeg'},
                                         timeout=(3, 30))
                print(f'HTTP {response.status_code}')
                print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            except requests.RequestException as error:
                print(f'API request failed: {error}. Check server and API key.')
    except (RuntimeError, cv2.error) as error:
        print(error)
        return 1
    except KeyboardInterrupt:
        pass
    finally:
        camera.release()
        cv2.destroyAllWindows()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
