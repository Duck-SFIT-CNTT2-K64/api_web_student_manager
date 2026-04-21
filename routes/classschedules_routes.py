import pyodbc
from flask import Blueprint, jsonify, request
from db import get_db_connection
from models.helpers import rows_to_list, row_to_dict
from utils.auth import role_required

class_schedule_bp = Blueprint("class_schedules", __name__)

@class_schedule_bp.get("")
def list_class_schedules():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    cs.ScheduleId,
                    cs.ClassId,
                    c.ClassCode,
                    c.ClassName,
                    cs.RoomId,
                    r.RoomName,
                    cs.Weekday,
                    CONVERT(VARCHAR(5), cs.StartTime, 108) AS StartTime,
                    CONVERT(VARCHAR(5), cs.EndTime, 108) AS EndTime,
                    c.TeacherId,
                    CONCAT(t.FirstName, ' ', t.LastName) AS TeacherName
                FROM ClassSchedules cs
                JOIN Classes c ON cs.ClassId = c.ClassId
                LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
                LEFT JOIN Teachers t ON c.TeacherId = t.TeacherId
                ORDER BY cs.ScheduleId
            """)
            rows = cursor.fetchall()
            data = rows_to_list(cursor, rows)
            return jsonify({"success": True, "data": data}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@class_schedule_bp.get("/<int:schedule_id>")
def get_schedule(schedule_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    cs.ScheduleId, cs.ClassId, cs.RoomId, cs.Weekday,
                    CONVERT(VARCHAR(5), cs.StartTime, 108) AS StartTime,
                    CONVERT(VARCHAR(5), cs.EndTime, 108) AS EndTime
                FROM ClassSchedules cs
                WHERE cs.ScheduleId = ?
            """, (schedule_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({"success": False, "error": "Lịch học không tồn tại."}), 404
            data = row_to_dict(cursor, row)
            return jsonify({"success": True, "data": data}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@class_schedule_bp.post("")
@role_required("Admin")
def add_schedule():
    try:
        payload = request.get_json(silent=True) or {}
        class_id = payload.get("ClassId")
        room_id = payload.get("RoomId")
        weekday = payload.get("Weekday")
        start_time = payload.get("StartTime")
        end_time = payload.get("EndTime")

        if not class_id or not weekday or not start_time or not end_time:
            return jsonify({"success": False, "error": "Thiếu thông tin bắt buộc (ClassId, Weekday, StartTime, EndTime)."}), 400

        # Kiểm tra xung đột lịch (cùng phòng, cùng thứ, giờ trùng lặp)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if room_id:
                cursor.execute("""
                    SELECT 1 FROM ClassSchedules 
                    WHERE RoomId = ? AND Weekday = ? 
                      AND ((StartTime < ? AND EndTime > ?) OR (StartTime < ? AND EndTime > ?))
                """, (room_id, weekday, end_time, start_time, end_time, start_time))
                if cursor.fetchone():
                    return jsonify({"success": False, "error": "Phòng học đã có lịch trùng khung giờ."}), 400

            # Kiểm tra giảng viên (qua lớp) có bị trùng lịch không
            cursor.execute("SELECT TeacherId FROM Classes WHERE ClassId = ?", (class_id,))
            teacher_row = cursor.fetchone()
            if teacher_row and teacher_row[0]:
                teacher_id = teacher_row[0]
                cursor.execute("""
                    SELECT 1 FROM ClassSchedules cs
                    JOIN Classes c ON cs.ClassId = c.ClassId
                    WHERE c.TeacherId = ? AND cs.Weekday = ?
                      AND ((cs.StartTime < ? AND cs.EndTime > ?) OR (cs.StartTime < ? AND cs.EndTime > ?))
                """, (teacher_id, weekday, end_time, start_time, end_time, start_time))
                if cursor.fetchone():
                    return jsonify({"success": False, "error": "Giảng viên đã có lịch dạy trùng khung giờ."}), 400

            cursor.execute("""
                INSERT INTO ClassSchedules (ClassId, RoomId, Weekday, StartTime, EndTime)
                OUTPUT INSERTED.ScheduleId
                VALUES (?, ?, ?, ?, ?)
            """, (class_id, room_id, weekday, start_time, end_time))
            schedule_id = cursor.fetchone()[0]
            conn.commit()

        return jsonify({"success": True, "message": "Đã thêm lịch học.", "data": {"ScheduleId": schedule_id}}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500   

@class_schedule_bp.put("/<int:schedule_id>")
@role_required("Admin")
def update_schedule(schedule_id: int):
    try:
        payload = request.get_json(silent=True) or {}
        class_id = payload.get("ClassId")
        room_id = payload.get("RoomId")
        weekday = payload.get("Weekday")
        start_time = payload.get("StartTime")
        end_time = payload.get("EndTime")

        if not class_id or not weekday or not start_time or not end_time:
            return jsonify({"success": False, "error": "Thiếu thông tin bắt buộc."}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Kiểm tra xung đột (bỏ qua chính nó)
            if room_id:
                cursor.execute("""
                    SELECT 1 FROM ClassSchedules 
                    WHERE RoomId = ? AND Weekday = ? AND ScheduleId != ?
                      AND ((StartTime < ? AND EndTime > ?) OR (StartTime < ? AND EndTime > ?))
                """, (room_id, weekday, schedule_id, end_time, start_time, end_time, start_time))
                if cursor.fetchone():
                    return jsonify({"success": False, "error": "Phòng học đã có lịch trùng."}), 400

            cursor.execute("SELECT TeacherId FROM Classes WHERE ClassId = ?", (class_id,))
            teacher_row = cursor.fetchone()
            if teacher_row and teacher_row[0]:
                teacher_id = teacher_row[0]
                cursor.execute("""
                    SELECT 1 FROM ClassSchedules cs
                    JOIN Classes c ON cs.ClassId = c.ClassId
                    WHERE c.TeacherId = ? AND cs.Weekday = ? AND cs.ScheduleId != ?
                      AND ((cs.StartTime < ? AND cs.EndTime > ?) OR (cs.StartTime < ? AND cs.EndTime > ?))
                """, (teacher_id, weekday, schedule_id, end_time, start_time, end_time, start_time))
                if cursor.fetchone():
                    return jsonify({"success": False, "error": "Giảng viên đã có lịch trùng."}), 400

            cursor.execute("""
                UPDATE ClassSchedules
                SET ClassId = ?, RoomId = ?, Weekday = ?, StartTime = ?, EndTime = ?
                WHERE ScheduleId = ?
            """, (class_id, room_id, weekday, start_time, end_time, schedule_id))
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "Không tìm thấy lịch học."}), 404
            conn.commit()

        return jsonify({"success": True, "message": "Đã cập nhật lịch học."}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@class_schedule_bp.delete("/<int:schedule_id>")
@role_required("Admin")
def delete_schedule(schedule_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM ClassSchedules WHERE ScheduleId = ?", (schedule_id,))
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "Không tìm thấy lịch học."}), 404
            conn.commit()
        return jsonify({"success": True, "message": "Đã xóa lịch học."}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500  