/* ============================================================
   sawa-rtc.js — المكالمات: الثنائيّة (C6) والجماعيّة والمجدولة (C7)
   ------------------------------------------------------------
   • الوسائط مباشرةً بين الجهازين (WebRTC). STUN مجّاني؛ TURN (Metered) يعطيه الـWorker
     عبر rtc.ice إن ضُبط METERED_KEY/METERED_APP — بدونه قد تفشل بعض الشبكات (4G خلف NAT صارم).
   • الإشارات في Realtime Database:
       calls/{id}  = { from, to, type, fromName, state, ts, offer, acc, answer, reoffer, reanswer,
                       ic_caller/{push}, ic_callee/{push} }
       inbox/{uid}/{id} = { from, fromName, type, ts }   ← «يرنّ عندك»
     القواعد (database.rules.json): يكتب المتّصل فقط لمن هو في جهات اتّصاله (acl)، ويقرأ الطرفان وحدهما.
   • الرنين والتطبيق مغلق: الـWorker call.ring (إشعار عالي الأولويّة) · فائتة: call.missed.
   • واجهة المكالمة DOM مستقلّة فوق التطبيق (لا React) — تبقى حتّى لو تغيّرت الشاشة.
   ⛔ لا تستعمل اسماً عامّاً قد تعرّفه sawa-app (Image, Phone, Video…) — استعمل global.X.
   ============================================================ */
(function (global) {
  "use strict";
  var VERSION = "c7";
  var RING_MS = global.__sawaRtcRingMs || 45000, STALE_MS = 50000, CONNECT_MS = 30000, LOST_MS = 20000;
  var app = null, logQueue = [], cur = null, inboxRef = null, inboxUid = null, offsetRef = null, srvOffset = 0;
  var iceCache = null, iceAt = 0, seen = {}, devId = rid(10);

  function isAr() { try { return (localStorage.getItem("sawaLang") || "ar") === "ar"; } catch (e) { return true; } }
  function L(ar, en) { return isAr() ? ar : en; }
  function S() { return global.SawaSync; }
  function C() { return global.SawaChat; }
  function toast(m) { try { S().toast(m); } catch (e) {} }
  function wcall(op, payload) { return S().call(op, payload || {}); }
  function log() { try { console.log.apply(console, ["[sawa-rtc]"].concat([].slice.call(arguments))); } catch (e) {} }
  function db() { try { return global.firebase && firebase.database ? firebase.database() : null; } catch (e) { return null; } }
  function TS() { return firebase.database.ServerValue.TIMESTAMP; }
  function now() { return Date.now() + (srvOffset || 0); }
  function rid(n) {
    var a = "abcdefghijklmnopqrstuvwxyz0123456789", s = "", r = new Uint8Array(n);
    try { global.crypto.getRandomValues(r); } catch (e) { for (var j = 0; j < n; j++) r[j] = Math.floor(Math.random() * 256); }
    for (var i = 0; i < n; i++) s += a[r[i] % 36];
    return s;
  }
  function myUid() { try { return C() && C().uid ? C().uid() : null; } catch (e) { return null; } }
  function myName() { try { var m = C().me(); return (m && m.name) || ""; } catch (e) { return ""; } }
  function nameOf(uid) {
    try { var l = C().contacts(); for (var i = 0; i < l.length; i++) if (l[i].uid === uid) return l[i].name; } catch (e) {}
    return "";
  }
  function supported() { return !!(global.RTCPeerConnection && global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function enabled() { return supported() && !!myUid() && !!db(); }
  function sdpOf(d) { return { type: d.type, sdp: d.sdp }; }
  function iceJson(c) {
    var j = c.toJSON ? c.toJSON() : { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex };
    var o = {}; for (var k in j) if (j[k] !== undefined && j[k] !== null) o[k] = j[k];   // RTDB يرفض undefined
    return o;
  }
  function fmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

  // ---------- ربط التطبيق: سجلّ المكالمات + فتح المحادثة ----------
  function bindApp(fns) {
    app = fns || null;
    if (app && app.setCallLog && logQueue.length) { var q = logQueue; logQueue = []; q.forEach(addLog); }
    if (app && app.setScheduledCalls && schedAt) publishSched();
  }
  function addLog(entry) {
    if (!app || !app.setCallLog) { logQueue.push(entry); return; }
    try { app.setCallLog(function (prev) { prev = prev || []; return prev.some(function (x) { return x.id === entry.id; }) ? prev : [entry].concat(prev); }); } catch (e) {}
  }
  function logCall(c) {
    if (!c || c.logged || c.silent) return; c.logged = true;
    var secs = c.connectedAt ? Math.max(1, Math.round((Date.now() - c.connectedAt) / 1000)) : 0;
    var type = c.role === "caller" ? "outgoing" : (c.connectedAt || c.declined ? "incoming" : "missed");
    addLog({ id: "call-" + c.id, name: c.name || L("جهة اتّصال", "Contact"), peerUid: c.peer, callType: c.type,
             type: type, time: L("الآن", "Now"), duration: secs ? fmt(secs) : null, timestamp: Date.now(), participants: null, cloud: true });
  }

  // ---------- خوادم ICE (STUN + TURN إن وُجد) ----------
  var STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  function getIce() {
    if (iceCache && Date.now() - iceAt < 20 * 60 * 1000) return Promise.resolve(iceCache);
    return Promise.race([
      wcall("rtc.ice", {}).then(function (b) {
        var l = b && Array.isArray(b.iceServers) && b.iceServers.length ? b.iceServers : STUN;
        iceCache = l; iceAt = Date.now(); log("ice", b && b.turn ? "TURN" : "STUN"); return l;
      }),
      new Promise(function (r) { setTimeout(function () { r(iceCache || STUN); }, 6000); })
    ]).catch(function () { return iceCache || STUN; });
  }

  // ---------- الوسائط ----------
  function getMedia(type, facing) {
    var md = navigator.mediaDevices;
    var audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (type !== "video") return md.getUserMedia({ audio: audio, video: false });
    // 640×480 كافية وخفيفة على الشبكات الضعيفة
    return md.getUserMedia({ audio: audio, video: { facingMode: facing || "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } });
  }
  function stopStream(s) { try { s && s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
  function mediaError(e) {
    var n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError") return L("اسمح لسوا باستخدام الميكروفون/الكاميرا من إعدادات المتصفّح", "Allow microphone/camera access in browser settings");
    if (n === "NotFoundError" || n === "OverconstrainedError") return L("لا يوجد ميكروفون أو كاميرا متاحة", "No microphone or camera found");
    if (n === "NotReadableError") return L("الميكروفون أو الكاميرا مشغول بتطبيقٍ آخر", "Microphone or camera is busy");
    return null;
  }

  // ---------- النغمات (WebAudio — لا ملفّات) ----------
  var tone = { ctx: null, timer: null };
  function audioCtx() {
    var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null;
    try { if (!tone.ctx) tone.ctx = new AC(); if (tone.ctx.state === "suspended" && tone.ctx.resume) tone.ctx.resume(); } catch (e) { return null; }
    return tone.ctx;
  }
  function beep(freqs, dur, vol) {
    var ctx = audioCtx(); if (!ctx) return;
    try {
      var t0 = ctx.currentTime, g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
      g.gain.setValueAtTime(vol, t0 + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      g.connect(ctx.destination);
      freqs.forEach(function (f) { var o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + dur + 0.02); });
    } catch (e) {}
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function playTone(kind) {
    stopTone();
    var cycle;
    if (kind === "ring") cycle = function () { beep([440, 480], 0.45, 0.22); setTimeout(function () { beep([440, 480], 0.45, 0.22); }, 650); vibrate([450, 200, 450]); };
    else cycle = function () { beep([425], 1.0, 0.08); };          // نغمة «يرنّ» عند المتّصل
    cycle(); tone.timer = setInterval(cycle, kind === "ring" ? 2600 : 4000);
  }
  function stopTone() { if (tone.timer) clearInterval(tone.timer); tone.timer = null; vibrate(0); }
  function endTone() { beep([480], 0.18, 0.1); setTimeout(function () { beep([480], 0.18, 0.1); }, 260); setTimeout(function () { beep([480], 0.18, 0.1); }, 520); }

  // ---------- إبقاء الشاشة مضاءة أثناء المكالمة ----------
  var wake = null;
  function wakeOn() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request("screen").then(function (w) { wake = w; }).catch(function () {}); } catch (e) {} }
  function wakeOff() { try { if (wake) wake.release(); } catch (e) {} wake = null; }

  // ============================================================
  //  واجهة المكالمة
  // ============================================================
  var ui = { root: null };
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function btn(icon, label, bg, onclick) {
    var w = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px;min-width:64px");
    var b = el("button", "width:60px;height:60px;border-radius:50%;border:0;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;background:" + bg, icon);
    b.setAttribute("aria-label", label);
    b.onclick = function (ev) { ev.stopPropagation(); onclick(); };
    var t = el("span", "font:600 12px system-ui;color:#e8f5ee", label);
    w.appendChild(b); w.appendChild(t); w._b = b; w._t = t;
    return w;
  }
  function buildUi() {
    if (ui.root) return ui;
    var r = el("div", "position:fixed;inset:0;z-index:2147483000;background:linear-gradient(160deg,#0f3d2c,#071a12);color:#fff;display:none;flex-direction:column;align-items:stretch;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;direction:rtl;overflow:hidden;user-select:none;-webkit-user-select:none");
    r.id = "sawa-call";
    var rv = el("video", "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;display:none");
    rv.autoplay = true; rv.playsInline = true; rv.muted = true; rv.setAttribute("playsinline", "");
    var ra = el("audio", "display:none"); ra.autoplay = true;
    var lv = el("video", "position:absolute;top:calc(env(safe-area-inset-top,0px) + 76px);left:14px;width:100px;height:142px;border-radius:14px;object-fit:cover;background:#123;display:none;transform:scaleX(-1);box-shadow:0 4px 16px rgba(0,0,0,.5);z-index:2");
    lv.autoplay = true; lv.playsInline = true; lv.muted = true; lv.setAttribute("playsinline", "");
    var top = el("div", "position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 8px;background:linear-gradient(rgba(0,0,0,.45),transparent)");
    var topName = el("div", "font:700 15px system-ui;opacity:0;transition:opacity .2s;text-shadow:0 1px 3px #000");
    var minBtn = el("button", "background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:18px;padding:7px 12px;font:600 12px system-ui;cursor:pointer", L("تصغير ▾", "Minimize ▾"));
    minBtn.onclick = function () { minimize(true); };
    top.appendChild(topName); top.appendChild(minBtn);
    var mid = el("div", "position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 20px;text-align:center");
    var av = el("div", "width:112px;height:112px;border-radius:50%;background:#2e7d5b;display:flex;align-items:center;justify-content:center;font:800 46px system-ui;box-shadow:0 0 0 10px rgba(46,125,91,.25),0 0 0 22px rgba(46,125,91,.12)");
    var nm = el("div", "font:800 24px system-ui;margin-top:14px");
    var st = el("div", "font:600 15px system-ui;color:#bfe3d0");
    var sub = el("div", "font:500 11px system-ui;color:#8fb8a4;min-height:14px");
    mid.appendChild(av); mid.appendChild(nm); mid.appendChild(st); mid.appendChild(sub);
    var bar = el("div", "position:relative;z-index:3;display:flex;justify-content:space-evenly;align-items:flex-start;padding:18px 10px calc(env(safe-area-inset-bottom,0px) + 26px);background:linear-gradient(transparent,rgba(0,0,0,.55))");
    r.appendChild(rv); r.appendChild(ra); r.appendChild(lv); r.appendChild(top); r.appendChild(mid); r.appendChild(bar);
    // الشريط المصغّر
    var pill = el("button", "position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);z-index:2147483001;display:none;align-items:center;gap:8px;background:#2e7d5b;color:#fff;border:0;border-radius:22px;padding:9px 16px;font:700 13px system-ui;box-shadow:0 4px 18px rgba(0,0,0,.35);direction:rtl;cursor:pointer");
    pill.onclick = function () { minimize(false); };
    document.body.appendChild(r); document.body.appendChild(pill);
    ui = { root: r, rv: rv, ra: ra, lv: lv, topName: topName, minBtn: minBtn, mid: mid, av: av, nm: nm, st: st, sub: sub, bar: bar, pill: pill, min: false };
    return ui;
  }
  function minimize(on) {
    if (!ui.root) return; ui.min = !!on;
    ui.root.style.display = on ? "none" : "flex";
    ui.pill.style.display = on ? "flex" : "none";
    paintPill();
  }
  function paintPill() {
    if (!ui.pill || !cur) return;
    ui.pill.textContent = (cur.type === "video" ? "📹 " : "📞 ") + (cur.name || "") + " · " + statusText(cur) + "  ▴";
  }
  function statusText(c) {
    switch (c.state) {
      case "starting": return L("جارٍ التجهيز…", "Preparing…");
      case "calling": return L("جارٍ الاتّصال…", "Calling…");
      case "ringing": return L("يرنّ…", "Ringing…");
      case "incoming": return c.type === "video" ? L("مكالمة فيديو واردة", "Incoming video call") : L("مكالمة صوتيّة واردة", "Incoming voice call");
      case "connecting": return L("جارٍ الربط…", "Connecting…");
      case "reconnecting": return L("ضعف الشبكة — إعادة الاتّصال…", "Weak network — reconnecting…");
      case "connected": return fmt(Math.floor((Date.now() - c.connectedAt) / 1000));
      case "ended": return c.endText || L("انتهت المكالمة", "Call ended");
    }
    return "";
  }
  function show(c) {
    buildUi();
    ui.av.textContent = (c.name || "؟").charAt(0);
    ui.nm.textContent = c.name || ""; ui.topName.textContent = c.name || "";
    ui.rv.style.display = "none"; ui.lv.style.display = "none"; ui.sub.textContent = "";
    ui.rv.srcObject = null; ui.ra.srcObject = null; ui.lv.srcObject = null;
    minimize(false); paint(c);
  }
  function hide() { if (!ui.root) return; ui.root.style.display = "none"; ui.pill.style.display = "none"; ui.min = false;
    try { ui.rv.srcObject = null; ui.ra.srcObject = null; ui.lv.srcObject = null; } catch (e) {} }
  function paintStatus(c) {
    if (!ui.root || c !== cur && c.state !== "ended") return;
    ui.st.textContent = statusText(c);
    var vid = c.type === "video" && c.remoteVideo && (c.state === "connected" || c.state === "reconnecting");
    ui.rv.style.display = vid ? "block" : "none";
    ui.mid.style.visibility = vid && c.state === "connected" ? "hidden" : "visible";
    ui.topName.style.opacity = vid ? "1" : "0";
    if (vid && c.state === "connected") ui.topName.textContent = (c.name || "") + " · " + statusText(c);
    if (ui.min) paintPill();
  }
  function paint(c) {
    if (!ui.root) return;
    paintStatus(c);
    var bar = ui.bar; bar.innerHTML = "";
    ui.minBtn.style.visibility = c.state === "incoming" || c.state === "ended" ? "hidden" : "visible";
    if (c.state === "ended") return;
    if (c.state === "incoming") {
      // بالعربيّة (من اليمين): ردّ · بالصوت · رفض
      bar.appendChild(btn(c.type === "video" ? "📹" : "📞", L("ردّ", "Answer"), "#21a366", function () { accept(false); }));
      if (c.type === "video") bar.appendChild(btn("🎤", L("ردّ بالصوت", "Voice only"), "#3c6e5a", function () { accept(true); }));
      bar.appendChild(btn("✕", L("رفض", "Decline"), "#d64545", decline));
      return;
    }
    var mute = btn(c.muted ? "🔇" : "🎤", c.muted ? L("إلغاء الكتم", "Unmute") : L("كتم", "Mute"), c.muted ? "#e8f5ee" : "rgba(255,255,255,.16)", toggleMute);
    if (c.muted) mute._b.style.color = "#123";
    bar.appendChild(mute);
    if (c.type === "video" && c.hasCam) {
      bar.appendChild(btn(c.camOff ? "🚫" : "📷", c.camOff ? L("تشغيل الكاميرا", "Camera on") : L("الكاميرا", "Camera"), c.camOff ? "#e8f5ee" : "rgba(255,255,255,.16)", toggleCam));
      bar.appendChild(btn("🔄", L("تبديل", "Flip"), "rgba(255,255,255,.16)", switchCam));
    }
    if (c.state === "connected") bar.appendChild(btn("➕", L("إضافة", "Add"), "rgba(255,255,255,.16)", function () { pickPerson(cur); }));
    bar.appendChild(btn("📞", L("إنهاء", "End"), "#d64545", function () { hangup(); }));
    bar.lastChild._b.style.transform = "rotate(135deg)";
  }
  function attachLocal(c) {
    if (!ui.root || !c.local) return;
    var hasVid = c.local.getVideoTracks().length > 0;
    c.hasCam = hasVid;
    ui.lv.srcObject = hasVid ? c.local : null;
    ui.lv.style.display = hasVid && !c.camOff ? "block" : "none";
    ui.lv.style.transform = c.facing === "environment" ? "none" : "scaleX(-1)";
    if (hasVid) try { ui.lv.play().catch(function () {}); } catch (e) {}
  }
  function attachRemote(c) {
    if (!ui.root || !c.remote) return;
    ui.ra.srcObject = c.remote; try { ui.ra.play().catch(function () {}); } catch (e) {}
    c.remoteVideo = c.remote.getVideoTracks().some(function (t) { return t.readyState === "live"; });
    if (c.remoteVideo) { ui.rv.srcObject = c.remote; try { ui.rv.play().catch(function () {}); } catch (e) {} }
    paintStatus(c);
  }

  // ============================================================
  //  المكالمة
  // ============================================================
  function newCall(o) {
    o.timers = {}; o.offs = []; o.iceOut = []; o.iceIn = []; o.remoteSet = false;
    o.muted = false; o.camOff = false; o.facing = "user"; o.reN = 0; o.reSeen = 0;
    return o;
  }
  function setState(c, s) {
    c.state = s; paint(c);
    if (s === "connected" && !c.tick) c.tick = setInterval(function () { paintStatus(c); }, 1000);
  }
  function listen(c, ref, ev, fn, onErr) {
    var h = ref.on(ev, fn, onErr || function () {});
    c.offs.push(function () { try { ref.off(ev, h); } catch (e) {} });
  }
  function clearTimers(c) { for (var k in c.timers) { clearTimeout(c.timers[k]); } c.timers = {}; if (c.tick) clearInterval(c.tick); c.tick = null; }

  function makePc(c, ice) {
    var pc = new global.RTCPeerConnection({ iceServers: ice });
    var side = c.role === "caller" ? "ic_caller" : "ic_callee";
    pc.onicecandidate = function (e) {
      if (!e.candidate || !e.candidate.candidate) return;
      var j = iceJson(e.candidate);
      if (c.ref && c.live) c.ref.child(side).push(j).catch(function () {}); else c.iceOut.push(j);
    };
    pc.ontrack = function (e) {
      var s = e.streams && e.streams[0];
      if (!c.remote) c.remote = s || new global.MediaStream();
      if (!s || s !== c.remote) try { c.remote.addTrack(e.track); } catch (x) {}
      e.track.onunmute = function () { attachRemote(c); };
      e.track.onended = function () { attachRemote(c); };
      attachRemote(c);
    };
    pc.onconnectionstatechange = function () { onConn(c, pc.connectionState); };
    pc.oniceconnectionstatechange = function () {
      // متصفّحات لا تدعم connectionState (Safari قديم)
      if (pc.connectionState === undefined) {
        var m = { connected: "connected", completed: "connected", disconnected: "disconnected", failed: "failed", closed: "closed" };
        if (m[pc.iceConnectionState]) onConn(c, m[pc.iceConnectionState]);
      }
    };
    return pc;
  }
  function flushIceOut(c) {
    var side = c.role === "caller" ? "ic_caller" : "ic_callee";
    var q = c.iceOut; c.iceOut = [];
    q.forEach(function (j) { c.ref.child(side).push(j).catch(function () {}); });
  }
  function addRemoteIce(c, j) {
    if (!c.pc || !j || !j.candidate) return;
    if (!c.remoteSet) { c.iceIn.push(j); return; }
    c.pc.addIceCandidate(j).catch(function (e) { log("ice add", e && e.message); });
  }
  function flushIceIn(c) { c.remoteSet = true; var q = c.iceIn; c.iceIn = []; q.forEach(function (j) { addRemoteIce(c, j); }); }
  function addTracks(c) {
    c.local.getTracks().forEach(function (t) { c.pc.addTrack(t, c.local); });
  }
  function capVideo(c) {
    try {
      c.pc.getSenders().forEach(function (s) {
        if (!s.track || s.track.kind !== "video" || !s.getParameters) return;
        var p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = 600000; s.setParameters(p).catch(function () {});
      });
    } catch (e) {}
  }
  function routeInfo(c) {
    try {
      c.pc.getStats().then(function (rep) {
        var pair = null, cands = {};
        rep.forEach(function (r) {
          if (r.type === "transport" && r.selectedCandidatePairId) pair = rep.get(r.selectedCandidatePairId);
          if (r.type === "local-candidate" || r.type === "remote-candidate") cands[r.id] = r;
        });
        if (!pair) rep.forEach(function (r) { if (r.type === "candidate-pair" && r.state === "succeeded" && (r.selected || r.nominated)) pair = pair || r; });
        if (!pair) return;
        var lc = cands[pair.localCandidateId] || {}, rc = cands[pair.remoteCandidateId] || {};
        var relay = lc.candidateType === "relay" || rc.candidateType === "relay";
        c.route = relay ? "relay" : "direct";
        log("route", lc.candidateType, "→", rc.candidateType);
        if (ui.sub && c === cur) ui.sub.textContent = relay ? L("عبر خادم وسيط", "via relay") : L("اتّصال مباشر", "direct");
      }).catch(function () {});
    } catch (e) {}
  }
  function onConn(c, s) {
    if (c.done) return;
    if (s === "connected") {
      clearTimeout(c.timers.conn); clearTimeout(c.timers.lost); delete c.timers.lost;
      if (!c.connectedAt) { c.connectedAt = Date.now(); stopTone(); capVideo(c); wakeOn(); }
      setState(c, "connected"); setTimeout(function () { routeInfo(c); }, 800);
    } else if (s === "disconnected" || s === "failed") {
      if (!c.connectedAt) { if (s === "failed") finish(c, "failed"); return; }
      setState(c, "reconnecting");
      // المتّصل يعيد التفاوض (ICE restart) — يفيد عند تبدّل الشبكة (واي فاي ↔ بيانات)
      if (c.role === "caller" && (s === "failed" || !c.timers.restart)) c.timers.restart = setTimeout(function () { iceRestart(c); }, s === "failed" ? 0 : 3000);
      if (!c.timers.lost) c.timers.lost = setTimeout(function () { finish(c, "lost"); }, LOST_MS);
    }
  }
  function iceRestart(c) {
    delete c.timers.restart;
    if (c.done || !c.pc || c.role !== "caller" || c.state === "connected") return;
    var n = ++c.reN;
    c.pc.createOffer({ iceRestart: true }).then(function (o) { return c.pc.setLocalDescription(o).then(function () { return o; }); })
      .then(function (o) { return c.ref.update({ reoffer: { type: o.type, sdp: o.sdp, n: n } }); })
      .catch(function (e) { log("restart", e && e.message); });
  }

  // ---------- المتّصل ----------
  function startCall(peer, name, type) {
    if (!enabled() || !peer || peer === myUid()) return false;
    if (busy()) { if (cur && ui.min) minimize(false); else if (gc && gui.min) gMinimize(false); toast(L("أنت في مكالمة الآن", "You're already in a call")); return true; }
    type = type === "video" ? "video" : "audio";
    var me = myUid(), d = db();
    var c = cur = newCall({ id: "k" + Date.now().toString(36) + rid(7), role: "caller", peer: peer, name: name || nameOf(peer), type: type, state: "starting" });
    seen[c.id] = 1;
    show(c);
    Promise.all([getMedia(type), getIce()]).then(function (r) {
      if (c.done) { stopStream(r[0]); return; }
      c.local = r[0]; attachLocal(c); paint(c);
      c.pc = makePc(c, r[1]); addTracks(c);
      return c.pc.createOffer().then(function (o) { return c.pc.setLocalDescription(o).then(function () { return o; }); }).then(function (o) {
        if (c.done) return;
        c.ref = d.ref("calls/" + c.id);
        return c.ref.set({ from: me, to: peer, type: type, fromName: myName() || "", state: "ringing", ts: TS(), offer: sdpOf(o) });
      }).then(function () {
        if (c.done) { if (c.ref) c.ref.remove().catch(function () {}); return; }
        c.live = true;
        try { c.ref.onDisconnect().update({ state: "ended" }); } catch (e) {}
        c.inbox = d.ref("inbox/" + peer + "/" + c.id);
        c.inbox.set({ from: me, fromName: myName() || "", type: type, ts: TS() }).catch(function (e) { log("inbox", e && e.message); });
        try { c.inbox.onDisconnect().remove(); } catch (e) {}
        flushIceOut(c);
        listen(c, c.ref, "value", function (s) { onCallerValue(c, s.val()); }, function () { finish(c, "remote", { remote: true }); });
        listen(c, c.ref.child("ic_callee"), "child_added", function (s) { addRemoteIce(c, s.val()); });
        wcall("call.ring", { to: peer, callId: c.id, type: type }).catch(function (e) { log("ring", e && e.message); });
        setState(c, "ringing"); playTone("back");
        c.timers.ring = setTimeout(function () { if (!c.accepted) finish(c, "noanswer"); }, RING_MS);
      });
    }).catch(function (e) {
      log("start", e && (e.name || e.message), e && e.message);
      var m = mediaError(e);
      if (!m && e && /permission|denied/i.test(String(e.code || e.message))) m = L("لا يمكن الاتّصال بهذا الشخص — ليس في جهات اتّصالك بعد", "Can't call: not in your contacts yet");
      finish(c, "error", { text: m || L("تعذّر بدء المكالمة", "Couldn't start the call") });
    });
    return true;
  }
  function onCallerValue(c, v) {
    if (c.done) return;
    if (!v) { finish(c, "remote", { remote: true }); return; }
    if (v.up && !c.upSeen) { c.upSeen = true; c.silent = true; finish(c, "upgraded", { remote: true }); groupJoinDirect(v.up, c.type, null, c.upgrading ? "starter" : "joiner"); return; }
    if (v.acc && !c.accepted) {
      c.accepted = true; clearTimeout(c.timers.ring); stopTone();
      setState(c, "connecting");
      if (c.inbox) c.inbox.remove().catch(function () {});
      c.timers.conn = setTimeout(function () { if (!c.connectedAt) finish(c, "failed"); }, CONNECT_MS + 15000);
    }
    if (v.answer && !c.answerSet && c.pc) {
      c.answerSet = true;   // الحدث يتكرّر (مرشّحو ICE يغيّرون السجلّ) — طبّق الردّ مرّةً واحدة
      c.pc.setRemoteDescription(v.answer).then(function () { flushIceIn(c); }).catch(function (e) { log("answer", e && e.message); finish(c, "failed"); });
    }
    if (v.reanswer && v.reanswer.n === c.reN && c.reSeen !== c.reN && c.pc) {
      c.reSeen = c.reN;
      c.pc.setRemoteDescription({ type: v.reanswer.type, sdp: v.reanswer.sdp })
        .then(function () { if (c.pc.connectionState === "connected") onConn(c, "connected"); })
        .catch(function (e) { log("reanswer", e && e.message); });
    }
    if (v.state === "declined") finish(c, "declined", { remote: true });
    else if (v.state === "busy") finish(c, "busy", { remote: true });
    else if (v.state === "ended" || v.state === "missed") finish(c, "remote", { remote: true });
  }

  // ---------- المستقبِل ----------
  function watchInbox(uid) {
    var d = db(); if (!d || inboxUid === uid) return;
    try { if (inboxRef) inboxRef.off(); } catch (e) {}
    inboxUid = uid; inboxRef = d.ref("inbox/" + uid);
    try {
      if (!offsetRef) { offsetRef = d.ref(".info/serverTimeOffset"); offsetRef.on("value", function (s) { srvOffset = s.val() || 0; }); }
    } catch (e) {}
    inboxRef.on("child_added", function (s) {
      var v = s.val() || {}, id = s.key;
      if (!v.ts || now() - v.ts > STALE_MS) { s.ref.remove().catch(function () {}); return; }
      if (v.gid) groupIncoming(id, v); else incoming(id);
    }, function (e) { log("inbox listen", e && e.code); });
  }
  function incoming(id) {
    var me = myUid(), d = db();
    if (!me || !d || !id || seen[id]) return;
    seen[id] = 1;
    var ref = d.ref("calls/" + id), inbox = d.ref("inbox/" + me + "/" + id);
    ref.once("value").then(function (snap) {
      var v = snap.val();
      if (!v || v.to !== me || v.state !== "ringing" || v.acc || (v.ts && now() - v.ts > STALE_MS)) { inbox.remove().catch(function () {}); return; }
      // المحظور: لا رنين ولا سجلّ — ويبقى عنده «يرنّ» حتّى ينتهي الوقت (لا نكشف الحظر)
      try { if (C().isBlocked && C().isBlocked(v.from)) { inbox.remove().catch(function () {}); return; } } catch (e) {}
      var name = nameOf(v.from) || v.fromName || "";
      if (busy()) {   // مشغول بمكالمة أخرى
        ref.update({ state: "busy" }).catch(function () {}); inbox.remove().catch(function () {});
        addLog({ id: "call-" + id, name: name, peerUid: v.from, callType: v.type === "video" ? "video" : "audio", type: "missed", time: L("الآن", "Now"), duration: null, timestamp: Date.now(), participants: null, cloud: true });
        return;
      }
      var c = cur = newCall({ id: id, role: "callee", peer: v.from, name: name, type: v.type === "video" ? "video" : "audio", state: "incoming", ref: ref, inbox: inbox, offer: v.offer });
      c.live = true;
      show(c); playTone("ring");
      listen(c, ref, "value", function (s) { onCalleeValue(c, s.val()); }, function () { finish(c, "remote", { remote: true }); });
      c.timers.ring = setTimeout(function () { if (c.state === "incoming") finish(c, "missed", { remote: true }); }, RING_MS + 5000);
      getIce();   // تجهيزٌ مسبق
    }).catch(function (e) { log("incoming", e && e.message); inbox.remove().catch(function () {}); });
  }
  function onCalleeValue(c, v) {
    if (c.done) return;
    if (!v) { finish(c, c.connectedAt ? "remote" : "missed", { remote: true }); return; }
    if (v.acc && v.acc !== devId) { c.silent = true; finish(c, "elsewhere", { remote: true }); return; }   // ردّ جهازٌ آخر لي
    if (v.up && !c.upSeen && c.connectedAt) { c.upSeen = true; c.silent = true; finish(c, "upgraded", { remote: true }); groupJoinDirect(v.up, c.type, null, c.upgrading ? "starter" : "joiner"); return; }
    if (v.reoffer && v.reoffer.n > c.reSeen && c.pc && c.remoteSet) {
      var n = v.reoffer.n; c.reSeen = n;
      c.pc.setRemoteDescription({ type: v.reoffer.type, sdp: v.reoffer.sdp })
        .then(function () { return c.pc.createAnswer(); })
        .then(function (a) { return c.pc.setLocalDescription(a).then(function () { return a; }); })
        .then(function (a) { return c.ref.update({ reanswer: { type: a.type, sdp: a.sdp, n: n } }); })
        .catch(function (e) { log("reoffer", e && e.message); });
    }
    if (v.state === "ended" || v.state === "missed") finish(c, c.connectedAt ? "remote" : "missed", { remote: true });
  }
  function accept(audioOnly) {
    var c = cur; if (!c || c.role !== "callee" || c.state !== "incoming") return;
    stopTone(); clearTimeout(c.timers.ring);
    setState(c, "connecting");
    var mediaType = audioOnly ? "audio" : c.type;
    // أوّل جهازٍ يردّ يفوز (لو فتحت سوا على هاتفين)
    c.ref.child("acc").transaction(function (v) { return v ? undefined : devId; }).then(function (r) {
      if (c.done) return;
      if (!r.committed || r.snapshot.val() !== devId) { c.silent = true; finish(c, "elsewhere", { remote: true }); return; }
      if (c.inbox) c.inbox.remove().catch(function () {});
      return Promise.all([getMedia(mediaType), getIce()]).then(function (res) {
        if (c.done) { stopStream(res[0]); return; }
        c.local = res[0]; attachLocal(c); paint(c);
        c.pc = makePc(c, res[1]);
        listen(c, c.ref.child("ic_caller"), "child_added", function (s) { addRemoteIce(c, s.val()); });
        return c.pc.setRemoteDescription(c.offer).then(function () {
          flushIceIn(c); addTracks(c);
          return c.pc.createAnswer();
        }).then(function (a) { return c.pc.setLocalDescription(a).then(function () { return a; }); }).then(function (a) {
          try { c.ref.onDisconnect().update({ state: "ended" }); } catch (e) {}
          flushIceOut(c);
          c.timers.conn = setTimeout(function () { if (!c.connectedAt) finish(c, "failed"); }, CONNECT_MS);
          return c.ref.update({ answer: sdpOf(a), state: "accepted" });
        });
      });
    }).catch(function (e) {
      log("accept", e && (e.name || e.message), e && e.message);
      finish(c, "error", { text: mediaError(e) || L("تعذّر الردّ على المكالمة", "Couldn't answer the call") });
    });
  }
  function decline() {
    var c = cur; if (!c || c.role !== "callee" || c.state !== "incoming") return;
    c.declined = true;
    c.ref.update({ state: "declined" }).catch(function () {});
    finish(c, "declinedByMe", { remote: true });
  }

  // ---------- أثناء المكالمة ----------
  function toggleMute() {
    var c = cur; if (!c || !c.local) return;
    c.muted = !c.muted; c.local.getAudioTracks().forEach(function (t) { t.enabled = !c.muted; }); paint(c);
  }
  function toggleCam() {
    var c = cur; if (!c || !c.local) return;
    c.camOff = !c.camOff; c.local.getVideoTracks().forEach(function (t) { t.enabled = !c.camOff; });
    attachLocal(c); paint(c);
  }
  function switchCam() {
    var c = cur; if (!c || !c.local || !c.pc || c.switching) return;
    var want = c.facing === "user" ? "environment" : "user";
    c.switching = true;
    var old = c.local.getVideoTracks()[0];
    try { if (old) old.stop(); } catch (e) {}   // بعض الهواتف لا تفتح الكاميرتين معاً
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: want }, width: { ideal: 640 }, height: { ideal: 480 } } })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: { facingMode: want } }); })
      .then(function (s) {
        var nt = s.getVideoTracks()[0]; if (!nt) throw new Error("no track");
        nt.enabled = !c.camOff;
        var snd = c.pc.getSenders().filter(function (x) { return x.track === old || (x.track && x.track.kind === "video"); })[0]
          || c.pc.getSenders().filter(function (x) { return !x.track; })[0];
        if (old) c.local.removeTrack(old);
        c.local.addTrack(nt); c.facing = want;
        attachLocal(c);
        return snd ? snd.replaceTrack(nt) : null;
      })
      .catch(function (e) { log("switch", e && e.message); toast(L("تعذّر تبديل الكاميرا", "Couldn't switch camera")); })
      .then(function () { c.switching = false; });
  }
  function hangup() {
    var c = cur; if (!c) return;
    finish(c, c.role === "caller" && !c.accepted ? "cancel" : "hangup");
  }

  var END_TEXT = {
    declined: ["رُفضت المكالمة", "Call declined"], busy: ["مشغولٌ بمكالمة أخرى", "Busy on another call"],
    noanswer: ["لم يُجب", "No answer"], failed: ["تعذّر الربط — الشبكة لا تسمح بالاتّصال المباشر", "Couldn't connect (network)"],
    lost: ["انقطع الاتّصال", "Connection lost"], missed: ["مكالمة فائتة", "Missed call"], elsewhere: ["رُدّ عليها من جهازٍ آخر", "Answered on another device"]
  };
  function finish(c, reason, opts) {
    if (!c || c.done) return;
    opts = opts || {}; c.done = true;
    clearTimers(c); stopTone(); wakeOff();
    c.offs.forEach(function (f) { f(); }); c.offs = [];
    // أخبر الطرف الآخر
    if (c.ref && c.live && !opts.remote) {
      var st = reason === "noanswer" ? "missed" : "ended";
      c.ref.update({ state: st }).catch(function () {});
    }
    if (c.ref && c.live) {
      try { c.ref.onDisconnect().cancel(); } catch (e) {}
      // المتّصل ينظّف السجلّ بعد أن يرى الطرف الآخر الحالة الأخيرة
      if (c.role === "caller") { var ref = c.ref; setTimeout(function () { ref.remove().catch(function () {}); }, 4000); }
    }
    if (c.inbox && (c.role === "caller" || c.state === "incoming")) { c.inbox.remove().catch(function () {}); try { c.inbox.onDisconnect().cancel(); } catch (e) {} }
    // فائتة: إشعارٌ للطرف الآخر (لو كان التطبيق مغلقاً يرى «مكالمة فائتة» مكان «مكالمة واردة»)
    if (c.role === "caller" && !c.accepted && c.live && (reason === "noanswer" || reason === "cancel")) {
      wcall("call.missed", { to: c.peer, callId: c.id, type: c.type }).catch(function () {});
    }
    stopStream(c.local);
    try { if (c.pc) c.pc.close(); } catch (e) {}
    logCall(c);
    if (cur === c) cur = null;
    var tx = opts.text || (END_TEXT[reason] && L(END_TEXT[reason][0], END_TEXT[reason][1])) || (c.connectedAt ? L("انتهت المكالمة", "Call ended") + " · " + fmt(Math.max(1, Math.round((Date.now() - c.connectedAt) / 1000))) : L("انتهت المكالمة", "Call ended"));
    log("end", c.id, reason);
    if (c.silent || reason === "declinedByMe") { hide(); return; }
    if (c.connectedAt || c.role === "caller") endTone();
    c.endText = tx; c.state = "ended";
    if (ui.root) { if (ui.min) minimize(false); paint(c); ui.rv.style.display = "none"; ui.lv.style.display = "none"; ui.mid.style.visibility = "visible"; ui.st.textContent = tx; ui.sub.textContent = ""; }
    setTimeout(function () { if (!cur) hide(); }, opts.text ? 3200 : 1800);
  }

  // ============================================================
  //  C7: المكالمات الجماعيّة — شبكةٌ مباشرة بين الأجهزة (≤ ٤ فيديو / ≤ ٨ صوت حتّى SFU)
  //  gcalls/{gid} = { by, type, title, cid, ts, approval, allow{uid}, members{uid:{name,sess,ts}},
  //                   sig/{to}/{push}:{from,fs,tsn,t,sdp|cand}, req{uid}, adm{uid} }
  //  الـWorker وحده ينشئها ويحدّد allow (gcall.start / gcall.add). الوافد الجديد يرسل العروض لمن سبقه (لا تصادم).
  //  sess: رقم الجلسة — رسائلُ جلسةٍ قديمة (خروج ثمّ عودة) تُتجاهل.
  // ============================================================
  var GC_MAX = { video: 4, audio: 8 }, ALONE_MS = global.__sawaRtcAloneMs || 60000;
  var gc = null, gui = { root: null };
  function busy() { return !!(cur || gc); }

  function gcNew(o) {
    o.peers = {}; o.members = {}; o.offs = []; o.timers = {}; o.sess = rid(8); o.muted = false; o.camOff = false; o.facing = "user";
    o.met = {}; o.reqs = {};
    return o;
  }
  function gListen(g, ref, ev, fn) { var h = ref.on(ev, fn, function () {}); g.offs.push(function () { try { ref.off(ev, h); } catch (e) {} }); }
  function gName(g, uid) { return (g.members[uid] && g.members[uid].name) || nameOf(uid) || L("عضو", "Member"); }

  // ---------- البدء ----------
  // opts: { cid } من مجموعة/عائلة · { to:[uid…], quiet:[uid] } من جهات الاتّصال · { sched: id } موعدٌ مجدول
  function groupStart(opts, type, title) {
    if (!enabled()) return false;
    // ترنّ عندي مكالمة هذه المحادثة نفسها ⇒ «انضمام» = ردّ
    if (gc && gc.state === "incoming" && opts.cid && gc.cid === opts.cid) { groupAccept(); return true; }
    if (busy()) { if (gc && gui.min) gMinimize(false); else if (cur && ui.min) minimize(false); toast(L("أنت في مكالمة الآن", "You're already in a call")); return true; }
    type = type === "video" ? "video" : "audio";
    var g = gc = gcNew({ gid: null, type: type, title: title || "", state: "starting", role: "starter" });
    gShow(g);
    var p = { type: type };
    if (opts.cid) p.cid = opts.cid; else if (opts.sched) p.sched = opts.sched; else { p.to = opts.to; if (opts.quiet) p.quiet = opts.quiet; }
    wcall("gcall.start", p).then(function (r) {
      if (g.done) return;
      g.gid = r.gid; g.type = r.type || type; g.title = r.title || g.title; g.cid = r.cid || null; g.by = r.by; g.approval = !!r.approval;
      if (r.joined) g.role = "joiner";
      seen[g.gid] = 1;
      gJoin(g);
    }).catch(function (e) {
      log("gcall.start", e && e.message);
      gFinish(g, "error", { text: /not a contact/.test(String(e && e.message)) ? L("ليسوا كلّهم في جهات اتّصالك", "Not all are your contacts") : L("تعذّر بدء المكالمة", "Couldn't start the call") });
    });
    return true;
  }
  // الانضمام مباشرةً (ترقية مكالمة ثنائيّة إلى جماعيّة — لا رنين)
  function groupJoinDirect(gid, type, by, role) {
    if (gc) return;
    var g = gc = gcNew({ gid: gid, type: type, title: "", state: "starting", role: role || "joiner", by: by });
    seen[gid] = 1; gShow(g); gJoin(g);
  }

  // ---------- الرنين ----------
  function groupIncoming(gid, v) {
    var me = myUid(), d = db();
    if (!me || !d || !gid || seen[gid]) return;
    seen[gid] = 1; v = v || {};
    var inbox = d.ref("inbox/" + me + "/" + gid), ref = d.ref("gcalls/" + gid);
    ref.once("value").then(function (snap) {
      var n = snap.val();
      // بلا أعضاء: إمّا انتهت، أو أنشأها الخادم للتوّ والمتّصل لم يدخل بعد (أقلّ من دقيقة)
      var empty = !n || !n.members || !Object.keys(n.members).length;
      if (!n || !n.allow || !n.allow[me] || (n.members && n.members[me]) || (empty && now() - (n.ts || 0) > 60000) || (n.ts && now() - n.ts > 6 * 3600000)) { inbox.remove().catch(function () {}); return; }
      try { if (C().isBlocked && v.from && C().isBlocked(v.from)) { inbox.remove().catch(function () {}); return; } } catch (e) {}
      var title = n.title || "", from = v.from || n.by;
      if (busy()) {
        inbox.remove().catch(function () {});
        addLog({ id: "gcall-" + gid, name: title || nameOf(from) || L("مكالمة جماعيّة", "Group call"), callType: n.type, type: "missed", time: L("الآن", "Now"), duration: null, timestamp: Date.now(), participants: null, cloud: true, cid: n.cid || null });
        return;
      }
      var g = gc = gcNew({ gid: gid, type: n.type === "video" ? "video" : "audio", title: title, cid: n.cid || null, by: n.by, approval: !!n.approval,
                           state: "incoming", role: "incoming", from: from, fromName: nameOf(from) || v.fromName || "", inbox: inbox, ref: ref });
      g.members = n.members || {};
      gShow(g); playTone("ring");
      var saw = !empty;
      gListen(g, ref.child("members"), "value", function (s) {
        if (g.done || g.state !== "incoming") return;
        g.members = s.val() || {};
        if (Object.keys(g.members).length) { saw = true; gPaint(g); }
        else if (saw) gFinish(g, "missed");   // غادر الجميع قبل أن أردّ
      });
      g.timers.empty = setTimeout(function () { if (g.state === "incoming" && !saw) gFinish(g, "missed"); }, 25000);
      g.timers.ring = setTimeout(function () { if (g.state === "incoming") gFinish(g, "missed"); }, RING_MS + 5000);
      getIce();
    }).catch(function () { inbox.remove().catch(function () {}); });
  }
  function groupAccept() {
    var g = gc; if (!g || g.state !== "incoming") return;
    stopTone(); clearTimeout(g.timers.ring);
    if (g.inbox) g.inbox.remove().catch(function () {});
    g.offs.forEach(function (f) { f(); }); g.offs = [];
    g.role = "joiner"; g.state = "starting"; gPaint(g);
    gJoin(g);
  }
  function groupDecline() {
    var g = gc; if (!g || g.state !== "incoming") return;
    g.declined = true; gFinish(g, "declined");
  }

  // ---------- الانضمام ----------
  function gJoin(g) {
    var me = myUid(), d = db();
    g.ref = d.ref("gcalls/" + g.gid);
    Promise.all([getMedia(g.type), getIce(), g.ref.once("value")]).then(function (r) {
      if (g.done) { stopStream(r[0]); return; }
      g.local = r[0]; g.ice = r[1];
      var n = r[2].val();
      if (!n || !n.allow || !n.allow[me]) { gFinish(g, "error", { text: L("انتهت هذه المكالمة", "This call has ended") }); return; }
      g.by = n.by; g.approval = !!n.approval; g.title = n.title || g.title; g.cid = n.cid || g.cid || null; g.type = n.type === "video" ? "video" : "audio";
      g.allow = n.allow;
      var others = Object.keys(n.members || {}).filter(function (u) { return u !== me; });
      if (others.length + 1 > GC_MAX[g.type]) { gFinish(g, "full"); return; }
      gLocalTile(g);
      if (g.approval && g.by !== me && !(n.adm && n.adm[me] === true)) { gWait(g); return; }
      gEnter(g);
    }).catch(function (e) {
      log("gjoin", e && (e.name || e.message), e && e.message);
      gFinish(g, "error", { text: mediaError(e) || L("تعذّر الانضمام للمكالمة", "Couldn't join the call") });
    });
  }
  // غرفة الانتظار: المضيف يوافق (adm/{uid} = true) أو يرفض (false)
  function gWait(g) {
    var me = myUid();
    g.state = "waiting"; gPaint(g);
    g.ref.child("req/" + me).set({ name: myName() || "", ts: TS() }).catch(function (e) { log("req", e && e.message); });
    try { g.ref.child("req/" + me).onDisconnect().remove(); } catch (e) {}
    var h = function (s) {
      var v = s.val();
      if (g.done || g.state !== "waiting") return;
      if (v === true) { g.ref.child("adm/" + me).off("value", h); g.ref.child("req/" + me).remove().catch(function () {}); gEnter(g); }
      else if (v === false) gFinish(g, "rejected");
    };
    g.ref.child("adm/" + me).on("value", h, function () {});
    g.offs.push(function () { try { g.ref.child("adm/" + me).off("value", h); } catch (e) {} });
    g.timers.wait = setTimeout(function () { if (g.state === "waiting") gFinish(g, "error", { text: L("لم يوافق المضيف بعد — حاول لاحقاً", "The host hasn't let you in yet") }); }, 5 * 60000);
  }
  function gEnter(g) {
    var me = myUid();
    g.state = "joining"; gPaint(g);
    var mine = g.ref.child("sig/" + me);
    mine.remove().catch(function () {}).then(function () {
      if (g.done) return;
      return g.ref.child("members/" + me).set({ name: myName() || "", sess: g.sess, ts: TS() });
    }).then(function () {
      if (g.done) return;
      g.live = true;
      try { g.ref.child("members/" + me).onDisconnect().remove(); mine.onDisconnect().remove(); } catch (e) {}
      g.joinedAt = Date.now(); g.state = "live"; wakeOn(); gPaint(g);
      if (!g.tick) g.tick = setInterval(function () { gPaintHead(g); }, 1000);
      if (g.role === "starter") playTone("back");   // نغمة «يرنّ» حتّى ينضمّ أوّل شخص
      var first = true;
      gListen(g, mine, "child_added", function (s) { onGSig(g, s.val() || {}); });
      gListen(g, g.ref.child("members"), "value", function (s) {
        var m = s.val() || {};
        if (first) {   // من سبقني (وقت دخولٍ أقدم بحسب الخادم): أرسل لهم العروض؛ ومن يأتي بعدي يرسل هو
          first = false;
          var mt = m[me] && m[me].ts;
          Object.keys(m).forEach(function (u) {
            if (u === me || !m[u] || !m[u].sess) return;
            if (!mt || m[u].ts < mt || (m[u].ts === mt && u < me)) gOffer(g, u, m[u].sess);
          });
        }
        onGMembers(g, m);
      });
      if (g.by === me && g.approval) gListen(g, g.ref.child("req"), "value", function (s) { g.reqs = s.val() || {}; gPaintReqs(g); });
      gListen(g, g.ref.child("allow"), "value", function (s) { g.allow = s.val() || g.allow; });
    }).catch(function (e) {
      log("genter", e && e.message);
      gFinish(g, "error", { text: L("تعذّر الانضمام للمكالمة", "Couldn't join the call") });
    });
  }
  function onGMembers(g, m) {
    if (g.done) return;
    var me = myUid();
    g.members = m;
    Object.keys(g.peers).forEach(function (u) {
      var p = g.peers[u];
      if (!m[u] || m[u].sess !== p.sess) gDrop(g, u);
    });
    Object.keys(m).forEach(function (u) {
      if (u === me) return;
      g.met[u] = gName(g, u);
      // احتياط: عضوٌ لم يصلني منه عرضٌ خلال ٦ ثوانٍ ⇒ أعرض أنا (والتصادم يحسمه onGSig)
      if (!g.peers[u] && m[u] && m[u].sess && !(g.timers["o" + u])) g.timers["o" + u] = setTimeout(function () {
        delete g.timers["o" + u];
        if (!g.done && !g.peers[u] && g.members[u] && g.members[u].sess === m[u].sess) gOffer(g, u, m[u].sess);
      }, 6000);
    });
    var others = Object.keys(m).filter(function (u) { return u !== me; });
    // وحدك: انتظر قليلاً ثمّ أنهِ (لا يبقى أحدٌ في مكالمةٍ فارغة)
    if (!others.length) { if (!g.timers.alone) g.timers.alone = setTimeout(function () { gFinish(g, Object.keys(g.met).length ? "everyoneLeft" : "nobody"); }, ALONE_MS); }
    else { clearTimeout(g.timers.alone); delete g.timers.alone; stopTone(); }
    gPaint(g);
  }
  function gSend(g, to, toSess, payload) {
    var o = { from: myUid(), fs: g.sess, tsn: toSess, ts: TS() };
    for (var k in payload) o[k] = payload[k];
    return g.ref.child("sig/" + to).push(o).catch(function (e) { log("gsig", e && e.message); });
  }
  function gPeer(g, uid, sess, offerer) {
    var me = myUid();
    var p = { uid: uid, sess: sess, offerer: offerer, iceIn: [], remoteSet: false, state: "connecting", stream: null };
    var pc = p.pc = new global.RTCPeerConnection({ iceServers: g.ice || STUN });
    g.local.getTracks().forEach(function (t) { pc.addTrack(t, g.local); });
    pc.onicecandidate = function (e) { if (e.candidate && e.candidate.candidate) gSend(g, uid, sess, { t: "ice", cand: iceJson(e.candidate) }); };
    pc.ontrack = function (e) {
      if (!p.stream) p.stream = (e.streams && e.streams[0]) || new global.MediaStream();
      if (p.stream.getTracks().indexOf(e.track) < 0) try { p.stream.addTrack(e.track); } catch (x) {}
      e.track.onunmute = function () { gTile(g, uid); };
      gTile(g, uid);
    };
    pc.onconnectionstatechange = function () {
      var s = pc.connectionState;
      if (g.done || g.peers[uid] !== p) return;
      if (s === "connected") {
        p.state = "connected"; p.everConnected = true; clearTimeout(p.lost); p.lost = null;
        gCap(g); stopTone(); gTile(g, uid); gPaintHead(g);
      } else if (s === "disconnected" || s === "failed") {
        p.state = "reconnecting"; gTile(g, uid);
        if (p.offerer) setTimeout(function () { if (g.peers[uid] === p && p.state !== "connected") gRenegotiate(g, p, true); }, s === "failed" ? 0 : 3000);
        if (!p.lost) p.lost = setTimeout(function () { if (g.peers[uid] === p && p.state !== "connected") { p.state = "lost"; gTile(g, uid); } }, LOST_MS);
      }
    };
    g.peers[uid] = p;
    gTile(g, uid);
    return p;
  }
  function gOffer(g, uid, sess) {
    var p = gPeer(g, uid, sess, true);
    gRenegotiate(g, p, false);
  }
  function gRenegotiate(g, p, restart) {
    if (g.done || !p.pc) return;
    p.pc.createOffer(restart ? { iceRestart: true } : undefined)
      .then(function (o) { return p.pc.setLocalDescription(o).then(function () { return o; }); })
      .then(function (o) { gSend(g, p.uid, p.sess, { t: "offer", sdp: o.sdp }); })
      .catch(function (e) { log("goffer", e && e.message); });
  }
  function gFlush(p) { p.remoteSet = true; var q = p.iceIn; p.iceIn = []; q.forEach(function (c) { p.pc.addIceCandidate(c).catch(function () {}); }); }
  function onGSig(g, msg) {
    if (g.done || msg.tsn !== g.sess || !msg.from) return;
    var u = msg.from, p = g.peers[u];
    if (msg.t === "offer") {
      if (p && p.sess !== msg.fs) { gDrop(g, u); p = null; }
      // تصادم عرضين: الأصغر معرّفاً «مهذّب» يتراجع ويقبل عرض الآخر، والأكبر يتجاهله
      if (p && p.pc.signalingState === "have-local-offer") { if (myUid() < u) { gDrop(g, u); p = null; } else return; }
      if (!p) p = gPeer(g, u, msg.fs, false);
      p.pc.setRemoteDescription({ type: "offer", sdp: msg.sdp })
        .then(function () { gFlush(p); return p.pc.createAnswer(); })
        .then(function (a) { return p.pc.setLocalDescription(a).then(function () { return a; }); })
        .then(function (a) { gSend(g, u, p.sess, { t: "answer", sdp: a.sdp }); })
        .catch(function (e) { log("ganswer", e && e.message); });
    } else if (msg.t === "answer") {
      if (!p || p.sess !== msg.fs || p.pc.signalingState !== "have-local-offer") return;
      p.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp }).then(function () { gFlush(p); }).catch(function (e) { log("gans", e && e.message); });
    } else if (msg.t === "ice") {
      if (!p || p.sess !== msg.fs || !msg.cand) return;
      if (!p.remoteSet) p.iceIn.push(msg.cand); else p.pc.addIceCandidate(msg.cand).catch(function () {});
    }
  }
  function gDrop(g, uid) {
    var p = g.peers[uid]; if (!p) return;
    try { p.pc.close(); } catch (e) {}
    clearTimeout(p.lost);
    delete g.peers[uid];
    gTile(g, uid);
  }
  // سقف الفيديو يتوزّع: كلّ جهازٍ يرسل نسخةً لكلّ مشارك
  function gCap(g) {
    var n = Object.keys(g.peers).length, br = n <= 1 ? 600000 : n === 2 ? 450000 : 320000;
    Object.keys(g.peers).forEach(function (u) {
      try {
        g.peers[u].pc.getSenders().forEach(function (s) {
          if (!s.track || s.track.kind !== "video" || !s.getParameters) return;
          var pr = s.getParameters(); if (!pr.encodings || !pr.encodings.length) pr.encodings = [{}];
          pr.encodings[0].maxBitrate = br; s.setParameters(pr).catch(function () {});
        });
      } catch (e) {}
    });
  }

  // ---------- أثناء المكالمة ----------
  function gToggleMute() { var g = gc; if (!g || !g.local) return; g.muted = !g.muted; g.local.getAudioTracks().forEach(function (t) { t.enabled = !g.muted; }); gPaint(g); }
  function gToggleCam() { var g = gc; if (!g || !g.local) return; g.camOff = !g.camOff; g.local.getVideoTracks().forEach(function (t) { t.enabled = !g.camOff; }); gLocalTile(g); gPaint(g); }
  function gSwitchCam() {
    var g = gc; if (!g || !g.local || g.switching) return;
    var want = g.facing === "user" ? "environment" : "user", old = g.local.getVideoTracks()[0];
    g.switching = true;
    try { if (old) old.stop(); } catch (e) {}
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: want }, width: { ideal: 640 }, height: { ideal: 480 } } })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ video: { facingMode: want } }); })
      .then(function (s) {
        var nt = s.getVideoTracks()[0]; if (!nt) throw new Error("no track");
        nt.enabled = !g.camOff;
        if (old) g.local.removeTrack(old);
        g.local.addTrack(nt); g.facing = want; gLocalTile(g);
        return Promise.all(Object.keys(g.peers).map(function (u) {
          var snd = g.peers[u].pc.getSenders().filter(function (x) { return x.track === old || (x.track && x.track.kind === "video"); })[0];
          return snd ? snd.replaceTrack(nt) : null;
        }));
      })
      .catch(function (e) { log("gswitch", e && e.message); toast(L("تعذّر تبديل الكاميرا", "Couldn't switch camera")); })
      .then(function () { g.switching = false; });
  }
  function gAdmit(uid, yes) {
    var g = gc; if (!g || g.by !== myUid()) return;
    g.ref.child("adm/" + uid).set(!!yes).catch(function () {});
    g.ref.child("req/" + uid).remove().catch(function () {});
  }
  // إضافة شخص: من جهات اتّصالي أو من أعضاء المحادثة
  function gAdd(uid, name) {
    var g = gc; if (!g || !g.gid) return;
    var n = Object.keys(g.members).length;
    if (n >= GC_MAX[g.type]) { toast(L("المكالمة ممتلئة", "The call is full")); return; }
    wcall("gcall.add", { gid: g.gid, to: [uid] }).then(function () { toast(L("جارٍ الاتّصال بـ", "Calling ") + (name || "")); })
      .catch(function (e) { log("gadd", e && e.message); toast(L("تعذّرت الإضافة", "Couldn't add")); });
  }
  // ترقية مكالمةٍ ثنائيّة إلى جماعيّة: Worker ينشئ المكالمة ويرنّ للجديد، والطرف الآخر ينتقل تلقائيّاً
  function upgrade(c, uid, name) {
    if (!c || c.done || c.state !== "connected" || c.upgrading) return;
    c.upgrading = true; toast(L("جارٍ الاتّصال بـ", "Calling ") + (name || ""));
    wcall("gcall.start", { to: [c.peer, uid], quiet: [c.peer], type: c.type }).then(function (r) {
      if (c.done) return;
      return c.ref.update({ up: r.gid }).then(function () {
        c.silent = true; finish(c, "upgraded", { remote: true });
        groupJoinDirect(r.gid, r.type || c.type, r.by, "starter");
      });
    }).catch(function (e) { c.upgrading = false; log("upgrade", e && e.message); toast(L("تعذّرت الإضافة", "Couldn't add")); });
  }

  // ---------- النهاية ----------
  var G_END = {
    missed: ["مكالمة جماعيّة فائتة", "Missed group call"], full: ["المكالمة ممتلئة (الحدّ ٤ فيديو / ٨ صوت حاليّاً)", "The call is full"],
    rejected: ["لم يوافق المضيف على انضمامك", "The host declined your request"], nobody: ["لم ينضمّ أحد", "Nobody joined"],
    everyoneLeft: ["غادر الجميع", "Everyone left"]
  };
  function gFinish(g, reason, opts) {
    if (!g || g.done) return;
    opts = opts || {}; g.done = true;
    var me = myUid();
    for (var k in g.timers) clearTimeout(g.timers[k]); g.timers = {};
    if (g.tick) clearInterval(g.tick); g.tick = null;
    stopTone(); wakeOff();
    g.offs.forEach(function (f) { f(); }); g.offs = [];
    if (g.inbox && (g.state === "incoming" || reason === "missed")) g.inbox.remove().catch(function () {});
    Object.keys(g.peers).forEach(function (u) { try { g.peers[u].pc.close(); } catch (e) {} });
    stopStream(g.local);
    if (g.ref && me) {
      try { g.ref.child("members/" + me).onDisconnect().cancel(); g.ref.child("sig/" + me).onDisconnect().cancel(); g.ref.child("req/" + me).onDisconnect().cancel(); } catch (e) {}
      if (g.state === "waiting") g.ref.child("req/" + me).remove().catch(function () {});
      if (g.live) {
        var ref = g.ref, cid = g.cid, gid = g.gid;
        ref.child("members/" + me).remove().then(function () { return ref.child("sig/" + me).remove(); }).then(function () {
          return ref.child("members").once("value");
        }).then(function (s) {
          if (s.val()) return;
          // آخر من يغادر ينظّف المكالمة ومؤشّرها في المحادثة
          ref.remove().catch(function () {});
          if (cid) db().ref("gcur/" + cid).once("value").then(function (x) { var v = x.val(); if (v && v.gid === gid) x.ref.remove().catch(function () {}); }).catch(function () {});
        }).catch(function () {});
      }
    }
    // السجلّ
    if (!g.silentLog && g.gid) {
      var secs = g.joinedAt && g.live ? Math.max(1, Math.round((Date.now() - g.joinedAt) / 1000)) : 0;
      var names = Object.keys(g.met).map(function (u) { return g.met[u]; });
      var type = g.role === "starter" ? "outgoing" : (g.live ? "incoming" : (g.declined ? "incoming" : "missed"));
      if (!(g.role === "starter" && !g.live && reason === "error"))
        addLog({ id: "gcall-" + g.gid + "-" + g.sess, name: g.title || names.join("، ") || g.fromName || L("مكالمة جماعيّة", "Group call"), callType: g.type,
                 type: type, time: L("الآن", "Now"), duration: secs ? fmt(secs) : null, timestamp: Date.now(), participants: names.length ? names : null, cloud: true, cid: g.cid || null, gid: g.gid });
    }
    if (gc === g) gc = null;
    log("gend", g.gid, reason);
    if (reason === "declined") { gHide(); return; }
    if (g.live) endTone();
    var tx = opts.text || (G_END[reason] && L(G_END[reason][0], G_END[reason][1])) || L("غادرت المكالمة", "You left the call");
    g.endText = tx; g.state = "ended";
    if (gui.root) { if (gui.min) gMinimize(false); gPaint(g); }
    setTimeout(function () { if (!gc) gHide(); }, opts.text ? 3200 : 1800);
  }
  function groupLeave() { if (gc) gFinish(gc, "left"); }

  // ---------- الواجهة ----------
  function gBuild() {
    if (gui.root) return gui;
    var r = el("div", "position:fixed;inset:0;z-index:2147483000;background:linear-gradient(160deg,#10324a,#071320);color:#fff;display:none;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;direction:rtl;overflow:hidden;user-select:none;-webkit-user-select:none");
    r.id = "sawa-gcall";
    var top = el("div", "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 10px");
    var hd = el("div", "min-width:0");
    var title = el("div", "font:800 17px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    var sub = el("div", "font:600 12px system-ui;color:#a9c6dc;margin-top:2px");
    hd.appendChild(title); hd.appendChild(sub);
    var minBtn = el("button", "background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:18px;padding:7px 12px;font:600 12px system-ui;cursor:pointer;flex-shrink:0", L("تصغير ▾", "Minimize ▾"));
    minBtn.onclick = function () { gMinimize(true); };
    top.appendChild(hd); top.appendChild(minBtn);
    var reqs = el("div", "display:flex;flex-direction:column;gap:6px;padding:0 12px");
    var grid = el("div", "flex:1;min-height:0;display:grid;gap:8px;padding:8px 12px;align-content:center");
    var center = el("div", "flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:0 20px");
    var av = el("div", "width:104px;height:104px;border-radius:50%;background:#2d6a9a;display:flex;align-items:center;justify-content:center;font:800 40px system-ui;box-shadow:0 0 0 10px rgba(45,106,154,.25)");
    var cName = el("div", "font:800 22px system-ui"), cSt = el("div", "font:600 14px system-ui;color:#bcd6ea"), cWho = el("div", "font:500 12px system-ui;color:#8fb0c8");
    center.appendChild(av); center.appendChild(cName); center.appendChild(cSt); center.appendChild(cWho);
    var bar = el("div", "display:flex;justify-content:space-evenly;align-items:flex-start;padding:14px 8px calc(env(safe-area-inset-bottom,0px) + 22px);background:linear-gradient(transparent,rgba(0,0,0,.5))");
    var audios = el("div", "display:none");
    r.appendChild(top); r.appendChild(reqs); r.appendChild(grid); r.appendChild(center); r.appendChild(bar); r.appendChild(audios);
    var pill = el("button", "position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);z-index:2147483001;display:none;align-items:center;gap:8px;background:#2d6a9a;color:#fff;border:0;border-radius:22px;padding:9px 16px;font:700 13px system-ui;box-shadow:0 4px 18px rgba(0,0,0,.35);direction:rtl;cursor:pointer");
    pill.onclick = function () { gMinimize(false); };
    document.body.appendChild(r); document.body.appendChild(pill);
    gui = { root: r, title: title, sub: sub, minBtn: minBtn, reqs: reqs, grid: grid, center: center, av: av, cName: cName, cSt: cSt, cWho: cWho, bar: bar, audios: audios, pill: pill, tiles: {}, min: false };
    return gui;
  }
  function gShow(g) {
    gBuild();
    gui.grid.innerHTML = ""; gui.audios.innerHTML = ""; gui.reqs.innerHTML = ""; gui.tiles = {};
    gMinimize(false); gPaint(g);
  }
  function gHide() { if (!gui.root) return; gui.root.style.display = "none"; gui.pill.style.display = "none"; gui.min = false; gui.grid.innerHTML = ""; gui.audios.innerHTML = ""; gui.tiles = {}; }
  function gMinimize(on) {
    if (!gui.root) return; gui.min = !!on;
    gui.root.style.display = on ? "none" : "flex"; gui.pill.style.display = on ? "flex" : "none";
    gPaintHead(gc);
  }
  function gCount(g) { return Object.keys(g.members || {}).length; }
  function gStatus(g) {
    switch (g.state) {
      case "starting": return L("جارٍ التجهيز…", "Preparing…");
      case "incoming": return g.type === "video" ? L("مكالمة فيديو جماعيّة واردة", "Incoming group video call") : L("مكالمة صوتيّة جماعيّة واردة", "Incoming group voice call");
      case "waiting": return L("بانتظار موافقة المضيف…", "Waiting for the host…");
      case "joining": return L("جارٍ الانضمام…", "Joining…");
      case "live": return (gCount(g) <= 1 ? L("بانتظار الآخرين…", "Waiting for others…") : gCount(g) + " " + L("مشاركين", "people")) + " · " + fmt(Math.floor((Date.now() - g.joinedAt) / 1000));
      case "ended": return g.endText || "";
    }
    return "";
  }
  function gPaintHead(g) {
    if (!g || !gui.root) return;
    gui.title.textContent = g.title || (g.type === "video" ? L("مكالمة فيديو جماعيّة", "Group video call") : L("مكالمة جماعيّة", "Group call"));
    gui.sub.textContent = gStatus(g);
    if (gui.min) gui.pill.textContent = "👥 " + (g.title || "") + " · " + gStatus(g) + "  ▴";
  }
  function gPaint(g) {
    if (!gui.root || !g) return;
    gPaintHead(g);
    var centerMode = g.state === "incoming" || g.state === "waiting" || g.state === "starting" || g.state === "ended";
    gui.center.style.display = centerMode ? "flex" : "none";
    gui.grid.style.display = centerMode ? "none" : "grid";
    gui.minBtn.style.visibility = g.state === "incoming" || g.state === "ended" ? "hidden" : "visible";
    if (centerMode) {
      gui.av.textContent = (g.title || g.fromName || "👥").charAt(0);
      gui.cName.textContent = g.title || g.fromName || L("مكالمة جماعيّة", "Group call");
      gui.cSt.textContent = gStatus(g);
      var who = Object.keys(g.members || {}).map(function (u) { return gName(g, u); });
      gui.cWho.textContent = g.state === "incoming" ? ((g.fromName ? g.fromName + " " + L("يدعوك", "invites you") : "") + (who.length ? " · " + L("في المكالمة: ", "In call: ") + who.slice(0, 4).join("، ") + (who.length > 4 ? "…" : "") : "")) : "";
    } else gLayout(g);
    var bar = gui.bar; bar.innerHTML = "";
    if (g.state === "ended") return;
    if (g.state === "incoming") {
      bar.appendChild(btn(g.type === "video" ? "📹" : "📞", L("انضمام", "Join"), "#21a366", groupAccept));
      bar.appendChild(btn("✕", L("رفض", "Decline"), "#d64545", groupDecline));
      return;
    }
    if (g.local) {
      var mute = btn(g.muted ? "🔇" : "🎤", g.muted ? L("إلغاء الكتم", "Unmute") : L("كتم", "Mute"), g.muted ? "#e8f5ee" : "rgba(255,255,255,.16)", gToggleMute);
      if (g.muted) mute._b.style.color = "#123";
      bar.appendChild(mute);
      if (g.type === "video" && g.local.getVideoTracks().length) {
        bar.appendChild(btn(g.camOff ? "🚫" : "📷", g.camOff ? L("تشغيل الكاميرا", "Camera on") : L("الكاميرا", "Camera"), g.camOff ? "#e8f5ee" : "rgba(255,255,255,.16)", gToggleCam));
        bar.appendChild(btn("🔄", L("تبديل", "Flip"), "rgba(255,255,255,.16)", gSwitchCam));
      }
    }
    if (g.state === "live") bar.appendChild(btn("➕", L("إضافة", "Add"), "rgba(255,255,255,.16)", function () { pickPerson(g); }));
    bar.appendChild(btn("📞", g.state === "waiting" ? L("إلغاء", "Cancel") : L("مغادرة", "Leave"), "#d64545", groupLeave));
    bar.lastChild._b.style.transform = "rotate(135deg)";
  }
  function gPaintReqs(g) {
    if (!gui.root) return;
    gui.reqs.innerHTML = "";
    Object.keys(g.reqs || {}).forEach(function (u) {
      var row = el("div", "display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);border-radius:14px;padding:8px 10px");
      row.appendChild(el("span", "flex:1;font:700 13px system-ui", ((g.reqs[u] && g.reqs[u].name) || nameOf(u) || L("عضو", "Member")) + " " + L("يطلب الانضمام", "wants to join")));
      var ok = el("button", "background:#21a366;color:#fff;border:0;border-radius:10px;padding:6px 10px;font:700 12px system-ui", L("قبول", "Admit"));
      var no = el("button", "background:#d64545;color:#fff;border:0;border-radius:10px;padding:6px 10px;font:700 12px system-ui", L("رفض", "Deny"));
      ok.onclick = function () { gAdmit(u, true); }; no.onclick = function () { gAdmit(u, false); };
      row.appendChild(ok); row.appendChild(no); gui.reqs.appendChild(row);
    });
  }
  function gTileEl(uid) {
    var t = gui.tiles[uid];
    if (t) return t;
    var box = el("div", "position:relative;border-radius:16px;overflow:hidden;background:#13283a;min-height:0;display:flex;align-items:center;justify-content:center");
    var v = el("video", "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none");
    v.autoplay = true; v.playsInline = true; v.muted = true; v.setAttribute("playsinline", "");
    var av = el("div", "width:64px;height:64px;border-radius:50%;background:#2d6a9a;display:flex;align-items:center;justify-content:center;font:800 26px system-ui");
    var lab = el("div", "position:absolute;bottom:6px;right:8px;left:8px;font:700 12px system-ui;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    box.appendChild(v); box.appendChild(av); box.appendChild(lab);
    var a = el("audio", ""); a.autoplay = true;
    gui.audios.appendChild(a);
    t = gui.tiles[uid] = { box: box, v: v, av: av, lab: lab, a: a };
    return t;
  }
  function gLocalTile(g) {
    if (!gui.root || !g.local) return;
    var t = gTileEl("__me");
    var hasV = g.type === "video" && g.local.getVideoTracks().length > 0 && !g.camOff;
    t.v.srcObject = hasV ? g.local : null; t.v.style.display = hasV ? "block" : "none"; t.v.style.transform = g.facing === "environment" ? "none" : "scaleX(-1)";
    if (hasV) try { t.v.play().catch(function () {}); } catch (e) {}
    t.av.textContent = (myName() || "أ").charAt(0); t.av.style.display = hasV ? "none" : "flex";
    t.lab.textContent = L("أنت", "You") + (g.muted ? " · 🔇" : "");
    gLayout(g);
  }
  function gTile(g, uid) {
    if (!gui.root || !g || g.done) return;
    var p = g.peers[uid], inCall = g.members && g.members[uid];
    if (!p && !inCall) {   // غادر
      var old = gui.tiles[uid];
      if (old) { try { old.v.srcObject = null; old.a.srcObject = null; old.box.remove(); old.a.remove(); } catch (e) {} delete gui.tiles[uid]; }
      gLayout(g); return;
    }
    var t = gTileEl(uid);
    var st = p && p.stream, hasV = !!(st && st.getVideoTracks().some(function (x) { return x.readyState === "live" && !x.muted; }));
    if (st && t.a.srcObject !== st) { t.a.srcObject = st; try { t.a.play().catch(function () {}); } catch (e) {} }
    if (hasV && t.v.srcObject !== st) { t.v.srcObject = st; try { t.v.play().catch(function () {}); } catch (e) {} }
    t.v.style.display = hasV ? "block" : "none"; t.av.style.display = hasV ? "none" : "flex";
    t.av.textContent = gName(g, uid).charAt(0);
    var state = !p ? L("ينضمّ…", "joining…") : p.state === "connected" ? "" : p.state === "lost" ? L("انقطع", "lost") : p.state === "reconnecting" ? L("الشبكة ضعيفة…", "weak network…") : L("جارٍ الربط…", "connecting…");
    t.lab.textContent = gName(g, uid) + (state ? " · " + state : "");
    gLayout(g);
  }
  function gLayout(g) {
    if (!gui.root || !g) return;
    var me = myUid();
    var ids = ["__me"].concat(Object.keys(g.members || {}).filter(function (u) { return u !== me; }));
    ids = ids.filter(function (u) { return gui.tiles[u] || u === "__me"; });
    var n = ids.length, cols = n <= 1 ? 1 : n <= 4 ? (n === 2 ? 1 : 2) : 3, rows = Math.ceil(n / cols);
    gui.grid.style.gridTemplateColumns = "repeat(" + cols + ",1fr)";
    gui.grid.style.gridTemplateRows = "repeat(" + rows + "," + (g.type === "video" ? "1fr" : "minmax(0,150px)") + ")";
    ids.forEach(function (u) { var t = gui.tiles[u]; if (t && t.box.parentNode !== gui.grid) gui.grid.appendChild(t.box); });
  }
  // اختيار شخص: جهات الاتّصال (+ أعضاء المحادثة) ممّن ليسوا في المكالمة
  function pickPerson(target) {
    var me = myUid(), inCall = {};
    if (target === cur && cur) inCall[cur.peer] = 1;
    else if (gc) Object.keys(gc.members || {}).forEach(function (u) { inCall[u] = 1; });
    var list = [];
    try { list = C().contacts().filter(function (c) { return c.uid && c.uid !== me && !inCall[c.uid]; }); } catch (e) {}
    var ov = el("div", "position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:system-ui");
    var box = el("div", "background:#1b2633;color:#fff;border-radius:20px;width:min(92vw,380px);max-height:70vh;display:flex;flex-direction:column;overflow:hidden");
    box.appendChild(el("div", "padding:16px 16px 4px;font:800 15px system-ui;text-align:center", L("إضافة شخص للمكالمة", "Add someone to the call")));
    box.appendChild(el("div", "padding:0 16px 10px;font:500 11px system-ui;color:#9fb3c6;text-align:center", L("يُضاف دون قطع المكالمة", "They'll join without ending the call")));
    var sc = el("div", "flex:1;overflow-y:auto;padding:0 10px");
    if (!list.length) sc.appendChild(el("div", "padding:20px;text-align:center;color:#8aa0b4;font:600 12px system-ui", L("لا أحد آخر في جهات اتّصالك", "No other contacts")));
    list.forEach(function (c) {
      var b = el("button", "width:100%;display:flex;align-items:center;gap:10px;padding:10px 6px;background:transparent;border:0;color:#fff;font:700 13px system-ui;text-align:right;cursor:pointer");
      var a = el("span", "width:34px;height:34px;border-radius:50%;background:#2d6a9a;display:flex;align-items:center;justify-content:center;font:800 14px system-ui;flex-shrink:0", (c.name || "؟").charAt(0));
      b.appendChild(a); b.appendChild(el("span", "flex:1", c.name || ""));
      if (c.online) b.appendChild(el("span", "width:8px;height:8px;border-radius:50%;background:#22c55e"));
      b.onclick = function () { ov.remove(); if (target === cur) upgrade(cur, c.uid, c.name); else gAdd(c.uid, c.name); };
      sc.appendChild(b);
    });
    box.appendChild(sc);
    var cancel = el("button", "margin:10px 14px 14px;padding:10px;border:0;border-radius:12px;background:#2a3644;color:#e2e8f0;font:700 13px system-ui", L("إلغاء", "Cancel"));
    cancel.onclick = function () { ov.remove(); };
    box.appendChild(cancel); ov.appendChild(box);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }

  // ---------- مكالمةٌ جارية في محادثة جماعيّة (شريط «انضمام») ----------
  function watchChat(cid, cb) {
    var d = db(); if (!d || !cid || !/^(fam_|grp_)/.test(cid)) return function () {};
    var ref = d.ref("gcur/" + cid), memRef = null, memH = null, last = null, closed = false;
    function emit(v) { var j = JSON.stringify(v); if (j === last || closed) return; last = j; try { cb(v); } catch (e) {} }
    function stopMem() { if (memRef && memH) try { memRef.off("value", memH); } catch (e) {} memRef = null; memH = null; }
    var h = ref.on("value", function (s) {
      var v = s.val(); stopMem();
      if (!v || !v.gid) { emit(null); return; }
      emit({ gid: v.gid, type: v.type, n: null });
      memRef = d.ref("gcalls/" + v.gid + "/members");
      memH = memRef.on("value", function (m) {
        var mm = m.val() || {}, n = Object.keys(mm).length;
        emit(n ? { gid: v.gid, type: v.type, n: n, inCall: !!mm[myUid()] } : null);
      }, function () { /* لستُ في قائمة المدعوّين بعد — يبقى الشريط، والانضمام عبر الخادم */ });
    }, function () { emit(null); });
    return function () { closed = true; stopMem(); try { ref.off("value", h); } catch (e) {} };
  }

  // ============================================================
  //  C7: المكالمات المجدولة — محفوظة في الخادم (scheds)، تذكيرٌ حقيقيّ بإشعار من الـWorker (Cron)
  // ============================================================
  var schedItems = [], schedAt = 0, schedBusy = false;
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(ts) { var d = new Date(ts); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function ymd(ts) { var d = new Date(ts); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function schedShape(s) {
    var me = myUid(), mine = s.by === me;
    return { id: s.id, cloud: true, mine: mine, by: s.by, cid: s.cid || null, users: s.users || [],
             contactName: mine ? (s.toName || s.title || L("مكالمة مجدولة", "Scheduled call")) : (s.byName || nameOf(s.by) || L("مكالمة مجدولة", "Scheduled call")),
             description: s.title || "", date: ymd(s.at), startTime: hhmm(s.at), endTime: hhmm(s.end || s.at + 1800000),
             callType: s.type === "video" ? "video" : "audio", requireApproval: !!s.approval, reminderMinutes: s.remind || 15, timestamp: s.at };
  }
  function publishSched() { if (app && app.setScheduledCalls) try { app.setScheduledCalls(schedItems.map(schedShape)); } catch (e) {} }
  function schedRefresh(force) {
    if (!myUid() || schedBusy || (!force && Date.now() - schedAt < 60000)) return Promise.resolve(schedItems);
    schedBusy = true;
    return wcall("sched.list", {}).then(function (b) { schedItems = (b && b.items) || []; schedAt = Date.now(); publishSched(); return schedItems; })
      .catch(function (e) { log("sched.list", e && e.message); return schedItems; })
      .then(function (r) { schedBusy = false; return r; });
  }
  // entry من شاشة الجدولة: { contactName, peerUid | cid, description, timestamp, endTime, callType, requireApproval, reminderMinutes }
  function schedSave(entry) {
    if (!enabled()) return Promise.reject(new Error("offline"));
    var end = entry.timestamp + 30 * 60000;
    try { var p = String(entry.endTime || "").split(":"); if (p.length === 2) { var d = new Date(entry.timestamp); d.setHours(+p[0], +p[1], 0, 0); if (d.getTime() <= entry.timestamp) d.setDate(d.getDate() + 1); end = d.getTime(); } } catch (e) {}
    var pl = { title: entry.description || "", type: entry.callType, at: entry.timestamp, end: end, remind: entry.reminderMinutes, approval: !!entry.requireApproval, toName: entry.contactName || "" };
    if (entry.cid) pl.cid = entry.cid; else pl.to = [entry.peerUid];
    return wcall("sched.set", pl).then(function (b) { if (b && b.item) { schedItems = schedItems.filter(function (x) { return x.id !== b.item.id; }).concat([b.item]); publishSched(); } return b; });
  }
  function schedRemove(id) {
    schedItems = schedItems.filter(function (x) { return x.id !== id; }); publishSched();
    return wcall("sched.delete", { id: id }).catch(function (e) { log("sched.delete", e && e.message); schedRefresh(true); });
  }
  function schedStart(entry) {
    if (!entry || !entry.cloud || !enabled()) return false;
    return groupStart({ sched: entry.id }, entry.callType, entry.description || entry.contactName);
  }

  // ---------- من الإشعار ----------
  function handleCallParam() {
    var id = null;
    try { id = new URLSearchParams(global.location.search).get("call"); } catch (e) {}
    if (!id) return;
    try { var u = new URL(global.location.href); u.searchParams.delete("call"); global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (e) {}
    whenUid(function () { setTimeout(function () { if (/^[gs]/.test(id)) groupIncoming(id); else incoming(id); }, 300); });
  }
  try {
    if (global.navigator && navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", function (ev) {
      var m = ev.data || {};
      if ((m.type === "sawa-open" || m.type === "sawa-push") && m.data && m.data.t === "call" && m.data.call)
        whenUid(function () { if (m.data.gid) groupIncoming(m.data.gid, { from: m.data.from, fromName: m.data.fromName }); else incoming(m.data.call); });
      if (m.type === "sawa-push" && m.data && m.data.t === "sched") schedRefresh(true);
    });
  } catch (e) {}

  // ---------- الإقلاع ----------
  var uidWaiters = [], lastUid = null;
  function whenUid(f) { if (myUid() && db()) f(); else uidWaiters.push(f); }
  function boot() {
    handleCallParam();
    setInterval(function () {
      var u = myUid();
      if (u && u !== lastUid && db()) {
        lastUid = u; watchInbox(u); schedRefresh(true);
        var w = uidWaiters; uidWaiters = []; w.forEach(function (f) { try { f(); } catch (e) {} });
      }
    }, 700);
  }

  global.SawaRTC = {
    version: VERSION, supported: supported, enabled: enabled, bindApp: bindApp,
    call: startCall, accept: accept, decline: decline, hangup: hangup,
    active: function () { return cur ? { id: cur.id, peer: cur.peer, name: cur.name, type: cur.type, state: cur.state, role: cur.role, route: cur.route || null } : null; },
    _cur: function () { return cur; }, _incoming: incoming, _dev: devId,
    _restart: function () { if (cur && cur.pc) { cur.state = "reconnecting"; iceRestart(cur); } },
    // C7: الجماعيّة
    groupCall: function (cid, type) { return groupStart({ cid: cid }, type); },
    groupWith: function (uids, type, title) { return groupStart({ to: uids }, type, title); },
    groupAccept: groupAccept, groupDecline: groupDecline, groupLeave: groupLeave, admit: gAdmit, addToGroup: gAdd, watchChat: watchChat,
    group: function () { var g = gc; return g ? { gid: g.gid, type: g.type, state: g.state, role: g.role, title: g.title, members: Object.keys(g.members || {}),
      peers: Object.keys(g.peers).map(function (u) { return { uid: u, state: g.peers[u].state }; }) } : null; },
    // C7: المجدولة
    schedRefresh: schedRefresh, schedSave: schedSave, schedRemove: schedRemove, schedStart: schedStart,
    _gc: function () { return gc; }, _pick: pickPerson, _gIncoming: groupIncoming
  };
  try { document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") schedRefresh(false); }); } catch (e) {}
  if (global.document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
