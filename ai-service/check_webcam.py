"""Preview a Windows webcam without saving images or video."""

import argparse
import time

import cv2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--backend', choices=['dshow', 'msmf'], default='dshow')
    args = parser.parse_args()
    backend = cv2.CAP_DSHOW if args.backend == 'dshow' else cv2.CAP_MSMF
    camera = cv2.VideoCapture(args.camera, backend)
    title = 'Webcam check - Q or Esc to quit'
    try:
        if not camera.isOpened():
            print('ERROR: Cannot open camera. Close Teams/Zoom, check Windows camera permissions,')
            print('or try --camera 1 or --backend msmf. See README.md.')
            return 1
        print('Camera opened. Press Q/Esc or close the preview window to exit.')
        start = time.perf_counter()
        frames = 0
        fps = 0.0
        while True:
            ok, frame = camera.read()
            if not ok or frame is None:
                print('ERROR: Cannot read frame. Check camera connection and try again.')
                return 1
            frames += 1
            elapsed = time.perf_counter() - start
            if elapsed >= 1:
                fps = frames / elapsed
                start = time.perf_counter()
                frames = 0
            cv2.putText(frame, f'FPS: {fps:.1f} | Q/Esc: exit', (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.imshow(title, frame)
            if cv2.waitKey(1) & 0xFF in (ord('q'), ord('Q'), 27):
                break
            if cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
        return 0
    except KeyboardInterrupt:
        return 0
    except cv2.error as error:
        print(f'OpenCV error: {error}')
        return 1
    finally:
        camera.release()
        cv2.destroyAllWindows()
        print('Camera released.')


if __name__ == '__main__':
    raise SystemExit(main())
