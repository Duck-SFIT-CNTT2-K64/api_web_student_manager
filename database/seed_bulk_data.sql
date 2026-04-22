/* =====================================================================
   QLSV_TrungTamTinHoc · Bulk sample-data seed (15 GV + 35 SV + ~12 lớp)
   ---------------------------------------------------------------------
   Idempotent, transaction + TRY/CATCH, password mặc định: '123456'.

   Nơi sử dụng:
     • Docker: docker/db-init/init-db.sh tự chạy file này sau schema
       (đường dẫn trong container: /scripts/seed_bulk_data.sql).
       Điều khiển qua biến RUN_BULK_SEED (auto | always | never).
     • sqlcmd thủ công (Windows, UTF-8 BOM):
         sqlcmd -S <SERVER> -E -C -d master -f 65001 -i database\seed_bulk_data.sql
     • Nội dung đã được ĐỒNG BỘ vào NHÓM 8 của QLSV_TrungTamTinHoc.sql,
       nên nếu bạn chỉ chạy file schema thuần, bulk data cũng được nạp.
   ===================================================================== */
USE QLSV_TrungTamTinHoc;
GO

SET NOCOUNT ON;

/* ---------------------------------------------------------------
   Đảm bảo các bảng phụ (Exams / ExamSubmissions) đã tồn tại.
   Một số bản DB cũ chưa có 2 bảng này.
   --------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Exams', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Exams (
        ExamId        INT IDENTITY(1,1) PRIMARY KEY,
        ClassId       INT NOT NULL,
        UserId        INT NOT NULL,
        Title         NVARCHAR(255) NOT NULL,
        ExamType      NVARCHAR(50) NOT NULL DEFAULT N'Trắc nghiệm',
        Description   NVARCHAR(MAX) NULL,
        DueDate       DATETIME NOT NULL,
        CreatedDate   DATETIME DEFAULT GETDATE(),
        Status        NVARCHAR(20) DEFAULT N'Active',
        CONSTRAINT FK_Exams_Class FOREIGN KEY (ClassId) REFERENCES Classes(ClassId),
        CONSTRAINT FK_Exams_User  FOREIGN KEY (UserId)  REFERENCES Users(UserId)
    );
END;
GO

IF OBJECT_ID(N'dbo.ExamSubmissions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ExamSubmissions (
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
END;
GO

BEGIN TRY
    BEGIN TRAN;

    /* ---------------- Resolve lookup IDs ---------------- */
    DECLARE @RoleTeacher  INT = (SELECT TOP 1 RoleId FROM Roles WHERE RoleName = N'Teacher');
    DECLARE @RoleStudent  INT = (SELECT TOP 1 RoleId FROM Roles WHERE RoleName = N'Student');
    DECLARE @RoleAdmin    INT = (SELECT TOP 1 RoleId FROM Roles WHERE RoleName = N'Admin');

    DECLARE @StActive     INT = (SELECT TOP 1 StatusId FROM StudentStatuses WHERE StatusName = N'Đang học');
    DECLARE @StReserved   INT = (SELECT TOP 1 StatusId FROM StudentStatuses WHERE StatusName = N'Bảo lưu');
    DECLARE @StGraduated  INT = (SELECT TOP 1 StatusId FROM StudentStatuses WHERE StatusName = N'Đã tốt nghiệp');
    DECLARE @StQuit       INT = (SELECT TOP 1 StatusId FROM StudentStatuses WHERE StatusName = N'Đã nghỉ học');

    DECLARE @ScCC INT = (SELECT TOP 1 ScoreTypeId FROM ScoreTypes WHERE ScoreTypeName = N'Chuyên cần');
    DECLARE @ScGK INT = (SELECT TOP 1 ScoreTypeId FROM ScoreTypes WHERE ScoreTypeName = N'Giữa kỳ');
    DECLARE @ScCK INT = (SELECT TOP 1 ScoreTypeId FROM ScoreTypes WHERE ScoreTypeName = N'Cuối kỳ');

    -- Lấy một admin bất kỳ (ưu tiên username 'admin', 'admin_test')
    DECLARE @CashierId INT = (
        SELECT TOP 1 UserId FROM Users
        WHERE Username IN (N'admin', N'admin_test')
           OR RoleId = @RoleAdmin
        ORDER BY CASE WHEN Username = N'admin' THEN 0
                      WHEN Username = N'admin_test' THEN 1
                      ELSE 2 END, UserId
    );

    IF @RoleTeacher IS NULL OR @RoleStudent IS NULL OR @StActive IS NULL
        OR @ScCC IS NULL OR @ScGK IS NULL OR @ScCK IS NULL OR @CashierId IS NULL
    BEGIN
        RAISERROR(N'Thiếu dữ liệu danh mục (Roles/Statuses/ScoreTypes/Admin). Hãy chạy file schema trước.', 16, 1);
    END;

    /* =====================================================================
       STEP 1 · Mở rộng danh mục: Courses & Rooms
       ===================================================================== */
    -- FE-REACT có thể đã thiếu trong các bản DB cũ
    IF NOT EXISTS (SELECT 1 FROM Courses WHERE CourseCode = N'FE-REACT')
        INSERT INTO Courses (CourseCode, CourseName, Description, Duration, TuitionFee, Credits)
        VALUES (N'FE-REACT', N'Thiết kế Web Frontend React', N'Xây dựng giao diện web hiện đại.', N'3 tháng', 4500000, 3);

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

    /* =====================================================================
       STEP 2 · Seed 15 Teachers
       ===================================================================== */
    DECLARE @TeacherSeed TABLE (
        Username NVARCHAR(50), FullName NVARCHAR(100), Email NVARCHAR(100),
        PhoneNumber VARCHAR(20), TeacherCode NVARCHAR(20),
        FirstName NVARCHAR(50), LastName NVARCHAR(50), Specialization NVARCHAR(100)
    );

    INSERT INTO @TeacherSeed VALUES
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

    -- Insert Users for teachers that don't exist yet
    INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
    SELECT @RoleTeacher, ts.Username, N'123456', ts.FullName, ts.Email, ts.PhoneNumber, N'Active'
    FROM @TeacherSeed ts
    WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username = ts.Username);

    -- Insert Teachers rows
    INSERT INTO Teachers (UserId, TeacherCode, FirstName, LastName, Specialization, PhoneNumber, Email)
    SELECT u.UserId, ts.TeacherCode, ts.FirstName, ts.LastName, ts.Specialization, ts.PhoneNumber, ts.Email
    FROM @TeacherSeed ts
    INNER JOIN Users u ON u.Username = ts.Username
    WHERE NOT EXISTS (SELECT 1 FROM Teachers t WHERE t.UserId = u.UserId)
      AND NOT EXISTS (SELECT 1 FROM Teachers t2 WHERE t2.TeacherCode = ts.TeacherCode);

    /* =====================================================================
       STEP 3 · Seed 35 Students (xen kẽ 4 trạng thái)
       ===================================================================== */
    DECLARE @StudentSeed TABLE (
        Username NVARCHAR(50), FullName NVARCHAR(100), Email NVARCHAR(100),
        PhoneNumber VARCHAR(20), StudentCode NVARCHAR(20),
        DateOfBirth DATE, Gender NVARCHAR(10), Address NVARCHAR(255),
        StatusName NVARCHAR(50)
    );

    INSERT INTO @StudentSeed VALUES
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

    -- Insert Users for students
    INSERT INTO Users (RoleId, Username, PasswordHash, FullName, Email, PhoneNumber, Status)
    SELECT @RoleStudent, ss.Username, N'123456', ss.FullName, ss.Email, ss.PhoneNumber, N'Active'
    FROM @StudentSeed ss
    WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Username = ss.Username);

    -- Insert Students rows
    INSERT INTO Students (UserId, StatusId, StudentCode, FullName, DateOfBirth, Gender, Address, PhoneNumber, Email)
    SELECT
        u.UserId,
        COALESCE(st.StatusId, @StActive),
        ss.StudentCode,
        ss.FullName,
        ss.DateOfBirth,
        ss.Gender,
        ss.Address,
        ss.PhoneNumber,
        ss.Email
    FROM @StudentSeed ss
    INNER JOIN Users u ON u.Username = ss.Username
    LEFT JOIN StudentStatuses st ON st.StatusName = ss.StatusName
    WHERE NOT EXISTS (SELECT 1 FROM Students s WHERE s.UserId = u.UserId)
      AND NOT EXISTS (SELECT 1 FROM Students s2 WHERE s2.StudentCode = ss.StudentCode);

    /* =====================================================================
       STEP 4 · Thêm 12 Class + ClassSchedules
       ===================================================================== */
    DECLARE @ClassSeed TABLE (
        ClassCode   NVARCHAR(20),
        ClassName   NVARCHAR(100),
        CourseCode  NVARCHAR(20),
        TeacherCode NVARCHAR(20),
        MaxStudents INT,
        Weekday1    NVARCHAR(20), Start1 TIME, End1 TIME, Room1 NVARCHAR(50),
        Weekday2    NVARCHAR(20), Start2 TIME, End2 TIME, Room2 NVARCHAR(50)
    );

    INSERT INTO @ClassSeed VALUES
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
    FROM @ClassSeed cs
    INNER JOIN Courses co ON co.CourseCode = cs.CourseCode
    INNER JOIN Teachers t ON t.TeacherCode = cs.TeacherCode
    WHERE NOT EXISTS (SELECT 1 FROM Classes c WHERE c.ClassCode = cs.ClassCode);

    -- Lịch học: buổi 1
    INSERT INTO ClassSchedules (ClassId, RoomId, Weekday, StartTime, EndTime)
    SELECT c.ClassId, r.RoomId, cs.Weekday1, cs.Start1, cs.End1
    FROM @ClassSeed cs
    INNER JOIN Classes c ON c.ClassCode = cs.ClassCode
    LEFT  JOIN Rooms r ON r.RoomName = cs.Room1
    WHERE cs.Weekday1 IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ClassSchedules sc
        WHERE sc.ClassId = c.ClassId AND sc.Weekday = cs.Weekday1 AND sc.StartTime = cs.Start1
      );

    -- Lịch học: buổi 2
    INSERT INTO ClassSchedules (ClassId, RoomId, Weekday, StartTime, EndTime)
    SELECT c.ClassId, r.RoomId, cs.Weekday2, cs.Start2, cs.End2
    FROM @ClassSeed cs
    INNER JOIN Classes c ON c.ClassCode = cs.ClassCode
    LEFT  JOIN Rooms r ON r.RoomName = cs.Room2
    WHERE cs.Weekday2 IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ClassSchedules sc
        WHERE sc.ClassId = c.ClassId AND sc.Weekday = cs.Weekday2 AND sc.StartTime = cs.Start2
      );

    /* =====================================================================
       STEP 5 · Enrollments (xếp mỗi SV vào 2-4 lớp, có cả Dropped/Completed)
       ===================================================================== */
    DECLARE @EnrollmentSeed TABLE (
        StudentCode NVARCHAR(20),
        ClassCode   NVARCHAR(20),
        EnrollDate  DATETIME2,
        Status      NVARCHAR(20)
    );

    INSERT INTO @EnrollmentSeed VALUES
        -- Nhóm 1 (lớp phổ biến)
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
    FROM @EnrollmentSeed es
    INNER JOIN Students s ON s.StudentCode = es.StudentCode
    INNER JOIN Classes  c ON c.ClassCode   = es.ClassCode
    WHERE NOT EXISTS (
        SELECT 1 FROM Enrollments e
        WHERE e.StudentId = s.StudentId AND e.ClassId = c.ClassId
    );

    /* =====================================================================
       STEP 6 · Tuitions cho mọi enrollment mới (chưa có tuition)
       ===================================================================== */
    INSERT INTO Tuitions (EnrollmentId, TotalFee, AmountPaid, DueDate, Status)
    SELECT
        e.EnrollmentId,
        co.TuitionFee,
        CASE
            WHEN e.Status = N'Completed'        THEN co.TuitionFee
            WHEN (e.EnrollmentId % 5) = 0       THEN co.TuitionFee                                -- Paid đầy đủ
            WHEN (e.EnrollmentId % 5) = 1       THEN co.TuitionFee / 2                            -- Đóng đợt 1
            WHEN (e.EnrollmentId % 5) = 2       THEN 0                                            -- Chưa đóng
            WHEN (e.EnrollmentId % 5) = 3       THEN co.TuitionFee                                -- Paid
            ELSE co.TuitionFee / 3                                                                 -- Đóng 1 phần
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

    /* =====================================================================
       STEP 7 · Receipts cho mọi Tuition đã có AmountPaid > 0
       ===================================================================== */
    INSERT INTO Receipts (TuitionId, CashierId, ReceiptCode, Amount, PaymentDate, Note)
    SELECT
        t.TuitionId,
        @CashierId,
        N'BL' + RIGHT(N'00000' + CAST(1000 + t.TuitionId AS NVARCHAR(10)), 5),
        t.AmountPaid,
        DATEADD(DAY, -ABS(CHECKSUM(NEWID())) % 60, GETDATE()),
        N'Thu học phí cho Enrollment #' + CAST(t.EnrollmentId AS NVARCHAR(10))
    FROM Tuitions t
    WHERE t.AmountPaid > 0
      AND NOT EXISTS (SELECT 1 FROM Receipts r WHERE r.TuitionId = t.TuitionId);

    /* =====================================================================
       STEP 8 · Attendances (8 buổi/enrollment cho các lớp mới, random)
       ===================================================================== */
    -- Chỉ sinh cho enrollments chưa có attendance
    ;WITH Targets AS (
        SELECT e.EnrollmentId, e.EnrollmentDate
        FROM Enrollments e
        INNER JOIN Classes c ON c.ClassId = e.ClassId
        WHERE c.ClassCode IN (SELECT ClassCode FROM @ClassSeed)
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

    /* =====================================================================
       STEP 9 · Scores (CC/GK/CK) cho enrollments Enrolled/Completed
       ===================================================================== */
    -- Chuyên cần
    INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue)
    SELECT e.EnrollmentId, @ScCC,
           CAST(6.5 + (ABS(CHECKSUM(NEWID())) % 350) / 100.0 AS DECIMAL(5,2))
    FROM Enrollments e
    INNER JOIN Classes c ON c.ClassId = e.ClassId
    WHERE c.ClassCode IN (SELECT ClassCode FROM @ClassSeed)
      AND e.Status <> N'Dropped'
      AND NOT EXISTS (
        SELECT 1 FROM Scores s
        WHERE s.EnrollmentId = e.EnrollmentId AND s.ScoreTypeId = @ScCC
      );

    -- Giữa kỳ
    INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue)
    SELECT e.EnrollmentId, @ScGK,
           CAST(5.0 + (ABS(CHECKSUM(NEWID())) % 500) / 100.0 AS DECIMAL(5,2))
    FROM Enrollments e
    INNER JOIN Classes c ON c.ClassId = e.ClassId
    WHERE c.ClassCode IN (SELECT ClassCode FROM @ClassSeed)
      AND e.Status <> N'Dropped'
      AND NOT EXISTS (
        SELECT 1 FROM Scores s
        WHERE s.EnrollmentId = e.EnrollmentId AND s.ScoreTypeId = @ScGK
      );

    -- Cuối kỳ (chỉ cho Completed + 80% Enrolled)
    INSERT INTO Scores (EnrollmentId, ScoreTypeId, ScoreValue)
    SELECT e.EnrollmentId, @ScCK,
           CAST(4.0 + (ABS(CHECKSUM(NEWID())) % 600) / 100.0 AS DECIMAL(5,2))
    FROM Enrollments e
    INNER JOIN Classes c ON c.ClassId = e.ClassId
    WHERE c.ClassCode IN (SELECT ClassCode FROM @ClassSeed)
      AND (e.Status = N'Completed' OR (e.EnrollmentId % 5) <> 4)
      AND NOT EXISTS (
        SELECT 1 FROM Scores s
        WHERE s.EnrollmentId = e.EnrollmentId AND s.ScoreTypeId = @ScCK
      );

    /* =====================================================================
       STEP 10 · Exams + ExamSubmissions cho các lớp mới
       ===================================================================== */
    DECLARE @ExamSeed TABLE (
        ClassCode NVARCHAR(20),
        Title     NVARCHAR(200),
        ExamType  NVARCHAR(50),
        Description NVARCHAR(500),
        DueDate   DATETIME,
        Status    NVARCHAR(20)
    );

    INSERT INTO @ExamSeed VALUES
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

    -- Creator = GV phụ trách lớp (lấy UserId từ Teachers)
    INSERT INTO Exams (ClassId, UserId, Title, ExamType, Description, DueDate, Status)
    SELECT c.ClassId, t.UserId, es.Title, es.ExamType, es.Description, es.DueDate, es.Status
    FROM @ExamSeed es
    INNER JOIN Classes  c ON c.ClassCode  = es.ClassCode
    INNER JOIN Teachers t ON t.TeacherId  = c.TeacherId
    WHERE NOT EXISTS (
        SELECT 1 FROM Exams ex
        WHERE ex.ClassId = c.ClassId AND ex.Title = es.Title
    );

    -- Submissions: với mỗi exam, sinh submission cho ~70% học viên trong lớp
    INSERT INTO ExamSubmissions (ExamId, EnrollmentId, SubmittedAt, Note, Grade, Status)
    SELECT
        ex.ExamId,
        e.EnrollmentId,
        CASE
            WHEN ex.Status = N'Closed' THEN DATEADD(HOUR, -ABS(CHECKSUM(NEWID())) % 48, ex.DueDate)
            WHEN (e.EnrollmentId % 3) = 0 THEN DATEADD(HOUR, -ABS(CHECKSUM(NEWID())) % 24, ex.DueDate)
            ELSE NULL
        END AS SubmittedAt,
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
    WHERE c.ClassCode IN (SELECT ClassCode FROM @ClassSeed)
      AND (e.EnrollmentId % 10) < 7   -- ~70% sinh submission
      AND NOT EXISTS (
        SELECT 1 FROM ExamSubmissions sub
        WHERE sub.ExamId = ex.ExamId AND sub.EnrollmentId = e.EnrollmentId
      );

    /* =====================================================================
       STEP 11 · Notifications + NotificationRecipients
       ===================================================================== */
    -- Thông báo 1: Lịch thi giữa kỳ
    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Lịch thi giữa kỳ khoá Thu 2025')
    BEGIN
        DECLARE @NId1 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (
            @CashierId,
            N'Lịch thi giữa kỳ khoá Thu 2025',
            N'Kính gửi quý học viên, lịch thi giữa kỳ sẽ diễn ra từ 20/11 đến 30/11. Vui lòng kiểm tra lịch chi tiết trong mục Lịch thi.',
            '2025-11-05 09:00:00'
        );
        SET @NId1 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT @NId1, u.UserId, CAST(ABS(CHECKSUM(NEWID())) % 2 AS BIT)
        FROM Users u
        WHERE u.RoleId IN (@RoleStudent, @RoleTeacher);
    END;

    -- Thông báo 2: Bảo trì hệ thống
    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Bảo trì hệ thống CLASSES369')
    BEGIN
        DECLARE @NId2 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (
            @CashierId,
            N'Bảo trì hệ thống CLASSES369',
            N'Hệ thống sẽ bảo trì từ 00:00 - 03:00 sáng Chủ Nhật tuần này. Trong thời gian này, vui lòng không truy cập để tránh mất dữ liệu.',
            '2025-10-30 14:00:00'
        );
        SET @NId2 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT @NId2, u.UserId, 0
        FROM Users u
        WHERE u.Status = N'Active';
    END;

    -- Thông báo 3: Workshop nội bộ giáo viên
    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Workshop giáo viên: Active Learning')
    BEGIN
        DECLARE @NId3 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (
            @CashierId,
            N'Workshop giáo viên: Active Learning',
            N'Mời toàn thể giáo viên tham dự workshop "Active Learning" chiều Thứ 7 (08/11) tại phòng Hội thảo 301.',
            '2025-11-01 08:00:00'
        );
        SET @NId3 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT @NId3, u.UserId, 0
        FROM Users u
        WHERE u.RoleId = @RoleTeacher;
    END;

    -- Thông báo 4: Nhắc học phí sắp đến hạn
    IF NOT EXISTS (SELECT 1 FROM Notifications WHERE Title = N'Nhắc nhở học phí đợt tháng 11')
    BEGIN
        DECLARE @NId4 INT;
        INSERT INTO Notifications (CreatorId, Title, Content, CreatedDate)
        VALUES (
            @CashierId,
            N'Nhắc nhở học phí đợt tháng 11',
            N'Bạn còn một số khoản học phí chưa thanh toán. Vui lòng kiểm tra mục Học phí trong cổng học viên.',
            '2025-11-02 10:00:00'
        );
        SET @NId4 = SCOPE_IDENTITY();
        INSERT INTO NotificationRecipients (NotificationId, RecipientId, IsRead)
        SELECT DISTINCT @NId4, u.UserId, 0
        FROM Students s
        INNER JOIN Users u       ON u.UserId = s.UserId
        INNER JOIN Enrollments e ON e.StudentId = s.StudentId
        INNER JOIN Tuitions t    ON t.EnrollmentId = e.EnrollmentId
        WHERE t.Status IN (N'Pending', N'Overdue');
    END;

    /* =====================================================================
       STEP 12 · ActionLogs (nhật ký mẫu)
       ===================================================================== */
    INSERT INTO ActionLogs (UserId, Action, Details, LogDate)
    SELECT TOP 1 UserId, N'Bulk Seed', N'Khởi tạo dữ liệu mẫu: 15 GV + 35 SV + 12 lớp học.', GETDATE()
    FROM Users WHERE Username = N'admin'
    AND NOT EXISTS (SELECT 1 FROM ActionLogs WHERE Action = N'Bulk Seed');

    INSERT INTO ActionLogs (UserId, Action, Details, LogDate)
    SELECT TOP 1 UserId, N'Login',       N'Admin đăng nhập kiểm tra hệ thống.', DATEADD(HOUR, -3, GETDATE())
    FROM Users WHERE Username = N'admin';

    INSERT INTO ActionLogs (UserId, Action, Details, LogDate)
    SELECT TOP 1 UserId, N'Create Exam', N'Tạo bài kiểm tra giữa kỳ cho lớp API.K11.T24.', DATEADD(DAY, -2, GETDATE())
    FROM Users WHERE Username = N'hung.dq';

    INSERT INTO ActionLogs (UserId, Action, Details, LogDate)
    SELECT TOP 1 UserId, N'Update Scores', N'Nhập điểm chuyên cần cho lớp PYTHON.K16.T57.', DATEADD(DAY, -1, GETDATE())
    FROM Users WHERE Username = N'anh.dh';

    INSERT INTO ActionLogs (UserId, Action, Details, LogDate)
    SELECT TOP 1 UserId, N'Payment', N'Đóng học phí đợt 1 — SV023.', DATEADD(DAY, -4, GETDATE())
    FROM Users WHERE Username = N'han.hg';

    INSERT INTO ActionLogs (UserId, Action, Details, LogDate)
    SELECT TOP 1 UserId, N'Update Profile', N'Cập nhật số điện thoại liên hệ.', DATEADD(HOUR, -12, GETDATE())
    FROM Users WHERE Username = N'khoa.tm';

    /* =====================================================================
       STEP 13 · HomeNotices bổ sung
       ===================================================================== */
    IF NOT EXISTS (SELECT 1 FROM HomeNotices WHERE Title = N'Khai giảng khoá Java Enterprise K01')
        INSERT INTO HomeNotices (Title, Content, CreatedAt)
        VALUES (
            N'Khai giảng khoá Java Enterprise K01',
            N'Lớp Java Spring Boot K01 khai giảng vào 05/12. Ưu đãi giảm 10% cho 20 học viên đăng ký sớm.',
            '2025-11-05 09:00:00'
        );

    IF NOT EXISTS (SELECT 1 FROM HomeNotices WHERE Title = N'Workshop miễn phí: An toàn thông tin')
        INSERT INTO HomeNotices (Title, Content, CreatedAt)
        VALUES (
            N'Workshop miễn phí: An toàn thông tin',
            N'Diễn giả: Phan Văn Thắng (GV023). Thời gian: 14:00 Thứ 7 (15/11) tại Hội thảo 301.',
            '2025-11-03 10:00:00'
        );

    IF NOT EXISTS (SELECT 1 FROM HomeNotices WHERE Title = N'Chương trình học bổng "New Coder 2025"')
        INSERT INTO HomeNotices (Title, Content, CreatedAt)
        VALUES (
            N'Chương trình học bổng "New Coder 2025"',
            N'CLASSES369 trao 10 suất học bổng 50% cho học viên có kết quả xuất sắc học kỳ vừa qua. Hạn đăng ký: 20/11.',
            '2025-11-07 14:00:00'
        );

    /* =====================================================================
       STEP 14 · FeaturedTeachers bổ sung (từ đội ngũ giáo viên mới)
       ===================================================================== */
    IF NOT EXISTS (SELECT 1 FROM FeaturedTeachers WHERE Title = N'Bùi Thị Hồng Nhung')
        INSERT INTO FeaturedTeachers (TeacherId, Title, Summary, ImagePath, SortOrder, IsActive)
        SELECT t.TeacherId, N'Bùi Thị Hồng Nhung',
               N'Chuyên gia Java Enterprise, Spring Boot, Microservices, 8+ năm kinh nghiệm tại doanh nghiệp lớn.',
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
               N'Product Designer đang làm việc tại start-up công nghệ, mạnh về Figma và Design System.',
               N'/Images/huyen_ln.png', 9, 1
        FROM Teachers t WHERE t.TeacherCode = N'GV022';

    IF NOT EXISTS (SELECT 1 FROM FeaturedTeachers WHERE Title = N'Hoàng Minh Đức')
        INSERT INTO FeaturedTeachers (TeacherId, Title, Summary, ImagePath, SortOrder, IsActive)
        SELECT t.TeacherId, N'Hoàng Minh Đức',
               N'Nghiên cứu sinh Machine Learning, đồng tác giả nhiều bài báo AAAI/ICLR.',
               N'/Images/duc_hm.png', 10, 1
        FROM Teachers t WHERE t.TeacherCode = N'GV028';

    /* =====================================================================
       STEP 15 · Reports bổ sung
       ===================================================================== */
    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Báo cáo Doanh thu Tháng 10/2025')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (
            N'Báo cáo Doanh thu Tháng 10/2025',
            N'Tổng doanh thu: 84.750.000 VND. Tỷ lệ hoàn thành học phí: 68%. Khoản còn nợ: 39.500.000 VND.',
            '2025-11-01 08:30:00'
        );

    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Báo cáo tuyển sinh K26 - K27')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (
            N'Báo cáo tuyển sinh K26 - K27',
            N'Tổng học viên mới: 35. Khoá được quan tâm: Python AI (9 SV), React (7 SV), Java Enterprise (6 SV).',
            '2025-11-02 09:00:00'
        );

    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Khảo sát chất lượng giảng dạy Q3/2025')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (
            N'Khảo sát chất lượng giảng dạy Q3/2025',
            N'Điểm hài lòng trung bình: 4.7/5. Giáo viên nổi bật: Đinh Quang Hưng, Đặng Hoàng Huy, Hoàng Minh Đức.',
            '2025-10-28 15:00:00'
        );

    IF NOT EXISTS (SELECT 1 FROM Reports WHERE Title = N'Tình hình điểm danh tháng 10/2025')
        INSERT INTO Reports (Title, Description, CreatedAt)
        VALUES (
            N'Tình hình điểm danh tháng 10/2025',
            N'Tỷ lệ đi học đúng giờ: 82%. Đi muộn: 11%. Vắng: 7%. Lớp chuyên cần cao nhất: REACT.K6.T35.',
            '2025-11-03 11:30:00'
        );

    COMMIT TRAN;

    DECLARE
        @CntTeachers    INT = (SELECT COUNT(*) FROM Teachers),
        @CntStudents    INT = (SELECT COUNT(*) FROM Students),
        @CntClasses     INT = (SELECT COUNT(*) FROM Classes),
        @CntEnrollments INT = (SELECT COUNT(*) FROM Enrollments),
        @CntAttendances INT = (SELECT COUNT(*) FROM Attendances),
        @CntScores      INT = (SELECT COUNT(*) FROM Scores),
        @CntTuitions    INT = (SELECT COUNT(*) FROM Tuitions),
        @CntReceipts    INT = (SELECT COUNT(*) FROM Receipts),
        @CntExams       INT = (SELECT COUNT(*) FROM Exams),
        @CntSubs        INT = (SELECT COUNT(*) FROM ExamSubmissions),
        @CntNotif       INT = (SELECT COUNT(*) FROM Notifications),
        @CntNotifR      INT = (SELECT COUNT(*) FROM NotificationRecipients),
        @CntHome        INT = (SELECT COUNT(*) FROM HomeNotices),
        @CntFeat        INT = (SELECT COUNT(*) FROM FeaturedTeachers),
        @CntReports     INT = (SELECT COUNT(*) FROM Reports);

    PRINT N'=======================================================';
    PRINT N' BULK SEED — HOÀN TẤT';
    PRINT N'-------------------------------------------------------';
    PRINT N' Teachers:               ' + CAST(@CntTeachers    AS NVARCHAR(10));
    PRINT N' Students:               ' + CAST(@CntStudents    AS NVARCHAR(10));
    PRINT N' Classes:                ' + CAST(@CntClasses     AS NVARCHAR(10));
    PRINT N' Enrollments:            ' + CAST(@CntEnrollments AS NVARCHAR(10));
    PRINT N' Attendances:            ' + CAST(@CntAttendances AS NVARCHAR(10));
    PRINT N' Scores:                 ' + CAST(@CntScores      AS NVARCHAR(10));
    PRINT N' Tuitions:               ' + CAST(@CntTuitions    AS NVARCHAR(10));
    PRINT N' Receipts:               ' + CAST(@CntReceipts    AS NVARCHAR(10));
    PRINT N' Exams:                  ' + CAST(@CntExams       AS NVARCHAR(10));
    PRINT N' ExamSubmissions:        ' + CAST(@CntSubs        AS NVARCHAR(10));
    PRINT N' Notifications:          ' + CAST(@CntNotif       AS NVARCHAR(10));
    PRINT N' NotificationRecipients: ' + CAST(@CntNotifR      AS NVARCHAR(10));
    PRINT N' HomeNotices:            ' + CAST(@CntHome        AS NVARCHAR(10));
    PRINT N' FeaturedTeachers:       ' + CAST(@CntFeat        AS NVARCHAR(10));
    PRINT N' Reports:                ' + CAST(@CntReports     AS NVARCHAR(10));
    PRINT N'=======================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@Err, 16, 1);
END CATCH;
GO
