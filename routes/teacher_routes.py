import pyodbc
from flask import Blueprint, jsonify

from models.teacher_model import get_all_teachers, get_teacher_by_id

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
