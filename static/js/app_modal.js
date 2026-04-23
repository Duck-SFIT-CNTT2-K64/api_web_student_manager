(function () {
  function esc(v) {
    return String(v == null ? "" : v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureModalEl() {
    var el = document.getElementById("appModal");
    if (el) return el;

    el = document.createElement("div");
    el.className = "app-modal";
    el.id = "appModal";
    el.hidden = true;

    el.innerHTML =
      '<div class="app-modal-backdrop" data-app-modal-close></div>' +
      '<div class="app-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="appModalTitle" aria-describedby="appModalDesc">' +
      '  <header class="app-modal-head">' +
      '    <div>' +
      '      <p class="app-modal-kicker" id="appModalKicker">Confirmation</p>' +
      '      <h3 class="app-modal-title" id="appModalTitle">—</h3>' +
      '      <p class="app-modal-sub" id="appModalDesc">—</p>' +
      "    </div>" +
      '    <button type="button" class="app-modal-close" data-app-modal-close aria-label="Close"><i class="fas fa-xmark"></i></button>' +
      "  </header>" +
      '  <div class="app-modal-body" id="appModalBody"></div>' +
      '  <footer class="app-modal-foot" id="appModalFoot"></footer>' +
      "</div>";

    document.body.appendChild(el);
    return el;
  }

  function showModal(opts) {
    opts = opts || {};
    var modal = ensureModalEl();

    var kicker = document.getElementById("appModalKicker");
    var title = document.getElementById("appModalTitle");
    var desc = document.getElementById("appModalDesc");
    var body = document.getElementById("appModalBody");
    var foot = document.getElementById("appModalFoot");

    var t = window.i18n && typeof window.i18n.t === "function" ? window.i18n.t : function (k) { return k; };
    if (kicker) kicker.textContent = opts.kicker || (opts.mode === "alert" ? t("common.close") : t("common.confirm"));
    if (title) title.textContent = opts.title || (opts.mode === "alert" ? "Message" : "Confirm action");
    if (desc) desc.textContent = opts.desc || (opts.mode === "alert" ? "Please review the message below." : "Review the details below before continuing.");

    // Body
    if (body) {
      if (opts.html) {
        body.innerHTML = String(opts.html);
      } else if (opts.details && Array.isArray(opts.details) && opts.details.length) {
        var grid = opts.details
          .map(function (row) {
            return (
              '<div class="app-modal-confirm-row">' +
              "<span>" + esc(row.label) + "</span>" +
              "<strong>" + esc(row.value) + "</strong>" +
              "</div>"
            );
          })
          .join("");
        body.innerHTML =
          '<div class="app-modal-confirm-card"><div class="app-modal-confirm-grid">' +
          grid +
          "</div></div>";
      } else {
        body.innerHTML = '<p class="app-modal-msg">' + esc(opts.message || "—") + "</p>";
      }
    }

    // Footer buttons
    foot.innerHTML = "";
    var okText = opts.okText || (opts.mode === "alert" ? t("common.ok") : t("common.confirm"));
    var cancelText = opts.cancelText || t("common.cancel");
    var okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btn-primary";
    okBtn.innerHTML = (opts.okIconHtml || '<i class="fas fa-check"></i>') + " " + esc(okText);

    var cancelBtn = null;
    if (opts.mode !== "alert") {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-outline";
      cancelBtn.textContent = cancelText;
      foot.appendChild(cancelBtn);
    }
    foot.appendChild(okBtn);

    // Focus management
    var previousActive = document.activeElement;
    var closeEls = modal.querySelectorAll("[data-app-modal-close]");

    return new Promise(function (resolve) {
      var done = false;
      function cleanup(result) {
        if (done) return;
        done = true;
        modal.hidden = true;
        document.removeEventListener("keydown", onKeyDown);
        okBtn.removeEventListener("click", onOk);
        if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
        closeEls.forEach(function (el) {
          el.removeEventListener("click", onCancel);
        });
        if (previousActive && previousActive.focus) {
          try {
            previousActive.focus();
          } catch (e) {}
        }
        resolve(result);
      }

      function onOk() {
        cleanup(true);
      }
      function onCancel() {
        cleanup(false);
      }
      function onKeyDown(ev) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          cleanup(false);
        }
        if (ev.key === "Enter" && opts.mode === "alert") {
          ev.preventDefault();
          cleanup(true);
        }
      }

      document.addEventListener("keydown", onKeyDown);
      okBtn.addEventListener("click", onOk);
      if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
      closeEls.forEach(function (el) {
        el.addEventListener("click", onCancel);
      });

      modal.hidden = false;
      setTimeout(function () {
        try {
          okBtn.focus();
        } catch (e) {}
      }, 0);
    });
  }

  window.AppModal = {
    confirm: function (opts) {
      return showModal(Object.assign({ mode: "confirm" }, opts || {}));
    },
    alert: function (optsOrMessage) {
      if (typeof optsOrMessage === "string") {
        return showModal({ mode: "alert", message: optsOrMessage });
      }
      return showModal(Object.assign({ mode: "alert" }, optsOrMessage || {}));
    },
  };
})();

