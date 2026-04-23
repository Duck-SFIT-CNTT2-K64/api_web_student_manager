import pyodbc
from flask import Blueprint, jsonify, request

from models.notification_model import (
    create_notification,
    delete_notification,
    get_all_notifications,
    get_notification_by_id,
    get_notifications_for_user,
    get_unread_notifications_for_user,
    mark_notification_as_read,
    update_notification,
    user_can_view_notification,
)
from utils.auth import current_session_user, login_required, role_required

notification_bp = Blueprint("notifications", __name__)


@notification_bp.get("/my/unread")
@login_required
def get_my_unread_notifications():
    user = current_session_user()
    user_id = user.get("UserId")
    if not user_id:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    try:
        notifications = get_unread_notifications_for_user(int(user_id))
        return jsonify({"success": True, "data": notifications}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.get("/my")
@login_required
def get_my_notifications():
    user = current_session_user()
    user_id = user.get("UserId")
    if not user_id:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    try:
        notifications = get_notifications_for_user(int(user_id))
        return jsonify({"success": True, "data": notifications}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.get("")
@role_required("Admin")
def list_notifications():
    try:
        notifications = get_all_notifications()
        return jsonify({"success": True, "data": notifications}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@notification_bp.get("/<int:notification_id>")
@login_required
def get_notification(notification_id: int):
    user = current_session_user()
    user_id = int(user["UserId"])
    role_name = str(user.get("RoleName") or "")

    if not user_can_view_notification(user_id, role_name, notification_id):
        return jsonify({"success": False, "error": "Forbidden."}), 403

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
        payload["CreatorId"] = int(current_session_user()["UserId"])
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
@login_required
def read_notification(notification_id: int):
    user = current_session_user()
    if not user.get("UserId"):
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    try:
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
