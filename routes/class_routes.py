import pyodbc
from flask import Blueprint, jsonify, request

from models.class_model import (
    create_class,
    delete_class_by_id,
    get_all_classes_with_details,
    get_class_by_id,
    get_class_schedules,
    get_rooms,
    update_class,
)

class_bp = Blueprint("classes", __name__)


@class_bp.get("")
def list_classes():
    try:
        classes = get_all_classes_with_details()
        return jsonify({"success": True, "data": classes}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@class_bp.get("/rooms")
def list_rooms():
    try:
        return jsonify({"success": True, "data": get_rooms()}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@class_bp.get("/schedules")
def list_schedules():
    try:
        class_id = request.args.get("classId", type=int)
        return jsonify({"success": True, "data": get_class_schedules(class_id)}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@class_bp.get("/<int:class_id>")
def get_class(class_id: int):
    try:
        class_item = get_class_by_id(class_id)
        if not class_item:
            return jsonify({"success": False, "error": "Class not found."}), 404
        return jsonify({"success": True, "data": class_item}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@class_bp.post("")
def add_class():
    try:
        payload = request.get_json(silent=True) or {}
        class_item = create_class(payload)
        return jsonify({"success": True, "message": "Class created.", "data": class_item}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Constraint violation.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@class_bp.put("/<int:class_id>")
def edit_class(class_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        class_item = update_class(class_id, payload)
        if not class_item:
            return jsonify({"success": False, "error": "Class not found."}), 404
        return jsonify({"success": True, "message": "Class updated.", "data": class_item}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Constraint violation.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@class_bp.delete("/<int:class_id>")
def remove_class(class_id: int):
    try:
        deleted = delete_class_by_id(class_id)
        if not deleted:
            return jsonify({"success": False, "error": "Class not found."}), 404
        return jsonify({"success": True, "message": "Class deleted."}), 200
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Cannot delete class with related enrollments.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
