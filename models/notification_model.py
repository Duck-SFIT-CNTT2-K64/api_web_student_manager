from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list

NOTIFICATION_SELECT_BASE = """
SELECT
    n.NotificationId,
    n.AttachmentUrl,
    creator.FullName AS CreatorName,
    n.Title,
    n.Content,
    n.CreatedDate,
    COUNT(DISTINCT nr.RecipientId) AS RecipientCount,
    COALESCE(CAST(SUM(CASE WHEN nr.IsRead = 1 THEN 1 ELSE 0 END) AS INT), 0) AS ReadCount
FROM Notifications n
LEFT JOIN Users creator ON n.CreatorId = creator.UserId
LEFT JOIN NotificationRecipients nr ON n.NotificationId = nr.NotificationId
"""


def get_all_notifications() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            NOTIFICATION_SELECT_BASE
            + """
            GROUP BY n.NotificationId, n.CreatorId, n.AttachmentUrl, creator.FullName, n.Title, n.Content, n.CreatedDate
            ORDER BY n.CreatedDate DESC
            """
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def delete_notification(notification_id: int) -> bool:
    if not get_notification_by_id(notification_id):
        return False
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM NotificationRecipients WHERE NotificationId = ?", (notification_id,))
        cursor.execute("DELETE FROM Notifications WHERE NotificationId = ?", (notification_id,))
        connection.commit()
    return True


def get_unread_notifications_for_user(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        query = """
        SELECT
            n.NotificationId,
            n.Title,
            n.Content,
            n.CreatedDate,
            c.FullName AS CreatorName
        FROM Notifications n
        INNER JOIN NotificationRecipients nr ON n.NotificationId = nr.NotificationId
        LEFT JOIN Users c ON n.CreatorId = c.UserId
        WHERE nr.RecipientId = ? AND nr.IsRead = 0
        ORDER BY n.CreatedDate DESC
        """
        cursor.execute(query, user_id)
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)
 
 
def get_all_notifications_for_user(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        query = """
        SELECT
            n.NotificationId,
            n.Title,
            n.Content,
            n.CreatedDate,
            c.FullName AS CreatorName,
            nr.IsRead
        FROM Notifications n
        INNER JOIN NotificationRecipients nr ON n.NotificationId = nr.NotificationId
        LEFT JOIN Users c ON n.CreatorId = c.UserId
        WHERE nr.RecipientId = ?
        ORDER BY n.CreatedDate DESC
        """
        cursor.execute(query, user_id)
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def mark_notification_as_read(notification_id: int, user_id: int) -> bool:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE NotificationRecipients
            SET IsRead = 1
            WHERE NotificationId = ? AND RecipientId = ?
            """,
            (notification_id, user_id),
        )
        if cursor.rowcount > 0:
            connection.commit()
            return True
        return False


def get_notification_by_id(notification_id: int) -> Dict[str, Any] | None:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            NOTIFICATION_SELECT_BASE
            + """
            WHERE n.NotificationId = ?
            GROUP BY n.NotificationId, n.CreatorId, n.AttachmentUrl, creator.FullName, n.Title, n.Content, n.CreatedDate
            """,
            notification_id,
        )
        row = cursor.fetchone()
        return row_to_dict(cursor, row) if row else None


def _get_default_creator_id(cursor) -> int:
    cursor.execute(
        """
        SELECT TOP 1 u.UserId
        FROM Users u
        LEFT JOIN Roles r ON u.RoleId = r.RoleId
        ORDER BY CASE WHEN r.RoleName = N'Admin' THEN 0 ELSE 1 END, u.UserId
        """
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError("No user exists to use as notification creator.")
    return int(row[0])


def _resolve_recipient_ids(cursor, payload: Dict[str, Any]) -> List[int]:
    explicit_ids = payload.get("RecipientIds")
    if explicit_ids:
        return [int(x) for x in explicit_ids]

    audience = (payload.get("Audience") or "all").lower()
    query = """
        SELECT u.UserId
        FROM Users u
        LEFT JOIN Roles r ON u.RoleId = r.RoleId
    """
    params: list[Any] = []
    if audience == "students":
        query += " WHERE r.RoleName = N'Student'"
    elif audience == "teachers":
        query += " WHERE r.RoleName = N'Teacher'"
    elif audience == "admins":
        query += " WHERE r.RoleName = N'Admin'"
    elif audience != "all":
        query += " WHERE r.RoleName = ?"
        params.append(payload.get("Audience"))

    cursor.execute(query, *params)
    return [int(row[0]) for row in cursor.fetchall()]


def create_notification(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = (payload.get("Title") or "").strip()
    if not title:
        raise ValueError("Title is required.")

    content = payload.get("Content") or None
    attachment_url = payload.get("AttachmentUrl") or None
    creator_id = payload.get("CreatorId")

    with get_db_connection() as connection:
        cursor = connection.cursor()
        try:
            if not creator_id:
                creator_id = _get_default_creator_id(cursor)

            cursor.execute(
                """
                INSERT INTO Notifications (CreatorId, Title, Content, AttachmentUrl, CreatedDate)
                OUTPUT INSERTED.NotificationId
                VALUES (?, ?, ?, ?, GETDATE())
                """,
                int(creator_id),
                title,
                content,
                attachment_url,
            )
            notification_id = int(cursor.fetchone()[0])

            recipient_ids = sorted(set(_resolve_recipient_ids(cursor, payload)))
            for recipient_id in recipient_ids:
                cursor.execute(
                    """
                    INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
                    VALUES (?, ?, 0)
                    """,
                    notification_id,
                    recipient_id,
                )
            connection.commit()
        except Exception:
            connection.rollback()
            raise

        return get_notification_by_id(notification_id)


def update_notification(notification_id: int, payload: Dict[str, Any]) -> Dict[str, Any] | None:
    title = (payload.get("Title") or "").strip()
    if not title:
        raise ValueError("Title is required.")

    content = payload.get("Content") or None

    try:
        with get_db_connection() as connection:
            cursor = connection.cursor()
            
            # 1. Update the notification's title and content
            cursor.execute(
                """
                UPDATE Notifications
                SET Title = ?, Content = ?, AttachmentUrl = ?
                WHERE NotificationId = ?
                """,
                title,
                content,
                attachment_url,
                notification_id,
            )
            if cursor.rowcount == 0:
                return None
                
            # 2. Reset the read state for all recipients so the banner appears again
            cursor.execute(
                """
                UPDATE NotificationRecipients
                SET IsRead = 0
                WHERE NotificationId = ?
                """,
                notification_id,
            )
            
            connection.commit()

            return get_notification_by_id(notification_id)
    except Exception:
        raise


def get_notification_read_details(notification_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        query = """
        SELECT
            u.UserId,
            u.FullName,
            u.Username,
            r.RoleName,
            nr.IsRead,
            c.ClassName,
            c.ClassCode
        FROM NotificationRecipients nr
        INNER JOIN Users u ON nr.RecipientId = u.UserId
        LEFT JOIN Roles r ON u.RoleId = r.RoleId
        LEFT JOIN Students s ON u.UserId = s.UserId
        LEFT JOIN Enrollments e ON s.StudentId = e.StudentId
        LEFT JOIN Notifications n ON nr.NotificationId = n.NotificationId
        LEFT JOIN Classes c ON e.ClassId = c.ClassId AND (n.ClassId IS NULL OR n.ClassId = c.ClassId)
        WHERE nr.NotificationId = ?
        ORDER BY nr.IsRead DESC, u.FullName ASC
        """
        cursor.execute(query, notification_id)
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)
