# Student Management System (Flask + SQL Server + Vanilla JS)

A full-stack Student Management System using:
- Backend: Flask REST API
- Database: SQL Server (pyodbc)
- Frontend: HTML + CSS + JavaScript (no framework)

## 1) Project Structure

```
BTL_API/
├─ app.py
├─ db.py
├─ requirements.txt
├─ .env.example
├─ routes/
│  ├─ page_routes.py
│  ├─ student_routes.py
│  ├─ course_routes.py
│  ├─ class_routes.py
│  ├─ enrollment_routes.py
│  ├─ payment_routes.py
│  └─ score_routes.py
├─ models/
│  ├─ helpers.py
│  ├─ student_model.py
│  ├─ course_model.py
│  ├─ class_model.py
│  ├─ enrollment_model.py
│  ├─ payment_model.py
│  └─ score_model.py
├─ templates/
│  ├─ students.html
│  ├─ classes.html
│  └─ enrollment.html
├─ static/
│  ├─ css/style.css
│  └─ js/
│     ├─ students.js
│     ├─ classes.js
│     └─ enrollment.js
└─ QLSV_TrungTamTinHoc_.sql
```

## 2) Prerequisites

1. Python 3.10+
2. SQL Server
3. ODBC Driver 17 for SQL Server (or newer)

## 3) Database Setup

1. Open SQL Server Management Studio.
2. Run `QLSV_TrungTamTinHoc_.sql` to create database and tables.
3. Run `seed_sample_data.sql` to insert sample `Teachers`, `Courses`, and `Classes` data.

## 4) Backend Setup

1. Create virtual environment and activate it:

   Windows PowerShell:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Configure database environment variables (example):

   ```powershell
   $env:DB_DRIVER="ODBC Driver 17 for SQL Server"
   $env:DB_SERVER="localhost"
   $env:DB_NAME="QLSV_TrungTamTinHoc_"
   $env:DB_TRUSTED_CONNECTION="yes"
   ```

   If using SQL Server authentication:
   ```powershell
   $env:DB_TRUSTED_CONNECTION="no"
   $env:DB_USER="sa"
   $env:DB_PASSWORD="your_password"
   ```

4. Run Flask app:

   ```powershell
   python app.py
   ```

5. Open browser:
   - http://127.0.0.1:5000/students-page
   - http://127.0.0.1:5000/classes-page
   - http://127.0.0.1:5000/enrollment-page

## 5) API Endpoints

### Students (CRUD)
- `GET /api/students`
- `GET /api/students/{id}`
- `POST /api/students`
- `PUT /api/students/{id}`
- `DELETE /api/students/{id}`

### Courses
- `GET /api/courses`

### Classes (JOIN with teacher + course)
- `GET /api/classes`

### Enrollments
- `GET /api/enrollments` (JOIN enrollment info)
- `POST /api/enrollments`

### Payments
- `POST /api/payments`

### Scores
- `POST /api/scores`

## 6) Sample Postman Requests

### 6.1 Add Student
**POST** `http://127.0.0.1:5000/api/students`
```json
{
  "FullName": "Nguyen Van A",
  "Email": "vana@example.com",
  "Phone": "0901234567",
  "DateOfBirth": "2005-04-01"
}
```

### 6.2 Enroll Student To Class
**POST** `http://127.0.0.1:5000/api/enrollments`
```json
{
  "StudentId": 1,
  "ClassId": 1,
  "Status": "Đang học"
}
```

### 6.3 Make Payment
**POST** `http://127.0.0.1:5000/api/payments`
```json
{
  "StudentId": 1,
  "Amount": 2500000,
  "Method": "Bank Transfer"
}
```

### 6.4 Add Score
**POST** `http://127.0.0.1:5000/api/scores`
```json
{
  "EnrollmentId": 1,
  "Score": 8.5
}
```

## 7) Notes

- All APIs return JSON with a `success` flag.
- Each route uses `try/except` for validation and database error handling.
- JOIN queries are implemented for:
  - Classes with `TeacherName` and `CourseName`
  - Enrollments with student/class/course/teacher info
