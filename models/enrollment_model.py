from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

ENROLLMENT_DETAILS_BASE = """
SELECT
    e.EnrollmentId,
    e.StudentId,
    s.FullName AS StudentName,
    e.ClassId,
    c.ClassName,
    co.CourseName,
    t.FullName AS TeacherName,
    e.EnrollDate,
    e.Status
FROM Enrollments e
INNER JOIN Students s ON e.StudentId = s.StudentId
INNER JOIN Classes c ON e.ClassId = c.ClassId
INNER JOIN Courses co ON c.CourseId = co.CourseId
INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
"""


def get_enrollments_with_details() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(ENROLLMENT_DETAILS_BASE + " ORDER BY e.EnrollmentId")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def create_enrollment(payload: Dict[str, Any]) -> Dict[str, Any]:
    student_id = payload.get("StudentId")
    class_id = payload.get("ClassId")

    if student_id is None:
        raise ValueError("StudentId is required.")
    if class_id is None:
        raise ValueError("ClassId is required.")

    enroll_date = payload.get("EnrollDate") or None
    status = payload.get("Status") or None

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO Enrollments (StudentId, ClassId, EnrollDate, Status)
            OUTPUT INSERTED.EnrollmentId
            VALUES (?, ?, COALESCE(?, CAST(GETDATE() AS DATE)), COALESCE(?, N'Đang học'))
            """,
            int(student_id),
            int(class_id),
            enroll_date,
            status,
        )
        enrollment_id = cursor.fetchone()[0]
        connection.commit()

        cursor.execute(
            ENROLLMENT_DETAILS_BASE + " WHERE e.EnrollmentId = ?",
            enrollment_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row)
