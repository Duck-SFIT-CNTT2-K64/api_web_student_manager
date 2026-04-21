const state = {
    summary: {},
    students: [],
    teachers: [],
    courses: [],
    classes: [],
    rooms: [],
    enrollments: [],
    tuitions: [],
    scores: [],
    scoreTypes: [],
    notifications: [],
    users: [],
    class_schedules: [],
    me: null,
};

const endpoints = {
    summary: "/api/reports/summary",
    students: "/api/students",
    teachers: "/api/teachers",
    courses: "/api/courses",
    classes: "/api/classes",
    rooms: "/api/rooms",
    enrollments: "/api/enrollments",
    tuitions: "/api/tuitions",
    scores: "/api/scores",
    scoreTypes: "/api/scores/types",
    notifications: "/api/notifications",
    users: "/api/users",
    class_schedules: "/api/schedules",
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

function showCredentialModal(teacherName, username, password) {
    // Xóa modal cũ nếu có
    var old = document.getElementById("credentialModal");
    if (old) old.remove();

    var modal = document.createElement("div");
    modal.id = "credentialModal";
    modal.style.cssText = [
        "position:fixed", "inset:0", "z-index:9999",
        "display:flex", "align-items:center", "justify-content:center",
        "background:rgba(0,0,0,.55)", "backdrop-filter:blur(4px)",
        "animation:fadeIn .2s ease"
    ].join(";");

    modal.innerHTML =
        '<div style="background:var(--surface,#1e2433);border:1px solid var(--border,#2d3550);border-radius:16px;padding:32px 36px;max-width:420px;width:90%;box-shadow:0 24px 60px rgba(0,0,0,.5);position:relative">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
        '<span style="font-size:2rem">\uD83C\uDF93</span>' +
        '<div><strong style="font-size:1.05rem;color:var(--text,#e2e8f0)">Tài khoản đăng nhập</strong>' +
        '<br><small style="color:var(--text-muted,#94a3b8)">' + escapeHtml(teacherName) + '</small></div>' +
        '</div>' +
        '<div style="background:var(--surface-alt,#151929);border-radius:10px;padding:16px 18px;margin-bottom:20px;font-family:monospace;font-size:.95rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<span style="color:var(--text-muted,#94a3b8);font-size:.8rem">USERNAME</span>' +
        '<strong id="credUsername" style="color:var(--primary,#6366f1);letter-spacing:.5px">' + escapeHtml(username) + '</strong>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<span style="color:var(--text-muted,#94a3b8);font-size:.8rem">MẬT KHẨU</span>' +
        '<strong id="credPassword" style="color:var(--success,#22c55e);letter-spacing:.5px">' + escapeHtml(password) + '</strong>' +
        '</div>' +
        '</div>' +
        '<p style="font-size:.8rem;color:var(--text-muted,#94a3b8);margin-bottom:18px">\u26a0\uFE0F Sao chép và gửi cho người dùng</p>' +
        '<div style="display:flex;gap:10px">' +
        '<button id="credCopyBtn" style="flex:1;padding:9px 0;border-radius:8px;border:none;background:var(--primary,#6366f1);color:#fff;cursor:pointer;font-size:.9rem"><i class="fas fa-copy"></i> Sao chép</button>' +
        '<button id="credCloseBtn" style="flex:1;padding:9px 0;border-radius:8px;border:1px solid var(--border,#2d3550);background:transparent;color:var(--text,#e2e8f0);cursor:pointer;font-size:.9rem">\u0110óng</button>' +
        '</div>' +
        '</div>';

    document.body.appendChild(modal);

    document.getElementById("credCopyBtn").addEventListener("click", function () {
        var text = "Username: " + username + "\n" + "Mật khẩu: " + password;
        navigator.clipboard.writeText(text).then(function () {
            document.getElementById("credCopyBtn").textContent = "\u2713 Đã sao chép!";
        });
    });

    function closeModal() { modal.remove(); }
    document.getElementById("credCloseBtn").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
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
    if (formId === "teacherForm" && form.elements["Password"]) {
        form.elements["Password"].placeholder = "Mặc định: Teacher@123";
    }
}

function renderStats() {
    var statsGrid = document.getElementById("statsGrid");
    if (!statsGrid) return;
    var s = state.summary || {};
    var cards = [
        ["Sinh viên", s.TotalStudents, "fa-user-graduate", "gc-blue"],
        ["Giảng viên", s.TotalTeachers, "fa-user-tie", "gc-green"],
        ["Lớp học", s.TotalClasses, "fa-chalkboard", "gc-amber"],
        ["Doanh thu", formatMoney(s.TotalRevenue), "fa-coins", "gc-teal"],
        ["Công nợ", formatMoney(s.OutstandingTuition), "fa-hourglass-half", "gc-red"],
        ["Thông báo", s.TotalNotifications, "fa-bell", "gc-violet"],
    ];
    statsGrid.innerHTML = cards
        .map(function (c) {
            return '<article class="gradient-card ' + c[3] + '">' +
                '<div class="gc-icon"><i class="fas ' + c[2] + '"></i></div>' +
                '<div class="gc-content"><span>' + escapeHtml(c[0]) + "</span>" +
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

    // Vẽ biểu đồ
    renderCharts();
}

function renderStudents() {
    var tbody = document.getElementById("studentsTableBody");
    tbody.innerHTML =
        state.students
            .map(function (student) {
                //kiem tra xem sinh vien da co UserId chua
                var btnGenerateAccount = !student.UserId
                    ? '<button class="btn-icon" style="color:var(--primary)" title="Cấp tài khoản tự động" data-generate-account="' + student.StudentId + '"><i class="fas fa-user-plus"></i></button> '
                    : '<span title="Đã có tài khoản" style="color:var(--success);display:inline-block;padding:6px;font-size:.9rem"><i class="fas fa-check-circle"></i></span> ';
                return '<tr data-search="' + escapeHtml((student.StudentCode + " " + student.FullName + " " + student.Email).toLowerCase()) + '">' +
                    "<td><strong>" + escapeHtml(student.StudentCode) + "</strong></td>" +
                    "<td>" + escapeHtml(student.FullName) + "</td>" +
                    "<td>" + escapeHtml(student.Email) + "</td>" +
                    "<td>" + escapeHtml(student.PhoneNumber) + "</td>" +
                    "<td>" + badge(student.StatusName || student.AccountStatus) + "</td>" +
                    "<td>" + btnGenerateAccount + "</td>" +
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

function renderRooms() {
    var tbody = document.getElementById("roomsTableBody");
    if (!tbody) return;
    tbody.innerHTML =
        state.rooms
            .map(function (r) {
                return '<tr data-search="' + escapeHtml(r.RoomName).toLowerCase() + '">' +
                    "<td><strong>" + escapeHtml(r.RoomName) + "</strong></td>" +
                    "<td>" + (r.Capacity || 0) + " chỗ</td>" +
                    '<td style="white-space:nowrap">' +
                    '<button class="btn-icon edit" title="Sửa" data-edit-room="' + r.RoomId + '"><i class="fas fa-edit"></i></button> ' +
                    '<button class="btn-icon del" title="Xóa" data-delete-room="' + r.RoomId + '"><i class="fas fa-trash-alt"></i></button>' +
                    '</td></tr>';
            })
            .join("") || '<tr><td colspan="3" class="empty">Chưa có phòng học.</td></tr>';
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
                    "<td>" + escapeHtml(item.CourseName) + "</td>" +
                    "<td>" + escapeHtml(item.ScoreTypeName) + "</td>" +
                    "<td><strong>" + escapeHtml(item.ScoreValue) + "</strong></td>" +
                    '<td style="white-space:nowrap">' +
                    '<button class="btn-icon edit" title="Sửa" data-edit-score="' + item.ScoreId + '"><i class="fas fa-edit"></i></button> ' +
                    '<button class="btn-icon del" title="Xóa" data-delete-score="' + item.ScoreId + '"><i class="fas fa-trash-alt"></i></button>' +
                    '</td></tr>';
            })
            .join("") || '<tr><td colspan="6" class="empty">Chưa có điểm.</td></tr>';
}

function renderTeachers() {
    var tbody = document.getElementById("teachersTableBody");
    if (!tbody) return;
    tbody.innerHTML =
        state.teachers
            .map(function (t) {
                var searchText = escapeHtml((t.TeacherCode + " " + t.FullName + " " + t.Email + " " + (t.Specialization || "")).toLowerCase());
                var btnGenerateAccount = !t.UserId
                    ? '<button class="btn-icon" style="color:var(--primary)" title="Cấp tài khoản tự động" data-generate-teacher-account="' + t.TeacherId + '"><i class="fas fa-user-plus"></i></button> '
                    : '<span title="Đã có tài khoản" style="color:var(--success);display:inline-block;padding:6px;font-size:.9rem"><i class="fas fa-check-circle"></i></span> ';

                return '<tr data-search="' + searchText + '">' +
                    "<td><strong>" + escapeHtml(t.TeacherCode) + "</strong></td>" +
                    "<td>" + escapeHtml(t.FullName) + "</td>" +
                    "<td>" + escapeHtml(t.Email) + "</td>" +
                    "<td>" + escapeHtml(t.Specialization || "—") + "</td>" +
                    "<td>" + escapeHtml(t.ClassCount || 0) + " lớp / " + escapeHtml(t.StudentCount || 0) + " HV</td>" +
                    "<td>" + badge(t.AccountStatus) + "</td>" +
                    "<td>" + btnGenerateAccount + "</td>" +
                    '<td style="white-space:nowrap">' +
                    '<button class="btn-icon edit" title="Sửa" data-edit-teacher="' + t.TeacherId + '"><i class="fas fa-edit"></i></button> ' +
                    '<button class="btn-icon del" title="Xóa" data-delete-teacher="' + t.TeacherId + '"><i class="fas fa-trash-alt"></i></button>' +
                    '</td></tr>';
            })
            .join("") || '<tr><td colspan="7" class="empty">Chưa có giảng viên.</td></tr>';
}

function renderNotifications() {
    var list = document.getElementById("notificationsList");
    list.innerHTML =
        state.notifications
            .map(function (item) {
                var read = Number(item.ReadCount || 0);
                var total = Number(item.RecipientCount || 0);
                var percent = total > 0 ? Math.round((read * 100) / total) : 0;
                return '<article class="notice-card" style="position:relative"><div>' +
                    "<strong>" + escapeHtml(item.Title) + "</strong>" +
                    "<small>" + formatDate(item.CreatedDate) + " · " + escapeHtml(item.CreatorName || "Hệ thống") + "</small></div>" +
                    "<p>" + escapeHtml(item.Content || "") + "</p>" +
                    "<span>" + read + "/" + total + " đã đọc · " + percent + "%</span>" +
                    '<div style="position:absolute;top:10px;right:10px;display:flex;gap:5px">' +
                    '<button class="btn-icon edit" title="Sửa" data-edit-notification="' + item.NotificationId + '"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn-icon del" title="Xóa" data-delete-notification="' + item.NotificationId + '"><i class="fas fa-trash-alt"></i></button>' +
                    '</div></article>';
            })
            .join("") || '<p class="empty">Chưa có thông báo.</p>';
}

function renderUsers() {
    var tbody = document.getElementById("usersTableBody");
    if (!tbody) return;
    var roleColors = { "Admin": "#6366f1", "Teacher": "#22c55e", "Student": "#38bdf8" };
    tbody.innerHTML = state.users.map(function (u) {
        var isActive = String(u.Status || "").toLowerCase() === "active";
        var roleColor = roleColors[u.RoleName] || "#94a3b8";
        var toggleLabel = isActive ? "Khóa" : "Mở";
        var toggleIcon = isActive ? "fa-lock" : "fa-lock-open";
        var toggleClass = isActive ? "btn-icon del" : "btn-icon edit";

        // Chỉ hiện nút sửa vai trò nếu user đó KHÔNG PHẢI là tài khoản đang đăng nhập
        var currentMeId = state.me ? String(state.me.UserId || state.me.userid || "") : "";
        var rowUserId = String(u.UserId || "");
        var isSelf = currentMeId !== "" && currentMeId === rowUserId;

        if (isSelf) console.log("Detected self: ", u.Username, "ID:", rowUserId);

        var roleEditBtn = isSelf ? "" : (" <button class='btn-icon edit-role' title='Sửa vai trò' data-user-role='" + u.UserId + "' data-current-role='" + u.RoleId + "'><i class='fas fa-pen'></i></button>");

        return "<tr data-search='" + escapeHtml((u.Username + " " + (u.FullName || "") + " " + (u.Email || "")).toLowerCase()) + "' data-role='" + escapeHtml(u.RoleName || "") + "'>" +
            "<td><strong>" + escapeHtml(u.Username) + "</strong></td>" +
            "<td>" + escapeHtml(u.FullName || "—") + "<br>" + escapeHtml(u.PhoneNumber || "—") + "<br>" + escapeHtml(u.Email || "—") + "</td>" +
            "<td><span style='background:" + roleColor + "22;color:" + roleColor + ";padding:3px 10px;border-radius:20px;font-size:.8rem;font-weight:600'>" + escapeHtml(u.RoleName || "—") + "</span>" +
            roleEditBtn + "</td>" +
            "<td>" + badge(u.Status) + "</td>" +
            "<td style='white-space:nowrap'>" +
            "<button class='btn-icon edit' title='Đổi mật khẩu' data-user-pwd='" + u.UserId + "' data-user-name='" + escapeHtml(u.FullName || u.Username) + "'><i class='fas fa-key'></i></button> " +
            "<button class='" + toggleClass + "' title='" + toggleLabel + "' data-user-toggle='" + u.UserId + "' data-user-status='" + (isActive ? "Inactive" : "Active") + "'><i class='fas " + toggleIcon + "'></i></button>" +
            "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="empty">Chưa có tài khoản.</td></tr>';
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

    fillSelect(
        document.getElementById("class_scheduleClassSelect"),
        state.classes,
        "ClassId",
        function (item) { return item.ClassCode + " - " + item.ClassName; }
    );
    fillSelect(
        document.getElementById("class_scheduleRoomSelect"),
        state.rooms,
        "RoomId",
        function (item) { return item.RoomName; },
        true
    );

    syncPaymentAmountLimit();
}

function renderAll() {
    renderStats();
    renderStudents();
    renderTeachers();
    renderCourses();
    renderClasses();
    renderRooms();
    renderEnrollments();
    renderTuitions();
    renderScores();
    renderNotifications();
    renderUsers();
    renderClassSchedules();
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
        // Lấy thêm thông tin tài khoản hiện tại
        state.me = await getJson("/api/auth/me");
        console.log("Current User (state.me):", state.me);

        renderAll();
        setMessage(globalMessage, "Dữ liệu đã được cập nhật.", "success");
    } catch (error) {
        setMessage(globalMessage, error.message, "error");
    }
}

function bindForms() {
    var studentFormEl = document.getElementById("studentForm");
    if (studentFormEl) studentFormEl.addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var studentPayload = readForm(form);
            var editId = studentPayload.EditId;
            delete studentPayload.EditId;

            var studentValidationError = validateStudentPayload(studentPayload, editId);
            if (studentValidationError) {
                throw new Error(studentValidationError);
            }

            if (editId) {
                await sendJson("/api/students/" + editId, "PUT", studentPayload);
                setMessage(document.getElementById("studentMessage"), "Đã cập nhật sinh viên.", "success");
                resetFormState("studentForm", "studentFormTitle", "Thêm sinh viên", "Lưu sinh viên");
            } else {
                const newStudent = await sendJson("/api/students", "POST", studentPayload);
                form.reset();
                setMessage(document.getElementById("studentMessage"), "Đã thêm sinh viên.", "success");

                if (newStudent && newStudent._loginUsername && newStudent._loginPassword) {
                    showCredentialModal(
                        newStudent.FullName,
                        newStudent._loginUsername,
                        newStudent._loginPassword
                    );
                }

            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("studentMessage"), error.message, "error");
        }
    });

    function generateUsername(lastName, firstName) {
        if (!lastName && !firstName) return "";
        var normalize = function (str) {
            return str.normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/Đ/g, "D")
                .toLowerCase();
        };
        var words = normalize(lastName).split(/\s+/).filter(Boolean);
        var initials = words.map(function (w) { return w[0]; }).join('');
        var fname = normalize(firstName).replace(/\s+/g, '');
        return initials + fname;
    }

    var teacherFormEl = document.getElementById("teacherForm");
    if (teacherFormEl) {
        teacherFormEl.addEventListener("submit", async function (event) {
            event.preventDefault();
            var form = event.currentTarget;
            try {
                var payload = readForm(form);
                var editId = payload.EditId;
                delete payload.EditId;

                var teacherValidationError = validateTeacherPayload(payload, editId);
                if (teacherValidationError) {
                    throw new Error(teacherValidationError);
                }

                if (editId) {
                    await sendJson("/api/teachers/" + editId, "PUT", payload);
                    setMessage(document.getElementById("teacherMessage"), "Đã cập nhật giảng viên.", "success");
                    resetFormState("teacherForm", "teacherFormTitle", "Thêm giảng viên", "Lưu giảng viên");
                } else {
                    var createdTeacher = await sendJson("/api/teachers", "POST", payload);
                    form.reset();
                    setMessage(document.getElementById("teacherMessage"), "Đã thêm giảng viên.", "success");
                    // Hiển thị modal thông tin đăng nhập
                    var fullName = (payload.LastName || "") + " " + (payload.FirstName || "");
                    showCredentialModal(
                        fullName.trim(),
                        createdTeacher._loginUsername || "(không rõ)",
                        createdTeacher._loginPassword || "Teacher@123"
                    );
                }
                await loadAll();
            } catch (error) {
                setMessage(document.getElementById("teacherMessage"), error.message, "error");
            }
        });
    }

    var courseFormEl = document.getElementById("courseForm");
    if (courseFormEl) courseFormEl.addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = readForm(form);
            var editId = payload.EditId;
            delete payload.EditId;
            setNumeric(payload, ["TuitionFee", "Credits"]);

            var courseValidationError = validateCoursePayload(payload, editId);
            if (courseValidationError) {
                throw new Error(courseValidationError);
            }

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

    var classFormEl = document.getElementById("classForm");
    if (classFormEl) classFormEl.addEventListener("submit", async function (event) {
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

    var roomFormEl = document.getElementById("roomForm");
    if (roomFormEl) roomFormEl.addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = readForm(form);
            payload = setNumeric(payload, ["Capacity"]);
            var editId = payload.EditId;
            delete payload.EditId;

            if (!payload.RoomName) throw new Error("Tên phòng là bắt buộc.");
            if (payload.Capacity <= 0) throw new Error("Sức chứa phải lớn hơn 0.");

            if (editId) {
                await sendJson("/api/rooms/" + editId, "PUT", payload);
                setMessage(document.getElementById("roomMessage"), "Đã cập nhật phòng.", "success");
                resetFormState("roomForm", "roomFormTitle", "Thêm phòng học", "Lưu phòng");
            } else {
                await sendJson("/api/rooms", "POST", payload);
                form.reset();
                setMessage(document.getElementById("roomMessage"), "Đã thêm phòng học.", "success");
            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("roomMessage"), error.message, "error");
        }
    });

    var enrollmentFormEl = document.getElementById("enrollmentForm");
    if (enrollmentFormEl) enrollmentFormEl.addEventListener("submit", async function (event) {
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

    var paymentFormEl = document.getElementById("paymentForm");
    if (paymentFormEl) paymentFormEl.addEventListener("submit", async function (event) {
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

    var scoreFormEl = document.getElementById("scoreForm");
    if (scoreFormEl) scoreFormEl.addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            // Because EnrollmentId might be disabled during edit and readForm ignores disabled fields, we collect it manually if editId is present
            var payload = readForm(form);
            if (form.elements["EnrollmentId"].disabled) {
                payload["EnrollmentId"] = form.elements["EnrollmentId"].value;
            }
            payload = setNumeric(payload, ["EnrollmentId", "ScoreTypeId", "ScoreValue"]);
            var editId = payload.EditId;
            delete payload.EditId;

            var scoreError = validateScorePayload(payload);
            if (scoreError) {
                throw new Error(scoreError);
            }
            if (editId) {
                await sendJson("/api/scores/" + editId, "PUT", payload);
                setMessage(document.getElementById("scoreMessage"), "Đã cập nhật điểm.", "success");
                form.elements["EnrollmentId"].disabled = false;
                resetFormState("scoreForm", "scoreFormTitle", "Thêm điểm", "Lưu điểm");
            } else {
                await sendJson("/api/scores", "POST", payload);
                form.reset();
                setMessage(document.getElementById("scoreMessage"), "Đã lưu điểm.", "success");
            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("scoreMessage"), error.message, "error");
        }
    });

    var class_scheduleFormEl = document.getElementById("class_scheduleForm");
    if (class_scheduleFormEl) class_scheduleFormEl.addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = readForm(form);
            var editId = payload.EditId;
            delete payload.EditId;
            setNumeric(payload, ["ClassId", "RoomId"]);

            var validationError = validateClassSchedulePayload(payload);
            if (validationError) throw new Error(validationError);

            if (editId) {
                await sendJson("/api/schedules/" + editId, "PUT", payload);
                setMessage(document.getElementById("class_scheduleMessage"), "Đã cập nhật lịch học.", "success");
                resetFormState("class_scheduleForm", "class_scheduleFormTitle", "Thêm lịch học", "Lưu lịch");
            } else {
                await sendJson("/api/schedules", "POST", payload);
                form.reset();
                setMessage(document.getElementById("class_scheduleMessage"), "Đã thêm lịch học.", "success");
            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("class_scheduleMessage"), error.message, "error");
        }
    });

    var notificationFormEl = document.getElementById("notificationForm");
    if (notificationFormEl) notificationFormEl.addEventListener("submit", async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        try {
            var payload = readForm(form);
            var notificationValidationError = validateNotificationPayload(payload);
            if (notificationValidationError) {
                throw new Error(notificationValidationError);
            }
            var editId = payload.EditId;
            delete payload.EditId;

            if (editId) {
                await sendJson("/api/notifications/" + editId, "PUT", payload);
                setMessage(document.getElementById("notificationMessage"), "Đã cập nhật thông báo.", "success");
                resetFormState("notificationForm", "notificationFormTitle", "Tạo thông báo", "Gửi thông báo");
                form.elements["Audience"].disabled = false;
            } else {
                await sendJson("/api/notifications", "POST", payload);
                form.reset();
                setMessage(document.getElementById("notificationMessage"), "Đã tạo thông báo.", "success");
            }
            await loadAll();
        } catch (error) {
            setMessage(document.getElementById("notificationMessage"), error.message, "error");
        }
    });
}

function bindDeletes() {
    document.body.addEventListener("click", async function (event) {
        var studentButton = event.target.closest("[data-delete-student]");
        var teacherButton = event.target.closest("[data-delete-teacher]");
        var courseButton = event.target.closest("[data-delete-course]");
        var classButton = event.target.closest("[data-delete-class]");
        var roomButton = event.target.closest("[data-delete-room]");
        var scoreButton = event.target.closest("[data-delete-score]");
        var notifButton = event.target.closest("[data-delete-notification]");
        var scheduleButton = event.target.closest("[data-delete-schedule]");
        var target = studentButton || teacherButton || courseButton || classButton || roomButton || scoreButton || notifButton || scheduleButton;
        if (!target) return;

        var config;
        if (studentButton) config = ["/api/students/", studentButton.dataset.deleteStudent, "sinh viên"];
        else if (teacherButton) config = ["/api/teachers/", teacherButton.dataset.deleteTeacher, "giảng viên"];
        else if (courseButton) config = ["/api/courses/", courseButton.dataset.deleteCourse, "khóa học"];
        else if (classButton) config = ["/api/classes/", classButton.dataset.deleteClass, "lớp học"];
        else if (roomButton) config = ["/api/rooms/", roomButton.dataset.deleteRoom, "phòng học"];
        else if (scoreButton) config = ["/api/scores/", scoreButton.dataset.deleteScore, "điểm số"];
        else if (notifButton) config = ["/api/notifications/", notifButton.dataset.deleteNotification, "thông báo"];
        else if (scheduleButton) config = ["/api/schedules/", scheduleButton.dataset.deleteSchedule, "lịch học"];

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

        var teacherBtn = event.target.closest("[data-edit-teacher]");
        if (teacherBtn) {
            var id = Number(teacherBtn.dataset.editTeacher);
            var teacher = state.teachers.find(function (t) { return t.TeacherId === id; });
            if (teacher) {
                var form = document.getElementById("teacherForm");
                form.elements["EditId"].value = teacher.TeacherId;
                form.elements["LastName"].value = teacher.LastName || "";
                form.elements["FirstName"].value = teacher.FirstName || "";
                form.elements["Email"].value = teacher.Email || "";
                form.elements["PhoneNumber"].value = teacher.PhoneNumber || "";
                form.elements["Specialization"].value = teacher.Specialization || "";
                setFormEditMode("teacherForm", "teacherFormTitle", "Sửa giảng viên", "Cập nhật giảng viên");
                document.getElementById("teacherFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
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

        var roomBtn = event.target.closest("[data-edit-room]");
        if (roomBtn) {
            var id = Number(roomBtn.dataset.editRoom);
            var room = state.rooms.find(function (r) { return r.RoomId === id; });
            if (room) {
                var form = document.getElementById("roomForm");
                form.elements["EditId"].value = room.RoomId;
                form.elements["RoomName"].value = room.RoomName || "";
                form.elements["Capacity"].value = room.Capacity || 30;

                setFormEditMode("roomForm", "roomFormTitle", "Sửa phòng học", "Cập nhật phòng");
                document.getElementById("roomFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        var scoreBtn = event.target.closest("[data-edit-score]");
        if (scoreBtn) {
            var id = Number(scoreBtn.dataset.editScore);
            var score = state.scores.find(function (s) { return s.ScoreId === id; });
            if (score) {
                var form = document.getElementById("scoreForm");
                form.elements["EditId"].value = score.ScoreId;
                form.elements["EnrollmentId"].value = score.EnrollmentId || "";
                form.elements["ScoreTypeId"].value = score.ScoreTypeId || "";
                form.elements["ScoreValue"].value = score.ScoreValue !== null ? score.ScoreValue : "";
                form.elements["EnrollmentId"].disabled = true;

                setFormEditMode("scoreForm", "scoreFormTitle", "Sửa điểm", "Cập nhật điểm");
                document.getElementById("scoreFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        var notificationBtn = event.target.closest("[data-edit-notification]");
        if (notificationBtn) {
            var id = Number(notificationBtn.dataset.editNotification);
            var notification = state.notifications.find(function (n) { return n.NotificationId === id; });
            if (notification) {
                var form = document.getElementById("notificationForm");
                form.elements["EditId"].value = notification.NotificationId;
                form.elements["Title"].value = notification.Title || "";
                form.elements["Content"].value = notification.Content || "";
                form.elements["Audience"].disabled = true; // Disable audience select for editing

                setFormEditMode("notificationForm", "notificationFormTitle", "Sửa thông báo", "Cập nhật thông báo");
                document.getElementById("notificationFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        var scheduleBtn = event.target.closest("[data-edit-schedule]");
        if (scheduleBtn) {
            var id = Number(scheduleBtn.dataset.editSchedule);
            var schedule = state.class_schedules.find(function (s) { return s.ScheduleId === id; });
            if (schedule) {
                var form = document.getElementById("class_scheduleForm");
                form.elements["EditId"].value = schedule.ScheduleId;
                form.elements["ClassId"].value = schedule.ClassId || "";
                form.elements["RoomId"].value = schedule.RoomId || "";
                form.elements["Weekday"].value = schedule.Weekday || "";
                form.elements["StartTime"].value = schedule.StartTime || "";
                form.elements["EndTime"].value = schedule.EndTime || "";

                setFormEditMode("class_scheduleForm", "class_scheduleFormTitle", "Sửa lịch học", "Cập nhật lịch");
                document.getElementById("class_scheduleFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    });

    document.querySelectorAll(".cancel-btn").forEach(function (btn) {
        btn.addEventListener("click", function (event) {
            var formId = event.target.closest("form").id;
            var form = event.target.closest("form");
            if (formId === "studentForm") resetFormState("studentForm", "studentFormTitle", "Thêm sinh viên", "Lưu sinh viên");
            if (formId === "teacherForm") resetFormState("teacherForm", "teacherFormTitle", "Thêm giảng viên", "Lưu giảng viên");
            if (formId === "courseForm") resetFormState("courseForm", "courseFormTitle", "Thêm khóa học", "Lưu khóa học");
            if (formId === "classForm") resetFormState("classForm", "classFormTitle", "Tạo lớp", "Lưu lớp");
            if (formId === "roomForm") resetFormState("roomForm", "roomFormTitle", "Thêm phòng học", "Lưu phòng");
            if (formId === "scoreForm") {
                resetFormState("scoreForm", "scoreFormTitle", "Thêm điểm", "Lưu điểm");
                if (form.elements["EnrollmentId"]) form.elements["EnrollmentId"].disabled = false;
            }
            if (formId === "notificationForm") {
                resetFormState("notificationForm", "notificationFormTitle", "Tạo thông báo", "Gửi thông báo");
                if (form.elements["Audience"]) form.elements["Audience"].disabled = false;
            }
            if (formId === "class_scheduleForm") {
                resetFormState("class_scheduleForm", "class_scheduleFormTitle", "Thêm lịch học", "Lưu lịch");
            }
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
        ["teacherSearch", "teachersTableBody"],
        ["courseSearch", "coursesTableBody"],
        ["classSearch", "classesTableBody"],
        ["roomSearch", "roomsTableBody"],
        ["class_scheduleSearch", "class_schedulesTableBody"],
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
    // Logic lọc tài khoản (kết hợp cả ô tìm kiếm và lọc vai trò)
    const userSearchInput = document.getElementById("userFilterSearch");
    const userRoleSelect = document.getElementById("userRoleFilter");
    const userTableBody = document.getElementById("usersTableBody");

    if (userSearchInput && userRoleSelect && userTableBody) {
        const applyUserFilters = () => {
            const query = userSearchInput.value.toLowerCase();
            const role = userRoleSelect.value;
            userTableBody.querySelectorAll("tr").forEach(row => {
                const searchText = (row.dataset.search || "").toLowerCase();
                const rowRole = row.dataset.role || "";
                const matchesSearch = !query || searchText.includes(query);
                const matchesRole = !role || rowRole === role;
                row.hidden = !(matchesSearch && matchesRole);
            });
        };
        userSearchInput.addEventListener("input", applyUserFilters);
        userRoleSelect.addEventListener("change", applyUserFilters);
    }
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

function validateTeacherPayload(payload, editId) {
    var firstName = String(payload.FirstName || "").trim();
    var lastName = String(payload.LastName || "").trim();
    var email = String(payload.Email || "").trim().toLowerCase();
    var phone = String(payload.PhoneNumber || "").trim();

    if (!firstName) return "Tên giảng viên là bắt buộc.";
    if (!lastName) return "Họ giảng viên là bắt buộc.";

    if (!editId) {
        // Chỉ bắt buộc email khi thêm mới
        if (!email) return "Email giảng viên là bắt buộc.";

        var emailExists = state.teachers.some(function (t) {
            return String(t.Email || "").trim().toLowerCase() === email;
        });
        if (emailExists) return "Email này đã được sử dụng.";

    }

    if (phone) {
        if (!/^[0-9]{10,15}$/.test(phone)) {
            return "Số điện thoại không hợp lệ (chỉ nhập số, 10-15 ký tự).";
        }
    }

    return "";
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
function validateCoursePayload(payload, editId) {
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


function validateClassSchedulePayload(payload) {
    if (!payload.ClassId) return "Vui lòng chọn lớp học.";
    if (!payload.Weekday) return "Vui lòng chọn ngày trong tuần.";
    if (!payload.StartTime || !payload.EndTime) return "Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc.";
    if (payload.StartTime >= payload.EndTime) return "Giờ bắt đầu phải trước giờ kết thúc.";
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

    // === User management events ===
    var pwdModal = document.getElementById("pwdModal");
    var pwdInput = document.getElementById("pwdModalInput");
    var pwdMsg = document.getElementById("pwdModalMsg");
    var pwdName = document.getElementById("pwdModalName");
    var currentPwdUserId = null;

    var roleModal = document.getElementById("roleModal");
    var roleModalName = document.getElementById("roleModalName");
    var roleModalSelect = document.getElementById("roleModalSelect");
    var roleModalMsg = document.getElementById("roleModalMsg");
    var currentRoleUserId = null;

    function openRoleModal(userId, currentRoleId) {
        currentRoleUserId = userId;
        // Tìm tên user để hiển thị
        var user = state.users.find(u => u.UserId == userId);
        roleModalName.textContent = "Tài khoản: " + (user ? (user.FullName || user.Username) : userId);
        roleModalSelect.value = currentRoleId;
        roleModalMsg.textContent = "";
        roleModal.style.display = "flex";
    }

    function closeRoleModal() {
        roleModal.style.display = "none";
        currentRoleUserId = null;
    }

    document.getElementById("roleModalClose").addEventListener("click", closeRoleModal);
    if (roleModal) roleModal.addEventListener("click", function (e) { if (e.target === roleModal) closeRoleModal(); });

    document.getElementById("roleModalSave").addEventListener("click", async function () {
        var newRoleId = roleModalSelect.value;
        if (!newRoleId) return;
        try {
            await sendJson("/api/users/" + currentRoleUserId + "/role", "PUT", { RoleId: parseInt(newRoleId) });
            roleModalMsg.textContent = "Đã cập nhật vai trò!";
            roleModalMsg.className = "message success";
            setTimeout(closeRoleModal, 1000);
            await loadAll(); // refresh lại toàn bộ
        } catch (err) {
            roleModalMsg.textContent = err.message;
            roleModalMsg.className = "message error";
        }
    });

    // Xử lý click vào nút edit-role
    document.body.addEventListener("click", function (e) {
        var roleBtn = e.target.closest("[data-user-role]");
        if (roleBtn) {
            var userId = roleBtn.dataset.userRole;
            var currentRoleId = roleBtn.dataset.currentRole;
            openRoleModal(userId, currentRoleId);
        }
    });

    function openPwdModal(userId, name) {
        currentPwdUserId = userId;
        pwdName.textContent = "Tài khoản: " + name;
        pwdInput.value = "";
        pwdMsg.textContent = "";
        pwdMsg.className = "message";
        pwdModal.style.display = "flex";
        setTimeout(function () { pwdInput.focus(); }, 100);
    }

    function closePwdModal() {
        pwdModal.style.display = "none";
        currentPwdUserId = null;
    }

    if (document.getElementById("pwdModalClose")) {
        document.getElementById("pwdModalClose").addEventListener("click", closePwdModal);
    }
    if (pwdModal) {
        pwdModal.addEventListener("click", function (e) { if (e.target === pwdModal) closePwdModal(); });
    }

    if (document.getElementById("pwdModalSave")) {
        document.getElementById("pwdModalSave").addEventListener("click", async function () {
            var pw = pwdInput.value.trim();
            if (!pw || pw.length < 6) {
                pwdMsg.textContent = "Mật khẩu phải có ít nhất 6 ký tự.";
                pwdMsg.className = "message error";
                return;
            }
            try {
                await sendJson("/api/users/" + currentPwdUserId + "/password", "PUT", { Password: pw });
                pwdMsg.textContent = "Đã đổi mật khẩu thành công!";
                pwdMsg.className = "message success";
                setTimeout(closePwdModal, 1200);
            } catch (err) {
                pwdMsg.textContent = err.message;
                pwdMsg.className = "message error";
            }
        });
    }

    // Delegate: Khoa/Mo khoa + Doi mat khau
    document.body.addEventListener("click", async function (e) {
        var pwdBtn = e.target.closest("[data-user-pwd]");
        if (pwdBtn) {
            openPwdModal(pwdBtn.dataset.userPwd, pwdBtn.dataset.userName);
            return;
        }

        var toggleBtn = e.target.closest("[data-user-toggle]");
        if (toggleBtn) {
            var uid = toggleBtn.dataset.userToggle;
            var newStatus = toggleBtn.dataset.userStatus;
            var label = newStatus === "Inactive" ? "khóa" : "mở khóa";
            if (!window.confirm("Xác nhận " + label + " tài khoản này?")) return;
            try {
                await sendJson("/api/users/" + uid + "/status", "PUT", { Status: newStatus });
                setMessage(document.getElementById("userMessage"), "Đã " + label + " tài khoản.", "success");
                await loadAll();
            } catch (err) {
                setMessage(document.getElementById("userMessage"), err.message, "error");
            }
        }
    });

    loadAll();
    // === Xử lý Cấp tài khoản tự động cho Sinh viên ===
    document.body.addEventListener("click", async function (event) {
        var generateBtn = event.target.closest("[data-generate-account]");
        if (generateBtn) {
            var studentId = generateBtn.dataset.generateAccount;
            var row = generateBtn.closest("tr");
            var fullName = row.cells[1].textContent;

            if (!window.confirm("Bạn có chắc muốn tự động tạo tài khoản cho sinh viên này?")) return;

            try {
                var result = await sendJson("/api/users/generate/student/" + studentId, "POST");
                await loadAll();
                if (result.username && result.password) {
                    showCredentialModal(fullName, result.username, result.password);
                } else if (result.data) {
                    showCredentialModal(fullName, result.data.username, result.data.password);
                }
            } catch (error) {
                alert("Lỗi khi cấp tài khoản: " + error.message);
            }
        }
    });

    // === Xử lý Cấp tài khoản tự động cho Giảng viên ===
    document.body.addEventListener("click", async function (event) {
        var generateBtn = event.target.closest("[data-generate-teacher-account]");
        if (generateBtn) {
            var teacherId = generateBtn.dataset.generateTeacherAccount;
            var row = generateBtn.closest("tr");
            var fullName = row.cells[1].textContent;

            if (!window.confirm("Bạn có chắc muốn tự động tạo tài khoản cho giảng viên này?")) return;

            try {
                var result = await sendJson("/api/users/generate/teacher/" + teacherId, "POST");
                await loadAll();
                if (result.username && result.password) {
                    showCredentialModal(fullName, result.username, result.password);
                } else if (result.data) {
                    showCredentialModal(fullName, result.data.username, result.data.password);
                }
            } catch (error) {
                alert("Lỗi khi cấp tài khoản: " + error.message);
            }
        }
    });

    loadAll();
    // ... handles for student/teacher generate account ...

    // Class List Modal Events
    var classListModal = document.getElementById("classListModal");
    var classListModalClose = document.getElementById("classListModalClose");

    if (classListModalClose) {
        classListModalClose.addEventListener("click", function () {
            classListModal.style.display = "none";
        });
    }

    if (classListModal) {
        window.addEventListener("click", function (event) {
            if (event.target === classListModal) {
                classListModal.style.display = "none";
            }
        });
    }

    // Delegate click for calendar items
    document.body.addEventListener("click", function (e) {
        var calItem = e.target.closest(".calendar-item");
        if (calItem && !e.target.closest(".actions")) {
            var classId = calItem.dataset.classId;
            var className = calItem.dataset.className;
            if (classId) {
                openClassListModal(classId, className);
            }
        }
    });

    var exportScheduleBtn = document.getElementById("exportScheduleBtn");
    if (exportScheduleBtn) {
        exportScheduleBtn.addEventListener("click", exportScheduleToExcel);
    }

    loadAll();
});

async function openClassListModal(classId, className) {
    var modal = document.getElementById("classListModal");
    var title = document.getElementById("classListModalTitle");
    var tbody = document.getElementById("classListModalBody");

    if (!modal || !tbody) return;

    title.textContent = "Danh sách lớp: " + className;
    tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    modal.style.display = "flex";

    try {
        var students = await getJson("/api/teachers/class-students/" + classId);
        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center;padding:20px">Lớp này chưa có sinh viên nào.</td></tr>';
            return;
        }

        tbody.innerHTML = students.map(function (sv, idx) {
            return "<tr>" +
                "<td>" + (idx + 1) + "</td>" +
                "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>" +
                "<td>" + escapeHtml(sv.FullName) + "</td>" +
                "<td>" + escapeHtml(sv.DateOfBirth || "—") + "</td>" +
                "<td>" + escapeHtml(sv.Gender || "—") + "</td>" +
                "</tr>";
        }).join("");
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center;padding:20px;color:var(--danger)">Lỗi: ' + escapeHtml(error.message) + '</td></tr>';
    }
}

function exportScheduleToExcel() {
    if (!state.class_schedules || state.class_schedules.length === 0) {
        alert("Không có lịch học để xuất!");
        return;
    }

    var data = [
        ["Thứ", "Bắt đầu", "Kết thúc", "Lớp", "Phòng", "Giảng viên"]
    ];

    // Sắp xếp lịch theo Thứ và Giờ bắt đầu
    var dayOrder = {
        "Thứ 2": 1, "Monday": 1,
        "Thứ 3": 2, "Tuesday": 2,
        "Thứ 4": 3, "Wednesday": 3,
        "Thứ 5": 4, "Thursday": 4,
        "Thứ 6": 5, "Friday": 5,
        "Thứ 7": 6, "Saturday": 6,
        "Chủ Nhật": 7, "Sunday": 7
    };

    var sortedSchedules = [...state.class_schedules].sort((a, b) => {
        var dayA = dayOrder[a.Weekday] || 99;
        var dayB = dayOrder[b.Weekday] || 99;
        if (dayA !== dayB) return dayA - dayB;
        return (a.StartTime || "").localeCompare(b.StartTime || "");
    });

    sortedSchedules.forEach(function (s) {
        data.push([
            s.Weekday,
            s.StartTime,
            s.EndTime,
            s.ClassName,
            s.RoomName || "N/A",
            s.TeacherName || "N/A"
        ]);
    });

    var ws = XLSX.utils.aoa_to_sheet(data);

    // Căn chỉnh độ rộng cột
    ws["!cols"] = [
        { wch: 12 }, // Thứ
        { wch: 10 }, // Bắt đầu
        { wch: 10 }, // Kết thúc
        { wch: 25 }, // Lớp
        { wch: 15 }, // Phòng
        { wch: 20 }  // Giảng viên
    ];

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lịch học");

    var fileName = "LichHoc_CLASSES369_" + new Date().toISOString().slice(0, 10) + ".xlsx";
    XLSX.writeFile(wb, fileName);
}

function renderClassSchedules() {
    var body = document.getElementById("class_schedulesCalendarBody");
    if (!body) return;
    body.innerHTML = "";

    // 1. Tạo các nhãn thời gian và đường lưới (7h - 22h)
    for (var h = 7; h <= 21; h++) {
        var timeLabel = document.createElement("div");
        timeLabel.className = "calendar-time-label";
        timeLabel.style.gridRowStart = (h - 7) * 4 + 1;
        timeLabel.style.gridRowEnd = (h - 7) * 4 + 5;
        timeLabel.textContent = h + ":00";
        body.appendChild(timeLabel);

        var gridLine = document.createElement("div");
        gridLine.className = "calendar-grid-line";
        gridLine.style.gridRowStart = (h - 7) * 4 + 1;
        body.appendChild(gridLine);
    }

    // 2. Map Thứ sang Cột
    var dayMap = {
        "Thứ 2": 2, "Monday": 2,
        "Thứ 3": 3, "Tuesday": 3,
        "Thứ 4": 4, "Wednesday": 4,
        "Thứ 5": 5, "Thursday": 5,
        "Thứ 6": 6, "Friday": 6,
        "Thứ 7": 7, "Saturday": 7,
        "Chủ Nhật": 8, "Sunday": 8
    };

    // 3. Render các mục lịch học
    state.class_schedules.forEach(function (s, idx) {
        var col = dayMap[s.Weekday];
        if (!col) return;

        // Tính toán hàng (Mỗi hàng 15ph)
        function timeToRow(timeStr) {
            if (!timeStr) return 1;
            var parts = timeStr.split(":");
            var hour = parseInt(parts[0]);
            var min = parseInt(parts[1]);
            // baseline là 7:00
            return ((hour - 7) * 4 + Math.floor(min / 15)) + 1;
        }

        var rowStart = timeToRow(s.StartTime);
        var rowEnd = timeToRow(s.EndTime);

        // Giới hạn trong khung 7h-22h (row 1-61)
        if (rowStart < 1) rowStart = 1;
        if (rowEnd > 61) rowEnd = 61;
        if (rowStart >= rowEnd) return;

        var colorIdx = (idx % 7) + 1;
        var item = document.createElement("div");
        item.className = "calendar-item cal-bg-" + colorIdx;
        item.style.setProperty("--col", col);
        item.style.setProperty("--row-start", rowStart);
        item.style.setProperty("--row-end", rowEnd);
        item.style.cursor = "pointer";
        item.dataset.classId = s.ClassId;
        item.dataset.className = s.ClassName;

        item.innerHTML =
            "<strong>" + escapeHtml(s.ClassName) + "</strong>" +
            "<span><i class='fas fa-clock'></i> " + escapeHtml(s.StartTime) + " - " + escapeHtml(s.EndTime) + "</span>" +
            "<span><i class='fas fa-map-marker-alt'></i> " + escapeHtml(s.RoomName || "N/A") + "</span>" +
            "<span><i class='fas fa-user'></i> " + escapeHtml(s.TeacherName || "N/A") + "</span>" +
            "<div class='actions'>" +
            "<button title='Sửa' data-edit-schedule='" + s.ScheduleId + "'><i class='fas fa-pen'></i></button>" +
            "<button title='Xóa' data-delete-schedule='" + s.ScheduleId + "'><i class='fas fa-trash'></i></button>" +
            "</div>";

        body.appendChild(item);
    });
}

// Quản lý biểu đồ
var dashboardCharts = {};

function renderCharts() {
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js is not loaded yet.");
        return;
    }
    var s = state.summary || {};

    // 1. Biểu đồ Ghi danh (Bar Chart)
    var ctxEnroll = document.getElementById('enrollmentChart');
    if (ctxEnroll) {
        if (dashboardCharts.enroll) dashboardCharts.enroll.destroy();

        var labels = (s.TopCourses || []).map(item => item.CourseName);
        var counts = (s.TopCourses || []).map(item => item.EnrollmentCount);

        dashboardCharts.enroll = new Chart(ctxEnroll, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lượng ghi danh',
                    data: counts,
                    backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    borderColor: 'rgb(99, 102, 241)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { display: false } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Biểu đồ Tài chính (Doughnut Chart)
    var ctxTuition = document.getElementById('tuitionChart');
    if (ctxTuition) {
        if (dashboardCharts.tuition) dashboardCharts.tuition.destroy();

        dashboardCharts.tuition = new Chart(ctxTuition, {
            type: 'doughnut',
            data: {
                labels: ['Đã đóng', 'Công nợ'],
                datasets: [{
                    data: [s.TotalRevenue || 0, s.OutstandingTuition || 0],
                    backgroundColor: ['#22c55e', '#ef4444'],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                },
                cutout: '70%'
            }
        });
    }
}
