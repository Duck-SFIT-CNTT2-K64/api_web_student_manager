(function () {
    var root = document.getElementById("studentPortalRoot");
    if (!root) {
        return;
    }

    var userId = Number(root.dataset.userId || 0);
    if (!userId) {
        return;
    }

    var state = {
        profile: null,
        learning: { Enrollments: [], CourseContents: [] },
        registrationStatus: [],
        registrationOptions: [],
        schedule: [],
        exams: [],
        scores: [],
        finance: [],
    };

    var endpoints = {
        profile: "/api/students/profile/" + userId,
        learning: "/api/students/learning/" + userId,
        registrationStatus: "/api/students/registration/" + userId,
        registrationOptions: "/api/students/registration-options/" + userId,
        register: "/api/students/registration/" + userId,
        schedule: "/api/students/schedule/" + userId,
        exams: "/api/students/exams/" + userId,
        scores: "/api/students/scores/" + userId,
        finance: "/api/students/finance/" + userId,
        payment: "/api/students/finance/" + userId + "/payments",
    };

    var weekdayMap = {
        Monday: "Thu Hai",
        Tuesday: "Thu Ba",
        Wednesday: "Thu Tu",
        Thursday: "Thu Nam",
        Friday: "Thu Sau",
        Saturday: "Thu Bay",
        Sunday: "Chu Nhat",
    };

    function formatMoney(value) {
        return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + " VND";
    }

    function formatDate(value) {
        if (!value) {
            return "-";
        }
        return String(value).slice(0, 10);
    }

    function renderStatusBadge(status) {
        var normalized = String(status || "").toLowerCase();
        var tone = "";

        if (["paid", "enrolled", "active", "planned", "da thanh toan", "dang hoc"].includes(normalized)) {
            tone = " good";
        } else if (["pending", "cho xu ly", "bao luu"].includes(normalized)) {
            tone = " warn";
        } else if (["overdue", "dropped", "inactive", "qua han"].includes(normalized)) {
            tone = " bad";
        }

        return '<span class="badge' + tone + '">' + escapeHtml(status || "-") + "</span>";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function parseResponse(response) {
        var json = await response.json();
        if (!response.ok || json.success === false) {
            throw new Error(json.error || json.details || "Request failed.");
        }
        return json.data;
    }

    async function getJson(url) {
        var response = await fetch(url);
        return parseResponse(response);
    }

    async function postJson(url, payload) {
        var response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return parseResponse(response);
    }

    function setMessage(elementId, text, type) {
        var el = document.getElementById(elementId);
        if (!el) {
            return;
        }
        el.textContent = text || "";
        el.classList.remove("success", "error");
        if (type) {
            el.classList.add(type);
        }
    }

    function renderLearning() {
        var tbody = document.getElementById("learningEnrollmentsBody");
        var rows = state.learning.Enrollments || [];

        tbody.innerHTML = rows.map(function (item) {
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode) + "</strong><br><small>" + escapeHtml(item.ClassName) + "</small></td>"
                + "<td>" + escapeHtml(item.CourseName) + "</td>"
                + "<td>" + escapeHtml(item.TeacherName || "Chua phan cong") + "</td>"
                + "<td>" + renderStatusBadge(item.Status) + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="4" class="empty">Ban chua ghi danh lop nao.</td></tr>';

        var contentWrap = document.getElementById("courseContentList");
        var contents = state.learning.CourseContents || [];

        contentWrap.innerHTML = contents.map(function (item) {
            return '<article class="notice-card" style="margin-bottom:10px">'
                + "<strong>" + escapeHtml(item.CourseCode) + " - " + escapeHtml(item.CourseName) + "</strong>"
                + "<p>" + escapeHtml(item.CourseContent || "Noi dung dang cap nhat") + "</p>"
                + "<span>" + escapeHtml(item.Duration || "Dang cap nhat") + " • " + escapeHtml(item.Credits || 0) + " tin chi</span>"
                + "</article>";
        }).join("") || '<p class="empty">Chua co noi dung khoa hoc.</p>';
    }

    function renderScores() {
        var tbody = document.getElementById("scoreTableBody");
        tbody.innerHTML = (state.scores || []).map(function (item) {
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode) + "</strong><br><small>" + escapeHtml(item.ClassName) + "</small></td>"
                + "<td>" + (item.ChuyenCan ?? "-") + "</td>"
                + "<td>" + (item.GiuaKy ?? "-") + "</td>"
                + "<td>" + (item.CuoiKy ?? "-") + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="4" class="empty">Chua co diem.</td></tr>';
    }

    function renderRegistrationOptions() {
        var select = document.getElementById("registrationClassSelect");
        var options = state.registrationOptions || [];

        select.innerHTML = '<option value="">Chon lop de dang ky</option>';
        options.forEach(function (item) {
            var option = document.createElement("option");
            option.value = item.ClassId;
            var seatText = item.RemainingSeats == null ? "Con cho" : (item.RemainingSeats + " cho");
            option.textContent = item.ClassCode + " - " + item.ClassName + " (" + seatText + ")";
            select.appendChild(option);
        });
    }

    function renderRegistrationStatus() {
        var tbody = document.getElementById("registrationStatusBody");
        tbody.innerHTML = (state.registrationStatus || []).map(function (item) {
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode) + "</strong><br><small>" + escapeHtml(item.ClassName) + "</small></td>"
                + "<td>" + escapeHtml(item.CourseCode || "") + " - " + escapeHtml(item.CourseName || "") + "</td>"
                + "<td>" + formatDate(item.EnrollmentDate) + "</td>"
                + "<td>" + renderStatusBadge(item.RegistrationStatus) + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="4" class="empty">Chua co dang ky.</td></tr>';
    }

    function renderSchedule() {
        var tbody = document.getElementById("scheduleTableBody");
        tbody.innerHTML = (state.schedule || []).map(function (item) {
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode || "") + "</strong><br><small>" + escapeHtml(item.ClassName || "") + "</small></td>"
                + "<td>" + escapeHtml(weekdayMap[item.Weekday] || item.Weekday || "-") + "</td>"
                + "<td>" + escapeHtml((item.StartTime || "").slice(0, 5)) + " - " + escapeHtml((item.EndTime || "").slice(0, 5)) + "</td>"
                + "<td>" + escapeHtml(item.RoomName || "-") + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="4" class="empty">Chua co lich hoc.</td></tr>';
    }

    function renderExams() {
        var tbody = document.getElementById("examTableBody");
        tbody.innerHTML = (state.exams || []).map(function (item) {
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode || "") + "</strong><br><small>" + escapeHtml(item.ClassName || "") + "</small></td>"
                + "<td>" + escapeHtml(item.CourseName || "-") + "</td>"
                + "<td>" + formatDate(item.ExamDate) + "</td>"
                + "<td>" + escapeHtml(item.ExamRoom || "-") + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="4" class="empty">Chua co lich thi du kien.</td></tr>';
    }

    function renderFinance() {
        var finance = state.finance || [];
        var tbody = document.getElementById("financeTableBody");
        var totalDebt = 0;

        tbody.innerHTML = finance.map(function (item) {
            var debt = Number(item.Debt || 0);
            totalDebt += debt;
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode || "") + "</strong><br><small>" + escapeHtml(item.ClassName || "") + "</small></td>"
                + "<td>" + formatMoney(item.TotalFee) + "</td>"
                + "<td>" + formatMoney(item.AmountPaid) + "</td>"
                + "<td>" + formatMoney(debt) + "</td>"
                + "<td>" + renderStatusBadge(item.Status) + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="5" class="empty">Chua co khoan hoc phi.</td></tr>';

        var debtNode = document.getElementById("debtValue");
        if (debtNode) {
            debtNode.innerHTML = new Intl.NumberFormat("vi-VN").format(totalDebt) + ' <span style="font-size:.85rem;font-weight:400">VNĐ</span>';
        }

        var select = document.getElementById("paymentTuitionSelect");
        select.innerHTML = '<option value="">Chon khoan hoc phi</option>';

        finance.filter(function (item) {
            return Number(item.Debt || 0) > 0;
        }).forEach(function (item) {
            var option = document.createElement("option");
            option.value = item.TuitionId;
            option.textContent = (item.ClassCode || item.ClassName || "Tuition") + " - Con no " + formatMoney(item.Debt || 0);
            select.appendChild(option);
        });
    }

    function renderSummaryStats() {
        var enrollmentCount = (state.learning.Enrollments || []).length;
        var countNode = document.getElementById("enrollmentCountValue");
        if (countNode) {
            countNode.textContent = enrollmentCount;
        }
    }

    async function reloadData() {
        var results = await Promise.all([
            getJson(endpoints.profile),
            getJson(endpoints.learning),
            getJson(endpoints.registrationStatus),
            getJson(endpoints.registrationOptions),
            getJson(endpoints.schedule),
            getJson(endpoints.exams),
            getJson(endpoints.scores),
            getJson(endpoints.finance),
        ]);

        state.profile = results[0];
        state.learning = results[1] || { Enrollments: [], CourseContents: [] };
        state.registrationStatus = results[2] || [];
        state.registrationOptions = results[3] || [];
        state.schedule = results[4] || [];
        state.exams = results[5] || [];
        state.scores = results[6] || [];
        state.finance = results[7] || [];

        renderLearning();
        renderScores();
        renderRegistrationOptions();
        renderRegistrationStatus();
        renderSchedule();
        renderExams();
        renderFinance();
        renderSummaryStats();
    }

    async function handleRegistrationSubmit(event) {
        event.preventDefault();
        var select = document.getElementById("registrationClassSelect");
        if (!select.value) {
            setMessage("registrationMessage", "Vui long chon lop hoc.", "error");
            return;
        }

        try {
            setMessage("registrationMessage", "Dang tao dang ky...", "");
            await postJson(endpoints.register, { ClassId: Number(select.value) });
            setMessage("registrationMessage", "Dang ky lop thanh cong.", "success");
            await reloadData();
        } catch (error) {
            setMessage("registrationMessage", error.message, "error");
        }
    }

    async function handlePaymentSubmit(event) {
        event.preventDefault();
        var tuitionId = document.getElementById("paymentTuitionSelect").value;
        var amount = document.getElementById("paymentAmountInput").value;
        var note = document.getElementById("paymentNoteInput").value;

        if (!tuitionId || !amount) {
            setMessage("paymentMessage", "Vui long chon khoan hoc phi va nhap so tien.", "error");
            return;
        }

        try {
            setMessage("paymentMessage", "Dang ghi nhan thanh toan...", "");
            await postJson(endpoints.payment, {
                TuitionId: Number(tuitionId),
                Amount: Number(amount),
                Note: note || null,
            });
            setMessage("paymentMessage", "Thanh toan da duoc ghi nhan.", "success");
            document.getElementById("paymentForm").reset();
            await reloadData();
        } catch (error) {
            setMessage("paymentMessage", error.message, "error");
        }
    }

    function bindEvents() {
        var registrationForm = document.getElementById("registrationForm");
        if (registrationForm) {
            registrationForm.addEventListener("submit", handleRegistrationSubmit);
        }

        var paymentForm = document.getElementById("paymentForm");
        if (paymentForm) {
            paymentForm.addEventListener("submit", handlePaymentSubmit);
        }
    }

    bindEvents();
    reloadData().catch(function (error) {
        setMessage("registrationMessage", error.message, "error");
        setMessage("paymentMessage", error.message, "error");
    });
})();
