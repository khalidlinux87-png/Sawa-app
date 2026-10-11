/* ============================================================
   sawa-rtc.js — المكالمات الصوتيّة والمرئيّة 1:1 (C6 في CHAT.md)
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
  var VERSION = "c6";
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
    if (cur) { if (ui.min) minimize(false); toast(L("أنت في مكالمة الآن", "You're already in a call")); return true; }
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
      incoming(id);
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
      if (cur) {   // مشغول بمكالمة أخرى
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

  // ---------- من الإشعار ----------
  function handleCallParam() {
    var id = null;
    try { id = new URLSearchParams(global.location.search).get("call"); } catch (e) {}
    if (!id) return;
    try { var u = new URL(global.location.href); u.searchParams.delete("call"); global.history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash); } catch (e) {}
    whenUid(function () { setTimeout(function () { incoming(id); }, 300); });
  }
  try {
    if (global.navigator && navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", function (ev) {
      var m = ev.data || {};
      if ((m.type === "sawa-open" || m.type === "sawa-push") && m.data && m.data.t === "call" && m.data.call) whenUid(function () { incoming(m.data.call); });
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
        lastUid = u; watchInbox(u);
        var w = uidWaiters; uidWaiters = []; w.forEach(function (f) { try { f(); } catch (e) {} });
      }
    }, 700);
  }

  global.SawaRTC = {
    version: VERSION, supported: supported, enabled: enabled, bindApp: bindApp,
    call: startCall, accept: accept, decline: decline, hangup: hangup,
    active: function () { return cur ? { id: cur.id, peer: cur.peer, name: cur.name, type: cur.type, state: cur.state, role: cur.role, route: cur.route || null } : null; },
    _cur: function () { return cur; }, _incoming: incoming, _dev: devId,
    _restart: function () { if (cur && cur.pc) { cur.state = "reconnecting"; iceRestart(cur); } }
  };
  if (global.document && document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
