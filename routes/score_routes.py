import pyodbc
from flask import Blueprint, jsonify, request

from models.score_model import create_score, get_all_scores, get_score_types
from utils.auth import role_required

score_bp = Blueprint("scores", __name__)


@score_bp.get("")
@role_required("Admin")
def list_scores():
    try:
        scores = get_all_scores()
        return jsonify({"success": True, "data": scores}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@score_bp.get("/types")
@role_required("Admin")
def list_score_types():
    try:
        score_types = get_score_types()
        return jsonify({"success": True, "data": score_types}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@score_bp.post("")
@role_required("Admin")
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


@score_bp.put("/<int:score_id>")
@role_required("Admin")
def edit_score(score_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        from models.score_model import update_score
        score = update_score(score_id, payload)
        if not score:
            return jsonify({"success": False, "error": "Score not found."}), 404
        return jsonify({"success": True, "message": "Score updated.", "data": score}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Data validation failed.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@score_bp.delete("/<int:score_id>")
@role_required("Admin")
def remove_score(score_id: int):
    try:
        from models.score_model import delete_score
        success = delete_score(score_id)
        if not success:
            return jsonify({"success": False, "error": "Score not found."}), 404
        return jsonify({"success": True, "message": "Score deleted."}), 200
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Cannot delete because of dependent records.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500
