(function () {
    var navButtons = Array.from(document.querySelectorAll("#settingsNav [data-tab]"));
    var panels = Array.from(document.querySelectorAll(".settings-panel"));
    var feedback = document.getElementById("settingsFeedback");
    var profileForm = document.getElementById("profileForm");
    var passwordForm = document.getElementById("passwordForm");
    var preferencesForm = document.getElementById("preferencesForm");
    var sessionAgent = document.getElementById("sessionUserAgent");
    var PREF_KEY = "classes369.settings.preferences";

    function showTab(tabId) {
        navButtons.forEach(function (btn) {
            btn.classList.toggle("is-active", btn.dataset.tab === tabId);
        });
        panels.forEach(function (panel) {
            panel.classList.toggle("is-active", panel.dataset.panel === tabId);
        });
        if (history && history.replaceState) {
            history.replaceState(null, "", "#" + tabId);
        }
    }

    navButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            showTab(btn.dataset.tab);
            if (feedback) {
                feedback.hidden = true;
            }
        });
    });

    var initialTab = (location.hash || "").replace("#", "");
    if (initialTab && navButtons.some(function (b) { return b.dataset.tab === initialTab; })) {
        showTab(initialTab);
    }

    function renderFeedback(type, message) {
        if (!feedback) {
            return;
        }
        feedback.textContent = "";
        feedback.className = "settings-feedback " + type;
        var icon = document.createElement("i");
        icon.className = type === "success" ? "fas fa-check-circle" : "fas fa-circle-exclamation";
        var label = document.createElement("span");
        label.textContent = message;
        feedback.appendChild(icon);
        feedback.appendChild(label);
        feedback.hidden = false;
        feedback.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function formToJson(form) {
        var data = {};
        Array.from(form.elements).forEach(function (el) {
            if (!el.name || el.disabled) {
                return;
            }
            if (el.type === "checkbox") {
                data[el.name] = el.checked;
            } else {
                data[el.name] = el.value;
            }
        });
        return data;
    }

    if (profileForm) {
        profileForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var payload = formToJson(profileForm);

            fetch("/api/users/me", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
                .then(function (res) { return res.json().then(function (json) { return { res: res, json: json }; }); })
                .then(function (result) {
                    if (result.res.ok && result.json && result.json.success) {
                        renderFeedback("success", result.json.message || "Đã lưu thay đổi.");
                    } else {
                        renderFeedback("error", (result.json && result.json.error) || "Không thể lưu thay đổi.");
                    }
                })
                .catch(function () {
                    renderFeedback("error", "Không thể kết nối máy chủ. Vui lòng thử lại.");
                });
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var payload = formToJson(passwordForm);

            if (payload.NewPassword && payload.NewPassword !== payload.ConfirmPassword) {
                renderFeedback("error", "Mật khẩu xác nhận không khớp.");
                return;
            }

            fetch("/api/users/me/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
                .then(function (res) { return res.json().then(function (json) { return { res: res, json: json }; }); })
                .then(function (result) {
                    if (result.res.ok && result.json && result.json.success) {
                        renderFeedback("success", result.json.message || "Đã đổi mật khẩu.");
                        passwordForm.reset();
                    } else {
                        renderFeedback("error", (result.json && result.json.error) || "Không thể đổi mật khẩu.");
                    }
                })
                .catch(function () {
                    renderFeedback("error", "Không thể kết nối máy chủ. Vui lòng thử lại.");
                });
        });
    }

    function loadPreferences() {
        if (!preferencesForm) {
            return;
        }

        try {
            var stored = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
            Object.keys(stored).forEach(function (key) {
                var el = preferencesForm.elements.namedItem(key);
                if (!el) {
                    return;
                }
                if (el.type === "checkbox") {
                    el.checked = Boolean(stored[key]);
                } else {
                    el.value = stored[key];
                }
            });
        } catch (err) {
            // ignore storage parse errors
        }
    }

    if (preferencesForm) {
        loadPreferences();
        preferencesForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var payload = formToJson(preferencesForm);
            try {
                localStorage.setItem(PREF_KEY, JSON.stringify(payload));
                renderFeedback("success", "Đã lưu tuỳ chọn trên thiết bị này.");
            } catch (err) {
                renderFeedback("error", "Không thể lưu vào thiết bị này.");
            }
        });
    }

    if (sessionAgent) {
        sessionAgent.textContent = navigator.userAgent || "Không xác định";
    }
})();
