/* ============================================================
   sawa-sync.js — طبقة الجسر بين التطبيق والخلفية (الـWorker + Firestore)
   ------------------------------------------------------------
   محلّيٌّ-أوّلاً: localStorage يبقى المخزن، والخادم مرجع للمجموعات المرفوعة.

   • connect()            — دخولٌ مجهول + accounts/{uid}            (B1)
   • watchGroup(gid, cb)  — مستمعات Firestore الحيّة                 (B2 / B5)
   • observe(gp, rels)    — يُنادى من sawa-app.js عند كلّ تغيّر؛ يحسب
                            الفرق لكلّ مجموعةٍ مرفوعة ويرسله للخادم  (B4)
   • uploadCurrent()      — زرّ «ارفع شجرتي»: bulk.import + ربط المجموعة (B4)

   المجموعات: معرّفها المحلّيّ (g-1…) غير فريد عالمياً، فيولّد الخادم معرّفها
   ويُحفَظ الربط في sawa_group_map. الأشخاص والصلات: المعرّف المحلّيّ = معرّف
   الخادم (قرار §٨-١)، فلا ترجمة.

   ⛔ الخصوصية: status_detail (الحالة الصحّية) و healthStatus و photo لا تغادر
   الجهاز أبداً — ليست في SYNC_FIELDS.

   مفتاح الإيقاف: localStorage "sawa_sync_off" = "1" أو ?sync=off.
   شارة الفحص: ?sync=debug (أو seed / upload).
   ============================================================ */
(function (global) {
  "use strict";

  var WORKER = "https://sawa-deploy-test.khalidlinux87.workers.dev";

  // الحقول التي تُزامَن — مطابقةٌ تماماً لقائمة ALLOWED في الـWorker v8.
  var SYNC_FIELDS = ["local_name", "gender", "kinship", "proximity", "birthYear", "birthday",
                     "alive", "death_date", "deathYear", "contacts", "phones", "notes", "motherId"];

  var state = {
    uid: null, ready: false, error: null,
    groupListeners: null,
    reviews: 0, lastAck: "", sending: false
  };
  var readyResolvers = [];

  // ---------- أدوات ----------
  function log() {
    if (global.console && console.log) {
      try { console.log.apply(console, ["[sawa-sync]"].concat([].slice.call(arguments))); } catch (e) {}
    }
  }
  function lsGet(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : JSON.parse(r); } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsRead(key, fb) { return lsGet("sawa:" + key, fb); } // مخازن التطبيق (البادئة sawa:)
  function isAr() { try { return (localStorage.getItem("sawaLang") || "ar") === "ar"; } catch (e) { return true; } }
  function hasFirebase() { return !!(global.firebase && firebase.auth && global.SawaAuth); }

  function enabled() {
    try {
      if (/[?&]sync=off/.test(global.location.search)) localStorage.setItem("sawa_sync_off", "1");
      if (/[?&]sync=on/.test(global.location.search)) localStorage.removeItem("sawa_sync_off");
      return localStorage.getItem("sawa_sync_off") !== "1";
    } catch (e) { return true; }
  }
  global.SAWA_SYNC = enabled();

  // ---------- B1: الاتصال ----------
  function connect() {
    if (state.ready && state.uid) return Promise.resolve(state.uid);
    return new Promise(function (resolve) {
      try {
        if (!hasFirebase()) throw new Error("Firebase/SawaAuth غير محمَّل");
        SawaAuth.currentUser(); // يُهيّئ Firebase
        var auth = firebase.auth();
        auth.onAuthStateChanged(function (user) {
          if (user) {
            state.uid = user.uid; state.ready = true; state.error = null;
            paintBadge(); flushReady(user.uid); drain();
          }
        });
        if (!auth.currentUser) {
          auth.signInAnonymously().catch(function (e) {
            state.error = (e && e.message) || "تعذّر الدخول المجهول";
            paintBadge(); resolve(null);
          });
        }
        onReady(resolve);
      } catch (e) {
        state.error = (e && e.message) || String(e); state.ready = false;
        paintBadge(); log("connect فشل:", state.error); resolve(null);
      }
    });
  }
  function onReady(cb) {
    if (state.uid) { try { cb(state.uid); } catch (e) {} return; }
    readyResolvers.push(cb);
  }
  function flushReady(uid) {
    var l = readyResolvers; readyResolvers = [];
    l.forEach(function (cb) { try { cb(uid); } catch (e) {} });
  }
  function getToken() {
    try {
      var u = firebase.auth().currentUser;
      if (!u) return Promise.reject(new Error("لا مستخدم"));
      return u.getIdToken();
    } catch (e) { return Promise.reject(e); }
  }
  function sendOnce(op, payload) {
    return getToken().then(function (tok) {
      return fetch(WORKER, {
        method: "POST",
        headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ op: op, payload: payload })
      });
    }).then(function (r) { return r.json(); });
  }

  // ---------- صندوق الصادر: طابورٌ متسلسل محفوظ ----------
  // الترتيب مهمّ (الشخص قبل صلته)، فيُرسَل أمرٌ واحد في كلّ مرّة.
  // فشل الشبكة ⇒ يبقى ويُعاد لاحقاً. رفضٌ من الخادم ⇒ يُسجَّل ويُتخطّى.
  var OUTBOX = "sawa_outbox", FAILED = "sawa_sync_failed";
  var retryTimer = null;
  function enqueue(op, payload) {
    var q = lsGet(OUTBOX, []); q.push({ op: op, payload: payload, ts: Date.now() }); lsSet(OUTBOX, q);
    paintBadge(); drain();
  }
  function push(op, payload) { if (!enabled()) return; enqueue(op, payload); } // واجهةٌ متوافقة
  function drain() {
    if (state.sending || !state.uid || !enabled()) return;
    var q = lsGet(OUTBOX, []);
    if (!q.length) return;
    state.sending = true;
    var item = q[0];
    sendOnce(item.op, item.payload).then(function (b) {
      var rest = lsGet(OUTBOX, []); rest.shift(); lsSet(OUTBOX, rest);
      if (!b || b.ok === false) {
        var f = lsGet(FAILED, []); f.push({ op: item.op, error: b && b.error, ts: Date.now() });
        lsSet(FAILED, f.slice(-20));
        log("رُفض:", item.op, b && b.error);
        state.lastAck = "✗ " + item.op;
      } else {
        state.lastAck = "✓ " + item.op;
        if (b.queued) { state.reviews++; toast(isAr() ? "تعديلٌ ذهب للمراجعة" : "A change was sent for review"); }
      }
      state.sending = false; paintBadge(); drain();
    }).catch(function (e) {
      // شبكة: أبقِ الأمر وأعد المحاولة
      state.sending = false; state.lastAck = "… " + item.op; paintBadge();
      log("شبكة — إعادة لاحقاً:", (e && e.message) || e);
      if (!retryTimer) retryTimer = setTimeout(function () { retryTimer = null; drain(); }, 15000);
    });
  }
  try { global.addEventListener("online", drain); } catch (e) {}

  // ---------- ربط المجموعات المحلّية بالخادم ----------
  function groupMap() { return lsGet("sawa_group_map", {}); }
  function serverGid(localGid) { return groupMap()[localGid] || null; }

  // ---------- B4: المراقبة وحساب الفرق ----------
  function personToFields(p) {
    var out = {};
    for (var i = 0; i < SYNC_FIELDS.length; i++) {
      var k = SYNC_FIELDS[i];
      if (p && p[k] !== undefined) out[k] = p[k];
    }
    return out;
  }
  function snapshot(localGid, gp, rels) {
    var persons = {}, relations = {};
    ((gp && gp[localGid]) || []).forEach(function (p) { if (p && p.id) persons[p.id] = personToFields(p); });
    (rels || []).forEach(function (r) {
      if (r && r.id && r.groupId === localGid)
        relations[r.id] = { source: r.source, target: r.target, type: r.type, inferred: r.inferred || null };
    });
    return { persons: persons, relations: relations };
  }
  function same(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }

  function diffAndEnqueue(sg, base, snap) {
    var id, k;
    // ١) الأشخاص: جديدٌ أو حقولٌ تغيّرت (حقليّاً — قرار ④)
    for (id in snap.persons) {
      var cur = snap.persons[id], old = base.persons[id];
      if (!old) { enqueue("person.set", { groupId: sg, personId: id, fields: cur }); continue; }
      var changed = {}, any = false, keys = {};
      for (k in cur) keys[k] = 1;
      for (k in old) keys[k] = 1;
      for (k in keys) if (!same(cur[k], old[k])) { changed[k] = cur[k] === undefined ? null : cur[k]; any = true; }
      if (any) enqueue("person.set", { groupId: sg, personId: id, fields: changed });
    }
    // ٢) الصلات: جديدة / تغيّر طرفاها / تغيّر نوعها
    for (id in snap.relations) {
      var r = snap.relations[id], b = base.relations[id];
      var addPayload = { groupId: sg, relationId: id, type: r.type, from: r.source, to: r.target };
      if (r.inferred) addPayload.inferred = r.inferred;
      if (!b) { enqueue("relation.add", addPayload); continue; }
      if (b.source !== r.source || b.target !== r.target) {
        enqueue("relation.remove", { groupId: sg, relationId: id });
        enqueue("relation.add", addPayload);
      } else if (b.type !== r.type) {
        enqueue("relation.update", { groupId: sg, relationId: id, type: r.type });
      }
    }
    // ٣) حذف الصلات قبل حذف الأشخاص
    for (id in base.relations) if (!snap.relations[id]) enqueue("relation.remove", { groupId: sg, relationId: id });
    for (id in base.persons) if (!snap.persons[id]) enqueue("person.delete", { groupId: sg, personId: id });
  }

  var baseline = {};          // localGid -> لقطة آخر حالةٍ أُرسلت
  var lastGp = null, lastRels = null;
  function observe(gp, rels) {
    lastGp = gp; lastRels = rels;
    if (!enabled()) return;
    var map = groupMap();
    for (var localGid in map) {
      if (!Object.prototype.hasOwnProperty.call(map, localGid)) continue;
      var snap = snapshot(localGid, gp, rels);
      var base = baseline[localGid];
      baseline[localGid] = snap;
      if (!base) continue;      // أوّل مراقبة بعد الفتح = خطّ الأساس
      diffAndEnqueue(map[localGid], base, snap);
    }
  }

  // ---------- B4: «ارفع شجرتي» ----------
  function currentLocalGid() { return lsRead("currentGroupId", "g-1"); }
  function buildImport(localGid, gp, rels) {
    var groups = lsRead("familyGroups", []);
    var gObj = (groups || []).filter(function (g) { return g && g.id === localGid; })[0];
    var persons = (gp && gp[localGid]) || [];
    var groupRels = (rels || []).filter(function (r) { return r && r.groupId === localGid; });
    return {
      persons: persons, groupRels: groupRels,
      payload: {
        name: (gObj && gObj.name) || "عائلتي",
        persons: persons.map(function (p) {
          var o = personToFields(p); o.localId = p.id; return o; // ⛔ بلا status_detail ولا photo
        }),
        relations: groupRels.map(function (r) {
          var o = { localId: r.id, fromLocalId: r.source, toLocalId: r.target, type: r.type };
          if (r.inferred) o.inferred = r.inferred;
          return o;
        })
      }
    };
  }
  function uploadGroup(localGid, gp, rels) {
    var built = buildImport(localGid, gp, rels);
    return sendOnce("bulk.import", built.payload).then(function (b) {
      if (!b || !b.ok) throw new Error((b && b.error) || "bulk.import failed");
      var map = groupMap(); map[localGid] = b.groupId; lsSet("sawa_group_map", map);
      baseline[localGid] = snapshot(localGid, gp, rels); // ما رُفع هو خطّ الأساس
      return b;
    });
  }
  function uploadCurrent() {
    var ar = isAr();
    var localGid = currentLocalGid();
    var gp = lastGp || lsRead("groupPersons", {});
    var rels = lastRels || lsRead("kinshipRelations", []);
    var n = ((gp && gp[localGid]) || []).length;
    if (!n) { toast(ar ? "المجموعة الحالية لا تحوي أشخاصاً بعد" : "This group has no people yet"); return Promise.resolve(null); }
    if (serverGid(localGid)) {
      var again = global.confirm(ar
        ? "شجرة هذه المجموعة مرفوعةٌ ومتزامنة. أترفع نسخةً جديدة كاملة؟ (تحلّ محلّ الربط الحاليّ)"
        : "This tree is already synced. Upload a fresh full copy? (replaces the current link)");
      if (!again) return Promise.resolve(null);
    }
    if (!state.uid) { toast(ar ? "تعذّر الاتصال بالخادم — حاول بعد قليل" : "Can't reach the server — try again shortly"); return Promise.resolve(null); }
    toast(ar ? "جارٍ رفع الشجرة…" : "Uploading tree…");
    return uploadGroup(localGid, gp, rels).then(function (b) {
      toast(ar ? ("رُفعت شجرتك: " + b.personsImported + " شخصاً و" + b.relationsImported + " صلة ✓")
               : ("Tree uploaded: " + b.personsImported + " people, " + b.relationsImported + " links ✓"));
      paintBadge();
      return b;
    }).catch(function (e) {
      toast((ar ? "تعذّر الرفع: " : "Upload failed: ") + ((e && e.message) || e));
      return null;
    });
  }

  // ---------- القراءة الحيّة ----------
  function rawWatch(gid, cbs) {
    if (!gid) return function () {};
    if (state.groupListeners && state.groupListeners.off) { try { state.groupListeners.off(); } catch (e) {} }
    try {
      var base = firebase.firestore().collection("groups").doc(gid);
      var offP = base.collection("persons").onSnapshot(function (snap) {
        var arr = []; snap.forEach(function (d) { arr.push(personFromDoc(d.id, d.data())); });
        cbs && cbs.onPersons && cbs.onPersons(arr);
      }, function (e) { log("مستمع الأشخاص:", (e && e.message) || e); });
      var offR = base.collection("relations").onSnapshot(function (snap) {
        var arr = []; snap.forEach(function (d) { arr.push(relFromDoc(gid, d.id, d.data())); });
        cbs && cbs.onRelations && cbs.onRelations(arr);
      }, function (e) { log("مستمع الصلات:", (e && e.message) || e); });
      var off = function () { try { offP(); } catch (e) {} try { offR(); } catch (e) {} };
      state.groupListeners = { gid: gid, off: off };
      return off;
    } catch (e) { log("rawWatch فشل:", (e && e.message) || e); return function () {}; }
  }
  function watchGroup(gid, cbs) { if (!enabled()) return function () {}; return rawWatch(gid, cbs); }
  function personFromDoc(id, data) {
    var p = { id: id };
    for (var k in data) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
      if (k === "fts" || k === "healthStatus" || k === "status_detail") continue;
      p[k] = data[k];
    }
    return p;
  }
  function relFromDoc(gid, id, data) {
    return { id: id, groupId: gid, source: data.from, target: data.to, type: data.type,
             inferred: data.inferred, deleted: data.deleted === true };
  }
  function relToServer(r) { return { groupId: r.groupId, type: r.type, from: r.source, to: r.target }; }

  // ---------- إشعارٌ صغير ----------
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    try {
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:2147483646;" +
          "background:rgba(20,30,40,.92);color:#fff;font:600 14px system-ui;padding:10px 16px;border-radius:12px;" +
          "max-width:86vw;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.3);transition:opacity .25s;pointer-events:none";
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg; toastEl.style.opacity = "1";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.style.opacity = "0"; }, 3500);
    } catch (e) {}
  }

  // ---------- شارة الفحص ----------
  function debugOn() {
    try {
      if (/[?&]sync=(debug|seed|upload)/.test(global.location.search)) return true;
      return localStorage.getItem("sawa_sync_debug") === "1";
    } catch (e) { return false; }
  }
  var badgeEl = null;
  function paintBadge() {
    if (!debugOn()) return;
    try {
      if (!badgeEl) {
        badgeEl = document.createElement("div");
        badgeEl.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;" +
          "font:700 13px system-ui;padding:9px 12px;border-radius:10px;text-align:center;" +
          "box-shadow:0 2px 10px rgba(0,0,0,.35);direction:ltr;pointer-events:none;";
        document.body.appendChild(badgeEl);
      }
      var ok = state.ready && state.uid;
      badgeEl.style.background = ok ? "#187854" : (state.error ? "#b23b3b" : "#8a6d1f");
      badgeEl.style.color = "#fff";
      var body = ok ? ("uid " + String(state.uid).slice(0, 6) + "…") : (state.error ? ("err: " + state.error) : "connecting…");
      if (state.dbgGid) {
        body += " · G " + String(state.dbgGid).slice(0, 6) +
                " P:" + (state.dbgPersons == null ? "?" : state.dbgPersons) +
                " R:" + (state.dbgRelations == null ? "?" : state.dbgRelations);
      }
      body += " · Q:" + lsGet(OUTBOX, []).length + " F:" + lsGet(FAILED, []).length + " Rv:" + state.reviews;
      if (state.lastAck) body += " " + state.lastAck;
      if (state.dbgNote) body = state.dbgNote + " · " + body;
      badgeEl.textContent = "sync " + (enabled() ? "ON" : "off") + " · " + body;
    } catch (e) {}
  }

  // ---------- أدوات الفحص (seed / upload / debug) ----------
  function debugParam(name) { try { return new URLSearchParams(global.location.search).get(name); } catch (e) { return null; } }
  function debugSeed() {
    return sendOnce("group.create", { name: "مجموعة البذرة (B2)" }).then(function (g) {
      if (!g || !g.ok) throw new Error("group.create: " + JSON.stringify(g));
      var gid = g.groupId;
      return sendOnce("person.set", { groupId: gid, fields: { local_name: "خالد", gender: "male" } }).then(function (a) {
        return sendOnce("person.set", { groupId: gid, fields: { local_name: "أحمد", gender: "male" } }).then(function (b) {
          return sendOnce("relation.add", { groupId: gid, type: "parent", from: a.personId, to: b.personId })
            .then(function () { return gid; });
        });
      });
    });
  }
  function debugUpload() {
    var gp = lsRead("groupPersons", {}), rels = lsRead("kinshipRelations", []);
    var localGid = currentLocalGid();
    var count = function (id) { return ((gp && gp[id]) || []).length; };
    if (!count(localGid)) {
      var best = localGid, bestN = 0;
      for (var k in (gp || {})) if (Object.prototype.hasOwnProperty.call(gp, k) && count(k) > bestN) { best = k; bestN = count(k); }
      localGid = best;
    }
    var built = buildImport(localGid, gp, rels);
    state.dbgNote = "uploading " + localGid + " L:" + built.persons.length + "/" + built.groupRels.length + "…"; paintBadge();
    return uploadGroup(localGid, gp, rels).then(function (b) {
      state.dbgNote = localGid + " L:" + built.persons.length + "/" + built.groupRels.length +
                      " → up P:" + b.personsImported + " R:" + b.relationsImported + " orphans:" + b.orphansSkipped;
      return b.groupId;
    });
  }
  function debugRun() {
    if (!debugOn()) return;
    onReady(function () {
      var mode = debugParam("sync");
      var gid = debugParam("gid") || serverGid(currentLocalGid()) || lsGet("sawa_b2_gid", null);
      var startWatch = function (g) {
        lsSet("sawa_b2_gid", g);
        state.dbgGid = g; if (mode !== "upload") state.dbgNote = ""; paintBadge();
        rawWatch(g, {
          // العدّ يستثني المحذوف (شاهدة)
          onPersons:   function (arr) { state.dbgPersons   = arr.filter(function (p) { return p.deleted !== true; }).length; paintBadge(); },
          onRelations: function (arr) { state.dbgRelations = arr.filter(function (r) { return !r.deleted; }).length; paintBadge(); }
        });
      };
      if (mode === "upload") {
        debugUpload().then(startWatch).catch(function (e) { state.error = "upload: " + ((e && e.message) || e); paintBadge(); });
      } else if (mode === "seed" && !gid) {
        state.dbgNote = "seeding…"; paintBadge();
        debugSeed().then(startWatch).catch(function (e) { state.error = "seed: " + ((e && e.message) || e); paintBadge(); });
      } else if (gid) {
        startWatch(gid);
      }
    });
  }

  // ---------- الواجهة العامّة ----------
  global.SawaSync = {
    connect: connect, onReady: onReady, getToken: getToken,
    push: push, observe: observe, uploadCurrent: uploadCurrent,
    watchGroup: watchGroup, serverGid: serverGid,
    personToFields: personToFields, relToServer: relToServer,
    uid: function () { return state.uid; },
    isReady: function () { return !!(state.ready && state.uid); },
    _state: state, _diff: diffAndEnqueue, _snapshot: snapshot
  };

  // ---------- إقلاعٌ ذاتيّ ----------
  function boot() {
    paintBadge();
    connect().then(function (uid) {
      paintBadge();
      log(uid ? ("متّصل: " + uid) : "تعذّر الاتصال — التطبيق يعمل محلّياً");
      debugRun();
    });
  }
  if (global.document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
