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
        examEditingId: null,
        examPdfFiles: [],
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
        "Monday": "Thứ Hai",
        "Tuesday": "Thứ Ba",
        "Wednesday": "Thứ Tư",
        "Thursday": "Thứ Năm",
        "Friday": "Thứ Sáu",
        "Saturday": "Thứ Bảy",
        "Sunday": "Chủ Nhật",
        "Thứ 2": "Thứ Hai",
        "Thứ 3": "Thứ Ba",
        "Thứ 4": "Thứ Tư",
        "Thứ 5": "Thứ Năm",
        "Thứ 6": "Thứ Sáu",
        "Thứ 7": "Thứ Bảy",
        "Chủ nhật": "Chủ Nhật"
    };

    // Map tiếng Anh sang tiếng Việt cho calendar
    var weekdayToVietnamese = {
        "Monday": "Thứ 2",
        "Tuesday": "Thứ 3",
        "Wednesday": "Thứ 4",
        "Thursday": "Thứ 5",
        "Friday": "Thứ 6",
        "Saturday": "Thứ 7",
        "Sunday": "Chủ nhật"
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function splitExamDescriptionAndPdf(rawDescription) {
        var text = String(rawDescription || "");
        var marker = "[PDFS]";
        var idx = text.lastIndexOf(marker);
        if (idx < 0) {
            var oldMarker = "[PDF]";
            var oldIdx = text.lastIndexOf(oldMarker);
            if (oldIdx < 0) return { description: text.trim(), pdfUrls: [] };
            var oldUrl = text.slice(oldIdx + oldMarker.length).trim();
            return {
                description: text.slice(0, oldIdx).trim(),
                pdfUrls: oldUrl ? [oldUrl] : [],
            };
        }
        var rawUrls = text.slice(idx + marker.length).split("\n");
        var pdfUrls = rawUrls.map(function (x) { return String(x || "").trim(); }).filter(Boolean);
        return {
            description: text.slice(0, idx).trim(),
            pdfUrls: pdfUrls,
        };
    }

    function composeExamDescription(description, pdfUrls) {
        var desc = String(description || "").trim();
        var urls = (pdfUrls || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
        if (!urls.length) return desc;
        if (!desc) return "[PDFS]\n" + urls.join("\n");
        return desc + "\n[PDFS]\n" + urls.join("\n");
    }

    function renderExamPdfList() {
        var list = document.getElementById("examPdfList");
        var status = document.getElementById("examPdfUploadStatus");
        if (!list) return;

        if (!state.examPdfFiles.length) {
            list.innerHTML = "";
            if (status) status.textContent = "Chưa tải file.";
            return;
        }

        list.innerHTML = state.examPdfFiles.map(function (url, idx) {
            var fileName = decodeURIComponent(String(url).split("/").pop() || ("file_" + (idx + 1) + ".pdf"));
            return '<div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;">'
                + '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" style="color:#1d4ed8;font-size:0.88rem;"><i class="fas fa-file-pdf" style="color:#dc2626;"></i> ' + escapeHtml(fileName) + '</a>'
                + '<button type="button" class="btn-ghost exam-pdf-remove" data-index="' + idx + '" title="Xóa file" style="color:#ef4444;"><i class="fas fa-trash"></i></button>'
                + '</div>';
        }).join("");
        if (status) status.textContent = "Đã tải " + state.examPdfFiles.length + " file PDF.";
    }

    async function uploadExamPdfFile(file) {
        if (!file) return;
        if (!String(file.name || "").toLowerCase().endsWith(".pdf")) {
            alert("Chỉ hỗ trợ file PDF.");
            return;
        }

        var status = document.getElementById("examPdfUploadStatus");
        if (status) status.textContent = "Đang tải file PDF...";

        var formData = new FormData();
        formData.append("file", file);
        try {
            var res = await postFormData("/api/exams/upload-pdf", formData);
            if (res.url) {
                state.examPdfFiles.push(res.url);
                renderExamPdfList();
            } else if (status) {
                status.textContent = "Upload không trả về URL.";
            }
        } catch (err) {
            if (status) status.textContent = "Tải file thất bại.";
            alert("Upload PDF lỗi: " + err.message);
        }
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

    async function postFormData(url, formData) {
        var response = await fetch(url, {
            method: "POST",
            body: formData
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
                + "<td>"
                + "<button class=\"btn\" style=\"background:#e0e7ff;color:#3730a3;padding:6px 14px;font-size:0.85rem;border-radius:6px;border:none;cursor:pointer;\""
                + " type=\"button\" data-cal-detail=\"" + classId + "\" data-cal-weekday=\"\">"
                + "<i class=\"fas fa-eye\"></i> Xem chi tiết"
                + "</button>"
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
            "Thứ 2": "Thứ Hai", "Thứ 3": "Thứ Ba", "Thứ 4": "Thứ Tư",
            "Thứ 5": "Thứ Năm", "Thứ 6": "Thứ Sáu", "Thứ 7": "Thứ Bảy"
        };

        // weekdayToJs: Thứ 2 = 1 (Mon), Thứ 7 = 6 (Sat)
        var weekdayToJs = {
            "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3,
            "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6
        };

        // State tuần hiện tại (offset tính từ tuần này, 0 = tuần này)
        if (typeof renderCalendar._weekOffset === "undefined") {
            renderCalendar._weekOffset = 0;
        }

        // Tính ngày đầu tuần (Thứ 2) theo offset
        function getWeekStart(offset) {
            var today = new Date();
            var day = today.getDay(); // 0=Sun, 1=Mon...
            var diffToMon = (day === 0 ? -6 : 1 - day);
            var mon = new Date(today);
            mon.setDate(today.getDate() + diffToMon + offset * 7);
            mon.setHours(0, 0, 0, 0);
            return mon;
        }

        function getDateOfWeekday(weekStart, weekdayStr) {
            var jsDay = weekdayToJs[weekdayStr]; // 1-6
            var result = new Date(weekStart);
            result.setDate(weekStart.getDate() + (jsDay - 1)); // Mon=+0, Tue=+1...
            return result;
        }

        function formatDate(date) {
            return date.getDate() + "/" + (date.getMonth() + 1);
        }

        function renderWeek() {
            var offset = renderCalendar._weekOffset;
            var weekStart = getWeekStart(offset);
            var weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 5); // Thứ 7

            // Label tuần
            var weekLabel = offset === 0
                ? "Tuần này"
                : offset === -1 ? "Tuần trước"
                : offset === 1 ? "Tuần sau"
                : "Tuần " + (offset > 0 ? "+" : "") + offset;

            var weekRange = formatDate(weekStart) + " – " + formatDate(weekEnd);
            var today = new Date();
            today.setHours(0, 0, 0, 0);

            var map = {};
            days.forEach(function (d) { map[d] = []; });

            (state.schedule || []).forEach(function (item) {
                var weekdayVi = weekdayToVietnamese[item.Weekday] || item.Weekday;
                if (!map[weekdayVi]) return;

                var sessionDate = getDateOfWeekday(weekStart, weekdayVi);
                var isToday = sessionDate.getTime() === today.getTime();
                var isPast  = sessionDate < today;

                var start = item.StartTime ? item.StartTime.slice(0, 5) : "--";
                var end   = item.EndTime   ? item.EndTime.slice(0, 5)   : "--";

                map[weekdayVi].push(
                    "<div class='calendar-item" + (isPast ? " cal-past" : "") + (isToday ? " cal-today" : "") + "'>"
                    + "<strong style='color:#1e293b;'>" + escapeHtml(item.ClassCode || "") + "</strong><br>"
                    + "<span style='color:#475569;font-size:0.8rem;'>" + start + " – " + end + "</span><br>"
                    + "<small style='color:#64748b;'>" + escapeHtml(item.RoomName || "") + "</small><br>"
                    + "<div class='calendar-item-actions'>"
                    + "<button class='btn-cal' data-cal-detail='" + Number(item.ClassId) + "'"
                    + " data-cal-weekday='" + escapeHtml(weekdayVi) + "'"
                    + " data-cal-date='" + sessionDate.toISOString().slice(0, 10) + "'>"
                    + "<i class='fas fa-eye'></i> Xem chi tiết"
                    + "</button>"
                    + "</div>"
                    + "</div>"
                );
            });

            container.innerHTML =
                // Header điều hướng tuần
                "<div class='calendar-nav'>"
                + "<button class='btn-cal-nav' id='calPrevWeek'><i class='fas fa-chevron-left'></i> Tuần trước</button>"
                + "<div class='calendar-nav-label'>"
                +   "<span class='calendar-week-label'>" + weekLabel + "</span>"
                +   "<span class='calendar-week-range'>" + weekRange + "</span>"
                + "</div>"
                + "<button class='btn-cal-nav' id='calNextWeek'>Tuần sau <i class='fas fa-chevron-right'></i></button>"
                + "</div>"
                // Grid lịch
                + "<div class='calendar-grid'>"
                + days.map(function (day) {
                    var sessionDate = getDateOfWeekday(weekStart, day);
                    var isToday = sessionDate.getTime() === today.getTime();
                    var dateStr = formatDate(sessionDate);
                    return "<div class='calendar-col" + (isToday ? " cal-col-today" : "") + "'>"
                        + "<div class='calendar-day-header'>"
                        +   dayLabels[day]
                        +   "<span class='calendar-day-date'>" + dateStr + "</span>"
                        + "</div>"
                        + (map[day].length
                            ? map[day].join("")
                            : "<div class='calendar-empty'>Không có lịch</div>")
                        + "</div>";
                }).join("")
                + "</div>";

            // Bind nút prev/next
            var prevBtn = document.getElementById("calPrevWeek");
            var nextBtn = document.getElementById("calNextWeek");
            if (prevBtn) {
                prevBtn.addEventListener("click", function () {
                    renderCalendar._weekOffset--;
                    renderWeek();
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener("click", function () {
                    renderCalendar._weekOffset++;
                    renderWeek();
                });
            }
        }

        renderWeek();
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
        var pdfDropZone = document.getElementById("examPdfDropZone");
        var pdfFileInput = document.getElementById("examPdfFileInput");
        if (pdfDropZone && pdfFileInput) {
            pdfDropZone.addEventListener("click", function () {
                pdfFileInput.click();
            });
            pdfFileInput.addEventListener("change", function () {
                var files = Array.from(this.files || []);
                files.forEach(function (file) { uploadExamPdfFile(file); });
                this.value = "";
            });
            pdfDropZone.addEventListener("dragover", function (e) {
                e.preventDefault();
                pdfDropZone.style.borderColor = "#2563eb";
                pdfDropZone.style.background = "#eff6ff";
            });
            pdfDropZone.addEventListener("dragleave", function () {
                pdfDropZone.style.borderColor = "#cbd5e1";
                pdfDropZone.style.background = "#f8fafc";
            });
            pdfDropZone.addEventListener("drop", function (e) {
                e.preventDefault();
                pdfDropZone.style.borderColor = "#cbd5e1";
                pdfDropZone.style.background = "#f8fafc";
                var files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
                files.forEach(function (file) { uploadExamPdfFile(file); });
            });
        }
        renderExamPdfList();

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
                var date = document.getElementById('attendanceDateInput').value;
                var body = document.getElementById('attendanceTableBody');

                if (!classId || !date) {
                    alert('Vui lòng chọn lớp và ngày học!');
                    return;
                }

                attSearchBtn.disabled = true;
                attSearchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
                body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';

                getJson('/api/teachers/attendance/' + classId + '?date=' + date)
                    .then(function (students) {
                        if (!students || students.length === 0) {
                            body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;"><i class="fas fa-users-slash" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>Lớp chưa có sinh viên.</td></tr>';
                        } else {
                            body.innerHTML = students.map(function (sv) {
                                var present = sv.AttendanceStatus === 'Present' ? 'checked' : '';
                                var absent = sv.AttendanceStatus === 'Absent' ? 'checked' : '';
                                var late = sv.AttendanceStatus === 'Late' ? 'checked' : '';
                                return "<tr data-enrollment-id='" + sv.EnrollmentId + "' style='hover:background:#f8fafc;'>"
                                    + "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>"
                                    + "<td>" + escapeHtml(sv.FullName) + "</td>"
                                    + "<td style='text-align:center'><label style='cursor:pointer;display:inline-flex;align-items:center;'><input type='radio' name='att_" + sv.EnrollmentId + "' value='Present' " + present + " style='margin-right:6px;'><span style='color:#15803d;font-weight:500;'>Có</span></label></td>"
                                    + "<td style='text-align:center'><label style='cursor:pointer;display:inline-flex;align-items:center;'><input type='radio' name='att_" + sv.EnrollmentId + "' value='Absent' " + absent + " style='margin-right:6px;'><span style='color:#b91c1c;font-weight:500;'>Vắng</span></label></td>"
                                    + "<td style='text-align:center'><label style='cursor:pointer;display:inline-flex;align-items:center;'><input type='radio' name='att_" + sv.EnrollmentId + "' value='Late' " + late + " style='margin-right:6px;'><span style='color:#ea580c;font-weight:500;'>Trễ</span></label></td>"
                                    + "</tr>";
                            }).join('');
                        }
                    })
                    .catch(function (err) {
                        body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#ef4444;"><i class="fas fa-exclamation-circle" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>Lỗi: ' + escapeHtml(err.message) + '</td></tr>';
                    })
                    .finally(function () {
                        attSearchBtn.disabled = false;
                        attSearchBtn.innerHTML = '<i class="fas fa-search"></i> Tải danh sách';
                    });
            });
        }

        document.addEventListener("click", function (event) {
            // Bài tập từ calendar
            var calExamBtn = event.target.closest("[data-cal-exam]");
            if (calExamBtn) {
                var classId = Number(calExamBtn.getAttribute("data-cal-exam"));
                var sel = document.getElementById("examClassSelect");
                if (sel) sel.value = String(classId);
                window.location.hash = "#exams";
                return;
            }

            // 2. Xem chi tiết trong lịch
            var calDetailBtn = event.target.closest("[data-cal-detail]");
            if (calDetailBtn) {
                var classId = Number(calDetailBtn.getAttribute("data-cal-detail"));
                var weekdayVi = calDetailBtn.getAttribute("data-cal-weekday");

                var classInfo = (state.classes || []).find(function (c) {
                    return Number(c.ClassId) === classId;
                });
                // Chuyển đổi weekday tiếng Việt sang tiếng Anh để so khớp với dữ liệu từ API
                var weekdayEn = null;
                for (var key in weekdayToVietnamese) {
                    if (weekdayToVietnamese[key] === weekdayVi) {
                        weekdayEn = key;
                        break;
                    }
                }
                var schedInfo = (state.schedule || []).find(function (s) {
                    return Number(s.ClassId) === classId && (s.Weekday === weekdayVi || s.Weekday === weekdayEn);
                });

                // Set tiêu đề
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

                // Lưu classId vào modal để 2 button dùng
                var modal = document.getElementById("calDetailModal");
                if (modal) modal.dataset.classId = classId;

                // Load danh sách sinh viên
                var tbody = document.getElementById("calDetailTableBody");
                if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;">Đang tải...</td></tr>';

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
                        }).join("") || '<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;">Lớp chưa có sinh viên.</td></tr>';
                    })
                    .catch(function () {
                        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;">Lỗi tải dữ liệu.</td></tr>';
                    });

                // Gán onclick cho button Nhập điểm
                var goScoreBtn = document.getElementById("calDetailGoScore");
                if (goScoreBtn) {
                    goScoreBtn.onclick = function () {
                        modal.style.display = "none";
                        var sel = document.getElementById("teacherClassSelect");
                        if (sel) sel.value = String(classId);
                        window.location.hash = "#score-entry";
                        loadClassStudents(classId).catch(function (err) {
                            setMessage(err.message, "error");
                        });
                    };
                }

                // Gán onclick cho button Điểm danh
                var goAttendBtn = document.getElementById("calDetailGoAttend");
                if (goAttendBtn) {
                    goAttendBtn.onclick = function () {
                        modal.style.display = "none";
                        var sel = document.getElementById("attendanceClassSelect");
                        if (sel) sel.value = String(classId);
                        var dateInput = document.getElementById("attendanceDateInput");
                        if (dateInput) {
                            // Ưu tiên dùng data-cal-date nếu có, fallback getLastOccurrence
                            var calDate = calDetailBtn.getAttribute("data-cal-date");
                            dateInput.value = calDate || getLastOccurrence(weekdayVi);
                        }
                        window.location.hash = "#attendance";
                        var searchBtn = document.getElementById("attendanceSearchBtn");
                        if (searchBtn) searchBtn.click();
                    };
                }

                // Gán onclick cho button Bài tập
                var goExamBtn = document.getElementById("calDetailGoExam");
                if (goExamBtn) {
                    goExamBtn.onclick = function () {
                        modal.style.display = "none";
                        var sel = document.getElementById("examClassSelect");
                        if (sel) sel.value = String(classId);
                        window.location.hash = "#exams";
                    };
                }

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
            var btnViewSubmissions = event.target.closest('.btn-view-submissions');
            if (btnViewSubmissions) {
                event.stopPropagation();
                var examId = btnViewSubmissions.getAttribute('data-id');
                var examTitle = btnViewSubmissions.getAttribute('data-title') || '';
                var modal = document.getElementById('examSubmissionsModal');
                var titleNode = document.getElementById('examSubmissionsTitle');
                var body = document.getElementById('examSubmissionsBody');
                if (titleNode) titleNode.textContent = 'Bài nộp - ' + examTitle;
                if (body) body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:#94a3b8;">Đang tải...</td></tr>';
                if (modal) modal.style.display = 'flex';

                getJson('/api/exams/' + examId + '/submissions')
                    .then(function (items) {
                        if (!body) return;
                        if (!items || !items.length) {
                            body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:#94a3b8;">Chưa có bài nộp.</td></tr>';
                            return;
                        }
                        body.innerHTML = items.map(function (s) {
                            var submittedAt = s.SubmittedAt ? new Date(s.SubmittedAt).toLocaleString('vi-VN') : '-';
                            var fileLink = s.FileUrl
                                ? '<a href="' + escapeHtml(s.FileUrl) + '" target="_blank" rel="noopener">Mở tệp</a>'
                                : '<span style="color:#94a3b8;">-</span>';
                            return '<tr>'
                                + '<td><strong>' + escapeHtml(s.StudentCode || '') + '</strong></td>'
                                + '<td>' + escapeHtml(s.FullName || '') + '</td>'
                                + '<td>' + submittedAt + '</td>'
                                + '<td>' + fileLink + '</td>'
                                + '<td><input type="number" min="0" max="10" step="0.1" value="' + (s.Grade != null ? Number(s.Grade) : '') + '" data-sub-grade="' + s.SubmissionId + '" style="width:80px;"></td>'
                                + '<td><input type="text" value="' + escapeHtml(s.Note || '') + '" data-sub-note="' + s.SubmissionId + '" placeholder="Nhập feedback..."></td>'
                                + '<td><select data-sub-status="' + s.SubmissionId + '">'
                                + '<option value="Pending"' + (s.Status === 'Pending' ? ' selected' : '') + '>Pending</option>'
                                + '<option value="Submitted"' + (s.Status === 'Submitted' ? ' selected' : '') + '>Submitted</option>'
                                + '<option value="Graded"' + (s.Status === 'Graded' ? ' selected' : '') + '>Graded</option>'
                                + '</select></td>'
                                + '<td><button class="btn btn-primary btn-save-submission-grade" data-exam-id="' + examId + '" data-sub-id="' + s.SubmissionId + '" style="padding:6px 10px;">Lưu</button></td>'
                                + '</tr>';
                        }).join('');
                    })
                    .catch(function (err) {
                        if (body) body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:#ef4444;">Lỗi: ' + escapeHtml(err.message) + '</td></tr>';
                    });
                return;
            }

            var btnSaveGrade = event.target.closest('.btn-save-submission-grade');
            if (btnSaveGrade) {
                event.stopPropagation();
                var examIdForGrade = Number(btnSaveGrade.getAttribute('data-exam-id'));
                var subId = Number(btnSaveGrade.getAttribute('data-sub-id'));
                var gradeInput = document.querySelector('[data-sub-grade="' + subId + '"]');
                var noteInput = document.querySelector('[data-sub-note="' + subId + '"]');
                var statusInput = document.querySelector('[data-sub-status="' + subId + '"]');
                var payloadGrade = {
                    Grade: gradeInput ? gradeInput.value : null,
                    Note: noteInput ? noteInput.value : '',
                    Status: statusInput ? statusInput.value : null,
                };
                btnSaveGrade.disabled = true;
                putJson('/api/exams/' + examIdForGrade + '/submissions/' + subId, payloadGrade)
                    .then(function () { alert('Đã cập nhật chấm bài.'); })
                    .catch(function (err) { alert('Lỗi: ' + err.message); })
                    .finally(function () { btnSaveGrade.disabled = false; });
                return;
            }

            var btnEditExam = event.target.closest('.btn-edit-exam');
            if (btnEditExam) {
                event.stopPropagation();
                var raw = btnEditExam.getAttribute('data-raw');
                if (!raw) return;
                var exam = JSON.parse(decodeURIComponent(raw));
                var parsedExamDesc = splitExamDescriptionAndPdf(exam.Description);
                state.examEditingId = Number(exam.ExamId);
                state.examPdfFiles = parsedExamDesc.pdfUrls || [];
                renderExamPdfList();
                document.getElementById('examClassSelect').value = String(exam.ClassId || '');
                document.getElementById('examTitleInput').value = exam.Title || '';
                document.getElementById('examTypeSelect').value = exam.ExamType || 'Trắc nghiệm';
                document.getElementById('examDescription').value = parsedExamDesc.description || '';
                var due = exam.DueDate ? new Date(exam.DueDate) : null;
                if (due && !Number.isNaN(due.getTime())) {
                    var local = new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    document.getElementById('examDueDate').value = local;
                }
                var submitBtn = document.querySelector('#examForm button[type="submit"]');
                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật bài kiểm tra';
                window.location.hash = '#exams';
                return;
            }

            var removePdfBtn = event.target.closest('.exam-pdf-remove');
            if (removePdfBtn) {
                event.stopPropagation();
                var idxToRemove = Number(removePdfBtn.getAttribute("data-index"));
                if (!Number.isNaN(idxToRemove) && idxToRemove >= 0) {
                    state.examPdfFiles.splice(idxToRemove, 1);
                    renderExamPdfList();
                }
                return;
            }

            var btnToggleExam = event.target.closest('.btn-toggle-exam');
            if (btnToggleExam) {
                event.stopPropagation();
                var examIdToggle = btnToggleExam.getAttribute('data-id');
                var nextStatus = btnToggleExam.getAttribute('data-next-status');
                var isOverdue = btnToggleExam.getAttribute('data-overdue') === 'true';

                // Nếu đang mở lại (Active) và bài đã quá hạn → yêu cầu chọn hạn mới
                if (nextStatus === 'Active' && isOverdue) {
                    var newDue = prompt(
                        'Bài kiểm tra đã quá hạn. Nhập hạn nộp mới (VD: 2025-12-31T23:59):',
                        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                            .toISOString().slice(0, 16)
                    );
                    if (!newDue) return; // User cancel

                    try {
                        var parsed = new Date(newDue);
                        if (isNaN(parsed.getTime()) || parsed <= new Date()) {
                            alert('Hạn nộp mới phải là thời điểm trong tương lai!');
                            return;
                        }
                    } catch (e) {
                        alert('Định dạng thời gian không hợp lệ!');
                        return;
                    }

                    putJson('/api/exams/' + examIdToggle + '/status', {
                        Status: 'Active',
                        DueDate: newDue
                    })
                        .then(function () { loadExams(); })
                        .catch(function (err) { alert('Lỗi: ' + err.message); });
                    return;
                }

                // Đóng bình thường
                putJson('/api/exams/' + examIdToggle + '/status', { Status: nextStatus })
                    .then(function () { loadExams(); })
                    .catch(function (err) { alert('Lỗi: ' + err.message); });
                return;
            }

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
            if (event.target.id === 'examSubmissionsModal') {
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

        var examSubmissionsModal = document.getElementById("examSubmissionsModal");
        var examSubmissionsClose = document.getElementById("examSubmissionsClose");
        if (examSubmissionsClose && examSubmissionsModal) {
            examSubmissionsClose.addEventListener("click", function () {
                examSubmissionsModal.style.display = "none";
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
                var date = document.getElementById('attendanceDateInput').value;
                var rows = document.querySelectorAll('#attendanceTableBody tr[data-enrollment-id]');

                if (!rows.length || !date) {
                    alert('Chưa có dữ liệu điểm danh!');
                    return;
                }

                var records = [];
                var selectedCount = 0;
                rows.forEach(function (row) {
                    var enrollmentId = Number(row.dataset.enrollmentId);
                    var checked = row.querySelector('input[type="radio"]:checked');
                    if (checked) {
                        selectedCount++;
                        records.push({
                            EnrollmentId: enrollmentId,
                            SessionDate: date,
                            Status: checked.value
                        });
                    }
                });

                if (!records.length) {
                    alert('Vui lòng chọn trạng thái điểm danh cho ít nhất một sinh viên!');
                    return;
                }

                attSaveBtn.disabled = true;
                attSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

                postJson('/api/teachers/attendance/save', { records: records })
                    .then(function () {
                        alert('Đã lưu điểm danh cho ' + selectedCount + ' sinh viên thành công!');
                        document.getElementById('attendanceSearchBtn').click(); // Reload
                    })
                    .catch(function (err) {
                        alert('Lỗi: ' + err.message);
                    })
                    .finally(function () {
                        attSaveBtn.disabled = false;
                        attSaveBtn.innerHTML = '<i class="fas fa-save"></i> Lưu điểm danh';
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
                    console.error("Lỗi load notifications:", err);
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
                var title = document.getElementById('examTitleInput').value;
                var examType = document.getElementById('examTypeSelect').value;
                var dueDate = document.getElementById('examDueDate').value;
                var desc = document.getElementById('examDescription').value;
                var editId = state.examEditingId;

                if (!classId || !title) {
                    alert('Vui lòng điền lớp học và tiêu đề!');
                    return;
                }

                var btn = examForm.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = editId
                    ? '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...'
                    : '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';

                var payload = {
                    ClassId: classId,
                    Title: title,
                    ExamType: examType,
                    DueDate: dueDate || null,
                    Description: composeExamDescription(desc, state.examPdfFiles)
                };
                var req = editId ? putJson('/api/exams/' + editId, payload) : postJson('/api/exams', payload);

                req.then(function () {
                    alert(editId ? 'Đã cập nhật bài kiểm tra!' : 'Đã tạo bài kiểm tra!');
                    examForm.reset();
                    state.examEditingId = null;
                    state.examPdfFiles = [];
                    renderExamPdfList();
                    loadExams();
                }).catch(function (err) {
                    alert('Lỗi: ' + err.message);
                }).finally(function () {
                    btn.disabled = false;
                    btn.innerHTML = state.examEditingId
                        ? '<i class="fas fa-save"></i> Cập nhật bài kiểm tra'
                        : '<i class="fas fa-plus"></i> Tạo bài kiểm tra';
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
        getJson('/api/exams/user/' + userId).then(function (exams) {
            if (exams && exams.length > 0) {
                tbody.innerHTML = exams.map(function (e) {
                    var date = new Date(e.DueDate) < new Date();
                    var isOpen = String(e.Status || '').toLowerCase() === 'active';
                    var isOverdue = new Date(e.DueDate) < new Date();
                    var badgeHtml = isOpen
                        ? '<span class="badge good">Đang mở</span>'
                        : '<span class="badge bad">Đã đóng</span>';
                    if (isOverdue) {
                        badgeHtml += ' <span class="badge" style="background:#fee2e2;color:#b91c1c;">Quá hạn</span>';
                    }
                    var parsed = splitExamDescriptionAndPdf(e.Description);
                    var firstPdf = parsed.pdfUrls && parsed.pdfUrls.length ? parsed.pdfUrls[0] : "";
                    var pdfCount = parsed.pdfUrls ? parsed.pdfUrls.length : 0;
                    var pdfHtml = firstPdf
                        ? '<a href="' + escapeHtml(firstPdf) + '" target="_blank" rel="noopener" title="Đề PDF (' + pdfCount + ' file)" style="color:#dc2626;"><i class="fas fa-file-pdf"></i> ' + pdfCount + '</a>'
                        : '<span style="color:#94a3b8;">-</span>';
                    var toggleIcon = isOpen ? 'fa-lock-open' : 'fa-lock';
                    var toggleTitle = isOpen ? 'Đang mở - bấm để đóng' : 'Đang đóng - bấm để mở';
                    return '<tr>' +
                        '<td><strong>' + escapeHtml(e.Title) + '</strong></td>' +
                        '<td>' + escapeHtml(e.ClassCode) + ' - ' + escapeHtml(e.ClassName) + '</td>' +
                        '<td><span class="badge">' + escapeHtml(e.ExamType) + '</span></td>' +
                        '<td>' + date + '</td>' +
                        '<td>' + badgeHtml + '</td>' +
                        '<td style="white-space:nowrap;">'
                        + '<button class="btn-ghost btn-view-submissions" style="color:#2563eb;" title="Xem bài nộp" data-id="' + e.ExamId + '" data-title="' + escapeHtml(e.Title) + '"><i class="fas fa-eye"></i></button>'
                        + '<button class="btn-ghost btn-edit-exam" style="color:#f59e0b;" title="Sửa bài kiểm tra" data-raw=\'' + encodeURIComponent(JSON.stringify(e)) + '\'><i class="fas fa-pen"></i></button>'
                        + '<button class="btn-ghost btn-toggle-exam" style="color:#059669;" title="' + toggleTitle + '" data-id="' + e.ExamId + '" data-next-status="' + (isOpen ? 'Closed' : 'Active') + '" data-overdue="' + (isOverdue ? 'true' : 'false') + '"><i class="fas ' + toggleIcon + '"></i></button>'
                        + '<span style="display:inline-block;width:24px;text-align:center;">' + pdfHtml + '</span>'
                        + '<button class="btn-ghost btn-del-exam" style="color:#ef4444;" title="Xóa bài kiểm tra" data-id="' + e.ExamId + '"><i class="fas fa-trash"></i></button>'
                        + '</td>' +
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

    // Profile editing functionality
    var editProfileBtn = document.getElementById('editProfileBtn');
    var editProfileModal = document.getElementById('editProfileModal');
    var editProfileForm = document.getElementById('editProfileForm');
    var editProfileSaveBtn = document.getElementById('editProfileSaveBtn');
    var editProfileCancelBtn = document.getElementById('editProfileCancelBtn');
    var editProfileModalClose = document.getElementById('editProfileModalClose');

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', function() {
            // Get profile data from the page
            var fullName = document.getElementById('profileFullName').textContent.trim();
            var nameParts = fullName.split(' ');
            var firstName = nameParts[0] || '';
            var lastName = nameParts.slice(1).join(' ') || '';

            // Get specialization from the profile card
            var specialization = '';
            var profileRows = document.querySelectorAll('.profile-row');
            profileRows.forEach(function(row) {
                var label = row.querySelector('.profile-row-label');
                var value = row.querySelector('.profile-row-value');
                if (label && value && label.textContent.includes('Chuyên môn')) {
                    specialization = value.textContent.trim();
                }
            });

            // Get email and phone from profile rows
            var email = '';
            var phone = '';
            profileRows.forEach(function(row) {
                var label = row.querySelector('.profile-row-label');
                var value = row.querySelector('.profile-row-value');
                if (label && value) {
                    if (label.textContent.includes('Email')) {
                        email = value.textContent.trim();
                    } else if (label.textContent.includes('Số điện thoại')) {
                        phone = value.textContent.trim();
                    }
                }
            });

            // Fill form
            document.getElementById('profileFirstName').value = firstName;
            document.getElementById('profileLastName').value = lastName;
            document.getElementById('profileSpecialization').value = specialization;
            document.getElementById('profileEmail').value = email;
            document.getElementById('profilePhone').value = phone;
            document.getElementById('profileUsername').value = (root.dataset.username || '').trim();
            document.getElementById('profilePassword').value = '';

            // Show modal
            editProfileModal.style.display = 'flex';
        });
    }

    if (editProfileCancelBtn) {
        editProfileCancelBtn.addEventListener('click', function() {
            editProfileModal.style.display = 'none';
            editProfileForm.reset();
        });
    }

    if (editProfileModalClose) {
        editProfileModalClose.addEventListener('click', function() {
            editProfileModal.style.display = 'none';
            editProfileForm.reset();
        });
    }

    if (editProfileSaveBtn) {
        editProfileSaveBtn.addEventListener('click', function() {
            var formData = new FormData(editProfileForm);
            var payload = {};
            for (var pair of formData.entries()) {
                payload[pair[0]] = pair[1];
            }

            editProfileSaveBtn.disabled = true;
            editProfileSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

            putJson('/api/teachers/profile', payload)
                .then(function(response) {
                    alert('Hồ sơ đã được cập nhật thành công!');
                    editProfileModal.style.display = 'none';
                    editProfileForm.reset();
                    // Reload page to show updated data
                    window.location.reload();
                })
                .catch(function(err) {
                    alert('Lỗi: ' + err.message);
                })
                .finally(function() {
                    editProfileSaveBtn.disabled = false;
                    editProfileSaveBtn.innerHTML = '<i class="fas fa-save"></i> Lưu thay đổi';
                });
        });
    }

    // Close modal when clicking outside
    if (editProfileModal) {
        editProfileModal.addEventListener('click', function(e) {
            if (e.target === editProfileModal) {
                editProfileModal.style.display = 'none';
                editProfileForm.reset();
            }
        });
    }

    window.toggleSubmenu = toggleSubmenu;
})();
