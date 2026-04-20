--CREATE DATABASE QLSV_TrungTamTinHoc
--GO

IF DB_ID(N'QLSV_TrungTamTinHoc') IS NULL
BEGIN
    CREATE DATABASE QLSV_TrungTamTinHoc;
END
GO

USE QLSV_TrungTamTinHoc;
GO

--USE QLSV_TrungTamTinHoc
--GO

/* ===================================
   PHẦN 1: TẠO CẤU TRÚC (SCHEMA)
   =================================== */

-- Bảng Roles (Vai trò: Admin, Giáo vụ, Giảng viên...)
CREATE TABLE Roles (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE
);
GO

-- Bảng Permissions (Quyền hạn: Xem điểm, Thêm sinh viên...)
CREATE TABLE Permissions (
    PermissionId INT IDENTITY(1,1) PRIMARY KEY,
    PermissionName NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(255)
);
GO

-- Bảng RolePermissions (Bảng nối Nhiều-Nhiều cho Vai trò và Quyền hạn)
CREATE TABLE RolePermissions (
    RoleId INT NOT NULL,
    PermissionId INT NOT NULL,
    PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId)
        REFERENCES Roles(RoleId)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId)
        REFERENCES Permissions(PermissionId)
        ON DELETE CASCADE ON UPDATE NO ACTION
);
GO

-- Bảng Users (Người dùng hệ thống)
CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    RoleId INT,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(256) NOT NULL,
    FullName NVARCHAR(100),
    Email NVARCHAR(100) NOT NULL UNIQUE,
    PhoneNumber VARCHAR(20),
    Status NVARCHAR(20) NOT NULL DEFAULT N'Active',
    DateCreated DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId)
        REFERENCES Roles(RoleId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng ActionLogs (Nhật ký hoạt động của người dùng)
CREATE TABLE ActionLogs (
    LogId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Action NVARCHAR(100) NOT NULL,
    Details NVARCHAR(MAX),
    LogDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_ActionLogs_Users FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
        ON DELETE NO ACTION ON UPDATE NO ACTION -- ĐÃ SỬA TỪ CASCADE
);
GO
-- Bảng Notifications (Thông báo)
CREATE TABLE Notifications (
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,
    CreatorId INT NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX),
    CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (CreatorId)
        REFERENCES Users(UserId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng NotificationRecipients (Bảng nối người nhận thông báo)
CREATE TABLE NotificationRecipients (
    NotificationId INT NOT NULL,
    RecipientId INT NOT NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    PRIMARY KEY (NotificationId, RecipientId),
    CONSTRAINT FK_NotificationRecipients_Notifications FOREIGN KEY (NotificationId)
        REFERENCES Notifications(NotificationId)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT FK_NotificationRecipients_Users FOREIGN KEY (RecipientId)
        REFERENCES Users(UserId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng StudentStatuses (Trạng thái sinh viên: Đang học, Bảo lưu...)
CREATE TABLE StudentStatuses (
    StatusId INT IDENTITY(1,1) PRIMARY KEY,
    StatusName NVARCHAR(50) NOT NULL UNIQUE
);
GO

-- Bảng Students (Sinh viên)
CREATE TABLE Students (
    StudentId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE, -- Liên kết 1-1 với Users (để SV đăng nhập)
    StatusId INT,
    StudentCode NVARCHAR(20) NOT NULL UNIQUE,
    FullName NVARCHAR(100) NOT NULL,
    DateOfBirth DATE,
    Gender NVARCHAR(10),
    Address NVARCHAR(255),
    PhoneNumber VARCHAR(20),
    Email NVARCHAR(100) NOT NULL UNIQUE,
    CONSTRAINT FK_Students_Users FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
        ON DELETE NO ACTION ON UPDATE NO ACTION, -- ĐÃ SỬA TỪ CASCADE
    CONSTRAINT FK_Students_StudentStatuses FOREIGN KEY (StatusId)
        REFERENCES StudentStatuses(StatusId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng Teachers (Giảng viên)
CREATE TABLE Teachers (
    TeacherId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE, -- Liên kết 1-1 với Users (để GV đăng nhập)
    TeacherCode NVARCHAR(20) NOT NULL UNIQUE,
    FirstName NVARCHAR(50) NOT NULL,
    LastName NVARCHAR(50) NOT NULL,
    Specialization NVARCHAR(100),
    PhoneNumber VARCHAR(20),
    Email NVARCHAR(100) NOT NULL UNIQUE,
    CONSTRAINT FK_Teachers_Users FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
        ON DELETE NO ACTION ON UPDATE NO ACTION -- ĐÃ SỬA TỪ CASCADE
);
GO

-- Bảng Courses (Khóa học: Lập trình C#, Mạng CCNA...)
CREATE TABLE Courses (
    CourseId INT IDENTITY(1,1) PRIMARY KEY,
    CourseCode NVARCHAR(20) NOT NULL UNIQUE,
    CourseName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    Duration NVARCHAR(50), -- Ví dụ: '3 tháng', '45 giờ'
    TuitionFee DECIMAL(18, 2) NOT NULL DEFAULT 0,
    Credits INT NULL -- ĐÃ GỘP VÀO ĐÂY
);
GO

-- Bảng Rooms (Phòng học)
CREATE TABLE Rooms (
    RoomId INT IDENTITY(1,1) PRIMARY KEY,
    RoomName NVARCHAR(50) NOT NULL UNIQUE,
    Capacity INT
);
GO

-- Bảng Classes (Lớp học: C# Tối T2-T4, CCNA Sáng T3-T5)
CREATE TABLE Classes (
    ClassId INT IDENTITY(1,1) PRIMARY KEY,
    CourseId INT NOT NULL,
    TeacherId INT,
    ClassCode NVARCHAR(20) NOT NULL UNIQUE,
    ClassName NVARCHAR(100) NOT NULL,
    MaxStudents INT,
    CONSTRAINT FK_Classes_Courses FOREIGN KEY (CourseId)
        REFERENCES Courses(CourseId)
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT FK_Classes_Teachers FOREIGN KEY (TeacherId)
        REFERENCES Teachers(TeacherId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng ClassSchedules (Lịch học cho các lớp)
CREATE TABLE ClassSchedules (
    ScheduleId INT IDENTITY(1,1) PRIMARY KEY,
    ClassId INT NOT NULL,
    RoomId INT,
    Weekday NVARCHAR(20) NOT NULL, -- Ví dụ: 'Monday', 'Tuesday'
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    CONSTRAINT FK_ClassSchedules_Classes FOREIGN KEY (ClassId)
        REFERENCES Classes(ClassId)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT FK_ClassSchedules_Rooms FOREIGN KEY (RoomId)
        REFERENCES Rooms(RoomId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng Enrollments (Ghi danh - Bảng nối Sinh viên và Lớp học)
CREATE TABLE Enrollments (
    EnrollmentId INT IDENTITY(1,1) PRIMARY KEY,
    StudentId INT NOT NULL,
    ClassId INT NOT NULL,
    EnrollmentDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    Status NVARCHAR(20) NOT NULL DEFAULT N'Enrolled', -- Ví dụ: 'Enrolled', 'Completed', 'Dropped'
    CONSTRAINT UQ_Student_Class UNIQUE (StudentId, ClassId), -- Đảm bảo SV chỉ ghi danh 1 lớp 1 lần
    CONSTRAINT FK_Enrollments_Students FOREIGN KEY (StudentId)
        REFERENCES Students(StudentId)
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT FK_Enrollments_Classes FOREIGN KEY (ClassId)
        REFERENCES Classes(ClassId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng Attendances (Điểm danh)
CREATE TABLE Attendances (
    AttendanceId INT IDENTITY(1,1) PRIMARY KEY,
    EnrollmentId INT NOT NULL,
    SessionDate DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL, -- Ví dụ: 'Present', 'Absent', 'Late'
    CONSTRAINT FK_Attendances_Enrollments FOREIGN KEY (EnrollmentId)
        REFERENCES Enrollments(EnrollmentId)
        ON DELETE CASCADE ON UPDATE NO ACTION
);
GO

-- Bảng ScoreTypes (Loại điểm: Chuyên cần, Giữa kỳ, Cuối kỳ)
CREATE TABLE ScoreTypes (
    ScoreTypeId INT IDENTITY(1,1) PRIMARY KEY,
    ScoreTypeName NVARCHAR(50) NOT NULL,
    Weight DECIMAL(5, 2) -- Trọng số (ví dụ: 0.3 cho 30%)
);
GO

-- Bảng Scores (Điểm số của sinh viên)
CREATE TABLE Scores (
    ScoreId INT IDENTITY(1,1) PRIMARY KEY,
    EnrollmentId INT NOT NULL,
    ScoreTypeId INT NOT NULL,
    ScoreValue DECIMAL(5, 2) NOT NULL,
    CONSTRAINT CHK_ScoreValue CHECK (ScoreValue >= 0 AND ScoreValue <= 10), -- ĐÃ SỬA (thêm <= 10)
    CONSTRAINT FK_Scores_Enrollments FOREIGN KEY (EnrollmentId)
        REFERENCES Enrollments(EnrollmentId)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT FK_Scores_ScoreTypes FOREIGN KEY (ScoreTypeId)
        REFERENCES ScoreTypes(ScoreTypeId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng Tuitions (Học phí cần thu)
CREATE TABLE Tuitions (
    TuitionId INT IDENTITY(1,1) PRIMARY KEY,
    EnrollmentId INT NOT NULL,
    TotalFee DECIMAL(18, 2) NOT NULL,
    AmountPaid DECIMAL(18, 2) NOT NULL DEFAULT 0,
    DueDate DATE,
    Status NVARCHAR(20) NOT NULL DEFAULT N'Pending', -- Ví dụ: 'Pending', 'Paid', 'Overdue'
    CONSTRAINT FK_Tuitions_Enrollments FOREIGN KEY (EnrollmentId)
        REFERENCES Enrollments(EnrollmentId)
        ON DELETE CASCADE ON UPDATE NO ACTION
);
GO

-- Bảng Receipts (Biên lai thu tiền)
CREATE TABLE Receipts (
    ReceiptId INT IDENTITY(1,1) PRIMARY KEY,
    TuitionId INT NOT NULL,
    CashierId INT NOT NULL,
    ReceiptCode NVARCHAR(50) NOT NULL UNIQUE,
    Amount DECIMAL(18, 2) NOT NULL,
    PaymentDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    Note NVARCHAR(500),
    CONSTRAINT FK_Receipts_Tuitions FOREIGN KEY (TuitionId)
        REFERENCES Tuitions(TuitionId)
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT FK_Receipts_Users FOREIGN KEY (CashierId)
        REFERENCES Users(UserId)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO

-- Bảng Reports (Báo cáo)
CREATE TABLE Reports (
    ReportId INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- Bảng HomeNotices (Thông báo trang chủ)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='HomeNotices' and xtype='U')
BEGIN
    CREATE TABLE HomeNotices (
        NoticeId INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        Content NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT N'Đã tạo bảng HomeNotices.';
END
ELSE
BEGIN
    PRINT N'Bảng HomeNotices đã tồn tại.';
END
GO

-- Bảng FeaturedTeachers (Giảng viên nổi bật trên trang chủ)
CREATE TABLE FeaturedTeachers (
    FeaturedId INT IDENTITY(1,1) PRIMARY KEY,
    TeacherId INT NULL,                    
    Title NVARCHAR(200) NOT NULL,
    Summary NVARCHAR(MAX) NULL,
    ImagePath NVARCHAR(500) NULL,
    SortOrder INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_FeaturedTeachers_Teachers FOREIGN KEY (TeacherId)
        REFERENCES Teachers(TeacherId)
        ON DELETE SET NULL ON UPDATE NO ACTION -- Dùng SET NULL là rất tốt
);
GO