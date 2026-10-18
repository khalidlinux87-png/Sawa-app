const QR_SCAN_CONTACT_POOL = ["مريم أحمد", "الطيب عثمان", "هدى الفاتح", "يوسف كمال", "رانيا الصادق"];
function CallOverlay({ contactName, callType, onEnd, requireApproval = false, availableContacts = [] }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [status, setStatus] = useState(requireApproval ? "waitingApproval" : "ringing"); // waitingApproval | ringing | connected | ending
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const [speakerOn, setSpeakerOn] = useState(false);
    const [camOff, setCamOff] = useState(false);
    const [frontCam, setFrontCam] = useState(true);
    // مشاركون إضافيون: {name, state: "ringing"|"connected"}
    const [extras, setExtras] = useState([]);
    const [showAddPeople, setShowAddPeople] = useState(false);
    function addPerson(name) {
        if (extras.some((e) => e.name === name) || name === contactName) {
            showToast(name + " موجود بالمكالمة أصلاً", "info");
            return;
        }
        setExtras((p) => [...p, { name, state: "ringing" }]);
        showToast(t("jar_alatsal_b", { name }), "success");
        // محاكاة الرد — بمنتج حقيقي هذا إشعار يستقبله الطرف الآخر
        setTimeout(() => {
            setExtras((p) => p.map((e) => e.name === name ? { ...e, state: "connected" } : e));
        }, 2600);
    }
    function removePerson(name) {
        setExtras((p) => p.filter((e) => e.name !== name));
        showToast(t("akhrj", { name }), "info");
    }
    const isGroupCall = extras.length > 0;
    useEffect(() => {
        if (status === "waitingApproval") {
            // محاكاة موافقة الطرف الآخر — بمنتج حقيقي هذا إشعار يستقبله الطرف
            // الآخر فعلياً وينقر "قبول"، هنا نحاكيه بتأخير واقعي
            const approveTimer = setTimeout(() => setStatus("ringing"), 2500);
            return () => clearTimeout(approveTimer);
        }
        if (status === "ringing") {
            const connectTimer = setTimeout(() => setStatus("connected"), 2000);
            return () => clearTimeout(connectTimer);
        }
    }, [status]);
    useEffect(() => {
        if (status !== "connected")
            return;
        const interval = setInterval(() => setDuration((d) => d + 1), 1000);
        return () => clearInterval(interval);
    }, [status]);
    function formatDuration(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, "0");
        const s = (sec % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }
    function handleEnd() {
        const wasConnected = status === "connected";
        setStatus("ending");
        setTimeout(() => onEnd(duration, wasConnected, extras), 260);
    }
    const bgByStatus = {
        waitingApproval: `linear-gradient(160deg, #241a32, #0E1116 65%)`,
        ringing: `linear-gradient(160deg, #1a2332, #0E1116 65%)`,
        connected: `linear-gradient(160deg, #14171c, #0E1116 70%)`,
        ending: `linear-gradient(160deg, #2a1418, #0E1116 70%)`,
    };
    return (React.createElement("div", { className: "absolute inset-0 z-50 flex flex-col items-center justify-between py-10", style: { background: bgByStatus[status], transition: "background 0.4s ease" } },
        React.createElement("div", { className: "flex flex-col items-center" },
            React.createElement("div", { className: "w-24 h-24 rounded-full flex items-center justify-center mb-4", style: { backgroundColor: colors.primaryLight } },
                React.createElement(User, { size: 40, color: colors.primaryDark })),
            React.createElement("h2", { className: "text-lg font-extrabold text-white" }, isGroupCall ? "مكالمة جماعية" : contactName),
            React.createElement("p", { className: "text-sm mt-1", style: { color: "#8A93A0" } }, isGroupCall
                ? (extras.length + 1) + " مشاركين · " + (callType === "video" ? "فيديو" : "صوتية")
                : (callType === "video" ? "مكالمة فيديو مشفّرة" : "مكالمة صوتية مشفّرة")),
            React.createElement("p", { className: "text-xs mt-2", style: { color: "#5AA9E6" } }, status === "waitingApproval" ? "بانتظار موافقة الطرف الآخر…" : status === "ringing" ? "يتصل…" : status === "ending" ? "جارٍ الإنهاء…" : formatDuration(duration)),
            isGroupCall && (React.createElement("div", { className: `flex ${rowStart()} flex-wrap justify-center gap-2 mt-4 px-4` }, [{ name: contactName, state: "connected" }, ...extras].map((p) => (React.createElement("div", { key: p.name, className: `flex ${rowStart()} items-center gap-1.5 px-2.5 py-1.5 rounded-full`, style: { backgroundColor: "#262B33" } },
                React.createElement("span", { className: "w-1.5 h-1.5 rounded-full", style: { backgroundColor: p.state === "connected" ? "#22C55E" : "#F59E0B" } }),
                React.createElement("span", { className: "text-[11px] font-bold text-white" }, p.name),
                React.createElement("span", { className: "text-[9px]", style: { color: "#8A93A0" } }, p.state === "connected" ? "" : "يرن…"),
                p.name !== contactName && (React.createElement("button", { onClick: () => removePerson(p.name), "aria-label": "إخراج " + p.name },
                    React.createElement(X, { size: 11, color: "#8A93A0" }))))))))),
        callType === "video" && status === "connected" && (React.createElement("div", { className: "w-full flex-1 mx-6 rounded-2xl flex items-center justify-center relative overflow-hidden", style: { backgroundColor: "#171B21" } }, camOff ? (React.createElement("div", { className: "flex flex-col items-center gap-2" },
            React.createElement(VideoOff, { size: 36, color: "#8A93A0" }),
            React.createElement("span", { className: "text-[11px] font-bold", style: { color: "#8A93A0" } }, t("alkamyra_mwqwfa")))) : (React.createElement(React.Fragment, null,
            React.createElement(Video, { size: 40, color: "#8A93A0" }),
            React.createElement("button", { onClick: () => setFrontCam((v) => !v), className: `absolute top-3 left-3 px-2.5 py-1.5 rounded-xl flex ${rowStart()} items-center gap-1.5`, style: { backgroundColor: "#00000088" }, "aria-label": t("tbdyl_alkamyra") },
                React.createElement(RotateCcw, { size: 13, color: "#fff" }),
                React.createElement("span", { className: "text-[10px] font-bold text-white" }, frontCam ? "أمامية" : "خلفية")))))),
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-6` },
            React.createElement("button", { "aria-label": t("ktm"), onClick: () => setMuted(!muted), className: "w-14 h-14 rounded-full flex items-center justify-center", style: { backgroundColor: muted ? colors.primary : "#262B33" } },
                React.createElement(MicOff, { size: 20, color: "#fff" })),
            React.createElement("button", { "aria-label": t("inha_almkalma"), onClick: handleEnd, className: "w-16 h-16 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger } },
                React.createElement(PhoneOff, { size: 24, color: "#fff" })),
            React.createElement("button", { onClick: () => setSpeakerOn(!speakerOn), className: "w-14 h-14 rounded-full flex items-center justify-center", style: { backgroundColor: speakerOn ? colors.primary : "#262B33" }, "aria-label": t("mkbr_alswt") },
                React.createElement(Volume2, { size: 20, color: "#fff" })),
            callType === "video" && (React.createElement("button", { onClick: () => setCamOff(!camOff), className: "w-14 h-14 rounded-full flex items-center justify-center", style: { backgroundColor: camOff ? colors.primary : "#262B33" }, "aria-label": camOff ? "تشغيل الكاميرا" : "إيقاف الكاميرا" }, camOff ? React.createElement(VideoOff, { size: 20, color: "#fff" }) : React.createElement(Video, { size: 20, color: "#fff" }))),
            status === "connected" && availableContacts.length > 0 && (React.createElement("button", { onClick: () => setShowAddPeople(true), className: "w-14 h-14 rounded-full flex items-center justify-center", style: { backgroundColor: "#262B33" }, "aria-label": t("idafa_shkhs_llmkalma") },
                React.createElement(UserPlus, { size: 20, color: "#fff" })))),
        showAddPeople && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setShowAddPeople(false), style: { position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.6)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 16, right: 16, top: "18%", bottom: "18%", zIndex: 51, backgroundColor: "#1B2028", borderRadius: 20, border: "1px solid #2C333D", display: "flex", flexDirection: "column" } },
                React.createElement("div", { className: "px-4 pt-4 pb-2 shrink-0" },
                    React.createElement("p", { className: "text-white font-extrabold text-sm text-center" }, t("idafa_shkhs_llmkalma")),
                    React.createElement("p", { className: "text-[11px] text-center mt-1", style: { color: "#8A93A0" } }, t("sydaf_llmkalma_alhalya_dwn"))),
                React.createElement("div", { className: "flex-1 overflow-y-auto px-3", style: { minHeight: 0 } },
                    availableContacts
                        .filter((n) => n !== contactName && !extras.some((e) => e.name === n))
                        .map((n) => (React.createElement("button", { key: n, onClick: () => { addPerson(n); setShowAddPeople(false); }, className: `w-full flex ${rowStart()} items-center gap-3 px-2 py-2.5 rounded-xl mb-1` },
                        React.createElement("div", { className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primaryLight } },
                            React.createElement(User, { size: 17, color: colors.primaryDark })),
                        React.createElement("span", { className: `flex-1 ${textStart()} text-xs font-bold text-white truncate` }, n),
                        React.createElement(UserPlus, { size: 15, color: "#8A93A0" })))),
                    availableContacts.filter((n) => n !== contactName && !extras.some((e) => e.name === n)).length === 0 && (React.createElement("p", { className: "text-xs text-center mt-6", style: { color: "#5A6472" } }, t("kl_jhat_atsalk_balmkalma")))),
                React.createElement("div", { className: "p-4 shrink-0", style: { borderTop: "1px solid #2C333D" } },
                    React.createElement("button", { onClick: () => setShowAddPeople(false), className: "w-full py-2.5 rounded-xl text-xs font-bold", style: { backgroundColor: "#262B33", color: "#e2e8f0" } }, t("ilgha"))))))));
}
function GroupCallOverlay({ groupName, members, callType, onEnd }) {
    var _a;
    const { colors } = useTheme();
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const [speakerOn, setSpeakerOn] = useState(false);
    const [joinedIds, setJoinedIds] = useState([(_a = members[0]) === null || _a === void 0 ? void 0 : _a.id]);
    useEffect(() => {
        const timers = members.slice(1).map((m, i) => setTimeout(() => setJoinedIds((prev) => [...prev, m.id]), (i + 1) * 900));
        return () => timers.forEach(clearTimeout);
    }, []);
    useEffect(() => {
        const interval = setInterval(() => setDuration((d) => d + 1), 1000);
        return () => clearInterval(interval);
    }, []);
    function formatDuration(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, "0");
        const s = (sec % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }
    return (React.createElement("div", { className: "absolute inset-0 z-50 flex flex-col items-center justify-between py-10", style: { backgroundColor: "#0E1116" } },
        React.createElement("div", { className: "flex flex-col items-center" },
            React.createElement("h2", { className: "text-lg font-extrabold text-white" }, groupName),
            React.createElement("p", { className: "text-sm mt-1", style: { color: "#8A93A0" } },
                callType === "video" ? "مكالمة فيديو جماعية" : "مكالمة صوتية جماعية",
                " \u00B7 ",
                joinedIds.length,
                "/",
                members.length),
            React.createElement("p", { className: "text-xs mt-2", style: { color: "#5AA9E6" } }, formatDuration(duration))),
        React.createElement("div", { className: "w-full flex-1 mx-6 grid grid-cols-2 gap-2 content-start overflow-y-auto" }, members.map((m) => {
            var _a;
            const joined = joinedIds.includes(m.id);
            return (React.createElement("div", { key: m.id, className: "rounded-xl flex flex-col items-center justify-center py-4", style: { backgroundColor: "#171B21", opacity: joined ? 1 : 0.4 } },
                React.createElement(Pic, { photo: m.photo || null, letter: (_a = m.name) === null || _a === void 0 ? void 0 : _a.charAt(0), size: 48, bg: colors.primary, color: "#fff", className: "mb-1.5" }),
                React.createElement("span", { className: "text-xs font-bold text-white" }, m.name),
                React.createElement("span", { className: "text-[10px] mt-0.5", style: { color: joined ? "#5AA9E6" : "#8A93A0" } }, joined ? "متّصل" : "جارٍ الانضمام…")));
        })),
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-6` },
            React.createElement("button", { "aria-label": t("ktm"), onClick: () => setMuted(!muted), className: "w-14 h-14 rounded-full flex items-center justify-center", style: { backgroundColor: muted ? colors.primary : "#262B33" } },
                React.createElement(MicOff, { size: 20, color: "#fff" })),
            React.createElement("button", { "aria-label": t("inha_almkalma"), onClick: () => onEnd(duration, true), className: "w-16 h-16 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger } },
                React.createElement(PhoneOff, { size: 24, color: "#fff" })),
            React.createElement("button", { onClick: () => setSpeakerOn(!speakerOn), className: "w-14 h-14 rounded-full flex items-center justify-center", style: { backgroundColor: speakerOn ? colors.primary : "#262B33" } },
                React.createElement(Volume2, { size: 20, color: "#fff" })))));
}
function VoiceMessageBubble({ url, duration, mine, transcript, loading = false, failed = false, cid = null, mid = null }) {
    const { showToast } = useToast();
    const [prog, setProg] = useState(0), [elapsed, setElapsed] = useState(0);   // C19: شريط التقدّم والوقت المنقضي
    const { colors } = useTheme();
    const [playing, setPlaying] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    const audioRef = useRef(null);
    // كل فقاعة صوتية مستقلة ولا تعرف بغيرها، فكانت تشتغل كلها معاً.
    // نسجّل «المشغّل النشط» عالمياً: بدء تشغيل جديد يوقف السابق.
    const stopSelfRef = useRef(null);
    stopSelfRef.current = function () {
        try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } } catch (e) { }
        setPlaying(false);
    };
    // لو أُزيلت الفقاعة من الشاشة أثناء التشغيل نحرّر المرجع العالمي
    useEffect(function () {
        return function () {
            if (window.__sawaActiveAudio === stopSelfRef) window.__sawaActiveAudio = null;
        };
    }, []);
    return (React.createElement("div", { style: { minWidth: 160 } },
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
            React.createElement("audio", { ref: audioRef, src: url, onEnded: () => { setPlaying(false); setProg(0); setElapsed(0); if (window.__sawaActiveAudio === stopSelfRef) window.__sawaActiveAudio = null; }, onPause: () => setPlaying(false),
                onTimeUpdate: (e) => { const a = e.currentTarget; setElapsed(Math.floor(a.currentTime || 0)); if (a.duration && isFinite(a.duration)) setProg(Math.min(1, a.currentTime / a.duration)); }, className: "hidden" }),
            React.createElement("button", { onClick: () => {
                    var _a, _b;
                    if (playing) {
                        (_a = audioRef.current) === null || _a === void 0 ? void 0 : _a.pause();
                        setPlaying(false);
                        if (window.__sawaActiveAudio === stopSelfRef) window.__sawaActiveAudio = null;
                    }
                    else if (window.__sawaActiveRecorder) {   // C19: لا تشغيل أثناء التسجيل
                        showToast(tl("أنهِ التسجيل أوّلاً", "Finish recording first"), "info");
                    }
                    else if (!url) {   // C18: لم يُنزَّل بعد ⇒ تنزيل الآن بدل زرٍّ صامت
                        if (cid && mid && window.SawaChat && window.SawaChat.retryMedia) window.SawaChat.retryMedia(cid, mid);
                        showToast(tl("جارٍ تنزيل التسجيل…", "Downloading the voice note…"), "info");
                    }
                    else {
                        // أوقف أي رسالة صوتية أخرى تعمل الآن
                        if (window.__sawaActiveAudio && window.__sawaActiveAudio !== stopSelfRef) {
                            try { window.__sawaActiveAudio.current(); } catch (e) { }
                        }
                        window.__sawaActiveAudio = stopSelfRef;
                        const pr = (_b = audioRef.current) === null || _b === void 0 ? void 0 : _b.play();
                        setPlaying(true);
                        // C18: الصيغة غير مدعومة على هذا الجهاز (مثلاً webm على آيفون قديم) ⇒ نقول ذلك بدل زرٍّ عالق
                        if (pr && pr.catch) pr.catch((e) => { setPlaying(false); showToast(tl("تعذّر تشغيل التسجيل على هذا الجهاز", "Can't play this voice note on this device") + (e && e.name === "NotSupportedError" ? tl(" (صيغة غير مدعومة)", " (unsupported format)") : ""), "error"); });
                    }
                }, className: "w-8 h-8 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: mine ? "rgba(255,255,255,0.25)" : colors.primaryLight } }, playing ? React.createElement(Pause, { size: 14, color: mine ? "#fff" : colors.primary }) : React.createElement(Play, { size: 14, color: mine ? "#fff" : colors.primary })),
            React.createElement("div", { className: "flex-1 h-1 rounded-full overflow-hidden", style: { backgroundColor: mine ? "rgba(255,255,255,0.3)" : colors.border } },
                React.createElement("div", { style: { height: "100%", width: Math.round(prog * 100) + "%", backgroundColor: mine ? "#fff" : colors.primary, transition: "width .25s linear" } })),
            React.createElement("span", { className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } }, !url && loading ? "⏳ " + duration : !url && failed ? "↻ " + tl("أعد التنزيل", "Retry") : (playing || elapsed) ? Math.floor(elapsed / 60) + ":" + String(elapsed % 60).padStart(2, "0") : duration)),
        transcript && (React.createElement("button", { onClick: () => setShowTranscript(!showTranscript), className: "mt-1.5" },
            React.createElement("span", { className: "text-[10px] font-bold underline", style: { color: mine ? "#ffffffdd" : colors.primary } }, showTranscript ? "إخفاء النص" : "عرض النص"))),
        transcript && showTranscript && (React.createElement("p", { className: "text-xs mt-1", style: { color: mine ? "#fff" : colors.text } }, transcript))));
}
// ============================================================
// GroupInfoScreen — معلومات المجموعة وإدارة الأعضاء
// المشرف وحده يرى أزرار التعديل والترقية والإزالة.
// ============================================================
function GroupInfoScreen({ group, myUserId, mediaCount = 0, onRename, onAddMembers, onRemoveMember, onToggleAdmin, onLeave, onBack, contacts = null, onInviteLink = null, onUpdate = null }) {
    const { colors } = useTheme();
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(group.name);
    const [memberMenu, setMemberMenu] = useState(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [newMemberName, setNewMemberName] = useState("");
    const me = group.members.find((m) => m.id === myUserId);
    const isAdmin = !!me && me.role === "admin";
    const admins = group.members.filter((m) => m.role === "admin").length;
    // C3: محادثة العائلة تتبع أعضاء العائلة — لا إضافة ولا إزالة ولا مغادرة من هنا
    const isFamily = group.kind === "family";
    const [picked, setPicked] = useState([]);
    const [descDraft, setDescDraft] = useState(null);
    const memberUids = group.members.map((m) => m.uid || m.id);
    const addable = (contacts || []).filter((c) => memberUids.indexOf(c.uid) < 0);

    function saveName() {
        const clean = nameDraft.trim();
        if (!clean) { setNameDraft(group.name); setEditingName(false); return; }
        onRename(clean);
        setEditingName(false);
    }
    function confirmAdd() {
        const clean = newMemberName.trim();
        if (!clean) return;
        onAddMembers([clean]);
        setNewMemberName("");
        setShowAdd(false);
    }

    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col relative", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("gi_malwmat"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto" },
            // ── الرأس: الصورة والاسم ──
            React.createElement("div", { className: "flex flex-col items-center py-6 px-6", style: { backgroundColor: colors.card } },
                React.createElement("div", { className: "w-24 h-24 rounded-full flex items-center justify-center mb-3", style: { backgroundColor: colors.primaryLight } },
                    React.createElement(UsersRound, { size: 40, color: colors.primary })),
                editingName
                    ? React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 w-full` },
                        React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: nameDraft, autoFocus: true, onChange: (e) => setNameDraft(e.target.value), className: `flex-1 rounded-xl border px-3 py-2 text-sm ${textStart()}`, style: { borderColor: colors.primary, color: colors.text, backgroundColor: colors.bg } }),
                        React.createElement("button", { onClick: saveName, className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primary } },
                            React.createElement(Check, { size: 16, color: "#fff" })))
                    : React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                        React.createElement("span", { className: "text-lg font-extrabold", style: { color: colors.text } }, group.name),
                        isAdmin && React.createElement("button", { "aria-label": t("gi_tadyl_alasm"), onClick: () => { setNameDraft(group.name); setEditingName(true); } },
                            React.createElement(Pencil, { size: 15, color: colors.textMuted }))),
                React.createElement("span", { className: "text-xs mt-1", style: { color: colors.textMuted } },
                    group.members.length + t("gi_aada") + mediaCount + t("gi_wsayt"))),
            // ── الأعضاء ──
            React.createElement("div", { className: "mt-3", style: { backgroundColor: colors.card } },
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between px-4 pt-3 pb-1` },
                    React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.textMuted } }, t("gi_alaada")),
                    isAdmin && !isFamily && React.createElement("button", { onClick: () => setShowAdd(true), className: `flex ${rowStart()} items-center gap-1` },
                        React.createElement(UserPlus, { size: 14, color: colors.primary }),
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primary } }, t("gi_idafa")))),
                group.members.map((m) => React.createElement("div", { key: m.id, className: `flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                    React.createElement(Pic, { photo: m.photo || null, letter: (m.name || "?").charAt(0), size: 40, bg: colors.primaryLight, color: colors.primary }),
                    React.createElement("div", { className: `flex-1 min-w-0 ${textStart()}` },
                        React.createElement("div", { className: "text-sm truncate", style: { color: colors.text } }, m.name),
                        m.role === "admin" && React.createElement("div", { className: "text-[10px] font-bold", style: { color: colors.accent } }, t("gi_mshrf"))),
                    // المشرف لا يدير نفسه من هنا — الخروج له زر مستقل بالأسفل
                    isAdmin && !isFamily && m.id !== myUserId && React.createElement("button", { "aria-label": t("gi_khyarat"), onClick: () => setMemberMenu(m), className: "w-7 h-7 flex items-center justify-center shrink-0" },
                        React.createElement(MoreVertical, { size: 15, color: colors.textMuted }))))),
            isFamily && React.createElement("p", { className: `text-[11px] px-4 py-3 leading-relaxed ${textStart()}`, style: { color: colors.textMuted } }, t("c3_family_managed")),
            !isFamily && onUpdate && React.createElement("div", { className: "mt-3 px-4 py-3", style: { backgroundColor: colors.card } },
                React.createElement("div", { className: `text-xs font-extrabold mb-1.5 ${textStart()}`, style: { color: colors.textMuted } }, t("c3_desc")),
                descDraft === null
                    ? React.createElement("button", { onClick: () => (isAdmin || !group.infoAdminsOnly) && setDescDraft(group.desc || ""), className: `w-full ${textStart()} text-sm`, style: { color: group.desc ? colors.text : colors.textMuted } }, group.desc || t("c3_desc_ph"))
                    : React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: descDraft, autoFocus: true, onChange: (e) => setDescDraft(e.target.value), className: "flex-1 rounded-xl border px-3 py-2 text-sm", style: { borderColor: colors.border, backgroundColor: colors.bg, color: colors.text } }),
                        React.createElement("button", { onClick: () => { onUpdate({ desc: descDraft }); setDescDraft(null); }, className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primary } }, React.createElement(Check, { size: 16, color: "#fff" }))),
                isAdmin && React.createElement("button", { onClick: () => onUpdate({ adminsOnly: !group.adminsOnly }), className: `w-full flex ${rowStart()} items-center justify-between mt-3 pt-3 border-t`, style: { borderColor: colors.border } },
                    React.createElement("span", { className: "text-sm", style: { color: colors.text } }, t("c3_admins_only")),
                    React.createElement("span", { className: "w-10 h-6 rounded-full relative", style: { backgroundColor: group.adminsOnly ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [group.adminsOnly ? "right" : "left"]: 2 } }))),
                isAdmin && onInviteLink && React.createElement("button", { onClick: onInviteLink, className: `w-full flex ${rowStart()} items-center gap-2 mt-3 pt-3 border-t`, style: { borderColor: colors.border } },
                    React.createElement(Share2, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.primary } }, t("c3_invite_link")))),
            // ── الخروج ──
            !isFamily && React.createElement("div", { className: "mt-3 mb-8", style: { backgroundColor: colors.card } },
                React.createElement("button", { onClick: () => setConfirmLeave(true), className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-3.5` },
                    React.createElement(LogOut, { size: 17, color: colors.danger, style: { transform: "scaleX(-1)" } }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("gi_mghadra"))),
                // C13: إبلاغ حقيقيّ عن المجموعة (يصل لفريق سوا مع آخر الرسائل)
                window.SawaChat && window.SawaChat.reportSheet && group && group.id && /^grp_/.test(group.id) && React.createElement("button", { onClick: () => window.SawaChat.reportSheet({ cid: group.id, name: group.name, kind: "group" }), className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-3`, style: { borderTop: `1px solid ${colors.border}` } },
                    React.createElement(Flag, { size: 16, color: colors.textMuted }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, tl("الإبلاغ عن المجموعة", "Report group"))))),
        // ── قائمة خيارات العضو ──
        memberMenu && React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setMemberMenu(null), style: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 40 } }),
            React.createElement("div", { className: "absolute left-0 right-0 bottom-0 rounded-t-3xl pb-8 pt-5 px-6", style: { backgroundColor: colors.card, zIndex: 50 } },
                React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto mb-4", style: { backgroundColor: colors.border } }),
                React.createElement("p", { className: `text-sm font-extrabold mb-3 ${textStart()}`, style: { color: colors.text } }, memberMenu.name),
                React.createElement("button", { onClick: () => { onToggleAdmin(memberMenu.id); setMemberMenu(null); }, className: `w-full flex ${rowStart()} items-center gap-3 py-3` },
                    React.createElement(Crown, { size: 17, color: colors.accent }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, memberMenu.role === "admin" ? t("gi_izala_alishraf") : t("gi_trqya"))),
                React.createElement("button", { onClick: () => { onRemoveMember(memberMenu.id); setMemberMenu(null); }, className: `w-full flex ${rowStart()} items-center gap-3 py-3` },
                    React.createElement(Trash2, { size: 17, color: colors.danger }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("gi_izala_mn"))))),
        // ── إضافة عضو ──
        showAdd && React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setShowAdd(false), style: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 40 } }),
            React.createElement("div", { className: "absolute left-0 right-0 bottom-0 rounded-t-3xl pb-8 pt-5 px-6", style: { backgroundColor: colors.card, zIndex: 50 } },
                React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto mb-4", style: { backgroundColor: colors.border } }),
                React.createElement("p", { className: `text-sm font-extrabold mb-3 ${textStart()}`, style: { color: colors.text } }, contacts ? t("c3_pick_members") : t("gi_idafa_adw")),
                contacts && React.createElement("div", { style: { maxHeight: "50vh", overflowY: "auto" } },
                    addable.length === 0 && React.createElement("p", { className: "text-xs py-4 text-center", style: { color: colors.textMuted } }, t("c3_no_more_contacts")),
                    addable.map((c) => React.createElement("button", { key: c.uid, onClick: () => setPicked((p) => p.indexOf(c.uid) >= 0 ? p.filter((x) => x !== c.uid) : [...p, c.uid]), className: `w-full flex ${rowStart()} items-center gap-3 py-2.5` },
                        React.createElement("span", { className: "w-5 h-5 rounded-md border flex items-center justify-center", style: { borderColor: colors.primary, backgroundColor: picked.indexOf(c.uid) >= 0 ? colors.primary : "transparent" } }, picked.indexOf(c.uid) >= 0 && React.createElement(Check, { size: 13, color: "#fff" })),
                        React.createElement("span", { className: `flex-1 ${textStart()} text-sm`, style: { color: colors.text } }, c.name)))),
                contacts && React.createElement("button", { onClick: () => { if (picked.length) onAddMembers(picked); setPicked([]); setShowAdd(false); }, disabled: !picked.length, className: "w-full rounded-2xl py-3 mt-3", style: { backgroundColor: picked.length ? colors.primary : colors.border } },
                    React.createElement("span", { className: "text-sm font-extrabold", style: { color: "#fff" } }, t("c3_add_selected"))),
                !contacts && React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: newMemberName, autoFocus: true, onChange: (e) => setNewMemberName(e.target.value), placeholder: t("gi_asm_aladw"), className: `w-full rounded-xl border px-3 py-2.5 text-sm mb-3 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
                !contacts && React.createElement("button", { onClick: confirmAdd, className: "w-full rounded-2xl py-3", style: { backgroundColor: colors.primary } },
                    React.createElement("span", { className: "text-sm font-extrabold", style: { color: "#fff" } }, t("gi_idafa_2"))))),
        // ── تأكيد المغادرة ──
        confirmLeave && React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setConfirmLeave(false), style: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 40 } }),
            React.createElement("div", { className: "absolute left-6 right-6 rounded-2xl p-5", style: { top: "35%", backgroundColor: colors.card, zIndex: 50 } },
                React.createElement("p", { className: `text-sm font-extrabold mb-1 ${textStart()}`, style: { color: colors.text } }, t("gi_mghadra_s")),
                React.createElement("p", { className: `text-xs mb-4 ${textStart()}`, style: { color: colors.textMuted } },
                    (isAdmin && admins === 1 && group.members.length > 1)
                        ? t("gi_almshrf_alwhyd")
                        : t("gi_ln_tslk")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => setConfirmLeave(false), className: "flex-1 rounded-xl py-2.5 border", style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("gi_ilgha"))),
                    React.createElement("button", { onClick: () => { setConfirmLeave(false); onLeave(); }, className: "flex-1 rounded-xl py-2.5", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: "#fff" } }, t("gi_mghadra_btn"))))))));
}

function ForwardPickerScreen({ conversations, groups, contacts, currentConversationId, onForward, onClose }) {
    const { colors } = useTheme();
    const [selectedIds, setSelectedIds] = useState([]);
    // C47: جهات الاتّصال التي لا محادثة معها بعد — كان التوجيه مقصوراً على المحادثات القائمة
    const SC = window.SawaChat;
    const extra = (contacts || []).filter((c) => c && c.uid && SC && SC.dmWith && !conversations.some((x) => x.id === SC.dmWith(c.uid)) && SC.dmWith(c.uid) !== currentConversationId).map((c) => ({ id: "contact:" + c.uid, name: c.name, kind: "contact" }));
    const targets = [
        ...conversations.filter((c) => c.id !== currentConversationId).map((c) => ({ id: c.id, name: c.name, kind: "chat" })),
        ...groups.filter((g) => g.id !== currentConversationId).map((g) => ({ id: g.id, name: g.name, kind: "group" })),
        ...extra,
    ];
    function toggle(id) {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("twjyh_ila"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            targets.length === 0 && React.createElement(EmptyState, { icon: Send, label: t("ma_fyh_mhadthat_aw") }),
            targets.map((target) => (React.createElement("button", { key: target.id, onClick: () => toggle(target.id), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl border p-3 mb-2`, style: { borderColor: selectedIds.includes(target.id) ? colors.primary : colors.border, backgroundColor: colors.card } },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                    target.kind === "group" ? React.createElement(Users2, { size: 16, color: colors.primary }) : React.createElement(MessageCircle, { size: 16, color: colors.primary }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, target.name)),
                React.createElement("div", { className: "w-5 h-5 rounded-full border-2 flex items-center justify-center", style: { borderColor: colors.primary, backgroundColor: selectedIds.includes(target.id) ? colors.primary : "transparent" } }, selectedIds.includes(target.id) && React.createElement(Check, { size: 12, color: "#fff" })))))),
        React.createElement("div", { className: "p-3 border-t", style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(Button, { label: t("twjyh", { length: selectedIds.length }), disabled: selectedIds.length === 0, onPress: () => onForward(selectedIds) }))));
}
// بديل يظهر مكان الوسائط التي لم يُحفَظ محتواها بين الجلسات
function MediaUnavailable({ label = "الوسائط غير متاحة", note = "لم تُحفظ بين الجلسات في وضع المعاينة" }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "rounded-xl flex flex-col items-center justify-center gap-1 px-4 py-6", style: { backgroundColor: colors.border + "44", minWidth: 160 } },
        React.createElement(Images, { size: 20, color: colors.textMuted }),
        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, label),
        React.createElement("span", { className: "text-[9px] text-center", style: { color: colors.textMuted } }, note)));
}
// ════════ قطع مشتركة بين المحادثة الخاصة والمجموعة ════════
// استُخرجت لأن أي تعديل عليها كان يلزم تكراره في شاشتين متباعدتين.

// فاصل يوضّح أين توقّفت القراءة
function UnreadDivider() {
    const { colors } = useTheme();
    return (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 my-3` },
        React.createElement("div", { className: "flex-1 h-px", style: { backgroundColor: colors.primary + "55" } }),
        React.createElement("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full", style: { color: colors.primary, backgroundColor: colors.primaryLight } }, "رسائل غير مقروءة"),
        React.createElement("div", { className: "flex-1 h-px", style: { backgroundColor: colors.primary + "55" } })));
}

// C48: الروابط داخل نصّ الرسالة كانت نصّاً جامداً — الآن تُفتح بالنقر (روابط سوا تُفتح داخل التطبيق)، مع بطاقة النطاق تحت النصّ
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"'()\u0600-\u06FF]+|(?:[a-z0-9-]+\.)+(?:com|net|org|sd|app|io|me|info|ly|co|dev|edu|gov|tv|ae|sa|eg|uk)(?:\/[^\s<>"'()\u0600-\u06FF]*)?)/gi;
const SawaLinkIcon = (p) => React.createElement("svg", { width: p.size || 14, height: p.size || 14, viewBox: "0 0 24 24", fill: "none", stroke: p.color || "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }), React.createElement("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }));
function urlHref(u) { return /^https?:\/\//i.test(u) ? u : "https://" + u; }
function urlsIn(text) { const out = []; String(text || "").replace(URL_RE, (m) => { const t = m.replace(/[.,!?؟،:;]+$/, ""); if (t.length > 3) out.push(t); return m; }); return out; }
function isSawaLink(u) { try { return /(^|\.)sawaaap\.com$/i.test(new URL(urlHref(u)).hostname); } catch (e) { return false; } }
function openUrl(u, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const href = urlHref(u);
    if (isSawaLink(u)) { location.href = href; return; }
    // window.open مع noopener يعيد null دوماً — فنفتح برابطٍ حقيقيّ حتى لا نغادر التطبيق
    const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); setTimeout(() => { try { a.remove(); } catch (x) {} }, 300);
}
// نصّ غنيّ: روابط + إشارات @ (في المجموعات)
function renderRichText(text, opts) {
    const o = opts || {}; const t = String(text == null ? "" : text);
    const linkColor = o.mine ? "#E3F2FF" : (o.colors ? o.colors.primary : "#2F80C8");
    const nodes = []; let k = 0;
    const pushPlain = (seg) => {
        if (!seg) return;
        if (!o.mentions) { nodes.push(React.createElement("span", { key: k++ }, seg)); return; }
        seg.split(/(@[\u0600-\u06FFa-zA-Z]+)/g).forEach((part) => { if (!part) return; nodes.push(part.startsWith("@") ? React.createElement("span", { key: k++, className: "font-bold", style: { color: o.colors ? o.colors.accent : "#8B5CF6" } }, part) : React.createElement("span", { key: k++ }, part)); });
    };
    let last = 0; URL_RE.lastIndex = 0; let m;
    while ((m = URL_RE.exec(t))) {
        let u = m[0]; const trail = (u.match(/[.,!?؟،:;]+$/) || [""])[0]; u = u.slice(0, u.length - trail.length);
        if (u.length <= 3) continue;
        pushPlain(t.slice(last, m.index));
        nodes.push(React.createElement("a", { key: k++, href: urlHref(u), target: isSawaLink(u) ? "_self" : "_blank", rel: "noopener noreferrer", onClick: (e) => { e.stopPropagation(); if (isSawaLink(u)) { e.preventDefault(); location.href = urlHref(u); } }, onContextMenu: (e) => e.stopPropagation(), style: { color: linkColor, textDecoration: "underline", wordBreak: "break-all", unicodeBidi: "isolate", direction: "ltr" } }, u));
        if (trail) pushPlain(trail);
        last = m.index + m[0].length;
    }
    pushPlain(t.slice(last));
    return nodes;
}
// C49: المعاينة تأتي من الخادم (link.peek: عنوان/وصف/صورة من وسوم og) — ذاكرةٌ محلّيّة حتى لا يُطلب الرابط نفسه مرّتين
const LINK_PEEK = new Map();
function peekLink(u) {
    const href = urlHref(u);
    if (LINK_PEEK.has(href)) return LINK_PEEK.get(href);
    const SS = window.SawaSync;
    const pr = (SS && SS.call && !isSawaLink(u)) ? SS.call("link.peek", { url: href }).then((r) => (r && r.ok !== false) ? r : null).catch(() => null) : Promise.resolve(null);
    LINK_PEEK.set(href, pr); if (LINK_PEEK.size > 300) LINK_PEEK.clear();
    return pr;
}
function LinkCard({ text, mine }) {
    const { colors } = useTheme();
    const u = urlsIn(text)[0];
    const [meta, setMeta] = useState(null);
    const [imgOk, setImgOk] = useState(true);
    useEffect(() => { let on = true; if (u) peekLink(u).then((r) => { if (on) setMeta(r || {}); }); return () => { on = false; }; }, [u]);
    if (!u) return null;
    let host = ""; try { host = new URL(urlHref(u)).hostname.replace(/^www\./, ""); } catch (e) { return null; }
    const sawa = isSawaLink(u);
    const title = meta && meta.title && meta.title !== host ? meta.title : "";
    const desc = meta && meta.desc ? meta.desc : "";
    const image = meta && meta.image && imgOk ? meta.image : "";
    const fg = mine ? "#fff" : colors.text, muted = mine ? "#ffffffcc" : colors.textMuted;
    return (React.createElement("button", { onClick: (e) => openUrl(u, e), className: `w-full flex flex-col rounded-xl mt-1.5 overflow-hidden ${textStart()}`, style: { backgroundColor: mine ? "rgba(255,255,255,0.14)" : colors.bg, border: `1px solid ${mine ? "#ffffff33" : colors.border}`, maxWidth: 260 } },
        image ? React.createElement("img", { src: image, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: () => setImgOk(false), className: "w-full object-cover", style: { maxHeight: 130, display: "block" } }) : null,
        React.createElement("div", { className: "px-2.5 py-1.5 w-full" },
            title ? React.createElement("div", { className: "text-[11.5px] font-extrabold leading-4", style: { color: fg, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, title) : null,
            desc ? React.createElement("div", { className: "text-[10.5px] leading-4 mt-0.5", style: { color: muted, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, desc) : null,
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 ${title || desc ? "mt-1" : ""}` },
                React.createElement(SawaLinkIcon, { size: 12, color: mine ? "#fff" : colors.primary }),
                React.createElement("span", { className: "flex-1 text-[10.5px] font-bold truncate", style: { color: title ? muted : fg, direction: "ltr", textAlign: isRTL() ? "right" : "left" } }, (meta && meta.host) || host),
                React.createElement("span", { className: "text-[10px] shrink-0", style: { color: muted } }, sawa ? tl("فتح في سوا", "Open in Sawa") : tl("فتح ↗", "Open ↗"))))));
}
// C47: فاصل اليوم بين الرسائل (اليوم · أمس · التاريخ) — كانت المحادثة قائمةً واحدة بلا تواريخ
function dayKeyOf(ts) { const d = new Date(ts || 0); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function dayLabelOf(ts) {
    const d = new Date(ts), now = new Date(); const k = dayKeyOf(ts), today = dayKeyOf(now.getTime()), yest = dayKeyOf(now.getTime() - 86400000);
    if (k === today) return tl("اليوم", "Today");
    if (k === yest) return tl("أمس", "Yesterday");
    const sameYear = d.getFullYear() === now.getFullYear();
    try { return d.toLocaleDateString(loc(), sameYear ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return d.toLocaleDateString(); }
}
function DayDivider({ label }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex justify-center my-2" },
        React.createElement("span", { className: "text-[10px] font-bold px-2.5 py-0.5 rounded-full", style: { backgroundColor: colors.border + "88", color: colors.textMuted } }, label)));
}
// C47: هل الجهاز متّصل؟ — شريطٌ في المحادثة بدل أن تبدو الرسائل «معلّقة» بلا سبب
function useOnline() {
    const [on, setOn] = useState(() => { try { return navigator.onLine !== false; } catch (e) { return true; } });
    useEffect(() => { const a = () => setOn(true), b = () => setOn(false); window.addEventListener("online", a); window.addEventListener("offline", b); return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); }; }, []);
    return on;
}
function OfflineBar() {
    return React.createElement("div", { className: "text-[11px] font-bold text-center py-1", style: { backgroundColor: "#F59E0B22", color: "#B45309" } }, tl("لا اتصال بالإنترنت — تُرسل رسائلك عند عودة الشبكة", "No internet — messages will go out when you're back online"));
}
// C47: نافذة العرض — المحادثة الطويلة (آلاف الرسائل) كانت تُرسم كلّها فتثقل الفتح والكتابة؛ نعرض آخر WIN_STEP ونوسّع عند الصعود
const WIN_STEP = 80;
function useMessageWindow(messages, unread, showAll, scrollRef) {
    const [n, setN] = useState(() => Math.min(300, Math.max(WIN_STEP, (unread || 0) + 10)));
    const all = showAll || n >= messages.length;
    const shown = all ? messages : messages.slice(messages.length - n);
    const hidden = messages.length - shown.length;
    const keepRef = useRef(null);
    const more = (extra) => { const el = scrollRef.current; if (el) keepRef.current = { h: el.scrollHeight, top: el.scrollTop }; setN((x) => extra === Infinity ? Infinity : x + (extra || WIN_STEP * 2)); };
    React.useLayoutEffect(() => { const el = scrollRef.current, k = keepRef.current; if (el && k) { el.scrollTop = k.top + (el.scrollHeight - k.h); keepRef.current = null; } }, [n]);
    return { shown, hidden, more };
}
function OlderButton({ hidden, onMore }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex justify-center mb-2" },
        React.createElement("button", { onClick: () => onMore(), className: "text-[11px] font-bold px-3 py-1.5 rounded-full border", style: { borderColor: colors.border, backgroundColor: colors.card, color: colors.primary } }, tl("عرض الرسائل الأقدم (" + hidden.toLocaleString(loc()) + ")", "Show older messages (" + hidden + ")"))));
}

// موضع الفاصل: قبل أول رسالة غير مقروءة.
// يُخفى إذا كانت كل الرسائل غير مقروءة (فوضعه فوق الأولى بلا معنى).
function unreadDividerIndex(total, unread) {
    return unread > 0 ? total - unread : -1;
}

// محادثة بلا رسائل بعد
function EmptyChatState({ icon }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex flex-col items-center justify-center gap-2 py-16" },
        React.createElement(icon || MessageCircle, { size: 30, color: colors.border }),
        React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("ch_ma_fyh_rsayl"))));
}

// يحفظ ما لم يُرسَل عند مغادرة الشاشة، ويعيده عند العودة
function useChatDraft(draft, onSaveDraft, onTyping) {
    const [text, setText0] = useState(draft || "");
    // C47: مؤشّر «يكتب…» كان يُرسل عند مغادرة الشاشة فقط (حفظ المسوّدة) — الآن مع كلّ كتابة (sawa-chat يخفّفه كلّ ٣ ثوانٍ)
    const setText = (v) => { setText0(v); try { const val = typeof v === "function" ? v(textRef.current) : v; if (onTyping && val && String(val).trim()) onTyping(); } catch (e) {} };
    const textRef = useRef(text);
    textRef.current = text;
    useEffect(function () {
        return function () { if (onSaveDraft) onSaveDraft(textRef.current); };
    }, []);
    function clearDraft() { setText(""); if (onSaveDraft) onSaveDraft(""); }
    return [text, setText, clearDraft];
}

// تسجيل صوتي — كان مكرّراً في الشاشتين بعلّة واحدة:
// دالة onstop كانت تلتقط recordSeconds من لحظة بدء التسجيل، فتخرج
// المدة "0:00" دائماً مهما طال التسجيل. المرجع أدناه يحمل القيمة الحيّة.
// C18: المحادثة تُفتح عند آخر رسالة وتبقى في الأسفل ما لم يصعد المستخدم — كانت تُفتح من الأعلى لأنّ الرسائل تصل بعد فتح الشاشة
//      (والصور تكبر بعد تحميلها)، وشرط «قريبٌ من الأسفل» كان يُقرأ والصفحة في أعلاها.
function useStickToBottom(ref, dep) {
    const stick = useRef(true);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const toEnd = () => { el.scrollTop = el.scrollHeight; };
        const onScroll = () => { stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
        const onLoad = () => { if (stick.current) toEnd(); };   // صورة/فيديو اكتمل تحميله فطال المحتوى
        el.addEventListener("scroll", onScroll, { passive: true });
        el.addEventListener("load", onLoad, true);
        el.addEventListener("loadedmetadata", onLoad, true);
        toEnd();
        const t0 = Date.now();
        const iv = setInterval(() => { if (stick.current) toEnd(); if (Date.now() - t0 > 5000) clearInterval(iv); }, 200);
        return () => { el.removeEventListener("scroll", onScroll); el.removeEventListener("load", onLoad, true); el.removeEventListener("loadedmetadata", onLoad, true); clearInterval(iv); };
    }, []);
    useEffect(() => {
        const el = ref.current;
        if (!el || !stick.current) return;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => { if (stick.current) el.scrollTop = el.scrollHeight; });
    }, [dep]);
    return stick;
}
function useVoiceRecorder({ onComplete, transcribe }) {
    const [isRecording, setIsRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [micError, setMicError] = useState(false);
    const recorderRef = useRef(null);
    const timerRef = useRef(null);
    const speechRef = useRef(null);
    const transcriptRef = useRef("");
    const secondsRef = useRef(0);
    const streamRef = useRef(null);
    // ما إذا كان التوقّف إرسالاً أم إلغاءً — يُقرأ داخل onstop
    const discardRef = useRef(false);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const MIN_SECONDS = 1;        // أقصر من ثانية = نقرة غير مقصودة
    const MAX_SECONDS = 120;      // تسجيل منسيّ لا يعمل إلى ما لا نهاية

    // صيغة التسجيل المدعومة في هذا المتصفح.
    // كروم/أندرويد: webm — iOS Safari: mp4 فقط.
    // "" تعني: دع المتصفح يختار (متصفحات قديمة بلا isTypeSupported).
    function pickMimeType() {
        if (typeof MediaRecorder === "undefined") return "";
        if (typeof MediaRecorder.isTypeSupported !== "function") return "";
        const candidates = ["audio/webm", "audio/mp4", "audio/aac", "audio/ogg"];
        for (let i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
        }
        return "";
    }

    // مرجع ثابت لهذا الخُطّاف نفسه — يميّزه عن نظرائه في الشاشات الأخرى
    const selfRef = useRef(null);
    if (!selfRef.current) selfRef.current = { cancel: function () { } };

    function teardown() {
        clearInterval(timerRef.current);
        try { if (speechRef.current) speechRef.current.stop(); } catch (e) { }
        try {
            if (streamRef.current) streamRef.current.getTracks().forEach(function (tr) { tr.stop(); });
        } catch (e) { }
        speechRef.current = null;
        streamRef.current = null;
        recorderRef.current = null;
        if (window.__sawaActiveRecorder === selfRef.current) window.__sawaActiveRecorder = null;
        setIsRecording(false);
    }

    // مغادرة الشاشة أثناء التسجيل = إلغاء، لا إرسال.
    // قبل هذا كان التنظيف يستدعي stop() فتُرسل الرسالة رغماً عن المستخدم.
    useEffect(function () {
        return function () {
            discardRef.current = true;
            try { if (recorderRef.current) recorderRef.current.stop(); } catch (e) { }
            teardown();
        };
    }, []);

    function flashError() {
        setMicError(true);
        setTimeout(function () { setMicError(false); }, 2500);
    }

    function start() {
        if (isRecording) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { flashError(); return; }
        // تسجيل واحد فقط في كل وقت. لو بقي تسجيل معلّق في شاشة أخرى
        // يُلغى (لا يُرسَل) قبل بدء الجديد.
        if (window.__sawaActiveRecorder && window.__sawaActiveRecorder !== selfRef.current) {
            try { window.__sawaActiveRecorder.cancel(); } catch (e) { }
        }
        window.__sawaActiveRecorder = selfRef.current;
        // C19: بدء التسجيل يوقف أيّ رسالةٍ صوتيّة تعمل (كانت تستمرّ فيُسجَّل صوتها مع صوتك)
        try { if (window.__sawaActiveAudio && window.__sawaActiveAudio.current) window.__sawaActiveAudio.current(); } catch (e) { }
        window.__sawaActiveAudio = null;
        try { document.querySelectorAll("audio").forEach(function (a) { if (!a.paused && !a.srcObject) a.pause(); }); } catch (e) { }
        discardRef.current = false;
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            streamRef.current = stream;
            // iOS Safari لا يدعم audio/webm — يفشل التسجيل صامتاً بدونه
            const mimeType = pickMimeType();
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType: mimeType })
                : new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
            recorder.onstop = function () {
                const total = secondsRef.current;
                const discarded = discardRef.current;
                teardown();
                if (discarded || total < MIN_SECONDS) return;   // إلغاء أو نقرة عابرة
                const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
                // C18: تسجيلٌ فارغ (الميكروفون مشغول أو انقطع) ⇒ نقول ذلك بدل إرسال رسالةٍ صامتة
                if (blob.size < 800) { if (window.SawaChat && window.SawaSync && window.SawaSync.toast) window.SawaSync.toast(tl("لم يُلتقط صوت — تأكّد أنّ الميكروفون غير مستخدم في تطبيقٍ آخر وأعد المحاولة", "No audio was captured — try again")); flashError(); return; }
                const url = URL.createObjectURL(blob);
                const duration = Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
                const text = transcriptRef.current.trim();
                if (onCompleteRef.current) onCompleteRef.current(url, duration, text || null, blob, total);
            };
            recorder.start(1000);   // C18: دفعاتٌ كلّ ثانية — لا يضيع التسجيل كلّه إن تعثّر الإيقاف
            recorderRef.current = recorder;
            secondsRef.current = 0;
            setSeconds(0);
            setIsRecording(true);
            timerRef.current = setInterval(function () {
                secondsRef.current += 1;
                setSeconds(secondsRef.current);
                if (secondsRef.current >= MAX_SECONDS) stop();   // إيقاف تلقائي وإرسال ما سُجّل
            }, 1000);

            // التفريغ النصي الحي: Web Speech API تعمل على الصوت الحيّ فقط،
            // فتُشغَّل بالتوازي مع التسجيل لا بعده
            transcriptRef.current = "";
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            // C18: على الهاتف يستولي التعرّف على الكلام على الميكروفون فيُسجَّل صمتٌ أو لا شيء — التفريغ الحيّ على الحاسوب فقط
            const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
            if (transcribe && SpeechRec && !mobile) {
                const recognizer = new SpeechRec();
                recognizer.lang = "ar-SA";
                recognizer.continuous = true;
                recognizer.interimResults = false;
                recognizer.onresult = function (e) {
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                        if (e.results[i].isFinal) transcriptRef.current += e.results[i][0].transcript + " ";
                    }
                };
                recognizer.onerror = function () { };
                try { recognizer.start(); speechRef.current = recognizer; } catch (err) { }
            }
        }).catch(function () { if (window.__sawaActiveRecorder === selfRef.current) window.__sawaActiveRecorder = null; flashError(); });   // C19: لا يبقى «يسجّل» عالقاً
    }

    function stop() {
        discardRef.current = false;
        try { if (recorderRef.current) recorderRef.current.stop(); } catch (e) { teardown(); }
    }

    function cancel() {
        discardRef.current = true;
        try { if (recorderRef.current) recorderRef.current.stop(); } catch (e) { teardown(); }
    }
    selfRef.current.cancel = cancel;

    return {
        isRecording: isRecording, seconds: seconds, micError: micError,
        start: start, stop: stop, cancel: cancel,
        maxSeconds: MAX_SECONDS, minSeconds: MIN_SECONDS,
    };
}

// شريط "جارٍ التسجيل" وتنبيه تعذّر الميكروفون
function RecordingBar({ isRecording, seconds, micError, onCancel, maxSeconds }) {
    const { colors } = useTheme();
    if (!isRecording && !micError) return null;
    const left = maxSeconds ? maxSeconds - seconds : null;
    return (React.createElement(React.Fragment, null,
        isRecording && React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-3 py-2`, style: { backgroundColor: colors.danger + "18" } },
            React.createElement("span", { className: "w-2 h-2 rounded-full animate-pulse shrink-0", style: { backgroundColor: colors.danger } }),
            React.createElement("span", { className: "text-xs font-bold tabular-nums shrink-0", style: { color: colors.danger } },
                Math.floor(seconds / 60), ":", String(seconds % 60).padStart(2, "0")),
            // تنبيه قبل بلوغ الحد الأقصى بعشر ثوانٍ
            (left !== null && left <= 10) && React.createElement("span", { className: "text-[10px] shrink-0", style: { color: colors.textMuted } }, "يتبقّى " + left + " ث"),
            React.createElement("span", { className: "flex-1" }),
            onCancel && React.createElement("button", { onClick: onCancel, className: `flex ${rowStart()} items-center gap-1 rounded-full px-2.5 py-1 shrink-0`, style: { backgroundColor: colors.card } },
                React.createElement(Trash2, { size: 12, color: colors.danger }),
                React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.danger } }, "إلغاء"))),
        micError && React.createElement("div", { className: "px-3 py-1.5" },
            React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, t("tadhr_alwswl_llmykrwfwn_takd")))));
}

// معاينة صورة بملء الشاشة
function ImageLightbox({ src, onClose }) {
    if (!src) return null;
    return (React.createElement("div", { onClick: onClose, className: "absolute inset-0 z-50 flex items-center justify-center p-4", style: { backgroundColor: "rgba(0,0,0,0.92)" } },
        React.createElement("img", { src: src, alt: t("swra_mkbra"), className: "max-w-full max-h-full rounded-lg object-contain" })));
}

// ============================================================
// MediaLightbox — معاينة الوسائط بملء الشاشة
// items: [{ url, type: "image"|"video", name }]  ·  startIndex: موضع البداية
// يُستعمل في ChatScreen و GroupChatScreen و ChatInfoScreen.
// ============================================================
function MediaLightbox({ items, startIndex = 0, onClose, onForward }) {
    const [i, setI] = useState(startIndex);
    const [dx, setDx] = useState(0);
    const startXRef = useRef(null);
    const startYRef = useRef(0);
    const axisRef = useRef(null);
    // ── التكبير والتمرير ──
    const [zoom, setZoom] = useState(1);
    const [tx, setTx] = useState(0);
    const [ty, setTy] = useState(0);
    const pinchRef = useRef(null);       // { dist, zoom } عند بدء القرص
    const panRef = useRef(null);         // { x, y, tx, ty } عند بدء السحب المكبَّر
    const lastTapRef = useRef(0);
    const MAX_ZOOM = 4;
    const imgRef = useRef(null);
    const boxRef = useRef(null);
    function resetZoom() { setZoom(1); setTx(0); setTy(0); }
    // أقصى إزاحة مسموحة عند تكبير معيّن: نصف الفائض عن حدود الحاوية.
    // offsetWidth هو المقاس التخطيطي ولا يتأثر بـ transform، فالحساب سليم.
    function limitsFor(z) {
        const im = imgRef.current, bx = boxRef.current;
        if (!im || !bx) return { x: 0, y: 0 };
        return {
            x: Math.max(0, (im.offsetWidth * z - bx.clientWidth) / 2),
            y: Math.max(0, (im.offsetHeight * z - bx.clientHeight) / 2),
        };
    }
    // ثبّت الإزاحة داخل الحدود — يمنع سحب الصورة خارج الشاشة
    function clampTo(z, nx, ny) {
        const L = limitsFor(z);
        setTx(Math.max(-L.x, Math.min(L.x, nx)));
        setTy(Math.max(-L.y, Math.min(L.y, ny)));
    }
    function dist(t) {
        const a0 = t[0], a1 = t[1];
        return Math.hypot(a1.clientX - a0.clientX, a1.clientY - a0.clientY);
    }
    // نقرتان متتاليتان: كبّر أو ارجع للحجم الأصلي
    function onTap() {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            lastTapRef.current = 0;
            if (zoom > 1) { resetZoom(); } else { setZoom(2.5); clampTo(2.5, tx, ty); }
            return true;
        }
        lastTapRef.current = now;
        return false;
    }
    const list = items || [];
    // لو تغيّر مصدر القائمة بعد الفتح لا نخرج خارج حدودها
    const idx = Math.max(0, Math.min(list.length - 1, i));
    const cur = list[idx];
    useEffect(function () { setI(startIndex); }, [startIndex]);
    // كل صورة تبدأ بحجمها الطبيعي
    useEffect(function () { resetZoom(); }, [idx]);
    if (!cur) return null;

    // الانتقال على ثلاث مراحل: انزلاق للخارج، تبديل الصورة صامتاً
    // في الطرف المقابل، ثم انزلاق للداخل.
    const [animOn, setAnimOn] = useState(true);
    const busyRef = useRef(false);
    const OUT = 320;
    function go(step) {
        const next = idx + step;
        if (next < 0 || next >= list.length || busyRef.current) return;
        busyRef.current = true;
        setAnimOn(true);
        setDx(step > 0 ? -OUT : OUT);          // اخرج جهة الحركة
        setTimeout(function () {
            setAnimOn(false);                   // بلا حركة: اقفز للطرف الآخر
            setI(next);
            setDx(step > 0 ? OUT : -OUT);
            setTimeout(function () {
                setAnimOn(true);                // ثم انزلق للمركز
                setDx(0);
                setTimeout(function () { busyRef.current = false; }, 200);
            }, 20);
        }, 190);
    }
    function onTouchStart(e) {
        if (e.touches.length === 2) {
            pinchRef.current = { dist: dist(e.touches), zoom: zoom };
            startXRef.current = null;
            return;
        }
        if (onTap()) return;
        if (zoom > 1) {
            panRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: tx, ty: ty };
            return;
        }
        startXRef.current = e.touches[0].clientX;
        startYRef.current = e.touches[0].clientY;
        axisRef.current = null;
    }
    function onTouchMove(e) {
        // قرص بإصبعين
        if (e.touches.length === 2 && pinchRef.current) {
            const ratio = dist(e.touches) / (pinchRef.current.dist || 1);
            const nz = Math.max(1, Math.min(MAX_ZOOM, pinchRef.current.zoom * ratio));
            setZoom(nz);
            clampTo(nz, tx, ty);   // التصغير قد يُخرج الصورة عن الحدود
            return;
        }
        // تمرير داخل صورة مكبّرة
        if (panRef.current) {
            const st = panRef.current;
            clampTo(zoom, st.tx + (e.touches[0].clientX - st.x), st.ty + (e.touches[0].clientY - st.y));
            return;
        }
        if (startXRef.current === null) return;
        const mx = e.touches[0].clientX - startXRef.current;
        const my = e.touches[0].clientY - startYRef.current;
        if (axisRef.current === null) {
            if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
            axisRef.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        }
        if (axisRef.current === "y") return;
        if (busyRef.current) return;
        setAnimOn(false);
        setDx(mx);
    }
    function onTouchEnd() {
        if (pinchRef.current) {
            pinchRef.current = null;
            if (zoom <= 1.02) resetZoom();   // رجع لحجمه: صفّر الإزاحة
            return;
        }
        if (panRef.current) { panRef.current = null; return; }
        // سحب لليسار = التالي · سحب لليمين = السابق
        const moved = dx;
        startXRef.current = null;
        axisRef.current = null;
        if (moved < -60 && idx < list.length - 1) { go(1); return; }
        if (moved > 60 && idx > 0) { go(-1); return; }
        setAnimOn(true);
        setDx(0);   // لا يوجد انتقال: ارجع للمركز
    }
    function handleDownload() {
        try {
            const a = document.createElement("a");
            a.href = cur.url;
            a.download = cur.name || (cur.type === "video" ? "sawa-video" : "sawa-image");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) { }
    }
    function handleShare() {
        // ورقة المشاركة الأصلية (iOS/أندرويد). غير متاحة على سطح المكتب
        // فنسقط للتحميل بدل أن لا يحدث شيء.
        if (!navigator.share) { handleDownload(); return; }
        fetch(cur.url)
            .then(function (r) { return r.blob(); })
            .then(function (blob) {
                const file = new File([blob], cur.name || "sawa-media", { type: blob.type });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    return navigator.share({ files: [file] });
                }
                return navigator.share({ url: cur.url });
            })
            .catch(function () { });
    }

    const btn = { backgroundColor: "rgba(255,255,255,0.15)" };
    return (React.createElement("div", { className: "absolute inset-0 z-50 flex flex-col", style: { backgroundColor: "rgba(0,0,0,0.95)" } },
        // الشريط العلوي: إغلاق + العدّاد
        React.createElement("div", { className: "flex flex-row items-center justify-between px-4 pt-10 pb-2" },
            React.createElement("button", { "aria-label": t("ighlaq"), onClick: onClose, className: "w-9 h-9 rounded-full flex items-center justify-center", style: btn },
                React.createElement(X, { size: 18, color: "#fff" })),
            list.length > 1 && React.createElement("span", { dir: "ltr", className: "text-[12px] font-bold", style: { color: "#fff" } }, (idx + 1) + " / " + list.length),
            React.createElement("div", { style: { width: 36 } })),
        // الوسط: الصورة أو الفيديو
        React.createElement("div", { onTouchStart: onTouchStart, onTouchMove: onTouchMove, onTouchEnd: onTouchEnd, ref: boxRef, className: "flex-1 min-h-0 flex items-center justify-center p-4 relative overflow-hidden", style: { touchAction: "none" } },
            React.createElement("div", { style: { transform: "translateX(" + dx + "px)", transition: animOn ? "transform .19s ease" : "none", maxWidth: "100%", maxHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" } }, cur.type === "video"
                ? React.createElement("video", { src: cur.url, controls: true, className: "max-w-full max-h-full rounded-lg" })
                : React.createElement("img", { ref: imgRef, src: cur.url, alt: t("swra_mkbra"), draggable: false, className: "max-w-full rounded-lg object-contain", style: { maxHeight: "100%", transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transition: (pinchRef.current || panRef.current) ? "none" : "transform .18s ease", transformOrigin: "center center" } })),
            // أسهم التنقّل — تظهر فقط حين يوجد ما ينتقل إليه
            zoom === 1 && list.length > 1 && idx > 0 && React.createElement("button", { "aria-label": "السابق", onClick: () => go(-1), className: "absolute right-2 w-9 h-9 rounded-full flex items-center justify-center", style: btn },
                React.createElement(ChevronRight, { size: 20, color: "#fff" })),
            zoom === 1 && list.length > 1 && idx < list.length - 1 && React.createElement("button", { "aria-label": "التالي", onClick: () => go(1), className: "absolute left-2 w-9 h-9 rounded-full flex items-center justify-center", style: btn },
                React.createElement(ChevronLeft, { size: 20, color: "#fff" }))),
        // النقاط — تُخفى إن كثرت حتى لا تمتلئ الشاشة
        list.length > 1 && list.length <= 12 && React.createElement("div", { dir: "ltr", className: "flex flex-row items-center justify-center gap-1.5 pb-2" }, list.map(function (it, n) {
            return React.createElement("div", { key: n, style: { width: n === idx ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: n === idx ? "#fff" : "rgba(255,255,255,0.4)", transition: "width .2s" } });
        })),
        // الشريط السفلي: تحميل · مشاركة · توجيه
        React.createElement("div", { className: "flex flex-row items-center justify-center gap-8 pb-8 pt-2" },
            React.createElement("button", { onClick: handleDownload, className: "flex flex-col items-center gap-1" },
                React.createElement("div", { className: "w-10 h-10 rounded-full flex items-center justify-center", style: btn }, React.createElement(Download, { size: 18, color: "#fff" })),
                React.createElement("span", { className: "text-[10px]", style: { color: "#fff" } }, "تحميل")),
            React.createElement("button", { onClick: handleShare, className: "flex flex-col items-center gap-1" },
                React.createElement("div", { className: "w-10 h-10 rounded-full flex items-center justify-center", style: btn }, React.createElement(Share2, { size: 18, color: "#fff" })),
                React.createElement("span", { className: "text-[10px]", style: { color: "#fff" } }, "مشاركة")),
            onForward && React.createElement("button", { onClick: () => onForward(cur), className: "flex flex-col items-center gap-1" },
                React.createElement("div", { className: "w-10 h-10 rounded-full flex items-center justify-center", style: btn }, React.createElement(Forward, { size: 18, color: "#fff" })),
                React.createElement("span", { className: "text-[10px]", style: { color: "#fff" } }, "توجيه")))));
}

// C23: المحادثات السرّيّة — فوق مربّع الكتابة شريطٌ «مشفّرة بين الطرفين · رمز الأمان»، أو بوّابة التفعيل بدل الكتابة
function E2eBar({ e2e }) {
    const { colors } = useTheme();
    if (!e2e) return null;
    const C = window.SawaChat;
    if (e2e.state === "ready")
        return (React.createElement("button", { onClick: () => C && C.e2eSafety && C.e2eSafety(e2e.cid), className: "w-full flex flex-row items-center justify-center gap-1.5 py-1.5 border-t", style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(Lock, { size: 11, color: "#16a34a" }),
            React.createElement("span", { className: "text-[10.5px] font-bold", style: { color: colors.textMuted } }, tl("مشفّرة بين الطرفين — اضغط لرمز الأمان", "End-to-end encrypted — tap for the safety code"))));
    return (React.createElement("div", { className: "px-4 py-3 border-t text-center", style: { borderColor: colors.border, backgroundColor: colors.card } },
        React.createElement("div", { className: "flex flex-row items-center justify-center gap-1.5 mb-1" },
            React.createElement(Lock, { size: 14, color: colors.primary }),
            React.createElement("span", { className: "text-sm font-extrabold", style: { color: colors.text } }, e2e.title || "")),
        e2e.text ? React.createElement("p", { className: "text-[11.5px] leading-5", style: { color: colors.textMuted } }, e2e.text) : null,
        e2e.action ? React.createElement("button", { onClick: () => C && C.e2eAct && C.e2eAct(e2e.cid), className: "mt-2 px-5 py-2 rounded-xl text-xs font-extrabold text-white", style: { backgroundColor: colors.primary } }, e2e.action) : null));
}
// C32: فقاعة الموقع — خريطة مصغّرة (OpenStreetMap) وزرّ «فتح في الخرائط»
function LocationBubble({ m, mine }) {
    const { colors } = useTheme();
    const lat = Number(m.lat), lng = Number(m.lng);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
    const z = 15, n = Math.pow(2, z), x = Math.floor((lng + 180) / 360 * n), y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    const tile = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const url = window.SawaChat && window.SawaChat.mapsUrl ? window.SawaChat.mapsUrl(lat, lng) : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const open = (e) => { e.stopPropagation(); try { window.open(url, "_blank", "noopener"); } catch (x) { location.href = url; } };
    return (React.createElement("div", { onClick: open, style: { cursor: "pointer", minWidth: 200 } },
        React.createElement("div", { className: "rounded-xl overflow-hidden relative mb-1.5", style: { height: 120, backgroundColor: mine ? "rgba(255,255,255,0.18)" : colors.bg, backgroundImage: `url(${tile})`, backgroundSize: "cover", backgroundPosition: "center" } },
            React.createElement("div", { style: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-100%)" } },
                React.createElement(MapPin, { size: 30, color: "#E53935", fill: "#E53935", strokeWidth: 1.5 }))),
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
            React.createElement(MapPin, { size: 13, color: mine ? "#fff" : colors.primary }),
            React.createElement("span", { className: "text-xs font-bold truncate", style: { color: mine ? "#fff" : colors.text } }, m.text || tl("موقعي", "My location"))),
        React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: mine ? "#ffffffcc" : colors.textMuted, direction: "ltr", textAlign: isRTL() ? "right" : "left" } }, lat.toFixed(5) + ", " + lng.toFixed(5) + (m.acc ? " · ±" + Math.round(m.acc) + "m" : "")),
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 mt-1` },
            React.createElement("span", { className: "text-[11px] font-extrabold", style: { color: mine ? "#fff" : colors.primary } }, tl("فتح في الخرائط ↗", "Open in Maps ↗")),
            // C37: رسالة موقع ⇒ منزل قريبٍ في صلة الرحم (يلتقطها AppInner)
            React.createElement("button", { onClick: (e) => { e.stopPropagation(); try { window.dispatchEvent(new CustomEvent("sawa-save-home", { detail: { lat, lng, label: m.text || "" } })); } catch (x) { } }, className: "text-[11px] font-bold underline", style: { color: mine ? "#ffffffdd" : colors.textMuted } }, tl("احفظه منزلاً لقريب", "Save as a relative's home")))));
}
function ChatScreen({ conversation, messages, onSend, onForward, onReact, onSendSticker, onSendFile, onSendVoice, onEditMessage, onMarkViewedOnce, onTogglePin, onToggleStar, onOpenInfo, disappearing, setDisappearing, background, onBack, myUserId, isBlocked, allConversations, allGroups, isTyping, onLogCall, isOnline, callSettings, groupPersons = {}, onDeleteMessage, onOpenFamilyProfile, draft = "", onSaveDraft, unreadCount = 0, onTyping, contactsForForward, }) {
    var _a, _b;
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [text, setText, clearDraft] = useChatDraft(draft, onSaveDraft, onTyping);
    const initialUnreadRef = useRef(unreadCount);
    // C47: الفاصل يثبت عند أوّل رسالةٍ كانت غير مقروءة عند الفتح — كان يُحسب من طول القائمة فينزلق مع كلّ رسالةٍ جديدة أو مرسَلة
    const dividerIdRef = useRef(null);
    if (dividerIdRef.current === null && messages.length) { const di = unreadDividerIndex(messages.length, initialUnreadRef.current); dividerIdRef.current = di > 0 && messages[di] ? messages[di].id : false; }
    const online = useOnline();
    const [replyTo, setReplyTo] = useState(null);
    const [reactingTo, setReactingTo] = useState(null);
    const [msgMenu, setMsgMenu] = useState(null); // {id, text, mine, type} | null
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [activeCall, setActiveCall] = useState(null); // null | "audio" | "video"
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [deletingMsg, setDeletingMsg] = useState(null); // {id, mine} | null
    const [sharingContact, setSharingContact] = useState(false);
    const [editingText, setEditingText] = useState("");
    const recorder = useVoiceRecorder({
        transcribe: true,
        onComplete: (url, duration, transcript, blob, secs) => onSendVoice(url, duration, transcript, blob, secs),
    });
    const [showSearch, setShowSearch] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [viewOnceNext, setViewOnceNext] = useState(false);
    const [forwardingText, setForwardingText] = useState(null);
    const [showCallChoice, setShowCallChoice] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const scrollContainerRef = useRef(null);
    useStickToBottom(scrollContainerRef, messages.length + ":" + (isTyping ? 1 : 0));
    const [viewingImage, setViewingImage] = useState(null);
    const [searchQueryW, setSearchQueryW] = useState("");
    const win = useMessageWindow(messages, unreadCount, !!searchQueryW.trim(), scrollContainerRef);
    // كل صور وفيديوهات المحادثة بالترتيب — تُمرَّر للمعاينة لتمكين التنقّل
    const mediaItems = useMemo(() => (messages || [])
        .filter((m) => (m.type === "image" || m.type === "video") && m.fileUrl && !m.deleted)
        .map((m) => ({ id: m.id, url: m.fileUrl, type: m.type, name: m.fileName || m.text || "" })), [messages]);
    const mediaInputRef = useRef(null);
    const searchQuery = searchQueryW, setSearchQuery = setSearchQueryW;
    const [searchMatchIndex, setSearchMatchIndex] = useState(0);
    const searchMatches = searchQuery.trim()
        ? messages.filter((m) => {
            const q = searchQuery.trim().toLowerCase();
            const text = (m.text || "").toLowerCase();
            const transcript = (m.transcript || "").toLowerCase();
            const fileName = (m.type === "file" ? m.text || "" : "").toLowerCase();
            return text.includes(q) || transcript.includes(q) || fileName.includes(q);
        }).map((m) => m.id)
        : [];
    const currentMatchId = searchMatches[searchMatchIndex] || null;
    const pinnedMessage = conversation.pinnedMessageId ? messages.find((m) => m.id === conversation.pinnedMessageId) : null;
    const fileInputRef = useRef(null);
    const bgGradient = (_a = CHAT_THEMES.find((b) => b.key === background)) === null || _a === void 0 ? void 0 : _a.gradient;
    const myBubbleColor = ((_b = CHAT_THEMES.find((b) => b.key === background)) === null || _b === void 0 ? void 0 : _b.bubbleColor) || colors.primary;

    useEffect(() => {
        var _a;
        if (currentMatchId) {
            (_a = document.querySelector(`[data-message-id="${currentMatchId}"]`)) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMatchId]);
    function handleSend() {
        if (!text.trim())
            return;
        onSend(text.trim(), replyTo);
        clearDraft();
        setReplyTo(null);
    }
    if (activeCall) {
        return (React.createElement(CallOverlay, { contactName: conversation.name, callType: activeCall, availableContacts: (allConversations || []).filter((x) => !x.isSavedMessages).map((x) => x.name), requireApproval: callSettings === null || callSettings === void 0 ? void 0 : callSettings.requireApproval, onEnd: (duration, wasConnected, participants) => {
                onLogCall(conversation.name, activeCall, duration, wasConnected, participants);
                setActiveCall(null);
            } }));
    }
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col relative" },
        React.createElement(TopBar, { title: conversation.isSavedMessages ? t("rsayly_almhfwza") : conversation.name, avatar: !conversation.isSavedMessages, photo: conversation.photo || null, subtitle: !online ? tl("أنت غير متّصل", "You're offline") : isTyping ? t("ch_yktb") : (isOnline ? t("ch_mtsl_alan") : null), onBack: onBack, actions: React.createElement("div", { className: "flex flex-row items-center gap-3" },
                React.createElement("button", { "aria-label": t("bhth"), onClick: () => setShowSearch(!showSearch) },
                    React.createElement(Search, { size: 18, color: "#fff" })),
                !conversation.isSavedMessages && (React.createElement("button", { "aria-label": t("atsal"), onClick: () => setShowCallChoice(!showCallChoice) },
                    React.createElement(Phone, { size: 18, color: "#fff" }))),
                React.createElement("button", { "aria-label": t("malwmat"), onClick: onOpenInfo },
                    React.createElement(MoreVertical, { size: 18, color: "#fff" }))) }),
        showSearch && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-3 py-2 border-b`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: searchQuery, onChange: (e) => { setSearchQuery(e.target.value); setSearchMatchIndex(0); }, placeholder: t("bhth_balmhadtha"), className: "flex-1 rounded-full px-3 py-1.5 text-xs border", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg, minWidth: 0 }, autoFocus: true }),
            searchQuery.trim() && (React.createElement("span", { className: "text-[10px] shrink-0 font-bold", style: { color: colors.textMuted } }, searchMatches.length > 0 ? `${searchMatchIndex + 1}/${searchMatches.length}` : t("ch_la_ntayj"))),
            searchMatches.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("button", { className: "w-6 h-6 flex items-center justify-center", onClick: () => setSearchMatchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length) },
                    React.createElement(ChevronUp, { size: 15, color: colors.textMuted })),
                React.createElement("button", { className: "w-6 h-6 flex items-center justify-center", onClick: () => setSearchMatchIndex((i) => (i + 1) % searchMatches.length) },
                    React.createElement(ChevronDown, { size: 15, color: colors.textMuted })))),
            React.createElement("button", { "aria-label": t("ighlaq"), className: "w-6 h-6 flex items-center justify-center", onClick: () => { setShowSearch(false); setSearchQuery(""); } },
                React.createElement(X, { size: 15, color: colors.textMuted })))),
        showCallChoice && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setShowCallChoice(false), style: { position: "fixed", inset: 0, zIndex: 15 } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", top: "3.5rem", left: "1rem", zIndex: 20, backgroundColor: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", overflow: "hidden" } },
                React.createElement("button", { onClick: () => { setShowCallChoice(false); if (conversation.cloud && conversation.peerUid && cloudCallTo({ uid: conversation.peerUid, name: conversation.name }, "audio")) return; if (conversation.cloud) { showToast(CALL_FAIL_MSG(), "error"); return; } setActiveCall("audio"); }, className: `w-full flex ${rowStart()} items-center gap-2 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 160 } },
                    React.createElement(Phone, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mkalma_swtya"))),
                React.createElement("button", { onClick: () => { setShowCallChoice(false); if (conversation.cloud && conversation.peerUid && cloudCallTo({ uid: conversation.peerUid, name: conversation.name }, "video")) return; if (conversation.cloud) { showToast(CALL_FAIL_MSG(), "error"); return; } setActiveCall("video"); }, className: `w-full flex ${rowStart()} items-center gap-2 px-4 py-3` },
                    React.createElement(Video, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mkalma_fydyw")))))),
        (() => {
            if (conversation.isSavedMessages)
                return null;
            const allFP = typeof groupPersons !== "undefined"
                ? Object.values(groupPersons || {}).flat()
                : [];
            const fp = allFP.find(p => {
                var _a;
                return p.alive && conversation.name &&
                    ((_a = p.local_name) === null || _a === void 0 ? void 0 : _a.split(" ")[0]) &&
                    conversation.name.toLowerCase().includes(p.local_name.split(" ")[0].toLowerCase());
            });
            if (!fp)
                return null;
            const days = daysSinceRef(fp);
            const overdue = isContactOverdue(fp);
            return (React.createElement("button", { onClick: () => onOpenFamilyProfile === null || onOpenFamilyProfile === void 0 ? void 0 : onOpenFamilyProfile(fp), className: `w-full flex ${rowStart()} items-center gap-2 px-3 py-1.5 border-b`, style: {
                    backgroundColor: overdue ? "#ef444412" : colors.accent + "12",
                    borderColor: overdue ? "#ef444430" : colors.accent + "30",
                } },
                React.createElement("span", { style: { fontSize: 14 } }, overdue ? "⚠️" : "🤍"),
                React.createElement("span", { className: `flex-1 text-[11px] ${textStart()}`, style: { color: overdue ? "#ef4444" : colors.accent } },
                    fp.local_name,
                    " \u2014 ",
                    kinshipLabel(fp.kinship),
                    t("ch_akhr_twasl"),
                    days === 0 ? t("ch_alywm") : days + t("ch_ywm")),
                React.createElement("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full", style: { backgroundColor: overdue ? "#ef444420" : colors.accent + "20", color: overdue ? "#ef4444" : colors.accent } },
                    proxLabel(fp.proximity),
                    " \u2190")));
        })(),
        !online && React.createElement(OfflineBar, null),
        pinnedMessage && (React.createElement("button", { "aria-label": t("tthbyt"), onClick: () => { const go = () => { var _a; return (_a = document.querySelector(`[data-message-id="${pinnedMessage.id}"]`)) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "center" }); }; if (document.querySelector(`[data-message-id="${pinnedMessage.id}"]`)) go(); else { win.more(Infinity); setTimeout(go, 60); } }, className: `w-full flex ${rowStart()} items-center gap-2 px-3 py-2 border-b`, style: { borderColor: colors.border, backgroundColor: colors.primaryLight } },
            React.createElement(Pin, { size: 12, color: colors.primary, fill: colors.primary }),
            React.createElement("span", { className: `text-[11px] font-bold flex-1 ${textStart()} truncate`, style: { color: colors.primaryDark } }, pinnedMessage.text))),
        React.createElement("div", { style: { position: "relative", flex: 1, minHeight: 0 } },
            React.createElement("div", { ref: scrollContainerRef, className: "flex-1 overflow-y-auto p-4", style: { background: bgGradient || colors.bg, height: "100%", overflowY: "auto" }, onScroll: (e) => {
                    const el = e.currentTarget;
                    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                    setShowScrollBtn(distFromBottom > 120);
                    if (win.hidden > 0 && el.scrollTop < 80) win.more();
                } },
                messages.length === 0 && !isTyping && React.createElement(EmptyChatState, { icon: MessageCircle }),
                win.hidden > 0 && React.createElement(OlderButton, { hidden: win.hidden, onMore: win.more }),
                win.shown.map((m, mi) => {
                    const mine = m.senderUserId === myUserId;
                    const prevM = mi > 0 ? win.shown[mi - 1] : null;
                    const dayLabel = (m.createdAt && (!prevM || dayKeyOf(prevM.createdAt) !== dayKeyOf(m.createdAt)) && (prevM || win.hidden === 0)) ? dayLabelOf(m.createdAt) : null;
                    if (m.type === "system") return (React.createElement(React.Fragment, { key: m.id }, dayLabel && React.createElement(DayDivider, { label: dayLabel }), React.createElement("div", { className: "flex justify-center my-2" },
                        React.createElement("span", { className: "text-[10.5px] px-3 py-1 rounded-2xl text-center leading-5", style: { backgroundColor: colors.border + "88", color: colors.textMuted, maxWidth: "88%" } }, m.text))));
                    // فقاعات الصور والفيديو والملصقات خلفيتها شفافة لا ملوّنة،
                    // فالنص الأبيض عليها غير مقروء.
                    const onTint = mine && !(["sticker", "image", "video"].includes(m.type) && !m.viewOnce);
                    // فاصل يوضّح أين توقّفت القراءة
                    const showDivider = dividerIdRef.current && m.id === dividerIdRef.current;
                    return (React.createElement(React.Fragment, { key: m.id },
                        dayLabel && React.createElement(DayDivider, { label: dayLabel }),
                        showDivider && React.createElement(UnreadDivider, null),
                        React.createElement("div", { "data-message-id": m.id, className: "flex flex-col mb-1 rounded-lg transition-colors", style: { alignItems: mine ? "flex-start" : "flex-end", backgroundColor: m.id === currentMatchId ? colors.accent + "33" : "transparent" } },
                        m.forwarded && (React.createElement("span", { className: `text-[9px] mb-0.5 flex ${rowStart()} items-center gap-1`, style: { color: colors.textMuted } },
                            React.createElement(Send, { size: 9, style: { transform: "scaleX(-1)" } }),
                            t("rsala_mwjha"))),
                        React.createElement("div", { className: `max-w-[78%] rounded-2xl border ${["sticker", "image", "video"].includes(m.type) && !m.viewOnce ? "" : "px-3 py-2"}`, style: { backgroundColor: ["sticker", "image", "video"].includes(m.type) && !m.viewOnce ? "transparent" : mine ? myBubbleColor : colors.card, borderColor: ["sticker", "image", "video"].includes(m.type) && !m.viewOnce ? "transparent" : colors.border, cursor: "pointer", borderRadius: ["sticker", "image", "video"].includes(m.type) && !m.viewOnce ? 16 : (mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px"), boxShadow: ["sticker", "image", "video"].includes(m.type) && !m.viewOnce ? "none" : "0 1px 1.5px rgba(0,0,0,0.10)" }, onContextMenu: (e) => { e.preventDefault(); setMsgMenu({ id: m.id, text: m.text, mine, type: m.type, starred: m.starred, pinned: conversation.pinnedMessageId === m.id }); }, onTouchStart: (e) => { const t0 = Date.now(); const onEnd = () => { if (Date.now() - t0 > 500)
                                setMsgMenu({ id: m.id, text: m.text, mine, type: m.type, starred: m.starred, pinned: conversation.pinnedMessageId === m.id }); e.target.removeEventListener("touchend", onEnd); }; e.target.addEventListener("touchend", onEnd); } },
                            m.replyToText && (React.createElement("div", { className: "rounded-xl px-2 py-1 mb-1 text-[10px] border-r-2", style: { backgroundColor: mine ? "rgba(255,255,255,0.15)" : colors.bg, borderColor: colors.accent, color: mine ? "#ffffffcc" : colors.textMuted } }, m.replyToText)),
                            m.type === "sticker" ? (React.createElement("span", { className: "text-4xl" }, m.text)) : m.type === "image" && m.viewOnce ? (m.viewedOnce ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-2 py-3`, style: { minWidth: 160 } },
                                React.createElement("span", { style: { fontSize: 16 } }, "\uD83D\uDD25"),
                                React.createElement("span", { className: "text-xs font-bold", style: { color: mine ? "#fff" : colors.textMuted } }, t("tm_fthha_ard_lmra")))) : (React.createElement("button", { onClick: () => { onMarkViewedOnce(m.id); setViewingImage(m.fileUrl); }, className: "flex flex-col items-center justify-center gap-1.5 py-6", style: { minWidth: 160 } },
                                React.createElement("span", { style: { fontSize: 22 } }, "\uD83D\uDD25"),
                                React.createElement("span", { className: "text-xs font-bold", style: { color: mine ? "#fff" : colors.text } }, t("swra_lmra_wahda")),
                                React.createElement("span", { className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } }, t("adght_llard_tkhtfy_badha"))))) : m.type === "image" ? (m.fileUrl ? (React.createElement("button", { onClick: () => setViewingImage(m.fileUrl), className: "block -m-1" }, m.fileUrl ? React.createElement("img", { src: m.fileUrl, alt: m.text, className: "rounded-xl max-h-56 w-full object-cover", style: { minWidth: 160 } }) : React.createElement(MediaUnavailable, { label: t("swra") }))) : React.createElement(MediaUnavailable, { label: t("swra") })) : m.type === "video" ? (m.fileUrl
                                ? React.createElement("video", { src: m.fileUrl, controls: true, className: "rounded-xl max-h-56 w-full", style: { minWidth: 200 } })
                                : React.createElement(MediaUnavailable, { label: t("fydyw") })) : m.type === "file" ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2`, onClick: () => { if (m.cloudMid && window.SawaChat) window.SawaChat.openFile(m); }, style: { cursor: m.cloudMid ? "pointer" : "default" } },
                                React.createElement(FileIconLucide, { size: 18, color: mine ? "#fff" : colors.primary }),
                                React.createElement("div", null,
                                    React.createElement("div", { className: "text-xs font-bold", style: { color: mine ? "#fff" : colors.text } }, m.text),
                                    React.createElement("div", { className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } },
                                        (m.fileSize / 1024).toFixed(0),
                                        t("ch_kylwbayt"))))) : m.type === "location" ? React.createElement(LocationBubble, { m, mine }) : m.type === "voice" ? (React.createElement(VoiceMessageBubble, { loading: !!m.mediaLoading, failed: !!m.mediaFailed, cid: m.cloudCid || null, mid: m.cloudMid || null, url: m.audioUrl, duration: m.duration, mine: mine, transcript: m.transcript })) : editingMessageId === m.id ? (React.createElement("div", { className: "flex flex-col gap-1.5" },
                                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: editingText, onChange: (e) => setEditingText(e.target.value), onKeyDown: (e) => { if (e.key === "Enter" && editingText.trim()) { e.preventDefault(); onEditMessage(m.id, editingText.trim()); setEditingMessageId(null); } else if (e.key === "Escape") setEditingMessageId(null); }, className: "text-sm rounded px-2 py-1", style: { backgroundColor: mine ? "rgba(255,255,255,0.15)" : colors.bg, color: mine ? "#fff" : colors.text, border: `1px solid ${mine ? "#ffffff55" : colors.border}` }, autoFocus: true }),
                                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                                    React.createElement("button", { onClick: () => { onEditMessage(m.id, editingText.trim()); setEditingMessageId(null); }, className: "text-[10px] font-bold", style: { color: mine ? "#fff" : colors.primary } }, t("hfz")),
                                    React.createElement("button", { onClick: () => setEditingMessageId(null), className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } }, t("ilgha"))))) : (React.createElement("span", { className: "text-sm", style: { color: mine ? "#fff" : colors.text } },
                                renderRichText(m.text, { mine, colors }),
                                m.edited && React.createElement("span", { className: "text-[10px] opacity-70" }, t("ch_madla")),
                                (!m.type || m.type === "text") && urlsIn(m.text).length ? React.createElement(LinkCard, { text: m.text, mine }) : null)), React.createElement("div", { className: `flex ${rowStart()} items-center gap-1 justify-end`, style: { marginTop: 2, marginBottom: -2 } }, mine && m.status && (React.createElement("span", { title: m.status === "read" ? t("ch_tmt_alqraa") : m.status === "delivered" ? t("ch_tm_altslym") : m.status === "pending" ? t("c2_pending") : m.status === "failed" ? t("c2_failed") : t("ch_tm_alirsal") }, m.status === "pending" ? (m.uploadPct != null ? React.createElement("span", { className: "text-[10px] font-bold", style: { color: onTint ? "rgba(255,255,255,0.9)" : colors.textMuted } }, "⏫ " + m.uploadPct + "%") : React.createElement(Clock, { size: 11, color: onTint ? "rgba(255,255,255,0.85)" : colors.textMuted })) : m.status === "failed" ? React.createElement("button", { onClick: (e) => { e.stopPropagation(); if (window.SawaChat && window.SawaChat.failedSheet) window.SawaChat.failedSheet(m.id); }, className: "inline-flex items-center gap-1", style: { color: colors.danger, fontSize: 10, fontWeight: 700 } }, React.createElement(AlertCircle, { size: 12, color: colors.danger }), tl("لم تُرسل · اضغط", "Not sent · tap")) : m.status === "sent" ? React.createElement(Check, { size: 12, color: onTint ? "rgba(255,255,255,0.85)" : colors.textMuted }) : React.createElement(CheckCheck, { size: 12, color: m.status === "read" ? (onTint ? "#BFE3FF" : colors.primary) : (onTint ? "rgba(255,255,255,0.85)" : colors.textMuted) }))), React.createElement("span", { className: "text-[10px]", style: { color: onTint ? "rgba(255,255,255,0.75)" : colors.textMuted } }, m.time || (m.createdAt ? new Date(m.createdAt).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }) : "")))),
                        m.reaction && React.createElement("span", { className: "text-xs mt-0.5" }, m.reaction))));
                }),
                isTyping && (React.createElement("div", { className: "flex flex-col mb-2 items-end" },
                    React.createElement("div", { className: "rounded-2xl border px-4 py-3", style: { backgroundColor: colors.card, borderColor: colors.border } },
                        React.createElement("div", { className: `flex ${rowStart()} gap-1` },
                            React.createElement("span", { className: "w-1.5 h-1.5 rounded-full animate-bounce", style: { backgroundColor: colors.textMuted, animationDelay: "0ms" } }),
                            React.createElement("span", { className: "w-1.5 h-1.5 rounded-full animate-bounce", style: { backgroundColor: colors.textMuted, animationDelay: "150ms" } }),
                            React.createElement("span", { className: "w-1.5 h-1.5 rounded-full animate-bounce", style: { backgroundColor: colors.textMuted, animationDelay: "300ms" } })))))),
            showScrollBtn && (React.createElement("button", { onClick: () => { const el = scrollContainerRef.current; if (el)
                    el.scrollTop = el.scrollHeight; setShowScrollBtn(false); }, style: { position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10, backgroundColor: colors.primary, color: "#fff", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 4 } },
                React.createElement(ChevronDown, { size: 13, color: "#fff" }),
                t("ch_rsayl_jdyda")))),
        replyTo && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-3 py-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => setReplyTo(null) },
                React.createElement(X, { size: 14, color: colors.textMuted })),
            React.createElement("span", { className: "text-xs flex-1 truncate", style: { color: colors.textMuted } },
                t("ch_alrd_ala"),
                replyTo.text))),
        showStickerPicker && (React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 p-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } }, STICKER_SET.map((s) => (React.createElement("button", { key: s, onClick: () => { onSendSticker(s); setShowStickerPicker(false); }, className: "w-10 h-10 rounded-xl flex items-center justify-center text-xl", style: { backgroundColor: colors.bg } }, s))))),
        conversation.e2e ? React.createElement(E2eBar, { e2e: conversation.e2e }) : null,
        isBlocked ? (React.createElement("div", { className: `flex ${rowStart()} items-center justify-center gap-2 p-3 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(Ban, { size: 14, color: colors.danger }),
            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.danger } }, t("hzrt_hdha_alshkhs_algh")))) : (conversation.e2e && conversation.e2e.state !== "ready") ? null : (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-2 border-t relative`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("input", { ref: mediaInputRef, type: "file", accept: "image/*,video/*", multiple: !viewOnceNext, onChange: (e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    setShowAttachMenu(false);
                    if (files.length === 0)
                        return;
                    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
                    const validFiles = files.filter((f) => f.size <= MAX_FILE_SIZE_BYTES);
                    if (oversized.length > 0) {
                        showToast(`تعذّر إرسال ${oversized.length > 1 ? `${oversized.length} ملفات` : oversized[0].name} — الحد الأقصى ${MAX_FILE_SIZE_LABEL} في المعاينة`, "error");
                    }
                    if (validFiles.length === 0)
                        return;
                    const wasViewOnce = viewOnceNext;
                    setViewOnceNext(false);
                    // كل صورة/فيديو تُقرأ وتُرسَل كرسالة منفصلة — نفس سلوك واتساب
                    // بالضبط عند اختيار عدة صور دفعة واحدة من المعرض
                    validFiles.forEach((file) => {
                        const isVideo = file.type.startsWith("video/");
                        const reader = new FileReader();
                        reader.onload = (ev) => onSendFile(file.name, file.size, ev.target.result, isVideo ? "video" : "image", wasViewOnce, file);
                        reader.readAsDataURL(file);
                    });
                }, className: "hidden" }),
            React.createElement("input", { ref: fileInputRef, type: "file", onChange: (e) => {
                    var _a;
                    const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    e.target.value = "";
                    setShowAttachMenu(false);
                    if (!file)
                        return;
                    if (file.size > MAX_FILE_SIZE_BYTES) {
                        showToast(`تعذّر إرسال ${file.name} (${formatFileSize(file.size)}) — الحد الأقصى ${MAX_FILE_SIZE_LABEL} في المعاينة`, "error");
                        return;
                    }
                    onSendFile(file.name, file.size, null, "file", false, file);
                }, className: "hidden" }),
            showAttachMenu && (React.createElement(React.Fragment, null,
                React.createElement("div", { onClick: () => setShowAttachMenu(false), className: "sawa-fade-in", style: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 30 } }),
                React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 31, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 16 } },
                    React.createElement("div", { className: "flex justify-center pt-3 pb-4" },
                        React.createElement("div", { style: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border } })),
                    React.createElement("div", { className: "grid grid-cols-3 gap-3 px-5" },
                        React.createElement("button", { onClick: () => { var _a; return (_a = mediaInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "flex flex-col items-center gap-2 py-3" },
                            React.createElement("div", { className: "w-14 h-14 rounded-2xl flex items-center justify-center", style: { backgroundColor: colors.accent + "1a" } },
                                React.createElement(Image, { size: 24, color: colors.accent })),
                            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, t("swra_aw_fydyw"))),
                        React.createElement("button", { onClick: () => { var _a; setViewOnceNext(true); (_a = mediaInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "flex flex-col items-center gap-2 py-3" },
                            React.createElement("div", { className: "w-14 h-14 rounded-2xl flex items-center justify-center", style: { backgroundColor: colors.danger + "1a" } },
                                React.createElement("span", { className: "text-sm font-extrabold", style: { color: colors.danger } }, "1x")),
                            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, t("lmra_wahda"))),
                        React.createElement("button", { onClick: () => { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "flex flex-col items-center gap-2 py-3" },
                            React.createElement("div", { className: "w-14 h-14 rounded-2xl flex items-center justify-center", style: { backgroundColor: colors.primary + "1a" } },
                                React.createElement(FileIconLucide, { size: 24, color: colors.primary })),
                            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, t("mstnd"))),
                        window.SawaChat && window.SawaChat.sendLocation && conversation.cloud !== false && React.createElement("button", { onClick: () => { setShowAttachMenu(false); window.SawaChat.sendLocation(conversation.id); }, className: "flex flex-col items-center gap-2 py-3" },
                            React.createElement("div", { className: "w-14 h-14 rounded-2xl flex items-center justify-center", style: { backgroundColor: "#E539351a" } },
                                React.createElement(MapPin, { size: 24, color: "#E53935" })),
                            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, tl("الموقع", "Location"))),
                        React.createElement("button", { onClick: () => { setShowAttachMenu(false); setSharingContact(true); }, className: "flex flex-col items-center gap-2 py-3" },
                            React.createElement("div", { className: "w-14 h-14 rounded-2xl flex items-center justify-center", style: { backgroundColor: "#22C55E1a" } },
                                React.createElement(User, { size: 24, color: "#22C55E" })),
                            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, t("jha_atsal"))))))),
            React.createElement("button", { "aria-label": t("irfaq"), onClick: () => setShowAttachMenu(!showAttachMenu), className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: showAttachMenu ? colors.primary : colors.bg } },
                React.createElement(Paperclip, { size: 16, color: showAttachMenu ? "#fff" : colors.textMuted })),
            React.createElement("button", { "aria-label": t("rmwz_tabyrya"), onClick: () => setShowStickerPicker(!showStickerPicker), className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: colors.bg } },
                React.createElement(Smile, { size: 16, color: colors.textMuted })),
            React.createElement(ChatComposerInput, { value: text, onChange: setText, placeholder: t("aktb_rsala"), disabled: recorder.isRecording, onEnter: handleSend }),
            text.trim() ? (React.createElement("button", { "aria-label": t("irsal"), onClick: handleSend, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary } },
                React.createElement(Send, { size: 16, color: "#fff", style: { transform: "scaleX(-1)" } }))) : recorder.isRecording ? (React.createElement("button", { "aria-label": tl("إرسال التسجيل", "Send recording"), onClick: recorder.stop, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger } },
                React.createElement(Square, { size: 14, color: "#fff", fill: "#fff" }))) : (React.createElement("button", { "aria-label": t("ch_tsjyl_swtya"), onClick: recorder.start, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.accent }, title: t("adght_bastmrar_lltsjyl") },
                React.createElement(Mic, { size: 16, color: "#fff" }))))),
        sharingContact && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setSharingContact(false), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.4)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 12, maxHeight: "70%", display: "flex", flexDirection: "column" } },
                React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto my-3 shrink-0", style: { backgroundColor: colors.border } }),
                React.createElement("p", { className: "text-sm font-extrabold text-center mb-2 px-4 shrink-0", style: { color: colors.text } }, t("msharka_jha_atsal")),
                React.createElement("div", { className: "overflow-y-auto px-3 pb-2" }, (allConversations || []).filter((x) => !x.isSavedMessages && x.id !== conversation.id).map((x) => (React.createElement("button", { key: x.id, onClick: () => { onSend(t("ch_jha_atsal") + x.name, null); setSharingContact(false); }, className: `w-full flex ${rowStart()} items-center gap-3 px-2 py-2.5 rounded-xl border-b`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primaryLight } },
                        React.createElement(User, { size: 17, color: colors.primaryDark })),
                    React.createElement("span", { className: `flex-1 ${textStart()} text-sm font-bold truncate`, style: { color: colors.text } }, x.name)))))))),
        msgMenu && (() => {
            const MsgMenuSheet = () => {
                const [showReactions, setShowReactions] = React.useState(false);
                return (React.createElement(React.Fragment, null,
                    React.createElement("div", { onClick: () => setMsgMenu(null), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.35)" } }),
                    React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 16 } },
                        React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto my-3", style: { backgroundColor: colors.border } }),
                        showReactions && (React.createElement("div", { className: `flex ${rowStart()} gap-3 px-5 py-3 border-b`, style: { borderColor: colors.border } }, QUICK_REACTIONS.map((e) => (React.createElement("button", { key: e, onClick: () => { onReact(msgMenu.id, e); setShowReactions(false); setMsgMenu(null); }, className: "text-xl" }, e))))),
                        [
                            { icon: Smile, label: t("tfaal"), act: () => setShowReactions((v) => !v), toggle: true },
                            { icon: MessageCircle, label: t("rd"), act: () => setReplyTo({ id: msgMenu.id, text: msgMenu.text }) },
                            { icon: Share2, label: t("twjyh_2"), act: () => setForwardingText({ id: msgMenu.id, text: msgMenu.text, cid: conversation.id }) },
                            ...(msgMenu.text && msgMenu.type !== "sticker" && msgMenu.type !== "voice" && msgMenu.type !== "image" && msgMenu.type !== "video" ? [{ icon: Copy, label: t("nskh"), act: () => { copyText(msgMenu.text || ""); showToast(t("gc_tm_alnskh"), "success"); } }] : []),
                            { icon: Pin, label: msgMenu.pinned ? t("ch_ilgha_altthbyt") : t("tthbyt"), act: () => onTogglePin(msgMenu.id) },
                            { icon: Star, label: msgMenu.starred ? t("ch_ilgha_alhfz") : t("hfz_alrsala"), act: () => onToggleStar(msgMenu.id, msgMenu.text) },
                            ...(msgMenu.mine && msgMenu.type !== "sticker" && msgMenu.type !== "voice" ? [{ icon: Edit2, label: t("tadyl"), act: () => { setEditingMessageId(msgMenu.id); setEditingText(msgMenu.text); } }] : []),
                            { icon: Trash2, label: t("hdhf"), act: () => setDeletingMsg({ id: msgMenu.id, mine: msgMenu.mine }), danger: true },
                        ].map((it) => (React.createElement("button", { key: it.label, onClick: () => { it.act(); if (!it.toggle)
                                setMsgMenu(null); }, className: `w-full flex ${rowStart()} items-center gap-3 px-5 py-3.5 border-t`, style: { borderColor: colors.border, backgroundColor: it.toggle && showReactions ? colors.primaryLight : "transparent" } },
                            React.createElement(it.icon, { size: 17, color: it.danger ? colors.danger : it.toggle && showReactions ? colors.primary : colors.textMuted }),
                            React.createElement("span", { className: `flex-1 ${textStart()} text-sm font-bold`, style: { color: it.danger ? colors.danger : it.toggle && showReactions ? colors.primary : colors.text } }, it.label)))))));
            };
            return React.createElement(MsgMenuSheet, null);
        })(),
        deletingMsg && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setDeletingMsg(null), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.35)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 12 } },
                React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto my-3", style: { backgroundColor: colors.border } }),
                React.createElement("p", { className: "text-sm font-extrabold text-center mb-1 px-4", style: { color: colors.text } }, t("hdhf_alrsala")),
                React.createElement("button", { onClick: () => { onDeleteMessage === null || onDeleteMessage === void 0 ? void 0 : onDeleteMessage(deletingMsg.id, "me"); setDeletingMsg(null); }, className: `w-full flex ${rowStart()} items-center gap-3 px-5 py-3.5 border-t`, style: { borderColor: colors.border } },
                    React.createElement(Trash2, { size: 17, color: colors.textMuted }),
                    React.createElement("span", { className: `flex-1 ${textStart()} text-sm font-bold`, style: { color: colors.text } }, t("hdhf_andy_fqt"))),
                deletingMsg.mine && (React.createElement("button", { onClick: () => { onDeleteMessage === null || onDeleteMessage === void 0 ? void 0 : onDeleteMessage(deletingMsg.id, "all"); setDeletingMsg(null); }, className: `w-full flex ${rowStart()} items-center gap-3 px-5 py-3.5 border-t`, style: { borderColor: colors.border } },
                    React.createElement(Trash2, { size: 17, color: colors.danger }),
                    React.createElement("span", { className: `flex-1 ${textStart()} text-sm font-bold`, style: { color: colors.danger } }, t("hdhf_and_aljmya")))),
                React.createElement("button", { onClick: () => setDeletingMsg(null), className: "w-full px-5 py-3.5 border-t text-sm font-bold", style: { borderColor: colors.border, color: colors.textMuted } }, t("ilgha"))))),
        !conversation.isSavedMessages && (() => {
            const allFP = Object.values(groupPersons || {}).flat();
            const fp = allFP.find(p => {
                var _a;
                return p.alive && conversation.name &&
                    ((_a = p.local_name) === null || _a === void 0 ? void 0 : _a.split(" ")[0]) &&
                    conversation.name.toLowerCase().includes(p.local_name.split(" ")[0].toLowerCase());
            });
            if (!fp)
                return null;
            const lastMsg = messages[messages.length - 1];
            const daysSinceLast = lastMsg ? Math.floor((Date.now() - lastMsg.createdAt) / 86400000) : 999;
            if (messages.length > 0 && daysSinceLast < 7)
                return null;
            const suggestions = [
                t("ch_qr1"),
                t("ch_qr2"),
                t("ch_qr3"),
            ];
            return (React.createElement("div", { className: "px-3 py-2 border-t", style: { borderColor: colors.border } },
                React.createElement("p", { className: `text-[10px] ${textStart()} mb-1.5 font-bold`, style: { color: colors.textMuted } },
                    t("ch_rdwd_srya"),
                    fp.local_name,
                    ":"),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 flex-wrap` }, suggestions.map((s, i) => (React.createElement("button", { key: i, onClick: () => onSend(s, null), className: "px-3 py-1.5 rounded-full text-[11px] font-bold border", style: { borderColor: colors.accent + "60", color: colors.accent, backgroundColor: colors.accent + "10" } }, s))))));
        })(),
        React.createElement(RecordingBar, { isRecording: recorder.isRecording, seconds: recorder.seconds, micError: recorder.micError, onCancel: recorder.cancel, maxSeconds: recorder.maxSeconds }),
        viewingImage && (React.createElement(MediaLightbox, { items: mediaItems, startIndex: Math.max(0, mediaItems.findIndex((it) => it.url === viewingImage)), onClose: () => setViewingImage(null), onForward: (it) => { setViewingImage(null); setForwardingText({ id: it.id, text: it.name, cid: conversation.id }); } })),
        forwardingText && (React.createElement(ForwardPickerScreen, { conversations: allConversations, groups: allGroups, contacts: contactsForForward, currentConversationId: conversation.id, onForward: (destinationIds) => { onForward(forwardingText, destinationIds); setForwardingText(null); }, onClose: () => setForwardingText(null) }))));
}
const GROUP_ADMIN_ACTIONS = ["تسمية المجموعة", "إدارة الأعضاء"];
// C24: نافذة أدوات المجموعة (استطلاع · فاتورة · تبرّعات · مهامّ) — من الأسفل، بعنوانٍ وزرّ إغلاق، وتُغلق بالضغط خارجها أو بزرّ الرجوع
function ToolSheet({ title, onClose, children }) {
    const { colors } = useTheme();
    useEffect(() => {
        const k = (e) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", k);
        // زرّ الرجوع في أندرويد يغلق النافذة بدل أن يخرج من المحادثة
        let popped = false;
        const pop = () => { popped = true; onClose(); };
        try { history.pushState({ sawaSheet: 1 }, ""); window.addEventListener("popstate", pop); } catch (e) { }
        return () => { window.removeEventListener("keydown", k); window.removeEventListener("popstate", pop); if (!popped) { try { if (history.state && history.state.sawaSheet) history.back(); } catch (e) { } } };
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { onClick: onClose, className: "sawa-fade-in", style: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.42)", zIndex: 40 } }),
        React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": title, className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "86vh", display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: "0 -8px 30px rgba(0,0,0,0.18)" } },
            React.createElement("div", { className: "flex justify-center pt-2" },
                React.createElement("div", { style: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border } })),
            React.createElement("div", { className: "flex flex-row items-center justify-between px-4 pt-1 pb-2 border-b", style: { borderColor: colors.border } },
                React.createElement("p", { className: "text-sm font-extrabold", style: { color: colors.text } }, title),
                React.createElement("button", { "aria-label": tl("إغلاق", "Close"), onClick: onClose, className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: colors.bg } },
                    React.createElement(X, { size: 17, color: colors.text }))),
            React.createElement("div", { className: "px-4 pt-3 pb-4 overflow-y-auto", style: { flex: 1, minHeight: 0 } }, children))));
}
function GroupChatScreen({ group, messages, myUserId, onSend, onSendFile, onSendVoice, onEditMessage, onReact, onDeleteMessage, onTyping, contactsForForward, onSendSticker, contacts = null, onInviteLink, onUpdateGroup, onCreatePoll, onEditPoll, onVotePoll, onCreateBillSplit, onPayBillSplit, onCreateFundraiser, onContributeFundraiser, onCreateTaskList, onToggleTaskStatus, onAddTaskNote, onForward, allConversations, allGroups, draft = "", onSaveDraft, unreadCount = 0, onBack, onRenameGroup, onAddGroupMembers, onRemoveGroupMember, onToggleGroupAdmin, onLeaveGroup }) {
    var _a, _b;
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [text, setText, clearDraft] = useChatDraft(draft, onSaveDraft);
    const initialUnreadRef = useRef(unreadCount);
    const dividerIdRef = useRef(null);
    if (dividerIdRef.current === null && messages.length) { const di = unreadDividerIndex(messages.length, initialUnreadRef.current); dividerIdRef.current = di > 0 && messages[di] ? messages[di].id : false; }
    const online = useOnline();
    const [showMentions, setShowMentions] = useState(false);
    const [showGStickers, setShowGStickers] = useState(false);   // C48: ملصقات المجموعة (كانت في الثنائيّة فقط)
    const [showMembers, setShowMembers] = useState(false);
    const [showPollForm, setShowPollForm] = useState(false);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [pollDeadlineMinutes, setPollDeadlineMinutes] = useState(null);
    const [pollAnonymous, setPollAnonymous] = useState(false);
    const [editingPollId, setEditingPollId] = useState(null);
    const [addingNoteFor, setAddingNoteFor] = useState(null);
    const [noteDraft, setNoteDraft] = useState("");
    const [showBillForm, setShowBillForm] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [billDescription, setBillDescription] = useState("");
    const [billTotal, setBillTotal] = useState("");
    const [billParticipants, setBillParticipants] = useState(group.members.map((m) => m.id));
    const [billSplitType, setBillSplitType] = useState("equal"); // equal | shares | custom
    const [billCustomValues, setBillCustomValues] = useState({}); // memberId -> حصص أو مبلغ حسب النوع
    const billCustomSum = Object.values(billCustomValues).reduce((s, v) => s + (Number(v) || 0), 0);
    const canCreateBillSplit = !!billDescription.trim() && !!billTotal &&
        (billSplitType === "equal"
            ? billParticipants.length > 0
            : billSplitType === "shares"
                ? Object.values(billCustomValues).some((v) => Number(v) > 0)
                : billCustomSum === Number(billTotal) && billCustomSum > 0);
    function handleCreateBillSplit() {
        let participantAmounts = {};
        if (billSplitType === "equal") {
            const share = Math.round(Number(billTotal) / billParticipants.length);
            billParticipants.forEach((id) => { participantAmounts[id] = share; });
        }
        else if (billSplitType === "shares") {
            const totalShares = Object.values(billCustomValues).reduce((s, v) => s + (Number(v) || 0), 0);
            Object.entries(billCustomValues).forEach(([id, shares]) => {
                if (Number(shares) > 0)
                    participantAmounts[id] = Math.round((Number(shares) / totalShares) * Number(billTotal));
            });
        }
        else {
            Object.entries(billCustomValues).forEach(([id, amount]) => {
                if (Number(amount) > 0)
                    participantAmounts[id] = Number(amount);
            });
        }
        onCreateBillSplit(billDescription.trim(), Number(billTotal), participantAmounts, billSplitType);
        setShowBillForm(false);
        setBillDescription("");
        setBillTotal("");
        setBillParticipants(group.members.map((m) => m.id));
        setBillSplitType("equal");
        setBillCustomValues({});
    }
    const [showFundraiserForm, setShowFundraiserForm] = useState(false);
    const [fundCause, setFundCause] = useState("");
    const [fundGoal, setFundGoal] = useState("");
    const [fundDeadline, setFundDeadline] = useState("");
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [taskListTitle, setTaskListTitle] = useState("");
    const [taskDrafts, setTaskDrafts] = useState([{ text: "", assigneeId: (_a = group.members[0]) === null || _a === void 0 ? void 0 : _a.id, dueAt: "" }]);
    const [memberSearch, setMemberSearch] = useState("");
    // C24: أداةٌ واحدة مفتوحة في كلّ مرّة
    const openTool = (k) => { setShowPollForm(k === "poll"); setShowBillForm(k === "bill"); setShowFundraiserForm(k === "fund"); setShowTaskForm(k === "tasks"); setShowToolsMenu(false); setShowAttachMenu(false); };
    const closePollForm = () => { setShowPollForm(false); setEditingPollId(null); setPollQuestion(""); setPollOptions(["", ""]); setPollDeadlineMinutes(null); setPollAnonymous(false); };
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [viewingImage, setViewingImage] = useState(null);
    // كل صور وفيديوهات المحادثة بالترتيب — تُمرَّر للمعاينة لتمكين التنقّل
    const mediaItems = useMemo(() => (messages || [])
        .filter((m) => (m.type === "image" || m.type === "video") && m.fileUrl && !m.deleted)
        .map((m) => ({ id: m.id, url: m.fileUrl, type: m.type, name: m.fileName || m.text || "" })), [messages]);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState("");
    const recorder = useVoiceRecorder({
        transcribe: true,
        onComplete: (url, duration, transcript, blob, secs) => onSendVoice(url, duration, transcript, blob, secs),
    });
    const [showSearch, setShowSearch] = useState(false);
    const [gSearchQ, setGSearchQ] = useState("");
    const searchQuery = gSearchQ, setSearchQuery = setGSearchQ;
    const [searchMatchIndex, setSearchMatchIndex] = useState(0);
    const [activeGroupCall, setActiveGroupCallRaw] = useState(null); // null | "audio" | "video"
    // C7: مجموعة/عائلة حقيقيّة ⇒ مكالمة جماعيّة حقيقيّة (SawaRTC)؛ غير ذلك الواجهة التجريبيّة
    const cloudGroup = !!(window.SawaRTC && window.SawaRTC.enabled && window.SawaRTC.enabled() && /^(fam_|grp_)/.test(group.id || ""));
    const setActiveGroupCall = (type) => { if (type && cloudGroup && window.SawaRTC && window.SawaRTC.groupCall(group.id, type)) return; if (type && /^(fam_|grp_)/.test(group.id || "")) { showToast(CALL_FAIL_MSG(), "error"); return; } setActiveGroupCallRaw(type); };   // C14: لا مكالمة جماعيّة وهميّة
    // شريط «مكالمة جارية — انضمام»
    const [liveGroupCall, setLiveGroupCall] = useState(null);
    useEffect(() => { if (!cloudGroup || !window.SawaRTC.watchChat) return; return window.SawaRTC.watchChat(group.id, setLiveGroupCall); }, [group.id, cloudGroup]);
    const scrollContainerRef = useRef(null);
    useStickToBottom(scrollContainerRef, messages.length);
    const win = useMessageWindow(messages, unreadCount, !!gSearchQ.trim(), scrollContainerRef);
    const [forwardingText, setForwardingText] = useState(null);
    const [groupMsgMenu, setGroupMsgMenu] = useState(null);
    const [gReply, setGReply] = useState(null);       // C3: ردٌّ حقيقيّ (معرّف الرسالة)
    const [gDel, setGDel] = useState(null);           // C3: تأكيد الحذف (عندي/للجميع)
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [voiceChatActive, setVoiceChatActive] = useState(false);
    const [voiceChatJoined, setVoiceChatJoined] = useState(false);
    const [voiceChatParticipants, setVoiceChatParticipants] = useState([]);
    const [voiceChatElapsed, setVoiceChatElapsed] = useState(0);
    const [voiceChatHost, setVoiceChatHost] = useState(null); // id المضيف
    const [confirmEndAll, setConfirmEndAll] = useState(false);
    const vcTimerRef = useRef(null);
    useEffect(() => {
        if (!voiceChatActive) {
            setVoiceChatParticipants([]);
            setVoiceChatElapsed(0);
            clearInterval(vcTimerRef.current);
            return;
        }
        // مؤقت الوقت
        vcTimerRef.current = setInterval(() => setVoiceChatElapsed((e) => e + 1), 1000);
        // محاكاة انضمام الأعضاء تدريجياً
        const others = group.members.filter((m) => m.id !== myUserId);
        const timers = others.map((m, i) => setTimeout(() => setVoiceChatParticipants((prev) => {
            if (prev.some((p) => p.id === m.id))
                return prev;
            return [...prev, { id: m.id, name: m.name }];
        }), (i + 1) * 2500));
        return () => { timers.forEach(clearTimeout); clearInterval(vcTimerRef.current); };
    }, [voiceChatActive]);
    useEffect(() => {
        return () => {
            var _a;
            setVoiceChatActive(false);
            setVoiceChatJoined(false);
            setVoiceChatParticipants([]);
            clearInterval(vcTimerRef.current);
        };
    }, []);
    const mediaInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const myRole = ((_b = group.members.find((m) => m.id === myUserId)) === null || _b === void 0 ? void 0 : _b.role) || "member";
    const isAdmin = myRole === "admin";
    const searchMatches = searchQuery.trim()
        ? messages.filter((m) => m.text && m.text.toLowerCase().includes(searchQuery.trim().toLowerCase())).map((m) => m.id)
        : [];
    const currentMatchId = searchMatches[searchMatchIndex] || null;
    useEffect(() => {
        var _a;
        if (currentMatchId) {
            (_a = document.querySelector(`[data-message-id="${currentMatchId}"]`)) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMatchId]);

    const amVoiceHost = voiceChatHost === myUserId;
    const vcMins = String(Math.floor(voiceChatElapsed / 60)).padStart(2, "0");
    const vcSecs = String(voiceChatElapsed % 60).padStart(2, "0");
    // C24: الدردشة الصوتيّة حقيقيّة — مكالمةٌ صوتيّة جماعيّة بلا رنين (SawaRTC)، يظهر للأعضاء شريط «انضمام».
    //      (كانت محاكاةً: مؤقّتٌ وأسماءٌ تنضمّ وحدها كلّ ثانيتين ونصف بلا صوت)
    function startVoiceChat() {
        if (liveGroupCall && !liveGroupCall.inCall) { window.SawaRTC.groupCall(group.id, liveGroupCall.type, liveGroupCall.vc ? { vc: true } : undefined); return; }
        if (cloudGroup && window.SawaRTC.groupCall(group.id, "audio", { vc: true })) return;
        showToast(CALL_FAIL_MSG(), "error");
    }
    function leaveVoiceChat() {
        var _a;
        setVoiceChatJoined(false);
        setVoiceChatParticipants((prev) => prev.filter((p) => p.id !== myUserId));
        // رسالة نظام في الدردشة
        onSend === null || onSend === void 0 ? void 0 : onSend(t("gc_ghadr_alghrfa", { name: ((_a = group.members.find((m) => m.id === myUserId)) === null || _a === void 0 ? void 0 : _a.name) || t("gc_ant") }));
    }
    function endVoiceChatForAll() {
        setVoiceChatActive(false);
        setVoiceChatJoined(false);
        setVoiceChatParticipants([]);
        setVoiceChatHost(null);
        setConfirmEndAll(false);
        onSend === null || onSend === void 0 ? void 0 : onSend(t("gc_anthat_alghrfa", { d: vcMins + ":" + vcSecs }));
    }
    function handleTextChange(val) {
        setText(val);
        setShowMentions(val.endsWith("@"));
        if (onTyping && val && val.trim()) onTyping();
    }
    function insertMention(name) {
        setText((prev) => prev.slice(0, -1) + `@${name} `);
        setShowMentions(false);
    }
    function handleSend() {
        if (!text.trim())
            return;
        if (group.adminsOnly && !isAdmin) { showToast(t("c3_only_admins_send"), "info"); return; }
        onSend(text.trim(), gReply);
        setGReply(null);
        clearDraft();
    }
    function handleCreatePoll() {
        const validOptions = pollOptions.filter((o) => o.trim());
        if (!pollQuestion.trim() || validOptions.length < 2)
            return;
        if (editingPollId) {
            onEditPoll(editingPollId, pollQuestion.trim(), validOptions);
            setEditingPollId(null);
        }
        else {
            onCreatePoll(pollQuestion.trim(), validOptions, pollDeadlineMinutes, pollAnonymous);
        }
        setPollQuestion("");
        setPollOptions(["", ""]);
        setPollDeadlineMinutes(null);
        setPollAnonymous(false);
        setShowPollForm(false);
        // انزل لآخر رسالة بعد النشر — بدونه يبقى الاستطلاع الجديد خارج الشاشة
        setTimeout(function () {
            try {
                const msgs = document.querySelectorAll("[data-message-id]");
                const last = msgs[msgs.length - 1];
                if (last) last.scrollIntoView({ behavior: "smooth", block: "end" });
            } catch (e) { }
        }, 120);
    }
    function renderMessageText(msgText, mine) { return renderRichText(msgText, { mine, colors, mentions: true }); }
    if (showGroupInfo) {
        return React.createElement(GroupInfoScreen, {
            group: group,
            myUserId: myUserId,
            mediaCount: (messages || []).filter((m) => m.type === "image" || m.type === "video").length,
            onRename: (n) => onRenameGroup && onRenameGroup(group.id, n),
            onAddMembers: (names) => onAddGroupMembers && onAddGroupMembers(group.id, names),
            contacts: contacts, onInviteLink: onInviteLink ? () => onInviteLink(group.id) : null,
            onUpdate: onUpdateGroup ? (patch) => onUpdateGroup(group.id, patch) : null,
            onRemoveMember: (id) => onRemoveGroupMember && onRemoveGroupMember(group.id, id),
            onToggleAdmin: (id) => onToggleGroupAdmin && onToggleGroupAdmin(group.id, id),
            onLeave: () => { setShowGroupInfo(false); onLeaveGroup && onLeaveGroup(group.id); },
            onBack: () => setShowGroupInfo(false),
        });
    }
    if (activeGroupCall) {
        return React.createElement(GroupCallOverlay, { groupName: group.name, members: group.members, callType: activeGroupCall, onEnd: () => setActiveGroupCallRaw(null) });
    }
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col relative" },
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-3 border-b`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("button", { "aria-label": tl("رجوع", "Back"), onClick: onBack },
                React.createElement(ChevronLeft, { size: 20, color: colors.text })),
            React.createElement("div", { onClick: () => setShowGroupInfo(true), className: `flex-1 ${textStart()} ${me("2")}`, style: { minWidth: 0, cursor: "pointer" } },
                React.createElement("div", { className: "font-bold text-sm truncate", style: { color: colors.text } }, group.name),
                React.createElement("button", { onClick: () => setShowMembers(!showMembers), className: "text-[11px]", style: { color: colors.textMuted } },
                    group.members.length,
                    t("gc_aada"))),
            isAdmin && React.createElement(Crown, { size: 16, color: colors.accent }),
            React.createElement("button", { "aria-label": t("fydyw"), onClick: () => setActiveGroupCall("video") },
                React.createElement(Video, { size: 17, color: colors.textMuted })),
            React.createElement("button", { "aria-label": t("atsal"), onClick: () => setActiveGroupCall("audio") },
                React.createElement(Phone, { size: 17, color: colors.textMuted })),
            React.createElement("button", { "aria-label": t("bhth"), onClick: () => setShowSearch(!showSearch) },
                React.createElement(Search, { size: 17, color: colors.textMuted }))),
        liveGroupCall && !liveGroupCall.inCall && (React.createElement("button", { onClick: () => window.SawaRTC.groupCall(group.id, liveGroupCall.type, liveGroupCall.vc ? { vc: true } : undefined), className: `w-full flex ${rowStart()} items-center gap-2 px-3 py-2`, style: { backgroundColor: "#E6F4EC", borderBottom: `1px solid ${colors.border}` } },
            liveGroupCall.vc ? React.createElement(Radio, { size: 15, color: "#1E7A4C" }) : liveGroupCall.type === "video" ? React.createElement(Video, { size: 15, color: "#1E7A4C" }) : React.createElement(Phone, { size: 15, color: "#1E7A4C" }),
            React.createElement("span", { className: `flex-1 ${textStart()} text-xs font-bold`, style: { color: "#1E7A4C" } }, (liveGroupCall.vc ? tl("دردشة صوتيّة جارية", "Voice chat live") : liveGroupCall.type === "video" ? tl("مكالمة فيديو جارية", "Video call in progress") : tl("مكالمة صوتيّة جارية", "Voice call in progress")) + (liveGroupCall.n ? " · " + tl(liveGroupCall.n + " فيها", liveGroupCall.n + " in") : "")),
            React.createElement("span", { className: "text-[11px] font-extrabold text-white rounded-full px-3 py-1", style: { backgroundColor: "#21A366" } }, tl("انضمام", "Join")))),
        false && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-2 border-b`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: searchQuery, onChange: (e) => { setSearchQuery(e.target.value); setSearchMatchIndex(0); }, placeholder: t("bhth_balmhadtha"), className: "flex-1 border rounded-full px-3 py-1.5 text-xs", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg }, autoFocus: true }),
            searchQuery.trim() && (React.createElement("span", { className: "text-[10px] shrink-0", style: { color: colors.textMuted } }, searchMatches.length > 0 ? `${searchMatchIndex + 1}/${searchMatches.length}` : t("gc_0_ntyja"))),
            searchMatches.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("button", { onClick: () => setSearchMatchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length) },
                    React.createElement(ChevronUp, { size: 16, color: colors.textMuted })),
                React.createElement("button", { onClick: () => setSearchMatchIndex((i) => (i + 1) % searchMatches.length) },
                    React.createElement(ChevronDown, { size: 16, color: colors.textMuted })))),
            React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => { setShowSearch(false); setSearchQuery(""); } },
                React.createElement(X, { size: 16, color: colors.textMuted })))),
        showMembers && (React.createElement("div", { className: "p-3 border-b", style: { borderColor: colors.border, backgroundColor: colors.bg } },
            group.members.map((m) => (React.createElement("div", { key: m.id, className: `flex ${rowStart()} items-center justify-between py-1.5` },
                React.createElement("span", { className: "text-xs", style: { color: colors.text } }, m.name),
                m.role === "admin" && React.createElement(Badge, { size: "sm", variant: "neutral", icon: Crown, label: t("mshrf") })))),
            isAdmin && (React.createElement("div", { className: "mt-2 pt-2 border-t text-[10px]", style: { borderColor: colors.border, color: colors.textMuted } }, GROUP_ADMIN_ACTIONS.map((a) => React.createElement("div", { key: a },
                "\u2022 ",
                a,
                t("gc_slahya_mshrf"))))))),
        !online && React.createElement(OfflineBar, null),
        React.createElement("div", { ref: scrollContainerRef, className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg }, onScroll: (e) => { if (win.hidden > 0 && e.currentTarget.scrollTop < 80) win.more(); } },
            messages.length === 0 && React.createElement(EmptyChatState, { icon: UsersRound }),
            win.hidden > 0 && React.createElement(OlderButton, { hidden: win.hidden, onMore: win.more }),
            (function () {
            const rendered = win.shown.map((m, mi) => {
            var _a;
            const mine = m.senderId === myUserId;
            const sender = group.members.find((x) => x.id === m.senderId);
            // C3: رسائل النظام (إنشاء/إضافة/مغادرة…) في وسط المحادثة
            if (m.type === "system") {
                return (React.createElement("div", { key: m.id, className: "flex justify-center my-2" },
                    React.createElement("span", { className: "text-[10px] px-3 py-1 rounded-full text-center", style: { backgroundColor: colors.border + "88", color: colors.textMuted, maxWidth: "85%" } }, m.text)));
            }

            if (m.type === "billSplit") {
                const paidAmount = m.participants.filter((p) => p.paid).reduce((s, p) => s + p.share, 0);
                const pct = Math.round((paidAmount / m.totalAmount) * 100);
                const myShare = m.participants.find((p) => p.userId === myUserId);
                return (React.createElement("div", { key: m.id, className: "mb-3 rounded-xl border p-3", style: { borderColor: colors.border, backgroundColor: colors.card } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-1` },
                        React.createElement(Banknote, { size: 14, color: colors.primary }),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, m.description)),
                    React.createElement("div", { className: "text-[11px] mb-2", style: { color: colors.textMuted } },
                        t("gc_alijmaly"),
                        m.totalAmount.toLocaleString(loc()),
                        " \u062C.\u0633 \u00B7 ",
                        ((_a = BILL_SPLIT_TYPES.find((x) => x.key === m.splitType)) ? t(_a.labelKey) : t("spl_baltsawy"))),
                    React.createElement("div", { className: "h-1.5 rounded-full mb-1", style: { backgroundColor: colors.border } },
                        React.createElement("div", { className: "h-1.5 rounded-full", style: { width: `${pct}%`, backgroundColor: colors.success } })),
                    React.createElement("div", { className: "text-[10px] mb-2", style: { color: colors.textMuted } },
                        t("gc_jma"),
                        paidAmount.toLocaleString(loc()),
                        t("gc_mn"),
                        m.totalAmount.toLocaleString(loc()),
                        t("w_sdg_sp")),
                    m.participants.map((p) => (React.createElement("div", { key: p.userId, className: `flex ${rowStart()} items-center justify-between py-1` },
                        React.createElement("span", { className: "text-[11px]", style: { color: colors.text } },
                            p.name,
                            p.userId === myUserId ? t("gc_ant_qws") : ""),
                        React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.textMuted } },
                                p.share.toLocaleString(loc()),
                                t("w_sdg_sp")),
                            p.paid ? React.createElement(CheckCircle2, { size: 13, color: colors.success }) : React.createElement("span", { className: "text-[9px]", style: { color: colors.danger } }, t("lm_ydfa")))))),
                    myShare && !myShare.paid && (React.createElement(Button, { label: t("gc_thdyd_hsty", { v: myShare.share.toLocaleString(loc()) }), onPress: () => onPayBillSplit(m.id), className: "mt-2" }))));
            }
            if (m.type === "fundraiser") {
                const pct = Math.min(100, Math.round((m.raised / m.goal) * 100));
                const daysLeft = m.deadline ? Math.ceil((m.deadline - Date.now()) / 86400000) : null;
                const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
                const isGoalReached = m.raised >= m.goal;
                const isEnded = isGoalReached || (daysLeft !== null && daysLeft < 0);
                return (React.createElement("div", { key: m.id, className: "mb-3 rounded-xl border p-3", style: { borderColor: isUrgent ? colors.danger : colors.border, backgroundColor: colors.card } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-1` },
                        React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                            React.createElement(Gift, { size: 14, color: colors.accent }),
                            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, m.cause)),
                        isGoalReached ? (React.createElement(Badge, { size: "sm", variant: "success", label: t("gc_aktml") })) : daysLeft !== null && (React.createElement(Badge, { size: "sm", variant: isEnded ? "neutral" : isUrgent ? "danger" : "neutral", label: isEnded ? t("gc_anthat_almhla") : daysLeft === 0 ? t("gc_akhr_ywm") : t("ywm_mtbq", { daysLeft }) }))),
                    React.createElement("div", { className: "h-2 rounded-full mb-1", style: { backgroundColor: colors.border } },
                        React.createElement("div", { className: "h-2 rounded-full", style: { width: `${pct}%`, backgroundColor: colors.accent } })),
                    React.createElement("div", { className: `flex ${rowStart()} justify-between text-[10px] mb-2`, style: { color: colors.textMuted } },
                        React.createElement("span", null,
                            m.raised.toLocaleString(loc()),
                            t("gc_mn"),
                            m.goal.toLocaleString(loc()),
                            " \u062C.\u0633 (",
                            pct,
                            "%)"),
                        m.deadline && React.createElement("span", null,
                            t("gc_hta"),
                            new Date(m.deadline).toLocaleDateString(loc(), { day: "numeric", month: "long" }))),
                    m.contributions.length > 0 && (React.createElement("div", { className: "mb-2" }, m.contributions.slice(0, 3).map((c, i) => (React.createElement("div", { key: i, className: `flex ${rowStart()} justify-between text-[10px] py-0.5`, style: { color: colors.textMuted } },
                        React.createElement("span", null, c.name),
                        React.createElement("span", null,
                            c.amount.toLocaleString(loc()),
                            t("w_sdg_sp"))))))),
                    React.createElement(Button, { label: t("tbra_alan"), onPress: () => onContributeFundraiser(m.id), disabled: isEnded })));
            }
            if (m.type === "taskList") {
                const sortedTasks = [...m.tasks].sort((a, b) => {
                    if (a.status !== b.status)
                        return a.status === "done" ? 1 : -1; // المُنجَزة بالأسفل دائماً
                    if (!a.dueAt && !b.dueAt)
                        return 0;
                    if (!a.dueAt)
                        return 1; // بلا موعد تنزل آخراً بين نفس الحالة
                    if (!b.dueAt)
                        return -1;
                    return a.dueAt - b.dueAt; // الأقرب استحقاقاً أولاً
                });
                return (React.createElement("div", { key: m.id, className: "mb-3 rounded-xl border p-3", style: { borderColor: colors.border, backgroundColor: colors.card } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-2` },
                        React.createElement(CheckCircle2, { size: 14, color: colors.primary }),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, m.title)),
                    sortedTasks.map((task) => {
                        const isOverdue = task.status !== "done" && task.dueAt && task.dueAt < Date.now();
                        return (React.createElement("div", { key: task.id, className: "py-1.5 border-t", style: { borderColor: colors.border } },
                            React.createElement("div", { className: `flex ${rowStart()} items-center justify-between` },
                                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                                    task.assigneeId === myUserId && (React.createElement("button", { "aria-label": t("takyd"), onClick: () => onToggleTaskStatus(m.id, task.id) },
                                        React.createElement("div", { className: "w-4 h-4 rounded border-2 flex items-center justify-center", style: { borderColor: task.status === "done" ? colors.success : colors.border, backgroundColor: task.status === "done" ? colors.success : "transparent" } }, task.status === "done" && React.createElement(Check, { size: 10, color: "#fff" })))),
                                    task.assigneeId !== myUserId && (React.createElement("div", { className: "w-4 h-4 rounded border-2 flex items-center justify-center", style: { borderColor: task.status === "done" ? colors.success : colors.border, backgroundColor: task.status === "done" ? colors.success : "transparent" } }, task.status === "done" && React.createElement(Check, { size: 10, color: "#fff" }))),
                                    React.createElement("span", { className: "text-[11px]", style: { color: colors.text, textDecoration: task.status === "done" ? "line-through" : "none" } }, task.text)),
                                React.createElement("div", { className: `${textStart()}` },
                                    React.createElement("div", { className: "text-[10px] font-bold", style: { color: colors.primary } }, task.assigneeName),
                                    task.dueAt && (React.createElement("div", { className: `text-[9px] flex ${rowStart()} items-center gap-1`, style: { color: isOverdue ? colors.danger : colors.textMuted } },
                                        isOverdue && React.createElement(AlertTriangle, { size: 9, color: colors.danger }),
                                        new Date(task.dueAt).toLocaleDateString(loc(), { day: "numeric", month: "long" }))))),
                            task.note ? (React.createElement("p", { className: `text-[10px] mt-1 ${me("6")}`, style: { color: colors.textMuted } },
                                "\uD83D\uDCDD ",
                                task.note)) : addingNoteFor === task.id ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-1 ${me("6")}` },
                                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: noteDraft, onChange: (e) => setNoteDraft(e.target.value), placeholder: t("mlahza_qsyra"), autoFocus: true, className: "flex-1 border rounded px-2 py-1 text-[10px]", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
                                React.createElement("button", { "aria-label": t("takyd"), onClick: () => { if (noteDraft.trim())
                                        onAddTaskNote(m.id, task.id, noteDraft.trim()); setAddingNoteFor(null); setNoteDraft(""); } },
                                    React.createElement(Check, { size: 13, color: colors.success })),
                                React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => { setAddingNoteFor(null); setNoteDraft(""); } },
                                    React.createElement(X, { size: 13, color: colors.textMuted })))) : (React.createElement("button", { onClick: () => { setAddingNoteFor(task.id); setNoteDraft(""); }, className: `text-[9px] mt-1 ${me("6")}`, style: { color: colors.primary } }, t("idafa_mlahza")))));
                    })));
            }
            if (m.type === "poll") {
                const totalVotes = m.options.reduce((s, o) => s + o.votes.length, 0);
                const myVote = m.options.findIndex((o) => o.votes.includes(myUserId));
                const isExpired = m.deadline && Date.now() > m.deadline;
                const isCreator = m.creatorId === myUserId;
                const canEdit = isCreator && Date.now() - m.createdAt < 15 * 60000;
                return (React.createElement("div", { key: m.id, className: "mb-3 rounded-xl border p-3", style: { borderColor: colors.border, backgroundColor: colors.card } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                        React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                            React.createElement(BarChart3, { size: 14, color: colors.primary }),
                            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, m.question)),
                        canEdit && (React.createElement("button", { onClick: () => { setEditingPollId(m.id); setPollQuestion(m.question); setPollOptions(m.options.map((o) => o.text)); openTool("poll"); } },
                            React.createElement(Edit3, { size: 12, color: colors.textMuted })))),
                    (m.deadline || m.editedAt) && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mb-2` },
                        m.deadline && (React.createElement("span", { className: "text-[10px] font-bold", style: { color: isExpired ? colors.danger : colors.textMuted } }, isExpired ? t("gc_anthat_almhla") : `تنتهي ${new Date(m.deadline).toLocaleString(loc(), { day: "numeric", month: "short", hour: "numeric", minute: "numeric" })}`)),
                        m.editedAt && React.createElement("span", { className: "text-[9px]", style: { color: colors.textMuted } }, t("madl")))),
                    m.options.map((opt, i) => {
                        const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                        const voterNames = opt.votes.map((uid) => { var _a; return ((_a = group.members.find((mem) => mem.id === uid)) === null || _a === void 0 ? void 0 : _a.name) || (uid === myUserId ? t("gc_ant") : t("gc_adw")); });
                        return (React.createElement("button", { key: i, onClick: () => !isExpired && onVotePoll(m.id, i), disabled: isExpired, className: `w-full ${textStart()} mb-1.5`, style: { opacity: isExpired && myVote !== i ? 0.6 : 1 } },
                            React.createElement("div", { className: `flex ${rowStart()} justify-between text-[11px] mb-0.5`, style: { color: myVote === i ? colors.primary : colors.text } },
                                React.createElement("span", null,
                                    opt.text,
                                    myVote === i ? " ✓" : ""),
                                React.createElement("span", null,
                                    pct,
                                    "% (",
                                    opt.votes.length,
                                    ")")),
                            React.createElement("div", { className: "h-1.5 rounded-full", style: { backgroundColor: colors.border } },
                                React.createElement("div", { className: "h-1.5 rounded-full", style: { width: `${pct}%`, backgroundColor: colors.primary } })),
                            !m.anonymous && voterNames.length > 0 && (React.createElement("div", { className: `text-[9px] mt-0.5 ${textStart()}`, style: { color: colors.textMuted } }, voterNames.join(t("fasl_qayma"))))));
                    }),
                    m.anonymous && React.createElement("p", { className: "text-[9px] mt-1", style: { color: colors.textMuted } }, t("tswyt_mjhwl_asma_almswtyn"))));
            }
            return (React.createElement("div", { key: m.id, "data-message-id": m.id, className: "flex flex-col mb-2 rounded-lg", style: { alignItems: mine ? "flex-start" : "flex-end", backgroundColor: m.id === currentMatchId ? colors.accent + "33" : "transparent" } },
                m.forwarded && (React.createElement("span", { className: `text-[9px] mb-0.5 flex ${rowStart()} items-center gap-1`, style: { color: colors.textMuted } },
                    React.createElement(Send, { size: 9, style: { transform: "scaleX(-1)" } }),
                    t("rsala_mwjha"))),
                !mine && React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-0.5` },
                    React.createElement(SenderAvatar, { name: (sender && sender.name) || t("gc_swal"), size: 20, photo: sender && sender.photo }),
                    React.createElement("span", { className: "text-[10px] font-bold", style: { color: senderColor((sender && sender.name) || t("gc_swal")) } }, sender === null || sender === void 0 ? void 0 : sender.name)),
                m.replyToText && React.createElement("div", { className: "max-w-[78%] text-[10px] px-2 py-1 mb-0.5 rounded-lg border-r-2 truncate", style: { backgroundColor: colors.card, borderColor: colors.accent, color: colors.textMuted } }, "↩ " + m.replyToText),
                React.createElement("div", { className: `max-w-[78%] rounded-2xl border ${["image", "video", "sticker"].includes(m.type) ? "" : "px-3 py-2"}`, style: { backgroundColor: ["image", "video", "sticker"].includes(m.type) ? "transparent" : mine ? colors.primary : colors.card, borderColor: ["image", "video", "sticker"].includes(m.type) ? "transparent" : colors.border, cursor: "pointer" }, onContextMenu: (e) => { e.preventDefault(); setGroupMsgMenu({ id: m.id, text: m.text, mine: mine, senderId: m.senderId, senderName: (sender && sender.name) || "" }); }, onTouchStart: (e) => { const t0 = Date.now(); const el = e.currentTarget; const onEnd = () => { if (Date.now() - t0 > 500) { setGroupMsgMenu({ id: m.id, text: m.text, mine: mine, senderId: m.senderId, senderName: (sender && sender.name) || "" }); } el.removeEventListener("touchend", onEnd); }; el.addEventListener("touchend", onEnd); } }, m.type === "image" ? (React.createElement("button", { onClick: () => setViewingImage(m.fileUrl), className: "block -m-1" }, m.fileUrl ? React.createElement("img", { src: m.fileUrl, alt: m.text, className: "rounded-xl max-h-56 w-full object-cover", style: { minWidth: 160 } }) : React.createElement(MediaUnavailable, { label: t("swra") }))) : m.type === "sticker" ? (React.createElement("span", { className: "text-4xl" }, m.text)) : m.type === "video" ? (React.createElement("video", { src: m.fileUrl, controls: true, className: "rounded-xl max-h-56 w-full", style: { minWidth: 200 } })) : m.type === "file" ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2`, onClick: () => { if (m.cloudMid && window.SawaChat) window.SawaChat.openFile(m); }, style: { cursor: m.cloudMid ? "pointer" : "default" } },
                    React.createElement(FileIconLucide, { size: 18, color: mine ? "#fff" : colors.primary }),
                    React.createElement("div", null,
                        React.createElement("div", { className: "text-xs font-bold", style: { color: mine ? "#fff" : colors.text } }, m.text),
                        React.createElement("div", { className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } },
                            (m.fileSize / 1024).toFixed(0),
                            t("gc_kylwbayt"))))) : m.type === "location" ? React.createElement(LocationBubble, { m, mine }) : m.type === "voice" ? (React.createElement(VoiceMessageBubble, { loading: !!m.mediaLoading, failed: !!m.mediaFailed, cid: m.cloudCid || null, mid: m.cloudMid || null, url: m.audioUrl, duration: m.duration, mine: mine, transcript: m.transcript })) : editingMessageId === m.id ? (React.createElement("div", { className: "flex flex-col gap-1.5" },
                    React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: editingText, onChange: (e) => setEditingText(e.target.value), onKeyDown: (e) => { if (e.key === "Enter" && editingText.trim()) { e.preventDefault(); onEditMessage(m.id, editingText.trim()); setEditingMessageId(null); } else if (e.key === "Escape") setEditingMessageId(null); }, className: "text-sm rounded px-2 py-1", style: { backgroundColor: mine ? "rgba(255,255,255,0.15)" : colors.bg, color: mine ? "#fff" : colors.text, border: `1px solid ${mine ? "#ffffff55" : colors.border}` }, autoFocus: true }),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("button", { onClick: () => { onEditMessage(m.id, editingText.trim()); setEditingMessageId(null); }, className: "text-[10px] font-bold", style: { color: mine ? "#fff" : colors.primary } }, t("hfz")),
                        React.createElement("button", { onClick: () => setEditingMessageId(null), className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } }, t("ilgha"))))) : (React.createElement("span", { className: "text-sm", style: { color: mine ? "#fff" : colors.text } },
                    renderMessageText(m.text, mine),
                    m.edited && React.createElement("span", { className: "text-[10px] opacity-70" }, t("gc_madla")),
                    m.type === "text" && urlsIn(m.text).length ? React.createElement(LinkCard, { text: m.text, mine }) : null))),
                // التوجيه والتعديل في قائمة الضغط المطوّل — إظهارهما تحت كل
                // رسالة يزدحم ويكرّر ما هو متاح أصلاً. الوقت مكانهما كما في الخاص.
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-0.5` },
                    React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } },
                        m.createdAt ? new Date(m.createdAt).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }) : ""),
                    m.uploadPct != null && React.createElement("span", { className: "text-[10px] font-bold", style: { color: colors.textMuted } }, "⏫ " + m.uploadPct + "%"),
                    m.status === "failed" && React.createElement("button", { onClick: (e) => { e.stopPropagation(); if (window.SawaChat && window.SawaChat.failedSheet) window.SawaChat.failedSheet(m.id); }, className: "text-[10px] font-bold", style: { color: colors.danger } }, "⚠ " + t("c2_failed") + " · " + tl("اضغط", "tap")),
                    m.reaction && React.createElement("span", { className: "text-xs" }, Object.keys(m.reactions || {}).length > 1 ? m.reaction + " " + Object.keys(m.reactions).length : m.reaction))));
        });
            // C47: فواصل الأيّام + فاصل «غير مقروءة» الثابت على معرّف الرسالة
            const out = [];
            for (let i = 0; i < rendered.length; i++) {
                const m = win.shown[i], prevM = i > 0 ? win.shown[i - 1] : null;
                if (m.createdAt && (!prevM || dayKeyOf(prevM.createdAt) !== dayKeyOf(m.createdAt)) && (prevM || win.hidden === 0)) out.push(React.createElement(DayDivider, { key: "day-" + m.id, label: dayLabelOf(m.createdAt) }));
                if (dividerIdRef.current && m.id === dividerIdRef.current) out.push(React.createElement(UnreadDivider, { key: "unread-divider" }));
                out.push(rendered[i]);
            }
            return out;
            })()),
        showGStickers && (React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 p-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } }, STICKER_SET.map((st) => (React.createElement("button", { key: st, onClick: () => { onSendSticker(st); setShowGStickers(false); }, className: "w-10 h-10 rounded-xl flex items-center justify-center text-xl", style: { backgroundColor: colors.bg } }, st))))),
        showMentions && (React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 p-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } }, group.members.filter((m) => m.id !== myUserId).map((m) => (React.createElement("button", { key: m.id, onClick: () => insertMention(m.name), className: "text-xs rounded-full border px-2.5 py-1", style: { borderColor: colors.border, color: colors.text } },
            "@",
            m.name))))),
        gReply && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-3 py-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("div", { className: `flex-1 min-w-0 ${textStart()} border-r-2 px-2`, style: { borderColor: colors.accent } },
                React.createElement("div", { className: "text-[10px] font-bold", style: { color: colors.accent } }, t("c3_replying") + " " + (gReply.senderName || "")),
                React.createElement("div", { className: "text-[11px] truncate", style: { color: colors.textMuted } }, gReply.text)),
            React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => setGReply(null) }, React.createElement(X, { size: 14, color: colors.textMuted })))),
        gDel && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setGDel(null), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.35)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 12 } },
                React.createElement("button", { onClick: () => { onDeleteMessage(gDel.id, "me"); setGDel(null); }, className: `w-full ${textStart()} px-5 py-3.5 border-b text-sm font-bold`, style: { borderColor: colors.border, color: colors.text } }, t("c3_del_me")),
                gDel.canAll && React.createElement("button", { onClick: () => { onDeleteMessage(gDel.id, "all"); setGDel(null); }, className: `w-full ${textStart()} px-5 py-3.5 border-b text-sm font-bold`, style: { borderColor: colors.border, color: colors.danger } }, t("c3_del_all")),
                React.createElement("button", { onClick: () => setGDel(null), className: "w-full px-5 py-3 text-sm font-bold", style: { color: colors.textMuted } }, t("ilgha"))))),
        showPollForm && (React.createElement(ToolSheet, { title: editingPollId ? t("gc_tadyl_alastltla") : t("gc_astltla_jdyd"), onClose: closePollForm },
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: pollQuestion, onChange: (e) => setPollQuestion(e.target.value), placeholder: t("swal_alasttlaa"), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            pollOptions.map((opt, i) => (React.createElement("input", { key: i, value: opt, onChange: (e) => setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o))), dir: isRTL() ? "rtl" : "ltr", placeholder: t("gc_khyar", { i: i + 1 }), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }))),
            React.createElement("button", { onClick: () => setPollOptions((prev) => [...prev, ""]), className: "text-[11px] mb-2 block", style: { color: colors.primary } }, t("khyar")),
            !editingPollId && (React.createElement(React.Fragment, null,
                React.createElement("label", { className: "text-[10px] font-bold mb-1 block", style: { color: colors.textMuted } }, t("mhla_altswyt")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-1.5 mb-2` }, POLL_DEADLINE_OPTIONS.map((o) => (React.createElement("button", { key: o.key, onClick: () => setPollDeadlineMinutes(o.minutes), className: "rounded-full px-2.5 py-1 border text-[10px] font-bold", style: { borderColor: pollDeadlineMinutes === o.minutes ? colors.primary : colors.border, backgroundColor: pollDeadlineMinutes === o.minutes ? colors.primary : "transparent", color: pollDeadlineMinutes === o.minutes ? "#fff" : colors.text } }, t(o.labelKey))))),
                React.createElement("button", { onClick: () => setPollAnonymous(!pollAnonymous), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl border px-2.5 py-2 mb-2`, style: { borderColor: pollAnonymous ? colors.primary : colors.border, backgroundColor: pollAnonymous ? colors.primary : "transparent" } },
                    React.createElement("span", { className: "text-[11px] font-bold", style: { color: pollAnonymous ? "#fff" : colors.text } }, t("tswyt_mjhwl_ikhfa_asma")),
                    React.createElement("div", { className: "w-8 h-4.5 rounded-full relative", style: { backgroundColor: pollAnonymous ? "rgba(255,255,255,0.35)" : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white", style: { [pollAnonymous ? "right" : "left"]: 2 } }))))),
            React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                editingPollId && (React.createElement("button", { onClick: () => { setEditingPollId(null); setPollQuestion(""); setPollOptions(["", ""]); setShowPollForm(false); }, className: "text-[11px]", style: { color: colors.textMuted } }, t("ilgha"))),
                React.createElement("button", { onClick: handleCreatePoll, className: "flex-1 py-3 rounded-xl text-sm font-extrabold text-white", style: { backgroundColor: colors.primary } }, editingPollId ? t("gc_hfz_altadyl") : t("gc_nshr"))))),
        showBillForm && (React.createElement(ToolSheet, { title: t("aqtsam_fatwra"), onClose: () => setShowBillForm(false) },
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: billDescription, onChange: (e) => setBillDescription(e.target.value), placeholder: t("wsf_alfatwra_mthal_asha"), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement(NumericAmountInput, { value: billTotal, onChange: setBillTotal, placeholder: t("almblgh_alijmaly_j_s"), className: `w-full border rounded-xl px-3 py-2 text-xs mb-2 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement("div", { className: `flex ${rowStart()} gap-1.5 mb-2` }, BILL_SPLIT_TYPES.map((btype) => (React.createElement("button", { key: btype.key, onClick: () => setBillSplitType(btype.key), className: "flex-1 rounded-xl border py-1.5 text-center", style: { borderColor: billSplitType === btype.key ? colors.primary : colors.border, backgroundColor: billSplitType === btype.key ? colors.primary : "transparent" } },
                React.createElement("span", { className: "text-[10px] font-bold", style: { color: billSplitType === btype.key ? "#fff" : colors.text } }, t(btype.labelKey)))))),
            React.createElement("p", { className: "text-[11px] font-bold mb-1.5", style: { color: colors.textMuted } }, billSplitType === "equal" ? t("yqsm_baltsawy_ala_mn", { n: billParticipants.length, total: group.members.length }) : billSplitType === "shares" ? t("gc_hdd_alhss") : t("gc_hdd_almblgh")),
            billSplitType === "equal" ? (React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-1.5 mb-2` }, group.members.map((mem) => (React.createElement("button", { key: mem.id, onClick: () => setBillParticipants((prev) => prev.includes(mem.id) ? prev.filter((id) => id !== mem.id) : [...prev, mem.id]), className: "rounded-full px-2.5 py-1 border text-[10px] font-bold", style: { borderColor: billParticipants.includes(mem.id) ? colors.primary : colors.border, backgroundColor: billParticipants.includes(mem.id) ? colors.primary : "transparent", color: billParticipants.includes(mem.id) ? "#fff" : colors.text } }, mem.name))))) : (React.createElement("div", { className: "mb-2" },
                group.members.map((mem) => (React.createElement("div", { key: mem.id, className: `flex ${rowStart()} items-center gap-2 mb-1.5` },
                    React.createElement("span", { className: `text-[11px] font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, mem.name),
                    React.createElement(NumericAmountInput, { value: billCustomValues[mem.id] || "", onChange: (v) => setBillCustomValues((prev) => ({ ...prev, [mem.id]: v })), placeholder: billSplitType === "shares" ? t("gc_hss") : t("gc_mblgh"), className: "w-20 border rounded-xl px-2 py-1.5 text-xs text-center", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } })))),
                billSplitType === "custom" && (React.createElement("p", { className: "text-[10px]", style: { color: billCustomSum === Number(billTotal) ? colors.success : colors.danger } },
                    t("gc_almjmwa"),
                    billCustomSum.toLocaleString(loc()),
                    " \u0645\u0646 ",
                    (Number(billTotal) || 0).toLocaleString(loc()),
                    " \u062C.\u0633")))),
            React.createElement("button", { onClick: handleCreateBillSplit, disabled: !canCreateBillSplit, className: "w-full mt-2 py-3 rounded-xl text-sm font-extrabold text-white", style: { backgroundColor: colors.primary, opacity: canCreateBillSplit ? 1 : 0.5 } }, t("insha_aqtsam_alfatwra")))),
        showFundraiserForm && (React.createElement(ToolSheet, { title: t("jma_tbraat"), onClose: () => setShowFundraiserForm(false) },
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: fundCause, onChange: (e) => setFundCause(e.target.value), placeholder: t("alsbb_mthal_msaada_asra"), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement(NumericAmountInput, { value: fundGoal, onChange: setFundGoal, placeholder: t("alhdf_j_s"), className: `w-full border rounded-xl px-3 py-2 text-xs mb-2 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement("input", { dir: "ltr", type: "date", value: fundDeadline, onChange: (e) => setFundDeadline(e.target.value), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement("button", { onClick: () => { onCreateFundraiser(fundCause.trim(), Number(fundGoal), fundDeadline || null); setShowFundraiserForm(false); setFundCause(""); setFundGoal(""); setFundDeadline(""); }, disabled: !fundCause.trim() || !fundGoal, className: "w-full mt-2 py-3 rounded-xl text-sm font-extrabold text-white", style: { backgroundColor: colors.primary, opacity: (!fundCause.trim() || !fundGoal) ? 0.5 : 1 } }, t("bd_jma_altbraat")))),
        showTaskForm && (React.createElement(ToolSheet, { title: t("qayma_mham"), onClose: () => setShowTaskForm(false) },
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: taskListTitle, onChange: (e) => setTaskListTitle(e.target.value), placeholder: t("anwan_alqayma_mthal_thdyr"), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            taskDrafts.map((td, i) => {
                var _a;
                return (React.createElement("div", { key: i, className: "rounded-xl border p-2 mb-2", style: { borderColor: colors.border } },
                    React.createElement("input", { value: td.text, onChange: (e) => setTaskDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, text: e.target.value } : d))), dir: isRTL() ? "rtl" : "ltr", placeholder: t("gc_almhma", { i: i + 1 }), className: "w-full border rounded-xl px-2 py-1.5 text-xs mb-1.5", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
                    React.createElement("div", { className: `flex ${rowStart()} gap-1.5` },
                        React.createElement("div", { className: "flex-1 relative" },
                            React.createElement("input", { list: `members-list-${i}`, defaultValue: ((_a = group.members.find((m) => m.id === td.assigneeId)) === null || _a === void 0 ? void 0 : _a.name) || "", onChange: (e) => {
                                    const found = group.members.find((m) => m.name === e.target.value);
                                    if (found)
                                        setTaskDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, assigneeId: found.id } : d)));
                                }, placeholder: t("bhth"), className: "w-full border rounded-xl px-2 py-1.5 text-[11px]", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
                            React.createElement("datalist", { id: `members-list-${i}` }, group.members.map((mem) => React.createElement("option", { key: mem.id, value: mem.name })))),
                        React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", type: "date", value: td.dueAt, onChange: (e) => setTaskDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, dueAt: e.target.value } : d))), className: "flex-1 border rounded-xl px-2 py-1.5 text-[11px]", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }))));
            }),
            React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                React.createElement("button", { onClick: () => setTaskDrafts((prev) => { var _a; return [...prev, { text: "", assigneeId: (_a = group.members[0]) === null || _a === void 0 ? void 0 : _a.id, dueAt: "" }]; }), className: "text-[11px]", style: { color: colors.primary } }, t("mhma")),
                React.createElement("button", { onClick: () => {
                        var _a;
                        const validTasks = taskDrafts.filter((t) => t.text.trim());
                        if (!taskListTitle.trim() || validTasks.length === 0)
                            return;
                        onCreateTaskList(taskListTitle.trim(), validTasks);
                        setShowTaskForm(false);
                        setTaskListTitle("");
                        setTaskDrafts([{ text: "", assigneeId: (_a = group.members[0]) === null || _a === void 0 ? void 0 : _a.id, dueAt: "" }]);
                    }, className: "flex-1 py-3 rounded-xl text-sm font-extrabold text-white", style: { backgroundColor: colors.primary } }, t("nshr_qayma_almham"))))),
        false && (React.createElement("div", { style: { borderTop: `1px solid ${colors.border}`, backgroundColor: colors.primaryLight } },
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-3 py-1.5` },
                React.createElement("div", { className: "w-7 h-7 rounded-full flex items-center justify-center animate-pulse shrink-0", style: { backgroundColor: colors.primary } },
                    React.createElement(Radio, { size: 12, color: "#fff" })),
                React.createElement("div", { className: `flex-1 ${textStart()}`, style: { minWidth: 0 } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primaryDark } }, t("gc_mhadtha_swtya")),
                        React.createElement("span", { className: "text-[10px] font-extrabold tabular-nums px-1.5 py-0.5 rounded-full", style: { backgroundColor: colors.primary + "22", color: colors.primary } },
                            vcMins,
                            ":",
                            vcSecs)),
                    React.createElement("span", { className: "text-[10px] truncate block", style: { color: colors.primaryDark } },
                        voiceChatJoined ? t("gc_ant") : "",
                        voiceChatParticipants.length > 0 ? (voiceChatJoined ? t("fasl_qayma") : "") + voiceChatParticipants.map((p) => p.name).join(t("fasl_qayma")) : "",
                        (voiceChatParticipants.length + (voiceChatJoined ? 1 : 0)) === 0 ? t("gc_la_ahd") : "")),
                voiceChatJoined ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 shrink-0` },
                    React.createElement("button", { onClick: leaveVoiceChat, className: "rounded-full px-2 py-1 border shrink-0", style: { borderColor: colors.primary } },
                        React.createElement("span", { className: "text-[10px] font-bold", style: { color: colors.primary } }, t("mghadra_2"))),
                    amVoiceHost && (React.createElement("button", { onClick: () => setConfirmEndAll(true), className: "rounded-full px-2.5 py-1.5", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-[10px] font-bold text-white" }, t("inha_lljmya")))))) : (React.createElement("button", { onClick: () => setVoiceChatJoined(true), className: "rounded-full px-3 py-1.5 shrink-0", style: { backgroundColor: colors.primary } },
                    React.createElement("span", { className: "text-[10px] font-bold text-white" }, t("andmam"))))))),
        confirmEndAll && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setConfirmEndAll(false), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.5)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 24, right: 24, top: "35%", zIndex: 41, backgroundColor: colors.card, borderRadius: 20, padding: 20 } },
                React.createElement("div", { className: "flex flex-col items-center mb-4" },
                    React.createElement("div", { className: "w-12 h-12 rounded-full flex items-center justify-center mb-3", style: { backgroundColor: colors.danger + "18" } },
                        React.createElement(Radio, { size: 22, color: colors.danger })),
                    React.createElement("p", { className: "text-sm font-extrabold text-center", style: { color: colors.text } }, t("gc_inha_lljmya")),
                    React.createElement("p", { className: "text-xs text-center mt-1", style: { color: colors.textMuted } },
                        t("gc_stghlq"),
                        vcMins,
                        ":",
                        vcSecs)),
                React.createElement("button", { onClick: endVoiceChatForAll, className: "w-full py-2.5 rounded-xl text-sm font-extrabold text-white mb-2", style: { backgroundColor: colors.danger } }, t("inha_lljmya")),
                React.createElement("button", { onClick: () => setConfirmEndAll(false), className: "w-full py-2.5 rounded-xl text-sm font-bold", style: { backgroundColor: colors.card, border: `1px solid ${colors.border}`, color: colors.textMuted } }, t("ilgha"))))),
        group.e2e ? React.createElement(E2eBar, { e2e: group.e2e }) : null,
        (group.e2e && group.e2e.state !== "ready") ? null : React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-2 border-t relative`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("input", { ref: mediaInputRef, type: "file", accept: "image/*,video/*", onChange: (e) => {
                    var _a;
                    const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    e.target.value = "";
                    setShowAttachMenu(false);
                    if (!file)
                        return;
                    if (file.size > MAX_FILE_SIZE_BYTES) {
                        showToast(`تعذّر إرسال ${file.name} (${formatFileSize(file.size)}) — الحد الأقصى ${MAX_FILE_SIZE_LABEL} في المعاينة`, "error");
                        return;
                    }
                    const isVideo = file.type.startsWith("video/");
                    const reader = new FileReader();
                    reader.onload = (ev) => onSendFile(file.name, file.size, ev.target.result, isVideo ? "video" : "image", file);
                    reader.readAsDataURL(file);
                }, className: "hidden" }),
            React.createElement("input", { ref: fileInputRef, type: "file", onChange: (e) => {
                    var _a;
                    const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    e.target.value = "";
                    setShowAttachMenu(false);
                    if (!file)
                        return;
                    if (file.size > MAX_FILE_SIZE_BYTES) {
                        showToast(`تعذّر إرسال ${file.name} (${formatFileSize(file.size)}) — الحد الأقصى ${MAX_FILE_SIZE_LABEL} في المعاينة`, "error");
                        return;
                    }
                    onSendFile(file.name, file.size, null, "file", file);
                }, className: "hidden" }),
            showAttachMenu && React.createElement("div", { onClick: () => setShowAttachMenu(false), style: { position: "fixed", inset: 0, zIndex: 9 } }),
            showAttachMenu && (React.createElement("div", { className: "absolute bottom-14 right-2 rounded-2xl border shadow-lg overflow-hidden z-10 backdrop-blur-md sawa-pop-in", style: { backgroundColor: colors.card + "ee", borderColor: colors.border } },
                React.createElement("button", { onClick: () => { var _a; return (_a = mediaInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 180 } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.accent + "22" } },
                        React.createElement(Image, { size: 15, color: colors.accent })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("swra_aw_fydyw"))),
                React.createElement("button", { onClick: () => { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3` },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary + "22" } },
                        React.createElement(FileIconLucide, { size: 15, color: colors.primary })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mstnd"))),
                window.SawaChat && window.SawaChat.sendLocation && /^(fam_|grp_)/.test(group.id || "") && React.createElement("button", { onClick: () => { setShowAttachMenu(false); window.SawaChat.sendLocation(group.id); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3` },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: "#E5393522" } },
                        React.createElement(MapPin, { size: 15, color: "#E53935" })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, tl("الموقع", "Location"))))),
            React.createElement("button", { "aria-label": t("irfaq"), onClick: () => { setShowToolsMenu(false); setShowAttachMenu(!showAttachMenu); }, className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: showAttachMenu ? colors.primary : colors.bg } },
                React.createElement(Paperclip, { size: 16, color: showAttachMenu ? "#fff" : colors.textMuted })),
            showToolsMenu && React.createElement("div", { onClick: () => setShowToolsMenu(false), style: { position: "fixed", inset: 0, zIndex: 9 } }),
            showToolsMenu && (React.createElement("div", { className: "absolute bottom-14 right-16 rounded-2xl border shadow-lg overflow-hidden z-10 backdrop-blur-md sawa-pop-in", style: { backgroundColor: colors.card + "ee", borderColor: colors.border } },
                React.createElement("button", { onClick: () => openTool("poll"), className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 190 } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.textMuted + "22" } },
                        React.createElement(BarChart3, { size: 15, color: colors.textMuted })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("asttlaa"))),
                React.createElement("button", { onClick: () => openTool("bill"), className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 190 } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary + "22" } },
                        React.createElement(Banknote, { size: 15, color: colors.primary })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("aqtsam_fatwra"))),
                React.createElement("button", { onClick: () => openTool("fund"), className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.accent + "22" } },
                        React.createElement(Gift, { size: 15, color: colors.accent })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("jma_tbraat"))),
                React.createElement("button", { onClick: () => openTool("tasks"), className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.success + "22" } },
                        React.createElement(CheckCircle2, { size: 15, color: colors.success })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("qayma_mham"))),
                !group.secret && !(liveGroupCall && liveGroupCall.inCall) && (React.createElement("button", { onClick: () => { startVoiceChat(); setShowToolsMenu(false); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3` },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary + "22" } },
                        React.createElement(Radio, { size: 15, color: colors.primary })),
                    React.createElement("div", { className: `${textStart()}` },
                        React.createElement("span", { className: "text-xs font-bold block", style: { color: colors.text } }, t("bd_mhadtha_swtya")),
                        React.createElement("span", { className: "text-[9px]", style: { color: colors.textMuted } }, t("ghrfa_mftwha_bla_rnyn"))))))),
            !group.secret && React.createElement("button", { "aria-label": t("idafa"), onClick: () => { setShowAttachMenu(false); setShowToolsMenu(!showToolsMenu); }, className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: showToolsMenu ? colors.primary : colors.bg } },
                React.createElement(Plus, { size: 16, color: showToolsMenu ? "#fff" : colors.textMuted })),
            onSendSticker && React.createElement("button", { "aria-label": t("rmwz_tabyrya"), onClick: () => { setShowGStickers(!showGStickers); setShowToolsMenu(false); setShowAttachMenu(false); }, className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: showGStickers ? colors.primary : colors.bg } },
                React.createElement(Smile, { size: 16, color: showGStickers ? "#fff" : colors.textMuted })),
            React.createElement("button", { "aria-label": "@", onClick: () => handleTextChange(text + "@"), className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: colors.bg } },
                React.createElement(AtSign, { size: 16, color: colors.textMuted })),
            React.createElement(ChatComposerInput, { value: text, onChange: handleTextChange, placeholder: t("aktb_rsala_lishara_adw"), disabled: recorder.isRecording, onEnter: handleSend }),
            text.trim() ? (React.createElement("button", { "aria-label": t("irsal"), onClick: handleSend, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary } },
                React.createElement(Send, { size: 16, color: "#fff", style: { transform: "scaleX(-1)" } }))) : recorder.isRecording ? (React.createElement("button", { "aria-label": tl("إرسال التسجيل", "Send recording"), onClick: recorder.stop, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger } },
                React.createElement(Square, { size: 14, color: "#fff", fill: "#fff" }))) : (React.createElement("button", { "aria-label": t("gc_tsjyl"), onClick: recorder.start, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.accent } },
                React.createElement(Mic, { size: 16, color: "#fff" })))),
        React.createElement(RecordingBar, { isRecording: recorder.isRecording, seconds: recorder.seconds, micError: recorder.micError, onCancel: recorder.cancel, maxSeconds: recorder.maxSeconds }),
        viewingImage && (React.createElement(MediaLightbox, { items: mediaItems, startIndex: Math.max(0, mediaItems.findIndex((it) => it.url === viewingImage)), onClose: () => setViewingImage(null), onForward: (it) => { setViewingImage(null); setForwardingText({ id: it.id, text: it.name, cid: group.id }); } })),
        forwardingText && (React.createElement(ForwardPickerScreen, { conversations: allConversations, groups: allGroups, contacts: contactsForForward, currentConversationId: group.id, onForward: (destinationIds) => { onForward(forwardingText, destinationIds); setForwardingText(null); }, onClose: () => setForwardingText(null) })),
        groupMsgMenu && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setGroupMsgMenu(null), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.35)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 12, overflow: "hidden" } },
                React.createElement("div", { className: "px-5 pt-3 pb-2 border-b", style: { borderColor: colors.border } },
                    React.createElement("span", { className: `block ${textStart()} text-[11px] truncate`, style: { color: colors.textMuted } }, groupMsgMenu.text || "")),
                onReact && React.createElement("div", { className: `flex ${rowStart()} gap-3 px-5 py-3 border-b`, style: { borderColor: colors.border } }, QUICK_REACTIONS.map((e) => React.createElement("button", { key: e, className: "text-xl", onClick: () => { onReact(groupMsgMenu.id, e); setGroupMsgMenu(null); } }, e))),
                [
                    { icon: MessageCircle, label: t("rd"), act: () => setGReply({ id: groupMsgMenu.id, text: groupMsgMenu.text || "", senderId: groupMsgMenu.senderId, senderName: groupMsgMenu.senderName }) },
                    { icon: Share2, label: t("twjyh_2"), act: () => setForwardingText({ id: groupMsgMenu.id, text: groupMsgMenu.text, cid: group.id }) },
                    { icon: Copy, label: t("nskh"), act: () => { copyText(groupMsgMenu.text || ""); showToast(t("gc_tm_alnskh"), "success"); } },
                ].concat(groupMsgMenu.mine && groupMsgMenu.text ? [{ icon: Edit2, label: t("tadyl"), act: () => { setEditingMessageId(groupMsgMenu.id); setEditingText(groupMsgMenu.text || ""); } }] : [])
                .concat(onDeleteMessage ? [{ icon: Trash2, label: t("hdhf"), act: () => setGDel({ id: groupMsgMenu.id, canAll: groupMsgMenu.mine || isAdmin }) }] : [])
                .map((item, ii) => React.createElement("button", { key: ii, onClick: () => { item.act(); setGroupMsgMenu(null); }, className: `w-full flex ${rowStart()} items-center gap-3 px-5 py-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement(item.icon, { size: 16, color: colors.textMuted }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, item.label))),
                React.createElement("button", { onClick: () => setGroupMsgMenu(null), className: "w-full px-5 py-3" },
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.textMuted } }, t("ilgha")))))),
        null));
}
function UnifiedSearchScreen({ conversations, groups, shipments, taxiTripsHistory, messagesByConversation, groupMessages, onOpenChat, onOpenGroup, onClose }) {
    const { colors } = useTheme();
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();
    const matchedContacts = q
        ? [...conversations.filter((c) => c.name.toLowerCase().includes(q)), ...groups.filter((g) => g.name.toLowerCase().includes(q))]
        : [];
    const matchedShipments = q ? shipments.filter((s) => s.destination.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) : [];
    const matchedTrips = q ? taxiTripsHistory.filter((t) => t.destination.toLowerCase().includes(q)) : [];
    const matchedConvoMessages = q
        ? conversations.flatMap((c) => (messagesByConversation[c.id] || []).filter((m) => { var _a; return (_a = m.text) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q); }).map((m) => ({ ...m, convoName: c.name, convoId: c.id })))
        : [];
    const matchedGroupMessages = q
        ? groups.flatMap((g) => (groupMessages[g.id] || []).filter((m) => { var _a; return (_a = m.text) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q); }).map((m) => ({ ...m, groupName: g.name, groupData: g })))
        : [];
    const hasAnyResults = matchedContacts.length || matchedShipments.length || matchedTrips.length || matchedConvoMessages.length || matchedGroupMessages.length;
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("bhth"), onBack: onClose }),
        React.createElement("div", { className: "p-3 border-b", style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-full border px-3 py-2`, style: { borderColor: colors.border, backgroundColor: colors.bg } },
                React.createElement(Search, { size: 15, color: colors.textMuted }),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: query, onChange: (e) => setQuery(e.target.value), placeholder: t("abhth_fy_almhadthat_alshhnat"), className: "flex-1 bg-transparent text-sm outline-none", style: { color: colors.text }, autoFocus: true }))),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            !q && React.createElement(EmptyState, { icon: Search, label: t("abhth_abr_kl_khdmat") }),
            q && !hasAnyResults && React.createElement(EmptyState, { icon: X, label: t("la_twjd_ntayj_mtabqa_2") }),
            matchedContacts.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("h4", { className: "text-xs font-extrabold mb-2", style: { color: colors.text } }, t("jhat_alatsal_walmhadthat")),
                matchedContacts.map((item) => {
                    const isGroup = !!item.members;
                    return (React.createElement(Card, { key: item.id, className: `flex ${rowStart()} items-center cursor-pointer` },
                        React.createElement("button", { onClick: () => (isGroup ? onOpenGroup(item) : onOpenChat(item)), className: `w-full flex ${rowStart()} items-center ${textStart()}` },
                            isGroup ? React.createElement(Users2, { size: 16, color: colors.primary, className: `${ms("2")}` }) : React.createElement(User, { size: 16, color: colors.primary, className: `${ms("2")}` }),
                            React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, item.name))));
                }))),
            (matchedShipments.length > 0 || matchedTrips.length > 0) && (React.createElement(React.Fragment, null,
                React.createElement("h4", { className: "text-xs font-extrabold mb-2 mt-3", style: { color: colors.text } }, t("irsal_iksbrys_wtaksy_swa")),
                matchedShipments.map((s) => (React.createElement(Card, { key: s.id, className: `flex ${rowStart()} items-center gap-2` },
                    React.createElement(Truck, { size: 14, color: colors.primary }),
                    React.createElement("span", { className: "text-xs", style: { color: colors.text } },
                        s.id,
                        " \u2014 ",
                        s.category,
                        " \u2190 ",
                        s.destination)))),
                matchedTrips.map((trip) => (React.createElement(Card, { key: trip.id, className: `flex ${rowStart()} items-center gap-2` },
                    React.createElement(Car, { size: 14, color: colors.primary }),
                    React.createElement("span", { className: "text-xs", style: { color: colors.text } },
                        "\u0631\u062D\u0644\u0629 \u0625\u0644\u0649 ",
                        trip.destination)))))),
            matchedConvoMessages.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("h4", { className: "text-xs font-extrabold mb-2 mt-3", style: { color: colors.text } }, t("rsayl_mtabqa_mhadthtk")),
                matchedConvoMessages.map((m) => (React.createElement("button", { key: m.id, onClick: () => onOpenChat({ id: m.convoId, name: m.convoName }), className: `w-full ${textStart()}` },
                    React.createElement(Card, null,
                        React.createElement("div", { className: "text-[11px] font-bold mb-0.5", style: { color: colors.primary } }, m.convoName),
                        React.createElement("div", { className: "text-xs", style: { color: colors.text } }, m.text))))))),
            matchedGroupMessages.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("h4", { className: "text-xs font-extrabold mb-2 mt-3", style: { color: colors.text } },
                    "\u0631\u0633\u0627\u0626\u0644 \u0645\u0637\u0627\u0628\u0642\u0629 (",
                    matchedGroupMessages[0].groupName,
                    ")"),
                matchedGroupMessages.map((m) => (React.createElement("button", { key: m.id, onClick: () => onOpenGroup(m.groupData), className: `w-full ${textStart()}` },
                    React.createElement(Card, null,
                        React.createElement("div", { className: "text-xs", style: { color: colors.text } }, m.text))))))))));
}
function NewConversationScreen({ onCreate, onClose, contacts = null, onPickContact }) {
    const { colors } = useTheme();
    const [name, setName] = useState("");
    // C2: على السحابة لا أسماء تجريبيّة — المحادثة مع جهة اتّصالٍ حقيقيّة
    if (contacts) {
        return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
            React.createElement(TopBar, { title: t("mhadtha_jdyda"), onBack: onClose }),
            React.createElement("div", { className: "flex-1 overflow-y-auto" },
                React.createElement("p", { className: `text-xs font-bold px-4 pt-4 pb-2 ${textStart()}`, style: { color: colors.textMuted } }, t("c2_pick_contact")),
                contacts.length === 0 && React.createElement("p", { className: "text-xs px-4 py-6 text-center", style: { color: colors.textMuted } }, t("c2_no_contacts")),
                contacts.map((c) => React.createElement(ContactRow, { key: c.id, contact: c, isOnline: !!c.online, colors: colors, onPress: () => onPickContact && onPickContact(c) })))));
    }
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("mhadtha_jdyda"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            React.createElement("p", { className: "text-[11px] mb-3", style: { color: colors.textMuted } }, t("mwqta_bs_lltjrba_bdwn")),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("asm_jha_alatsal_tjryby")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: name, onChange: (e) => setName(e.target.value), placeholder: t("mthal_namat_babkr"), className: "w-full border rounded-xl px-3 py-3 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement(Button, { label: t("abda_almhadtha"), onPress: () => name.trim() && onCreate(name.trim()), disabled: !name.trim() }))));
}
function NewBroadcastListScreen({ conversations, onCreate, onClose }) {
    const { colors } = useTheme();
    const [name, setName] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    function toggle(id) {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("qayma_bth_jdyda"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("trsl_nfs_alrsala_lkl")),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("asm_alqayma_lk_ant")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: name, onChange: (e) => setName(e.target.value), placeholder: t("mthal_asdqa_alaml"), className: "w-full border rounded-xl px-3 py-3 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } },
                "\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0633\u062A\u0644\u0645\u064A\u0646 (",
                selectedIds.length,
                ")"),
            conversations.length === 0 && React.createElement("p", { className: "text-xs text-center mt-4", style: { color: colors.textMuted } }, t("ma_fyh_mhadthat_bad")),
            conversations.map((c) => (React.createElement("button", { "aria-label": t("takyd"), key: c.id, onClick: () => toggle(c.id), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl border p-3 mb-2`, style: { borderColor: selectedIds.includes(c.id) ? colors.primary : colors.border, backgroundColor: colors.card } },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, c.name),
                React.createElement("div", { className: "w-5 h-5 rounded-full border-2 flex items-center justify-center", style: { borderColor: colors.primary, backgroundColor: selectedIds.includes(c.id) ? colors.primary : "transparent" } }, selectedIds.includes(c.id) && React.createElement(Check, { size: 12, color: "#fff" }))))),
            React.createElement("div", { className: "mt-4" },
                React.createElement(Button, { label: t("insha_qayma_albth_mstlm", { length: selectedIds.length }), onPress: () => name.trim() && selectedIds.length > 0 && onCreate(name.trim(), selectedIds), disabled: !name.trim() || selectedIds.length === 0 })))));
}
function BroadcastListScreen({ list, conversations, myUserId, onSend, onBack }) {
    const { colors } = useTheme();
    const [text, setText] = useState("");
    const recipients = list.recipientIds.map((id) => conversations.find((c) => c.id === id)).filter(Boolean);
    function handleSend() {
        if (!text.trim())
            return;
        onSend(text.trim());
        setText("");
    }
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: list.name, onBack: onBack }),
        React.createElement("div", { className: `p-3 border-b flex ${rowStart()} items-center gap-1.5`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(Users2, { size: 13, color: colors.primary }),
            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.textMuted } },
                "\u0628\u062B \u0625\u0644\u0649 ",
                recipients.length,
                ": ",
                recipients.map((r) => r.name).join("، "))),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            list.sentMessages.length === 0 && React.createElement(EmptyState, { icon: Send, label: t("lsa_ma_bthyt_ay") }),
            list.sentMessages.map((m) => (React.createElement("div", { key: m.id, className: "flex flex-col mb-2 items-start" },
                React.createElement("div", { className: "max-w-[78%] rounded-2xl border px-3 py-2", style: { backgroundColor: colors.primary, borderColor: colors.border } },
                    React.createElement("span", { className: "text-sm text-white" }, m.text)),
                React.createElement("span", { className: "text-[9px] mt-0.5", style: { color: colors.textMuted } },
                    "\u0628\u064F\u062B\u064E\u0651\u062A \u0644\u0640",
                    recipients.length,
                    " \u0634\u062E\u0635"))))),
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(ChatComposerInput, { value: text, onChange: setText, placeholder: t("aktb_rsala_llbth"), onEnter: handleSend }),
            React.createElement("button", { "aria-label": t("irsal"), onClick: handleSend, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary } },
                React.createElement(Send, { size: 16, color: "#fff", style: { transform: "scaleX(-1)" } })))));
}
function NewGroupScreen({ onCreate, onClose, contacts = [] }) {
    const { colors } = useTheme();
    const [name, setName] = useState("");
    const [selected, setSelected] = useState([]);
    const [query, setQuery] = useState("");
    const [manualName, setManualName] = useState("");
    const filtered = useMemo(function () {
        const q = query.trim();
        if (!q) return contacts;
        return contacts.filter(function (c) { return c.name.indexOf(q) !== -1; });
    }, [contacts, query]);
    function toggle(nm) {
        setSelected(function (prev) { return prev.indexOf(nm) === -1 ? prev.concat([nm]) : prev.filter(function (x) { return x !== nm; }); });
    }
    function addManual() {
        const nm = manualName.trim();
        if (!nm) return;
        if (selected.indexOf(nm) === -1) setSelected(selected.concat([nm]));
        setManualName("");
    }
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("mjmwaa_jdyda"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("asm_almjmwaa")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: name, onChange: (e) => setName(e.target.value), placeholder: t("mthal_aayla"), className: "w-full border rounded-xl px-3 py-3 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("alaada")),
            selected.length > 0 && React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-2.5" }, selected.map(function (nm) {
                return React.createElement("button", { key: nm, onClick: function () { toggle(nm); }, className: "flex flex-row items-center gap-1 rounded-full px-2.5 py-1", style: { backgroundColor: colors.primaryLight } },
                    React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primary } }, nm),
                    React.createElement(X, { size: 11, color: colors.primary }));
            })),
            React.createElement("div", { className: "flex flex-row items-center gap-2 border rounded-xl px-3 py-2 mb-2", style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement(Search, { size: 14, color: colors.textMuted }),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: query, onChange: (e) => setQuery(e.target.value), placeholder: t("misc_bhth_jhat"), className: "flex-1 bg-transparent text-sm outline-none", style: { color: colors.text } })),
            React.createElement("div", { className: "rounded-xl border mb-3 overflow-hidden", style: { borderColor: colors.border, backgroundColor: colors.card } },
                filtered.length === 0
                    ? React.createElement("div", { className: "px-3 py-4 text-center text-[11px]", style: { color: colors.textMuted } }, t("la_twjd_ntayj"))
                    : filtered.slice(0, 40).map(function (c, i) {
                        const on = selected.indexOf(c.name) !== -1;
                        return React.createElement("button", { key: c.name + i, onClick: function () { toggle(c.name); }, className: "w-full flex flex-row items-center gap-2.5 px-3 py-2.5 border-b", style: { borderColor: colors.border } },
                            React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-extrabold", style: { backgroundColor: on ? colors.primary : colors.primaryLight, color: on ? "#fff" : colors.primary } }, on ? "✓" : (c.name || "?").charAt(0)),
                            React.createElement("div", { className: "flex-1", style: { minWidth: 0, textAlign: "right" } },
                                React.createElement("span", { className: "text-sm font-bold block truncate", style: { color: colors.text } }, c.name),
                                React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, c.source)));
                    })),
            React.createElement("div", { className: "flex flex-row items-center gap-2 mb-4" },
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: manualName, onChange: (e) => setManualName(e.target.value), placeholder: t("misc_aw_aktb"), className: "flex-1 border rounded-xl px-3 py-2.5 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("button", { onClick: addManual, className: "rounded-xl px-3 py-2.5 text-xs font-extrabold", style: { backgroundColor: colors.primaryLight, color: colors.primary } }, t("idafa"))),
            React.createElement(Button, { label: t("insha_almjmwaa"), onPress: () => name.trim() && onCreate(name.trim(), selected), disabled: !name.trim() || selected.length === 0 }))));
}

function StatsScreen({ transactions, onBack }) {
    const { colors } = useTheme();
    const totalCredit = transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const totalDebit = transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const maxVal = Math.max(totalCredit, totalDebit, 1);
    // تجميع حسب اليوم (نفس تاريخ العملية، مبسّط باستخدام toDateString)
    const byDay = {};
    transactions.forEach((txn) => {
        const day = new Date(txn.ts).toLocaleDateString(loc(), { weekday: "short" });
        if (!byDay[day])
            byDay[day] = { credit: 0, debit: 0 };
        byDay[day][txn.type] += txn.amount;
    });
    const days = Object.keys(byDay);
    const maxDayVal = Math.max(...days.map((d) => Math.max(byDay[d].credit, byDay[d].debit)), 1);
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("alihsayyat"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` },
                React.createElement(Card, { style: { flex: 1, padding: 12 } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                        React.createElement(ArrowDownLeft, { size: 14, color: colors.success }),
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, t("ijmaly_aldkhl"))),
                    React.createElement("div", { className: "text-lg font-extrabold mt-1", style: { color: colors.success } }, totalCredit.toLocaleString(loc()))),
                React.createElement(Card, { style: { flex: 1, padding: 12 } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                        React.createElement(ArrowUpRight, { size: 14, color: colors.danger }),
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, t("ijmaly_almsrwf"))),
                    React.createElement("div", { className: "text-lg font-extrabold mt-1", style: { color: colors.danger } }, totalDebit.toLocaleString(loc())))),
            React.createElement(Card, { style: { padding: 14 } },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-3` },
                    React.createElement(TrendingUp, { size: 14, color: colors.primary }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("aldkhl_mqabl_almsrwf"))),
                React.createElement("div", { className: `flex ${rowStart()} items-end gap-2`, style: { height: 100 } },
                    React.createElement("div", { className: "flex-1 flex flex-col items-center justify-end" },
                        React.createElement("div", { className: "w-full rounded-t-md", style: { height: `${(totalCredit / maxVal) * 100}%`, backgroundColor: colors.success, minHeight: 4 } }),
                        React.createElement("span", { className: "text-[10px] mt-1", style: { color: colors.textMuted } }, t("dkhl"))),
                    React.createElement("div", { className: "flex-1 flex flex-col items-center justify-end" },
                        React.createElement("div", { className: "w-full rounded-t-md", style: { height: `${(totalDebit / maxVal) * 100}%`, backgroundColor: colors.danger, minHeight: 4 } }),
                        React.createElement("span", { className: "text-[10px] mt-1", style: { color: colors.textMuted } }, t("msrwf"))))),
            days.length > 0 && (React.createElement(Card, { style: { padding: 14 } },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("hsb_alywm")),
                React.createElement("div", { className: `flex ${rowStart()} items-end gap-3 mt-3`, style: { height: 90 } }, days.map((day) => (React.createElement("div", { key: day, className: "flex-1 flex flex-col items-center justify-end" },
                    React.createElement("div", { className: `w-full flex ${rowStart()} gap-0.5`, style: { height: 70, alignItems: "flex-end" } },
                        React.createElement("div", { className: "flex-1 rounded-t-sm", style: { height: `${(byDay[day].credit / maxDayVal) * 100}%`, backgroundColor: colors.success, minHeight: byDay[day].credit > 0 ? 3 : 0 } }),
                        React.createElement("div", { className: "flex-1 rounded-t-sm", style: { height: `${(byDay[day].debit / maxDayVal) * 100}%`, backgroundColor: colors.danger, minHeight: byDay[day].debit > 0 ? 3 : 0 } })),
                    React.createElement("span", { className: "text-[9px] mt-1", style: { color: colors.textMuted } }, day))))))))));
}
const NOTIF_TYPE_ICONS = { message: MessageCircle, schedule: Clock, mention: AtSign, shipment: Truck, ride: Car, event: Calendar, proximity: MapPin };
// تصنيف كل نوع إشعار لمصغّر (mini-app) — أساس فلتر مركز الإشعارات الموحّد
const NOTIF_CATEGORY_MAP = { message: "chat", mention: "chat", schedule: "family", proximity: "family", event: "family" };
const NOTIF_CATEGORIES = [
    { key: "all", labelKey: "ntf_alkl" },
    // ⛔ فئة محادثات لا محلّ لها في أرحام — كالأجهزة المرتبطة في «حسابي»
    ...(IS_RAHIM ? [] : [{ key: "chat", labelKey: "ntf_rsayl" }]),
    { key: "family", labelKey: "ntf_sla_alrhm" },
];
function NotificationCenterScreen({ notifications, onMarkRead, onBack }) {
    const { colors } = useTheme();
    const [category, setCategory] = useState("all");
    const availableCategories = NOTIF_CATEGORIES.filter((c) => c.key === "all" || notifications.some((n) => NOTIF_CATEGORY_MAP[n.type] === c.key));
    const filtered = category === "all" ? notifications : notifications.filter((n) => NOTIF_CATEGORY_MAP[n.type] === category);
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("mrkz_alishaarat"), onBack: onBack }),
        availableCategories.length > 2 && (React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 px-4 py-2.5 border-b`, style: { borderColor: colors.border } }, availableCategories.map((c) => React.createElement(Chip, { key: c.key, label: t(c.labelKey), active: category === c.key, onPress: () => setCategory(c.key) })))),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            filtered.length === 0 && React.createElement(EmptyState, { icon: BellIcon, label: category === "all" ? "لا توجد إشعارات جديدة" : "لا توجد إشعارات بهذا التصنيف" }),
            filtered.map((n) => {
                const Icon = NOTIF_TYPE_ICONS[n.type] || BellIcon;
                return (React.createElement("button", { key: n.id, onClick: () => onMarkRead(n.id), className: `w-full ${textStart()}` },
                    React.createElement(Card, { className: `flex ${rowStart()} items-center`, style: { opacity: n.read ? 0.55 : 1 } },
                        React.createElement("div", { className: `w-9 h-9 rounded-full flex items-center justify-center ${ms("2.5")}`, style: { backgroundColor: colors.primaryLight } },
                            React.createElement(Icon, { size: 16, color: colors.primary })),
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, n.title),
                            React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, n.body)),
                        !n.read && React.createElement("span", { className: "w-2 h-2 rounded-full", style: { backgroundColor: colors.accent } }))));
            }))));
}
function SessionsScreen({ sessions, onRevoke, onRevokeAll, onBack }) {
    const { colors } = useTheme();
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("alajhza_almsjla"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            sessions.length > 1 && (React.createElement(Button, { variant: "outline", icon: LogOut, label: t("tsjyl_khrwj_mn_kl"), onPress: onRevokeAll, className: "mb-3", style: { borderColor: colors.danger, color: colors.danger } })),
            sessions.map((s) => (React.createElement(Card, { key: s.id, className: `flex ${rowStart()} items-center` },
                React.createElement("div", { className: `w-9 h-9 rounded-full flex items-center justify-center ${ms("2.5")}`, style: { backgroundColor: colors.primaryLight } },
                    React.createElement(Smartphone, { size: 16, color: colors.primary })),
                React.createElement("div", { className: "flex-1" },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, s.device),
                    React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } },
                        "\u0622\u062E\u0631 \u0646\u0634\u0627\u0637: ",
                        s.lastActive)),
                React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => onRevoke(s.id) },
                    React.createElement(X, { size: 18, color: colors.danger }))))))));
}
// ============================================================================
// المكالمات — نفس تبويب سوا الأصلي (سجل مكالمات بسيط)
// ============================================================================
function CallSettingsScreen({ settings, onUpdate, onClearLog, onOpenSpeedDial, onBack }) {
    const { colors } = useTheme();
    const [subSection, setSubSection] = useState(null); // null | privacy | scheduling | notifications | history | help
    const [confirmingClearSub, setConfirmingClearSub] = useState(false);
    if (subSection === "privacy") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("alkhswsya"), onBack: () => setSubSection(null) }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement(Card, null,
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between` },
                        React.createElement("div", { className: `flex-1 ${textStart()} ${ms("2")}` },
                            React.createElement("span", { className: "text-sm font-bold block", style: { color: colors.text } }, t("almwafqa_qbl_aldkhwl_balmkalma")),
                            React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, t("ay_mkalma_warda_twda"))),
                        React.createElement("button", { onClick: () => onUpdate({ ...settings, requireApproval: !settings.requireApproval }), className: "w-10 h-5 rounded-full relative shrink-0", style: { backgroundColor: settings.requireApproval ? colors.primary : colors.border } },
                            React.createElement("span", { className: "absolute top-0.5 w-4 h-4 rounded-full bg-white", style: { [settings.requireApproval ? "right" : "left"]: 2 } })))))));
    }
    if (subSection === "scheduling") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("aljdwla"), onBack: () => setSubSection(null) }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement(Card, null,
                    React.createElement("span", { className: "text-sm font-bold block mb-2", style: { color: colors.text } }, t("nwa_almkalma_alaftrady_and")),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("button", { onClick: () => onUpdate({ ...settings, defaultScheduleType: "audio" }), className: `flex-1 rounded-xl border-2 py-2.5 flex ${rowStart()} items-center justify-center gap-1.5`, style: { borderColor: settings.defaultScheduleType === "audio" ? colors.primary : colors.border } },
                            React.createElement(Phone, { size: 14, color: settings.defaultScheduleType === "audio" ? colors.primary : colors.textMuted }),
                            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("swtya"))),
                        React.createElement("button", { onClick: () => onUpdate({ ...settings, defaultScheduleType: "video" }), className: `flex-1 rounded-xl border-2 py-2.5 flex ${rowStart()} items-center justify-center gap-1.5`, style: { borderColor: settings.defaultScheduleType === "video" ? colors.primary : colors.border } },
                            React.createElement(Video, { size: 14, color: settings.defaultScheduleType === "video" ? colors.primary : colors.textMuted }),
                            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("fydyw"))))))));
    }
    if (subSection === "notifications") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("alishaarat"), onBack: () => setSubSection(null) }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("mda_altdhkyr_alaftradya_qbl")),
                React.createElement("select", { value: settings.defaultReminderMinutes || 15, onChange: (e) => onUpdate({ ...settings, defaultReminderMinutes: Number(e.target.value) }), className: "w-full border rounded-xl px-3 py-2.5 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } },
                    React.createElement("option", { value: 5 }, t("qbl_5_dqayq")),
                    React.createElement("option", { value: 15 }, t("qbl_15_dqyqa")),
                    React.createElement("option", { value: 30 }, t("qbl_30_dqyqa")),
                    React.createElement("option", { value: 60 }, t("qbl_saaa"))))));
    }
    if (subSection === "history") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("sjl_almkalmat"), onBack: () => setSubSection(null) }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } }, !confirmingClearSub ? (React.createElement("button", { onClick: () => setConfirmingClearSub(true), className: `w-full ${textStart()} block` },
                React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2` },
                    React.createElement(Trash2, { size: 15, color: colors.danger }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("msh_sjl_almkalmat_nhayya"))))) : (React.createElement(Card, null,
                React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, t("msh_kl_sjl_almkalmat")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement(Button, { label: t("msh_nhayya"), onPress: () => { onClearLog(); setConfirmingClearSub(false); setSubSection(null); }, style: { flex: 1, backgroundColor: colors.danger } }),
                    React.createElement(Button, { label: t("ilgha"), variant: "outline", onPress: () => setConfirmingClearSub(false), style: { flex: 1 } })))))));
    }
    if (subSection === "help") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("almsaada"), onBack: () => setSubSection(null) }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement(Card, null,
                    React.createElement("p", { className: "text-xs leading-relaxed", style: { color: colors.text } }, t("lay_astfsar_hwl_almkalmat"))))));
    }
    const categories = [
        { key: "privacy", icon: Lock, label: t("cst_alkhswsya"), desc: t("cst_almwafqa") },
        { key: "scheduling", icon: Calendar, label: t("cst_aljdwla"), desc: t("cst_nwa_almkalma") },
        { key: "speedDial", icon: Star, label: t("cst_alarqam"), desc: null, external: true },
        { key: "notifications", icon: BellIcon, label: t("cst_alishaarat"), desc: t("cst_tdhkyrat") },
        { key: "history", icon: FileClock, label: t("cst_sjl"), desc: t("cst_msh_alsjl") },
        { key: "help", icon: HelpCircle, label: t("cst_almsaada"), desc: null },
    ];
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("iadadat_almkalmat"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } }, categories.map((cat) => (React.createElement("button", { "aria-label": t("altaly"), key: cat.key, onClick: () => (cat.external ? onOpenSpeedDial() : setSubSection(cat.key)), className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-3.5 border-b`, style: { borderColor: colors.border, backgroundColor: colors.bg } },
            React.createElement("div", { className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primaryLight } }, React.createElement(cat.icon, { size: 16, color: colors.primaryDark })),
            React.createElement("div", { className: `flex-1 ${textStart()}` },
                React.createElement("span", { className: "text-sm font-bold block", style: { color: colors.text } }, cat.label),
                cat.desc && React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, cat.desc)),
            React.createElement(ChevronLeft, { size: 16, color: colors.textMuted, style: { transform: "scaleX(-1)" } })))))));
}
//@@sawa-part:5
