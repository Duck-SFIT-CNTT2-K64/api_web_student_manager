from typing import Any, Dict, List, Optional

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list


def get_all_classes_with_details() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                c.MaxStudents,
                c.CourseId,
                co.CourseCode,
                co.CourseName,
                co.TuitionFee,
                c.TeacherId,
                t.TeacherCode,
                CASE
                    WHEN t.TeacherId IS NULL THEN NULL
                    ELSE CONCAT(t.FirstName, N' ', t.LastName)
                END AS TeacherName,
                COUNT(DISTINCT e.EnrollmentId) AS EnrollmentCount,
                CASE
                    WHEN c.MaxStudents IS NULL THEN NULL
                    ELSE c.MaxStudents - COUNT(DISTINCT e.EnrollmentId)
                END AS RemainingSeats,
                COUNT(DISTINCT cs.ScheduleId) AS ScheduleCount
            FROM Classes c
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Teachers t ON c.TeacherId = t.TeacherId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            LEFT JOIN ClassSchedules cs ON c.ClassId = cs.ClassId
            GROUP BY
                c.ClassId, c.ClassCode, c.ClassName, c.MaxStudents,
                c.CourseId, co.CourseCode, co.CourseName, co.TuitionFee,
                c.TeacherId, t.TeacherId, t.TeacherCode, t.FirstName, t.LastName
            ORDER BY c.ClassId
            """
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_class_schedules(class_id: Optional[int] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        query = """
            SELECT
                cs.ScheduleId,
                cs.ClassId,
                c.ClassCode,
                c.ClassName,
                cs.RoomId,
                r.RoomName,
                cs.Weekday,
                CONVERT(VARCHAR(5), cs.StartTime, 108) AS StartTime,
                CONVERT(VARCHAR(5), cs.EndTime, 108) AS EndTime
            FROM ClassSchedules cs
            INNER JOIN Classes c ON cs.ClassId = c.ClassId
            LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
        """
        params = []
        if class_id is not None:
            query += " WHERE cs.ClassId = ?"
            params.append(class_id)
        query += " ORDER BY cs.ClassId, cs.Weekday, cs.StartTime"
        cursor.execute(query, *params)
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_rooms() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT RoomId, RoomName, Capacity FROM Rooms ORDER BY RoomId")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_class_by_id(class_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT ClassId, CourseId, TeacherId, ClassCode, ClassName, MaxStudents
            FROM Classes
            WHERE ClassId = ?
            """,
            class_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def create_class(payload: Dict[str, Any]) -> Dict[str, Any]:
    class_code = (payload.get("ClassCode") or "").strip()
    class_name = (payload.get("ClassName") or "").strip()
    course_id = payload.get("CourseId")
    if not class_code:
        raise ValueError("ClassCode is required.")
    if not class_name:
        raise ValueError("ClassName is required.")
    if course_id is None:
        raise ValueError("CourseId is required.")

    teacher_id = payload.get("TeacherId") or None
    max_students = payload.get("MaxStudents") or None

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO Classes (CourseId, TeacherId, ClassCode, ClassName, MaxStudents)
            OUTPUT INSERTED.ClassId
            VALUES (?, ?, ?, ?, ?)
            """,
            int(course_id),
            int(teacher_id) if teacher_id else None,
            class_code,
            class_name,
            int(max_students) if max_students else None,
        )
        class_id = int(cursor.fetchone()[0])
        connection.commit()
        return get_class_by_id(class_id)


def update_class(class_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    existing = get_class_by_id(class_id)
    if not existing:
        return None

    class_code = (payload.get("ClassCode", existing["ClassCode"]) or "").strip()
    class_name = (payload.get("ClassName", existing["ClassName"]) or "").strip()
    if not class_code:
        raise ValueError("ClassCode cannot be empty.")
    if not class_name:
        raise ValueError("ClassName cannot be empty.")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE Classes
            SET CourseId = ?, TeacherId = ?, ClassCode = ?, ClassName = ?, MaxStudents = ?
            WHERE ClassId = ?
            """,
            payload.get("CourseId", existing["CourseId"]),
            payload.get("TeacherId", existing["TeacherId"]),
            class_code,
            class_name,
            payload.get("MaxStudents", existing["MaxStudents"]),
            class_id,
        )
        connection.commit()
        return get_class_by_id(class_id)


def delete_class_by_id(class_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM Classes WHERE ClassId = ?", class_id)
        deleted = cursor.rowcount > 0
        connection.commit()
        return deleted
