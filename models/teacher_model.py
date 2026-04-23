from typing import Any, Dict, List, Optional
import bcrypt
import re

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

TEACHER_SELECT_BASE = """
SELECT
    t.TeacherId,
    t.UserId,
    t.TeacherCode,
    t.FirstName,
    t.LastName,
    CONCAT(t.FirstName, N' ', t.LastName) AS FullName,
    t.Specialization,
    t.PhoneNumber,
    t.Email,
    u.Username,
    u.Status AS AccountStatus,
    COUNT(DISTINCT c.ClassId) AS ClassCount,
    COUNT(DISTINCT e.EnrollmentId) AS StudentCount
FROM Teachers t
LEFT JOIN Users u ON t.UserId = u.UserId
LEFT JOIN Classes c ON t.TeacherId = c.TeacherId
LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
"""


def get_all_teachers() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            TEACHER_SELECT_BASE
            + """
            GROUP BY
                t.TeacherId, t.UserId, t.TeacherCode, t.FirstName, t.LastName,
                t.Specialization, t.PhoneNumber, t.Email, u.Username, u.Status
            ORDER BY t.TeacherId
            """
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_teacher_by_id(teacher_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                t.TeacherId, t.UserId, t.TeacherCode, t.FirstName, t.LastName,
                CONCAT(t.FirstName, N' ', t.LastName) AS FullName,
                t.Specialization, t.PhoneNumber, t.Email,
                u.Username, u.Status AS AccountStatus
            FROM Teachers t
            LEFT JOIN Users u ON t.UserId = u.UserId
            WHERE t.TeacherId = ?
            """,
            teacher_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def get_teacher_by_user_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                t.TeacherId, t.UserId, t.TeacherCode, t.FirstName, t.LastName,
                CONCAT(t.FirstName, N' ', t.LastName) AS FullName,
                t.Specialization, t.PhoneNumber, t.Email,
                u.Username, u.Status AS AccountStatus
            FROM Teachers t
            LEFT JOIN Users u ON t.UserId = u.UserId
            WHERE t.UserId = ?
            """,
            user_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def _get_role_id(cursor, role_name: str) -> int:
    cursor.execute("SELECT RoleId FROM Roles WHERE RoleName = ?", role_name)
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Role '{role_name}' does not exist.")
    return int(row[0])


def _generate_teacher_code(cursor) -> str:
    cursor.execute("SELECT ISNULL(MAX(TeacherId), 0) + 1 FROM Teachers")
    next_seq = int(cursor.fetchone()[0])
    return f"GV{next_seq:03d}"


def create_teacher(payload: Dict[str, Any]) -> Dict[str, Any]:
    first_name = (payload.get("FirstName") or "").strip()
    last_name  = (payload.get("LastName")  or "").strip()
    email = (payload.get("Email") or "").strip()
    phone = (payload.get("PhoneNumber") or "").strip() or None
    specialization = (payload.get("Specialization") or "").strip() or None
    username = (payload.get("Username") or "").strip().lower()
    password_raw = (payload.get("Password") or "123456").strip()


    if not first_name:
        raise ValueError("First name is required.")
    if not last_name:
        raise ValueError("Last name is required.")
    if not email:
        raise ValueError("Email is required.")

    password_hash = bcrypt.hashpw(password_raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    with get_db_connection() as connection:
        cursor = connection.cursor()

        # Sinh mã giảng viên tự động
        teacher_code = _generate_teacher_code(cursor)
        
        # Nếu chưa có username thì lấy mã GV làm username
        if not username:
            username = teacher_code.lower()

        # Lấy RoleId cho giảng viên (tránh dùng số cứng 3)
        role_id = _get_role_id(cursor, "Teacher")

        # Tạo tài khoản Users
        cursor.execute(
            """
            INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
            OUTPUT INSERTED.UserId
            VALUES (?, ?, ?, ?, ?, ?, N'Active')
            """,
            (role_id, username, password_hash, first_name + " " + last_name, email, phone),
        )
        row = cursor.fetchone()
        user_id = row[0]

        cursor.execute(
            """
            INSERT INTO Teachers (UserId, TeacherCode, FirstName, LastName, Specialization, PhoneNumber, Email)
            OUTPUT INSERTED.TeacherId
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, teacher_code, first_name, last_name, specialization, phone, email),
        )
        row = cursor.fetchone()
        teacher_id = row[0]
        connection.commit()

    result = get_teacher_by_id(teacher_id)
    # Đính kèm thông tin đăng nhập để trả về frontend (chỉ hiển thị 1 lần)
    result["_loginUsername"] = username
    result["_loginPassword"] = password_raw
    return result


def update_teacher(teacher_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    first_name = (payload.get("FirstName") or "").strip() or None
    last_name  = (payload.get("LastName")  or "").strip() or None
    username   = (payload.get("Username")  or "").strip().lower() or None
    specialization = (payload.get("Specialization") or "").strip() or None
    phone = (payload.get("PhoneNumber") or "").strip() or None
    email = (payload.get("Email") or "").strip() or None
    password_raw = (payload.get("Password") or "").strip()

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE Teachers
            SET FirstName      = ISNULL(?, FirstName),
                LastName       = ISNULL(?, LastName),
                Specialization = ISNULL(?, Specialization),
                PhoneNumber    = ISNULL(?, PhoneNumber),
                Email          = ISNULL(?, Email)
            WHERE TeacherId = ?
            """,
            (first_name, last_name, specialization, phone, email, teacher_id),
        )
        
        # Lấy UserId để cập nhật bảng Users
        cursor.execute("SELECT UserId FROM Teachers WHERE TeacherId = ?", (teacher_id,))
        row = cursor.fetchone()
        if row:
            user_id = row[0]
            # Cập nhật tên, username
            cursor.execute(
                """
                UPDATE Users 
                SET FullName = ISNULL(?, FullName),
                    Username = ISNULL(?, Username)
                WHERE UserId = ?
                """,
                (f"{first_name} {last_name}" if first_name and last_name else None, username, user_id),
            )
            
            # Cập nhật mật khẩu nếu có nhập mật khẩu mới
            if password_raw:
                password_hash = bcrypt.hashpw(password_raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                cursor.execute(
                    "UPDATE Users SET PasswordHash = ? WHERE UserId = ?",
                    (password_hash, user_id)
                )

        connection.commit()

    return get_teacher_by_id(teacher_id)


def delete_teacher(teacher_id: int) -> bool:
    existing = get_teacher_by_id(teacher_id)
    if not existing:
        return False
    user_id = existing.get("UserId")
    with get_db_connection() as connection:
        cursor = connection.cursor()
        # 1. Gỡ giảng viên khỏi các lớp đang dạy (nếu có)
        cursor.execute("UPDATE Classes SET TeacherId = NULL WHERE TeacherId = ?", (teacher_id,))
        
        # 2. Xóa teacher
        cursor.execute("DELETE FROM Teachers WHERE TeacherId = ?", (teacher_id,))
        
        # 3. Xóa user nếu có
        if user_id:
            cursor.execute("DELETE FROM Users WHERE UserId = ?", (user_id,))
            
        connection.commit()
    return True


def get_teacher_id_by_user_id(user_id: int) -> Optional[int]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT TOP 1 TeacherId FROM Teachers WHERE UserId = ?", int(user_id))
        row = cursor.fetchone()
        return int(row[0]) if row else None


def get_teacher_classes_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                c.Semester,
                co.CourseCode,
                co.CourseName,
                COUNT(e.EnrollmentId) AS StudentCount
            FROM Classes c
            INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            WHERE t.UserId = ?
            GROUP BY
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                c.Semester,
                co.CourseCode,
                co.CourseName
            ORDER BY c.ClassCode
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_teacher_stats_by_user_id(user_id: int) -> Dict[str, Any]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                COUNT(DISTINCT c.ClassId) AS ClassCount,
                COUNT(DISTINCT e.StudentId) AS StudentCount,
                COUNT(sc.ScoreId) AS ScoreCount
            FROM Teachers t
            LEFT JOIN Classes c ON t.TeacherId = c.TeacherId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            LEFT JOIN Scores sc ON e.EnrollmentId = sc.EnrollmentId
            WHERE t.UserId = ?
            """,
            int(user_id),
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else {"ClassCount": 0, "StudentCount": 0, "ScoreCount": 0}


def get_teacher_schedule_by_user_id(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                co.CourseName,
                cs.Weekday,
                cs.StartTime,
                cs.EndTime,
                r.RoomName
            FROM Classes c
            INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
            LEFT JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN ClassSchedules cs ON c.ClassId = cs.ClassId
            LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
            WHERE t.UserId = ?
            ORDER BY
                CASE
                    WHEN cs.Weekday = N'Monday' THEN 1
                    WHEN cs.Weekday = N'Tuesday' THEN 2
                    WHEN cs.Weekday = N'Wednesday' THEN 3
                    WHEN cs.Weekday = N'Thursday' THEN 4
                    WHEN cs.Weekday = N'Friday' THEN 5
                    WHEN cs.Weekday = N'Saturday' THEN 6
                    ELSE 7
                END,
                cs.StartTime,
                c.ClassCode
            """,
            int(user_id),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_all_score_types() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT ScoreTypeId, ScoreTypeName, Weight FROM ScoreTypes ORDER BY ScoreTypeId")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_class_students_with_scores(class_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        
        # Lấy danh sách SV
        cursor.execute(
            """
            SELECT
                e.EnrollmentId,
                s.StudentCode,
                s.FullName,
                s.DateOfBirth,      
                s.Gender,
                s.PhoneNumber,
                s.Email,
                s.Address
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            WHERE e.ClassId = ?
            ORDER BY s.StudentCode
            """,
            int(class_id),
        )
        students = rows_to_list(cursor, cursor.fetchall())
        
        if not students:
            return []

        # Lấy tất cả điểm của lớp này
        cursor.execute(
            """
            SELECT EnrollmentId, ScoreTypeId, ScoreValue
            FROM Scores
            WHERE EnrollmentId IN (SELECT EnrollmentId FROM Enrollments WHERE ClassId = ?)
            """,
            int(class_id)
        )
        scores = cursor.fetchall()
        
        # Map điểm vào SV
        for sv in students:
            sv["Scores"] = [
                {"ScoreTypeId": row[1], "ScoreValue": float(row[2])}
                for row in scores if row[0] == sv["EnrollmentId"]
            ]
            
        return students


def save_score_entry(enrollment_id: int, score_type_id: int, score_value: Any, changed_by: int) -> bool:
    value = float(score_value)
    if value < 0 or value > 10:
        raise ValueError("Score must be between 0 and 10.")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        
        # 1. Lấy giá trị cũ để audit
        cursor.execute(
            "SELECT ScoreId, ScoreValue FROM Scores WHERE EnrollmentId = ? AND ScoreTypeId = ?",
            (int(enrollment_id), int(score_type_id))
        )
        row = cursor.fetchone()
        old_value = float(row[1]) if row else None
        score_id = int(row[0]) if row else None
        
        if old_value == value:
            return True # Không có gì thay đổi

        # 2. Cập nhật hoặc thêm mới điểm
        if score_id:
            cursor.execute(
                "UPDATE Scores SET ScoreValue = ? WHERE ScoreId = ?",
                (value, score_id)
            )
            action = "UPDATE"
        else:
            cursor.execute(
                "INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue) OUTPUT INSERTED.ScoreId VALUES (?, ?, ?)",
                (int(enrollment_id), int(score_type_id), value)
            )
            score_id = cursor.fetchone()[0]
            action = "INSERT"

        # 3. Ghi log audit
        cursor.execute(
            """
            INSERT INTO ScoreAuditLogs (ScoreId, EnrollmentId, ScoreTypeId, OldValue, NewValue, ChangedBy, Action)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (score_id, int(enrollment_id), int(score_type_id), old_value, value, int(changed_by), action)
        )
        
        connection.commit()
        return True


def get_score_audit_history(enrollment_id: int, score_type_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT 
                sal.AuditId,
                sal.OldValue,
                sal.NewValue,
                sal.ChangedAt,
                sal.Action,
                u.FullName AS ChangedByName
            FROM ScoreAuditLogs sal
            INNER JOIN Users u ON sal.ChangedBy = u.UserId
            WHERE sal.EnrollmentId = ? AND sal.ScoreTypeId = ?
            ORDER BY sal.ChangedAt DESC
            """,
            (int(enrollment_id), int(score_type_id))
        )
        return rows_to_list(cursor, cursor.fetchall())


def is_class_owned_by_teacher(user_id: int, class_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP 1 1
            FROM Classes c
            INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
            WHERE t.UserId = ? AND c.ClassId = ?
            """,
            int(user_id),
            int(class_id),
        )
        return cursor.fetchone() is not None


def is_enrollment_owned_by_teacher(user_id: int, enrollment_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP 1 1
            FROM Enrollments e
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
            WHERE t.UserId = ? AND e.EnrollmentId = ?
            """,
            int(user_id),
            int(enrollment_id),
        )
        return cursor.fetchone() is not None

def enroll_student_to_class(class_id: int, student_code: str, user_id: int) -> Dict[str, Any]:
    # Kiểm tra quyền quản lý lớp
    if not is_class_owned_by_teacher(user_id, class_id):
        return {"success": False, "error": "You do not have permission to manage this class."}

    with get_db_connection() as connection:
        cursor = connection.cursor()
        
        # Tìm sinh viên theo mã
        cursor.execute("SELECT StudentId, FullName FROM Students WHERE StudentCode = ?", student_code.strip())
        student = cursor.fetchone()
        if not student:
            return {"success": False, "error": "Student code not found: " + student_code}
        
        student_id = student[0]
        student_name = student[1]

        # Kiểm tra xem sinh viên đã trong lớp chưa
        cursor.execute("SELECT 1 FROM Enrollments WHERE StudentId = ? AND ClassId = ?", (student_id, class_id))
        if cursor.fetchone():
            return {"success": False, "error": "Student is already in this class."}

        # Thêm sinh viên vào lớp
        try:
            cursor.execute(
                "INSERT INTO Enrollments (StudentId, ClassId) VALUES (?, ?)",
                (student_id, class_id)
            )
            connection.commit()
            return {"success": True, "message": f"Added student {student_name} to class."}
        except Exception as e:
            return {"success": False, "error": str(e)}

def get_student_by_code(student_code: str) -> Dict[str, Any]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT StudentCode, FullName, Email, PhoneNumber, DateOfBirth, Gender, Address
            FROM Students WHERE StudentCode = ?
        """, student_code.strip())
        row = cursor.fetchone()
        if row:
            return {
                "StudentCode": row[0],
                "FullName": row[1],
                "Email": row[2],
                "PhoneNumber": row[3],
                "DateOfBirth": row[4],
                "Gender": row[5],
                "Address": row[6]
            }
        return None

def save_student_and_enroll(class_id: int, user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    # 1. Kiểm tra quyền quản lý lớp
    if not is_class_owned_by_teacher(user_id, class_id):
        return {"success": False, "error": "You do not have permission to manage this class."}

    student_code = payload.get("StudentCode")
    if not student_code:
        return {"success": False, "error": "Student code is required."}

    with get_db_connection() as connection:
        cursor = connection.cursor()
        
        # 2. Tìm hoặc tạo Student
        cursor.execute("SELECT StudentId, UserId FROM Students WHERE StudentCode = ?", student_code.strip())
        student_row = cursor.fetchone()
        
        if student_row:
            student_id = student_row[0]
            # Cập nhật thông tin sinh viên
            cursor.execute("""
                UPDATE Students SET 
                    FullName = ?, Email = ?, PhoneNumber = ?, DateOfBirth = ?, Gender = ?, Address = ?
                WHERE StudentId = ?
            """, (
                payload.get("FullName"), payload.get("Email"), payload.get("PhoneNumber"),
                payload.get("DateOfBirth"), payload.get("Gender"), payload.get("Address"),
                student_id
            ))
        else:
            try:
                # Password mặc định là mã sinh viên, được hash
                password_plain = student_code.strip()
                hashed_pw = bcrypt.hashpw(password_plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                cursor.execute("""
                    INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
                    OUTPUT INSERTED.UserId
                    VALUES (3, ?, ?, ?, ?, ?, 'Active')
                """, (
                    student_code.strip(), 
                    hashed_pw, 
                    payload.get("FullName"), 
                    payload.get("Email"), 
                    payload.get("PhoneNumber")
                ))
                new_user_id = cursor.fetchone()[0]
                
                cursor.execute("""
                    INSERT INTO Students (UserId, StudentCode, FullName, Email, PhoneNumber, DateOfBirth, Gender, Address)
                    OUTPUT INSERTED.StudentId
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    new_user_id, student_code.strip(), payload.get("FullName"), payload.get("Email"),
                    payload.get("PhoneNumber"), payload.get("DateOfBirth"), payload.get("Gender"), payload.get("Address")
                ))
                student_id = cursor.fetchone()[0]
            except Exception as e:
                return {"success": False, "error": "Error creating new student account: " + str(e)}

                cursor.execute("""
                    INSERT INTO Students (UserId, StudentCode, FullName, Email, PhoneNumber, DateOfBirth, Gender, Address)
                    OUTPUT INSERTED.StudentId
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    new_user_id, student_code.strip(), payload.get("FullName"), payload.get("Email"),
                    payload.get("PhoneNumber"), payload.get("DateOfBirth"), payload.get("Gender"), payload.get("Address")
                ))
                student_id = cursor.fetchone()[0]
            except Exception as e:
                return {"success": False, "error": "Lỗi tạo tài khoản sinh viên mới: " + str(e)}

        # 3. Ghi danh vào lớp (nếu chưa có)
        cursor.execute("SELECT 1 FROM Enrollments WHERE StudentId = ? AND ClassId = ?", (student_id, class_id))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO Enrollments (StudentId, ClassId) VALUES (?, ?)", (student_id, class_id))
            
            # Cập nhật trạng thái sinh viên thành "Đang học"
            cursor.execute("UPDATE Students SET StatusId = 1 WHERE StudentId = ?", student_id)
        
        connection.commit()
        return {"success": True, "message": "Student info saved and enrolled successfully!"}

def remove_student_from_class(enrollment_id: int, user_id: int) -> bool:
    # Kiểm tra quyền sở hữu enrollment
    if not is_enrollment_owned_by_teacher(user_id, enrollment_id):
        return False

    with get_db_connection() as connection:
        cursor = connection.cursor()
        
        # Kiểm tra trạng thái phải là Dropped
        cursor.execute("SELECT Status FROM Enrollments WHERE EnrollmentId = ?", enrollment_id)
        row = cursor.fetchone()
        if not row or str(row[0] or "").strip().lower() != "dropped":
            raise ValueError("Chỉ được phép xóa khi trạng thái học tập là 'Dropped' (Đã nghỉ).")

        # Lấy StudentId trước khi xóa
        cursor.execute("SELECT StudentId FROM Enrollments WHERE EnrollmentId = ?", enrollment_id)
        student_row = cursor.fetchone()
        if not student_row:
            return False
        student_id = student_row[0]
        
        # Xóa các dữ liệu liên quan (điểm, điểm danh)
        cursor.execute("DELETE FROM Scores WHERE EnrollmentId = ?", enrollment_id)
        cursor.execute("DELETE FROM Attendances WHERE EnrollmentId = ?", enrollment_id)
        # Xóa enrollment
        cursor.execute("DELETE FROM Enrollments WHERE EnrollmentId = ?", enrollment_id)
        
        # Kiểm tra xem sinh viên còn ghi danh lớp nào khác không
        cursor.execute("""
            SELECT COUNT(*) FROM Enrollments 
            WHERE StudentId = ? AND Status = 'Enrolled'
        """, student_id)
        remaining_enrollments = cursor.fetchone()[0]
        
        # Nếu không còn ghi danh lớp nào, cập nhật trạng thái thành "Đã nghỉ học"
        if remaining_enrollments == 0:
            cursor.execute("UPDATE Students SET StatusId = 4 WHERE StudentId = ?", student_id)
        
        connection.commit()
        return True

def remove_student_from_class_by_code(class_id: int, student_code: str, user_id: int) -> Dict[str, Any]:
    # Kiểm tra quyền quản lý lớp
    if not is_class_owned_by_teacher(user_id, class_id):
        return {"success": False, "error": "You do not have permission to manage this class."}

    with get_db_connection() as connection:
        cursor = connection.cursor()
        
        # Tìm StudentId và EnrollmentId
        cursor.execute("""
            SELECT e.EnrollmentId, s.FullName, s.StudentId 
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            WHERE e.ClassId = ? AND s.StudentCode = ?
        """, (int(class_id), student_code.strip()))
        
        row = cursor.fetchone()
        if not row:
            return {"success": False, "error": "Student code " + student_code + " not found in this class."}
        
        enrollment_id = row[0]
        student_name = row[1]
        student_id = row[2]
        
        # Xóa
        cursor.execute("DELETE FROM Scores WHERE EnrollmentId = ?", enrollment_id)
        cursor.execute("DELETE FROM Attendances WHERE EnrollmentId = ?", enrollment_id)
        cursor.execute("DELETE FROM Enrollments WHERE EnrollmentId = ?", enrollment_id)
        
        # Kiểm tra xem sinh viên còn ghi danh lớp nào khác không
        cursor.execute("""
            SELECT COUNT(*) FROM Enrollments 
            WHERE StudentId = ? AND Status = 'Enrolled'
        """, student_id)
        remaining_enrollments = cursor.fetchone()[0]
        
        # Nếu không còn ghi danh lớp nào, cập nhật trạng thái thành "Đã nghỉ học"
        if remaining_enrollments == 0:
            cursor.execute("UPDATE Students SET StatusId = 4 WHERE StudentId = ?", student_id)
        
        connection.commit()
        return {"success": True, "message": f"Removed student {student_name} from class."}

def get_attendance_by_class_and_date(class_id: int, session_date: str):
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                e.EnrollmentId,
                s.StudentCode,
                s.FullName,
                a.Status AS AttendanceStatus
            FROM Enrollments e
            INNER JOIN Students s ON e.StudentId = s.StudentId
            LEFT JOIN Attendances a 
                ON a.EnrollmentId = e.EnrollmentId 
                AND a.SessionDate = ?
            WHERE e.ClassId = ?
            ORDER BY s.StudentCode
        """, session_date, int(class_id))
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def save_attendance_records(records: list):
    with get_db_connection() as connection:
        cursor = connection.cursor()
        for r in records:
            cursor.execute("""
                MERGE Attendances AS target
                USING (SELECT ? AS EnrollmentId, ? AS SessionDate) AS source
                ON target.EnrollmentId = source.EnrollmentId
                   AND target.SessionDate = source.SessionDate
                WHEN MATCHED THEN
                    UPDATE SET Status = ?
                WHEN NOT MATCHED THEN
                    INSERT (EnrollmentId, SessionDate, Status)
                    VALUES (?, ?, ?);
            """,
                r["EnrollmentId"], r["SessionDate"],
                r["Status"],
                r["EnrollmentId"], r["SessionDate"], r["Status"]
            )
        connection.commit()



# Hàm tạo thông báo và gửi đến sinh viên của 1 lớp hoặc tất cả lớp của teacher
def create_notification(user_id: int, title: str, content: str, class_id=None, recipient_ids=None, attachment_url=None) -> int:
    with get_db_connection() as connection:
        cursor = connection.cursor()

        # 1. Tạo thông báo
        cursor.execute("""
            INSERT INTO Notifications (CreatorId, Title, Content, ClassId, AttachmentUrl)
            OUTPUT INSERTED.NotificationId
            VALUES (?, ?, ?, ?, ?)
        """, int(user_id), title, content, int(class_id) if class_id else None, attachment_url)
        notif_id = cursor.fetchone()[0]

        # 2. Xác định danh sách UserId người nhận
        final_recipients = []
        if recipient_ids:
            # Nếu truyền danh sách ID cụ thể
            final_recipients = recipient_ids
        elif class_id:
            # Gửi cho toàn bộ lớp
            cursor.execute("""
                SELECT DISTINCT s.UserId
                FROM Enrollments e
                INNER JOIN Students s ON e.StudentId = s.StudentId
                WHERE e.ClassId = ?
            """, int(class_id))
            final_recipients = [row[0] for row in cursor.fetchall()]
        else:
            # Gửi tất cả lớp của teacher
            cursor.execute("""
                SELECT DISTINCT s.UserId
                FROM Enrollments e
                INNER JOIN Students s ON e.StudentId = s.StudentId
                INNER JOIN Classes c ON e.ClassId = c.ClassId
                INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
                WHERE t.UserId = ?
            """, int(user_id))
            final_recipients = [row[0] for row in cursor.fetchall()]

        # 3. Insert từng người nhận
        for r_id in final_recipients:
            cursor.execute("""
                INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
                VALUES (?, ?, 0)
            """, notif_id, int(r_id))

        connection.commit()
        return notif_id
    
# Hàm lấy thông báo đã tạo bởi teacher, kèm số lượng người nhận (sinh viên) của mỗi thông báo
def get_notifications_by_creator(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                n.NotificationId,
                n.Title,
                n.Content,
                n.CreatedDate,
                n.ClassId,
                n.AttachmentUrl,
                CONCAT(t.FirstName, N' ', t.LastName) AS CreatorName,
                COUNT(nr.RecipientId) AS RecipientCount,
                SUM(CASE WHEN nr.IsRead = 1 THEN 1 ELSE 0 END) AS ReadCount
            FROM Notifications n
            LEFT JOIN NotificationRecipients nr 
                ON n.NotificationId = nr.NotificationId
            LEFT JOIN Teachers t
                ON n.CreatorId = t.UserId
            WHERE n.CreatorId = ?
            GROUP BY n.NotificationId, n.Title, n.Content, n.CreatedDate, n.ClassId, n.AttachmentUrl,
                     t.FirstName, t.LastName
            ORDER BY n.CreatedDate DESC
        """, int(user_id))
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)

def update_notification(notif_id: int, user_id: int, title: str, content: str, attachment_url=None) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT CreatorId FROM Notifications WHERE NotificationId = ?", int(notif_id))
        row = cursor.fetchone()
        if not row or int(row[0]) != int(user_id):
            return False
            
        cursor.execute("""
            UPDATE Notifications
            SET Title = ?, Content = ?, AttachmentUrl = ISNULL(?, AttachmentUrl)
            WHERE NotificationId = ?
        """, title, content, attachment_url, int(notif_id))
        connection.commit()
        return True

def delete_notification(notif_id: int, user_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT CreatorId FROM Notifications WHERE NotificationId = ?", int(notif_id))
        row = cursor.fetchone()
        if not row or int(row[0]) != int(user_id):
            return False
            
        cursor.execute("DELETE FROM NotificationRecipients WHERE NotificationId = ?", int(notif_id))
        cursor.execute("DELETE FROM Notifications WHERE NotificationId = ?", int(notif_id))
        connection.commit()
        return True


def get_teacher_report_by_user_id(user_id: int) -> dict:
    """Thống kê báo cáo tổng hợp cho giảng viên."""
    with get_db_connection() as connection:
        cursor = connection.cursor()

        # 1. Tỷ lệ đi học trung bình (% Present / tổng điểm danh)
        cursor.execute("""
            SELECT
                COUNT(*) AS TotalSessions,
                SUM(CASE WHEN a.Status = 'Present' THEN 1 ELSE 0 END) AS PresentCount
            FROM Attendances a
            INNER JOIN Enrollments e ON a.EnrollmentId = e.EnrollmentId
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
            WHERE t.UserId = ?
        """, int(user_id))
        row = cursor.fetchone()
        total_sess = row[0] or 0
        present_count = row[1] or 0
        avg_attendance = round((present_count / total_sess * 100), 1) if total_sess > 0 else None

        # 2. Thống kê điểm: tỷ lệ đạt, SV xuất sắc, ĐTB từng lớp
        cursor.execute("""
            WITH StudentScores AS (
                SELECT
                    e.ClassId,
                    e.EnrollmentId,
                    (
                        COALESCE(0.1 * MAX(CASE WHEN sc.ScoreTypeId = 1 THEN sc.ScoreValue END), 0)
                      + COALESCE(0.3 * MAX(CASE WHEN sc.ScoreTypeId = 2 THEN sc.ScoreValue END), 0)
                      + COALESCE(0.6 * MAX(CASE WHEN sc.ScoreTypeId = 3 THEN sc.ScoreValue END), 0)
                    ) AS FinalScore
                FROM Enrollments e
                LEFT JOIN Scores sc ON e.EnrollmentId = sc.EnrollmentId
                GROUP BY e.ClassId, e.EnrollmentId
            )
            SELECT
                c.ClassId,
                c.ClassCode,
                c.ClassName,
                co.CourseName,
                COUNT(ss.EnrollmentId) AS TotalStudents,
                AVG(ss.FinalScore) AS AvgScore,
                SUM(CASE WHEN ss.FinalScore >= 5.0 THEN 1 ELSE 0 END) AS PassCount,
                SUM(CASE WHEN ss.FinalScore >= 9.0 THEN 1 ELSE 0 END) AS ExcellentCount
            FROM Classes c
            INNER JOIN Teachers t ON c.TeacherId = t.TeacherId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN StudentScores ss ON c.ClassId = ss.ClassId
            WHERE t.UserId = ?
            GROUP BY c.ClassId, c.ClassCode, c.ClassName, co.CourseName
            ORDER BY c.ClassCode
        """, int(user_id))
        rows = cursor.fetchall()
        class_stats = rows_to_list(cursor, rows)

        # Tổng hợp
        total_students = sum(r.get('TotalStudents', 0) or 0 for r in class_stats)
        total_pass = sum(r.get('PassCount', 0) or 0 for r in class_stats)
        total_excellent = sum(r.get('ExcellentCount', 0) or 0 for r in class_stats)
        pass_rate = round((total_pass / total_students * 100), 1) if total_students > 0 else None

        # Lớp có ĐTB cao nhất
        top_class = None
        top_avg = -1.0
        for r in class_stats:
            avg = r.get('AvgScore')
            if avg is not None and float(avg) > top_avg:
                top_avg = float(avg)
                top_class = r.get('ClassCode', '') + ' - ' + r.get('ClassName', '')

        return {
            'avg_attendance': avg_attendance,
            'pass_rate': pass_rate,
            'excellent_count': total_excellent,
            'total_students': total_students,
            'top_class': top_class,
            'top_class_avg': round(top_avg, 2) if top_avg >= 0 else None,
            'class_stats': class_stats,
        }

def get_exams_by_teacher(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                e.ExamId,
                e.ClassId,
                c.ClassCode,
                c.ClassName,
                e.Title,
                e.ExamType,
                e.Description,
                e.DueDate,
                e.CreatedDate,
                e.Status
            FROM Exams e
            INNER JOIN Classes c ON e.ClassId = c.ClassId
            WHERE e.UserId = ?
            ORDER BY e.CreatedDate DESC
        """, int(user_id))
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)

def create_exam(user_id: int, payload: Dict[str, Any]) -> int:
    class_id = payload.get("ClassId")
    title = payload.get("Title")
    exam_type = payload.get("ExamType", "Trắc nghiệm")
    description = payload.get("Description")
    due_date = payload.get("DueDate")

    if not class_id or not title or not due_date:
        raise ValueError("Thiếu thông tin bắt buộc (ClassId, Title, DueDate)")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO Exams (ClassId, UserId, Title, ExamType, Description, DueDate)
            OUTPUT INSERTED.ExamId
            VALUES (?, ?, ?, ?, ?, ?)
        """, int(class_id), int(user_id), title, exam_type, description, due_date)
        exam_id = cursor.fetchone()[0]
        connection.commit()
        return exam_id

def delete_exam(exam_id: int, user_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT UserId FROM Exams WHERE ExamId = ?", int(exam_id))
        row = cursor.fetchone()
        if not row or int(row[0]) != int(user_id):
            return False
            
        cursor.execute("DELETE FROM ExamSubmissions WHERE ExamId = ?", int(exam_id))
        cursor.execute("DELETE FROM Exams WHERE ExamId = ?", int(exam_id))
        connection.commit()
        return True