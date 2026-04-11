from typing import Any, Dict

from db import get_db_connection
from models.helpers import row_to_dict, rows_to_list


def get_dashboard_summary() -> Dict[str, Any]:
    with get_db_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM Students) AS TotalStudents,
                (SELECT COUNT(*) FROM Teachers) AS TotalTeachers,
                (SELECT COUNT(*) FROM Courses) AS TotalCourses,
                (SELECT COUNT(*) FROM Classes) AS TotalClasses,
                (SELECT COUNT(*) FROM Users) AS TotalUsers,
                (SELECT COUNT(*) FROM Enrollments) AS TotalEnrollments,
                (SELECT COALESCE(SUM(AmountPaid), 0) FROM Tuitions) AS TotalRevenue,
                (SELECT COALESCE(SUM(TotalFee - AmountPaid), 0) FROM Tuitions) AS OutstandingTuition,
                (SELECT COUNT(*) FROM Tuitions WHERE Status = N'Paid') AS PaidTuitionCount,
                (SELECT COUNT(*) FROM Tuitions WHERE Status = N'Pending') AS PendingTuitionCount,
                (SELECT COUNT(*) FROM Tuitions WHERE Status = N'Overdue') AS OverdueTuitionCount,
                (SELECT COUNT(*) FROM Notifications) AS TotalNotifications
            """
        )
        row = cursor.fetchone()
        summary = row_to_dict(cursor, row)

        cursor.execute(
            """
            SELECT TOP 5
                co.CourseName,
                COUNT(e.EnrollmentId) AS EnrollmentCount
            FROM Courses co
            LEFT JOIN Classes c ON co.CourseId = c.CourseId
            LEFT JOIN Enrollments e ON c.ClassId = e.ClassId
            GROUP BY co.CourseName
            ORDER BY EnrollmentCount DESC, co.CourseName
            """
        )
        summary["TopCourses"] = rows_to_list(cursor, cursor.fetchall())

        cursor.execute(
            """
            SELECT TOP 5
                n.NotificationId,
                n.Title,
                n.CreatedDate,
                COUNT(nr.RecipientId) AS RecipientCount
            FROM Notifications n
            LEFT JOIN NotificationRecipients nr ON n.NotificationId = nr.NotificationId
            GROUP BY n.NotificationId, n.Title, n.CreatedDate
            ORDER BY n.CreatedDate DESC
            """
        )
        summary["RecentNotifications"] = rows_to_list(cursor, cursor.fetchall())
        return summary
