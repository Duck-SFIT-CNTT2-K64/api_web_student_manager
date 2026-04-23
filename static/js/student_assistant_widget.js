(function () {
  function nowHHMM() {
    var d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  var trigger = document.getElementById("saTrigger");
  var backdrop = document.getElementById("saBackdrop");
  var widget = document.getElementById("saWidget");
  if (!trigger || !backdrop || !widget) return;

  var statusEl = document.getElementById("saStatus");
  var bodyEl = document.getElementById("saBody");
  var inputEl = document.getElementById("saInput");
  var sendBtn = document.getElementById("saSend");
  var closeBtn = document.getElementById("saClose");
  var quickWrap = document.getElementById("saQuickWrap");

  var history = [];
  var sending = false;

  function setStatus(s) {
    if (!statusEl) return;
    statusEl.textContent = s;
    statusEl.classList.remove("ok", "typing", "bad");
    if (s === "Online") statusEl.classList.add("ok");
    else if (s === "Typing…") statusEl.classList.add("typing");
    else statusEl.classList.add("bad");
  }

  function open() {
    widget.classList.add("is-open");
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(function () { inputEl && inputEl.focus(); }, 0);
  }

  function close() {
    widget.classList.remove("is-open");
    backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  function addMessage(role, text) {
    var row = document.createElement("div");
    row.className = "sa-row " + (role === "user" ? "right" : "left");

    var bubble = document.createElement("div");
    bubble.className = "sa-bubble " + (role === "user" ? "user" : "bot");

    var msg = document.createElement("div");
    msg.textContent = text;
    msg.style.whiteSpace = "pre-wrap";
    msg.style.lineHeight = "1.55";
    msg.style.fontSize = ".92rem";

    var time = document.createElement("div");
    time.className = "sa-time";
    time.textContent = nowHHMM();

    bubble.appendChild(msg);
    bubble.appendChild(time);
    row.appendChild(bubble);
    bodyEl.appendChild(row);

    bodyEl.scrollTop = bodyEl.scrollHeight;

    history.push({ role: role, text: text });
    if (history.length > 20) history = history.slice(-20);
  }

  function canSend() {
    return !sending && inputEl && inputEl.value.trim().length > 0;
  }

  function syncSendState() {
    if (!sendBtn) return;
    sendBtn.disabled = !canSend();
  }

  async function send(rawText) {
    if (!canSend()) return;
    var text = String(rawText != null ? rawText : inputEl.value).trim();
    if (!text) return;
    if (inputEl) inputEl.value = "";
    syncSendState();

    addMessage("user", text);
    sending = true;
    setStatus("Typing…");
    sendBtn.disabled = true;

    try {
      var resp = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          message: text,
          history: history.slice(-12),
        }),
      });
      var json = await resp.json();
      if (!resp.ok || json.success === false) {
        var msg = (json && (json.error || json.message)) || ("HTTP " + resp.status);
        if (json && json.details) msg += "\n" + String(json.details);
        throw new Error(msg);
      }
      addMessage("assistant", (json.reply || "Mình chưa trả lời được lúc này."));
      setStatus("Online");
    } catch (e) {
      // Best-effort: show error message to help diagnose quota/billing.
      addMessage("assistant", "Lỗi kết nối AI: " + String(e && e.message ? e.message : e));
      setStatus("Offline");
    } finally {
      sending = false;
      syncSendState();
      setTimeout(function () { setStatus("Online"); }, 1200);
    }
  }

  trigger.addEventListener("click", open);
  backdrop.addEventListener("mousedown", close);
  if (closeBtn) closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", function (e) {
    if (!widget.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
  });

  if (inputEl) {
    inputEl.addEventListener("input", syncSendState);
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  if (sendBtn) sendBtn.addEventListener("click", send);

  function wireQuickButtons() {
    if (!quickWrap) return;
    quickWrap.addEventListener("click", function (e) {
      var btn = e.target && (e.target.closest ? e.target.closest("[data-quick]") : null);
      if (!btn) return;
      var q = btn.getAttribute("data-quick") || "";
      if (q) send(q);
    });
  }

  setStatus("Online");
  addMessage("assistant", "Chào bạn! Mình là Trợ lý sinh viên. Bạn có thể hỏi: lịch học hôm nay, công nợ học phí, điểm theo môn, hoặc hồ sơ.");
  wireQuickButtons();
  syncSendState();
})();

