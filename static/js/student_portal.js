(function () {
    var root = document.getElementById("studentPortalRoot");
    var portalNav = document.getElementById("portalNav");

    // Active link follows current pathname (fallback in case server missed)
    if (portalNav) {
        var pathname = location.pathname.replace(/\/+$/, "");
        portalNav.querySelectorAll("a").forEach(function (link) {
            var href = (link.getAttribute("href") || "").replace(/\/+$/, "");
            if (href && href === pathname) {
                link.classList.add("is-active");
            }
        });

        var activeLink = portalNav.querySelector("a.is-active");
        if (activeLink && window.innerWidth < 860) {
            activeLink.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        }
    }

    if (!root) {
        return;
    }

    var userId = Number(root.dataset.userId || 0);
    if (!userId) {
        return;
    }

    // ───────────────────────── STATE ─────────────────────────
    var state = {
        profile: null,
        learning: { Enrollments: [], CourseContents: [] },
        registrationStatus: [],
        registrationOptions: [],
        schedule: [],
        exams: [],
        assignments: [],
        attendance: [],
        scores: [],
        finance: [],
        notifications: [],
    };

    var endpoints = {
        profile: "/api/students/profile/" + userId,
        learning: "/api/students/learning/" + userId,
        registrationStatus: "/api/students/registration/" + userId,
        registrationOptions: "/api/students/registration-options/" + userId,
        register: "/api/students/registration/" + userId,
        schedule: "/api/students/schedule/" + userId,
        exams: "/api/students/exams/" + userId,
        assignments: "/api/students/assignments/" + userId,
        submitAssignment: "/api/students/assignments/" + userId + "/submit",
        attendance: "/api/students/attendance/" + userId,
        dropEnrollment: "/api/students/enrollments/" + userId + "/drop",
        scores: "/api/students/scores/" + userId,
        finance: "/api/students/finance/" + userId,
        payment: "/api/students/finance/" + userId + "/payments",
        notificationsAll: "/api/notifications/my",
        notificationsUnread: "/api/notifications/my/unread",
    };

    var activePanelEl = document.querySelector(".portal-panel.is-active");
    var activePanel = activePanelEl ? activePanelEl.dataset.panel : "overview";

    // ───────────────────────── UTILS ─────────────────────────
    var WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    var WEEKDAY_VI = {
        Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
        Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun"
    };
    var MONTH_VI = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function esc(v) {
        return String(v == null ? "" : v)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function fmtMoney(value) {
        return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
    }

    function fmtMoneyVND(value) {
        return fmtMoney(value) + " đ";
    }

    function fmtDateISO(value) {
        if (!value) return "—";
        return String(value).slice(0, 10);
    }

    function fmtDateVi(value) {
        var iso = fmtDateISO(value);
        if (iso === "—") return iso;
        var parts = iso.split("-");
        if (parts.length === 3) {
            return parts[2] + "/" + parts[1] + "/" + parts[0];
        }
        return iso;
    }

    function toHoursFloat(t) {
        if (!t) return 0;
        var s = String(t).split(":");
        return Number(s[0] || 0) + Number(s[1] || 0) / 60 + Number(s[2] || 0) / 3600;
    }

    function hhmm(t) {
        return String(t || "").slice(0, 5);
    }

    function parseResponse(response) {
        return response.json().then(function (json) {
            if (!response.ok || json.success === false) {
                throw new Error(json.error || json.details || "Request failed.");
            }
            return json.data;
        });
    }

    function getJson(url) {
        return fetch(url, { credentials: "same-origin" }).then(parseResponse);
    }

    function putJsonSimple(url) {
        return fetch(url, { method: "PUT", credentials: "same-origin" }).then(function (response) {
            return response.json().then(function (json) {
                if (!response.ok || json.success === false) {
                    throw new Error(json.error || json.details || "Request failed.");
                }
                return json;
            });
        });
    }

    function isReadFlag(row) {
        var v = row && row.IsRead;
        if (v === true || v === 1) return true;
        if (v === false || v === 0) return false;
        return false;
    }

    function refreshNotifBadge() {
        return fetch(endpoints.notificationsUnread, { credentials: "same-origin" })
            .then(function (res) { return res.json(); })
            .then(function (json) {
                if (!json.success || !Array.isArray(json.data)) {
                    return;
                }
                var n = json.data.length;
                var badge = document.getElementById("studentNotifBellBadge");
                if (badge) {
                    if (n > 0) {
                        badge.textContent = n > 99 ? "99+" : String(n);
                        badge.hidden = false;
                    } else {
                        badge.textContent = "0";
                        badge.hidden = true;
                    }
                }
            })
            .catch(function () { /* ignore */ });
    }

    function renderNotificationInbox(items) {
        var container = document.getElementById("studentNotificationList");
        var pill = document.getElementById("studentNotifUnreadPill");
        if (!container) return;
        if (!items || !items.length) {
            container.innerHTML = "<p class=\"empty\">No notifications yet.</p>";
            if (pill) {
                pill.textContent = "0 unread";
            }
            return;
        }
        var unread = items.filter(function (r) { return !isReadFlag(r); }).length;
        if (pill) {
            pill.textContent = unread + " unread";
        }
        container.innerHTML = items
            .map(function (it) {
                var id = it.NotificationId;
                var read = isReadFlag(it);
                var title = esc(it.Title || "Notification");
                var date = esc(String(it.CreatedDate || "").slice(0, 16).replace("T", " "));
                var body = esc(it.Content || "");
                var who = esc(it.CreatorName || "Center");
                return (
                    "<article class=\"notif-inbox-item" + (read ? " is-read" : "") + "\" data-notif-id=\"" + id + "\" role=\"button\" tabindex=\"0\">" +
                    "<div class=\"notif-inbox-meta\"><span class=\"notif-inbox-who\">" + who + "</span><time>" + date + "</time></div>" +
                    "<h4 class=\"notif-inbox-title\">" + title + "</h4>" +
                    "<p class=\"notif-inbox-body\">" + body + "</p>" +
                    (read
                        ? "<span class=\"portal-chip chip-green notif-inbox-state\">Read</span>"
                        : "<span class=\"portal-chip chip-yellow notif-inbox-state\">Unread — click to mark read</span>") +
                    "</article>"
                );
            })
            .join("");

        container.querySelectorAll(".notif-inbox-item").forEach(function (el) {
            var nid = el.getAttribute("data-notif-id");
            function onActivate() {
                if (el.classList.contains("is-read") || !nid) return;
                putJsonSimple("/api/notifications/" + nid + "/read")
                    .then(function () {
                        return getJson(endpoints.notificationsAll);
                    })
                    .then(function (data) {
                        renderNotificationInbox(data || []);
                    })
                    .then(function () {
                        return refreshNotifBadge();
                    })
                    .catch(function () { });
            }
            el.addEventListener("click", onActivate);
            el.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onActivate();
                }
            });
        });
    }

    function loadNotificationInbox() {
        if (!document.getElementById("studentNotificationList")) {
            return Promise.resolve();
        }
        return getJson(endpoints.notificationsAll)
            .then(function (data) {
                renderNotificationInbox(data || []);
            })
            .catch(function (err) {
                var c = document.getElementById("studentNotificationList");
                if (c) {
                    c.innerHTML = "<p class=\"empty\">" + esc(err.message || "Could not load notifications.") + "</p>";
                }
            });
    }

    function postJson(url, payload) {
        return fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "same-origin",
        }).then(parseResponse);
    }

    function setMessage(elementId, text, type) {
        var el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = text || "";
        el.classList.remove("success", "error");
        if (type) el.classList.add(type);
    }

    // ───────────────────────── GRADE LOGIC ─────────────────────────
    function computeFinalGrade10(chuyenCan, giuaKy, cuoiKy) {
        var cc = chuyenCan == null ? null : Number(chuyenCan);
        var gk = giuaKy == null ? null : Number(giuaKy);
        var ck = cuoiKy == null ? null : Number(cuoiKy);
        if (cc == null && gk == null && ck == null) return null;
        // Nếu thiếu thành phần, dùng 0 cho phần thiếu chỉ khi có điểm cuối kỳ
        if (ck == null) return null;
        cc = cc == null ? 0 : cc;
        gk = gk == null ? 0 : gk;
        return cc * 0.1 + gk * 0.3 + ck * 0.6;
    }

    function gradeToLetter(score10) {
        if (score10 == null) return "—";
        if (score10 >= 8.5) return "A";
        if (score10 >= 8.0) return "B+";
        if (score10 >= 7.0) return "B";
        if (score10 >= 6.5) return "C+";
        if (score10 >= 5.5) return "C";
        if (score10 >= 5.0) return "D+";
        if (score10 >= 4.0) return "D";
        return "F";
    }

    function gradeToScore4(score10) {
        if (score10 == null) return null;
        if (score10 >= 8.5) return 4.0;
        if (score10 >= 8.0) return 3.5;
        if (score10 >= 7.0) return 3.0;
        if (score10 >= 6.5) return 2.5;
        if (score10 >= 5.5) return 2.0;
        if (score10 >= 5.0) return 1.5;
        if (score10 >= 4.0) return 1.0;
        return 0.0;
    }

    function letterToClass(letter) {
        if (!letter) return "";
        var c = letter.toUpperCase().charAt(0);
        if (c === "A") return "grade-a";
        if (c === "B") return "grade-b";
        if (c === "C") return "grade-c";
        if (c === "D") return "grade-d";
        return "grade-f";
    }

    function classifySemester(dateStr) {
        // Group by academic year based on EnrollmentDate (month 8+ = semester 1 of <year>-<year+1>, <8 = semester 2 of <year-1>-<year>)
        if (!dateStr) return { key: "unknown", label: "Chưa xác định học kỳ", order: 0 };
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return { key: "unknown", label: "Chưa xác định học kỳ", order: 0 };
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var semester, start, end;
        if (m >= 8) { semester = 1; start = y; end = y + 1; }
        else if (m >= 1 && m <= 6) { semester = 2; start = y - 1; end = y; }
        else { semester = 3; start = y - 1; end = y; } // July summer
        var label = "Năm học " + start + "_" + end + " · Học kỳ " + semester;
        var key = start + "-" + end + "-" + semester;
        var order = start * 10 + semester;
        return { key: key, label: label, order: order };
    }

    function statusBadgeHtml(status) {
        var s = String(status || "").toLowerCase();
        var cls = "subject-status";
        if (s === "enrolled" || s === "đang học") cls += " is-enrolled";
        else if (s === "pending") cls += " is-pending";
        else if (s === "dropped" || s === "cancelled") cls += " is-dropped";
        return '<span class="' + cls + '"><i class="fas fa-circle-dot"></i> ' + esc(status || "—") + '</span>';
    }

    // ───────────────────────── SCORES RENDERING ─────────────────────────
    function buildScoreRows() {
        var scores = state.scores || [];
        return scores.map(function (row, idx) {
            var final10 = computeFinalGrade10(row.ChuyenCan, row.GiuaKy, row.CuoiKy);
            var letter = gradeToLetter(final10);
            var score4 = gradeToScore4(final10);
            var sem = classifySemester(row.EnrollmentDate);
            var pass = final10 != null && final10 >= 4.0 && letter !== "F";
            return {
                idx: idx + 1,
                CourseCode: row.CourseCode || "",
                CourseName: row.CourseName || row.ClassName || "",
                ClassCode: row.ClassCode || "",
                Credits: row.Credits || 0,
                ChuyenCan: row.ChuyenCan,
                GiuaKy: row.GiuaKy,
                CuoiKy: row.CuoiKy,
                Final10: final10,
                Score4: score4,
                Letter: letter,
                Pass: pass,
                SemesterKey: sem.key,
                SemesterLabel: sem.label,
                SemesterOrder: sem.order,
            };
        });
    }

    function renderScores() {
        var rows = buildScoreRows();
        var listEl = document.getElementById("scoreSemesterList");
        var recentEl = document.getElementById("scoreRecentList");
        var debtEl = document.getElementById("scoreDebtBody");
        var knowledgeEl = document.getElementById("scoreKnowledgeBody");
        var warningEl = document.getElementById("scoreWarningBody");

        // Group by semester (descending)
        var groups = {};
        rows.forEach(function (r) {
            if (!groups[r.SemesterKey]) {
                groups[r.SemesterKey] = { key: r.SemesterKey, label: r.SemesterLabel, order: r.SemesterOrder, rows: [] };
            }
            groups[r.SemesterKey].rows.push(r);
        });
        var groupArr = Object.keys(groups).map(function (k) { return groups[k]; });
        groupArr.sort(function (a, b) { return b.order - a.order; });

        // Semester tables
        if (listEl) {
            if (!rows.length) {
                listEl.innerHTML = '<div class="portal-card"><p class="empty">Chưa có điểm.</p></div>';
            } else {
                listEl.innerHTML = groupArr.map(function (g) {
                    var totalCredits = g.rows.reduce(function (s, r) { return s + (r.Credits || 0); }, 0);
                    var weighted10 = 0, weighted4 = 0, creditsGraded = 0;
                    g.rows.forEach(function (r) {
                        if (r.Final10 != null) {
                            var c = r.Credits || 0;
                            weighted10 += r.Final10 * c;
                            weighted4 += (r.Score4 == null ? 0 : r.Score4) * c;
                            creditsGraded += c;
                        }
                    });
                    var avg10 = creditsGraded ? (weighted10 / creditsGraded).toFixed(2) : "—";
                    var avg4 = creditsGraded ? (weighted4 / creditsGraded).toFixed(2) : "—";

                    var body = g.rows.map(function (r, i) {
                        return '<tr>'
                            + '<td>' + (i + 1) + '</td>'
                            + '<td><strong>' + esc(r.CourseCode || r.ClassCode) + '</strong></td>'
                            + '<td>' + esc(r.CourseName) + '<br><small>' + esc(r.ClassCode) + '</small></td>'
                            + '<td>' + (r.Credits || 0) + '</td>'
                            + '<td>' + (r.ChuyenCan == null ? '—' : Number(r.ChuyenCan).toFixed(1)) + '</td>'
                            + '<td>' + (r.GiuaKy == null ? '—' : Number(r.GiuaKy).toFixed(1)) + '</td>'
                            + '<td>' + (r.CuoiKy == null ? '—' : Number(r.CuoiKy).toFixed(1)) + '</td>'
                            + '<td><strong>' + (r.Final10 == null ? '—' : r.Final10.toFixed(2)) + '</strong></td>'
                            + '<td>' + (r.Score4 == null ? '—' : r.Score4.toFixed(1)) + '</td>'
                            + '<td><span class="score-letter ' + letterToClass(r.Letter) + '">' + esc(r.Letter) + '</span></td>'
                            + '<td>' + (r.Final10 == null
                                ? '<span class="score-judge judge-pending">Chưa có</span>'
                                : (r.Pass
                                    ? '<span class="score-judge judge-ok">Đạt</span>'
                                    : '<span class="score-judge judge-fail">Không đạt</span>'))
                            + '</td>'
                            + '</tr>';
                    }).join("");

                    return ''
                        + '<article class="semester-card">'
                        + '  <header class="semester-card-head">'
                        + '    <h3><i class="fas fa-graduation-cap"></i> ' + esc(g.label) + '</h3>'
                        + '    <div class="semester-meta">'
                        + '      <span>Tổng TC: <strong>' + totalCredits + '</strong></span>'
                        + '      <span>TB hệ 10: <strong>' + avg10 + '</strong></span>'
                        + '      <span>TB hệ 4: <strong>' + avg4 + '</strong></span>'
                        + '    </div>'
                        + '  </header>'
                        + '  <div class="table-wrap">'
                        + '    <table class="portal-table">'
                        + '      <thead><tr>'
                        + '        <th>STT</th><th>Mã HP</th><th>Tên học phần</th>'
                        + '        <th>TC</th><th>CC</th><th>GK</th><th>CK</th>'
                        + '        <th>Hệ 10</th><th>Hệ 4</th><th>Chữ</th><th>Đánh giá</th>'
                        + '      </tr></thead>'
                        + '      <tbody>' + body + '</tbody>'
                        + '    </table>'
                        + '  </div>'
                        + '</article>';
                }).join("");
            }
        }

        // Recent
        if (recentEl) {
            var recent = rows.slice().filter(function (r) { return r.Final10 != null; })
                .sort(function (a, b) {
                    var ao = a.SemesterOrder || 0, bo = b.SemesterOrder || 0;
                    return bo - ao;
                })
                .slice(0, 8);
            recentEl.innerHTML = recent.length
                ? recent.map(function (r) {
                    return '<li>'
                        + '<span class="recent-name">' + esc(r.CourseName) + '</span>'
                        + '<span class="recent-value">' + r.Final10.toFixed(1) + '</span>'
                        + '</li>';
                }).join("")
                : '<li class="empty">Chưa có điểm mới.</li>';
        }

        // Totals
        var totalCreditsAll = rows.reduce(function (s, r) { return s + (r.Credits || 0); }, 0);
        var creditsPassed = 0, weighted10All = 0, weighted4All = 0, creditsGradedAll = 0;
        rows.forEach(function (r) {
            if (r.Final10 != null) {
                creditsGradedAll += (r.Credits || 0);
                weighted10All += r.Final10 * (r.Credits || 0);
                weighted4All += (r.Score4 == null ? 0 : r.Score4) * (r.Credits || 0);
                if (r.Pass) creditsPassed += (r.Credits || 0);
            }
        });
        var avg10All = creditsGradedAll ? (weighted10All / creditsGradedAll).toFixed(2) : "—";
        var avg4All = creditsGradedAll ? (weighted4All / creditsGradedAll).toFixed(2) : "—";
        var setEl = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
        setEl("scoreTotalCredits", totalCreditsAll);
        setEl("scoreCumulatedCredits", creditsPassed);
        setEl("scoreAvg10", avg10All);
        setEl("scoreAvg4", avg4All);
        setEl("scoreCumulated10", avg10All);
        setEl("scoreCumulated4", avg4All);
        setEl("kpiTotalCourses", rows.length);
        setEl("kpiTotalCredits", creditsPassed);
        setEl("kpiGpa4", avg4All);

        // Debt courses (failed / not passed with grade available)
        if (debtEl) {
            var debtRows = rows.filter(function (r) { return r.Final10 != null && !r.Pass; });
            debtEl.innerHTML = debtRows.length
                ? debtRows.map(function (r, i) {
                    return '<tr>'
                        + '<td>' + (i + 1) + '</td>'
                        + '<td><strong>' + esc(r.CourseCode || r.ClassCode) + '</strong></td>'
                        + '<td>' + esc(r.CourseName) + '</td>'
                        + '<td>' + esc(r.ClassCode) + '</td>'
                        + '<td>' + (r.Credits || 0) + '</td>'
                        + '<td><strong>' + r.Final10.toFixed(2) + '</strong></td>'
                        + '<td><span class="score-judge judge-fail">Chưa đạt</span></td>'
                        + '</tr>';
                }).join("")
                : '<tr><td colspan="7" class="empty">Không có học phần nợ — bạn đã đạt tất cả các môn có điểm.</td></tr>';
        }

        // Knowledge (simple: group by CourseCode prefix or credits tiers)
        if (knowledgeEl) {
            var buckets = {};
            rows.forEach(function (r) {
                var key = (r.CourseCode || "—").slice(0, 3).toUpperCase() || "—";
                if (!buckets[key]) buckets[key] = { key: key, credits: 0, credGraded: 0, weighted10: 0, count: 0 };
                buckets[key].count += 1;
                buckets[key].credits += (r.Credits || 0);
                if (r.Final10 != null) {
                    buckets[key].credGraded += (r.Credits || 0);
                    buckets[key].weighted10 += r.Final10 * (r.Credits || 0);
                }
            });
            var blocks = Object.keys(buckets).sort().map(function (k) {
                var b = buckets[k];
                var avg = b.credGraded ? (b.weighted10 / b.credGraded).toFixed(2) : "—";
                return '<article class="subject-class">'
                    + '<div class="subject-class-head">'
                    + '<span class="subject-class-code">Khối ' + esc(b.key) + '</span>'
                    + '<span class="subject-class-seats">' + b.count + ' học phần · ' + b.credits + ' TC</span>'
                    + '</div>'
                    + '<div class="subject-class-meta">'
                    + '<span><i class="fas fa-chart-line"></i> TB hệ 10: <strong>' + avg + '</strong></span>'
                    + '</div>'
                    + '</article>';
            }).join("");
            knowledgeEl.innerHTML = blocks || '<p class="empty">Chưa có dữ liệu.</p>';
        }

        // Warning
        if (warningEl) {
            var gpa = parseFloat(avg4All);
            var msgs = [];
            if (!isNaN(gpa)) {
                if (gpa < 1.0) msgs.push({ level: "fail", text: "Cảnh báo mức 3: Điểm TB tích lũy hệ 4 dưới 1.0 — nguy cơ buộc thôi học." });
                else if (gpa < 1.5) msgs.push({ level: "fail", text: "Cảnh báo mức 2: Điểm TB tích lũy hệ 4 dưới 1.5." });
                else if (gpa < 2.0) msgs.push({ level: "warn", text: "Cảnh báo mức 1: Điểm TB tích lũy hệ 4 dưới 2.0." });
            }
            var debtCount = rows.filter(function (r) { return r.Final10 != null && !r.Pass; }).length;
            if (debtCount > 0) msgs.push({ level: "warn", text: "Bạn đang có " + debtCount + " học phần chưa đạt, nên đăng ký học lại sớm." });
            if (!msgs.length) msgs.push({ level: "ok", text: "Chúc mừng! Bạn không có cảnh báo học vụ nào." });
            warningEl.innerHTML = msgs.map(function (m) {
                var cls = m.level === "fail" ? "judge-fail" : m.level === "warn" ? "judge-pending" : "judge-ok";
                return '<div class="score-judge ' + cls + '" style="display:block;padding:10px 14px;margin-bottom:8px;font-size:0.9rem">' + esc(m.text) + '</div>';
            }).join("");
        }
    }

    function renderNotifications() {
        var listEl = document.getElementById("notificationsList");
        if (!listEl) return;
        var notifs = state.notifications || [];
        if (!notifs.length) {
            listEl.innerHTML = '<div class="portal-card"><div class="empty">Bạn không có thông báo nào.</div></div>';
            return;
        }
        listEl.innerHTML = notifs.map(function (n) {
            var dateStr = fmtDateVi(n.CreatedDate);
            var unreadStyle = n.IsRead ? "" : 'border-left: 4px solid var(--accent); background: #fdf9f5;';
            var markReadBtn = n.IsRead ? "" : '<button class="btn btn-outline btn-small" data-read-id="' + n.NotificationId + '">Đánh dấu đã đọc</button>';
            return '<div class="portal-card" style="' + unreadStyle + '">'
                + '  <div class="portal-card-head">'
                + '    <h3>' + (n.IsRead ? "" : '<i class="fas fa-circle" style="font-size:0.5rem; color:var(--accent); vertical-align:middle; margin-right:6px"></i>') + esc(n.Title) + '</h3>'
                + '    <span class="portal-card-badge">' + esc(n.CreatorName || "Hệ thống") + '</span>'
                + '  </div>'
                + '  <div class="portal-card-body">'
                + '    <p style="margin: 0 0 10px; color: var(--ink-light); white-space: pre-wrap;">' + esc(n.Content) + '</p>'
                + '    <div style="display:flex; align-items:center; justify-content:space-between">'
                + '      <span style="font-size:0.8rem; color:var(--ink-lightest); font-weight:600">' + dateStr + '</span>'
                + markReadBtn
                + '    </div>'
                + '  </div>'
                + '</div>';
        }).join("");
    }

    // ───────────────────────── REGISTRATION ─────────────────────────
    function subjectThemeByIndex(i) {
        var themes = ["theme-blue", "theme-green", "theme-teal", "theme-orange", "theme-red", "theme-purple", "theme-indigo"];
        return themes[i % themes.length];
    }

    function renderRegistration() {
        // Group options by CourseCode
        var options = state.registrationOptions || [];
        var keyword = (document.getElementById("registerKeyword") || {}).value || "";
        keyword = String(keyword).toLowerCase().trim();
        var courseFilter = (document.getElementById("registerCourseFilter") || {}).value || "";

        var grid = document.getElementById("registerSubjectGrid");
        var courseSelect = document.getElementById("registerCourseFilter");
        var countEl = document.getElementById("registerCount");

        // Populate course filter (once)
        if (courseSelect && !courseSelect.dataset.populated) {
            var uniq = {};
            options.forEach(function (o) {
                var c = o.CourseCode || "";
                if (!uniq[c]) uniq[c] = (o.CourseName || c);
            });
            var keys = Object.keys(uniq).sort();
            keys.forEach(function (k) {
                var opt = document.createElement("option");
                opt.value = k;
                opt.textContent = k + " – " + uniq[k];
                courseSelect.appendChild(opt);
            });
            courseSelect.dataset.populated = "1";
        }

        // Group
        var groups = {};
        options.forEach(function (o) {
            var key = o.CourseCode || "—";
            if (courseFilter && courseFilter !== key) return;
            var hay = (o.CourseName + " " + o.ClassCode + " " + o.ClassName + " " + o.CourseCode + " " + (o.CourseContent || "")).toLowerCase();
            if (keyword && hay.indexOf(keyword) === -1) return;
            if (!groups[key]) groups[key] = { CourseCode: key, CourseName: o.CourseName, TuitionFee: o.TuitionFee, classes: [] };
            groups[key].classes.push(o);
        });
        var groupArr = Object.keys(groups).map(function (k) { return groups[k]; });

        if (countEl) countEl.textContent = groupArr.reduce(function (s, g) { return s + g.classes.length; }, 0);

        if (!grid) return;
        if (!groupArr.length) {
            grid.innerHTML = '<p class="empty">Không có lớp phù hợp bộ lọc.</p>';
            return;
        }

        grid.innerHTML = groupArr.map(function (g, idx) {
            var classesHtml = g.classes.map(function (c) {
                var seat = c.RemainingSeats == null ? "Không giới hạn" : (c.RemainingSeats + " chỗ còn");
                return '<article class="subject-class">'
                    + '<div class="subject-class-head">'
                    + '<span class="subject-class-code">' + esc(c.ClassCode) + '</span>'
                    + '<span class="subject-class-seats">' + esc(seat) + '</span>'
                    + '</div>'
                    + '<div class="subject-class-meta">'
                    + '<span><i class="fas fa-users"></i> Sĩ số: ' + (c.EnrollmentCount || 0) + (c.MaxStudents ? "/" + c.MaxStudents : "") + '</span>'
                    + '<span><i class="fas fa-tag"></i> ' + esc(c.ClassName || "") + '</span>'
                    + '</div>'
                    + '<div style="margin-top:6px;text-align:right">'
                    + '<button type="button" class="btn btn-primary btn-sm" data-register-class="' + c.ClassId + '">'
                    + '<i class="fas fa-plus"></i> Đăng ký</button>'
                    + '</div>'
                    + '</article>';
            }).join("");
            return '<article class="subject-card ' + subjectThemeByIndex(idx) + '">'
                + '  <header class="subject-card-head">'
                + '    <span class="subject-card-tag"><i class="fas fa-book"></i> ' + esc(g.CourseCode) + '</span>'
                + '    <h3>' + esc(g.CourseName) + '</h3>'
                + '    <small>' + g.classes.length + ' lớp đang mở</small>'
                + '  </header>'
                + '  <div class="subject-card-body">' + classesHtml + '</div>'
                + '  <footer class="subject-card-footer">'
                + '    <span class="fee">' + fmtMoneyVND(g.TuitionFee) + '</span>'
                + '    <span class="subject-status"><i class="fas fa-circle-dot"></i> Có thể đăng ký</span>'
                + '  </footer>'
                + '</article>';
        }).join("");

        // Bind register buttons
        grid.querySelectorAll("[data-register-class]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                handleRegisterClass(Number(btn.dataset.registerClass));
            });
        });
    }

    function handleRegisterClass(classId) {
        if (!classId) return;
        setMessage("registrationMessage", "Đang gửi đăng ký lớp…", "");
        postJson(endpoints.register, { ClassId: classId })
            .then(function () {
                setMessage("registrationMessage", "Đăng ký lớp thành công.", "success");
                return reloadData();
            })
            .catch(function (err) {
                setMessage("registrationMessage", err.message || "Không đăng ký được.", "error");
            });
    }

    function renderEnrollments() {
        var learning = (state.learning && state.learning.Enrollments) || [];
        var regs = state.registrationStatus || [];

        // Cards view grouped by course
        var grid = document.getElementById("enrollmentSubjectGrid");
        if (grid) {
            if (!learning.length) {
                grid.innerHTML = '<p class="empty">Bạn chưa ghi danh lớp nào.</p>';
            } else {
                var byCourse = {};
                learning.forEach(function (e) {
                    var key = e.CourseCode || "—";
                    if (!byCourse[key]) byCourse[key] = { CourseCode: key, CourseName: e.CourseName, TuitionFee: e.TuitionFee, classes: [] };
                    byCourse[key].classes.push(e);
                });
                grid.innerHTML = Object.keys(byCourse).map(function (k, idx) {
                    var g = byCourse[k];
                    var classesHtml = g.classes.map(function (c) {
                        return '<article class="subject-class">'
                            + '<div class="subject-class-head">'
                            + '<span class="subject-class-code">' + esc(c.ClassCode) + '</span>'
                            + '<span class="subject-class-seats">' + fmtDateVi(c.EnrollmentDate) + '</span>'
                            + '</div>'
                            + '<div class="subject-class-meta">'
                            + '<span><i class="fas fa-user-tie"></i> ' + esc(c.TeacherName || "Chưa phân công") + '</span>'
                            + '<span><i class="fas fa-tag"></i> ' + esc(c.ClassName || "") + '</span>'
                            + '<span><i class="fas fa-clock"></i> ' + esc(c.Duration || "—") + '</span>'
                            + '</div>'
                            + '</article>';
                    }).join("");
                    var status = g.classes[0] && g.classes[0].Status;
                    return '<article class="subject-card ' + subjectThemeByIndex(idx) + '">'
                        + '  <header class="subject-card-head">'
                        + '    <span class="subject-card-tag"><i class="fas fa-bookmark"></i> ' + esc(g.CourseCode) + '</span>'
                        + '    <h3>' + esc(g.CourseName) + '</h3>'
                        + '    <small>' + g.classes.length + ' lớp đã ghi danh</small>'
                        + '  </header>'
                        + '  <div class="subject-card-body">' + classesHtml + '</div>'
                        + '  <footer class="subject-card-footer">'
                        + '    <span class="fee">' + fmtMoneyVND(g.TuitionFee) + '</span>'
                        + '    ' + statusBadgeHtml(status)
                        + '  </footer>'
                        + '</article>';
                }).join("");
            }
        }

        // List view
        var tbody = document.getElementById("registrationStatusBody");
        if (tbody) {
            tbody.innerHTML = regs.length
                ? regs.map(function (r, i) {
                    var canDrop = String(r.RegistrationStatus || "").toLowerCase() === "enrolled";
                    var actionHtml = canDrop
                        ? '<button type="button" class="btn btn-outline btn-sm drop-enroll-btn" data-enrollment-id="' + esc(r.EnrollmentId) + '">'
                            + '<i class="fas fa-ban"></i> Drop</button>'
                        : '<span style="color:var(--dk-text-3,#64748b);font-size:.85rem">—</span>';
                    return '<tr>'
                        + '<td>' + (i + 1) + '</td>'
                        + '<td><strong>' + esc(r.ClassCode) + '</strong><br><small>' + esc(r.ClassName || "") + '</small></td>'
                        + '<td>' + esc(r.CourseCode || "") + ' – ' + esc(r.CourseName || "") + '</td>'
                        + '<td>' + fmtDateVi(r.EnrollmentDate) + '</td>'
                        + '<td>' + fmtMoneyVND(r.TuitionFee) + '</td>'
                        + '<td>' + statusBadgeHtml(r.RegistrationStatus) + '</td>'
                        + '<td>' + actionHtml + '</td>'
                        + '</tr>';
                }).join("")
                : '<tr><td colspan="7" class="empty">Chưa có đăng ký.</td></tr>';

            tbody.querySelectorAll(".drop-enroll-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var eid = Number(btn.dataset.enrollmentId || 0);
                    if (!eid) return;
                    if (!confirm("Bạn chắc chắn muốn huỷ ghi danh lớp này? (Chỉ được huỷ khi chưa phát sinh thanh toán)")) {
                        return;
                    }
                    btn.disabled = true;
                    postJson(endpoints.dropEnrollment, { EnrollmentId: eid })
                        .then(function (res) {
                            alert(res.message || "Đã huỷ ghi danh.");
                            return reloadData();
                        })
                        .catch(function (err) {
                            alert(err.message || "Không huỷ được ghi danh.");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                });
            });
        }
    }

    // ───────────────────────── SCHEDULE (WEEK GRID) ─────────────────────────
    var scheduleCursor = null; // Monday date of current week

    function mondayOf(date) {
        var d = new Date(date);
        d.setHours(0, 0, 0, 0);
        var day = d.getDay();        // 0=Sun..6=Sat
        var diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        return d;
    }

    function addDays(date, n) {
        var d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    function sameDate(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function renderSchedule() {
        var grid = document.getElementById("scheduleGrid");
        var listEl = document.getElementById("scheduleList");
        var weekTitle = document.getElementById("scheduleWeekTitle");
        var weekRange = document.getElementById("scheduleWeekRange");
        if (!grid) return;

        if (!scheduleCursor) scheduleCursor = mondayOf(new Date());

        var startOfWeek = mondayOf(scheduleCursor);
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var events = state.schedule || [];

        // Compute hour range
        var minHour = 7, maxHour = 20;
        events.forEach(function (e) {
            var s = Math.floor(toHoursFloat(e.StartTime)) || 7;
            var en = Math.ceil(toHoursFloat(e.EndTime)) || 8;
            if (s < minHour) minHour = s;
            if (en > maxHour) maxHour = en;
        });
        if (minHour > 7) minHour = 7;
        if (maxHour < 18) maxHour = 18;
        var hourCount = maxHour - minHour;

        // Header
        var html = '<div class="schedule-corner" style="grid-row: 1; grid-column: 1;"></div>';
        for (var i = 0; i < 7; i++) {
            var day = addDays(startOfWeek, i);
            var isToday = sameDate(day, today);
            var dd = String(day.getDate()).padStart(2, "0");
            var mm = String(day.getMonth() + 1).padStart(2, "0");
            html += '<div class="schedule-day-head' + (isToday ? " is-today" : "") + '" data-day-idx="' + i + '" style="grid-row: 1; grid-column: ' + (i + 2) + ';">'
                + esc(WEEKDAY_VI[WEEKDAY_ORDER[i]])
                + '<small>' + dd + '/' + mm + '</small>'
                + '</div>';
        }

        // Time cells + slots
        for (var h = 0; h < hourCount; h++) {
            html += '<div class="schedule-time-cell" style="grid-row: ' + (h + 2) + '; grid-column: 1;">'
                + String(minHour + h).padStart(2, "0") + ':00</div>';
            for (var d = 0; d < 7; d++) {
                var dayDate = addDays(startOfWeek, d);
                var isTodaySlot = sameDate(dayDate, today);
                html += '<div class="schedule-slot' + (isTodaySlot ? " is-today" : "") + '" data-day-idx="' + d + '" style="grid-row: ' + (h + 2) + '; grid-column: ' + (d + 2) + ';"></div>';
            }
        }

        grid.style.gridTemplateRows = "auto repeat(" + hourCount + ", var(--row-height))";
        grid.innerHTML = html;

        // Place events
        var weekEvents = [];
        events.forEach(function (e, i) {
            var wdIdx = WEEKDAY_ORDER.indexOf(e.Weekday);
            if (wdIdx < 0) return;
            var startH = toHoursFloat(e.StartTime);
            var endH = toHoursFloat(e.EndTime);
            if (!endH || endH <= startH) return;

            var topUnits = (startH - minHour);
            var heightUnits = (endH - startH);
            if (topUnits < 0 || topUnits + heightUnits > hourCount) return;

            var block = document.createElement("div");
            block.className = "schedule-event color-" + (i % 7);
            block.style.gridRow = "2 / " + (hourCount + 2);
            block.style.gridColumn = (wdIdx + 2) + " / " + (wdIdx + 3);
            // Position with transform top (inside grid area)
            var totalHeightPx = hourCount * 52;
            var topPx = (topUnits / hourCount) * totalHeightPx;
            var hPx = (heightUnits / hourCount) * totalHeightPx;
            block.style.position = "relative";
            block.style.gridRow = (Math.floor(topUnits) + 2) + " / " + (Math.ceil(topUnits + heightUnits) + 2);
            block.style.alignSelf = "stretch";
            block.style.marginTop = ((topUnits - Math.floor(topUnits)) * 52) + "px";
            block.style.marginBottom = ((Math.ceil(topUnits + heightUnits) - (topUnits + heightUnits)) * 52) + "px";
            block.innerHTML = '<strong>' + esc(e.ClassName || e.ClassCode) + '</strong>'
                + '<span class="event-time"><i class="fas fa-clock"></i> ' + hhmm(e.StartTime) + ' – ' + hhmm(e.EndTime) + '</span>'
                + '<small>' + esc(e.RoomName || "—") + (e.TeacherName ? " · " + esc(e.TeacherName) : "") + '</small>';

            block.addEventListener("click", function () {
                openScheduleModal(e);
            });
            grid.appendChild(block);
            weekEvents.push(e);
        });

        // Title & range
        if (weekTitle) {
            weekTitle.textContent = "Tuần " + fmtDateVi(startOfWeek) + " – " + fmtDateVi(addDays(startOfWeek, 6));
        }
        if (weekRange) {
            var minM = startOfWeek.getMonth() + 1;
            var maxM = addDays(startOfWeek, 6).getMonth() + 1;
            weekRange.textContent = "Tháng " + (minM === maxM ? minM : (minM + "–" + maxM)) + "/" + startOfWeek.getFullYear();
        }

        // List
        if (listEl) {
            if (!events.length) {
                listEl.innerHTML = '<li class="empty">Chưa có lịch học trong tuần.</li>';
            } else {
                var sorted = events.slice().sort(function (a, b) {
                    return WEEKDAY_ORDER.indexOf(a.Weekday) - WEEKDAY_ORDER.indexOf(b.Weekday)
                        || toHoursFloat(a.StartTime) - toHoursFloat(b.StartTime);
                });
                listEl.innerHTML = sorted.map(function (e) {
                    return '<li>'
                        + '<strong>' + esc(e.ClassName || e.ClassCode) + '</strong>'
                        + '<span>' + esc(WEEKDAY_VI[e.Weekday] || e.Weekday) + ' · ' + hhmm(e.StartTime) + '–' + hhmm(e.EndTime) + '</span>'
                        + '<span><i class="fas fa-door-open"></i> ' + esc(e.RoomName || "TBA") + (e.TeacherName ? ' · ' + esc(e.TeacherName) : '') + '</span>'
                        + '</li>';
                }).join("");
            }
        }

        document.getElementById("kpiWeekSessions") && (document.getElementById("kpiWeekSessions").textContent = events.length);
    }

    function openScheduleModal(e) {
        var modal = document.getElementById("scheduleModal");
        if (!modal) return;
        var title = document.getElementById("scheduleModalTitle");
        var kicker = document.getElementById("scheduleModalKicker");
        var body = document.getElementById("scheduleModalBody");
        if (title) title.textContent = e.ClassName || e.ClassCode;
        if (kicker) kicker.textContent = "Chi tiết buổi học · " + (WEEKDAY_VI[e.Weekday] || e.Weekday);
        if (body) {
            body.innerHTML = '<dl class="modal-info-grid">'
                + '<dt>Mã lớp</dt><dd>' + esc(e.ClassCode || "—") + '</dd>'
                + '<dt>Tên lớp</dt><dd>' + esc(e.ClassName || "—") + '</dd>'
                + '<dt>Ngày học</dt><dd>' + esc(WEEKDAY_VI[e.Weekday] || e.Weekday) + '</dd>'
                + '<dt>Ca học</dt><dd>' + hhmm(e.StartTime) + ' – ' + hhmm(e.EndTime) + '</dd>'
                + '<dt>Phòng</dt><dd>' + esc(e.RoomName || "TBA") + '</dd>'
                + '<dt>Giảng viên</dt><dd>' + esc(e.TeacherName || "—") + '</dd>'
                + '</dl>';
        }
        modal.hidden = false;
    }

    function bindModalClose() {
        var modal = document.getElementById("scheduleModal");
        if (!modal) return;
        modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
            el.addEventListener("click", function () { modal.hidden = true; });
        });
        document.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape") modal.hidden = true;
        });
    }

    // ───────────────────────── MINI CALENDAR ─────────────────────────
    var miniCursor = new Date();

    function renderMiniCalendar() {
        var container = document.getElementById("miniCalendar");
        var title = document.getElementById("miniTitle");
        if (!container) return;

        var y = miniCursor.getFullYear();
        var m = miniCursor.getMonth();
        if (title) title.textContent = MONTH_VI[m] + " " + y;

        var firstDay = new Date(y, m, 1);
        var startDay = firstDay.getDay(); // 0=Sun
        var offset = startDay === 0 ? 6 : startDay - 1;
        var gridStart = new Date(y, m, 1 - offset);
        var today = new Date(); today.setHours(0, 0, 0, 0);

        var events = state.schedule || [];
        var eventWeekdays = {};
        events.forEach(function (e) {
            var idx = WEEKDAY_ORDER.indexOf(e.Weekday);
            if (idx >= 0) eventWeekdays[idx] = true;
        });

        var labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
        var html = labels.map(function (l) { return '<div class="mini-cal-label">' + l + '</div>'; }).join("");

        for (var i = 0; i < 42; i++) {
            var d = addDays(gridStart, i);
            var out = d.getMonth() !== m;
            var isT = sameDate(d, today);
            var wdIdx = (d.getDay() === 0) ? 6 : d.getDay() - 1;
            var hasEvent = !out && eventWeekdays[wdIdx];
            html += '<div class="mini-cal-day' + (out ? " is-out" : "")
                + (isT ? " is-today" : "")
                + (hasEvent ? " has-event" : "")
                + '" data-date="' + d.toISOString().slice(0, 10) + '">' + d.getDate() + '</div>';
        }
        container.innerHTML = html;

        container.querySelectorAll(".mini-cal-day").forEach(function (cell) {
            cell.addEventListener("click", function () {
                var d = new Date(cell.dataset.date);
                scheduleCursor = mondayOf(d);
                miniCursor = new Date(d);
                renderSchedule();
                renderMiniCalendar();
            });
        });
    }

    // ───────────────────────── EXAMS ─────────────────────────
    function renderExams() {
        var tbody = document.getElementById("examTableBody");
        var semSel = document.getElementById("examSemesterFilter");
        var courseSel = document.getElementById("examCourseFilter");
        var count = document.getElementById("examPersonalCount");
        if (!tbody) return;

        var exams = state.exams || [];

        if (semSel && !semSel.dataset.populated) {
            var sems = {};
            exams.forEach(function (e) {
                var sem = classifySemester(e.ExamDate);
                sems[sem.key] = sem.label;
            });
            Object.keys(sems).forEach(function (k) {
                var o = document.createElement("option");
                o.value = k;
                o.textContent = sems[k];
                semSel.appendChild(o);
            });
            semSel.dataset.populated = "1";
        }
        if (courseSel && !courseSel.dataset.populated) {
            var cs = {};
            exams.forEach(function (e) {
                var k = e.CourseName || e.ClassName;
                if (k) cs[k] = k;
            });
            Object.keys(cs).sort().forEach(function (k) {
                var o = document.createElement("option");
                o.value = k;
                o.textContent = k;
                courseSel.appendChild(o);
            });
            courseSel.dataset.populated = "1";
        }

        var semF = semSel ? semSel.value : "";
        var courseF = courseSel ? courseSel.value : "";

        var rows = exams.filter(function (e) {
            if (semF && classifySemester(e.ExamDate).key !== semF) return false;
            if (courseF && (e.CourseName || e.ClassName) !== courseF) return false;
            return true;
        });

        if (count) count.textContent = rows.length + " ca thi";

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty">Không có lịch thi phù hợp bộ lọc.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(function (e, i) {
            var mode = (e.ExamStatus || "Planned").toLowerCase() === "planned" ? "Tự luận" : (e.ExamStatus || "—");
            return '<tr>'
                + '<td>' + (i + 1) + '</td>'
                + '<td><strong>' + esc(e.ClassCode || "") + '</strong></td>'
                + '<td>' + esc(e.CourseName || e.ClassName || "") + '</td>'
                + '<td>1</td>'
                + '<td>' + fmtDateVi(e.ExamDate) + '</td>'
                + '<td>07:00 – 09:00</td>'
                + '<td>' + esc(mode) + '</td>'
                + '<td>' + esc(e.ExamRoom || "TBA") + '</td>'
                + '<td>' + (i + 1) + '</td>'
                + '</tr>';
        }).join("");
    }

    function exportExamsCSV() {
        var rows = state.exams || [];
        if (!rows.length) {
            alert("Chưa có dữ liệu lịch thi để xuất.");
            return;
        }
        var header = ["STT", "Mã HP", "Tên học phần", "Ngày thi", "Phòng"];
        var body = rows.map(function (e, i) {
            return [i + 1, e.ClassCode || "", (e.CourseName || e.ClassName || "").replaceAll(",", " "), fmtDateISO(e.ExamDate), (e.ExamRoom || "TBA").replaceAll(",", " ")];
        });
        var csv = [header].concat(body).map(function (r) { return r.join(","); }).join("\n");
        var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "lich_thi.csv";
        a.click();
        URL.revokeObjectURL(url);
    }

    // ───────────────────────── TUITION ─────────────────────────
    function renderTuition() {
        var finance = state.finance || [];
        var paiseNop = 0, daNop = 0, duocMien = 0, daRut = 0, noCon = 0, tongDu = 0;
        var phieuThu = 0, phieuRut = 0, phieuHoaDon = 0;

        finance.forEach(function (f) {
            var total = Number(f.TotalFee || 0);
            var paid = Number(f.AmountPaid || 0);
            var debt = Math.max(Number(f.Debt || 0), 0);
            paiseNop += total;
            daNop += paid;
            noCon += debt;
            if (paid > 0) phieuThu += 1;
            if (paid >= total && total > 0) phieuHoaDon += 1;
            var status = String(f.Status || "").toLowerCase();
            if (status === "waived" || status === "miễn") duocMien += total;
            if (status === "refunded" || status === "đã rút") { daRut += paid; phieuRut += 1; }
            if (paid > total) tongDu += (paid - total);
        });

        var setEl = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
        setEl("tuitionPhaiNop", fmtMoney(paiseNop));
        setEl("tuitionDaNop", fmtMoney(daNop));
        setEl("tuitionDuocMien", fmtMoney(duocMien));
        setEl("tuitionDaRut", fmtMoney(daRut));
        setEl("tuitionNoCon", fmtMoney(noCon));
        setEl("tuitionTongDu", fmtMoney(tongDu));
        setEl("tuitionPhieuThu", phieuThu);
        setEl("tuitionPhieuRut", phieuRut);
        setEl("tuitionPhieuHoaDon", phieuHoaDon);

        var badge = document.getElementById("tuitionStatusBadge");
        if (badge) {
            if (noCon <= 0 && paiseNop > 0) {
                badge.className = "portal-chip chip-green";
                badge.textContent = "Đã hoàn thành";
            } else if (noCon > 0) {
                badge.className = "portal-chip chip-red";
                badge.textContent = "Còn nợ " + fmtMoney(noCon) + " đ";
            } else {
                badge.className = "portal-chip chip-yellow";
                badge.textContent = "Chưa phát sinh học phí";
            }
        }

        // Debt value in hero
        var heroDebt = document.getElementById("debtValue");
        if (heroDebt) {
            heroDebt.innerHTML = fmtMoney(noCon) + ' <span>VNĐ</span>';
        }

        var tbody = document.getElementById("financeTableBody");
        if (tbody) {
            tbody.innerHTML = finance.length
                ? finance.map(function (f) {
                    var debt = Number(f.Debt || 0);
                    var status = String(f.Status || "—");
                    var chip = "chip-yellow";
                    var s = status.toLowerCase();
                    if (s === "paid" || s === "đã thanh toán") chip = "chip-green";
                    else if (s === "overdue" || s === "quá hạn") chip = "chip-red";
                    return '<tr>'
                        + '<td><strong>' + esc(f.ClassCode || "") + '</strong><br><small>' + esc(f.ClassName || "") + '</small></td>'
                        + '<td>' + fmtMoneyVND(f.TotalFee) + '</td>'
                        + '<td>' + fmtMoneyVND(f.AmountPaid) + '</td>'
                        + '<td>' + fmtMoneyVND(debt) + '</td>'
                        + '<td>' + fmtDateVi(f.DueDate) + '</td>'
                        + '<td><span class="portal-chip ' + chip + '">' + esc(status) + '</span></td>'
                        + '</tr>';
                }).join("")
                : '<tr><td colspan="6" class="empty">Chưa có khoản học phí.</td></tr>';
        }

        // Payment select
        var paySel = document.getElementById("paymentTuitionSelect");
        if (paySel) {
            paySel.innerHTML = '<option value="">Chọn khoản học phí</option>';
            finance.filter(function (f) { return Number(f.Debt || 0) > 0; }).forEach(function (f) {
                var opt = document.createElement("option");
                opt.value = f.TuitionId;
                opt.textContent = (f.ClassCode || "—") + " · Còn nợ " + fmtMoneyVND(f.Debt);
                opt.dataset.debt = f.Debt;
                opt.dataset.classcode = f.ClassCode || "";
                paySel.appendChild(opt);
            });
        }
    }

    // ───────────────────────── ASSIGNMENTS ─────────────────────────
    function assignmentStatusChip(status) {
        var s = String(status || "").toLowerCase();
        if (s === "submitted") return '<span class="portal-chip chip-green">Submitted</span>';
        if (s === "graded") return '<span class="portal-chip chip-green">Graded</span>';
        if (s === "pending") return '<span class="portal-chip chip-yellow">Pending</span>';
        if (!s) return '<span class="portal-chip chip-yellow">Pending</span>';
        return '<span class="portal-chip chip-yellow">' + esc(status) + '</span>';
    }

    function renderAssignments() {
        var wrap = document.getElementById("assignmentList");
        var pill = document.getElementById("assignmentCountPill");
        if (!wrap) return;

        var rows = state.assignments || [];
        if (pill) pill.textContent = rows.length + " items";
        if (!rows.length) {
            wrap.innerHTML = '<p class="empty">No assignments yet.</p>';
            return;
        }

        wrap.innerHTML = rows.map(function (a) {
            var due = fmtDateVi(a.DueDate);
            var created = fmtDateVi(a.CreatedDate);
            var title = esc(a.Title || "Assignment");
            var desc = esc(a.Description || "");
            var classLine = esc(a.ClassCode || "") + " · " + esc(a.ClassName || "");
            var courseLine = esc(a.CourseCode || "") + " · " + esc(a.CourseName || "");
            var subStatus = a.SubmissionStatus || (a.SubmittedAt ? "Submitted" : "Pending");
            var grade = a.Grade == null ? "—" : String(a.Grade);

            var canSubmit = true;
            // Server side will re-check due date + membership; UI just offers form.

            var submitBlock = canSubmit
                ? (
                    '<div class="portal-form" style="margin-top:10px;display:grid;gap:10px;">'
                    + '<label><span>Submission link (optional)</span>'
                    + '<input type="url" class="assign-fileurl" placeholder="https://drive.google.com/... or github..." value="' + esc(a.FileUrl || "") + '"></label>'
                    + '<label><span>Note (optional)</span>'
                    + '<textarea class="assign-note" rows="3" placeholder="Anything you want to tell your instructor...">' + esc(a.Note || "") + '</textarea></label>'
                    + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
                    + '<button type="button" class="btn btn-primary assign-submit-btn" data-exam-id="' + esc(a.ExamId) + '">'
                    + '<i class="fas fa-paper-plane"></i> Submit</button>'
                    + '<span class="portal-readonly-note" style="margin:0"><i class="fas fa-clock"></i> Due: <strong>' + due + '</strong></span>'
                    + '</div>'
                    + '<p class="portal-message assign-msg" style="margin:0"></p>'
                    + '</div>'
                )
                : '';

            return (
                '<article class="portal-card" style="margin-bottom:12px;">'
                + '<div class="portal-card-head" style="align-items:flex-start;gap:12px;">'
                + '<div style="flex:1;min-width:0">'
                + '<h3 style="margin:0 0 4px 0;"><i class="fas fa-file-circle-check"></i> ' + title + '</h3>'
                + '<p style="margin:0;color:var(--text-muted);font-size:.85rem">' + classLine + '<br>' + courseLine + '</p>'
                + '</div>'
                + '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">'
                + assignmentStatusChip(subStatus)
                + '<span class="portal-chip chip-yellow">Grade: <strong>' + esc(grade) + '</strong></span>'
                + '</div>'
                + '</div>'
                + (desc ? '<p style="margin:0 0 10px 0;color:var(--text);white-space:pre-wrap;line-height:1.6">' + desc + '</p>' : '')
                + '<p style="margin:0 0 10px 0;color:var(--text-muted);font-size:.85rem">Created: ' + created + '</p>'
                + submitBlock
                + '</article>'
            );
        }).join("");

        wrap.querySelectorAll(".assign-submit-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var examId = Number(btn.dataset.examId || 0);
                if (!examId) return;
                var card = btn.closest(".portal-card");
                var fileUrl = card ? (card.querySelector(".assign-fileurl") || {}).value : "";
                var note = card ? (card.querySelector(".assign-note") || {}).value : "";
                var msg = card ? card.querySelector(".assign-msg") : null;
                if (msg) msg.textContent = "Submitting…";
                btn.disabled = true;
                postJson(endpoints.submitAssignment, { ExamId: examId, FileUrl: fileUrl || null, Note: note || null })
                    .then(function (res) {
                        if (msg) msg.textContent = res.message || "Submitted.";
                        return reloadData();
                    })
                    .catch(function (err) {
                        if (msg) msg.textContent = err.message || "Submit failed.";
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        });
    }

    // ───────────────────────── ATTENDANCE ─────────────────────────
    function attendanceChip(status) {
        var s = String(status || "").toLowerCase();
        if (s === "present") return '<span class="portal-chip chip-green">Present</span>';
        if (s === "absent") return '<span class="portal-chip chip-red">Absent</span>';
        if (s === "late") return '<span class="portal-chip chip-yellow">Late</span>';
        if (!s) return '<span class="portal-chip chip-yellow">—</span>';
        return '<span class="portal-chip chip-yellow">' + esc(status) + '</span>';
    }

    function renderAttendance() {
        var tbody = document.getElementById("attendanceTableBody");
        var pill = document.getElementById("attendanceSummaryPill");
        if (!tbody) return;

        var rows = (state.attendance || []).filter(function (r) { return r.SessionDate; });
        var present = 0, absent = 0, late = 0;
        rows.forEach(function (r) {
            var s = String(r.AttendanceStatus || "").toLowerCase();
            if (s === "present") present += 1;
            else if (s === "absent") absent += 1;
            else if (s === "late") late += 1;
        });
        if (pill) {
            pill.textContent = "Present " + present + " · Absent " + absent + " · Late " + late;
        }

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty">No attendance data yet.</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(function (r) {
            return (
                "<tr>"
                + "<td>" + fmtDateVi(r.SessionDate) + "</td>"
                + "<td><strong>" + esc(r.ClassCode || "") + "</strong><br><small>" + esc(r.ClassName || "") + "</small></td>"
                + "<td>" + esc(r.CourseCode || "") + " – " + esc(r.CourseName || "") + "</td>"
                + "<td>" + attendanceChip(r.AttendanceStatus) + "</td>"
                + "</tr>"
            );
        }).join("");
    }

    // ───────────────────────── REGISTER / PAYMENT FORMS ─────────────────────────
    function bindForms() {
        var keywordInput = document.getElementById("registerKeyword");
        var courseSel = document.getElementById("registerCourseFilter");
        if (keywordInput) keywordInput.addEventListener("input", renderRegistration);
        if (courseSel) courseSel.addEventListener("change", renderRegistration);

        var paymentForm = document.getElementById("paymentForm");
        if (paymentForm) {
            paymentForm.addEventListener("submit", function (event) {
                event.preventDefault();
                var tuitionId = document.getElementById("paymentTuitionSelect").value;
                var amount = document.getElementById("paymentAmountInput").value;
                var note = document.getElementById("paymentNoteInput").value;
                var method = document.getElementById("paymentMethodSelect") ? document.getElementById("paymentMethodSelect").value : "";

                if (!tuitionId || !amount) {
                    setMessage("paymentMessage", "Vui lòng chọn khoản học phí và nhập số tiền.", "error");
                    return;
                }
                setMessage("paymentMessage", "Đang ghi nhận thanh toán…", "");
                postJson(endpoints.payment, {
                    TuitionId: Number(tuitionId),
                    Amount: Number(amount),
                    Method: method || null,
                    Note: note || null,
                }).then(function () {
                    setMessage("paymentMessage", "Thanh toán đã được ghi nhận.", "success");
                    paymentForm.reset();
                    return reloadData();
                }).catch(function (err) {
                    setMessage("paymentMessage", err.message || "Không ghi nhận được thanh toán.", "error");
                });
            });
        }

        // Payment example code update when selecting tuition
        var paySel = document.getElementById("paymentTuitionSelect");
        var example = document.getElementById("paymentExample");
        if (paySel && example) {
            paySel.addEventListener("change", function () {
                var opt = paySel.selectedOptions[0];
                var studentCode = document.querySelector(".score-profile-head small");
                var code = studentCode ? studentCode.textContent.trim() : "MSV";
                example.textContent = (code || "MSV") + " HP " + (opt && opt.dataset.classcode ? opt.dataset.classcode : "MALOP");
            });
        }

        // Schedule navigation
        var prev = document.getElementById("schedulePrevBtn");
        var next = document.getElementById("scheduleNextBtn");
        var todayBtn = document.getElementById("scheduleTodayBtn");
        if (prev) prev.addEventListener("click", function () { scheduleCursor = addDays(scheduleCursor, -7); renderSchedule(); renderMiniCalendar(); });
        if (next) next.addEventListener("click", function () { scheduleCursor = addDays(scheduleCursor, 7); renderSchedule(); renderMiniCalendar(); });
        if (todayBtn) todayBtn.addEventListener("click", function () { scheduleCursor = mondayOf(new Date()); miniCursor = new Date(); renderSchedule(); renderMiniCalendar(); });

        // Mini calendar nav
        var miniPrev = document.getElementById("miniPrev");
        var miniNext = document.getElementById("miniNext");
        if (miniPrev) miniPrev.addEventListener("click", function () { miniCursor = new Date(miniCursor.getFullYear(), miniCursor.getMonth() - 1, 1); renderMiniCalendar(); });
        if (miniNext) miniNext.addEventListener("click", function () { miniCursor = new Date(miniCursor.getFullYear(), miniCursor.getMonth() + 1, 1); renderMiniCalendar(); });

        // Score sub-tabs
        var scoreTabs = document.getElementById("scoreSubtabs");
        if (scoreTabs) {
            scoreTabs.addEventListener("click", function (ev) {
                var btn = ev.target.closest("button[data-score-tab]");
                if (!btn) return;
                scoreTabs.querySelectorAll("button").forEach(function (b) { b.classList.remove("is-active"); });
                btn.classList.add("is-active");
                var tab = btn.dataset.scoreTab;
                document.querySelectorAll("[data-score-view]").forEach(function (v) {
                    v.hidden = v.dataset.scoreView !== tab;
                });
            });
        }

        // Enrollment sub-tabs
        var enrolTabs = document.getElementById("enrollmentSubtabs");
        if (enrolTabs) {
            enrolTabs.addEventListener("click", function (ev) {
                var btn = ev.target.closest("button[data-enrol-tab]");
                if (!btn) return;
                enrolTabs.querySelectorAll("button").forEach(function (b) { b.classList.remove("is-active"); });
                btn.classList.add("is-active");
                var tab = btn.dataset.enrolTab;
                document.querySelectorAll("[data-enrol-view]").forEach(function (v) {
                    v.hidden = v.dataset.enrolView !== tab;
                });
            });
        }

        // Exam filters
        var semF = document.getElementById("examSemesterFilter");
        var courseF = document.getElementById("examCourseFilter");
        if (semF) semF.addEventListener("change", renderExams);
        if (courseF) courseF.addEventListener("change", renderExams);

        var examExport = document.getElementById("examExportBtn");
        if (examExport) examExport.addEventListener("click", exportExamsCSV);

    }

    // ───────────────────────── MAIN LOAD ─────────────────────────
    function reloadData() {
        return Promise.all([
            getJson(endpoints.profile).catch(function () { return null; }),
            getJson(endpoints.learning).catch(function () { return { Enrollments: [], CourseContents: [] }; }),
            getJson(endpoints.registrationStatus).catch(function () { return []; }),
            getJson(endpoints.registrationOptions).catch(function () { return []; }),
            getJson(endpoints.schedule).catch(function () { return []; }),
            getJson(endpoints.exams).catch(function () { return []; }),
            getJson(endpoints.assignments).catch(function () { return []; }),
            getJson(endpoints.attendance).catch(function () { return []; }),
            getJson(endpoints.scores).catch(function () { return []; }),
            getJson(endpoints.finance).catch(function () { return []; }),
        ]).then(function (results) {
            state.profile = results[0];
            state.learning = results[1] || { Enrollments: [], CourseContents: [] };
            state.registrationStatus = results[2] || [];
            state.registrationOptions = results[3] || [];
            state.schedule = results[4] || [];
            state.exams = results[5] || [];
            state.assignments = results[6] || [];
            state.attendance = results[7] || [];
            state.scores = results[8] || [];
            state.finance = results[9] || [];

            renderScores();
            renderRegistration();
            renderEnrollments();
            renderSchedule();
            renderMiniCalendar();
            renderExams();
            renderTuition();
            renderAssignments();
            renderAttendance();

            // Overview counts
            var enrollCount = (state.learning.Enrollments || []).length;
            var node = document.getElementById("enrollmentCountValue");
            if (node) node.textContent = enrollCount;
        });
    }

    bindForms();
    bindModalClose();
    reloadData().catch(function (err) {
        setMessage("registrationMessage", err.message, "error");
        setMessage("paymentMessage", err.message, "error");
    });
    refreshNotifBadge();
    if (activePanel === "notifications") {
        loadNotificationInbox();
    }
})();
