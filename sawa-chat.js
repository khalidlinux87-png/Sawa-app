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
  var VERSION = "c20";
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
  function guestTag(uid) { var t = String(uid || "").replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase(); return t || "؟"; }
  function nickOf(uid) { try { return (prefs && prefs.nick && prefs.nick[uid]) || null; } catch (e) { return null; } }
  function displayName(p) {
    return nickOf(p.uid) || p.name || (p.anon ? L("ضيف · ", "Guest · ") + guestTag(p.uid) : L("عضو", "Member") + " · " + guestTag(p.uid));
  }
  function decorate(p) {
    var pr = state.presence[p.uid] || null;
    return { id: p.uid, uid: p.uid, name: displayName(p), realName: p.name || null, nick: nickOf(p.uid), anon: !!p.anon, tag: guestTag(p.uid),
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
  function refresh() {
    if (!state.uid || state.loading) return Promise.resolve(contacts());
    state.loading = true;
    return call("people.list", {}).then(function (b) {
      state.me = b.me || null; state.people = b.people || []; state.loaded = true; state.error = null;
      maybeAskName();
      lsSet("sawa_people_cache", { uid: state.uid, me: state.me, people: state.people });
      watchPresence();
      publish();
      return contacts();
    }).catch(function (e) {
      state.error = (e && e.message) || String(e); log("people.list:", state.error);
      return contacts();
    }).then(function (r) { state.loading = false; return r; });
  }

  // ---------- الملفّ الشخصيّ: اسم «سوا» + رقم الهاتف (غير موثّق حتّى الإطلاق) ----------
  function profile() {
    var m = state.me || {};
    return { uid: state.uid, name: m.name || null, phone: m.phone || null, phoneVerified: false, googleName: m.googleName || null, anon: !!m.anon,
             code: m.code || null, findable: m.findable !== false };
  }
  function saveProfile(patch) {
    return call("profile.set", patch).then(function (b) {
      state.me = Object.assign({}, state.me || {}, { name: b.profile.name, phone: b.profile.phone });
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
    box.appendChild(lab(L("اسمك في سوا — يراه من تتواصل معهم", "Your name in Sawa — shown to people you connect with")));
    var nIn = inp(p.name || p.googleName || "", L("مثال: خالد علي", "e.g. Khalid Ali")); box.appendChild(nIn);
    if (p.googleName && p.googleName !== p.name) { var g = document.createElement("div"); g.textContent = L("اسم حساب Google: ", "Google name: ") + p.googleName; g.style.cssText = "font:500 11px system-ui;color:#888;margin:4px 2px 0"; box.appendChild(g); }
    box.appendChild(lab(L("رقم هاتفك (اختياريّ)", "Your phone number (optional)")));
    var pIn = inp(p.phone || "", "+249 9X XXX XXXX", true); pIn.type = "tel"; box.appendChild(pIn);
    var note = document.createElement("div");
    note.textContent = L("⚠️ «غير موثّق»: يظهر لجهات اتّصالك فقط، ولا يُستعمل للدخول أو البحث عنك حتّى نوثّقه برسالة SMS عند الإطلاق.", "⚠️ Unverified: visible to your contacts only; not used for sign-in or search until SMS verification at launch.");
    note.style.cssText = "font:500 11px system-ui;color:#8a6d00;background:#fff7e0;border-radius:10px;padding:8px 10px;margin-top:8px;line-height:1.6";
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
      if (!Object.keys(patch).length) { close(); return; }
      if (patch.name !== undefined && patch.name.length < 2) { toast(L("اكتب اسماً من حرفين على الأقلّ", "Enter at least 2 letters")); return; }
      ok.disabled = true; ok.textContent = "…";
      saveProfile(patch).then(function () { toast(L("حُفظ ✓ — يظهر لجهات اتّصالك خلال لحظات", "Saved ✓")); close(); refresh(); })
        .catch(function (e) { ok.disabled = false; ok.textContent = L("حفظ", "Save"); toast((e && e.message) || String(e)); });
    };
    setTimeout(function () { try { nIn.focus(); } catch (e) {} }, 50);
    return true;
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
    sub.textContent = (p.name ? L("اسمه في سوا: ", "Their Sawa name: ") + p.name : (p.anon ? L("ضيف بلا اسم · الرمز ", "Unnamed guest · code ") + guestTag(uid) : "")) + " — " + L("التسمية تظهر لك وحدك", "only you see this name");
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
  function startMyPresence(uid) {
    var d = db(); if (!d) { log("Realtime Database غير محمَّلة"); return; }
    stopMyPresence();
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
    jsqrP = new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
      sc.onload = function () { global.jsQR ? res(global.jsQR) : rej(new Error("jsQR")); };
      sc.onerror = function () { jsqrP = null; rej(new Error(L("تعذّر تحميل قارئ QR — تحقّق من الاتّصال", "Couldn't load the QR reader — check your connection"))); };
      document.head.appendChild(sc);
    });
    return jsqrP;
  }
  function scanSupported() { return !!(global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function scanQr() {
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
    toast(L("هذا الرمز ليس من سوا", "That isn't a Sawa code")); return null;
  }
  function scanAny() {
    return scanQr().then(function (txt) { return txt ? routeScanned(txt) : null; })
      .catch(function (e) { toast((e && e.message) || String(e)); return null; });
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
  function isCloud(id) { return /^(dm_|sv_|fam_|grp_)/.test(String(id || "")); }
  function appId(u) { return u === state.uid ? "u-1" : u; }
  function realId(u) { return u === "u-1" ? state.uid : u; }
  function newMsgId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function dmWith(other) { return "dm_" + [state.uid, other].sort().join("_"); }
  function others(c) { return (c.members || []).filter(function (u) { return u !== state.uid; }); }
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
      : type === "tasks" ? L("✅ مهامّ", "✅ Tasks") : "";
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
      chats = next;
      for (var v in virtualChats) if (chats[v]) delete virtualChats[v];
      // «وصلت»: آخر رسالةٍ من غيري أحدث ممّا سجّلتُه
      Object.keys(chats).forEach(function (cid) {
        var c = chats[cid], l = c.last;
        if (l && l.by !== state.uid && l.ts > ((c.delivered || {})[state.uid] || 0)) queueMark(cid, { d: l.ts });
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
    var ob = lsGet(OUTBOX, []); ob.push({ uid: state.uid, cid: cid, msg: msg }); lsSet(OUTBOX, ob);
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
  var PERMANENT = /bad |not a member|too large|message id taken|only |empty message|media not uploaded|media id required|chat not found|not a contact|removed|confirm required/i;
  function drainOutbox() {
    if (draining || !state.uid) return;
    var ob = myOutbox(); if (!ob.length) return;
    draining = true; drainAt = Date.now();
    var job = ob[0];
    call("chat.send", { cid: job.cid, msg: job.msg }).then(function (b) {
      setPend(job.cid, job.msg.id, b && b.blocked ? "sent" : "sent");
      shiftOutbox(job.msg.id);
    }).catch(function (e) {
      var m = (e && e.message) || String(e);
      if (!PERMANENT.test(m)) {        // الشبكة أو الخادم مؤقّتاً: نعيد لاحقاً (أسرع في المحاولة الأولى)
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
    var ob = lsGet(OUTBOX, []); if (!ob.some(function (x) { return x.msg.id === id; })) { ob.push({ uid: state.uid, cid: j.cid, msg: j.msg }); lsSet(OUTBOX, ob); }
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
  function edit(cid, id, text) {
    var day = patchLocal(cid, id, function (m) { m.text = text; m.edited = Date.now(); return m; });
    if (!day) return;
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
    publishMessages(cid); publishChats(); savePrefs({ cleared: prefs.cleared });
  }
  function react(cid, id, emoji) {
    var day = patchLocal(cid, id, function (m) { m.re = Object.assign({}, m.re); if (emoji) m.re[state.uid] = emoji; else delete m.re[state.uid]; return m; });
    if (!day) return;
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
    return {
      id: c.cid, cloud: true, kind: c.type, peerUid: other || null,
      name: c.type === "saved" ? L("رسائلي المحفوظة", "Saved messages") : personName(other, c),
      isSavedMessages: c.type === "saved",
      lastMessage: lp ? preview(lp.msg) : preview(l), lastFromMe: lastMine,
      lastStatus: lp ? lp.status : (l && l.by === state.uid ? statusOf(c, l.ts) : null),
      unread: unreadOf(c), updatedAt: lp ? lp.ts : (c.updatedTs || 0), pinnedMessageId: c.pinned || null,
      disappear: c.disappear || 0, online: !!(p && state.presence[other] && state.presence[other].state === "online")
    };
  }
  function groupOf(c) {
    var admins = c.admins || [], l = c.last;
    var members = (c.members || []).map(function (u) {
      return { id: appId(u), uid: u, name: u === state.uid ? L("أنت", "You") : personName(u, c), role: admins.indexOf(u) >= 0 ? "admin" : "member" };
    });
    var pendList = pend[c.cid] || [], lp = pendList[pendList.length - 1];
    var lastText = lp ? preview(lp.msg) : (l ? (l.type === "system" ? sysText({ by: l.by, extra: { ev: l.ev } }, c).replace(/«»|“”/g, "").trim() : (l.by && l.by !== state.uid ? personName(l.by, c) + ": " : "") + preview(l)) : "");
    return { id: c.cid, cloud: true, kind: c.type, familyGroupId: c.familyGroupId || null, desc: c.desc || "", adminsOnly: !!c.adminsOnly, infoAdminsOnly: !!c.infoAdminsOnly,
      name: c.name || L("مجموعة", "Group"), members: members, lastMessage: lastText,
      unread: unreadOf(c), updatedAt: lp ? lp.ts : (c.updatedTs || 0), pinnedMessageId: c.pinned || null, disappear: c.disappear || 0 };
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
    (pend[cid] || []).forEach(function (p) { if (!hidden[p.msg.id]) arr.push({ m: Object.assign({ by: state.uid, ts: p.ts }, p.msg), pending: p.status, progress: p.uploading ? (p.progress || 0) : null }); });
    arr.sort(function (a, b) { return (a.m.ts || 0) - (b.m.ts || 0); });
    var group = c.type === "family" || c.type === "group";
    return arr.map(function (x) {
      var m = x.m, mine = m.by === state.uid, re = m.re || {};
      var mineRe = re[state.uid], anyRe = Object.keys(re).map(function (k) { return re[k]; })[0];
      var o = { id: m.id, day: x.day || null, createdAt: m.ts, text: m.del ? L("🚫 حُذفت هذه الرسالة", "🚫 This message was deleted") : (m.text || ""),
                type: m.del ? "text" : (m.type === "text" ? undefined : m.type), deleted: !!m.del, edited: !!m.edited,
                forwarded: !!m.fwd, reaction: mineRe || anyRe || null, reactions: re, replyTo: m.reply || null,
                replyToText: m.reply ? (m.reply.missing ? L("رسالة غير متاحة", "Message unavailable") : m.reply.del ? L("🚫 رسالة محذوفة", "🚫 Deleted message") : m.reply.text) : null, contact: m.contact || null, extra: m.extra || null, cloud: true,
                starred: !!(prefs && prefs.starred && prefs.starred.some(function (s) { return s.id === m.id; })) };
      if (group) { o.senderId = appId(m.by); o.senderName = personName(m.by, c); if (o.type === undefined) o.type = "text"; if (!m.del) toolShape(m, o, c); }
      else o.senderUserId = appId(m.by);
      if (!m.del && MEDIA_TYPES.indexOf(m.type) >= 0) mediaShape(m, o, cid, mine);
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
  function loadPrefs() {
    return call("chat.prefs", {}).then(function (b) {
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
      out[k] = k === "blocked" ? (o.blocked || []).filter(function (id) { return /^dm_/.test(id); }).map(function (id) { return id.slice(3).split("_").filter(function (u) { return u !== state.uid; })[0]; }).filter(Boolean)
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
    return send(cid, null, { type: "tasks", extra: { title: String(title), tasks: (tasks || []).map(function (t) { return { id: t.id, text: t.text, assigneeId: realId(t.assigneeId), assigneeName: t.assigneeName || "", dueAt: t.dueAt || null }; }) } });
  }
  function setTask(cid, id, taskId, patch) {
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
      adminsOnly: ex.on ? L(who + " جعل الإرسال للمشرفين فقط", who + " allowed only admins to send") : L(who + " سمح للجميع بالإرسال", who + " allowed everyone to send")
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
      o.type = "taskList"; o.title = ex.title || "";
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
  function sendMedia(cid, opts) {
    if (!isCloud(cid) || !state.uid) return null;
    var src = opts.blob || (opts.dataUrl ? dataUrlToBlob(opts.dataUrl) : null);
    if (!src) { toast(L("تعذّر قراءة الملفّ", "Couldn't read the file")); return null; }
    if (src.size > MAX_MEDIA) { toast(L("الحدّ الأقصى ١٦ ميجابايت", "The limit is 16 MB")); return null; }
    var kind = opts.kind, id = newMsgId(), mid = newMediaId();
    var extra = { mid: mid, name: opts.name || src.name || null, mime: src.type || null, size: src.size };
    if (opts.viewOnce) extra.viewOnce = true;
    if (opts.duration) extra.duration = opts.duration;
    if (opts.transcript) extra.transcript = String(opts.transcript).slice(0, 1500);
    localUrls[mid] = URL.createObjectURL(src);
    var msg = { id: id, type: kind, extra: extra };
    var p = { msg: msg, ts: Date.now(), status: "pending", uploading: true };
    (pend[cid] = pend[cid] || []).push(p);
    publishMessages(cid); publishChats();
    var prep = kind === "image" ? prepareImage(src) : kind === "video" ? prepareVideo(src) : Promise.resolve({ blob: src });
    prep.then(function (r) {
      var blob = r.blob || src;
      if (r.thumb) extra.thumb = r.thumb;
      if (r.w) { extra.w = r.w; extra.h = r.h; }
      if (r.duration && !extra.duration) extra.duration = Math.round(r.duration);
      extra.size = blob.size; extra.mime = blob.type || extra.mime;
      if (blob !== src) { try { URL.revokeObjectURL(localUrls[mid]); } catch (e) {} localUrls[mid] = URL.createObjectURL(blob); }
      publishMessages(cid);
      return uploadMedia(cid, mid, blob, extra, function (pct) { p.progress = pct; publishMessages(cid); });
    }).then(function () {
      p.uploading = false;
      var ob = lsGet(OUTBOX, []); ob.push({ uid: state.uid, cid: cid, msg: msg }); lsSet(OUTBOX, ob);
      drainOutbox();
    }).catch(function (e) {
      p.uploading = false; p.reupload = function () { p.reupload = null; p.status = "pending"; p.uploading = true; publishMessages(cid); return prep.then(function (r) { return uploadMedia(cid, mid, r.blob || src, extra, function (pct) { p.progress = pct; publishMessages(cid); }); })
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
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(function (res) {
      try {
        var r = indexedDB.open("sawa-media", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("m"); };
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
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
  function ensureMedia(cid, mid, noCache) {
    if (!mid || mediaUrls[mid] || localUrls[mid] || mediaLoading[mid] || mediaFailed[mid]) return Promise.resolve(mediaUrls[mid] || localUrls[mid] || null);
    mediaLoading[mid] = true;
    return idbGet(mid).then(function (b) {
      var tmp = !!((chats[cid] || {}).disappear);   // C14: لا نحفظ وسائط المحادثات المؤقّتة على الجهاز
      return b || fetchMedia(cid, mid).then(function (blob) { if (!noCache && !tmp) idbPut(mid, blob); return blob; });
    }).then(function (blob) {
      mediaUrls[mid] = URL.createObjectURL(blob); delete mediaLoading[mid]; publishMessages(cid); return mediaUrls[mid];
    }).catch(function (e) {
      delete mediaLoading[mid]; mediaFailed[mid] = (e && e.message) || "x"; publishMessages(cid);
      // C18: تعثّر التنزيل (شبكة ضعيفة) ⇒ إعادة تلقائيّة بعد ٥ ثم ٢٠ ثم ٦٠ ثانية — كان يبقى «لم يصل» حتّى إعادة فتح التطبيق
      var n = (mediaTries[mid] = (mediaTries[mid] || 0) + 1);
      if (!/gone/.test(mediaFailed[mid]) && n <= 3) setTimeout(function () { if (mediaFailed[mid] && !mediaUrls[mid]) { delete mediaFailed[mid]; ensureMedia(cid, mid, noCache); } }, [5000, 20000, 60000][n - 1]);
      return null;
    });
  }
  var mediaTries = {};
  function retryMedia(cid, mid) { if (!mid) return; delete mediaFailed[mid]; mediaTries[mid] = 0; publishMessages(cid); return ensureMedia(cid, mid); }
  // ملفٌّ عامّ: يُنزَّل ثمّ يُفتح/يُحفظ
  function openFile(m) {
    if (!m || !m.cloudMid) return;
    var url = mediaUrls[m.cloudMid] || localUrls[m.cloudMid];
    var go = function (u) {
      if (!u) { toast(L("تعذّر تنزيل الملفّ", "Couldn't download the file")); return; }
      var a = document.createElement("a"); a.href = u; a.download = m.text || "file"; a.target = "_blank";
      document.body.appendChild(a); a.click(); setTimeout(function () { try { a.remove(); } catch (e) {} }, 500);
    };
    if (url) return go(url);
    delete mediaFailed[m.cloudMid];
    toast(L("جارٍ التنزيل…", "Downloading…"));
    ensureMedia(m.cloudCid, m.cloudMid).then(go);
  }
  function markViewedOnce(cid, id) {
    var f = findMsg(cid, id); if (!f) return;
    patchLocal(cid, id, function (m) { m.viewed = Object.assign({}, m.viewed); m.viewed[state.uid] = Date.now(); return m; });
    call("media.viewed", { cid: cid, day: f.day, id: id }).catch(fail);
  }
  // يحوّل رسالة وسائط إلى شكل الواجهة (ويطلب التنزيل التلقائيّ للصغير في المحادثة المفتوحة)
  function mediaShape(m, o, cid, mine) {
    var ex = m.extra || {}, mid = ex.mid, url = localUrls[mid] || mediaUrls[mid] || null;
    var viewedByMe = !!(m.viewed && m.viewed[state.uid]);
    o.cloudMid = mid; o.cloudCid = cid; o.fileSize = ex.size || 0; o.mime = ex.mime || null;
    if (m.type === "image" || m.type === "video") {
      o.viewOnce = !!ex.viewOnce; o.viewedOnce = !!ex.viewOnce && (mine || viewedByMe || !!m.gone);
      // الفيديو لا يُعرض بصورةٍ مصغّرة داخل <video> — يبقى «غير متاح» حتّى يكتمل تنزيله
      o.fileUrl = o.viewedOnce ? null : (url || (m.type === "image" ? ex.thumb || null : null)); o.thumb = ex.thumb || null; o.mediaLoading = !url && !mediaFailed[mid];
      o.text = ex.name || ""; o.w = ex.w || null; o.h = ex.h || null; o.durationSec = ex.duration || null;
    } else if (m.type === "voice") {
      o.audioUrl = url; o.duration = typeof ex.duration === "number" ? (Math.floor(ex.duration / 60) + ":" + String(ex.duration % 60).padStart(2, "0")) : (ex.duration || "0:00");
      o.transcript = ex.transcript || null;
      o.mediaLoading = !url && !mediaFailed[mid]; o.mediaFailed = !url && !!mediaFailed[mid];   // C18: الفقاعة تعرض «يُنزَّل…» أو «اضغط لإعادة التنزيل»
    } else { o.text = ex.name || L("ملفّ", "File"); o.fileUrl = url; }
    var auto = cid === openCid && !url && !mediaFailed[mid] && !(ex.viewOnce && (mine || viewedByMe || m.gone))
      && (m.type !== "file") && (m.type !== "video" || (ex.size || 0) <= AUTO_DL);
    if (auto) setTimeout(function () { ensureMedia(cid, mid, !!ex.viewOnce); }, 0);
    return o;
  }

  // ==================================================================
  // C5: الإشعارات — Firebase Cloud Messaging. الرمز يُسجَّل عند الـWorker (push.register)، وعامل الخدمة (sw.js)
  //     يُظهر الإشعار أو يمرّره للتطبيق المفتوح. الضغط على الإشعار يفتح المحادثة نفسها.
  // ==================================================================
  var VAPID_KEY = "BIXTjlI7zsibBBqZXkdIGu7tEnqVKf9Rf63v20ZdfNiNs6jj5olbf-a1SJ1SpnNm3OcC807QpPEUR7GrwMAuGdw";   // ← مفتاح Web Push العامّ (Firebase Console ← Cloud Messaging ← Web Push certificates)
  function pushSupported() {
    try { return !!(VAPID_KEY && global.navigator && navigator.serviceWorker && global.PushManager && global.Notification && firebase.messaging && firebase.messaging.isSupported && firebase.messaging.isSupported()); }
    catch (e) { return false; }
  }
  function pushToken() {
    return navigator.serviceWorker.ready.then(function (reg) { return firebase.messaging().getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }); });
  }
  function registerToken(tok) {
    var prev = lsGet("sawa_push", {});
    if (prev.token === tok && prev.uid === state.uid) return Promise.resolve(true);
    return call("push.register", { token: tok, ua: (navigator.userAgent || "").slice(0, 150), prevUid: prev.uid && prev.uid !== state.uid ? prev.uid : null })
      .then(function () { lsSet("sawa_push", { token: tok, uid: state.uid, ts: Date.now() }); return true; });
  }
  function isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent || ""); }
  function pushState() {   // "granted" | "default" | "denied" | "off" (سُمح ثمّ أوقفه المستخدم من سوا) | "unsupported"
    if (!pushSupported()) return "unsupported";
    var p; try { p = Notification.permission; } catch (e) { return "unsupported"; }
    if (p === "granted" && lsGet("sawa_push_off", 0)) return "off";
    return p;
  }
  function emitPush() { try { global.dispatchEvent(new CustomEvent("sawa-push-state", { detail: pushState() })); } catch (e) {} }
  function deniedHelp() {
    return isIOS()
      ? L("الإشعارات محظورة لسوا. افتح «الإعدادات» ← «الإشعارات» ← «سوا» وفعّل «السماح بالإشعارات».",
          "Notifications are blocked for Sawa. Open Settings → Notifications → Sawa and turn on Allow Notifications.")
      : L("الإشعارات محظورة لسوا. اضغط مطوّلاً على أيقونة سوا ← «معلومات التطبيق» ← «الإشعارات» ← سماح. (أو من المتصفّح: 🔒 بجانب العنوان ← الأذونات ← الإشعارات ← سماح) ثمّ أعد فتح سوا.",
          "Notifications are blocked for Sawa. Long-press the Sawa icon → App info → Notifications → Allow (or in the browser: 🔒 next to the address → Permissions → Notifications → Allow), then reopen Sawa.");
  }
  function enablePush() {
    if (!VAPID_KEY) { toast(L("الإشعارات لم تُفعَّل بعد في هذا الإصدار", "Notifications aren't set up in this version yet")); return Promise.resolve(false); }
    if (!pushSupported()) { toast(L("هذا المتصفّح لا يدعم الإشعارات" + (isIOS() ? " — على آيفون ثبّت التطبيق على الشاشة الرئيسيّة أوّلاً" : ""), "This browser doesn't support notifications")); return Promise.resolve(false); }
    var perm0; try { perm0 = Notification.permission; } catch (e) {}
    if (perm0 === "denied") { hideBanner(); helpSheet(); return Promise.resolve(false); }
    try { localStorage.removeItem("sawa_push_off"); } catch (e) {}
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") { emitPush(); if (perm === "denied") helpSheet(); else toast(L("لم تُفعَّل الإشعارات — يمكنك المحاولة لاحقاً", "Notifications weren't turned on")); return false; }
      return pushToken().then(function (tok) { lsSet("sawa_push", {}); return registerToken(tok); })
        .then(function () { toast(L("الإشعارات مفعّلة ✓", "Notifications on ✓")); hideBanner(); emitPush(); return true; });
    }).catch(function (e) { toast(L("تعذّر تفعيل الإشعارات: ", "Couldn't enable notifications: ") + ((e && e.message) || e)); emitPush(); return false; });
  }
  function disablePush() {
    var prev = lsGet("sawa_push", {});
    lsSet("sawa_push", {}); lsSet("sawa_push_off", Date.now());
    var p = prev.token ? call("push.unregister", { token: prev.token }).catch(function () {}) : Promise.resolve();
    try { firebase.messaging().deleteToken().catch(function () {}); } catch (e) {}
    emitPush();
    return p;
  }
  function pushEnabled() { return pushState() === "granted"; }
  // بعد الدخول: إن سبق السماح نجدّد الرمز بصمت (يتغيّر أحياناً، أو تغيّر الحساب)؛ وإلا نعرض بطاقة التفعيل
  function refreshPush() {
    var st = pushState();
    emitPush();
    if (st === "default" || st === "denied") return maybeBanner(st);
    if (st !== "granted") return;
    pushToken().then(registerToken).catch(function (e) { log("push token:", (e && e.message) || e); });
  }
  // بطاقة «فعّل الإشعارات» (تحتاج ضغطة المستخدم — المتصفّحات تمنع الطلب التلقائيّ)
  //  · لم يُسأل بعد ⇒ تظهر كلّ فتحٍ، و«لاحقاً» يؤجّلها يوماً · محظورة ⇒ تظهر أسبوعيّاً مع طريقة الفتح
  var bannerEl = null;
  function hideBanner() { try { if (bannerEl) bannerEl.remove(); } catch (e) {} bannerEl = null; }
  function bannerShell() {
    var el = document.createElement("div");
    el.dir = isAr() ? "rtl" : "ltr"; el.id = "sawa-push-card";
    el.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:2147483640;background:#1f2d3a;color:#fff;border-radius:16px;padding:12px 14px;font:600 13px/1.6 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;max-width:520px;margin:0 auto";
    return el;
  }
  function btn(text, primary) {
    var b = document.createElement("button"); b.textContent = text;
    b.style.cssText = primary ? "background:#2e7d5b;color:#fff;border:0;border-radius:10px;padding:8px 12px;font:700 13px system-ui;white-space:nowrap"
                              : "background:transparent;color:#cfd8dc;border:0;padding:8px 6px;font:600 12px system-ui;white-space:nowrap";
    return b;
  }
  function maybeBanner(st) {
    st = st || pushState();
    if (bannerEl || !document.body || onbActive()) return;
    if (st !== "default" && st !== "denied") return;
    var snooze = st === "denied" ? 7 * 86400000 : 86400000;
    if (lsGet("sawa_push_asked", 0) > Date.now() - snooze) return;
    if (global.SawaRTC && ((SawaRTC.active && SawaRTC.active()) || (SawaRTC.group && SawaRTC.group()) || (SawaRTC.room && SawaRTC.room()))) return;
    bannerEl = bannerShell();
    var txt = document.createElement("div"); txt.style.flex = "1";
    txt.textContent = st === "denied"
      ? L("🔕 الإشعارات محظورة — لن تصلك الرسائل والمكالمات والتطبيق مغلق", "🔕 Notifications are blocked — you won't get messages or calls while the app is closed")
      : L("🔔 فعّل الإشعارات لتصلك الرسائل والمكالمات والتطبيق مغلق", "🔔 Turn on notifications to get messages and calls when the app is closed");
    var yes = btn(st === "denied" ? L("كيف أفتحها؟", "How?") : L("تفعيل", "Turn on"), true);
    var no = btn(L("لاحقاً", "Later"));
    yes.onclick = function () { hideBanner(); if (st === "denied") { lsSet("sawa_push_asked", Date.now()); helpSheet(); } else enablePush(); };
    no.onclick = function () { lsSet("sawa_push_asked", Date.now()); hideBanner(); };
    bannerEl.appendChild(txt); bannerEl.appendChild(yes); bannerEl.appendChild(no); document.body.appendChild(bannerEl);
  }
  function helpSheet() {
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center";
    var box = document.createElement("div"); box.dir = isAr() ? "rtl" : "ltr";
    box.style.cssText = "background:#fff;color:#1f2937;border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;font:500 14px/1.8 system-ui";
    var h = document.createElement("div"); h.style.cssText = "font:800 16px system-ui;margin-bottom:6px"; h.textContent = L("🔔 تفعيل الإشعارات", "🔔 Turn on notifications");
    var p = document.createElement("div"); p.textContent = deniedHelp();
    var ok = btn(L("حسناً", "OK"), true); ok.style.marginTop = "12px"; ok.style.width = "100%";
    ok.onclick = function () { try { ov.remove(); } catch (e) {} };
    ov.onclick = function (e) { if (e.target === ov) ok.onclick(); };
    box.appendChild(h); box.appendChild(p); box.appendChild(ok); ov.appendChild(box); document.body.appendChild(ov);
  }
  // عند العودة للتطبيق: ربّما غيّر المستخدم الإذن من إعدادات الهاتف
  try {
    var lastPushSt = null;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible" || !state.uid) return;
      var st = pushState(); if (st === lastPushSt) return; lastPushSt = st;
      if (st === "granted") { hideBanner(); refreshPush(); } else emitPush();
    });
  } catch (e) {}

  // ==================================================================
  // C9: تحديثات التطبيق — sw.js «المخزون أوّلاً»؛ نسخةٌ جديدة ⇒ تُحمَّل في الخلفيّة ثمّ:
  //   خلال ثوانٍ من الفتح ⇒ إعادة تحميلٍ تلقائيّة · غير ذلك ⇒ شريط «تحديث جديد» (لا نقطع مكالمةً أو كتابة)
  // ==================================================================
  (function swUpdates() {
    try { if (!global.navigator || !navigator.serviceWorker) return; } catch (e) { return; }
    var t0 = Date.now(), had = !!navigator.serviceWorker.controller, reloading = false, upEl = null, lastCheck = Date.now();
    function inCall() { var R = global.SawaRTC; try { return !!(R && ((R.active && R.active()) || (R.group && R.group()) || (R.room && R.room()))); } catch (e) { return false; } }
    function reload() { if (reloading) return; reloading = true; try { global.location.reload(); } catch (e) {} }
    function bar() {
      if (upEl || !document.body) return;
      upEl = bannerShell(); upEl.style.bottom = ""; upEl.style.top = "calc(10px + env(safe-area-inset-top,0px))"; upEl.style.background = "#2F80C8";
      var txt = document.createElement("div"); txt.style.flex = "1"; txt.textContent = L("✨ نسخةٌ جديدة من سوا جاهزة", "✨ A new version of Sawa is ready");
      var yes = btn(L("تحديث", "Update"), true); yes.style.background = "#fff"; yes.style.color = "#2F80C8";
      var no = btn(L("لاحقاً", "Later")); no.style.color = "#e3f0fb";
      yes.onclick = function () { if (inCall() && !global.confirm(L("ستنتهي المكالمة الحاليّة. تحديث الآن؟", "This will end the current call. Update now?"))) return; reload(); };
      no.onclick = function () { try { upEl.remove(); } catch (e) {} upEl = null; };
      upEl.appendChild(txt); upEl.appendChild(yes); upEl.appendChild(no); document.body.appendChild(upEl);
    }
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!had) { had = true; return; }            // أوّل تثبيتٍ لعامل الخدمة: لا شيء تغيّر في الصفحة
      if (Date.now() - t0 < 10000 && !inCall()) return reload();
      bar();
    });
    // التطبيق المثبّت قد يبقى مفتوحاً أيّاماً في الخلفيّة دون «فتحٍ» جديد ⇒ نفحص sw.js عند العودة (مرّةً كلّ 30 دقيقة)
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < 30 * 60000) return;
      lastCheck = Date.now();
      navigator.serviceWorker.getRegistration().then(function (r) { if (r) return r.update(); }).catch(function () {});
    });
  })();

  // عامل الخدمة → التطبيق: إشعارٌ والتطبيق أمامك (تنبيهٌ داخليّ) · ضغطٌ على إشعار (افتح المحادثة)
  function openFromPush(cid) { if (cid && isCloud(cid)) whenApp(function () { try { if (app.openChatById) app.openChatById(cid); } catch (e) {} }); }
  try {
    if (global.navigator && navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", function (ev) {
      var m = ev.data || {};
      if (m.type === "sawa-push" && m.data) {
        if (m.data.t !== "call" && m.data.cid !== openCid) toast((m.data.title ? m.data.title + ": " : "") + (m.data.body || ""));
        if (m.data.t === "req") loadRequests();
        if (m.data.t === "reqok") { refresh(); loadRequests(); }
      }
      if (m.type === "sawa-open" && m.data) { if (m.data.t === "req") whenReady(function () { requestsSheet(); }); else openFromPush(m.data.cid); }
    });
  } catch (e) {}
  function handleChatParam() {
    var cid = null;
    try { cid = new URLSearchParams(global.location.search).get("chat"); } catch (e) {}
    if (!cid) return;
    try { var u = new URL(global.location.href); u.searchParams.delete("chat"); global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (e) {}
    whenReady(function () { setTimeout(function () { openFromPush(cid); }, 600); });
  }
  // عدد غير المقروء على أيقونة التطبيق (حيث يدعمه الجهاز)
  var badgeN = -1;
  function appBadge() {
    var n = 0; Object.keys(chats).forEach(function (k) { n += unreadOf(chats[k]); });
    if (n === badgeN) return; badgeN = n;
    try { if (navigator.setAppBadge) { n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (e) {}
  }

  // ==================================================================
  // C10: رمز سوا (١٠ أرقام) + طلبات التواصل + الدخول بالبريد + شاشات البداية للمستخدم الجديد
  //   الرمز: ٩ أرقام عشوائيّة (أوّلها ١–٩) + رقم تحقّق (Luhn) يكشف خطأ رقمٍ واحد أو تبديل رقمين.
  //   من يُدخل الرمز يرى الاسم فقط ويرسل «طلب تواصل» — لا مراسلة ولا اتّصال قبل القبول.
  // ==================================================================
  function codeDigits(x) {
    return String(x == null ? "" : x).replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }).replace(/\D/g, "");
  }
  function luhnDigit(s) {
    var sum = 0;
    for (var i = 0; i < s.length; i++) { var d = Number(s[s.length - 1 - i]); if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    return String((10 - (sum % 10)) % 10);
  }
  function codeValid(c) { return /^[1-9]\d{9}$/.test(c) && luhnDigit(c.slice(0, 9)) === c[9]; }
  function fmtCode(c) { c = codeDigits(c); return c.length > 6 ? c.slice(0, 3) + " " + c.slice(3, 6) + " " + c.slice(6) : c.length > 3 ? c.slice(0, 3) + " " + c.slice(3) : c; }
  function myCode() { return (state.me && state.me.code) || null; }
  function codeUrl(c) { return global.location.origin + global.location.pathname.replace(/index\.html$/, "") + "?code=" + codeDigits(c); }
  function codeShareText(c) {
    return L("تواصل معي على سوا — رمزي: ", "Reach me on Sawa — my code: ") + fmtCode(c) + "\n" + codeUrl(c);
  }
  function loadCode() {
    if (myCode()) return Promise.resolve({ code: myCode(), findable: state.me.findable !== false });
    return call("code.mine", {}).then(function (b) {
      state.me = Object.assign({}, state.me || {}, { code: b.code, findable: b.findable });
      lsSet("sawa_people_cache", { uid: state.uid, me: state.me, people: state.people }); publish();
      return b;
    });
  }
  function codeErr(e) {
    var m = (e && e.message) || String(e);
    if (/bad_code/.test(m)) return L("الرمز غير صحيح — تأكّد من الأرقام العشرة", "That code isn't valid — check the 10 digits");
    if (/rate_limited/.test(m)) return L("محاولاتٌ كثيرة — انتظر قليلاً ثمّ أعد المحاولة", "Too many tries — wait a little");
    if (/too_many_pending/.test(m)) return L("لديك ٢٠ طلباً بانتظار الموافقة — ألغِ بعضها أوّلاً", "You have 20 pending requests — cancel some first");
    if (/not_found/.test(m)) return L("لا يوجد حسابٌ بهذا الرمز", "No account with this code");
    if (/^wait$/.test(m)) return L("غيّرتَ رمزك قبل قليل — انتظر ١٠ دقائق", "You changed your code a moment ago — wait 10 minutes");
    if (/fetch|network|timeout/i.test(m)) return L("تحقّق من الاتّصال بالإنترنت", "Check your internet connection");
    return m;
  }

  // ---------- أدوات واجهةٍ صغيرة (DOM) ----------
  function mk(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function mkBtn(text, kind) {
    var css = kind === "primary" ? "background:#2e7d5b;color:#fff;border:0"
      : kind === "danger" ? "background:#fdecec;color:#b42318;border:0"
      : kind === "ghost" ? "background:transparent;color:#2F80C8;border:0"
      : "background:#fff;color:#1A1A2E;border:1.5px solid #dfe5ec";
    return mk("button", css + ";border-radius:12px;padding:12px 14px;font:800 14px system-ui;width:100%;box-sizing:border-box;cursor:pointer", text);
  }
  function sheet(title) {
    var ov = mk("div", "position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui");
    ov.dir = isAr() ? "rtl" : "ltr";
    var box = mk("div", "background:#fff;color:#1A1A2E;border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;padding:16px 16px calc(env(safe-area-inset-bottom,0px) + 18px);box-sizing:border-box");
    box.appendChild(mk("div", "width:40px;height:4px;border-radius:2px;background:#dde3ea;margin:0 auto 12px"));
    if (title) box.appendChild(mk("div", "font:800 17px system-ui;text-align:center;margin-bottom:6px", title));
    ov.appendChild(box); document.body.appendChild(ov);
    var api = { ov: ov, box: box, close: function () { try { ov.remove(); } catch (e) {} } };
    ov.onclick = function (e) { if (e.target === ov) api.close(); };
    return api;
  }
  function note(text, color, bg) { return mk("div", "font:500 12.5px/1.7 system-ui;color:" + (color || "#5b6b7c") + ";" + (bg ? "background:" + bg + ";border-radius:10px;padding:8px 10px;" : "") + "margin:6px 0", text); }
  function avatar(name, size) {
    size = size || 52;
    return mk("div", "width:" + size + "px;height:" + size + "px;border-radius:50%;background:#e3effa;color:#2F80C8;display:flex;align-items:center;justify-content:center;font:800 " + Math.round(size * 0.42) + "px system-ui;flex-shrink:0", (name || "؟").trim().charAt(0) || "؟");
  }
  function copyText(t) {
    var done = function () { toast(L("نُسخ ✓", "Copied ✓")); };
    try { if (navigator.clipboard) return navigator.clipboard.writeText(t).then(done, function () { global.prompt(L("انسخ:", "Copy:"), t); }); } catch (e) {}
    global.prompt(L("انسخ:", "Copy:"), t);
  }
  function shareText(t) {
    try { if (navigator.share) return navigator.share({ title: "سوا", text: t }).catch(function () {}); } catch (e) {}
    copyText(t);
  }
  function codeBig(c) {
    var el = mk("div", "font:800 30px/1.3 ui-monospace,Menlo,monospace;letter-spacing:2px;text-align:center;direction:ltr;color:#1A1A2E;background:#f3f7fb;border-radius:16px;padding:14px 8px;margin:8px 0", c ? fmtCode(c) : "… … …");
    el.className = "sawa-code-big";
    return el;
  }

  // ---------- طلبات التواصل ----------
  var reqs = { incoming: [], outgoing: [], at: 0 };
  function publishReqs() {
    try { global.dispatchEvent(new CustomEvent("sawa-requests", { detail: reqs.incoming.length })); } catch (e) {}
  }
  function loadRequests() {
    if (!state.uid) return Promise.resolve(reqs);
    return call("code.requests", {}).then(function (b) {
      reqs = { incoming: b.incoming || [], outgoing: b.outgoing || [], at: Date.now() };
      publishReqs(); return reqs;
    }).catch(function (e) { log("requests:", (e && e.message) || e); return reqs; });
  }
  function respond(from, action) {
    return call("code.respond", { from: from, action: action }).then(function (b) {
      reqs.incoming = reqs.incoming.filter(function (r) { return r.uid !== from; }); publishReqs();
      if (action === "accept") {
        toast(L("أصبحتما جهتي اتّصال ✓", "You're now connected ✓"));
        refresh();
        if (b.cid) whenApp(function () { setTimeout(function () { try { if (app.openChatById) app.openChatById(b.cid); } catch (e) {} }, 900); });
      } else if (action === "block") { toast(L("حُظر ولن تصلك طلباته ✓", "Blocked ✓")); loadPrefs(); }
      else toast(L("رُفض الطلب", "Request declined"));
      return b;
    }).catch(function (e) { toast(codeErr(e)); return null; });
  }
  function timeAgo(ts) {
    if (!ts) return "";
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return L("الآن", "now");
    if (m < 60) return L("قبل " + m + " د", m + "m ago");
    var h = Math.round(m / 60); if (h < 24) return L("قبل " + h + " س", h + "h ago");
    return new Date(ts).toLocaleDateString(isAr() ? "ar" : "en");
  }
  function requestsSheet() {
    if (!state.uid) return false;
    var s = sheet(L("طلبات التواصل", "Contact requests"));
    var list = mk("div", "margin-top:6px"); s.box.appendChild(list);
    list.appendChild(note(L("جارٍ التحميل…", "Loading…")));
    function row(r, incoming) {
      var card = mk("div", "border:1px solid #e6ebf0;border-radius:14px;padding:12px;margin:8px 0");
      var top = mk("div", "display:flex;gap:10px;align-items:center");
      top.appendChild(avatar(r.name, 42));
      var info = mk("div", "flex:1;min-width:0");
      info.appendChild(mk("div", "font:800 15px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis", r.name || L("مستخدم سوا", "Sawa user")));
      info.appendChild(mk("div", "font:500 11px system-ui;color:#8796a5;direction:ltr;text-align:" + (isAr() ? "right" : "left"), (r.code ? fmtCode(r.code) + " · " : "") + timeAgo(r.ts)));
      top.appendChild(info); card.appendChild(top);
      if (incoming && r.text) card.appendChild(mk("div", "font:500 14px/1.7 system-ui;background:#f5f8fb;border-radius:10px;padding:8px 10px;margin-top:8px;white-space:pre-wrap;word-break:break-word", r.text));
      var acts = mk("div", "display:flex;gap:8px;margin-top:10px");
      function act(label, kind, fn) { var b = mkBtn(label, kind); b.style.padding = "9px 8px"; b.style.fontSize = "13px"; b.onclick = function () { b.disabled = true; b.textContent = "…"; fn(); }; acts.appendChild(b); }
      if (incoming) {
        act(L("قبول", "Accept"), "primary", function () { respond(r.uid, "accept").then(function () { s.close(); }); });
        act(L("رفض", "Decline"), "", function () { respond(r.uid, "reject").then(draw); });
        act(L("حظر", "Block"), "danger", function () { respond(r.uid, "block").then(draw); });
      } else {
        acts.appendChild(mk("div", "flex:2;align-self:center;font:600 12px system-ui;color:#8796a5", L("بانتظار موافقته…", "Waiting for them to accept…")));
        act(L("إلغاء الطلب", "Cancel"), "", function () {
          call("code.cancel", { to: r.uid }).then(function () { reqs.outgoing = reqs.outgoing.filter(function (x) { return x.uid !== r.uid; }); draw(); })
            .catch(function (e) { toast(codeErr(e)); draw(); });
        });
      }
      card.appendChild(acts);
      return card;
    }
    function draw() {
      list.innerHTML = "";
      if (!reqs.incoming.length && !reqs.outgoing.length) list.appendChild(note(L("لا طلبات الآن. شارك رمزك ليصلك من يعرفك.", "No requests. Share your code so people can reach you.")));
      if (reqs.incoming.length) { list.appendChild(mk("div", "font:800 13px system-ui;color:#5b6b7c;margin-top:8px", L("وصلتك", "Received") + " (" + reqs.incoming.length + ")")); reqs.incoming.forEach(function (r) { list.appendChild(row(r, true)); }); }
      if (reqs.outgoing.length) { list.appendChild(mk("div", "font:800 13px system-ui;color:#5b6b7c;margin-top:12px", L("أرسلتَها", "Sent") + " (" + reqs.outgoing.length + ")")); reqs.outgoing.forEach(function (r) { list.appendChild(row(r, false)); }); }
      var foot = mk("div", "display:flex;gap:8px;margin-top:12px");
      var b1 = mkBtn(L("🔢 أدخل رمز شخص", "🔢 Enter a code")); b1.onclick = function () { s.close(); findSheet(); };
      var b2 = mkBtn(L("رمزي", "My code")); b2.onclick = function () { s.close(); codeSheet(); };
      foot.appendChild(b1); foot.appendChild(b2); list.appendChild(foot);
      list.appendChild(note(L("الرفض لا يُبلَّغ للمرسل. والحظر يمنع طلباته ورسائله.", "Declining isn't shown to the sender. Blocking stops their requests and messages.")));
    }
    loadRequests().then(draw);
    return true;
  }

  // ---------- «أدخل رمز شخص» ----------
  function findSheet(prefill) {
    if (!state.uid) { toast(L("جارٍ الاتّصال بالخادم…", "Connecting…")); return false; }
    var s = sheet(L("أضف برمز سوا", "Add by Sawa code"));
    s.box.appendChild(note(L("اطلب من الشخص رمزه (في «حسابي» عنده) واكتبه هنا — ١٠ أرقام.", "Ask for their code (in their «Me» tab) and type it here — 10 digits.")));
    var inp = mk("input", "width:100%;box-sizing:border-box;border:1.5px solid #dfe5ec;color:#1A1A2E;background:#fff;border-radius:14px;padding:13px;font:800 24px ui-monospace,Menlo,monospace;letter-spacing:2px;text-align:center;direction:ltr;outline:none");
    inp.setAttribute("inputmode", "numeric"); inp.setAttribute("autocomplete", "off"); inp.placeholder = "000 000 0000";
    s.box.appendChild(inp);
    var hint = mk("div", "font:600 12px system-ui;min-height:18px;margin:6px 2px;text-align:center"); s.box.appendChild(hint);
    var go = mkBtn(L("بحث", "Search"), "primary"); s.box.appendChild(go);
    var res = mk("div", "margin-top:12px"); s.box.appendChild(res);
    function sync() {
      var d = codeDigits(inp.value).slice(0, 10), f = fmtCode(d);
      if (inp.value !== f) inp.value = f;
      var ok = d.length === 10 && codeValid(d);
      hint.style.color = d.length === 10 && !ok ? "#b42318" : "#8796a5";
      hint.textContent = d.length < 10 ? (d.length ? L("بقي " + (10 - d.length) + " أرقام", (10 - d.length) + " digits left") : "")
        : ok ? "✓" : L("الرمز غير صحيح — تأكّد من الأرقام", "Invalid code — check the digits");
      go.disabled = !ok; go.style.opacity = ok ? "1" : ".5";
      return ok ? d : null;
    }
    inp.oninput = function () { res.innerHTML = ""; sync(); };
    inp.onkeydown = function (e) { if (e.key === "Enter" && !go.disabled) go.onclick(); };
    function card(b) {
      res.innerHTML = "";
      var c = mk("div", "border:1px solid #e6ebf0;border-radius:16px;padding:14px;text-align:center");
      if (!b.found) { c.appendChild(note(L("لا يوجد حسابٌ بهذا الرمز. ربّما غيّر صاحبه رمزه أو أخفاه — اطلب منه رمزه الحاليّ.", "No account with this code. It may have been changed or hidden."), "#8a5a00")); res.appendChild(c); return; }
      var a = avatar(b.name, 64); a.style.margin = "0 auto 8px"; c.appendChild(a);
      c.appendChild(mk("div", "font:800 18px system-ui", b.name || L("مستخدم سوا", "Sawa user")));
      c.appendChild(mk("div", "font:600 12px system-ui;color:#8796a5;direction:ltr;margin:2px 0 10px", fmtCode(b.code)));
      if (b.self) { c.appendChild(note(L("هذا رمزك أنت 🙂", "That's your own code 🙂"))); res.appendChild(c); return; }
      if (b.contact) {
        c.appendChild(note(L("جهة اتّصالك ✓", "Already a contact ✓"), "#2e7d5b"));
        var m = mkBtn(L("مراسلة", "Message"), "primary");
        m.onclick = function () { openDm(b.uid).then(function (cid) { if (cid) whenApp(function () { try { app.openChatById(cid); } catch (e) {} }); s.close(); }); };
        c.appendChild(m); res.appendChild(c); return;
      }
      if (b.pending === "in") {
        c.appendChild(note(L("أرسل لك طلب تواصل.", "They sent you a request."), "#2F80C8"));
        var acc = mkBtn(L("قبول الطلب", "Accept"), "primary");
        acc.onclick = function () { acc.disabled = true; respond(b.uid, "accept").then(function () { s.close(); }); };
        c.appendChild(acc); res.appendChild(c); return;
      }
      if (b.pending === "out") {
        c.appendChild(note(L("أرسلتَ له طلباً — بانتظار موافقته.", "Request sent — waiting for them."), "#8796a5"));
        var cn = mkBtn(L("إلغاء الطلب", "Cancel request"));
        cn.onclick = function () { cn.disabled = true; call("code.cancel", { to: b.uid }).then(function () { toast(L("أُلغي الطلب", "Cancelled")); s.close(); }, function (e) { toast(codeErr(e)); cn.disabled = false; }); };
        c.appendChild(cn); res.appendChild(c); return;
      }
      var myN = (state.me && state.me.name) || "";
      var ta = mk("textarea", "width:100%;box-sizing:border-box;border:1px solid #dfe5ec;color:#1A1A2E;background:#fff;border-radius:12px;padding:10px;font:500 14px/1.6 system-ui;min-height:64px;resize:vertical;margin-top:4px");
      ta.maxLength = 300; ta.value = myN ? L("السلام عليكم، أنا " + myN + " 👋", "Hi, it's " + myN + " 👋") : L("السلام عليكم 👋", "Hi 👋");
      c.appendChild(mk("div", "font:700 12px system-ui;color:#5b6b7c;text-align:" + (isAr() ? "right" : "left") + ";margin-top:4px", L("رسالة تعريف (يقرؤها قبل أن يوافق)", "Intro message (they see it before accepting)")));
      c.appendChild(ta);
      var snd = mkBtn(L("إرسال طلب تواصل", "Send request"), "primary"); snd.style.marginTop = "10px"; c.appendChild(snd);
      c.appendChild(note(L("لن تستطيعا المراسلة أو الاتّصال حتّى يقبل طلبك.", "You can't message or call until they accept.")));
      snd.onclick = function () {
        snd.disabled = true; snd.textContent = "…";
        call("code.request", { code: b.code, text: ta.value }).then(function (r) {
          if (r.accepted) { toast(L("أصبحتما جهتي اتّصال ✓", "You're now connected ✓")); refresh(); loadRequests();
            if (r.cid) whenApp(function () { setTimeout(function () { try { app.openChatById(r.cid); } catch (e) {} }, 900); }); s.close(); return; }
          if (r.already) { card({ found: true, contact: true, uid: r.uid, name: b.name, code: b.code }); return; }
          toast(L("أُرسل الطلب ✓ — ستُبلَّغ حين يوافق", "Request sent ✓")); loadRequests(); s.close();
        }).catch(function (e) { snd.disabled = false; snd.textContent = L("إرسال طلب تواصل", "Send request"); toast(codeErr(e)); });
      };
      res.appendChild(c);
    }
    go.onclick = function () {
      var d = sync(); if (!d) return;
      go.disabled = true; go.textContent = "…";
      call("code.find", { code: d }).then(card, function (e) { res.innerHTML = ""; res.appendChild(note(codeErr(e), "#b42318")); })
        .then(function () { go.disabled = false; go.textContent = L("بحث", "Search"); });
    };
    if (prefill) { inp.value = prefill; if (sync()) go.onclick(); } else sync();
    setTimeout(function () { try { if (!prefill) inp.focus(); } catch (e) {} }, 60);
    return true;
  }

  // ---------- «رمزي في سوا» ----------
  function codeSheet() {
    if (!state.uid) { toast(L("جارٍ الاتّصال بالخادم…", "Connecting…")); return false; }
    var s = sheet(L("رمزك في سوا", "Your Sawa code"));
    var big = codeBig(myCode()); s.box.appendChild(big);
    s.box.appendChild(note(L("أعطه لمن تريد أن يتواصل معك. يرى اسمك فقط — لا بريدك ولا رقمك — ويرسل لك طلباً، ولا يراسلك قبل أن تقبل.",
      "Give it to people you want to hear from. They see your name only and send a request — no messages until you accept.")));
    var row = mk("div", "display:flex;gap:8px;margin:8px 0");
    var cp = mkBtn(L("نسخ", "Copy")), sh = mkBtn(L("مشاركة", "Share"), "primary");
    row.appendChild(cp); row.appendChild(sh); s.box.appendChild(row);
    var qrBtn = mkBtn(L("عرض رمز QR", "Show QR"), "ghost"); s.box.appendChild(qrBtn);
    var qr = mk("div", "display:none;justify-content:center;margin:8px 0"); var qrIn = mk("div", "background:#fff;padding:8px;border-radius:12px"); qr.appendChild(qrIn); s.box.appendChild(qr);
    var sep = mk("div", "height:1px;background:#eef1f4;margin:12px 0"); s.box.appendChild(sep);
    var tg = mk("label", "display:flex;align-items:center;gap:10px;font:700 14px system-ui;padding:6px 2px;cursor:pointer");
    var cb = mk("input"); cb.type = "checkbox"; cb.style.cssText = "width:20px;height:20px";
    tg.appendChild(cb); tg.appendChild(mk("span", "flex:1", L("يجدني الآخرون برمزي", "People can find me by my code"))); s.box.appendChild(tg);
    var reset = mkBtn(L("تغيير رمزي", "Change my code")); reset.style.marginTop = "8px"; s.box.appendChild(reset);
    s.box.appendChild(note(L("غيّره إن انتشر رمزك أكثر ممّا تريد — القديم يتوقّف فوراً، وجهات اتّصالك الحاليّة لا تتأثّر.", "Change it if it spread too far — the old one stops working; existing contacts stay.")));
    function fill(b) {
      big.textContent = fmtCode(b.code); cb.checked = b.findable !== false;
      cp.onclick = function () { copyText(fmtCode(b.code)); };
      sh.onclick = function () { shareText(codeShareText(b.code)); };
      qrBtn.onclick = function () {
        qr.style.display = "flex"; qrBtn.style.display = "none";
        loadQrLib().then(function (Q) { qrIn.innerHTML = ""; new Q(qrIn, { text: codeUrl(b.code), width: 200, height: 200, colorDark: "#1A1A2E", colorLight: "#FFFFFF", correctLevel: Q.CorrectLevel.M }); })
          .catch(function (e) { qrIn.textContent = (e && e.message) || String(e); });
      };
    }
    cb.onchange = function () {
      var v = cb.checked;
      call("code.privacy", { findable: v }).then(function () {
        state.me = Object.assign({}, state.me || {}, { findable: v }); lsSet("sawa_people_cache", { uid: state.uid, me: state.me, people: state.people });
        toast(v ? L("يمكن العثور عليك برمزك ✓", "Findable by code ✓") : L("لن يجدك أحدٌ برمزك", "Hidden from code search"));
      }).catch(function (e) { cb.checked = !v; toast(codeErr(e)); });
    };
    reset.onclick = function () {
      if (!global.confirm(L("تغيير رمزك؟ الرمز القديم يتوقّف فوراً.", "Change your code? The old one stops working."))) return;
      reset.disabled = true;
      call("code.reset", {}).then(function (b) {
        state.me = Object.assign({}, state.me || {}, { code: b.code, findable: b.findable }); lsSet("sawa_people_cache", { uid: state.uid, me: state.me, people: state.people });
        publish(); fill(b); qr.style.display = "none"; qrBtn.style.display = ""; toast(L("رمزك الجديد جاهز ✓", "New code ready ✓"));
      }).catch(function (e) { toast(codeErr(e)); }).then(function () { reset.disabled = false; });
    };
    loadCode().then(fill).catch(function (e) { big.textContent = "—"; toast(codeErr(e)); });
    return true;
  }

  // ---------- الدخول بالبريد الإلكتروني ----------
  function emailErr(e) {
    var c = (e && e.code) || "";
    var map = {
      "auth/email-already-in-use": L("هذا البريد مسجّلٌ سلفاً — اختر «لديّ حساب»", "This email is already registered — choose «I have an account»"),
      "auth/credential-already-in-use": L("هذا البريد مسجّلٌ سلفاً — اختر «لديّ حساب»", "This email is already registered"),
      "auth/invalid-email": L("البريد غير صحيح", "Invalid email"),
      "auth/missing-email": L("اكتب بريدك", "Enter your email"),
      "auth/weak-password": L("كلمة المرور قصيرة — ٦ أحرف على الأقلّ", "Password too short — at least 6 characters"),
      "auth/missing-password": L("اكتب كلمة المرور", "Enter a password"),
      "auth/wrong-password": L("البريد أو كلمة المرور غير صحيحة", "Wrong email or password"),
      "auth/invalid-credential": L("البريد أو كلمة المرور غير صحيحة", "Wrong email or password"),
      "auth/invalid-login-credentials": L("البريد أو كلمة المرور غير صحيحة", "Wrong email or password"),
      "auth/user-not-found": L("البريد أو كلمة المرور غير صحيحة", "Wrong email or password"),
      "auth/too-many-requests": L("محاولاتٌ كثيرة — انتظر قليلاً", "Too many attempts — wait a little"),
      "auth/network-request-failed": L("تحقّق من الاتّصال بالإنترنت", "Check your connection"),
      "auth/operation-not-allowed": L("الدخول بالبريد غير مفعّلٍ بعد في الخادم", "Email sign-in isn't enabled on the server yet"),
      "sawa/already-linked": L("حسابك مربوطٌ سلفاً", "Already linked"),
      "sawa/no-server": L("جارٍ الاتّصال بالخادم… حاول بعد لحظة", "Connecting… try again in a moment")
    };
    return map[c] || ((e && e.message) || String(e));
  }
  // يبني نموذج البريد داخل حاوية؛ onDone يُستدعى بعد النجاح
  function emailForm(host, onDone) {
    var mode = "create";
    var tabs = mk("div", "display:flex;background:#eef2f6;border-radius:12px;padding:3px;margin:6px 0 10px");
    function tab(m, t) { var b = mk("button", "flex:1;border:0;border-radius:10px;padding:9px;font:800 13px system-ui;cursor:pointer", t); b.onclick = function () { mode = m; paint(); }; tabs.appendChild(b); return b; }
    var tCreate = tab("create", L("حساب جديد", "New account")), tSign = tab("signin", L("لديّ حساب", "I have an account"));
    host.appendChild(tabs);
    function field(ph, type) { var i = mk("input", "width:100%;box-sizing:border-box;border:1.5px solid #dfe5ec;color:#1A1A2E;background:#fff;border-radius:12px;padding:12px;font:600 15px system-ui;direction:ltr;text-align:left;margin:4px 0;outline:none"); i.placeholder = ph; i.type = type; return i; }
    var em = field("name@example.com", "email"); em.autocomplete = "email"; host.appendChild(em);
    var pwWrap = mk("div", "position:relative");
    var pw = field(L("كلمة المرور", "Password"), "password"); pwWrap.appendChild(pw);
    var eye = mk("button", "position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;font-size:18px;cursor:pointer", "👁"); eye.type = "button";
    eye.onclick = function () { pw.type = pw.type === "password" ? "text" : "password"; };
    pwWrap.appendChild(eye); host.appendChild(pwWrap);
    var msg = mk("div", "font:600 12.5px/1.6 system-ui;min-height:18px;margin:4px 2px;color:#b42318"); host.appendChild(msg);
    var go = mkBtn("", "primary"); host.appendChild(go);
    var forgot = mkBtn(L("نسيتُ كلمة المرور", "Forgot password"), "ghost"); forgot.style.marginTop = "4px"; host.appendChild(forgot);
    function paint() {
      tCreate.style.background = mode === "create" ? "#fff" : "transparent"; tSign.style.background = mode === "signin" ? "#fff" : "transparent";
      tCreate.style.color = mode === "create" ? "#1A1A2E" : "#6b7a89"; tSign.style.color = mode === "signin" ? "#1A1A2E" : "#6b7a89";
      go.textContent = mode === "create" ? L("إنشاء الحساب", "Create account") : L("دخول", "Sign in");
      pw.autocomplete = mode === "create" ? "new-password" : "current-password";
      pw.placeholder = mode === "create" ? L("كلمة مرور (٦ أحرف على الأقلّ)", "Password (6+ characters)") : L("كلمة المرور", "Password");
      forgot.style.display = mode === "signin" ? "" : "none"; msg.textContent = "";
    }
    go.onclick = function () {
      var e = em.value.trim(), p = pw.value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { msg.textContent = L("البريد غير صحيح", "Invalid email"); return; }
      if (p.length < 6) { msg.textContent = L("كلمة المرور قصيرة — ٦ أحرف على الأقلّ", "Password too short — at least 6 characters"); return; }
      if (!S() || !S().linkEmail) { msg.textContent = emailErr({ code: "sawa/no-server" }); return; }
      go.disabled = true; go.textContent = "…"; msg.textContent = "";
      S().linkEmail(e, p, mode).then(function () { if (mode === "create") sendVerify(true); onDone && onDone(); }).catch(function (x) {
        msg.textContent = emailErr(x);
        if (x && (x.code === "auth/email-already-in-use" || x.code === "auth/credential-already-in-use")) { mode = "signin"; paint(); msg.textContent = emailErr(x); }
      }).then(function () { go.disabled = false; go.textContent = mode === "create" ? L("إنشاء الحساب", "Create account") : L("دخول", "Sign in"); });
    };
    forgot.onclick = function () {
      var e = em.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { msg.textContent = L("اكتب بريدك أوّلاً", "Enter your email first"); return; }
      S().resetPassword(e).then(function () { msg.style.color = "#2e7d5b"; msg.textContent = L("أرسلنا إلى بريدك رابطاً لتعيين كلمة مرورٍ جديدة (تفقّد مجلّد الرسائل غير المرغوبة).", "We emailed you a reset link (check spam)."); },
        function (x) { msg.style.color = "#b42318"; msg.textContent = emailErr(x); });
    };
    paint();
    return { focus: function () { try { em.focus(); } catch (e) {} } };
  }
  function emailSheet() {
    var a = S() && S().authInfo ? S().authInfo() : null;
    if (a && !a.anon) { toast(L("حسابك مربوطٌ سلفاً", "Already linked") + (a.email ? " — " + a.email : "")); return false; }
    var s = sheet(L("الدخول بالبريد الإلكتروني", "Continue with email"));
    s.box.appendChild(note(L("حسابٌ بالبريد يحفظ محادثاتك وجهات اتّصالك، وتدخل به من أيّ جهاز.", "An email account keeps your chats and contacts on any device.")));
    var f = emailForm(s.box, function () { s.close(); refresh(); });
    setTimeout(f.focus, 80);
    return true;
  }

  // ---------- الإبلاغ عن محادثةٍ أو شخص (سياسة Google Play للمحتوى) ----------
  //  opts: { cid, target, name, kind: "dm"|"group", onBlock(), onDone() }
  function reportSheet(opts) {
    opts = opts || {};
    if (!state.uid) { toast(L("جارٍ الاتّصال بالخادم…", "Connecting…")); return false; }
    var s = sheet(opts.kind === "group" ? L("الإبلاغ عن المجموعة", "Report group") : L("الإبلاغ عن ", "Report ") + (opts.name || L("هذه المحادثة", "this chat")));
    var reasons = [["spam", L("رسائل مزعجة أو إعلانات", "Spam")], ["harassment", L("مضايقة أو تهديد", "Harassment or threats")], ["hate", L("كراهية أو إساءة", "Hate or abuse")],
      ["scam", L("احتيال أو طلب مال", "Scam or fraud")], ["sexual", L("محتوى جنسيّ أو غير لائق", "Sexual or inappropriate content")], ["violence", L("عنف", "Violence")],
      ["impersonation", L("انتحال شخصيّة", "Impersonation")], ["other", L("سببٌ آخر", "Something else")]];
    var pick = null, list = mk("div", "margin:6px 0");
    reasons.forEach(function (r) {
      var row = mk("label", "display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #eef1f4;font:600 14px system-ui;cursor:pointer");
      var rb = mk("input"); rb.type = "radio"; rb.name = "sawa-rep"; rb.style.cssText = "width:18px;height:18px";
      rb.onchange = function () { pick = r[0]; go.disabled = false; go.style.opacity = "1"; };
      row.appendChild(rb); row.appendChild(mk("span", "", r[1])); list.appendChild(row);
    });
    s.box.appendChild(list);
    var ta = mk("textarea", "width:100%;box-sizing:border-box;border:1px solid #dfe5ec;color:#1A1A2E;background:#fff;border-radius:12px;padding:10px;font:500 14px/1.6 system-ui;min-height:60px;margin-top:6px");
    ta.maxLength = 500; ta.placeholder = L("تفاصيل إضافيّة (اختياريّ)", "More details (optional)"); s.box.appendChild(ta);
    var blk = null;
    if (opts.onBlock && opts.kind !== "group") {
      var bl = mk("label", "display:flex;align-items:center;gap:10px;font:700 14px system-ui;margin-top:10px;cursor:pointer");
      blk = mk("input"); blk.type = "checkbox"; blk.checked = true; blk.style.cssText = "width:18px;height:18px";
      bl.appendChild(blk); bl.appendChild(mk("span", "", L("احظره أيضاً", "Also block"))); s.box.appendChild(bl);
    }
    s.box.appendChild(note(L("يصل البلاغ إلى فريق سوا مع آخر ٢٠ رسالة من هذه المحادثة لمراجعتها. لا يُبلَّغ الطرف الآخر.", "Your report and the last 20 messages of this chat are sent to the Sawa team for review. The other person isn't notified.")));
    var go = mkBtn(L("إرسال البلاغ", "Send report"), "danger"); go.disabled = true; go.style.opacity = ".5"; go.style.marginTop = "8px";
    s.box.appendChild(go);
    go.onclick = function () {
      if (!pick) return;
      go.disabled = true; go.textContent = "…";
      call("report.create", { cid: opts.cid || null, target: opts.target || null, reason: pick, note: ta.value }).then(function () {
        if (blk && blk.checked && opts.onBlock) { try { opts.onBlock(); } catch (e) {} }
        toast(L("وصلنا بلاغك ✓ — سنراجعه، وشكراً لك", "Report received ✓ — thank you"));
        try { if (opts.onDone) opts.onDone(); } catch (e) {}
        s.close();
      }).catch(function (e) { go.disabled = false; go.textContent = L("إرسال البلاغ", "Send report"); toast(L("تعذّر الإرسال: ", "Couldn't send: ") + codeErr(e)); });
    };
    return true;
  }

  // ---------- حذف الحساب (شرط Google Play) ----------
  function wipeLocal() {
    var done = function () {
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      try { if (global.indexedDB) indexedDB.deleteDatabase("firebaseLocalStorageDb"); } catch (e) {}
      try { if (global.indexedDB) indexedDB.deleteDatabase("sawa-media"); } catch (e) {}   // C14: الصور والصوتيّات المنزّلة أيضاً (كما تعد نافذة الحذف)
      setTimeout(function () { try { global.location.replace(global.location.pathname); } catch (e) {} }, 700);
    };
    try { firebase.auth().signOut().then(done, done); } catch (e) { done(); }
  }
  // C20: تسجيل الخروج حقّاً — كان «تسجيل الخروج» يقفل الشاشة برمزٍ لم يُضبط أصلاً ويبقى الحساب مفتوحاً
  function signOutSheet() {
    var a = authNow() || {}, me = state.me || {};
    var s = sheet(L("تسجيل الخروج", "Sign out"));
    s.box.appendChild(note((me.name || L("حسابك", "Your account")) + (a.email ? " · " + a.email : "") + (myCode() ? " · " + fmtCode(myCode()) : ""), "#1A1A2E", "#f3f7fb"));
    if (a.anon || !a.uid) {
      s.box.appendChild(note(L("حسابك «ضيف» غير مربوط بـGoogle أو بالبريد — إن خرجت فلن تستطيع العودة إليه أبداً، وتضيع محادثاتك ورمزك.",
        "Your guest account isn't linked to Google or email — signing out loses it forever."), "#b42318", "#fdecec"));
      var lk = mkBtn(L("اربط حسابك أوّلاً", "Link your account first"), "primary");
      lk.onclick = function () { s.close(); emailSheet(); };
      s.box.appendChild(lk);
      var c0 = mkBtn(L("إلغاء", "Cancel")); c0.style.marginTop = "8px"; c0.onclick = function () { s.close(); }; s.box.appendChild(c0);
      return true;
    }
    s.box.appendChild(note(L("تخرج من هذا الجهاز فقط: تتوقّف إشعاراته، وتُمسح منه المحادثات المخزّنة والإعدادات. حسابك ورسائلك باقية، وتعود إليها بالدخول من جديد.",
      "Signs out this device only: notifications stop and local data is cleared. Your account and messages stay."), "#5b6b7c", "#f5f8fb"));
    s.box.appendChild(note(L("شجرة العائلة المحفوظة على هذا الجهاز وحده تُمسح أيضاً — إن لم ترفعها إلى السحابة فصدّرها أوّلاً من «حسابي».",
      "A family tree kept only on this device is cleared too — export or upload it first."), "#9a6700", "#fdf3d8"));
    var ok = mkBtn(L("تسجيل الخروج", "Sign out"), "danger"); ok.style.marginTop = "6px";
    ok.onclick = function () {
      ok.disabled = true; ok.textContent = "…";
      var stop = function () { try { stopMyPresence(); } catch (e) {} wipeLocal(); };
      Promise.race([disablePush().catch(function () {}), new Promise(function (r) { setTimeout(r, 4000); })]).then(stop, stop);
    };
    var no = mkBtn(L("إلغاء", "Cancel")); no.style.marginTop = "8px"; no.onclick = function () { s.close(); };
    s.box.appendChild(ok); s.box.appendChild(no);
    return true;
  }
  function deleteAccountSheet() {
    if (!state.uid) { toast(L("جارٍ الاتّصال بالخادم…", "Connecting…")); return false; }
    var s = sheet(L("حذف الحساب نهائيّاً", "Delete account permanently"));
    var a = authNow(), me = state.me || {};
    s.box.appendChild(note((me.name || L("حسابك", "Your account")) + (a && a.email ? " · " + a.email : "") + (myCode() ? " · " + fmtCode(myCode()) : ""), "#1A1A2E", "#f3f7fb"));
    var ul = mk("ul", "font:500 13.5px/1.9 system-ui;color:#3b4652;padding-inline-start:20px;margin:8px 0");
    [L("يُحذف: اسمك ورقمك ورمزك في سوا، وجهات اتّصالك وطلبات التواصل، ورسائلك المحفوظة، وإعداداتك، وأجهزتك المسجّلة للإشعارات.", "Deleted: your name, number and code, contacts and requests, saved messages, settings and notification devices."),
     L("تخرج من كلّ المحادثات والمجموعات. رسائلك عند الآخرين تبقى عندهم باسم «حساب محذوف».", "You leave all chats and groups. Messages others received stay with them under «Deleted account»."),
     L("العائلات التي تملكها: تنتقل ملكيّتها لأقدم محرّرٍ فيها، وتُحذف كاملةً إن كنت وحدك فيها (خلال دقائق).", "Families you own pass to their senior editor, or are fully deleted if you're the only member (within minutes)."),
     L("تُمسح بيانات سوا من هذا الجهاز أيضاً. لا يمكن التراجع.", "Sawa data on this device is wiped too. This can't be undone.")
    ].forEach(function (t) { ul.appendChild(mk("li", "", t)); });
    s.box.appendChild(ul);
    s.box.appendChild(mk("div", "font:700 13px system-ui;color:#5b6b7c;margin:6px 2px", L("للتأكيد اكتب: حذف", "To confirm, type: DELETE")));
    var inp = mk("input", "width:100%;box-sizing:border-box;border:1.5px solid #dfe5ec;color:#1A1A2E;background:#fff;border-radius:12px;padding:12px;font:700 16px system-ui;text-align:center;outline:none");
    inp.autocomplete = "off"; s.box.appendChild(inp);
    var go = mkBtn(L("حذف حسابي نهائيّاً", "Delete my account"), "danger"); go.style.marginTop = "10px"; go.disabled = true; go.style.opacity = ".5";
    var cancel = mkBtn(L("إلغاء", "Cancel")); cancel.style.marginTop = "8px";
    s.box.appendChild(go); s.box.appendChild(cancel);
    var ok = function () { var v = inp.value.trim(); return v === "حذف" || v.toUpperCase() === "DELETE"; };
    inp.oninput = function () { go.disabled = !ok(); go.style.opacity = ok() ? "1" : ".5"; };
    cancel.onclick = s.close;
    go.onclick = function () {
      if (!ok()) return;
      go.disabled = true; cancel.disabled = true; go.textContent = L("جارٍ الحذف…", "Deleting…");
      call("account.delete", { confirm: "DELETE" }).then(function () {
        s.box.innerHTML = "";
        s.box.appendChild(mk("div", "font:800 17px system-ui;text-align:center;margin:18px 0 6px", L("حُذف حسابك ✓", "Your account was deleted ✓")));
        s.box.appendChild(note(L("شكراً لاستعمالك سوا. يُعاد تشغيل التطبيق الآن.", "Thanks for using Sawa. Restarting…")));
        wipeLocal();
      }).catch(function (e) {
        go.disabled = false; cancel.disabled = false; go.textContent = L("حذف حسابي نهائيّاً", "Delete my account");
        toast(L("تعذّر الحذف: ", "Couldn't delete: ") + codeErr(e));
      });
    };
    return true;
  }

  // ---------- شاشات البداية (المستخدم الجديد) ----------
  //  ترحيب ← الدخول (Google · البريد · بدون حساب) ← الاسم ← رمزك ← الإشعارات ← تواصل مع أحد ← المحادثات
  var onb = null, pendingCode = null, pendingDelete = false, onbDeleteMode = false;
  var ONB_STEPS = ["login", "name", "code", "notify", "find"];
  function onbActive() { return !!onb; }
  function onbNeeded() {
    if (lsGet("sawa_onboarded", 0)) return false;
    if (lsGet("sawa_onb_step", null)) return true;   // بدأها ولم يكملها (أو عاد من صفحة Google)
    if (lsGet("sawa_people_cache", null)) { lsSet("sawa_onboarded", Date.now()); return false; }   // جهازٌ مستعمَلٌ قبل هذه النسخة
    try { var q = new URLSearchParams(global.location.search); if (q.get("room") || q.get("call") || q.get("join")) return false; } catch (e) {}
    return true;
  }
  function authNow() { try { return S() && S().authInfo ? S().authInfo() : null; } catch (e) { return null; } }
  function onbStart() {
    if (onb || !document.body) return;
    var el = mk("div", "position:fixed;inset:0;z-index:2147483000;background:linear-gradient(170deg,#2F80C8 0%,#1d5f9e 55%,#174a7c 100%);color:#fff;display:flex;flex-direction:column;font-family:system-ui;overflow-y:auto");
    el.id = "sawa-onb"; el.dir = isAr() ? "rtl" : "ltr";
    document.body.appendChild(el);
    onb = { el: el, step: null, timer: null };
    onbGo(lsGet("sawa_onb_step", "welcome"));
  }
  function onbFrame(step) {
    var el = onb.el; el.innerHTML = "";
    if (onb.timer) { clearInterval(onb.timer); onb.timer = null; }
    var i = ONB_STEPS.indexOf(step);
    var top = mk("div", "display:flex;justify-content:center;gap:6px;padding:calc(env(safe-area-inset-top,0px) + 18px) 0 4px;min-height:10px");
    if (i >= 0) ONB_STEPS.forEach(function (_, k) { top.appendChild(mk("div", "height:6px;border-radius:3px;background:" + (k <= i ? "#fff" : "rgba(255,255,255,.3)") + ";width:" + (k === i ? "22px" : "6px"))); });
    el.appendChild(top);
    var body = mk("div", "flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:12px 24px;max-width:460px;width:100%;box-sizing:border-box;margin:0 auto");
    var foot = mk("div", "padding:12px 20px calc(env(safe-area-inset-bottom,0px) + 22px);max-width:460px;width:100%;box-sizing:border-box;margin:0 auto;display:flex;flex-direction:column;gap:10px");
    el.appendChild(body); el.appendChild(foot);
    return { body: body, foot: foot };
  }
  function bigBtn(text, kind) {
    var css = kind === "white" ? "background:#fff;color:#1d5f9e;border:0" : kind === "link" ? "background:transparent;color:rgba(255,255,255,.85);border:0;font-weight:700" : "background:rgba(255,255,255,.14);color:#fff;border:1.5px solid rgba(255,255,255,.35)";
    return mk("button", css + ";border-radius:14px;padding:14px;font:800 15px system-ui;width:100%;cursor:pointer", text);
  }
  function hTitle(t) { return mk("div", "font:800 24px/1.4 system-ui;margin:10px 0 6px", t); }
  function hSub(t) { return mk("div", "font:500 15px/1.8 system-ui;color:rgba(255,255,255,.85)", t); }
  function onbGo(step) {
    if (!onb) return;
    onb.step = step; lsSet("sawa_onb_step", step);
    var f = onbFrame(step), b = f.body, ft = f.foot;
    if (step === "welcome") {
      var logo = mk("img", "width:96px;height:96px;border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,.25)"); logo.src = "./icons/icon-192.png"; logo.alt = "سوا";
      b.appendChild(logo);
      b.appendChild(hTitle(L("أهلاً بك في سوا", "Welcome to Sawa")));
      b.appendChild(hSub(L("محادثات ومكالمات، غرف اجتماعات، وصلة رحم — في تطبيقٍ واحد.", "Chats and calls, meeting rooms, and family ties — in one app.")));
      var st = bigBtn(L("ابدأ", "Get started"), "white"); st.onclick = function () { onbGo("login"); }; ft.appendChild(st);
      return;
    }
    if (step === "login") {
      var a = authNow();
      if (a && !a.anon) return onbDeleteMode ? onbDone() : onbGo("name");
      b.appendChild(mk("div", "font-size:54px", "🔐"));
      b.appendChild(hTitle(L("أنشئ حسابك", "Create your account")));
      b.appendChild(hSub(L("حسابك يحفظ محادثاتك وجهات اتّصالك، وتدخل به من أيّ جهاز.", "Your account keeps your chats and contacts, on any device.")));
      var g = bigBtn(L("المتابعة بحساب Google", "Continue with Google"), "white");
      g.insertBefore(mk("span", "font:900 16px system-ui;color:#4285F4;margin-inline-end:8px", "G"), g.firstChild);
      var em = bigBtn(L("✉️  المتابعة بالبريد الإلكتروني", "✉️  Continue with email"));
      var gu = bigBtn(L("جرّب بدون حساب", "Try without an account"), "link");
      ft.appendChild(g); ft.appendChild(em);
      if (onbDeleteMode) { b.appendChild(mk("div", "font:700 14px/1.8 system-ui;color:#ffe08a;margin-top:12px", L("لحذف حسابك: ادخل بالحساب نفسه الذي تريد حذفه.", "To delete your account, sign in with that account."))); }
      else ft.appendChild(gu);
      var legal = mk("div", "font:500 12px/1.8 system-ui;color:rgba(255,255,255,.75);text-align:center;margin-top:2px");
      legal.appendChild(document.createTextNode(L("بالمتابعة توافق على ", "By continuing you agree to the ")));
      var lt = mk("a", "color:#fff;font-weight:700", L("شروط الاستخدام", "Terms")); lt.href = "/terms"; lt.target = "_blank"; lt.rel = "noopener";
      var lp = mk("a", "color:#fff;font-weight:700", L("سياسة الخصوصيّة", "Privacy Policy")); lp.href = "/privacy"; lp.target = "_blank"; lp.rel = "noopener";
      legal.appendChild(lt); legal.appendChild(document.createTextNode(L(" و", " and "))); legal.appendChild(lp);
      ft.appendChild(legal);
      g.onclick = function () {
        if (!state.uid || !S() || !S().linkGoogle) { toast(L("جارٍ الاتّصال بالخادم… حاول بعد لحظة", "Connecting… try again in a moment")); return; }
        try { Promise.resolve(S().linkGoogle()).catch(function () {}); } catch (e) {}
      };
      em.onclick = function () { onbGo("email"); };
      gu.onclick = function () {
        var s = sheet(L("المتابعة بدون حساب؟", "Continue without an account?"));
        s.box.appendChild(note(L("حسابك سيكون محفوظاً في هذا الهاتف فقط: إن مسحتَ بيانات التطبيق أو غيّرت هاتفك تضيع محادثاتك وجهات اتّصالك. يمكنك ربطه بحسابٍ لاحقاً من «حسابي» ← «السحابة والمشاركة».",
          "Your account will live on this phone only: clearing app data or changing phones loses your chats and contacts. You can link an account later from «Me» → «Cloud & sharing»."), "#8a5a00", "#fff7e0"));
        var y = mkBtn(L("متابعة بدون حساب", "Continue without account")); var n = mkBtn(L("رجوع", "Back"), "primary");
        y.style.marginTop = "8px"; n.style.marginTop = "8px";
        y.onclick = function () { s.close(); onbGo("name"); }; n.onclick = s.close;
        s.box.appendChild(n); s.box.appendChild(y);
      };
      // ربط Google (نافذةً منبثقة أو إعادة توجيه): نلاحظ تغيّر الهويّة ونتقدّم
      onb.timer = setInterval(function () { var x = authNow(); if (x && !x.anon && onb && onb.step === "login") { if (onbDeleteMode) onbDone(); else onbGo("name"); } }, 700);
      return;
    }
    if (step === "email") {
      var card = mk("div", "background:#fff;color:#1A1A2E;border-radius:20px;padding:16px;width:100%;box-sizing:border-box;text-align:start");
      card.dir = isAr() ? "rtl" : "ltr";
      card.appendChild(mk("div", "font:800 18px system-ui;text-align:center;margin-bottom:4px", L("البريد الإلكتروني", "Email")));
      b.appendChild(card);
      var form = emailForm(card, function () { if (onbDeleteMode) onbDone(); else onbGo("name"); });
      var back = bigBtn(L("رجوع", "Back"), "link"); back.onclick = function () { onbGo("login"); }; ft.appendChild(back);
      setTimeout(form.focus, 80);
      return;
    }
    if (step === "name") {
      b.appendChild(mk("div", "font-size:54px", "👤"));
      b.appendChild(hTitle(L("ما اسمك؟", "What's your name?")));
      b.appendChild(hSub(L("يظهر لمن تتواصل معهم.", "Shown to the people you talk to.")));
      var inp = mk("input", "width:100%;box-sizing:border-box;margin-top:18px;border:0;border-radius:14px;padding:14px;font:700 18px system-ui;text-align:center;outline:none;color:#1A1A2E;background:#fff;caret-color:#2F80C8");
      inp.placeholder = L("مثال: خالد علي", "e.g. Khalid Ali"); inp.maxLength = 40; inp.autocomplete = "name";
      var err = mk("div", "font:700 13px system-ui;color:#ffd7d7;min-height:20px;margin-top:8px");
      b.appendChild(inp); b.appendChild(err);
      var fillName = function () { if (inp.value) return; var a2 = authNow(); inp.value = (state.me && state.me.name) || (state.me && state.me.googleName) || (a2 && a2.name) || ""; };
      fillName(); whenReady(function () { refresh().then(fillName); });
      var nx = bigBtn(L("التالي", "Next"), "white"); ft.appendChild(nx);
      nx.onclick = function () {
        var nm = inp.value.replace(/\s+/g, " ").trim();
        if (nm.length < 2) { err.textContent = L("اكتب اسماً من حرفين على الأقلّ", "At least 2 letters"); return; }
        nx.disabled = true; nx.textContent = "…";
        whenReady(function () {
          var p = nm === ((state.me && state.me.name) || "") ? Promise.resolve() : saveProfile({ name: nm });
          p.then(function () { lsSet("sawa_name_asked", Date.now()); onbGo("code"); })
            .catch(function (e) { err.textContent = codeErr(e); nx.disabled = false; nx.textContent = L("التالي", "Next"); });
        });
      };
      inp.onkeydown = function (e) { if (e.key === "Enter") nx.onclick(); };
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80);
      return;
    }
    if (step === "code") {
      b.appendChild(mk("div", "font-size:54px", "🔢"));
      b.appendChild(hTitle(L("هذا رمزك في سوا", "This is your Sawa code")));
      var big = mk("div", "font:800 32px/1.3 ui-monospace,Menlo,monospace;letter-spacing:2px;direction:ltr;background:#fff;color:#1d5f9e;border-radius:18px;padding:16px 10px;margin:12px 0;width:100%;box-sizing:border-box", "… … …");
      b.appendChild(big);
      b.appendChild(hSub(L("أعطه لمن تريد أن يتواصل معك. يرى اسمك فقط، ويرسل لك طلباً لا يُقبَل إلا بموافقتك.", "Give it to people you want to hear from. They see your name only and send a request you approve.")));
      var row = mk("div", "display:flex;gap:10px;width:100%;margin-top:14px");
      var cp = bigBtn(L("نسخ", "Copy")), sh = bigBtn(L("مشاركة", "Share"));
      row.appendChild(cp); row.appendChild(sh); b.appendChild(row);
      var nx2 = bigBtn(L("التالي", "Next"), "white"); ft.appendChild(nx2);
      nx2.onclick = function () { onbGo("notify"); };
      whenReady(function () {
        loadCode().then(function (r) {
          big.textContent = fmtCode(r.code);
          cp.onclick = function () { copyText(fmtCode(r.code)); };
          sh.onclick = function () { shareText(codeShareText(r.code)); };
        }).catch(function (e) { big.textContent = "—"; toast(codeErr(e)); });
      });
      return;
    }
    if (step === "notify") {
      if (pushState() !== "default") return onbGo("find");
      b.appendChild(mk("div", "font-size:54px", "🔔"));
      b.appendChild(hTitle(L("لا تفوّتك رسالةٌ أو مكالمة", "Don't miss a message or call")));
      b.appendChild(hSub(L("نُعلمك حين تصلك رسالة أو مكالمة أو طلب تواصل — حتّى والتطبيق مغلق.", "We'll tell you about messages, calls and requests — even when the app is closed.")));
      var on = bigBtn(L("تفعيل الإشعارات", "Turn on notifications"), "white");
      var later = bigBtn(L("ليس الآن", "Not now"), "link");
      ft.appendChild(on); ft.appendChild(later);
      on.onclick = function () { on.disabled = true; enablePush().then(function () { onbGo("find"); }); };
      later.onclick = function () { lsSet("sawa_push_asked", Date.now()); onbGo("find"); };
      return;
    }
    if (step === "find") {
      b.appendChild(mk("div", "font-size:54px", "🤝"));
      b.appendChild(hTitle(L("تواصل مع من تعرف", "Connect with people you know")));
      b.appendChild(hSub(L("أدخل رمز صديقٍ أو زميل، أو أرسل له رمزك ليضيفك.", "Enter a friend's code, or send them yours.")));
      var fc = bigBtn(L("🔢  أدخل رمز شخص", "🔢  Enter someone's code"));
      var inv = bigBtn(L("📤  أرسل رمزي لصديق", "📤  Send my code to a friend"));
      var done = bigBtn(L("ابدأ استخدام سوا", "Start using Sawa"), "white");
      ft.appendChild(fc); ft.appendChild(inv); ft.appendChild(done);
      fc.onclick = function () { findSheet(); };
      inv.onclick = function () { loadCode().then(function (r) { shareText(codeShareText(r.code)); }, function (e) { toast(codeErr(e)); }); };
      done.onclick = onbDone;
      return;
    }
    onbGo("welcome");
  }
  function onbDone() {
    if (!onb) return;
    if (onb.timer) clearInterval(onb.timer);
    lsSet("sawa_onboarded", Date.now()); lsSet("sawa_name_asked", Date.now());
    try { localStorage.removeItem("sawa_onb_step"); } catch (e) {}
    try { onb.el.remove(); } catch (e) {}
    onb = null;
    whenApp(function () { try { if (app.goTab) app.goTab("chats"); } catch (e) {} });
    if (pendingCode) { var c = pendingCode; pendingCode = null; whenReady(function () { findSheet(c); }); }
    if (pendingDelete) { pendingDelete = false; onbDeleteMode = false; whenReady(function () { setTimeout(deleteAccountSheet, 600); }); }
  }
  // ?code=… (رابط «رمزي») و ?requests=1 (إشعار طلب تواصل)
  // ---------- تأكيد البريد (حسابات البريد وكلمة المرور) ----------
  //  بعد إنشاء الحساب تُرسَل رسالة تأكيد · شريطٌ يوميّ لطيف حتّى يؤكَّد · العودة من الرابط (?verified=1) ⇒ تحديث الحالة
  function emailUser() {
    try { var u = firebase.auth().currentUser; if (!u || u.isAnonymous || !u.email) return null;
      return (u.providerData || []).some(function (p) { return p && p.providerId === "password"; }) ? u : null; } catch (e) { return null; }
  }
  function sendVerify(silent) {
    var u = emailUser(); if (!u) return Promise.resolve(false);
    return u.sendEmailVerification({ url: global.location.origin + "/?verified=1" }).then(function () {
      lsSet("sawa_verify_sent", Date.now());
      toast(L("أرسلنا رابط تأكيدٍ إلى ", "We sent a confirmation link to ") + u.email + L(" — تفقّد الرسائل غير المرغوبة أيضاً", " — check spam too"));
      return true;
    }).catch(function (e) {
      if (!silent) toast(e && e.code === "auth/too-many-requests" ? L("أُرسل رابطٌ قبل قليل — انتظر ثمّ أعد المحاولة", "A link was sent recently — try again later") : L("تعذّر الإرسال: ", "Couldn't send: ") + ((e && (e.code || e.message)) || e));
      return false;
    });
  }
  var verifyEl = null;
  function maybeVerifyBanner() {
    var u = emailUser();
    if (!u || u.emailVerified || verifyEl || onbActive() || !document.body) return;
    if (lsGet("sawa_verify_asked", 0) > Date.now() - 86400000) return;
    verifyEl = bannerShell(); verifyEl.style.bottom = ""; verifyEl.style.top = "calc(10px + env(safe-area-inset-top,0px))"; verifyEl.style.background = "#8a5a00";
    var txt = mk("div", "flex:1", L("📧 أكّد بريدك ", "📧 Confirm ") + u.email + L(" لتستطيع استعادة حسابك", " so you can recover your account"));
    var yes = btn(L("إرسال الرابط", "Send link"), true), no = btn(L("لاحقاً", "Later"));
    var close = function () { lsSet("sawa_verify_asked", Date.now()); try { verifyEl.remove(); } catch (e) {} verifyEl = null; };
    yes.onclick = function () { close(); sendVerify(false); };
    no.onclick = close;
    verifyEl.appendChild(txt); verifyEl.appendChild(yes); verifyEl.appendChild(no); document.body.appendChild(verifyEl);
  }
  function handleVerifiedParam() {
    if (!/[?&]verified=1(&|$)/.test(global.location.search)) return;
    try { var u0 = new URL(global.location.href); u0.searchParams.delete("verified"); global.history.replaceState(null, "", u0.pathname + (u0.search ? u0.search : "") + u0.hash); } catch (e) {}
    whenReady(function () {
      var u = emailUser(); if (!u) return;
      u.reload().then(function () {
        var v = firebase.auth().currentUser;
        toast(v && v.emailVerified ? L("تمّ تأكيد بريدك ✓", "Email confirmed ✓") : L("لم يُؤكَّد البريد بعد — افتح الرابط من رسالة التأكيد", "Not confirmed yet — open the link in the email"));
      }).catch(function () {});
    });
  }
  function handleCodeParams() {
    var q; try { q = new URLSearchParams(global.location.search); } catch (e) { return; }
    var code = q.get("code"), rq = q.get("requests");
    if (!code && !rq) return;
    try { var u = new URL(global.location.href); u.searchParams.delete("code"); u.searchParams.delete("requests"); global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (e) {}
    if (code) {
      var d = codeDigits(code);
      if (onb || onbNeeded()) pendingCode = d;
      else whenReady(function () { setTimeout(function () { findSheet(d); }, 700); });
    }
    if (rq) whenReady(function () { setTimeout(requestsSheet, 700); });
  }

  // ---------- الإقلاع ----------
  var readyCbs = [];
  function whenReady(f) { if (state.uid) f(state.uid); else readyCbs.push(f); }
  function onUid(uid) {
    if (!uid || uid === state.uid) return;
    // تغيّر الهويّة (ربط Google): نبدأ من جديد
    for (var u in presenceRefs) { try { presenceRefs[u].off(); } catch (e) {} }
    presenceRefs = {}; state.presence = {}; state.people = []; state.loaded = false;
    state.uid = uid;
    var c = lsGet("sawa_people_cache", null);
    if (c && c.uid === uid) { state.me = c.me; state.people = c.people || []; publish(); }
    else { state.me = null; try { if (app && app.setMyProfile) app.setMyProfile(null); if (app && app.setPeople) app.setPeople([]); } catch (e) {}
      // C14: حسابٌ آخر على هذا الجهاز ⇒ وسائط الحساب السابق المنزّلة تُمسح
      if (c && c.uid) { try { idbP = null; if (global.indexedDB) indexedDB.deleteDatabase("sawa-media"); } catch (e) {} } }
    state.cachedUid = null;
    startMyPresence(uid);
    refresh();
    stopChats(); prefs = null; prefsLoaded = false; pend = {}; virtualChats = {};
    restorePending(); startChats(uid); loadPrefs(); drainOutbox();
    setTimeout(refreshPush, 3000);
    setTimeout(loadRequests, 2500);
    setTimeout(maybeVerifyBanner, 6000);
    var cbs = readyCbs; readyCbs = [];
    cbs.forEach(function (f) { try { f(uid); } catch (e) {} });
  }
  function boot() {
    // ?delete=1 (رابط «حذف الحساب» لـGoogle Play): جهازٌ جديد ⇒ شاشة الدخول وحدها ثمّ نافذة الحذف
    try {
      if (/[?&]delete=1(&|$)/.test(global.location.search)) {
        var du = new URL(global.location.href); du.searchParams.delete("delete"); global.history.replaceState(null, "", du.pathname + (du.search ? du.search : "") + du.hash);
        pendingDelete = true;
        if (onbNeeded()) { onbDeleteMode = true; lsSet("sawa_onb_step", "login"); }
        else whenReady(function () { setTimeout(function () { if (pendingDelete) { pendingDelete = false; deleteAccountSheet(); } }, 900); });
      }
    } catch (e) {}
    try { if (onbNeeded()) onbStart(); } catch (e) { log("onboarding:", e && e.message); }
    handleCodeParams();
    handleVerifiedParam();
    handleContactParam();
    handleGroupParam();
    handleChatParam();
    var tries = 0;
    (function wait() {
      if (S() && S().onReady) {
        S().onReady(function (uid) {
          onUid(uid);
          try {
            if (!authUnsub) authUnsub = firebase.auth().onAuthStateChanged(function (u) { if (u && u.uid !== state.uid) onUid(u.uid); });
          } catch (e) {}
        });
        return;
      }
      if (++tries < 100) setTimeout(wait, 100);
    })();
  }

  global.SawaChat = {
    version: VERSION,
    bindApp: bindApp, refresh: refresh, contacts: contacts,
    shareInvite: shareInvite, createInvite: createInvite, renderQr: renderQr,
    accept: accept, scanSupported: scanSupported, scanAndAdd: scanAndAdd, removeContact: removeContact,
    me: function () { return state.me; }, uid: function () { return state.uid; },
    profile: profile, saveProfile: saveProfile, editProfile: editProfile,   // حسابي: الاسم والرقم
    renameContact: renameContact, nickOf: nickOf,
    qrLib: loadQrLib,   // C8: رمز QR لروابط الغرف
    isBlocked: function (u) { return !!(prefs && prefs.blocked && prefs.blocked.indexOf(u) >= 0); },   // C6: المحظور لا يرنّ
    status: function () { return { loaded: state.loaded, error: state.error, count: state.people.length }; },
    // C2
    isCloud: isCloud, enabled: function () { return !!state.uid; }, openChat: openChat, closeChat: closeChat,
    send: send, edit: edit, clearChat: clearChat,
    // C4
    enablePush: enablePush, disablePush: disablePush, pushEnabled: pushEnabled, pushSupported: pushSupported, pushState: pushState, pushHelp: helpSheet,
    sendMedia: sendMedia, openFile: openFile, markViewedOnce: markViewedOnce, ensureMedia: ensureMedia,
    // C3
    createGroup: createGroup, updateGroup: updateGroup, addMembers: addMembers, removeMember: removeMember, setAdmin: setAdmin,
    leaveGroup: leaveGroup, shareGroupInvite: shareGroupInvite, joinGroup: joinGroup,
    sendPoll: sendPoll, vote: vote, editPoll: editPoll, sendBill: sendBill, billPaid: billPaid, sendFund: sendFund, contribute: contribute,
    sendTasks: sendTasks, setTask: setTask, deleteForAll: deleteForAll, deleteForMe: deleteForMe, react: react, pin: pin,
    setDisappear: setDisappear, openDm: openDm, openSaved: openSaved, dmWith: function (u) { return state.uid ? dmWith(u) : null; },
    typing: typing, whoTyping: whoTyping, observePrefs: observePrefs, markRead: markRead,
    _chats: function () { return chats; }, _days: function () { return days; }, _pend: function () { return pend; }, _flushMarks: flushMarks, _appMessages: appMessages,
    // C10
    codeSheet: codeSheet, findSheet: findSheet, requestsSheet: requestsSheet, emailSheet: emailSheet, loadRequests: loadRequests, deleteAccountSheet: deleteAccountSheet, reportSheet: reportSheet, sendVerify: sendVerify, emailVerified: function () { var u = emailUser(); return u ? !!u.emailVerified : null; },
    requestCount: function () { return reqs.incoming.length; }, fmtCode: fmtCode, codeValid: codeValid,
    retryFailed: retryFailed, discardFailed: discardFailed, failedSheet: failedSheet,   // C14
    retryMedia: retryMedia,   // C18
    scanAny: scanAny, routeScanned: routeScanned, signOutSheet: signOutSheet,   // C20
    onboarding: function () { return onb ? onb.step : null; }, startOnboarding: function () { try { localStorage.removeItem("sawa_onboarded"); } catch (e) {} onbStart(); },
    _state: state, _onUid: onUid, _tokenFrom: tokenFrom
  };
  if (global.document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
