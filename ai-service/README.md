# AI Service — Webcam và Face Detection

Python 3.11 x64, NumPy 1.26.4, OpenCV 4.11.0.86,
InsightFace 2.1 và ONNX Runtime 1.23.2 (CPU).
FastAPI 0.162.0, Uvicorn 0.54.0. Chưa cài CUDA/cuDNN hoặc PyTorch.
Chỉ dùng một biến thể OpenCV, không cài thêm opencv-python-headless vào môi trường này.

## Chạy trong Windows PowerShell

```powershell
cd 'D:\ST23D\2026-2027\Doancongnghephanmem\Face-Attendance-System\ai-service'
# Chỉ cần tạo lại nếu chưa có .venv:
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe check_webcam.py
```

Không cần kích hoạt venv khi gọi trực tiếp python.exe như trên.
Nếu muốn kích hoạt: `.\.venv\Scripts\Activate.ps1`.
Nếu PowerShell chặn Activate.ps1, dùng đường dẫn python.exe trực tiếp;
không cần thay đổi Execution Policy.

## Kết quả mong đợi

Cửa sổ hiển thị hình camera và FPS (cập nhật sau khoảng một giây).
Kiểm tra ảnh rõ, chuyển động liên tục và không giật quá mức.
Nhấn Q/Esc hoặc đóng cửa sổ để thoát. Terminal báo `Camera released.`.
Chạy lại để kiểm tra camera đã được giải phóng đúng cách.
Chương trình không lưu ảnh/video, không phát hiện hoặc nhận diện khuôn mặt.

## Xử lý lỗi

- Không mở được camera: đóng Camera/Teams/Zoom và ứng dụng đang dùng webcam.
  Vào Windows Settings > Privacy & security > Camera; bật quyền camera
  và quyền cho desktop apps. Kiểm tra nắp che hoặc phím tắt camera của laptop.
- Sai camera: chạy `.\.venv\Scripts\python.exe check_webcam.py --camera 1`.
- DirectShow không hoạt động: chạy
  `.\.venv\Scripts\python.exe check_webcam.py --backend msmf`.
- Không đọc được frame: kiểm tra kết nối USB, đóng chương trình rồi thử lại.
- `No module named cv2`: dùng đúng python.exe trong .venv và cài lại requirements.
- `DLL load failed`: kiểm tra Microsoft Visual C++ Redistributable x64
  theo hướng dẫn OpenCV: https://pypi.org/project/opencv-python/4.11.0.86/.
- pip báo `getaddrinfo failed`: lỗi phân giải tên miền/kết nối kho thư viện;
  kiểm tra mạng, DNS hoặc proxy rồi chạy lại lệnh cài. Không phải bằng chứng
  phiên bản thư viện không tồn tại.

## Face Detection — webcam đã được người dùng xác nhận hoạt động

Chạy tại thư mục ai-service:

```powershell
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe detect_faces.py --check-model
.\.venv\Scripts\python.exe detect_faces.py
```

`requirements-lock.txt` ghi toàn bộ phiên bản đã cài và kiểm tra; dùng
`-r requirements-lock.txt` thay cho requirements.txt khi cần tái tạo đúng môi trường.
`dependency-plan.json` là báo cáo giải dependency trước khi cài.

Model buffalo_l được tải từ release chính thức của InsightFace vào
`models/models/buffalo_l/` (thư viện tự thêm thư mục models vào root truyền vào).
Gói tải khoảng 275 MiB, có cả các model khác nhưng chương trình chỉ bật detection.
Không tạo/lưu embeddings, không nhận diện danh tính, không lưu ảnh hoặc video.
Model pretrained do InsightFace cung cấp giới hạn cho nghiên cứu phi thương mại:
https://pypi.org/project/insightface/.

Kết quả mong đợi: khung xanh quanh khuôn mặt, 5 chấm đỏ tại hai mắt, mũi,
hai khóe miệng; số Faces và thời gian suy luận CPU. Điểm `Face 0.xx` là
độ tin cậy phát hiện, không phải độ chính xác nhận diện danh tính.
Q/Esc hoặc đóng cửa sổ để thoát. Camera được giải phóng cả khi có lỗi.

Kiểm tra thực tế:
- Một người nhìn thẳng trong ánh sáng đủ: khung và landmarks đúng vị trí.
- Rời khỏi khung hình: Faces về 0.
- Di chuyển nhẹ và quay mặt nhẹ: quan sát độ ổn định.
- Đóng rồi chạy lại: camera mở lại bình thường.

Nếu sai camera/backend, dùng `--camera 1` hoặc `--backend msmf` như bước webcam.
Nếu tải model thất bại: kiểm tra mạng/proxy, chạy lại `--check-model`.
Nếu tải/giải nén bị gián đoạn và thư viện báo thiếu detector: đổi tên thư mục
`models/models/buffalo_l` tải dở rồi chạy lại để thư viện tải bản đầy đủ.
Nếu import/DLL lỗi: chạy pip check, dùng đúng .venv; xem mục lỗi Windows ở trên.
Nếu CPU chậm: ghi lại thời gian inference hiển thị; sẽ đo và tối ưu ở bước riêng.
Không cài đồng thời onnxruntime và onnxruntime-gpu.

## Căn chỉnh và kiểm tra chất lượng — detection đã được xác nhận

Chạy lại `detect_faces.py` bằng lệnh ở trên. Không cần cài thư viện mới.
Chương trình dùng 5 landmarks để căn chỉnh theo mẫu ArcFace 112×112.
Cửa sổ phụ hiển thị khuôn mặt lớn nhất (phóng lên 224×224 để dễ xem).
Không có mặt thì cửa sổ phụ được xóa, tránh hiển thị ảnh cũ.

- Khung xanh / OK: vượt qua các kiểm tra chất lượng cơ bản.
- Khung cam / CHECK: có ít nhất một cảnh báo.
- SMALL: cạnh nhỏ nhất của bounding box dưới 100 pixel; tiến gần camera.
- DARK: độ sáng trung bình ảnh căn chỉnh dưới 50/255; bổ sung ánh sáng.
- BLUR: phương sai Laplacian ảnh căn chỉnh dưới 60; giữ yên, chỉnh nét.
- EDGE / INVALID LANDMARKS: đưa mặt vào giữa khung hình.

Các ngưỡng trên chỉ là giá trị khởi đầu cần hiệu chỉnh bằng webcam thực tế.
Không chứng minh ảnh đúng người, không phát hiện che khuất đầy đủ,
không phải liveness hoặc xác suất nhận diện đúng. Ảnh nhiễu cũng có thể có
điểm sharpness cao. Căn chỉnh 2D không khôi phục được phần mặt bị che/khuất.
Mọi khuôn mặt vẫn được hiển thị để người dùng sửa điều kiện chụp; trạng thái
CHECK đánh dấu ảnh chưa phù hợp cho đăng ký, chưa có thao tác lưu ảnh.

```powershell
# Điều chỉnh khi cần sau khi quan sát điểm thực tế:
.\.venv\Scripts\python.exe detect_faces.py --min-face-size 100 --min-brightness 50 --min-sharpness 60
# Kiểm tra pipeline, không mở camera:
.\.venv\Scripts\python.exe -m unittest test_face_quality -v
```

Thử mặt nhìn thẳng, di chuyển xa, giảm ánh sáng và di chuyển nhanh;
quan sát cảnh báo và ảnh căn chỉnh. Nếu vẫn hiện BLUR khi ảnh rõ, ghi lại
điểm sharpness để hiệu chỉnh; không hạ ngưỡng chỉ để mọi ảnh đều đạt.
Đóng một trong hai cửa sổ hoặc Q/Esc để giải phóng camera.
Chờ xác nhận bước này hoạt động trước khi thu thập ảnh đăng ký.

## Đăng ký khuôn mặt bằng ArcFace pretrained

Chỉ thực hiện khi người tham gia đồng ý lưu ảnh khuôn mặt và embeddings.
Giải thích mục đích, nơi lưu, người được truy cập, thời hạn lưu/xóa và cách
điểm danh thay thế. `--consent` là xác nhận của người vận hành, không phải
hệ thống quản lý biểu mẫu đồng ý. Tự thống nhất và ghi nhận sự đồng ý trước.

```powershell
# Thay SV001 bằng mã sinh viên thật, chỉ thêm --consent sau khi có sự đồng ý:
.\.venv\Scripts\python.exe register_face.py --student-id SV001 --consent
# Tùy chọn: --samples 15 đến 25, --camera 1, --backend msmf
```

Mỗi lần nhấn Space nhận một ảnh đạt kiểm tra chất lượng, chỉ khi có đúng một mặt.
Giữ người khác ngoài khung hình. Người vận hành kiểm tra đúng người/mã sinh viên.
Đổi nhẹ góc nhìn và ánh sáng giữa các ảnh; không xoay quá nghiêng hoặc che mặt.
Chương trình không tự xác minh tất cả ảnh cùng một người, không kiểm tra liveness.
Nhấn Q/Esc để hủy trước khi đủ ảnh: không lưu dữ liệu phiên đó.

Sau đủ 20 ảnh (mặc định), dữ liệu được lưu tại:

```text
data/registrations/SV001/
  01.jpg ... 20.jpg     ảnh đã căn chỉnh 112×112
  embeddings.npz       mảng embeddings: (20, 512), float32, L2-normalized
  metadata.json        mã sinh viên, model, thời gian UTC và số ảnh
  COMPLETE             chỉ xuất hiện khi ghi hoàn tất
```

Thư mục data/ được .gitignore loại khỏi Git. Đây là lưu trữ demo cục bộ,
chưa có phân quyền ứng dụng hoặc mã hóa; không đồng bộ/chia sẻ thư mục này.
Không thể đăng ký đè mã đã tồn tại. Nếu ghi lỗi, thư mục không có COMPLETE
là phiên chưa hoàn tất; kiểm tra và xử lý dữ liệu đó trước khi thử lại.
Xóa cả thư mục của mã sinh viên khi cần xóa dữ liệu đăng ký.

Kiểm tra ảnh để loại ảnh sai người/mờ/che khuất mà bộ lọc không nhận ra.
Nếu bộ ảnh không đạt, đăng ký lại trọn bộ thay vì sửa ảnh mà để embeddings cũ.
Ảnh mẫu thư viện chỉ dùng kiểm tra code; không dùng để tuyên bố độ chính xác.
Tự so cosine một vector với chính nó xấp xỉ 1 chỉ xác minh phép tính chuẩn hóa.

Bước kế tiếp sau khi đăng ký thử thành công: so khớp cosine với webcam,
hiệu chỉnh ngưỡng trên dữ liệu validation riêng và kiểm thử ở buổi khác,
bao gồm người chưa đăng ký. Chưa triển khai API/Backend/Frontend ở bước này.

## So khớp cosine qua webcam — demo cục bộ

```powershell
.\.venv\Scripts\python.exe recognize_faces.py --threshold 0.5 --check-gallery
.\.venv\Scripts\python.exe recognize_faces.py --threshold 0.5
# Kiểm tra logic, không mở camera:
.\.venv\Scripts\python.exe -m unittest test_recognition test_face_quality -v
```

0.5 chỉ là ngưỡng thử luồng, không phải ngưỡng đã xác minh cho hệ thống.
Không suy ra phần trăm độ chính xác từ cosine. Phải chọn ngưỡng trên tập
validation có cả người đã đăng ký và người lạ rồi đánh giá trên test độc lập.

Chương trình đọc các phiên COMPLETE tương thích model. Với mỗi sinh viên,
lấy trung bình 20 embeddings đã chuẩn hóa rồi chuẩn hóa vector trung bình;
cosine là tích vô hướng của vector webcam chuẩn hóa và template này.
Chỉ chấp nhận khi điểm cao nhất đạt threshold và hơn người đứng thứ hai
ít nhất --margin (mặc định 0.05; bỏ so margin khi chỉ có một sinh viên).
Một sinh viên trong gallery vẫn có thể trả Unknown nếu không đạt threshold.

- Checking: ứng viên chưa đủ 3 khung liên tiếp cùng mã sinh viên.
- SV001: đã vượt ngưỡng và ổn định 3 khung liên tiếp, chỉ là kết quả demo.
- Unknown: chất lượng ảnh đạt nhưng không đủ điều kiện so khớp.
- Quality: sửa ánh sáng/khoảng cách/độ nét; không cố nhận diện ảnh kém.
- No face / One person at a time: không có mặt hoặc có nhiều người.

Trạng thái ổn định được xóa ngay khi mất mặt, nhiều người, ảnh kém hoặc Unknown.
Ba khung liên tiếp không phải cơ chế chống giả mạo hoặc theo dõi danh tính chắc chắn.
Không ghi điểm danh, không lưu ảnh/video mới, không sửa dữ liệu đăng ký.

Thử chính bạn qua webcam với khung hình mới; rời camera thì No face.
Sau đó thử người chưa đăng ký có đồng ý: mong đợi Unknown, cần ghi nhận nếu
bị nhận nhầm. Chỉ một người chưa đủ đánh giá nhận diện giữa nhiều sinh viên.
Thu dữ liệu kiểm thử ở buổi khác; không dùng lại ảnh đăng ký làm test.
Nếu chính bạn luôn Unknown, kiểm tra chất lượng, mã đăng ký và dữ liệu đúng người;
ghi lại cosine trong các điều kiện trước khi hiệu chỉnh threshold.
Nếu tải gallery thất bại: kiểm tra COMPLETE/metadata và thông báo terminal;
chương trình không bỏ qua âm thầm dữ liệu hỏng hoặc model không tương thích.
Tùy chọn --camera/--backend và Q/Esc giống các chương trình trước.

## Ghi kiểm thử có nhãn — không ghi điểm danh

Sau khi được người tham gia đồng ý, chạy từ ai-service:

```powershell
# Bạn đã đăng ký là SV001; dùng webcam mới, không mở lại ảnh đăng ký:
.\.venv\Scripts\python.exe recognize_faces.py --threshold 0.5 --expected SV001 --session buoi2 --consent
# Người khác CHƯA đăng ký, có đồng ý tham gia:
.\.venv\Scripts\python.exe recognize_faces.py --threshold 0.5 --expected Unknown --session buoi2_khach1 --consent
```

SPACE ghi một lần thử với nhãn do người vận hành cung cấp. Q/Esc kết thúc.
Tên session nên phản ánh buổi thu thật; đặt tên buoi2 không tự tạo sự độc lập
nếu vẫn thu ngay buổi đăng ký. Thử nhiều điều kiện, không chỉ ghi lúc nhận đúng.
Gợi ý demo: 10–20 lần mỗi người/điều kiện, giãn cách và thay đổi tư thế nhẹ;
đây không phải cỡ mẫu đủ để kết luận độ chính xác hay tính độc lập thống kê.
Các khung gần nhau có tương quan. Ghi cả lỗi chất lượng/no_face nếu đang kiểm
tra các tình huống này, không tính chúng là Unknown có điểm cosine.

CSV có tên duy nhất tại data/validation/, chứa thời gian UTC, session,
split, nhãn mong đợi, ứng viên, cosine cao nhất/đứng thứ hai, dự đoán trước
và sau ổn định, trạng thái chất lượng, threshold/margin đã dùng.
Không lưu ảnh hoặc embeddings mới. CSV vẫn chứa mã sinh viên: giữ cục bộ,
không đưa lên Git hoặc chia sẻ công khai. Trạng thái stable_prediction rỗng
nghĩa là chưa xác nhận, không đồng nghĩa Unknown.

`--expected` là nhãn thực tế của người trước camera; chỉ đổi nó bằng cách
đóng chương trình và chạy lại. Đảm bảo đúng người và đúng nhãn.
Không dùng chính bạn với nhãn Unknown khi SV001 vẫn nằm trong gallery.
Nếu chưa có người lạ tham gia, chỉ thu known; chưa thể đánh giá từ chối người lạ.

Mặc định --split validation: dùng để chọn ngưỡng sau này. Dành một buổi khác
cho test, thêm `--split test` và giữ nguyên ngưỡng đã chọn; không dùng test
để chỉnh ngưỡng. Hiện chưa tự chọn ngưỡng hoặc công bố độ chính xác.
Nếu lỗi --expected: dùng đúng mã đã đăng ký hoặc chữ Unknown viết hoa U.
Nếu thiếu --consent/--session: chương trình dừng trước khi mở camera.

```powershell
.\.venv\Scripts\python.exe -m unittest test_validation_log test_recognition test_face_quality -v
```

## FastAPI — AI Service cục bộ

Model và gallery chỉ nạp một lần trong lifespan khi khởi động.
Thêm/sửa đăng ký bằng chương trình webcam thì khởi động lại API để nạp lại gallery.
API không mở camera; nhận ảnh từ bên gọi. Có endpoint đăng ký; chưa ghi điểm danh.

PowerShell thứ nhất, tại thư mục ai-service:

```powershell
# Tự nhập khóa riêng ít nhất 32 ký tự ASCII; không dùng mật khẩu tài khoản thật.
$env:AI_API_KEY = Read-Host 'Nhap khoa API rieng (it nhat 32 ky tu ASCII)'
$env:AI_THRESHOLD = '0.5'
.\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Đợi `Application startup complete`. Chỉ bind localhost, dùng một worker.
Ctrl+C dừng. Không đưa khóa API lên Git hoặc đặt trong frontend.
`.env.example` chỉ mô tả biến; chương trình không tự đọc file .env.

Mở http://127.0.0.1:8000/health: mong đợi status ok, model_ready true.
Tài liệu API: http://127.0.0.1:8000/docs.

PowerShell thứ hai:

```powershell
cd 'D:\ST23D\2026-2027\Doancongnghephanmem\Face-Attendance-System\ai-service'
.\.venv\Scripts\python.exe api_webcam.py
```

Nhập lại đúng khóa của server khi được hỏi (không hiển thị ký tự lúc nhập).
SPACE gửi một khung hình webcam; xem JSON kết quả trong terminal thứ hai.
Q/Esc đóng camera. Đóng các chương trình webcam khác trước khi chạy.
Nếu có AI_API_KEY trong terminal thứ hai, client dùng giá trị đó thay vì hỏi.

POST /recognize nhận body JPEG/PNG thô, không dùng JSON/base64/multipart;
Content-Type image/jpeg hoặc image/png; header X-API-Key.
Giới hạn 5 MiB và mỗi chiều tối đa 4096 pixel, kiểm tra header trước decode.
Không trả embeddings hoặc lưu ảnh request. Mỗi thời điểm xử lý một inference;
khi đang bận trả 503, bên gọi thử lại sau. Không bật CORS: React sẽ gọi Spring Boot.

Các status: matched, unknown, no_face, multiple_faces, low_quality, gallery_empty.
student_id chỉ có khi matched; cosine không phải xác suất chính xác.
threshold_calibrated luôn false, attendance_recorded luôn false ở bản demo.
API trả kết quả một khung hình, chưa áp dụng xác nhận ba khung như demo webcam;
phần ổn định theo phiên/người cần tích hợp khi làm luồng điểm danh.
Spring Boot sau này phải kiểm tra lớp, phiên và chống ghi trùng trước khi lưu.

HTTP 401: sai/thiếu khóa. 400: ảnh trống/hỏng. 413: vượt giới hạn.
415: sai định dạng/Content-Type. 503: model đang bận.
Connection refused: kiểm tra terminal server đã khởi động và đúng port 8000.
Port đang dùng: dừng tiến trình server cũ bằng Ctrl+C trước khi chạy lại.
Startup lỗi gallery: chạy recognize_faces.py --threshold 0.5 --check-gallery
để xem lỗi dữ liệu. Không sửa ngưỡng từ ảnh đăng ký để tuyên bố chính xác.

```powershell
# Máy chủ tạm được mở trên localhost và tự dừng sau kiểm tra:
.\.venv\Scripts\python.exe -m unittest test_api -v
```

Kiểm tra API dùng ảnh mẫu/ảnh trống để xác minh kỹ thuật, không đo độ chính xác
và không tạo dữ liệu đăng ký. Bước tiếp theo là xác nhận API chạy trên máy bạn;
chưa tự xây Spring Boot/React hoặc chuyển ngưỡng demo thành ngưỡng chính thức.

## API đăng ký: POST /registrations

Cùng header X-API-Key; Content-Type application/json. Nội dung gồm:

```json
{
  "student_id": "SV002",
  "consent": true,
  "images": [
    {"content_type": "image/jpeg", "data_base64": "<base64 ảnh gốc, không có tiền tố data:>"}
  ]
}
```

Ví dụ chỉ minh họa một phần tử: request thật phải có 15–25 ảnh khác nhau,
tổng JSON tối đa 20 MiB, mỗi ảnh tối đa 5 MiB, mỗi chiều tối đa 4096 pixel.
Gửi ảnh gốc có mặt đủ lớn, không gửi lại ảnh 112×112 đã căn chỉnh làm nguồn
đăng ký mới. Mọi ảnh phải có đúng một mặt và vượt kiểm tra chất lượng.
consent=true xác nhận của người vận hành sau khi người tham gia đồng ý;
API không chứng minh đã xin sự đồng ý hoặc tự xác minh ảnh đúng sinh viên.
Ảnh trùng hệt bị từ chối; vẫn cần người vận hành kiểm tra ảnh cùng một người.

201: đã lưu đủ ảnh, embeddings và metadata, gallery cập nhật ngay.
409: mã đã có dữ liệu, không ghi đè. 422: payload/số ảnh/chất lượng/ảnh trùng
không hợp lệ. 401/413/415/503 tương tự /recognize.
Nếu bất kỳ ảnh nào bị từ chối, không xuất bản bộ đăng ký một phần.
File được ghi vào thư mục tạm rồi chuyển thành bộ COMPLETE trong data/registrations.
Server có thể khởi động khi chưa có đăng ký; /recognize trả gallery_empty
nếu ảnh có một mặt đạt chất lượng nhưng gallery chưa có người nào.
Chạy một worker để gallery trong bộ nhớ nhất quán.

SV001 hiện có không cần đăng ký lại. Sau khi sửa code, dừng server bằng Ctrl+C
và chạy lại lệnh uvicorn; giữ nguyên AI_API_KEY/AI_THRESHOLD trong terminal.
Mở /docs để xem endpoint mới, hoặc thử lại api_webcam.py như trước.

```powershell
.\.venv\Scripts\python.exe -m unittest test_registration_api test_api -v
```

Kiểm tra đăng ký sử dụng dữ liệu tổng hợp trong thư mục tạm, không tạo sinh viên
giả trong dữ liệu thật và không phải bằng chứng về độ chính xác nhận diện.
