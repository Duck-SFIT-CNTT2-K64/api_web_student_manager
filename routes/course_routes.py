import pyodbc
from flask import Blueprint, jsonify, request

from models.course_model import create_course, delete_course_by_id, get_all_courses, get_course_by_id, update_course

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


@course_bp.get("/<int:course_id>")
def get_course(course_id: int):
    try:
        course = get_course_by_id(course_id)
        if not course:
            return jsonify({"success": False, "error": "Course not found."}), 404
        return jsonify({"success": True, "data": course}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@course_bp.post("")
def add_course():
    try:
        payload = request.get_json(silent=True) or {}
        course = create_course(payload)
        return jsonify({"success": True, "message": "Course created.", "data": course}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Constraint violation.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@course_bp.put("/<int:course_id>")
def edit_course(course_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        course = update_course(course_id, payload)
        if not course:
            return jsonify({"success": False, "error": "Course not found."}), 404
        return jsonify({"success": True, "message": "Course updated.", "data": course}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Constraint violation.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@course_bp.delete("/<int:course_id>")
def remove_course(course_id: int):
    try:
        deleted = delete_course_by_id(course_id)
        if not deleted:
            return jsonify({"success": False, "error": "Course not found."}), 404
        return jsonify({"success": True, "message": "Course deleted."}), 200
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Cannot delete course with related classes.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
