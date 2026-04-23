import pyodbc
from flask import Blueprint, jsonify, request

from models.notification_model import create_notification, get_all_notifications, get_notification_by_id
from utils.auth import role_required

notification_bp = Blueprint("notifications", __name__)


@notification_bp.get("")
def list_notifications():
    try:
        notifications = get_all_notifications()
        return jsonify({"success": True, "data": notifications}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.get("/my/unread")
def get_my_unread_notifications():
    from utils.auth import current_session_user
    user = current_session_user()
    user_id = user.get("UserId") if user else None
    if not user_id:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    
    try:
        from models.notification_model import get_unread_notifications_for_user
        notifications = get_unread_notifications_for_user(int(user_id))
        return jsonify({"success": True, "data": notifications}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.get("/my/all")
def get_my_all_notifications():
    from utils.auth import current_session_user
    user = current_session_user()
    user_id = user.get("UserId") if user else None
    if not user_id:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
    
    try:
        from models.notification_model import get_all_notifications_for_user
        notifications = get_all_notifications_for_user(int(user_id))
        return jsonify({"success": True, "data": notifications}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.get("/<int:notification_id>")
def get_notification(notification_id: int):
    try:
        notification = get_notification_by_id(notification_id)
        if not notification:
            return jsonify({"success": False, "error": "Notification not found."}), 404
        return jsonify({"success": True, "data": notification}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.post("")
@role_required("Admin")
def add_notification():
    try:
        payload = request.get_json(silent=True) or {}
        notification = create_notification(payload)
        return jsonify({"success": True, "message": "Notification created.", "data": notification}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Constraint violation.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.put("/<int:notification_id>")
@role_required("Admin")
def edit_notification(notification_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        from models.notification_model import update_notification
        notification = update_notification(notification_id, payload)
        if not notification:
            return jsonify({"success": False, "error": "Notification not found."}), 404
        return jsonify({"success": True, "message": "Notification updated.", "data": notification}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Data validation failed.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.put("/<int:notification_id>/read")
def read_notification(notification_id: int):
    from utils.auth import current_session_user
    user = current_session_user()
    if not user:
        return jsonify({"success": False, "error": "Unauthorized"}), 401
        
    try:
        from models.notification_model import mark_notification_as_read
        success = mark_notification_as_read(notification_id, int(user["UserId"]))
        if not success:
            return jsonify({"success": False, "error": "Notification not found or already read."}), 404
        return jsonify({"success": True, "message": "Notification marked as read."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.delete("/<int:notification_id>")
@role_required("Admin")
def remove_notification(notification_id: int):
    try:
        from models.notification_model import delete_notification
        success = delete_notification(notification_id)
        if not success:
            return jsonify({"success": False, "error": "Notification not found."}), 404
        return jsonify({"success": True, "message": "Notification deleted."}), 200
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Cannot delete because of dependent records.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


import os
import uuid
from werkzeug.utils import secure_filename

_NOTIF_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "notifications")
_ALLOWED_NOTIF_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "zip", "rar", "jpg", "jpeg", "png"}

def _is_allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in _ALLOWED_NOTIF_EXTENSIONS

@notification_bp.post("/upload")
def upload_notification_file():
    try:
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"success": False, "error": "Please select a file."}), 400

        if not _is_allowed_file(file.filename):
            return jsonify({"success": False, "error": "Unsupported file format."}), 400

        os.makedirs(_NOTIF_UPLOAD_FOLDER, exist_ok=True)
        safe_name = secure_filename(file.filename)
        ext = safe_name.rsplit(".", 1)[1].lower()
        new_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(_NOTIF_UPLOAD_FOLDER, new_name)
        file.save(save_path)

        file_url = f"/static/uploads/notifications/{new_name}"
        return jsonify({"success": True, "data": {"url": file_url, "name": safe_name}}), 201
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@notification_bp.get("/<int:notification_id>/read-details")
def get_read_details(notification_id: int):
    try:
        from models.notification_model import get_notification_read_details
        details = get_notification_read_details(notification_id)
        return jsonify({"success": True, "data": details}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
