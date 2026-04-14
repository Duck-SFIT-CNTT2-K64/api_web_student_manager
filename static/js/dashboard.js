const state = {
    summary: {},
    students: [],
    teachers: [],
    courses: [],
    classes: [],
    enrollments: [],
    tuitions: [],
    scores: [],
    scoreTypes: [],
    notifications: [],
};

const endpoints = {
    summary: "/api/reports/summary",
    students: "/api/students",
    teachers: "/api/teachers",
    courses: "/api/courses",
    classes: "/api/classes",
    enrollments: "/api/enrollments",
    tuitions: "/api/tuitions",
    scores: "/api/scores",
    scoreTypes: "/api/scores/types",
    notifications: "/api/notifications",
};

const globalMessage = document.getElementById("globalMessage");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {
    if (!value) return "—";
    return String(value).slice(0, 10);
}

function formatMoney(value) {
    var number = Number(value || 0);
    return new Intl.NumberFormat("vi-VN").format(number) + " VNĐ";
}

function setMessage(element, text, type) {
    if (!element) return;
    element.textContent = text || "";
    element.classList.remove("success", "error");
    if (type) element.classList.add(type);
}

async function parseResponse(response) {
    var result = await response.json();
    if (!response.ok || result.success === false) {
        throw new Error(result.error || result.details || "Yêu cầu thất bại.");
    }
    return result.data ?? result;
}

async function getJson(url) {
    var response = await fetch(url);
    return parseResponse(response);
}

async function sendJson(url, method, payload) {
    var response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parseResponse(response);
}

function readForm(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
        var trimmed = typeof value === "string" ? value.trim() : value;
        data[key] = trimmed === "" ? null : trimmed;
    });
    return data;
}

function setNumeric(payload, keys) {
    keys.forEach(function (key) {
        if (payload[key] !== null && payload[key] !== undefined) {
            payload[key] = Number(payload[key]);
        }
    });
    return payload;
}

function badge(status) {
    var normalized = String(status || "").toLowerCase();
    var tone = "neutral";
    if (["paid", "active", "đang học", "enrolled", "present"].includes(normalized)) {
        tone = "good";
    } else if (["pending", "late", "bảo lưu"].includes(normalized)) {
        tone = "warn";
    } else if (["overdue", "inactive", "dropped", "absent", "đã nghỉ học"].includes(normalized)) {
        tone = "bad";
    }
    return '<span class="badge ' + tone + '">' + escapeHtml(status || "—") + "</span>";
}

function fillSelect(select, items, valueKey, labelBuilder, includeEmpty) {
    if (!select) return;
    select.innerHTML = "";
    if (includeEmpty) {
        var option = document.createElement("option");
        option.value = "";
        option.textContent = "Không chọn";
        select.appendChild(option);
    }
    items.forEach(function (item) {
        var option = document.createElement("option");
        option.value = item[valueKey];
        option.textContent = labelBuilder(item);
        select.appendChild(option);
    });
}

function setFormEditMode(formId, titleId, editTitle, submitText) {
    var form = document.getElementById(formId);
    if (!form) return;
    document.getElementById(titleId).textContent = editTitle;
    form.querySelector(".submit-btn span").textContent = submitText;
    form.querySelector(".cancel-btn").style.display = "inline-flex";
}

function resetFormState(formId, titleId, baseTitle, submitText) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.reset();
    if (form.elements["EditId"]) form.elements["EditId"].value = "";
    document.getElementById(titleId).textContent = baseTitle;
    form.querySelector(".submit-btn span").textContent = submitText;
    form.querySelector(".cancel-btn").style.display = "none";
}

function renderStats() {
    var statsGrid = document.getElementById("statsGrid");
    var s = state.summary || {};
    var cards = [
        ["Sinh viên", s.TotalStudents, "fa-user-graduate", "blue"],
        ["Giảng viên", s.TotalTeachers, "fa-user-tie", "green"],
        ["Lớp học", s.TotalClasses, "fa-chalkboard", "amber"],
        ["Doanh thu", formatMoney(s.TotalRevenue), "fa-coins", "teal"],
        ["Công nợ", formatMoney(s.OutstandingTuition), "fa-hourglass-half", "red"],
        ["Thông báo", s.TotalNotifications, "fa-bell", "violet"],
    ];
    statsGrid.innerHTML = cards
        .map(function (c) {
            return '<article class="stat-card ' + c[3] + '">' +
                '<i class="fas ' + c[2] + '"></i>' +
                "<div><span>" + escapeHtml(c[0]) + "</span>" +
                "<strong>" + escapeHtml(c[1] ?? 0) + "</strong></div></article>";
        })
        .join("");

    document.getElementById("topCoursesList").innerHTML =
        (s.TopCourses || [])
            .map(function (item, index) {
                return '<div class="rank-item"><span>' + (index + 1) + "</span>" +
                    "<div><strong>" + escapeHtml(item.CourseName) + "</strong>" +
                    "<small>" + escapeHtml(item.EnrollmentCount) + " lượt ghi danh</small></div></div>";
            })
            .join("") || '<p class="empty">Chưa có dữ liệu ghi danh.</p>';

    document.getElementById("recentNotificationsList").innerHTML =
        (s.RecentNotifications || [])
            .map(function (item) {
                return '<div class="rank-item"><span><i class="fas fa-bullhorn"></i></span>' +
                    "<div><strong>" + escapeHtml(item.Title) + "</strong>" +
                    "<small>" + formatDate(item.CreatedDate) + " · " + escapeHtml(item.RecipientCount) + " người nhận</small></div></div>";
            })
            .join("") || '<p class="empty">Chưa có thông báo.</p>';
}

function renderStudents() {
    var tbody = document.getElementById("studentsTableBody");
    tbody.innerHTML =
        state.students
            .map(function (student) {
                return '<tr data-search="' + escapeHtml((student.StudentCode + " " + student.FullName + " " + student.Email).toLowerCase()) + '">' +
                    "<td><strong>" + escapeHtml(student.StudentCode) + "</strong></td>" +
                    "<td>" + escapeHtml(student.FullName) + "</td>" +
                    "<td>" + escapeHtml(student.Email) + "</td>" +
                    "<td>" + escapeHtml(student.PhoneNumber) + "</td>" +
                    "<td>" + badge(student.StatusName || student.AccountStatus) + "</td>" +
                    '<td style="white-space:nowrap">' +
                    '<button class="btn-icon edit" title="Sửa" data-edit-student="' + student.StudentId + '"><i class="fas fa-edit"></i></button> ' +
                    '<button class="btn-icon del" title="Xóa" data-delete-student="' + student.StudentId + '"><i class="fas fa-trash-alt"></i></button>' +
                    '</td></tr>';
            })
            .join("") || '<tr><td colspan="6" class="empty">Chưa có sinh viên.</td></tr>';
}

function renderCourses() {
    var tbody = document.getElementById("coursesTableBody");
    tbody.innerHTML =
        state.courses
            .map(function (course) {
                return '<tr data-search="' + escapeHtml((course.CourseCode + " " + course.CourseName).toLowerCase()) + '">' +
                    "<td><strong>" + escapeHtml(course.CourseCode) + "</strong></td>" +
                    "<td>" + escapeHtml(course.CourseName) + "</td>" +
                    "<td>" + escapeHtml(course.Duration) + "</td>" +
                    "<td>" + formatMoney(course.TuitionFee) + "</td>" +
                    "<td>" + escapeHtml(course.ClassCount) + " lớp / " + escapeHtml(course.EnrollmentCount) + " HV</td>" +
                    '<td style="white-space:nowrap">' +
                    '<button class="btn-icon edit" title="Sửa" data-edit-course="' + course.CourseId + '"><i class="fas fa-edit"></i></button> ' +
                    '<button class="btn-icon del" title="Xóa" data-delete-course="' + course.CourseId + '"><i class="fas fa-trash-alt"></i></button>' +
                    '</td></tr>';
            })
            .join("") || '<tr><td colspan="6" class="empty">Chưa có khóa học.</td></tr>';
}

function renderClasses() {
    var tbody = document.getElementById("classesTableBody");
    tbody.innerHTML =
        state.classes
            .map(function (item) {
                return '<tr data-search="' + escapeHtml((item.ClassCode + " " + item.ClassName + " " + item.CourseName + " " + (item.TeacherName || "")).toLowerCase()) + '">' +
                    "<td><strong>" + escapeHtml(item.ClassCode) + "</strong></td>" +
                    "<td>" + escapeHtml(item.ClassName) + "</td>" +
                    "<td>" + escapeHtml(item.CourseName) + "</td>" +
                    "<td>" + escapeHtml(item.TeacherName || "Chưa phân công") + "</td>" +
                    "<td>" + escapeHtml(item.EnrollmentCount) + " / " + escapeHtml(item.MaxStudents || "∞") + "</td>" +
                    '<td style="white-space:nowrap">' +
                    '<button class="btn-icon edit" title="Sửa" data-edit-class="' + item.ClassId + '"><i class="fas fa-edit"></i></button> ' +
                    '<button class="btn-icon del" title="Xóa" data-delete-class="' + item.ClassId + '"><i class="fas fa-trash-alt"></i></button>' +
                    '</td></tr>';
            })
            .join("") || '<tr><td colspan="6" class="empty">Chưa có lớp học.</td></tr>';
}

function renderEnrollments() {
    var tbody = document.getElementById("enrollmentsTableBody");
    tbody.innerHTML =
        state.enrollments
            .map(function (item) {
                return "<tr>" +
                    "<td><strong>" + escapeHtml(item.StudentCode) + "</strong><br><small>" + escapeHtml(item.StudentName) + "</small></td>" +
                    "<td>" + escapeHtml(item.ClassName) + "</td>" +
                    "<td>" + escapeHtml(item.CourseName) + "</td>" +
                    "<td>" + formatDate(item.EnrollmentDate) + "</td>" +
                    "<td>" + badge(item.TuitionStatus || "Pending") + "</td></tr>";
            })
            .join("") || '<tr><td colspan="5" class="empty">Chưa có ghi danh.</td></tr>';
}

function renderTuitions() {
    var tbody = document.getElementById("tuitionsTableBody");
    tbody.innerHTML =
        state.tuitions
            .map(function (item) {
                return "<tr>" +
                    "<td><strong>" + escapeHtml(item.StudentCode) + "</strong><br><small>" + escapeHtml(item.StudentName) + "</small></td>" +
                    "<td>" + escapeHtml(item.ClassName) + "</td>" +
                    "<td>" + formatMoney(item.TotalFee) + "</td>" +
                    "<td>" + formatMoney(item.AmountPaid) + "</td>" +
                    "<td>" + formatMoney(item.RemainingAmount) + "</td>" +
                    "<td>" + badge(item.Status) + "</td></tr>";
            })
            .join("") || '<tr><td colspan="6" class="empty">Chưa có khoản học phí.</td></tr>';
}

function renderScores() {
    var tbody = document.getElementById("scoresTableBody");
    tbody.innerHTML =
        state.scores
            .map(function (item) {
                return "<tr>" +
                    "<td>" + escapeHtml(item.StudentName) + "<br><small>" + escapeHtml(item.StudentCode) + "</small></td>" +
                    "<td>" + escapeHtml(item.ClassName) + "</td>" +
                    "<td>" + escapeHtml(item.ScoreTypeName) + "</td>" +
                    "<td><strong>" + escapeHtml(item.ScoreValue) + "</strong></td></tr>";
            })
            .join("") || '<tr><td colspan="4" class="empty">Chưa có điểm.</td></tr>';
}

function renderNotifications() {
    var list = document.getElementById("notificationsList");
    list.innerHTML =
        state.notifications
            .map(function (item) {
                var read = Number(item.ReadCount || 0);
                var total = Number(item.RecipientCount || 0);
                var percent = total > 0 ? Math.round((read * 100) / total) : 0;
                return '<article class="notice-card"><div>' +
                    "<strong>" + escapeHtml(item.Title) + "</strong>" +
                    "<small>" + formatDate(item.CreatedDate) + " · " + escapeHtml(item.CreatorName || "Hệ thống") + "</small></div>" +
                    "<p>" + escapeHtml(item.Content || "") + "</p>" +
                    "<span>" + read + "/" + total + " đã đọc · " + percent + "%</span></article>";
            })
            .join("") || '<p class="empty">Chưa có thông báo.</p>';
}

function renderOptions() {
    fillSelect(
        document.getElementById("classCourseSelect"),
        state.courses,
        "CourseId",
        function (item) { return item.CourseCode + " - " + item.CourseName; }
    );
    fillSelect(
        document.getElementById("classTeacherSelect"),
        state.teachers,
        "TeacherId",
        function (item) { return item.TeacherCode + " - " + item.FullName; },
        true
    );
    fillSelect(
        document.getElementById("enrollmentStudentSelect"),
        state.students,
        "StudentId",
        function (item) { return item.StudentCode + " - " + item.FullName; }
    );
    fillSelect(
        document.getElementById("enrollmentClassSelect"),
        state.classes,
        "ClassId",
        function (item) { return item.ClassCode + " - " + item.ClassName; }
    );
    fillSelect(
        document.getElementById("scoreEnrollmentSelect"),
        state.enrollments,
        "EnrollmentId",
        function (item) { return item.EnrollmentId + " - " + item.StudentName + " / " + item.ClassName; }
    );
    fillSelect(
        document.getElementById("scoreTypeSelect"),
        state.scoreTypes,
        "ScoreTypeId",
        function (item) { return item.ScoreTypeName + " (" + (Number(item.Weight || 0) * 100) + "%)"; }
    );
    fillSelect(
        document.getElementById("paymentTuitionSelect"),
        state.tuitions.filter(function (item) { return Number(item.RemainingAmount || 0) > 0; }),
        "TuitionId",
        function (item) { return item.StudentCode + " - " + item.ClassName + " còn " + formatMoney(item.RemainingAmount); }
    );

    syncPaymentAmountLimit();
}

function renderAll() {
    renderStats();
    renderStudents();
    renderCourses();
    renderClasses();
    renderEnrollments();
    renderTuitions();
    renderScores();
    renderNotifications();
    renderOptions();
}

async function loadAll() {
    setMessage(globalMessage, "Đang tải dữ liệu...");
    try {
        await Promise.all(
            Object.entries(endpoints).map(async function (entry) {
                state[entry[0]] = await getJson(entry[1]);
            })
        );
        renderAll();
        setMessage(globalMessage, "Dữ liệu đã được cập nhật.", "success");
    } catch (error) {
        setMessage(globalMessage, error.message, "error");
    }
}

function bindForms() {
    document.getElementById("studentForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var studentPayload = readForm(form);
            var editId = payload.EditId;

            var studentValidationError = validateStudentPayload(studentPayload, editId);
            if (studentValidationError) {
                throw new Error(studentValidationError);
            }

            if (editId) {
                await sendJson("/api/students/" + editId, "PUT", studentPayload);
                setMessage(document.getElementById("studentMessage"), "Đã cập nhật sinh viên.", "success");
                resetFormState("studentForm", "studentFormTitle", "Thêm sinh viên", "Lưu sinh viên");
            } else {
                await sendJson("/api/students", "POST", studentPayload);
                form.reset();
                setMessage(document.getElementById("studentMessage"), "Đã thêm sinh viên.", "success");
            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("studentMessage"), error.message, "error");
        }
    });

    document.getElementById("courseForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = readForm(form);
            var editId = payload.EditId;
            delete payload.EditId;
            setNumeric(payload, ["TuitionFee", "Credits"]);

            if (editId) {
                await sendJson("/api/courses/" + editId, "PUT", payload);
                setMessage(document.getElementById("courseMessage"), "Đã cập nhật khóa học.", "success");
                resetFormState("courseForm", "courseFormTitle", "Thêm khóa học", "Lưu khóa học");
            } else {
                await sendJson("/api/courses", "POST", payload);
                form.reset();
                setMessage(document.getElementById("courseMessage"), "Đã thêm khóa học.", "success");
            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("courseMessage"), error.message, "error");
        }
    });

    document.getElementById("classForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = readForm(form);
            var editId = payload.EditId;
            delete payload.EditId;
            setNumeric(payload, ["CourseId", "TeacherId", "MaxStudents"]);

            var classValidationError = validateClassPayload(payload, editId);
            if (classValidationError) {
                throw new Error(classValidationError);
            }

            if (editId) {
                await sendJson("/api/classes/" + editId, "PUT", payload);
                setMessage(document.getElementById("classMessage"), "Đã cập nhật lớp học.", "success");
                resetFormState("classForm", "classFormTitle", "Tạo lớp", "Lưu lớp");
            } else {
                await sendJson("/api/classes", "POST", payload);
                form.reset();
                setMessage(document.getElementById("classMessage"), "Đã tạo lớp.", "success");
            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("classMessage"), error.message, "error");
        }
    });

    document.getElementById("enrollmentForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = setNumeric(readForm(form), ["StudentId", "ClassId"]);
            var enrollmentValidationError = validateEnrollmentPayload(payload);
            if (enrollmentValidationError) {
                throw new Error(enrollmentValidationError);
            }

            await sendJson("/api/enrollments", "POST", payload);
            form.reset();
            setMessage(document.getElementById("enrollmentMessage"), "Đã ghi danh và tạo học phí.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("enrollmentMessage"), error.message, "error");
        }
    });

    document.getElementById("paymentForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = setNumeric(readForm(form), ["TuitionId", "Amount"]);
            var paymentValidationError = validatePaymentPayload(payload);
            if (paymentValidationError) {
                throw new Error(paymentValidationError);
            }

            await sendJson("/api/payments", "POST", payload);
            form.reset();
            setDefaultPaymentDate();
            setMessage(document.getElementById("paymentMessage"), "Đã ghi nhận thanh toán.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("paymentMessage"), error.message, "error");
        }
    });

    document.getElementById("scoreForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = setNumeric(readForm(form), ["EnrollmentId", "ScoreTypeId", "ScoreValue"]);
            var scoreError = validateScorePayload(payload);
            if (scoreError) {
                throw new Error(scoreError);
            }
            await sendJson("/api/scores", "POST", payload);
            form.reset();
            setMessage(document.getElementById("scoreMessage"), "Đã lưu điểm.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("scoreMessage"), error.message, "error");
        }
    });

    document.getElementById("notificationForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = readForm(form);
            var notificationValidationError = validateNotificationPayload(payload);
            if (notificationValidationError) {
                throw new Error(notificationValidationError);
            }
            await sendJson("/api/notifications", "POST", payload);
            form.reset();
            setMessage(document.getElementById("notificationMessage"), "Đã tạo thông báo.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("notificationMessage"), error.message, "error");
        }
    });
}

function bindDeletes() {
    document.body.addEventListener("click", async function (event) {
        var studentButton = event.target.closest("[data-delete-student]");
        var courseButton = event.target.closest("[data-delete-course]");
        var classButton = event.target.closest("[data-delete-class]");
        var target = studentButton || courseButton || classButton;
        if (!target) return;

        var config = studentButton
            ? ["/api/students/", studentButton.dataset.deleteStudent, "sinh viên"]
            : courseButton
                ? ["/api/courses/", courseButton.dataset.deleteCourse, "khóa học"]
                : ["/api/classes/", classButton.dataset.deleteClass, "lớp học"];

        if (!window.confirm("Xóa " + config[2] + " này?")) return;

        try {
            await fetch(config[0] + config[1], { method: "DELETE" }).then(parseResponse);
            setMessage(globalMessage, "Đã xóa " + config[2] + ".", "success");
            await loadAll();
        } catch (error) {
            setMessage(globalMessage, error.message, "error");
        }
    });
}

function bindEdits() {
    document.body.addEventListener("click", function (event) {
        var studentBtn = event.target.closest("[data-edit-student]");
        var courseBtn = event.target.closest("[data-edit-course]");
        var classBtn = event.target.closest("[data-edit-class]");

        if (studentBtn) {
            var id = Number(studentBtn.dataset.editStudent);
            var student = state.students.find(function (s) { return s.StudentId === id; });
            if (student) {
                var form = document.getElementById("studentForm");
                form.elements["EditId"].value = student.StudentId;
                form.elements["FullName"].value = student.FullName || "";
                form.elements["Email"].value = student.Email || "";
                form.elements["PhoneNumber"].value = student.PhoneNumber || "";
                if (student.DateOfBirth) {
                    form.elements["DateOfBirth"].value = String(student.DateOfBirth).slice(0, 10);
                } else {
                    form.elements["DateOfBirth"].value = "";
                }
                form.elements["Gender"].value = student.Gender || "";
                form.elements["Address"].value = student.Address || "";

                setFormEditMode("studentForm", "studentFormTitle", "Sửa sinh viên", "Cập nhật sinh viên");
                document.getElementById("studentFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        if (courseBtn) {
            var id = Number(courseBtn.dataset.editCourse);
            var course = state.courses.find(function (c) { return c.CourseId === id; });
            if (course) {
                var form = document.getElementById("courseForm");
                form.elements["EditId"].value = course.CourseId;
                form.elements["CourseCode"].value = course.CourseCode || "";
                form.elements["CourseName"].value = course.CourseName || "";
                form.elements["Duration"].value = course.Duration || "";
                form.elements["TuitionFee"].value = course.TuitionFee || 0;
                form.elements["Credits"].value = course.Credits || 0;
                form.elements["Description"].value = course.Description || "";

                setFormEditMode("courseForm", "courseFormTitle", "Sửa khóa học", "Cập nhật khóa học");
                document.getElementById("courseFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        if (classBtn) {
            var id = Number(classBtn.dataset.editClass);
            var cls = state.classes.find(function (c) { return c.ClassId === id; });
            if (cls) {
                var form = document.getElementById("classForm");
                form.elements["EditId"].value = cls.ClassId;
                form.elements["ClassCode"].value = cls.ClassCode || "";
                form.elements["ClassName"].value = cls.ClassName || "";
                form.elements["CourseId"].value = cls.CourseId || "";
                form.elements["TeacherId"].value = cls.TeacherId || "";
                form.elements["MaxStudents"].value = cls.MaxStudents || 30;

                setFormEditMode("classForm", "classFormTitle", "Sửa lớp", "Cập nhật lớp");
                document.getElementById("classFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    });

    document.querySelectorAll(".cancel-btn").forEach(function (btn) {
        btn.addEventListener("click", function (event) {
            var formId = event.target.closest("form").id;
            if (formId === "studentForm") resetFormState("studentForm", "studentFormTitle", "Thêm sinh viên", "Lưu sinh viên");
            if (formId === "courseForm") resetFormState("courseForm", "courseFormTitle", "Thêm khóa học", "Lưu khóa học");
            if (formId === "classForm") resetFormState("classForm", "classFormTitle", "Tạo lớp", "Lưu lớp");
        });
    });
}

let studentSearchTimer;
async function searchStudents(query) {
    try {
        let url = endpoints.students;
        if (query && query.trim() !== "") {
            url += `?q=${encodeURIComponent(query.trim())}`;
        }
        state.students = await getJson(url);
        renderStudents();
    } catch (error) {
        console.error("Error searching students:", error);
    }
}


function bindSearch() {
    const studentSearch = document.getElementById("studentSearch");
    if (studentSearch) {
        studentSearch.addEventListener("input", function () {
            clearTimeout(studentSearchTimer);
            studentSearchTimer = setTimeout(() => {
                searchStudents(studentSearch.value);
            }, 300);
        });
    }

    [
        //["studentSearch", "studentsTableBody"],
        ["courseSearch", "coursesTableBody"],
        ["classSearch", "classesTableBody"],
    ].forEach(function (pair) {
        var input = document.getElementById(pair[0]);
        var tbody = document.getElementById(pair[1]);
        if (!input || !tbody) return;
        input.addEventListener("input", function () {
            var query = input.value.toLowerCase();
            tbody.querySelectorAll("tr").forEach(function (row) {
                var text = row.dataset.search || row.textContent.toLowerCase();
                row.hidden = query && !text.includes(query);
            });
        });
    });
}

function bindNavigation() {
    var navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    if (!navItems.length) return;

    function normalizeDashboardHash(hash) {
        var fallback = "#overview";
        if (!hash || !hash.startsWith("#")) {
            return fallback;
        }
        if (!document.querySelector(hash)) {
            return fallback;
        }
        return hash;
    }

    function getNormalizedHashFromHref(href) {
        if (!href) return "";
        if (href.startsWith("#")) return href;
        if (href.startsWith("/dashboard#")) return "#" + href.split("#")[1];
        return "";
    }

    function applyDashboardActiveState() {
        var activeHash = normalizeDashboardHash(window.location.hash || "#overview");

        navItems.forEach(function (item) {
            var href = item.getAttribute("href") || "";
            var itemHash = getNormalizedHashFromHref(href);
            item.classList.remove("active");
            if (itemHash && itemHash === activeHash) {
                item.classList.add("active");
            }
        });

        document.querySelectorAll(".section").forEach(function (sec) {
            if ("#" + sec.id === activeHash) {
                sec.style.display = "block";
            } else {
                sec.style.display = "none";
            }
        });

        window.scrollTo(0, 0);
    }

    navItems.forEach(function (link) {
        link.addEventListener("click", function () {
            var href = link.getAttribute("href") || "";
            var itemHash = getNormalizedHashFromHref(href);
            if (itemHash) {
                window.setTimeout(applyDashboardActiveState, 0);
            }
        });
    });

    if (!window.location.hash || !document.querySelector(window.location.hash)) {
        history.replaceState(null, "", "#overview");
    }

    window.addEventListener("hashchange", applyDashboardActiveState);
    applyDashboardActiveState();
}

function validateStudentPayload(payload, editId) {
    var fullName = String(payload.FullName || "").trim();
    var email = String(payload.Email || "").trim().toLowerCase();
    var phone = String(payload.PhoneNumber || "").trim();

    // DÒNG TRUY VẾT: Để xem trình duyệt có nhận diện được bạn gõ gì không
    console.log("Dữ liệu SDT đang check là: ", phone);

    if (!fullName) return "Họ tên là bắt buộc.";
    if (fullName.length > 100) return "Họ tên không quá 100 ký tự.";

    if (!email) return "Email là bắt buộc.";
    if (email.length > 100) return "Email không quá 100 ký tự.";

    var emailExists = state.students.some(function (student) {
        if (editId && student.StudentId === Number(editId)) return false;
        return String(student.Email || "").trim().toLowerCase() === email;
    });
    if (emailExists) return "Email này đã được sử dụng.";

    // KIỂM TRA SỐ ĐIỆN THOẠI
    if (phone) {
        var phoneRegex = /^[0-9]{10,15}$/;
        if (!phoneRegex.test(phone)) {
            return "Số điện thoại không hợp lệ (Chỉ nhập số, từ 10-15 ký tự).";
        }
    }

    return "";


}
function validateCoursePayload(payload, EditId) {
    var courseCode = String(payload.CourseCode || "").trim().toLowerCase();
    var courseName = String(payload.CourseName || "").trim();
    var fee = Number(payload.TuitionFee || 0);

    if (!courseCode) return "Mã khóa học là bắt buộc.";
    if (courseCode.length > 20) return "Mã khóa học không quá 20 ký tự.";

    var codeExists = state.courses.some(function (c) {
        if (editId && c.CourseId === Number(editId)) return false;
        return String(c.CourseCode || "").trim().toLowerCase() === courseCode;
    });
    if (codeExists) return "Mã khóa học này đã tồn tại.";

    if (!courseName) return "Tên khóa học là bắt buộc.";
    if (courseName.length > 100) return "Tên khóa học không quá 100 ký tự.";

    if (fee < 0) return "Học phí không được là số âm.";

    return "";
}

function validateClassPayload(payload, editId) {
    var classCode = String(payload.ClassCode || "").trim().toLowerCase();
    var className = String(payload.ClassName || "").trim();
    var courseId = Number(payload.CourseId || 0);

    if (!classCode) {
        return "Mã lớp là bắt buộc.";
    }

    if (classCode.length > 20) {
        return "Mã lớp không được vượt quá 20 ký tự.";
    }

    if (!className) {
        return "Tên lớp là bắt buộc.";
    }

    if (className.length > 100) {
        return "Tên lớp không được vượt quá 100 ký tự.";
    }

    var exists = state.classes.some(function (item) {
        if (editId && item.ClassId === Number(editId)) return false;
        return String(item.ClassCode || "").trim().toLowerCase() === classCode;
    });

    if (exists) {
        return "Mã lớp đã tồn tại. Vui lòng dùng mã lớp khác.";
    }

    return "";
}

function validateEnrollmentPayload(payload) {
    var studentId = Number(payload.StudentId || 0);
    var classId = Number(payload.ClassId || 0);
    if (!studentId || !classId) {
        return "Vui lòng chọn sinh viên và lớp hợp lệ.";
    }

    var exists = state.enrollments.some(function (item) {
        return Number(item.StudentId) === studentId && Number(item.ClassId) === classId;
    });

    if (exists) {
        return "Sinh viên đã ghi danh lớp này.";
    }

    return "";
}

function validatePaymentPayload(payload) {
    var tuitionId = Number(payload.TuitionId || 0);
    var amount = Number(payload.Amount || 0);
    if (!tuitionId) {
        return "Vui lòng chọn khoản học phí cần thanh toán.";
    }
    if (!amount) {
        return "Vui lòng nhập số tiền cần thanh toán.";
    }
    if (amount <= 0) {
        return "Số tiền thanh toán phải lớn hơn 0.";
    }

    var tuition = state.tuitions.find(function (item) {
        return Number(item.TuitionId) === tuitionId;
    });

    if (!tuition) {
        return "Khoản học phí không tồn tại hoặc đã thanh toán đủ.";
    }

    var remaining = Number(tuition.RemainingAmount || 0);
    if (amount > remaining) {
        return "Số tiền nhập vượt quá số còn lại (" + formatMoney(remaining) + ").";
    }

    return "";
}

function validateScorePayload(payload, editId) {
    var enrollmentId = Number(payload.EnrollmentId || 0);
    var scoreTypeId = Number(payload.ScoreTypeId || 0);
    var scoreValue = payload.ScoreValue;

    if (!enrollmentId) return "Vui lòng chọn sinh viên cần nhập điểm.";
    if (!scoreTypeId) return "Vui lòng chọn loại điểm.";

    if (scoreValue === null || scoreValue === undefined || scoreValue === "") {
        return "Vui lòng nhập số điểm.";
    }

    scoreValue = Number(scoreValue);
    if (scoreValue < 0 || scoreValue > 10) {
        return "Điểm số phải nằm trong khoảng từ 0 đến 10.";
    }

    return "";
}

function validateNotificationPayload(payload) {
    var title = String(payload.Title || "").trim();
    var content = String(payload.Content || "").trim();

    if (!title) return "Tiêu đề thông báo là bắt buộc.";
    if (title.length > 200) return "Tiêu đề không được vượt quá 200 ký tự.";
    if (!content) return "Nội dung thông báo không được để trống.";

    return "";
}


function syncPaymentAmountLimit() {
    var select = document.getElementById("paymentTuitionSelect");
    var amountInput = document.querySelector("#paymentForm input[name='Amount']");
    if (!select || !amountInput) return;

    var tuitionId = Number(select.value || 0);
    var tuition = state.tuitions.find(function (item) {
        return Number(item.TuitionId) === tuitionId;
    });

    if (!tuition) {
        amountInput.removeAttribute("max");
        amountInput.placeholder = "Nhập số tiền";
        return;
    }

    var remaining = Math.max(0, Number(tuition.RemainingAmount || 0));
    amountInput.max = String(remaining);
    amountInput.placeholder = "Tối đa " + formatMoney(remaining);
}

function setDefaultPaymentDate() {
    var paymentDate = document.querySelector("#paymentForm input[name='PaymentDate']");
    if (paymentDate) {
        paymentDate.value = new Date().toISOString().slice(0, 10);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    bindForms();
    bindDeletes();
    bindEdits();
    bindSearch();
    bindNavigation();
    setDefaultPaymentDate();

    var refreshBtn = document.getElementById("refreshAll");
    if (refreshBtn) refreshBtn.addEventListener("click", loadAll);

    var paymentTuitionSelect = document.getElementById("paymentTuitionSelect");
    if (paymentTuitionSelect) {
        paymentTuitionSelect.addEventListener("change", syncPaymentAmountLimit);
    }

    loadAll();

});
