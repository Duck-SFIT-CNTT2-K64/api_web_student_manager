from db import get_db_connection
with get_db_connection() as conn:
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE Notifications ADD ClassId INT NULL")
        print("Column ClassId added successfully.")
    except Exception as e:
        print("Error:", e)
    conn.commit()
