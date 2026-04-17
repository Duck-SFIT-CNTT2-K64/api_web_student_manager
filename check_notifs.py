from db import get_db_connection
from models.notification_model import get_unread_notifications_for_user

def check_notifs():
    # Thử kiểm tra cho một vài User ID mẫu
    for uid in [1, 2, 3, 4, 5, 6]:
        notifs = get_unread_notifications_for_user(uid)
        print(f"User {uid}: {len(notifs)} unread notifications.")
        for n in notifs:
            print(f"  - Title: {n['Title']}")

if __name__ == "__main__":
    check_notifs()
