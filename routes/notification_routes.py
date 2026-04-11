import pyodbc
from flask import Blueprint, jsonify, request

from models.notification_model import create_notification, get_all_notifications, get_notification_by_id

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
