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
