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
                -- Lấy chuỗi tóm tắt lịch học (Dùng FOR XML PATH cho SQL Server cũ hơn hoặc STRING_AGG cho mới)
                ISNULL(
                    STUFF((
                        SELECT ', ' + cs.Weekday + ' ' + CONVERT(VARCHAR(5), cs.StartTime, 108)
                        FROM ClassSchedules cs
                        WHERE cs.ClassId = c.ClassId
                        ORDER BY 
                            CASE 
                                WHEN cs.Weekday = 'Monday' THEN 1
                                WHEN cs.Weekday = 'Tuesday' THEN 2
                                WHEN cs.Weekday = 'Wednesday' THEN 3
                                WHEN cs.Weekday = 'Thursday' THEN 4
                                WHEN cs.Weekday = 'Friday' THEN 5
                                WHEN cs.Weekday = 'Saturday' THEN 6
                                ELSE 7
                            END
                        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, ''),
                    N'Chưa có lịch'
                ) AS ScheduleSummary,
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


def _class_code_exists(cursor, class_code: str, exclude_class_id: Optional[int] = None) -> bool:
    if exclude_class_id is None:
        cursor.execute("SELECT TOP 1 ClassId FROM Classes WHERE ClassCode = ?", class_code)
    else:
        cursor.execute(
            "SELECT TOP 1 ClassId FROM Classes WHERE ClassCode = ? AND ClassId <> ?",
            class_code,
            int(exclude_class_id),
        )
    return cursor.fetchone() is not None


def _course_exists(cursor, course_id: int) -> bool:
    cursor.execute("SELECT TOP 1 CourseId FROM Courses WHERE CourseId = ?", int(course_id))
    return cursor.fetchone() is not None


def _teacher_exists(cursor, teacher_id: int) -> bool:
    cursor.execute("SELECT TOP 1 TeacherId FROM Teachers WHERE TeacherId = ?", int(teacher_id))
    return cursor.fetchone() is not None


def create_class(payload: Dict[str, Any]) -> Dict[str, Any]:
    class_code = (payload.get("ClassCode") or "").strip()
    class_name = (payload.get("ClassName") or "").strip()
    course_id = payload.get("CourseId")
    if not class_code:
        raise ValueError("ClassCode is required.")
    if len(class_code) > 20:
        raise ValueError("Mã lớp không được vượt quá 20 ký tự.")
    if not class_name:
        raise ValueError("ClassName is required.")
    if len(class_name) > 100:
        raise ValueError("Tên lớp không được vượt quá 100 ký tự.")
    if course_id is None:
        raise ValueError("CourseId is required.")

    try:
        course_id_int = int(course_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("CourseId không hợp lệ.") from exc

    teacher_id = payload.get("TeacherId") or None
    teacher_id_int = None
    if teacher_id not in (None, ""):
        try:
            teacher_id_int = int(teacher_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("TeacherId không hợp lệ.") from exc

    max_students = payload.get("MaxStudents") or None
    max_students_int = None
    if max_students not in (None, ""):
        try:
            max_students_int = int(max_students)
        except (TypeError, ValueError) as exc:
            raise ValueError("Sĩ số tối đa không hợp lệ.") from exc
        if max_students_int <= 0:
            raise ValueError("Sĩ số tối đa phải lớn hơn 0.")

    with get_db_connection() as connection:
        cursor = connection.cursor()

        if _class_code_exists(cursor, class_code):
            raise ValueError("Mã lớp đã tồn tại.")
        if not _course_exists(cursor, course_id_int):
            raise ValueError("Khóa học không tồn tại.")
        if teacher_id_int is not None and not _teacher_exists(cursor, teacher_id_int):
            raise ValueError("Giảng viên không tồn tại.")

        cursor.execute(
            """
            INSERT INTO Classes (CourseId, TeacherId, ClassCode, ClassName, MaxStudents)
            OUTPUT INSERTED.ClassId
            VALUES (?, ?, ?, ?, ?)
            """,
            course_id_int,
            teacher_id_int,
            class_code,
            class_name,
            max_students_int,
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
    if len(class_code) > 20:
        raise ValueError("Mã lớp không được vượt quá 20 ký tự.")
    if not class_name:
        raise ValueError("ClassName cannot be empty.")
    if len(class_name) > 100:
        raise ValueError("Tên lớp không được vượt quá 100 ký tự.")

    course_id = payload.get("CourseId", existing["CourseId"])
    teacher_id = payload.get("TeacherId", existing["TeacherId"])
    max_students = payload.get("MaxStudents", existing["MaxStudents"])

    try:
        course_id_int = int(course_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("CourseId không hợp lệ.") from exc

    teacher_id_int = None
    if teacher_id not in (None, ""):
        try:
            teacher_id_int = int(teacher_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("TeacherId không hợp lệ.") from exc

    max_students_int = None
    if max_students not in (None, ""):
        try:
            max_students_int = int(max_students)
        except (TypeError, ValueError) as exc:
            raise ValueError("Sĩ số tối đa không hợp lệ.") from exc
        if max_students_int <= 0:
            raise ValueError("Sĩ số tối đa phải lớn hơn 0.")

    with get_db_connection() as connection:
        cursor = connection.cursor()

        if _class_code_exists(cursor, class_code, class_id):
            raise ValueError("Mã lớp đã tồn tại ở bản ghi khác.")
        if not _course_exists(cursor, course_id_int):
            raise ValueError("Khóa học không tồn tại.")
        if teacher_id_int is not None and not _teacher_exists(cursor, teacher_id_int):
            raise ValueError("Giảng viên không tồn tại.")

        cursor.execute(
            """
            UPDATE Classes
            SET CourseId = ?, TeacherId = ?, ClassCode = ?, ClassName = ?, MaxStudents = ?
            WHERE ClassId = ?
            """,
            course_id_int,
            teacher_id_int,
            class_code,
            class_name,
            max_students_int,
            class_id,
        )
        connection.commit()
        return get_class_by_id(class_id)


def delete_class_by_id(class_id: int, user_role: str = "Admin") -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        
        # 1. Kiểm tra sĩ số thực tế đang học trong lớp này (Enrollment Status)
        cursor.execute("""
            SELECT Status, COUNT(*) as Count
            FROM Enrollments
            WHERE ClassId = ?
            GROUP BY Status
        """, class_id)
        
        enroll_results = cursor.fetchall()
        enroll_status_counts = {row[0]: row[1] for row in enroll_results}
        
        active_enrolled = enroll_status_counts.get("Enrolled", 0)
        
        # Ngăn chặn xóa nếu vẫn còn sinh viên đang học (áp dụng cho cả Admin)
        if active_enrolled > 0:
            raise ValueError(f"Không thể xóa lớp: Vẫn còn {active_enrolled} sinh viên đang theo học (Enrolled). Hãy chuyển lớp hoặc đổi trạng thái ghi danh cho sinh viên trước khi xóa.")

        # 3. Thực hiện xóa các dữ liệu liên quan
        # 1. Xóa bài làm của sinh viên (ExamSubmissions) - Phải xóa trước Exams
        cursor.execute("""
            DELETE FROM ExamSubmissions WHERE ExamId IN (SELECT ExamId FROM Exams WHERE ClassId = ?)
        """, class_id)

        # 2. Xóa thông báo liên quan đến lớp (nếu có cột ClassId)
        # Lưu ý: Phải xóa NotificationRecipients trước do FK NO ACTION
        try:
            cursor.execute("""
                DELETE FROM NotificationRecipients WHERE NotificationId IN (
                    SELECT NotificationId FROM Notifications WHERE ClassId = ?
                )
            """, class_id)
            cursor.execute("DELETE FROM Notifications WHERE ClassId = ?", class_id)
        except Exception:
            # Nếu cột ClassId không tồn tại trong Notifications thì bỏ qua
            pass

        # 3. Xóa biên lai (Receipts) - Phải xóa trước Tuitions/Enrollments (do ON DELETE NO ACTION)
        cursor.execute("""
            DELETE FROM Receipts WHERE TuitionId IN (
                SELECT t.TuitionId FROM Tuitions t 
                INNER JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId 
                WHERE e.ClassId = ?
            )
        """, class_id)

        # 4. Xóa điểm danh (Attendances) - Phải xóa trước ClassSchedules/Enrollments
        cursor.execute("""
            DELETE FROM Attendances WHERE EnrollmentId IN (SELECT EnrollmentId FROM Enrollments WHERE ClassId = ?)
        """, class_id)
        cursor.execute("""
            DELETE FROM Attendances WHERE ScheduleId IN (SELECT ScheduleId FROM ClassSchedules WHERE ClassId = ?)
        """, class_id)

        # 5. Xóa bài tập/kiểm tra (Exams)
        cursor.execute("DELETE FROM Exams WHERE ClassId = ?", class_id)

        # 6. Xóa danh sách ghi danh (Enrollments)
        # Lưu ý: Bảng Scores và Tuitions có ON DELETE CASCADE từ Enrollments nên sẽ tự động xóa theo
        cursor.execute("DELETE FROM Enrollments WHERE ClassId = ?", class_id)
        
        # 7. Xóa lịch học (ClassSchedules)
        cursor.execute("DELETE FROM ClassSchedules WHERE ClassId = ?", class_id)
        
        # 8. Cuối cùng mới xóa lớp (Classes)
        cursor.execute("DELETE FROM Classes WHERE ClassId = ?", class_id)
        
        deleted = cursor.rowcount > 0
        connection.commit()
        return deleted
