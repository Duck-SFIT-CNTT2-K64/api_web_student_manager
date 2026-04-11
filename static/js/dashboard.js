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
    if (!value) {
        return "—";
    }
    return String(value).slice(0, 10);
}

function formatMoney(value) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("vi-VN").format(number) + " VNĐ";
}

function setMessage(element, text, type = "") {
    if (!element) {
        return;
    }
    element.textContent = text || "";
    element.classList.remove("success", "error");
    if (type) {
        element.classList.add(type);
    }
}

async function parseResponse(response) {
    const result = await response.json();
    if (!response.ok || result.success === false) {
        throw new Error(result.error || result.details || "Yêu cầu thất bại.");
    }
    return result.data ?? result;
}

async function getJson(url) {
    const response = await fetch(url);
    return parseResponse(response);
}

async function sendJson(url, method, payload) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parseResponse(response);
}

function readForm(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
        const trimmed = typeof value === "string" ? value.trim() : value;
        data[key] = trimmed === "" ? null : trimmed;
    });
    return data;
}

function setNumeric(payload, keys) {
    keys.forEach((key) => {
        if (payload[key] !== null && payload[key] !== undefined) {
            payload[key] = Number(payload[key]);
        }
    });
    return payload;
}

function badge(status) {
    const normalized = String(status || "").toLowerCase();
    let tone = "neutral";
    if (["paid", "active", "đang học", "enrolled", "present"].includes(normalized)) {
        tone = "good";
    } else if (["pending", "late", "bảo lưu"].includes(normalized)) {
        tone = "warn";
    } else if (["overdue", "inactive", "dropped", "absent", "đã nghỉ học"].includes(normalized)) {
        tone = "bad";
    }
    return `<span class="badge ${tone}">${escapeHtml(status || "—")}</span>`;
}

function fillSelect(select, items, valueKey, labelBuilder, includeEmpty = false) {
    if (!select) {
        return;
    }
    select.innerHTML = "";
    if (includeEmpty) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Không chọn";
        select.appendChild(option);
    }
    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item[valueKey];
        option.textContent = labelBuilder(item);
        select.appendChild(option);
    });
}

function renderStats() {
    const statsGrid = document.getElementById("statsGrid");
    const s = state.summary || {};
    const cards = [
        ["Sinh viên", s.TotalStudents, "fa-user-graduate", "blue"],
        ["Giảng viên", s.TotalTeachers, "fa-user-tie", "green"],
        ["Lớp học", s.TotalClasses, "fa-chalkboard", "amber"],
        ["Doanh thu", formatMoney(s.TotalRevenue), "fa-coins", "teal"],
        ["Công nợ", formatMoney(s.OutstandingTuition), "fa-hourglass-half", "red"],
        ["Thông báo", s.TotalNotifications, "fa-bell", "violet"],
    ];
    statsGrid.innerHTML = cards
        .map(([label, value, icon, tone]) => `
            <article class="stat-card ${tone}">
                <i class="fas ${icon}"></i>
                <div>
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value ?? 0)}</strong>
                </div>
            </article>
        `)
        .join("");

    document.getElementById("topCoursesList").innerHTML = (s.TopCourses || [])
        .map((item, index) => `
            <div class="rank-item">
                <span>${index + 1}</span>
                <div>
                    <strong>${escapeHtml(item.CourseName)}</strong>
                    <small>${escapeHtml(item.EnrollmentCount)} lượt ghi danh</small>
                </div>
            </div>
        `)
        .join("") || '<p class="empty">Chưa có dữ liệu ghi danh.</p>';

    document.getElementById("recentNotificationsList").innerHTML = (s.RecentNotifications || [])
        .map((item) => `
            <div class="rank-item">
                <span><i class="fas fa-bullhorn"></i></span>
                <div>
                    <strong>${escapeHtml(item.Title)}</strong>
                    <small>${formatDate(item.CreatedDate)} · ${escapeHtml(item.RecipientCount)} người nhận</small>
                </div>
            </div>
        `)
        .join("") || '<p class="empty">Chưa có thông báo.</p>';
}

function renderStudents() {
    const tbody = document.getElementById("studentsTableBody");
    tbody.innerHTML = state.students.map((student) => `
        <tr data-search="${escapeHtml(`${student.StudentCode} ${student.FullName} ${student.Email}`.toLowerCase())}">
            <td><strong>${escapeHtml(student.StudentCode)}</strong></td>
            <td>${escapeHtml(student.FullName)}</td>
            <td>${escapeHtml(student.Email)}</td>
            <td>${escapeHtml(student.PhoneNumber)}</td>
            <td>${badge(student.StatusName || student.AccountStatus)}</td>
            <td><button class="btn btn-ghost danger" data-delete-student="${student.StudentId}">Xóa</button></td>
        </tr>
    `).join("") || '<tr><td colspan="6" class="empty">Chưa có sinh viên.</td></tr>';
}

function renderCourses() {
    const tbody = document.getElementById("coursesTableBody");
    tbody.innerHTML = state.courses.map((course) => `
        <tr data-search="${escapeHtml(`${course.CourseCode} ${course.CourseName}`.toLowerCase())}">
            <td><strong>${escapeHtml(course.CourseCode)}</strong></td>
            <td>${escapeHtml(course.CourseName)}</td>
            <td>${escapeHtml(course.Duration)}</td>
            <td>${formatMoney(course.TuitionFee)}</td>
            <td>${escapeHtml(course.ClassCount)} lớp / ${escapeHtml(course.EnrollmentCount)} HV</td>
            <td><button class="btn btn-ghost danger" data-delete-course="${course.CourseId}">Xóa</button></td>
        </tr>
    `).join("") || '<tr><td colspan="6" class="empty">Chưa có khóa học.</td></tr>';
}

function renderClasses() {
    const tbody = document.getElementById("classesTableBody");
    tbody.innerHTML = state.classes.map((item) => `
        <tr>
            <td><strong>${escapeHtml(item.ClassCode)}</strong></td>
            <td>${escapeHtml(item.ClassName)}</td>
            <td>${escapeHtml(item.CourseName)}</td>
            <td>${escapeHtml(item.TeacherName || "Chưa phân công")}</td>
            <td>${escapeHtml(item.EnrollmentCount)} / ${escapeHtml(item.MaxStudents || "∞")}</td>
            <td><button class="btn btn-ghost danger" data-delete-class="${item.ClassId}">Xóa</button></td>
        </tr>
    `).join("") || '<tr><td colspan="6" class="empty">Chưa có lớp học.</td></tr>';
}

function renderEnrollments() {
    const tbody = document.getElementById("enrollmentsTableBody");
    tbody.innerHTML = state.enrollments.map((item) => `
        <tr>
            <td><strong>${escapeHtml(item.StudentCode)}</strong><br><small>${escapeHtml(item.StudentName)}</small></td>
            <td>${escapeHtml(item.ClassName)}</td>
            <td>${escapeHtml(item.CourseName)}</td>
            <td>${formatDate(item.EnrollmentDate)}</td>
            <td>${badge(item.TuitionStatus || "Pending")}</td>
        </tr>
    `).join("") || '<tr><td colspan="5" class="empty">Chưa có ghi danh.</td></tr>';
}

function renderTuitions() {
    const tbody = document.getElementById("tuitionsTableBody");
    tbody.innerHTML = state.tuitions.map((item) => `
        <tr>
            <td><strong>${escapeHtml(item.StudentCode)}</strong><br><small>${escapeHtml(item.StudentName)}</small></td>
            <td>${escapeHtml(item.ClassName)}</td>
            <td>${formatMoney(item.TotalFee)}</td>
            <td>${formatMoney(item.AmountPaid)}</td>
            <td>${formatMoney(item.RemainingAmount)}</td>
            <td>${badge(item.Status)}</td>
        </tr>
    `).join("") || '<tr><td colspan="6" class="empty">Chưa có khoản học phí.</td></tr>';
}

function renderScores() {
    const tbody = document.getElementById("scoresTableBody");
    tbody.innerHTML = state.scores.map((item) => `
        <tr>
            <td>${escapeHtml(item.StudentName)}<br><small>${escapeHtml(item.StudentCode)}</small></td>
            <td>${escapeHtml(item.ClassName)}</td>
            <td>${escapeHtml(item.ScoreTypeName)}</td>
            <td><strong>${escapeHtml(item.ScoreValue)}</strong></td>
        </tr>
    `).join("") || '<tr><td colspan="4" class="empty">Chưa có điểm.</td></tr>';
}

function renderNotifications() {
    const list = document.getElementById("notificationsList");
    list.innerHTML = state.notifications.map((item) => {
        const read = Number(item.ReadCount || 0);
        const total = Number(item.RecipientCount || 0);
        const percent = total > 0 ? Math.round((read * 100) / total) : 0;
        return `
            <article class="notice-card">
                <div>
                    <strong>${escapeHtml(item.Title)}</strong>
                    <small>${formatDate(item.CreatedDate)} · ${escapeHtml(item.CreatorName || "Hệ thống")}</small>
                </div>
                <p>${escapeHtml(item.Content || "")}</p>
                <span>${read}/${total} đã đọc · ${percent}%</span>
            </article>
        `;
    }).join("") || '<p class="empty">Chưa có thông báo.</p>';
}

function renderOptions() {
    fillSelect(
        document.getElementById("classCourseSelect"),
        state.courses,
        "CourseId",
        (item) => `${item.CourseCode} - ${item.CourseName}`
    );
    fillSelect(
        document.getElementById("classTeacherSelect"),
        state.teachers,
        "TeacherId",
        (item) => `${item.TeacherCode} - ${item.FullName}`,
        true
    );
    fillSelect(
        document.getElementById("enrollmentStudentSelect"),
        state.students,
        "StudentId",
        (item) => `${item.StudentCode} - ${item.FullName}`
    );
    fillSelect(
        document.getElementById("enrollmentClassSelect"),
        state.classes,
        "ClassId",
        (item) => `${item.ClassCode} - ${item.ClassName}`
    );
    fillSelect(
        document.getElementById("scoreEnrollmentSelect"),
        state.enrollments,
        "EnrollmentId",
        (item) => `${item.EnrollmentId} - ${item.StudentName} / ${item.ClassName}`
    );
    fillSelect(
        document.getElementById("scoreTypeSelect"),
        state.scoreTypes,
        "ScoreTypeId",
        (item) => `${item.ScoreTypeName} (${Number(item.Weight || 0) * 100}%)`
    );
    fillSelect(
        document.getElementById("paymentTuitionSelect"),
        state.tuitions.filter((item) => Number(item.RemainingAmount || 0) > 0),
        "TuitionId",
        (item) => `${item.StudentCode} - ${item.ClassName} còn ${formatMoney(item.RemainingAmount)}`
    );
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
        await Promise.all(Object.entries(endpoints).map(async ([key, url]) => {
            state[key] = await getJson(url);
        }));
        renderAll();
        setMessage(globalMessage, "Dữ liệu đã được cập nhật.", "success");
    } catch (error) {
        setMessage(globalMessage, error.message, "error");
    }
}

function bindForms() {
    document.getElementById("studentForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await sendJson("/api/students", "POST", readForm(form));
            form.reset();
            setMessage(document.getElementById("studentMessage"), "Đã thêm sinh viên.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("studentMessage"), error.message, "error");
        }
    });

    document.getElementById("courseForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            const payload = setNumeric(readForm(form), ["TuitionFee", "Credits"]);
            await sendJson("/api/courses", "POST", payload);
            form.reset();
            setMessage(document.getElementById("courseMessage"), "Đã thêm khóa học.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("courseMessage"), error.message, "error");
        }
    });

    document.getElementById("classForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            const payload = setNumeric(readForm(form), ["CourseId", "TeacherId", "MaxStudents"]);
            await sendJson("/api/classes", "POST", payload);
            form.reset();
            setMessage(document.getElementById("classMessage"), "Đã tạo lớp.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("classMessage"), error.message, "error");
        }
    });

    document.getElementById("enrollmentForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            const payload = setNumeric(readForm(form), ["StudentId", "ClassId"]);
            await sendJson("/api/enrollments", "POST", payload);
            form.reset();
            setMessage(document.getElementById("enrollmentMessage"), "Đã ghi danh và tạo học phí.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("enrollmentMessage"), error.message, "error");
        }
    });

    document.getElementById("paymentForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            const payload = setNumeric(readForm(form), ["TuitionId", "Amount"]);
            await sendJson("/api/payments", "POST", payload);
            form.reset();
            setDefaultPaymentDate();
            setMessage(document.getElementById("paymentMessage"), "Đã ghi nhận thanh toán.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("paymentMessage"), error.message, "error");
        }
    });

    document.getElementById("scoreForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            const payload = setNumeric(readForm(form), ["EnrollmentId", "ScoreTypeId", "ScoreValue"]);
            await sendJson("/api/scores", "POST", payload);
            form.reset();
            setMessage(document.getElementById("scoreMessage"), "Đã lưu điểm.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("scoreMessage"), error.message, "error");
        }
    });

    document.getElementById("notificationForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await sendJson("/api/notifications", "POST", readForm(form));
            form.reset();
            setMessage(document.getElementById("notificationMessage"), "Đã tạo thông báo.", "success");
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("notificationMessage"), error.message, "error");
        }
    });
}

function bindDeletes() {
    document.body.addEventListener("click", async (event) => {
        const studentButton = event.target.closest("[data-delete-student]");
        const courseButton = event.target.closest("[data-delete-course]");
        const classButton = event.target.closest("[data-delete-class]");
        const target = studentButton || courseButton || classButton;
        if (!target) {
            return;
        }

        const config = studentButton
            ? ["/api/students/", studentButton.dataset.deleteStudent, "sinh viên"]
            : courseButton
                ? ["/api/courses/", courseButton.dataset.deleteCourse, "khóa học"]
                : ["/api/classes/", classButton.dataset.deleteClass, "lớp học"];

        if (!window.confirm(`Xóa ${config[2]} này?`)) {
            return;
        }

        try {
            await fetch(config[0] + config[1], { method: "DELETE" }).then(parseResponse);
            setMessage(globalMessage, `Đã xóa ${config[2]}.`, "success");
            await loadAll();
        } catch (error) {
            setMessage(globalMessage, error.message, "error");
        }
    });
}

function bindSearch() {
    [
        ["studentSearch", "studentsTableBody"],
        ["courseSearch", "coursesTableBody"],
    ].forEach(([inputId, bodyId]) => {
        const input = document.getElementById(inputId);
        const tbody = document.getElementById(bodyId);
        input.addEventListener("input", () => {
            const query = input.value.toLowerCase();
            tbody.querySelectorAll("tr").forEach((row) => {
                const text = row.dataset.search || row.textContent.toLowerCase();
                row.hidden = query && !text.includes(query);
            });
        });
    });
}

function bindNavigation() {
    document.querySelectorAll(".side-nav a").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".side-nav a").forEach((item) => item.classList.remove("active"));
            link.classList.add("active");
        });
    });
}

function setDefaultPaymentDate() {
    const paymentDate = document.querySelector("#paymentForm input[name='PaymentDate']");
    if (paymentDate) {
        paymentDate.value = new Date().toISOString().slice(0, 10);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    bindForms();
    bindDeletes();
    bindSearch();
    bindNavigation();
    setDefaultPaymentDate();
    document.getElementById("refreshAll").addEventListener("click", loadAll);
    loadAll();
});
