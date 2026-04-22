import pyodbc
from flask import Blueprint, jsonify, request

from models.enrollment_model import (
    create_enrollment,
    delete_enrollment,
    get_enrollments_with_details,
    update_enrollment,
)
from utils.auth import role_required

enrollment_bp = Blueprint("enrollments", __name__)


@enrollment_bp.get("")
def list_enrollments():
    try:
        enrollments = get_enrollments_with_details()
        return jsonify({"success": True, "data": enrollments}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@enrollment_bp.post("")
@role_required("Admin")
def add_enrollment():
    try:
        payload = request.get_json(silent=True) or {}
        enrollment = create_enrollment(payload)
        return jsonify({"success": True, "message": "Enrollment created.", "data": enrollment}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Ghi danh không hợp lệ (trùng ghi danh hoặc sai dữ liệu lớp/sinh viên).",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@enrollment_bp.put("/<int:enrollment_id>")
@role_required("Admin")
def edit_enrollment(enrollment_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        enrollment = update_enrollment(enrollment_id, payload)
        if not enrollment:
            return jsonify({"success": False, "error": "Enrollment not found."}), 404
        return jsonify({"success": True, "message": "Enrollment updated.", "data": enrollment}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Dữ liệu cập nhật ghi danh không hợp lệ.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@enrollment_bp.delete("/<int:enrollment_id>")
@role_required("Admin")
def remove_enrollment(enrollment_id: int):
    try:
        deleted = delete_enrollment(enrollment_id)
        if not deleted:
            return jsonify({"success": False, "error": "Enrollment not found."}), 404
        return jsonify({"success": True, "message": "Enrollment deleted."}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Cannot delete enrollment with related records.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
