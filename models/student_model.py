from typing import Any, Dict, List, Optional

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

    with get_db_connection() as connection:
        cursor = connection.cursor()
        try:
            role_id = _get_role_id(cursor, "Student")
            status_id = payload.get("StatusId") or _get_default_status_id(cursor)
            username_seed = payload.get("Username") or email.split("@")[0] or full_name
            username = _make_unique_username(cursor, username_seed)

            cursor.execute(
                """
                INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
                OUTPUT INSERTED.UserId
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                role_id,
                username,
                password,
                full_name,
                email,
                phone,
                account_status,
            )
            user_id = int(cursor.fetchone()[0])

            student_code = (payload.get("StudentCode") or f"SV{user_id:06d}")[:20]
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
        return row_to_dict(cursor, row)


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
