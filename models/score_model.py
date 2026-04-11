from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

SCORE_SELECT_BASE = """
SELECT
    sc.ScoreId,
    sc.EnrollmentId,
    e.StudentId,
    st.StudentCode,
    st.FullName AS StudentName,
    e.ClassId,
    c.ClassCode,
    c.ClassName,
    co.CourseName,
    sc.ScoreTypeId,
    sty.ScoreTypeName,
    sty.Weight,
    sc.ScoreValue
FROM Scores sc
INNER JOIN Enrollments e ON sc.EnrollmentId = e.EnrollmentId
INNER JOIN Students st ON e.StudentId = st.StudentId
INNER JOIN Classes c ON e.ClassId = c.ClassId
INNER JOIN Courses co ON c.CourseId = co.CourseId
INNER JOIN ScoreTypes sty ON sc.ScoreTypeId = sty.ScoreTypeId
"""


def get_all_scores() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(SCORE_SELECT_BASE + " ORDER BY sc.ScoreId DESC")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_score_types() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT ScoreTypeId, ScoreTypeName, Weight FROM ScoreTypes ORDER BY ScoreTypeId")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def _get_default_score_type_id(cursor) -> int:
    cursor.execute("SELECT TOP 1 ScoreTypeId FROM ScoreTypes ORDER BY ScoreTypeId")
    row = cursor.fetchone()
    if not row:
        raise ValueError("No score type exists.")
    return int(row[0])


def create_score(payload: Dict[str, Any]) -> Dict[str, Any]:
    enrollment_id = payload.get("EnrollmentId")
    score = payload.get("ScoreValue", payload.get("Score"))

    if enrollment_id is None:
        raise ValueError("EnrollmentId is required.")
    if score is None:
        raise ValueError("ScoreValue is required.")

    try:
        score = float(score)
    except (TypeError, ValueError) as exc:
        raise ValueError("ScoreValue must be a number.") from exc

    if score < 0 or score > 10:
        raise ValueError("ScoreValue must be between 0 and 10.")

    score_type_id = payload.get("ScoreTypeId")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        if score_type_id is None:
            score_type_id = _get_default_score_type_id(cursor)

        cursor.execute(
            """
            INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue)
            OUTPUT INSERTED.ScoreId
            VALUES (?, ?, ?)
            """,
            int(enrollment_id),
            int(score_type_id),
            score,
        )
        score_id = cursor.fetchone()[0]
        connection.commit()

        cursor.execute(SCORE_SELECT_BASE + " WHERE sc.ScoreId = ?", score_id)
        row = cursor.fetchone()
        return row_to_dict(cursor, row)
