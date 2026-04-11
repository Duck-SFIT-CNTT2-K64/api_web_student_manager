USE QLSV_TrungTamTinHoc;
GO

SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRAN;

    DECLARE @TeacherRoleId INT = (
        SELECT TOP 1 RoleId
        FROM Roles
        WHERE RoleName = N'Teacher'
    );

    DECLARE @StudentRoleId INT = (
        SELECT TOP 1 RoleId
        FROM Roles
        WHERE RoleName = N'Student'
    );

    DECLARE @DefaultStudentStatusId INT = (
        SELECT TOP 1 StatusId
        FROM StudentStatuses
        ORDER BY CASE WHEN StatusName = N'Đang học' THEN 0 ELSE 1 END, StatusId
    );

    IF @TeacherRoleId IS NULL OR @StudentRoleId IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy role Teacher/Student. Hãy kiểm tra bảng Roles.', 16, 1);
    END;

    IF @DefaultStudentStatusId IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy trạng thái sinh viên mặc định. Hãy kiểm tra bảng StudentStatuses.', 16, 1);
    END;

    -- Fix account teacher01: đảm bảo là role Teacher + có hồ sơ giáo viên
    IF EXISTS (SELECT 1 FROM Users WHERE Username = N'teacher01')
    BEGIN
        UPDATE Users
        SET RoleId = @TeacherRoleId,
            Status = N'Active'
        WHERE Username = N'teacher01';

        DECLARE @Teacher01UserId INT = (SELECT UserId FROM Users WHERE Username = N'teacher01');

        IF NOT EXISTS (SELECT 1 FROM Teachers WHERE UserId = @Teacher01UserId)
        BEGIN
            DECLARE @Teacher01Code NVARCHAR(20) = N'GV003';
            IF EXISTS (SELECT 1 FROM Teachers WHERE TeacherCode = @Teacher01Code)
            BEGIN
                SET @Teacher01Code = N'GV' + RIGHT(N'000' + CAST(@Teacher01UserId + 300 AS NVARCHAR(10)), 3);
            END;

            INSERT INTO Teachers (UserId, TeacherCode, FirstName, LastName, Specialization, PhoneNumber, Email)
            SELECT
                u.UserId,
                @Teacher01Code,
                N'Hoàng Quốc',
                N'Anh',
                N'Tin học văn phòng, Cơ sở dữ liệu',
                u.PhoneNumber,
                u.Email
            FROM Users u
            WHERE u.UserId = @Teacher01UserId;
        END;
    END;

    -- Fix account student01: đảm bảo là role Student + có hồ sơ sinh viên
    IF EXISTS (SELECT 1 FROM Users WHERE Username = N'student01')
    BEGIN
        UPDATE Users
        SET RoleId = @StudentRoleId,
            Status = N'Active'
        WHERE Username = N'student01';

        DECLARE @Student01UserId INT = (SELECT UserId FROM Users WHERE Username = N'student01');

        IF NOT EXISTS (SELECT 1 FROM Students WHERE UserId = @Student01UserId)
        BEGIN
            DECLARE @Student01Code NVARCHAR(20) = N'SV006';
            IF EXISTS (SELECT 1 FROM Students WHERE StudentCode = @Student01Code)
            BEGIN
                SET @Student01Code = N'SV' + RIGHT(N'000' + CAST(@Student01UserId + 600 AS NVARCHAR(10)), 3);
            END;

            INSERT INTO Students (
                UserId, StatusId, StudentCode, FullName, DateOfBirth, Gender,
                Address, PhoneNumber, Email
            )
            SELECT
                u.UserId,
                @DefaultStudentStatusId,
                @Student01Code,
                COALESCE(u.FullName, N'Sinh viên 01'),
                '2004-01-10',
                N'Nam',
                N'Hà Nội',
                u.PhoneNumber,
                u.Email
            FROM Users u
            WHERE u.UserId = @Student01UserId;
        END;
    END;

    -- Seed thêm giáo viên ảo
    DECLARE @TeacherSeed TABLE (
        Username NVARCHAR(50),
        FullName NVARCHAR(100),
        Email NVARCHAR(100),
        PhoneNumber VARCHAR(20),
        TeacherCode NVARCHAR(20),
        FirstName NVARCHAR(50),
        LastName NVARCHAR(50),
        Specialization NVARCHAR(100)
    );

    INSERT INTO @TeacherSeed (Username, FullName, Email, PhoneNumber, TeacherCode, FirstName, LastName, Specialization)
    VALUES
        (N'minh.tt', N'Trần Thanh Minh', N'minh.tt@itcenter.edu', '0901000001', N'GV011', N'Thanh Minh', N'Trần', N'ASP.NET Core, Docker'),
        (N'lan.pt', N'Phạm Thu Lan', N'lan.pt@itcenter.edu', '0901000002', N'GV012', N'Thu Lan', N'Phạm', N'Frontend JavaScript, UI/UX'),
        (N'son.nv', N'Nguyễn Văn Sơn', N'son.nv@itcenter.edu', '0901000003', N'GV013', N'Văn Sơn', N'Nguyễn', N'Python, Data Analysis'),
        (N'giang.ht', N'Hoàng Thị Giang', N'giang.ht@itcenter.edu', '0901000004', N'GV014', N'Thị Giang', N'Hoàng', N'SQL Server, BI');

    DECLARE
        @TUsername NVARCHAR(50),
        @TFullName NVARCHAR(100),
        @TEmail NVARCHAR(100),
        @TPhone VARCHAR(20),
        @TCode NVARCHAR(20),
        @TFirst NVARCHAR(50),
        @TLast NVARCHAR(50),
        @TSpecial NVARCHAR(100),
        @TUserId INT,
        @ResolvedTCode NVARCHAR(20);

    DECLARE teacher_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT Username, FullName, Email, PhoneNumber, TeacherCode, FirstName, LastName, Specialization
        FROM @TeacherSeed;

    OPEN teacher_cursor;
    FETCH NEXT FROM teacher_cursor INTO @TUsername, @TFullName, @TEmail, @TPhone, @TCode, @TFirst, @TLast, @TSpecial;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = @TUsername)
        BEGIN
            INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
            VALUES (@TeacherRoleId, @TUsername, N'123456', @TFullName, @TEmail, @TPhone, N'Active');
        END;

        UPDATE Users
        SET RoleId = @TeacherRoleId,
            FullName = @TFullName,
            Email = @TEmail,
            PhoneNumber = @TPhone,
            Status = N'Active'
        WHERE Username = @TUsername;

        SELECT @TUserId = UserId FROM Users WHERE Username = @TUsername;

        IF NOT EXISTS (SELECT 1 FROM Teachers WHERE UserId = @TUserId)
        BEGIN
            SET @ResolvedTCode = @TCode;
            IF EXISTS (SELECT 1 FROM Teachers WHERE TeacherCode = @ResolvedTCode)
            BEGIN
                SET @ResolvedTCode = N'GV' + RIGHT(N'000' + CAST(@TUserId + 400 AS NVARCHAR(10)), 3);
            END;

            INSERT INTO Teachers (UserId, TeacherCode, FirstName, LastName, Specialization, PhoneNumber, Email)
            VALUES (@TUserId, @ResolvedTCode, @TFirst, @TLast, @TSpecial, @TPhone, @TEmail);
        END;

        FETCH NEXT FROM teacher_cursor INTO @TUsername, @TFullName, @TEmail, @TPhone, @TCode, @TFirst, @TLast, @TSpecial;
    END;

    CLOSE teacher_cursor;
    DEALLOCATE teacher_cursor;

    -- Seed thêm sinh viên ảo
    DECLARE @StudentSeed TABLE (
        Username NVARCHAR(50),
        FullName NVARCHAR(100),
        Email NVARCHAR(100),
        PhoneNumber VARCHAR(20),
        StudentCode NVARCHAR(20),
        DateOfBirth DATE,
        Gender NVARCHAR(10),
        Address NVARCHAR(255)
    );

    INSERT INTO @StudentSeed (Username, FullName, Email, PhoneNumber, StudentCode, DateOfBirth, Gender, Address)
    VALUES
        (N'ngoc.lt', N'Lê Thị Ngọc', N'ngoc.lt@itcenter.edu', '0902000001', N'SV011', '2005-03-20', N'Nữ', N'Hà Nội'),
        (N'khanh.pb', N'Phan Bảo Khánh', N'khanh.pb@itcenter.edu', '0902000002', N'SV012', '2004-12-11', N'Nam', N'Hải Phòng'),
        (N'linh.nt', N'Ngô Thùy Linh', N'linh.nt@itcenter.edu', '0902000003', N'SV013', '2005-05-01', N'Nữ', N'Đà Nẵng'),
        (N'phuc.vm', N'Vũ Minh Phúc', N'phuc.vm@itcenter.edu', '0902000004', N'SV014', '2003-09-17', N'Nam', N'Nam Định'),
        (N'huong.dt', N'Đỗ Thu Hương', N'huong.dt@itcenter.edu', '0902000005', N'SV015', '2005-07-09', N'Nữ', N'Thái Bình'),
        (N'anh.kt', N'Khuất Tuấn Anh', N'anh.kt@itcenter.edu', '0902000006', N'SV016', '2004-04-14', N'Nam', N'Bắc Ninh');

    DECLARE
        @SUsername NVARCHAR(50),
        @SFullName NVARCHAR(100),
        @SEmail NVARCHAR(100),
        @SPhone VARCHAR(20),
        @SCode NVARCHAR(20),
        @SDob DATE,
        @SGender NVARCHAR(10),
        @SAddress NVARCHAR(255),
        @SUserId INT,
        @ResolvedSCode NVARCHAR(20);

    DECLARE student_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT Username, FullName, Email, PhoneNumber, StudentCode, DateOfBirth, Gender, Address
        FROM @StudentSeed;

    OPEN student_cursor;
    FETCH NEXT FROM student_cursor INTO @SUsername, @SFullName, @SEmail, @SPhone, @SCode, @SDob, @SGender, @SAddress;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = @SUsername)
        BEGIN
            INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
            VALUES (@StudentRoleId, @SUsername, N'123456', @SFullName, @SEmail, @SPhone, N'Active');
        END;

        UPDATE Users
        SET RoleId = @StudentRoleId,
            FullName = @SFullName,
            Email = @SEmail,
            PhoneNumber = @SPhone,
            Status = N'Active'
        WHERE Username = @SUsername;

        SELECT @SUserId = UserId FROM Users WHERE Username = @SUsername;

        IF NOT EXISTS (SELECT 1 FROM Students WHERE UserId = @SUserId)
        BEGIN
            SET @ResolvedSCode = @SCode;
            IF EXISTS (SELECT 1 FROM Students WHERE StudentCode = @ResolvedSCode)
            BEGIN
                SET @ResolvedSCode = N'SV' + RIGHT(N'000' + CAST(@SUserId + 700 AS NVARCHAR(10)), 3);
            END;

            INSERT INTO Students (
                UserId, StatusId, StudentCode, FullName, DateOfBirth,
                Gender, Address, PhoneNumber, Email
            )
            VALUES (
                @SUserId, @DefaultStudentStatusId, @ResolvedSCode, @SFullName, @SDob,
                @SGender, @SAddress, @SPhone, @SEmail
            );
        END;

        FETCH NEXT FROM student_cursor INTO @SUsername, @SFullName, @SEmail, @SPhone, @SCode, @SDob, @SGender, @SAddress;
    END;

    CLOSE student_cursor;
    DEALLOCATE student_cursor;

    -- Tạo lớp mẫu cho teacher01 nếu chưa được phân lớp
    DECLARE @Teacher01Id INT = (
        SELECT t.TeacherId
        FROM Teachers t
        INNER JOIN Users u ON t.UserId = u.UserId
        WHERE u.Username = N'teacher01'
    );

    IF @Teacher01Id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM Classes WHERE TeacherId = @Teacher01Id)
    BEGIN
        DECLARE @Teacher01CourseId INT = (
            SELECT TOP 1 CourseId
            FROM Courses
            WHERE CourseCode = N'WEB-API'
            ORDER BY CourseId
        );

        IF @Teacher01CourseId IS NULL
        BEGIN
            SELECT TOP 1 @Teacher01CourseId = CourseId FROM Courses ORDER BY CourseId;
        END;

        IF @Teacher01CourseId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM Classes WHERE ClassCode = N'WEB.TEACHER01.K01')
        BEGIN
            INSERT INTO Classes (CourseId, TeacherId, ClassCode, ClassName, MaxStudents)
            VALUES (
                @Teacher01CourseId,
                @Teacher01Id,
                N'WEB.TEACHER01.K01',
                N'Lớp thực hành teacher01',
                35
            );
        END;
    END;

    -- Tạo thêm ghi danh để các trang Student/Teacher có dữ liệu hiển thị
    DECLARE @EnrollmentSeed TABLE (
        StudentCode NVARCHAR(20),
        ClassCode NVARCHAR(20)
    );

    INSERT INTO @EnrollmentSeed (StudentCode, ClassCode)
    VALUES
        (N'SV006', N'CSHARP.K25.T24'),
        (N'SV011', N'API.K10.T35'),
        (N'SV012', N'PYTHON.K15.T24'),
        (N'SV013', N'REACT.K5.CN'),
        (N'SV014', N'SQL.K20.T7'),
        (N'SV015', N'CSHARP.K25.T24'),
        (N'SV016', N'API.K10.T35'),
        (N'SV006', N'WEB.TEACHER01.K01'),
        (N'SV011', N'WEB.TEACHER01.K01');

    INSERT INTO Enrollments (StudentId, ClassId, EnrollmentDate, Status)
    SELECT
        s.StudentId,
        c.ClassId,
        GETDATE(),
        N'Enrolled'
    FROM @EnrollmentSeed es
    INNER JOIN Students s ON s.StudentCode = es.StudentCode
    INNER JOIN Classes c ON c.ClassCode = es.ClassCode
    LEFT JOIN Enrollments e ON e.StudentId = s.StudentId AND e.ClassId = c.ClassId
    WHERE e.EnrollmentId IS NULL;

    -- Tạo khoản học phí cho mọi enrollment chưa có tuition
    INSERT INTO Tuitions (EnrollmentId, TotalFee, AmountPaid, DueDate, Status)
    SELECT
        e.EnrollmentId,
        co.TuitionFee,
        0,
        DATEADD(DAY, 30, CAST(GETDATE() AS DATE)),
        N'Pending'
    FROM Enrollments e
    INNER JOIN Classes c ON e.ClassId = c.ClassId
    INNER JOIN Courses co ON c.CourseId = co.CourseId
    LEFT JOIN Tuitions tu ON e.EnrollmentId = tu.EnrollmentId
    WHERE tu.EnrollmentId IS NULL;

    COMMIT TRAN;

    PRINT N'Đã thêm dữ liệu ảo giáo viên + học sinh thành công.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;

    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@Err, 16, 1);
END CATCH;
GO

-- Kiểm tra nhanh dữ liệu mới
SELECT TOP 20 u.UserId, u.Username, r.RoleName, u.FullName, u.Email
FROM Users u
LEFT JOIN Roles r ON u.RoleId = r.RoleId
ORDER BY u.UserId DESC;

SELECT TOP 20 TeacherId, UserId, TeacherCode, FirstName, LastName, Email
FROM Teachers
ORDER BY TeacherId DESC;

SELECT TOP 20 StudentId, UserId, StudentCode, FullName, Email
FROM Students
ORDER BY StudentId DESC;
GO
