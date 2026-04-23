(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var modal = $("loginNotifModal");
  if (!modal) return;

  var backdropCloses = modal.querySelectorAll("[data-login-notif-close]");
  var btnRead = $("loginNotifReadBtn");

  var elTitle = $("loginNotifTitle");
  var elContent = $("loginNotifContent");
  var elCreator = $("loginNotifCreator");
  var elCreatorRole = $("loginNotifCreatorRole");
  var elDate = $("loginNotifDate");

  var queue = [];
  var showing = null;
  var cancelled = false;

  function normalizeRole(roleName) {
    return String(roleName || "").trim().toLowerCase();
  }

  function rolePriority(roleName) {
    var r = normalizeRole(roleName);
    if (r === "admin") return 0;
    if (r === "teacher") return 1;
    return 2;
  }

  function formatDate(dt) {
    try {
      var d = new Date(dt);
      if (Number.isNaN(d.getTime())) return String(dt || "—");
      return d.toLocaleString();
    } catch (e) {
      return String(dt || "—");
    }
  }

  function openModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function fillNotification(n) {
    if (elTitle) elTitle.textContent = n.Title || "—";
    if (elContent) elContent.textContent = n.Content || "—";
    if (elCreator) elCreator.textContent = n.CreatorName || "—";
    if (elCreatorRole) elCreatorRole.textContent = n.CreatorRoleName || "—";
    if (elDate) elDate.textContent = formatDate(n.CreatedDate);
  }

  function showNext() {
    if (cancelled) return;
    if (!queue.length) {
      showing = null;
      closeModal();
      return;
    }
    showing = queue.shift();
    fillNotification(showing);
    if (btnRead) {
      btnRead.disabled = false;
      btnRead.innerHTML = '<i class="fas fa-check"></i> Đã đọc';
    }
    openModal();
  }

  function fetchUnread() {
    return fetch("/api/notifications/my/unread", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("Failed to load notifications");
        return r.json();
      })
      .then(function (json) {
        var list = (json && json.data) || [];
        if (!Array.isArray(list)) list = [];
        list.sort(function (a, b) {
          var pa = rolePriority(a.CreatorRoleName);
          var pb = rolePriority(b.CreatorRoleName);
          if (pa !== pb) return pa - pb;
          var da = new Date(a.CreatedDate).getTime() || 0;
          var db = new Date(b.CreatedDate).getTime() || 0;
          return db - da;
        });
        queue = list;
      });
  }

  function syncBadges() {
    return fetch("/api/notifications/my/unread", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        if (!json || !json.success || !Array.isArray(json.data)) return;
        var n = json.data.length;

        var topbarBadge = document.getElementById("topbarNotifBellBadge");
        if (topbarBadge) {
          if (n > 0) {
            topbarBadge.textContent = n > 99 ? "99+" : String(n);
            topbarBadge.hidden = false;
          } else {
            topbarBadge.textContent = "0";
            topbarBadge.hidden = true;
          }
        }

        var studentBadge = document.getElementById("studentNotifBellBadge");
        if (studentBadge) {
          if (n > 0) {
            studentBadge.textContent = n > 99 ? "99+" : String(n);
            studentBadge.hidden = false;
          } else {
            studentBadge.textContent = "0";
            studentBadge.hidden = true;
          }
        }
      })
      .catch(function () { /* ignore */ });
  }

  function markRead(notificationId) {
    return fetch("/api/notifications/" + notificationId + "/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({}),
    }).then(function (r) {
      if (!r.ok) throw new Error("Failed to mark as read");
      return r.json().catch(function () { return {}; });
    });
  }

  function onClose() {
    cancelled = true;
    closeModal();
  }

  backdropCloses.forEach(function (el) {
    el.addEventListener("click", onClose);
  });

  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") onClose();
  });

  if (btnRead) {
    btnRead.addEventListener("click", function () {
      if (!showing || !showing.NotificationId) return;
      var id = showing.NotificationId;
      btnRead.disabled = true;
      btnRead.innerHTML = '<i class="fas fa-check"></i> Đã đọc';
      markRead(id)
        .then(function () {
          syncBadges();
          showNext();
        })
        .catch(function () {
          btnRead.disabled = false;
        });
    });
  }

  fetchUnread()
    .then(function () {
      if (!queue.length) return;
      showNext();
    })
    .catch(function () {
      /* ignore */
    });
})();

