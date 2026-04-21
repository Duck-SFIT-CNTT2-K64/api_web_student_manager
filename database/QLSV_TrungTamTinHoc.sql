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
(4, 2, N'hung.dq', N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.', N'Đinh Quang Hưng', N'hung.dq@itcenter.edu', '0944444444', N'Active'),
(5, 2, N'anh.dh', N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.', N'Hoàng Quốc Anh', N'huy.dh@itcenter.edu', '0955555555', N'Active'),

-- Sinh viên (Mới thêm - Khớp với StudentId từ 1 đến 5)
(6, 3, N'tien.nm', N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.', N'Nguyễn Mạnh Tiến', N'tien.nm@itcenter.edu', '0966666666', N'Active'),
(7, 3, N'a.nv', N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.', N'Nguyễn Văn A', N'a.nv@itcenter.edu', '0977777777', N'Active'),
(8, 3, N'b.tt', N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.', N'Trần Thị B', N'b.tt@itcenter.edu', '0988888888', N'Active'),
(9, 3, N'c.lm', N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.', N'Lê Minh C', N'c.lm@itcenter.edu', '0999999999', N'Active'),
(10, 3, N'd.ph', N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92s.ag/iHjO8MYL/7o7i.', N'Phạm Hoàng D', N'd.ph@itcenter.edu', '0912345678', N'Active');
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
