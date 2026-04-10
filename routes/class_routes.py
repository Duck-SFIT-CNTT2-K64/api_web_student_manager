import pyodbc
from flask import Blueprint, jsonify

from models.class_model import get_all_classes_with_details

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
