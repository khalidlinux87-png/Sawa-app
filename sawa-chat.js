/* ============================================================
   sawa-chat.js — المحادثات والحضور وجهات الاتّصال (خطّة CHAT.md)
   ------------------------------------------------------------
   C1: جهات الاتّصال الحقيقيّة (أعضاء عائلاتي + من أضفتهم برابطٍ شخصيّ)،
       والحضور «متّصل الآن / آخر ظهور» عبر Realtime Database.
   يعتمد على: firebase (compat: app/auth/database) · SawaSync (call/toast/onReady).
   الكتابة الدائمة عبر الـWorker؛ الحضور يكتبه الجهاز مباشرةً في status/{uid}
   (القواعد: صاحبه يكتب، ومن في acl/{uid} يقرأ — الـWorker يكتب acl).
   ⛔ لا تستعمل هنا اسماً عامّاً قد تعرّفه sawa-app (Image, Link, Phone…) — انظر BUILD.md.
   ============================================================ */
// P2: العنوان الرسميّ لسوا = www.sawaaap.com — من يفتح عنواناً قديماً أو بديلاً يُحوَّل فوراً مع الرابط نفسه (?code= ?room= …)
//     (Netlify القديم · sawaap.pages.dev · sawaaap.com بلا www). نسخ المعاينة ‎*.sawaap.pages.dev‎ والتجربة المحلّيّة لا تُحوَّل.
(function () {
  try {
    var h = location.hostname;
    if (/\.netlify\.app$/i.test(h) || /^sawaap\.pages\.dev$/i.test(h) || /^sawaaap\.com$/i.test(h)) {
      location.replace("https://www.sawaaap.com" + location.pathname + location.search + location.hash);
    }
  } catch (e) {}
})();
(function (global) {
  "use strict";
  var VERSION = "c107";
  var state = { uid: null, me: null, people: [], presence: {}, loaded: false, loading: false, error: null };
  var app = null, waiters = [], presenceRefs = {}, myStatusRef = null, connRef = null, authUnsub = null;

  function isAr() { try { return (localStorage.getItem("sawaLang") || "ar") === "ar"; } catch (e) { return true; } }
  function L(ar, en) { return isAr() ? ar : en; }
  function S() { return global.SawaSync; }
  function toast(m) { try { S().toast(m); } catch (e) {} }
  function call(op, payload) { return S().call(op, payload || {}); }
  function log() { try { console.log.apply(console, ["[sawa-chat]"].concat([].slice.call(arguments))); } catch (e) {} }
  function db() { try { return global.firebase && firebase.database ? firebase.database() : null; } catch (e) { return null; } }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  // C13c: حسابي يظهر فوراً من آخر نسخةٍ محفوظة — قبل أن تجهز هويّة Firebase وردّ الخادم (كانت «حسابي» تعرض
  //       «مستخدم سوا +249 9X…» ثوانيَ فتبدو نسخةً قديمة). onUid يتحقّق من الهويّة ويمسحها إن اختلفت.
  (function () { var c = lsGet("sawa_people_cache", null); if (c && c.uid && c.me) { state.me = c.me; state.people = c.people || []; state.cachedUid = c.uid; } })();
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // C39: تثبيت التطبيق على الشاشة الرئيسيّة — نلتقط beforeinstallprompt (Chrome/Edge/Samsung على أندرويد) ونحتفظ به لزرّ «تثبيت»
  var instPrompt = null;
  try {
    global.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); instPrompt = e; try { global.dispatchEvent(new CustomEvent("sawa-install-state")); } catch (x) {} });
    global.addEventListener("appinstalled", function () { instPrompt = null; lsSet("sawa_installed", Date.now()); try { global.dispatchEvent(new CustomEvent("sawa-install-state")); } catch (x) {} });
  } catch (e) {}
  // C72: داخل تطبيق أندرويد الأصليّ (WebView + SawaNativeBridge) — الإشعارات عبر FCM الأصليّ لا Web Push
  function NB() { try { return global.SawaNativeBridge || null; } catch (e) { return null; } }
  // C123: تطبيق iOS الأصليّ — جسر window.SawaIOS (منفصل عن أندرويد)
  function IOSB() { try { return global.SawaIOS || null; } catch (e) { return null; } }
  // زرّ «المتابعة باستخدام Apple» بمواصفات Apple (أسود، شعار Apple، بحجم زرّ Google نفسه أو أكبر)
  function appleBtn(round) {
    var b = mk("button", "display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;min-height:50px;padding:12px 16px;border:0;border-radius:" + (round ? "999px" : "12px") + ";background:#000;color:#fff;font:600 17px -apple-system,system-ui;cursor:pointer;margin-bottom:10px");
    b.type = "button";
    var lg = mk("span", "font-size:20px;line-height:1;margin-top:-3px", "\uF8FF");
    b.appendChild(lg); b.appendChild(mk("span", "", L("المتابعة باستخدام Apple", "Continue with Apple")));
    b.onclick = function () {
      if (!S() || !S().linkApple) { toast(L("جارٍ تحميل التطبيق… حاول بعد لحظة", "Still loading… try again")); return; }
      try { Promise.resolve(S().linkApple()).catch(function () {}); } catch (e) {}
    };
    return b;
  }
  function iosNoGoogle() { var b = IOSB(); return !!(b && !b.hasGoogle); }
  // C84: WebView في تطبيق أندرويد لا يعرف navigator.share ⇒ نوصله بقائمة المشاركة الأصليّة (واتساب، تيليجرام…)
  try {
    if (NB() && NB().share && global.navigator && !global.navigator.share) {
      global.navigator.share = function (d) {
        d = d || {};
        var parts = [d.text, d.url].filter(function (x) { return x; });
        if (d.url && d.text && String(d.text).indexOf(d.url) >= 0) parts = [d.text];
        if (!parts.length) return Promise.reject(new TypeError("nothing to share"));
        try { NB().share(d.title || "سوا", parts.join("\n")); return Promise.resolve(); } catch (e) { return Promise.reject(e); }
      };
    }
  } catch (e) {}
  // C73: نداءٌ للجسر الأصليّ ينتظر ردّه عبر __sawaNativeCb (السجلّ مشترك مع sawa-sync)
  function nativeAsk(method, args, ms) {
    return new Promise(function (res) {
      var c = global.__sawaNatCbs = global.__sawaNatCbs || {};
      if (!global.__sawaNativeCb) global.__sawaNativeCb = function (id, r) { var f = c[id]; delete c[id]; if (f) f(r || {}); };
      var id = method + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      var to = setTimeout(function () { delete c[id]; res({ ok: false, error: "timeout" }); }, ms || 120000);
      c[id] = function (r) { clearTimeout(to); res(r || {}); };
      try { var b = NB(), a = args || []; if (a.length === 0) b[method](id); else if (a.length === 1) b[method](a[0], id); else b[method](a[0], a[1], id); } catch (e) { clearTimeout(to); delete c[id]; res({ ok: false, error: String(e) }); }
    });
  }
  function swDispatch(msg) {   // يمرّر رسالةً كأنّها من عامل الخدمة (المستمعون نفسهم في sawa-chat و sawa-rtc)
    try { if (global.navigator && navigator.serviceWorker && navigator.serviceWorker.dispatchEvent) { navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: msg })); return true; } } catch (e) {}
    return false;
  }
  global.__sawaNativePush = function (j) { try { var d = typeof j === "string" ? JSON.parse(j) : j; if (d) swDispatch({ type: "sawa-push", data: d }); } catch (e) {} };
  // رابطٌ وصل التطبيقَ وهو مفتوح (نقر إشعار/ردّ على مكالمة/رابط سوا) ⇒ نعالجه في مكانه بلا إعادة تحميل
  global.__sawaNativeOpen = function (url) {
    try {
      var u = new URL(url, global.location.href), p = u.searchParams, d = null;
      if (p.get("call")) d = { t: "call", call: p.get("call"), answer: p.get("answer") === "1" ? 1 : 0 };
      else if (p.get("room")) d = { room: p.get("room") };
      else if (p.get("chat")) d = { cid: p.get("chat") };
      else if (p.get("requests")) d = { t: "req" };
      else if (p.get("famreq")) d = { t: "famreq" };   // C107
      else if (p.get("moment")) d = { t: "moment", pid: p.get("moment"), cm: p.get("cm") || "" };   // C135
      else if (p.get("join") && global.SawaSync && global.SawaSync.join) return global.SawaSync.join(p.get("join"), p.get("p"), p.get("pn"));   // C114: في مكانه — لا تسقط مكالمة جارية
      else if (p.get("contact") || p.get("join")) return false;   // دعوة: تحميلٌ كامل يعالجها
      // C88: رمز QR مُسح بكاميرا الهاتف والتطبيق مفتوح ⇒ كان «يُعالَج» ولا يحدث شيء
      else if (p.get("code")) { var cd = codeDigits(p.get("code")); if (cd.length === 10) { whenReady(function () { findSheet(cd); }); return true; } return false; }
      else if (p.get("group")) { var gt = p.get("group"); whenReady(function () { linkConfirm("group", gt); }); return true; }
      else if (u.search && u.search !== "?") return false;   // معاملٌ لا نعرفه هنا ⇒ تحميلٌ كامل
      if (d) return swDispatch({ type: "sawa-open", data: d });
      return true;
    } catch (e) { return false; }
  };
  var natTokWait = [];
  global.__sawaNativeToken = function (tok) {
    var w = natTokWait; natTokWait = []; w.forEach(function (f) { try { f(tok); } catch (e) {} });
    // رمزٌ جديد من أندرويد (تجديد) ⇒ تسجيلٌ فوريّ
    try { if (tok && state.uid && pushState() === "granted") registerToken(tok).catch(function () {}); } catch (e) {}
  };
  var natPermWait = [];
  global.__sawaNativePerm = function (st) { var w = natPermWait; natPermWait = []; w.forEach(function (f) { try { f(st); } catch (e) {} }); emitPush(); };
  function isStandalone() {
    if (NB() || IOSB()) return true;
    try { if (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) {}
    try { if (global.navigator.standalone === true) return true; } catch (e) {}
    try { if (String(document.referrer || "").indexOf("android-app://") === 0) return true; } catch (e) {}
    return false;
  }
  // installed · ios-safari · ios-other · android-prompt · android-manual · desktop
  function installState() {
    if (isStandalone()) return "installed";
    var ua = ""; try { ua = navigator.userAgent || ""; } catch (e) {}
    var ios = /iPhone|iPad|iPod/.test(ua); try { if (!ios && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ios = true; } catch (e) {}
    if (ios) return (/Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA/.test(ua)) ? "ios-safari" : "ios-other";
    if (!/Android/.test(ua)) return "desktop";
    return instPrompt ? "android-prompt" : "android-manual";
  }
  function installable() { var st = installState(); return st !== "installed" && st !== "desktop"; }
  function installNow() {   // أندرويد مع prompt: يفتح مربّع التثبيت الأصليّ
    var e = instPrompt; if (!e) return Promise.resolve("none");
    try { e.prompt(); } catch (x) { return Promise.resolve("none"); }
    return (e.userChoice || Promise.resolve({ outcome: "dismissed" })).then(function (r) { var out = r && r.outcome === "accepted" ? "accepted" : "dismissed"; if (out === "accepted") { instPrompt = null; lsSet("sawa_installed", Date.now()); } return out; }).catch(function () { return "dismissed"; });
  }
  // خطوات التثبيت اليدويّ لكلّ منصّة
  function installSteps(st) {
    if (st === "ios-safari" || st === "ios-other") return [
      ["share", L("اضغط زرّ المشاركة في شريط Safari السفليّ", "Tap the Share button in Safari's bottom bar")],
      ["plus", L("مرّر في القائمة واختر «إضافة إلى الشاشة الرئيسية»", "Scroll and choose “Add to Home Screen”")],
      ["check", L("اضغط «إضافة» في أعلى الشاشة", "Tap “Add” at the top")]];
    return [
      ["menu", L("اضغط القائمة ⋮ في أعلى المتصفّح", "Tap the ⋮ menu at the top of the browser")],
      ["plus", L("اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»", "Choose “Install app” or “Add to Home screen”")],
      ["check", L("اضغط «تثبيت»", "Tap “Install”")]];
  }

  // ---------- ربط التطبيق ----------
  function bindApp(fns) {
    app = fns || null;
    var w = waiters; waiters = [];
    w.forEach(function (f) { try { f(); } catch (e) {} });
    publish();
    try { if (state.uid) { publishChats(); Object.keys(days).forEach(publishMessages); } } catch (e) {}
  }
  function whenApp(f) { if (app) f(); else waiters.push(f); }

  // ---------- جهات الاتّصال ----------
  // الشكل الذي يراه التطبيق: { id: uid, uid, name, anon, families:[{groupId,name}], via:[…], online, lastSeen, onSawa:true }
  // التسمية: اسمٌ أختاره أنا لجهة الاتّصال (يظهر لي وحدي، ويتزامن بين أجهزتي) ← اسمه في سوا ← «ضيف · رمز» يميّز الضيوف
  // C88: رمز سوا (١٠ أرقام) لجهات الاتّصال بدل الوسم القديم (آخر ٤ حروف من المعرّف) — يُجلب من الخادم ويُحفظ هنا
  var peerCodes = lsGet("sawa_codes_v1", {});   // uid -> { c: "1234567890" | null, t: وقت الجلب }
  function peerCode(uid) { var e = peerCodes[uid]; return e && e.c ? e.c : null; }
  function guestTag(uid) {
    var c = peerCode(uid); if (c) return fmtCode(c);
    var t = String(uid || "").replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase(); return t || "؟";
  }
  var codesBusy = false;
  function fetchPeerCodes(force) {
    if (!state.uid || codesBusy) return Promise.resolve();
    var now = Date.now(), need = state.people.map(function (p) { return p.uid; })
      .filter(function (u) { var e = peerCodes[u]; return force || !e || now - (e.t || 0) > (e.c ? 7 : 1) * 86400000; }).slice(0, 50);
    if (!need.length) return Promise.resolve();
    codesBusy = true;
    var chunks = [need.slice(0, 25), need.slice(25, 50)].filter(function (x) { return x.length; });
    return chunks.reduce(function (pr, ch) {
      return pr.then(function () { return call("code.of", { uids: ch }).then(function (b) {
        var cs = (b && b.codes) || {}; ch.forEach(function (u) { if (u in cs) peerCodes[u] = { c: cs[u] || null, t: Date.now() }; });
      }); });
    }, Promise.resolve()).then(function () { lsSet("sawa_codes_v1", peerCodes); publish(); }, function (e) { log("code.of", e && e.message); })
      .then(function () { codesBusy = false; });
  }
  function nickOf(uid) { try { return (prefs && prefs.nick && prefs.nick[uid]) || null; } catch (e) { return null; } }
  function displayName(p) {
    return nickOf(p.uid) || p.name || (p.anon ? L("ضيف · ", "Guest · ") + guestTag(p.uid) : L("عضو", "Member") + " · " + guestTag(p.uid));
  }
  // ---------- C25: صور الحسابات — avatars/{uid} في Firestore (يكتبها الخادم)، تُقرأ على دفعاتٍ وتُخزَّن ١٢ ساعة ----------
  var AVK = "sawa_avatars", avCache = null, avWant = {}, avT = null, avFetching = {};
  function avAll() { if (!avCache) { avCache = lsGet(AVK, {}); if (!avCache || typeof avCache !== "object") avCache = {}; } return avCache; }
  function avSave() { var all = avAll(), ks = Object.keys(all); if (ks.length > 400) { ks.sort(function (a, b) { return (all[a].at || 0) - (all[b].at || 0); }); ks.slice(0, ks.length - 400).forEach(function (k) { delete all[k]; }); } lsSet(AVK, all); }
  function photoOf(uid) {
    if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(String(uid))) return null;
    var e = avAll()[uid], fresh = e && Date.now() - (e.at || 0) < 12 * 3600000;
    if (!fresh && !avFetching[uid]) { avWant[uid] = 1; if (!avT) avT = setTimeout(avFlush, 60); }
    return e && e.d ? e.d : null;
  }
  function avFlush() {
    avT = null;
    var d = fsdb(), ids = Object.keys(avWant).filter(function (u) { return !avFetching[u]; }).slice(0, 30); avWant = {};
    if (!d || !ids.length || !state.uid) return;
    ids.forEach(function (u) { avFetching[u] = 1; });
    var chunks = []; for (var i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    Promise.all(chunks.map(function (ch) {
      var q; try { q = d.collection("avatars").where(firebase.firestore.FieldPath.documentId(), "in", ch).get(); } catch (e) { q = Promise.reject(e); }
      return q.then(function (snap) {
        var got = {}; snap.forEach(function (doc) { var x = doc.data() || {}; if (typeof x.d === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(x.d) && x.d.length <= 20000) got[doc.id] = x.d; });
        var all = avAll(), now = Date.now();
        ch.forEach(function (u) { all[u] = { d: got[u] || null, at: now }; });
      }, function (e) { log("avatars:", e && e.code); var all = avAll(), now = Date.now(); ch.forEach(function (u) { all[u] = all[u] || { d: null, at: now - 11 * 3600000 }; }); });
    })).then(function () { ids.forEach(function (u) { delete avFetching[u]; }); avSave(); avChanged(); });
  }
  function avChanged() { publish(); publishChats(); Object.keys(days).forEach(publishMessages); try { if (app && app.setMyProfile) app.setMyProfile(profile()); } catch (e) {} try { global.dispatchEvent(new CustomEvent("sawa-avatars")); } catch (e) {} }
  // C155: صورة المجموعة — تُحفظ في avatars/{cid} كصور الحسابات (يكتبها الخادم لمن يحقّ له تعديل المعلومات) · photoTs في المحادثة يجدّد النسخة المخزّنة
  var CHAT_BUILD = "c167";   // C160: يُرفع مع كلّ تعديلٍ على هذا الملفّ — يظهر في «تحديث التطبيق»
  function setGroupPhoto(cid, has) {
    return choosePhoto({ title: L("صورة المجموعة", "Group photo"), remove: !!has }).then(function (du) {
      if (!du) return null;
      var v = du === "-" ? "" : du;
      return call("group.update", { cid: cid, photo: v }).then(function () {
        var all = avAll(); all[cid] = { d: v || null, at: Date.now() }; avSave(); avChanged();
        toast(v ? L("تغيّرت صورة المجموعة ✓", "Group photo updated ✓") : L("أُزيلت صورة المجموعة", "Group photo removed"));
        return true;
      });
    }).catch(function (e) { toast(/only admins/.test(String(e && e.message)) ? L("المشرفون وحدهم يغيّرون صورة هذه المجموعة", "Only admins can change this group's photo") : L("تعذّر تغيير الصورة: ", "Couldn't change the photo: ") + String((e && e.message) || e).slice(0, 80)); });   // C159: السبب ظاهر
  }
  function groupPhotoOf(c) {
    var e = avAll()[c.cid];
    if (e && c.photoTs && (e.at || 0) < c.photoTs) e.at = 0;   // تغيّرت عند غيري ⇒ تُجلب من جديد
    return c.photoTs ? photoOf(c.cid) : null;
  }
  function setMyPhoto(dataUrl) {   // null ⇒ إزالة
    return call("profile.set", { photo: dataUrl || null }).then(function () {
      var all = avAll(); all[state.uid] = { d: dataUrl || null, at: Date.now() }; avSave(); avChanged();
    });
  }
  // صورةٌ صغيرة مربّعة (١٢٨px, JPEG) ≤ ٢٠ ألف حرف
  function squareThumb(blob) {
    return loadImg(blob).then(function (r) {
      var img = r.img, w = img.naturalWidth, h = img.naturalHeight, m = Math.min(w, h), sizes = [160, 128, 96, 72], qs = [0.8, 0.72, 0.62, 0.5];
      for (var i = 0; i < sizes.length; i++) {
        var c = document.createElement("canvas"); c.width = c.height = sizes[i];
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, c.width, c.height);
        var du = c.toDataURL("image/jpeg", qs[i]); if (du.length <= 20000) { URL.revokeObjectURL(r.url); return du; }
      }
      URL.revokeObjectURL(r.url); throw new Error("too big");
    });
  }
  // ==================================================================
  // C130: صورة الحساب — اختيار المصدر + محرّر قصّ دائريّ (سحب · تكبير بإصبعين أو بالشريط · تدوير)
  // ==================================================================
  var AV_PRESETS = [["🌙", "#1E3A63", "#2F80C8"], ["🌿", "#065f46", "#16a34a"], ["🌸", "#9d174d", "#f472b6"], ["☀️", "#b45309", "#fbbf24"], ["🕊️", "#334155", "#94a3b8"], ["🌊", "#0f766e", "#22d3ee"],
    ["⭐", "#4c1d95", "#8b5cf6"], ["🌹", "#7f1d1d", "#ef4444"], ["🌴", "#14532d", "#84cc16"], ["☕", "#451a03", "#a16207"], ["📚", "#1e293b", "#3b82f6"], ["⚽", "#064e3b", "#10b981"],
    ["🐪", "#78350f", "#f59e0b"], ["🦅", "#1c1917", "#78716c"], ["🌾", "#713f12", "#eab308"], ["💙", "#1e3a8a", "#60a5fa"]];
  function presetAvatar(x) {
    var c = document.createElement("canvas"); c.width = c.height = 160; var g = c.getContext("2d");
    var gr = g.createLinearGradient(0, 0, 160, 160); gr.addColorStop(0, x[2]); gr.addColorStop(1, x[1]); g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
    g.font = "84px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(x[0], 80, 88);
    return c.toDataURL("image/jpeg", 0.85);
  }
  function pickFile(accept, capture) {
    return new Promise(function (res) {
      var inp = document.createElement("input"); inp.type = "file"; inp.accept = accept; if (capture) inp.setAttribute("capture", capture);
      inp.onchange = function () { var f = inp.files && inp.files[0]; res(f || null); };
      inp.click();
    });
  }
  function choosePhoto(o) {
    o = o || {};
    return new Promise(function (res) {
      var ov = document.createElement("div"); ov.dir = isAr() ? "rtl" : "ltr";
      ov.style.cssText = "position:fixed;inset:0;z-index:2147483005;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui";
      var box = document.createElement("div");
      box.style.cssText = "background:#fff;color:#1A1A2E;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:14px 14px calc(env(safe-area-inset-bottom,0px) + 14px);box-sizing:border-box;max-height:88vh;overflow:auto";
      var done = false, close = function (v) { if (done) return; done = true; ov.remove(); res(v || null); };
      ov.onclick = function (e) { if (e.target === ov) close(null); };
      var h = document.createElement("div"); h.textContent = o.title || L("صورة حسابك", "Your profile photo"); h.style.cssText = "font:800 15px system-ui;text-align:center;margin-bottom:10px"; box.appendChild(h);
      var row = document.createElement("div"); row.style.cssText = "display:grid;grid-template-columns:repeat(" + (NB() && NB().albumsOk ? 4 : 3) + ",1fr);gap:8px";
      var src = function (ic, label, fn) {
        var b = document.createElement("button"); b.type = "button";
        b.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;color:#1A1A2E;font:700 12.5px system-ui";
        var i = document.createElement("span"); i.textContent = ic; i.style.cssText = "font-size:24px"; b.appendChild(i); b.appendChild(document.createTextNode(label));
        b.onclick = fn; row.appendChild(b);
      };
      var fromFile = function (f) { if (!f) return; ov.style.visibility = "hidden"; cropPhoto(f).then(function (du) { if (du) close(du); else ov.style.visibility = ""; }, function () { ov.style.visibility = ""; toast(L("تعذّر قراءة الصورة", "Couldn't read the image")); }); };
      src("📷", L("الكاميرا", "Camera"), function () { pickFile("image/*", "user").then(fromFile); });
      src("🖼️", L("المعرض", "Gallery"), function () { pickFile("image/*").then(fromFile); });
      // C130b: الألبومات (تطبيق معرض الهاتف) — في تطبيق أندرويد c130+ · الآيفون: «المعرض» فيه الألبومات أصلاً
      if (NB() && NB().albumsOk) src("🗂️", L("الألبومات", "Albums"), function () { pickFile("image/x-sawa-albums").then(fromFile); });
      src("📁", L("الملفّات", "Files"), function () { pickFile("image/jpeg,image/png,image/webp,image/heic,image/gif").then(fromFile); });
      box.appendChild(row);
      var sub = document.createElement("div"); sub.textContent = L("أو اختر صورةً جاهزة", "Or pick a ready-made picture"); sub.style.cssText = "font:700 12px system-ui;color:#6b7280;margin:14px 2px 8px"; box.appendChild(sub);
      var grid = document.createElement("div"); grid.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:10px;justify-items:center";
      AV_PRESETS.forEach(function (x) {
        var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", x[0]);
        b.style.cssText = "width:58px;height:58px;border-radius:50%;border:0;font-size:28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg," + x[2] + "," + x[1] + ")";
        b.textContent = x[0]; b.onclick = function () { close(presetAvatar(x)); }; grid.appendChild(b);
      });
      box.appendChild(grid);
      if (o.remove) {   // C155: إزالة الصورة الحاليّة (صورة المجموعة)
        var rm = document.createElement("button"); rm.type = "button"; rm.textContent = L("إزالة الصورة", "Remove photo");
        rm.style.cssText = "width:100%;margin-top:14px;padding:12px;border:0;border-radius:12px;background:#fdecec;color:#b42318;font:700 14px system-ui"; rm.onclick = function () { close("-"); };
        box.appendChild(rm);
      }
      var cn = document.createElement("button"); cn.type = "button"; cn.textContent = L("إلغاء", "Cancel");
      cn.style.cssText = "width:100%;margin-top:14px;padding:12px;border:0;border-radius:12px;background:#eee;color:#333;font:700 14px system-ui"; cn.onclick = function () { close(null); };
      box.appendChild(cn); ov.appendChild(box); document.body.appendChild(ov);
    });
  }
  // محرّر القصّ: الصورة تُسحب وتُكبَّر داخل دائرة؛ «حفظ» يرسم الجزء الظاهر إلى ١٦٠ بكسل (≤ ٢٠ ألف حرف)
  function cropPhoto(file) {
    return loadImg(file).then(function (r) {
      return new Promise(function (res) {
        var img = r.img, W = img.naturalWidth, H = img.naturalHeight, rot = 0;
        var ov = document.createElement("div"); ov.dir = isAr() ? "rtl" : "ltr";
        ov.style.cssText = "position:fixed;inset:0;z-index:2147483006;background:#0b1220;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;color:#fff;touch-action:none;user-select:none";
        var tip = document.createElement("div"); tip.textContent = L("اسحب الصورة لتحريكها · كبّرها بإصبعين أو بالشريط", "Drag to move · pinch or use the slider to zoom");
        tip.style.cssText = "font:600 13px system-ui;color:#cbd5e1;margin-bottom:14px;text-align:center;padding:0 16px";
        var S = Math.min(300, Math.round(Math.min(innerWidth, innerHeight) * 0.78));
        var stage = document.createElement("div"); stage.style.cssText = "position:relative;width:" + S + "px;height:" + S + "px;overflow:hidden;border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.85);background:#111;cursor:grab";
        var cv = document.createElement("canvas"); cv.width = cv.height = S * 2; cv.style.cssText = "width:100%;height:100%;display:block";
        stage.appendChild(cv);
        var g = cv.getContext("2d");
        var dims = function () { return rot % 180 ? [H, W] : [W, H]; };
        var minZ = function () { var d = dims(); return S / Math.min(d[0], d[1]); };
        var z = minZ(), x = 0, y = 0;   // x,y: إزاحة مركز الصورة عن مركز الدائرة (بكسل الشاشة)
        var clamp = function () {
          z = Math.max(minZ(), Math.min(minZ() * 6, z));
          var d = dims(), mx = Math.max(0, (d[0] * z - S) / 2), my = Math.max(0, (d[1] * z - S) / 2);
          x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y));
        };
        var draw = function (ctx, size) {
          var k = size / S; ctx.save(); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
          ctx.translate(size / 2 + x * k, size / 2 + y * k); ctx.rotate(rot * Math.PI / 180); ctx.scale(z * k, z * k);
          ctx.drawImage(img, -W / 2, -H / 2); ctx.restore();
        };
        var paint = function () { clamp(); draw(g, cv.width); sl.value = String(Math.round((z / minZ() - 1) * 100)); };
        var pts = {}, last = null;
        stage.addEventListener("pointerdown", function (e) { stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; last = null; });
        stage.addEventListener("pointermove", function (e) {
          if (!pts[e.pointerId]) return;
          var ids = Object.keys(pts), prev = pts[e.pointerId]; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          if (ids.length === 1) { x += e.clientX - prev.x; y += e.clientY - prev.y; }
          else { var a = pts[ids[0]], b = pts[ids[1]], dd = Math.hypot(a.x - b.x, a.y - b.y); if (last) { var f = dd / last; z *= f; x *= f; y *= f; } last = dd; }
          paint();
        });
        var up = function (e) { delete pts[e.pointerId]; last = null; };
        stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
        stage.addEventListener("wheel", function (e) { e.preventDefault(); var f = e.deltaY < 0 ? 1.08 : 1 / 1.08; z *= f; x *= f; y *= f; paint(); }, { passive: false });
        var ctr = document.createElement("div"); ctr.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:22px;width:" + S + "px";
        var zm = document.createElement("span"); zm.textContent = "🔍"; zm.style.cssText = "font-size:16px";
        var sl = document.createElement("input"); sl.type = "range"; sl.min = "0"; sl.max = "500"; sl.value = "0"; sl.style.cssText = "flex:1;accent-color:#60a5fa";
        sl.setAttribute("aria-label", L("تكبير", "Zoom"));
        sl.oninput = function () { var nz = minZ() * (1 + Number(sl.value) / 100), f = nz / z; z = nz; x *= f; y *= f; paint(); };
        var rb = document.createElement("button"); rb.type = "button"; rb.textContent = "⟳"; rb.setAttribute("aria-label", L("تدوير", "Rotate"));
        rb.style.cssText = "width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:700 20px system-ui";
        rb.onclick = function () { rot = (rot + 90) % 360; z = minZ(); x = y = 0; paint(); };
        ctr.appendChild(zm); ctr.appendChild(sl); ctr.appendChild(rb);
        var row = document.createElement("div"); row.style.cssText = "display:flex;gap:10px;margin-top:22px;width:" + S + "px";
        var ok = document.createElement("button"); ok.type = "button"; ok.textContent = L("استخدام الصورة", "Use photo");
        ok.style.cssText = "flex:1;padding:13px;border:0;border-radius:14px;background:#2F80C8;color:#fff;font:800 14px system-ui";
        var no = document.createElement("button"); no.type = "button"; no.textContent = L("رجوع", "Back");
        no.style.cssText = "flex:1;padding:13px;border:0;border-radius:14px;background:rgba(255,255,255,.12);color:#fff;font:700 14px system-ui";
        var fin = function (v) { ov.remove(); try { URL.revokeObjectURL(r.url); } catch (e) {} res(v); };
        no.onclick = function () { fin(null); };
        ok.onclick = function () {
          var sizes = [160, 128, 96, 72], qs = [0.82, 0.72, 0.62, 0.5];
          for (var i = 0; i < sizes.length; i++) {
            var c = document.createElement("canvas"); c.width = c.height = sizes[i]; draw(c.getContext("2d"), sizes[i]);
            var du = c.toDataURL("image/jpeg", qs[i]); if (du.length <= 20000) return fin(du);
          }
          toast(L("الصورة كبيرة جدّاً", "Image too large"));
        };
        row.appendChild(ok); row.appendChild(no);
        ov.appendChild(tip); ov.appendChild(stage); ov.appendChild(ctr); ov.appendChild(row);
        document.body.appendChild(ov); paint();
      });
    });
  }
  function pickPhoto() {
    return new Promise(function (res) {
      var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = function () { var f = inp.files && inp.files[0]; res(f || null); };
      inp.click();
    });
  }
  function decorate(p) {
    var pr = state.presence[p.uid] || null;
    return { id: p.uid, uid: p.uid, name: displayName(p), realName: p.name || null, nick: nickOf(p.uid), anon: !!p.anon, tag: guestTag(p.uid), code: peerCode(p.uid), photo: photoOf(p.uid),
             families: p.families || [], via: p.via || [], onSawa: true, phone: p.phone || "",
             online: !!(pr && pr.state === "online"), lastSeen: pr && pr.ts ? pr.ts : null };
  }
  function contacts() {
    return state.people.map(decorate).sort(function (a, b) { return a.name.localeCompare(b.name, "ar"); });
  }
  var pubTimer = null;
  function publish() {
    if (!app) return;
    if (pubTimer) return;
    pubTimer = setTimeout(function () {
      pubTimer = null;
      var list = contacts();
      try { if (app.setPeople) app.setPeople(list); } catch (e) {}
      // واجهاتٌ قديمة تعرف الأسماء فقط (نقطة «متّصل» في قائمة المحادثات) — حتّى C2
      try { if (app.setOnlineContacts) app.setOnlineContacts(list.filter(function (c) { return c.online; }).map(function (c) { return c.name; })); } catch (e) {}
      try { if (app.setMyProfile && state.me) app.setMyProfile(profile()); } catch (e) {}
    }, 60);
  }
  function applyPeople(b) {
    state.me = b.me || null; state.people = b.people || []; state.loaded = true; state.error = null;
    maybeAskName();
    lsSet("sawa_people_cache", { uid: state.uid, me: state.me, people: state.people });
    watchPresence();
    publish();
    setTimeout(function () { fetchPeerCodes(false); }, 1500);
  }
  function refresh() {
    if (!state.uid || state.loading) return Promise.resolve(contacts());
    state.loading = true;
    return call("people.list", {}).then(function (b) {
      applyPeople(b);
      return contacts();
    }).catch(function (e) {
      state.error = (e && e.message) || String(e); log("people.list:", state.error);
      return contacts();
    }).then(function (r) { state.loading = false; return r; });
  }

  // ---------- الملفّ الشخصيّ: اسم «سوا» + رقم الهاتف (غير موثّق حتّى الإطلاق) ----------
  function profile() {
    var m = state.me || {};
    return { uid: state.uid, name: m.name || null, phone: m.phone || null, phoneVerified: !!m.phoneVerified, verifiedBy: m.phoneVerified ? (m.verifiedBy || "whatsapp") : null, emailVerified: !!m.emailVerified, googleName: m.googleName || null, anon: !!m.anon, photo: state.uid ? photoOf(state.uid) : null,
             code: m.code || null, findable: m.findable !== false, waReady: !!state.waReady };
  }
  function saveProfile(patch) {
    return call("profile.set", patch).then(function (b) {
      state.me = Object.assign({}, state.me || {}, { name: b.profile.name, phone: b.profile.phone, phoneVerified: !!b.profile.phoneVerified });
      // C35: اسم سوا يُكتب في حساب Firebase أيضاً (للمربوط بـGoogle أو البريد) فلا يختلف الاسمان
      if ("name" in patch && b.profile.name) { try { if (S() && S().syncAuthName) S().syncAuthName(b.profile.name); } catch (e) {} }
      lsSet("sawa_people_cache", { uid: state.uid, me: state.me, people: state.people });
      publish(); try { if (app && app.setMyProfile) app.setMyProfile(profile()); } catch (e) {}
      return profile();
    });
  }
  function editProfile(hint) {
    if (!state.uid) return false;
    var p = profile();
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui";
    ov.dir = isAr() ? "rtl" : "ltr";
    var box = document.createElement("div");
    box.style.cssText = "background:#fff;color:#1A1A2E;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:16px 16px calc(env(safe-area-inset-bottom,0px) + 16px);box-sizing:border-box";
    function lab(t) { var l = document.createElement("div"); l.textContent = t; l.style.cssText = "font:700 12px system-ui;color:#555;margin:10px 2px 6px"; return l; }
    function inp(v, ph, ltr) { var i = document.createElement("input"); i.value = v || ""; i.placeholder = ph; i.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:12px;padding:11px 12px;font:600 15px system-ui;" + (ltr ? "direction:ltr;text-align:left" : ""); return i; }
    var h = document.createElement("div"); h.textContent = L("حسابي", "My account"); h.style.cssText = "font:800 16px system-ui;text-align:center;margin-bottom:4px";
    box.appendChild(h);
    if (typeof hint === "string" && hint) { var hh = document.createElement("div"); hh.textContent = hint; hh.style.cssText = "font:700 13px system-ui;color:#2e7d5b;text-align:center;margin:2px 0 4px"; box.appendChild(hh); }
    // C25: الصورة — تظهر لجهات اتّصالك في المحادثات والمكالمات
    var pr = document.createElement("div"); pr.style.cssText = "display:flex;align-items:center;gap:12px;margin:8px 0 2px";
    var pv = document.createElement("div"); pv.style.cssText = "width:64px;height:64px;border-radius:50%;background:#CFE5F7 center/cover no-repeat;display:flex;align-items:center;justify-content:center;font:800 26px system-ui;color:#1d5f9e;flex-shrink:0;overflow:hidden";
    var curPhoto = photoOf(state.uid), newPhoto;
    var paintPv = function () { var d = newPhoto === undefined ? curPhoto : newPhoto; pv.style.backgroundImage = d ? "url(" + d + ")" : "none"; pv.textContent = d ? "" : ((p.name || p.googleName || "؟").charAt(0)); };
    paintPv();
    var pb = document.createElement("div"); pb.style.cssText = "display:flex;flex-direction:column;gap:6px;flex:1";
    var chg = document.createElement("button"); chg.textContent = L("📷 تغيير الصورة", "📷 Change photo"); chg.style.cssText = "padding:9px 12px;border:1.5px solid #2F80C8;border-radius:10px;background:#fff;color:#2F80C8;font:800 13px system-ui";
    var rmv = document.createElement("button"); rmv.textContent = L("إزالة الصورة", "Remove photo"); rmv.style.cssText = "padding:7px 12px;border:0;border-radius:10px;background:transparent;color:#b42318;font:700 12px system-ui";
    // C130: مصدر الصورة (كاميرا · معرض · ملفّات · صور جاهزة) ثمّ قصٌّ بالتحريك والتكبير قبل الحفظ
    chg.onclick = function () { choosePhoto().then(function (du) { if (du) { newPhoto = du; paintPv(); } }).catch(function () { toast(L("تعذّر قراءة الصورة", "Couldn't read the image")); }); };
    rmv.onclick = function () { newPhoto = null; paintPv(); };
    pb.appendChild(chg); pb.appendChild(rmv); pr.appendChild(pv); pr.appendChild(pb); box.appendChild(pr);
    box.appendChild(lab(L("اسمك في سوا — يراه من تتواصل معهم", "Your name in Sawa — shown to people you connect with")));
    var nIn = inp(p.name || p.googleName || "", L("مثال: خالد علي", "e.g. Khalid Ali")); box.appendChild(nIn);
    if (p.googleName && p.googleName !== p.name) { var g = document.createElement("div"); g.textContent = L("اسم حساب Google: ", "Google name: ") + p.googleName; g.style.cssText = "font:500 11px system-ui;color:#888;margin:4px 2px 0"; box.appendChild(g); }
    box.appendChild(lab(L("رقم هاتفك (اختياريّ)", "Your phone number (optional)")));
    var pIn = inp(p.phone || "", "+249 9X XXX XXXX", true); pIn.type = "tel"; box.appendChild(pIn);
    var note = document.createElement("div");
    if (p.phone && p.phoneVerified) {
      note.textContent = L("✓ رقمك موثَّق — يستطيع معارفك إيجادك به. تغييره يُلغي التوثيق.", "✓ Your number is verified — people can find you by it. Changing it removes verification.");
      note.style.cssText = "font:600 11.5px system-ui;color:#187854;background:#e8f5ee;border-radius:10px;padding:8px 10px;margin-top:8px;line-height:1.6";
    } else {
      note.textContent = L("غير موثَّق: يظهر لجهات اتّصالك فقط ولا يُبحث عنك به. وثّقه عبر واتساب في ثوانٍ من «حسابي».", "Unverified: shown to your contacts only; nobody can find you by it. Verify it via WhatsApp from «Me».");
      note.style.cssText = "font:500 11px system-ui;color:#8a6d00;background:#fff7e0;border-radius:10px;padding:8px 10px;margin-top:8px;line-height:1.6";
    }
    box.appendChild(note);
    var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;margin-top:14px";
    var ok = document.createElement("button"); ok.textContent = L("حفظ", "Save"); ok.style.cssText = "flex:1;padding:12px;border:0;border-radius:12px;background:#2e7d5b;color:#fff;font:800 14px system-ui";
    var no = document.createElement("button"); no.textContent = L("إلغاء", "Cancel"); no.style.cssText = "flex:1;padding:12px;border:0;border-radius:12px;background:#eee;color:#333;font:700 14px system-ui";
    row.appendChild(ok); row.appendChild(no); box.appendChild(row);
    ov.appendChild(box); document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    no.onclick = close; ov.onclick = function (e) { if (e.target === ov) close(); };
    ok.onclick = function () {
      var patch = {}, nm = nIn.value.replace(/\s+/g, " ").trim(), ph = pIn.value.trim();
      if (nm !== (p.name || "")) patch.name = nm;
      if (ph !== (p.phone || "")) patch.phone = ph;
      var photoChanged = newPhoto !== undefined && newPhoto !== curPhoto;
      if (!Object.keys(patch).length && !photoChanged) { close(); return; }
      if (patch.name !== undefined && patch.name.length < 2) { toast(L("اكتب اسماً من حرفين على الأقلّ", "Enter at least 2 letters")); return; }
      ok.disabled = true; ok.textContent = "…";
      (photoChanged ? setMyPhoto(newPhoto) : Promise.resolve()).then(function () { return Object.keys(patch).length ? saveProfile(patch) : null; }).then(function () { toast(L("حُفظ ✓ — يظهر لجهات اتّصالك خلال لحظات", "Saved ✓")); close(); refresh(); })
        .catch(function (e) { ok.disabled = false; ok.textContent = L("حفظ", "Save"); toast((e && e.message) || String(e)); });
    };
    setTimeout(function () { try { nIn.focus(); } catch (e) {} }, 50);
    return true;
  }

  // C88: تسمية جهة اتّصال من طرفي (تظهر لي وحدي) — تُستعمل من «تسمية» ومن إضافة شخصٍ برمزه
  function setNick(uid, v, silent) {
    if (!uid) return;
    prefs = prefs || {}; var nk = Object.assign({}, prefs.nick || {});
    v = String(v || "").replace(/\s+/g, " ").trim();
    if (v) nk[uid] = v.slice(0, 40); else delete nk[uid];
    prefs.nick = nk; savePrefs({ nick: nk });
    publish(); publishChats(); Object.keys(days).forEach(publishMessages);
    if (!silent) toast(v ? L("حُفظت التسمية ✓", "Name saved ✓") : L("أُزيلت التسمية", "Name cleared"));
  }
  function renameContact(uid) {
    if (!state.uid || !uid) return false;
    var p = state.people.filter(function (x) { return x.uid === uid; })[0] || { uid: uid };
    var cur = nickOf(uid) || "";
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui";
    ov.dir = isAr() ? "rtl" : "ltr";
    var box = document.createElement("div");
    box.style.cssText = "background:#fff;color:#1A1A2E;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:16px 16px calc(env(safe-area-inset-bottom,0px) + 16px);box-sizing:border-box";
    var h = document.createElement("div"); h.textContent = L("تسمية جهة الاتّصال", "Name this contact"); h.style.cssText = "font:800 16px system-ui;text-align:center";
    var sub = document.createElement("div");
    sub.textContent = (p.name ? L("اسمه في سوا: ", "Their Sawa name: ") + p.name : (p.anon ? L("ضيف بلا اسم · رمزه ", "Unnamed guest · code ") + guestTag(uid) : "")) + " — " + L("التسمية تظهر لك وحدك", "only you see this name");
    sub.style.cssText = "font:500 12px system-ui;color:#777;text-align:center;margin:6px 0 10px";
    var i = document.createElement("input"); i.value = cur; i.placeholder = L("مثال: أحمد — زميل العمل", "e.g. Ahmed — work");
    i.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:12px;padding:11px 12px;font:600 15px system-ui";
    var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;margin-top:12px";
    var ok = document.createElement("button"); ok.textContent = L("حفظ", "Save"); ok.style.cssText = "flex:1;padding:12px;border:0;border-radius:12px;background:#2e7d5b;color:#fff;font:800 14px system-ui";
    var clr = document.createElement("button"); clr.textContent = L("إزالة التسمية", "Clear"); clr.style.cssText = "flex:1;padding:12px;border:0;border-radius:12px;background:#eee;color:#333;font:700 14px system-ui";
    row.appendChild(ok); if (cur) row.appendChild(clr);
    box.appendChild(h); box.appendChild(sub); box.appendChild(i); box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) close(); };
    var apply = function (v) {
      prefs = prefs || {}; var nk = Object.assign({}, prefs.nick || {});
      if (v) nk[uid] = v.slice(0, 40); else delete nk[uid];
      prefs.nick = nk; savePrefs({ nick: nk });
      publish(); publishChats(); Object.keys(days).forEach(publishMessages);
      toast(v ? L("حُفظت التسمية ✓", "Name saved ✓") : L("أُزيلت التسمية", "Name cleared")); close();
    };
    ok.onclick = function () { apply(i.value.replace(/\s+/g, " ").trim()); };
    clr.onclick = function () { apply(""); };
    setTimeout(function () { try { i.focus(); } catch (e) {} }, 50);
    return true;
  }
  // الضيف بلا اسم: نطلب منه اسماً مرّةً واحدة — حتّى يميّزه الآخرون
  function maybeAskName() {
    var m = state.me;
    if (!m || m.name || lsGet("sawa_name_asked", 0) || onbActive()) return;
    lsSet("sawa_name_asked", Date.now());
    setTimeout(function () { editProfile(L("اكتب اسمك ليعرفك من تتواصل معهم — بدل «ضيف»", "Add your name so people know who you are")); }, 1500);
  }

  // ---------- الحضور (Realtime Database) ----------
  function watchPresence() {
    var d = db(); if (!d) return;
    var want = {}; state.people.forEach(function (p) { want[p.uid] = 1; });
    for (var u in presenceRefs) if (!want[u]) { try { presenceRefs[u].off(); } catch (e) {} delete presenceRefs[u]; delete state.presence[u]; }
    Object.keys(want).forEach(function (u) {
      if (presenceRefs[u]) return;
      var ref = d.ref("status/" + u);
      presenceRefs[u] = ref;
      ref.on("value", function (snap) { state.presence[u] = snap.val() || null; publish(); },
        function (err) { log("presence", u, err && err.code); });   // بلا صلاحيّة بعد (acl يُكتب مع people.list)
    });
  }
  function setMine(stateName) {
    if (!myStatusRef || !global.firebase) return;
    try { myStatusRef.set({ state: stateName, ts: firebase.database.ServerValue.TIMESTAMP }); } catch (e) {}
  }
  // C50: إشارة الخادم (طلب تواصل / قبول / طلب تأكيد رقم) — كانت الطلبات لا تظهر إلا بإشعارٍ أو بعد عودةٍ من الخلفية
  var sigRef = null, sigSeen = -1;
  function startSig(uid) {
    var d = db(); if (!d) return;
    try { if (sigRef) sigRef.off(); } catch (e) {}
    sigSeen = -1;
    sigRef = d.ref("sig/" + uid);
    sigRef.on("value", function (snap) {
      var v = snap.val() || {}; var ts = Number(v.ts || 0);
      if (sigSeen < 0) { sigSeen = ts; return; }          // القيمة الأولى = الحالة الراهنة، لا حدث
      if (ts <= sigSeen) return; sigSeen = ts;
      if (v.k === "famreq") { loadFamReqs(true); return; }   // C107
      loadRequests(); if (v.k === "reqok") refresh();
    }, function () {});
  }
  function startMyPresence(uid) {
    var d = db(); if (!d) { log("Realtime Database غير محمَّلة"); return; }
    stopMyPresence();
    startSig(uid);
    myStatusRef = d.ref("status/" + uid);
    connRef = d.ref(".info/connected");
    connRef.on("value", function (snap) {
      if (snap.val() !== true) return;
      // عند الانقطاع (إغلاق التطبيق/فقد الشبكة) يكتب الخادم «غير متّصل» بنفسه
      myStatusRef.onDisconnect().set({ state: "offline", ts: firebase.database.ServerValue.TIMESTAMP }).then(function () {
        setMine(document.visibilityState === "hidden" ? "offline" : "online");
      });
    });
  }
  function stopMyPresence() {
    try { if (sigRef) { sigRef.off(); sigRef = null; } } catch (e) {}
    try { if (connRef) connRef.off(); } catch (e) {}
    try { if (myStatusRef) { myStatusRef.onDisconnect().cancel(); setMine("offline"); } } catch (e) {}
    connRef = null; myStatusRef = null;
  }
  try {
    var hiddenAt = 0, lastRefresh = 0;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); if (myStatusRef) setMine("offline"); return; }
      if (myStatusRef) setMine("online");
      if (!state.uid) return;
      // عودةٌ بعد غيابٍ في الخلفية: اتّصال Firestore قد يكون «ميّتاً» دون أن يعلم — نعيد فتحه فوراً بدل انتظار مهلته الطويلة
      if (hiddenAt && Date.now() - hiddenAt > 15000) {
        try { var fs = firebase.firestore(); fs.disableNetwork().then(function () { return fs.enableNetwork(); }).catch(function () {}); } catch (e) {}
      }
      hiddenAt = 0;
      if (Date.now() - lastRefresh > 60000) { lastRefresh = Date.now(); refresh(); loadRequests(); }   // قائمة جهات الاتّصال: مرّة في الدقيقة على الأكثر
      if (openCid) markRead(openCid);
      unstickOutbox(); drainOutbox();
    });
    global.addEventListener("pagehide", function () { setMine("offline"); });
  } catch (e) {}

  // ---------- الرابط الشخصيّ و QR ----------
  function inviteUrl(token) { return global.location.origin + global.location.pathname.replace(/index\.html$/, "") + "?contact=" + token; }
  function createInvite() {
    return call("people.invite", {}).then(function (b) { return { token: b.token, url: inviteUrl(b.token), expiresTs: b.expiresTs }; });
  }
  function shareInvite() {
    toast(L("جارٍ إنشاء رابطك…", "Creating your link…"));
    return createInvite().then(function (inv) {
      var text = L("أضفني إلى جهات اتّصالك في سوا (الرابط صالح أسبوعاً):", "Add me as a contact on Sawa (link valid for a week):");
      if (global.navigator && navigator.share) return navigator.share({ title: "سوا", text: text, url: inv.url }).catch(function () {}).then(function () { return inv; });
      if (global.navigator && navigator.clipboard) return navigator.clipboard.writeText(text + " " + inv.url).then(function () { toast(L("نُسخ الرابط ✓", "Link copied ✓")); return inv; });
      global.prompt(L("انسخ الرابط:", "Copy the link:"), inv.url); return inv;
    }).catch(function (e) { toast(L("تعذّر إنشاء الرابط: ", "Couldn't create the link: ") + ((e && e.message) || e)); return null; });
  }
  // مكتبة QR تُحمَّل عند الحاجة فقط (cdnjs)
  var qrLib = null;
  function loadQrLib() {
    if (global.QRCode) return Promise.resolve(global.QRCode);
    if (qrLib) return qrLib;
    qrLib = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      s.onload = function () { global.QRCode ? res(global.QRCode) : rej(new Error("QR")); };
      s.onerror = function () { qrLib = null; rej(new Error(L("تعذّر تحميل أداة QR — تحقّق من الاتّصال", "Couldn't load the QR tool — check your connection"))); };
      document.head.appendChild(s);
    });
    return qrLib;
  }
  // يرسم رمز QR داخل عنصر (div) — يعيد الرابط المرسوم
  function renderQr(el, size) {
    return Promise.all([createInvite(), loadQrLib()]).then(function (r) {
      var inv = r[0], Q = r[1];
      el.innerHTML = "";
      new Q(el, { text: inv.url, width: size || 220, height: size || 220, colorDark: "#1A1A2E", colorLight: "#FFFFFF", correctLevel: Q.CorrectLevel.M });
      return inv;
    });
  }
  function tokenFrom(text) {
    if (!text) return null;
    var m = String(text).match(/[?&]contact=([A-Za-z0-9-]{8,80})/);
    if (m) return m[1];
    var t = String(text).trim();
    return /^[A-Za-z0-9-]{20,80}$/.test(t) ? t : null;
  }
  function accept(textOrToken) {
    var tok = tokenFrom(textOrToken);
    if (!tok) { toast(L("هذا ليس رابط جهة اتّصال من سوا", "That isn't a Sawa contact link")); return Promise.resolve(null); }
    return call("people.accept", { token: tok }).then(function (b) {
      if (b.self) { toast(L("هذا رابطك أنت 🙂", "That's your own link 🙂")); return null; }
      toast(L("أُضيف «" + (b.name || L("جهة اتّصال", "contact")) + "» إلى جهات اتّصالك ✓", "Added «" + (b.name || "contact") + "» to your contacts ✓"));
      return refresh().then(function () { return b; });
    }).catch(function (e) {
      var m = (e && e.message) || String(e);
      if (/expired/.test(m)) m = L("انتهت صلاحيّة الرابط — اطلب رابطاً جديداً", "The link expired — ask for a new one");
      else if (/not found/.test(m)) m = L("الرابط غير صحيح", "Invalid link");
      toast(m); return null;
    });
  }
  // C24: حظر/إلغاء حظر من جهات الاتّصال — نفس قائمة الحظر في الإعدادات (تتزامن بين أجهزتي، والخادم يمنع الرسائل والمكالمات)
  function setBlocked(uid, on) {
    if (!state.uid || !uid) return false;
    prefs = prefs || {};
    var l = (prefs.blocked || []).filter(function (u) { return u !== uid; });
    if (on) l.push(uid);
    prefs.blocked = l;
    try { if (app && app.setBlockedConversations) app.setBlockedConversations(l.map(dmWith)); } catch (e) {}
    savePrefs({ blocked: l });
    publish();
    return true;
  }
  function removeContact(uid) {
    return call("people.remove", { uid: uid }).then(function () { return refresh(); })
      .catch(function (e) { toast(L("تعذّر: ", "Failed: ") + ((e && e.message) || e)); });
  }
  // C20: مسح QR بالكاميرا — BarcodeDetector إن وُجد وعمل، وإلّا مكتبة jsQR (تُحمَّل عند الحاجة) تقرأ إطارات الكاميرا.
  //      كان يعتمد على BarcodeDetector وحده: غير موجود في متصفّحات كثيرة، وفي بعض أجهزة أندرويد موجودٌ لكنّه يفشل بصمت فلا يُقرأ شيء.
  var jsqrP = null;
  function loadJsQr() {
    if (global.jsQR) return Promise.resolve(global.jsQR);
    if (jsqrP) return jsqrP;
    // C84: عدّة مصادر — cdnjs أوّلاً (هو نفسه مصدر أداة رسم QR التي تعمل)، ثمّ jsdelivr ثمّ unpkg
    var SRC = ["https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js", "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js", "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js"];
    jsqrP = new Promise(function (res, rej) {
      (function next(i) {
        if (global.jsQR) return res(global.jsQR);
        if (i >= SRC.length) { jsqrP = null; return rej(new Error(L("تعذّر تحميل قارئ QR — تحقّق من الاتّصال", "Couldn't load the QR reader — check your connection"))); }
        var sc = document.createElement("script"), t = setTimeout(function () { sc.onload = sc.onerror = null; next(i + 1); }, 12000);
        sc.src = SRC[i];
        sc.onload = function () { clearTimeout(t); global.jsQR ? res(global.jsQR) : next(i + 1); };
        sc.onerror = function () { clearTimeout(t); next(i + 1); };
        document.head.appendChild(sc);
      })(0);
    });
    return jsqrP;
  }
  var lastScanErr = "";
  function scanSupported() { return !!(global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  // C73: في تطبيق أندرويد الأصليّ نستعمل ماسح Google (أسرع ولا يطلب إذن الكاميرا)، وإن لم يتوفّر نعود إلى ماسح الصفحة
  function scanQr() {
    if (NB() && NB().scanQr) {
      return nativeAsk("scanQr", [], 180000).then(function (r) {
        if (r.ok && r.value) return r.value;
        if (r.cancelled) return null;
        // C84: لا نُخفي سبب فشل ماسح Google — غالباً أوّل استعمال (يُنزَّل في الخلفيّة) أو خدمات Google قديمة
        var er = String(r.error || "");
        log("native scan", er);
        toast(/download|unavailable|module|\b14\b/i.test(er) ? L("ماسح Google يُجهَّز لأوّل مرّة — نفتح الكاميرا الآن", "Google scanner is still downloading — using the camera")
                                                               : L("ماسح Google لم يعمل — نفتح الكاميرا", "Google scanner failed — using the camera"));
        lastScanErr = er;
        return scanQrWeb();
      });
    }
    return scanQrWeb();
  }
  function scanQrWeb() {
    if (!scanSupported()) return Promise.reject(new Error(L("الكاميرا غير متاحة في هذا المتصفّح — الصق الرابط بدلاً منه", "Camera isn't available here — paste the link instead")));
    return new Promise(function (resolve, reject) {
      var stream, done = false, det = null, detFails = 0, canvas = null, ctx = null;
      var wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center";
      var box = document.createElement("div"); box.style.cssText = "position:relative;width:100%;max-width:520px";
      var vid = document.createElement("video"); vid.setAttribute("playsinline", ""); vid.muted = true; vid.autoplay = true;
      vid.style.cssText = "width:100%;max-height:75vh;object-fit:cover;display:block";
      var frame = document.createElement("div");
      frame.style.cssText = "position:absolute;left:50%;top:50%;width:62%;aspect-ratio:1;transform:translate(-50%,-50%);border:3px solid rgba(255,255,255,.9);border-radius:18px;box-shadow:0 0 0 2000px rgba(0,0,0,.35)";
      box.appendChild(vid); box.appendChild(frame);
      var hint = document.createElement("div");
      hint.textContent = L("وجّه الكاميرا إلى رمز QR من سوا", "Point the camera at a Sawa QR code");
      hint.style.cssText = "color:#fff;font:700 15px system-ui;margin:14px;text-align:center";
      var btn = document.createElement("button");
      btn.textContent = L("إلغاء", "Cancel");
      btn.style.cssText = "color:#fff;background:rgba(255,255,255,.18);border:0;border-radius:12px;padding:10px 22px;font:700 14px system-ui";
      wrap.appendChild(box); wrap.appendChild(hint); wrap.appendChild(btn); document.body.appendChild(wrap);
      function finish(val, err) {
        if (done) return; done = true;
        try { stream && stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { wrap.remove(); } catch (e) {}
        err ? reject(err) : resolve(val);
      }
      btn.onclick = function () { finish(null); };
      try { if (global.BarcodeDetector) det = new global.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { det = null; }
      function viaJsQr() {
        if (!global.jsQR || !vid.videoWidth) return null;
        var w = Math.min(640, vid.videoWidth), h = Math.round(vid.videoHeight * w / vid.videoWidth);
        if (!canvas) { canvas = document.createElement("canvas"); ctx = canvas.getContext("2d", { willReadFrequently: true }); }
        canvas.width = w; canvas.height = h; ctx.drawImage(vid, 0, 0, w, h);
        var r = global.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        return r && r.data ? r.data : null;
      }
      var jsq = loadJsQr().catch(function (e) { if (!det) finish(null, e); return null; });
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(function (s) {
        if (done) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; vid.srcObject = s; return vid.play();
      }).then(function () {
        (function tick() {
          if (done) return;
          var useDet = det && detFails < 4;
          var p = useDet ? det.detect(vid).then(function (codes) { detFails = 0; return codes && codes.length && codes[0].rawValue ? codes[0].rawValue : null; }, function () { detFails++; return null; })
                         : jsq.then(function () { try { return viaJsQr(); } catch (e) { return null; } });
          p.then(function (v) { if (v) return finish(v); setTimeout(tick, useDet ? 250 : 180); });
        })();
      }).catch(function (e) { finish(null, new Error(e && e.name === "NotAllowedError" ? L("لا إذن للكاميرا — اسمح بها من إعدادات المتصفّح", "No camera permission") : L("تعذّر فتح الكاميرا", "Couldn't open the camera"))); });
    });
  }
  // C20: ما يُمسح يُوجَّه بحسب نوعه — رابط شخص · رابط مجموعة · رابط غرفة · رمز سوا (١٠ أرقام). وكلّها تسأل قبل التنفيذ.
  function routeScanned(txt) {
    var t = String(txt || "").trim(), m;
    if ((m = t.match(/[?&]group=([A-Za-z0-9-]{8,80})/))) { whenReady(function () { linkConfirm("group", m[1]); }); return "group"; }
    if ((m = t.match(/[?&]room=([A-Za-z0-9]{8})/i))) { var R = global.SawaRTC, f = R && (R.prejoin || (R._r && R._r.prejoin)); if (f) f(m[1].toUpperCase()); else toast(L("الغرف غير متاحة الآن", "Rooms unavailable")); return "room"; }
    if ((m = t.match(/[?&]code=(\d{10})/)) || (m = t.replace(/[\s-]/g, "").match(/^(\d{10})$/))) { findSheet(m[1]); return "code"; }
    var tok = tokenFrom(t);
    if (tok) { whenReady(function () { linkConfirm("contact", tok); }); return "contact"; }
    // C84: دعوة العائلة (?join=) وبقيّة روابط سوا (محادثة/طلبات…) — تُفتح كما لو ضُغط الرابط
    var u = null; try { u = new URL(t); } catch (e) {}
    if (u && /(^|\.)sawaaap\.com$/i.test(u.hostname) || (u && u.origin === global.location.origin)) {
      if (u.searchParams.get("join")) {
        if (global.confirm(L("هذا رابط دعوة للانضمام إلى عائلة في «صلة رحم». الانضمام؟", "This is a family invite. Join?"))) {
          if (global.SawaSync && global.SawaSync.join) global.SawaSync.join(u.searchParams.get("join"), u.searchParams.get("p"), u.searchParams.get("pn"));   // C114
          else global.location.assign(global.location.origin + "/?join=" + encodeURIComponent(u.searchParams.get("join")));
        }
        return "join";
      }
      if (global.__sawaNativeOpen && global.__sawaNativeOpen(u.href) && (u.searchParams.get("chat") || u.searchParams.get("call") || u.searchParams.get("requests"))) return "link";
      if (!u.search || u.search === "?") { toast(L("هذا رابط موقع سوا", "That's the Sawa website")); return "site"; }
      global.location.assign(global.location.origin + "/" + u.search); return "link";
    }
    scannedSheet(t); return null;
  }
  // رمزٌ ليس من سوا: نعرض ما قُرئ بدل رسالةٍ مبهمة (فيُعرف أنّ الكاميرا قرأت فعلاً)
  function scannedSheet(t) {
    var s = sheet(L("قُرئ الرمز", "Code scanned"));
    s.box.appendChild(note(L("هذا الرمز ليس من سوا. محتواه:", "This isn't a Sawa code. It contains:")));
    var pre = mk("div", "margin:8px 0;padding:10px;border-radius:12px;background:#f3f4f6;color:#111827;font:600 13px system-ui;direction:ltr;text-align:left;word-break:break-all;white-space:pre-wrap;max-height:40vh;overflow:auto");
    pre.textContent = t; s.box.appendChild(pre);
    var b1 = mkBtn(L("نسخ", "Copy")); b1.onclick = function () { copyText(t); s.close(); }; s.box.appendChild(b1);
    if (/^https?:\/\//i.test(t)) { var b2 = mkBtn(L("فتح الرابط", "Open link"), "primary"); b2.style.marginTop = "8px"; b2.onclick = function () { s.close(); try { if (NB() && NB().openExternal) NB().openExternal(t); else global.open(t, "_blank"); } catch (e) {} }; s.box.appendChild(b2); }
  }
  function scanAny() {
    return scanQr().then(function (txt) { return txt ? routeScanned(txt) : null; })
      .catch(function (e) { toast(((e && e.message) || String(e)) + (lastScanErr ? " · " + lastScanErr.slice(0, 80) : "")); return null; });
  }
  function scanAndAdd() { return scanAny(); }

  // رابط ?contact= في عنوان الصفحة: يُقبل بعد الدخول ثمّ يُحذف من العنوان
  function handleContactParam() {
    var tok = null;
    try { tok = new URLSearchParams(global.location.search).get("contact"); } catch (e) {}
    if (!tok) return;
    try {
      var u = new URL(global.location.href); u.searchParams.delete("contact");
      global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash);
    } catch (e) {}
    whenReady(function () { afterOnb(function () { linkConfirm("contact", tok); }); });
  }
  // C14: الروابط لا تُنفَّذ وحدها — رابطٌ من غريب كان يضيفه إلى جهاتك (فيرى حالتك) أو يضمّك إلى مجموعته بلا سؤال
  function afterOnb(f) { (function w() { if (onbActive()) return setTimeout(w, 800); f(); })(); }
  function linkConfirm(kind, tok) {
    var contact = kind === "contact";
    var s = sheet(contact ? L("إضافة جهة اتّصال", "Add a contact") : L("الانضمام إلى مجموعة", "Join a group"));
    var body = mk("div", "text-align:center;margin:6px 0 4px"); s.box.appendChild(body);
    body.appendChild(note(L("جارٍ التحميل…", "Loading…")));
    function draw(b) {
      body.innerHTML = "";
      var nm = (b && b.name) || (contact ? L("مستخدم سوا", "Sawa user") : L("مجموعة", "Group"));
      var av = avatar(nm, 64); av.style.margin = "4px auto 8px"; body.appendChild(av);
      body.appendChild(mk("div", "font:800 18px system-ui", nm));
      if (!contact && b && b.count) body.appendChild(mk("div", "font:600 12.5px system-ui;color:#8796a5;margin-top:2px", L(b.count + " عضو", b.count + " members")));
      body.appendChild(note(contact
        ? L("فتحت رابطاً شخصيّاً. إن أضفته صار جهة اتّصال: يرى أنّك متّصل وآخر ظهورك، ويستطيع مراسلتك والاتّصال بك. أضِف من تعرفه فقط.",
            "You opened a personal link. Adding them lets them see when you're online and message or call you. Only add people you know.")
        : L("عند الانضمام يرى أعضاء المجموعة اسمك، ويصلك ما يُكتب فيها. انضمّ إلى المجموعات التي تعرف أصحابها فقط.",
            "Members will see your name and you'll get the group's messages. Only join groups you trust."), "#5b6b7c", "#f5f8fb"));
      var row = mk("div", "display:flex;gap:8px;margin-top:10px");
      var ok = mkBtn(contact ? L("أضِفه", "Add") : L("انضمّ", "Join"), "primary"), no = mkBtn(L("إلغاء", "Cancel"));
      ok.className = "sawa-link-ok";
      ok.onclick = function () {
        ok.disabled = true; ok.textContent = "…";
        (contact ? accept(tok) : joinGroup(tok).then(function (cid) { if (cid) whenApp(function () { setTimeout(function () { try { if (app.openChatById) app.openChatById(cid); } catch (e) {} }, 600); }); return cid; }))
          .then(function () { s.close(); });
      };
      no.onclick = function () { s.close(); };
      row.appendChild(ok); row.appendChild(no); s.box.appendChild(row);
    }
    call(contact ? "people.peek" : "group.peek", { token: tok }).then(function (b) {
      if (b.self) { s.close(); toast(L("هذا رابطك أنت 🙂", "That's your own link 🙂")); return; }
      if (b.already) { s.close(); toast(contact ? L("«" + (b.name || "") + "» في جهات اتّصالك سلفاً", "Already in your contacts") : L("أنت عضوٌ في «" + (b.name || "") + "» سلفاً", "You're already in this group"));
        if (!contact && b.cid) whenApp(function () { try { if (app.openChatById) app.openChatById(b.cid); } catch (e) {} }); return; }
      draw(b);
    }).catch(function (e) {
      var m = (e && e.message) || String(e);
      if (/unknown op|bad op/i.test(m)) { draw(null); return; }   // خادمٌ أقدم بلا معاينة: نسأل بلا اسم
      body.innerHTML = "";
      body.appendChild(note(/expired/.test(m) ? L("انتهت صلاحيّة هذا الرابط — اطلب رابطاً جديداً.", "This link has expired.")
        : /removed/.test(m) ? L("أزالك مشرفٌ من هذه المجموعة — لا تعود إلّا بإضافته.", "An admin removed you from this group.")
        : L("الرابط غير صحيح أو لم يعد صالحاً.", "This link is invalid."), "#b42318", "#fdecec"));
      var c = mkBtn(L("حسناً", "OK")); c.onclick = function () { s.close(); }; s.box.appendChild(c);
    });
  }

  // ==================================================================
  // C2: المحادثات — قائمة (chats where members ∋ أنا) · رسائل الأيّام · إرسالٌ متفائل بطابورٍ محفوظ ·
  //     وصلت/قُرئت · «يكتب…» (RTDB) · إعداداتي متزامنة بين أجهزتي
  // ==================================================================
  var chats = {}, chatsUnsub = null, dayUnsubs = {}, dayOrder = [], days = {}, pend = {}, virtualChats = {};
  var typingRefs = {}, typingNow = {}, openCid = null, prefs = null, prefsLoaded = false, prefsSent = "";
  var OUTBOX = "sawa_chat_outbox", DAYS_WINDOW = 7, MAX_DAY_LISTENERS = 6, savedAsked = false;
  function fsdb() { try { return firebase.firestore(); } catch (e) { return null; } }
  function isCloud(id) { return /^(dm_|sdm_|sv_|fam_|grp_)/.test(String(id || "")); }
  function appId(u) { return u === state.uid ? "u-1" : u; }
  function realId(u) { return u === "u-1" ? state.uid : u; }
  function newMsgId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function dmWith(other) { return "dm_" + [state.uid, other].sort().join("_"); }
  function others(c) { return (c.members || []).filter(function (u) { return u !== state.uid; }); }
  function chatTitle(cid) {   // C89: اسم المحادثة للقوائم (مشاركة إلى سوا)
    var c = chats[cid] || {};
    if (c.type === "saved") return L("رسائلي المحفوظة", "Saved messages");
    if (c.type === "dm" || c.type === "sdm") { var o = others(c)[0]; return o ? personName(o, c) : L("محادثة", "Chat"); }
    return c.name || L("مجموعة", "Group");
  }
  // C91: لا اسم حقيقيّ (لا اسم في سوا ولا تسمية منّي ولا اسم في المحادثة) ⇒ يظهر برمزه فقط
  function hasRealName(u, c) {
    if (!u || u === state.uid) return true;
    if (nickOf(u)) return true;
    var p = state.people.filter(function (x) { return x.uid === u; })[0];
    return !!((p && p.name) || (c && c.names && c.names[u]));
  }
  function personName(u, c) {
    if (u === state.uid) return L("أنت", "You");
    var p = state.people.filter(function (x) { return x.uid === u; })[0];
    if (p) return displayName(p);
    var n = nickOf(u) || (c && c.names && c.names[u]);
    return n || L("عضو", "Member") + " · " + guestTag(u);
  }
  function typeLabel(type) {
    return type === "voice" ? L("🎤 رسالة صوتيّة", "🎤 Voice message") : type === "image" ? L("📷 صورة", "📷 Photo")
      : type === "video" ? L("🎥 فيديو", "🎥 Video") : type === "file" ? L("📎 ملفّ", "📎 File") : type === "poll" ? L("📊 استطلاع", "📊 Poll")
      : type === "contact" ? L("👤 جهة اتّصال", "👤 Contact") : type === "bill" ? L("🧾 فاتورة", "🧾 Bill") : type === "fund" ? L("💝 تبرّعات", "💝 Fundraiser")
      : type === "tasks" ? L("✅ مهامّ", "✅ Tasks") : type === "location" ? L("📍 موقع", "📍 Location") : "";
  }
  function preview(m) {
    if (!m) return "";
    if (m.del) return L("🚫 حُذفت هذه الرسالة", "🚫 This message was deleted");
    if (!m.type || m.type === "text" || m.type === "sticker") return m.text || "";
    return typeLabel(m.type) || m.text || "";
  }
  function statusOf(c, ts) {
    var os = others(c); if (!os.length) return "read";
    var reads = c.reads || {}, del = c.delivered || {};
    if (os.every(function (u) { return (reads[u] || 0) >= ts; })) return "read";
    if (os.every(function (u) { return (del[u] || 0) >= ts || (reads[u] || 0) >= ts; })) return "delivered";
    return "sent";
  }
  function unreadOf(c) {
    if (c.cid === openCid && document.visibilityState !== "hidden") return 0;
    var n = (c.cnt || 0) - ((c.readCnt || {})[state.uid] || 0);
    return n > 0 ? n : 0;
  }

  // ---------- القائمة ----------
  function startChats(uid) {
    stopChats();
    var d = fsdb(); if (!d) return;
    chatsUnsub = d.collection("chats").where("members", "array-contains", uid).onSnapshot(function (snap) {
      var next = {};
      snap.forEach(function (doc) { var x = doc.data() || {}; x.cid = doc.id; next[doc.id] = x; });
      // C111: علامات الوصول والقراءة داخل المحادثة تُبنى من reads/delivered في وثيقة المحادثة — كانت لا تُعاد إلّا مع رسالةٍ جديدة،
      //       فيبقى خطٌّ واحد داخل المحادثة وفي القائمة خطّان (خالد). الآن: تغيّرا ⇒ نعيد رسم رسائل تلك المحادثة.
      Object.keys(next).forEach(function (cid) {
        var o = chats[cid], x = next[cid];
        if (o && days[cid] && (JSON.stringify(o.reads || {}) !== JSON.stringify(x.reads || {}) || JSON.stringify(o.delivered || {}) !== JSON.stringify(x.delivered || {}))) setTimeout(function () { publishMessages(cid); }, 0);
      });
      chats = next; chatsLoaded = true;
      e2eWatch();
      for (var v in virtualChats) if (chats[v]) delete virtualChats[v];
      // C23: رسالةٌ وصلت قبل أن تصلنا وثيقة المحادثة بمفتاح مرسلها ⇒ نعيد المحاولة الآن
      if (Object.keys(plain).some(function (pk) { return plain[pk] && plain[pk].retry; })) Object.keys(days).forEach(publishMessages);
      // «وصلت»: آخر رسالةٍ من غيري أحدث ممّا سجّلتُه
      Object.keys(chats).forEach(function (cid) {
        var c = chats[cid], l = c.last;
        if (l && l.by !== state.uid && l.ts > ((c.delivered || {})[state.uid] || 0)) queueMark(cid, { d: l.ts });
        // C140: وصلتني صورة/فيديو/رسالة صوتيّة ⇒ نحمّل أيّام المحادثة الآن (الوسائط تُنزَّل مسبقاً) بدل الانتظار حتّى تُفتح
        if (l && l.by !== state.uid && /^(image|video|voice)$/.test(l.type || "") && Date.now() - (l.ts || 0) < 86400000 && prefetched[cid] !== l.id) {
          prefetched[cid] = l.id; if (!dayUnsubs[cid]) ensureDays(cid); else publishMessages(cid);
        }
      });
      if (openCid && chats[openCid]) markRead(openCid);
      if (!savedAsked && !Object.keys(chats).some(function (k) { return chats[k].type === "saved"; })) { savedAsked = true; openSaved(); }
      syncTyping();
      publishChats();
    }, function (e) { log("chats:", e && e.code); });
  }
  function stopChats() {
    try { if (chatsUnsub) chatsUnsub(); } catch (e) {}
    chatsUnsub = null;
    Object.keys(dayUnsubs).forEach(function (cid) { try { dayUnsubs[cid](); } catch (e) {} });
    dayUnsubs = {}; dayOrder = []; days = {}; chats = {};
    Object.keys(typingRefs).forEach(function (cid) { try { typingRefs[cid].off(); } catch (e) {} });
    typingRefs = {}; typingNow = {};
  }
  // ---------- رسائل محادثةٍ مفتوحة: آخر ٧ أيّامٍ فيها رسائل (وثيقةٌ لكلّ يوم) ----------
  var prefetched = {};
  function ensureDays(cid) {
    var d = fsdb(); if (!d || !isCloud(cid) || !state.uid) return;
    dayOrder = dayOrder.filter(function (x) { return x !== cid; }); dayOrder.push(cid);
    if (dayUnsubs[cid]) return;
    while (dayOrder.length > MAX_DAY_LISTENERS) {
      var old = dayOrder.shift();
      if (dayUnsubs[old] && old !== openCid) { try { dayUnsubs[old](); } catch (e) {} delete dayUnsubs[old]; }
    }
    var coll = d.collection("chats").doc(cid).collection("days");
    var onDays = function (snap) {
      var m = {}; snap.forEach(function (doc) { m[doc.id] = (doc.data() || {}).msgs || {}; });
      days[cid] = m;
      // ما وصل صداه يخرج من المعلّق
      if (pend[cid]) pend[cid] = pend[cid].filter(function (p) { return !findMsg(cid, p.msg.id); });
      if (cid === openCid) markRead(cid);
      publishMessages(cid);
    };
    dayUnsubs[cid] = coll.orderBy(firebase.firestore.FieldPath.documentId(), "desc").limit(DAYS_WINDOW).onSnapshot(onDays, function (e) {
      log("days", cid, e && e.code);
      // احتياط: إن طلب Firestore فهرساً للترتيب التنازليّ نقرأ آخر ١٤ يوماً تصاعديّاً (لا يحتاج فهرساً)
      if (e && e.code === "failed-precondition") {
        var from = new Date(Date.now() - 14 * 86400000), key = from.getUTCFullYear() + String(from.getUTCMonth() + 1).padStart(2, "0") + String(from.getUTCDate()).padStart(2, "0");
        dayUnsubs[cid] = coll.orderBy(firebase.firestore.FieldPath.documentId()).startAt(key).onSnapshot(onDays, function (e2) { log("days2", cid, e2 && e2.code); });
      }
    });
  }
  function findMsg(cid, id) {
    var dd = days[cid] || {};
    for (var day in dd) if (dd[day][id]) return { day: day, msg: dd[day][id] };
    return null;
  }
  function openChat(cid) {
    if (!isCloud(cid)) return;
    openCid = cid; ensureDays(cid); markRead(cid); publishChats();
  }
  function closeChat(cid) { if (!cid || openCid === cid) openCid = null; }

  // ---------- وصلت/قُرئت (مجمَّعة) ----------
  var markQ = {}, markTimer = null;
  var markFails = 0;
  function queueMark(cid, m) {
    var q = markQ[cid] || (markQ[cid] = { cid: cid });
    for (var k in m) if (m[k] != null) q[k] = Math.max(q[k] || 0, m[k]);
    if (!markTimer) markTimer = setTimeout(flushMarks, 1200);
  }
  function flushMarks() {
    markTimer = null;
    var list = Object.keys(markQ).map(function (k) { return markQ[k]; }); markQ = {};
    if (!list.length || !state.uid) return;
    call("chat.mark", { marks: list }).then(function () { markFails = 0; }).catch(function (e) {   // C14: تُعاد (حتّى ٣ مرّات) بعد ٢٠ ثانية — كانت تضيع فلا تزرقّ علامات المرسل
      log("chat.mark:", (e && e.message) || e);
      if (++markFails <= 3) setTimeout(function () { list.forEach(function (x) { queueMark(x.cid, { r: x.r, rc: x.rc, d: x.d }); }); }, 20000);
    });
  }
  function markRead(cid) {
    var c = chats[cid];
    if (!c || document.visibilityState === "hidden") return;
    var lastTs = (c.last && c.last.ts) || 0, cnt = c.cnt || 0;
    var rc = (c.readCnt || {})[state.uid] || 0, r = (c.reads || {})[state.uid] || 0;
    if (rc >= cnt && r >= lastTs) return;
    c.readCnt = Object.assign({}, c.readCnt); c.readCnt[state.uid] = cnt;
    c.reads = Object.assign({}, c.reads); c.reads[state.uid] = lastTs;
    queueMark(cid, { r: lastTs, rc: cnt, d: lastTs });
  }

  // ---------- الإرسال: متفائل + طابورٌ محفوظ (يُعاد عند عودة الشبكة) ----------
  function send(cid, text, opts) {
    opts = opts || {};
    if (!isCloud(cid) || !state.uid) return null;
    if (e2eOn(chats[cid]) && e2eState(chats[cid]) !== "ready") { toast(e2eUi(chats[cid]).title || ""); return null; }   // C23
    var msg = { id: newMsgId(), type: opts.type || "text" };
    if (text != null) msg.text = String(text);
    if (opts.reply && opts.reply.id) {
      msg.reply = { id: opts.reply.id, by: realId(opts.reply.by || null), text: String(opts.reply.text || "").slice(0, 200) };
      var rf = findMsg(cid, opts.reply.id); if (rf) msg.reply.day = rf.day;   // C14: الخادم يأخذ نصّ الاقتباس من الأصل في ذلك اليوم
    }
    if (opts.fwd) msg.fwd = true;
    if (opts.contact) msg.contact = opts.contact;
    if (opts.mentions) msg.mentions = opts.mentions;
    else if (opts.mentionsFrom && text) { var mn = mentionsIn(cid, String(text)); if (mn) msg.mentions = mn; }
    if (opts.extra) msg.extra = opts.extra;
    (pend[cid] = pend[cid] || []).push({ msg: msg, ts: Date.now(), status: "pending" });
    var ob = lsGet(OUTBOX, []); ob.push({ uid: state.uid, cid: cid, msg: msg, ts: Date.now() }); lsSet(OUTBOX, ob);   // C100: ts ⇒ الترتيب بعد إعادة الفتح
    publishMessages(cid); publishChats();
    drainOutbox();
    return msg.id;
  }
  var draining = false, retryT = null;
  // حارس: إن علق طلبٌ (رغم المهلة) لا يبقى الطابور كلّه معلّقاً
  var drainAt = 0;
  function unstickOutbox() { if (draining && Date.now() - drainAt > 35000) { log("outbox: unstick"); draining = false; } }
  setInterval(function () { unstickOutbox(); if (!draining && myOutbox().length) drainOutbox(); }, 15000);
  // C14: الطابور لكلّ حساب — رسائل حسابٍ سابق على الجهاز لا تُرسل باسم الحساب الجديد. القديم بلا uid يُنسب لصاحب الجهاز الأخير.
  var FAILED = "sawa_chat_failed";
  function ownerOf(j) { if (j.uid) return j.uid; var c = lsGet("sawa_people_cache", null); return c && c.uid || null; }
  function myOutbox() { return lsGet(OUTBOX, []).filter(function (j) { return ownerOf(j) === state.uid; }); }
  // أخطاءٌ نهائيّة (رفضٌ صريح من الخادم) ⇒ «لم تُرسل» مع إعادة المحاولة. غيرها (شبكة/مهلة/خادم مشغول) ⇒ تبقى في الطابور
  var PERMANENT = /bad |not a member|too large|only |empty message|media not uploaded|media id required|chat not found|not a contact|removed|confirm required|encrypted payload|device not bound|no key on this device|secret chat|e2e key/i;
  function drainOutbox() {
    if (draining || !state.uid) return;
    var ob = myOutbox(); if (!ob.length) return;
    draining = true; drainAt = Date.now();
    var job = ob[0];
    var sentOk = function () {
      setPend(job.cid, job.msg.id, "sent");
      shiftOutbox(job.msg.id);
      // C100: محادثةٌ غير مفتوحة (توجيه/مشاركة) لا يصلها صدى الرسالة ⇒ لا نُبقي «المعلّقة» فتتجمّد معاينة القائمة وعلامة القراءة
      if (!dayUnsubs[job.cid]) { pend[job.cid] = (pend[job.cid] || []).filter(function (p) { return p.msg.id !== job.msg.id; }); publishChats(); }
    };
    wireOf(job).then(function (wm) { return call("chat.send", { cid: job.cid, msg: wm }); }).then(function () { sentOk(); }).catch(function (e) {
      var m = (e && e.message) || String(e);
      // C100: «الرقم مأخوذ» = وصلت فعلاً في محاولةٍ سابقة انقطع ردّها (مهلة) أو أرسلها تبويبٌ آخر ⇒ نجاح لا «لم تُرسل»
      if (/message id taken/i.test(m)) { sentOk(); return; }
      // C100: رسالةٌ عالقة لا تحجز الطابور كلّه: بعد ١٠ محاولات أو ٢٤ ساعة ⇒ «لم تُرسل» (مع إعادة المحاولة يدويّاً)
      var tries = bumpTries(job.msg.id);
      if (!PERMANENT.test(m) && tries < 10 && !(job.ts && Date.now() - job.ts > 86400000)) {        // الشبكة أو الخادم مؤقّتاً: نعيد لاحقاً
        draining = false;
        if (!retryT) retryT = setTimeout(function () { retryT = null; drainOutbox(); }, 4000);
        return "stop";
      }
      setPend(job.cid, job.msg.id, "failed"); shiftOutbox(job.msg.id);
      var fl = lsGet(FAILED, []).filter(function (x) { return x.msg.id !== job.msg.id; });
      fl.push({ uid: state.uid, cid: job.cid, msg: job.msg, err: m.slice(0, 120), ts: Date.now() }); lsSet(FAILED, fl.slice(-50));
      toast(L("لم تُرسل رسالة: ", "A message wasn't sent: ") + m + L(" — اضغط ⚠ عليها لإعادة المحاولة", " — tap ⚠ to retry"));
    }).then(function (r) { if (r === "stop") return; draining = false; drainOutbox(); });
  }
  function bumpTries(id) {
    var ob = lsGet(OUTBOX, []), n = 0;
    ob.forEach(function (x) { if (x.msg.id === id) { x.tries = (x.tries || 0) + 1; n = x.tries; } });
    lsSet(OUTBOX, ob); return n;
  }
  function shiftOutbox(id) { lsSet(OUTBOX, lsGet(OUTBOX, []).filter(function (x) { return x.msg.id !== id; })); }
  function setPend(cid, id, st) {
    (pend[cid] || []).forEach(function (p) { if (p.msg.id === id) p.status = st; });
    publishMessages(cid);
  }
  try { global.addEventListener("online", drainOutbox); } catch (e) {}
  function restorePending() {   // بعد إعادة الفتح: ما بقي في الطابور يظهر «قيد الإرسال»، وما رُفض «لم تُرسل» (C14: كان يختفي)
    var add = function (j, st) { if (ownerOf(j) !== state.uid) return; if (!(pend[j.cid] || []).some(function (p) { return p.msg.id === j.msg.id; })) (pend[j.cid] = pend[j.cid] || []).push({ msg: j.msg, ts: j.ts || Date.now(), status: st }); };
    lsGet(OUTBOX, []).forEach(function (j) { add(j, "pending"); });
    lsGet(FAILED, []).forEach(function (j) { add(j, "failed"); });
  }
  // C14: «لم تُرسل» ⇒ إعادة المحاولة أو الحذف
  function retryFailed(id) {
    for (var c0 in pend) { var pp = (pend[c0] || []).filter(function (p) { return p.msg.id === id && p.reupload; })[0]; if (pp) { pp.reupload(); return true; } }   // C18: وسيطٌ لم يُرفع ⇒ يُعاد رفعه
    var fl = lsGet(FAILED, []), j = fl.filter(function (x) { return x.msg.id === id && ownerOf(x) === state.uid; })[0];
    if (!j) { for (var cid in pend) (pend[cid] || []).forEach(function (p) { if (p.msg.id === id && p.status === "failed") j = { cid: cid, msg: p.msg }; }); }
    if (!j) return false;
    lsSet(FAILED, fl.filter(function (x) { return x.msg.id !== id; }));
    var ob = lsGet(OUTBOX, []); if (!ob.some(function (x) { return x.msg.id === id; })) { ob.push({ uid: state.uid, cid: j.cid, msg: j.msg, ts: Date.now() }); lsSet(OUTBOX, ob); }
    setPend(j.cid, id, "pending"); drainOutbox();
    return true;
  }
  function discardFailed(id) {
    lsSet(FAILED, lsGet(FAILED, []).filter(function (x) { return x.msg.id !== id; }));
    for (var cid in pend) { var n = (pend[cid] || []).length; pend[cid] = (pend[cid] || []).filter(function (p) { return p.msg.id !== id; }); if (pend[cid].length !== n) publishMessages(cid); }
  }
  function failedSheet(id) {
    var s = sheet(L("لم تُرسل هذه الرسالة", "This message wasn't sent"));
    var j = lsGet(FAILED, []).filter(function (x) { return x.msg.id === id; })[0];
    if (j && j.err) s.box.appendChild(note(L("السبب: ", "Reason: ") + j.err, "#b42318", "#fdecec"));
    var a = mkBtn(L("إعادة الإرسال", "Send again"), "primary"); a.onclick = function () { s.close(); retryFailed(id); };
    var b = mkBtn(L("حذفها", "Delete it"), "danger"); b.style.marginTop = "8px"; b.onclick = function () { s.close(); discardFailed(id); };
    s.box.appendChild(a); s.box.appendChild(b);
  }

  // ---------- أفعال الرسالة ----------
  function patchLocal(cid, id, fn) {
    var f = findMsg(cid, id); if (!f) return null;
    days[cid][f.day] = Object.assign({}, days[cid][f.day]); days[cid][f.day][id] = fn(Object.assign({}, f.msg));
    publishMessages(cid); return f.day;
  }
  function fail(e) { toast(L("تعذّر: ", "Failed: ") + ((e && e.message) || e)); }
  function notYet() { toast(L("لحظة — الرسالة لم تُحفظ بعد", "One moment — the message isn't saved yet")); }
  function edit(cid, id, text) {
    if (e2eOn(chats[cid])) {   // C23: نصٌّ مشفّرٌ جديد للرسالة نفسها (يبقى الاقتباس)
      var f0 = findMsg(cid, id); if (!f0 || !f0.msg.enc) return;
      var old = plain[encKey(cid, f0.msg)] || {}, np = { text: String(text) }; if (old.reply) np.reply = { id: old.reply.id, by: old.reply.by || null };
      e2e.encrypt(chats[cid], id, np).then(function (en) { return call("chat.edit", { cid: cid, day: f0.day, id: id, enc: en }); }).catch(function (e) { toast(e2eErrText(e)); });
      return;
    }
    var day = patchLocal(cid, id, function (m) { m.text = text; m.edited = Date.now(); return m; });
    if (!day) { notYet(); return; }
    call("chat.edit", { cid: cid, day: day, id: id, text: text }).catch(fail);
  }
  function deleteForAll(cid, id) {
    var day = patchLocal(cid, id, function (m) { return { id: m.id, by: m.by, ts: m.ts, type: m.type, del: true }; });
    if (!day) return;
    call("chat.delete", { cid: cid, day: day, id: id }).catch(fail);
  }
  function deleteForMe(cid, id) {
    prefs = prefs || {}; prefs.hidden = Object.assign({}, prefs.hidden); prefs.hidden[id] = 1;
    publishMessages(cid); savePrefs({ hidden: prefs.hidden });
  }
  // «حذف المحادثة» عندي: تُخفى رسائلها حتّى الآن، وتختفي من القائمة حتّى تصل رسالةٌ جديدة
  function clearChat(cid) {
    prefs = prefs || {}; prefs.cleared = Object.assign({}, prefs.cleared); prefs.cleared[cid] = Date.now();
    var c0 = chats[cid], lt = c0 && c0.last && c0.last.ts;   // C100: المحذوفة عندي تُعلَّم مقروءة (كان عدّاد أيقونة التطبيق يعلق)
    if (lt) queueMark(cid, { r: lt, rc: c0.cnt || 0, d: lt });
    publishMessages(cid); publishChats(); savePrefs({ cleared: prefs.cleared });
  }
  function react(cid, id, emoji) {
    var day = patchLocal(cid, id, function (m) { m.re = Object.assign({}, m.re); if (emoji) m.re[state.uid] = emoji; else delete m.re[state.uid]; return m; });
    if (!day) { notYet(); return; }
    call("chat.react", { cid: cid, day: day, id: id, emoji: emoji || null }).catch(fail);
  }
  function pin(cid, id) {
    var c = chats[cid]; if (!c) return;
    var next = c.pinned === id ? null : id; c.pinned = next; publishChats();
    call("chat.pin", { cid: cid, id: next }).catch(fail);
  }
  function setDisappear(cid, seconds) {
    var c = chats[cid]; if (c) { c.disappear = seconds; publishChats(); }
    return call("chat.settings", { cid: cid, disappear: seconds }).catch(fail);
  }
  function openDm(uid) {
    if (!state.uid || !uid) return Promise.resolve(null);
    var cid = dmWith(uid);
    if (!chats[cid]) virtualChats[cid] = { cid: cid, type: "dm", members: [state.uid, uid].sort(), names: {}, cnt: 0, updatedTs: Date.now(), virtual: true };
    publishChats();
    return call("chat.open", { to: uid }).then(function (b) { return b.cid; })
      .catch(function (e) { delete virtualChats[cid]; publishChats(); fail(e); return null; });
  }
  function openSaved() {
    if (!state.uid) return Promise.resolve(null);
    return call("chat.open", { saved: true }).then(function (b) { return b.cid; }).catch(function (e) { fail(e); return null; });
  }

  // ---------- «يكتب…» (Realtime Database: typing/{cid}/{uid}) ----------
  var lastTyping = {}, typingClear = {};
  function typing(cid) {
    var d = db(); if (!d || !isCloud(cid) || !state.uid) return;
    var now = Date.now();
    if (!lastTyping[cid] || now - lastTyping[cid] > 3000) {
      lastTyping[cid] = now;
      var ref = d.ref("typing/" + cid + "/" + state.uid);
      try { ref.onDisconnect().remove(); ref.set(firebase.database.ServerValue.TIMESTAMP); } catch (e) {}
    }
    clearTimeout(typingClear[cid]);
    typingClear[cid] = setTimeout(function () { lastTyping[cid] = 0; try { d.ref("typing/" + cid + "/" + state.uid).remove(); } catch (e) {} }, 5000);
  }
  function syncTyping() {
    var d = db(); if (!d) return;
    var want = Object.keys(chats).slice(0, 30);
    Object.keys(typingRefs).forEach(function (cid) { if (want.indexOf(cid) < 0) { try { typingRefs[cid].off(); } catch (e) {} delete typingRefs[cid]; delete typingNow[cid]; } });
    want.forEach(function (cid) {
      if (typingRefs[cid] || chats[cid].type === "saved") return;
      var ref = d.ref("typing/" + cid); typingRefs[cid] = ref;
      ref.on("value", function (s) { typingNow[cid] = s.val() || {}; publishTyping(); }, function () {});
    });
  }
  function typingList() {
    var now = Date.now(), out = [];
    Object.keys(typingNow).forEach(function (cid) {
      var t = typingNow[cid] || {};
      if (Object.keys(t).some(function (u) { return u !== state.uid && now - (t[u] || 0) < 8000; })) out.push(cid);
    });
    return out;
  }
  function whoTyping(cid) {
    var t = typingNow[cid] || {}, now = Date.now(), c = chats[cid];
    return Object.keys(t).filter(function (u) { return u !== state.uid && now - (t[u] || 0) < 8000; }).map(function (u) { return personName(u, c); });
  }
  var typingSig = "";
  function publishTyping() {
    var l = typingList(), sig = l.join(",");
    if (sig === typingSig || !app || !app.setTypingConversations) return;
    typingSig = sig; app.setTypingConversations(l);
  }
  setInterval(function () { if (Object.keys(typingNow).length) publishTyping(); }, 3000);

  // ---------- النشر للتطبيق ----------
  function chatList() {
    var all = Object.assign({}, virtualChats, chats), cleared = (prefs && prefs.cleared) || {};
    return Object.keys(all).map(function (k) { return all[k]; }).filter(function (c) {
      return !cleared[c.cid] || c.cid === openCid || ((c.last && c.last.ts) || 0) > cleared[c.cid] || (pend[c.cid] || []).length;
    });
  }
  function convOf(c) {
    var other = others(c)[0], l = c.last;
    var p = other && state.people.filter(function (x) { return x.uid === other; })[0];
    var pendList = pend[c.cid] || [], lp = pendList[pendList.length - 1];
    var lastMine = lp ? true : !!(l && l.by === state.uid);
    var sec = e2eOn(c);
    return {
      id: c.cid, cloud: true, kind: c.type, peerUid: other || null, unnamed: !!other && c.type !== "saved" && !hasRealName(other, c),
      name: c.type === "saved" ? L("رسائلي المحفوظة", "Saved messages") : personName(other, c) + (sec ? " 🔒" : ""),
      isSavedMessages: c.type === "saved", secret: sec, e2e: sec ? e2eUi(c) : null, photo: other ? photoOf(other) : null,
      lastMessage: lp ? preview(lp.msg) : sec ? secretPreview(c) : preview(l), lastFromMe: lastMine,
      lastStatus: lp ? lp.status : (l && l.by === state.uid ? statusOf(c, l.ts) : null),
      unread: unreadOf(c), updatedAt: lp ? lp.ts : (c.updatedTs || 0), pinnedMessageId: c.pinned || null,
      disappear: c.disappear || 0, online: !!(p && state.presence[other] && state.presence[other].state === "online")
    };
  }
  function groupOf(c) {
    var admins = c.admins || [], l = c.last;
    var members = (c.members || []).map(function (u) {
      return { id: appId(u), uid: u, unnamed: !hasRealName(u, c), name: u === state.uid ? L("أنت", "You") : personName(u, c), role: admins.indexOf(u) >= 0 ? "admin" : "member", photo: photoOf(u) };
    });
    var pendList = pend[c.cid] || [], lp = pendList[pendList.length - 1];
    var sec = e2eOn(c);
    var lastText = lp ? preview(lp.msg) : (l ? (l.type === "system" ? sysText({ by: l.by, extra: { ev: l.ev } }, c).replace(/«»|“”/g, "").trim() : (l.by && l.by !== state.uid ? personName(l.by, c) + ": " : "") + (sec ? secretPreview(c) : preview(l))) : (sec ? secretPreview(c) : ""));
    return { id: c.cid, cloud: true, kind: c.type, familyGroupId: c.familyGroupId || null, desc: c.desc || "", adminsOnly: !!c.adminsOnly, infoAdminsOnly: !!c.infoAdminsOnly,
      name: (c.name || L("مجموعة", "Group")) + (sec ? " 🔒" : ""), members: members, lastMessage: lastText, secret: sec, e2e: sec ? e2eUi(c) : null,
      unread: unreadOf(c), updatedAt: lp ? lp.ts : (c.updatedTs || 0), pinnedMessageId: c.pinned || null, disappear: c.disappear || 0,
      photo: c.type === "group" || c.type === "family" ? groupPhotoOf(c) : null };   // C155 · C159: والعائلة
  }
  var pubChatsT = null;
  function publishChats() {
    if (!app || pubChatsT) return;
    pubChatsT = setTimeout(function () {
      pubChatsT = null;
      var list = chatList();
      var convs = list.filter(function (c) { return c.type === "dm" || c.type === "saved"; }).map(convOf)
        .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      var groups = list.filter(function (c) { return c.type === "family" || c.type === "group"; }).map(groupOf)
        .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      try { if (app.setConversations) app.setConversations(convs); } catch (e) {}
      appBadge();
      try { if (app.setGroups) app.setGroups(groups); } catch (e) {}
    }, 40);
  }
  function appMessages(cid) {
    var c = chats[cid] || virtualChats[cid] || { members: [] }, hidden = (prefs && prefs.hidden) || {};
    var clearedAt = (prefs && prefs.cleared && prefs.cleared[cid]) || 0;
    var dd = days[cid] || {}, arr = [], now = Date.now();   // C14: المؤقّتة تختفي عند انتهاء أجلها (لا تنتظر تنظيف الخادم)
    Object.keys(dd).forEach(function (day) { var mm = dd[day]; Object.keys(mm).forEach(function (id) { var m = mm[id]; if (m && !hidden[id] && (m.ts || 0) > clearedAt && !(m.exp && m.exp < now)) arr.push({ m: m, day: day }); }); });
    if (e2eOn(c)) {
      arr = arr.filter(function (x) { var m0 = x.m; return !(m0.type === "system" && m0.extra && m0.extra.ev === "e2e_rekey" && m0.by !== state.uid); });
      (lsGet(NOTES, {})[cid] || []).forEach(function (n) { if (n.ts > clearedAt) arr.push({ m: { id: n.id, by: "", ts: n.ts, type: "system", extra: { ev: "local" }, text: n.text } }); });
    }
    (pend[cid] || []).forEach(function (p) { if (!hidden[p.msg.id]) arr.push({ m: Object.assign({ by: state.uid, ts: p.ts }, p.msg), pending: p.status, progress: p.uploading ? (p.progress || 0) : null }); });
    arr.sort(function (a, b) { return (a.m.ts || 0) - (b.m.ts || 0); });
    var group = c.type === "family" || c.type === "group";
    return arr.map(function (x) {
      var m = x.m.enc && !x.m.del ? plainOf(cid, x.m) : x.m, mine = m.by === state.uid, re = m.re || {};
      var mineRe = re[state.uid], anyRe = Object.keys(re).map(function (k) { return re[k]; })[0];
      var o = { id: m.id, day: x.day || null, createdAt: m.ts, text: m.del ? L("🚫 حُذفت هذه الرسالة", "🚫 This message was deleted") : (m.text || ""),
                type: m.del ? "text" : (m.type === "text" ? undefined : m.type), deleted: !!m.del, edited: !!m.edited,
                forwarded: !!m.fwd, reaction: mineRe || anyRe || null, reactions: re, replyTo: m.reply || null,
                replyToText: m.reply ? (m.reply.missing ? L("رسالة غير متاحة", "Message unavailable") : m.reply.del ? L("🚫 رسالة محذوفة", "🚫 Deleted message") : m.reply.text) : null, contact: m.contact || null, extra: m.extra || null, cloud: true,
                starred: !!(prefs && prefs.starred && prefs.starred.some(function (s) { return s.id === m.id; })) };
      if (group) { o.senderId = appId(m.by); o.senderName = personName(m.by, c); if (o.type === undefined) o.type = "text"; if (!m.del) toolShape(m, o, c); }
      else { o.senderUserId = appId(m.by); if (m.type === "system") { o.type = "system"; o.text = sysText(m, c); } }   // C23: إشعارات المحادثة السرّيّة في المحادثة الفرديّة
      if (m.e2eErr) o.e2eErr = true;
      if (!m.del && MEDIA_TYPES.indexOf(m.type) >= 0) mediaShape(m, o, cid, mine);
      if (!m.del && m.type === "location" && m.extra) { o.type = "location"; o.lat = Number(m.extra.lat); o.lng = Number(m.extra.lng); o.acc = m.extra.acc || null; o.text = m.extra.label || ""; }
      if (mine) o.status = x.pending ? (x.pending === "failed" ? "failed" : "pending") : statusOf(c, m.ts);
      if (x.progress != null) o.uploadPct = x.progress;   // نسبة رفع الوسيط (تظهر بدل الساعة)
      return o;
    });
  }
  var pubMsgT = {};
  function publishMessages(cid) {
    if (!app || pubMsgT[cid]) return;
    pubMsgT[cid] = setTimeout(function () {
      delete pubMsgT[cid];
      var c = chats[cid] || virtualChats[cid] || {}, list = appMessages(cid);
      var group = c.type === "family" || c.type === "group";
      var setter = group ? app.setGroupMessages : app.setMessagesByConversation;
      if (setter) try { setter(function (prev) { var o = {}; for (var k in (prev || {})) if (isCloud(k)) o[k] = prev[k]; o[cid] = list; return o; }); } catch (e) {}
      publishChats();
    }, 30);
  }

  // ---------- إعداداتي في المحادثات (بين أجهزتي) ----------
  var PREF_SETTERS = { archived: "setArchivedConversations", pinned: "setPinnedConversations", muted: "setMutedConversations",
    locked: "setLockedConversationIds", folders: "setChatFolders", folderOf: "setFolderAssignments", themes: "setChatThemes",
    tones: "setConversationTones", starred: "setStarredMessages", blocked: "setBlockedConversations", broadcasts: "setBroadcastLists" };
  function loadPrefs(pre) {
    return (pre ? Promise.resolve(pre) : call("chat.prefs", {})).then(function (b) {
      prefs = b.prefs || {}; prefsLoaded = true;
      var applied = {};
      Object.keys(PREF_SETTERS).forEach(function (k) {
        if (!(k in prefs)) return;
        var v = k === "blocked" ? (prefs.blocked || []).map(dmWith) : prefs[k];
        applied[k] = v;
        try { if (app && app[PREF_SETTERS[k]]) app[PREF_SETTERS[k]](v); } catch (e) {}
      });
      prefsSent = JSON.stringify(normPrefs(applied));
      Object.keys(days).forEach(publishMessages); publishChats(); publish();   // التسميات تظهر في جهات الاتّصال
    }).catch(function (e) { log("prefs:", (e && e.message) || e); });
  }
  function normPrefs(o) {
    var out = {};
    Object.keys(PREF_SETTERS).forEach(function (k) {
      if (o[k] === undefined) return;
      if (k === "starred") { out[k] = (o.starred || []).map(function (x) { return x && (knownSecret(x.conversationId) || e2eOn(chats[x.conversationId])) ? Object.assign({}, x, { text: "🔒" }) : x; }); return; }
      out[k] = k === "blocked" ? (o.blocked || []).filter(function (id) { return /^s?dm_/.test(id); }).map(function (id) { if (/^sdm_/.test(id)) { var sc = chats[id]; return sc ? others(sc)[0] : null; } return id.slice(3).split("_").filter(function (u) { return u !== state.uid; })[0]; }).filter(Boolean)
        : o[k];
    });
    return out;
  }
  var prefsT = null, prefsPending = {};
  function savePrefs(partial) {
    Object.assign(prefsPending, partial);
    clearTimeout(prefsT);
    prefsT = setTimeout(function () {
      var set = prefsPending; prefsPending = {};
      call("chat.prefs", { set: set }).catch(function (e) { log("prefs save:", (e && e.message) || e); });
    }, 1500);
  }
  // يستدعيه التطبيق عند تغيّر أيٍّ من إعداداته (بعد التحميل الأوّل فقط — لا نكتب فوق الخادم بنسخةٍ قديمة)
  function observePrefs(appPrefs) {
    if (!prefsLoaded || !state.uid) return;
    var n = normPrefs(appPrefs || {}), sig = JSON.stringify(n);
    if (sig === prefsSent) return;
    var old = {}; try { old = JSON.parse(prefsSent || "{}"); } catch (e) {}
    var diff = {}; Object.keys(n).forEach(function (k) { if (JSON.stringify(n[k]) !== JSON.stringify(old[k])) diff[k] = n[k]; });
    prefsSent = sig;
    if (n.blocked) { prefs = prefs || {}; prefs.blocked = n.blocked; }
    if (n.starred) { prefs = prefs || {}; prefs.starred = n.starred; if (diff.starred) Object.keys(days).forEach(publishMessages); }
    if (Object.keys(diff).length) savePrefs(diff);
  }

  // ==================================================================
  // C3: المجموعات وأدواتها (استطلاع · فاتورة · تبرّعات · مهامّ) · رسائل النظام · الإشارات @ · روابط دعوة المجموعات
  // ==================================================================
  function createGroup(name, uids) {
    return call("group.new", { name: name, members: (uids || []).map(realId) }).then(function (b) {
      if (b.skipped && b.skipped.length) toast(L("لم يُضف " + b.skipped.length + " (ليسوا من جهات اتّصالك)", b.skipped.length + " not added (not your contacts)"));
      return b.cid;
    }).catch(function (e) { fail(e); return null; });
  }
  function updateGroup(cid, patch) {
    var c = chats[cid]; if (c) { Object.assign(c, patch); publishChats(); }
    return call("group.update", Object.assign({ cid: cid }, patch)).catch(fail);
  }
  function addMembers(cid, uids) { return call("group.members", { cid: cid, add: (uids || []).map(realId) }).catch(fail); }
  function removeMember(cid, uid) { return call("group.members", { cid: cid, remove: [realId(uid)] }).catch(fail); }
  function setAdmin(cid, uid, on) { return call("group.admin", { cid: cid, uid: realId(uid), admin: !!on }).catch(fail); }
  function leaveGroup(cid) { closeChat(cid); return call("group.exit", { cid: cid }).catch(fail); }
  function shareGroupInvite(cid) {
    toast(L("جارٍ إنشاء الرابط…", "Creating link…"));
    return call("group.invite", { cid: cid }).then(function (b) {
      var url = global.location.origin + global.location.pathname.replace(/index\.html$/, "") + "?group=" + b.token;
      var name = (chats[cid] && chats[cid].name) || "";
      var text = L("انضمّ إلى مجموعة «" + name + "» في سوا (صالح أسبوعاً):", "Join the «" + name + "» group on Sawa (valid for a week):");
      if (global.navigator && navigator.share) return navigator.share({ title: "سوا", text: text, url: url }).catch(function () {});
      if (global.navigator && navigator.clipboard) return navigator.clipboard.writeText(text + " " + url).then(function () { toast(L("نُسخ الرابط ✓", "Link copied ✓")); });
      global.prompt(L("انسخ الرابط:", "Copy the link:"), url);
    }).catch(fail);
  }
  function joinGroup(tok) {
    return call("group.join", { token: tok }).then(function (b) {
      toast(b.already ? L("أنت عضوٌ في «" + (b.name || "") + "» سلفاً", "You're already in «" + (b.name || "") + "»") : L("انضممت إلى «" + (b.name || "") + "» ✓", "You joined «" + (b.name || "") + "» ✓"));
      return b.cid;
    }).catch(function (e) {
      var m = (e && e.message) || String(e);
      toast(/expired/.test(m) ? L("انتهت صلاحيّة رابط المجموعة", "The group link expired") : /not found/.test(m) ? L("رابط المجموعة غير صحيح", "Invalid group link") : L("تعذّر الانضمام: ", "Couldn't join: ") + m);
      return null;
    });
  }
  // الإشارات: @الاسم في النصّ ⇒ معرّفات الأعضاء (للإشعارات في C5)
  function mentionsIn(cid, text) {
    var c = chats[cid]; if (!c || !text || text.indexOf("@") < 0) return null;
    var out = [];
    (c.members || []).forEach(function (u) {
      if (u === state.uid) return;
      var n = personName(u, c);
      if (n && text.indexOf("@" + n) >= 0) out.push(u);
    });
    return out.length ? out : null;
  }
  // أدوات المجموعة: تُرسَل رسائل بنوعٍ خاصّ، والتفاعل معها حقلٌ لكلّ شخص
  function sendPoll(cid, question, options, deadline, anonymous) {
    return send(cid, null, { type: "poll", extra: { question: String(question), options: (options || []).map(String), deadline: deadline || null, anonymous: !!anonymous } });
  }
  function toolCall(op, cid, id, extra, local) {
    var day = local ? patchLocal(cid, id, local) : (findMsg(cid, id) || {}).day;
    if (!day) { toast(L("لحظة — الرسالة لم تُحفظ بعد", "One moment — the message isn't saved yet")); return; }
    call(op, Object.assign({ cid: cid, day: day, id: id }, extra)).catch(fail);
  }
  // C16: الاستطلاع المجهول — صوتي مخزَّنٌ تحت مفتاحٍ لا يعرفه غيري؛ أعرف مفتاحي من الخادم (يُحفظ على الجهاز)
  var PKEYS = "sawa_poll_keys", pkWant = {}, pkT = null;
  function pollKey(id) { var k = lsGet(PKEYS, {}); return k[state.uid + ":" + id] || null; }
  function savePollKey(id, key) { var k = lsGet(PKEYS, {}); k[state.uid + ":" + id] = key; var ks = Object.keys(k); if (ks.length > 400) delete k[ks[0]]; lsSet(PKEYS, k); }
  function wantPollKey(cid, id) {
    if (pollKey(id) || pkWant[id]) return;
    pkWant[id] = cid;
    if (!pkT) pkT = setTimeout(function () {
      pkT = null; var by = {};
      Object.keys(pkWant).forEach(function (i) { if (pkWant[i] !== true) { (by[pkWant[i]] = by[pkWant[i]] || []).push(i); pkWant[i] = true; } });
      Object.keys(by).forEach(function (c) {
        call("chat.pollKeys", { cid: c, ids: by[c].slice(0, 50) }).then(function (b) {
          Object.keys((b && b.keys) || {}).forEach(function (i) { savePollKey(i, b.keys[i]); }); publishMessages(c);
        }).catch(function () {});
      });
    }, 300);
  }
  function vote(cid, id, idx) {
    var f = findMsg(cid, id), anon = !!(f && f.msg.extra && f.msg.extra.anonymous), key = anon ? pollKey(id) : state.uid;
    var day = key ? patchLocal(cid, id, function (m) { m.votes = Object.assign({}, m.votes); if (anon) delete m.votes[state.uid]; m.votes[key] = idx; return m; }) : (f || {}).day;
    if (!day) { toast(L("لحظة — الرسالة لم تُحفظ بعد", "One moment — the message isn't saved yet")); return; }
    call("chat.vote", { cid: cid, day: day, id: id, option: idx }).then(function (b) { if (b && b.key) { savePollKey(id, b.key); publishMessages(cid); } }).catch(fail);
  }
  function editPoll(cid, id, question, options) { toolCall("chat.pollEdit", cid, id, { question: question, options: options }); }
  function sendBill(cid, description, totalAmount, participantAmounts, splitType) {
    var c = chats[cid] || {};
    var parts = Object.keys(participantAmounts || {}).map(function (aid) { var u = realId(aid); return { uid: u, name: personName(u, c), share: Number(participantAmounts[aid]) || 0 }; });
    return send(cid, null, { type: "bill", extra: { description: String(description), totalAmount: Number(totalAmount) || 0, participants: parts, splitType: splitType || "equal" } });
  }
  function billPaid(cid, id, uid) {
    var who = realId(uid || "u-1");
    toolCall("chat.billPaid", cid, id, { uid: who }, function (m) { m.paid = Object.assign({}, m.paid); m.paid[who] = Date.now(); return m; });
  }
  function sendFund(cid, cause, goal, deadline) { return send(cid, null, { type: "fund", extra: { cause: String(cause), goal: Number(goal) || 0, deadline: deadline || null } }); }
  function contribute(cid, id, amount) {
    toolCall("chat.fund", cid, id, { amount: amount }, function (m) { m.contrib = Object.assign({}, m.contrib); var p = m.contrib[state.uid] || { amount: 0 }; m.contrib[state.uid] = { amount: p.amount + amount, ts: Date.now() }; return m; });
  }
  function sendTasks(cid, title, tasks) {
    return send(cid, null, { type: "tasks", extra: tasksClean(title, tasks) });
  }
  // C164: تعديل قائمة المهامّ (منشئها أو المشرف) — في السرّيّة: المحتوى مشفّرٌ من جديد للرسالة نفسها
  function tasksClean(title, tasks) {
    return { title: String(title || "").slice(0, 200), tasks: (tasks || []).slice(0, 50).map(function (t, i) { return { id: t.id || ("t" + Date.now().toString(36) + i), text: String(t.text || "").slice(0, 300), assigneeId: t.assigneeId ? realId(t.assigneeId) : null, assigneeName: t.assigneeName || "", dueAt: t.dueAt || null }; }) };
  }
  function editTasks(cid, id, title, tasks) {
    var f = findMsg(cid, id); if (!f) { notYet(); return Promise.resolve(null); }
    var ex = tasksClean(title, tasks);
    if (e2eOn(chats[cid])) {
      return e2e.encrypt(chats[cid], id, { extra: ex }).then(function (en) { return call("chat.tasksEdit", { cid: cid, day: f.day, id: id, enc: en }); }).catch(function (e) { toast(e2eErrText(e)); });
    }
    patchLocal(cid, id, function (m) { m.extra = Object.assign({}, m.extra, ex, { editedAt: Date.now() }); return m; });
    return call("chat.tasksEdit", Object.assign({ cid: cid, day: f.day, id: id }, ex)).catch(fail);
  }
  function setTask(cid, id, taskId, patch) {
    if (patch && patch.note != null && e2eOn(chats[cid])) { toast(L("الملاحظات غير متاحة في المحادثة السرّيّة (تبقى المهمّة نفسها مشفّرة)", "Notes aren't available in secret chats")); return; }   // C164
    toolCall("chat.task", cid, id, Object.assign({ taskId: taskId }, patch), function (m) { m.tstate = Object.assign({}, m.tstate); m.tstate[taskId] = Object.assign({}, m.tstate[taskId], patch); return m; });
  }
  // نصّ رسائل النظام
  function sysText(m, c) {
    var ex = m.extra || {}, who = personName(m.by, c);
    var list = (ex.who || []).map(function (u) { return personName(u, c); }).join(L("، ", ", "));
    var T = {
      created: L(who + " أنشأ المجموعة «" + (ex.name || "") + "»", who + " created the group “" + (ex.name || "") + "”"),
      added: L(who + " أضاف " + list, who + " added " + list), removed: L(who + " أزال " + list, who + " removed " + list),
      left: L(who + " غادر", who + " left"), joined: L(who + " انضمّ عبر رابط الدعوة", who + " joined via the invite link"),
      admin: L(who + " جعل " + list + " مشرفاً", who + " made " + list + " an admin"), unadmin: L(who + " أزال إشراف " + list, who + " removed " + list + " as admin"),
      renamed: L(who + " غيّر الاسم إلى «" + (ex.name || "") + "»", who + " renamed the group to “" + (ex.name || "") + "”"),
      desc: L(who + " غيّر الوصف", who + " changed the description"),
      photo: ex.on !== false ? L(who + " غيّر صورة المجموعة", who + " changed the group photo") : L(who + " أزال صورة المجموعة", who + " removed the group photo"),   // C155
      adminsOnly: ex.on ? L(who + " جعل الإرسال للمشرفين فقط", who + " allowed only admins to send") : L(who + " سمح للجميع بالإرسال", who + " allowed everyone to send"),
      vc_on: m.by === state.uid ? L("🎙 بدأتَ دردشةً صوتيّة", "🎙 You started a voice chat") : L("🎙 " + who + " بدأ دردشةً صوتيّة — انضمّ من الشريط أعلى المحادثة", "🎙 " + who + " started a voice chat — join from the bar at the top"),
      // C23
      local: m.text || "",
      e2e_on: m.by === state.uid ? L("🔒 بدأتَ محادثةً سرّيّة — مشفّرة بين الأجهزة، ولا يقرؤها خادم سوا", "🔒 You started a secret chat — end-to-end encrypted")
        : L("🔒 " + who + " بدأ محادثةً سرّيّة — مشفّرة بين الأجهزة، ولا يقرؤها خادم سوا", "🔒 " + who + " started a secret chat — end-to-end encrypted"),
      e2e_join: m.by === state.uid ? L("🔒 فعّلتَ المحادثة السرّيّة على هذا الجهاز", "🔒 You turned on the secret chat on this device") : L("🔒 " + who + " فعّل المحادثة السرّيّة على جهازه", "🔒 " + who + " turned on the secret chat"),
      e2e_rekey: m.by === state.uid ? L("🔐 نقلتَ المحادثة السرّيّة إلى جهازٍ جديد", "🔐 You moved the secret chat to a new device")
        : L("🔐 تغيّر رمز الأمان مع " + who + " (جهازٌ جديد) — قارنه من جديد إن أردت التأكّد", "🔐 Your safety code with " + who + " changed (new device)")
    };
    return T[ex.ev] || "";
  }
  // رسائل الأدوات بالشكل الذي تعرفه واجهة المجموعة
  function toolShape(m, o, c) {
    var ex = m.extra || {};
    if (m.type === "system") { o.type = "system"; o.text = sysText(m, c); return o; }
    if (m.type === "poll") {
      var votes = m.votes || {};
      o.type = "poll"; o.question = ex.question || ""; o.creatorId = appId(m.by); o.deadline = ex.deadline || null; o.anonymous = !!ex.anonymous; o.editedAt = ex.editedAt || null;
      var mine = ex.anonymous ? pollKey(m.id) : null;
      if (ex.anonymous && !mine && c && c.cid) wantPollKey(c.cid, m.id);
      // المجهول: لا هويّات — «أنا» إن كان المفتاح مفتاحي، والبقيّة معرّفاتٌ صمّاء للعدّ فقط
      var who = function (u) { return !ex.anonymous ? appId(u) : (u === mine || u === state.uid) ? appId(state.uid) : "anon:" + u.slice(-6); };
      o.options = (ex.options || []).map(function (text, i) { return { text: text, votes: Object.keys(votes).filter(function (u) { return votes[u] === i; }).map(who) }; });
      return o;
    }
    if (m.type === "bill") {
      var paid = m.paid || {};
      o.type = "billSplit"; o.description = ex.description || ""; o.totalAmount = ex.totalAmount || 0; o.splitType = ex.splitType || "equal";
      o.participants = (ex.participants || []).map(function (p) { return { userId: appId(p.uid), name: personName(p.uid, c), share: p.share || 0, paid: !!paid[p.uid], paidAt: paid[p.uid] || null }; });
      return o;
    }
    if (m.type === "fund") {
      var contrib = m.contrib || {}, ks = Object.keys(contrib);
      o.type = "fundraiser"; o.cause = ex.cause || ""; o.goal = ex.goal || 0; o.deadline = ex.deadline || null;
      o.raised = ks.reduce(function (s, u) { return s + (contrib[u].amount || 0); }, 0);
      o.contributions = ks.map(function (u) { return { name: personName(u, c), amount: contrib[u].amount || 0, ts: contrib[u].ts || 0 }; }).sort(function (a, b) { return b.ts - a.ts; });
      return o;
    }
    if (m.type === "tasks") {
      var ts = m.tstate || {};
      o.type = "taskList"; o.title = ex.title || ""; o.creatorId = appId(m.by); o.secret = !!(c && e2eOn(c)); o.editedAt = ex.editedAt || m.edited || null;   // C164
      o.tasks = (ex.tasks || []).map(function (t) { var s = ts[t.id] || {}; return { id: t.id, text: t.text, assigneeId: appId(t.assigneeId), assigneeName: t.assigneeName || personName(t.assigneeId, c), dueAt: t.dueAt || null, status: s.status || "pending", note: s.note || "" }; });
      return o;
    }
    return o;
  }
  function handleGroupParam() {
    var tok = null;
    try { tok = new URLSearchParams(global.location.search).get("group"); } catch (e) {}
    if (!tok) return;
    try { var u = new URL(global.location.href); u.searchParams.delete("group"); global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (e) {}
    whenReady(function () { afterOnb(function () { linkConfirm("group", tok); }); });
  }

  // ==================================================================
  // C4: الوسائط — صور (تُصغَّر) · فيديو · صوت · ملفّات (≤ ١٦ MB) · مشاهدة مرّة واحدة
  //     الرفع: الجهاز يكتب chats/{cid}/media/{mid} (+ قطع base64 ≤ ٧٠٠ ألف حرف في c/{i}) مباشرةً (القواعد تسمح للعضو المالك)،
  //     ثمّ يُرسل الرسالة عبر الـWorker (يتحقّق أنّ الوسيط له واكتمل). التنزيل عند الحاجة، ويُحفظ في IndexedDB.
  // ==================================================================
  var CHUNK = 700000, MAX_MEDIA = 16 * 1024 * 1024, AUTO_DL = 5 * 1024 * 1024;
  var mediaUrls = {}, mediaLoading = {}, localUrls = {}, mediaFailed = {};
  var MEDIA_TYPES = ["image", "video", "voice", "file"];
  function newMediaId() { return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result || ""); res(s.slice(s.indexOf(",") + 1)); };
      r.onerror = function () { rej(new Error("read")); };
      r.readAsDataURL(blob);
    });
  }
  function b64ToBlob(b64, mime) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime || "application/octet-stream" });
  }
  function dataUrlToBlob(du) { var i = du.indexOf(","), mime = (du.slice(5, i).split(";")[0]) || "application/octet-stream"; return b64ToBlob(du.slice(i + 1), mime); }
  // ⛔ document.createElement("img") لا new Image() — sawa-app يحجب Image (انظر BUILD.md)
  function loadImg(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), img = document.createElement("img");
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("decode")); };
      img.src = url;
    });
  }
  function drawTo(src, w, h, maxSide) {
    var sc = Math.min(1, maxSide / Math.max(w, h)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
    var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function canvasBlob(c, q) { return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/jpeg", q); }); }
  function smallThumb(src, w, h) {   // ≤ ٦٠٠٠ حرف: معاينةٌ فوريّة داخل الرسالة نفسها
    var sizes = [96, 72, 56], qs = [0.5, 0.4, 0.3];
    for (var i = 0; i < sizes.length; i++) { var d = drawTo(src, w, h, sizes[i]).toDataURL("image/jpeg", qs[i]); if (d.length <= 6000) return d; }
    return null;
  }
  function prepareImage(blob) {
    if (/gif/.test(blob.type) && blob.size < 2 * 1024 * 1024) return loadImg(blob).then(function (r) { var th = smallThumb(r.img, r.img.naturalWidth, r.img.naturalHeight); URL.revokeObjectURL(r.url); return { blob: blob, thumb: th, w: r.img.naturalWidth, h: r.img.naturalHeight }; });
    return loadImg(blob).then(function (r) {
      var w = r.img.naturalWidth, h = r.img.naturalHeight, c = drawTo(r.img, w, h, 1280), th = smallThumb(r.img, w, h);
      URL.revokeObjectURL(r.url);
      return canvasBlob(c, 0.78).then(function (b) { return { blob: b && b.size < blob.size ? b : blob, thumb: th, w: c.width, h: c.height }; });
    });
  }
  function prepareVideo(blob) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(blob), v = document.createElement("video"), done = false;
      var finish = function (th, dur, w, h) { if (done) return; done = true; URL.revokeObjectURL(url); res({ blob: blob, thumb: th, duration: dur, w: w, h: h }); };
      v.muted = true; v.playsInline = true; v.preload = "metadata";
      v.onloadeddata = function () { try { v.currentTime = Math.min(0.2, (v.duration || 1) / 2); } catch (e) { finish(null, v.duration, v.videoWidth, v.videoHeight); } };
      v.onseeked = function () { var th = null; try { th = smallThumb(v, v.videoWidth, v.videoHeight); } catch (e) {} finish(th, v.duration, v.videoWidth, v.videoHeight); };
      v.onerror = function () { finish(null, null, null, null); };
      setTimeout(function () { finish(null, null, null, null); }, 6000);
      v.src = url;
    });
  }
  // kind: image | video | voice | file · src: Blob/File أو dataURL
  // C32: مشاركة الموقع — يُطلب من الجهاز (دقّةٌ عالية، ١٥ ثانية) ويُرسل كرسالة «location» (وتُشفَّر في السرّيّة كغيرها)
  function sendLocation(cid, label) {
    if (!isCloud(cid) || !state.uid) return Promise.resolve(null);
    if (!(global.navigator && navigator.geolocation)) { toast(L("هذا الجهاز لا يدعم تحديد الموقع", "Location isn't supported on this device")); return Promise.resolve(null); }
    toast(L("📍 جارٍ تحديد موقعك…", "📍 Getting your location…"));
    return new Promise(function (res) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        var c = pos.coords;
        res(send(cid, null, { type: "location", extra: { lat: Math.round(c.latitude * 1e6) / 1e6, lng: Math.round(c.longitude * 1e6) / 1e6, acc: Math.round(c.accuracy || 0) || null, label: label ? String(label).slice(0, 120) : null } }));
      }, function (e) {
        toast(e && e.code === 1 ? L("لم يُسمح بالوصول إلى الموقع — فعّله من إعدادات المتصفّح", "Location permission denied — enable it in browser settings")
          : e && e.code === 3 ? L("تعذّر تحديد الموقع في الوقت المحدّد — جرّب في مكانٍ مكشوف", "Location timed out — try outdoors") : L("تعذّر تحديد الموقع", "Couldn't get your location"));
        res(null);
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    });
  }
  function mapsUrl(lat, lng) { return "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng; }
  // C99: نسخة الملفّ المختار في الذاكرة فوراً — ملفّات منتقي الصور في أندرويد تُقرأ من مصدرٍ قد تنتهي صلاحيّته قبل اكتمال
  //      الرفع (فيفشل أو يظهر عند المرسل مكسوراً)، والنوع يُستنتج من الامتداد إن جاء فارغاً
  var EXT_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif", mp4: "video/mp4", "3gp": "video/3gpp", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", pdf: "application/pdf" };
  function mimeOf(f) { if (f && f.type) return f.type; var m = /\.([a-z0-9]+)$/i.exec((f && f.name) || ""); return (m && EXT_MIME[m[1].toLowerCase()]) || ""; }
  function sendMedia(cid, opts) {
    if (opts && opts.blob && typeof File !== "undefined" && opts.blob instanceof File && !opts._copied && opts.blob.arrayBuffer) {
      var f0 = opts.blob, o2 = Object.assign({}, opts, { _copied: true });
      if (!isCloud(cid) || !state.uid) return null;
      var tmpId = newMsgId();
      f0.arrayBuffer().then(function (buf) { o2.blob = new Blob([buf], { type: mimeOf(f0) }); o2.name = o2.name || f0.name; sendMedia(cid, o2); },
        function () { toast(L("تعذّر قراءة الملفّ — اختره مرّةً أخرى", "Couldn't read the file — pick it again")); });
      return tmpId;
    }
    if (!isCloud(cid) || !state.uid) return null;
    var secret = e2eOn(chats[cid]);
    if (secret && e2eState(chats[cid]) !== "ready") { toast(e2eUi(chats[cid]).title || ""); return null; }   // C23
    var src = opts.blob || (opts.dataUrl ? dataUrlToBlob(opts.dataUrl) : null);
    if (!src) { toast(L("تعذّر قراءة الملفّ", "Couldn't read the file")); return null; }
    if (src.size > MAX_MEDIA - (secret ? 64 : 0)) { toast(L("الحدّ الأقصى ١٦ ميجابايت", "The limit is 16 MB")); return null; }
    var kind = opts.kind, id = newMsgId(), mid = newMediaId();
    var extra = { mid: mid, name: opts.name || src.name || null, mime: src.type || null, size: src.size };
    if (opts.viewOnce) extra.viewOnce = true;
    if (opts.duration) extra.duration = opts.duration;
    if (opts.transcript) extra.transcript = String(opts.transcript).slice(0, 1500);
    localUrls[mid] = URL.createObjectURL(src);
    var msg = { id: id, type: kind, extra: extra };
    if (opts.fwd) msg.fwd = true;   // C48: وسيطٌ موجَّه
    var p = { msg: msg, ts: Date.now(), status: "pending", uploading: true };
    (pend[cid] = pend[cid] || []).push(p);
    publishMessages(cid); publishChats();
    var prep = kind === "image" ? prepareImage(src) : kind === "video" ? prepareVideo(src) : Promise.resolve({ blob: src });
    // C23: في السرّيّة يُرفع الملفّ مشفّراً (مفتاحه داخل الرسالة المشفّرة) وبلا اسم
    var encP = null;
    var doUpload = function (blob, prog) {
      if (!secret) return uploadMedia(cid, mid, blob, extra, prog);
      if (!encP) encP = e2e.encFile(blob).then(function (ef) { extra.fk = ef.fk; extra.fiv = ef.fiv; return ef.blob; });
      return encP.then(function (eb) { return uploadMedia(cid, mid, eb, { name: "" }, prog); });
    };
    prep.then(function (r) {
      var blob = r.blob || src;
      if (r.thumb) extra.thumb = r.thumb;
      if (r.w) { extra.w = r.w; extra.h = r.h; }
      if (r.duration && !extra.duration) extra.duration = Math.round(r.duration);
      extra.size = blob.size; extra.mime = blob.type || extra.mime;
      if (blob !== src) { try { URL.revokeObjectURL(localUrls[mid]); } catch (e) {} localUrls[mid] = URL.createObjectURL(blob); }
      if (secret && extra.viewOnce) delete extra.thumb;
      publishMessages(cid);
      return doUpload(blob, function (pct) { p.progress = pct; publishMessages(cid); });
    }).then(function () {
      p.uploading = false;
      var ob = lsGet(OUTBOX, []); ob.push({ uid: state.uid, cid: cid, msg: msg }); lsSet(OUTBOX, ob);
      drainOutbox();
    }).catch(function (e) {
      p.uploading = false; p.reupload = function () { p.reupload = null; p.status = "pending"; p.uploading = true; publishMessages(cid); return prep.then(function (r) { return doUpload(r.blob || src, function (pct) { p.progress = pct; publishMessages(cid); }); })
        .then(function () { p.uploading = false; var ob = lsGet(OUTBOX, []); ob.push({ uid: state.uid, cid: cid, msg: msg }); lsSet(OUTBOX, ob); drainOutbox(); })
        .catch(function (e2) { setPend(cid, id, "failed"); toast(L("تعذّر رفع الملفّ: ", "Upload failed: ") + ((e2 && e2.message) || e2)); }); };
      setPend(cid, id, "failed");
      toast(L("تعذّر رفع الملفّ: ", "Upload failed: ") + ((e && e.message) || e) + L(" — اضغط ⚠ لإعادة المحاولة", " — tap ⚠ to retry"));
    });
    return id;
  }
  function uploadMedia(cid, mid, blob, extra, onProgress) {
    var d = fsdb(); if (!d) return Promise.reject(new Error("offline"));
    var meta = d.collection("chats").doc(cid).collection("media").doc(mid);
    // C16: حجز الرفع من الخادم أوّلاً (القواعد تطلبه) — حدٌّ يوميّ، وما لم يُرسل يُحذف بعد ٢٤ ساعة
    return call("media.begin", { cid: cid, mid: mid, size: blob.size }).catch(function (e) {
      var m = (e && e.message) || String(e);
      if (/quota/.test(m)) throw new Error(L("تجاوزت حدّ الرفع اليوميّ (٣٠٠ ميغابايت) — جرّب غداً", "Daily upload limit reached (300 MB)"));
      if (/unknown op/.test(m)) return null;   // خادمٌ أقدم
      throw e;
    }).then(function () { return blobToB64(blob); }).then(function (b64) {
      var n = Math.max(1, Math.ceil(b64.length / CHUNK));
      return meta.set({ by: state.uid, mime: blob.type || "application/octet-stream", size: blob.size, name: String(extra.name || "").slice(0, 200), n: n, ts: Date.now(), done: false })
        .then(function () {
          // ثلاث قطعٍ في وقتٍ واحد (أسرع على الجوّال من التسلسل)، مع نسبة التقدّم
          var i = 0, doneN = 0;
          if (onProgress) onProgress(0);
          var worker = function () {
            if (i >= n) return Promise.resolve();
            var k = i++;
            return meta.collection("c").doc(String(k)).set({ d: b64.slice(k * CHUNK, (k + 1) * CHUNK) })
              .then(function () { doneN++; if (onProgress) onProgress(Math.round(doneN * 100 / n)); return worker(); });
          };
          return Promise.all([worker(), worker(), worker()]);
        }).then(function () { return meta.update({ done: true }); });
    });
  }
  // ---------- التنزيل والتخزين المحلّيّ (IndexedDB) ----------
  var idbP = null;
  // C99: لا ننتظر إلى الأبد — مخزن الهاتف (IndexedDB) قد يعلق، وقراءة Firestore على شبكةٍ ضعيفة قد لا تعود؛
  //      فكانت الصورة تبقى «تُحمَّل» بلا نهاية ولا زرّ إعادة. الآن مهلة ثمّ «تعذّر» (مع إعادةٍ تلقائيّة وزرّ).
  function withTimeout(p, ms, fallback, err) {
    return new Promise(function (res, rej) {
      var done = false, t = setTimeout(function () { if (done) return; done = true; if (err) rej(new Error(err)); else res(fallback); }, ms);
      p.then(function (v) { if (done) return; done = true; clearTimeout(t); res(v); }, function (e) { if (done) return; done = true; clearTimeout(t); rej(e); });
    });
  }
  function idb() {
    if (idbP) return idbP;
    idbP = withTimeout(new Promise(function (res) {
      try {
        var r = indexedDB.open("sawa-media", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("m"); };
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    }), 4000, null);
    return idbP;
  }
  function idbGet(k) { return idb().then(function (db_) { if (!db_) return null; return new Promise(function (res) { try { var q = db_.transaction("m").objectStore("m").get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }); }); }
  function idbPut(k, v) { return idb().then(function (db_) { if (!db_) return; try { db_.transaction("m", "readwrite").objectStore("m").put(v, k); } catch (e) {} }); }
  function fetchMedia(cid, mid) {
    var d = fsdb(); if (!d) return Promise.reject(new Error("offline"));
    var meta = d.collection("chats").doc(cid).collection("media").doc(mid);
    return Promise.all([meta.get(), meta.collection("c").get()]).then(function (r) {
      if (!r[0].exists) throw new Error("gone");
      var m = r[0].data() || {}, parts = [];
      r[1].forEach(function (doc) { parts.push({ i: Number(doc.id), d: (doc.data() || {}).d || "" }); });
      parts.sort(function (a, b) { return a.i - b.i; });
      if (m.n && parts.length < m.n) throw new Error("incomplete");
      return b64ToBlob(parts.map(function (p) { return p.d; }).join(""), m.mime);
    });
  }
  // C140: طابور تنزيل — ٣ في وقتٍ واحد، المحادثة المفتوحة أوّلاً، والأحدث طلباً أوّلاً (آخر الرسائل قبل أقدمها).
  //       كان كلّ وسيطٍ في المحادثة يبدأ تنزيله معاً فتتزاحم وتتأخّر الصورة التي وصلت للتوّ.
  var dlQ = [], dlRun = 0, DL_MAX = 3;
  function dlSlot(cid) {
    return new Promise(function (res) { dlQ.push({ cid: cid, go: res }); dlPump(); });
  }
  function dlPump() {
    while (dlRun < DL_MAX && dlQ.length) {
      var k = -1;
      for (var i = dlQ.length - 1; i >= 0; i--) if (dlQ[i].cid === openCid) { k = i; break; }
      if (k < 0) k = dlQ.length - 1;
      var j = dlQ.splice(k, 1)[0]; dlRun++;
      j.go(function () { dlRun = Math.max(0, dlRun - 1); setTimeout(dlPump, 0); });
    }
  }
  function ensureMedia(cid, mid, noCache) {
    if (!mid || mediaUrls[mid] || localUrls[mid] || mediaLoading[mid] || mediaFailed[mid]) return Promise.resolve(mediaUrls[mid] || localUrls[mid] || null);
    var mk2 = mediaKeys[cid + "|" + mid], sec = e2eOn(chats[cid]) || /^sdm_/.test(String(cid));
    if (sec && !mk2) return Promise.resolve(null);   // C23: مفتاح الوسيط داخل رسالته المشفّرة — بعد فكّها
    mediaLoading[mid] = true;
    return withTimeout(idbGet(mid), 4000, null).then(function (b) {
      var tmp = !!((chats[cid] || {}).disappear);   // C14: لا نحفظ وسائط المحادثات المؤقّتة على الجهاز
      return b || dlSlot(cid).then(function (done) {
        return withTimeout(fetchMedia(cid, mid), 90000, null, "timeout").then(function (x) { done(); return x; }, function (e) { done(); throw e; });
      }).then(function (blob) { return sec ? e2e.decFile(blob, mk2.fk, mk2.fiv, mk2.mime) : blob; })
        .then(function (blob) { if (!noCache && !tmp) idbPut(mid, blob); return blob; });
    }).then(function (blob) {
      mediaUrls[mid] = URL.createObjectURL(blob); delete mediaLoading[mid]; publishMessages(cid); return mediaUrls[mid];
    }).catch(function (e) {
      delete mediaLoading[mid]; mediaFailed[mid] = (e && e.message) || "x"; publishMessages(cid);
      // C18: تعثّر التنزيل (شبكة ضعيفة) ⇒ إعادة تلقائيّة بعد ٥ ثم ٢٠ ثم ٦٠ ثانية — كان يبقى «لم يصل» حتّى إعادة فتح التطبيق
      var n = (mediaTries[mid] = (mediaTries[mid] || 0) + 1);
      if (!/gone/.test(mediaFailed[mid]) && n <= 5) setTimeout(function () { if (mediaFailed[mid] && !mediaUrls[mid]) { delete mediaFailed[mid]; ensureMedia(cid, mid, noCache); } }, [5000, 15000, 45000, 120000, 300000][n - 1]);
      return null;
    });
  }
  var mediaTries = {};
  // C48: توجيه رسالةٍ بمحتواها: النصّ نصّاً، والوسائط بملفّها (يُنزَّل إن لزم ثمّ يُرفع للمحادثة الهدف)
  function forwardMessage(fromCid, id, toCid) {
    var f = findMsg(fromCid, id); if (!f || !toCid) return Promise.resolve(null);
    var m = f.msg; if (m.enc) m = plainOf(fromCid, m);
    var ex = m.extra || {};
    if (ex.viewOnce) { toast(L("الصورة لمرّةٍ واحدة لا تُوجَّه", "View-once media can't be forwarded")); return Promise.resolve(null); }   // C100
    // C100: الموقع وبطاقة جهة الاتّصال تُوجَّه بمحتواها (كانت تُرسل نصّاً فارغاً فتُرفض «لم تُرسل»)
    if (m.type === "location" && ex.lat != null) { send(toCid, null, { type: "location", fwd: true, extra: { lat: ex.lat, lng: ex.lng, acc: ex.acc || null, label: ex.label || null } }); return Promise.resolve(true); }
    if (m.contact) { send(toCid, m.text || "", { fwd: true, contact: m.contact }); return Promise.resolve(true); }
    // C164: قائمة المهامّ تُوجَّه نسخةً جديدة (حالتها من جديد؛ المكلَّف يبقى إن كان عضواً في المحادثة الأخرى)
    if (m.type === "tasks" && ex.tasks) {
      var dm = (chats[toCid] && chats[toCid].members) || [];
      send(toCid, null, { type: "tasks", fwd: true, extra: { title: ex.title || "", tasks: (ex.tasks || []).map(function (t) { var keep = t.assigneeId && dm.indexOf(t.assigneeId) >= 0; return { id: t.id, text: t.text, assigneeId: keep ? t.assigneeId : null, assigneeName: keep ? (t.assigneeName || "") : "", dueAt: t.dueAt || null }; }) } });
      return Promise.resolve(true);
    }
    if (["poll", "bill", "fund", "tasks", "system"].indexOf(m.type) >= 0) { toast(L("هذا النوع لا يُوجَّه", "This can't be forwarded")); return Promise.resolve(null); }
    if (["image", "video", "file", "voice"].indexOf(m.type) < 0 || !ex.mid) { if (!String(m.text || "").trim()) return Promise.resolve(null); send(toCid, m.text || "", { fwd: true }); return Promise.resolve(true); }
    toast(L("جارٍ التوجيه…", "Forwarding…"));
    return ensureMedia(fromCid, ex.mid).then(function (url) {
      if (!url) throw new Error("no media");
      return fetch(url).then(function (r) { return r.blob(); });
    }).then(function (blob) {
      var b = (ex.mi