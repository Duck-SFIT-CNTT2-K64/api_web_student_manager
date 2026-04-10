from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import rows_to_list


def get_all_classes_with_details() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassId,
                c.ClassName,
                c.CourseId,
                co.CourseName,
                c.TeacherId,
                t.FullName AS TeacherName,
                c.StartDate,
                c.EndDate,
                c.Status
            FROM Classes c
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
            ORDER BY c.ClassId
            """
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)
