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
        days.forEach(function(d) { map[d] = []; });

        (state.schedule || []).forEach(function(item) {
            if (!map[item.Weekday]) return;
            var start = item.StartTime ? item.StartTime.slice(0, 5) : "--";
            var end   = item.EndTime   ? item.EndTime.slice(0, 5)   : "--";
            map[item.Weekday].push(
                "<div class='calendar-item'>"
                + "<strong>" + escapeHtml(item.ClassCode || "") + "</strong><br>"
                + start + " – " + end + "<br>"
                + "<small>" + escapeHtml(item.RoomName || "") + "</small><br>"
                + "<div class='calendar-item-actions'>"
                + "<button class='btn-cal' data-cal-list='" + Number(item.ClassId) + "'>"
                + "<i class='fas fa-users'></i> Danh sách"
                + "</button>"
                + "<button class='btn-cal btn-cal-score' data-cal-score='" + Number(item.ClassId) + "'>"
                + "<i class='fas fa-pen'></i> Nhập điểm"
                + "</button>"
                + "<button class='btn-cal btn-cal-attend'"
                + " data-cal-attend='" + Number(item.ClassId) + "'"
                + " data-cal-weekday='" + escapeHtml(item.Weekday) + "'>"  
                + "<i class='fas fa-clipboard-check'></i> Điểm danh"
                + "</button>"
                + "</div>"
                + "</div>"
            );
        });

        container.innerHTML = "<div class='calendar-grid'>"
            + days.map(function(day) {
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

        var saveAllBtn       = document.getElementById("saveAllScoresBtn");
        var downloadBtn      = document.getElementById("downloadTemplateBtn");
        var importLabel      = document.getElementById("importExcelLabel");

        if (!state.classStudents || !state.classStudents.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Lớp chưa có sinh viên.</td></tr>';
            if (saveAllBtn)  saveAllBtn.style.display  = "none";
            if (downloadBtn) downloadBtn.style.display = "none";
            if (importLabel) importLabel.style.display = "none";
            return;
        }

        tbody.innerHTML = state.classStudents.map(function(item) {
            return "<tr data-enrollment-id=\"" + Number(item.EnrollmentId) + "\">"
                + "<td><strong>" + escapeHtml(item.StudentCode) + "</strong></td>"
                + "<td>" + escapeHtml(item.FullName) + "</td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"1\" value=\"" + (item.ChuyenCan ?? "") + "\"></td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"2\" value=\"" + (item.GiuaKy ?? "") + "\"></td>"
                + "<td><input type=\"number\" min=\"0\" max=\"10\" step=\"0.1\" data-score-type=\"3\" value=\"" + (item.CuoiKy ?? "") + "\"></td>"
                + "</tr>";
        }).join("");

        // Hiện các nút
        if (saveAllBtn)  saveAllBtn.style.display  = "inline-flex";
        if (downloadBtn) downloadBtn.style.display = "inline-flex";
        if (importLabel) importLabel.style.display = "inline-flex";
    }

    function exportClassListToExcel() {
        var select = document.getElementById("classListSelect");
        var classId = Number(select.value);
        var className = select.options[select.selectedIndex]
            ? select.options[select.selectedIndex].text
            : "DanhSachLop";

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
            .then(function(students) {
                if (!students || !students.length) {
                    alert("Lớp chưa có sinh viên!");
                    return;
                }

                var data = [
                    ["STT", "Mã SV", "Họ tên", "Ngày sinh", "Giới tính", "Chuyên cần", "Giữa kỳ", "Cuối kỳ"]
                ];

                // Rows
                students.forEach(function(sv, idx) {
                    data.push([
                        idx + 1,
                        sv.StudentCode   || "",
                        sv.FullName      || "",
                        sv.DateOfBirth   || "",
                        sv.Gender        || "",
                        sv.ChuyenCan     !== null && sv.ChuyenCan     !== undefined ? Number(sv.ChuyenCan)  : "",
                        sv.GiuaKy        !== null && sv.GiuaKy        !== undefined ? Number(sv.GiuaKy)     : "",
                        sv.CuoiKy        !== null && sv.CuoiKy        !== undefined ? Number(sv.CuoiKy)     : "",
                    ]);
                });

                var ws = XLSX.utils.aoa_to_sheet(data);

                ws["!cols"] = [
                    { wch: 5  },  
                    { wch: 12 },  
                    { wch: 30 },  
                    { wch: 15 },  
                    { wch: 10 },  
                    { wch: 12 },  
                    { wch: 12 },  
                    { wch: 12 },  
                ];

                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Danh sách & Điểm");

                var fileName = "DanhSach_" + className.replace(/[^a-zA-Z0-9_]/g, "_") + ".xlsx";
                XLSX.writeFile(wb, fileName);
            })
            .catch(function(err) {
                alert("Lỗi xuất Excel: " + err.message);
            })
            .finally(function() {
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

        rows.forEach(function(row) {
            var cells  = row.querySelectorAll("td");
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
        reader.onload = function(e) {
            try {
                var data     = new Uint8Array(e.target.result);
                var workbook = XLSX.read(data, { type: "array" });
                var sheet    = workbook.Sheets[workbook.SheetNames[0]];
                var rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

                if (!rows || rows.length < 2) {
                    setMessage("File Excel không có dữ liệu!", "error");
                    return;
                }

                // Đọc header để tìm vị trí cột linh hoạt
                var header = rows[0].map(function(h) {
                    return String(h).trim().toLowerCase();
                });

                var colMaSV      = header.findIndex(function(h) { return h.includes("mã sv") || h.includes("ma sv") || h === "mã sv"; });
                var colChuyenCan = header.findIndex(function(h) { return h.includes("chuyên") || h.includes("chuyen"); });
                var colGiuaKy    = header.findIndex(function(h) { return h.includes("giữa") || h.includes("giua"); });
                var colCuoiKy    = header.findIndex(function(h) { return h.includes("cuối") || h.includes("cuoi"); });

                // Fallback về vị trí mặc định nếu không tìm được
                if (colMaSV      < 0) colMaSV      = 0;
                if (colChuyenCan < 0) colChuyenCan = 4;
                if (colGiuaKy    < 0) colGiuaKy    = 5;
                if (colCuoiKy    < 0) colCuoiKy    = 6;

                var dataRows = rows.slice(1).filter(function(r) {
                    return String(r[colMaSV] || "").trim() !== "";
                });

                if (!dataRows.length) {
                    setMessage("Không tìm thấy dữ liệu hợp lệ trong file!", "error");
                    return;
                }

                // Validate điểm
                var errors = [];
                dataRows.forEach(function(row, idx) {
                    [colChuyenCan, colGiuaKy, colCuoiKy].forEach(function(col) {
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
                document.querySelectorAll("#scoreStudentTableBody tr[data-enrollment-id]").forEach(function(tr) {
                    var maSV = tr.querySelector("td:first-child")
                        ? tr.querySelector("td:first-child").textContent.trim()
                        : "";
                    if (maSV) trMap[maSV] = tr;
                });

                // Điền điểm vào bảng
                var filled  = 0;
                var skipped = 0;
                dataRows.forEach(function(row) {
                    var maSV = String(row[colMaSV] || "").trim();
                    var tr   = trMap[maSV];
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

            } catch(err) {
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

            // Nhập điểm
            // Tải file mẫu
            var downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
            if (downloadTemplateBtn) {
                downloadTemplateBtn.addEventListener("click", function() {
                    downloadScoreTemplate();
                });
            }

            // Import Excel
            var importExcelInput = document.getElementById("importExcelInput");
            if (importExcelInput) {
                importExcelInput.addEventListener("change", function() {
                    var file = this.files[0];
                    if (!file) return;
                    importScoreFromExcel(file);
                });
            }

            var calListBtn = event.target.closest("[data-cal-list]");
            if (calListBtn) {
                var classId = Number(calListBtn.getAttribute("data-cal-list"));

                var classListSelect = document.getElementById("classListSelect");
                if (classListSelect) classListSelect.value = String(classId);

                window.location.hash = "#class-list";

                var classListBtn = document.getElementById("classListBtn");
                if (classListBtn) classListBtn.click();
                return;
            }

            var calScoreBtn = event.target.closest("[data-cal-score]");
            if (calScoreBtn) {
                var classId = Number(calScoreBtn.getAttribute("data-cal-score"));

                var teacherClassSelect = document.getElementById("teacherClassSelect");
                if (teacherClassSelect) teacherClassSelect.value = String(classId);

                window.location.hash = "#score-entry";

                loadClassStudents(classId).catch(function(err) {
                    setMessage(err.message, "error");
                });
                return;
            }

            var calAttendBtn = event.target.closest("[data-cal-attend]");
            if (calAttendBtn) {
                var classId  = Number(calAttendBtn.getAttribute("data-cal-attend"));
                var weekday  = calAttendBtn.getAttribute("data-cal-weekday");

                var attendanceClassSelect = document.getElementById("attendanceClassSelect");
                if (attendanceClassSelect) attendanceClassSelect.value = String(classId);

                var dateInput = document.querySelector("#attendanceForm input[type='date']");
                if (dateInput) {
                    dateInput.value = getLastOccurrence(weekday);
                }

                window.location.hash = "#attendance";

                var attendSearchBtn = document.getElementById("attendanceSearchBtn");
                if (attendSearchBtn) attendSearchBtn.click();
                return;
            }
            
            // Xuất Excel
            var exportBtn = document.getElementById("exportClassListBtn");
            if (exportBtn) {
                exportBtn.addEventListener("click", function() {
                    exportClassListToExcel();
                });
            }
            
            // Save button for scores
            var saveAllBtn = document.getElementById("saveAllScoresBtn");
            if (saveAllBtn) {
                saveAllBtn.addEventListener("click", function() {
                    var rows = document.querySelectorAll("#scoreStudentTableBody tr[data-enrollment-id]");
                    if (!rows.length) {
                        setMessage("Không có dữ liệu để lưu.", "error");
                        return;
                    }

                    var tasks = [];
                    var hasError = false;

                    rows.forEach(function(row) {
                        var enrollmentId = Number(row.dataset.enrollmentId);
                        row.querySelectorAll("input[data-score-type]").forEach(function(input) {
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
                        .then(function() {
                            setMessage("Đã lưu tất cả điểm thành công!", "success");
                            return Promise.all([
                                loadClassStudents(state.selectedClassId),
                                loadDashboardData()
                            ]);
                        })
                        .catch(function(err) {
                            setMessage(err.message, "error");
                        })
                        .finally(function() {
                            saveAllBtn.disabled = false;
                            saveAllBtn.innerHTML = "<i class='fas fa-save'></i> Lưu tất cả điểm";
                        });
                });
            }
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

                body.innerHTML = '<tr><td colspan="4" class="empty">Đang tải...</td></tr>';

                getJson(endpoints.classStudents + Number(val))
                    .then(function(students) {
                        body.innerHTML = (students || []).map(function(sv) {
                            return "<tr>"
                                + "<td><strong>" + escapeHtml(sv.StudentCode) + "</strong></td>"
                                + "<td>" + escapeHtml(sv.FullName) + "</td>"
                                + "<td>" + escapeHtml(sv.DateOfBirth || "—") + "</td>"
                                + "<td>" + escapeHtml(sv.Gender || "—") + "</td>"
                                + "</tr>";
                        }).join("") || '<tr><td colspan="4" class="empty">Lớp chưa có sinh viên.</td></tr>';

                        // Hiện nút xuất nếu có dữ liệu
                        var exportBtn = document.getElementById("exportClassListBtn");
                        if (exportBtn) {
                            exportBtn.style.display = students && students.length ? "inline-flex" : "none";
                        }
                    })
                    .catch(function(err) {
                        body.innerHTML = '<tr><td colspan="4" class="empty">Lỗi: ' + escapeHtml(err.message) + '</td></tr>';
                        var exportBtn = document.getElementById("exportClassListBtn");
                        if (exportBtn) exportBtn.style.display = "none";
                    });
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
        
        // Save attendence
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
        // 5. Notifications
        // Load danh sách thông báo đã gửi
        function loadNotifications() {
            var body = document.getElementById('notificationTableBody');
            getJson('/api/teachers/notifications/' + userId)
                .then(function(items) {
                    body.innerHTML = (items || []).map(function(n) {
                        var date = new Date(n.CreatedDate).toLocaleDateString('vi-VN');
                        return "<tr>"
                            + "<td>" 
                            +     "<a href='#' class='notif-title-link' data-notif='" 
                            +     encodeURIComponent(JSON.stringify(n)) 
                            +     "'>" + escapeHtml(n.Title) + "</a>"
                            + "</td>"
                            + "<td><span class='badge info'>" + Number(n.RecipientCount) + " SV</span></td>"
                            + "<td>" + date + "</td>"
                            + "</tr>";
                    }).join('')
                    || '<tr><td colspan="3" class="empty">Bạn chưa gửi thông báo nào.</td></tr>';
                })
                .catch(function() {
                    body.innerHTML = '<tr><td colspan="3" class="empty">Lỗi tải dữ liệu.</td></tr>';
                });
        }

        // Chức năng gửi thông báo
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

        // Mở modal thông báo
        document.addEventListener('click', function(e) {
            var link = e.target.closest('.notif-title-link');
            if (link) {
                e.preventDefault();
                var n = JSON.parse(decodeURIComponent(link.getAttribute('data-notif')));
                
                document.getElementById('notifModalTitle').textContent   = n.Title || "";
                document.getElementById('notifModalContent').textContent = n.Content || "";
                document.getElementById('notifModalCreator').textContent = "Giảng viên " + (n.CreatorName || "bạn");
                document.getElementById('notifModalTarget').textContent  = Number(n.RecipientCount) + " sinh viên";
                document.getElementById('notifModalDate').textContent    = new Date(n.CreatedDate).toLocaleString('vi-VN');

                var modal = document.getElementById('notifModal');
                modal.style.display = 'flex';
                return;
            }

            // Đóng modal khi click nền
            if (e.target.id === 'notifModal') {
                e.target.style.display = 'none';
            }
        });

        // Đóng modal bằng nút X
        var notifModalClose = document.getElementById('notifModalClose');
        if (notifModalClose) {
            notifModalClose.addEventListener('click', function() {
                document.getElementById('notifModal').style.display = 'none';
            });
        }

        // Load lần đầu khi trang khởi động
        loadNotifications();
    }

    bindNavigation();
    bindEvents();
    loadDashboardData().catch(function (error) {
        setMessage(error.message, "error");
    });
})();
