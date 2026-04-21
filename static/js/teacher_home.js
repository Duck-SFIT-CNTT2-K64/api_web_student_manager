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

    function renderCalendar() {
        var container = document.getElementById("calendar");
        if (!container) return;

        var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        var map = {};
        days.forEach(function (d) { map[d] = []; });

        (state.schedule || []).forEach(function (item) {
            if (!map[item.Weekday]) return;

            var start = item.StartTime ? item.StartTime.slice(0,5) : "--";
            var end = item.EndTime ? item.EndTime.slice(0,5) : "--";

            map[item.Weekday].push(
                "<div class='calendar-item'>"
                + "<strong>" + escapeHtml(item.ClassCode || "") + "</strong><br>"
                + start + " - " + end + "<br>"
                + "<small>" + escapeHtml(item.RoomName || "") + "</small>"
                + "</div>"
            );
        });

        container.innerHTML = "<div class='calendar-grid'>" + days.map(function (day) {
            return "<div class='calendar-col'>..."
        }).join("") + "</div>";
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
        try {
            var results = await Promise.all([
                getJson(endpoints.stats),
                getJson(endpoints.classes),
                getJson(endpoints.schedule),
            ]);

            console.log("API OK:", results);

            state.stats = results[0] || {};
            state.classes = results[1] || [];
            state.schedule = results[2] || [];

            renderStats();
            renderClassTable();
            renderClassSelect();
            renderSchedule();
            renderCalendar();
        } catch (err) {
            console.error("Lỗi load API:", err);
        }
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

    function bindNavigation() {
        var navItems = document.querySelectorAll(".sidebar-nav .nav-item");
        if (!navItems.length) return;

        function applyActiveState() {
            var activeHash = window.location.hash;
            if (!activeHash || !document.querySelector(activeHash)) {
                activeHash = "#overview";
            }

            navItems.forEach(function (item) {
                var href = item.getAttribute("href") || "";
                item.classList.remove("active");
                if (href === activeHash) {
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
                window.setTimeout(applyActiveState, 0);
            });
        });

        if (!window.location.hash || !document.querySelector(window.location.hash)) {
            history.replaceState(null, "", "#overview");
        }

        window.addEventListener("hashchange", applyActiveState);
        applyActiveState();
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
                window.location.hash = "#score-entry";
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

                body.innerHTML = '<tr><td colspan="4" class="empty">Đang tải...</td></tr>';

                getJson(endpoints.classStudents + Number(val))
                    .then(function (students) {
                        body.innerHTML = (students || []).map(function (sv) {
                            return "<tr>"
                                + "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>"
                                + "<td>" + escapeHtml(sv.FullName) + "</td>"
                                + "<td>" + escapeHtml(sv.DateOfBirth || '—') + "</td>"
                                + "<td>" + escapeHtml(sv.Gender || '—') + "</td>"
                                + "</tr>";
                        }).join('') || '<tr><td colspan="4" class="empty">Lớp chưa có sinh viên.</td></tr>';
                    })
                    .catch(function (err) {
                        body.innerHTML = '<tr><td colspan="4" class="empty">Lỗi tải dữ liệu: ' + escapeHtml(err.message) + '</td></tr>';
                    });
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
                var classId = document.getElementById('attendanceClassSelect').value;
                var date    = document.querySelector('#attendanceForm input[type="date"]').value;
                var body    = document.getElementById('attendanceTableBody');

                if (!classId || !date) {
                    alert('Vui lòng chọn lớp và ngày học!');
                    return;
                }

                body.innerHTML = '<tr><td colspan="5" class="empty">Đang tải...</td></tr>';

                getJson('/api/teachers/attendance/' + classId + '?date=' + date)
                    .then(function (students) {
                        body.innerHTML = (students || []).map(function (sv) {
                            var present  = sv.AttendanceStatus === 'Present'  ? 'checked' : '';
                            var absent   = sv.AttendanceStatus === 'Absent'   ? 'checked' : '';
                            var late     = sv.AttendanceStatus === 'Late'      ? 'checked' : '';
                            return "<tr data-enrollment-id='" + sv.EnrollmentId + "'>"
                                + "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>"
                                + "<td>" + escapeHtml(sv.FullName) + "</td>"
                                + "<td style='text-align:center'><input type='radio' name='att_" + sv.EnrollmentId + "' value='Present' " + present + "></td>"
                                + "<td style='text-align:center'><input type='radio' name='att_" + sv.EnrollmentId + "' value='Absent' " + absent + "></td>"
                                + "<td style='text-align:center'><input type='radio' name='att_" + sv.EnrollmentId + "' value='Late' " + late + "></td>"
                                + "</tr>";
                        }).join('') || '<tr><td colspan="5" class="empty">Lớp chưa có sinh viên.</td></tr>';
                    })
                    .catch(function (err) {
                        body.innerHTML = '<tr><td colspan="5" class="empty">Lỗi: ' + escapeHtml(err.message) + '</td></tr>';
                    });
            });
        }

        var attSaveBtn = document.getElementById('attendanceSaveBtn');
        if (attSaveBtn) {
            attSaveBtn.addEventListener('click', function () {
                var date = document.querySelector('#attendanceForm input[type="date"]').value;
                var rows = document.querySelectorAll('#attendanceTableBody tr[data-enrollment-id]');

                if (!rows.length || !date) {
                    alert('Chưa có dữ liệu điểm danh!');
                    return;
                }

                var records = [];
                rows.forEach(function (row) {
                    var enrollmentId = Number(row.dataset.enrollmentId);
                    var checked = row.querySelector('input[type="radio"]:checked');
                    if (checked) {
                        records.push({
                            EnrollmentId: enrollmentId,
                            SessionDate: date,
                            Status: checked.value
                        });
                    }
                });

                postJson('/api/teachers/attendance/save', { records: records })
                    .then(function () {
                        alert('Đã lưu điểm danh thành công!');
                    })
                    .catch(function (err) {
                        alert('Lỗi: ' + err.message);
                    });
            });
        }
        // 5. Notifications
        // Load danh sách thông báo đã gửi
        function loadNotifications() {
            var body = document.getElementById('notificationTableBody');
            getJson('/api/teachers/notifications/' + userId)
                .then(function (items) {
                    body.innerHTML = (items || []).map(function (n) {
                        var date = new Date(n.CreatedDate).toLocaleDateString('vi-VN');
                        return "<tr>"
                            + "<td>" + escapeHtml(n.Title) + "</td>"
                            + "<td><span class='badge info'>" 
                            +     Number(n.RecipientCount) + " SV"
                            + "</span></td>"
                            + "<td>" + date + "</td>"
                            + "</tr>";
                    }).join('') 
                    || '<tr><td colspan="3" class="empty">Bạn chưa gửi thông báo nào.</td></tr>';
                })
                .catch(function () {
                    body.innerHTML = '<tr><td colspan="3" class="empty">Lỗi tải dữ liệu.</td></tr>';
                });
        }

        // Gửi thông báo
        var notifSendBtn = document.getElementById('notificationSendBtn');
        if (notifSendBtn) {
            notifSendBtn.addEventListener('click', function () {
                var target  = document.getElementById('notificationTargetSelect').value;
                var title   = document.querySelector('#notificationForm input[required]').value.trim();
                var content = document.querySelector('#notificationForm textarea').value.trim();

                if (!title || !content) {
                    alert('Vui lòng nhập tiêu đề và nội dung!');
                    return;
                }

                // Nếu chọn "all" thì classId = null, ngược lại lấy classId
                var classId = (target === 'all' || !Number(target)) 
                            ? null 
                            : Number(target);

                notifSendBtn.disabled = true;
                notifSendBtn.textContent = 'Đang gửi...';

                postJson('/api/teachers/notifications/send', {
                    Title:   title,
                    Content: content,
                    ClassId: classId
                })
                .then(function () {
                    alert('Thông báo đã được gửi thành công!');
                    document.getElementById('notificationForm').reset();
                    loadNotifications(); // Reload danh sách
                })
                .catch(function (err) {
                    alert('Lỗi: ' + err.message);
                })
                .finally(function () {
                    notifSendBtn.disabled = false;
                    notifSendBtn.textContent = 'Gửi thông báo';
                });
            });
        }

        // Load lần đầu khi trang khởi động
        loadNotifications();
    }

    bindNavigation();
    bindEvents();
    initNewUIMockEvents();
    loadDashboardData().catch(function (error) {
        setMessage(error.message, "error");
    });
})();
