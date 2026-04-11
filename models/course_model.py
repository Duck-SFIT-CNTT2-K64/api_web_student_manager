from typing import Any, Dict, List, Optional

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list


def get_all_courses() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                co.CourseId,
                co.CourseCode,
                co.CourseName,
                co.Description,
                co.Duration,
                co.TuitionFee,
                co.Credits,
                COUNT(DISTINCT c.ClassId) AS ClassCount,
                COUNT(DISTINCT e.EnrollmentId) AS EnrollmentCount
            FROM Courses co
            LEFT JOIN Classes c ON co.CourseId = c.CourseId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            GROUP BY
                co.CourseId, co.CourseCode, co.CourseName, co.Description,
                co.Duration, co.TuitionFee, co.Credits
            ORDER BY co.CourseId
            """
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_course_by_id(course_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT CourseId, CourseCode, CourseName, Description, Duration, TuitionFee, Credits
            FROM Courses
            WHERE CourseId = ?
            """,
            course_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def create_course(payload: Dict[str, Any]) -> Dict[str, Any]:
    course_code = (payload.get("CourseCode") or "").strip()
    course_name = (payload.get("CourseName") or "").strip()
    if not course_code:
        raise ValueError("CourseCode is required.")
    if not course_name:
        raise ValueError("CourseName is required.")

    description = payload.get("Description") or None
    duration = payload.get("Duration") or None
    tuition_fee = payload.get("TuitionFee") or 0
    credits = payload.get("Credits") or None

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO Courses (CourseCode, CourseName, Description, Duration, TuitionFee, Credits)
            OUTPUT INSERTED.CourseId
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            course_code,
            course_name,
            description,
            duration,
            tuition_fee,
            credits,
        )
        course_id = int(cursor.fetchone()[0])
        connection.commit()
        return get_course_by_id(course_id)


def update_course(course_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    existing = get_course_by_id(course_id)
    if not existing:
        return None

    course_code = (payload.get("CourseCode", existing["CourseCode"]) or "").strip()
    course_name = (payload.get("CourseName", existing["CourseName"]) or "").strip()
    if not course_code:
        raise ValueError("CourseCode cannot be empty.")
    if not course_name:
        raise ValueError("CourseName cannot be empty.")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE Courses
            SET CourseCode = ?, CourseName = ?, Description = ?, Duration = ?, TuitionFee = ?, Credits = ?
            WHERE CourseId = ?
            """,
            course_code,
            course_name,
            payload.get("Description", existing["Description"]),
            payload.get("Duration", existing["Duration"]),
            payload.get("TuitionFee", existing["TuitionFee"]),
            payload.get("Credits", existing["Credits"]),
            course_id,
        )
        connection.commit()
    return get_course_by_id(course_id)


def delete_course_by_id(course_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM Courses WHERE CourseId = ?", course_id)
        deleted = cursor.rowcount > 0
        connection.commit()
        return deleted
