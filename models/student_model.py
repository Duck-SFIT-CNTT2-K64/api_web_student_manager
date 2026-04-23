from typing import Any, Dict, List, Optional
import bcrypt

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

STUDENT_SELECT_BASE = """
SELECT
    s.StudentId,
    s.UserId,
    s.StatusId,
    ss.StatusName,
    s.StudentCode,
    s.FullName,
    s.DateOfBirth,
    s.Gender,
    s.Address,
    s.PhoneNumber,
    s.Email,
    u.Username,
    u.Status AS AccountStatus,
    u.DateCreated
FROM Students s
LEFT JOIN StudentStatuses ss ON s.StatusId = ss.StatusId
LEFT JOIN Users u ON s.UserId = u.UserId
"""


def get_all_students() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(STUDENT_SELECT_BASE + " ORDER BY s.StudentId")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def search_students(keyword: str) -> List[Dict[str, Any]]:
    term = (keyword or "").strip()
    if not term:
        return get_all_students()

    like_term = f"%{term}%"
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            STUDENT_SELECT_BASE
            + """
            WHERE s.StudentCode LIKE ? OR s.FullName LIKE ? OR s.Email LIKE ?
            ORDER BY s.StudentId
            """,
            like_term,
            like_term,
            like_term,
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_student_by_id(student_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(STUDENT_SELECT_BASE + " WHERE s.StudentId = ?", student_id)
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def get_student_statuses() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT StatusId, StatusName FROM StudentStatuses ORDER BY StatusId")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def _get_role_id(cursor, role_name: str) -> int:
    cursor.execute("SELECT RoleId FROM Roles WHERE RoleName = ?", role_name)
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Role '{role_name}' does not exist in the database.")
    return int(row[0])


def _get_default_status_id(cursor) -> Optional[int]:
    cursor.execute(
        """
        SELECT TOP 1 StatusId
        FROM StudentStatuses
        ORDER BY CASE WHEN StatusName = N'Đang học' THEN 0 ELSE 1 END, StatusId
        """
    )
    row = cursor.fetchone()
    return int(row[0]) if row else None


def _make_unique_username(cursor, desired: str) -> str:
    base = "".join(ch for ch in desired.lower().strip() if ch.isalnum() or ch in "._-")
    if not base:
        base = "student"

    username = base[:50]
    suffix = 1
    while True:
        cursor.execute("SELECT 1 FROM Users WHERE Username = ?", username)
        if not cursor.fetchone():
            return username
        suffix += 1
        suffix_text = str(suffix)
        username = f"{base[:50 - len(suffix_text) - 1]}_{suffix_text}"


def _student_code_exists(cursor, student_code: str, exclude_student_id: Optional[int] = None) -> bool:
    if exclude_student_id is None:
        cursor.execute("SELECT TOP 1 StudentId FROM Students WHERE StudentCode = ?", student_code)
    else:
        cursor.execute(
            "SELECT TOP 1 StudentId FROM Students WHERE StudentCode = ? AND StudentId <> ?",
            student_code,
            int(exclude_student_id),
        )
    return cursor.fetchone() is not None


def _email_exists_in_users(cursor, email: str, exclude_user_id: Optional[int] = None) -> bool:
    if exclude_user_id is None:
        cursor.execute("SELECT TOP 1 UserId FROM Users WHERE Email = ?", email)
    else:
        cursor.execute(
            "SELECT TOP 1 UserId FROM Users WHERE Email = ? AND UserId <> ?",
            email,
            int(exclude_user_id),
        )
    return cursor.fetchone() is not None


def _username_exists(cursor, username: str, exclude_user_id: Optional[int] = None) -> bool:
    if exclude_user_id is None:
        cursor.execute("SELECT TOP 1 UserId FROM Users WHERE Username = ?", username)
    else:
        cursor.execute(
            "SELECT TOP 1 UserId FROM Users WHERE Username = ? AND UserId <> ?",
            username,
            int(exclude_user_id),
        )
    return cursor.fetchone() is not None


def create_student(payload: Dict[str, Any]) -> Dict[str, Any]:
    full_name = (payload.get("FullName") or "").strip()
    if not full_name:
        raise ValueError("FullName is required.")

    email = (payload.get("Email") or "").strip()
    if not email:
        raise ValueError("Email is required.")

    phone = payload.get("PhoneNumber") or payload.get("Phone") or None
    date_of_birth = payload.get("DateOfBirth") or None
    gender = payload.get("Gender") or None
    address = payload.get("Address") or None
    password = payload.get("Password") or "123456"
    account_status = payload.get("AccountStatus") or "Active"
    requested_username = (payload.get("Username") or "").strip()
    student_code = (payload.get("StudentCode") or "")[:20]

    with get_db_connection() as connection:
        cursor = connection.cursor()
        try:
            role_id = _get_role_id(cursor, "Student")
            status_id = payload.get("StatusId") or _get_default_status_id(cursor)
            if _email_exists_in_users(cursor, email):
                raise ValueError("Email đã tồn tại trong hệ thống. Vui lòng dùng email khác.")

            if requested_username:
                if _username_exists(cursor, requested_username):
                    raise ValueError("Username đã tồn tại. Vui lòng dùng username khác.")
                username = requested_username
            else:
                username_seed = email.split("@")[0] or full_name
                username = _make_unique_username(cursor, username_seed)

            if not student_code:
                cursor.execute("SELECT ISNULL(MAX(StudentId), 0) + 1 FROM Students")
                next_student_id = int(cursor.fetchone()[0])
                student_code = f"SV{next_student_id:06d}"[:20]
            if _student_code_exists(cursor, student_code):
                raise ValueError("Mã sinh viên đã tồn tại. Vui lòng nhập mã khác.")

            cursor.execute(
                """
                INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
                OUTPUT INSERTED.UserId
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                role_id,
                username,
                bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
                full_name,
                email,
                phone,
                account_status,
            )
            user_id = int(cursor.fetchone()[0])

            cursor.execute(
                """
                INSERT INTO Students
                    (UserId, StatusId, StudentCode, FullName, DateOfBirth, Gender, Address, PhoneNumber, Email)
                OUTPUT INSERTED.StudentId
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                user_id,
                status_id,
                student_code,
                full_name,
                date_of_birth,
                gender,
                address,
                phone,
                email,
            )
            student_id = int(cursor.fetchone()[0])
            connection.commit()
        except Exception:
            connection.rollback()
            raise

        cursor.execute(STUDENT_SELECT_BASE + " WHERE s.StudentId = ?", student_id)
        row = cursor.fetchone()
        result = row_to_dict(cursor, row)
        result["_loginUsername"] = username
        result["_loginPassword"] = password
        return result


def update_student(student_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(STUDENT_SELECT_BASE + " WHERE s.StudentId = ?", student_id)
        existing_row = cursor.fetchone()
        if not existing_row:
            return None

        existing_student = row_to_dict(cursor, existing_row)

        full_name = (payload.get("FullName", existing_student["FullName"]) or "").strip()
        if not full_name:
            raise ValueError("FullName cannot be empty.")

        email = payload.get("Email", existing_student["Email"])
        phone = payload.get("PhoneNumber", payload.get("Phone", existing_student["PhoneNumber"]))
        date_of_birth = payload.get("DateOfBirth", existing_student["DateOfBirth"])
        student_code = payload.get("StudentCode", existing_student["StudentCode"])
        status_id = payload.get("StatusId", existing_student["StatusId"])
        gender = payload.get("Gender", existing_student["Gender"])
        address = payload.get("Address", existing_student["Address"])
        account_status = payload.get("AccountStatus", existing_student["AccountStatus"])
        username = payload.get("Username", existing_student["Username"])

        if _student_code_exists(cursor, student_code, student_id):
            raise ValueError("Mã sinh viên đã tồn tại ở bản ghi khác.")

        if _email_exists_in_users(cursor, email, int(existing_student["UserId"])):
            raise ValueError("Email đã tồn tại ở tài khoản khác.")

        if username and _username_exists(cursor, username, int(existing_student["UserId"])):
            raise ValueError("Username đã tồn tại ở tài khoản khác.")

        try:
            cursor.execute(
                """
                UPDATE Students
                SET StudentCode = ?, FullName = ?, Email = ?, PhoneNumber = ?,
                    DateOfBirth = ?, Gender = ?, Address = ?, StatusId = ?
                WHERE StudentId = ?
                """,
                student_code,
                full_name,
                email,
                phone,
                date_of_birth,
                gender,
                address,
                status_id,
                student_id,
            )
            cursor.execute(
                """
                UPDATE Users
                SET Username = ?, FullName = ?, Email = ?, PhoneNumber = ?, Status = ?
                WHERE UserId = ?
                """,
                username,
                full_name,
                email,
                phone,
                account_status,
                existing_student["UserId"],
            )
            
            # Nếu có đổi mật khẩu (ví dụ được truyền qua payload)
            new_password = payload.get("Password")
            if new_password:
                cursor.execute(
                    "UPDATE Users SET PasswordHash = ? WHERE UserId = ?",
                    (bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"), existing_student["UserId"])
                )
            
            connection.commit()
        except Exception:
            connection.rollback()
            raise

        cursor.execute(STUDENT_SELECT_BASE + " WHERE s.StudentId = ?", student_id)
        updated_row = cursor.fetchone()
        return row_to_dict(cursor, updated_row)


def delete_student_by_id(student_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT UserId FROM Students WHERE StudentId = ?", student_id)
        row = cursor.fetchone()
        if not row:
            return False

        user_id = int(row[0])

        # Kiểm tra nợ học phí trước khi xóa
        cursor.execute("""
            SELECT ISNULL(SUM(t.TotalFee - t.AmountPaid), 0)
            FROM Tuitions t
            INNER JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId
            WHERE e.StudentId = ?
        """, student_id)
        row_tuition = cursor.fetchone()
        unpaid_amount = row_tuition[0] if row_tuition else 0
        
        if unpaid_amount > 0:
            raise ValueError(f"Không thể xóa sinh viên này vì vẫn còn khoản học phí chưa thanh toán ({unpaid_amount:,.0f} VNĐ).")

        try:
            cursor.execute("DELETE FROM Students WHERE StudentId = ?", student_id)
            deleted = cursor.rowcount > 0
            cursor.execute(
                """
                DELETE FROM Users
                WHERE UserId = ?
                  AND NOT EXISTS (SELECT 1 FROM Students WHERE UserId = ?)
                  AND NOT EXISTS (SELECT 1 FROM Teachers WHERE UserId = ?)
                """,
                user_id,
                user_id,
                user_id,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        return deleted


def get_student_id_by_user_id(user_id: int) -> Optional[int]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT TOP 1 StudentId FROM Students WHERE UserId = ?", int(user_id))
        row = cursor.fetchone()
        return int(row[0]) if row else None


def get_student_profile_by_user_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                s.StudentId,
                s.StudentCode,
                s.FullName,
                s.Email,
                s.PhoneNumber,
                s.DateOfBirth,
                s.Gender,
                s.Address,
                ss.StatusName,
                (SELECT COUNT(*)
                 FROM Enrollments e
                 WHERE e.StudentId = s.StudentId
                   AND e.Status = N'Enrolled') AS ActiveClasses,
                (SELECT ISNULL(SUM(t.TotalFee - t.AmountPaid), 0)
                 FROM Tuitions t
                 INNER JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId
                 WHERE e.StudentId = s.StudentId) AS TotalDebt
            FROM Students s
            LEFT JOIN StudentStatuses ss ON s.StatusId = ss.StatusId
            WHERE s.UserId = ?
            """,
            int(user_id),
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def get_student_learning_by_user_id(user_id: int) -> Dict[str, List[Dict[str, Any]]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                e.EnrollmentId,
                e.EnrollmentDate,
                e.Status,
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                co.CourseId,
                co.CourseCode,
                co.CourseName,
                co.Description AS CourseContent,
                co.Duration,
                co.Credits,
                co.TuitionFee,
                CASE
                    WHEN t.TeacherId IS NULL THEN NULL
                    ELSE CONCAT(t.LastName, N' ', t.FirstName)
                END AS TeacherName
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Teachers t ON c.TeacherId = t.TeacherId
            WHERE s.UserId = ?
            ORDER BY e.EnrollmentDate DESC, e.EnrollmentId DESC
            """,
            int(user_id),
        )
        enrollment_rows = cursor.fetchall()
        enrollments = rows_to_list(cursor, enrollment_rows)

        contents: List[Dict[str, Any]] = []
        seen_course_ids = set()
        for item in enrollments:
            course_id = item.get("CourseId")
            if course_id in seen_course_ids:
                continue
            seen_course_ids.add(course_id)
            contents.append(
                {
                    "CourseId": course_id,
                    "CourseCode": item.get("CourseCode"),
                    "CourseName": item.get("CourseName"),
                    "CourseContent": item.get("CourseContent"),
                    "Duration": item.get("Duration"),
                    "Credits": item.get("Credits"),
                }
            )

        return {"Enrollments": enrollments, "CourseContents": contents}


def get_student_registration_status_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                e.EnrollmentId,
                e.EnrollmentDate,
                e.Status AS RegistrationStatus,
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                co.TuitionFee
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            WHERE s.UserId = ?
            ORDER BY e.EnrollmentDate DESC, e.EnrollmentId DESC
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_registration_options_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    student_id = get_student_id_by_user_id(user_id)
    if not student_id:
        return []

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                c.MaxStudents,
                co.CourseCode,
                co.CourseName,
                co.Description AS CourseContent,
                co.TuitionFee,
                COUNT(e.EnrollmentId) AS EnrollmentCount,
                CASE
                    WHEN c.MaxStudents IS NULL THEN NULL
                    ELSE c.MaxStudents - COUNT(e.EnrollmentId)
                END AS RemainingSeats
            FROM Classes c
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            WHERE NOT EXISTS (
                SELECT 1
                FROM Enrollments me
                WHERE me.ClassId = c.ClassId
                  AND me.StudentId = ?
            )
            GROUP BY
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                c.MaxStudents,
                co.CourseCode,
                co.CourseName,
                co.Description,
                co.TuitionFee
            HAVING c.MaxStudents IS NULL OR c.MaxStudents > COUNT(e.EnrollmentId)
            ORDER BY co.CourseName, c.ClassName
            """,
            int(student_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def create_student_registration(user_id: int, class_id: int) -> Dict[str, Any]:
    student_id = get_student_id_by_user_id(user_id)
    if not student_id:
        raise ValueError("Không tìm thấy hồ sơ sinh viên cho tài khoản hiện tại.")

    from models.enrollment_model import create_enrollment

    return create_enrollment(
        {
            "StudentId": int(student_id),
            "ClassId": int(class_id),
            "Status": "Enrolled",
            "CreateTuition": True,
        }
    )


def get_student_schedule_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassCode,
                c.ClassName,
                cs.Weekday,
                cs.StartTime,
                cs.EndTime,
                r.RoomName,
                CONCAT(t.LastName, N' ', t.FirstName) AS TeacherName
            FROM ClassSchedules cs
            INNER JOIN Classes c ON cs.ClassId = c.ClassId
            INNER JOIN Enrollments e ON c.ClassId = e.ClassId
            INNER JOIN Students s ON e.StudentId = s.StudentId
            LEFT JOIN Teachers t ON c.TeacherId = t.TeacherId
            LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
            WHERE s.UserId = ?
              AND e.Status = N'Enrolled'
            ORDER BY
                CASE
                    WHEN cs.Weekday = N'Monday' THEN 1
                    WHEN cs.Weekday = N'Tuesday' THEN 2
                    WHEN cs.Weekday = N'Wednesday' THEN 3
                    WHEN cs.Weekday = N'Thursday' THEN 4
                    WHEN cs.Weekday = N'Friday' THEN 5
                    WHEN cs.Weekday = N'Saturday' THEN 6
                    ELSE 7
                END,
                cs.StartTime
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_student_exam_schedule_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassCode,
                c.ClassName,
                co.CourseName,
                DATEADD(DAY, 60, CAST(e.EnrollmentDate AS DATE)) AS ExamDate,
                COALESCE(MIN(r.RoomName), N'TBA') AS ExamRoom,
                N'Planned' AS ExamStatus
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN ClassSchedules cs ON c.ClassId = cs.ClassId
            LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
            WHERE s.UserId = ?
              AND e.Status = N'Enrolled'
            GROUP BY
                c.ClassCode,
                c.ClassName,
                co.CourseName,
                DATEADD(DAY, 60, CAST(e.EnrollmentDate AS DATE))
            ORDER BY ExamDate ASC, c.ClassCode
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_student_scores_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                co.Credits,
                MIN(e.EnrollmentId) AS EnrollmentId,
                MIN(e.EnrollmentDate) AS EnrollmentDate,
                MAX(CASE WHEN st.ScoreTypeId = 1 THEN sc.ScoreValue END) AS ChuyenCan,
                MAX(CASE WHEN st.ScoreTypeId = 2 THEN sc.ScoreValue END) AS GiuaKy,
                MAX(CASE WHEN st.ScoreTypeId = 3 THEN sc.ScoreValue END) AS CuoiKy
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Scores sc ON e.EnrollmentId = sc.EnrollmentId
            LEFT JOIN ScoreTypes st ON sc.ScoreTypeId = st.ScoreTypeId
            WHERE s.UserId = ?
            GROUP BY
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                co.Credits
            ORDER BY MIN(e.EnrollmentDate) DESC, c.ClassCode
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_student_finance_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                t.TuitionId,
                c.ClassCode,
                c.ClassName,
                t.TotalFee,
                t.AmountPaid,
                (t.TotalFee - t.AmountPaid) AS Debt,
                t.DueDate,
                t.Status
            FROM Tuitions t
            INNER JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Students s ON e.StudentId = s.StudentId
            WHERE s.UserId = ?
            ORDER BY t.DueDate, t.TuitionId
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def create_student_tuition_payment(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    tuition_id = payload.get("TuitionId") or payload.get("tuitionId")
    if tuition_id is None:
        raise ValueError("TuitionId is required.")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP 1 t.TuitionId
            FROM Tuitions t
            INNER JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId
            INNER JOIN Students s ON e.StudentId = s.StudentId
            WHERE t.TuitionId = ? AND s.UserId = ?
            """,
            int(tuition_id),
            int(user_id),
        )
        if not cursor.fetchone():
            raise ValueError("Khoản học phí không thuộc tài khoản sinh viên hiện tại.")

    from models.payment_model import record_tuition_payment

    payment_payload = dict(payload)
    payment_payload["TuitionId"] = int(tuition_id)
    if not payment_payload.get("CashierId"):
        payment_payload["CashierId"] = int(user_id)
    return record_tuition_payment(payment_payload)


def get_student_attendance_by_user_id(
    user_id: int,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Personal attendance across all enrollments of the student user.
    Returns one row per (EnrollmentId, SessionDate) with class & course info.
    """
    with get_db_connection() as connection:
        cursor = connection.cursor()

        query = """
        SELECT
            e.EnrollmentId,
            e.Status AS EnrollmentStatus,
            c.ClassId,
            c.ClassCode,
            c.ClassName,
            co.CourseCode,
            co.CourseName,
            a.SessionDate,
            a.Status AS AttendanceStatus
        FROM Enrollments e
        INNER JOIN Students s ON e.StudentId = s.StudentId
        INNER JOIN Classes c ON e.ClassId = c.ClassId
        INNER JOIN Courses co ON c.CourseId = co.CourseId
        LEFT JOIN Attendances a ON a.EnrollmentId = e.EnrollmentId
        WHERE s.UserId = ?
        """
        params: list[Any] = [int(user_id)]

        if from_date:
            query += " AND (a.SessionDate IS NULL OR a.SessionDate >= ?)"
            params.append(from_date)
        if to_date:
            query += " AND (a.SessionDate IS NULL OR a.SessionDate <= ?)"
            params.append(to_date)

        query += """
        ORDER BY
            CASE WHEN a.SessionDate IS NULL THEN 1 ELSE 0 END,
            a.SessionDate DESC,
            c.ClassCode ASC
        """

        cursor.execute(query, *params)
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_student_assignments_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    """
    Exams/assignments created by teachers for the student's enrolled classes,
    joined with the student's own submission (if any).
    """
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                e.ExamId,
                e.Title,
                e.ExamType,
                e.Description,
                e.DueDate,
                e.CreatedDate,
                e.Status AS ExamStatus,
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                enr.EnrollmentId,
                es.SubmissionId,
                es.SubmittedAt,
                es.FileUrl,
                es.Note,
                es.Grade,
                es.Status AS SubmissionStatus
            FROM Exams e
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            INNER JOIN Enrollments enr ON enr.ClassId = c.ClassId
            INNER JOIN Students s ON enr.StudentId = s.StudentId
            LEFT JOIN ExamSubmissions es
                ON es.ExamId = e.ExamId
               AND es.EnrollmentId = enr.EnrollmentId
            WHERE s.UserId = ?
              AND enr.Status = N'Enrolled'
            ORDER BY e.DueDate ASC, e.ExamId DESC
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def submit_student_exam(
    user_id: int,
    exam_id: int,
    note: Optional[str] = None,
    file_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Upsert ExamSubmissions for the student's enrollment that matches the exam's class.
    """
    note_clean = (note or "").strip() or None
    file_clean = (file_url or "").strip() or None

    with get_db_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                e.ExamId,
                e.ClassId,
                e.DueDate,
                e.Status
            FROM Exams e
            WHERE e.ExamId = ?
            """,
            int(exam_id),
        )
        exam = cursor.fetchone()
        if not exam:
            raise ValueError("Bài kiểm tra không tồn tại.")

        exam_class_id = int(exam[1])
        due_date = exam[2]
        exam_status = str(exam[3] or "")

        if exam_status.lower() not in {"active", "open", ""}:
            raise ValueError("Bài kiểm tra đang không mở để nộp.")

        cursor.execute("SELECT GETDATE()")
        now = cursor.fetchone()[0]
        if due_date and now > due_date:
            raise ValueError("Đã quá hạn nộp bài.")

        cursor.execute(
            """
            SELECT TOP 1 enr.EnrollmentId
            FROM Enrollments enr
            INNER JOIN Students s ON enr.StudentId = s.StudentId
            WHERE s.UserId = ?
              AND enr.ClassId = ?
              AND enr.Status = N'Enrolled'
            """,
            int(user_id),
            exam_class_id,
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("Bạn không thuộc lớp của bài kiểm tra này.")
        enrollment_id = int(row[0])

        cursor.execute(
            """
            MERGE ExamSubmissions AS target
            USING (SELECT ? AS ExamId, ? AS EnrollmentId) AS source
            ON target.ExamId = source.ExamId AND target.EnrollmentId = source.EnrollmentId
            WHEN MATCHED THEN
                UPDATE SET
                    SubmittedAt = GETDATE(),
                    FileUrl = ?,
                    Note = ?,
                    Status = N'Submitted'
            WHEN NOT MATCHED THEN
                INSERT (ExamId, EnrollmentId, SubmittedAt, FileUrl, Note, Status)
                VALUES (?, ?, GETDATE(), ?, ?, N'Submitted');
            """,
            int(exam_id),
            enrollment_id,
            file_clean,
            note_clean,
            int(exam_id),
            enrollment_id,
            file_clean,
            note_clean,
        )
        connection.commit()

        cursor.execute(
            """
            SELECT
                es.SubmissionId,
                es.ExamId,
                es.EnrollmentId,
                es.SubmittedAt,
                es.FileUrl,
                es.Note,
                es.Grade,
                es.Status
            FROM ExamSubmissions es
            WHERE es.ExamId = ? AND es.EnrollmentId = ?
            """,
            int(exam_id),
            enrollment_id,
        )
        submission = cursor.fetchone()
        return row_to_dict(cursor, submission) if submission else {}


def drop_student_enrollment(user_id: int, enrollment_id: int, reason: Optional[str] = None) -> Dict[str, Any]:
    """
    Drop (soft-cancel) an enrollment owned by the student.
    Rules:
      - must belong to the student
      - cannot drop if any amount has been paid
      - will mark Enrollment.Status = Dropped, and Tuition.Status = Cancelled (if exists & unpaid)
    """
    _ = (reason or "").strip() or None

    with get_db_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                e.EnrollmentId,
                e.Status,
                t.TuitionId,
                ISNULL(t.AmountPaid, 0) AS AmountPaid
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            LEFT JOIN Tuitions t ON t.EnrollmentId = e.EnrollmentId
            WHERE e.EnrollmentId = ? AND s.UserId = ?
            """,
            int(enrollment_id),
            int(user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("Ghi danh không tồn tại hoặc không thuộc tài khoản của bạn.")

        current_status = str(row[1] or "")
        tuition_id = row[2]
        amount_paid = float(row[3] or 0)

        if current_status.lower() == "dropped":
            return {"success": True, "message": "Ghi danh đã ở trạng thái Dropped."}

        if amount_paid > 0:
            raise ValueError("Không thể huỷ ghi danh vì đã phát sinh thanh toán học phí.")

        cursor.execute(
            "UPDATE Enrollments SET Status = N'Dropped' WHERE EnrollmentId = ?",
            int(enrollment_id),
        )
        if tuition_id:
            cursor.execute(
                """
                UPDATE Tuitions
                SET Status = N'Cancelled'
                WHERE EnrollmentId = ? AND ISNULL(AmountPaid, 0) = 0
                """,
                int(enrollment_id),
            )
        connection.commit()
        return {"success": True, "message": "Đã huỷ ghi danh (Dropped)."}
