from __future__ import annotations

from flask import Blueprint, jsonify, redirect, render_template, request, url_for

from models.auth_model import authenticate_user, get_navigation_path_by_role, get_user_by_id
from utils.auth import clear_login_session, current_session_user, save_login_session

auth_bp = Blueprint("auth", __name__)


def _resolve_next_path(default_path: str) -> str:
    next_path = request.values.get("next") or request.args.get("next")
    if next_path and next_path.startswith("/"):
        return next_path
    return default_path


def _login_payload() -> tuple[str, str]:
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        username = (payload.get("username") or payload.get("Username") or payload.get("email") or "").strip()
        password = str(payload.get("password") or payload.get("Password") or "")
        return username, password

    username = (request.form.get("username") or request.form.get("email") or "").strip()
    password = str(request.form.get("password") or "")
    return username, password


@auth_bp.get("/login")
def login_page():
    if current_session_user().get("UserId"):
        return redirect(url_for("pages.home"))

    error = request.args.get("error")
    next_path = request.args.get("next") or ""
    return render_template("login.html", error=error, next_path=next_path)


@auth_bp.post("/login")
def login_submit():
    username_or_email, password = _login_payload()
    next_path = _resolve_next_path("")

    if not username_or_email or not password:
        if request.is_json:
            return jsonify({"success": False, "error": "Username/email and password are required."}), 400
        return render_template(
            "login.html",
            error="Vui lòng nhập tên đăng nhập/email và mật khẩu.",
            next_path=next_path,
        ), 400

    user = authenticate_user(username_or_email, password)
    if not user:
        if request.is_json:
            return jsonify({"success": False, "error": "Invalid credentials or inactive account."}), 401
        return render_template(
            "login.html",
            error="Sai thông tin đăng nhập hoặc tài khoản bị khóa.",
            next_path=next_path,
        ), 401

    save_login_session(user)
    default_path = get_navigation_path_by_role(user.get("RoleName"))
    target = _resolve_next_path(default_path)

    if request.is_json:
        return jsonify(
            {
                "success": True,
                "message": "Login successful.",
                "data": {
                    "user": user,
                    "redirectPath": target,
                },
            }
        ), 200

    return redirect(target)


@auth_bp.post("/logout")
def logout_submit():
    clear_login_session()

    if request.path.startswith("/api/") or request.is_json:
        return jsonify({"success": True, "message": "Logged out."}), 200

    return redirect(url_for("auth.login_page"))


@auth_bp.post("/api/auth/login")
def api_login():
    return login_submit()


@auth_bp.post("/api/auth/logout")
def api_logout():
    clear_login_session()
    return jsonify({"success": True, "message": "Logged out."}), 200


@auth_bp.get("/api/auth/me")
def api_me():
    user_id = current_session_user().get("UserId")
    if not user_id:
        return jsonify({"success": False, "error": "Unauthorized."}), 401

    user = get_user_by_id(int(user_id))
    if not user:
        clear_login_session()
        return jsonify({"success": False, "error": "Session user not found."}), 401

    return jsonify({"success": True, "data": user}), 200
