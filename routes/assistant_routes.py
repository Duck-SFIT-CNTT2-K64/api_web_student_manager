import os

from flask import Blueprint, jsonify, request

from utils.auth import login_required, current_session_user

assistant_bp = Blueprint("assistant", __name__)


def _build_agent():
    # Lazy import to avoid crashing app if deps not installed yet.
    from services.student_assistant_agent import build_student_assistant_agent

    return build_student_assistant_agent()


_AGENT = None
_AGENT_SIG = None


def _agent_signature() -> str:
    # Any change here should rebuild agent to avoid stale cached model order.
    return "|".join(
        [
            os.getenv("ASSISTANT_MODEL_ORDER", "").strip(),
            os.getenv("ASSISTANT_TEMPERATURE", "").strip(),
        ]
    )


def _get_model_used(agent_obj) -> str | None:
    # Works for both single model and fallback wrapper.
    if getattr(agent_obj, "model_name", None):
        return str(getattr(agent_obj, "model_name"))
    if getattr(agent_obj, "last_model_used", None):
        return str(getattr(agent_obj, "last_model_used"))
    return None


@assistant_bp.post("/chat")
@login_required
def chat():
    """
    Chat endpoint for Student Assistant Agentic AI.
    Uses GOOGLE_API_KEY from environment. Never hardcode secrets.
    """
    global _AGENT
    global _AGENT_SIG

    if not (os.getenv("SHOPAIKEY_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Missing SHOPAIKEY_API_KEY (preferred) or GOOGLE_API_KEY. Please set it in environment (.env / docker env).",
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
        sig = _agent_signature()
        if _AGENT is None or _AGENT_SIG != sig:
            _AGENT = _build_agent()
            _AGENT_SIG = sig

        reply = _AGENT.reply(
            user_id=user_id,
            role_name=role_name,
            message=message,
            history=history,
        )
        return jsonify({"success": True, "reply": reply, "model_used": _get_model_used(_AGENT)}), 200
    except Exception as exc:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Assistant error.",
                    "details": str(exc),
                    "model_used": _get_model_used(_AGENT),
                }
            ),
            500,
        )

