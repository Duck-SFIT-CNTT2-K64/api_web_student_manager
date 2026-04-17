from db import get_db_connection

def fix_teacher_roles():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Tìm RoleId chính xác của Teacher
        cursor.execute("SELECT RoleId FROM Roles WHERE RoleName = N'Teacher'")
        role_row = cursor.fetchone()
        if not role_row:
            print("Không tìm thấy Role 'Teacher' trong CSDL.")
            return
        
        teacher_role_id = role_row[0]
        
        # 2. Cập nhật các tài khoản User nào có trong bảng Teachers nhưng đang mang RoleId khác
        cursor.execute("""
            UPDATE Users 
            SET RoleId = ? 
            WHERE UserId IN (SELECT UserId FROM Teachers)
            AND RoleId <> ?
        """, (teacher_role_id, teacher_role_id))
        
        affected = cursor.rowcount
        conn.commit()
        print(f"Đã cập nhật thành công {affected} tài khoản giảng viên về đúng vai trò.")

if __name__ == "__main__":
    fix_teacher_roles()
