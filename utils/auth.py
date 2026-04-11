from __future__ import annotations

from functools import wraps
from typing import Any, Callable

from flask import jsonify, redirect, request, session, url_for


def save_login_session(user: dict[str, Any]) -> None:
    session["user_id"] = user.get("UserId")
    session["role_name"] = user.get("RoleName")
    session["username"] = user.get("Username")
    session["full_name"] = user.get("FullName")


def clear_login_session() -> None:
    session.pop("user_id", None)
    session.pop("role_name", None)
    session.pop("username", None)
    session.pop("full_name", None)


def current_session_user() -> dict[str, Any]:
    return {
        "UserId": session.get("user_id"),
        "RoleName": session.get("role_name"),
        "Username": session.get("username"),
        "FullName": session.get("full_name"),
    }


def _is_api_request() -> bool:
    return request.path.startswith("/api/")


def login_required(view: Callable):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            if _is_api_request():
                return jsonify({"success": False, "error": "Unauthorized."}), 401
            return redirect(url_for("auth.login_page", next=request.path))
        return view(*args, **kwargs)

    return wrapped


def role_required(*allowed_roles: str):
    normalized_roles = {role.lower() for role in allowed_roles}

    def decorator(view: Callable):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not session.get("user_id"):
                if _is_api_request():
                    return jsonify({"success": False, "error": "Unauthorized."}), 401
                return redirect(url_for("auth.login_page", next=request.path))

            role_name = str(session.get("role_name") or "").lower()
            if role_name not in normalized_roles:
                if _is_api_request():
                    return jsonify({"success": False, "error": "Forbidden."}), 403
                return redirect(url_for("pages.home"))
            return view(*args, **kwargs)

        return wrapped

    return decorator
