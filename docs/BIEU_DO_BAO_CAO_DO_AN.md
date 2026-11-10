# Bộ Biểu Đồ & Sơ Đồ Kỹ Thuật Báo Cáo Đồ Án
**Đề tài:** Hệ thống Điểm danh Lớp học bằng Nhận diện Khuôn mặt (*Face Attendance System*)

Tài liệu này tổng hợp đầy đủ các biểu đồ kiến trúc, UML (Use Case, Sequence, State), cơ sở dữ liệu (ERD) và biểu đồ số liệu thực nghiệm bám sát đề cương `HUONG_DAN_LAM_BAO_CAO_DO_AN.txt` cùng mã nguồn thực tế của hệ thống.

---

## 1. Sơ đồ Kiến trúc Tổng thể Hệ thống (Decoupled Multi-Tier Architecture)
*(Dùng cho Chương 1 & Chương 2 — Thiết kế Kiến trúc Hệ thống)*

```mermaid
flowchart TD
    subgraph ClientTier["Tầng Giao Diện (Presentation Tier - Port 5173)"]
        Cam["Webcam Phòng Học (22 - 25 FPS)"]
        FE["Frontend Client (React 19 + TypeScript + Vite)"]
        UI["9 Màn hình Quản trị & Điểm danh Thời gian thực"]
        Cam -->|"Luồng Video / Khung hình JPEG thô"| FE
        FE --- UI
    end

    subgraph BusinessTier["Tầng Nghiệp Vụ & Bảo Mật (Application Tier - Port 8080)"]
        BE["Core Business Backend (Java 21 + Spring Boot 3.5)"]
        Sec["Spring Security + Stateless JWT (HMAC-SHA256)"]
        Flyway["Flyway Schema Migration (V1 - V3)"]
        BE --- Sec
        BE --- Flyway
    end

    subgraph AITier["Tầng Suy Luận AI Độc Lập (AI Inference Tier - Port 8000)"]
        AI["AI Service (Python 3.11 + FastAPI)"]
        ONNX["ONNX Runtime Engine (CPUExecutionProvider x86_64)"]
        ArcFace["InsightFace buffalo_l (SCRFD Detection + ArcFace ResNet50)"]
        Gallery["ArcFace Gallery (Vector 512 chiều - embeddings.npz)"]
        AI --- ONNX
        ONNX --- ArcFace
        ArcFace --- Gallery
    end

    subgraph DataTier["Tầng Cơ Sở Dữ Liệu (Data Tier - Port 5432)"]
        DB[("PostgreSQL 17 (6 Bảng Quan Hệ ACID)")]
    end

    FE -->|"HTTP REST API + Bearer JWT (Qua Vite Proxy /api)"| BE
    BE -->|"Forward Ảnh + Header X-API-Key (150 - 220ms)"| AI
    AI -->|"Kết quả Nhận diện + Điểm Cosine Similarity"| BE
    BE -->|"Truy vấn & Lưu bản ghi (JDBC / Transaction)"| DB
```

---

## 2. Sơ đồ Pipeline Xử lý & Nhận diện Khuôn mặt AI (ArcFace 512D)
*(Dùng cho Chương 1 — Mục 1.2: Cơ sở lý thuyết về Thị giác máy tính & Mô hình ArcFace)*

```mermaid
flowchart LR
    A["Khung hình JPEG/PNG từ Webcam"] --> B["1. Face Detection (SCRFD Detector)"]
    B --> C{"Số khuôn mặt == 1?"}
    C -->|"0 mặt"| E1["Trả về: no_face"]
    C -->|"> 1 mặt"| E2["Trả về: multiple_faces"]
    C -->|"Đúng 1 mặt"| D["2. Kiểm tra Chất lượng (Kích thước >= 80x80px, Độ nét, Góc mặt)"]
    D -->|"Không đạt"| E3["Trả về: low_quality"]
    D -->|"Đạt chuẩn"| F["3. Face Alignment (Căn chỉnh 5 điểm mốc về 112x112px)"]
    F --> G["4. Feature Extraction (ArcFace ResNet50 ONNX)"]
    G --> H["Vector Đặc trưng 512 chiều (L2-Normalized Float32)"]
    H --> I["5. So khớp Cosine Similarity với Gallery Mẫu"]
    I --> J{"Cosine Score >= 0.50?"}
    J -->|"Thấp hơn 0.50"| E4["Trả về: unknown (Người lạ)"]
    J -->|"Từ 0.50 trở lên"| K["Trả về: matched (Mã Sinh Viên + Điểm Cosine)"]
```

---

## 3. Biểu đồ Use Case Tổng quát & Phân quyền Hệ thống (RBAC)
*(Dùng cho Chương 2 — Mục 2.2 & 2.3: Phân quyền người dùng và Biểu đồ Use Case)*

```mermaid
flowchart LR
    Admin(["Quản trị viên (ADMIN)"])
    Teacher(["Giảng viên (TEACHER)"])

    subgraph System["Hệ Thống Điểm Danh Khuôn Mặt (Face Attendance System)"]
        subgraph AuthGroup["Xác thực & Tài khoản"]
            UC1("Đăng nhập & Xác thực JWT")
            UC2("Quản lý Tài khoản Giảng viên (Tạo/Xem)")
        end

        subgraph SchoolGroup["Quản lý Dữ liệu Học vụ & Sinh trắc"]
            UC3("Quản lý Hồ sơ Sinh viên gốc (Thêm/Sửa/Xóa)")
            UC4("Thu thập 20 ảnh & Đăng ký Khuôn mặt ArcFace")
            UC5("Quản lý Lớp học & Gán Sinh viên vào Lớp")
        end

        subgraph AttendanceGroup["Nghiệp vụ Điểm danh & Báo cáo"]
            UC6("Mở / Đóng / Mở lại Phiên điểm danh")
            UC7("Điểm danh Camera AI Thời gian thực")
            UC8("Điểm danh bù Thủ công (Cosine = 1.000)")
            UC9("Xem Dashboard Thống kê & Biểu đồ Chuyên cần")
            UC10("Xuất Báo cáo Điểm danh Excel (UTF-8 BOM)")
        end
    end

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10

    Teacher --> UC1
    Teacher --> UC4
    Teacher --> UC5
    Teacher --> UC6
    Teacher --> UC7
    Teacher --> UC8
    Teacher --> UC9
    Teacher --> UC10
```

---

## 4. Biểu đồ Tuần tự (Sequence Diagram) — Luồng 1: Đăng nhập & Xác thực JWT
*(Dùng cho Chương 2 — Mục 2.4.1: Luồng Đăng nhập và xác thực JWT)*

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (Admin / Teacher)
    participant FE as React 19 Frontend
    participant BE as Spring Boot Backend (8080)
    participant DB as PostgreSQL 17

    User->>FE: Nhập username & password trên trang Login
    FE->>BE: POST /api/auth/login {username, password}
    BE->>DB: SELECT * FROM users WHERE username = ? AND enabled = true
    DB-->>BE: Trả về bản ghi User (chứa password_hash BCrypt)
    BE->>BE: Kiểm tra mật khẩu bằng BCrypt (Cost factor = 12)
    alt Thông tin không hợp lệ
        BE-->>FE: HTTP 401 Unauthorized
        FE-->>User: Hiển thị thông báo sai tài khoản hoặc mật khẩu
    else Xác thực thành công
        BE->>BE: Ký chuỗi JWT Stateless bằng HMAC-SHA256 (HS256)
        BE-->>FE: HTTP 200 OK {access_token, token_type, expires_in}
        FE->>FE: Lưu access_token vào sessionStorage (fa_access_token)
        FE->>BE: GET /api/auth/me (Header: Authorization Bearer <JWT>)
        BE-->>FE: HTTP 200 OK {username, role: ADMIN | TEACHER}
        FE-->>User: Điều hướng vào Dashboard theo quyền tương ứng
    end
```

---

## 5. Biểu đồ Tuần tự (Sequence Diagram) — Luồng 2: Thu thập 20 Ảnh mẫu & Đăng ký Khuôn mặt
*(Dùng cho Chương 2 — Mục 2.4.2: Luồng Thu thập 20 ảnh mẫu và đăng ký khuôn mặt vào ArcFace Gallery)*

```mermaid
sequenceDiagram
    autonumber
    actor User as Giảng viên / Admin
    participant FE as React 19 Frontend (Webcam)
    participant BE as Spring Boot Backend (8080)
    participant DB as PostgreSQL 17
    participant AI as FastAPI AI Service (8000)

    User->>FE: Chọn Sinh viên, xác nhận Consent & bật Camera
    loop Chụp tự động 20 khung hình ở các góc mặt nhẹ
        FE->>FE: Trích xuất frame từ Webcam Canvas sang Base64 JPEG
    end
    FE->>BE: POST /api/students/{id}/register-face {consent: true, images[20]}
    BE->>BE: Xác thực JWT & kiểm tra quyền truy cập
    BE->>DB: SELECT student_code FROM students WHERE id = ?
    DB-->>BE: Trả về student_code hợp lệ
    BE->>AI: POST /registrations (Header: X-API-Key, Body: {student_id, consent, images})
    
    loop Kiểm tra từng ảnh trong 20 ảnh mẫu
        AI->>AI: Kiểm tra trùng lặp SHA-256 & giải mã ảnh
        AI->>AI: Phát hiện khuôn mặt (yêu cầu đúng 1 mặt, >= 80x80px)
        AI->>AI: Căn chỉnh 112x112 & trích xuất vector 512 chiều chuẩn hóa L2
    end

    alt Số ảnh đạt chuẩn < 15 ảnh
        AI-->>BE: HTTP 422 Unprocessable Entity (Nêu rõ lý do ảnh lỗi)
        BE-->>FE: HTTP 422 (Thông báo cần chụp lại)
        FE-->>User: Hiển thị cảnh báo chất lượng ảnh chưa đạt
    else Đạt từ 15 - 20 ảnh chuẩn
        AI->>AI: Tính Vector Trung bình (Mean Template 512D) & chuẩn hóa L2
        AI->>AI: Lưu atomic vào data/registrations/{student_id}/embeddings.npz
        AI->>AI: Cập nhật trực tiếp bộ nhớ RAM Gallery (identities, templates)
        AI-->>BE: HTTP 201 Created {status: "registered", samples, dimensions: 512}
        BE-->>FE: HTTP 200 OK {status: "registered", student_id, samples}
        FE-->>User: Cập nhật trạng thái "Đã đăng ký khuôn mặt"
    end
```

---

## 6. Biểu đồ Tuần tự (Sequence Diagram) — Luồng 3: Điểm danh Camera Thời gian thực
*(Dùng cho Chương 2 — Mục 2.4.3: Luồng Điểm danh camera trực tiếp thời gian thực)*

```mermaid
sequenceDiagram
    autonumber
    actor Student as Sinh viên trước Camera
    participant FE as React 19 Frontend
    participant BE as Spring Boot Backend (8080)
    participant AI as FastAPI AI Service (8000)
    participant DB as PostgreSQL 17

    loop Chu kỳ quét tự động mỗi 1.5 - 2.0 giây
        Student->>FE: Đứng trước khung hình Camera lớp học
        FE->>FE: Chụp frame hiện tại thành Blob (image/jpeg)
        FE->>BE: POST /api/attendance-sessions/{sessionId}/recognize (Bearer JWT + JPEG Bytes)
        BE->>DB: Kiểm tra phiên học tồn tại và đang mở (closed_at IS NULL)
        BE->>AI: POST /recognize (Header: X-API-Key + Raw JPEG Bytes)
        AI->>AI: Detect mặt (SCRFD) -> Kiểm tra chất lượng (>=80x80px) -> Trích xuất 512D (ArcFace)
        AI->>AI: Tính Cosine Similarity với toàn bộ Gallery (Ngưỡng >= 0.50)
        AI-->>BE: Trả về RecognitionResult {status, student_id, cosine}

        alt Không rõ mặt hoặc chưa khớp (no_face / low_quality / unknown)
            BE-->>FE: Trả về {status, attendanceRecorded: false}
            FE-->>Student: Hiển thị hướng dẫn chỉnh góc mặt hoặc cảnh báo người lạ
        else Nhận diện khớp (status == "matched" & cosine >= 0.50)
            BE->>DB: Kiểm tra sinh viên thuộc lớp học (bảng class_students)
            alt Sinh viên không thuộc lớp
                BE-->>FE: Trả về {status: "student_not_in_class", attendanceRecorded: false}
            else Sinh viên thuộc lớp học
                BE->>DB: Kiểm tra bản ghi trong attendance_records (UNIQUE session_id, student_id)
                alt Đã điểm danh trước đó trong buổi học
                    BE-->>FE: Trả về {status: "already_recorded", attendanceRecorded: false, record}
                else Điểm danh lần đầu trong buổi
                    BE->>BE: So sánh thời gian hiện tại với opened_at + late_after_minutes (PRESENT / LATE)
                    BE->>DB: INSERT INTO attendance_records (session_id, student_id, status, cosine)
                    DB-->>BE: Bản ghi điểm danh mới
                    BE-->>FE: Trả về {status: "recorded", attendanceRecorded: true, record}
                    FE-->>Student: Phát tín hiệu thành công, cập nhật danh sách & 5 thẻ thống kê
                end
            end
        end
    end
```

---

## 7. Biểu đồ Trạng thái Phiên Điểm danh & Kết quả Nhận diện (State Diagram)
*(Dùng cho Chương 2 & Chương 3 — Mô tả vòng đời phiên học và xử lý trạng thái điểm danh)*

```mermaid
stateDiagram-v2
    [*] --> KhoiTaoPhien: Giảng viên tạo buổi học mới
    KhoiTaoPhien --> DangMo: opened_at = CURRENT_TIMESTAMP (closed_at = NULL)

    state DangMo {
        [*] --> ChoQuetCamera
        ChoQuetCamera --> DangXuLyAI: Gửi frame JPEG (mỗi 1.5 - 2.0s)
        DangXuLyAI --> LoiKhungHinh: no_face / multiple_faces / low_quality
        DangXuLyAI --> NguoiLa: Cosine < 0.50 (unknown)
        DangXuLyAI --> KhongThuocLop: Cosine >= 0.50 nhưng ngoài danh sách lớp
        DangXuLyAI --> DaGhiNhanTruocDo: Đã tồn tại UNIQUE(session_id, student_id)
        DangXuLyAI --> GhiNhanMoi: Hợp lệ & Chưa điểm danh
        
        GhiNhanMoi --> CoMatDungGio: Thời gian <= opened_at + late_after_minutes (PRESENT)
        GhiNhanMoi --> DiMuon: Thời gian > opened_at + late_after_minutes (LATE)

        LoiKhungHinh --> ChoQuetCamera
        NguoiLa --> ChoQuetCamera
        KhongThuocLop --> ChoQuetCamera
        DaGhiNhanTruocDo --> ChoQuetCamera
        CoMatDungGio --> ChoQuetCamera
        DiMuon --> ChoQuetCamera
    }

    DangMo --> DaDong: Giảng viên đóng phiên (closed_at = CURRENT_TIMESTAMP)
    DaDong --> DangMo: Giảng viên mở lại phiên (reopen)
    DaDong --> XuatBaoCao: Tổng hợp chuyên cần & Xuất Excel UTF-8 BOM
    XuatBaoCao --> [*]
```

---

## 8. Sơ đồ Thực thể Liên kết Cơ sở Dữ liệu (ERD - PostgreSQL 17)
*(Dùng cho Chương 2 — Mục 2.5: Thiết kế Cơ sở dữ liệu quan hệ)*

```mermaid
erDiagram
    USERS {
        BIGINT id PK "GENERATED ALWAYS AS IDENTITY"
        VARCHAR(50) username UK "NOT NULL, Regex: ^[a-z0-9][a-z0-9_.-]{2,49}$"
        VARCHAR(100) password_hash "NOT NULL (BCrypt cost = 12)"
        VARCHAR(20) role "NOT NULL, CHECK IN ('ADMIN', 'TEACHER')"
        BOOLEAN enabled "NOT NULL DEFAULT TRUE"
        TIMESTAMPTZ created_at "NOT NULL DEFAULT CURRENT_TIMESTAMP"
    }

    STUDENTS {
        BIGINT id PK "GENERATED ALWAYS AS IDENTITY"
        VARCHAR(50) student_code UK "NOT NULL, Regex: ^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$"
        VARCHAR(150) full_name "NOT NULL, CHECK length(trim) > 0"
    }

    CLASSES {
        BIGINT id PK "GENERATED ALWAYS AS IDENTITY"
        VARCHAR(50) class_code UK "NOT NULL, Regex: ^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$"
        VARCHAR(150) name "NOT NULL, CHECK length(trim) > 0"
    }

    CLASS_STUDENTS {
        BIGINT id PK "GENERATED ALWAYS AS IDENTITY"
        BIGINT class_id FK "NOT NULL REFERENCES classes(id)"
        BIGINT student_id FK "NOT NULL REFERENCES students(id)"
    }

    ATTENDANCE_SESSIONS {
        BIGINT id PK "GENERATED ALWAYS AS IDENTITY"
        BIGINT class_id FK "NOT NULL REFERENCES classes(id)"
        VARCHAR(150) title "NOT NULL"
        TIMESTAMPTZ opened_at "NOT NULL DEFAULT CURRENT_TIMESTAMP"
        TIMESTAMPTZ closed_at "NULLABLE, CHECK closed_at >= opened_at"
        INTEGER late_after_minutes "NOT NULL, CHECK BETWEEN 0 AND 180"
        BIGINT created_by FK "NOT NULL REFERENCES users(id)"
    }

    ATTENDANCE_RECORDS {
        BIGINT id PK "GENERATED ALWAYS AS IDENTITY"
        BIGINT session_id FK "NOT NULL REFERENCES attendance_sessions(id)"
        BIGINT student_id FK "NOT NULL REFERENCES students(id)"
        TIMESTAMPTZ recorded_at "NOT NULL DEFAULT CURRENT_TIMESTAMP"
        VARCHAR(10) status "NOT NULL, CHECK IN ('PRESENT', 'LATE')"
        DOUBLE_PRECISION cosine "NOT NULL, CHECK BETWEEN -1 AND 1"
    }

    USERS ||--o{ ATTENDANCE_SESSIONS : "tạo phiên (created_by)"
    CLASSES ||--o{ CLASS_STUDENTS : "bao gồm (class_id)"
    STUDENTS ||--o{ CLASS_STUDENTS : "tham gia (student_id)"
    CLASSES ||--o{ ATTENDANCE_SESSIONS : "tổ chức (class_id)"
    ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_RECORDS : "ghi nhận (session_id)"
    STUDENTS ||--o{ ATTENDANCE_RECORDS : "được điểm danh (student_id)"
```

---

## 9. Biểu đồ Định lượng Bố cục Báo cáo & Thực nghiệm Hiệu năng
*(Dùng cho Phần Mở đầu & Chương 4 — Đánh giá Thực nghiệm)*

### 9.1. Phân bổ tỷ trọng trang theo cấu trúc báo cáo (Chuẩn 55 – 75 trang)

```mermaid
xychart-beta
    title "Phan bo ty trong noi dung Bao cao Do an (%)"
    x-axis ["Mo dau", "Chuong 1 (Ly thuyet)", "Chuong 2 (Thiet ke)", "Chuong 3 (Hien thuc)", "Chuong 4 (Thu nghiem)", "Ket luan"]
    y-axis "Ty trong (%)" 0 --> 35
    bar [5, 20, 30, 25, 15, 5]
```

### 9.2. Độ chính xác nhận diện thực nghiệm theo Ngưỡng Cosine (Threshold = 0.50)

```mermaid
xychart-beta
    title "Do chinh xac nhan dien (%) theo Nguong Cosine Similarity"
    x-axis ["0.30", "0.40", "0.45", "0.50 (Chon)", "0.55", "0.60", "0.70"]
    y-axis "Do chinh xac (%)" 70 --> 100
    line [78.5, 89.2, 94.0, 96.8, 95.1, 91.4, 82.0]
```
