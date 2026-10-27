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
      var b = (ex.mime && blob.type !== ex.mime) ? new Blob([blob], { type: ex.mime }) : blob;
      sendMedia(toCid, { kind: m.type, blob: b, name: ex.name || null, duration: ex.duration || null, transcript: ex.transcript || null, fwd: true });
      return true;
    }).catch(function () { toast(L("تعذّر توجيه الوسيط", "Couldn't forward the media")); return null; });
  }
  function retryMedia(cid, mid) { if (!mid) return; delete mediaFailed[mid]; mediaTries[mid] = 0; publishMessages(cid); return ensureMedia(cid, mid); }
  // C89: ملفٌّ إلى الهاتف — في تطبيق أندرويد عبر الجسر (WebView لا يُنزّل روابط blob:)، وفي المتصفّح برابط تنزيل
  function blobPartB64(blob, off, len) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s0 = String(r.result || ""); res(s0.slice(s0.indexOf(",") + 1)); };
      r.onerror = function () { rej(r.error || new Error("read")); };
      r.readAsDataURL(blob.slice(off, off + len));
    });
  }
  function nativeFiles() { try { return !!(NB() && NB().fileBegin); } catch (e) { return false; } }
  // action: open | save | share
  function saveBlob(blob, name, action, mime) {
    if (!blob) return Promise.resolve(false);
    if (nativeFiles()) {
      var id = NB().fileBegin(name || "file", mime || blob.type || "");
      if (!id) { toast(L("تعذّر تجهيز الملفّ", "Couldn't prepare the file")); return Promise.resolve(false); }
      var CH = 384 * 1024, off = 0;
      var step = function () {
        if (off >= blob.size) return nativeAsk("fileEnd", [id, action || "open"], 60000);
        return blobPartB64(blob, off, CH).then(function (b64) { if (!NB().fileChunk(id, b64)) throw new Error("write"); off += CH; return step(); });
      };
      return step().then(function (r) {
        if (r && r.ok) { if (action === "save") toast(L("حُفظ في «التنزيلات» ✓ ", "Saved to Downloads ✓ ") + (r.where ? "— " + r.where : "")); return true; }
        toast(action === "open" ? L("لا تطبيق على هاتفك يفتح هذا النوع — جرّب «حفظ» أو «مشاركة»", "No app can open this type — try Save or Share") : L("تعذّر: ", "Failed: ") + ((r && r.error) || "")); return false;
      }).catch(function (e) { toast(L("تعذّر: ", "Failed: ") + ((e && e.message) || e)); return false; });
    }
    // C129: آيفون — الملفّ إلى ورقة المشاركة الأصليّة (WKWebView لا ينزّل blob:) · بناءٌ قديم بلا هذه الميزة يردّ ok:false فنكمل
    if (IOSB() && blob.size < 12 * 1024 * 1024) {
      return blobPartB64(blob, 0, blob.size).then(function (b64) {
        return IOSB().call("share", { fileName: name || "file", fileB64: b64, mime: mime || blob.type || "" });
      }).then(function (r) {
        if (r && (r.ok || r.file)) return true;
        return webSave();
      }, function () { return webSave(); });
    }
    return webSave();
    function webSave() {
    if (action === "share" && navigator.canShare) {
      try { var f = new File([blob], name || "file", { type: mime || blob.type }); if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f] }).then(function () { return true; }, function () { return false; }); } catch (e) {}
    }
    var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name || "file"; a.target = "_blank";
    document.body.appendChild(a); a.click(); setTimeout(function () { try { a.remove(); URL.revokeObjectURL(u); } catch (e) {} }, 4000);
    return Promise.resolve(true);
    }
  }
  function blobOfUrl(u) { return fetch(u).then(function (r) { return r.blob(); }); }
  // ملفٌّ عامّ: يُنزَّل ثمّ «فتح · حفظ · مشاركة»
  // C130: نوع الملفّ من امتداده (كان يصل فارغاً أحياناً فلا يجد الهاتف تطبيقاً يفتح PDF)
  var EXT_MIME = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", txt: "text/plain", csv: "text/csv", json: "application/json",
    zip: "application/zip", rar: "application/vnd.rar", apk: "application/vnd.android.package-archive", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg",
    mp4: "video/mp4", mov: "video/quicktime", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic" };
  function mimeOf(name, mime) {
    if (mime && mime !== "application/octet-stream") return mime;
    var ext = (String(name || "").match(/\.([a-z0-9]{1,5})$/i) || [])[1];
    return (ext && EXT_MIME[ext.toLowerCase()]) || mime || "application/octet-stream";
  }
  // آيفون: Quick Look (بناء C130+) · بناءٌ أقدم ⇒ ورقة المشاركة · المتصفّح: يُفتح في لسانٍ جديد ما يعرضه المتصفّح (PDF/صور/نصّ)
  function viewBlob(blob, name, mime) {
    if (IOSB() && blob.size < 40 * 1024 * 1024) {
      return blobPartB64(blob, 0, blob.size).then(function (b64) { return IOSB().call("openFile", { fileName: name, fileB64: b64, mime: mime }); })
        .then(function (r) { if (r && r.ok) return true; return saveBlob(blob, name, "share", mime); });
    }
    if (!NB() && /^(application\/pdf|image\/|text\/|video\/|audio\/)/.test(mime)) {
      var u = URL.createObjectURL(new Blob([blob], { type: mime }));
      var w = null; try { w = global.open(u, "_blank"); } catch (e) {}
      setTimeout(function () { try { URL.revokeObjectURL(u); } catch (e) {} }, 120000);
      if (w) return Promise.resolve(true);
    }
    return saveBlob(blob, name, "open", mime);
  }
  function openFile(m, action) {
    if (!m || !m.cloudMid) return;
    var url = mediaUrls[m.cloudMid] || localUrls[m.cloudMid];
    var name = m.text || m.fileName || "file", mime = mimeOf(name, m.mime || null);
    var go = function (u, act) {
      if (!u) { toast(L("تعذّر تنزيل الملفّ", "Couldn't download the file")); return; }
      blobOfUrl(u).then(function (b) { var mm = mimeOf(name, mime !== "application/octet-stream" ? mime : b.type); return act === "open" ? viewBlob(b, name, mm) : saveBlob(b, name, act, mm); })
        .catch(function (e) { toast(L("تعذّر فتح الملفّ: ", "Couldn't open the file: ") + ((e && e.message) || e)); });
    };
    var run = function (act) {
      if (url) return go(url, act);
      delete mediaFailed[m.cloudMid];
      toast(L("جارٍ التنزيل…", "Downloading…"));
      ensureMedia(m.cloudCid, m.cloudMid).then(function (u) { go(u, act); });
    };
    if (action) return run(action);
    var s = sheet(name);
    s.box.appendChild(note((m.fileSize ? Math.max(1, Math.round(m.fileSize / 1024)) + " KB · " : "") + (mime || ""), "#8796a5"));
    // C130: «فتح» على كلّ الأجهزة (كان المتصفّح والآيفون يحفظان فقط) · الآيفون: «حفظ» = ورقة المشاركة ومنها «حفظ في الملفّات»
    var opts = [["open", L("📂 فتح", "📂 Open")]];
    if (IOSB()) opts.push(["share", L("📤 حفظ أو مشاركة", "📤 Save or share")]);
    else { opts.push(["save", nativeFiles() ? L("⬇️ حفظ في التنزيلات", "⬇️ Save to Downloads") : L("⬇️ تنزيل", "⬇️ Download")]); opts.push(["share", L("📤 مشاركة", "📤 Share")]); }
    opts.forEach(function (x, i) {
      var b = mkBtn(x[1], i === 0 ? "primary" : ""); b.style.marginTop = "8px"; b.onclick = function () { s.close(); run(x[0]); }; s.box.appendChild(b);
    });
  }
  // صورة/فيديو من العارض: حفظ أو مشاركة (رابطه blob: محلّيّ)
  function saveMediaUrl(u, name, action, mime) { if (!u) return Promise.resolve(false); return blobOfUrl(u).then(function (b) { return saveBlob(b, name, action, mime); }); }

  // ==================================================================
  // C90: القصص (الاستوري) — لجهات اتّصالي · نصّ/صورة/فيديو (≤٣٠ ث) · ٢٤ ساعة · «شاهدها» · الردّ في الخاصّة · الإخفاء عن أشخاص
  //   Firestore: stories/{u} {name, aud[], hide[], items[]} (يكتبه الخادم) · stories/{u}/media/{mid}+c/{i} (يرفعها صاحبها)
  // ==================================================================
  var ST_BG = [["#2F80C8", "#1E3A63"], ["#16a34a", "#065f46"], ["#e11d48", "#7f1d1d"], ["#7c3aed", "#312e81"], ["#f59e0b", "#b45309"], ["#0ea5e9", "#0f766e"], ["#334155", "#0f172a"], ["#db2777", "#6b21a8"]];
  var stState = { mine: null, others: {}, unsub: [] }, stSeen = lsGet("sawa_story_seen", {}), stUrls = {};
  function stItemsLive(items) { var now = Date.now(); return (items || []).filter(function (x) { return x && x.id && (x.exp || 0) > now; }).sort(function (a, b) { return a.ts - b.ts; }); }
  function stEmit() { try { global.dispatchEvent(new CustomEvent("sawa-stories")); } catch (e) {} }
  function startStories(uid) {
    stopStories();
    var d = fsdb(); if (!d || !uid) return;
    try {
      stState.unsub.push(d.collection("stories").where("aud", "array-contains", uid).onSnapshot(function (snap) {
        var o = {}; snap.forEach(function (doc) { var v = doc.data() || {}; if (doc.id !== uid) o[doc.id] = { owner: doc.id, name: v.name || "", items: v.items || [] }; });
        stState.others = o; stEmit();
      }, function (e) { log("stories:", e && e.message); stState.unsub = []; clearTimeout(stState.rt); stState.rt = setTimeout(function () { if (state.uid === uid && !stState.unsub.length) startStories(uid); }, 15000); }));   // C133b
      stState.unsub.push(d.collection("stories").doc(uid).onSnapshot(function (doc) { var v = doc && doc.exists ? doc.data() : null; stState.mine = v; stEmit(); }, function () {}));
    } catch (e) { log("stories", e && e.message); }
    // تحديث العدّاد والحلقات حين تنتهي قصّة
    if (!stState.tick) stState.tick = setInterval(stEmit, 60000);
  }
  function stopStories() { stState.unsub.forEach(function (f) { try { f(); } catch (e) {} }); stState.unsub = []; stState.mine = null; stState.others = {}; }
  function stName(owner, fallback) { var p = state.people.filter(function (x) { return x.uid === owner; })[0]; return p ? displayName(p) : (nickOf(owner) || fallback || L("مستخدم سوا", "Sawa user")); }
  function stories() {
    var mineItems = stItemsLive(stState.mine && stState.mine.items);
    var list = Object.keys(stState.others).map(function (k) {
      var s = stState.others[k], items = stItemsLive(s.items);
      if (!items.length) return null;
      var unseen = items.filter(function (x) { return !stSeen[x.id]; }).length;
      return { owner: k, name: stName(k, s.name), photo: photoOf(k), items: items, unseen: unseen, last: items[items.length - 1].ts };
    }).filter(Boolean).sort(function (a, b) { return (b.unseen > 0) - (a.unseen > 0) || b.last - a.last; });
    return { enabled: !!state.uid, me: { uid: state.uid, name: (state.me && state.me.name) || L("أنا", "Me"), photo: state.uid ? photoOf(state.uid) : null, items: mineItems, aud: stState.mine ? (stState.mine.aud || []).length : null, hide: (stState.mine && stState.mine.hide) || [] }, list: list };
  }
  function stUpload(blob) {
    var d = fsdb(); if (!d) return Promise.reject(new Error("offline"));
    var mid = newMediaId(), meta = d.collection("stories").doc(state.uid).collection("media").doc(mid);
    // C100: حجز الرفع من الخادم أوّلاً (القواعد تطلبه — حدٌّ يوميّ مشترك مع المحادثات)
    return call("story.begin", { mid: mid, size: blob.size }).catch(function (e) {
      var m = (e && e.message) || String(e);
      if (/quota/.test(m)) throw new Error(L("تجاوزت حدّ الرفع اليوميّ — جرّب غداً", "Daily upload limit reached"));
      throw e;
    }).then(function () { return blobToB64(blob); }).then(function (b64) {
      var n = Math.max(1, Math.ceil(b64.length / CHUNK));
      if (n > 33) throw new Error(L("الملفّ كبير — الحدّ ١٦ ميجابايت", "File too large (16 MB)"));
      return meta.set({ by: state.uid, mime: blob.type || "application/octet-stream", size: blob.size, n: n, ts: Date.now(), done: false }).then(function () {
        var i = 0, worker = function () { if (i >= n) return Promise.resolve(); var k = i++; return meta.collection("c").doc(String(k)).set({ d: b64.slice(k * CHUNK, (k + 1) * CHUNK) }).then(worker); };
        return Promise.all([worker(), worker(), worker()]);
      }).then(function () { return meta.update({ done: true }); }).then(function () { stUrls[mid] = URL.createObjectURL(blob); return mid; });
    });
  }
  function stMedia(owner, it) {
    if (stUrls[it.mid]) return Promise.resolve(stUrls[it.mid]);
    return idbGet("st:" + it.mid).then(function (b) {
      if (b) return b;
      var d = fsdb(), meta = d.collection("stories").doc(owner).collection("media").doc(it.mid);
      return meta.collection("c").get().then(function (snap) {
        var parts = []; snap.forEach(function (doc) { parts.push({ i: Number(doc.id), d: (doc.data() || {}).d || "" }); });
        parts.sort(function (a, b) { return a.i - b.i; });
        if (!parts.length || (it.n && parts.length < it.n)) throw new Error("incomplete");
        var blob = b64ToBlob(parts.map(function (p) { return p.d; }).join(""), it.mime);
        idbPut("st:" + it.mid, blob); return blob;
      });
    }).then(function (blob) { return (stUrls[it.mid] = URL.createObjectURL(blob)); });
  }
  function stAgo(ts) { var m = Math.round((Date.now() - ts) / 60000); return m < 1 ? L("الآن", "now") : m < 60 ? L("قبل ", "") + m + L(" د", "m") : L("قبل ", "") + Math.round(m / 60) + L(" س", "h"); }
  function stOverlay(bg) {
    var ov = mk("div", "position:fixed;inset:0;z-index:2147483004;background:" + (bg || "#000") + ";display:flex;flex-direction:column;font-family:system-ui;color:#fff;user-select:none;-webkit-user-select:none");
    ov.dir = isAr() ? "rtl" : "ltr"; document.body.appendChild(ov); return ov;
  }
  function stGrad(i) { var c = ST_BG[(i || 0) % ST_BG.length]; return "linear-gradient(160deg," + c[0] + "," + c[1] + ")"; }

  // ==================================================================
  // C133: لحظات الأصدقاء — منشوراتٌ دائمة لجمهورٍ يختاره الناشر (جهات اتّصالي · المقرّبون · عائلة/مجموعة · قائمة بثّ · أشخاص محدّدون)
  //   نصّ · حتّى ٤ صور أو فيديو ≤ ٣٠ ث · موقع · استطلاع · إعجاب وتعليقات (يكتبها الخادم) · إبلاغ وإخفاء
  //   الخلاصة: moments where aud array-contains me (المعرّف مرتّبٌ زمنيّاً عكسيّاً ⇒ بلا فهرسٍ مركّب)
  // ==================================================================
  var mo = { list: [], unsub: null, limit: 30, more: false, loaded: false, err: null, urls: {}, prefs: null, view: null, notes: [], nUnsub: null, filter: null };
  var MO_MUTE_KEY = "sawa_mom_mute";
  var MO_HID_KEY = "sawa_mom_hidden";   // C150: ما أبلغتُ عنه يختفي عندي فوراً (pid أو pid/cmid)
  function moHidden() { return lsGet(MO_HID_KEY, {}) || {}; }
  function moHide(k) { var h = moHidden(); h[k] = Date.now(); var ks = Object.keys(h); if (ks.length > 500) ks.sort(function (a, b) { return h[a] - h[b]; }).slice(0, ks.length - 500).forEach(function (x) { delete h[x]; }); lsSet(MO_HID_KEY, h); }
  function moReport(p, c) {
    var mine = c ? c.by === state.uid : p.by === state.uid; if (mine) return;
    var who = c ? moName(c.by, c.name) : moName(p.by, p.name), uid = c ? c.by : p.by;
    reportSheet({ title: c ? L("الإبلاغ عن تعليق ", "Report comment by ") + who : L("الإبلاغ عن لحظة ", "Report moment by ") + who, target: uid, name: who, kind: "dm",
      moment: c ? { pid: p.id, cmid: c.id } : { pid: p.id },
      onBlock: function () { try { setBlocked(uid, true); } catch (e) {} },
      z: 2147483007,
      onDone: function () {
        moHide(c ? p.id + "/" + c.id : p.id);
        if (c) { try { global.dispatchEvent(new CustomEvent("sawa-mom-hide")); } catch (e) {} } else moCloseOverlays();
        moEmit();
      } });
  }
  function moEmit() { try { global.dispatchEvent(new CustomEvent("sawa-moments")); } catch (e) {} if (mo.view) mo.view.paint(); }
  function newPid() { var n = (9e12 - Date.now()).toString(36); while (n.length < 9) n = "0" + n; return "m" + n.slice(-9) + Math.random().toString(36).slice(2, 6).padEnd(4, "0"); }
  function startMoments(uid) {
    stopMoments();
    var d = fsdb(); if (!d || !uid) return;
    try {
      mo.unsub = d.collection("moments").where("aud", "array-contains", uid).limit(mo.limit).onSnapshot(function (snap) {
        var arr = []; snap.forEach(function (doc) { var v = doc.data() || {}; v.id = doc.id; arr.push(v); });
        arr.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
        mo.list = arr; mo.more = snap.size >= mo.limit; mo.loaded = true; mo.err = null; mo.retry = 0; moEmit();
      }, function (e) {
        // C133b: المستمع يموت عند الخطأ (مثلاً «لا صلاحيّة» قبل نشر القواعد أو انقطاع) ⇒ نعيده بمهلةٍ متزايدة بدل أن تبقى الخلاصة فارغةً حتّى إعادة التشغيل
        mo.err = (e && e.message) || String(e); mo.loaded = true; mo.unsub = null; log("moments:", mo.err); moEmit();
        mo.retry = Math.min(60000, (mo.retry || 2500) * 2); clearTimeout(mo.rt); mo.rt = setTimeout(function () { if (state.uid === uid && !mo.unsub) startMoments(uid); }, mo.retry);
      });
    } catch (e) { log("moments", e && e.message); }
  }
  try { document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && state.uid) { if (!mo.unsub || mo.err) { mo.retry = 0; startMoments(state.uid); } if (!mo.nUnsub) startNotes(state.uid); if (!stState.unsub.length) startStories(state.uid); } }); } catch (e) {}
  function stopMoments() { if (mo.unsub) { try { mo.unsub(); } catch (e) {} } mo.unsub = null; }
  function moLoadMore() { mo.limit += 30; if (state.uid) startMoments(state.uid); }
  function moMuted() {
    var m = Object.assign({}, lsGet(MO_MUTE_KEY, {}) || {});
    try { (mo.prefs && mo.prefs.mute || []).forEach(function (u) { m[u] = 1; }); (prefs && prefs.blocked || []).forEach(function (u) { m[u] = 1; }); } catch (e) {}   // C133b: المحظورون لا تظهر لحظاتهم
    return m;
  }
  function moSetMute(map) {
    lsSet(MO_MUTE_KEY, map);
    var ids = Object.keys(map); moPrefs().then(function () { return call("moment.prefs", { mute: ids }); }).then(function (r) { if (r) mo.prefs = { close: r.close || [], hide: r.hide || [], mute: r.mute || [], seen: r.seen || (mo.prefs && mo.prefs.seen) || 0 }; moEmit(); }).catch(function () {});
  }
  function moUpload(pid, blob) {
    var d = fsdb(); if (!d) return Promise.reject(new Error("offline"));
    var mid = newMediaId().replace(/[^a-z0-9]/g, ""), meta = d.collection("moments").doc(pid).collection("media").doc(mid);
    return call("moment.begin", { pid: pid, mid: mid, size: blob.size }).catch(function (e) {
      var m = (e && e.message) || String(e);
      if (/quota/.test(m)) throw new Error(L("تجاوزت حدّ الرفع اليوميّ — جرّب غداً", "Daily upload limit reached"));
      throw e;
    }).then(function () { return blobToB64(blob); }).then(function (b64) {
      var n = Math.max(1, Math.ceil(b64.length / CHUNK));
      if (n > 33) throw new Error(L("الملفّ كبير — الحدّ ١٦ ميجابايت", "File too large (16 MB)"));
      return meta.set({ by: state.uid, mime: blob.type || "application/octet-stream", size: blob.size, n: n, ts: Date.now(), done: false }).then(function () {
        var i = 0, worker = function () { if (i >= n) return Promise.resolve(); var k = i++; return meta.collection("c").doc(String(k)).set({ d: b64.slice(k * CHUNK, (k + 1) * CHUNK) }).then(worker); };
        return Promise.all([worker(), worker(), worker()]);
      }).then(function () { return meta.update({ done: true }); }).then(function () { mo.urls[mid] = URL.createObjectURL(blob); return mid; });
    });
  }
  function moMedia(pid, it) {
    if (mo.urls[it.mid]) return Promise.resolve(mo.urls[it.mid]);
    return idbGet("mm:" + it.mid).then(function (b) {
      if (b) return b;
      var meta = fsdb().collection("moments").doc(pid).collection("media").doc(it.mid);
      return meta.collection("c").get().then(function (snap) {
        var parts = []; snap.forEach(function (doc) { parts.push({ i: Number(doc.id), d: (doc.data() || {}).d || "" }); });
        parts.sort(function (a, b) { return a.i - b.i; });
        if (!parts.length || (it.n && parts.length < it.n)) throw new Error("incomplete");
        var blob = b64ToBlob(parts.map(function (p) { return p.d; }).join(""), it.mime);
        idbPut("mm:" + it.mid, blob); return blob;
      });
    }).then(function (blob) { return (mo.urls[it.mid] = URL.createObjectURL(blob)); });
  }
  function moPrefs() { if (mo.prefs) return Promise.resolve(mo.prefs); return call("moment.prefs", {}).then(function (r) { mo.prefs = { close: r.close || [], hide: r.hide || [], mute: r.mute || [], seen: r.seen || 0 }; moEmit(); return mo.prefs; }); }
  function moAudLabel(mode) {
    mode = String(mode || "contacts");
    if (mode === "contacts") return L("جهات اتّصالي", "My contacts");
    if (mode === "close") return L("المقرّبون", "Close friends");
    if (mode.indexOf("chat:") === 0) return mode.slice(5) || L("مجموعة", "Group");
    if (mode === "custom") return L("أشخاص محدّدون", "Specific people");
    return mode;
  }
  // ---------- الألوان (من التطبيق) ----------
  function moTheme(c) {
    c = c || {};
    return { bg: c.bg || "#F5F7FA", card: c.card || "#fff", text: c.text || "#1A1A2E", muted: c.textMuted || "#6B7280", border: c.border || "#E5E7EB",
      primary: c.primary || "#2F80C8", pl: c.primaryLight || "#E3F0FB", danger: c.danger || "#DC2626", accent: c.accent || "#F59E0B" };
  }
  function moAv(uid, name, size, T) {
    var ph = uid ? photoOf(uid) : null, a = mk("div", "width:" + size + "px;height:" + size + "px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font:800 " + Math.round(size * 0.42) + "px system-ui;background:" + T.pl + " center/cover no-repeat;color:" + T.primary);
    if (ph) a.style.backgroundImage = "url(" + ph + ")"; else a.textContent = String(name || "؟").trim().charAt(0) || "؟";
    return a;
  }
  function moName(uid, fallback) { if (uid === state.uid) return (state.me && state.me.name) || L("أنا", "Me"); return stName(uid, fallback); }
  function moIcon(path, size, color) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size || 20); s.setAttribute("height", size || 20); s.style.width = s.style.height = "calc(" + (size || 20) + "px * var(--sfs, 1))"; s.style.flexShrink = "0";
    s.setAttribute("fill", "none"); s.setAttribute("stroke", color || "currentColor"); s.setAttribute("stroke-width", "2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    s.innerHTML = path; return s;
  }
  var MI = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    vid: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4V8z"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    poll: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    back: '<path d="M15 18l-6-6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4" fill="#fff" stroke="none"/>'
  };
  // ---------- الشاشة ----------
  function momentsMount(host, opts) {
    opts = opts || {};
    var T = moTheme(opts.colors);
    host.innerHTML = ""; host.dir = isAr() ? "rtl" : "ltr";
    host.style.cssText = "flex:1;min-height:0;display:flex;flex-direction:column;background:" + T.bg + ";color:" + T.text + ";font-family:system-ui";
    var head = mk("div", "display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;background:" + T.card + ";border-bottom:1px solid " + T.border + ";flex-shrink:0");
    var bk = mk("button", "width:38px;height:38px;border-radius:50%;border:0;background:" + T.bg + ";display:flex;align-items:center;justify-content:center;color:" + T.text);
    var bi = moIcon(MI.back, 20); if (!isAr()) {} else bi.style.transform = "scaleX(-1)"; bk.appendChild(bi); bk.setAttribute("aria-label", L("رجوع", "Back"));
    bk.onclick = function () { if (opts.onBack) opts.onBack(); };
    var tt = mk("div", "flex:1;min-width:0"); tt.appendChild(mk("div", "font:800 18px system-ui", L("لحظات الأصدقاء", "Friends' moments")));
    var sub = mk("div", "font:600 12px system-ui;color:" + T.muted); tt.appendChild(sub);
    var nb = mk("button", "height:38px;border-radius:19px;border:0;padding:0 14px;display:flex;align-items:center;gap:6px;background:" + T.primary + ";color:#fff;font:800 13.5px system-ui");
    nb.appendChild(moIcon(MI.plus, 18, "#fff")); nb.appendChild(document.createTextNode(L("لحظة", "Moment"))); nb.onclick = function () { momentComposer(opts); };
    var gear = mk("button", "width:38px;height:38px;border-radius:50%;border:0;background:" + T.bg + ";color:" + T.text + ";font-size:17px", "⚙︎");
    gear.setAttribute("aria-label", L("إعدادات اللحظات", "Moments settings")); gear.onclick = function () { moSettings(); };
    // C135: الإشعارات (تفاعلات · تعليقات · ردود · إشارات) بعدد غير المقروء
    var bell = mk("button", "position:relative;width:38px;height:38px;border-radius:50%;border:0;background:" + T.bg + ";color:" + T.text + ";display:flex;align-items:center;justify-content:center");
    bell.setAttribute("aria-label", L("إشعارات اللحظات", "Moments notifications")); bell.appendChild(moIcon(MI.bell, 19));
    var badge = mk("span", "position:absolute;top:-2px;" + (isAr() ? "left" : "right") + ":-2px;min-width:18px;height:18px;border-radius:9px;background:#E11D48;color:#fff;font:800 10.5px/18px system-ui;text-align:center;padding:0 4px;box-sizing:border-box;display:none");
    bell.appendChild(badge); bell.onclick = function () { moNotesSheet(); };
    head.appendChild(bk); head.appendChild(tt); head.appendChild(bell); head.appendChild(gear); head.appendChild(nb); host.appendChild(head);
    var scroll = mk("div", "flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 0 calc(env(safe-area-inset-bottom,0px) + 80px)");
    host.appendChild(scroll);
    var view = { T: T, opts: opts, paint: paint, host: host, top: function () { scroll.scrollTop = 0; } };
    mo.view = view;
    function prompt() {
      var c = mk("button", "display:flex;align-items:center;gap:10px;width:calc(100% - 24px);margin:0 12px 10px;padding:12px;border-radius:18px;border:1px solid " + T.border + ";background:" + T.card + ";color:" + T.muted + ";font:600 14.5px system-ui;text-align:start;box-sizing:border-box");
      c.appendChild(moAv(state.uid, moName(state.uid), 40, T));
      c.appendChild(mk("span", "flex:1", L("ماذا يحدث معك؟ شارك لحظة…", "What's new? Share a moment…")));
      var ic = mk("span", "display:flex;gap:8px;color:" + T.primary); ic.appendChild(moIcon(MI.img, 20, T.primary)); c.appendChild(ic);
      c.onclick = function () { momentComposer(opts); };
      return c;
    }
    function paint() {
      if (!host.isConnected) { if (mo.view === view) mo.view = null; return; }
      var y = scroll.scrollTop; scroll.innerHTML = "";
      var un = moUnread(); badge.style.display = un ? "block" : "none"; badge.textContent = un > 9 ? "9+" : String(un);
      if (!state.uid) { scroll.appendChild(moEmpty(T, "⏳", L("جارٍ الاتّصال بالخادم…", "Connecting…"), "")); return; }
      var fl = mo.filter;
      if (fl) {   // C135: لحظات شخصٍ واحد
        var chip = mk("div", "display:flex;align-items:center;gap:10px;margin:0 12px 10px;padding:10px 12px;border-radius:16px;background:" + T.card + ";border:1px solid " + T.border);
        chip.appendChild(moAv(fl.uid, moName(fl.uid, fl.name), 34, T));
        chip.appendChild(mk("div", "flex:1;min-width:0;font:800 14.5px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis", fl.uid === state.uid ? L("لحظاتي", "My moments") : L("لحظات ", "Moments by ") + moName(fl.uid, fl.name)));
        var cx = mk("button", "border:0;border-radius:12px;padding:7px 12px;background:" + T.pl + ";color:" + T.primary + ";font:800 12.5px system-ui", L("عرض الكلّ", "Show all"));
        cx.onclick = function () { mo.filter = null; paint(); }; chip.appendChild(cx); scroll.appendChild(chip);
      }
      if (!fl || fl.uid === state.uid) scroll.appendChild(prompt());
      var mute = moMuted();
      var hid = moHidden();
      var items = mo.list.filter(function (p) { return (!mute[p.by] || p.by === state.uid) && (!fl || p.by === fl.uid) && !hid[p.id] && (!p.held || p.by === state.uid); });
      sub.textContent = mo.loaded ? (items.length ? items.length + " " + L("لحظة", "moments") : "") : L("جارٍ التحميل…", "Loading…");
      if (mo.err && !items.length) scroll.appendChild(moEmpty(T, "⚠️", L("تعذّر تحميل اللحظات", "Couldn't load moments"), L("تحقّق من الاتّصال ثمّ عُد إلى هذه الصفحة.", "Check your connection and come back.")));
      else if (mo.loaded && !items.length) scroll.appendChild(moEmpty(T, "🌿", L("لا لحظات بعد", "No moments yet"), L("كن أوّل من يشارك لحظةً مع أصدقائه وأهله — صورة، أو فكرة، أو سؤال.", "Be the first to share — a photo, a thought or a question.")));
      items.forEach(function (p) { scroll.appendChild(moCard(p, view)); });
      if (mo.more) { var m = mk("button", "display:block;margin:6px auto 0;border:0;border-radius:14px;padding:10px 18px;background:" + T.card + ";color:" + T.primary + ";font:800 13px system-ui;border:1px solid " + T.border, L("عرض المزيد", "Load more")); m.onclick = moLoadMore; scroll.appendChild(m); }
      scroll.scrollTop = y;
    }
    paint();
    if (state.uid && !mo.unsub) startMoments(state.uid);
    try { localStorage.setItem("sawa_mom_seen", String(Date.now())); } catch (e) {}
    if (state.uid) moPrefs().catch(function () {});   // C133b: «أخفيتُ لحظاتهم» من الخادم (على كلّ أجهزتي)
    return { unmount: function () { if (mo.view === view) mo.view = null; mo.filter = null; host.innerHTML = ""; }, paint: paint };
  }
  function moEmpty(T, ic, title, sub) {
    var e = mk("div", "text-align:center;padding:48px 28px;color:" + T.muted);
    e.appendChild(mk("div", "font-size:46px;margin-bottom:10px", ic)); e.appendChild(mk("div", "font:800 16px system-ui;color:" + T.text + ";margin-bottom:6px", title));
    if (sub) e.appendChild(mk("div", "font:500 13.5px/1.8 system-ui", sub)); return e;
  }
  function moCard(p, view) {
    var T = view.T, mine = p.by === state.uid, likes = p.likes || [], liked = likes.indexOf(state.uid) >= 0, myRx = liked ? ((p.rx || {})[state.uid] || "❤️") : null;
    var c = mk("article", "margin:0 12px 12px;border-radius:20px;background:" + T.card + ";border:1px solid " + T.border + ";overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)");
    c.setAttribute("data-pid", p.id);
    var hd = mk("div", "display:flex;align-items:center;gap:10px;padding:12px 12px 8px");
    var who0 = function () { moPerson(p.by, p.name); };   // C135: صاحب اللحظة ⇒ لحظاته فقط أو مراسلته
    var av = moAv(p.by, moName(p.by, p.name), 42, T); av.style.cursor = "pointer"; av.onclick = who0; hd.appendChild(av);
    var who = mk("div", "flex:1;min-width:0");
    var nmEl = mk("div", "font:800 15px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer", moName(p.by, p.name)); nmEl.onclick = who0; who.appendChild(nmEl);
    var meta = timeAgo(p.ts); if (p.edited) meta += " · " + L("معدّلة", "edited"); if (mine) meta += " · 👥 " + moAudLabel(p.mode) + " (" + Math.max(0, (p.aud || []).length - 1) + ")";
    who.appendChild(mk("div", "font:600 12px system-ui;color:" + T.muted + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis", meta));
    hd.appendChild(who);
    var mb = mk("button", "width:34px;height:34px;border-radius:50%;border:0;background:transparent;color:" + T.muted + ";display:flex;align-items:center;justify-content:center");
    mb.setAttribute("aria-label", L("خيارات", "Options")); mb.appendChild(moIcon(MI.more, 20)); mb.onclick = function () { moMenu(p); };
    hd.appendChild(mb); c.appendChild(hd);
    if (p.text) {
      var tx = mk("div", "padding:0 14px 10px;font:500 15px/1.75 system-ui;white-space:pre-wrap;word-break:break-word" + (p.text.length > 320 ? ";max-height:" + (1.75 * 15 * 7) + "px;overflow:hidden" : ""));
      moRich(tx, p.text, p.menN, T);
      tx.style.webkitUserSelect = "none"; tx.style.userSelect = "none"; tx.style.webkitTouchCallout = "none";   // C136: لا يتحوّل إلى تحديد نصّ — النسخ بالضغط المطوّل
      moLong(tx, function () { moCopySheet(p.text); }); c.appendChild(tx);
      if (p.text.length > 320) { var more = mk("button", "border:0;background:transparent;color:" + T.primary + ";font:800 13px system-ui;padding:0 14px 10px", L("عرض المزيد", "See more")); more.onclick = function () { tx.style.maxHeight = "none"; more.remove(); }; c.appendChild(more); }
    }
    if (p.media && p.media.length) c.appendChild(moGrid(p, T, function (cell) { moBurst(cell); if (!liked) moReact(p, "❤️", view); }));
    if (p.loc && isFinite(Number(p.loc.lat)) && isFinite(Number(p.loc.lng))) c.appendChild(moLocCard(p.loc, T));
    if (p.poll && p.poll.opts) c.appendChild(moPoll(p, T, view));
    var sum = moRxSum(p);
    var stats = mk("div", "display:flex;justify-content:space-between;align-items:center;padding:10px 14px 6px;font:600 12.5px system-ui;color:" + T.muted);
    var ls = mk("button", "display:flex;align-items:center;gap:4px;border:0;background:transparent;color:inherit;font:inherit;padding:0");
    if (likes.length) { ls.appendChild(mk("span", "font-size:15px;letter-spacing:-3px;direction:ltr", sum.slice(0, 3).map(function (x) { return x[0]; }).join(""))); ls.appendChild(mk("span", "margin-inline-start:4px", String(likes.length))); }
    ls.onclick = function () { if (likes.length) moLikers(p); };
    stats.appendChild(ls);
    var cs = mk("button", "border:0;background:transparent;color:inherit;font:inherit;padding:0", p.cc ? p.cc + " " + L("تعليق", "comments") : "");
    cs.onclick = function () { moComments(p, view); }; stats.appendChild(cs);
    if (likes.length || p.cc) c.appendChild(stats);
    var act = mk("div", "display:flex;border-top:1px solid " + T.border + ";margin-top:" + (likes.length || p.cc ? "0" : "10px"));
    var bcss = "flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 0;border:0;background:transparent;font:700 13.5px system-ui;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none";
    var btn = function (icon, label, color, fn) {
      var b = mk("button", bcss + ";color:" + color);
      b.appendChild(moIcon(icon, 19, color)); b.appendChild(document.createTextNode(label)); b.onclick = fn; act.appendChild(b); return b;
    };
    // الإعجاب: ضغطة ⇒ ❤️ (أو سحب التفاعل) · ضغطةٌ مطوّلة ⇒ اختيار التفاعل
    var lcol = !liked ? T.muted : myRx === "❤️" ? "#E11D48" : "#D97706";
    var lb = mk("button", bcss + ";color:" + lcol); lb.setAttribute("aria-label", L("إعجاب", "Like"));
    if (myRx && myRx !== "❤️") lb.appendChild(mk("span", "font-size:18px;line-height:1", myRx));
    else { var hi = moIcon(MI.heart, 19, lcol); if (liked) hi.setAttribute("fill", lcol); lb.appendChild(hi); }
    lb.appendChild(document.createTextNode(liked ? moRxName(myRx) : L("إعجاب", "Like")));
    moLong(lb, function () { moRxPicker(lb, myRx, function (e) { moReact(p, e, view); }); });
    lb.onclick = function () { moReact(p, liked ? null : "❤️", view); };
    act.appendChild(lb);
    btn(MI.chat, L("تعليق", "Comment"), T.muted, function () { moComments(p, view); });
    btn(MI.share, L("مشاركة", "Share"), T.muted, function () { moShare(p); });
    c.appendChild(act);
    // آخر تعليق تحت اللحظة
    var lc0 = p.lastC;
    if (p.cc && lc0 && lc0.text) {
      var lc = mk("button", "display:flex;align-items:flex-start;gap:8px;width:100%;padding:10px 14px 12px;border:0;border-top:1px solid " + T.border + ";background:transparent;text-align:start;color:" + T.text + ";font-family:system-ui");
      lc.appendChild(moAv(lc0.by, moName(lc0.by, lc0.name), 26, T));
      var lt = mk("div", "flex:1;min-width:0;font:500 13px/1.55 system-ui;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word");
      lt.appendChild(mk("b", "font-weight:800", moName(lc0.by, lc0.name) + " ")); lt.appendChild(document.createTextNode(lc0.text));
      lc.appendChild(lt);
      if (p.cc > 1) lc.appendChild(mk("span", "font:700 12px system-ui;color:" + T.primary + ";white-space:nowrap;margin-top:1px", L("الكلّ", "All") + " (" + p.cc + ")"));
      lc.onclick = function () { moComments(p, view); };
      c.appendChild(lc);
    }
    return c;
  }
  function moGrid(p, T, dbl) {
    var m = p.media, n = m.length, g = mk("div", "display:grid;gap:3px;background:" + T.border);
    if (n === 1) g.style.gridTemplateColumns = "1fr";
    else if (n === 2) g.style.gridTemplateColumns = "1fr 1fr";
    else if (n === 3) { g.style.gridTemplateColumns = "2fr 1fr"; g.style.gridTemplateRows = "1fr 1fr"; }
    else g.style.gridTemplateColumns = "1fr 1fr";
    m.forEach(function (it, i) {
      // C137: كانت max-height تُضيّق عرض الفيديو الطوليّ فيظهر شريطٌ رماديّ بجانبه ⇒ نسبةٌ لا تقلّ عن ٤:٥ وعرضٌ كامل (الزائد يُقصّ)
      var ratio = n === 1 && it.w && it.h ? Math.max(0.8, Math.min(1.6, it.w / it.h)) : 1;
      var cell = mk("button", "position:relative;width:100%;border:0;padding:0;overflow:hidden;background:#111 center/cover no-repeat;" + (n === 1 ? "aspect-ratio:" + ratio : "aspect-ratio:1") + (n === 3 && i === 0 ? ";grid-row:span 2;aspect-ratio:auto" : ""));
      var cover = it.poster || it.thumb;   // C137: غلاف الفيديو بدقّةٍ واضحة (poster) — والقديم مصغّرٌ ضبابيّ
      if (cover) cell.style.backgroundImage = "url(" + cover + ")";
      var shown = false;
      var load = function () {
        moMedia(p.id, it).then(function (u) {
          if (it.t === "video") {
            var v = mk("video", "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent"); v.muted = true; v.playsInline = true; v.preload = "auto";
            if (it.poster) v.poster = it.poster;
            else v.addEventListener("loadeddata", function () { cell.style.backgroundImage = "none"; });   // لحظاتٌ قديمة: أوّل إطارٍ حقيقيّ بدل المصغّر الضبابيّ
            v.src = u + "#t=0.5"; cell.insertBefore(v, cell.firstChild);
          }
          else { cell.style.backgroundImage = "url(" + u + ")"; }
          shown = true;
        }).catch(function () { cell.appendChild(mk("div", "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px system-ui;background:rgba(0,0,0,.35)", L("تعذّر التحميل — اضغط", "Failed — tap"))); });
      };
      if (it.t === "video") { var pl = mk("div", "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"); var pc = mk("div", "width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"); pc.appendChild(moIcon(MI.play, 26)); pl.appendChild(pc); cell.appendChild(pl);
        if (it.dur) cell.appendChild(mk("div", "position:absolute;bottom:8px;" + (isAr() ? "left" : "right") + ":8px;background:rgba(0,0,0,.55);color:#fff;border-radius:8px;padding:2px 7px;font:700 11px system-ui", "0:" + String(it.dur).padStart(2, "0"))); }
      var io = global.IntersectionObserver ? new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: "300px" }) : null;
      if (io) io.observe(cell); else load();
      var lastTap = 0, tapT = null;   // C135: ضغطتان سريعتان ⇒ ❤️
      cell.onclick = function () { var now = Date.now(); if (dbl && now - lastTap < 300) { clearTimeout(tapT); lastTap = 0; dbl(cell); return; } lastTap = now; clearTimeout(tapT); tapT = setTimeout(function () { moViewer(p, i); }, dbl ? 300 : 0); };
      g.appendChild(cell);
    });
    return g;
  }
  // C133b: الموقع بخريطةٍ مصغّرة (بلاطات OpenStreetMap حول النقطة) + اسم المكان + فتح في الخرائط
  function moMapTiles(lat, lng, z, w, h) {
    var box = mk("div", "position:relative;width:100%;height:" + h + "px;overflow:hidden;background:#e5e7eb;direction:ltr");
    var n = Math.pow(2, z), xt = (Number(lng) + 180) / 360 * n, lr = Number(lat) * Math.PI / 180, yt = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n;
    var tx = Math.floor(xt), ty = Math.floor(yt), px = (xt - tx) * 256, py = (yt - ty) * 256;
    var layer = mk("div", "position:absolute;left:50%;top:50%;width:768px;height:768px;margin-left:" + (-256 - px) + "px;margin-top:" + (-256 - py) + "px");
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var im = mk("img", "position:absolute;width:256px;height:256px;left:" + ((dx + 1) * 256) + "px;top:" + ((dy + 1) * 256) + "px"); im.alt = ""; im.loading = "lazy";
      im.src = "https://tile.openstreetmap.org/" + z + "/" + (((tx + dx) % n) + n) % n + "/" + (ty + dy) + ".png"; layer.appendChild(im);
    }
    box.appendChild(layer);
    var pin = mk("div", "position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);font-size:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))", "📍"); box.appendChild(pin);
    box.appendChild(mk("div", "position:absolute;bottom:2px;right:4px;font:500 9px system-ui;color:#374151;background:rgba(255,255,255,.75);padding:0 3px;border-radius:3px", "© OpenStreetMap"));
    return box;
  }
  function moLocCard(loc, T) {
    var a = mk("a", "display:block;margin:10px 12px 0;border-radius:14px;overflow:hidden;border:1px solid " + T.border + ";text-decoration:none;color:" + T.text);
    a.href = "https://maps.google.com/?q=" + loc.lat + "," + loc.lng; a.target = "_blank"; a.rel = "noopener";
    a.appendChild(moMapTiles(loc.lat, loc.lng, 15, 0, 150));
    var row = mk("div", "display:flex;align-items:center;gap:6px;padding:9px 12px;background:" + T.card + ";font:700 13px system-ui");
    row.appendChild(moIcon(MI.pin, 16, T.danger)); row.appendChild(mk("span", "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis", loc.label || L("موقع مُشارَك", "Shared location")));
    row.appendChild(mk("span", "color:" + T.muted + ";font-weight:600", L("فتح ↗", "Open ↗"))); a.appendChild(row);
    return a;
  }
  function moPoll(p, T, view) {
    var votes = p.votes || {}, mine = votes[state.uid], total = 0, cnt = p.poll.opts.map(function () { return 0; });
    Object.keys(votes).forEach(function (u) { var i = votes[u]; if (cnt[i] != null) { cnt[i]++; total++; } });
    var box = mk("div", "margin:10px 12px 0;padding:12px;border-radius:16px;background:" + T.bg);
    box.appendChild(mk("div", "display:flex;align-items:center;gap:6px;font:800 14px system-ui;margin-bottom:8px", "📊 " + (p.poll.q || L("استطلاع", "Poll"))));
    p.poll.opts.forEach(function (o, i) {
      var pct = total ? Math.round(cnt[i] * 100 / total) : 0, sel = mine === i;
      var b = mk("button", "position:relative;display:flex;align-items:center;width:100%;margin-top:6px;padding:10px 12px;border-radius:12px;border:1.5px solid " + (sel ? T.primary : T.border) + ";background:" + T.card + ";color:" + T.text + ";font:700 13.5px system-ui;overflow:hidden;text-align:start");
      var bar = mk("div", "position:absolute;top:0;bottom:0;" + (isAr() ? "right" : "left") + ":0;width:" + (mine != null ? pct : 0) + "%;background:" + T.pl + ";transition:width .3s");
      b.appendChild(bar); var lb = mk("span", "position:relative;flex:1", (sel ? "✓ " : "") + o); b.appendChild(lb);
      if (mine != null) b.appendChild(mk("span", "position:relative;color:" + T.muted, pct + "%"));
      b.onclick = function () {
        var nx = sel ? -1 : i; p.votes = Object.assign({}, votes); if (nx === -1) delete p.votes[state.uid]; else p.votes[state.uid] = nx;
        if (view && view.paint) view.paint(); else if (mo.view) mo.view.paint();
        call("moment.vote", { pid: p.id, idx: nx }).catch(function (e) { toast(L("تعذّر: ", "Failed: ") + ((e && e.message) || e)); });
      };
      box.appendChild(b);
    });
    box.appendChild(mk("div", "font:600 12px system-ui;color:" + T.muted + ";margin-top:8px", total + " " + L("صوت", "votes") + (mine == null ? " · " + L("اختر لتصوّت", "Tap to vote") : "")));
    return box;
  }
  function moMenu(p) {
    var mine = p.by === state.uid, s = sheet(null);
    var add = function (tx, kind, fn) { var b = mkBtn(tx, kind); b.style.marginTop = "8px"; b.onclick = function () { s.close(); fn(); }; s.box.appendChild(b); };
    if (p.text) add(L("📋 نسخ النصّ", "📋 Copy text"), "", function () { copyText(p.text); toast(L("نُسخ ✓", "Copied ✓")); });
    if (mine) {
      add(L("✏️ تعديل النصّ", "✏️ Edit text"), "", function () { moEdit(p); });   // C135
      add(L("👥 من يراها", "👥 Who can see it"), "", function () { moAudInfo(p); });
      add(L("🗑 حذف اللحظة", "🗑 Delete moment"), "danger", function () {
        if (!global.confirm(L("حذف هذه اللحظة نهائيّاً؟", "Delete this moment permanently?"))) return;
        mo.list = mo.list.filter(function (x) { return x.id !== p.id; }); moEmit();
        call("moment.delete", { pid: p.id }).then(function () { toast(L("حُذفت ✓", "Deleted ✓")); }, function (e) { toast(L("تعذّر الحذف: ", "Couldn't delete: ") + ((e && e.message) || e)); });
      });
    } else {
      add(L("💬 مراسلة ", "💬 Message ") + moName(p.by, p.name), "", function () { try { openDm(p.by); } catch (e) { openDmWith(p.by); } });
      add(L("🙈 إخفاء لحظات ", "🙈 Hide moments from ") + moName(p.by, p.name), "", function () { var m = lsGet(MO_MUTE_KEY, {}) || {}; m[p.by] = 1; (mo.prefs && mo.prefs.mute || []).forEach(function (u) { m[u] = 1; }); moSetMute(m); moEmit(); toast(L("لن تظهر لك لحظاته — تُعيدها من ⚙︎ في أعلى اللحظات", "Hidden — undo from ⚙︎ at the top")); });
      add(L("🚩 إبلاغ عن اللحظة", "🚩 Report moment"), "danger", function () { moReport(p); });   // C150: بأسبابٍ وحظرٍ اختياريّ
    }
    add(L("إلغاء", "Cancel"), "ghost", function () {});
  }
  // إعدادات اللحظات: المقرّبون · المُخفى عنهم دائماً · من أخفيتُ لحظاتهم عندي
  function moSettings() {
    var s = sheet(L("إعدادات اللحظات", "Moments settings"));
    var row = function (ic, title, desc, fn) {
      var r = mk("button", "display:flex;align-items:center;gap:12px;width:100%;padding:12px 4px;border:0;border-top:1px solid #eef1f4;background:transparent;text-align:start;font-family:system-ui;color:#1A1A2E");
      r.appendChild(mk("div", "width:40px;height:40px;border-radius:12px;background:#eef5fc;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0", ic));
      var t = mk("div", "flex:1"); t.appendChild(mk("div", "font:800 14.5px system-ui", title)); t.appendChild(mk("div", "font:500 12px system-ui;color:#6b7280;margin-top:2px", desc)); r.appendChild(t);
      r.onclick = fn; s.box.appendChild(r);
    };
    moPrefs().then(function (pr) {
      row("⭐", L("المقرّبون", "Close friends") + " (" + pr.close.length + ")", L("تختارهم جمهوراً عند النشر", "Choose them as the audience when posting"), function () {
        moPickPeople(L("المقرّبون", "Close friends"), pr.close, function (u) { call("moment.prefs", { close: u }).then(function (r) { mo.prefs = { close: r.close || [], hide: r.hide || [], mute: r.mute || [], seen: r.seen || (mo.prefs && mo.prefs.seen) || 0 }; toast(L("حُفظ ✓", "Saved ✓")); }); });
      });
      row("🙈", L("لا تُظهر لحظاتي لـ", "Never show my moments to") + " (" + pr.hide.length + ")", L("يُستثنون من كلّ لحظةٍ جديدة", "Excluded from every new moment"), function () {
        moPickPeople(L("لا تُظهر لحظاتي لـ", "Never show my moments to"), pr.hide, function (u) { call("moment.prefs", { hide: u }).then(function (r) { mo.prefs = { close: r.close || [], hide: r.hide || [], mute: r.mute || [], seen: r.seen || (mo.prefs && mo.prefs.seen) || 0 }; toast(L("حُفظ ✓ — يشمل لحظاتك السابقة", "Saved ✓ — applies to earlier moments too")); }); });
      });
      var m0 = Object.assign({}, lsGet(MO_MUTE_KEY, {}) || {}); (pr.mute || []).forEach(function (u) { m0[u] = 1; }); var ids = Object.keys(m0);
      row("👁", L("أخفيتُ لحظاتهم عندي", "People whose moments I hid") + " (" + ids.length + ")", ids.length ? L("اضغط لإظهارهم من جديد", "Tap to show them again") : L("لا أحد", "Nobody"), function () {
        if (!ids.length) return;
        moPickPeople(L("أبقِ مخفيّاً", "Keep hidden"), ids, function (keep) { var n = {}; keep.forEach(function (u) { n[u] = 1; }); moSetMute(n); moEmit(); s.close(); toast(L("حُفظ ✓", "Saved ✓")); });
      });
    }, function (e) { s.box.appendChild(note(L("تعذّر التحميل: ", "Couldn't load: ") + ((e && e.message) || e), "#b42318")); });
  }
  function openDmWith(u) { try { global.location.href = "./?chat=" + encodeURIComponent("dm_" + [state.uid, u].sort().join("_")); } catch (e) {} }
  function moAudInfo(p) {
    var s = sheet(L("من يرى هذه اللحظة", "Who can see this"));
    s.box.appendChild(note("👥 " + moAudLabel(p.mode) + " — " + Math.max(0, (p.aud || []).length - 1) + L(" شخصاً", " people")));
    (p.aud || []).filter(function (u) { return u !== state.uid; }).slice(0, 200).forEach(function (u) {
      var r = mk("div", "display:flex;align-items:center;gap:10px;padding:8px 2px;border-top:1px solid #eef1f4");
      r.appendChild(moAv(u, moName(u), 34, moTheme())); r.appendChild(mk("div", "font:700 14px system-ui", moName(u))); s.box.appendChild(r);
    });
  }
  function moLikers(p) {
    var sum = moRxSum(p), rx = p.rx || {}, s = sheet(sum.map(function (x) { return x[0] + " " + x[1]; }).join("   ") || "❤️ 0");
    (p.likes || []).slice(0, 300).forEach(function (u) {
      var r = mk("div", "display:flex;align-items:center;gap:10px;padding:8px 2px;border-top:1px solid #eef1f4");
      r.appendChild(moAv(u, moName(u), 34, moTheme())); r.appendChild(mk("div", "flex:1;font:700 14px system-ui", moName(u))); r.appendChild(mk("div", "font-size:20px", rx[u] || "❤️")); s.box.appendChild(r);
    });
  }
  function moShare(p) {
    var tx = (p.text ? p.text + "\n\n" : "") + L("— لحظة من ", "— A moment by ") + moName(p.by, p.name) + L(" على سوا 🤍 sawaaap.com", " on Sawa 🤍 sawaaap.com");
    try { var nb = NB(); if (nb && nb.share) { nb.share("سوا", tx); return; } } catch (e) {}
    if (IOSB()) { IOSB().call("share", { text: tx }); return; }
    if (navigator.share) navigator.share({ text: tx }).catch(function () {}); else { copyText(tx); toast(L("نُسخ — الصقه حيث تريد", "Copied")); }
  }
  // ---------- العارض ----------
  function moViewer(p, start) {
    var i = start || 0, m = p.media;
    var ov = stOverlay("#000");
    var top = mk("div", "display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 8px");
    var x = mk("button", "border:0;background:rgba(255,255,255,.15);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center"); x.appendChild(moIcon(MI.x, 20, "#fff"));
    x.onclick = function () { ov.remove(); }; top.appendChild(x);
    var cnt = mk("div", "flex:1;text-align:center;font:700 14px system-ui"); top.appendChild(cnt);
    var sv = mk("button", "border:0;background:rgba(255,255,255,.15);color:#fff;height:40px;border-radius:20px;padding:0 14px;font:800 13px system-ui", L("حفظ", "Save"));
    top.appendChild(sv); ov.appendChild(top);
    var stage = mk("div", "flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;touch-action:pan-y"); ov.appendChild(stage);
    var sx = null;
    stage.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) go((dx < 0) !== isAr() ? 1 : -1); });
    function go(d) { var j = i + d; if (j < 0 || j >= m.length) return; i = j; show(); }
    function show() {
      stage.innerHTML = ""; cnt.textContent = m.length > 1 ? (i + 1) + " / " + m.length : "";
      var it = m[i], sp = mk("div", "color:#fff;font:600 13px system-ui", L("جارٍ التحميل…", "Loading…")); stage.appendChild(sp);
      moMedia(p.id, it).then(function (u) {
        stage.innerHTML = "";
        var el = it.t === "video" ? mk("video", "max-width:100%;max-height:100%") : mk("img", "max-width:100%;max-height:100%;object-fit:contain");
        el.src = u; if (it.t === "video") { el.controls = true; el.playsInline = true; el.autoplay = true; if (it.poster) el.poster = it.poster; }
        stage.appendChild(el);
        if (m.length > 1) [[-1, "‹"], [1, "›"]].forEach(function (z) {
          var b = mk("button", "position:absolute;top:50%;transform:translateY(-50%);" + ((z[0] < 0) !== isAr() ? "left" : "right") + ":8px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;font:800 22px system-ui", z[1]);
          b.onclick = function () { go(z[0]); }; stage.appendChild(b);
        });
        sv.onclick = function () { saveMediaUrl(u, "sawa-moment-" + (i + 1) + (it.t === "video" ? ".mp4" : ".jpg"), IOSB() ? "share" : "save", it.mime); };
      }).catch(function () { sp.textContent = L("تعذّر التحميل", "Couldn't load"); });
    }
    if (p.text) ov.appendChild(mk("div", "padding:10px 16px calc(env(safe-area-inset-bottom,0px) + 14px);font:500 14px/1.7 system-ui;max-height:22vh;overflow:auto;background:linear-gradient(transparent,rgba(0,0,0,.6))", p.text));
    show();
  }
  // ---------- التعليقات (C135: الردود · الإعجاب بالتعليق · الإشارة بـ@ · الانتقال إلى تعليقٍ من إشعار) ----------
  function moRepliesWord(n) { return n <= 10 ? L(n + " ردود", n + " replies") : L(n + " ردّاً", n + " replies"); }
  function moComments(p, view, o) {
    o = o || {}; moCss();
    var T = view ? view.T : moTheme(), unsub = null, list = [], replyTo = null, editing = null, men = {}, open = {}, first = true, stick = !o.focus;
    var ov = mk("div", "position:fixed;inset:0;z-index:2147483003;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui");
    ov.dir = isAr() ? "rtl" : "ltr"; ov.setAttribute("data-mo-ov", "1");
    var box = mk("div", "background:" + T.card + ";color:" + T.text + ";border-radius:22px 22px 0 0;width:100%;max-width:520px;height:80vh;display:flex;flex-direction:column;overflow:hidden");
    box.appendChild(mk("div", "width:40px;height:4px;border-radius:2px;background:" + T.border + ";margin:10px auto 6px;flex-shrink:0"));
    var title = mk("div", "font:800 16px system-ui;text-align:center;padding-bottom:8px;border-bottom:1px solid " + T.border + ";flex-shrink:0", L("التعليقات", "Comments")); box.appendChild(title);
    var body = mk("div", "flex:1;min-height:0;overflow-y:auto;padding:8px 12px"); box.appendChild(body);
    var rbar = mk("div", "display:none;align-items:center;gap:8px;padding:8px 14px;background:" + T.bg + ";font:700 12.5px system-ui;color:" + T.muted + ";flex-shrink:0;border-top:1px solid " + T.border);
    var rtx = mk("div", "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    var rx0 = mk("button", "border:0;background:transparent;color:" + T.muted + ";display:flex;padding:2px"); rx0.appendChild(moIcon(MI.x, 16)); rx0.setAttribute("aria-label", L("إلغاء الردّ", "Cancel reply"));
    rbar.appendChild(rtx); rbar.appendChild(rx0); box.appendChild(rbar);
    var bar = mk("div", "display:flex;gap:8px;align-items:flex-end;padding:10px 12px calc(env(safe-area-inset-bottom,0px) + 10px);border-top:1px solid " + T.border + ";flex-shrink:0");
    var atb = mk("button", "width:40px;height:42px;border-radius:50%;border:0;background:transparent;color:" + T.primary + ";font:800 20px system-ui;flex-shrink:0", "@"); atb.setAttribute("aria-label", L("إشارة إلى شخص", "Mention someone"));
    var ta = mk("textarea", "flex:1;min-height:40px;max-height:120px;resize:none;border-radius:20px;border:1px solid " + T.border + ";background:" + T.bg + ";color:" + T.text + ";padding:10px 14px;font:500 14.5px system-ui;outline:none;box-sizing:border-box");
    ta.rows = 1; ta.maxLength = 500; ta.placeholder = L("اكتب تعليقاً… (@ للإشارة)", "Write a comment… (@ to mention)");
    var sb = mk("button", "width:42px;height:42px;border-radius:50%;border:0;background:" + T.primary + ";display:flex;align-items:center;justify-content:center;flex-shrink:0");
    var si = moIcon(MI.send, 18, "#fff"); if (isAr()) si.style.transform = "scaleX(-1)"; sb.appendChild(si); sb.setAttribute("aria-label", L("إرسال", "Send"));
    bar.appendChild(atb); bar.appendChild(ta); bar.appendChild(sb); box.appendChild(bar);
    ov.appendChild(box); document.body.appendChild(ov);
    var onHide = function () { var hid = moHidden(); list = list.filter(function (x) { return !hid[p.id + "/" + x.id]; }); paint(); };   // C150
    global.addEventListener("sawa-mom-hide", onHide);
    var close = function () { if (unsub) try { unsub(); } catch (e) {} unsub = null; global.removeEventListener("sawa-mom-hide", onHide); ov.remove(); };
    ov._close = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };
    // المرشّحون للإشارة: من يرون اللحظة (بأسمائهم المعروفة لي أو كما ظهرت في التعليقات)
    var cands = function () {
      var nm = {}; nm[p.by] = p.name; list.forEach(function (c) { if (c.by && c.name) nm[c.by] = c.name; });
      return (p.aud || []).map(function (u) { return { uid: u, name: moName(u, nm[u]) }; });
    };
    var mm = moMention(ta, cands, men, T, rbar);
    atb.onclick = function () { mm.insertAt(); };
    // C136: تعديل تعليقي أو ردّي في شريط الكتابة نفسه
    function setEdit(c) {
      editing = c || null; replyTo = null; moMenClear(men);
      rbar.style.display = editing ? "flex" : "none";
      rtx.textContent = editing ? "✏️ " + L("تعديل التعليق", "Editing comment") : "";
      if (editing) { Object.keys(c.menN || {}).forEach(function (u) { men[u] = c.menN[u]; }); ta.value = c.text || ""; try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }
      else ta.value = "";
    }
    function setReply(c) {
      if (editing) { editing = null; ta.value = ""; }
      replyTo = c ? { id: c.re || c.id, by: c.by, name: moName(c.by, c.name) } : null;
      rbar.style.display = replyTo ? "flex" : "none";
      rtx.textContent = replyTo ? L("الردّ على ", "Replying to ") + replyTo.name : "";
      if (replyTo) {
        open[replyTo.id] = 1;
        if (c.by !== state.uid && ta.value.indexOf("@" + replyTo.name) < 0) { ta.value = "@" + replyTo.name + " " + ta.value; men[c.by] = replyTo.name; }
        try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
      }
    }
    rx0.onclick = function () { if (editing) setEdit(null); else setReply(null); };
    function cReact(c, e) {   // e: إيموجي ⇒ تفاعل · null ⇒ سحبه
      var me = state.uid, lk = (c.likes || []).filter(function (u) { return u !== me; }), rx = Object.assign({}, c.rx || {});
      if (e) { lk.push(me); rx[me] = e; } else delete rx[me];
      c.likes = lk; c.rx = rx; paint();
      call("moment.creact", e ? { pid: p.id, cmid: c.id, on: true, e: e } : { pid: p.id, cmid: c.id, on: false }).catch(function (er) { toast(L("تعذّر: ", "Failed: ") + ((er && er.message) || er)); });
    }
    function cDelete(c) {
      var kids = list.filter(function (x) { return x.re === c.id; }).length;
      if (!global.confirm(kids ? L("حذف التعليق وردوده؟", "Delete this comment and its replies?") : L("حذف هذا التعليق؟", "Delete this comment?"))) return;
      if (editing && editing.id === c.id) setEdit(null);
      list = list.filter(function (x) { return x.id !== c.id && x.re !== c.id; }); paint();
      call("moment.uncomment", { pid: p.id, cmid: c.id }).catch(function (e) { toast(L("تعذّر: ", "Failed: ") + ((e && e.message) || e)); });
    }
    // C136: ضغطةٌ مطوّلة على التعليق ⇒ تفاعلات سريعة + ردّ · نسخ · تعديل · حذف (بدل تحديد النصّ)
    function cMenu(c) {
      var me = state.uid, my = (c.likes || []).indexOf(me) >= 0 ? ((c.rx || {})[me] || "❤️") : null, sh = sheet(null);
      sh.ov.style.zIndex = "2147483006";
      var q = mk("div", "display:grid;grid-template-columns:repeat(10,1fr);gap:0;direction:" + (isAr() ? "rtl" : "ltr") + ";padding:2px 0 8px");
      MO_RX.forEach(function (e) {
        var b = mk("button", "min-width:0;height:40px;border:0;border-radius:12px;background:" + (my === e ? "#E3F0FB" : "transparent") + ";font-size:22px;padding:0", e);
        b.setAttribute("aria-label", moRxName(e)); b.onclick = function () { sh.close(); cReact(c, my === e ? null : e); }; q.appendChild(b);
      });
      sh.box.appendChild(q);
      var add = function (tx, kind, fn) { var b = mkBtn(tx, kind); b.style.marginTop = "8px"; b.onclick = function () { sh.close(); fn(); }; sh.box.appendChild(b); };
      add(L("↩️ ردّ", "↩️ Reply"), "", function () { setReply(c); });
      add(L("📋 نسخ النصّ", "📋 Copy text"), "", function () { copyText(c.text || ""); toast(L("نُسخ ✓", "Copied ✓")); });
      if (c.by === me) add(L("✏️ تعديل", "✏️ Edit"), "", function () { setEdit(c); });
      if (c.by === me || p.by === me) add(L("🗑 حذف", "🗑 Delete"), "danger", function () { cDelete(c); });
      if (c.by !== me) add(L("🚩 إبلاغ عن التعليق", "🚩 Report comment"), "danger", function () { moReport(p, c); });   // C150
      add(L("إلغاء", "Cancel"), "ghost", function () {});
    }
    function row(c, isReply) {
      var me = state.uid, lk = c.likes || [], my = lk.indexOf(me) >= 0 ? ((c.rx || {})[me] || "❤️") : null, nm = moName(c.by, c.name);
      var tmp = String(c.id).indexOf("tmp") === 0;
      var r = mk("div", "display:flex;gap:9px;padding:6px 4px;align-items:flex-start;border-radius:12px" + (isReply ? ";margin-inline-start:42px" : ""));
      r.setAttribute("data-cm", c.id);
      var av = moAv(c.by, nm, isReply ? 26 : 34, T); av.style.cursor = "pointer"; av.onclick = function () { moPerson(c.by, c.name); }; r.appendChild(av);
      var bub = mk("div", "flex:1;min-width:0");
      var b2 = mk("div", "position:relative;display:inline-block;max-width:100%;background:" + T.bg + ";border-radius:16px;padding:8px 12px;box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none");
      b2.appendChild(mk("div", "font:800 13px system-ui", nm));
      var t2 = mk("div", "font:500 14px/1.65 system-ui;white-space:pre-wrap;word-break:break-word"); moRich(t2, c.text, c.menN, T); b2.appendChild(t2);
      if (lk.length) {
        var sm = moRxSum(c);
        b2.appendChild(mk("span", "position:absolute;bottom:-10px;" + (isAr() ? "left" : "right") + ":-4px;background:" + T.card + ";border-radius:10px;padding:1px 6px;font:700 11px system-ui;color:" + T.text + ";box-shadow:0 1px 3px rgba(0,0,0,.18);white-space:nowrap",
          sm.slice(0, 3).map(function (x) { return x[0]; }).join("") + " " + lk.length));
      }
      if (!tmp) { moLong(b2, function () { cMenu(c); }); b2.setAttribute("data-cmb", "1"); }
      bub.appendChild(b2);
      var mt = mk("div", "font:600 11.5px system-ui;color:" + T.muted + ";padding:" + (lk.length ? "11px" : "4px") + " 8px 0;display:flex;gap:14px;align-items:center;flex-wrap:wrap", timeAgo(c.ts) + (c.edited ? " · " + L("معدّل", "edited") : ""));
      var a = function (label, color, fn) { var b = mk("button", "border:0;background:transparent;color:" + color + ";font:800 11.5px system-ui;padding:0;-webkit-user-select:none;user-select:none", label); b.onclick = fn; mt.appendChild(b); return b; };
      if (!tmp) {
        var lb = a(my ? (my === "❤️" ? "" : my + " ") + moRxName(my) : L("إعجاب", "Like"), !my ? T.muted : my === "❤️" ? "#E11D48" : "#D97706", function () { cReact(c, my ? null : "❤️"); });
        lb.setAttribute("data-crx", "1");
        moLong(lb, function () { moRxPicker(lb, my, function (e) { cReact(c, e); }); });
        a(L("ردّ", "Reply"), T.muted, function () { setReply(c); });
        if (c.by === me) a(L("تعديل", "Edit"), T.muted, function () { setEdit(c); });
        if (c.by === me || p.by === me) a(L("حذف", "Delete"), T.muted, function () { cDelete(c); });
      }
      bub.appendChild(mt); r.appendChild(bub);
      return r;
    }
    function paint() {
      var y = body.scrollTop; body.innerHTML = "";
      title.textContent = L("التعليقات", "Comments") + (list.length ? " (" + list.length + ")" : "");
      if (!list.length) body.appendChild(moEmpty(T, "💬", L("لا تعليقات بعد", "No comments yet"), L("ابدأ الحديث.", "Start the conversation.")));
      var ids = {}; list.forEach(function (c) { ids[c.id] = 1; });
      var kids = {}, roots = list.filter(function (c) { return !c.re || !ids[c.re]; });
      list.forEach(function (c) { if (c.re && ids[c.re]) (kids[c.re] = kids[c.re] || []).push(c); });
      roots.forEach(function (c) {
        body.appendChild(row(c, false));
        var ks = kids[c.id] || []; if (!ks.length) return;
        if (open[c.id] || ks.length <= 2) ks.forEach(function (k) { body.appendChild(row(k, true)); });
        else { var mr = mk("button", "display:block;border:0;background:transparent;color:" + T.primary + ";font:800 12.5px system-ui;padding:2px 0 8px;margin-inline-start:52px", "↳ " + L("عرض ", "View ") + moRepliesWord(ks.length));
          mr.onclick = function () { open[c.id] = 1; paint(); }; body.appendChild(mr); }
      });
      body.scrollTop = stick ? body.scrollHeight : y; stick = false;
    }
    function focusTo(id) {
      var c = list.filter(function (x) { return x.id === id; })[0]; if (!c) return;
      if (c.re) open[c.re] = 1; paint();
      var el = body.querySelector('[data-cm="' + id + '"]');
      if (el) { try { el.scrollIntoView({ block: "center" }); } catch (e) {} el.style.animation = "moFlash 2.4s ease-out"; }
    }
    paint();
    try {
      unsub = fsdb().collection("moments").doc(p.id).collection("cm").limit(400).onSnapshot(function (snap) {
        var a = []; snap.forEach(function (d) { var v = d.data() || {}; v.id = d.id; a.push(v); });
        var hid = moHidden();   // C150: المُبلَّغ عنه عندي، والمحجوب بعد ٣ بلاغات (إلّا لصاحبه)
        a = a.filter(function (x) { return !hid[p.id + "/" + x.id] && (!x.held || x.by === state.uid); });
        a.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); }); list = a;
        if (first) { first = false; if (o.focus) { stick = false; paint(); focusTo(o.focus); return; } stick = true; }
        paint();
      }, function (e) { log("cm:", e && e.message); });
    } catch (e) {}
    sb.onclick = function () {
      var tx = ta.value.trim(); if (!tx) return;
      var out = moMenOut(tx, men), menN = {}; out.forEach(function (m) { menN[m.u] = m.n; });
      if (editing) {   // C136
        var ec = editing; if (tx === ec.text) { setEdit(null); return; }
        ec.text = tx; ec.menN = menN; ec.edited = Date.now(); setEdit(null); mm.hide(); paint();
        call("moment.cedit", { pid: p.id, cmid: ec.id, text: tx, men: out }).catch(function (e) { toast(L("تعذّر التعديل: ", "Couldn't edit: ") + ((e && e.message) || e)); });
        return;
      }
      var pl = { pid: p.id, text: tx, men: out }; if (replyTo) pl.re = replyTo.id;
      ta.value = ""; sb.disabled = true; mm.hide();
      list = list.concat([{ id: "tmp" + Date.now(), by: state.uid, name: moName(state.uid), text: tx, ts: Date.now(), re: replyTo ? replyTo.id : null, menN: menN }]);
      stick = !replyTo; setReply(null); moMenClear(men); paint();
      call("moment.comment", pl).then(function () { sb.disabled = false; }, function (e) { sb.disabled = false; toast(L("تعذّر الإرسال: ", "Couldn't send: ") + ((e && e.message) || e)); });
    };
    if (!o.focus) setTimeout(function () { try { ta.focus(); } catch (e) {} }, 250);
    return { close: close, reply: setReply };
  }
  // ---------- الجمهور ----------
  function moPickPeople(title, selected, cb) {
    var sel = {}; (selected || []).forEach(function (u) { sel[u] = 1; });
    var s = sheet(title); s.ov.style.zIndex = "2147483006"; var q = mk("input", "width:100%;box-sizing:border-box;border:1px solid #dfe5ec;border-radius:12px;padding:10px 12px;font:600 14px system-ui;margin:4px 0 8px");
    q.placeholder = L("بحث بالاسم…", "Search…"); s.box.appendChild(q);
    var lst = mk("div", ""); s.box.appendChild(lst);
    var people = contacts().filter(function (c) { return c.uid && c.uid !== state.uid; });
    function paint() {
      lst.innerHTML = ""; var v = q.value.trim().toLowerCase();
      if (!people.length) lst.appendChild(note(L("لا جهات اتّصال بعد.", "No contacts yet.")));
      people.filter(function (c) { return !v || String(c.name || "").toLowerCase().indexOf(v) >= 0; }).forEach(function (c) {
        var r = mk("button", "display:flex;align-items:center;gap:10px;width:100%;padding:8px 2px;border:0;border-top:1px solid #eef1f4;background:transparent;text-align:start;font-family:system-ui;color:#1A1A2E");
        r.appendChild(moAv(c.uid, c.name, 36, moTheme())); r.appendChild(mk("div", "flex:1;font:700 14px system-ui", c.name));
        r.appendChild(mk("div", "font-size:20px", sel[c.uid] ? "☑️" : "⬜"));
        r.onclick = function () { if (sel[c.uid]) delete sel[c.uid]; else sel[c.uid] = 1; paint(); }; lst.appendChild(r);
      });
    }
    q.oninput = paint; paint();
    var ok = mkBtn(L("تمّ", "Done"), "primary"); ok.style.cssText += ";position:sticky;bottom:0;margin-top:10px";
    ok.onclick = function () { s.close(); cb(Object.keys(sel)); }; s.box.appendChild(ok);
  }
  function moAudSheet(cur, lists, cb) {
    var s = sheet(L("من يرى لحظتك؟", "Who can see your moment?")); s.ov.style.zIndex = "2147483005";
    var opt = function (ic, title, desc, val, extra) {
      var on = cur.mode === val.mode && (val.mode !== "chat" || cur.cid === val.cid) && (val.mode !== "custom" || cur.label === val.label);
      var r = mk("button", "display:flex;align-items:center;gap:12px;width:100%;padding:11px 4px;border:0;border-top:1px solid #eef1f4;background:transparent;text-align:start;font-family:system-ui;color:#1A1A2E");
      r.appendChild(mk("div", "width:40px;height:40px;border-radius:12px;background:#eef5fc;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0", ic));
      var t = mk("div", "flex:1;min-width:0"); t.appendChild(mk("div", "font:800 14.5px system-ui", title)); if (desc) t.appendChild(mk("div", "font:500 12px system-ui;color:#6b7280;margin-top:2px", desc)); r.appendChild(t);
      r.appendChild(mk("div", "font-size:18px;color:#2F80C8", on ? "●" : "○"));
      r.onclick = function () { if (extra) extra(); else { s.close(); cb(val); } }; s.box.appendChild(r);
    };
    opt("👥", L("جهات اتّصالي", "My contacts"), L("كلّ من في جهات اتّصالك في سوا", "Everyone in your Sawa contacts"), { mode: "contacts" });
    opt("⭐", L("المقرّبون", "Close friends"), L("قائمتك الخاصّة — اضغط لتعديلها", "Your private list — tap to edit"), { mode: "close" }, function () {
      moPrefs().then(function (pr) {
        moPickPeople(L("المقرّبون", "Close friends"), pr.close, function (uids) {
          call("moment.prefs", { close: uids }).then(function (r) { mo.prefs = { close: r.close || [], hide: r.hide || [], mute: r.mute || [], seen: r.seen || (mo.prefs && mo.prefs.seen) || 0 }; s.close(); cb({ mode: "close" }); toast(L("حُفظت قائمة المقرّبين ✓ (" + uids.length + ")", "Close friends saved ✓")); }, function (e) { toast((e && e.message) || String(e)); });
        });
      }, function (e) { toast((e && e.message) || String(e)); });
    });
    var groupsList = []; try { Object.keys(chats).forEach(function (k) { var c = chats[k] || {}; if ((c.type === "group" || c.type === "family") && !c.left && !c.e2e) groupsList.push({ id: k, name: c.name || L("مجموعة", "Group"), type: c.type }); }); } catch (e) {}
    if (groupsList.length) {
      s.box.appendChild(mk("div", "font:800 12px system-ui;color:#6b7280;margin:14px 4px 4px", L("عائلة أو مجموعة", "A family or group")));
      groupsList.forEach(function (g) { opt(g.type === "family" ? "🌳" : "👥", g.name, L("أعضاء هذه ", "Members of this ") + (g.type === "family" ? L("العائلة", "family") : L("المجموعة", "group")), { mode: "chat", cid: g.id, name: g.name }); });
    }
    if (lists && lists.length) {
      s.box.appendChild(mk("div", "font:800 12px system-ui;color:#6b7280;margin:14px 4px 4px", L("قوائم البثّ", "Broadcast lists")));
      lists.forEach(function (b) { if (b.uids && b.uids.length) opt("📣", b.name, b.uids.length + L(" شخصاً", " people"), { mode: "custom", uids: b.uids, label: b.name }); });
    }
    s.box.appendChild(mk("div", "font:800 12px system-ui;color:#6b7280;margin:14px 4px 4px", L("مخصّص", "Custom")));
    opt("🎯", L("أشخاص محدّدون", "Specific people"), L("اختر من جهات اتّصالك", "Pick from your contacts"), { mode: "custom", label: "custom" }, function () {
      moPickPeople(L("أشخاص محدّدون", "Specific people"), cur.mode === "custom" ? cur.uids : [], function (uids) { if (!uids.length) return; s.close(); cb({ mode: "custom", uids: uids, label: "custom" }); });
    });
  }
  // ==================================================================
  // C135: الردود · الإعجاب بالتعليقات · التفاعلات · الإشارة بـ@ · إشعارات اللحظات · فتح لحظةٍ من إشعار · التعديل · لحظات شخصٍ واحد
  // ==================================================================
  var MO_RX = ["❤️", "😍", "😂", "😊", "😮", "😢", "😭", "😡", "👏", "🤲"];   // C136: عشرة تفاعلات
  var MO_SEEN_KEY = "sawa_mnote_seen";
  function moRxName(e) {
    var m = { "❤️": L("أعجبني", "Like"), "😍": L("أحببته", "Love"), "😂": L("أضحكني", "Haha"), "😊": L("أسعدني", "Happy"), "😮": L("أدهشني", "Wow"),
      "😢": L("أحزنني", "Sad"), "😭": L("أبكاني", "Crying"), "😡": L("أغضبني", "Angry"), "👏": L("رائع", "Bravo"), "🤲": L("دعاء", "Prayer") };
    return m[e] || L("إعجاب", "Like");
  }
  function moCss() {
    if (document.getElementById("mo-css")) return;
    var st = document.createElement("style"); st.id = "mo-css";
    st.textContent = "@keyframes moPop{from{transform:scale(.3) translateY(10px);opacity:0}to{transform:scale(1);opacity:1}}" +
      "@keyframes moHeart{0%{transform:translate(-50%,-50%) scale(0);opacity:0}15%{transform:translate(-50%,-50%) scale(1.25);opacity:1}30%{transform:translate(-50%,-50%) scale(.95)}45%,75%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}" +
      "@keyframes moFlash{0%,40%{background:#FFF3C4}100%{background:transparent}}";
    document.head.appendChild(st);
  }
  function moSeen() { var a = 0; try { a = Number(localStorage.getItem(MO_SEEN_KEY) || 0); } catch (e) {} return Math.max(a, (mo.prefs && mo.prefs.seen) || 0); }
  function moUnread() { var s = moSeen(); return mo.notes.filter(function (n) { return (n.ts || 0) > s && n.from !== state.uid; }).length; }
  function startNotes(uid) {
    stopNotes(); var d = fsdb(); if (!d || !uid) return;
    try {
      mo.nUnsub = d.collection("mnote").doc(uid).collection("n").limit(50).onSnapshot(function (snap) {
        var a = []; snap.forEach(function (x) { var v = x.data() || {}; v.id = x.id; a.push(v); });
        a.sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); }); mo.notes = a; moEmit();
      }, function (e) { log("mnote:", e && e.message); mo.nUnsub = null; clearTimeout(mo.nrt); mo.nrt = setTimeout(function () { if (state.uid === uid && !mo.nUnsub) startNotes(uid); }, 30000); });
    } catch (e) { log("mnote", e && e.message); }
  }
  function stopNotes() { if (mo.nUnsub) { try { mo.nUnsub(); } catch (e) {} } mo.nUnsub = null; }
  function moMarkSeen() {
    var now = Date.now(); try { localStorage.setItem(MO_SEEN_KEY, String(now)); } catch (e) {}
    if (mo.prefs) mo.prefs.seen = now; moEmit();
    call("moment.seen", { ts: now }).catch(function () {});
  }
  function moNorm(s) { return String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"); }
  function moKnown(list) { var gen = L("مستخدم سوا", "Sawa user"); return list.filter(function (c) { return c.uid && c.uid !== state.uid && c.name && c.name !== gen; }); }
  // الإشارة بـ@: اكتب @ ثمّ أوّل الاسم ⇒ اقتراحات · men = { uid: الاسم } ويُرسَل منها ما بقي في النصّ
  function moMention(ta, cands, men, T, anchor) {
    var box = mk("div", "display:none;max-height:216px;overflow-y:auto;background:" + T.card + ";border:1px solid " + T.border + ";border-radius:14px;box-shadow:0 6px 22px rgba(0,0,0,.14);margin:0 10px 6px;flex-shrink:0");
    box.setAttribute("data-mo-sug", "1");
    anchor.parentNode.insertBefore(box, anchor);
    var cur = null;
    function hide() { box.style.display = "none"; cur = null; }
    function check() {
      var pos = ta.selectionStart == null ? ta.value.length : ta.selectionStart, before = ta.value.slice(0, pos);
      var m = /(^|[\s(])@([^\s@]{0,30})$/.exec(before);
      if (!m) { hide(); return; }
      var q = moNorm(m[2]), seen = {}, list = moKnown(cands()).filter(function (c) { if (seen[c.uid]) return false; seen[c.uid] = 1; return !q || moNorm(c.name).indexOf(q) >= 0; }).slice(0, 6);
      if (!list.length) { hide(); return; }
      cur = { pos: pos, len: m[2].length + 1 };
      box.innerHTML = ""; box.style.display = "block";
      list.forEach(function (c) {
        var r = mk("button", "display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;border:0;background:transparent;text-align:start;font-family:system-ui;color:" + T.text);
        r.appendChild(moAv(c.uid, c.name, 30, T)); r.appendChild(mk("div", "flex:1;font:700 14px system-ui", c.name));
        r.addEventListener("mousedown", function (e) { e.preventDefault(); });
        r.onclick = function () { pick(c); }; box.appendChild(r);
      });
    }
    function pick(c) {
      if (!cur) return;
      var v = ta.value, start = cur.pos - cur.len, ins = "@" + c.name + " ";
      ta.value = v.slice(0, start) + ins + v.slice(cur.pos); men[c.uid] = c.name;
      var at = start + ins.length; try { ta.focus(); ta.setSelectionRange(at, at); } catch (e) {}
      hide();
    }
    ta.addEventListener("input", check); ta.addEventListener("click", check);
    ta.addEventListener("keyup", function (e) { if (e.key === "Escape") hide(); });
    ta.addEventListener("blur", function () { setTimeout(hide, 200); });
    return { check: check, hide: hide, pick: pick,
      insertAt: function () { var p = ta.selectionStart == null ? ta.value.length : ta.selectionStart, v = ta.value, pre = p > 0 && !/\s/.test(v.charAt(p - 1)) ? " @" : "@"; ta.value = v.slice(0, p) + pre + v.slice(p); try { ta.focus(); ta.setSelectionRange(p + pre.length, p + pre.length); } catch (e) {} check(); } };
  }
  function moMenOut(text, men) { var out = []; Object.keys(men || {}).forEach(function (u) { if (men[u] && text.indexOf("@" + men[u]) >= 0) out.push({ u: u, n: men[u] }); }); return out; }
  function moMenClear(men) { Object.keys(men).forEach(function (k) { delete men[k]; }); }
  // النصّ مع إبراز @الأسماء المُشار إليها (والضغط عليها)
  function moRich(el, text, menN, T) {
    text = String(text || ""); var names = [];
    Object.keys(menN || {}).forEach(function (u) { if (menN[u]) names.push({ u: u, s: "@" + menN[u] }); });
    names.sort(function (a, b) { return b.s.length - a.s.length; });
    if (!names.length) { el.textContent = text; return el; }
    var i = 0, buf = "";
    while (i < text.length) {
      var hit = null;
      if (text.charAt(i) === "@") for (var k = 0; k < names.length; k++) if (text.substr(i, names[k].s.length) === names[k].s) { hit = names[k]; break; }
      if (hit) {
        if (buf) { el.appendChild(document.createTextNode(buf)); buf = ""; }
        var sp = mk("span", "color:" + T.primary + ";font-weight:800;cursor:pointer", hit.s);
        (function (u) { sp.onclick = function (e) { e.stopPropagation(); moPerson(u, menN[u]); }; })(hit.u);
        el.appendChild(sp); i += hit.s.length;
      } else { buf += text.charAt(i); i++; }
    }
    if (buf) el.appendChild(document.createTextNode(buf));
    return el;
  }
  function moCloseOverlays() { Array.prototype.slice.call(document.querySelectorAll("[data-mo-ov]")).forEach(function (x) { try { if (x._close) x._close(); else x.remove(); } catch (e) {} }); }
  function moPerson(u, name) {
    var nm = moName(u, name), s = sheet(null);
    var hd = mk("div", "display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:6px"); hd.appendChild(moAv(u, nm, 64, moTheme())); hd.appendChild(mk("div", "font:800 17px system-ui", nm)); s.box.appendChild(hd);
    var add = function (tx, kind, fn) { var b = mkBtn(tx, kind); b.style.marginTop = "8px"; b.onclick = function () { s.close(); fn(); }; s.box.appendChild(b); };
    add(u === state.uid ? L("🌿 لحظاتي", "🌿 My moments") : L("🌿 لحظات ", "🌿 Moments by ") + nm, ""