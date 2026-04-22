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
        exams: "/api/exams",
        examsByUser: "/api/exams/user/" + userId,
    };

    var weekdayMap = {
        "Thứ 2": "Thứ Hai",
        "Thứ 3": "Thứ Ba",
        "Thứ 4": "Thứ Tư",
        "Thứ 5": "Thứ Năm",
        "Thứ 6": "Thứ Sáu",
        "Thứ 7": "Thứ Bảy",
        "Chủ nhật": "Chủ Nhật"
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function toggleSubmenu(element) {
        const group = element.closest('.nav-group');
        if (group) group.classList.toggle('open');
    }

    // bindNavigation được định nghĩa bên dưới (sau loadReport)

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
        // Trả về json.data nếu có, ngược lại trả về toàn bộ json để lấy message/success
        return json.hasOwnProperty('data') ? json.data : json;
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

    async function putJson(url, payload) {
        var response = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return parseResponse(response);
    }

    async function deleteJson(url) {
        var response = await fetch(url, {
            method: "DELETE"
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
            var classId = Number(item.ClassId);
            return "<tr>"
                + "<td><strong>" + escapeHtml(item.ClassCode) + "</strong></td>"
                + "<td>" + escapeHtml(item.ClassName) + "</td>"
                + "<td>" + escapeHtml(item.CourseName) + "</td>"
                + "<td><span class=\"badge info\">" + Number(item.StudentCount || 0) + "</span></td>"
                + "<td style=\"display:flex;gap:8px;flex-wrap:wrap;\">"
                + "<button class=\"btn\" style=\"background:#dcfce7;color:#15803d;padding:6px 12px;font-size:0.85rem;border-radius:6px;border:none;cursor:pointer;\" type=\"button\" data-open-score-class=\"" + classId + "\"><i class=\"fas fa-pen\"></i> Nhập điểm</button>"
                + "<button class=\"btn\" style=\"background:#e0e7ff;color:#3730a3;padding:6px 12px;font-size:0.85rem;border-radius:6px;border:none;cursor:pointer;\" type=\"button\" data-open-class-list=\"" + classId + "\"><i class=\"fas fa-users\"></i> Danh sách</button>"
                + "<button class=\"btn\" style=\"background:#fef3c7;color:#b45309;padding:6px 12px;font-size:0.85rem;border-radius:6px;border:none;cursor:pointer;\" type=\"button\" data-open-exam-class=\"" + classId + "\"><i class=\"fas fa-file-alt\"></i> Bài tập</button>"
                + "<button class=\"btn\" style=\"background:#fef9c3;color:#854d0e;padding:6px 12px;font-size:0.85rem;border-radius:6px;border:none;cursor:pointer;\" type=\"button\" data-open-attendance-class=\"" + classId + "\"><i class=\"fas fa-clipboard-check\"></i> Điểm danh</button>"
                + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="5" class="empty">Chưa có lớp được phân công.</td></tr>';
    }

    function renderClassSelect() {
        var baseOption = '<option value="">Chọn lớp...</option>';
        var options = (state.classes || []).reduce(function (acc, item) {
            return acc + '<option value="' + item.ClassId + '">' + escapeHtml(item.ClassCode + " - " + item.ClassName) + ' (' + Number(item.StudentCount || 0) + ' SV)</option>';
        }, "");

        var selects = [
            { id: 'teacherClassSelect', def: '<option value="">Chọn lớp để nhập điểm</option>' },
            { id: 'classListSelect', def: baseOption },
            { id: 'examClassSelect', def: baseOption },
            { id: 'attendanceClassSelect', def: baseOption },
            { id: 'scoreViewClassSelect', def: '<option value="">Chọn lớp để xem điểm...</option>' },
        ];

        selects.forEach(function (s) {
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

    function renderCalendar() {
        var container = document.getElementById("calendar");
        if (!container) return;

        var days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
        var dayLabels = {
            "Thứ 2": "Thứ Hai",
            "Thứ 3": "Thứ Ba",
            "Thứ 4": "Thứ Tư",
            "Thứ 5": "Thứ Năm",
            "Thứ 6": "Thứ Sáu",
            "Thứ 7": "Thứ Bảy"
        };

        var map = {};
        days.forEach(function (d) { map[d] = []; });

        (state.schedule || []).forEach(function (item) {
            if (!map[item.Weekday]) return;
            var start = item.StartTime ? item.StartTime.slice(0, 5) : "--";
            var end = item.EndTime ? item.EndTime.slice(0, 5) : "--";
            map[item.Weekday].push(
                "<div class='calendar-item'>"
                + "<strong>" + escapeHtml(item.ClassCode || "") + "</strong><br>"
                + start + " – " + end + "<br>"
                + "<small>" + escapeHtml(item.RoomName || "") + "</small><br>"
                + "<div class='calendar-item-actions'>"
                + "<button class='btn-cal' data-cal-detail='" + Number(item.ClassId) + "'"
                + " data-cal-weekday='" + escapeHtml(item.Weekday) + "'>"
                + "<i class='fas fa-eye'></i> Xem chi tiết"
                + "</button>"
                + "</div>"
                + "</div>"
            );
        });

        container.innerHTML = "<div class='calendar-grid'>"
            + days.map(function (day) {
                return "<div class='calendar-col'>"
                    + "<div class='calendar-day-header'>" + dayLabels[day] + "</div>"
                    + (map[day].length
                        ? map[day].join("")
                        : "<div class='calendar-empty'>Không có lịch</div>")
                    + "</div>";
            }).join("")
            + "</div>";
    }

    function renderScoreStudents() {
        var tbody = document.getElementById("scoreStudentTableBody");
        if (!tbody) return;

        var saveAllBtn = document.getElementById("saveAllScoresBtn");
        var downloadBtn = document.getElementById("downloadTemplateBtn");
        var importLabel = document.getElementById("importExcelLabel");

        if (!state.classStudents || !state.classStudents.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Lớp chưa có sinh viên.</td></tr>';
            if (saveAllBtn) saveAllBtn.style.display = "none";
            if (downloadBtn) downloadBtn.style.display = "none";
            if (importLabel) importLabel.style.display = "none";
            return;
        }

        tbody.innerHTML = state.classStudents.map(function (item) {
            return "<tr data-enrollment-id=\"" + Number(item.EnrollmentId) + "\">"
                + "<td><strong>" + escapeHtml(item.StudentCode) + "</strong></td>"
                + "<td>" + escapeHtml(item.FullName) + "</td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"1\" value=\"" + (item.ChuyenCan ?? "") + "\"></td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"2\" value=\"" + (item.GiuaKy ?? "") + "\"></td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"3\" value=\"" + (item.CuoiKy ?? "") + "\"></td>"
                + "</tr>";
        }).join("");

        // Hiện các nút
        if (saveAllBtn) saveAllBtn.style.display = "inline-flex";
        if (downloadBtn) downloadBtn.style.display = "inline-flex";
        if (importLabel) importLabel.style.display = "inline-flex";
    }

    function exportClassListToExcel() {
        var select = document.getElementById("classListSelect");
        var classId = Number(select.value);
        var className = select.options[select.selectedIndex]
            ? select.options[select.selectedIndex].text
            : "DanhSachLop";

        var teacherName = document.getElementById("profileFullName") ? document.getElementById("profileFullName").textContent.trim() : "Giảng viên";

        if (!classId) {
            alert("Vui lòng chọn lớp trước!");
            return;
        }

        var exportBtn = document.getElementById("exportClassListBtn");
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Đang xuất...";
        }

        getJson(endpoints.classStudents + classId)
            .then(function (students) {
                if (!students || !students.length) {
                    alert("Lớp chưa có sinh viên!");
                    return;
                }

                // Tiêu đề theo mẫu: Giảng viên: [Tên], Lớp: [Tên]
                var data = [
                    ["Giảng viên:", teacherName],
                    ["Lớp:", className],
                    [] // Hàng trống
                ];

                // Header cột theo mẫu ảnh Excel
                data.push(["Ngày sinh", "Giới tính", "SĐT", "Email", "Địa chỉ", "", "Chuyên cần", "Giữa kỳ", "Cuối kỳ", "Điểm TB"]);

                students.forEach(function (sv) {
                    var cc = sv.ChuyenCan !== null && sv.ChuyenCan !== undefined ? Number(sv.ChuyenCan) : null;
                    var gk = sv.GiuaKy !== null && sv.GiuaKy !== undefined ? Number(sv.GiuaKy) : null;
                    var ck = sv.CuoiKy !== null && sv.CuoiKy !== undefined ? Number(sv.CuoiKy) : null;

                    var avg = "";
                    if (cc !== null && gk !== null && ck !== null) {
                        avg = ((cc + gk + ck) / 3).toFixed(2);
                    }

                    data.push([
                        sv.DateOfBirth || "",
                        sv.Gender || "",
                        sv.PhoneNumber || "",
                        sv.Email || "",
                        sv.Address || "",
                        "", // Cột trống theo ảnh
                        cc !== null ? cc : "",
                        gk !== null ? gk : "",
                        ck !== null ? ck : "",
                        avg
                    ]);
                });

                var ws = XLSX.utils.aoa_to_sheet(data);

                ws["!cols"] = [
                    { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 30 },
                    { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
                ];

                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Danh sách & Điểm");

                var fileName = "DanhSach_" + className.replace(/[^a-zA-Z0-9_]/g, "_") + ".xlsx";
                XLSX.writeFile(wb, fileName);
            })
            .catch(function (err) {
                alert("Lỗi xuất Excel: " + err.message);
            })
            .finally(function () {
                if (exportBtn) {
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = "<i class='fas fa-file-excel'></i> Xuất Excel";
                }
            });
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

            // Load report statistics on initial load
            loadReport();
        } catch (err) {
            console.error("Lỗi load API:", err);
        }
    }

    // ---- Score View ----
    async function loadScoreView(classId) {
        var body = document.getElementById('scoreViewBody');
        var summary = document.getElementById('scoreViewSummary');
        var exportBtn = document.getElementById('exportScoreBtn');
        if (!classId) {
            if (body) body.innerHTML = '<tr><td colspan="7" class="empty">Chọn một lớp để hiển thị bảng điểm.</td></tr>';
            if (summary) summary.style.display = 'none';
            return;
        }
        if (body) body.innerHTML = '<tr><td colspan="7" class="empty">Đang tải...</td></tr>';
        try {
            var students = await getJson(endpoints.classStudents + Number(classId));
            renderScoreView(students || []);
        } catch (err) {
            if (body) body.innerHTML = '<tr><td colspan="7" class="empty">Lỗi: ' + escapeHtml(err.message) + '</td></tr>';
        }
    }

    function renderScoreView(students) {
        var body = document.getElementById('scoreViewBody');
        var summary = document.getElementById('scoreViewSummary');
        var exportBtn = document.getElementById('exportScoreBtn');
        if (!body) return;

        if (!students.length) {
            body.innerHTML = '<tr><td colspan="7" class="empty">Lớp chưa có sinh viên.</td></tr>';
            if (summary) summary.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'none';
            return;
        }

        var totalPass = 0, totalFail = 0;
        body.innerHTML = students.map(function (sv) {
            var cc = sv.ChuyenCan != null ? Number(sv.ChuyenCan) : null;
            var gk = sv.GiuaKy != null ? Number(sv.GiuaKy) : null;
            var ck = sv.CuoiKy != null ? Number(sv.CuoiKy) : null;
            var dtb = null;
            if (cc != null && gk != null && ck != null) {
                dtb = Math.round((0.1 * cc + 0.3 * gk + 0.6 * ck) * 10) / 10;
            }
            var passed = dtb != null && dtb >= 5.0;
            if (dtb != null) { passed ? totalPass++ : totalFail++; }
            var resultBadge = dtb == null
                ? '<span class="badge">Chưa có điểm</span>'
                : (passed ? '<span class="badge good">Đạt</span>' : '<span class="badge bad">Không đạt</span>');
            return '<tr>'
                + '<td><strong>' + escapeHtml(sv.StudentCode) + '</strong></td>'
                + '<td>' + escapeHtml(sv.FullName) + '</td>'
                + '<td>' + (cc != null ? cc : '<span style="color:#94a3b8">--</span>') + '</td>'
                + '<td>' + (gk != null ? gk : '<span style="color:#94a3b8">--</span>') + '</td>'
                + '<td>' + (ck != null ? ck : '<span style="color:#94a3b8">--</span>') + '</td>'
                + '<td><strong style="color:' + (dtb == null ? '#94a3b8' : (dtb >= 8 ? '#16a34a' : (dtb >= 5 ? '#d97706' : '#ef4444'))) + '">' + (dtb != null ? dtb : '--') + '</strong></td>'
                + '<td>' + resultBadge + '</td>'
                + '</tr>';
        }).join('');

        // Summary stats
        var total = students.length;
        var svTotal = document.getElementById('svTotalCount');
        var svPass = document.getElementById('svPassCount');
        var svFail = document.getElementById('svFailCount');
        if (svTotal) svTotal.textContent = total;
        if (svPass) svPass.textContent = totalPass;
        if (svFail) svFail.textContent = totalFail;
        if (summary) summary.style.display = 'block';
        if (exportBtn) exportBtn.style.display = 'inline-flex';
    }

    // ---- Report / Statistics ----
    async function loadReport() {
        try {
            var data = await getJson(endpoints.report);
            renderReport(data);
        } catch (err) {
            console.warn('Lỗi tải báo cáo:', err.message);
            var reportBody = document.getElementById('reportClassStatsBody');
            if (reportBody) reportBody.innerHTML = '<tr><td colspan="6" class="empty">Không thể tải số liệu.</td></tr>';
        }
    }

    function renderReport(data) {
        if (!data) return;

        // KPI cards
        var avgAtt = document.getElementById('avgAttendance');
        var passRateEl = document.getElementById('passRate');
        var excellentEl = document.getElementById('excellentCount');
        if (avgAtt) avgAtt.textContent = data.avg_attendance != null ? data.avg_attendance + '%' : '--';
        if (passRateEl) passRateEl.textContent = data.pass_rate != null ? data.pass_rate + '%' : '--';
        if (excellentEl) excellentEl.textContent = data.excellent_count || 0;

        // Detail column
        var topClass = document.getElementById('topClass');
        var topClassAvg = document.getElementById('topClassAvg');
        var reportTotal = document.getElementById('reportTotalStudents');
        var reportClasses = document.getElementById('reportTotalClasses');
        if (topClass) topClass.textContent = data.top_class || '--';
        if (topClassAvg) topClassAvg.textContent = data.top_class_avg != null ? data.top_class_avg.toFixed(2) : '--';
        if (reportTotal) reportTotal.textContent = data.total_students || 0;
        if (reportClasses) reportClasses.textContent = (data.class_stats || []).length;

        // Progress bars
        var passRateVal = data.pass_rate || 0;
        var attRateVal = data.avg_attendance || 0;
        var passBarText = document.getElementById('passRateBar');
        var passFill = document.getElementById('passRateBarFill');
        var attBarText = document.getElementById('attendanceRateBar');
        var attFill = document.getElementById('attendanceBarFill');
        if (passBarText) passBarText.textContent = data.pass_rate != null ? data.pass_rate + '%' : '--';
        if (passFill) setTimeout(function () { passFill.style.width = Math.min(passRateVal, 100) + '%'; }, 100);
        if (attBarText) attBarText.textContent = data.avg_attendance != null ? data.avg_attendance + '%' : '--';
        if (attFill) setTimeout(function () { attFill.style.width = Math.min(attRateVal, 100) + '%'; }, 100);

        // Per-class table
        var tbody = document.getElementById('reportClassStatsBody');
        if (tbody) {
            var stats = data.class_stats || [];
            if (!stats.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="empty">Chưa có dữ liệu.</td></tr>';
            } else {
                tbody.innerHTML = stats.map(function (cls) {
                    var avg = cls.AvgScore != null ? Number(cls.AvgScore).toFixed(2) : '--';
                    var avgColor = cls.AvgScore == null ? '#94a3b8' : (cls.AvgScore >= 8 ? '#16a34a' : (cls.AvgScore >= 5 ? '#d97706' : '#ef4444'));
                    return '<tr>'
                        + '<td><strong>' + escapeHtml(cls.ClassCode || '') + '</strong><br><small>' + escapeHtml(cls.ClassName || '') + '</small></td>'
                        + '<td>' + escapeHtml(cls.CourseName || '--') + '</td>'
                        + '<td><span class="badge info">' + (cls.TotalStudents || 0) + '</span></td>'
                        + '<td><strong style="color:' + avgColor + '">' + avg + '</strong></td>'
                        + '<td><span class="badge good">' + (cls.PassCount || 0) + '</span></td>'
                        + '<td><span class="badge" style="background:rgba(234,88,12,.15);color:#ea580c;">' + (cls.ExcellentCount || 0) + '</span></td>'
                        + '</tr>';
                }).join('');
            }
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

            // Active state cho nav-subitem
            document.querySelectorAll(".nav-subitem").forEach(function (item) {
                var href = item.getAttribute("href") || "";
                item.classList.remove("active");
                if (href === activeHash) {
                    item.classList.add("active");
                    // Mở submenu cha nếu chưa mở
                    var group = item.closest(".nav-group");
                    if (group) group.classList.add("open");
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

        // Helper for custom navigation to prevent browser scroll jump
        function navigateTo(hash, e) {
            if (e) e.preventDefault();
            if (window.location.hash !== hash) {
                history.pushState(null, null, hash);
            }
            applyActiveState();
        }

        // Click handler cho nav-item thường (có href)
        navItems.forEach(function (link) {
            if (link.classList.contains("has-sub")) return; // bỏ qua .has-sub
            link.addEventListener("click", function (e) {
                var href = this.getAttribute("href");
                if (href && href.startsWith("#")) {
                    navigateTo(href, e);
                }
            });
        });

        // Click handler riêng cho .has-sub → toggle submenu
        document.querySelectorAll(".nav-item.has-sub").forEach(function (el) {
            el.addEventListener("click", function (e) {
                e.stopPropagation();
                toggleSubmenu(this);
            });
        });

        // Click handler cho nav-subitem
        document.querySelectorAll(".nav-subitem").forEach(function (link) {
            link.addEventListener("click", function (e) {
                var href = this.getAttribute("href");
                if (href && href.startsWith("#")) {
                    navigateTo(href, e);
                }
            });
        });

        // Click handler cho qa-card
        document.querySelectorAll(".qa-card").forEach(function (link) {
            link.addEventListener("click", function (e) {
                var href = this.getAttribute("href");
                if (href && href.startsWith("#")) {
                    navigateTo(href, e);
                }
            });
        });

        if (!window.location.hash || !document.querySelector(window.location.hash)) {
            history.replaceState(null, "", "#overview");
        }

        window.addEventListener("hashchange", applyActiveState);
        applyActiveState();
    }

    function getLastOccurrence(weekdayStr) {
        var weekdayToJs = {
            "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3,
            "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6, "Chủ nhật": 0
        };

        var targetDay = weekdayToJs[weekdayStr];
        if (targetDay === undefined) return new Date().toISOString().slice(0, 10);

        var today = new Date();
        var todayDay = today.getDay();

        var diff = (todayDay - targetDay + 7) % 7;

        var result = new Date(today);
        result.setDate(today.getDate() - diff);
        return result.toISOString().slice(0, 10);
    }

    // Load danh sách bài kiểm tra
    function loadExams() {
        var body = document.getElementById("examTableBody");
        if (!body) return;

        getJson(endpoints.examsByUser)   // <-- đổi từ endpoints.exams
            .then(function (exams) {
                body.innerHTML = (exams || []).map(function (ex) {
                    var due = new Date(ex.DueDate).toLocaleString("vi-VN");
                    var now = new Date();
                    var isDue = new Date(ex.DueDate) < now;
                    var badge = ex.Status === "Active" && !isDue
                        ? "<span class='badge good'>Đang mở</span>"
                        : "<span class='badge bad'>Đã đóng</span>";
                    return "<tr>"
                        + "<td>" + escapeHtml(ex.Title) + "</td>"
                        + "<td>" + escapeHtml(ex.ClassCode + " - " + ex.ClassName) + "</td>"
                        + "<td>" + escapeHtml(ex.ExamType) + "</td>"
                        + "<td>" + due + "</td>"
                        + "<td>" + badge + "</td>"
                        + "<td>"
                        + "<button class='btn btn-ghost' data-delete-exam='" + ex.ExamId + "'>"
                        + "<i class='fas fa-trash'></i></button>"
                        + "</td>"
                        + "</tr>";
                }).join("")
                    || '<tr><td colspan="6" class="empty">Chưa có bài kiểm tra nào.</td></tr>';
            })
            .catch(function (err) {
                var body = document.getElementById("examTableBody");
                if (body) body.innerHTML = '<tr><td colspan="6" class="empty">Lỗi tải dữ liệu.</td></tr>';
            });
    }
    // Sửa examForm submit
    var examForm = document.getElementById("examForm");
    if (examForm) {
        examForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var classId = document.getElementById("examClassSelect").value;
            var title = examForm.querySelector("input[placeholder]").value.trim();
            var examType = document.getElementById("examTypeSelect").value;
            var dueDate = examForm.querySelector('input[type="datetime-local"]').value;
            var description = examForm.querySelector("textarea").value.trim();

            if (!classId || !title || !dueDate) {
                alert("Vui lòng điền đầy đủ thông tin!");
                return;
            }

            postJson(endpoints.exams, {
                ClassId: Number(classId),
                Title: title,
                ExamType: examType,
                Description: description,
                DueDate: dueDate,
            })
                .then(function () {
                    alert("Tạo bài kiểm tra thành công!");
                    examForm.reset();
                    loadExams();
                })
                .catch(function (err) {
                    alert("Lỗi: " + err.message);
                });
        });
    }

    // Xóa bài kiểm tra
    document.addEventListener("click", function (e) {
        var deleteBtn = e.target.closest("[data-delete-exam]");
        if (deleteBtn) {
            var examId = Number(deleteBtn.getAttribute("data-delete-exam"));
            if (!confirm("Xóa bài kiểm tra này?")) return;
            fetch(endpoints.exams + "/" + examId, { method: "DELETE" })
                .then(function () { loadExams(); })
                .catch(function (err) { alert("Lỗi: " + err.message); });
        }
    });

    // Gọi load lần đầu
    loadExams();

    // Hàm tải danh sách sinh viên của lớp và hiển thị form nhập điểm
    function downloadScoreTemplate() {
        var select = document.getElementById("teacherClassSelect");
        var className = select.options[select.selectedIndex]
            ? select.options[select.selectedIndex].text : "Template";

        var rows = document.querySelectorAll("#scoreStudentTableBody tr[data-enrollment-id]");
        if (!rows.length) {
            alert("Vui lòng tải danh sách sinh viên trước!");
            return;
        }

        var data = [
            ["Mã SV", "Họ tên", "Ngày sinh", "Giới tính", "Chuyên cần", "Giữa kỳ", "Cuối kỳ"]
        ];

        rows.forEach(function (row) {
            var cells = row.querySelectorAll("td");
            var inputs = row.querySelectorAll("input[data-score-type]");
            data.push([
                cells[0] ? cells[0].textContent.trim() : "",
                cells[1] ? cells[1].textContent.trim() : "",
                "",  // Ngày sinh — để trống, chỉ tham khảo
                "",  // Giới tính — để trống
                inputs[0] && inputs[0].value !== "" ? Number(inputs[0].value) : "",
                inputs[1] && inputs[1].value !== "" ? Number(inputs[1].value) : "",
                inputs[2] && inputs[2].value !== "" ? Number(inputs[2].value) : "",
            ]);
        });

        var ws = XLSX.utils.aoa_to_sheet(data);
        ws["!cols"] = [
            { wch: 12 }, // Mã SV
            { wch: 30 }, // Họ tên
            { wch: 14 }, // Ngày sinh
            { wch: 10 }, // Giới tính
            { wch: 14 }, // Chuyên cần
            { wch: 12 }, // Giữa kỳ
            { wch: 10 }, // Cuối kỳ
        ];

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Nhập điểm");
        XLSX.writeFile(wb, "NhapDiem_" + className.replace(/[^a-zA-Z0-9_]/g, "_") + ".xlsx");
    }

    // Hàm xử lý file Excel được upload để điền điểm vào bảng HTML
    function importScoreFromExcel(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                var workbook = XLSX.read(data, { type: "array" });
                var sheet = workbook.Sheets[workbook.SheetNames[0]];
                var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

                if (!rows || rows.length < 2) {
                    setMessage("File Excel không có dữ liệu!", "error");
                    return;
                }

                // Đọc header để tìm vị trí cột linh hoạt
                var header = rows[0].map(function (h) {
                    return String(h).trim().toLowerCase();
                });

                var colMaSV = header.findIndex(function (h) { return h.includes("mã sv") || h.includes("ma sv") || h === "mã sv"; });
                var colChuyenCan = header.findIndex(function (h) { return h.includes("chuyên") || h.includes("chuyen"); });
                var colGiuaKy = header.findIndex(function (h) { return h.includes("giữa") || h.includes("giua"); });
                var colCuoiKy = header.findIndex(function (h) { return h.includes("cuối") || h.includes("cuoi"); });

                // Fallback về vị trí mặc định nếu không tìm được
                if (colMaSV < 0) colMaSV = 0;
                if (colChuyenCan < 0) colChuyenCan = 4;
                if (colGiuaKy < 0) colGiuaKy = 5;
                if (colCuoiKy < 0) colCuoiKy = 6;

                var dataRows = rows.slice(1).filter(function (r) {
                    return String(r[colMaSV] || "").trim() !== "";
                });

                if (!dataRows.length) {
                    setMessage("Không tìm thấy dữ liệu hợp lệ trong file!", "error");
                    return;
                }

                // Validate điểm
                var errors = [];
                dataRows.forEach(function (row, idx) {
                    [colChuyenCan, colGiuaKy, colCuoiKy].forEach(function (col) {
                        if (row[col] !== "" && row[col] !== null && row[col] !== undefined) {
                            var val = Number(row[col]);
                            if (isNaN(val) || val < 0 || val > 10) {
                                errors.push("Dòng " + (idx + 2) + " [" + rows[0][col] + "]: '" + row[col] + "' không hợp lệ.");
                            }
                        }
                    });
                });

                if (errors.length) {
                    setMessage(errors.join(" | "), "error");
                    return;
                }

                // Build map: MaSV → <tr>
                var trMap = {};
                document.querySelectorAll("#scoreStudentTableBody tr[data-enrollment-id]").forEach(function (tr) {
                    var maSV = tr.querySelector("td:first-child")
                        ? tr.querySelector("td:first-child").textContent.trim()
                        : "";
                    if (maSV) trMap[maSV] = tr;
                });

                // Điền điểm vào bảng
                var filled = 0;
                var skipped = 0;
                dataRows.forEach(function (row) {
                    var maSV = String(row[colMaSV] || "").trim();
                    var tr = trMap[maSV];
                    if (!tr) { skipped++; return; }

                    var inputs = tr.querySelectorAll("input[data-score-type]");
                    var cc = row[colChuyenCan];
                    var gk = row[colGiuaKy];
                    var ck = row[colCuoiKy];

                    if (cc !== "" && cc !== null && cc !== undefined && inputs[0]) inputs[0].value = Number(cc);
                    if (gk !== "" && gk !== null && gk !== undefined && inputs[1]) inputs[1].value = Number(gk);
                    if (ck !== "" && ck !== null && ck !== undefined && inputs[2]) inputs[2].value = Number(ck);
                    filled++;
                });

                var msg = "Đã import điểm cho " + filled + " sinh viên.";
                if (skipped > 0) msg += " (" + skipped + " mã SV không khớp, bỏ qua.)";
                msg += " Nhấn 'Lưu tất cả điểm' để lưu vào hệ thống.";
                setMessage(msg, "success");

                document.getElementById("importExcelInput").value = "";

            } catch (err) {
                setMessage("Lỗi đọc file: " + err.message, "error");
            }
        };
        reader.readAsArrayBuffer(file);
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

        // Tải file mẫu
        var downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
        if (downloadTemplateBtn) {
            downloadTemplateBtn.addEventListener("click", function () {
                downloadScoreTemplate();
            });
        }

        // Import Excel
        var importExcelInput = document.getElementById("importExcelInput");
        if (importExcelInput) {
            importExcelInput.addEventListener("change", function () {
                var file = this.files[0];
                if (!file) return;
                importScoreFromExcel(file);
            });
        }

        // Xuất Excel
        var exportBtn = document.getElementById("exportClassListBtn");
        if (exportBtn) {
            exportBtn.addEventListener("click", function () {
                exportClassListToExcel();
            });
        }

        // 4. Attendance
        var attSearchBtn = document.getElementById("attendanceSearchBtn");
        if (attSearchBtn) {
            attSearchBtn.addEventListener('click', function () {
                var classId = document.getElementById('attendanceClassSelect').value;
                var date = document.querySelector('#attendanceForm input[type="date"]').value;
                var body = document.getElementById('attendanceTableBody');

                if (!classId || !date) {
                    alert('Vui lòng chọn lớp và ngày học!');
                    return;
                }

                body.innerHTML = '<tr><td colspan="5" class="empty">Đang tải...</td></tr>';

                getJson('/api/teachers/attendance/' + classId + '?date=' + date)
                    .then(function (students) {
                        body.innerHTML = (students || []).map(function (sv) {
                            var present = sv.AttendanceStatus === 'Present' ? 'checked' : '';
                            var absent = sv.AttendanceStatus === 'Absent' ? 'checked' : '';
                            var late = sv.AttendanceStatus === 'Late' ? 'checked' : '';
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

        document.addEventListener("click", function (event) {
            // 1. Mở form nhập điểm từ bảng lớp học
            var openBtn = event.target.closest("[data-open-score-class]");
            if (openBtn) {
                var classId = Number(openBtn.getAttribute("data-open-score-class"));
                window.location.hash = "#score-entry";
                loadClassStudents(classId).catch(function (error) {
                    setMessage(error.message, "error");
                });
                return;
            }

            // 1.2. Mở danh sách lớp
            var openListBtn = event.target.closest("[data-open-class-list]");
            if (openListBtn) {
                var classId = Number(openListBtn.getAttribute("data-open-class-list"));
                window.location.hash = "#class-list";
                var select = document.getElementById("classListSelect");
                if (select) {
                    select.value = String(classId);
                    var btn = document.getElementById("classListBtn");
                    if (btn) btn.click();
                }
                return;
            }

            // 1.3. Mở tạo bài kiểm tra
            var openExamBtn = event.target.closest("[data-open-exam-class]");
            if (openExamBtn) {
                var classId = Number(openExamBtn.getAttribute("data-open-exam-class"));
                window.location.hash = "#exams";
                var select = document.getElementById("examClassSelect");
                if (select) select.value = String(classId);
                return;
            }

            // 1.4. Mở điểm danh
            var openAttBtn = event.target.closest("[data-open-attendance-class]");
            if (openAttBtn) {
                var classId = Number(openAttBtn.getAttribute("data-open-attendance-class"));
                window.location.hash = "#attendance";
                var select = document.getElementById("attendanceClassSelect");
                if (select) select.value = String(classId);

                var dateInput = document.getElementById("attendanceDateInput");
                if (dateInput && !dateInput.value) {
                    dateInput.value = new Date().toISOString().slice(0, 10);
                }
                var btn = document.getElementById("attendanceSearchBtn");
                if (btn) btn.click();
                return;
            }

            // 2. Xem chi tiết trong lịch
            var calDetailBtn = event.target.closest("[data-cal-detail]");
            if (calDetailBtn) {
                var classId = Number(calDetailBtn.getAttribute("data-cal-detail"));
                var weekday = calDetailBtn.getAttribute("data-cal-weekday");

                var classInfo = (state.classes || []).find(function (c) {
                    return Number(c.ClassId) === classId;
                });
                var schedInfo = (state.schedule || []).find(function (s) {
                    return Number(s.ClassId) === classId && s.Weekday === weekday;
                });

                var modalTitle = document.getElementById("calDetailModalTitle");
                var modalSub = document.getElementById("calDetailModalSubtitle");
                if (modalTitle) modalTitle.textContent = classInfo
                    ? (classInfo.ClassCode + " - " + classInfo.ClassName)
                    : "Chi tiết lớp";
                if (modalSub && schedInfo) modalSub.textContent =
                    (weekdayMap[schedInfo.Weekday] || schedInfo.Weekday)
                    + " · " + (schedInfo.StartTime || "").slice(0, 5)
                    + " – " + (schedInfo.EndTime || "").slice(0, 5)
                    + " · " + (schedInfo.RoomName || "");

                var tbody = document.getElementById("calDetailTableBody");
                if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty">Đang tải...</td></tr>';

                getJson(endpoints.classStudents + classId)
                    .then(function (students) {
                        if (!tbody) return;
                        tbody.innerHTML = (students || []).map(function (sv, idx) {
                            return "<tr>"
                                + "<td>" + (idx + 1) + "</td>"
                                + "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>"
                                + "<td>" + escapeHtml(sv.FullName) + "</td>"
                                + "<td>" + escapeHtml(sv.DateOfBirth || "—") + "</td>"
                                + "<td>" + escapeHtml(sv.Gender || "—") + "</td>"
                                + "</tr>";
                        }).join("") || '<tr><td colspan="5" class="empty">Lớp chưa có sinh viên.</td></tr>';
                    })
                    .catch(function () {
                        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty">Lỗi tải dữ liệu.</td></tr>';
                    });

                var modal = document.getElementById("calDetailModal");
                if (modal) modal.style.display = "flex";
                return;
            }

            // Sửa/Xóa thông báo
            var btnEditNotif = event.target.closest('.btn-edit-notif');
            if (btnEditNotif) {
                event.stopPropagation();
                var card = btnEditNotif.closest('.notice-card');
                var n = JSON.parse(decodeURIComponent(card.getAttribute('data-notif')));

                var form = document.getElementById('notificationForm');
                if (form) {
                    form.dataset.editId = n.NotificationId;
                    form.querySelector('input[required]').value = n.Title;
                    form.querySelector('textarea').value = n.Content;
                    var targetSelect = document.getElementById('notificationTargetSelect');
                    if (targetSelect) {
                        targetSelect.value = n.ClassId ? String(n.ClassId) : 'all';
                        targetSelect.disabled = true;
                    }

                    var sendBtn = document.getElementById('notificationSendBtn');
                    if (sendBtn) {
                        sendBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật thông báo';
                        sendBtn.classList.remove('btn-primary');
                        sendBtn.classList.add('btn-warning');
                        sendBtn.style.background = '#f59e0b';
                        sendBtn.style.color = '#fff';
                    }

                    if (!document.getElementById('notificationCancelBtn')) {
                        var cancelBtn = document.createElement('button');
                        cancelBtn.id = 'notificationCancelBtn';
                        cancelBtn.type = 'button';
                        cancelBtn.className = 'btn btn-ghost';
                        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Hủy';
                        cancelBtn.style.marginLeft = '8px';
                        cancelBtn.onclick = function () {
                            form.removeAttribute('data-edit-id');
                            form.reset();
                            var ts = document.getElementById('notificationTargetSelect');
                            if (ts) {
                                ts.disabled = false;
                                ts.value = 'all';
                            }
                            if (sendBtn) {
                                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo';
                                sendBtn.classList.add('btn-primary');
                                sendBtn.classList.remove('btn-warning');
                                sendBtn.style.background = '';
                                sendBtn.disabled = false;
                            }
                            this.remove();
                        };
                        if (sendBtn && sendBtn.parentNode) {
                            sendBtn.parentNode.insertBefore(cancelBtn, sendBtn.nextSibling);
                        }
                    }

                    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            var btnDelNotif = event.target.closest('.btn-del-notif');
            if (btnDelNotif) {
                event.stopPropagation();
                if (confirm('Bạn có chắc chắn muốn xóa thông báo này? Dữ liệu người nhận cũng sẽ bị xóa.')) {
                    var card = btnDelNotif.closest('.notice-card');
                    var n = JSON.parse(decodeURIComponent(card.getAttribute('data-notif')));

                    btnDelNotif.disabled = true;
                    deleteJson('/api/teachers/notifications/' + n.NotificationId)
                        .then(function () {
                            alert('Đã xóa thông báo!');
                            if (typeof loadNotifications === 'function') loadNotifications();
                        })
                        .catch(function (err) {
                            alert('Lỗi: ' + err.message);
                        })
                        .finally(function () {
                            btnDelNotif.disabled = false;
                        });
                }
                return;
            }

            // Xóa sinh viên khỏi lớp
            var btnDelStudent = event.target.closest('.btn-del-student-class');
            if (btnDelStudent) {
                event.stopPropagation();
                if (confirm('Bạn có chắc chắn muốn xóa sinh viên này khỏi lớp?')) {
                    var enrollmentId = btnDelStudent.getAttribute('data-enrollment-id');
                    btnDelStudent.disabled = true;
                    deleteJson('/api/teachers/enroll/' + enrollmentId)
                        .then(function () {
                            alert('Đã xóa sinh viên khỏi lớp!');
                            var classListBtn = document.getElementById('classListBtn');
                            if (classListBtn) classListBtn.click(); // Reload list
                        })
                        .catch(function (err) {
                            alert('Lỗi: ' + err.message);
                        })
                        .finally(function () {
                            btnDelStudent.disabled = false;
                        });
                }
                return;
            }

            // Xóa bài kiểm tra
            var btnDelExam = event.target.closest('.btn-del-exam');
            if (btnDelExam) {
                event.stopPropagation();
                if (confirm('Bạn có chắc chắn muốn xóa bài kiểm tra này?')) {
                    var examId = btnDelExam.getAttribute('data-id');
                    btnDelExam.disabled = true;
                    deleteJson('/api/teachers/exams/' + examId)
                        .then(function () {
                            alert('Đã xóa bài kiểm tra!');
                            loadExams();
                        })
                        .catch(function (err) {
                            alert('Lỗi: ' + err.message);
                        })
                        .finally(function () {
                            btnDelExam.disabled = false;
                        });
                }
                return;
            }

            // 3. Mở modal thông báo
            var notifLink = event.target.closest('.notif-title-link');
            if (notifLink) {
                event.preventDefault();
                var n = JSON.parse(decodeURIComponent(notifLink.getAttribute('data-notif')));

                document.getElementById('notifModalTitle').textContent = n.Title || "";
                document.getElementById('notifModalContent').textContent = n.Content || "";
                document.getElementById('notifModalCreator').textContent = "Giảng viên " + (n.CreatorName || "bạn");
                document.getElementById('notifModalTarget').textContent = Number(n.RecipientCount) + " sinh viên";
                document.getElementById('notifModalDate').textContent = new Date(n.CreatedDate).toLocaleString('vi-VN');

                var modal = document.getElementById('notifModal');
                if (modal) modal.style.display = 'flex';
                return;
            }

            // 4. Đóng các modal khi click nền
            if (event.target.id === 'calDetailModal') {
                event.target.style.display = 'none';
            }
            if (event.target.id === 'notifModal') {
                event.target.style.display = 'none';
            }
        });

        // Nút trong modal lịch
        var goScoreBtn = document.getElementById("calDetailGoScore");
        if (goScoreBtn) {
            goScoreBtn.onclick = function () {
                document.getElementById("calDetailModal").style.display = "none";
                var classId = Number(document.getElementById("calDetailModalTitle")?.dataset.classId || state.selectedClassId);
                // Vì dataset có thể không có, ta nên lấy từ logic mở modal nếu cần, nhưng ở đây dùng biến tạm hoặc tìm lại.
                // Để đơn giản, ta sẽ gán classId vào modal khi mở.
            };
        }
        // Sửa lại đoạn mở modal để gán classId
        // (Tôi sẽ gán trực tiếp onclick trong bindEvents cho các nút tĩnh nếu có thể, hoặc dùng delegation)

        // Quay lại gán onclick động trong data-cal-detail delegation ở trên là tốt nhất, 
        // nhưng để giữ logic cũ của user, tôi sẽ để các nút modal ở đây.
        var calModal = document.getElementById("calDetailModal");
        var calClose = document.getElementById("calDetailModalClose");
        if (calClose) {
            calClose.addEventListener("click", function () {
                calModal.style.display = "none";
            });
        }

        var notifModal = document.getElementById("notifModal");
        var notifClose = document.getElementById("notifModalClose");
        if (notifClose) {
            notifClose.addEventListener("click", function () {
                notifModal.style.display = "none";
            });
        }

        // Lưu tất cả điểm
        var saveAllBtn = document.getElementById("saveAllScoresBtn");
        if (saveAllBtn) {
            saveAllBtn.addEventListener("click", function () {
                var rows = document.querySelectorAll("#scoreStudentTableBody tr[data-enrollment-id]");
                if (!rows.length) {
                    setMessage("Không có dữ liệu để lưu.", "error");
                    return;
                }

                var tasks = [];
                var hasError = false;

                rows.forEach(function (row) {
                    var enrollmentId = Number(row.dataset.enrollmentId);
                    row.querySelectorAll("input[data-score-type]").forEach(function (input) {
                        if (input.value === "") return;
                        var score = Number(input.value);
                        if (Number.isNaN(score) || score < 0 || score > 10) {
                            hasError = true;
                            return;
                        }
                        tasks.push(postJson(endpoints.saveScore, {
                            EnrollmentId: enrollmentId,
                            ScoreTypeId: Number(input.dataset.scoreType),
                            ScoreValue: score,
                        }));
                    });
                });

                if (hasError) {
                    setMessage("Điểm phải nằm trong khoảng 0 đến 10.", "error");
                    return;
                }
                if (!tasks.length) {
                    setMessage("Chưa có điểm nào được nhập.", "error");
                    return;
                }

                saveAllBtn.disabled = true;
                saveAllBtn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Đang lưu...";
                setMessage("", "");

                Promise.all(tasks)
                    .then(function () {
                        setMessage("Đã lưu tất cả điểm thành công!", "success");
                        return Promise.all([
                            loadClassStudents(state.selectedClassId),
                            loadDashboardData()
                        ]);
                    })
                    .catch(function (err) {
                        setMessage(err.message, "error");
                    })
                    .finally(function () {
                        saveAllBtn.disabled = false;
                        saveAllBtn.innerHTML = "<i class='fas fa-save'></i> Lưu tất cả điểm";
                    });
            });
        }

        // Xem danh sách sinh viên lớp
        var classListBtn = document.getElementById("classListBtn");
        if (classListBtn) {
            classListBtn.addEventListener("click", function () {
                var val = document.getElementById("classListSelect").value;
                var body = document.getElementById("classListTableBody");
                if (!val) {
                    alert("Vui lòng chọn lớp!");
                    return;
                }

                body.innerHTML = '<tr><td colspan="7" class="empty">Đang tải...</td></tr>';
                getJson(endpoints.classStudents + Number(val))
                    .then(function (students) {
                        body.innerHTML = (students || []).map(function (sv, idx) {
                            return "<tr class='student-row'>"
                                + "<td>" + (idx + 1) + "</td>"
                                + "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>"
                                + "<td>" + escapeHtml(sv.FullName) + "</td>"
                                + "<td>" + escapeHtml(sv.DateOfBirth || "—") + "</td>"
                                + "<td>" + escapeHtml(sv.Gender || "—") + "</td>"
                                + "<td>" + escapeHtml(sv.PhoneNumber || "—") + "</td>"
                                + "</tr>";
                        }).join("") || '<tr><td colspan="7" class="empty">Lớp chưa có sinh viên.</td></tr>';

                        var exportBtn = document.getElementById("exportClassListBtn");
                        if (exportBtn) {
                            exportBtn.style.display = students && students.length ? "inline-flex" : "none";
                        }
                    })
                    .catch(function (err) {
                        body.innerHTML = '<tr><td colspan="7" class="empty">Lỗi: ' + escapeHtml(err.message) + '</td></tr>';
                    });
            });
        }

        // Tìm kiếm sinh viên
        var searchInput = document.getElementById("studentSearchInput");
        if (searchInput) {
            searchInput.addEventListener("input", function () {
                var query = this.value.toLowerCase().trim();
                var rows = document.querySelectorAll("#classListTableBody tr.student-row");
                rows.forEach(function (row) {
                    var text = row.textContent.toLowerCase();
                    row.style.display = text.includes(query) ? "" : "none";
                });
            });
        }

        // Thêm/Xóa sinh viên nhanh (Full Form)
        var actionStudentCode = document.getElementById("actionStudentCode");
        var actionFullName = document.getElementById("actionFullName");
        var actionEmail = document.getElementById("actionEmail");
        var actionPhone = document.getElementById("actionPhone");
        var actionDob = document.getElementById("actionDob");
        var actionGender = document.getElementById("actionGender");
        var actionAddress = document.getElementById("actionAddress");

        var quickAddBtn = document.getElementById("quickAddStudentBtn");
        var quickRemoveBtn = document.getElementById("quickRemoveStudentBtn");

        // Tự động điền thông tin khi nhập mã SV
        if (actionStudentCode) {
            actionStudentCode.addEventListener("blur", function () {
                var code = this.value.trim();
                if (!code) return;

                getJson("/api/teachers/student/" + code)
                    .then(function (res) {
                        if (res.success && res.student) {
                            var sv = res.student;
                            if (actionFullName) actionFullName.value = sv.FullName || "";
                            if (actionEmail) actionEmail.value = sv.Email || "";
                            if (actionPhone) actionPhone.value = sv.PhoneNumber || "";
                            if (actionDob) actionDob.value = sv.DateOfBirth ? sv.DateOfBirth.split('T')[0] : "";
                            if (actionGender) actionGender.value = sv.Gender || "";
                            if (actionAddress) actionAddress.value = sv.Address || "";
                        }
                    })
                    .catch(function (err) {
                        // Không tìm thấy thì thôi, người dùng tự nhập mới
                        console.log("Student not found or error:", err.message);
                    });
            });
        }

        if (quickAddBtn) {
            quickAddBtn.addEventListener("click", function () {
                var classIdSelect = document.getElementById("classListSelect");
                var classId = classIdSelect ? classIdSelect.value : "";
                if (!classId) { alert("Vui lòng chọn lớp!"); return; }

                var payload = {
                    ClassId: classId,
                    StudentCode: actionStudentCode ? actionStudentCode.value.trim() : "",
                    FullName: actionFullName ? actionFullName.value.trim() : "",
                    Email: actionEmail ? actionEmail.value.trim() : "",
                    PhoneNumber: actionPhone ? actionPhone.value.trim() : "",
                    DateOfBirth: actionDob ? actionDob.value : "",
                    Gender: actionGender ? actionGender.value : "",
                    Address: actionAddress ? actionAddress.value.trim() : ""
                };

                if (!payload.StudentCode) { alert("Vui lòng nhập mã sinh viên!"); return; }
                if (!payload.FullName) { alert("Vui lòng nhập họ tên sinh viên!"); return; }

                quickAddBtn.disabled = true;
                postJson("/api/teachers/student/save", payload)
                    .then(function (res) {
                        alert(res.message || "Lưu thành công!");
                        // Clear form
                        if (actionStudentCode) actionStudentCode.value = "";
                        if (actionFullName) actionFullName.value = "";
                        if (actionEmail) actionEmail.value = "";
                        if (actionPhone) actionPhone.value = "";
                        if (actionDob) actionDob.value = "";
                        if (actionGender) actionGender.value = "";
                        if (actionAddress) actionAddress.value = "";

                        var classListBtn = document.getElementById("classListBtn");
                        if (classListBtn) classListBtn.click(); // Refresh list
                    })
                    .catch(function (err) { alert("Lỗi: " + err.message); })
                    .finally(function () { quickAddBtn.disabled = false; });
            });
        }

        if (quickRemoveBtn) {
            quickRemoveBtn.addEventListener("click", function () {
                var classId = document.getElementById("classListSelect").value;
                var studentCode = actionStudentCode.value.trim();
                if (!classId) { alert("Vui lòng chọn lớp!"); return; }
                if (!studentCode) { alert("Vui lòng nhập mã sinh viên!"); return; }

                if (confirm("Bạn có chắc muốn xóa sinh viên " + studentCode + " khỏi lớp này?")) {
                    quickRemoveBtn.disabled = true;
                    postJson("/api/teachers/unenroll", { ClassId: classId, StudentCode: studentCode })
                        .then(function (res) {
                            alert(res.message || "Đã xóa thành công!");
                            actionStudentCode.value = "";
                            if (classListBtn) classListBtn.click(); // Refresh list
                        })
                        .catch(function (err) { alert("Lỗi: " + err.message); })
                        .finally(function () { quickRemoveBtn.disabled = false; });
                }
            });
        }

        // Lưu điểm danh
        var attSaveBtn = document.getElementById("attendanceSaveBtn");
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

        // Gửi thông báo
        var notifSendBtn = document.getElementById('notificationSendBtn');
        if (notifSendBtn) {
            notifSendBtn.addEventListener('click', function () {
                var form = document.getElementById('notificationForm');
                var target = document.getElementById('notificationTargetSelect').value;
                var title = form.querySelector('input[required]').value.trim();
                var content = form.querySelector('textarea').value.trim();

                if (!title || !content) {
                    alert('Vui lòng nhập tiêu đề và nội dung!');
                    return;
                }

                var classId = (target === 'all' || !Number(target)) ? null : Number(target);
                var editId = form.dataset.editId;

                notifSendBtn.disabled = true;
                notifSendBtn.innerHTML = editId ? '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...' : '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

                if (editId) {
                    putJson('/api/teachers/notifications/' + editId, {
                        Title: title,
                        Content: content
                    })
                        .then(function () {
                            alert('Thông báo đã được cập nhật!');
                            var cancelBtn = document.getElementById('notificationCancelBtn');
                            if (cancelBtn) cancelBtn.click(); // Reset form and remove editId
                            loadNotifications();
                        })
                        .catch(function (err) {
                            alert('Lỗi: ' + err.message);
                        })
                        .finally(function () {
                            // Only reset button state if it hasn't been reset by cancelBtn.click() yet
                            if (notifSendBtn && !document.getElementById('notificationCancelBtn')) {
                                notifSendBtn.disabled = false;
                            } else if (notifSendBtn) {
                                notifSendBtn.disabled = false;
                                notifSendBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật thông báo';
                            }
                        });
                } else {
                    postJson('/api/teachers/notifications/send', {
                        Title: title,
                        Content: content,
                        ClassId: classId
                    })
                        .then(function () {
                            alert('Thông báo đã được gửi thành công!');
                            form.reset();
                            loadNotifications();
                        })
                        .catch(function (err) {
                            alert('Lỗi: ' + err.message);
                        })
                        .finally(function () {
                            notifSendBtn.disabled = false;
                            notifSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo';
                        });
                }
            });
        }

        function loadNotifications() {
            var list = document.getElementById('notificationTableBody');
            if (!list) return;
            getJson('/api/teachers/notifications/' + userId)
                .then(function (items) {
                    list.innerHTML = (items || []).map(function (n) {
                        var date = new Date(n.CreatedDate).toLocaleDateString('vi-VN');
                        var read = Number(n.ReadCount || 0);
                        var total = Number(n.RecipientCount || 0);
                        var percent = total > 0 ? Math.round((read * 100) / total) : 0;
                        var contentPreview = escapeHtml(n.Content || "");
                        if (contentPreview.length > 100) contentPreview = contentPreview.substring(0, 100) + '...';

                        return '<article class="notice-card notif-title-link" style="position:relative;cursor:pointer;transition:transform 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.05)" data-notif=\'' + encodeURIComponent(JSON.stringify(n)) + '\' onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 8px rgba(0,0,0,0.1)\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.05)\'">' +
                            '<div style="position:absolute; top:12px; right:12px; display:flex; gap:4px;">' +
                            '<button type="button" class="btn-ghost btn-edit-notif" style="padding:6px; color:#f59e0b; border-radius:6px; background:transparent; border:none; cursor:pointer;" title="Chỉnh sửa"><i class="fas fa-edit"></i></button>' +
                            '<button type="button" class="btn-ghost btn-del-notif" style="padding:6px; color:#ef4444; border-radius:6px; background:transparent; border:none; cursor:pointer;" title="Xóa"><i class="fas fa-trash"></i></button>' +
                            '</div>' +
                            '<div style="padding-right: 70px;"><strong>' + escapeHtml(n.Title) + '</strong>' +
                            '<small style="margin-top:4px;color:#64748b;">' + date + ' · Bạn</small></div>' +
                            '<p style="color:#475569;margin:8px 0;line-height:1.5;">' + contentPreview + '</p>' +
                            '<span style="color:#0ea5e9;font-weight:600;font-size:0.85rem;">' + read + '/' + total + ' đã đọc · ' + percent + '%</span>' +
                            '</article>';
                    }).join('') || '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-inbox" style="font-size:2rem;margin-bottom:10px;display:block;"></i>Bạn chưa gửi thông báo nào.</div>';
                })
                .catch(function () {
                    list.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Lỗi tải dữ liệu.</div>';
                });
        }

        // Xem điểm lớp
        var scoreViewLoadBtn = document.getElementById('scoreViewLoadBtn');
        if (scoreViewLoadBtn) {
            scoreViewLoadBtn.addEventListener('click', function () {
                var classId = document.getElementById('scoreViewClassSelect').value;
                if (!classId) {
                    alert('Vui lòng chọn lớp để xem điểm!');
                    return;
                }
                loadScoreView(Number(classId));
            });
        }

        var scoreViewSel = document.getElementById('scoreViewClassSelect');
        if (scoreViewSel) {
            scoreViewSel.addEventListener('change', function () {
                if (this.value) loadScoreView(Number(this.value));
            });
        }

        var exportScoreViewBtn = document.getElementById('exportScoreBtn');
        if (exportScoreViewBtn) {
            exportScoreViewBtn.addEventListener('click', function () {
                var select = document.getElementById('scoreViewClassSelect');
                var className = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : 'BangDiem';
                var teacherName = document.getElementById("profileFullName") ? document.getElementById("profileFullName").textContent.trim() : "Giảng viên";
                var rows = document.querySelectorAll('#scoreViewBody tr');

                if (!rows.length || rows[0].querySelector('.empty')) {
                    alert('Chưa có dữ liệu để xuất!');
                    return;
                }

                // Header theo yêu cầu: Giảng viên, Lớp
                var data = [
                    ["Giảng viên:", teacherName],
                    ["Lớp:", className],
                    [],
                    ['Mã SV', 'Họ tên', 'Chuyên cần', 'Giữa kỳ', 'Cuối kỳ', 'ĐTB', 'Kết quả']
                ];

                rows.forEach(function (row) {
                    var cells = row.querySelectorAll('td');
                    if (cells.length >= 7) {
                        data.push([
                            cells[0].textContent.trim(),
                            cells[1].textContent.trim(),
                            cells[2].textContent.trim(),
                            cells[3].textContent.trim(),
                            cells[4].textContent.trim(),
                            cells[5].textContent.trim(),
                            cells[6].textContent.trim()
                        ]);
                    }
                });

                var ws = XLSX.utils.aoa_to_sheet(data);
                ws["!cols"] = [
                    { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }
                ];

                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Bảng điểm");
                XLSX.writeFile(wb, 'BangDiem_' + className.replace(/[^a-zA-Z0-9_]/g, "_") + '.xlsx');
            });
        }

        // Làm mới báo cáo
        var reloadReportBtn = document.getElementById('reloadReportBtn');
        if (reloadReportBtn) {
            reloadReportBtn.addEventListener('click', function () {
                reloadReportBtn.disabled = true;
                reloadReportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
                loadReport().finally(function () {
                    reloadReportBtn.disabled = false;
                    reloadReportBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Làm mới';
                });
            });
        }

        // Khởi tạo thông báo
        loadNotifications();

        // Khởi tạo báo cáo và bài kiểm tra
        loadReport();
        loadExams();

        // Tạo bài kiểm tra
        var examForm = document.getElementById('examForm');
        if (examForm) {
            examForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var classId = document.getElementById('examClassSelect').value;
                var title = examForm.querySelector('input[required]').value;
                var examType = document.getElementById('examTypeSelect').value;
                var dueDate = document.getElementById('examDueDate').value;
                var desc = document.getElementById('examDescription').value;

                var btn = examForm.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';

                postJson('/api/teachers/exams', {
                    ClassId: classId,
                    Title: title,
                    ExamType: examType,
                    DueDate: dueDate,
                    Description: desc
                }).then(function () {
                    alert('Đã tạo bài kiểm tra!');
                    examForm.reset();
                    loadExams();
                }).catch(function (err) {
                    alert('Lỗi: ' + err.message);
                }).finally(function () {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-plus"></i> Tạo bài kiểm tra';
                });
            });
        }
    }

    function loadReport() {
        var body = document.getElementById('reportClassStatsBody');
        if (!body) return Promise.resolve();

        return getJson('/api/teachers/report/' + userId).then(function (res) {
            if (res) {
                var avgAtt = res.avg_attendance !== null ? Number(res.avg_attendance) : null;
                var passR = res.pass_rate !== null ? Number(res.pass_rate) : null;

                if (document.getElementById('avgAttendance')) document.getElementById('avgAttendance').textContent = (avgAtt !== null ? avgAtt + '%' : '--%');
                if (document.getElementById('passRate')) document.getElementById('passRate').textContent = (passR !== null ? passR + '%' : '--%');
                if (document.getElementById('excellentCount')) document.getElementById('excellentCount').textContent = res.excellent_count || 0;

                // Phần Tổng hợp
                if (document.getElementById('topClass')) document.getElementById('topClass').textContent = escapeHtml(res.top_class || '--');
                if (document.getElementById('topClassAvg')) document.getElementById('topClassAvg').textContent = res.top_class_avg !== null ? res.top_class_avg : '--';
                if (document.getElementById('reportTotalStudents')) document.getElementById('reportTotalStudents').textContent = res.total_students || 0;
                if (document.getElementById('reportTotalClasses')) document.getElementById('reportTotalClasses').textContent = (res.class_stats ? res.class_stats.length : 0);

                if (document.getElementById('passRateBar')) document.getElementById('passRateBar').textContent = (passR !== null ? passR + '%' : '0%');
                if (document.getElementById('passRateBarFill')) document.getElementById('passRateBarFill').style.width = (passR !== null ? passR : 0) + '%';

                if (document.getElementById('attendanceRateBar')) document.getElementById('attendanceRateBar').textContent = (avgAtt !== null ? avgAtt + '%' : '0%');
                if (document.getElementById('attendanceBarFill')) document.getElementById('attendanceBarFill').style.width = (avgAtt !== null ? avgAtt : 0) + '%';

                if (res.class_stats && res.class_stats.length > 0) {
                    body.innerHTML = res.class_stats.map(function (c) {
                        return '<tr>' +
                            '<td><strong>' + escapeHtml(c.ClassCode) + ' - ' + escapeHtml(c.ClassName) + '</strong></td>' +
                            '<td>' + escapeHtml(c.CourseName) + '</td>' +
                            '<td style="text-align:center;">' + (c.TotalStudents || 0) + '</td>' +
                            '<td style="text-align:center;font-weight:bold;color:#1e293b;">' + (c.AvgScore !== null ? Number(c.AvgScore).toFixed(2) : '--') + '</td>' +
                            '<td style="text-align:center;color:#15803d;">' + (c.PassCount || 0) + '</td>' +
                            '<td style="text-align:center;color:#9a3412;">' + (c.ExcellentCount || 0) + '</td>' +
                            '</tr>';
                    }).join('');
                } else {
                    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8;">Không có dữ liệu thống kê.</td></tr>';
                }
            }
        }).catch(function (err) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#ef4444;">Lỗi tải báo cáo: ' + escapeHtml(err.message) + '</td></tr>';
        });
    }

    function loadExams() {
        var tbody = document.getElementById('examTableBody');
        if (!tbody) return;
        getJson('/api/teachers/exams/' + userId).then(function (exams) {
            if (exams && exams.length > 0) {
                tbody.innerHTML = exams.map(function (e) {
                    var date = new Date(e.DueDate).toLocaleString('vi-VN');
                    return '<tr>' +
                        '<td><strong>' + escapeHtml(e.Title) + '</strong></td>' +
                        '<td>' + escapeHtml(e.ClassCode) + ' - ' + escapeHtml(e.ClassName) + '</td>' +
                        '<td><span class="badge">' + escapeHtml(e.ExamType) + '</span></td>' +
                        '<td>' + date + '</td>' +
                        '<td><span class="badge good">' + escapeHtml(e.Status) + '</span></td>' +
                        '<td style="width:80px;"><button class="btn-ghost btn-del-exam" style="color:#ef4444;" title="Xóa bài kiểm tra" data-id="' + e.ExamId + '"><i class="fas fa-trash"></i></button></td>' +
                        '</tr>';
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8;font-style:italic;">Bạn chưa tạo bài kiểm tra nào.</td></tr>';
            }
        }).catch(function (err) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#ef4444;">Lỗi tải danh sách: ' + escapeHtml(err.message) + '</td></tr>';
        });
    }

    // Các hàm khởi tạo chính
    bindNavigation();
    bindEvents();
    loadDashboardData().catch(function (error) {
        console.error("Lỗi khởi động:", error);
    });

    window.toggleSubmenu = toggleSubmenu;
})();
