from __future__ import annotations

from typing import Any, Dict, List, Optional

import bcrypt

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list
from models.report_model import get_dashboard_summary


def _verify_password(input_password: str, stored_password_hash: str) -> bool:
    if not stored_password_hash:
        return False

    normalized = stored_password_hash.strip()
    is_bcrypt = normalized.startswith("$2a$") or normalized.startswith("$2b$") or normalized.startswith("$2y$")

    if is_bcrypt:
        try:
            return bcrypt.checkpw(input_password.encode("utf-8"), normalized.encode("utf-8"))
        except ValueError:
            return False

    return input_password == normalized


def get_user_for_login(username_or_email: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP 1
                u.UserId,
                u.RoleId,
                r.RoleName,
                u.Username,
                u.PasswordHash,
                u.FullName,
                u.Email,
                u.PhoneNumber,
                u.Status,
                s.StudentId,
                s.StudentCode,
                t.TeacherId,
                t.TeacherCode,
                CASE
                    WHEN t.TeacherId IS NULL THEN NULL
                    ELSE CONCAT(t.FirstName, N' ', t.LastName)
                END AS TeacherFullName
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId = r.RoleId
            LEFT JOIN Students s ON u.UserId = s.UserId
            LEFT JOIN Teachers t ON u.UserId = t.UserId
            WHERE u.Username = ? OR u.Email = ?
            """,
            username_or_email,
            username_or_email,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def authenticate_user(username_or_email: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_for_login(username_or_email)
    if not user:
        return None

    status = str(user.get("Status") or "").lower()
    if status != "active":
        return None

    if not _verify_password(password, str(user.get("PasswordHash") or "")):
        return None

    user.pop("PasswordHash", None)
    return user


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                u.UserId,
                u.RoleId,
                r.RoleName,
                u.Username,
                u.FullName,
                u.Email,
                u.PhoneNumber,
                u.Status,
                s.StudentId,
                s.StudentCode,
                t.TeacherId,
                t.TeacherCode,
                CASE
                    WHEN t.TeacherId IS NULL THEN NULL
                    ELSE CONCAT(t.FirstName, N' ', t.LastName)
                END AS TeacherFullName
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId = r.RoleId
            LEFT JOIN Students s ON u.UserId = s.UserId
            LEFT JOIN Teachers t ON u.UserId = t.UserId
            WHERE u.UserId = ?
            """,
            user_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def get_admin_home_data() -> Dict[str, Any]:
    return get_dashboard_summary()


def get_teacher_home_data(user_id: int) -> Dict[str, Any]:
    with get_db_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                t.TeacherId,
                t.TeacherCode,
                CONCAT(t.FirstName, N' ', t.LastName) AS FullName,
                t.Specialization,
                t.Email,
                t.PhoneNumber,
                u.Username,
                u.Status AS AccountStatus
            FROM Teachers t
            INNER JOIN Users u ON t.UserId = u.UserId
            WHERE t.UserId = ?
            """,
            user_id,
        )
        teacher_row = cursor.fetchone()
        if not teacher_row:
            return {
                "Profile": None,
                "Totals": {"TotalClasses": 0, "TotalStudents": 0},
                "Classes": [],
            }

        teacher_profile = row_to_dict(cursor, teacher_row)

        cursor.execute(
            """
            SELECT
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                COUNT(e.EnrollmentId) AS StudentCount,
                c.MaxStudents
            FROM Classes c
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            WHERE c.TeacherId = ?
            GROUP BY c.ClassId, c.ClassCode, c.ClassName, co.CourseCode, co.CourseName, c.MaxStudents
            ORDER BY c.ClassId
            """,
            teacher_profile["TeacherId"],
        )
        class_rows = cursor.fetchall()
        class_list = rows_to_list(cursor, class_rows)

        total_classes = len(class_list)
        total_students = sum(int(item.get("StudentCount") or 0) for item in class_list)

        return {
            "Profile": teacher_profile,
            "Totals": {"TotalClasses": total_classes, "TotalStudents": total_students},
            "Classes": class_list,
        }


def get_student_home_data(user_id: int) -> Dict[str, Any]:
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
                s.Gender,
                s.DateOfBirth,
                ss.StatusName,
                u.Username,
                u.Status AS AccountStatus
            FROM Students s
            INNER JOIN Users u ON s.UserId = u.UserId
            LEFT JOIN StudentStatuses ss ON s.StatusId = ss.StatusId
            WHERE s.UserId = ?
            """,
            user_id,
        )
        student_row = cursor.fetchone()
        if not student_row:
            return {
                "Profile": None,
                "Totals": {"TotalEnrollments": 0, "OutstandingTuition": 0},
                "Enrollments": [],
            }

        student_profile = row_to_dict(cursor, student_row)

        cursor.execute(
            """
            SELECT
                e.EnrollmentId,
                e.EnrollmentDate,
                e.Status,
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                AVG(CAST(sc.ScoreValue AS FLOAT)) AS AverageScore,
                tu.TotalFee,
                tu.AmountPaid,
                (tu.TotalFee - tu.AmountPaid) AS RemainingAmount,
                tu.Status AS TuitionStatus
            FROM Enrollments e
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Scores sc ON e.EnrollmentId = sc.EnrollmentId
            LEFT JOIN Tuitions tu ON e.EnrollmentId = tu.EnrollmentId
            WHERE e.StudentId = ?
            GROUP BY
                e.EnrollmentId,
                e.EnrollmentDate,
                e.Status,
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                tu.TotalFee,
                tu.AmountPaid,
                tu.Status
            ORDER BY e.EnrollmentId
            """,
            student_profile["StudentId"],
        )
        enrollment_rows = cursor.fetchall()
        enrollment_list = rows_to_list(cursor, enrollment_rows)

        total_enrollments = len(enrollment_list)
        outstanding_tuition = sum(float(item.get("RemainingAmount") or 0) for item in enrollment_list)

        return {
            "Profile": student_profile,
            "Totals": {
                "TotalEnrollments": total_enrollments,
                "OutstandingTuition": outstanding_tuition,
            },
            "Enrollments": enrollment_list,
        }


def get_navigation_path_by_role(role_name: Optional[str]) -> str:
    role = (role_name or "").strip().lower()
    if role == "admin":
        return "/admin/home"
    if role == "teacher":
        return "/teacher/home"
    if role == "student":
        return "/student/home"
    return "/login"
