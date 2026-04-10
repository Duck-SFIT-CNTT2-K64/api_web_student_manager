-- =========================
-- CREATE DATABASE
-- =========================
CREATE DATABASE QLSV_TrungTamTinHoc_;
GO
USE QLSV_TrungTamTinHoc_;
GO

-- =========================
-- 1. STUDENTS
-- =========================
CREATE TABLE Students (
    StudentId INT IDENTITY PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) UNIQUE,
    Phone NVARCHAR(20),
    DateOfBirth DATE,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- =========================
-- 2. TEACHERS
-- =========================
CREATE TABLE Teachers (
    TeacherId INT IDENTITY PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) UNIQUE,
    Phone NVARCHAR(20),
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- =========================
-- 3. COURSES
-- =========================
CREATE TABLE Courses (
    CourseId INT IDENTITY PRIMARY KEY,
    CourseName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(255),
    Duration INT, -- số buổi / giờ
    Price DECIMAL(10,2),
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- =========================
-- 4. CLASSES
-- =========================
CREATE TABLE Classes (
    ClassId INT IDENTITY PRIMARY KEY,
    ClassName NVARCHAR(100) NOT NULL,
    CourseId INT NOT NULL,
    TeacherId INT NOT NULL,
    StartDate DATE,
    EndDate DATE,
    Status NVARCHAR(50) DEFAULT N'Đang mở',

    FOREIGN KEY (CourseId) REFERENCES Courses(CourseId),
    FOREIGN KEY (TeacherId) REFERENCES Teachers(TeacherId)
);

-- =========================
-- 5. ENROLLMENTS
-- =========================
CREATE TABLE Enrollments (
    EnrollmentId INT IDENTITY PRIMARY KEY,
    StudentId INT NOT NULL,
    ClassId INT NOT NULL,
    EnrollDate DATE DEFAULT GETDATE(),
    Status NVARCHAR(50) DEFAULT N'Đang học',

    FOREIGN KEY (StudentId) REFERENCES Students(StudentId) ON DELETE CASCADE,
    FOREIGN KEY (ClassId) REFERENCES Classes(ClassId) ON DELETE CASCADE,

    UNIQUE(StudentId, ClassId)
);

-- =========================
-- 6. PAYMENTS (HỌC PHÍ)
-- =========================
CREATE TABLE Payments (
    PaymentId INT IDENTITY PRIMARY KEY,
    StudentId INT NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    PaymentDate DATE DEFAULT GETDATE(),
    Method NVARCHAR(50), -- tiền mặt, chuyển khoản

    FOREIGN KEY (StudentId) REFERENCES Students(StudentId) ON DELETE CASCADE
);

-- =========================
-- 7. SCORES (ĐIỂM)
-- =========================
CREATE TABLE Scores (
    ScoreId INT IDENTITY PRIMARY KEY,
    EnrollmentId INT NOT NULL,
    Score FLOAT CHECK (Score >= 0 AND Score <= 10),
    ExamDate DATE DEFAULT GETDATE(),

    FOREIGN KEY (EnrollmentId) REFERENCES Enrollments(EnrollmentId) ON DELETE CASCADE
);

SELECT * FROM Students