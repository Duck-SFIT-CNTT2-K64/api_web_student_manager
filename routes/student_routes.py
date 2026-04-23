import pyodbc
from flask import Blueprint, jsonify, request
from models.student_model import (
    create_student_registration,
    create_student_tuition_payment,
    create_student,
    delete_student_by_id,
    get_registration_options_by_user_id,
    get_student_by_id,
    get_student_exam_schedule_by_user_id,
    get_student_finance_by_user_id,
    get_student_learning_by_user_id,
    get_student_profile_by_user_id,
    get_student_registration_status_by_user_id,
    get_student_schedule_by_user_id,
    get_student_scores_by_user_id,
    get_student_statuses,
    search_students,
    update_student,
)
from utils.auth import current_session_user, role_required

student_bp = Blueprint("students", __name__)


@student_bp.get("")
def list_students():
    try:
        search_query = request.args.get("q", "")
        students = search_students(search_query)
        return jsonify({"success": True, "data": students}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/statuses")
def list_student_statuses():
    try:
        statuses = get_student_statuses()
        return jsonify({"success": True, "data": statuses}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/<int:student_id>")
def get_student(student_id: int):
    try:
        student = get_student_by_id(student_id)
        if not student:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "data": student}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.post("")
@role_required("Admin")
def add_student():
    try:
        payload = request.get_json(silent=True) or {}
        student = create_student(payload)
        return jsonify({"success": True, "message": "Student created.", "data": student}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Dữ liệu bị trùng hoặc không hợp lệ (email/mã sinh viên).",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.put("/<int:student_id>")
@role_required("Admin")
def edit_student(student_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        student = update_student(student_id, payload)
        if not student:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "message": "Student updated.", "data": student}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Dữ liệu bị trùng hoặc không hợp lệ khi cập nhật sinh viên.",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.delete("/<int:student_id>")
@role_required("Admin")
def remove_student(student_id: int):
    try:
        deleted = delete_student_by_id(student_id)
        if not deleted:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "message": "Student deleted."}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


def _authorize_user_scope(target_user_id: int):
    session_user = current_session_user()
    session_user_id = session_user.get("UserId")
    role_name = str(session_user.get("RoleName") or "").lower()

    if role_name == "admin":
        return None

    if not session_user_id or int(session_user_id) != int(target_user_id):
        return jsonify({"success": False, "error": "Forbidden."}), 403

    return None


@student_bp.get("/profile/<int:user_id>")
@role_required("Student", "Admin")
def get_student_profile(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        profile = get_student_profile_by_user_id(user_id)
        if not profile:
            return jsonify({"success": False, "error": "Student profile not found."}), 404
        return jsonify({"success": True, "data": profile}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/learning/<int:user_id>")
@role_required("Student", "Admin")
def get_student_learning(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        data = get_student_learning_by_user_id(user_id)
        return jsonify({"success": True, "data": data}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/registration/<int:user_id>")
@role_required("Student", "Admin")
def get_registration_status(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        registrations = get_student_registration_status_by_user_id(user_id)
        return jsonify({"success": True, "data": registrations}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/registration-options/<int:user_id>")
@role_required("Student", "Admin")
def get_registration_options(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        options = get_registration_options_by_user_id(user_id)
        return jsonify({"success": True, "data": options}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.post("/registration/<int:user_id>")
@role_required("Student", "Admin")
def register_class(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    payload = request.get_json(silent=True) or {}
    class_id = payload.get("ClassId")
    if class_id is None:
        return jsonify({"success": False, "error": "ClassId is required."}), 400

    try:
        enrollment = create_student_registration(user_id, int(class_id))
        return jsonify({"success": True, "message": "Class registration created.", "data": enrollment}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Registration is not valid or already exists.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/schedule/<int:user_id>")
@role_required("Student", "Admin")
def get_student_schedule(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        schedule = get_student_schedule_by_user_id(user_id)
        return jsonify({"success": True, "data": schedule}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/exams/<int:user_id>")
@role_required("Student", "Admin")
def get_student_exams(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        exams = get_student_exam_schedule_by_user_id(user_id)
        return jsonify({"success": True, "data": exams}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/scores/<int:user_id>")
@role_required("Student", "Admin")
def get_student_scores(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        scores = get_student_scores_by_user_id(user_id)
        return jsonify({"success": True, "data": scores}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/finance/<int:user_id>")
@role_required("Student", "Admin")
def get_student_finance(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        finances = get_student_finance_by_user_id(user_id)
        return jsonify({"success": True, "data": finances}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.post("/finance/<int:user_id>/payments")
@role_required("Student", "Admin")
def create_student_payment(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    payload = request.get_json(silent=True) or {}

    try:
        receipt = create_student_tuition_payment(user_id, payload)
        return jsonify({"success": True, "message": "Payment recorded.", "data": receipt}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500