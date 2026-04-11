from typing import Any, Dict, List, Optional

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
