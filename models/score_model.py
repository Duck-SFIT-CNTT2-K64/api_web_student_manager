from typing import Any, Dict

from db import get_db_connection
from models.helpers import row_to_dict

SCORE_SELECT_BASE = """
SELECT ScoreId, EnrollmentId, Score, ExamDate
FROM Scores
"""


def create_score(payload: Dict[str, Any]) -> Dict[str, Any]:
    enrollment_id = payload.get("EnrollmentId")
    score = payload.get("Score")

    if enrollment_id is None:
        raise ValueError("EnrollmentId is required.")
    if score is None:
        raise ValueError("Score is required.")

    try:
        score = float(score)
    except (TypeError, ValueError) as exc:
        raise ValueError("Score must be a number.") from exc

    if score < 0 or score > 10:
        raise ValueError("Score must be between 0 and 10.")

    exam_date = payload.get("ExamDate") or None

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO Scores (EnrollmentId, Score, ExamDate)
            OUTPUT INSERTED.ScoreId
            VALUES (?, ?, COALESCE(?, CAST(GETDATE() AS DATE)))
            """,
            int(enrollment_id),
            score,
            exam_date,
        )
        score_id = cursor.fetchone()[0]
        connection.commit()

        cursor.execute(SCORE_SELECT_BASE + " WHERE ScoreId = ?", score_id)
        row = cursor.fetchone()
        return row_to_dict(cursor, row)
