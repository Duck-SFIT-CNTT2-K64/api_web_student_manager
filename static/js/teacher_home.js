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
        var baseOption = '<option value="">Chọn lớp...</option>';
        var options = (state.classes || []).reduce(function(acc, item) {
            return acc + '<option value="' + item.ClassId + '">' + escapeHtml(item.ClassCode + " - " + item.ClassName) + ' (' + Number(item.StudentCount || 0) + ' SV)</option>';
        }, "");

        var selects = [
            { id: 'teacherClassSelect', def: '<option value="">Chọn lớp để nhập điểm</option>' },
            { id: 'classListSelect', def: baseOption },
            { id: 'examClassSelect', def: baseOption },
            { id: 'attendanceClassSelect', def: baseOption }
        ];

        selects.forEach(function(s) {
            var el = document.getElementById(s.id);
            if (el) el.innerHTML = s.def + options;
        });

        var notifSelect = document.getElementById('notificationTargetSelect');
        if (notifSelect) {
            notifSelect.innerHTML = '<option value="all">Tất cả sinh viên</option>' + options;
        }

        var teacherSelect = document.getElementById("teacherClassSelect");
        if (teacherSelect && state.selectedClassId) {
            teacherSelect.value = String(state.selectedClassId);
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

        // 2. Class List
        var classListBtn = document.getElementById("classListBtn");
        if (classListBtn) {
            classListBtn.addEventListener("click", async function () {
                var val = document.getElementById("classListSelect").value;
                var body = document.getElementById("classListTableBody");
                if (!val) {
                    alert("Vui lòng chọn lớp!");
                    return;
                }
                body.innerHTML = '<tr><td colspan="4" class="empty">Đang tải danh sách sinh viên...</td></tr>';
                try {
                    var students = await getJson(endpoints.classStudents + Number(val));
                    body.innerHTML = students.map(function(s) {
                        return "<tr>" +
                               "<td><strong>" + escapeHtml(s.StudentCode) + "</strong></td>" +
                               "<td>" + escapeHtml(s.FullName) + "</td>" +
                               "<td>" + escapeHtml(s.DateOfBirth ? String(s.DateOfBirth).slice(0, 10) : "Chưa cập nhật") + "</td>" +
                               "<td>" + escapeHtml(s.Gender || "---") + "</td>" +
                               "</tr>";
                    }).join("") || '<tr><td colspan="4" class="empty">Lớp chưa có sinh viên.</td></tr>';
                } catch (e) {
                    body.innerHTML = '<tr><td colspan="4" class="empty error" style="color:var(--error)">Lỗi: ' + escapeHtml(e.message) + "</td></tr>";
                }
            });
        }

        // 3. Exams
        var examForm = document.getElementById("examForm");
        if (examForm) {
            examForm.addEventListener("submit", function (e) {
                e.preventDefault();
                var title = examForm.querySelector("input[placeholder]").value;
                var classSel = document.getElementById("examClassSelect");
                var className = classSel.options[classSel.selectedIndex].text;
                var dueDate = examForm.querySelector('input[type="datetime-local"]').value;
                
                var body = document.getElementById("examTableBody");
                if (body.querySelector(".empty")) body.innerHTML = "";
                
                var row = document.createElement("tr");
                row.innerHTML = "<td>" + escapeHtml(title) + "</td><td>" + escapeHtml(className) + "</td><td>" + escapeHtml(dueDate.replace("T", " ")) + "</td><td><span class=\"badge good\">Đã giao</span></td>";
                body.prepend(row);
                
                alert("Tạo bài kiểm tra thành công! (Mô phỏng UI)");
                examForm.reset();
            });
        }

        // 4. Attendance
        var attSearchBtn = document.getElementById("attendanceSearchBtn");
        if (attSearchBtn) {
            attSearchBtn.addEventListener("click", async function () {
                var val = document.getElementById("attendanceClassSelect").value;
                var body = document.getElementById("attendanceTableBody");
                if (!val) {
                    alert("Vui lòng chọn lớp và ngày học để điểm danh!");
                    return;
                }
                body.innerHTML = '<tr><td colspan="5" class="empty">Đang tải danh sách sinh viên...</td></tr>';
                try {
                    var students = await getJson(endpoints.classStudents + Number(val));
                    body.innerHTML = students.map(function(s, idx) {
                        return "<tr>" +
                               "<td><strong>" + escapeHtml(s.StudentCode) + "</strong></td>" +
                               "<td>" + escapeHtml(s.FullName) + "</td>" +
                               "<td style=\"text-align:center\"><input type=\"radio\" name=\"att_" + idx + "\" value=\"present\" checked></td>" +
                               "<td style=\"text-align:center\"><input type=\"radio\" name=\"att_" + idx + "\" value=\"absent\"></td>" +
                               "<td style=\"text-align:center\"><input type=\"radio\" name=\"att_" + idx + "\" value=\"late\"></td>" +
                               "</tr>";
                    }).join("") || '<tr><td colspan="5" class="empty">Lớp chưa có sinh viên.</td></tr>';
                } catch (e) {
                    body.innerHTML = '<tr><td colspan="5" class="empty error" style="color:var(--error)">Lỗi: ' + escapeHtml(e.message) + "</td></tr>";
                }
            });
        }

        var attSaveBtn = document.getElementById("attendanceSaveBtn");
        if (attSaveBtn) {
            attSaveBtn.addEventListener("click", function () {
                var body = document.getElementById("attendanceTableBody");
                if (body.querySelector(".empty")) {
                    alert("Không có dữ liệu để lưu!");
                    return;
                }
                alert("Đã lưu điểm danh thành công! (Mô phỏng UI)");
            });
        }

        // 5. Notifications
        var notifSendBtn = document.getElementById("notificationSendBtn");
        if (notifSendBtn) {
            notifSendBtn.addEventListener("click", async function () {
                var notifForm = document.getElementById("notificationForm");
                var titleInput = notifForm.querySelector("input[placeholder]");
                var targetSel = document.getElementById("notificationTargetSelect");
                var contentText = notifForm.querySelector("textarea");
                
                if (!titleInput.value || !contentText.value) {
                    alert("Vui lòng nhập đầy đủ tiêu đề và nội dung.");
                    return;
                }
                
                try {
                    notifSendBtn.disabled = true;
                    notifSendBtn.textContent = "Đang gửi...";
                    
                    var payload = {
                        Title: titleInput.value,
                        Content: contentText.value,
                        CreatorId: userId,
                        Audience: "students"
                    };
                    await postJson("/api/notifications", payload);
                    
                    var body = document.getElementById("notificationTableBody");
                    if (body.querySelector(".empty")) body.innerHTML = "";
                    
                    var row = document.createElement("tr");
                    var targetName = targetSel.options[targetSel.selectedIndex].text;
                    row.innerHTML = "<td>" + escapeHtml(titleInput.value) + "</td><td>" + escapeHtml(targetName) + "</td><td>Vừa xong</td>";
                    body.prepend(row);
                    
                    alert("Gửi thông báo thành công!");
                    notifForm.reset();
                } catch (e) {
                    alert("Lỗi: " + e.message);
                } finally {
                    notifSendBtn.disabled = false;
                    notifSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo';
                }
            });
        }
    }

    bindNavigation();
    bindEvents();
    loadDashboardData().catch(function (error) {
        setMessage(error.message, "error");
    });
})();
