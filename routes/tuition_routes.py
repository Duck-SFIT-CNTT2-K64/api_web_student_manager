import pyodbc
from flask import Blueprint, jsonify

from models.payment_model import get_all_tuitions, get_tuition_by_id

tuition_bp = Blueprint("tuitions", __name__)


@tuition_bp.get("")
def list_tuitions():
    try:
        tuitions = get_all_tuitions()
        return jsonify({"success": True, "data": tuitions}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@tuition_bp.get("/<int:tuition_id>")
def get_tuition(tuition_id: int):
    try:
        tuition = get_tuition_by_id(tuition_id)
        if not tuition:
            return jsonify({"success": False, "error": "Tuition not found."}), 404
        return jsonify({"success": True, "data": tuition}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
