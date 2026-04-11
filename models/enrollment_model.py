from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

ENROLLMENT_DETAILS_BASE = """
SELECT
    e.EnrollmentId,
    e.StudentId,
    s.StudentCode,
    s.FullName AS StudentName,
    e.ClassId,
    c.ClassCode,
    c.ClassName,
    co.CourseId,
    co.CourseCode,
    co.CourseName,
    co.TuitionFee,
    c.TeacherId,
    CASE
        WHEN t.TeacherId IS NULL THEN NULL
        ELSE CONCAT(t.FirstName, N' ', t.LastName)
    END AS TeacherName,
    e.EnrollmentDate,
    e.Status,
    tu.TuitionId,
    tu.Status AS TuitionStatus,
    tu.AmountPaid,
    tu.TotalFee
FROM Enrollments e
INNER JOIN Students s ON e.StudentId = s.StudentId
INNER JOIN Classes c ON e.ClassId = c.ClassId
INNER JOIN Courses co ON c.CourseId = co.CourseId
LEFT JOIN Teachers t ON c.TeacherId = t.TeacherId
LEFT JOIN Tuitions tu ON e.EnrollmentId = tu.EnrollmentId
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

    enrollment_date = payload.get("EnrollmentDate") or payload.get("EnrollDate") or None
    status = payload.get("Status") or "Enrolled"

    with get_db_connection() as connection:
        cursor = connection.cursor()
        try:
            cursor.execute(
                """
                SELECT
                    c.MaxStudents,
                    co.TuitionFee,
                    COUNT(e.EnrollmentId) AS CurrentEnrollmentCount
                FROM Classes c
                INNER JOIN Courses co ON c.CourseId = co.CourseId
                LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
                WHERE c.ClassId = ?
                GROUP BY c.MaxStudents, co.TuitionFee
                """,
                int(class_id),
            )
            class_row = cursor.fetchone()
            if not class_row:
                raise ValueError("ClassId does not exist.")

            max_students = class_row[0]
            current_count = class_row[2]
            if max_students is not None and current_count >= max_students:
                raise ValueError("Class is full.")

            cursor.execute(
                """
                INSERT INTO Enrollments (StudentId, ClassId, EnrollmentDate, Status)
                OUTPUT INSERTED.EnrollmentId
                VALUES (?, ?, COALESCE(?, GETDATE()), COALESCE(?, N'Enrolled'))
                """,
                int(student_id),
                int(class_id),
                enrollment_date,
                status,
            )
            enrollment_id = int(cursor.fetchone()[0])

            should_create_tuition = payload.get("CreateTuition", True)
            if should_create_tuition:
                due_days = int(payload.get("DueDays") or 30)
                cursor.execute(
                    """
                    INSERT INTO Tuitions (EnrollmentId, TotalFee, AmountPaid, DueDate, Status)
                    VALUES (?, ?, 0, DATEADD(day, ?, CAST(GETDATE() AS date)), N'Pending')
                    """,
                    enrollment_id,
                    class_row[1],
                    due_days,
                )
            connection.commit()
        except Exception:
            connection.rollback()
            raise

        cursor.execute(
            ENROLLMENT_DETAILS_BASE + " WHERE e.EnrollmentId = ?",
            enrollment_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row)
