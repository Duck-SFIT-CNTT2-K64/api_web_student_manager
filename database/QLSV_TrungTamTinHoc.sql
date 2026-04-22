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

/* ================================================================================
 NHÓM 1: CÁC BẢNG DỮ LIỆU "DANH MỤC" (Bảng gốc)
================================================================================
*/

-- 1. Bảng Roles (Vai trò)
SET IDENTITY_INSERT Roles ON;
INSERT INTO Roles (RoleId, RoleName) VALUES
(1, N'Admin'),
(2, N'Teacher'),
(3, N'Student');
SET IDENTITY_INSERT Roles OFF;
GO

-- 2. Bảng Permissions (Quyền hạn)
SET IDENTITY_INSERT Permissions ON;
INSERT INTO Permissions (PermissionId, PermissionName, Description) VALUES
(1, N'ManageStudents', N'Quản lý thông tin sinh viên'),
(2, N'ManageTeachers', N'Quản lý thông tin giảng viên'),
(3, N'ManageClasses', N'Quản lý lớp học và khóa học'),
(4, N'EnterScores', N'Nhập/sửa điểm số'),
(5, N'ViewReports', N'Xem báo cáo thống kê'),
(6, N'ManageTuition', N'Quản lý học phí và biên lai'),
(7, N'ManageSystem', N'Quản lý người dùng và phân quyền');
SET IDENTITY_INSERT Permissions OFF;
GO

-- 3. Bảng RolePermissions (Phân quyền cho vai trò)
INSERT INTO RolePermissions (RoleId, PermissionId) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7),
(2, 1), (2, 2), (2, 3), (2, 5),
(3, 4), (3, 5);
GO

-- 4. Bảng StudentStatuses (Trạng thái sinh viên)
SET IDENTITY_INSERT StudentStatuses ON;
INSERT INTO StudentStatuses (StatusId, StatusName) VALUES
(1, N'Đang học'),
(2, N'Bảo lưu'),
(3, N'Đã tốt nghiệp'),
(4, N'Đã nghỉ học');
SET IDENTITY_INSERT StudentStatuses OFF;
GO

-- 5. Bảng Courses (Khóa học) - ĐÃ CẬP NHẬT THÊM CỘT 'Credits'
SET IDENTITY_INSERT Courses ON;
INSERT INTO Courses (CourseId, CourseCode, CourseName, Description, Duration, TuitionFee, Credits) VALUES
(1, N'CSHARP-WF', N'Lập trình C# WinForms', N'Khóa học nền tảng C# và WinForms.', N'3 tháng', 3500000, 3),
(2, N'WEB-API', N'Xây dựng Web API với .NET', N'Phát triển RESTful API chuyên nghiệp.', N'2 tháng', 4000000, 4),
(3, N'PYTHON-AI', N'Lập trình Python và AI', N'Nhập môn AI và Machine Learning.', N'4 tháng', 6000000, 4),
(4, N'SQL-ADV', N'Quản trị CSDL SQL Server', N'Nâng cao kỹ năng T-SQL và quản trị.', N'2 tháng', 3000000, 2),
(5, N'FE-REACT', N'Thiết kế Web Frontend React', N'Xây dựng giao diện web hiện đại.', N'3 tháng', 4500000, 3);
SET IDENTITY_INSERT Courses OFF;
GO

-- 6. Bảng Rooms (Phòng học)
SET IDENTITY_INSERT Rooms ON;
INSERT INTO Rooms (RoomId, RoomName, Capacity) VALUES
(1, N'Phòng Lab 101', 30),
(2, N'Phòng Lab 102', 30),
(3, N'Phòng lý thuyết 201', 50),
(4, N'Phòng máy 202', 40);
SET IDENTITY_INSERT Rooms OFF;
GO

-- 7. Bảng ScoreTypes (Loại điểm)
SET IDENTITY_INSERT ScoreTypes ON;
INSERT INTO ScoreTypes (ScoreTypeId, ScoreTypeName, Weight) VALUES
(1, N'Chuyên cần', 0.1),
(2, N'Giữa kỳ', 0.3),
(3, N'Cuối kỳ', 0.6);
SET IDENTITY_INSERT ScoreTypes OFF;
GO

/* ================================================================================
 NHÓM 2: TÀI KHOẢN VÀ CÁC ĐỐI TƯỢNG NGƯỜI DÙNG
 (Mật khẩu mặc định cho tất cả là '123456'. 
 Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.)
================================================================================
*/

-- 8. Bảng Users (Người dùng)
SET IDENTITY_INSERT Users ON;
INSERT INTO Users (UserId, RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status) VALUES
(1, 1, N'admin', N'admin@123', N'Bùi Hải Đức', N'duc.bh@itcenter.edu', '0911111111', N'Active'),
(2, 2, N'teacher01', N'teacher@123', N'Hoàng Quốc Anh', N'giaovu@itcenter.edu', '0922222222', N'Active'),
(3, 3, N'student01', N'student@123', N'Đinh Quang Hưng', N'ketoan@itcenter.edu', '0933333333', N'Active'),
-- Giảng viên (Mới thêm - Khớp với TeacherId 1 và 2)
(4, 2, N'hung.dq', N'123456', N'Đinh Quang Hưng', N'hung.dq@itcenter.edu', '0944444444', N'Active'),
(5, 2, N'anh.dh', N'1234567', N'Hoàng Quốc Anh', N'huy.dh@itcenter.edu', '0955555555', N'Active'),

-- Sinh viên (Mới thêm - Khớp với StudentId từ 1 đến 5)
(6, 3, N'tien.nm', N'345678', N'Nguyễn Mạnh Tiến', N'tien.nm@itcenter.edu', '0966666666', N'Active'),
(7, 3, N'a.nv', N'3456', N'Nguyễn Văn A', N'a.nv@itcenter.edu', '0977777777', N'Active'),
(8, 3, N'b.tt', N'2203', N'Trần Thị B', N'b.tt@itcenter.edu', '0988888888', N'Active'),
(9, 3, N'c.lm', N'73647', N'Lê Minh C', N'c.lm@itcenter.edu', '0999999999', N'Active'),
(10, 3, N'd.ph', N'93843', N'Phạm Hoàng D', N'd.ph@itcenter.edu', '0912345678', N'Active');
SET IDENTITY_INSERT Users OFF;
GO

-- 9. Bảng ActionLogs (Nhật ký)
INSERT INTO ActionLogs (UserId, Action, Details, LogDate) VALUES
(1, N'Login', N'Admin đăng nhập thành công', '2025-10-25 08:00:00'),
(2, N'Create Student', N'Giáo vụ thêm sinh viên Nguyễn Văn A', '2025-10-25 09:15:00');
GO

-- 10. Bảng Students (Thông tin chi tiết của Sinh viên)
SET IDENTITY_INSERT Students ON;
INSERT INTO Students (StudentId, UserId, StatusId, StudentCode, FullName, DateOfBirth, Gender, Address, PhoneNumber, Email) VALUES
(1, 6, 1, N'SV001', N'Nguyễn Mạnh Tiến', '2004-10-20', N'Nam', N'123 Hà Nội', '0966666666', N'tien.nm@itcenter.edu'),
(2, 7, 1, N'SV002', N'Nguyễn Văn A', '2003-05-15', N'Nam', N'456 Hưng Yên', '0977777777', N'a.nv@itcenter.edu'),
(3, 8, 1, N'SV003', N'Trần Thị B', '2004-02-10', N'Nữ', N'789 Hải Dương', '0988888888', N'b.tt@itcenter.edu'),
(4, 9, 2, N'SV004', N'Lê Minh C', '2002-11-30', N'Nam', N'101 Nam Định', '0999999999', N'c.lm@itcenter.edu'),
(5, 10, 1, N'SV005', N'Phạm Hoàng D', '2004-07-07', N'Nữ', N'202 Thái Bình', '0912345678', N'd.ph@itcenter.edu'),
(6, 3, 1, N'SV006', N'Đinh Quang Hưng', '2004-01-10', N'Nam', N'Hưng Yên', '0933333333', N'ketoan@itcenter.edu');
SET IDENTITY_INSERT Students OFF;
GO

-- 11. Bảng Teachers (Thông tin chi tiết của Giảng viên)
SET IDENTITY_INSERT Teachers ON;
INSERT INTO Teachers (TeacherId, UserId, TeacherCode, FirstName, LastName, Specialization, PhoneNumber, Email) VALUES
(3, 2, N'GV003', N'Quốc Anh', N'Hoàng', N'Tin học văn phòng, Cơ sở dữ liệu', '0922222222', N'giaovu@itcenter.edu'),
(1, 4, N'GV001', N'Quang Hưng', N'Đinh', N'Lập trình .NET, Web API', '0944444444', N'hung.dq@itcenter.edu'),
(2, 5, N'GV002', N'Hoàng Huy', N'Đặng', N'Python, AI, SQL Server', '0955555555', N'huy.dh@itcenter.edu');
SET IDENTITY_INSERT Teachers OFF;
GO

/* ================================================================================
 NHÓM 3: NGHIỆP VỤ LỚP HỌC VÀ LỊCH HỌC
================================================================================
*/

-- 12. Bảng Classes (Lớp học)
SET IDENTITY_INSERT Classes ON;
INSERT INTO Classes (ClassId, CourseId, TeacherId, ClassCode, ClassName, MaxStudents) VALUES
(1, 1, 1, N'CSHARP.K25.T24', N'C# WinForms Tối 2-4 K25', 30),
(2, 2, 1, N'API.K10.T35', N'Web API .NET Tối 3-5 K10', 30),
(3, 3, 2, N'PYTHON.K15.T24', N'Python AI Tối 2-4 K15', 30),
(4, 4, 2, N'SQL.K20.T7', N'SQL Server Sáng T7 K20', 40),
(5, 5, 1, N'REACT.K5.CN', N'ReactJS Chiều CN K5', 30);
SET IDENTITY_INSERT Classes OFF;
GO

-- 13. Bảng ClassSchedules (Lịch học chi tiết)
INSERT INTO ClassSchedules (ClassId, RoomId, Weekday, StartTime, EndTime) VALUES
(1, 1, N'Tuesday', '18:00:00', '20:30:00'),
(1, 1, N'Thursday', '18:00:00', '20:30:00'),
(2, 2, N'Wednesday', '18:00:00', '20:30:00'),
(2, 2, N'Friday', '18:00:00', '20:30:00'),
(3, 1, N'Tuesday', '18:30:00', '21:00:00'),
(3, 1, N'Thursday', '18:30:00', '21:00:00'),
(4, 4, N'Saturday', '08:30:00', '11:30:00'),
(5, 2, N'Sunday', '14:00:00', '17:00:00');
GO

/* ================================================================================
 NHÓM 4: NGHIỆP VỤ CỐT LÕI (GHI DANH, ĐIỂM, HỌC PHÍ)
================================================================================
*/

-- 14. Bảng Enrollments (Ghi danh)
SET IDENTITY_INSERT Enrollments ON;
INSERT INTO Enrollments (EnrollmentId, StudentId, ClassId, EnrollmentDate, Status) VALUES
(1, 1, 1, '2025-09-01 09:00:00', N'Enrolled'),
(2, 1, 2, '2025-09-01 09:05:00', N'Enrolled'),
(3, 2, 1, '2025-09-02 10:00:00', N'Enrolled'),
(4, 2, 4, '2025-09-02 10:01:00', N'Enrolled'),
(5, 3, 3, '2025-09-03 14:00:00', N'Enrolled'),
(6, 3, 5, '2025-09-03 14:02:00', N'Enrolled'),
(7, 4, 4, '2025-09-04 11:00:00', N'Dropped'),
(8, 5, 3, '2025-09-05 15:00:00', N'Enrolled');
SET IDENTITY_INSERT Enrollments OFF;
GO

-- 15. Bảng Attendances (Điểm danh)
INSERT INTO Attendances (EnrollmentId, SessionDate, Status) VALUES
(1, '2025-09-10', N'Present'),
(1, '2025-09-12', N'Present'),
(1, '2025-09-17', N'Absent'),
(1, '2025-09-19', N'Present'),
(3, '2025-09-10', N'Present'),
(3, '2025-09-12', N'Late'),
(3, '2025-09-17', N'Present'),
(3, '2025-09-19', N'Present');
GO

-- 16. Bảng Scores (Điểm số)
INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue) VALUES
(1, 1, 9.0),  
(1, 2, 8.5), 
(1, 3, 8.0), 
(3, 1, 10.0),
(3, 2, 7.0), 
(3, 3, 7.5), 
(5, 1, 8.0), 
(5, 2, 8.5), 
(5, 3, 9.0), 
(8, 1, 7.0), 
(8, 2, 6.0), 
(8, 3, 5.0); 
GO

-- 17. Bảng Tuitions (Học phí)
SET IDENTITY_INSERT Tuitions ON;
INSERT INTO Tuitions (TuitionId, EnrollmentId, TotalFee, AmountPaid, DueDate, Status) VALUES
(1, 1, 3500000, 3500000, '2025-09-15', N'Paid'),
(2, 2, 4000000, 2000000, '2025-09-15', N'Pending'),
(3, 3, 3500000, 3500000, '2025-09-15', N'Paid'),
(4, 4, 3000000, 0, '2025-09-15', N'Pending'),
(5, 5, 6000000, 6000000, '2025-09-15', N'Paid'),
(6, 6, 4500000, 4500000, '2025-09-15', N'Paid'),
(7, 7, 3000000, 0, '2025-09-15', N'Pending'),
(8, 8, 6000000, 3000000, '2025-09-15', N'Pending');
SET IDENTITY_INSERT Tuitions OFF;
GO

-- 18. Bảng Receipts (Biên lai thu tiền)
INSERT INTO Receipts (TuitionId, CashierId, ReceiptCode, Amount, PaymentDate, Note) VALUES
(1, 3, N'BL0001', 3500000, '2025-09-01 09:01:00', N'Thu học phí C# cho SV001'),
(2, 3, N'BL0002', 2000000, '2025-09-01 09:06:00', N'Thu học phí API (đợt 1) cho SV001'),
(3, 3, N'BL0003', 3500000, '2025-09-02 10:00:30', N'Thu học phí C# cho SV002'),
(5, 3, N'BL0004', 6000000, '2025-09-03 14:01:00', N'Thu học phí Python cho SV003'),
(6, 3, N'BL0005', 4500000, '2025-09-03 14:03:00', N'Thu học phí React cho SV003'),
(8, 3, N'BL0006', 3000000, '2025-09-05 15:01:00', N'Thu học phí Python (đợt 1) cho SV005');
GO

/* ================================================================================
 NHÓM 5: NGHIỆP VỤ THÔNG BÁO
================================================================================
*/

-- 19. Bảng Notifications (Tạo thông báo)
SET IDENTITY_INSERT Notifications ON;
INSERT INTO Notifications (NotificationId, CreatorId, Title, Content, CreatedDate) VALUES
(1, 1, N'Chào mừng thành viên mới!', N'Chào mừng các bạn đến với Trung tâm Tin học!', '2025-09-01 08:00:00'),
(2, 2, N'Lịch nghỉ lễ Quốc Khánh', N'Trung tâm thông báo nghỉ lễ 2/9. Lịch học bù sẽ được thông báo sau.', '2025-08-30 10:00:00');
SET IDENTITY_INSERT Notifications OFF;
GO

-- 20. Bảng NotificationRecipients (Gửi thông báo)
INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead) VALUES
(1, 1, 1), (1, 2, 1), (1, 3, 1), (1, 4, 1), (1, 5, 1), (1, 6, 1), (1, 7, 0), (1, 8, 0), (1, 9, 0), (1, 10, 0),
(2, 4, 1), (2, 5, 1), (2, 6, 1), (2, 7, 1), (2, 8, 1), (2, 9, 0), (2, 10, 0);
GO

-- 21. Bảng Exams
CREATE TABLE Exams (
    ExamId        INT IDENTITY(1,1) PRIMARY KEY,
    ClassId       INT NOT NULL,
    UserId        INT NOT NULL,      
    Title         NVARCHAR(255) NOT NULL,
    ExamType      NVARCHAR(50) NOT NULL
                  DEFAULT N'Trắc nghiệm',
    Description   NVARCHAR(MAX) NULL,
    DueDate       DATETIME NOT NULL,
    CreatedDate   DATETIME DEFAULT GETDATE(),
    Status        NVARCHAR(20) DEFAULT N'Active',

    CONSTRAINT FK_Exams_Class    FOREIGN KEY (ClassId) REFERENCES Classes(ClassId),
    CONSTRAINT FK_Exams_User     FOREIGN KEY (UserId)  REFERENCES Users(UserId)
);

-- 22. Bảng ExamSubmissions (Nộp bài thi)
CREATE TABLE ExamSubmissions (
    SubmissionId  INT IDENTITY(1,1) PRIMARY KEY,
    ExamId        INT NOT NULL,
    EnrollmentId  INT NOT NULL,
    SubmittedAt   DATETIME NULL,
    FileUrl       NVARCHAR(500) NULL,
    Note          NVARCHAR(MAX) NULL,
    Grade         DECIMAL(4,1) NULL,
    Status        NVARCHAR(20) DEFAULT N'Pending',

    CONSTRAINT FK_Submissions_Exam        FOREIGN KEY (ExamId)       REFERENCES Exams(ExamId),
    CONSTRAINT FK_Submissions_Enrollment  FOREIGN KEY (EnrollmentId) REFERENCES Enrollments(EnrollmentId),
    CONSTRAINT UQ_Submission UNIQUE (ExamId, EnrollmentId)
);

/* ================================================================================
 NHÓM 6: CÁC BẢNG GIAO DIỆN (Trang chủ)
================================================================================
*/

-- 21. Bảng HomeNotices (Thông báo trang chủ - Mới)
INSERT INTO HomeNotices (Title, Content, CreatedAt) VALUES
(N'Khai giảng khóa Lập trình C# WinForms K26', N'Đăng ký ngay để nhận ưu đãi 15% học phí. Chỉ còn 5 suất cuối cùng!', '2025-10-20 10:00:00'),
(N'Workshop: Xây dựng AI với Python', N'Diễn giả Đặng Hoàng Huy. Thời gian: 9:00 Sáng Chủ Nhật tuần này. Đăng ký tham gia miễn phí.', '2025-10-22 14:30:00'),
(N'Thông báo Lịch học bù', N'Lớp API.K10.T35 sẽ học bù vào tối Thứ 7 tuần này (25/10) tại phòng Lab 102.', '2025-10-23 11:00:00');
GO

-- 22. Bảng FeaturedTeachers (Mục nổi bật - Đã di chuyển từ schema)
INSERT INTO FeaturedTeachers (TeacherId, Title, Summary, ImagePath, SortOrder, IsActive)
VALUES
(1, N'Đinh Quang Hưng', N'Chuyên gia hàng đầu về .NET và Web API. Với hơn 10 năm kinh nghiệm...', N'/Images/hung_quang.png', 1, 1),
(2, N'Đặng Hoàng Huy', N'Nhà vô địch Olympic Tin học, chuyên sâu về Python, AI và SQL Server.', N'/Images/dang_huy.png', 2, 1),
(NULL, N'Bùi Hải Đức', N'Người đặt nền móng cho Trung tâm, với tầm nhìn mang công nghệ chất lượng cao...', N'/Images/duc_1.png', 3, 1),
(NULL, N'Nguyễn Mạnh Tiến', N'Câu chuyện thành công: Từ sinh viên trái ngành đến lập trình viên Full-stack...', N'/Images/tien.png', 4, 1),
(NULL, N'Học viên đầu trọc', N'Đăng ký ngay để nhận ưu đãi 20% học phí. Xây dựng giao diện web...', N'/Images/huy_dau_troc.jpg', 5, 1),
(NULL, N'Cô Hường xinh đẹp', N'Cảm ơn cô đã dạy chúng em ạaaaaaaa, chúc cô luôn xinh đẹp và gặt hái được nhiều thành công hehe', N'/Images/co_huong.jpg', 6, 1); 
GO

-- 23. Bảng Reports (Báo cáo - Mới)
INSERT INTO Reports (Title, Description, CreatedAt) VALUES
(N'Báo cáo Doanh thu Tháng 09/2025', N'Tổng doanh thu: 24,500,000 VND. Tỷ lệ hoàn thành học phí: 75%.', '2025-10-01 10:00:00'),
(N'Báo cáo Tuyển sinh Khóa K25', N'Tổng số học viên mới: 85. Khóa học được quan tâm nhất: Python AI.', '2025-10-02 11:00:00');
GO

/* ================================================================================
 NHÓM 7: DỮ LIỆU MỞ RỘNG (gộp từ seed_mock_teachers_students.sql)
================================================================================
*/

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

-- Thêm bài kiểm tra mẫu (giả sử ClassId 1,2 và UserId của giảng viên là 2)
INSERT INTO Exams (ClassId, UserId, Title, ExamType, Description, DueDate, Status)
VALUES
    (1, 2, N'Kiểm tra giữa kỳ', N'Tự luận', 
     N'Kiểm tra chương 1 đến chương 3. Sinh viên cần ôn tập kỹ lý thuyết.', 
     '2025-11-15 23:59:00', N'Active'),
    (1, 2, N'Bài tập tuần 3', N'Tự luận', 
     N'Làm bài tập chương 2, nộp file PDF.', 
     '2025-10-20 23:59:00', N'Closed'),
    (2, 2, N'Kiểm tra trắc nghiệm chương 1', N'Trắc nghiệm', 
     N'30 câu trắc nghiệm, thời gian 45 phút.', 
     '2025-11-01 10:00:00', N'Active');

-- Thêm submissions mẫu
INSERT INTO ExamSubmissions (ExamId, EnrollmentId, SubmittedAt, Note, Grade, Status)
VALUES
    (1, 1, '2025-11-14 20:30:00', N'Em nộp bài ạ.', 8.5, N'Graded'),
    (1, 2, '2025-11-15 18:00:00', N'Bài làm của em.', NULL, N'Submitted'),
    (2, 1, '2025-10-19 22:00:00', NULL, 9.0, N'Graded');

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

/* ================================================================================
 NHÓM 8: DỮ LIỆU MẪU QUY MÔ LỚN (gộp từ seed_bulk_data.sql)
 ---------------------------------------------------------------------------------
 Thêm 15 giáo viên + 35 sinh viên, kèm dữ liệu đầy đủ cho TẤT CẢ các bảng
 nghiệp vụ: Users, Teachers, Students, Courses, Rooms, Classes, ClassSchedules,
 Enrollments, Attendances, Scores, Tuitions, Receipts, Notifications,
 NotificationRecipients, ActionLogs, Exams, ExamSubmissions, HomeNotices,
 FeaturedTeachers, Reports.

 Đặc tính: idempotent (có thể chạy lại), transaction + TRY/CATCH, rollback nếu lỗi.
 ================================================================================
*/
BEGIN TRY
    BEGIN TRAN;

    DECLARE @BulkRoleTeacher  INT = (SELECT TOP 1 RoleId FROM Roles WHERE RoleName = N'Teacher');
    DECLARE @BulkRoleStudent  INT = (SELECT TOP 1 RoleId FROM Roles WHERE RoleName = N'Student');
    DECLARE @BulkRoleAdmin    INT = (SELECT TOP 1 RoleId FROM Roles WHERE RoleName = N'Admin');

    DECLARE @BulkStActive     INT = (SELECT TOP 1 StatusId FROM StudentStatuses WHERE StatusName = N'Đang học');

    DECLARE @BulkScCC INT = (SELECT TOP 1 ScoreTypeId FROM ScoreTypes WHERE ScoreTypeName = N'Chuyên cần');
    DECLARE @BulkScGK INT = (SELECT TOP 1 ScoreTypeId FROM ScoreTypes WHERE ScoreTypeName = N'Giữa kỳ');
    DECLARE @BulkScCK INT = (SELECT TOP 1 ScoreTypeId FROM ScoreTypes WHERE ScoreTypeName = N'Cuối kỳ');

    DECLARE @BulkCashierId INT = (
        SELECT TOP 1 UserId FROM Users
        WHERE Username IN (N'admin', N'admin_test')
           OR RoleId = @BulkRoleAdmin
        ORDER BY CASE WHEN Username = N'admin' THEN 0
                      WHEN Username = N'admin_test' THEN 1
                      ELSE 2 END, UserId
    );

    IF @BulkRoleTeacher IS NULL OR @BulkRoleStudent IS NULL OR @BulkStActive IS NULL
        OR @BulkScCC IS NULL OR @BulkScGK IS NULL OR @BulkScCK IS NULL OR @BulkCashierId IS NULL
    BEGIN
        RAISERROR(N'Thiếu dữ liệu danh mục cho NHÓM 8 (Roles/Statuses/ScoreTypes/Admin).', 16, 1);
    END;

    /* ---- STEP 1: Mở rộng danh mục Courses & Rooms ---- */
    IF NOT EXISTS (SELECT 1 FROM Courses WHERE CourseCode = N'JAVA-ENT')
        INSERT INTO Courses (CourseCode, CourseName, Description, Duration, TuitionFee, Credits)
        VALUES (N'JAVA-ENT', N'Lập trình Java Enterprise', N'Spring Boot, Microservices, JPA.', N'4 tháng', 5500000, 4);
    IF NOT EXISTS (SELECT 1 FROM Courses WHERE CourseCode = N'DOCKER-K8S')
        INSERT INTO Courses (CourseCode, CourseName, Description, Duration, TuitionFee, Credits)
        VALUES (N'DOCKER-K8S', N'DevOps với Docker & Kubernetes', N'Container hoá ứng dụng và orchestration.', N'2 tháng', 4200000, 3);
    IF NOT EXISTS (SELECT 1 FROM Courses WHERE CourseCode = N'MOB-FLUTTER')
        INSERT INTO Courses (CourseCode, CourseName, Description, Duration, TuitionFee, Credits)
        VALUES (N'MOB-FLUTTER', N'Lập trình Mobile với Flutter', N'Xây dựng app đa nền tảng iOS & Android.', N'3 tháng', 4800000, 3);
    IF NOT EXISTS (SELECT 1 FROM Courses WHERE CourseCode = N'CYBER-SEC')
        INSERT INTO Courses (CourseCode, CourseName, Description, Duration, TuitionFee, Credits)
        VALUES (N'CYBER-SEC', N'An toàn thông tin & Pentest', N'Nền tảng bảo mật mạng, ethical hacking.', N'3 tháng', 5200000, 3);
    IF NOT EXISTS (SELECT 1 FROM Courses WHERE CourseCode = N'DATA-SCI')
        INSERT INTO Courses (CourseCode, CourseName, Description, Duration, TuitionFee, Credits)
        VALUES (N'DATA-SCI', N'Data Science & Phân tích dữ liệu', N'Pandas, NumPy, trực quan hoá, ML cơ bản.', N'3 tháng', 5000000, 3);

    IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomName = N'Phòng Lab 103') INSERT INTO Rooms (RoomName, Capacity) VALUES (N'Phòng Lab 103', 30);
    IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomName = N'Phòng Lab 104') INSERT INTO Rooms (RoomName, Capacity) VALUES (N'Phòng Lab 104', 30);
    IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomName = N'Phòng Hội thảo 301') INSERT INTO Rooms (RoomName, Capacity) VALUES (N'Phòng Hội thảo 301', 60);
    IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomName = N'Phòng Online A') INSERT INTO Rooms (RoomName, Capacity) VALUES (N'Phòng Online A', 100);

    /* ---- STEP 2: Seed 15 Teachers ---- */
    DECLARE @BulkTeacherSeed TABLE (
        Username NVARCHAR(50), FullName NVARCHAR(100), Email NVARCHAR(100),
        PhoneNumber VARCHAR(20), TeacherCode NVARCHAR(20),
        FirstName NVARCHAR(50), LastName NVARCHAR(50), Specialization NVARCHAR(100)
    );

    INSERT INTO @BulkTeacherSeed VALUES
        (N'nhung.bth', N'Bùi Thị Hồng Nhung', N'nhung.bth@itcenter.edu', '0903000001', N'GV020', N'Hồng Nhung', N'Bùi', N'Java Enterprise, Spring Boot'),
        (N'dung.tq',   N'Trần Quang Dũng',    N'dung.tq@itcenter.edu',   '0903000002', N'GV021', N'Quang Dũng', N'Trần', N'DevOps, Docker, Kubernetes'),
        (N'huyen.ln',  N'Lê Ngọc Huyền',      N'huyen.ln@itcenter.edu',  '0903000003', N'GV022', N'Ngọc Huyền', N'Lê',   N'UI/UX, Figma, Product Design'),
        (N'thang.pv',  N'Phan Văn Thắng',     N'thang.pv@itcenter.edu',  '0903000004', N'GV023', N'Văn Thắng',  N'Phan', N'Cybersecurity, Pentest'),
        (N'nam.dh',    N'Đỗ Hoàng Nam',       N'nam.dh@itcenter.edu',    '0903000005', N'GV024', N'Hoàng Nam',  N'Đỗ',   N'Cloud AWS, Azure'),
        (N'anh.vm',    N'Vũ Mai Anh',         N'anh.vm@itcenter.edu',    '0903000006', N'GV025', N'Mai Anh',    N'Vũ',   N'Mobile iOS, Swift'),
        (N'khanh.nq',  N'Nguyễn Quốc Khánh',  N'khanh.nq@itcenter.edu',  '0903000007', N'GV026', N'Quốc Khánh', N'Nguyễn', N'Mobile Android, Kotlin'),
        (N'trang.tt',  N'Trịnh Thu Trang',    N'trang.tt@itcenter.edu',  '0903000008', N'GV027', N'Thu Trang',  N'Trịnh', N'Data Science, Pandas'),
        (N'duc.hm',    N'Hoàng Minh Đức',     N'duc.hm@itcenter.edu',    '0903000009', N'GV028', N'Minh Đức',   N'Hoàng', N'Machine Learning, Deep Learning'),
        (N'tuan.pv',   N'Phạm Văn Tuấn',      N'tuan.pv@itcenter.edu',   '0903000010', N'GV029', N'Văn Tuấn',   N'Phạm', N'Blockchain, Solidity'),
        (N'anh.ntl',   N'Ngô Thị Lan Anh',    N'anh.ntl@itcenter.edu',   '0903000011', N'GV030', N'Lan Anh',    N'Ngô',  N'Business Analyst, Agile'),
        (N'phuc.lh',   N'Lý Hoàng Phúc',      N'phuc.lh@itcenter.edu',   '0903000012', N'GV031', N'Hoàng Phúc', N'Lý',   N'Game Development, Unity'),
        (N'chau.db',   N'Đặng Bảo Châu',      N'chau.db@itcenter.edu',   '0903000013', N'GV032', N'Bảo Châu',   N'Đặng', N'QA, Automation Testing'),
        (N'mai.ctn',   N'Cao Thị Ngọc Mai',   N'mai.ctn@itcenter.edu',   '0903000014', N'GV033', N'Ngọc Mai',   N'Cao',  N'Database Admin, Oracle'),
        (N'tri.vd',    N'Võ Đức Trí',         N'tri.vd@itcenter.edu',    '0903000015', N'GV034', N'Đức Trí',    N'Võ',   N'Networking Cisco, CCNA');

    INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
    SELECT @BulkRoleTeacher, ts.Username, N'123456', ts.FullName, ts.Email, ts.PhoneNumber, N'Active'
    FROM @BulkTeacherSeed ts
    WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username = ts.Username);

    INSERT INTO Teachers (UserId, TeacherCode, FirstName, LastName, Specialization, PhoneNumber, Email)
    SELECT u.UserId, ts.TeacherCode, ts.FirstName, ts.LastName, ts.Specialization, ts.PhoneNumber, ts.Email
    FROM @BulkTeacherSeed ts
    INNER JOIN Users u ON u.Username = ts.Username
    WHERE NOT EXISTS (SELECT 1 FROM Teachers t WHERE t.UserId = u.UserId)
      AND NOT EXISTS (SELECT 1 FROM Teachers t2 WHERE t2.TeacherCode = ts.TeacherCode);

    /* ---- STEP 3: Seed 35 Students (xen kẽ 4 trạng thái) ---- */
    DECLARE @BulkStudentSeed TABLE (
        Username NVARCHAR(50), FullName NVARCHAR(100), Email NVARCHAR(100),
        PhoneNumber VARCHAR(20), StudentCode NVARCHAR(20),
        DateOfBirth DATE, Gender NVARCHAR(10), Address NVARCHAR(255),
        StatusName NVARCHAR(50)
    );

    INSERT INTO @BulkStudentSeed VALUES
        (N'khoa.tm',    N'Trần Minh Khoa',          N'khoa.tm@itcenter.edu',    '0904000001', N'SV020', '2004-03-12', N'Nam', N'15 Láng Hạ, Hà Nội',             N'Đang học'),
        (N'thu.la',     N'Lê Anh Thư',              N'thu.la@itcenter.edu',     '0904000002', N'SV021', '2005-06-02', N'Nữ',  N'48 Nguyễn Trãi, Thanh Xuân',     N'Đang học'),
        (N'bao.pq',     N'Phạm Quốc Bảo',           N'bao.pq@itcenter.edu',     '0904000003', N'SV022', '2003-11-20', N'Nam', N'32 Lê Lợi, Hải Phòng',           N'Đang học'),
        (N'han.hg',     N'Hoàng Gia Hân',           N'han.hg@itcenter.edu',     '0904000004', N'SV023', '2005-02-25', N'Nữ',  N'9 Trần Phú, Nha Trang',          N'Đang học'),
        (N'nam.vt',     N'Vũ Tuấn Nam',             N'nam.vt@itcenter.edu',     '0904000005', N'SV024', '2004-08-18', N'Nam', N'77 Phan Chu Trinh, Đà Nẵng',    N'Bảo lưu'),
        (N'my.dt',      N'Đặng Thảo My',            N'my.dt@itcenter.edu',      '0904000006', N'SV025', '2003-12-30', N'Nữ',  N'12 Lý Thái Tổ, Huế',             N'Đang học'),
        (N'long.nh',    N'Nguyễn Hoàng Long',       N'long.nh@itcenter.edu',    '0904000007', N'SV026', '2005-05-04', N'Nam', N'5 Quang Trung, Biên Hoà',        N'Đang học'),
        (N'linh.bp',    N'Bùi Phương Linh',         N'linh.bp@itcenter.edu',    '0904000008', N'SV027', '2004-09-15', N'Nữ',  N'120 Điện Biên, Vinh',            N'Đang học'),
        (N'kiet.dt',    N'Đinh Tuấn Kiệt',          N'kiet.dt@itcenter.edu',    '0904000009', N'SV028', '2002-01-08', N'Nam', N'16 Hàm Nghi, Quảng Ninh',        N'Đã tốt nghiệp'),
        (N'tu.pm',      N'Phan Minh Tú',            N'tu.pm@itcenter.edu',      '0904000010', N'SV029', '2005-07-22', N'Nam', N'88 Hai Bà Trưng, Cần Thơ',       N'Đang học'),
        (N'anh.ltn',    N'Lương Thị Ngọc Ánh',      N'anh.ltn@itcenter.edu',    '0904000011', N'SV030', '2004-04-06', N'Nữ',  N'23 Nguyễn Đình Chiểu, Vĩnh Long', N'Đang học'),
        (N'hung.dg',    N'Đỗ Gia Hưng',             N'hung.dg@itcenter.edu',    '0904000012', N'SV031', '2004-10-11', N'Nam', N'45 Lạc Long Quân, Tây Ninh',     N'Đang học'),
        (N'linh.tk',    N'Trương Khánh Linh',       N'linh.tk@itcenter.edu',    '0904000013', N'SV032', '2005-03-28', N'Nữ',  N'Số 7 An Dương, Hải Dương',       N'Đang học'),
        (N'hoa.nt',     N'Nguyễn Thanh Hoa',        N'hoa.nt@itcenter.edu',     '0904000014', N'SV033', '2003-08-17', N'Nữ',  N'56 Ngô Quyền, Quảng Bình',       N'Đang học'),
        (N'nghia.lh',   N'Lê Hữu Nghĩa',            N'nghia.lh@itcenter.edu',   '0904000015', N'SV034', '2002-02-14', N'Nam', N'101 Nguyễn Du, Bắc Giang',       N'Đã nghỉ học'),
        (N'quan.pm',    N'Phạm Minh Quân',          N'quan.pm@itcenter.edu',    '0904000016', N'SV035', '2004-06-25', N'Nam', N'34 Đinh Bộ Lĩnh, Vũng Tàu',      N'Đang học'),
        (N'bich.vn',    N'Võ Ngọc Bích',            N'bich.vn@itcenter.edu',    '0904000017', N'SV036', '2005-09-12', N'Nữ',  N'78 Tôn Đức Thắng, Quảng Trị',    N'Đang học'),
        (N'phong.td',   N'Trần Đình Phong',         N'phong.td@itcenter.edu',   '0904000018', N'SV037', '2004-05-02', N'Nam', N'22 Kim Mã, Hà Nội',              N'Đang học'),
        (N'duy.hl',     N'Hoàng Lê Duy',            N'duy.hl@itcenter.edu',     '0904000019', N'SV038', '2003-07-31', N'Nam', N'60 Bà Triệu, Nam Định',          N'Bảo lưu'),
        (N'huong.ntt',  N'Nguyễn Thị Thanh Hương',  N'huong.ntt@itcenter.edu',  '0904000020', N'SV039', '2005-11-19', N'Nữ',  N'4 Tràng Tiền, Hà Nội',           N'Đang học'),
        (N'thinh.bq',   N'Bùi Quốc Thịnh',          N'thinh.bq@itcenter.edu',   '0904000021', N'SV040', '2004-12-05', N'Nam', N'11 Phan Đình Phùng, Hoà Bình',   N'Đang học'),
        (N'nhi.lt',     N'Lê Tuyết Nhi',            N'nhi.lt@itcenter.edu',     '0904000022', N'SV041', '2005-04-09', N'Nữ',  N'90 Trần Hưng Đạo, Đắk Lắk',      N'Đang học'),
        (N'anh.pd',     N'Phan Đức Anh',            N'anh.pd@itcenter.edu',     '0904000023', N'SV042', '2002-06-16', N'Nam', N'67 Nguyễn Huệ, Gia Lai',         N'Đã tốt nghiệp'),
        (N'quang.nm',   N'Nguyễn Minh Quang',       N'quang.nm@itcenter.edu',   '0904000024', N'SV043', '2004-02-27', N'Nam', N'Tổ 5 Phường 7, TP.HCM',          N'Đang học'),
        (N'vy.tt',      N'Trần Thúy Vy',            N'vy.tt@itcenter.edu',      '0904000025', N'SV044', '2005-10-03', N'Nữ',  N'18 Lê Thánh Tôn, Lâm Đồng',      N'Đang học'),
        (N'huy.lq',     N'Lã Quang Huy',            N'huy.lq@itcenter.edu',     '0904000026', N'SV045', '2003-05-21', N'Nam', N'Số 3 Thanh Niên, Yên Bái',       N'Đang học'),
        (N'phuong.vl',  N'Vũ Lan Phương',           N'phuong.vl@itcenter.edu',  '0904000027', N'SV046', '2004-11-24', N'Nữ',  N'112 Nguyễn Công Trứ, Thái Nguyên', N'Đang học'),
        (N'dat.lt',     N'Lê Tấn Đạt',              N'dat.lt@itcenter.edu',     '0904000028', N'SV047', '2005-08-07', N'Nam', N'15 Tô Hiệu, Sơn La',             N'Đang học'),
        (N'uyen.pt',    N'Phạm Thảo Uyên',          N'uyen.pt@itcenter.edu',    '0904000029', N'SV048', '2004-03-30', N'Nữ',  N'38 Nguyễn An Ninh, Bến Tre',     N'Đang học'),
        (N'dung.ht',    N'Hoàng Tiến Dũng',         N'dung.ht@itcenter.edu',    '0904000030', N'SV049', '2003-09-13', N'Nam', N'27 Trường Chinh, Hà Tĩnh',       N'Đang học'),
        (N'tran.nb',    N'Nguyễn Bảo Trân',         N'tran.nb@itcenter.edu',    '0904000031', N'SV050', '2005-01-29', N'Nữ',  N'70 Hùng Vương, Phú Yên',         N'Đang học'),
        (N'hieu.tm',    N'Trần Mạnh Hiếu',          N'hieu.tm@itcenter.edu',    '0904000032', N'SV051', '2004-07-04', N'Nam', N'5 Hoàng Quốc Việt, Hà Nội',      N'Đang học'),
        (N'tung.dt',    N'Đỗ Thanh Tùng',           N'tung.dt@itcenter.edu',    '0904000033', N'SV052', '2003-02-22', N'Nam', N'8 Trần Thái Tông, Hà Nội',       N'Đã nghỉ học'),
        (N'duyen.ptm',  N'Phan Thị Mỹ Duyên',       N'duyen.ptm@itcenter.edu',  '0904000034', N'SV053', '2005-06-11', N'Nữ',  N'50 Nguyễn Tri Phương, Khánh Hoà', N'Đang học'),
        (N'minh.lhn',   N'Lê Hoàng Nhật Minh',      N'minh.lhn@itcenter.edu',   '0904000035', N'SV054', '2004-04-16', N'Nam', N'29 Pasteur, Đà Lạt',             N'Đang học');

    INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
    SELECT @BulkRoleStudent, ss.Username, N'123456', ss.FullName, ss.Email, ss.PhoneNumber, N'Active'
    FROM @BulkStudentSeed ss
    WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username = ss.Username);

    INSERT INTO Students (UserId, StatusId, StudentCode, FullName, DateOfBirth, Gender, Address, PhoneNumber, Email)
    SELECT
        u.UserId,
        COALESCE(st.StatusId, @BulkStActive),
        ss.StudentCode,
        ss.FullName, ss.DateOfBirth, ss.Gender, ss.Address, ss.PhoneNumber, ss.Email
    FROM @BulkStudentSeed ss
    INNER JOIN Users u ON u.Username = ss.Username
    LEFT JOIN StudentStatuses st ON st.StatusName = ss.StatusName
    WHERE NOT EXISTS (SELECT 1 FROM Students s WHERE s.UserId = u.UserId)
      AND NOT EXISTS (SELECT 1 FROM Students s2 WHERE s2.StudentCode = ss.StudentCode);

    /* ---- STEP 4: Thêm 12 Class + ClassSchedules ---- */
    DECLARE @BulkClassSeed TABLE (
        ClassCode   NVARCHAR(20), ClassName NVARCHAR(100),
        CourseCode  NVARCHAR(20), TeacherCode NVARCHAR(20), MaxStudents INT,
        Weekday1 NVARCHAR(20), Start1 TIME, End1 TIME, Room1 NVARCHAR(50),
        Weekday2 NVARCHAR(20), Start2 TIME, End2 TIME, Room2 NVARCHAR(50)
    );

    INSERT INTO @BulkClassSeed VALUES
        (N'CSHARP.K26.T35',  N'C# WinForms Tối 3-5 K26',           N'CSHARP-WF',   N'GV001', 30, N'Tuesday', '18:00', '20:30', N'Phòng Lab 101', N'Thursday', '18:00', '20:30', N'Phòng Lab 101'),
        (N'API.K11.T24',     N'Web API .NET Tối 2-4 K11',          N'WEB-API',     N'GV001', 30, N'Monday',  '18:00', '20:30', N'Phòng Lab 102', N'Wednesday', '18:00', '20:30', N'Phòng Lab 102'),
        (N'PYTHON.K16.T57',  N'Python AI Tối 5-7 K16',             N'PYTHON-AI',   N'GV002', 30, N'Thursday','18:30', '21:00', N'Phòng Lab 103', N'Saturday', '09:00', '11:30', N'Phòng Lab 103'),
        (N'SQL.K21.T24',     N'SQL Server Tối 2-4 K21',            N'SQL-ADV',     N'GV002', 30, N'Monday',  '18:30', '21:00', N'Phòng Lab 104', N'Wednesday', '18:30', '21:00', N'Phòng Lab 104'),
        (N'REACT.K6.T35',    N'ReactJS Tối 3-5 K6',                N'FE-REACT',    N'GV022', 30, N'Tuesday', '18:00', '20:30', N'Phòng Lab 103', N'Thursday', '18:00', '20:30', N'Phòng Lab 103'),
        (N'JAVA.K01.T24',    N'Java Spring Boot Tối 2-4 K1',       N'JAVA-ENT',    N'GV020', 30, N'Monday',  '18:00', '20:30', N'Phòng Lab 104', N'Wednesday', '18:00', '20:30', N'Phòng Lab 104'),
        (N'DEVOPS.K01.CN',   N'DevOps Docker & K8s Chiều CN K1',   N'DOCKER-K8S',  N'GV021', 24, N'Sunday',  '13:30', '17:30', N'Phòng Hội thảo 301', NULL, NULL, NULL, NULL),
        (N'FLUTTER.K01.T35', N'Mobile Flutter Tối 3-5 K1',         N'MOB-FLUTTER', N'GV025', 28, N'Tuesday', '18:30', '21:00', N'Phòng Lab 102', N'Thursday', '18:30', '21:00', N'Phòng Lab 102'),
        (N'SEC.K01.T7',      N'An toàn thông tin Sáng T7 K1',      N'CYBER-SEC',   N'GV023', 24, N'Saturday','08:30', '11:30', N'Phòng Lab 101', NULL, NULL, NULL, NULL),
        (N'DATA.K01.T46',    N'Data Science Tối 4-6 K1',           N'DATA-SCI',    N'GV027', 30, N'Wednesday','18:30','21:00', N'Phòng Lab 103', N'Friday',   '18:30', '21:00', N'Phòng Lab 103'),
        (N'AWS.K01.T7',      N'Cloud AWS Sáng T7 K1',              N'DOCKER-K8S',  N'GV024', 30, N'Saturday','13:30', '16:30', N'Phòng Hội thảo 301', NULL, NULL, NULL, NULL),
        (N'UIUX.K01.CN',     N'UI/UX Designer Sáng CN K1',         N'FE-REACT',    N'GV022', 25, N'Sunday',  '08:30', '11:30', N'Phòng Online A', NULL, NULL, NULL, NULL);

    INSERT INTO Classes (CourseId, TeacherId, ClassCode, ClassName, MaxStudents)
    SELECT co.CourseId, t.TeacherId, cs.ClassCode, cs.ClassName, cs.MaxStudents
    FROM @BulkClassSeed cs
    INNER JOIN Courses co ON co.CourseCode = cs.CourseCode
    INNER JOIN Teachers t ON t.TeacherCode = cs.TeacherCode
    WHERE NOT EXISTS (SELECT 1 FROM Classes c WHERE c.ClassCode = cs.ClassCode);

    INSERT INTO ClassSchedules (ClassId, RoomId, Weekday, StartTime, EndTime)
    SELECT c.ClassId, r.RoomId, cs.Weekday1, cs.Start1, cs.End1
    FROM @BulkClassSeed cs
    INNER JOIN Classes c ON c.ClassCode = cs.ClassCode
    LEFT  JOIN Rooms r ON r.RoomName = cs.Room1
    WHERE cs.Weekday1 IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ClassSchedules sc
                      WHERE sc.ClassId = c.ClassId AND sc.Weekday = cs.Weekday1 AND sc.StartTime = cs.Start1);

    INSERT INTO ClassSchedules (ClassId, RoomId, Weekday, StartTime, EndTime)
    SELECT c.ClassId, r.RoomId, cs.Weekday2, cs.Start2, cs.End2
    FROM @BulkClassSeed cs
    INNER JOIN Classes c ON c.ClassCode = cs.ClassCode
    LEFT  JOIN Rooms r ON r.RoomName = cs.Room2
    WHERE cs.Weekday2 IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ClassSchedules sc
                      WHERE sc.ClassId = c.ClassId AND sc.Weekday = cs.Weekday2 AND sc.StartTime = cs.Start2);

    /* ---- STEP 5: Enrollments ---- */
    DECLARE @BulkEnrollmentSeed TABLE (
        StudentCode NVARCHAR(20), ClassCode NVARCHAR(20),
        EnrollDate  DATETIME2, Status NVARCHAR(20)
    );

    INSERT INTO @BulkEnrollmentSeed VALUES
        (N'SV020', N'CSHARP.K26.T35', '2025-09-10 08:00', N'Enrolled'),
        (N'SV020', N'API.K11.T24',    '2025-09-10 08:05', N'Enrolled'),
        (N'SV020', N'DATA.K01.T46',   '2025-09-10 08:10', N'Enrolled'),
        (N'SV021', N'REACT.K6.T35',   '2025-09-10 09:00', N'Enrolled'),
        (N'SV021', N'UIUX.K01.CN',    '2025-09-10 09:05', N'Enrolled'),
        (N'SV021', N'FLUTTER.K01.T35','2025-09-10 09:10', N'Enrolled'),
        (N'SV022', N'PYTHON.K16.T57', '2025-09-11 08:00', N'Enrolled'),
        (N'SV022', N'DATA.K01.T46',   '2025-09-11 08:05', N'Enrolled'),
        (N'SV022', N'SEC.K01.T7',     '2025-09-11 08:10', N'Enrolled'),
        (N'SV023', N'JAVA.K01.T24',   '2025-09-11 09:00', N'Enrolled'),
        (N'SV023', N'DEVOPS.K01.CN',  '2025-09-11 09:05', N'Enrolled'),
        (N'SV023', N'SQL.K21.T24',    '2025-09-11 09:10', N'Enrolled'),
        (N'SV024', N'PYTHON.K16.T57', '2025-09-12 10:00', N'Dropped'),
        (N'SV025', N'REACT.K6.T35',   '2025-09-12 11:00', N'Enrolled'),
        (N'SV025', N'UIUX.K01.CN',    '2025-09-12 11:05', N'Enrolled'),
        (N'SV026', N'JAVA.K01.T24',   '2025-09-12 12:00', N'Enrolled'),
        (N'SV026', N'DEVOPS.K01.CN',  '2025-09-12 12:05', N'Enrolled'),
        (N'SV026', N'AWS.K01.T7',     '2025-09-12 12:10', N'Enrolled'),
        (N'SV027', N'SEC.K01.T7',     '2025-09-13 08:00', N'Enrolled'),
        (N'SV027', N'DATA.K01.T46',   '2025-09-13 08:05', N'Enrolled'),
        (N'SV028', N'CSHARP.K26.T35', '2025-02-01 10:00', N'Completed'),
        (N'SV028', N'API.K11.T24',    '2025-02-01 10:05', N'Completed'),
        (N'SV029', N'FLUTTER.K01.T35','2025-09-13 09:00', N'Enrolled'),
        (N'SV029', N'REACT.K6.T35',   '2025-09-13 09:05', N'Enrolled'),
        (N'SV030', N'PYTHON.K16.T57', '2025-09-14 10:00', N'Enrolled'),
        (N'SV030', N'DATA.K01.T46',   '2025-09-14 10:05', N'Enrolled'),
        (N'SV031', N'SQL.K21.T24',    '2025-09-14 11:00', N'Enrolled'),
        (N'SV031', N'JAVA.K01.T24',   '2025-09-14 11:05', N'Enrolled'),
        (N'SV032', N'UIUX.K01.CN',    '2025-09-15 08:00', N'Enrolled'),
        (N'SV032', N'REACT.K6.T35',   '2025-09-15 08:05', N'Enrolled'),
        (N'SV033', N'FLUTTER.K01.T35','2025-09-15 09:00', N'Enrolled'),
        (N'SV033', N'AWS.K01.T7',     '2025-09-15 09:05', N'Enrolled'),
        (N'SV034', N'CSHARP.K26.T35', '2024-09-01 08:00', N'Dropped'),
        (N'SV035', N'DEVOPS.K01.CN',  '2025-09-16 10:00', N'Enrolled'),
        (N'SV035', N'AWS.K01.T7',     '2025-09-16 10:05', N'Enrolled'),
        (N'SV036', N'DATA.K01.T46',   '2025-09-16 11:00', N'Enrolled'),
        (N'SV036', N'SEC.K01.T7',     '2025-09-16 11:05', N'Enrolled'),
        (N'SV037', N'API.K11.T24',    '2025-09-17 08:00', N'Enrolled'),
        (N'SV037', N'JAVA.K01.T24',   '2025-09-17 08:05', N'Enrolled'),
        (N'SV038', N'PYTHON.K16.T57', '2025-02-01 10:00', N'Completed'),
        (N'SV039', N'REACT.K6.T35',   '2025-09-17 09:00', N'Enrolled'),
        (N'SV039', N'FLUTTER.K01.T35','2025-09-17 09:05', N'Enrolled'),
        (N'SV039', N'UIUX.K01.CN',    '2025-09-17 09:10', N'Enrolled'),
        (N'SV040', N'CSHARP.K26.T35', '2025-09-18 08:00', N'Enrolled'),
        (N'SV040', N'SQL.K21.T24',    '2025-09-18 08:05', N'Enrolled'),
        (N'SV041', N'DATA.K01.T46',   '2025-09-18 09:00', N'Enrolled'),
        (N'SV041', N'PYTHON.K16.T57', '2025-09-18 09:05', N'Enrolled'),
        (N'SV042', N'JAVA.K01.T24',   '2024-09-01 10:00', N'Completed'),
        (N'SV042', N'SEC.K01.T7',     '2024-09-01 10:05', N'Completed'),
        (N'SV043', N'API.K11.T24',    '2025-09-19 08:00', N'Enrolled'),
        (N'SV043', N'DEVOPS.K01.CN',  '2025-09-19 08:05', N'Enrolled'),
        (N'SV044', N'FLUTTER.K01.T35','2025-09-19 09:00', N'Enrolled'),
        (N'SV044', N'REACT.K6.T35',   '2025-09-19 09:05', N'Enrolled'),
        (N'SV045', N'SQL.K21.T24',    '2025-09-20 08:00', N'Enrolled'),
        (N'SV045', N'JAVA.K01.T24',   '2025-09-20 08:05', N'Enrolled'),
        (N'SV046', N'UIUX.K01.CN',    '2025-09-20 09:00', N'Enrolled'),
        (N'SV046', N'DATA.K01.T46',   '2025-09-20 09:05', N'Enrolled'),
        (N'SV047', N'CSHARP.K26.T35', '2025-09-21 08:00', N'Enrolled'),
        (N'SV047', N'API.K11.T24',    '2025-09-21 08:05', N'Enrolled'),
        (N'SV048', N'SEC.K01.T7',     '2025-09-21 09:00', N'Enrolled'),
        (N'SV048', N'FLUTTER.K01.T35','2025-09-21 09:05', N'Enrolled'),
        (N'SV049', N'PYTHON.K16.T57', '2025-09-22 08:00', N'Enrolled'),
        (N'SV049', N'DEVOPS.K01.CN',  '2025-09-22 08:05', N'Enrolled'),
        (N'SV050', N'DATA.K01.T46',   '2025-09-22 09:00', N'Enrolled'),
        (N'SV050', N'AWS.K01.T7',     '2025-09-22 09:05', N'Enrolled'),
        (N'SV051', N'REACT.K6.T35',   '2025-09-23 08:00', N'Enrolled'),
        (N'SV051', N'JAVA.K01.T24',   '2025-09-23 08:05', N'Enrolled'),
        (N'SV052', N'SQL.K21.T24',    '2024-09-01 08:00', N'Dropped'),
        (N'SV053', N'UIUX.K01.CN',    '2025-09-23 09:00', N'Enrolled'),
        (N'SV053', N'REACT.K6.T35',   '2025-09-23 09:05', N'Enrolled'),
        (N'SV053', N'FLUTTER.K01.T35','2025-09-23 09:10', N'Enrolled'),
        (N'SV054', N'API.K11.T24',    '2025-09-24 08:00', N'Enrolled'),
        (N'SV054', N'DEVOPS.K01.CN',  '2025-09-24 08:05', N'Enrolled');

    INSERT INTO Enrollments (StudentId, ClassId, EnrollmentDate, Status)
    SELECT s.StudentId, c.ClassId, es.EnrollDate, es.Status
    FROM @BulkEnrollmentSeed es
    INNER JOIN Students s ON s.StudentCode = es.StudentCode
    INNER JOIN Classes  c ON c.ClassCode   = es.ClassCode
    WHERE NOT EXISTS (SELECT 1 FROM Enrollments e
                      WHERE e.StudentId = s.StudentId AND e.ClassId = c.ClassId);

    /* ---- STEP 6: Tuitions ---- */
    INSERT INTO Tuitions (EnrollmentId, TotalFee, AmountPaid, DueDate, Status)
    SELECT
        e.EnrollmentId,
        co.TuitionFee,
        CASE
            WHEN e.Status = N'Completed'        THEN co.TuitionFee
            WHEN (e.EnrollmentId % 5) = 0       THEN co.TuitionFee
            WHEN (e.EnrollmentId % 5) = 1       THEN co.TuitionFee / 2
            WHEN (e.EnrollmentId % 5) = 2       THEN 0
            WHEN (e.EnrollmentId % 5) = 3       THEN co.TuitionFee
            ELSE co.TuitionFee / 3
        END,
        DATEADD(DAY, 30, CAST(e.EnrollmentDate AS DATE)),
        CASE
            WHEN e.Status = N'Completed'  THEN N'Paid'
            WHEN (e.EnrollmentId % 5) IN (0, 3) THEN N'Paid'
            WHEN DATEADD(DAY, 30, CAST(e.EnrollmentDate AS DATE)) < CAST(GETDATE() AS DATE)
                 AND (e.EnrollmentId % 5) = 2 THEN N'Overdue'
            ELSE N'Pending'
        END
    FROM Enrollments e
    INNER JOIN Classes c  ON c.ClassId  = e.ClassId
    INNER JOIN Courses co ON co.CourseId = c.CourseId
    WHERE NOT EXISTS (SELECT 1 FROM Tuitions t WHERE t.EnrollmentId = e.EnrollmentId);

    /* ---- STEP 7: Receipts ---- */
    INSERT INTO Receipts (TuitionId, CashierId, ReceiptCode, Amount, PaymentDate, Note)
    SELECT
        t.TuitionId,
        @BulkCashierId,
        N'BL' + RIGHT(N'00000' + CAST(1000 + t.TuitionId AS NVARCHAR(10)), 5),
        t.AmountPaid,
        DATEADD(DAY, -ABS(CHECKSUM(NEWID())) % 60, GETDATE()),
        N'Thu học phí cho Enrollment #' + CAST(t.EnrollmentId AS NVARCHAR(10))
    FROM Tuitions t
    WHERE t.AmountPaid > 0
      AND NOT EXISTS (SELECT 1 FROM Receipts r WHERE r.TuitionId = t.TuitionId);

    /* ---- STEP 8: Attendances ---- */
    ;WITH Targets AS (
        SELECT e.EnrollmentId, e.EnrollmentDate
        FROM Enrollments e
        INNER JOIN Classes c ON c.ClassId = e.ClassId
        WHERE c.ClassCode IN (SELECT ClassCode FROM @BulkClassSeed)
          AND e.Status <> N'Dropped'
          AND NOT EXISTS (SELECT 1 FROM Attendances a WHERE a.EnrollmentId = e.EnrollmentId)
    )
    INSERT INTO Attendances (EnrollmentId, SessionDate, Status)
    SELECT
        t.EnrollmentId,
        DATEADD(DAY, 3 + n.n * 4, CAST(t.EnrollmentDate AS DATE)),
        CASE ABS(CHECKSUM(NEWID())) % 10
            WHEN 0 THEN N'Absent'
            WHEN 1 THEN N'Late'
            WHEN 2 THEN N'Late'
            ELSE        N'Present'
        END
    FROM Targets t
    CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6),(7)) AS n(n);

    /* ---- STEP 9: Scores (CC/GK/CK) ---- */
    INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue)
    SELECT e.EnrollmentId, @BulkScCC,
           CAST(6.5 + (ABS(CHECKSUM(NEWID())) % 350) / 100.0 AS DECIMAL(5,2))
    FROM Enrollments e
    INNER JOIN Classes c ON c.ClassId = e.ClassId
    WHERE c.ClassCode IN (SELECT ClassCode FROM @BulkClassSeed)
      AND e.Status <> N'Dropped'
      AND NOT EXISTS (SELECT 1 FROM Scores s
                      WHERE s.EnrollmentId = e.EnrollmentId AND s.ScoreTypeId = @BulkScCC);

    INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue)
    SELECT e.EnrollmentId, @BulkScGK,
           CAST(5.0 + (ABS(CHECKSUM(NEWID())) % 500) / 100.0 AS DECIMAL(5,2))
    FROM Enrollments e
    INNER JOIN Classes c ON c.ClassId = e.ClassId
    WHERE c.ClassCode IN (SELECT ClassCode FROM @BulkClassSeed)
      AND e.Status <> N'Dropped'
      AND NOT EXISTS (SELECT 1 FROM Scores s
                      WHERE s.EnrollmentId = e.EnrollmentId AND s.ScoreTypeId = @BulkScGK);

    INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue)
    SELECT e.EnrollmentId, @BulkScCK,
           CAST(4.0 + (ABS(CHECKSUM(NEWID())) % 600) / 100.0 AS DECIMAL(5,2))
    FROM Enrollments e
    INNER JOIN Classes c ON c.ClassId = e.ClassId
    WHERE c.ClassCode IN (SELECT ClassCode FROM @BulkClassSeed)
      AND (e.Status = N'Completed' OR (e.EnrollmentId % 5) <> 4)
      AND NOT EXISTS (SELECT 1 FROM Scores s
                      WHERE s.EnrollmentId = e.EnrollmentId AND s.ScoreTypeId = @BulkScCK);

    /* ---- STEP 10: Exams + ExamSubmissions ---- */
    DECLARE @BulkExamSeed TABLE (
        ClassCode NVARCHAR(20), Title NVARCHAR(200), ExamType NVARCHAR(50),
        Description NVARCHAR(500), DueDate DATETIME, Status NVARCHAR(20)
    );

    INSERT INTO @BulkExamSeed VALUES
        (N'CSHARP.K26.T35', N'Bài tập chương 1-2', N'Tự luận',    N'Làm bài tập chương 1 và chương 2, nộp file .zip', '2025-11-10 23:59', N'Closed'),
        (N'CSHARP.K26.T35', N'Kiểm tra giữa kỳ',   N'Trắc nghiệm',N'40 câu trắc nghiệm, 60 phút.',                   '2025-11-25 18:00', N'Active'),
        (N'API.K11.T24',    N'Bài tập API cơ bản',  N'Tự luận',   N'Thiết kế Web API quản lý sản phẩm.',             '2025-11-05 23:59', N'Closed'),
        (N'API.K11.T24',    N'Thi cuối kỳ',         N'Tự luận',   N'Dự án nhỏ: Book Store API + JWT.',              '2025-12-15 18:00', N'Active'),
        (N'PYTHON.K16.T57', N'Quiz Machine Learning',N'Trắc nghiệm',N'Quiz 25 câu về ML cơ bản.',                    '2025-11-12 21:00', N'Active'),
        (N'SQL.K21.T24',    N'Bài tập truy vấn',    N'Tự luận',   N'10 query T-SQL nâng cao.',                      '2025-11-08 23:59', N'Closed'),
        (N'REACT.K6.T35',   N'Kiểm tra Hooks',      N'Trắc nghiệm',N'20 câu về useState, useEffect, useMemo.',       '2025-11-18 18:00', N'Active'),
        (N'JAVA.K01.T24',   N'Spring Boot Quiz',    N'Trắc nghiệm',N'30 câu về Spring DI, AOP, Data JPA.',           '2025-11-20 18:00', N'Active'),
        (N'DEVOPS.K01.CN',  N'Thực hành Docker',    N'Tự luận',   N'Đóng gói ứng dụng vào container & compose.',    '2025-11-16 23:59', N'Active'),
        (N'FLUTTER.K01.T35',N'Widget & Layout',     N'Trắc nghiệm',N'20 câu về widget tree, layout.',                '2025-11-14 21:00', N'Active'),
        (N'SEC.K01.T7',     N'Penetration lab 1',   N'Tự luận',   N'Kịch bản OWASP Top 10 cơ bản.',                 '2025-11-22 23:59', N'Active'),
        (N'DATA.K01.T46',   N'Phân tích dữ liệu',   N'Tự luận',   N'Làm sạch + trực quan dataset CSV.',             '2025-11-28 23:59', N'Active'),
        (N'AWS.K01.T7',     N'AWS Fundamentals',    N'Trắc nghiệm',N'30 câu EC2, S3, IAM, VPC.',                     '2025-11-30 18:00', N'Active'),
        (N'UIUX.K01.CN',    N'Figma Prototype',     N'Tự luận',   N'Thiết kế wireframe & high-fidelity prototype.', '2025-11-26 23:59', N'Active');

    INSERT INTO Exams (ClassId, UserId, Title, ExamType, Description, DueDate, Status)
    SELECT c.ClassId, t.UserId, es.Title, es.ExamType, es.Description, es.DueDate, es.Status
    FROM @BulkExamSeed es
    INNER JOIN Classes  c ON c.ClassCode  = es.ClassCode
    INNER JOIN Teachers t ON t.TeacherId  = c.TeacherId
    WHERE NOT EXISTS (SELECT 1 FROM Exams ex
                      WHERE ex.ClassId = c.ClassId AND ex.Title = es.Title);

    INSERT INTO ExamSubmissions (ExamId, EnrollmentId, SubmittedAt, Note, Grade, Status)
    SELECT
        ex.ExamId,
        e.EnrollmentId,
        CASE
            WHEN ex.Status = N'Closed' THEN DATEADD(HOUR, -ABS(CHECKSUM(NEWID())) % 48, ex.DueDate)
            WHEN (e.EnrollmentId % 3) = 0 THEN DATEADD(HOUR, -ABS(CHECKSUM(NEWID())) % 24, ex.DueDate)
            ELSE NULL
        END,
        CASE WHEN (e.EnrollmentId % 4) = 0 THEN N'Em nộp bài đúng hạn ạ.' ELSE NULL END,
        CASE
            WHEN ex.Status = N'Closed' THEN CAST(5.0 + (ABS(CHECKSUM(NEWID())) % 500) / 100.0 AS DECIMAL(4,1))
            WHEN (e.EnrollmentId % 3) = 0 AND (e.EnrollmentId % 7) <> 0
                 THEN CAST(5.0 + (ABS(CHECKSUM(NEWID())) % 500) / 100.0 AS DECIMAL(4,1))
            ELSE NULL
        END,
        CASE
            WHEN ex.Status = N'Closed' THEN N'Graded'
            WHEN (e.EnrollmentId % 3) = 0 AND (e.EnrollmentId % 7) <> 0 THEN N'Graded'
            WHEN (e.EnrollmentId % 3) = 0 THEN N'Submitted'
            ELSE N'Pending'
        END
    FROM Exams ex
    INNER JOIN Classes c     ON c.ClassId = ex.ClassId
    INNER JOIN Enrollments e ON e.ClassId = c.ClassId AND e.Status <> N'Dropped'
    WHERE c.ClassCode IN (SELECT ClassCode FROM @BulkClassSeed)
      AND (e.EnrollmentId % 10) < 7
      AND NOT EXISTS (SELECT 1 FROM ExamSubmissions sub
                      WHERE sub.ExamId = ex.ExamId AND sub.EnrollmentId = e.EnrollmentId);

    /* ---- STEP 11: Notifications + NotificationRecipients ---- */
    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Lịch thi giữa kỳ khoá Thu 2025')
    BEGIN
        DECLARE @BulkNId1 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (@BulkCashierId, N'Lịch thi giữa kỳ khoá Thu 2025',
                N'Kính gửi quý học viên, lịch thi giữa kỳ sẽ diễn ra từ 20/11 đến 30/11.',
                '2025-11-05 09:00:00');
        SET @BulkNId1 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT @BulkNId1, u.UserId, CAST(ABS(CHECKSUM(NEWID())) % 2 AS BIT)
        FROM Users u WHERE u.RoleId IN (@BulkRoleStudent, @BulkRoleTeacher);
    END;

    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Bảo trì hệ thống CLASSES369')
    BEGIN
        DECLARE @BulkNId2 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (@BulkCashierId, N'Bảo trì hệ thống CLASSES369',
                N'Hệ thống sẽ bảo trì từ 00:00 - 03:00 sáng Chủ Nhật tuần này.',
                '2025-10-30 14:00:00');
        SET @BulkNId2 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT @BulkNId2, u.UserId, 0 FROM Users u WHERE u.Status = N'Active';
    END;

    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Workshop giáo viên: Active Learning')
    BEGIN
        DECLARE @BulkNId3 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (@BulkCashierId, N'Workshop giáo viên: Active Learning',
                N'Mời toàn thể giáo viên tham dự workshop "Active Learning" chiều Thứ 7 tại phòng Hội thảo 301.',
                '2025-11-01 08:00:00');
        SET @BulkNId3 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT @BulkNId3, u.UserId, 0 FROM Users u WHERE u.RoleId = @BulkRoleTeacher;
    END;

    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Nhắc nhở học phí đợt tháng 11')
    BEGIN
        DECLARE @BulkNId4 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (@BulkCashierId, N'Nhắc nhở học phí đợt tháng 11',
                N'Bạn còn một số khoản học phí chưa thanh toán. Vui lòng kiểm tra mục Học phí.',
                '2025-11-02 10:00:00');
        SET @BulkNId4 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT DISTINCT @BulkNId4, u.UserId, 0
        FROM Students s
        INNER JOIN Users u       ON u.UserId = s.UserId
        INNER JOIN Enrollments e ON e.StudentId = s.StudentId
        INNER JOIN Tuitions t    ON t.EnrollmentId = e.EnrollmentId
        WHERE t.Status IN (N'Pending', N'Overdue');
    END;

    /* ---- STEP 12: ActionLogs ---- */
    INSERT INTO ActionLogs (UserId, Action, Details, LogDate)
    SELECT TOP 1 UserId, N'Bulk Seed', N'Khởi tạo dữ liệu mẫu: 15 GV + 35 SV + 12 lớp học.', GETDATE()
    FROM Users WHERE Username = N'admin'
    AND NOT EXISTS (SELECT 1 FROM ActionLogs WHERE Action = N'Bulk Seed');

    /* ---- STEP 13: HomeNotices bổ sung ---- */
    IF NOT EXISTS (SELECT 1 FROM HomeNotices WHERE Title = N'Khai giảng khoá Java Enterprise K01')
        INSERT INTO HomeNotices (Title, Content, CreatedAt)
        VALUES (N'Khai giảng khoá Java Enterprise K01',
                N'Lớp Java Spring Boot K01 khai giảng vào 05/12. Ưu đãi giảm 10% cho 20 học viên đăng ký sớm.',
                '2025-11-05 09:00:00');
    IF NOT EXISTS (SELECT 1 FROM HomeNotices WHERE Title = N'Workshop miễn phí: An toàn thông tin')
        INSERT INTO HomeNotices (Title, Content, CreatedAt)
        VALUES (N'Workshop miễn phí: An toàn thông tin',
                N'Diễn giả: Phan Văn Thắng (GV023). Thời gian: 14:00 Thứ 7 tại Hội thảo 301.',
                '2025-11-03 10:00:00');
    IF NOT EXISTS (SELECT 1 FROM HomeNotices WHERE Title = N'Chương trình học bổng "New Coder 2025"')
        INSERT INTO HomeNotices (Title, Content, CreatedAt)
        VALUES (N'Chương trình học bổng "New Coder 2025"',
                N'CLASSES369 trao 10 suất học bổng 50% cho học viên có kết quả xuất sắc. Hạn đăng ký: 20/11.',
                '2025-11-07 14:00:00');

    /* ---- STEP 14: FeaturedTeachers bổ sung ---- */
    IF NOT EXISTS (SELECT 1 FROM FeaturedTeachers WHERE Title = N'Bùi Thị Hồng Nhung')
        INSERT INTO FeaturedTeachers (TeacherId, Title, Summary, ImagePath, SortOrder, IsActive)
        SELECT t.TeacherId, N'Bùi Thị Hồng Nhung',
               N'Chuyên gia Java Enterprise, Spring Boot, Microservices, 8+ năm kinh nghiệm.',
               N'/Images/nhung_bth.png', 7, 1
        FROM Teachers t WHERE t.TeacherCode = N'GV020';
    IF NOT EXISTS (SELECT 1 FROM FeaturedTeachers WHERE Title = N'Trần Quang Dũng')
        INSERT INTO FeaturedTeachers (TeacherId, Title, Summary, ImagePath, SortOrder, IsActive)
        SELECT t.TeacherId, N'Trần Quang Dũng',
               N'Kỹ sư DevOps cao cấp, chuyên container hoá ứng dụng với Docker & Kubernetes.',
               N'/Images/dung_tq.png', 8, 1
        FROM Teachers t WHERE t.TeacherCode = N'GV021';
    IF NOT EXISTS (SELECT 1 FROM FeaturedTeachers WHERE Title = N'Lê Ngọc Huyền')
        INSERT INTO FeaturedTeachers (TeacherId, Title, Summary, ImagePath, SortOrder, IsActive)
        SELECT t.TeacherId, N'Lê Ngọc Huyền',
               N'Product Designer tại start-up công nghệ, mạnh về Figma và Design System.',
               N'/Images/huyen_ln.png', 9, 1
        FROM Teachers t WHERE t.TeacherCode = N'GV022';
    IF NOT EXISTS (SELECT 1 FROM FeaturedTeachers WHERE Title = N'Hoàng Minh Đức')
        INSERT INTO FeaturedTeachers (TeacherId, Title, Summary, ImagePath, SortOrder, IsActive)
        SELECT t.TeacherId, N'Hoàng Minh Đức',
               N'Nghiên cứu sinh Machine Learning, đồng tác giả nhiều bài báo AAAI/ICLR.',
               N'/Images/duc_hm.png', 10, 1
        FROM Teachers t WHERE t.TeacherCode = N'GV028';

    /* ---- STEP 15: Reports bổ sung ---- */
    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Báo cáo Doanh thu Tháng 10/2025')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (N'Báo cáo Doanh thu Tháng 10/2025',
                N'Tổng doanh thu: 84.750.000 VND. Tỷ lệ hoàn thành học phí: 68%.',
                '2025-11-01 08:30:00');
    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Báo cáo tuyển sinh K26 - K27')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (N'Báo cáo tuyển sinh K26 - K27',
                N'Tổng học viên mới: 35. Khoá được quan tâm: Python AI, React, Java Enterprise.',
                '2025-11-02 09:00:00');
    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Khảo sát chất lượng giảng dạy Q3/2025')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (N'Khảo sát chất lượng giảng dạy Q3/2025',
                N'Điểm hài lòng trung bình: 4.7/5.',
                '2025-10-28 15:00:00');
    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Tình hình điểm danh tháng 10/2025')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (N'Tình hình điểm danh tháng 10/2025',
                N'Tỷ lệ đi học đúng giờ: 82%. Đi muộn: 11%. Vắng: 7%.',
                '2025-11-03 11:30:00');

    COMMIT TRAN;
    PRINT N'NHÓM 8 (bulk seed) hoàn tất.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    DECLARE @BulkErr NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@BulkErr, 16, 1);
END CATCH;
GO

/* ================================================================================
 PHẦN 3: HOÀN TẤT VÀ KIỂM TRA
================================================================================
*/
-- Bật lại tất cả các ràng buộc FK và KIỂM TRA chúng
EXEC sp_msforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";
GO

PRINT N'HOÀN TẤT TOÀN BỘ SCRIPT CSDL!';
GO

-- (Tùy chọn) Bạn có thể bỏ các lệnh SELECT này nếu không muốn chúng tự chạy
SELECT * FROM Roles;
SELECT * FROM Permissions;
SELECT * FROM RolePermissions;
SELECT * FROM StudentStatuses;
SELECT * FROM Courses;
SELECT * FROM Rooms;
SELECT * FROM ScoreTypes;
SELECT * FROM Users;
SELECT * FROM ActionLogs;
SELECT * FROM Students;
SELECT * FROM Teachers;
SELECT * FROM Notifications;
SELECT * FROM NotificationRecipients;
SELECT * FROM Classes;
SELECT * FROM ClassSchedules;
SELECT * FROM Enrollments;
SELECT * FROM Attendances;
SELECT * FROM Scores;
SELECT * FROM Tuitions;
SELECT * FROM Receipts;
SELECT * FROM HomeNotices;
SELECT * FROM FeaturedTeachers;
SELECT * FROM Reports;
GO
