from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import rows_to_list


def get_all_courses() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT CourseId, CourseName, Description, Duration, Price, CreatedAt
            FROM Courses
            ORDER BY CourseId
            """
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)
