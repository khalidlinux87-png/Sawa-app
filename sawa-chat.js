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
(function (global) {
  "use strict";
  var VERSION = "c2";
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
  function displayName(p) {
    return p.name || (p.anon ? L("ضيف (بلا حساب Google)", "Guest (no Google account)") : L("عضو", "Member"));
  }
  function decorate(p) {
    var pr = state.presence[p.uid] || null;
    return { id: p.uid, uid: p.uid, name: displayName(p), realName: p.name || null, anon: !!p.anon,
             families: p.families || [], via: p.via || [], onSawa: true, phone: "",
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
    }, 60);
  }
  function refresh() {
    if (!state.uid || state.loading) return Promise.resolve(contacts());
    state.loading = true;
    return call("people.list", {}).then(function (b) {
      state.me = b.me || null; state.people = b.people || []; state.loaded = true; state.error = null;
      lsSet("sawa_people_cache", { uid: state.uid, me: state.me, people: state.people });
      watchPresence();
      publish();
      return contacts();
    }).catch(function (e) {
      state.error = (e && e.message) || String(e); log("people.list:", state.error);
      return contacts();
    }).then(function (r) { state.loading = false; return r; });
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
    document.addEventListener("visibilitychange", function () {
      if (!myStatusRef) return;
      setMine(document.visibilityState === "hidden" ? "offline" : "online");
      if (document.visibilityState === "visible" && state.uid) { refresh(); if (openCid) markRead(openCid); drainOutbox(); }
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
  // مسح QR بالكاميرا (BarcodeDetector — كروم أندرويد). يعيد النصّ المقروء أو null
  function scanSupported() { return !!(global.BarcodeDetector && global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function scanQr() {
    if (!scanSupported()) return Promise.reject(new Error(L("المسح غير مدعوم في هذا المتصفّح — الصق الرابط بدلاً منه", "Scanning isn't supported here — paste the link instead")));
    return new Promise(function (resolve, reject) {
      var det, stream, done = false;
      var wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center";
      var vid = document.createElement("video"); vid.setAttribute("playsinline", ""); vid.muted = true;
      vid.style.cssText = "width:100%;max-height:80vh;object-fit:cover";
      var hint = document.createElement("div");
      hint.textContent = L("وجّه الكاميرا إلى رمز QR", "Point the camera at a QR code");
      hint.style.cssText = "color:#fff;font:700 15px system-ui;margin:14px";
      var btn = document.createElement("button");
      btn.textContent = L("إلغاء", "Cancel");
      btn.style.cssText = "color:#fff;background:rgba(255,255,255,.18);border:0;border-radius:12px;padding:10px 22px;font:700 14px system-ui";
      wrap.appendChild(vid); wrap.appendChild(hint); wrap.appendChild(btn); document.body.appendChild(wrap);
      function finish(val, err) {
        if (done) return; done = true;
        try { stream && stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { wrap.remove(); } catch (e) {}
        err ? reject(err) : resolve(val);
      }
      btn.onclick = function () { finish(null); };
      try { det = new global.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { return finish(null, e); }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (s) {
        stream = s; vid.srcObject = s; return vid.play();
      }).then(function () {
        (function tick() {
          if (done) return;
          det.detect(vid).then(function (codes) {
            if (codes && codes.length && codes[0].rawValue) return finish(codes[0].rawValue);
            setTimeout(tick, 250);
          }).catch(function () { setTimeout(tick, 400); });
        })();
      }).catch(function (e) { finish(null, new Error(L("لا إذن للكاميرا", "No camera permission"))); });
    });
  }
  function scanAndAdd() {
    return scanQr().then(function (txt) { return txt ? accept(txt) : null; })
      .catch(function (e) { toast((e && e.message) || String(e)); return null; });
  }

  // رابط ?contact= في عنوان الصفحة: يُقبل بعد الدخول ثمّ يُحذف من العنوان
  function handleContactParam() {
    var tok = null;
    try { tok = new URLSearchParams(global.location.search).get("contact"); } catch (e) {}
    if (!tok) return;
    try {
      var u = new URL(global.location.href); u.searchParams.delete("contact");
      global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash);
    } catch (e) {}
    whenReady(function () { accept(tok); });
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
    var n = c && c.names && c.names[u];
    return n || L("عضو", "Member");
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
  function queueMark(cid, m) {
    var q = markQ[cid] || (markQ[cid] = { cid: cid });
    for (var k in m) if (m[k] != null) q[k] = Math.max(q[k] || 0, m[k]);
    if (!markTimer) markTimer = setTimeout(flushMarks, 1200);
  }
  function flushMarks() {
    markTimer = null;
    var list = Object.keys(markQ).map(function (k) { return markQ[k]; }); markQ = {};
    if (!list.length || !state.uid) return;
    call("chat.mark", { marks: list }).catch(function (e) { log("chat.mark:", (e && e.message) || e); });
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
    if (opts.reply && opts.reply.id) msg.reply = { id: opts.reply.id, by: realId(opts.reply.by || null), text: String(opts.reply.text || "").slice(0, 200) };
    if (opts.fwd) msg.fwd = true;
    if (opts.contact) msg.contact = opts.contact;
    if (opts.mentions) msg.mentions = opts.mentions;
    if (opts.extra) msg.extra = opts.extra;
    (pend[cid] = pend[cid] || []).push({ msg: msg, ts: Date.now(), status: "pending" });
    var ob = lsGet(OUTBOX, []); ob.push({ cid: cid, msg: msg }); lsSet(OUTBOX, ob);
    publishMessages(cid); publishChats();
    drainOutbox();
    return msg.id;
  }
  var draining = false, retryT = null;
  function drainOutbox() {
    if (draining || !state.uid) return;
    var ob = lsGet(OUTBOX, []); if (!ob.length) return;
    draining = true;
    var job = ob[0];
    call("chat.send", { cid: job.cid, msg: job.msg }).then(function (b) {
      setPend(job.cid, job.msg.id, b && b.blocked ? "sent" : "sent");
      shiftOutbox(job.msg.id);
    }).catch(function (e) {
      var m = (e && e.message) || String(e);
      if (e instanceof TypeError || /fetch|network|rate/i.test(m)) {        // الشبكة: نعيد لاحقاً
        draining = false;
        if (!retryT) retryT = setTimeout(function () { retryT = null; drainOutbox(); }, 10000);
        return "stop";
      }
      setPend(job.cid, job.msg.id, "failed"); shiftOutbox(job.msg.id);
      toast(L("تعذّر إرسال رسالة: ", "A message couldn't be sent: ") + m);
    }).then(function (r) { if (r === "stop") return; draining = false; drainOutbox(); });
  }
  function shiftOutbox(id) { lsSet(OUTBOX, lsGet(OUTBOX, []).filter(function (x) { return x.msg.id !== id; })); }
  function setPend(cid, id, st) {
    (pend[cid] || []).forEach(function (p) { if (p.msg.id === id) p.status = st; });
    publishMessages(cid);
  }
  try { global.addEventListener("online", drainOutbox); } catch (e) {}
  function restorePending() {   // بعد إعادة الفتح: ما بقي في الطابور يظهر «قيد الإرسال»
    lsGet(OUTBOX, []).forEach(function (j) { if (!(pend[j.cid] || []).some(function (p) { return p.msg.id === j.msg.id; })) (pend[j.cid] = pend[j.cid] || []).push({ msg: j.msg, ts: Date.now(), status: "pending" }); });
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
      lastStatus: lp ? (lp.status === "pending" ? "sent" : lp.status) : (l && l.by === state.uid ? statusOf(c, l.ts) : null),
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
    var lastText = lp ? preview(lp.msg) : (l ? ((l.by && l.by !== state.uid ? personName(l.by, c) + ": " : "") + preview(l)) : "");
    return { id: c.cid, cloud: true, kind: c.type, familyGroupId: c.familyGroupId || null,
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
      try { if (app.setGroups) app.setGroups(groups); } catch (e) {}
    }, 40);
  }
  function appMessages(cid) {
    var c = chats[cid] || virtualChats[cid] || { members: [] }, hidden = (prefs && prefs.hidden) || {};
    var clearedAt = (prefs && prefs.cleared && prefs.cleared[cid]) || 0;
    var dd = days[cid] || {}, arr = [];
    Object.keys(dd).forEach(function (day) { var mm = dd[day]; Object.keys(mm).forEach(function (id) { var m = mm[id]; if (m && !hidden[id] && (m.ts || 0) > clearedAt) arr.push({ m: m, day: day }); }); });
    (pend[cid] || []).forEach(function (p) { if (!hidden[p.msg.id]) arr.push({ m: Object.assign({ by: state.uid, ts: p.ts }, p.msg), pending: p.status }); });
    arr.sort(function (a, b) { return (a.m.ts || 0) - (b.m.ts || 0); });
    var group = c.type === "family" || c.type === "group";
    return arr.map(function (x) {
      var m = x.m, mine = m.by === state.uid, re = m.re || {};
      var mineRe = re[state.uid], anyRe = Object.keys(re).map(function (k) { return re[k]; })[0];
      var o = { id: m.id, day: x.day || null, createdAt: m.ts, text: m.del ? L("🚫 حُذفت هذه الرسالة", "🚫 This message was deleted") : (m.text || ""),
                type: m.del ? "text" : (m.type === "text" ? undefined : m.type), deleted: !!m.del, edited: !!m.edited,
                forwarded: !!m.fwd, reaction: mineRe || anyRe || null, reactions: re, replyTo: m.reply || null,
                replyToText: m.reply ? m.reply.text : null, contact: m.contact || null, extra: m.extra || null, cloud: true,
                starred: !!(prefs && prefs.starred && prefs.starred.some(function (s) { return s.id === m.id; })) };
      if (group) { o.senderId = appId(m.by); o.senderName = personName(m.by, c); if (o.type === undefined) o.type = "text"; }
      else o.senderUserId = appId(m.by);
      if (mine) o.status = x.pending ? (x.pending === "failed" ? "failed" : "pending") : statusOf(c, m.ts);
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
    tones: "setConversationTones", starred: "setStarredMessages", blocked: "setBlockedConversations" };
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
      Object.keys(days).forEach(publishMessages); publishChats();
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
    startMyPresence(uid);
    refresh();
    stopChats(); prefs = null; prefsLoaded = false; pend = {}; virtualChats = {};
    restorePending(); startChats(uid); loadPrefs(); drainOutbox();
    var cbs = readyCbs; readyCbs = [];
    cbs.forEach(function (f) { try { f(uid); } catch (e) {} });
  }
  function boot() {
    handleContactParam();
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
    status: function () { return { loaded: state.loaded, error: state.error, count: state.people.length }; },
    // C2
    isCloud: isCloud, enabled: function () { return !!state.uid; }, openChat: openChat, closeChat: closeChat,
    send: send, edit: edit, clearChat: clearChat, deleteForAll: deleteForAll, deleteForMe: deleteForMe, react: react, pin: pin,
    setDisappear: setDisappear, openDm: openDm, openSaved: openSaved, dmWith: function (u) { return state.uid ? dmWith(u) : null; },
    typing: typing, whoTyping: whoTyping, observePrefs: observePrefs, markRead: markRead,
    _chats: function () { return chats; }, _days: function () { return days; }, _pend: function () { return pend; }, _flushMarks: flushMarks, _appMessages: appMessages,
    _state: state, _onUid: onUid, _tokenFrom: tokenFrom
  };
  if (global.document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
