(function () {
    function T(key, fallback) {
        try {
            if (window.i18n && typeof window.i18n.t === "function") {
                var s = window.i18n.t(key);
                if (s && s !== key) return s;
            }
        } catch (e) {}
        return fallback != null ? fallback : key;
    }

    function syncLanguageSelect() {
        var sel = document.getElementById("settingsLanguageSelect");
        if (!sel || !window.i18n || typeof window.i18n.getLang !== "function") return;
        var lang = window.i18n.getLang();
        sel.value = lang === "vi" ? "vi" : "en";
    }

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
                        renderFeedback("success", result.json.message || T("set.msg_profile_saved", "Changes saved."));
                    } else {
                        renderFeedback("error", (result.json && result.json.error) || T("set.msg_profile_error", "Could not save changes."));
                    }
                })
                .catch(function () {
                    renderFeedback("error", T("set.msg_network", "Cannot reach the server. Please try again."));
                });
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var payload = formToJson(passwordForm);

            if (payload.NewPassword && payload.NewPassword !== payload.ConfirmPassword) {
                renderFeedback("error", T("set.msg_pw_mismatch", "Password confirmation does not match."));
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
                        renderFeedback("success", result.json.message || T("set.msg_pw_saved", "Password updated."));
                        passwordForm.reset();
                    } else {
                        renderFeedback("error", (result.json && result.json.error) || T("set.msg_pw_error", "Could not change password."));
                    }
                })
                .catch(function () {
                    renderFeedback("error", T("set.msg_network", "Cannot reach the server. Please try again."));
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
        syncLanguageSelect();
        preferencesForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var payload = formToJson(preferencesForm);
            try {
                localStorage.setItem(PREF_KEY, JSON.stringify(payload));
                if (window.i18n && typeof window.i18n.setLang === "function" && payload.language) {
                    window.i18n.setLang(payload.language === "vi" ? "vi" : "en");
                }
                renderFeedback("success", T("set.msg_pref_saved", "Preferences saved on this device."));
            } catch (err) {
                renderFeedback("error", T("set.msg_pref_storage_error", "Could not save to this device."));
            }
        });

        var langSel = document.getElementById("settingsLanguageSelect");
        if (langSel) {
            langSel.addEventListener("change", function () {
                if (window.i18n && typeof window.i18n.setLang === "function") {
                    window.i18n.setLang(langSel.value === "vi" ? "vi" : "en");
                }
            });
        }
    }

    document.addEventListener("classes369:langchange", function () {
        syncLanguageSelect();
        if (window.i18n && typeof window.i18n.apply === "function") {
            window.i18n.apply(document);
        }
    });

    if (sessionAgent) {
        sessionAgent.textContent = navigator.userAgent || T("set.msg_ua_unknown", "Unknown");
    }
})();
