import pyodbc
from flask import Blueprint, jsonify, request
from models.teacher_model import (
    create_teacher,
    delete_teacher,
    get_all_teachers,
    get_class_students_with_scores,
    get_teacher_by_id,
    get_teacher_classes_by_user_id,
    get_teacher_schedule_by_user_id,
    get_teacher_stats_by_user_id,
    is_class_owned_by_teacher,
    is_enrollment_owned_by_teacher,
    save_score_entry,
    update_teacher,
    get_attendance_by_class_and_date,
    save_attendance_records,
    get_notifications_by_creator,
    create_notification,
)
from utils.auth import current_session_user, role_required

teacher_bp = Blueprint("teachers", __name__)


@teacher_bp.get("")
def list_teachers():
    try:
        teachers = get_all_teachers()
        return jsonify({"success": True, "data": teachers}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.get("/<int:teacher_id>")
def get_teacher(teacher_id: int):
    try:
        teacher = get_teacher_by_id(teacher_id)
        if not teacher:
            return jsonify({"success": False, "error": "Teacher not found."}), 404
        return jsonify({"success": True, "data": teacher}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.post("")
def add_teacher():
    try:
        payload = request.get_json(silent=True) or {}
        teacher = create_teacher(payload)
        return jsonify({"success": True, "message": "Teacher created.", "data": teacher}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Dữ liệu bị trùng (mã/email giảng viên).", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.put("/<int:teacher_id>")
def edit_teacher(teacher_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        teacher = update_teacher(teacher_id, payload)
        if not teacher:
            return jsonify({"success": False, "error": "Teacher not found."}), 404
        return jsonify({"success": True, "message": "Teacher updated.", "data": teacher}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Dữ liệu không hợp lệ khi cập nhật.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.delete("/<int:teacher_id>")
def remove_teacher(teacher_id: int):
    try:
        deleted = delete_teacher(teacher_id)
        if not deleted:
            return jsonify({"success": False, "error": "Teacher not found."}), 404
        return jsonify({"success": True, "message": "Teacher deleted."}), 200
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


@teacher_bp.get("/stats/<int:user_id>")
@role_required("Teacher", "Admin")
def get_teacher_stats(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        stats = get_teacher_stats_by_user_id(user_id)
        data = {
            "total_classes": stats.get("ClassCount", 0),
            "total_students": stats.get("StudentCount", 0),
            "total_scores": stats.get("ScoreCount", 0),
        }
        return jsonify({"success": True, "data": data}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.get("/classes/<int:user_id>")
@role_required("Teacher", "Admin")
def get_teacher_classes(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        classes = get_teacher_classes_by_user_id(user_id)
        return jsonify({"success": True, "data": classes}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.get("/schedule/<int:user_id>")
@role_required("Teacher", "Admin")
def get_teacher_schedule(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied

    try:
        schedule = get_teacher_schedule_by_user_id(user_id)
        return jsonify({"success": True, "data": schedule}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.get("/class-students/<int:class_id>")
@role_required("Teacher", "Admin")
def get_class_students(class_id: int):
    try:
        session_user = current_session_user()
        role_name = str(session_user.get("RoleName") or "").lower()
        user_id = session_user.get("UserId")

        if role_name == "teacher":
            if not user_id or not is_class_owned_by_teacher(int(user_id), int(class_id)):
                return jsonify({"success": False, "error": "Forbidden."}), 403

        students = get_class_students_with_scores(class_id)
        return jsonify({"success": True, "data": students}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.post("/save-score")
@role_required("Teacher", "Admin")
def save_score():
    payload = request.get_json(silent=True) or {}
    enrollment_id = payload.get("EnrollmentId")
    score_type_id = payload.get("ScoreTypeId")
    score_value = payload.get("ScoreValue")

    if enrollment_id is None or score_type_id is None or score_value is None:
        return jsonify({"success": False, "error": "EnrollmentId, ScoreTypeId, ScoreValue are required."}), 400

    try:
        session_user = current_session_user()
        role_name = str(session_user.get("RoleName") or "").lower()
        user_id = session_user.get("UserId")

        if role_name == "teacher":
            if not user_id or not is_enrollment_owned_by_teacher(int(user_id), int(enrollment_id)):
                return jsonify({"success": False, "error": "Forbidden."}), 403

        save_score_entry(int(enrollment_id), int(score_type_id), float(score_value))
        return jsonify({"success": True, "message": "Score saved."}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
    
@teacher_bp.get("/attendance/<int:class_id>")
@role_required("Teacher", "Admin")
def get_attendance(class_id: int):
    session_date = request.args.get("date")  # ?date=2025-10-01
    if not session_date:
        return jsonify({"success": False, "error": "date is required."}), 400
    try:
        data = get_attendance_by_class_and_date(class_id, session_date)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@teacher_bp.post("/attendance/save")
@role_required("Teacher", "Admin")
def save_attendance():
    payload = request.get_json(silent=True) or {}
    # payload = { records: [{EnrollmentId, SessionDate, Status}, ...] }
    records = payload.get("records", [])
    if not records:
        return jsonify({"success": False, "error": "Không có dữ liệu điểm danh."}), 400
    try:
        save_attendance_records(records)
        return jsonify({"success": True, "message": "Đã lưu điểm danh."}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    
@teacher_bp.get("/notifications/<int:user_id>")
@role_required("Teacher", "Admin")
def get_notifications(user_id: int):
    denied = _authorize_user_scope(user_id)
    if denied:
        return denied
    try:
        data = get_notifications_by_creator(user_id)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@teacher_bp.post("/notifications/send")
@role_required("Teacher", "Admin")
def send_notification():
    payload = request.get_json(silent=True) or {}
    title    = (payload.get("Title") or "").strip()
    content  = (payload.get("Content") or "").strip()
    class_id = payload.get("ClassId")  # None = gửi tất cả lớp

    if not title or not content:
        return jsonify({"success": False, "error": "Title và Content là bắt buộc."}), 400

    try:
        session_user = current_session_user()
        user_id = session_user.get("UserId")
        create_notification(int(user_id), title, content, class_id)
        return jsonify({"success": True, "message": "Đã gửi thông báo."}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500