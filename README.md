# Classes369 Student Management API

Flask + SQL Server project for managing the `QLSV_TrungTamTinHoc` schema.

## 1) Chức Năng Chính

- Đăng nhập theo vai trò từ bảng `Users` + `Roles`.
- Trang riêng theo vai trò:
  - Admin: `/admin/home`
  - Teacher: `/teacher/home`
  - Student: `/student/home`
- Dashboard quản trị: `/dashboard`.
- CRUD học viên, giảng viên, khóa học, lớp học, ghi danh.
- Quản lý học phí (`Tuitions`) và biên lai (`Receipts`).
- Quản lý điểm (`ScoreTypes`, `Scores`).
- Thông báo (`Notifications`, `NotificationRecipients`).

## 2) Cấu Trúc Dự Án

```text
BTL_API/
├─ app.py
├─ db.py
├─ Dockerfile
├─ docker-compose.yml
├─ .gitignore
├─ .dockerignore
├─ .env.example
├─ .env.docker.example
├─ database/
│  ├─ QLSV_TrungTamTinHoc.sql
│  └─ ...
├─ docker/
│  └─ db-init/
│     └─ init-db.sh
├─ models/
├─ routes/
├─ templates/
└─ static/
```

## 3) Cách 1 - Chạy Local (không Docker)

### 3.1 Cài dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3.2 Chuẩn bị `.env`

Tạo file `.env` từ `.env.example` và chỉnh giá trị phù hợp máy local:

```env
DB_DRIVER=ODBC Driver 17 for SQL Server
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=QLSV_TrungTamTinHoc
DB_TRUSTED_CONNECTION=yes
FLASK_SECRET_KEY=change-this-to-random-text
```

### 3.3 Chạy app

```powershell
python app.py
```

Mở:

- `http://127.0.0.1:5000/login`
- `http://127.0.0.1:5000/home`
- `http://127.0.0.1:5000/dashboard`
- `http://127.0.0.1:5000/api/health`

## 4) Cách 2 - Chạy Bằng Docker (app + SQL Server)

Mục tiêu: khách hàng chỉ cần Docker Desktop, không cần cài SQL Server riêng và không cần tự chạy script DB bằng tay.

### 4.1 Điều kiện

- Đã cài Docker Desktop.
- Bật Docker engine và đảm bảo lệnh `docker compose` chạy được.

### 4.2 Tạo file env cho Docker

Copy file mẫu:

```powershell
Copy-Item .env.docker.example .env.docker
```

Mở `.env.docker` và chỉnh:

```env
MSSQL_SA_PASSWORD=YourStrong!Passw0rd
DB_NAME=QLSV_TrungTamTinHoc
DB_ENCRYPT=yes
DB_TRUST_SERVER_CERTIFICATE=yes
FLASK_SECRET_KEY=change-this-to-a-random-secret
APP_PORT=5000
MSSQL_PORT=1433
```

Lưu ý:

- `MSSQL_SA_PASSWORD` phải đủ mạnh theo policy của SQL Server.
- Không commit `.env.docker` lên git.
- Dùng `--env-file .env.docker` cho mọi lệnh `docker compose` để tránh cảnh báo thiếu biến môi trường.

### 4.3 Build và chạy toàn bộ stack

```powershell
docker compose --env-file .env.docker up -d --build
```

Stack gồm 3 service:

- `db`: SQL Server 2022.
- `db-init`: chờ DB sẵn sàng rồi import `database/QLSV_TrungTamTinHoc.sql` (chỉ khi DB chưa khởi tạo).
- `web`: Flask API kết nối vào `db` qua network nội bộ Docker.

### 4.4 Kiểm tra container

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f db-init
docker compose --env-file .env.docker logs -f web
```

Khi `db-init` báo `Database initialization completed` hoặc `already initialized`, có thể truy cập app:

- `http://127.0.0.1:5000/login`
- `http://127.0.0.1:5000/api/health`

### 4.5 Tài khoản test

- Admin: `admin` / `admin@123`
- Teacher: `hung.dq` / `123456`
- Student: `tien.nm` / `123456`

### 4.6 Dừng hệ thống

```powershell
docker compose --env-file .env.docker down
```

### 4.7 Xoá toàn bộ dữ liệu DB Docker và khởi tạo lại từ đầu

```powershell
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d --build
```

Lệnh `down -v` sẽ xoá volume `sqlserver_data`, lần chạy tiếp theo `db-init` sẽ import DB mới lại từ script SQL.

## 5) API Nhóm Chính

- `POST /login`, `POST /logout`
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/students`
- `GET/POST/PUT/DELETE /api/teachers`
- `GET/POST/PUT/DELETE /api/courses`
- `GET/POST/PUT/DELETE /api/classes`
- `GET/POST /api/enrollments`
- `GET /api/tuitions`
- `POST /api/payments`, `GET /api/payments/receipts`
- `GET/POST /api/scores`
- `GET/POST /api/notifications`
- `GET /api/reports/summary`

## 6) Troubleshooting Nhanh

- `Login failed do DB`: kiểm tra `docker compose --env-file .env.docker logs web` và `docker compose --env-file .env.docker logs db`.
- `db-init fail`: thường do password SQL yếu hoặc script SQL lỗi.
- `Port 5000 bị chiếm`: đổi `APP_PORT` trong `.env.docker`.
- `Port 1433 bị chiếm`: đổi `MSSQL_PORT` trong `.env.docker`.
- `Đổi script seed/schema`: cập nhật file trong `database/` rồi chạy lại với `docker compose down -v`.
