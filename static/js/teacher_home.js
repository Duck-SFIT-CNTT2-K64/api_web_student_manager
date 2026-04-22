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
        scoreTypes: [],
        selectedClassId: null,
        classStudents: [],
        examEditingId: null,
        examPdfFiles: [],
        performanceChart: null,
    };

    var endpoints = {
        stats: "/api/teachers/stats/" + userId,
        classes: "/api/teachers/classes/" + userId,
        schedule: "/api/teachers/schedule/" + userId,
        classStudents: "/api/teachers/class-students/",
        saveScore: "/api/teachers/save-score",
        scoreTypes: "/api/teachers/score-types",
        scoreHistory: "/api/teachers/score-history/",
        exams: "/api/exams",
        examsByUser: "/api/exams/user/" + userId,
    };

    var weekdayMap = {
        "Monday": "Day Hai",
        "Tuesday": "Day Ba",
        "Wednesday": "Day Tư",
        "Thursday": "Day Năm",
        "Friday": "Day Sáu",
        "Saturday": "Day Bảy",
        "Sunday": "Chủ Nhật",
        "Day 2": "Day Hai",
        "Day 3": "Day Ba",
        "Day 4": "Day Tư",
        "Day 5": "Day Năm",
        "Day 6": "Day Sáu",
        "Day 7": "Day Bảy",
        "Chủ nhật": "Chủ Nhật"
    };

    // Map tiếng Anh sang tiếng Việt cho calendar
    var weekdayToVietnamese = {
        "Monday": "Day 2",
        "Tuesday": "Day 3",
        "Wednesday": "Day 4",
        "Thursday": "Day 5",
        "Friday": "Day 6",
        "Saturday": "Day 7",
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
            if (status) status.textContent = "No file uploaded.";
            return;
        }

        list.innerHTML = state.examPdfFiles.map(function (url, idx) {
            var fileName = decodeURIComponent(String(url).split("/").pop() || ("file_" + (idx + 1) + ".pdf"));
            return '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--page-bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;">'
                + '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" style="color:#1d4ed8;font-size:0.88rem;"><i class="fas fa-file-pdf" style="color:#dc2626;"></i> ' + escapeHtml(fileName) + '</a>'
                + '<button type="button" class="btn-ghost exam-pdf-remove" data-index="' + idx + '" title="Delete file" style="color:#ef4444;"><i class="fas fa-trash"></i></button>'
                + '</div>';
        }).join("");
        if (status) status.textContent = "Uploaded " + state.examPdfFiles.length + " file PDF.";
    }

    async function uploadExamPdfFile(file) {
        if (!file) return;
        if (!String(file.name || "").toLowerCase().endsWith(".pdf")) {
            alert("Only PDF files are supported.");
            return;
        }

        var status = document.getElementById("examPdfUploadStatus");
        if (status) status.textContent = "Uploading PDF...";

        var formData = new FormData();
        formData.append("file", file);
        try {
            var res = await postFormData("/api/exams/upload-pdf", formData);
            if (res.url) {
                state.examPdfFiles.push(res.url);
                renderExamPdfList();
            } else if (status) {
                status.textContent = "Upload returned no URL.";
            }
        } catch (err) {
            if (status) status.textContent = "Failed to upload file.";
            alert("Upload PDF error: " + err.message);
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
                + "<td style=\"display:flex;gap:8px;flex-wrap:wrap;\">"
                + "<button class=\"btn\" style=\"background:#dbeafe;color:#1d4ed8;padding:6px 15px;font-size:0.85rem;border-radius:8px;border:none;cursor:pointer;font-weight:600;\" type=\"button\" data-open-class-detail=\"" + classId + "\"><i class=\"fas fa-eye\"></i> View Details</button>"
                + "</td>"
                + "</tr>";
        }).join("") || '<tr><td colspan="5" class="empty">No assigned classes yet.</td></tr>';
    }

    function renderClassSelect() {
        var baseOption = '<option value="">Select class...</option>';

        // Cập nhật bộ lọc Semester và Subject nếu chưa có
        updateFilters();

        var filters = {
            entry: {
                semester: document.getElementById('scoreEntrySemesterFilter')?.value || "",
                subject: document.getElementById('scoreEntrySubjectFilter')?.value || ""
            },
            view: {
                semester: document.getElementById('scoreViewSemesterFilter')?.value || "",
                subject: document.getElementById('scoreViewSubjectFilter')?.value || ""
            }
        };

        function getFilteredOptions(type) {
            return (state.classes || [])
                .filter(function (c) {
                    var matchSem = !filters[type].semester || c.Semester === filters[type].semester;
                    var matchSub = !filters[type].subject || c.CourseName === filters[type].subject;
                    return matchSem && matchSub;
                })
                .map(function (item) {
                    return '<option value="' + item.ClassId + '">' + escapeHtml(item.ClassCode + " - " + item.ClassName) + ' (' + Number(item.StudentCount || 0) + ' SV)</option>';
                }).join("");
        }

        var entryOptions = getFilteredOptions('entry');
        var viewOptions = getFilteredOptions('view');
        var allOptions = (state.classes || []).map(function (item) {
            return '<option value="' + item.ClassId + '">' + escapeHtml(item.ClassCode + " - " + item.ClassName) + ' (' + Number(item.StudentCount || 0) + ' SV)</option>';
        }).join("");

        var selects = [
            { id: 'teacherClassSelect', def: '<option value="">Select class to enter scores...</option>', opt: entryOptions },
            { id: 'classListSelect', def: baseOption, opt: allOptions },
            { id: 'examClassSelect', def: baseOption, opt: allOptions },
            { id: 'attendanceClassSelect', def: baseOption, opt: allOptions },
            { id: 'scoreViewClassSelect', def: '<option value="">Select class to view scores...</option>', opt: viewOptions },
        ];

        selects.forEach(function (s) {
            var el = document.getElementById(s.id);
            if (el) {
                var currentVal = el.value;
                el.innerHTML = s.def + s.opt;
                if (currentVal && el.querySelector('option[value="' + currentVal + '"]')) {
                    el.value = currentVal;
                }
            }
        });

        var notifSelect = document.getElementById('notificationTargetSelect');
        if (notifSelect) {
            notifSelect.innerHTML = '<option value="all">All students</option>' + allOptions;
        }

        var teacherSelect = document.getElementById("teacherClassSelect");
        if (teacherSelect && state.selectedClassId) {
            teacherSelect.value = String(state.selectedClassId);
        }
    }

    function updateFilters() {
        var semesters = [...new Set((state.classes || []).map(c => c.Semester).filter(Boolean))].sort();
        var subjects = [...new Set((state.classes || []).map(c => c.CourseName).filter(Boolean))].sort();

        function populate(id, items, label) {
            var el = document.getElementById(id);
            if (!el) return;
            var current = el.value;
            el.innerHTML = '<option value="">' + label + '</option>' +
                items.map(it => '<option value="' + escapeHtml(it) + '">' + escapeHtml(it) + '</option>').join("");
            if (current && items.includes(current)) el.value = current;
        }

        populate('scoreEntrySemesterFilter', semesters, 'All học kỳ');
        populate('scoreEntrySubjectFilter', subjects, 'All môn học');
        populate('scoreViewSemesterFilter', semesters, 'All');
        populate('scoreViewSubjectFilter', subjects, 'All');
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

        var days = ["Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
        var dayLabels = {
            "Day 2": "Day Hai",
            "Day 3": "Day Ba",
            "Day 4": "Day Tư",
            "Day 5": "Day Năm",
            "Day 6": "Day Sáu",
            "Day 7": "Day Bảy"
        };

        var map = {};
        days.forEach(function (d) { map[d] = []; });

        (state.schedule || []).forEach(function (item) {
            // Chuyển đổi weekday từ tiếng Anh sang tiếng Việt
            var weekdayVi = weekdayToVietnamese[item.Weekday] || item.Weekday;
            if (!map[weekdayVi]) return;
            var start = item.StartTime ? item.StartTime.slice(0, 5) : "--";
            var end = item.EndTime ? item.EndTime.slice(0, 5) : "--";
            map[weekdayVi].push(
                "<div class='calendar-item'>"
                + "<strong>" + escapeHtml(item.ClassCode || "") + "</strong><br>"
                + start + " – " + end + "<br>"
                + "<small>" + escapeHtml(item.RoomName || "") + "</small><br>"
                + "<div class='calendar-item-actions'>"
                + "<button class='btn-cal' data-cal-detail='" + Number(item.ClassId) + "'"
                + " data-cal-weekday='" + escapeHtml(weekdayVi) + "'>"
                + "<i class='fas fa-eye'></i> View chi tiết"
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
        var thead = document.getElementById("scoreStudentTableHeader");
        if (!tbody || !thead) return;

        var saveAllBtn = document.getElementById("saveAllScoresBtn");
        var downloadBtn = document.getElementById("downloadTemplateBtn");
        var importLabel = document.getElementById("importExcelLabel");

        // Render header
        thead.innerHTML = '<tr>'
            + '<th>Student ID</th>'
            + '<th>Full Name</th>'
            + (state.scoreTypes || []).map(t => '<th style="text-align:center;">' + escapeHtml(t.ScoreTypeName) + '</th>').join("")
            + '</tr>';

        if (!state.classStudents || !state.classStudents.length) {
            tbody.innerHTML = '<tr><td colspan="' + (2 + (state.scoreTypes || []).length) + '" class="empty">No students in class.</td></tr>';
            if (saveAllBtn) saveAllBtn.style.display = "none";
            if (downloadBtn) downloadBtn.style.display = "none";
            if (importLabel) importLabel.style.display = "none";
            return;
        }

        tbody.innerHTML = state.classStudents.map(function (item) {
            var scoreCells = (state.scoreTypes || []).map(function (t) {
                // item.Scores is a list of {ScoreTypeId, ScoreValue}
                var scoreObj = (item.Scores || []).find(s => s.ScoreTypeId === t.ScoreTypeId);
                var val = scoreObj ? scoreObj.ScoreValue : "";
                return '<td><input type="number" min="0" max="10" step="0.1" data-score-type="' + t.ScoreTypeId + '" value="' + val + '"></td>';
            }).join("");

            return "<tr data-enrollment-id=\"" + Number(item.EnrollmentId) + "\">"
                + "<td><strong>" + escapeHtml(item.StudentCode) + "</strong></td>"
                + "<td>" + escapeHtml(item.FullName) + "</td>"
                + scoreCells
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
                    alert("No students in class!");
                    return;
                }

                // Title theo mẫu: Teacher: [Tên], Class: [Tên]
                var data = [
                    ["Teacher:", teacherName],
                    ["Class:", className],
                    [] // Hàng trống
                ];

                // Header cột theo mẫu ảnh Excel
                data.push(["Date of Birth", "Gender", "Phone", "Email", "Địa chỉ", "", "Attendance", "Midterm", "Final", "Điểm TB"]);

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
                    exportBtn.innerHTML = "<i class='fas fa-file-excel'></i> Export Excel";
                }
            });
    }

    async function loadDashboardData() {
        try {
            var results = await Promise.all([
                getJson(endpoints.stats),
                getJson(endpoints.classes),
                getJson(endpoints.schedule),
                getJson(endpoints.scoreTypes),
            ]);

            console.log("API OK:", results);

            state.stats = results[0] || {};
            state.classes = results[1] || [];
            state.schedule = results[2] || [];
            state.scoreTypes = results[3] || [];

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
        var head = document.getElementById('scoreViewTableHeader');
        var summary = document.getElementById('scoreViewSummary');
        var exportBtn = document.getElementById('exportScoreBtn');

        if (!classId) {
            if (body) body.innerHTML = '<tr><td colspan="7" class="empty">Chọn một lớp để hiển thị bảng điểm.</td></tr>';
            if (summary) summary.style.display = 'none';
            return;
        }

        // Render header
        if (head) {
            head.innerHTML = '<tr>'
                + '<th style="cursor:pointer;" data-sort="StudentCode">Student ID <i class="fas fa-sort"></i></th>'
                + '<th style="cursor:pointer;" data-sort="FullName">Full Name <i class="fas fa-sort"></i></th>'
                + (state.scoreTypes || []).map(t => '<th style="text-align:center;">' + escapeHtml(t.ScoreTypeName) + '</th>').join("")
                + '<th style="text-align:center;cursor:pointer;" data-sort="AvgScore">Avg <i class="fas fa-sort"></i></th>'
                + '<th style="text-align:center;">Result</th>'
                + '</tr>';
        }

        if (body) body.innerHTML = '<tr><td colspan="' + (4 + (state.scoreTypes || []).length) + '" class="empty">Loading...</td></tr>';
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

        var colCount = 4 + (state.scoreTypes || []).length;

        if (!students.length) {
            body.innerHTML = '<tr><td colspan="' + colCount + '" class="empty">No students in class.</td></tr>';
            if (summary) summary.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'none';
            return;
        }

        var totalPass = 0, totalFail = 0;
        body.innerHTML = students.map(function (sv) {
            var dtb = null;
            var sum = 0, count = 0;

            var scoreCells = (state.scoreTypes || []).map(function (t) {
                var scoreObj = (sv.Scores || []).find(s => s.ScoreTypeId === t.ScoreTypeId);
                var val = scoreObj ? scoreObj.ScoreValue : null;

                if (val !== null) {
                    sum += val;
                    count++;
                }

                var display = val !== null ? val : '--';
                return '<td style="text-align:center;cursor:pointer;text-decoration:underline dotted;color:var(--text-secondary);" '
                    + 'title="Click để xem lịch sử" class="score-audit-trigger" '
                    + 'data-enrollment-id="' + sv.EnrollmentId + '" '
                    + 'data-score-type-id="' + t.ScoreTypeId + '" '
                    + 'data-student-name="' + escapeHtml(sv.FullName) + '" '
                    + 'data-type-name="' + escapeHtml(t.ScoreTypeName) + '">'
                    + display + '</td>';
            }).join("");

            if (count > 0) {
                dtb = Math.round((sum / count) * 10) / 10;
            }

            var passed = dtb != null && dtb >= 5.0;
            if (dtb != null) { passed ? totalPass++ : totalFail++; }
            var resultBadge = dtb == null
                ? '<span class="badge">Chưa có điểm</span>'
                : (passed ? '<span class="badge good">Pass</span>' : '<span class="badge bad">Fail</span>');

            return '<tr>'
                + '<td><strong>' + escapeHtml(sv.StudentCode) + '</strong></td>'
                + '<td>' + escapeHtml(sv.FullName) + '</td>'
                + scoreCells
                + '<td style="text-align:center;"><strong style="color:' + (dtb == null ? '#94a3b8' : (dtb >= 8 ? '#16a34a' : (dtb >= 5 ? '#d97706' : '#ef4444'))) + '">' + (dtb != null ? dtb : '--') + '</strong></td>'
                + '<td style="text-align:center;">' + resultBadge + '</td>'
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
                tbody.innerHTML = '<tr><td colspan="6" class="empty">No data.</td></tr>';
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

    async function showClassDetailModal(classId, weekdayVi) {
        var classInfo = (state.classes || []).find(function (c) {
            return Number(c.ClassId) === classId;
        });

        var schedInfo = null;
        if (weekdayVi) {
            var weekdayEn = null;
            for (var key in weekdayToVietnamese) {
                if (weekdayToVietnamese[key] === weekdayVi) {
                    weekdayEn = key;
                    break;
                }
            }
            schedInfo = (state.schedule || []).find(function (s) {
                return Number(s.ClassId) === classId && (s.Weekday === weekdayVi || s.Weekday === weekdayEn);
            });
        } else {
            // Lấy lịch đầu tiên tìm thấy cho lớp này
            schedInfo = (state.schedule || []).find(function (s) {
                return Number(s.ClassId) === classId;
            });
        }

        // Set tiêu đề & lịch
        var modalTitle = document.getElementById("classDetailModalTitle");
        var timeText = document.getElementById("classDetailTimeText");

        if (modalTitle) modalTitle.textContent = classInfo
            ? (classInfo.ClassCode + " - " + classInfo.ClassName)
            : "Chi tiết lớp";

        if (timeText) {
            if (schedInfo) {
                timeText.textContent = (weekdayMap[schedInfo.Weekday] || schedInfo.Weekday)
                    + " · " + (schedInfo.StartTime || "").slice(0, 5)
                    + " – " + (schedInfo.EndTime || "").slice(0, 5)
                    + " · " + (schedInfo.RoomName || "");
            } else {
                timeText.textContent = "Chưa có lịch dạy cụ thể.";
            }
        }

        // Load danh sách sinh viên
        var tbody = document.getElementById("classDetailTableBody");
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        getJson(endpoints.classStudents + classId)
            .then(function (students) {
                if (!tbody) return;
                tbody.innerHTML = (students || []).map(function (sv, idx) {
                    return "<tr>"
                        + "<td style='text-align:center; color:var(--text-secondary);'>" + (idx + 1) + "</td>"
                        + "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>"
                        + "<td>" + escapeHtml(sv.FullName) + "</td>"
                        + "<td style='text-align:center;'>" + escapeHtml(sv.DateOfBirth || "—") + "</td>"
                        + "<td style='text-align:center;'>" + escapeHtml(sv.Gender || "—") + "</td>"
                        + "</tr>";
                }).join("") || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-secondary);">Lớp chưa có sinh viên.</td></tr>';
            })
            .catch(function () {
                if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:32px;">Lỗi tải dữ liệu.</td></tr>';
            });

        // Gán hành động cho các nút trong modal
        var modal = document.getElementById("classDetailModal");
        var btnScore = document.getElementById("classDetailGoScore");
        var btnAttend = document.getElementById("classDetailGoAttend");
        var btnExams = document.getElementById("classDetailGoExams");

        if (btnScore) {
            btnScore.onclick = function () {
                modal.style.display = "none";
                var sel = document.getElementById("teacherClassSelect");
                if (sel) sel.value = String(classId);
                window.location.hash = "#score-entry";
                loadClassStudents(classId).catch(function (err) {
                    setMessage(err.message, "error");
                });
            };
        }

        if (btnAttend) {
            btnAttend.onclick = function () {
                modal.style.display = "none";
                var sel = document.getElementById("attendanceClassSelect");
                if (sel) sel.value = String(classId);
                var dateInput = document.getElementById("attendanceDateInput");
                if (dateInput) {
                    dateInput.value = weekdayVi ? getLastOccurrence(weekdayVi) : new Date().toISOString().slice(0, 10);
                }
                window.location.hash = "#attendance";
                var searchBtn = document.getElementById("attendanceSearchBtn");
                if (searchBtn) searchBtn.click();
            };
        }

        if (btnExams) {
            btnExams.onclick = function () {
                modal.style.display = "none";
                var sel = document.getElementById("examClassSelect");
                if (sel) sel.value = String(classId);
                window.location.hash = "#exams";
            };
        }

        if (modal) modal.style.display = "flex";
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
            "Day 2": 1, "Day 3": 2, "Day 4": 3,
            "Day 5": 4, "Day 6": 5, "Day 7": 6, "Chủ nhật": 0
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

        var header = ["Student ID", "Full Name"];
        (state.scoreTypes || []).forEach(t => header.push(t.ScoreTypeName));
        var data = [header];

        rows.forEach(function (row) {
            var cells = row.querySelectorAll("td");
            var inputs = row.querySelectorAll("input[data-score-type]");
            var rowData = [
                cells[0] ? cells[0].textContent.trim() : "",
                cells[1] ? cells[1].textContent.trim() : ""
            ];
            (state.scoreTypes || []).forEach((t, idx) => {
                rowData.push(inputs[idx] && inputs[idx].value !== "" ? Number(inputs[idx].value) : "");
            });
            data.push(rowData);
        });

        var ws = XLSX.utils.aoa_to_sheet(data);
        var cols = [{ wch: 12 }, { wch: 30 }];
        (state.scoreTypes || []).forEach(() => cols.push({ wch: 12 }));
        ws["!cols"] = cols;

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Enter Grades");
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

                var header = rows[0].map(function (h) {
                    return String(h).trim().toLowerCase();
                });

                var colMaSV = header.findIndex(function (h) { return h.includes("mã sv") || h.includes("ma sv") || h === "mã sv"; });
                if (colMaSV < 0) colMaSV = 0;

                var scoreTypeCols = (state.scoreTypes || []).map(function (t) {
                    return {
                        id: t.ScoreTypeId,
                        name: t.ScoreTypeName,
                        col: header.findIndex(h => h === t.ScoreTypeName.toLowerCase() || h.includes(t.ScoreTypeName.toLowerCase()))
                    };
                });

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
                    scoreTypeCols.forEach(function (st) {
                        if (st.col >= 0 && row[st.col] !== "" && row[st.col] !== null && row[st.col] !== undefined) {
                            var val = Number(row[st.col]);
                            if (isNaN(val) || val < 0 || val > 10) {
                                errors.push("Dòng " + (idx + 2) + " [" + st.name + "]: '" + row[st.col] + "' không hợp lệ.");
                            }
                        }
                    });
                });

                if (errors.length) {
                    setMessage(errors.join(" | "), "error");
                    return;
                }

                var trMap = {};
                document.querySelectorAll("#scoreStudentTableBody tr[data-enrollment-id]").forEach(function (tr) {
                    var maSV = tr.querySelector("td:first-child") ? tr.querySelector("td:first-child").textContent.trim() : "";
                    if (maSV) trMap[maSV] = tr;
                });

                var filled = 0, skipped = 0;
                dataRows.forEach(function (row) {
                    var maSV = String(row[colMaSV] || "").trim();
                    var tr = trMap[maSV];
                    if (!tr) { skipped++; return; }

                    scoreTypeCols.forEach(function (st) {
                        if (st.col >= 0) {
                            var val = row[st.col];
                            if (val !== "" && val !== null && val !== undefined) {
                                var input = tr.querySelector('input[data-score-type="' + st.id + '"]');
                                if (input) input.value = Number(val);
                            }
                        }
                    });
                    filled++;
                });

                var msg = "Đã import điểm cho " + filled + " sinh viên.";
                if (skipped > 0) msg += " (" + skipped + " mã SV không khớp, bỏ qua.)";
                msg += " Nhấn 'Save all grades' để lưu vào hệ thống.";
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
                    setMessage("Please select a class first.", "error");
                    return;
                }
                loadClassStudents(classId).catch(function (error) {
                    setMessage(error.message, "error");
                });
            });
        }

        // Download template
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

        // Export Excel
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

                body.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';

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
            // 1. Mở chi tiết lớp
            var detailBtn = event.target.closest("[data-open-class-detail]");
            if (detailBtn) {
                var classId = Number(detailBtn.getAttribute("data-open-class-detail"));
                showClassDetailModal(classId);
                return;
            }

            // 1.1 Mở form nhập điểm từ bảng lớp học (Legacy - fallback if needed)
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

            // 2. View chi tiết trong lịch
            var calDetailBtn = event.target.closest("[data-cal-detail]");
            if (calDetailBtn) {
                var classId = Number(calDetailBtn.getAttribute("data-cal-detail"));
                var weekdayVi = calDetailBtn.getAttribute("data-cal-weekday");
                showClassDetailModal(classId, weekdayVi);
                return;
            }

            // Sửa thông báo
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
                        targetSelect.dispatchEvent(new Event('change')); // Trigger student list loading
                        targetSelect.disabled = true;
                    }

                    var sendBtn = document.getElementById('notificationSendBtn');
                    var cancelBtn = document.getElementById('notificationCancelBtn');
                    if (sendBtn) {
                        sendBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật';
                        sendBtn.classList.remove('btn-primary');
                        sendBtn.style.background = '#f59e0b';
                        sendBtn.style.color = '#fff';
                    }
                    if (cancelBtn) {
                        cancelBtn.style.display = 'inline-flex';
                        cancelBtn.onclick = function () {
                            form.removeAttribute('data-edit-id');
                            form.reset();
                            if (targetSelect) {
                                targetSelect.disabled = false;
                                targetSelect.value = 'all';
                                targetSelect.dispatchEvent(new Event('change'));
                            }
                            if (sendBtn) {
                                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Notification';
                                sendBtn.classList.add('btn-primary');
                                sendBtn.style.background = '';
                            }
                            cancelBtn.style.display = 'none';
                        };
                    }

                    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            var btnDelNotif = event.target.closest('.btn-del-notif');
            if (btnDelNotif) {
                event.stopPropagation();
                if (confirm('Bạn có chắc chắn muốn xóa thông báo này? Dữ liệu recipients cũng sẽ bị xóa.')) {
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

            // Delete sinh viên khỏi lớp
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

            // Delete bài kiểm tra
            var btnViewSubmissions = event.target.closest('.btn-view-submissions');
            if (btnViewSubmissions) {
                event.stopPropagation();
                var examId = btnViewSubmissions.getAttribute('data-id');
                var examTitle = btnViewSubmissions.getAttribute('data-title') || '';
                var modal = document.getElementById('examSubmissionsModal');
                var titleNode = document.getElementById('examSubmissionsTitle');
                var body = document.getElementById('examSubmissionsBody');
                if (titleNode) titleNode.textContent = 'Bài nộp - ' + examTitle;
                if (body) body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-secondary);">Loading...</td></tr>';
                if (modal) modal.style.display = 'flex';

                getJson('/api/exams/' + examId + '/submissions')
                    .then(function (items) {
                        if (!body) return;
                        if (!items || !items.length) {
                            body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-secondary);">Chưa có bài nộp.</td></tr>';
                            return;
                        }
                        body.innerHTML = items.map(function (s) {
                            var submittedAt = s.SubmittedAt ? new Date(s.SubmittedAt).toLocaleString('vi-VN') : '-';
                            var fileLink = s.FileUrl
                                ? '<a href="' + escapeHtml(s.FileUrl) + '" target="_blank" rel="noopener">Mở tệp</a>'
                                : '<span style="color:var(--text-secondary);">-</span>';
                            return '<tr>'
                                + '<td><strong>' + escapeHtml(s.StudentCode || '') + '</strong></td>'
                                + '<td>' + escapeHtml(s.FullName || '') + '</td>'
                                + '<td>' + submittedAt + '</td>'
                                + '<td>' + fileLink + '</td>'
                                + '<td><input type="number" min="0" max="10" step="0.1" value="' + (s.Grade != null ? Number(s.Grade) : '') + '" data-sub-grade="' + s.SubmissionId + '" style="width:80px;"></td>'
                                + '<td><input type="text" value="' + escapeHtml(s.Note || '') + '" data-sub-note="' + s.SubmissionId + '" placeholder="Enter feedback..."></td>'
                                + '<td><select data-sub-status="' + s.SubmissionId + '">'
                                + '<option value="Pending"' + (s.Status === 'Pending' ? ' selected' : '') + '>Pending</option>'
                                + '<option value="Submitted"' + (s.Status === 'Submitted' ? ' selected' : '') + '>Submitted</option>'
                                + '<option value="Graded"' + (s.Status === 'Graded' ? ' selected' : '') + '>Graded</option>'
                                + '</select></td>'
                                + '<td><button class="btn btn-primary btn-save-submission-grade" data-exam-id="' + examId + '" data-sub-id="' + s.SubmissionId + '" style="padding:6px 10px;">Save</button></td>'
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
                putJson('/api/exams/' + examIdToggle + '/status', { Status: nextStatus })
                    .then(function () { loadExams(); })
                    .catch(function (err) { alert('Lỗi: ' + err.message); });
                return;
            }

            var btnDelExam = event.target.closest('.btn-del-exam');
            if (btnDelExam) {
                event.stopPropagation();
                if (confirm('Are you sure you want to delete this exam?')) {
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

            // 5. Mở lịch sử điểm
            var auditBtn = event.target.closest('.score-audit-trigger');
            if (auditBtn) {
                var enrollmentId = auditBtn.dataset.enrollmentId;
                var scoreTypeId = auditBtn.dataset.scoreTypeId;
                var studentName = auditBtn.dataset.studentName;
                var typeName = auditBtn.dataset.typeName;

                var modal = document.getElementById('scoreHistoryModal');
                var subtitle = document.getElementById('scoreHistorySubtitle');
                var body = document.getElementById('scoreHistoryTableBody');

                if (subtitle) subtitle.textContent = studentName + " - " + typeName;
                if (body) body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
                if (modal) modal.style.display = 'flex';

                getJson(endpoints.scoreHistory + enrollmentId + "/" + scoreTypeId)
                    .then(function (logs) {
                        if (!body) return;
                        if (!logs || !logs.length) {
                            body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-secondary);">No change history.</td></tr>';
                            return;
                        }
                        body.innerHTML = logs.map(function (log) {
                            var date = new Date(log.ChangedAt).toLocaleString('vi-VN');
                            return '<tr>'
                                + '<td>' + date + '</td>'
                                + '<td>' + (log.OldValue !== null ? log.OldValue : '--') + '</td>'
                                + '<td><strong>' + (log.NewValue !== null ? log.NewValue : '--') + '</strong></td>'
                                + '<td>' + escapeHtml(log.ChangedByUsername || "Hệ thống") + '</td>'
                                + '</tr>';
                        }).join('');
                    })
                    .catch(function (err) {
                        if (body) body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#ef4444;">Lỗi: ' + escapeHtml(err.message) + '</td></tr>';
                    });
                return;
            }

            // 6. Export PDF báo cáo lớp
            var pdfBtn = event.target.closest('.btn-export-pdf');
            if (pdfBtn) {
                var classId = Number(pdfBtn.dataset.classId);
                exportClassReportPDF(classId);
                return;
            }

            // 4. Đóng các modal khi click nền
            if (event.target.id === 'classDetailModal' || event.target.id === 'notifModal' || event.target.id === 'examSubmissionsModal' || event.target.id === 'scoreHistoryModal') {
                event.target.style.display = 'none';
            }
        });

        // Nút đóng modal chi tiết lớp
        var classDetailModal = document.getElementById("classDetailModal");
        var classDetailClose = document.getElementById("classDetailModalClose");
        if (classDetailClose) {
            classDetailClose.addEventListener("click", function () {
                classDetailModal.style.display = "none";
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
        var scoreHistoryModal = document.getElementById("scoreHistoryModal");
        var scoreHistoryClose = document.getElementById("scoreHistoryModalClose");
        if (scoreHistoryClose && scoreHistoryModal) {
            scoreHistoryClose.addEventListener("click", function () {
                scoreHistoryModal.style.display = "none";
            });
        }

        // Bộ lọc động
        ['scoreEntrySemesterFilter', 'scoreEntrySubjectFilter', 'scoreViewSemesterFilter', 'scoreViewSubjectFilter'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', renderClassSelect);
        });

        // Save all grades
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
                    setMessage("Scores must be between 0 and 10.", "error");
                    return;
                }
                if (!tasks.length) {
                    setMessage("No grades have been entered yet.", "error");
                    return;
                }

                saveAllBtn.disabled = true;
                saveAllBtn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Loading...";
                setMessage("", "");

                Promise.all(tasks)
                    .then(function () {
                        setMessage("All grades have been saved successfully!", "success");
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
                        saveAllBtn.innerHTML = "<i class='fas fa-save'></i> Save all grades";
                    });
            });
        }

        // View List sinh viên lớp
        var classListBtn = document.getElementById("classListBtn");
        if (classListBtn) {
            classListBtn.addEventListener("click", function () {
                var val = document.getElementById("classListSelect").value;
                var body = document.getElementById("classListTableBody");
                if (!val) {
                    alert("Please select a class first.");
                    return;
                }

                body.innerHTML = '<tr><td colspan="7" class="empty">Loading...</td></tr>';
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

        // Thêm/Delete sinh viên nhanh (Full Form)
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

                if (!payload.StudentCode) { alert("Please enter a student ID!"); return; }
                if (!payload.FullName) { alert("Vui lòng nhập họ tên sinh viên!"); return; }

                quickAddBtn.disabled = true;
                postJson("/api/teachers/student/save", payload)
                    .then(function (res) {
                        alert(res.message || "Save thành công!");
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
                if (!studentCode) { alert("Please enter a student ID!"); return; }

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

        // Save điểm danh
        var attSaveBtn = document.getElementById("attendanceSaveBtn");
        if (attSaveBtn) {
            attSaveBtn.addEventListener('click', function () {
                var date = document.querySelector('#attendanceForm input[type="date"]').value;
                var rows = document.querySelectorAll('#attendanceTableBody tr[data-enrollment-id]');

                if (!rows.length || !date) {
                    alert('No data điểm danh!');
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
                        alert('Attendance saved successfully!');
                    })
                    .catch(function (err) {
                        alert('Lỗi: ' + err.message);
                    });
            });
        }

        // Send Notification
        var notifSendBtn = document.getElementById('notificationSendBtn');
        if (notifSendBtn) {
            notifSendBtn.addEventListener('click', function () {
                var form = document.getElementById('notificationForm');
                var target = document.getElementById('notificationTargetSelect').value;
                var title = document.getElementById('notifTitleInput').value.trim();
                var content = document.getElementById('notifContentInput').value.trim();
                var fileInput = document.getElementById('notifAttachmentInput');

                if (!title || !content) {
                    alert('Vui lòng nhập tiêu đề và nội dung!');
                    return;
                }

                var classId = (target === 'all' || !Number(target)) ? null : Number(target);
                var editId = form.dataset.editId;

                notifSendBtn.disabled = true;
                notifSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

                // 1. Upload file nếu có
                var uploadPromise = Promise.resolve(null);
                if (fileInput && fileInput.files.length > 0) {
                    var formData = new FormData();
                    formData.append('file', fileInput.files[0]);
                    uploadPromise = fetch('/api/notifications/upload', {
                        method: 'POST',
                        body: formData
                    }).then(r => r.json()).then(res => {
                        if (!res.success) throw new Error(res.error || 'Lỗi tải file');
                        return res.data.url;
                    });
                }

                uploadPromise.then(function (attachmentUrl) {
                    // 2. Thu thập danh sách recipients cụ thể
                    var recipientIds = [];
                    document.querySelectorAll('input[name="notifRecipient"]:checked').forEach(function (cb) {
                        recipientIds.push(Number(cb.value));
                    });

                    var payload = {
                        Title: title,
                        Content: content,
                        ClassId: classId,
                        RecipientIds: recipientIds.length > 0 ? recipientIds : null,
                        AttachmentUrl: attachmentUrl
                    };

                    if (editId) {
                        return putJson('/api/teachers/notifications/' + editId, payload)
                            .then(function () {
                                alert('Thông báo đã được cập nhật!');
                                var cancelBtn = document.getElementById('notificationCancelBtn');
                                if (cancelBtn) cancelBtn.click();
                                loadNotifications();
                            });
                    } else {
                        return postJson('/api/teachers/notifications/send', payload)
                            .then(function () {
                                alert('Thông báo đã được gửi thành công!');
                                form.reset();
                                document.getElementById('notifStudentSelectGroup').style.display = 'none';
                                loadNotifications();
                            });
                    }
                }).catch(function (err) {
                    alert('Lỗi: ' + err.message);
                }).finally(function () {
                    notifSendBtn.disabled = false;
                    notifSendBtn.innerHTML = editId ? '<i class="fas fa-save"></i> Cập nhật' : '<i class="fas fa-paper-plane"></i> Send Notification';
                });
            });
        }

        // Thay đổi đối tượng nhận thông báo
        var notifTargetSelect = document.getElementById('notificationTargetSelect');
        if (notifTargetSelect) {
            notifTargetSelect.addEventListener('change', function () {
                var classId = this.value;
                var studentGroup = document.getElementById('notifStudentSelectGroup');
                var studentList = document.getElementById('notifStudentList');

                if (classId === 'all' || !classId) {
                    studentGroup.style.display = 'none';
                    studentList.innerHTML = '';
                    return;
                }

                studentGroup.style.display = 'block';
                studentList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:10px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Đang tải sinh viên...</div>';

                getJson(endpoints.classStudents + classId)
                    .then(function (students) {
                        if (!students || !students.length) {
                            studentList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:10px;color:var(--text-secondary);">Lớp không có sinh viên.</div>';
                            return;
                        }
                        studentList.innerHTML = students.map(function (s) {
                            return '<label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;padding:4px;border-radius:4px;transition:background 0.2s;" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'transparent\'">' +
                                '<input type="checkbox" name="notifRecipient" value="' + s.UserId + '">' +
                                '<span>' + escapeHtml(s.FullName) + ' (' + s.StudentCode + ')</span>' +
                                '</label>';
                        }).join('');
                    })
                    .catch(function (err) {
                        studentList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:10px;color:#ef4444;">Lỗi: ' + escapeHtml(err.message) + '</div>';
                    });
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
                        if (contentPreview.length > 80) contentPreview = contentPreview.substring(0, 80) + '...';

                        var attachHtml = n.AttachmentUrl
                            ? '<div style="margin-top:8px;"><a href="' + escapeHtml(n.AttachmentUrl) + '" target="_blank" style="font-size:0.8rem; color:#2563eb; background:#eff6ff; padding:4px 8px; border-radius:4px; border:1px solid #dbeafe;"><i class="fas fa-paperclip"></i> View đính kèm</a></div>'
                            : '';

                        return '<article class="notice-card" style="position:relative;transition:transform 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.05);padding:16px;border-radius:12px;background:var(--surface);margin-bottom:12px;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 8px rgba(0,0,0,0.1)\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.05)\'" data-notif=\'' + encodeURIComponent(JSON.stringify(n)) + '\'>' +
                            '<div style="position:absolute; top:12px; right:12px; display:flex; gap:6px;">' +
                            '<button type="button" class="btn-ghost btn-edit-notif" style="padding:6px 10px; color:#f59e0b; border-radius:6px; background:var(--surface)7ed; border:1px solid #ffedd5; cursor:pointer; font-size:0.75rem; font-weight:600;" title="Chỉnh sửa"><i class="fas fa-edit"></i> Sửa</button>' +
                            '<button type="button" class="btn-ghost btn-del-notif" style="padding:6px 10px; color:#ef4444; border-radius:6px; background:#fef2f2; border:1px solid #fee2e2; cursor:pointer; font-size:0.75rem; font-weight:600;" title="Delete"><i class="fas fa-trash"></i> Delete</button>' +
                            '</div>' +
                            '<div style="padding-right: 120px;"><strong>' + escapeHtml(n.Title) + '</strong>' +
                            '<small style="margin-top:4px;color:var(--text-secondary);display:block;">' + date + ' · Bạn</small></div>' +
                            '<p style="color:var(--text-secondary);margin:12px 0;line-height:1.5;font-size:0.9rem;">' + contentPreview + '</p>' +
                            attachHtml +
                            '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border:1px solid var(--border);">' +
                            '<span style="background:#f0f9ff; color:#0ea5e9; padding:4px 10px; border-radius:6px; font-weight:600; font-size:0.8rem;"><i class="fas fa-check-circle"></i> ' + read + '/' + total + ' đã đọc</span>' +
                            '<span style="color:var(--text-secondary);font-size:0.8rem;">' + percent + '%</span>' +
                            '</div>' +
                            '</article>';
                    }).join('') || '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><i class="fas fa-inbox" style="font-size:2rem;margin-bottom:10px;display:block;"></i>Bạn chưa gửi thông báo nào.</div>';
                })
                .catch(function () {
                    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">Lỗi tải dữ liệu.</div>';
                });
        }


        // View Class Grades
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
                    alert('No data để xuất!');
                    return;
                }

                // Header theo yêu cầu: Giảng viên, Lớp
                var headerRow = ['Student ID', 'Full Name'];
                (state.scoreTypes || []).forEach(t => headerRow.push(t.ScoreTypeName));
                headerRow.push('Avg', 'Result');

                var data = [
                    ["Teacher:", teacherName],
                    ["Class:", className],
                    [],
                    headerRow
                ];

                rows.forEach(function (row) {
                    var cells = row.querySelectorAll('td');
                    if (cells.length > 2) {
                        var rowData = [];
                        for (var i = 0; i < cells.length; i++) {
                            rowData.push(cells[i].textContent.trim());
                        }
                        data.push(rowData);
                    }
                });

                var ws = XLSX.utils.aoa_to_sheet(data);
                var colWidths = [{ wch: 15 }, { wch: 25 }];
                (state.scoreTypes || []).forEach(() => colWidths.push({ wch: 12 }));
                colWidths.push({ wch: 10 }, { wch: 15 });
                ws["!cols"] = colWidths;

                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Bảng điểm");
                XLSX.writeFile(wb, 'BangDiem_' + className.replace(/[^a-zA-Z0-9_]/g, "_") + '.xlsx');
            });
        }

        // Refresh báo cáo
        var reloadReportBtn = document.getElementById('reloadReportBtn');
        if (reloadReportBtn) {
            reloadReportBtn.addEventListener('click', function () {
                reloadReportBtn.disabled = true;
                reloadReportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                loadReport().finally(function () {
                    reloadReportBtn.disabled = false;
                    reloadReportBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                });
            });
        }

        // Khởi tạo thông báo
        loadNotifications();

        // Khởi tạo báo cáo và bài kiểm tra
        loadReport();
        loadExams();

        // Create Exams
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

                var btn = examForm.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = editId
                    ? '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...'
                    : '<i class="fas fa-spinner fa-spin"></i> Generating...';

                var payload = {
                    ClassId: classId,
                    Title: title,
                    ExamType: examType,
                    DueDate: dueDate,
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
                        : '<i class="fas fa-plus"></i> Create Exams';
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
                            '<td style="text-align:center;font-weight:bold;color:var(--text);">' + (c.AvgScore !== null ? Number(c.AvgScore).toFixed(2) : '--') + '</td>' +
                            '<td style="text-align:center;color:#15803d;">' + (c.PassCount || 0) + '</td>' +
                            '<td style="text-align:center;color:#9a3412;">' + (c.ExcellentCount || 0) + '</td>' +
                            '<td style="text-align:center;">' +
                            '<button class="btn btn-export-pdf" data-class-id="' + c.ClassId + '" style="padding:4px 8px; font-size:0.75rem; background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; border-radius:6px; cursor:pointer;"><i class="fas fa-file-pdf"></i> PDF</button>' +
                            '</td>' +
                            '</tr>';
                    }).join('');

                    updatePerformanceChart(res.class_stats);
                } else {
                    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-secondary);">Không có dữ liệu thống kê.</td></tr>';
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
                    var date = new Date(e.DueDate).toLocaleString('vi-VN');
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
                        : '<span style="color:var(--text-secondary);">-</span>';
                    var toggleIcon = isOpen ? 'fa-lock-open' : 'fa-lock';
                    var toggleTitle = isOpen ? 'Đang mở - bấm để đóng' : 'Đang đóng - bấm để mở';
                    return '<tr>' +
                        '<td><strong>' + escapeHtml(e.Title) + '</strong></td>' +
                        '<td>' + escapeHtml(e.ClassCode) + ' - ' + escapeHtml(e.ClassName) + '</td>' +
                        '<td><span class="badge">' + escapeHtml(e.ExamType) + '</span></td>' +
                        '<td>' + date + '</td>' +
                        '<td>' + badgeHtml + '</td>' +
                        '<td style="white-space:nowrap;">'
                        + '<button class="btn-ghost btn-view-submissions" style="color:#2563eb;" title="View bài nộp" data-id="' + e.ExamId + '" data-title="' + escapeHtml(e.Title) + '"><i class="fas fa-eye"></i></button>'
                        + '<button class="btn-ghost btn-edit-exam" style="color:#f59e0b;" title="Sửa bài kiểm tra" data-raw=\'' + encodeURIComponent(JSON.stringify(e)) + '\'><i class="fas fa-pen"></i></button>'
                        + '<button class="btn-ghost btn-toggle-exam" style="color:#059669;" title="' + toggleTitle + '" data-id="' + e.ExamId + '" data-next-status="' + (isOpen ? 'Closed' : 'Active') + '"><i class="fas ' + toggleIcon + '"></i></button>'
                        + '<span style="display:inline-block;width:24px;text-align:center;">' + pdfHtml + '</span>'
                        + '<button class="btn-ghost btn-del-exam" style="color:#ef4444;" title="Delete bài kiểm tra" data-id="' + e.ExamId + '"><i class="fas fa-trash"></i></button>'
                        + '</td>' +
                        '</tr>';
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-secondary);font-style:italic;">Bạn chưa tạo bài kiểm tra nào.</td></tr>';
            }
        }).catch(function (err) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#ef4444;">Lỗi tải danh sách: ' + escapeHtml(err.message) + '</td></tr>';
        });
    }

    function updatePerformanceChart(classStats) {
        var canvas = document.getElementById('classPerformanceChart');
        if (!canvas) return;

        var labels = classStats.map(c => c.ClassCode);
        var dataValues = classStats.map(c => c.AvgScore || 0);
        var passRates = classStats.map(c => c.TotalStudents > 0 ? (c.PassCount * 100 / c.TotalStudents).toFixed(1) : 0);

        if (state.performanceChart) {
            state.performanceChart.data.labels = labels;
            state.performanceChart.data.datasets[0].data = dataValues;
            state.performanceChart.data.datasets[1].data = passRates;
            state.performanceChart.update();
            return;
        }

        var ctx = canvas.getContext('2d');
        state.performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Avg Lớp',
                        data: dataValues,
                        backgroundColor: 'rgba(37, 99, 235, 0.7)',
                        borderColor: '#2563eb',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Tỷ lệ đạt (%)',
                        data: passRates,
                        type: 'line',
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        title: { display: true, text: 'Điểm trung bình' }
                    },
                    y1: {
                        beginAtZero: true,
                        max: 100,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Phần trăm (%)' }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
    }

    function exportClassReportPDF(classId) {
        var classInfo = state.classes.find(c => Number(c.ClassId) === classId);
        if (!classInfo) {
            alert("Class information not found!");
            return;
        }

        var teacherName = document.getElementById("profileFullName") ? document.getElementById("profileFullName").textContent.trim() : "Giảng viên";

        var originalBtnHtml = "";
        var pdfBtn = document.querySelector('.btn-export-pdf[data-class-id="' + classId + '"]');
        if (pdfBtn) {
            originalBtnHtml = pdfBtn.innerHTML;
            pdfBtn.disabled = true;
            pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        getJson(endpoints.classStudents + classId).then(students => {
            if (!students || !students.length) {
                alert("The class has no students to export report!");
                if (pdfBtn) {
                    pdfBtn.disabled = false;
                    pdfBtn.innerHTML = originalBtnHtml;
                }
                return;
            }

            var htmlContent = `
                <div id="pdf-export-container" style="padding: 40px; font-family: Arial, sans-serif; color:var(--text); background:var(--surface); width: 750px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px;">
                        <h1 style="margin: 0; color: #1d4ed8; text-transform: uppercase; font-size: 24px;">Academic Performance Report</h1>
                        <p style="margin: 10px 0; color:var(--text-secondary); font-size: 14px;">Hệ thống Quản lý Students CLASSES369</p>
                    </div>
                    
                    <table style="width: 100%; margin-bottom: 30px; background:var(--page-bg); border:1px solid var(--border); border-radius: 10px; padding: 20px; font-size: 14px; border-spacing: 0;">
                        <tr>
                            <td style="width: 50%; vertical-align: top; line-height: 2;">
                                <strong>Class:</strong> ${classInfo.ClassCode} - ${classInfo.ClassName}<br>
                                <strong>Subject:</strong> ${classInfo.CourseName}<br>
                                <strong>Semester:</strong> ${classInfo.Semester || '—'}
                            </td>
                            <td style="width: 50%; vertical-align: top; text-align: right; line-height: 2;">
                                <strong>Teacher:</strong> ${teacherName}<br>
                                <strong>Created Date:</strong> ${new Date().toLocaleDateString('vi-VN')}<br>
                                <strong>Students:</strong> ${students.length} sinh viên
                            </td>
                        </tr>
                    </table>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
                        <thead>
                            <tr style="background:var(--page-bg);">
                                <th style="border:1px solid var(--border); padding: 12px 8px; text-align: center;">No.</th>
                                <th style="border:1px solid var(--border); padding: 12px 8px; text-align: left;">Student ID</th>
                                <th style="border:1px solid var(--border); padding: 12px 8px; text-align: left;">Full Name</th>
                                ${(state.scoreTypes || []).map(t => `<th style="border:1px solid var(--border); padding: 12px 8px; text-align: center;">${t.ScoreTypeName}</th>`).join('')}
                                <th style="border:1px solid var(--border); padding: 12px 8px; text-align: center; font-weight: bold; background: #e2e8f0;">Avg</th>
                                <th style="border:1px solid var(--border); padding: 12px 8px; text-align: center; background: #e2e8f0;">Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((sv, idx) => {
                var sum = 0, count = 0;
                var scoresHtml = (state.scoreTypes || []).map(t => {
                    var s = (sv.Scores || []).find(so => so.ScoreTypeId === t.ScoreTypeId);
                    if (s && s.ScoreValue !== null) { sum += s.ScoreValue; count++; }
                    return `<td style="border:1px solid var(--border); padding: 10px 8px; text-align: center;">${s && s.ScoreValue !== null ? s.ScoreValue : '--'}</td>`;
                }).join('');
                var dtb = count > 0 ? (sum / count).toFixed(1) : '--';
                var resText = dtb !== '--' ? (dtb >= 5 ? 'Pass' : 'Fail') : '--';
                var resColor = dtb !== '--' ? (dtb >= 5 ? '#15803d' : '#be123c') : '#64748b';
                return `
                                    <tr>
                                        <td style="border:1px solid var(--border); padding: 10px 8px; text-align: center;">${idx + 1}</td>
                                        <td style="border:1px solid var(--border); padding: 10px 8px; text-align: left; font-weight: bold;">${sv.StudentCode}</td>
                                        <td style="border:1px solid var(--border); padding: 10px 8px; text-align: left;">${sv.FullName}</td>
                                        ${scoresHtml}
                                        <td style="border:1px solid var(--border); padding: 10px 8px; text-align: center; font-weight: bold; background:var(--page-bg);">${dtb}</td>
                                        <td style="border:1px solid var(--border); padding: 10px 8px; text-align: center; font-weight: bold; color: ${resColor};">${resText}</td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>

                    <table style="width: 100%; margin-top: 60px;">
                        <tr>
                            <td style="width: 60%;"></td>
                            <td style="width: 40%; text-align: center; font-size: 14px;">
                                <p style="margin: 0;">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</p>
                                <p style="margin: 5px 0 80px 0; font-weight: bold;">Teacher in charge</p>
                                <p style="margin: 0; font-weight: bold; font-size: 16px;">${teacherName}</p>
                            </td>
                        </tr>
                    </table>
                </div>
            `;

            // Tạo phần tử tạm thời trong DOM
            var tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.top = '0';
            tempDiv.style.left = '0';
            tempDiv.style.width = '100%';
            tempDiv.style.height = '100%';
            tempDiv.style.zIndex = '-9999';
            tempDiv.style.backgroundColor = '#fff';
            tempDiv.style.overflow = 'hidden';
            tempDiv.innerHTML = htmlContent;
            document.body.appendChild(tempDiv);

            var opt = {
                margin: 0.2,
                filename: `BaoCao_Lop_${classInfo.ClassCode}_${new Date().getTime()}.pdf`,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    scrollY: 0,
                    scrollX: 0
                },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            // Đợi một chút để font render (nếu có)
            setTimeout(function () {
                html2pdf().set(opt).from(tempDiv.querySelector('#pdf-export-container')).save().then(() => {
                    document.body.removeChild(tempDiv);
                    if (pdfBtn) {
                        pdfBtn.disabled = false;
                        pdfBtn.innerHTML = originalBtnHtml;
                    }
                }).catch(err => {
                    console.error("PDF Export Error:", err);
                    document.body.removeChild(tempDiv);
                    alert("Error exporting PDF: " + err.message);
                    if (pdfBtn) {
                        pdfBtn.disabled = false;
                        pdfBtn.innerHTML = originalBtnHtml;
                    }
                });
            }, 500);
        }).catch(err => {
            alert("Error loading student data: " + err.message);
            if (pdfBtn) {
                pdfBtn.disabled = false;
                pdfBtn.innerHTML = originalBtnHtml;
            }
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
