import pyodbc
from flask import Blueprint, jsonify, request

from models.payment_model import create_payment

payment_bp = Blueprint("payments", __name__)


@payment_bp.post("")
def add_payment():
    try:
        payload = request.get_json(silent=True) or {}
        payment = create_payment(payload)
        return jsonify({"success": True, "message": "Payment created.", "data": payment}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Constraint violation (check StudentId exists).",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
