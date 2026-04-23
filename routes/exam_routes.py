import os
import pyodbc
import uuid
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from models.exam_model import (
    create_exam,
    delete_exam,
    get_exam_by_id,
    get_exams_by_user_id,
    get_submissions_by_exam,
    is_exam_owned_by_user,
    update_exam_status,
    update_submission_grade,
    update_exam,
    auto_close_overdue_exams,
)
from utils.auth import current_session_user, role_required

exam_bp = Blueprint("exams", __name__)
_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "exams")
_ALLOWED_EXTENSIONS = {"pdf"}


def _get_session_user():
    user = current_session_user()
    return user.get("UserId"), str(user.get("RoleName") or "").lower()


def _is_allowed_pdf(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in _ALLOWED_EXTENSIONS


@exam_bp.get("/user/<int:user_id>")
@role_required("Teacher", "Admin")
def list_exams_by_user(user_id: int):
    session_user = current_session_user()
    session_user_id = session_user.get("UserId")
    role = str(session_user.get("RoleName") or "").lower()

    if role != "admin" and int(session_user_id) != int(user_id):
        return jsonify({"success": False, "error": "Forbidden."}), 403

    try:
        auto_close_overdue_exams(int(user_id))
        exams = get_exams_by_user_id(int(user_id))
        return jsonify({"success": True, "data": exams}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# @exam_bp.get("/user/<int:user_id>")
# @role_required("Teacher", "Admin")
# def list_exams_by_user(user_id: int):
#     session_user = current_session_user()
#     session_user_id = session_user.get("UserId")
#     role = str(session_user.get("RoleName") or "").lower()

#     # Chỉ admin hoặc chính giảng viên đó mới xem được
#     if role != "admin" and int(session_user_id) != int(user_id):
#         return jsonify({"success": False, "error": "Forbidden."}), 403

#     try:
#         exams = get_exams_by_user_id(int(user_id))
#         return jsonify({"success": True, "data": exams}), 200
#     except Exception as exc:
#         return jsonify({"success": False, "error": str(exc)}), 500


@exam_bp.post("/upload-pdf")
@role_required("Teacher", "Admin")
def upload_exam_pdf():
    try:
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"success": False, "error": "Vui lòng chọn file PDF."}), 400

        if not _is_allowed_pdf(file.filename):
            return jsonify({"success": False, "error": "Chỉ chấp nhận file PDF."}), 400

        os.makedirs(_UPLOAD_FOLDER, exist_ok=True)
        safe_name = secure_filename(file.filename)
        ext = safe_name.rsplit(".", 1)[1].lower()
        new_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(_UPLOAD_FOLDER, new_name)
        file.save(save_path)

        file_url = f"/static/uploads/exams/{new_name}"
        return jsonify({"success": True, "message": "Đã tải PDF.", "data": {"url": file_url}}), 201
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


@exam_bp.put("/<int:exam_id>/status")
@role_required("Teacher", "Admin")
def edit_exam_status(exam_id: int):
    user_id, role = _get_session_user()
    try:
        if role == "teacher" and not is_exam_owned_by_user(int(user_id), exam_id):
            return jsonify({"success": False, "error": "Forbidden."}), 403
        payload = request.get_json(silent=True) or {}
        status = payload.get("Status")
        exam = update_exam_status(exam_id, status)
        if not exam:
            return jsonify({"success": False, "error": "Không tìm thấy bài kiểm tra."}), 404
        return jsonify({"success": True, "message": "Đã cập nhật trạng thái.", "data": exam}), 200
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


@exam_bp.put("/<int:exam_id>/submissions/<int:submission_id>")
@role_required("Teacher", "Admin")
def grade_submission(exam_id: int, submission_id: int):
    user_id, role = _get_session_user()
    try:
        if role == "teacher" and not is_exam_owned_by_user(int(user_id), exam_id):
            return jsonify({"success": False, "error": "Forbidden."}), 403

        payload = request.get_json(silent=True) or {}
        submission = update_submission_grade(exam_id, submission_id, payload)
        if not submission:
            return jsonify({"success": False, "error": "Không tìm thấy bài nộp."}), 404

        return jsonify({"success": True, "message": "Đã cập nhật chấm bài.", "data": submission}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500