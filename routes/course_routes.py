import pyodbc
from flask import Blueprint, jsonify

from models.course_model import get_all_courses

course_bp = Blueprint("courses", __name__)


@course_bp.get("")
def list_courses():
    try:
        courses = get_all_courses()
        return jsonify({"success": True, "data": courses}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
