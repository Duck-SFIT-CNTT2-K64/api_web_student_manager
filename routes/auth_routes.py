from __future__ import annotations

from flask import Blueprint, jsonify, redirect, render_template, request, url_for

from models.auth_model import authenticate_user, get_navigation_path_by_role, get_user_by_id
from models.student_model import create_student
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


def _register_payload() -> dict[str, str]:
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        return {
            "full_name": (payload.get("full_name") or payload.get("FullName") or payload.get("name") or "").strip(),
            "email": (payload.get("email") or payload.get("Email") or "").strip(),
            "phone": (payload.get("phone") or payload.get("PhoneNumber") or "").strip(),
            "username": (payload.get("username") or payload.get("Username") or "").strip(),
            "password": str(payload.get("password") or payload.get("Password") or ""),
            "confirm_password": str(
                payload.get("confirm_password")
                or payload.get("confirmPassword")
                or payload.get("ConfirmPassword")
                or ""
            ),
        }

    return {
        "full_name": (request.form.get("full_name") or "").strip(),
        "email": (request.form.get("email") or "").strip(),
        "phone": (request.form.get("phone") or "").strip(),
        "username": (request.form.get("username") or "").strip(),
        "password": str(request.form.get("password") or ""),
        "confirm_password": str(request.form.get("confirm_password") or ""),
    }


@auth_bp.get("/login")
def login_page():
    session_user = current_session_user()
    if session_user.get("UserId"):
        role_name = str(session_user.get("RoleName") or "").lower()
        if role_name in {"admin", "teacher"}:
            return redirect(url_for("pages.home"))
        return redirect(url_for("pages.home_redirect"))

    error = request.args.get("error")
    success = request.args.get("success")
    next_path = request.args.get("next") or ""
    return render_template("login.html", error=error, success=success, next_path=next_path)


@auth_bp.get("/register")
def register_page():
    session_user = current_session_user()
    if session_user.get("UserId"):
        role_name = str(session_user.get("RoleName") or "").lower()
        if role_name in {"admin", "teacher"}:
            return redirect(url_for("pages.home"))
        return redirect(url_for("pages.home_redirect"))

    error = request.args.get("error")
    return render_template("register.html", error=error, form_data={})


@auth_bp.post("/register")
def register_submit():
    payload = _register_payload()
    full_name = payload["full_name"]
    email = payload["email"]
    password = payload["password"]
    confirm_password = payload["confirm_password"]

    if not full_name or not email or not password or not confirm_password:
        message = "Vui lòng điền đầy đủ họ tên, email, mật khẩu và xác nhận mật khẩu."
        if request.is_json:
            return jsonify({"success": False, "error": message}), 400
        return render_template("register.html", error=message, form_data=payload), 400

    if password != confirm_password:
        message = "Mật khẩu xác nhận không khớp."
        if request.is_json:
            return jsonify({"success": False, "error": message}), 400
        return render_template("register.html", error=message, form_data=payload), 400

    try:
        created_student = create_student(
            {
                "FullName": full_name,
                "Email": email,
                "PhoneNumber": payload["phone"] or None,
                "Username": payload["username"] or None,
                "Password": password,
                "AccountStatus": "Active",
            }
        )
    except ValueError as exc:
        if request.is_json:
            return jsonify({"success": False, "error": str(exc)}), 400
        return render_template("register.html", error=str(exc), form_data=payload), 400
    except Exception:
        message = "Đăng ký thất bại. Vui lòng thử lại sau."
        if request.is_json:
            return jsonify({"success": False, "error": message}), 500
        return render_template("register.html", error=message, form_data=payload), 500

    if request.is_json:
        return jsonify(
            {
                "success": True,
                "message": "Đăng ký thành công. Tài khoản mặc định role Student.",
                "data": {
                    "student": created_student,
                    "redirectPath": "/login",
                },
            }
        ), 201

    return redirect(url_for("auth.login_page", success="Đăng ký thành công. Vui lòng đăng nhập."))


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


@auth_bp.post("/api/auth/register")
def api_register():
    return register_submit()


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
