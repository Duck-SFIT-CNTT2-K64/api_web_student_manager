from flask import Blueprint, redirect, render_template, session, url_for

from models.auth_model import get_admin_home_data, get_student_home_data, get_teacher_home_data
from utils.auth import current_session_user, login_required, role_required

page_bp = Blueprint("pages", __name__)


@page_bp.get("/")
def home():
    return redirect(url_for("pages.home_redirect"))


@page_bp.get("/home")
@login_required
def home_redirect():
    role_name = str(session.get("role_name") or "").lower()
    if role_name == "admin":
        return redirect(url_for("pages.admin_home_page"))
    if role_name == "teacher":
        return redirect(url_for("pages.teacher_home_page"))
    if role_name == "student":
        return redirect(url_for("pages.student_home_page"))
    return redirect(url_for("auth.login_page", error="Tài khoản chưa được gán role hợp lệ."))


@page_bp.get("/admin/home")
@role_required("Admin")
def admin_home_page():
    return render_template(
        "admin_home.html",
        current_user=current_session_user(),
        summary=get_admin_home_data(),
    )


@page_bp.get("/teacher/home")
@role_required("Teacher")
def teacher_home_page():
    session_user = current_session_user()
    home_data = get_teacher_home_data(int(session_user["UserId"]))
    return render_template(
        "teacher_home.html",
        current_user=session_user,
        home_data=home_data,
    )


@page_bp.get("/student/home")
@role_required("Student")
def student_home_page():
    session_user = current_session_user()
    home_data = get_student_home_data(int(session_user["UserId"]))
    return render_template(
        "student_home.html",
        current_user=session_user,
        home_data=home_data,
    )


@page_bp.get("/dashboard")
@role_required("Admin")
def dashboard_page():
    return render_template("dashboard.html", current_user=current_session_user())


@page_bp.get("/students-page")
def students_page():
    return redirect(url_for("pages.dashboard_page"))


@page_bp.get("/classes-page")
def classes_page():
    return redirect(url_for("pages.dashboard_page"))


@page_bp.get("/enrollment-page")
def enrollment_page():
    return redirect(url_for("pages.dashboard_page"))
