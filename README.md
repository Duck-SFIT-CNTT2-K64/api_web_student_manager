# Classes369 Student Management API

Flask + SQL Server project for managing the latest `QLSV_TrungTamTinHoc` database schema.

## What This Version Covers

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
├─ routes/
├─ templates/
│  └─ dashboard.html
└─ static/
   ├─ css/style.css
   └─ js/dashboard.js
```

## Database Setup

1. Open SQL Server Management Studio.
2. Run `QLSV_TrungTamTinHoc.sql`.
3. Confirm the database name is `QLSV_TrungTamTinHoc`.

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

- `http://127.0.0.1:5000/dashboard`
- `http://127.0.0.1:5000/api/health`

## API Groups

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
- Password handling is intentionally kept compatible with the supplied database sample. Add hashing before production use.
