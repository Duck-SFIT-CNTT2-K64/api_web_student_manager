from typing import Any, Dict, List

from db import get_db_connection
from models.helpers import rows_to_list


def _get_open_class_schedules(limit: int = 10) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP (?)
                c.ClassCode,
                c.ClassName,
                co.CourseCode,
                co.CourseName,
                cs.Weekday,
                cs.StartTime,
                cs.EndTime,
                r.RoomName,
                ISNULL(ec.EnrollmentCount, 0) AS EnrollmentCount,
                c.MaxStudents,
                CASE
                    WHEN c.MaxStudents IS NULL THEN NULL
                    ELSE c.MaxStudents - ISNULL(ec.EnrollmentCount, 0)
                END AS RemainingSeats
            FROM ClassSchedules cs
            INNER JOIN Classes c ON cs.ClassId = c.ClassId
            INNER JOIN Courses co ON c.CourseId = co.CourseId
            LEFT JOIN Rooms r ON cs.RoomId = r.RoomId
            LEFT JOIN (
                SELECT ClassId, COUNT(*) AS EnrollmentCount
                FROM Enrollments
                GROUP BY ClassId
            ) ec ON c.ClassId = ec.ClassId
            ORDER BY
                CASE
                    WHEN cs.Weekday = N'Monday' THEN 1
                    WHEN cs.Weekday = N'Tuesday' THEN 2
                    WHEN cs.Weekday = N'Wednesday' THEN 3
                    WHEN cs.Weekday = N'Thursday' THEN 4
                    WHEN cs.Weekday = N'Friday' THEN 5
                    WHEN cs.Weekday = N'Saturday' THEN 6
                    ELSE 7
                END,
                cs.StartTime,
                c.ClassCode
            """,
            int(limit),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def _get_training_programs(limit: int = 8) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP (?)
                co.CourseId,
                co.CourseCode,
                co.CourseName,
                co.Description,
                co.Duration,
                co.Credits,
                co.TuitionFee,
                COUNT(DISTINCT c.ClassId) AS ClassCount,
                COUNT(DISTINCT e.EnrollmentId) AS EnrollmentCount
            FROM Courses co
            LEFT JOIN Classes c ON co.CourseId = c.CourseId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            GROUP BY
                co.CourseId,
                co.CourseCode,
                co.CourseName,
                co.Description,
                co.Duration,
                co.Credits,
                co.TuitionFee
            ORDER BY co.CourseName
            """,
            int(limit),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def _get_home_notices(limit: int = 5) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP (?)
                NoticeId,
                Title,
                Content,
                CreatedAt
            FROM HomeNotices
            ORDER BY CreatedAt DESC, NoticeId DESC
            """,
            int(limit),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def _get_featured_teachers(limit: int = 4) -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT TOP (?)
                ft.FeaturedId,
                ft.Title,
                ft.Summary,
                ft.ImagePath,
                ft.SortOrder,
                COALESCE(CONCAT(t.LastName, N' ', t.FirstName), ft.Title) AS DisplayName,
                t.Specialization
            FROM FeaturedTeachers ft
            LEFT JOIN Teachers t ON ft.TeacherId = t.TeacherId
            WHERE ft.IsActive = 1
            ORDER BY ft.SortOrder ASC, ft.CreatedAt DESC
            """,
            int(limit),
        )
        rows = cursor.fetchall()
        return rows_to_list(cursor, rows)


def get_public_landing_data() -> Dict[str, Any]:
    return {
        "Center": {
            "Name": "CLASSES369",
            "Tagline": "Trung tam tin hoc thuc chien, huong nghiep va lam duoc viec",
            "Hotline": "0901 234 369",
            "Email": "hello@classes369.vn",
            "Address": "Khu A - Dai hoc Cong Nghiep Ha Noi",
        },
        "OpenSchedules": _get_open_class_schedules(),
        "Programs": _get_training_programs(),
        "Notices": _get_home_notices(),
        "FeaturedTeachers": _get_featured_teachers(),
        "Services": [
            {
                "Title": "Tu van lo trinh hoc",
                "Description": "Danh gia nang luc dau vao va tu van lo trinh ca nhan hoa theo muc tieu nghe nghiep.",
            },
            {
                "Title": "Ho tro thuc hanh 1-1",
                "Description": "Huong dan lam bai tap, project theo buoi va review code chi tiet voi tro giang.",
            },
            {
                "Title": "Ket noi viec lam",
                "Description": "Bo sung CV, mock interview va gioi thieu co hoi thuc tap tai doi tac cua trung tam.",
            },
            {
                "Title": "Bao luu linh hoat",
                "Description": "Bao luu ket qua hoc tap khi gap lich hoc dot xuat va hoc bu o lop tiep theo.",
            },
        ],
        "PaymentGuide": [
            "Dang ky lop hoc tai quay hoac tren cong thong tin.",
            "Nhan thong bao hoc phi va han thanh toan trong dashboard hoc vien.",
            "Nop hoc phi theo tung dot, cap nhat trang thai ngay sau khi thanh toan.",
            "Lien he bo phan tai vu neu can xac nhan bien lai va doi soat.",
        ],
    }
