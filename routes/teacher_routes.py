import pyodbc
from flask import Blueprint, jsonify, request
from db import get_db_connection
from models.teacher_model import (
    get_all_teachers,
    get_teacher_by_id,
    create_teacher,
    update_teacher,
    delete_teacher,
)

teacher_bp = Blueprint("teachers", __name__)


@teacher_bp.get("")
def list_teachers():
    try:
        teachers = get_all_teachers()
        return jsonify({"success": True, "data": teachers}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.get("/<int:teacher_id>")
def get_teacher(teacher_id: int):
    try:
        teacher = get_teacher_by_id(teacher_id)
        if not teacher:
            return jsonify({"success": False, "error": "Teacher not found."}), 404
        return jsonify({"success": True, "data": teacher}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.post("")
def add_teacher():
    try:
        payload = request.get_json(silent=True) or {}
        teacher = create_teacher(payload)
        return jsonify({"success": True, "message": "Teacher created.", "data": teacher}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Dữ liệu bị trùng (mã/email giảng viên).", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.put("/<int:teacher_id>")
def edit_teacher(teacher_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        teacher = update_teacher(teacher_id, payload)
        if not teacher:
            return jsonify({"success": False, "error": "Teacher not found."}), 404
        return jsonify({"success": True, "message": "Teacher updated.", "data": teacher}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify({"success": False, "error": "Dữ liệu không hợp lệ khi cập nhật.", "details": str(exc)}), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@teacher_bp.delete("/<int:teacher_id>")
def remove_teacher(teacher_id: int):
    try:
        deleted = delete_teacher(teacher_id)
        if not deleted:
            return jsonify({"success": False, "error": "Teacher not found."}), 404
        return jsonify({"success": True, "message": "Teacher deleted."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500



@teacher_bp.get('/stats/<int:user_id>')
def get_teacher_stats(user_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
        
            # 1. Tìm TeacherId
            cursor.execute("SELECT TeacherId FROM Teachers WHERE UserId = ?", (user_id,))
            teacher = cursor.fetchone()
            if not teacher:
                return jsonify({"success": False, "error": "Không tìm thấy hồ sơ giảng viên."}), 404
            
            # 2. Lấy thống kê
            query = """
                SELECT 
                    (SELECT COUNT(*) FROM Classes WHERE TeacherId = ?) as TotalClasses,
                    (SELECT COUNT(DISTINCT StudentId) FROM Enrollments e 
                    JOIN Classes c ON e.ClassId = c.ClassId 
                    WHERE c.TeacherId = ?) as TotalStudents
            """
            cursor.execute(query, (teacher.TeacherId, teacher.TeacherId))
            stats = cursor.fetchone()
            
            data = {
                "total_classes": stats.TotalClasses,
                "total_students": stats.TotalStudents
            }
            return jsonify({"success": True, "data": data}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Lỗi cơ sở dữ liệu.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi máy chủ.", "details": str(exc)}), 500

#lay lich day
@teacher_bp.get('/schedule/<int:user_id>')
def get_teacher_schedule(user_id: int):
    try:
        # Nhớ dùng 'with' để kết nối an toàn như API trước
        with get_db_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT cs.Weekday, cs.StartTime, cs.EndTime, r.RoomName, c.ClassName, c.ClassCode
                FROM ClassSchedules cs
                JOIN Classes c ON cs.ClassId = c.ClassId
                JOIN Teachers t ON c.TeacherId = t.TeacherId
                LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
                WHERE t.UserId = ?
                ORDER BY CASE 
                    WHEN Weekday = N'Monday' THEN 1 WHEN Weekday = N'Tuesday' THEN 2 
                    WHEN Weekday = N'Wednesday' THEN 3 WHEN Weekday = N'Thursday' THEN 4 
                    WHEN Weekday = N'Friday' THEN 5 WHEN Weekday = N'Saturday' THEN 6 
                    ELSE 7 END, StartTime
            """
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()
            
            # Xử lý ép kiểu thời gian thành chữ (String)
            schedule = []
            for row in rows:
                item = dict(zip([column[0] for column in cursor.description], row))
                # Ép StartTime và EndTime thành chữ (VD: '18:00:00')
                if item.get('StartTime') is not None:
                    item['StartTime'] = str(item['StartTime'])
                if item.get('EndTime') is not None:
                    item['EndTime'] = str(item['EndTime'])
                schedule.append(item)
                
            return jsonify({"success": True, "data": schedule}), 200
            
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi máy chủ.", "details": str(exc)}), 500

#lay danh sách sinh vien theo lop
@teacher_bp.get('/class-students/<int:class_id>')
def get_class_students(class_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT e.EnrollmentId, s.StudentCode, s.FullName, 
                   sc_cc.ScoreValue as ChuyenCan, 
                   sc_gk.ScoreValue as GiuaKy, 
                   sc_ck.ScoreValue as CuoiKy
            FROM Enrollments e
            JOIN Students s ON e.StudentId = s.StudentId
            LEFT JOIN Scores sc_cc ON e.EnrollmentId = sc_cc.EnrollmentId AND sc_cc.ScoreTypeId = 1
            LEFT JOIN Scores sc_gk ON e.EnrollmentId = sc_gk.EnrollmentId AND sc_gk.ScoreTypeId = 2
            LEFT JOIN Scores sc_ck ON e.EnrollmentId = sc_ck.EnrollmentId AND sc_ck.ScoreTypeId = 3
            WHERE e.ClassId = ?
        """ 
            cursor.execute(query, (class_id,))
            rows = cursor.fetchall()
            students = [dict(zip([column[0] for column in cursor.description], row)) for row in rows]
            return jsonify({"success": True, "data": students}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi máy chủ.", "details": str(exc)}), 500

#nhap va cap nhat diem
@teacher_bp.post('/save-score')
def save_score():
    try:
        data = request.json
        enrollment_id = data.get('EnrollmentId')
        score_type_id = data.get('ScoreTypeId')
        score_value = data.get('ScoreValue')

        # Validate điểm số
        if score_value is None or not (0 <= float(score_value) <= 10):
            return jsonify({"success": False, "error": "Điểm phải nằm trong khoảng từ 0 đến 10"}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
        
            upsert_query = """
                IF EXISTS (SELECT 1 FROM Scores WHERE EnrollmentId = ? AND ScoreTypeId = ?)
                    UPDATE Scores SET ScoreValue = ? WHERE EnrollmentId = ? AND ScoreTypeId = ?
                ELSE
                    INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue) VALUES (?, ?, ?)
            """
            cursor.execute(upsert_query, (enrollment_id, score_type_id, score_value, 
                                      enrollment_id, score_type_id, 
                                      enrollment_id, score_type_id, score_value))
            conn.commit()
            return jsonify({"success": True, "message": "Cập nhật điểm thành công"}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Lỗi khi lưu điểm vào CSDL.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi dữ liệu đầu vào.", "details": str(exc)}), 400