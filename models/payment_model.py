from typing import Any, Dict

from db import get_db_connection
from models.helpers import row_to_dict

PAYMENT_SELECT_BASE = """
SELECT PaymentId, StudentId, Amount, PaymentDate, Method
FROM Payments
"""


def create_payment(payload: Dict[str, Any]) -> Dict[str, Any]:
    student_id = payload.get("StudentId")
    amount = payload.get("Amount")

    if student_id is None:
        raise ValueError("StudentId is required.")
    if amount is None:
        raise ValueError("Amount is required.")

    try:
        amount = float(amount)
    except (TypeError, ValueError) as exc:
        raise ValueError("Amount must be a number.") from exc

    if amount <= 0:
        raise ValueError("Amount must be greater than 0.")

    payment_date = payload.get("PaymentDate") or None
    method = payload.get("Method") or None

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO Payments (StudentId, Amount, PaymentDate, Method)
            OUTPUT INSERTED.PaymentId
            VALUES (?, ?, COALESCE(?, CAST(GETDATE() AS DATE)), ?)
            """,
            int(student_id),
            amount,
            payment_date,
            method,
        )
        payment_id = cursor.fetchone()[0]
        connection.commit()

        cursor.execute(PAYMENT_SELECT_BASE + " WHERE PaymentId = ?", payment_id)
        row = cursor.fetchone()
        return row_to_dict(cursor, row)
