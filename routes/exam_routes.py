import pyodbc
from flask import Blueprint, jsonify, request
from models.exam_model import (
    create_exam,
    delete_exam,
    get_exam_by_id,
    get_exams_by_user_id,
    get_submissions_by_exam,
    is_exam_owned_by_user,
    update_exam,
)
from utils.auth import current_session_user, role_required

exam_bp = Blueprint("exams", __name__)


def _get_session_user():
    user = current_session_user()
    return user.get("UserId"), str(user.get("RoleName") or "").lower()


@exam_bp.get("")
@role_required("Teacher", "Admin")
def list_exams():
    user_id, role = _get_session_user()
    try:
        exams = get_exams_by_user_id(int(user_id))
        return jsonify({"success": True, "data": exams}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@exam_bp.get("/user/<int:user_id>")
@role_required("Teacher", "Admin")
def list_exams_by_user(user_id: int):
    session_user = current_session_user()
    session_user_id = session_user.get("UserId")
    role = str(session_user.get("RoleName") or "").lower()

    # Chỉ admin hoặc chính giảng viên đó mới xem được
    if role != "admin" and int(session_user_id) != int(user_id):
        return jsonify({"success": False, "error": "Forbidden."}), 403

    try:
        exams = get_exams_by_user_id(int(user_id))
        return jsonify({"success": True, "data": exams}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@exam_bp.post("")
@role_required("Teacher", "Admin")
def add_exam():
    user_id, _ = _get_session_user()
    try:
        payload = request.get_json(silent=True) or {}
        exam = create_exam(int(user_id), payload)
        return jsonify({"success": True, "message": "Đã tạo bài kiểm tra.", "data": exam}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.Error as exc:
        # Gộp details vào error để frontend đọc được
        return jsonify({"success": False, "error": "Database error: " + str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@exam_bp.put("/<int:exam_id>")
@role_required("Teacher", "Admin")
def edit_exam(exam_id: int):
    user_id, role = _get_session_user()
    try:
        if role == "teacher" and not is_exam_owned_by_user(int(user_id), exam_id):
            return jsonify({"success": False, "error": "Forbidden."}), 403
        payload = request.get_json(silent=True) or {}
        exam = update_exam(exam_id, payload)
        if not exam:
            return jsonify({"success": False, "error": "Không tìm thấy bài kiểm tra."}), 404
        return jsonify({"success": True, "message": "Đã cập nhật.", "data": exam}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@exam_bp.delete("/<int:exam_id>")
@role_required("Teacher", "Admin")
def remove_exam(exam_id: int):
    user_id, role = _get_session_user()
    try:
        if role == "teacher" and not is_exam_owned_by_user(int(user_id), exam_id):
            return jsonify({"success": False, "error": "Forbidden."}), 403
        deleted = delete_exam(exam_id)
        if not deleted:
            return jsonify({"success": False, "error": "Không tìm thấy bài kiểm tra."}), 404
        return jsonify({"success": True, "message": "Đã xóa bài kiểm tra."}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@exam_bp.get("/<int:exam_id>/submissions")
@role_required("Teacher", "Admin")
def get_submissions(exam_id: int):
    user_id, role = _get_session_user()
    try:
        if role == "teacher" and not is_exam_owned_by_user(int(user_id), exam_id):
            return jsonify({"success": False, "error": "Forbidden."}), 403
        submissions = get_submissions_by_exam(exam_id)
        return jsonify({"success": True, "data": submissions}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500