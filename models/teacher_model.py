from typing import Any, Dict, List, Optional
import bcrypt
import re

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

TEACHER_SELECT_BASE = """
SELECT
    t.TeacherId,
    t.UserId,
    t.TeacherCode,
    t.FirstName,
    t.LastName,
    CONCAT(t.FirstName, N' ', t.LastName) AS FullName,
    t.Specialization,
    t.PhoneNumber,
    t.Email,
    u.Username,
    u.Status AS AccountStatus,
    COUNT(DISTINCT c.ClassId) AS ClassCount,
    COUNT(DISTINCT e.EnrollmentId) AS StudentCount
FROM Teachers t
LEFT JOIN Users u ON t.UserId = u.UserId
LEFT JOIN Classes c ON t.TeacherId = c.TeacherId
LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
"""


def get_all_teachers() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            TEACHER_SELECT_BASE
            + """
            GROUP BY
                t.TeacherId, t.UserId, t.TeacherCode, t.FirstName, t.LastName,
                t.Specialization, t.PhoneNumber, t.Email, u.Username, u.Status
            ORDER BY t.TeacherId
            """
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_teacher_by_id(teacher_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                t.TeacherId, t.UserId, t.TeacherCode, t.FirstName, t.LastName,
                CONCAT(t.FirstName, N' ', t.LastName) AS FullName,
                t.Specialization, t.PhoneNumber, t.Email,
                u.Username, u.Status AS AccountStatus
            FROM Teachers t
            LEFT JOIN Users u ON t.UserId = u.UserId
            WHERE t.TeacherId = ?
            """,
            teacher_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def _get_role_id(cursor, role_name: str) -> int:
    cursor.execute("SELECT RoleId FROM Roles WHERE RoleName = ?", role_name)
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Role '{role_name}' does not exist.")
    return int(row[0])


def _generate_teacher_code(cursor) -> str:
    """Sinh TeacherCode theo format GV{seq:03d}, VD: GV001, GV002..."""
    prefix = "GV"
    cursor.execute(
        "SELECT MAX(TeacherCode) FROM Teachers WHERE TeacherCode LIKE ?",
        (prefix + "%",),
    )
    row = cursor.fetchone()
    last_code = row[0] if row and row[0] else None
    if last_code and last_code[len(prefix):].isdigit():
        next_seq = int(last_code[len(prefix):]) + 1
    else:
        next_seq = 1
    return f"{prefix}{next_seq:03d}"


def create_teacher(payload: Dict[str, Any]) -> Dict[str, Any]:
    first_name = (payload.get("FirstName") or "").strip()
    last_name  = (payload.get("LastName")  or "").strip()
    email = (payload.get("Email") or "").strip()
    phone = (payload.get("PhoneNumber") or "").strip() or None
    specialization = (payload.get("Specialization") or "").strip() or None
    password_raw = (payload.get("Password") or "123456").strip()
    username = (payload.get("Username") or "").strip().lower()

    if not first_name:
        raise ValueError("Tên giảng viên là bắt buộc.")
    if not last_name:
        raise ValueError("Họ giảng viên là bắt buộc.")
    if not email:
        raise ValueError("Email giảng viên là bắt buộc.")

    password_hash = bcrypt.hashpw(password_raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    with get_db_connection() as connection:
        cursor = connection.cursor()

        # Sinh mã giảng viên tự động
        teacher_code = _generate_teacher_code(cursor)
        
        # Nếu chưa có username thì lấy mã GV làm username
        if not username:
            username = teacher_code.lower()

        # Lấy RoleId cho giảng viên (tránh dùng số cứng 3)
        role_id = _get_role_id(cursor, "Teacher")

        # Tạo tài khoản Users
        cursor.execute(
            """
            INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
            OUTPUT INSERTED.UserId
            VALUES (?, ?, ?, ?, ?, ?, N'Active')
            """,
            (role_id, username, password_hash, first_name + " " + last_name, email, phone),
        )
        row = cursor.fetchone()
        user_id = row[0]

        cursor.execute(
            """
            INSERT INTO Teachers (UserId, TeacherCode, FirstName, LastName, Specialization, PhoneNumber, Email)
            OUTPUT INSERTED.TeacherId
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, teacher_code, first_name, last_name, specialization, phone, email),
        )
        row = cursor.fetchone()
        teacher_id = row[0]
        connection.commit()

    result = get_teacher_by_id(teacher_id)
    # Đính kèm thông tin đăng nhập để trả về frontend (chỉ hiển thị 1 lần)
    result["_loginUsername"] = username
    result["_loginPassword"] = password_raw
    return result


def update_teacher(teacher_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    first_name = (payload.get("FirstName") or "").strip() or None
    last_name  = (payload.get("LastName")  or "").strip() or None
    username   = (payload.get("Username")  or "").strip().lower() or None
    specialization = (payload.get("Specialization") or "").strip() or None
    phone = (payload.get("PhoneNumber") or "").strip() or None
    email = (payload.get("Email") or "").strip() or None
    password_raw = (payload.get("Password") or "").strip()

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE Teachers
            SET FirstName      = ISNULL(?, FirstName),
                LastName       = ISNULL(?, LastName),
                Specialization = ISNULL(?, Specialization),
                PhoneNumber    = ISNULL(?, PhoneNumber),
                Email          = ISNULL(?, Email)
            WHERE TeacherId = ?
            """,
            (first_name, last_name, specialization, phone, email, teacher_id),
        )
        
        # Lấy UserId để cập nhật bảng Users
        cursor.execute("SELECT UserId FROM Teachers WHERE TeacherId = ?", (teacher_id,))
        row = cursor.fetchone()
        if row:
            user_id = row[0]
            # Cập nhật tên, username
            cursor.execute(
                """
                UPDATE Users 
                SET FullName = ISNULL(?, FullName),
                    Username = ISNULL(?, Username)
                WHERE UserId = ?
                """,
                (f"{first_name} {last_name}" if first_name and last_name else None, username, user_id),
            )
            
            # Cập nhật mật khẩu nếu có nhập mật khẩu mới
            if password_raw:
                password_hash = bcrypt.hashpw(password_raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                cursor.execute(
                    "UPDATE Users SET PasswordHash = ? WHERE UserId = ?",
                    (password_hash, user_id)
                )

        connection.commit()

    return get_teacher_by_id(teacher_id)


def delete_teacher(teacher_id: int) -> bool:
    existing = get_teacher_by_id(teacher_id)
    if not existing:
        return False
    user_id = existing.get("UserId")
    with get_db_connection() as connection:
        cursor = connection.cursor()
        # Xóa teacher trước, sau đó xóa user
        cursor.execute("DELETE FROM Teachers WHERE TeacherId = ?", (teacher_id,))
        if user_id:
            cursor.execute("DELETE FROM Users WHERE UserId = ?", (user_id,))
        connection.commit()
    return True
