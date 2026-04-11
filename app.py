from flask import Flask, jsonify

from routes.class_routes import class_bp
from routes.course_routes import course_bp
from routes.enrollment_routes import enrollment_bp
from routes.notification_routes import notification_bp
from routes.page_routes import page_bp
from routes.payment_routes import payment_bp
from routes.report_routes import report_bp
from routes.score_routes import score_bp
from routes.student_routes import student_bp
from routes.teacher_routes import teacher_bp
from routes.tuition_routes import tuition_bp


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # Frontend pages
    app.register_blueprint(page_bp)

    # REST API routes
    app.register_blueprint(student_bp, url_prefix="/api/students")
    app.register_blueprint(teacher_bp, url_prefix="/api/teachers")
    app.register_blueprint(course_bp, url_prefix="/api/courses")
    app.register_blueprint(class_bp, url_prefix="/api/classes")
    app.register_blueprint(enrollment_bp, url_prefix="/api/enrollments")
    app.register_blueprint(tuition_bp, url_prefix="/api/tuitions")
    app.register_blueprint(payment_bp, url_prefix="/api/payments")
    app.register_blueprint(score_bp, url_prefix="/api/scores")
    app.register_blueprint(notification_bp, url_prefix="/api/notifications")
    app.register_blueprint(report_bp, url_prefix="/api/reports")

    @app.get("/api/health")
    def health_check():
        return jsonify({"success": True, "message": "Student Management API is running."}), 200

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"success": False, "error": "Endpoint not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return jsonify({"success": False, "error": "HTTP method not allowed."}), 405

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
