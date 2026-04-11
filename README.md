# Classes369 Student Management API

Flask + SQL Server project for managing the latest `QLSV_TrungTamTinHoc` database schema.

## What This Version Covers

- Login page at `/login` with role-based redirect from database (`Users` + `Roles`).
- Different home pages per role:
   - Admin: `/admin/home`
   - Teacher: `/teacher/home`
   - Student: `/student/home`
- Dashboard page at `/dashboard` with live data from REST APIs.
- Students linked to `Users` and `StudentStatuses`.
- Teachers, courses, classes, class capacity, and enrollments.
- Tuition tracking through `Tuitions` and payment receipts through `Receipts`.
- Score entry through `ScoreTypes` and `Scores`.
- Notifications through `Notifications` and `NotificationRecipients`.
- Report summary endpoint for dashboard totals and top courses.

## Project Structure

```text
BTL_API/
├─ app.py
├─ db.py
├─ QLSV_TrungTamTinHoc.sql
├─ models/
│  └─ auth_model.py
├─ routes/
│  └─ auth_routes.py
├─ templates/
│  ├─ login.html
│  ├─ admin_home.html
│  ├─ teacher_home.html
│  ├─ student_home.html
│  └─ dashboard.html
└─ static/
   ├─ css/style.css
   ├─ css/auth_pages.css
   └─ js/dashboard.js
```

## Database Setup

1. Open SQL Server Management Studio.
2. Run `QLSV_TrungTamTinHoc.sql`.
3. Confirm the database name is `QLSV_TrungTamTinHoc`.
4. (Khuyến nghị) Run `seed_mock_teachers_students.sql` để thêm dữ liệu ảo giáo viên/học sinh và sửa lệch role-profile của `teacher01` / `student01`.

The project no longer targets the older `QLSV_TrungTamTinHoc_` schema.

## Environment

Create a virtual environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Configure SQL Server connection variables:

```powershell
$env:DB_DRIVER="ODBC Driver 17 for SQL Server"
$env:DB_SERVER="localhost"
$env:DB_NAME="QLSV_TrungTamTinHoc"
$env:DB_TRUSTED_CONNECTION="yes"
$env:FLASK_SECRET_KEY="change-this-to-random-text"
```

For SQL Server authentication:

```powershell
$env:DB_TRUSTED_CONNECTION="no"
$env:DB_USER="sa"
$env:DB_PASSWORD="your_password"
```

## Run

```powershell
python app.py
```

Open:

- `http://127.0.0.1:5000/login`
- `http://127.0.0.1:5000/home` (auto redirect by role)
- `http://127.0.0.1:5000/dashboard`
- `http://127.0.0.1:5000/api/health`

## Login Test Accounts (from provided SQL)

- Admin: `admin` / `admin@123`
- Teacher: `hung.dq` / `123456`
- Student: `tien.nm` / `123456`

The app supports both plain text passwords and bcrypt hashes in `Users.PasswordHash`.

## API Groups

- `POST /login` (form login)
- `POST /logout` (form logout)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/students`
- `GET /api/students/statuses`
- `GET /api/teachers`
- `GET/POST/PUT/DELETE /api/courses`
- `GET/POST/PUT/DELETE /api/classes`
- `GET /api/classes/schedules`
- `GET /api/classes/rooms`
- `GET/POST /api/enrollments`
- `GET /api/tuitions`
- `POST /api/payments`
- `GET /api/payments/receipts`
- `GET/POST /api/scores`
- `GET /api/scores/types`
- `GET/POST /api/notifications`
- `GET /api/reports/summary`

## Notes

- Creating a student also creates the linked `Users` row with role `Student`.
- Creating an enrollment also creates a `Tuitions` row using the class course fee.
- Recording a payment updates `Tuitions.AmountPaid`, recalculates tuition status, and inserts a `Receipts` row.
- Authorization for role pages is enforced through server-side session (`login_required` and `role_required`).
- `/dashboard` is restricted to `Admin` role.
