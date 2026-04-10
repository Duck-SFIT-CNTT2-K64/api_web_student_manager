import pyodbc
from flask import Blueprint, jsonify, request

from models.score_model import create_score

score_bp = Blueprint("scores", __name__)


@score_bp.post("")
def add_score():
    try:
        payload = request.get_json(silent=True) or {}
        score = create_score(payload)
        return jsonify({"success": True, "message": "Score created.", "data": score}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Constraint violation (check EnrollmentId exists).",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
