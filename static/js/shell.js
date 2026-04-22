document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var toggle = document.getElementById('sidebarToggle');

    if (toggle) {
        toggle.addEventListener('click', function () {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    var currentPath = window.location.pathname;
    var navItems = document.querySelectorAll('.sidebar-nav .nav-item');

    navItems.forEach(function (item) {
        var href = item.getAttribute('href');
        if (!href) return;
        if (href === currentPath) {
            item.classList.add('active');
        } else if (href.startsWith('/') && href.indexOf('#') === -1 && currentPath.startsWith(href) && href !== '/') {
            item.classList.add('active');
        }
    });

    /* ──────────────────────────────────────────────────────────
       Collapsible nav groups (admin sidebar)
       - Bấm .nav-group-header → toggle class `open` trên .nav-group
       - State mỗi group lưu vào localStorage theo data-group
       - Nhóm chứa item active sẽ luôn tự mở khi load page
       ────────────────────────────────────────────────────────── */
    var NAV_STATE_KEY = 'adminNavGroupState_v1';

    function loadNavGroupState() {
        try {
            return JSON.parse(localStorage.getItem(NAV_STATE_KEY) || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function saveNavGroupState(state) {
        try {
            localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
        } catch (e) { /* storage không khả dụng, bỏ qua */ }
    }

    var navGroups = document.querySelectorAll('.sidebar-nav .nav-group');
    if (navGroups.length) {
        var storedState = loadNavGroupState();

        navGroups.forEach(function (group) {
            var key = group.getAttribute('data-group') || '';
            var header = group.querySelector('.nav-group-header');
            var hasActive = !!group.querySelector('.nav-item.active');

            // Ưu tiên: có item active → luôn mở.
            // Ngược lại: dùng state đã lưu, fallback sang render ban đầu (class `open` từ Jinja).
            if (hasActive) {
                group.classList.add('open');
            } else if (key && Object.prototype.hasOwnProperty.call(storedState, key)) {
                group.classList.toggle('open', !!storedState[key]);
            }

            if (header) {
                header.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    group.classList.toggle('open');
                    if (key) {
                        var next = loadNavGroupState();
                        next[key] = group.classList.contains('open');
                        saveNavGroupState(next);
                    }
                });
            }
        });
    }

    window.addEventListener('resize', function () {
        if (window.innerWidth > 1024 && sidebar) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        }
    });

    document.querySelectorAll('.alert-dismiss').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var alert = this.closest('.alert');
            if (alert) alert.remove();
        });
    });
});
