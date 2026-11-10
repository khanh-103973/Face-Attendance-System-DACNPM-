# Spring Boot — bước đầu tiên

Java 21 (LTS), Spring Boot 3.5.16, PostgreSQL 17, Maven Wrapper.
Có health check, đăng nhập JWT và phân quyền ADMIN/TEACHER.
Có CRUD lớp/sinh viên và quản lý thành viên lớp bằng Spring Data JPA.
Chưa ghi điểm danh hoặc gọi AI. Frontend chưa được tạo.
Server bind localhost:8080. Flyway quản lý migration bảng users.

## 1. Tạo database và tài khoản ứng dụng

Chạy từ thư mục gốc Face-Attendance-System:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -p 5432 -U postgres -d postgres -W -f .\database\init-local.psql
```

Lần đầu nhập mật khẩu quản trị postgres. Script tiếp tục hỏi mật khẩu MỚI
cho attendance_app và xác nhận lại. Không nhập mật khẩu vào câu SQL hoặc chat.
Script tạo role không phải superuser và database face_attendance thuộc role này.
Role/database đã tồn tại sẽ được giữ nguyên, không xóa hoặc đổi mật khẩu.
Nếu cần đổi mật khẩu một role đã tồn tại, đăng nhập psql với postgres rồi
chạy `\password attendance_app` (psql sẽ hỏi mật khẩu mới, không nhập vào SQL).

```powershell
# Kiểm tra bằng mật khẩu attendance_app vừa đặt:
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -p 5432 -U attendance_app -d face_attendance -W
```

Trong psql: `SELECT current_user, current_database();`, mong đợi attendance_app
và face_attendance. `\q` để thoát. Chưa có bảng nghiệp vụ ở giai đoạn này.

## 2. Khởi động backend

```powershell
# Tại thư mục gốc dự án:
.\scripts\Start-Backend.ps1
```

Nhập mật khẩu attendance_app khi được hỏi. Không dùng mật khẩu postgres.
Script mặc định luôn hỏi lại, kể cả terminal đã có DB_PASSWORD, để tránh dùng
mật khẩu cũ. Chỉ thêm -UseEnvironmentPassword nếu chủ động muốn dùng biến có sẵn.
Script đặt mật khẩu vào biến môi trường cho tiến trình, không ghi ra file.
Ctrl+C dừng ứng dụng và khôi phục biến DB_PASSWORD của terminal.
Lần đầu Maven Wrapper có thể tải Maven/dependencies; không cần gọi mvn toàn máy.
Cache dependencies được lưu ở .tools/m2, đã loại khỏi Git.
Nếu PowerShell chặn script, có thể chạy trong một tiến trình riêng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Backend.ps1
```

## 3. Kiểm tra

- http://127.0.0.1:8080/api/health/live: ứng dụng đang chạy, database not_checked.
- http://127.0.0.1:8080/api/health: chạy SELECT 1, trả status ok, database up nếu kết nối được.
- Database không truy cập được: readiness trả HTTP 503, database down;
  liveness không xác nhận kết nối database.

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

Password authentication failed: kiểm tra đúng mật khẩu attendance_app, không phải postgres.
Database does not exist: chạy bước 1. Connection refused: kiểm tra PostgreSQL/cổng 5432.
Port 8080 in use: Ctrl+C backend cũ, hoặc đặt `$env:SERVER_PORT='8081'` trước khi chạy.
Nếu đã đặt DB_URL/DB_USERNAME trong terminal, chúng được ưu tiên; kiểm tra khi sai database.
.env.example chỉ mô tả biến, ứng dụng không tự đọc .env.

## Kiểm tra tự động

```powershell
cd backend
.\mvnw.cmd '-Dmaven.repo.local=../.tools/m2' test
```

Tests dùng mock JDBC để kiểm tra nhánh trạng thái và không tiết lộ lỗi database.
Không phải bằng chứng kết nối database thật. Kết nối thật cần bạn chạy bước 1–3
vì mật khẩu quản trị/database không được chia sẻ với agent.
Chờ xác nhận health database up trước khi thêm đăng nhập và nghiệp vụ.

## Đăng nhập và phân quyền

Lần đầu: dừng Backend cũ bằng Ctrl+C. Tại thư mục gốc dự án:

```powershell
.\scripts\Start-Backend.ps1 -CreateAdmin
```

Script hỏi mật khẩu ĐĂNG NHẬP admin mới (ít nhất 10 ký tự, tối đa 72 byte UTF-8),
xác nhận lại, rồi hỏi mật khẩu DATABASE attendance_app đã đặt.
Đây là hai mục đích khác nhau; không dùng mật khẩu quản trị postgres.
Tên đăng nhập được tạo là admin. Flyway tạo bảng users trong database hiện có,
không xóa dữ liệu. Mật khẩu lưu dưới dạng BCrypt, không phải văn bản gốc.
admin đã tồn tại thì được giữ nguyên; -CreateAdmin không đặt lại mật khẩu cũ.
Không có endpoint đăng ký công khai để tự tạo tài khoản quản trị.

Khóa JWT tự tạo ở .secrets/backend-jwt.key, đã loại khỏi Git.
Giữ file này riêng tư, không sửa khi server chạy. Mất/đổi khóa làm token cũ
không còn hợp lệ sau khi khởi động lại. AI_API_KEY của FastAPI là khóa khác,
không dùng thay JWT hoặc mật khẩu đăng nhập.

Terminal thứ hai, tại thư mục gốc:

```powershell
.\scripts\Test-BackendLogin.ps1
```

Nhập mật khẩu ĐĂNG NHẬP admin. Mong đợi Login OK, profile có username admin,
role ADMIN và kết quả kiểm tra quyền ADMIN là ok. Script không in token.
Các lần khởi động sau chỉ dùng Start-Backend.ps1, không cần -CreateAdmin.

Endpoints:
- POST /api/auth/login: JSON username/password; trả access_token, token_type Bearer,
  expires_in 900 giây. Thông tin đăng nhập sai trả 401; input không hợp lệ trả 400.
- GET /api/auth/me: cần Authorization: Bearer <token>; không trả password/hash.
- GET /api/admin/check: ADMIN được phép; TEACHER nhận 403.
- GET /api/health và /api/health/live: không cần đăng nhập.
- Các API chưa được khai báo đều bị chặn, chưa bật CORS.

Token ký HS256, có issuer và hạn dùng 15 phút (validator cho phép lệch đồng hồ
nhỏ mặc định). Không có refresh token/logout endpoint ở bước này; client xóa
token để đăng xuất. Mỗi request xác thực đọc lại user và role trong DB,
nên tài khoản bị disable hoặc đổi quyền có hiệu lực ở request sau.
Chưa có chức năng tạo tài khoản giảng viên qua API; role TEACHER hiện được
kiểm tra bằng tests, sẽ thêm luồng quản lý tài khoản trong bước riêng.
Chưa có chống dò mật khẩu/rate limit hoặc triển khai public; giữ localhost.

## Quản lý sinh viên và lớp (Admin)

Dừng backend cũ bằng Ctrl+C, chạy lại Start-Backend.ps1 (không cần -CreateAdmin).
Flyway tự thêm migration V2, giữ nguyên users/admin và dữ liệu hiện có.
Hibernate chỉ validate schema, không tự xóa/tạo lại bảng.

Terminal thứ hai, tại thư mục gốc dự án:

```powershell
.\scripts\Test-SchoolApi.ps1
```

Nhập mật khẩu ĐĂNG NHẬP admin. Script tạo sinh viên/lớp TEST_ với mã ngẫu nhiên,
thêm thành viên hai lần để kiểm tra không trùng, đọc danh sách, sửa tên rồi
bỏ thành viên và xóa bản ghi thử. Nó không sửa SV001, tài khoản admin hoặc ảnh
đăng ký. Nếu cleanup lỗi, script in ID cần kiểm tra; không tuyên bố dữ liệu đã xóa.

Các endpoint cần Bearer JWT của ADMIN; TEACHER hiện bị chặn khỏi quản lý toàn bộ
danh sách, chưa có phân công giảng viên/lớp ở bước này.

- GET/POST /api/students: danh sách/tạo; JSON tạo gồm studentCode, fullName.
- GET/PUT/DELETE /api/students/{id}: xem/sửa tên/xóa; PUT chỉ nhận fullName.
- GET/POST /api/classes: danh sách/tạo; JSON tạo gồm classCode, name.
- GET/PUT/DELETE /api/classes/{id}: xem/sửa tên/xóa; PUT chỉ nhận name.
- GET /api/classes/{id}/students: danh sách sinh viên của lớp.
- PUT/DELETE /api/classes/{classId}/students/{studentId}: thêm/bỏ thành viên.

id trong URL là số ID PostgreSQL, khác studentCode dùng để liên kết AI (SV001).
Các GET danh sách hỗ trợ page từ 0, size 1–100 (mặc định 20), sắp xếp theo ID.
Trả items/page/size/totalElements. Chưa có tìm kiếm theo tên ở bước này.
Mã được chuẩn hóa chữ hoa khi tạo, 1–50 ký tự chữ/số/_/-, bắt đầu bằng chữ/số.
Mã sinh viên từ chối tên dành riêng Windows như CON, AUX, COM1 để tương thích AI.
Không cho đổi mã sau khi tạo, tránh lệch dữ liệu khuôn mặt. Tên bắt buộc tối đa 150 ký tự.

201: tạo thành công; 204: xóa/thêm/bỏ thành viên thành công; 400: input sai;
401: chưa đăng nhập/token sai; 403: thiếu quyền; 404: không có ID;
409: mã trùng hoặc bản ghi còn được lớp tham chiếu. Xóa lớp/sinh viên có thành
viên trả 409; cần bỏ quan hệ trước, không âm thầm xóa liên kết.
PUT thành viên lặp lại tuần tự không tạo trùng; xung đột đồng thời có thể trả 409.
Backend chưa tự đồng bộ/xóa ảnh hay embeddings trong AI Service.

## Phiên điểm danh và kết nối FastAPI — demo cục bộ

Migration V3 thêm attendance_sessions và attendance_records, giữ nguyên bảng cũ.
Mỗi lớp có tối đa một phiên chưa đóng. Mỗi cặp session_id/student_id chỉ có một
bản ghi, có unique constraint ở PostgreSQL và INSERT ON CONFLICT để chống trùng.
Chưa có phân công giảng viên/lớp nên các API phiên hiện chỉ dành cho ADMIN.

Dừng các server cũ trước khi chạy lại để tránh trùng cổng và khóa AI cũ.
Chạy các lệnh từ thư mục gốc dự án:

```powershell
# Terminal 1: AI Service, không hỏi khóa API nữa.
.\scripts\Start-AiService.ps1
# Terminal 2: Backend, hỏi mật khẩu DATABASE attendance_app.
.\scripts\Start-Backend.ps1
# Terminal 3: tạo dữ liệu demo, hỏi mật khẩu ĐĂNG NHẬP admin.
.\scripts\Manage-AttendanceDemo.ps1 -Action Prepare
```

Hai server dùng chung khóa .secrets/ai-service.key. Không in/chia sẻ/commit file này.
JWT vẫn có khóa riêng. Đừng chạy server AI cũ bằng khóa khác ở cổng 8000.
Start-AiService mặc định threshold 0.5 chưa hiệu chỉnh; có thể truyền -Threshold
chỉ khi chủ động thử hoặc đã hiệu chỉnh. Kết quả điểm danh hiện mang demo=true,
chưa dùng làm điểm danh chính thức do chưa kiểm thử độc lập/liveness/ổn định nhiều khung.

Prepare tìm sinh viên có studentCode SV001; nếu chưa có thì hỏi tên hiển thị rồi
tạo đúng mã đó để liên kết gallery AI. Script không sửa ảnh/embeddings có sẵn.
Tiếp theo tạo lớp DEMO_, thêm SV001 vào lớp và mở phiên (mốc đi muộn 15 phút).
Khác Test-SchoolApi, dữ liệu demo này được GIỮ LẠI để xem lịch sử và chống trùng.
ID được lưu cục bộ trong .tools/attendance-demo.json, không có token/mật khẩu.
Chạy Prepare lại khi file này tồn tại chỉ hiển thị phiên cũ, không tạo lặp.
Nếu chuẩn bị dở, script lưu ID lớp với sessionId rỗng để kiểm tra thủ công,
không âm thầm bỏ dữ liệu rồi tạo lớp mới.

Script in lệnh camera với ID phiên thật, ví dụ:

```powershell
# Thay 1 bằng ID phiên vừa được in. Chỉ dùng --consent khi người tham gia đồng ý.
.\ai-service\.venv\Scripts\python.exe .\ai-service\attendance_webcam.py --session-id 1 --consent
```

Nhập mật khẩu ĐĂNG NHẬP admin. SPACE gửi một ảnh camera → Backend → FastAPI.
Không nhập mã sinh viên/điểm cosine từ client để ghi điểm danh. Backend chỉ lấy
mã từ AI, kiểm tra sinh viên trong PostgreSQL và thuộc lớp của phiên đang mở.
Không giữ transaction/khóa database trong lúc chờ AI; khóa và kiểm tra lại phiên
sau khi AI xong, để việc đóng phiên trong lúc inference không tạo bản ghi muộn.
Membership được khóa khi ghi để không bị xóa giữa kiểm tra và INSERT.

Các kết quả HTTP 200:
- recorded, attendanceRecorded=true: tạo một bản ghi mới.
- already_recorded, attendanceRecorded=false: giữ bản ghi cũ, không đổi giờ/trạng thái.
- student_not_found: mã AI chưa có trong PostgreSQL, không ghi.
- student_not_in_class: sinh viên chưa thuộc lớp, không ghi.
- unknown/no_face/multiple_faces/low_quality/gallery_empty: không ghi.

PRESENT nếu thời điểm ghi <= openedAt + lateAfterMinutes; sau đó là LATE.
Chưa tự tạo ABSENT, chưa sửa tay/audit hoặc ghi CSV làm nguồn điểm danh chính.
Nhấn SPACE hai lần khi được nhận đúng: lần đầu recorded, lần sau already_recorded.
Q/Esc thoát camera. Không lưu ảnh request hoặc embeddings trong attendance_records.

```powershell
# Xem kết quả, hỏi mật khẩu admin:
.\scripts\Manage-AttendanceDemo.ps1 -Action Show
# Đóng phiên; lịch sử vẫn được giữ:
.\scripts\Manage-AttendanceDemo.ps1 -Action Close
```

Endpoints (đều cần Bearer JWT ADMIN):
- POST /api/attendance-sessions: JSON classId, title, lateAfterMinutes (0–180, bắt buộc).
- GET /api/attendance-sessions?classId=...&page=0&size=20: danh sách phiên của lớp.
- GET /api/attendance-sessions/{id}: chi tiết.
- POST /api/attendance-sessions/{id}/close: đóng; gọi lại giữ nguyên closedAt.
- GET /api/attendance-sessions/{id}/records?page=0&size=20: danh sách bản ghi.
- POST /api/attendance-sessions/{id}/recognize: body JPEG/PNG thô, tối đa 5 MiB.

409: phiên đóng hoặc lớp đã có phiên mở. 502: sai khóa AI/lỗi response AI.
503: AI đang bận hoặc Backend chưa cấu hình khóa. 504: kết nối AI lỗi/timeout.
400/413/415: ảnh trống/hỏng/quá lớn/sai định dạng. Không tạo bản ghi khi AI lỗi.
AI timeout kết nối 3 giây, đọc 30 giây. Backend không tự retry tạo điểm danh.
Lớp có lịch sử phiên và sinh viên có bản ghi không được xóa vì FK RESTRICT.

Kiểm thử tích hợp độc lập với database thật của dự án:

```powershell
# Sau khi build jar bằng Maven package:
.\ai-service\.venv\Scripts\python.exe .\scripts\test_attendance_integration.py
```

Script dùng PostgreSQL 17 tạm trên cổng riêng trong .tools, chạy migration/JPA thật
và một AI giả lập. Nó kiểm tra Unknown, lỗi AI, sinh viên ngoài lớp/không có trong DB,
yêu cầu đồng thời và đóng phiên trong lúc AI đang chạy, sau đó dừng và dọn database
tạm. Không đo độ chính xác AI và không truy cập face_attendance của bạn.

Tests HTTP dùng UserStore giả lập và tắt Flyway, không ghi dữ liệu thật.
Migration và admin thật được tạo khi bạn chạy server với mật khẩu database đúng.
Nếu Flyway báo schema không rỗng nhưng chưa có history, dừng và kiểm tra schema;
không bật baseline/clean tùy tiện. Nếu password admin sai, kiểm tra đã dùng
-CreateAdmin lần đầu và không nhầm mật khẩu database.
