import pyodbc
from flask import Blueprint, jsonify, request

from models.student_model import (
    create_student,
    delete_student_by_id,
    get_all_students,
    get_student_by_id,
    get_student_statuses,
    update_student,
)

student_bp = Blueprint("students", __name__)


@student_bp.get("")
def list_students():
    try:
        students = get_all_students()
        return jsonify({"success": True, "data": students}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
              return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/statuses")
def list_student_statuses():
    try:
        statuses = get_student_statuses()
        return jsonify({"success": True, "data": statuses}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/<int:student_id>")
def get_student(student_id: int):
    try:
        student = get_student_by_id(student_id)
        if not student:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "data": student}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.post("")
def add_student():
    try:
        payload = request.get_json(silent=True) or {}
        student = create_student(payload)
        return jsonify({"success": True, "message": "Student created.", "data": student}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Constraint violation (check unique email or required foreign keys).",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.put("/<int:student_id>")
def edit_student(student_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        student = update_student(student_id, payload)
        if not student:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "message": "Student updated.", "data": student}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Constraint violation (check unique email or required foreign keys).",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.delete("/<int:student_id>")
def remove_student(student_id: int):
    try:
        deleted = delete_student_by_id(student_id)
        if not deleted:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "message": "Student deleted."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
