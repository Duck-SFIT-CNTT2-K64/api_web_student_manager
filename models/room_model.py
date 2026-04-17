from typing import Any, Dict, List, Optional
import pyodbc
from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list


def get_all_rooms() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT RoomId, RoomName, Capacity FROM Rooms ORDER BY RoomName ASC")
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_room_by_id(room_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT RoomId, RoomName, Capacity FROM Rooms WHERE RoomId = ?",
            room_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def create_room(payload: Dict[str, Any]) -> Dict[str, Any]:
    room_name = (payload.get("RoomName") or "").strip()
    capacity = payload.get("Capacity") or 0

    if not room_name:
        raise ValueError("Tên phòng học là bắt buộc.")
    try:
        capacity = int(capacity)
        if capacity <= 0:
            raise ValueError("Sức chứa phải lớn hơn 0.")
    except (ValueError, TypeError):
        raise ValueError("Sức chứa không hợp lệ.")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        # Kiểm tra trùng tên phòng
        cursor.execute("SELECT 1 FROM Rooms WHERE RoomName = ?", room_name)
        if cursor.fetchone():
            raise ValueError("Tên phòng học này đã tồn tại.")

        cursor.execute(
            """
            INSERT INTO Rooms (RoomName, Capacity)
            OUTPUT INSERTED.RoomId
            VALUES (?, ?)
            """,
            room_name,
            capacity,
        )
        inserted_id = cursor.fetchone()[0]
        connection.commit()

        return get_room_by_id(inserted_id)


def update_room(room_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    room_name = (payload.get("RoomName") or "").strip()
    capacity = payload.get("Capacity")

    if not room_name:
        raise ValueError("Tên phòng học là bắt buộc.")
    try:
        capacity = int(capacity)
        if capacity <= 0:
            raise ValueError("Sức chứa phải lớn hơn 0.")
    except (ValueError, TypeError):
        raise ValueError("Sức chứa không hợp lệ.")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        # Kiểm tra trùng tên phòng (với ID khác)
        cursor.execute("SELECT 1 FROM Rooms WHERE RoomName = ? AND RoomId != ?", room_name, room_id)
        if cursor.fetchone():
            raise ValueError("Tên phòng học này đã tồn tại.")

        cursor.execute(
            """
            UPDATE Rooms
            SET RoomName = ?, Capacity = ?
            WHERE RoomId = ?
            """,
            room_name,
            capacity,
            room_id,
        )
        if cursor.rowcount == 0:
            return None
        connection.commit()

        return get_room_by_id(room_id)


def delete_room(room_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        # Ràng buộc khoa ngoại: Không được xóa nếu phòng đang được sử dụng trong ClassSchedules (Lịch xếp lớp)
        cursor.execute("SELECT 1 FROM ClassSchedules WHERE RoomId = ?", room_id)
        if cursor.fetchone():
            raise ValueError("Không thể xóa phòng học này vì phòng đang được sử dụng để xếp lịch học.")

        cursor.execute("DELETE FROM Rooms WHERE RoomId = ?", room_id)
        deleted = cursor.rowcount > 0
        connection.commit()
        return deleted
