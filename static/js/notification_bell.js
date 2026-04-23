/* Topbar notification bell: unread count from /api/notifications/my/unread (Admin + Teacher, base.html). */
(function () {
    function sync() {
        var bell = document.getElementById("topbarNotifBell");
        var badge = document.getElementById("topbarNotifBellBadge");
        if (!bell || !badge) {
            return;
        }
        fetch("/api/notifications/my/unread", { credentials: "same-origin" })
            .then(function (r) {
                return r.json();
            })
            .then(function (j) {
                if (!j.success || !Array.isArray(j.data)) {
                    return;
                }
                var n = j.data.length;
                if (n > 0) {
                    badge.textContent = n > 99 ? "99+" : String(n);
                    badge.hidden = false;
                } else {
                    badge.textContent = "0";
                    badge.hidden = true;
                }
            })
            .catch(function () { /* network / not logged in */ });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", sync);
    } else {
        sync();
    }
    // Periodic refresh (open tabs stay in sync)
    setInterval(sync, 5 * 60 * 1000);
})();
