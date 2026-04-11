import pyodbc
from flask import Blueprint, jsonify

from models.report_model import get_dashboard_summary

report_bp = Blueprint("reports", __name__)


@report_bp.get("/summary")
def summary():
    try:
        return jsonify({"success": True, "data": get_dashboard_summary()}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
