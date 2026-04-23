from flask import Blueprint, redirect, render_template, session, url_for

from db import get_db_connection
from models.auth_model import (
    get_admin_home_data,
    get_student_home_data,
    get_teacher_home_data,
    get_user_by_id,
)
from models.helpers import row_to_dict
from models.public_model import get_public_landing_data
from utils.auth import current_session_user, login_required, role_required

page_bp = Blueprint("pages", __name__)


def _get_settings_profile(user_id: int) -> dict:
    base = get_user_by_id(user_id) or {}
    profile = {
        "UserId": base.get("UserId"),
        "Username": base.get("Username"),
        "FullName": base.get("FullName"),
        "Email": base.get("Email"),
        "PhoneNumber": base.get("PhoneNumber"),
        "RoleName": base.get("RoleName"),
        "Status": base.get("Status"),
        "StudentCode": base.get("StudentCode"),
        "TeacherCode": base.get("TeacherCode"),
        "DateOfBirth": None,
        "Gender": None,
        "Address": None,
        "Specialization": None,
    }

    role_name = str(base.get("RoleName") or "").lower()

    try:
        with get_db_connection() as connection:
            cursor = connection.cursor()
            if role_name == "student":
                cursor.execute(
                    """
                    SELECT s.DateOfBirth, s.Gender, s.Address
                    FROM Students s
                    WHERE s.UserId = ?
                    """,
                    user_id,
                )
                row = cursor.fetchone()
                if row:
                    extra = row_to_dict(cursor, row)
                    profile["DateOfBirth"] = extra.get("DateOfBirth")
                    profile["Gender"] = extra.get("Gender")
                    profile["Address"] = extra.get("Address")
            elif role_name == "teacher":
                cursor.execute(
                    """
                    SELECT t.Specialization
                    FROM Teachers t
                    WHERE t.UserId = ?
                    """,
                    user_id,
                )
                row = cursor.fetchone()
                if row:
                    extra = row_to_dict(cursor, row)
                    profile["Specialization"] = extra.get("Specialization")
    except Exception:
        pass

    return profile


@page_bp.get("/")
def home():
    try:
        landing_data = get_public_landing_data()
    except Exception:
        landing_data = {
            "Center": {
                "Name": "CLASSES369",
                "Tagline": "Hands-on IT training — career ready from day one",
                "Hotline": "0901 234 369",
                "Email": "hello@classes369.vn",
                "Address": "Zone A - Hanoi University of Industry",
            },
            "OpenSchedules": [],
            "Programs": [],
            "Notices": [],
            "FeaturedTeachers": [],
            "Services": [],
            "PaymentGuide": [],
        }

    session_user = current_session_user()
    role_name = str(session_user.get('RoleName') or '').lower() if session_user else ''
    return render_template(
        "landing.html",
        landing_data=landing_data,
        current_user=session_user,
        role_name=role_name,
    )


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
    return redirect(url_for("auth.login_page", error="This account has not been assigned a valid role."))


@page_bp.get("/admin/home")
@role_required("Admin")
def admin_home_page():
    return render_template(
        "admin/home.html",
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


_STUDENT_SECTIONS = {
    "overview": "Overview",
    "scores": "Grades",
    "register": "Course registration",
    "enrollments": "My enrollments",
    "schedule": "Class schedule",
    "exams": "Exam schedule",
    "assignments": "Assignments",
    "attendance": "Attendance",
    "tuition": "Tuition",
    "payment": "Online payment",
    "notifications": "Notifications",
}


def _render_student_portal(active_section: str):
    session_user = current_session_user()
    home_data = get_student_home_data(int(session_user["UserId"]))
    section = active_section if active_section in _STUDENT_SECTIONS else "overview"
    return render_template(
        "student_portal.html",
        current_user=session_user,
        home_data=home_data,
        active_section=section,
        page_title=_STUDENT_SECTIONS.get(section, "Student portal"),
    )


@page_bp.get("/student/home")
@role_required("Student")
def student_home_page():
    return _render_student_portal("overview")


@page_bp.get("/student/scores")
@role_required("Student")
def student_scores_page():
    return _render_student_portal("scores")


@page_bp.get("/student/register")
@role_required("Student")
def student_register_page():
    return _render_student_portal("register")


@page_bp.get("/student/enrollments")
@role_required("Student")
def student_enrollments_page():
    return _render_student_portal("enrollments")


@page_bp.get("/student/schedule")
@role_required("Student")
def student_schedule_page():
    return _render_student_portal("schedule")


@page_bp.get("/student/exams")
@role_required("Student")
def student_exams_page():
    return _render_student_portal("exams")


@page_bp.get("/student/assignments")
@role_required("Student")
def student_assignments_page():
    return _render_student_portal("assignments")


@page_bp.get("/student/attendance")
@role_required("Student")
def student_attendance_page():
    return _render_student_portal("attendance")


@page_bp.get("/student/tuition")
@role_required("Student")
def student_tuition_page():
    return _render_student_portal("tuition")


@page_bp.get("/student/payment")
@role_required("Student")
def student_payment_page():
    return _render_student_portal("payment")


@page_bp.get("/student/notifications")
@role_required("Student")
def student_notifications_page():
    return _render_student_portal("notifications")


@page_bp.get("/dashboard")
@role_required("Admin")
def dashboard_page():
    return render_template("admin/dashboard.html", current_user=current_session_user())


@page_bp.get("/settings")
@login_required
def settings_page():
    session_user = current_session_user()
    profile = _get_settings_profile(int(session_user["UserId"]))
    return render_template(
        "settings.html",
        current_user=session_user,
        profile=profile,
    )


@page_bp.get("/students-page")
def students_page():
    return redirect(url_for("pages.dashboard_page"))


@page_bp.get("/classes-page")
def classes_page():
    return redirect(url_for("pages.dashboard_page"))


@page_bp.get("/enrollment-page")
def enrollment_page():
    return redirect(url_for("pages.dashboard_page"))
