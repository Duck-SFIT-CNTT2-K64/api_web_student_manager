
import bcrypt
import pyodbc
from flask import Blueprint, jsonify, request

from db import get_db_connection
from models.helpers import rows_to_list
from utils.auth import role_required

user_bp = Blueprint("users", __name__)


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

# @user_bp.post("/generate/teacher/<int:teacher_id>")
# @role_required("Admin")
# def generate_teacher_account(teacher_id: int):
    
