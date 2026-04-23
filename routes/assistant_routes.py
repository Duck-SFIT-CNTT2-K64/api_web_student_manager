import os

from flask import Blueprint, jsonify, request

from utils.auth import login_required, current_session_user

assistant_bp = Blueprint("assistant", __name__)


def _build_agent():
    # Lazy import to avoid crashing app if deps not installed yet.
    from services.student_assistant_agent import build_student_assistant_agent

    return build_student_assistant_agent()


_AGENT = None


@assistant_bp.post("/chat")
@login_required
def chat():
    """
    Chat endpoint for Student Assistant Agentic AI.
    Uses GOOGLE_API_KEY from environment. Never hardcode secrets.
    """
    global _AGENT

    if not os.getenv("GOOGLE_API_KEY"):
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Missing GOOGLE_API_KEY. Please set it in environment (.env / docker env).",
                }
            ),
            500,
        )

    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    history = payload.get("history") or []

    if not message:
        return jsonify({"success": False, "error": "message is required."}), 400

    user = current_session_user()
    user_id = int(user.get("UserId") or 0)
    role_name = str(user.get("RoleName") or "")

    try:
        if _AGENT is None:
            _AGENT = _build_agent()

        reply = _AGENT.reply(
            user_id=user_id,
            role_name=role_name,
            message=message,
            history=history,
        )
        return jsonify({"success": True, "reply": reply}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": "Assistant error.", "details": str(exc)}), 500

