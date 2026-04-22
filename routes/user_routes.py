
import bcrypt
import pyodbc
from flask import Blueprint, jsonify, request

from db import get_db_connection
from models.auth_model import get_user_by_id
from models.helpers import row_to_dict, rows_to_list
from utils.auth import current_session_user, login_required, role_required

user_bp = Blueprint("users", __name__)


def _verify_password(plain: str, stored: str) -> bool:
    if not stored:
        return False
    normalized = stored.strip()
    if normalized.startswith("$2a$") or normalized.startswith("$2b$") or normalized.startswith("$2y$"):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), normalized.encode("utf-8"))
        except ValueError:
            return False
    return plain == normalized


@user_bp.get("/me")
@login_required
def get_my_profile():
    try:
        session_user = current_session_user()
        user_id = int(session_user["UserId"])
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({"success": False, "error": "Không tìm thấy người dùng."}), 404

        role_name = str(user.get("RoleName") or "").lower()
        extra = {}
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if role_name == "student":
                cursor.execute(
                    "SELECT DateOfBirth, Gender, Address FROM Students WHERE UserId = ?",
                    user_id,
                )
                row = cursor.fetchone()
                if row:
                    extra = row_to_dict(cursor, row)
            elif role_name == "teacher":
                cursor.execute(
                    "SELECT Specialization FROM Teachers WHERE UserId = ?",
                    user_id,
                )
                row = cursor.fetchone()
                if row:
                    extra = row_to_dict(cursor, row)

        user.update(extra)
        return jsonify({"success": True, "data": user}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@user_bp.put("/me")
@login_required
def update_my_profile():
    try:
        payload = request.get_json(silent=True) or {}
        full_name = (payload.get("FullName") or "").strip()
        email = (payload.get("Email") or "").strip()
        phone = (payload.get("PhoneNumber") or "").strip()
        gender = (payload.get("Gender") or "").strip() or None
        address = (payload.get("Address") or "").strip() or None
        date_of_birth = (payload.get("DateOfBirth") or "").strip() or None
        specialization = (payload.get("Specialization") or "").strip() or None

        if not full_name:
            return jsonify({"success": False, "error": "Họ tên không được để trống."}), 400
        if not email:
            return jsonify({"success": False, "error": "Email không được để trống."}), 400

        session_user = current_session_user()
        user_id = int(session_user["UserId"])
        role_name = str(session_user.get("RoleName") or "").lower()

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT UserId FROM Users WHERE Email = ? AND UserId <> ?",
                (email, user_id),
            )
            if cursor.fetchone():
                return jsonify({"success": False, "error": "Email đã được sử dụng bởi tài khoản khác."}), 400

            cursor.execute(
                """
                UPDATE Users
                SET FullName = ?, Email = ?, PhoneNumber = ?
                WHERE UserId = ?
                """,
                (full_name, email, phone or None, user_id),
            )

            if role_name == "student":
                cursor.execute(
                    """
                    UPDATE Students
                    SET FullName = ?, Email = ?, PhoneNumber = ?, Gender = ?, Address = ?,
                        DateOfBirth = COALESCE(?, DateOfBirth)
                    WHERE UserId = ?
                    """,
                    (full_name, email, phone or None, gender, address, date_of_birth, user_id),
                )
            elif role_name == "teacher":
                cursor.execute(
                    """
                    UPDATE Teachers
                    SET Email = ?, PhoneNumber = ?, Specialization = ?
                    WHERE UserId = ?
                    """,
                    (email, phone or None, specialization, user_id),
                )

            conn.commit()

        from flask import session as flask_session
        flask_session["full_name"] = full_name

        return jsonify({"success": True, "message": "Đã cập nhật thông tin tài khoản."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@user_bp.put("/me/password")
@login_required
def change_my_password():
    try:
        payload = request.get_json(silent=True) or {}
        current_password = str(payload.get("CurrentPassword") or "")
        new_password = str(payload.get("NewPassword") or "").strip()
        confirm_password = str(payload.get("ConfirmPassword") or "").strip()

        if not current_password:
            return jsonify({"success": False, "error": "Vui lòng nhập mật khẩu hiện tại."}), 400
        if not new_password:
            return jsonify({"success": False, "error": "Mật khẩu mới không được để trống."}), 400
        if len(new_password) < 6:
            return jsonify({"success": False, "error": "Mật khẩu phải có ít nhất 6 ký tự."}), 400
        if new_password != confirm_password:
            return jsonify({"success": False, "error": "Mật khẩu xác nhận không khớp."}), 400

        session_user = current_session_user()
        user_id = int(session_user["UserId"])

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT PasswordHash FROM Users WHERE UserId = ?", (user_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({"success": False, "error": "Không tìm thấy tài khoản."}), 404

            stored_hash = str(row[0] or "")
            if not _verify_password(current_password, stored_hash):
                return jsonify({"success": False, "error": "Mật khẩu hiện tại không đúng."}), 400

            new_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cursor.execute("UPDATE Users SET PasswordHash = ? WHERE UserId = ?", (new_hash, user_id))
            conn.commit()

        return jsonify({"success": True, "message": "Đã đổi mật khẩu thành công."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


def _get_all_users():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                u.UserId,
                u.Username,
                u.FullName,
                u.Email,
                u.PhoneNumber,
                u.Status,
                r.RoleName,
                u.RoleId
            FROM Users u
            LEFT JOIN Roles r ON u.RoleId = r.RoleId
            ORDER BY r.RoleId ASC, u.FullName ASC
        """)
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


@user_bp.get("")
@role_required("Admin")
def list_users():
    try:
        users = _get_all_users()
        return jsonify({"success": True, "data": users}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@user_bp.put("/<int:user_id>/status")
@role_required("Admin")
def toggle_user_status(user_id: int):
    try:
        from utils.auth import current_session_user
        current = current_session_user()
        # Không cho phép admin tự khóa chính mình
        if current.get("UserId") and int(current["UserId"]) == user_id:
            return jsonify({"success": False, "error": "Không thể khóa tài khoản đang đăng nhập."}), 400

        payload = request.get_json(silent=True) or {}
        new_status = payload.get("Status")
        if new_status not in ("Active", "Inactive"):
            return jsonify({"success": False, "error": "Trạng thái không hợp lệ. Chỉ chấp nhận 'Active' hoặc 'Inactive'."}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE Users SET Status = ? WHERE UserId = ?",
                (new_status, user_id)
            )
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "Không tìm thấy người dùng."}), 404
            conn.commit()

        return jsonify({"success": True, "message": f"Tài khoản đã chuyển sang trạng thái '{new_status}'."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@user_bp.put("/<int:user_id>/password")
@role_required("Admin")
def change_user_password(user_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        new_password = (payload.get("Password") or "").strip()

        if not new_password:
            return jsonify({"success": False, "error": "Mật khẩu mới không được để trống."}), 400
        if len(new_password) < 6:
            return jsonify({"success": False, "error": "Mật khẩu phải có ít nhất 6 ký tự."}), 400

        hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE Users SET PasswordHash = ? WHERE UserId = ?",
                (hashed, user_id)
            )
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "Không tìm thấy người dùng."}), 404
            conn.commit()

        return jsonify({"success": True, "message": "Đã đổi mật khẩu thành công."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500

@user_bp.post("/generate/student/<int:student_id>")
@role_required("Admin")
def generate_student_account(student_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM Students WHERE StudentId = ?", (student_id,))
            student = cursor.fetchone()
            if not student:
                return jsonify({"success": False, "error": "Không tìm thấy học viên."}), 404
            
            if student.UserId:
                return jsonify({"success": False, "error": "Học viên đã có tài khoản."}), 400
            
            username = student.StudentCode.lower();
            default_password = "123456"
            hashed_password = bcrypt.hashpw(default_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            role_id = 3
            cursor.execute(
                "INSERT INTO Users (Username, PasswordHash, FullName, Email, PhoneNumber, Status, RoleId) VALUES (?, ?, ?, ?, ?, 'Active', ?)",
                (username, hashed_password, student.FullName, student.Email, student.PhoneNumber, role_id)
            )
            new_user_id = cursor.fetchone()[0]
            cursor.execute(
                "UPDATE Students SET UserId = ? WHERE StudentId = ?",
                (new_user_id, student_id)
            )
            conn.commit()
            return jsonify({
                "success": True,
                "message": "Tài khoản đã được tạo thành công.",
                "data": {
                    "username": username,
                    "password": default_password
                }
            }), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500

@user_bp.post("/generate/teacher/<int:teacher_id>")
@role_required("Admin")
def generate_teacher_account(teacher_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM Teachers WHERE TeacherId = ?", (teacher_id,))
            teacher = cursor.fetchone()
            if not teacher:
                return jsonify({"success": False, "error": "Không tìm thấy giảng viên."}), 404
            
            if teacher.UserId:
                return jsonify({"success": False, "error": "Giảng viên đã có tài khoản."}), 400
            
            username = teacher.TeacherCode.lower()
            default_password = "123456"
            hashed_password = bcrypt.hashpw(default_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            role_id = 2 # Teacher
            cursor.execute(
                """
                INSERT INTO Users (Username, PasswordHash, FullName, Email, PhoneNumber, Status, RoleId) 
                OUTPUT INSERTED.UserId
                VALUES (?, ?, ?, ?, ?, 'Active', ?)
                """,
                (username, hashed_password, f"{teacher.FirstName} {teacher.LastName}", teacher.Email, teacher.PhoneNumber, role_id)
            )
            new_user_id = cursor.fetchone()[0]
            
            cursor.execute(
                "UPDATE Teachers SET UserId = ? WHERE TeacherId = ?",
                (new_user_id, teacher_id)
            )
            conn.commit()
            return jsonify({
                "success": True,
                "message": "Tài khoản giảng viên đã được tạo thành công.",
                "data": {
                    "username": username,
                    "password": default_password
                }
            }), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500
# chinh role
@user_bp.put("/<int:user_id>/role")
@role_required("Admin")
def change_user_role(user_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        new_role_id = payload.get("RoleId")
        if not new_role_id:
            return jsonify({"success": False, "error": "RoleId is required."}), 400
        
        # Validate role exists
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT RoleId FROM Roles WHERE RoleId = ?", (new_role_id,))
            if not cursor.fetchone():
                return jsonify({"success": False, "error": "Role not found."}), 400
            
            cursor.execute("SELECT RoleId FROM Users WHERE UserId = ?", (user_id,))
            row = cursor.fetchone()
            if not row :
                return jsonify({"success": False, "error": "User not found."}), 404
            old_role_id = row[0]
            if old_role_id == new_role_id:
                return jsonify({"success": True, "message": "Role already set."}), 200
            
            


            # Không cho phép thay đổi role của chính mình (admin đang đăng nhập)
            from utils.auth import current_session_user
            current_user = current_session_user()
            if current_user.get("UserId") == user_id:
                return jsonify({"success": False, "error": "Không thể thay đổi role của chính mình."}), 400
            
            # neu la Teacher 
            if old_role_id == 2:
                cursor.execute("Select TeacherId from Teachers where UserId = ?", (user_id,))
                teacher_row = cursor.fetchone()
                if teacher_row:
                    teacher_id = teacher_row[0]
                    cursor.execute("SELECT COUNT(*) FROM Classes WHERE TeacherId = ?", (teacher_id,))
                    class_count = cursor.fetchone()[0]
                    if class_count > 0:
                        return jsonify({
                            "success": False,
                            "error": f"Giảng viên đang dạy {class_count} lớp. Vui lòng chuyển lớp cho giảng viên khác trước khi đổi role."
                        }), 400

            # neu la Student
            if old_role_id == 3:
                cursor.execute("Select StudentId from Students where UserId = ?", (user_id,))
                student_row = cursor.fetchone()
                if student_row:
                    student_id = student_row[0]
                    
                    # Kiểm tra lớp đang học
                    cursor.execute("SELECT COUNT(*) FROM Enrollments WHERE StudentId = ? AND Status IN ('Enrolled', 'Pending')", (student_id,))
                    enrollment_count = cursor.fetchone()[0]
                    if enrollment_count > 0:
                        return jsonify({
                            "success": False,
                            "error": f"Học viên đang theo học {enrollment_count} lớp. Vui lòng hoàn thành hoặc hủy ghi danh trước khi đổi role."
                        }), 400
                    
                    # Kiểm tra nợ học phí
                    cursor.execute("""
                        SELECT COUNT(*) 
                        FROM Tuitions t
                        JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId
                        WHERE e.StudentId = ? AND (t.Status IN ('Pending', 'Overdue') OR t.AmountPaid < t.TotalFee)
                    """, (student_id,))
                    unpaid_count = cursor.fetchone()[0]
                    if unpaid_count > 0:
                        return jsonify({
                            "success": False,
                            "error": f"Học viên còn {unpaid_count} khoản học phí chưa hoàn thành. Vui lòng thanh toán trước khi đổi role."
                        }), 400


            cursor.execute("UPDATE Users SET RoleId = ? WHERE UserId = ?", (new_role_id, user_id))
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "User not found."}), 404
            conn.commit()
        
        return jsonify({"success": True, "message": "Role updated successfully."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500