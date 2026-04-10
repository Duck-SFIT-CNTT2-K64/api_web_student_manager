from typing import Any, Dict, List, Optional

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

STUDENT_SELECT_BASE = """
SELECT StudentId, FullName, Email, Phone, DateOfBirth, CreatedAt
FROM Students
"""


def get_all_students() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(STUDENT_SELECT_BASE + " ORDER BY StudentId")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_student_by_id(student_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(STUDENT_SELECT_BASE + " WHERE StudentId = ?", student_id)
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def create_student(payload: Dict[str, Any]) -> Dict[str, Any]:
    full_name = (payload.get("FullName") or "").strip()
    if not full_name:
        raise ValueError("FullName is required.")

    email = payload.get("Email") or None
    phone = payload.get("Phone") or None
    date_of_birth = payload.get("DateOfBirth") or None

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO Students (FullName, Email, Phone, DateOfBirth)
            OUTPUT INSERTED.StudentId
            VALUES (?, ?, ?, ?)
            """,
            full_name,
            email,
            phone,
            date_of_birth,
        )
        student_id = cursor.fetchone()[0]
        connection.commit()

        cursor.execute(STUDENT_SELECT_BASE + " WHERE StudentId = ?", student_id)
        row = cursor.fetchone()
        return row_to_dict(cursor, row)


def update_student(student_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()

        cursor.execute(STUDENT_SELECT_BASE + " WHERE StudentId = ?", student_id)
        existing_row = cursor.fetchone()
        if not existing_row:
            return None

        existing_student = row_to_dict(cursor, existing_row)

        full_name = (payload.get("FullName", existing_student["FullName"]) or "").strip()
        if not full_name:
            raise ValueError("FullName cannot be empty.")

        email = payload.get("Email", existing_student["Email"])
        phone = payload.get("Phone", existing_student["Phone"])
        date_of_birth = payload.get("DateOfBirth", existing_student["DateOfBirth"])

        cursor.execute(
            """
            UPDATE Students
            SET FullName = ?, Email = ?, Phone = ?, DateOfBirth = ?
            WHERE StudentId = ?
            """,
            full_name,
            email,
            phone,
            date_of_birth,
            student_id,
        )
        connection.commit()

        cursor.execute(STUDENT_SELECT_BASE + " WHERE StudentId = ?", student_id)
        updated_row = cursor.fetchone()
        return row_to_dict(cursor, updated_row)


def delete_student_by_id(student_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM Students WHERE StudentId = ?", student_id)
        deleted = cursor.rowcount > 0
        connection.commit()
        return deleted
