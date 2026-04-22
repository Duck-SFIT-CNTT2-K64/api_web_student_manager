from typing import Any, Dict, List, Optional
from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list
from datetime import datetime


def get_exams_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                e.ExamId,
                e.Title,
                e.ExamType,
                e.Description,
                e.DueDate,
                e.CreatedDate,
                e.Status,
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                COUNT(es.SubmissionId) AS SubmissionCount
            FROM Exams e
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            LEFT JOIN ExamSubmissions es ON e.ExamId = es.ExamId
            WHERE e.UserId = ?
            GROUP BY
                e.ExamId, e.Title, e.ExamType, e.Description,
                e.DueDate, e.CreatedDate, e.Status,
                c.ClassId, c.ClassCode, c.ClassName
            ORDER BY e.CreatedDate DESC
        """, int(user_id))
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_exam_by_id(exam_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                e.ExamId,
                e.ClassId,
                e.UserId,
                e.Title,
                e.ExamType,
                e.Description,
                e.DueDate,
                e.CreatedDate,
                e.Status,
                c.ClassCode,
                c.ClassName
            FROM Exams e
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            WHERE e.ExamId = ?
        """, int(exam_id))
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def create_exam(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    class_id    = payload.get("ClassId")
    title       = (payload.get("Title") or "").strip()
    exam_type   = (payload.get("ExamType") or "Trắc nghiệm").strip()
    description = (payload.get("Description") or "").strip() or None
    due_date_raw = payload.get("DueDate")

    if not class_id:
        raise ValueError("ClassId là bắt buộc.")
    if not title:
        raise ValueError("Tiêu đề bài kiểm tra là bắt buộc.")
    if not due_date_raw:
        raise ValueError("Hạn nộp là bắt buộc.")

    try:
        due_date = datetime.fromisoformat(str(due_date_raw))
    except ValueError:
        raise ValueError("Định dạng hạn nộp không hợp lệ: " + str(due_date_raw))

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO Exams (ClassId, UserId, Title, ExamType, Description, DueDate)
            OUTPUT INSERTED.ExamId
            VALUES (?, ?, ?, ?, ?, ?)
        """, int(class_id), int(user_id), title, exam_type, description, due_date)
        exam_id = cursor.fetchone()[0]
        connection.commit()

    return get_exam_by_id(exam_id)


def update_exam(exam_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    title       = (payload.get("Title") or "").strip() or None
    exam_type   = (payload.get("ExamType") or "").strip() or None
    description = (payload.get("Description") or "").strip() or None
    due_date_raw = payload.get("DueDate")
    status      = (payload.get("Status") or "").strip() or None
    due_date = None

    if due_date_raw is not None and str(due_date_raw).strip() != "":
        try:
            due_date = datetime.fromisoformat(str(due_date_raw))
        except ValueError:
            raise ValueError("Định dạng hạn nộp không hợp lệ: " + str(due_date_raw))

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            UPDATE Exams
            SET Title       = ISNULL(?, Title),
                ExamType    = ISNULL(?, ExamType),
                Description = ISNULL(?, Description),
                DueDate     = ISNULL(?, DueDate),
                Status      = ISNULL(?, Status)
            WHERE ExamId = ?
        """, title, exam_type, description, due_date, status, int(exam_id))
        connection.commit()

    return get_exam_by_id(exam_id)


def update_exam_status(exam_id: int, status: str) -> Optional[Dict[str, Any]]:
    normalized_status = (status or "").strip()
    if normalized_status not in ("Active", "Closed"):
        raise ValueError("Status chỉ chấp nhận Active hoặc Closed.")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE Exams
            SET Status = ?
            WHERE ExamId = ?
            """,
            normalized_status,
            int(exam_id),
        )
        if cursor.rowcount <= 0:
            return None
        connection.commit()

    return get_exam_by_id(exam_id)


def delete_exam(exam_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        # Xóa submissions trước
        cursor.execute("DELETE FROM ExamSubmissions WHERE ExamId = ?", int(exam_id))
        cursor.execute("DELETE FROM Exams WHERE ExamId = ?", int(exam_id))
        affected = cursor.rowcount
        connection.commit()
    return affected > 0


def is_exam_owned_by_user(user_id: int, exam_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT TOP 1 1 FROM Exams
            WHERE ExamId = ? AND UserId = ?
        """, int(exam_id), int(user_id))
        return cursor.fetchone() is not None


def get_submissions_by_exam(exam_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                es.SubmissionId,
                es.ExamId,
                es.EnrollmentId,
                es.SubmittedAt,
                es.FileUrl,
                es.Note,
                es.Grade,
                es.Status,
                s.StudentCode,
                s.FullName
            FROM ExamSubmissions es
            INNER JOIN Enrollments e ON es.EnrollmentId = e.EnrollmentId
            INNER JOIN Students s ON e.StudentId = s.StudentId
            WHERE es.ExamId = ?
            ORDER BY s.StudentCode
        """, int(exam_id))
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def update_submission_grade(
    exam_id: int,
    submission_id: int,
    payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    grade = payload.get("Grade")
    note = payload.get("Note")
    status = payload.get("Status")

    normalized_grade = None
    if grade is not None and str(grade).strip() != "":
        try:
            normalized_grade = float(grade)
        except (TypeError, ValueError):
            raise ValueError("Điểm không hợp lệ.")
        if normalized_grade < 0 or normalized_grade > 10:
            raise ValueError("Điểm phải nằm trong khoảng 0-10.")

    normalized_note = None
    if note is not None:
        normalized_note = str(note).strip() or None

    normalized_status = None
    if status is not None:
        normalized_status = str(status).strip() or None

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE ExamSubmissions
            SET
                Grade = CASE WHEN ? IS NULL THEN Grade ELSE ? END,
                Note = CASE WHEN ? IS NULL THEN Note ELSE ? END,
                Status = CASE WHEN ? IS NULL THEN Status ELSE ? END
            WHERE SubmissionId = ? AND ExamId = ?
            """,
            normalized_grade,
            normalized_grade,
            normalized_note,
            normalized_note,
            normalized_status,
            normalized_status,
            int(submission_id),
            int(exam_id),
        )
        if cursor.rowcount <= 0:
            return None
        connection.commit()

        cursor.execute(
            """
            SELECT
                es.SubmissionId,
                es.ExamId,
                es.EnrollmentId,
                es.SubmittedAt,
                es.FileUrl,
                es.Note,
                es.Grade,
                es.Status,
                s.StudentCode,
                s.FullName
            FROM ExamSubmissions es
            INNER JOIN Enrollments e ON es.EnrollmentId = e.EnrollmentId
            INNER JOIN Students s ON e.StudentId = s.StudentId
            WHERE es.SubmissionId = ? AND es.ExamId = ?
            """,
            int(submission_id),
            int(exam_id),
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None