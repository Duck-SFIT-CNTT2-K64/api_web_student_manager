import pyodbc
from flask import Blueprint, jsonify, request
from db import get_db_connection
from models.student_model import (
    create_student,
    delete_student_by_id,
    get_all_students,
    get_student_by_id,
    get_student_statuses,
    update_student,
)

student_bp = Blueprint("students", __name__)


@student_bp.get("")
def list_students():
    try:
        search_query = request.args.get('q','').strip()
        if not search_query:
            students = get_all_students()
            return jsonify({"success": True, "data": students}), 200
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT s.StudentId, s.StudentCode, s.FullName, s.Email, s.PhoneNumber, ss.StatusName
                FROM Students s
                LEFT JOIN StudentStatuses ss ON s.StatusId = ss.StatusId
                WHERE s.StudentCode LIKE ? OR s.FullName LIKE ? OR s.Email LIKE ?
            """
            like_term = f"%{search_query}%"    
            cursor.execute(query, (like_term, like_term, like_term))
            rows = cursor.fetchall()
            students = [dict(zip([column[0] for column in cursor.description], row)) for row in rows]
            return jsonify({"success": True, "data": students}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/statuses")
def list_student_statuses():
    try:
        statuses = get_student_statuses()
        return jsonify({"success": True, "data": statuses}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.get("/<int:student_id>")
def get_student(student_id: int):
    try:
        student = get_student_by_id(student_id)
        if not student:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "data": student}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.post("")
def add_student():
    try:
        payload = request.get_json(silent=True) or {}
        student = create_student(payload)
        return jsonify({"success": True, "message": "Student created.", "data": student}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Dữ liệu bị trùng hoặc không hợp lệ (email/mã sinh viên).",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.put("/<int:student_id>")
def edit_student(student_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        student = update_student(student_id, payload)
        if not student:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "message": "Student updated.", "data": student}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except pyodbc.IntegrityError as exc:
        return jsonify(
            {
                "success": False,
                "error": "Dữ liệu bị trùng hoặc không hợp lệ khi cập nhật sinh viên.",
                "details": str(exc),
            }
        ), 400
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500


@student_bp.delete("/<int:student_id>")
def remove_student(student_id: int):
    try:
        deleted = delete_student_by_id(student_id)
        if not deleted:
            return jsonify({"success": False, "error": "Student not found."}), 404
        return jsonify({"success": True, "message": "Student deleted."}), 200
    except pyodbc.Error as exc:
        return jsonify({"success": False, "error": "Database error.", "details": str(exc)}), 500
    except Exception as exc:
        return jsonify({"success": False, "error": "Unexpected server error.", "details": str(exc)}), 500

#lay ho so ca nhan
@student_bp.get('/profile/<int:user_id>')
def get_student_profile(user_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT s.StudentCode, s.FullName, s.Email, s.PhoneNumber, ss.StatusName,
                       (SELECT COUNT(*) FROM Enrollments e WHERE e.StudentId = s.StudentId AND e.Status = N'Enrolled') as ActiveClasses,
                       (SELECT ISNULL(SUM(t.TotalFee - t.AmountPaid), 0) FROM Tuitions t 
                        JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId 
                        WHERE e.StudentId = s.StudentId) as TotalDebt
                FROM Students s
                LEFT JOIN StudentStatuses ss ON s.StatusId = ss.StatusId
                WHERE s.UserId = ?
            """
            cursor.execute(query, (user_id,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({"success": False, "error": "Không tìm thấy hồ sơ sinh viên."}), 404
                
            # Đóng gói dữ liệu (chuyển TotalDebt thành float để tránh lỗi Decimal JSON)
            data = dict(zip([column[0] for column in cursor.description], row))
            data['TotalDebt'] = float(data['TotalDebt'])
            
            return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi máy chủ.", "details": str(exc)}), 500


# 8.2: Lịch học cá nhân
@student_bp.get('/schedule/<int:user_id>')
def get_student_schedule(user_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT cs.Weekday, cs.StartTime, cs.EndTime, r.RoomName, c.ClassName, t.LastName + ' ' + t.FirstName as TeacherName
                FROM ClassSchedules cs
                JOIN Classes c ON cs.ClassId = c.ClassId
                JOIN Enrollments e ON c.ClassId = e.ClassId
                JOIN Students s ON e.StudentId = s.StudentId
                JOIN Teachers t ON c.TeacherId = t.TeacherId
                LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
                WHERE s.UserId = ? AND e.Status = N'Enrolled'
                ORDER BY CASE 
                    WHEN Weekday = N'Monday' THEN 1 WHEN Weekday = N'Tuesday' THEN 2 
                    WHEN Weekday = N'Wednesday' THEN 3 WHEN Weekday = N'Thursday' THEN 4 
                    WHEN Weekday = N'Friday' THEN 5 WHEN Weekday = N'Saturday' THEN 6 
                    ELSE 7 END, StartTime
            """
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()
            
            schedule = []
            for row in rows:
                item = dict(zip([column[0] for column in cursor.description], row))
                # Ép kiểu thời gian (Fix lỗi Object of type time is not JSON serializable)
                item['StartTime'] = str(item['StartTime']) if item.get('StartTime') else None
                item['EndTime'] = str(item['EndTime']) if item.get('EndTime') else None
                schedule.append(item)
                
            return jsonify({"success": True, "data": schedule}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi máy chủ.", "details": str(exc)}), 500


# 8.3: Bảng điểm các môn học
@student_bp.get('/scores/<int:user_id>')
def get_student_scores(user_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Dùng kỹ thuật PIVOT (hoặc MAX CASE) để xoay dọc thành ngang
            query = """
                SELECT c.ClassCode, c.ClassName,
                       MAX(CASE WHEN st.ScoreTypeId = 1 THEN sc.ScoreValue END) AS ChuyenCan,
                       MAX(CASE WHEN st.ScoreTypeId = 2 THEN sc.ScoreValue END) AS GiuaKy,
                       MAX(CASE WHEN st.ScoreTypeId = 3 THEN sc.ScoreValue END) AS CuoiKy
                FROM Enrollments e
                JOIN Students s ON e.StudentId = s.StudentId
                JOIN Classes c ON e.ClassId = c.ClassId
                LEFT JOIN Scores sc ON e.EnrollmentId = sc.EnrollmentId
                LEFT JOIN ScoreTypes st ON sc.ScoreTypeId = st.ScoreTypeId
                WHERE s.UserId = ?
                GROUP BY c.ClassCode, c.ClassName
            """
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()
            
            scores = [dict(zip([column[0] for column in cursor.description], row)) for row in rows]
            # Ép float cho an toàn
            for s in scores:
                s['ChuyenCan'] = float(s['ChuyenCan']) if s['ChuyenCan'] is not None else None
                s['GiuaKy'] = float(s['GiuaKy']) if s['GiuaKy'] is not None else None
                s['CuoiKy'] = float(s['CuoiKy']) if s['CuoiKy'] is not None else None

            return jsonify({"success": True, "data": scores}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi máy chủ.", "details": str(exc)}), 500


# 8.4: Tình trạng công nợ (Học phí)
@student_bp.get('/finance/<int:user_id>')
def get_student_finance(user_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT c.ClassName, t.TotalFee, t.AmountPaid, 
                       (t.TotalFee - t.AmountPaid) as Debt, 
                       t.DueDate, t.Status
                FROM Tuitions t
                JOIN Enrollments e ON t.EnrollmentId = e.EnrollmentId
                JOIN Classes c ON e.ClassId = c.ClassId
                JOIN Students s ON e.StudentId = s.StudentId
                WHERE s.UserId = ?
            """
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()
            
            finances = []
            for row in rows:
                item = dict(zip([column[0] for column in cursor.description], row))
                item['TotalFee'] = float(item['TotalFee'])
                item['AmountPaid'] = float(item['AmountPaid'])
                item['Debt'] = float(item['Debt'])
                # Ép ngày tháng thành chuỗi YYYY-MM-DD
                item['DueDate'] = str(item['DueDate']) if item.get('DueDate') else None
                finances.append(item)
                
            return jsonify({"success": True, "data": finances}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": "Lỗi máy chủ.", "details": str(exc)}), 500