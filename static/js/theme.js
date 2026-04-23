/* ============================================================
   CLASSES369 — Global theme (light / dark) controller
   - Lưu preference vào localStorage ('classes369_theme')
   - Apply attribute data-theme="light|dark" trên <html>
   - Tự sync nếu user chưa chọn gì → theo prefers-color-scheme
   - Expose window.toggleTheme() cho các nút bấm
   ============================================================ */
(function () {
    var STORAGE_KEY = 'classes369_theme';
    var DARK = 'dark';
    var LIGHT = 'light';
    var ATTR = 'data-theme';

    function getSystemPreference() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
        } catch (e) {
            return LIGHT;
        }
    }

    function getStoredTheme() {
        try {
            var value = localStorage.getItem(STORAGE_KEY);
            return value === DARK || value === LIGHT ? value : null;
        } catch (e) {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) { /* ignore quota errors */ }
    }

    function applyTheme(theme) {
        var normalized = theme === DARK ? DARK : LIGHT;
        document.documentElement.setAttribute(ATTR, normalized);
        document.documentElement.style.colorScheme = normalized;
        updateToggleButtons(normalized);
        window.dispatchEvent(new CustomEvent('classes369:themechange', { detail: { theme: normalized } }));
    }

    function tTheme(isDark) {
        if (window.i18n && typeof window.i18n.t === 'function') {
            return isDark ? window.i18n.t('theme.to_light') : window.i18n.t('theme.to_dark');
        }
        return isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }

    function updateToggleButtons(theme) {
        var isDark = theme === DARK;
        var titleText = tTheme(isDark);
        var nl = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < nl.length; i++) {
            var btn = nl[i];
            btn.setAttribute('aria-pressed', String(isDark));
            btn.setAttribute('title', titleText);
            btn.setAttribute('aria-label', titleText);
            var icon = btn.querySelector('[data-theme-icon]');
            if (icon) {
                icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            }
            var label = btn.querySelector('[data-theme-label]');
            if (label) {
                if (window.i18n && window.i18n.t) {
                    label.textContent = isDark ? window.i18n.t('theme.label_light') : window.i18n.t('theme.label_dark');
                } else {
                    label.textContent = isDark ? 'Light mode' : 'Dark mode';
                }
            }
        }
        var cbs = document.querySelectorAll('[data-theme-toggle-checkbox]');
        for (var j = 0; j < cbs.length; j++) {
            var cb = cbs[j];
            if (cb.checked !== isDark) cb.checked = isDark;
        }
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute(ATTR) === DARK ? DARK : LIGHT;
        var next = current === DARK ? LIGHT : DARK;
        saveTheme(next);
        applyTheme(next);
        return next;
    }

    function init() {
        var stored = getStoredTheme();
        var initial = stored || getSystemPreference();
        applyTheme(initial);

        document.addEventListener('click', function (ev) {
            var trigger = ev.target && ev.target.closest && ev.target.closest('[data-theme-toggle]');
            if (!trigger) return;
            ev.preventDefault();
            toggleTheme();
        });

        document.addEventListener('change', function (ev) {
            var cb = ev.target && ev.target.matches && ev.target.matches('[data-theme-toggle-checkbox]') ? ev.target : null;
            if (!cb) return;
            var next = cb.checked ? DARK : LIGHT;
            saveTheme(next);
            applyTheme(next);
        });

        if (window.matchMedia) {
            try {
                var mq = window.matchMedia('(prefers-color-scheme: dark)');
                var onChange = function () {
                    if (!getStoredTheme()) applyTheme(getSystemPreference());
                };
                if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
                else if (typeof mq.addListener === 'function') mq.addListener(onChange);
            } catch (e) { /* ignore */ }
        }

        window.addEventListener('classes369:langchange', function () {
            var current = document.documentElement.getAttribute(ATTR) === DARK ? DARK : LIGHT;
            updateToggleButtons(current === DARK);
        });
    }

    window.toggleTheme = toggleTheme;
    window.applyTheme = applyTheme;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
