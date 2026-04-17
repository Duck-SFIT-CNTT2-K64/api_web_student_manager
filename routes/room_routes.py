import pyodbc
from flask import Blueprint, jsonify, request
from models.room_model import get_all_rooms, get_room_by_id, create_room, update_room, delete_room
from utils.auth import role_required

room_bp = Blueprint("rooms", __name__)


@room_bp.get("")
@role_required("Admin", "Teacher")
def list_rooms():
    try:
        rooms = get_all_rooms()
        return jsonify({"success": True, "data": rooms}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@room_bp.get("/<int:room_id>")
@role_required("Admin", "Teacher")
def get_room(room_id: int):
    try:
        room = get_room_by_id(room_id)
        if not room:
            return jsonify({"success": False, "error": "Room not found."}), 404
        return jsonify({"success": True, "data": room}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@room_bp.post("")
@role_required("Admin")
def add_room():
    try:
        payload = request.get_json(silent=True) or {}
        new_room = create_room(payload)
        return jsonify({"success": True, "data": new_room}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@room_bp.put("/<int:room_id>")
@role_required("Admin")
def edit_room(room_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        updated_room = update_room(room_id, payload)
        if not updated_room:
            return jsonify({"success": False, "error": "Room not found."}), 404
        return jsonify({"success": True, "data": updated_room}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500


@room_bp.delete("/<int:room_id>")
@role_required("Admin")
def remove_room(room_id: int):
    try:
        deleted = delete_room(room_id)
        if not deleted:
            return jsonify({"success": False, "error": "Room not found."}), 404
        return jsonify({"success": True, "message": "Room deleted successfully."}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected error.", "details": str(exc)}), 500
