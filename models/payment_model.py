from datetime import datetime
from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

TUITION_SELECT_BASE = """
SELECT
    t.TuitionId,
    t.EnrollmentId,
    e.StudentId,
    s.StudentCode,
    s.FullName AS StudentName,
    e.ClassId,
    c.ClassCode,
    c.ClassName,
    co.CourseName,
    t.TotalFee,
    t.AmountPaid,
    t.TotalFee - t.AmountPaid AS RemainingAmount,
    t.DueDate,
    t.Status,
    (SELECT COUNT(*) FROM Receipts r WHERE r.TuitionId = t.TuitionId) AS ReceiptCount,
    (SELECT MAX(r.PaymentDate) FROM Receipts r WHERE r.TuitionId = t.TuitionId) AS LastPaymentDate
FROM Tuitions t
INNER JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId
INNER JOIN Students s ON e.StudentId = s.StudentId
INNER JOIN Classes c ON e.ClassId = c.ClassId
INNER JOIN Courses co ON c.CourseId = co.CourseId
"""


def get_all_tuitions() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(TUITION_SELECT_BASE + " ORDER BY t.TuitionId DESC")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_tuition_by_id(tuition_id: int) -> Dict[str, Any] | None:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(TUITION_SELECT_BASE + " WHERE t.TuitionId = ?", tuition_id)
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def get_receipts(tuition_id: int | None = None) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        query = """
            SELECT
                r.ReceiptId,
                r.TuitionId,
                r.CashierId,
                u.FullName AS CashierName,
                r.ReceiptCode,
                r.Amount,
                r.PaymentDate,
                r.Note
            FROM Receipts r
            LEFT JOIN Users u ON r.CashierId = u.UserId
        """
        params = []
        if tuition_id is not None:
            query += " WHERE r.TuitionId = ?"
            params.append(tuition_id)
        query += " ORDER BY r.PaymentDate DESC, r.ReceiptId DESC"
        cursor.execute(query, *params)
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def _get_default_cashier_id(cursor) -> int:
    cursor.execute(
        """
        SELECT TOP 1 u.UserId
        FROM Users u
        LEFT JOIN Roles r ON u.RoleId = r.RoleId
        ORDER BY CASE WHEN r.RoleName = N'Admin' THEN 0 ELSE 1 END, u.UserId
        """
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError("No user exists to use as cashier.")
    return int(row[0])


def record_tuition_payment(payload: Dict[str, Any]) -> Dict[str, Any]:
    tuition_id = payload.get("TuitionId") or payload.get("tuitionId")
    amount = payload.get("Amount")

    if tuition_id is None:
        raise ValueError("TuitionId is required.")
    if amount is None:
        raise ValueError("Amount is required.")

    try:
        amount = float(amount)
    except (TypeError, ValueError) as exc:
        raise ValueError("Amount must be a number.") from exc

    if amount <= 0:
        raise ValueError("Amount must be greater than 0.")

    payment_date = payload.get("PaymentDate") or None
    note = payload.get("Note") or payload.get("Method") or None
    cashier_id = payload.get("CashierId")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        try:
            cursor.execute(
                """
                SELECT TotalFee, AmountPaid, DueDate
                FROM Tuitions
                WHERE TuitionId = ?
                """,
                int(tuition_id),
            )
            tuition = cursor.fetchone()
            if not tuition:
                raise ValueError("TuitionId does not exist.")

            total_fee = float(tuition[0])
            amount_paid = float(tuition[1])
            remaining = total_fee - amount_paid
            if amount > remaining:
                raise ValueError(f"Amount exceeds remaining tuition ({remaining:,.0f}).")

            new_paid = min(total_fee, amount_paid + amount)
            due_date = tuition[2]
            if new_paid >= total_fee:
                status = "Paid"
            elif due_date is not None and due_date < datetime.now().date():
                status = "Overdue"
            else:
                status = "Pending"

            cursor.execute(
                """
                UPDATE Tuitions
                SET AmountPaid = ?, Status = ?
                WHERE TuitionId = ?
                """,
                new_paid,
                status,
                int(tuition_id),
            )

            if not cashier_id:
                cashier_id = _get_default_cashier_id(cursor)

            receipt_code = f"RC{datetime.now():%Y%m%d%H%M%S%f}{int(tuition_id):04d}"[:50]
            cursor.execute(
                """
                INSERT INTO Receipts (TuitionId, CashierId, ReceiptCode, Amount, PaymentDate, Note)
                OUTPUT INSERTED.ReceiptId
                VALUES (?, ?, ?, ?, COALESCE(?, GETDATE()), ?)
                """,
                int(tuition_id),
                int(cashier_id),
                receipt_code,
                amount,
                payment_date,
                note,
            )
            receipt_id = int(cursor.fetchone()[0])
            connection.commit()
        except Exception:
            connection.rollback()
            raise

        cursor.execute(
            """
            SELECT
                r.ReceiptId, r.TuitionId, r.CashierId, u.FullName AS CashierName,
                r.ReceiptCode, r.Amount, r.PaymentDate, r.Note
            FROM Receipts r
            LEFT JOIN Users u ON r.CashierId = u.UserId
            WHERE r.ReceiptId = ?
            """,
            receipt_id,
        )
        receipt = row_to_dict(cursor, cursor.fetchone())
        updated_tuition = get_tuition_by_id(int(tuition_id))
        return {"receipt": receipt, "tuition": updated_tuition}


def create_payment(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Backward-compatible alias for the old /api/payments endpoint."""
    return record_tuition_payment(payload)
