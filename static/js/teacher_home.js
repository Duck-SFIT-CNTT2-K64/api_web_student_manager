(function () {
    var root = document.getElementById("teacherPortalRoot");
    if (!root) {
        return;
    }

    var userId = Number(root.dataset.userId || 0);
    if (!userId) {
        return;
    }

    var state = {
        stats: null,
        classes: [],
        schedule: [],
        selectedClassId: null,
        classStudents: [],
    };

    var endpoints = {
        stats: "/api/teachers/stats/" + userId,
        classes: "/api/teachers/classes/" + userId,
        schedule: "/api/teachers/schedule/" + userId,
        classStudents: "/api/teachers/class-students/",
        saveScore: "/api/teachers/save-score",
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

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function setMessage(text, type) {
        var node = document.getElementById("scoreMessage");
        if (!node) {
            return;
        }
        node.textContent = text || "";
        node.classList.remove("success", "error");
        if (type) {
            node.classList.add(type);
        }
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

    function renderStats() {
        var classNode = document.getElementById("teacherClassCount");
        var studentNode = document.getElementById("teacherStudentCount");
        var scoreNode = document.getElementById("teacherScoreCount");

        if (classNode) {
            classNode.textContent = state.stats ? Number(state.stats.total_classes || 0) : 0;
        }
        if (studentNode) {
            studentNode.textContent = state.stats ? Number(state.stats.total_students || 0) : 0;
        }
        if (scoreNode) {
            scoreNode.textContent = state.stats ? Number(state.stats.total_scores || 0) : 0;
        }
    }

    function renderClassTable() {
        var tbody = document.getElementById("teacherClassesBody");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = (state.classes || []).map(function (item) {
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode) + "</strong></td>"
                + "<td>" + escapeHtml(item.ClassName) + "</td>"
                + "<td>" + escapeHtml(item.CourseName) + "</td>"
                + "<td><span class=\"badge info\">" + Number(item.StudentCount || 0) + "</span></td>"
                + "<td><button class=\"btn btn-ghost\" type=\"button\" data-open-score-class=\"" + Number(item.ClassId) + "\"><i class=\"fas fa-pen\"></i> Nhap diem</button></td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="5" class="empty">Chua co lop duoc phan cong.</td></tr>';
    }

    function renderClassSelect() {
        var select = document.getElementById("teacherClassSelect");
        if (!select) {
            return;
        }

        select.innerHTML = '<option value="">Chon lop de nhap diem</option>';
        (state.classes || []).forEach(function (item) {
            var option = document.createElement("option");
            option.value = item.ClassId;
            option.textContent = item.ClassCode + " - " + item.ClassName + " (" + Number(item.StudentCount || 0) + " SV)";
            select.appendChild(option);
        });

        if (state.selectedClassId) {
            select.value = String(state.selectedClassId);
        }
    }

    function renderSchedule() {
        var tbody = document.getElementById("teacherScheduleBody");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = (state.schedule || []).map(function (item) {
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode || "") + "</strong><br><small>" + escapeHtml(item.ClassName || "") + "</small></td>"
                + "<td>" + escapeHtml(item.CourseName || "-") + "</td>"
                + "<td>" + escapeHtml(weekdayMap[item.Weekday] || item.Weekday || "-") + "</td>"
                + "<td>" + escapeHtml((item.StartTime || "").slice(0, 5)) + " - " + escapeHtml((item.EndTime || "").slice(0, 5)) + "</td>"
                + "<td>" + escapeHtml(item.RoomName || "-") + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="5" class="empty">Chua co lich day.</td></tr>';
    }

    function renderScoreStudents() {
        var tbody = document.getElementById("scoreStudentTableBody");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = (state.classStudents || []).map(function (item) {
            return "<tr data-enrollment-id=\"" + Number(item.EnrollmentId) + "\">"
                + "<td><strong>" + escapeHtml(item.StudentCode) + "</strong></td>"
                + "<td>" + escapeHtml(item.FullName) + "</td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"1\" value=\"" + (item.ChuyenCan ?? "") + "\"></td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"2\" value=\"" + (item.GiuaKy ?? "") + "\"></td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"3\" value=\"" + (item.CuoiKy ?? "") + "\"></td>"
                + "<td><button class=\"btn btn-primary\" type=\"button\" data-save-row=\"" + Number(item.EnrollmentId) + "\">Luu</button></td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="6" class="empty">Lop chua co sinh vien.</td></tr>';
    }

    async function loadDashboardData() {
        var results = await Promise.all([
            getJson(endpoints.stats),
            getJson(endpoints.classes),
            getJson(endpoints.schedule),
        ]);

        state.stats = results[0] || { total_classes: 0, total_students: 0, total_scores: 0 };
        state.classes = results[1] || [];
        state.schedule = results[2] || [];

        renderStats();
        renderClassTable();
        renderClassSelect();
        renderSchedule();
    }

    async function loadClassStudents(classId) {
        if (!classId) {
            return;
        }
        state.selectedClassId = Number(classId);

        setMessage("Dang tai danh sach sinh vien...", "");
        var students = await getJson(endpoints.classStudents + Number(classId));
        state.classStudents = students || [];
        renderScoreStudents();
        renderClassSelect();
        setMessage("Da tai danh sach sinh vien.", "success");

        var section = document.getElementById("score-entry");
        if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    async function saveScoreForEnrollment(enrollmentId, row) {
        var inputs = row.querySelectorAll("input[data-score-type]");
        var tasks = [];

        inputs.forEach(function (input) {
            var raw = input.value;
            if (raw === "") {
                return;
            }

            var score = Number(raw);
            if (Number.isNaN(score) || score < 0 || score > 10) {
                throw new Error("Diem phai nam trong khoang 0 den 10.");
            }

            tasks.push(postJson(endpoints.saveScore, {
                EnrollmentId: Number(enrollmentId),
                ScoreTypeId: Number(input.dataset.scoreType),
                ScoreValue: score,
            }));
        });

        if (tasks.length === 0) {
            throw new Error("Hay nhap it nhat mot diem truoc khi luu.");
        }

        await Promise.all(tasks);
    }

    function bindEvents() {
        var classForm = document.getElementById("teacherClassForm");
        if (classForm) {
            classForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var classId = Number(document.getElementById("teacherClassSelect").value || 0);
                if (!classId) {
                    setMessage("Vui long chon lop hoc.", "error");
                    return;
                }
                loadClassStudents(classId).catch(function (error) {
                    setMessage(error.message, "error");
                });
            });
        }

        document.addEventListener("click", function (event) {
            var openBtn = event.target.closest("[data-open-score-class]");
            if (openBtn) {
                var classId = Number(openBtn.getAttribute("data-open-score-class"));
                loadClassStudents(classId).catch(function (error) {
                    setMessage(error.message, "error");
                });
                return;
            }

            var saveBtn = event.target.closest("[data-save-row]");
            if (!saveBtn) {
                return;
            }

            var enrollmentId = Number(saveBtn.getAttribute("data-save-row"));
            var row = saveBtn.closest("tr");
            if (!row || !enrollmentId) {
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = "Dang luu...";

            saveScoreForEnrollment(enrollmentId, row)
                .then(function () {
                    setMessage("Da luu diem thanh cong.", "success");
                    return Promise.all([loadClassStudents(state.selectedClassId), loadDashboardData()]);
                })
                .catch(function (error) {
                    setMessage(error.message, "error");
                })
                .finally(function () {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Luu";
                });
        });
    }

    function initNewUIMockEvents() {
        // Populate ALL class dropdowns when state.classes updates
        function updateClassSelects() {
            var options = '<option value="">Chọn lớp...</option>';
            (state.classes || []).forEach(function (c) {
                options += '<option value="' + c.ClassId + '">' + escapeHtml(c.ClassName) + '</option>';
            });

            var classListSelect = document.getElementById('classListSelect');
            if (classListSelect) classListSelect.innerHTML = options;

            var examClassSelect = document.getElementById('examClassSelect');
            if (examClassSelect) examClassSelect.innerHTML = options;

            var attClassSelect = document.getElementById('attendanceClassSelect');
            if (attClassSelect) attClassSelect.innerHTML = options;

            var notifSelect = document.getElementById('notificationTargetSelect');
            if (notifSelect) {
                notifSelect.innerHTML = '<option value="all">Tất cả lớp của tôi</option>' + options;
            }
        }

        // Listen to original class generation to reuse
        var origRenderClassSelect = renderClassSelect;
        renderClassSelect = function () {
            origRenderClassSelect();
            updateClassSelects();
        };

        // 1. Xem role học sinh
        var viewStudentSearch = document.getElementById('viewStudentSearch');
        if (viewStudentSearch) {
            viewStudentSearch.addEventListener('input', function (e) {
                var body = document.getElementById('viewStudentTableBody');
                if (body) {
                    body.innerHTML = '<tr><td colspan="4" class="empty">Đang tìm: ' + escapeHtml(e.target.value) + '... (Tính năng đang phát triển)</td></tr>';
                }
            });
        }

        // 2. Danh sách lớp
        var classListBtn = document.getElementById('classListBtn');
        if (classListBtn) {
            classListBtn.addEventListener('click', function () {
                var val = document.getElementById('classListSelect').value;
                var body = document.getElementById('classListTableBody');
                if (!val) {
                    alert('Vui lòng chọn lớp!');
                    return;
                }
                body.innerHTML = '<tr><td colspan="4" class="empty">Đang tải cấu trúc danh sách sinh viên... (Mockup/Tính năng chờ API)</td></tr>';
            });
        }

        // 3. Exams
        var examForm = document.getElementById('examForm');
        if (examForm) {
            examForm.addEventListener('submit', function (e) {
                e.preventDefault();
                alert("Tạo bài kiểm tra thành công! (Tính năng mô phỏng)");
                var body = document.getElementById('examTableBody');
                body.innerHTML = '<tr><td>Bài kiểm tra giả lập</td><td>---</td><td>---</td><td><span class="badge good">Đã giao</span></td></tr>';
                examForm.reset();
            });
        }

        // 4. Attendance
        var attSearchBtn = document.getElementById('attendanceSearchBtn');
        if (attSearchBtn) {
            attSearchBtn.addEventListener('click', function () {
                var val = document.getElementById('attendanceClassSelect').value;
                if (!val) {
                    alert('Vui lòng chọn lớp và ngày học để điểm danh!');
                    return;
                }
                var body = document.getElementById('attendanceTableBody');
                body.innerHTML = '<tr><td>SV01</td><td>Nguyễn Văn A</td><td style="text-align:center"><input type="radio" name="att_1" checked></td><td style="text-align:center"><input type="radio" name="att_1"></td><td style="text-align:center"><input type="radio" name="att_1"></td></tr>';
            });
        }

        var attSaveBtn = document.getElementById('attendanceSaveBtn');
        if (attSaveBtn) {
            attSaveBtn.addEventListener('click', function () {
                alert('Đã lưu điểm danh!');
            });
        }

        // 5. Notifications
        var notifSendBtn = document.getElementById('notificationSendBtn');
        if (notifSendBtn) {
            notifSendBtn.addEventListener('click', function () {
                alert('Thông báo đã được gửi đến sinh viên!');
                var body = document.getElementById('notificationTableBody');
                body.innerHTML = '<tr><td>Thông báo giả lập</td><td>Tất cả lớp</td><td>Vừa xong</td></tr>';
            });
        }
    }

    bindEvents();
    initNewUIMockEvents();
    loadDashboardData().catch(function (error) {
        setMessage(error.message, "error");
    });
})();
