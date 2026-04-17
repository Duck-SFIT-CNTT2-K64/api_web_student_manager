from db import get_db_connection
with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT RoleId, RoleName FROM Roles')
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, Name: {row[1]}")
