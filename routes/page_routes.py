from flask import Blueprint, redirect, render_template, url_for

page_bp = Blueprint("pages", __name__)


@page_bp.get("/")
def home():
    return redirect(url_for("pages.students_page"))


@page_bp.get("/students-page")
def students_page():
    return render_template("students.html")


@page_bp.get("/classes-page")
def classes_page():
    return render_template("classes.html")


@page_bp.get("/enrollment-page")
def enrollment_page():
    return render_template("enrollment.html")
