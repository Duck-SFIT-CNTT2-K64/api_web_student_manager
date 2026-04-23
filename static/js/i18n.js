/* ============================================================
   CLASSES369 — Global language (vi / en) controller
   - Lưu preference vào localStorage ('classes369_lang')
   - Apply i18n by scanning DOM attributes:
       data-i18n="key"                -> textContent
       data-i18n-html="key"           -> innerHTML (use sparingly)
       data-i18n-attr="placeholder" + data-i18n="key" -> set attribute
       data-i18n-attrs="title,aria-label" + data-i18n-title="key" etc.
   - Expose:
       window.i18n.t(key, vars?)
       window.i18n.setLang('vi'|'en')
       window.i18n.apply()
   ============================================================ */
(function () {
  var STORAGE_KEY = "classes369_lang";
  var LANG_VI = "vi";
  var LANG_EN = "en";

  /** Chạy an toàn trên môi trường không có NodeList#forEach (một số WebView cũ). */
  function eachNode(nl, fn) {
    if (!nl || !fn) return;
    if (typeof nl.forEach === "function") {
      nl.forEach(fn);
    } else {
      for (var i = 0; i < (nl.length || 0); i++) fn(nl[i], i);
    }
  }

  /** Từ điền đầy đủ: static/js/i18n-locales.js (phải load trước file này). */
  function mergeFlat(base, extra) {
    var out = {};
    var k;
    for (k in base) out[k] = base[k];
    if (extra) for (k in extra) out[k] = extra[k];
    return out;
  }
  var FALLBACK = {
    en: { "common.ok": "OK", "common.cancel": "Cancel", "common.toggle_language": "Switch language" },
    vi: { "common.ok": "OK", "common.cancel": "Hủy", "common.toggle_language": "Chuyển ngôn ngữ" },
  };
  var EXT = typeof window !== "undefined" && window.__CLASSES369_I18N ? window.__CLASSES369_I18N : null;
  var DICT = {
    en: mergeFlat(FALLBACK.en, EXT && EXT.en ? EXT.en : null),
    vi: mergeFlat(FALLBACK.vi, EXT && EXT.vi ? EXT.vi : null),
  };

  function detectLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === LANG_VI || stored === LANG_EN) return stored;
    } catch (e) {}

    try {
      var nav = (navigator.language || "").toLowerCase();
      if (nav.startsWith("vi")) return LANG_VI;
    } catch (e) {}
    return LANG_EN;
  }

  function getLang() {
    var v = document.documentElement.getAttribute("data-lang");
    if (v === LANG_VI || v === LANG_EN) return v;
    return detectLang();
  }

  function setLang(lang) {
    var next = lang === LANG_VI ? LANG_VI : LANG_EN;
    document.documentElement.setAttribute("data-lang", next);
    try {
      document.documentElement.setAttribute("lang", next);
    } catch (e) {}
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    updateLangToggle(next);
    apply();
    window.dispatchEvent(new CustomEvent("classes369:langchange", { detail: { lang: next } }));
    return next;
  }

  function format(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{\{(\w+)\}\}/g, function (_, k) {
      return vars[k] == null ? "" : String(vars[k]);
    });
  }

  function t(key, vars) {
    var lang = getLang();
    var table = DICT[lang] || {};
    var fallback = (DICT.en || {})[key];
    var value = table[key] != null ? table[key] : (fallback != null ? fallback : key);
    return format(value, vars);
  }

  function applyOne(el) {
    if (!el) return;
    var key = el.getAttribute("data-i18n");
    if (key) {
      var attr = el.getAttribute("data-i18n-attr");
      if (attr) {
        el.setAttribute(attr, t(key));
      } else if (el.hasAttribute("data-i18n-html")) {
        el.innerHTML = t(key);
      } else {
        el.textContent = t(key);
      }
    }

    var attrs = el.getAttribute("data-i18n-attrs");
    if (attrs) {
      var parts = attrs.split(",");
      for (var ai = 0; ai < parts.length; ai++) {
        var a = (parts[ai] || "").trim();
        if (!a) continue;
        var k = el.getAttribute("data-i18n-" + a);
        if (k) el.setAttribute(a, t(k));
      }
    }
  }

  function apply(root) {
    var scope = root || document;
    eachNode(scope.querySelectorAll("[data-i18n], [data-i18n-attrs]"), applyOne);
    updateLangToggle(getLang());
  }

  function updateLangToggle(lang) {
    eachNode(document.querySelectorAll("[data-lang-toggle]"), function (btn) {
      btn.setAttribute("aria-pressed", String(lang === LANG_VI));
      btn.setAttribute("title", t("common.toggle_language"));
      btn.setAttribute("aria-label", t("common.toggle_language"));
      var label = btn.querySelector("[data-lang-label]");
      if (label) label.textContent = lang === LANG_VI ? "VI" : "EN";
    });
  }

  function onLangButtonClick(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    setLang(getLang() === LANG_VI ? LANG_EN : LANG_VI);
  }

  function bind() {
    eachNode(document.querySelectorAll("[data-lang-toggle]"), function (btn) {
      if (btn.getAttribute("data-i18n-lang-bound") === "1") return;
      btn.setAttribute("data-i18n-lang-bound", "1");
      btn.addEventListener("click", onLangButtonClick);
    });
  }

  function init() {
    rebuildDict();
    try {
      setLang(detectLang());
    } catch (err) {
      try {
        var fallback = detectLang();
        document.documentElement.setAttribute("data-lang", fallback);
        document.documentElement.setAttribute("lang", fallback);
      } catch (e) {}
      if (window.console && console.error) console.error("i18n init:", err);
    }
    bind();
  }

  function rebuildDict() {
    var ext = typeof window !== "undefined" && window.__CLASSES369_I18N ? window.__CLASSES369_I18N : null;
    DICT.en = mergeFlat(FALLBACK.en, ext && ext.en ? ext.en : null);
    DICT.vi = mergeFlat(FALLBACK.vi, ext && ext.vi ? ext.vi : null);
  }

  window.i18n = { t: t, getLang: getLang, setLang: setLang, apply: apply, bindLangToggles: bind, rebuildDict: rebuildDict, DICT: DICT };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

