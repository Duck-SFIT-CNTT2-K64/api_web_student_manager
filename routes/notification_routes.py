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
