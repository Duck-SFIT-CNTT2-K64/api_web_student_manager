USE QLSV_TrungTamTinHoc_;
GO

-- Seed teacher data (only if table is empty)
IF NOT EXISTS (SELECT 1 FROM Teachers)
BEGIN
    INSERT INTO Teachers (FullName, Email, Phone)
    VALUES
        (N'Pham Thi Lan', N'lan.teacher@example.com', N'0901111111'),
        (N'Tran Minh Khoa', N'khoa.teacher@example.com', N'0902222222');
END
GO

-- Seed course data (only if table is empty)
IF NOT EXISTS (SELECT 1 FROM Courses)
BEGIN
    INSERT INTO Courses (CourseName, Description, Duration, Price)
    VALUES
        (N'Python Flask Basic', N'Backend API for beginners', 24, 2500000),
        (N'Frontend JavaScript Basic', N'HTML CSS JS foundation', 20, 2000000);
END
GO

DECLARE @TeacherId INT = (SELECT TOP 1 TeacherId FROM Teachers ORDER BY TeacherId);
DECLARE @CourseId INT = (SELECT TOP 1 CourseId FROM Courses ORDER BY CourseId);

IF @TeacherId IS NOT NULL
AND @CourseId IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM Classes WHERE ClassName = N'Flask Morning Class')
BEGIN
    INSERT INTO Classes (ClassName, CourseId, TeacherId, StartDate, EndDate, Status)
    VALUES (N'Flask Morning Class', @CourseId, @TeacherId, '2026-04-15', '2026-06-15', N'Đang mở');
END
GO

SELECT * FROM Teachers;
SELECT * FROM Courses;
SELECT * FROM Classes;
