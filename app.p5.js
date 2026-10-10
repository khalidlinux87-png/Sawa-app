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
                React.createElement("div", { className: "w-12 h-12 rounded-full flex items-center justify-center mb-1.5", style: { backgroundColor: colors.primary } },
                    React.createElement("span", { className: "text-base font-extrabold text-white" }, (_a = m.name) === null || _a === void 0 ? void 0 : _a.charAt(0))),
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
function VoiceMessageBubble({ url, duration, mine, transcript }) {
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
            React.createElement("audio", { ref: audioRef, src: url, onEnded: () => { setPlaying(false); if (window.__sawaActiveAudio === stopSelfRef) window.__sawaActiveAudio = null; }, className: "hidden" }),
            React.createElement("button", { onClick: () => {
                    var _a, _b;
                    if (playing) {
                        (_a = audioRef.current) === null || _a === void 0 ? void 0 : _a.pause();
                        setPlaying(false);
                        if (window.__sawaActiveAudio === stopSelfRef) window.__sawaActiveAudio = null;
                    }
                    else {
                        // أوقف أي رسالة صوتية أخرى تعمل الآن
                        if (window.__sawaActiveAudio && window.__sawaActiveAudio !== stopSelfRef) {
                            try { window.__sawaActiveAudio.current(); } catch (e) { }
                        }
                        window.__sawaActiveAudio = stopSelfRef;
                        (_b = audioRef.current) === null || _b === void 0 ? void 0 : _b.play();
                        setPlaying(true);
                    }
                }, className: "w-8 h-8 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: mine ? "rgba(255,255,255,0.25)" : colors.primaryLight } }, playing ? React.createElement(Pause, { size: 14, color: mine ? "#fff" : colors.primary }) : React.createElement(Play, { size: 14, color: mine ? "#fff" : colors.primary })),
            React.createElement("div", { className: "flex-1 h-1 rounded-full", style: { backgroundColor: mine ? "rgba(255,255,255,0.3)" : colors.border } }),
            React.createElement("span", { className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } }, duration)),
        transcript && (React.createElement("button", { onClick: () => setShowTranscript(!showTranscript), className: "mt-1.5" },
            React.createElement("span", { className: "text-[10px] font-bold underline", style: { color: mine ? "#ffffffdd" : colors.primary } }, showTranscript ? "إخفاء النص" : "عرض النص"))),
        transcript && showTranscript && (React.createElement("p", { className: "text-xs mt-1", style: { color: mine ? "#fff" : colors.text } }, transcript))));
}
// ============================================================
// GroupInfoScreen — معلومات المجموعة وإدارة الأعضاء
// المشرف وحده يرى أزرار التعديل والترقية والإزالة.
// ============================================================
function GroupInfoScreen({ group, myUserId, mediaCount = 0, onRename, onAddMembers, onRemoveMember, onToggleAdmin, onLeave, onBack }) {
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
                    isAdmin && React.createElement("button", { onClick: () => setShowAdd(true), className: `flex ${rowStart()} items-center gap-1` },
                        React.createElement(UserPlus, { size: 14, color: colors.primary }),
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primary } }, t("gi_idafa")))),
                group.members.map((m) => React.createElement("div", { key: m.id, className: `flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                    React.createElement("div", { className: "w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0", style: { backgroundColor: colors.primaryLight, color: colors.primary } }, (m.name || "?").charAt(0)),
                    React.createElement("div", { className: `flex-1 min-w-0 ${textStart()}` },
                        React.createElement("div", { className: "text-sm truncate", style: { color: colors.text } }, m.name),
                        m.role === "admin" && React.createElement("div", { className: "text-[10px] font-bold", style: { color: colors.accent } }, t("gi_mshrf"))),
                    // المشرف لا يدير نفسه من هنا — الخروج له زر مستقل بالأسفل
                    isAdmin && m.id !== myUserId && React.createElement("button", { "aria-label": t("gi_khyarat"), onClick: () => setMemberMenu(m), className: "w-7 h-7 flex items-center justify-center shrink-0" },
                        React.createElement(MoreVertical, { size: 15, color: colors.textMuted }))))),
            // ── الخروج ──
            React.createElement("div", { className: "mt-3 mb-8", style: { backgroundColor: colors.card } },
                React.createElement("button", { onClick: () => setConfirmLeave(true), className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-3.5` },
                    React.createElement(LogOut, { size: 17, color: colors.danger, style: { transform: "scaleX(-1)" } }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("gi_mghadra"))))),
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
                React.createElement("p", { className: `text-sm font-extrabold mb-3 ${textStart()}`, style: { color: colors.text } }, t("gi_idafa_adw")),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: newMemberName, autoFocus: true, onChange: (e) => setNewMemberName(e.target.value), placeholder: t("gi_asm_aladw"), className: `w-full rounded-xl border px-3 py-2.5 text-sm mb-3 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
                React.createElement("button", { onClick: confirmAdd, className: "w-full rounded-2xl py-3", style: { backgroundColor: colors.primary } },
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

function ForwardPickerScreen({ conversations, groups, currentConversationId, onForward, onClose }) {
    const { colors } = useTheme();
    const [selectedIds, setSelectedIds] = useState([]);
    const targets = [
        ...conversations.filter((c) => c.id !== currentConversationId).map((c) => ({ id: c.id, name: c.name, kind: "chat" })),
        ...groups.map((g) => ({ id: g.id, name: g.name, kind: "group" })),
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
function useChatDraft(draft, onSaveDraft) {
    const [text, setText] = useState(draft || "");
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
        discardRef.current = false;
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            streamRef.current = stream;
            // iOS Safari لا يدعم audio/webm — يفشل التسجيل صامتاً بدونه
            const mimeType = pickMimeType();
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType: mimeType })
                : new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = function (e) { chunks.push(e.data); };
            recorder.onstop = function () {
                const total = secondsRef.current;
                const discarded = discardRef.current;
                teardown();
                if (discarded || total < MIN_SECONDS) return;   // إلغاء أو نقرة عابرة
                const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
                const url = URL.createObjectURL(blob);
                const duration = Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
                const text = transcriptRef.current.trim();
                if (onCompleteRef.current) onCompleteRef.current(url, duration, text || null);
            };
            recorder.start();
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
            if (transcribe && SpeechRec) {
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
        }).catch(function () { flashError(); });
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

function ChatScreen({ conversation, messages, onSend, onForward, onReact, onSendSticker, onSendFile, onSendVoice, onEditMessage, onMarkViewedOnce, onTogglePin, onToggleStar, onOpenInfo, disappearing, setDisappearing, background, onBack, myUserId, isBlocked, allConversations, allGroups, isTyping, onLogCall, isOnline, callSettings, groupPersons = {}, onDeleteMessage, onOpenFamilyProfile, draft = "", onSaveDraft, unreadCount = 0, }) {
    var _a, _b;
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [text, setText, clearDraft] = useChatDraft(draft, onSaveDraft);
    // عدد غير المقروء يُلتقط مرة عند الفتح — يبقى الفاصل ثابتاً بعدها
    const initialUnreadRef = useRef(unreadCount);
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
        onComplete: (url, duration, transcript) => onSendVoice(url, duration, transcript),
    });
    const [showSearch, setShowSearch] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [viewOnceNext, setViewOnceNext] = useState(false);
    const [forwardingText, setForwardingText] = useState(null);
    const [showCallChoice, setShowCallChoice] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const scrollContainerRef = useRef(null);
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el)
            return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (nearBottom)
            el.scrollTop = el.scrollHeight;
    }, [messages.length, isTyping]);
    const [viewingImage, setViewingImage] = useState(null);
    // كل صور وفيديوهات المحادثة بالترتيب — تُمرَّر للمعاينة لتمكين التنقّل
    const mediaItems = useMemo(() => (messages || [])
        .filter((m) => (m.type === "image" || m.type === "video") && m.fileUrl && !m.deleted)
        .map((m) => ({ url: m.fileUrl, type: m.type, name: m.fileName || m.text || "" })), [messages]);
    const mediaInputRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState("");
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
        React.createElement(TopBar, { title: conversation.isSavedMessages ? t("rsayly_almhfwza") : conversation.name, avatar: !conversation.isSavedMessages, subtitle: isTyping ? t("ch_yktb") : (isOnline ? t("ch_mtsl_alan") : null), onBack: onBack, actions: React.createElement("div", { className: "flex flex-row items-center gap-3" },
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
                React.createElement("button", { onClick: () => { setShowCallChoice(false); setActiveCall("audio"); }, className: `w-full flex ${rowStart()} items-center gap-2 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 160 } },
                    React.createElement(Phone, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mkalma_swtya"))),
                React.createElement("button", { onClick: () => { setShowCallChoice(false); setActiveCall("video"); }, className: `w-full flex ${rowStart()} items-center gap-2 px-4 py-3` },
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
            const days = daysSinceContact(fp.lastContactDate);
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
                    proximityLabels[fp.proximity] || "",
                    " \u2190")));
        })(),
        pinnedMessage && (React.createElement("button", { "aria-label": t("tthbyt"), onClick: () => { var _a; return (_a = document.querySelector(`[data-message-id="${pinnedMessage.id}"]`)) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "center" }); }, className: `w-full flex ${rowStart()} items-center gap-2 px-3 py-2 border-b`, style: { borderColor: colors.border, backgroundColor: colors.primaryLight } },
            React.createElement(Pin, { size: 12, color: colors.primary, fill: colors.primary }),
            React.createElement("span", { className: `text-[11px] font-bold flex-1 ${textStart()} truncate`, style: { color: colors.primaryDark } }, pinnedMessage.text))),
        React.createElement("div", { style: { position: "relative", flex: 1, minHeight: 0 } },
            React.createElement("div", { ref: scrollContainerRef, className: "flex-1 overflow-y-auto p-4", style: { background: bgGradient || colors.bg, height: "100%", overflowY: "auto" }, onScroll: (e) => {
                    const el = e.currentTarget;
                    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                    setShowScrollBtn(distFromBottom > 120);
                } },
                messages.length === 0 && !isTyping && React.createElement(EmptyChatState, { icon: MessageCircle }),
                messages.map((m, mi) => {
                    const mine = m.senderUserId === myUserId;
                    // فقاعات الصور والفيديو والملصقات خلفيتها شفافة لا ملوّنة،
                    // فالنص الأبيض عليها غير مقروء.
                    const onTint = mine && !(["sticker", "image", "video"].includes(m.type) && !m.viewOnce);
                    // فاصل يوضّح أين توقّفت القراءة
                    const dividerAt = unreadDividerIndex(messages.length, initialUnreadRef.current);
                    const showDivider = mi === dividerAt && dividerAt > 0;
                    return (React.createElement(React.Fragment, { key: m.id },
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
                                : React.createElement(MediaUnavailable, { label: t("fydyw") })) : m.type === "file" ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                                React.createElement(FileIconLucide, { size: 18, color: mine ? "#fff" : colors.primary }),
                                React.createElement("div", null,
                                    React.createElement("div", { className: "text-xs font-bold", style: { color: mine ? "#fff" : colors.text } }, m.text),
                                    React.createElement("div", { className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } },
                                        (m.fileSize / 1024).toFixed(0),
                                        t("ch_kylwbayt"))))) : m.type === "voice" ? (React.createElement(VoiceMessageBubble, { url: m.audioUrl, duration: m.duration, mine: mine, transcript: m.transcript })) : editingMessageId === m.id ? (React.createElement("div", { className: "flex flex-col gap-1.5" },
                                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: editingText, onChange: (e) => setEditingText(e.target.value), className: "text-sm rounded px-2 py-1", style: { backgroundColor: mine ? "rgba(255,255,255,0.15)" : colors.bg, color: mine ? "#fff" : colors.text, border: `1px solid ${mine ? "#ffffff55" : colors.border}` }, autoFocus: true }),
                                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                                    React.createElement("button", { onClick: () => { onEditMessage(m.id, editingText.trim()); setEditingMessageId(null); }, className: "text-[10px] font-bold", style: { color: mine ? "#fff" : colors.primary } }, t("hfz")),
                                    React.createElement("button", { onClick: () => setEditingMessageId(null), className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } }, t("ilgha"))))) : (React.createElement("span", { className: "text-sm", style: { color: mine ? "#fff" : colors.text } },
                                m.text,
                                m.edited && React.createElement("span", { className: "text-[10px] opacity-70" }, t("ch_madla")))), React.createElement("div", { className: `flex ${rowStart()} items-center gap-1 justify-end`, style: { marginTop: 2, marginBottom: -2 } }, mine && m.status && (React.createElement("span", { title: m.status === "read" ? t("ch_tmt_alqraa") : m.status === "delivered" ? t("ch_tm_altslym") : t("ch_tm_alirsal") }, m.status === "sent" ? React.createElement(Check, { size: 12, color: onTint ? "rgba(255,255,255,0.85)" : colors.textMuted }) : React.createElement(CheckCheck, { size: 12, color: m.status === "read" ? (onTint ? "#BFE3FF" : colors.primary) : (onTint ? "rgba(255,255,255,0.85)" : colors.textMuted) }))), React.createElement("span", { className: "text-[10px]", style: { color: onTint ? "rgba(255,255,255,0.75)" : colors.textMuted } }, m.time || (m.createdAt ? new Date(m.createdAt).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }) : "")))),
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
        isBlocked ? (React.createElement("div", { className: `flex ${rowStart()} items-center justify-center gap-2 p-3 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(Ban, { size: 14, color: colors.danger }),
            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.danger } }, t("hzrt_hdha_alshkhs_algh")))) : (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-2 border-t relative`, style: { borderColor: colors.border, backgroundColor: colors.card } },
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
                        reader.onload = (ev) => onSendFile(file.name, file.size, ev.target.result, isVideo ? "video" : "image", wasViewOnce);
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
                    onSendFile(file.name, file.size, null, "file");
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
                React.createElement(Send, { size: 16, color: "#fff", style: { transform: "scaleX(-1)" } }))) : recorder.isRecording ? (React.createElement("button", { onClick: recorder.stop, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger } },
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
                        showReactions && (React.createElement("div", { className: `flex ${rowStart()} gap-3 px-5 py-3 border-b`, style: { borderColor: colors.border } }, QUICK_REACTIONS.map((e) => (React.createElement("button", { key: e, onClick: () => { onReact(msgMenu.id, e); setShowReactions(false); }, className: "text-xl" }, e))))),
                        [
                            { icon: Smile, label: t("tfaal"), act: () => setShowReactions((v) => !v), toggle: true },
                            { icon: MessageCircle, label: t("rd"), act: () => setReplyTo({ id: msgMenu.id, text: msgMenu.text }) },
                            { icon: Share2, label: t("twjyh_2"), act: () => setForwardingText(msgMenu.text) },
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
        viewingImage && (React.createElement(MediaLightbox, { items: mediaItems, startIndex: Math.max(0, mediaItems.findIndex((it) => it.url === viewingImage)), onClose: () => setViewingImage(null), onForward: (it) => { setViewingImage(null); setForwardingText(it.url); } })),
        forwardingText && (React.createElement(ForwardPickerScreen, { conversations: allConversations, groups: allGroups, currentConversationId: conversation.id, onForward: (destinationIds) => { onForward(forwardingText, destinationIds); setForwardingText(null); }, onClose: () => setForwardingText(null) }))));
}
const GROUP_ADMIN_ACTIONS = ["تسمية المجموعة", "إدارة الأعضاء"];
function GroupChatScreen({ group, messages, myUserId, onSend, onSendFile, onSendVoice, onEditMessage, onCreatePoll, onEditPoll, onVotePoll, onCreateBillSplit, onPayBillSplit, onCreateFundraiser, onContributeFundraiser, onCreateTaskList, onToggleTaskStatus, onAddTaskNote, onForward, allConversations, allGroups, draft = "", onSaveDraft, unreadCount = 0, onBack, onRenameGroup, onAddGroupMembers, onRemoveGroupMember, onToggleGroupAdmin, onLeaveGroup }) {
    var _a, _b;
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [text, setText, clearDraft] = useChatDraft(draft, onSaveDraft);
    const initialUnreadRef = useRef(unreadCount);
    const [showMentions, setShowMentions] = useState(false);
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
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [viewingImage, setViewingImage] = useState(null);
    // كل صور وفيديوهات المحادثة بالترتيب — تُمرَّر للمعاينة لتمكين التنقّل
    const mediaItems = useMemo(() => (messages || [])
        .filter((m) => (m.type === "image" || m.type === "video") && m.fileUrl && !m.deleted)
        .map((m) => ({ url: m.fileUrl, type: m.type, name: m.fileName || m.text || "" })), [messages]);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState("");
    const recorder = useVoiceRecorder({
        transcribe: true,
        onComplete: (url, duration) => onSendVoice(url, duration),
    });
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchMatchIndex, setSearchMatchIndex] = useState(0);
    const [activeGroupCall, setActiveGroupCall] = useState(null); // null | "audio" | "video"
    const scrollContainerRef = useRef(null);
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el)
            return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (nearBottom)
            el.scrollTop = el.scrollHeight;
    }, [messages.length]);
    const [forwardingText, setForwardingText] = useState(null);
    const [groupMsgMenu, setGroupMsgMenu] = useState(null);
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
    function startVoiceChat() {
        setVoiceChatActive(true);
        setVoiceChatJoined(true);
        setVoiceChatHost(myUserId);
        setVoiceChatElapsed(0);
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
    }
    function insertMention(name) {
        setText((prev) => prev.slice(0, -1) + `@${name} `);
        setShowMentions(false);
    }
    function handleSend() {
        if (!text.trim())
            return;
        onSend(text.trim());
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
    function renderMessageText(msgText) {
        const parts = msgText.split(/(@[\u0600-\u06FFa-zA-Z]+)/g);
        return parts.map((part, i) => part.startsWith("@") ? (React.createElement("span", { key: i, className: "font-bold", style: { color: colors.accent } }, part)) : (React.createElement("span", { key: i }, part)));
    }
    if (showGroupInfo) {
        return React.createElement(GroupInfoScreen, {
            group: group,
            myUserId: myUserId,
            mediaCount: (messages || []).filter((m) => m.type === "image" || m.type === "video").length,
            onRename: (n) => onRenameGroup && onRenameGroup(group.id, n),
            onAddMembers: (names) => onAddGroupMembers && onAddGroupMembers(group.id, names),
            onRemoveMember: (id) => onRemoveGroupMember && onRemoveGroupMember(group.id, id),
            onToggleAdmin: (id) => onToggleGroupAdmin && onToggleGroupAdmin(group.id, id),
            onLeave: () => { setShowGroupInfo(false); onLeaveGroup && onLeaveGroup(group.id); },
            onBack: () => setShowGroupInfo(false),
        });
    }
    if (activeGroupCall) {
        return React.createElement(GroupCallOverlay, { groupName: group.name, members: group.members, callType: activeGroupCall, onEnd: () => setActiveGroupCall(null) });
    }
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col relative" },
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-3 border-b`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("button", { "aria-label": t("altaly"), onClick: onBack },
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
        React.createElement("div", { ref: scrollContainerRef, className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            messages.length === 0 && React.createElement(EmptyChatState, { icon: UsersRound }),
            (function () {
            const rendered = messages.map((m, mi) => {
            var _a;
            const mine = m.senderId === myUserId;
            const sender = group.members.find((x) => x.id === m.senderId);

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
                        canEdit && (React.createElement("button", { onClick: () => { setEditingPollId(m.id); setPollQuestion(m.question); setPollOptions(m.options.map((o) => o.text)); setShowPollForm(true); } },
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
                    React.createElement(SenderAvatar, { name: (sender && sender.name) || t("gc_swal"), size: 20 }),
                    React.createElement("span", { className: "text-[10px] font-bold", style: { color: senderColor((sender && sender.name) || t("gc_swal")) } }, sender === null || sender === void 0 ? void 0 : sender.name)),
                React.createElement("div", { className: `max-w-[78%] rounded-2xl border ${["image", "video"].includes(m.type) ? "" : "px-3 py-2"}`, style: { backgroundColor: ["image", "video"].includes(m.type) ? "transparent" : mine ? colors.primary : colors.card, borderColor: ["image", "video"].includes(m.type) ? "transparent" : colors.border, cursor: "pointer" }, onContextMenu: (e) => { e.preventDefault(); setGroupMsgMenu({ id: m.id, text: m.text, mine: mine, senderName: (sender && sender.name) || "" }); }, onTouchStart: (e) => { const t0 = Date.now(); const el = e.currentTarget; const onEnd = () => { if (Date.now() - t0 > 500) { setGroupMsgMenu({ id: m.id, text: m.text, mine: mine, senderName: (sender && sender.name) || "" }); } el.removeEventListener("touchend", onEnd); }; el.addEventListener("touchend", onEnd); } }, m.type === "image" ? (React.createElement("button", { onClick: () => setViewingImage(m.fileUrl), className: "block -m-1" }, m.fileUrl ? React.createElement("img", { src: m.fileUrl, alt: m.text, className: "rounded-xl max-h-56 w-full object-cover", style: { minWidth: 160 } }) : React.createElement(MediaUnavailable, { label: t("swra") }))) : m.type === "video" ? (React.createElement("video", { src: m.fileUrl, controls: true, className: "rounded-xl max-h-56 w-full", style: { minWidth: 200 } })) : m.type === "file" ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                    React.createElement(FileIconLucide, { size: 18, color: mine ? "#fff" : colors.primary }),
                    React.createElement("div", null,
                        React.createElement("div", { className: "text-xs font-bold", style: { color: mine ? "#fff" : colors.text } }, m.text),
                        React.createElement("div", { className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } },
                            (m.fileSize / 1024).toFixed(0),
                            t("gc_kylwbayt"))))) : m.type === "voice" ? (React.createElement(VoiceMessageBubble, { url: m.audioUrl, duration: m.duration, mine: mine })) : editingMessageId === m.id ? (React.createElement("div", { className: "flex flex-col gap-1.5" },
                    React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: editingText, onChange: (e) => setEditingText(e.target.value), className: "text-sm rounded px-2 py-1", style: { backgroundColor: mine ? "rgba(255,255,255,0.15)" : colors.bg, color: mine ? "#fff" : colors.text, border: `1px solid ${mine ? "#ffffff55" : colors.border}` }, autoFocus: true }),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("button", { onClick: () => { onEditMessage(m.id, editingText.trim()); setEditingMessageId(null); }, className: "text-[10px] font-bold", style: { color: mine ? "#fff" : colors.primary } }, t("hfz")),
                        React.createElement("button", { onClick: () => setEditingMessageId(null), className: "text-[10px]", style: { color: mine ? "#ffffffcc" : colors.textMuted } }, t("ilgha"))))) : (React.createElement("span", { className: "text-sm", style: { color: mine ? "#fff" : colors.text } },
                    renderMessageText(m.text),
                    m.edited && React.createElement("span", { className: "text-[10px] opacity-70" }, t("gc_madla"))))),
                // التوجيه والتعديل في قائمة الضغط المطوّل — إظهارهما تحت كل
                // رسالة يزدحم ويكرّر ما هو متاح أصلاً. الوقت مكانهما كما في الخاص.
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-0.5` },
                    React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } },
                        m.createdAt ? new Date(m.createdAt).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }) : ""))));
        });
            const dividerAt = unreadDividerIndex(messages.length, initialUnreadRef.current);
            if (dividerAt > 0) {
                rendered.splice(dividerAt, 0, React.createElement(UnreadDivider, { key: "unread-divider" }));
            }
            return rendered;
            })()),
        showMentions && (React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 p-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } }, group.members.filter((m) => m.id !== myUserId).map((m) => (React.createElement("button", { key: m.id, onClick: () => insertMention(m.name), className: "text-xs rounded-full border px-2.5 py-1", style: { borderColor: colors.border, color: colors.text } },
            "@",
            m.name))))),
        showPollForm && (React.createElement("div", { className: "p-3 border-t", style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                React.createElement("p", { className: "text-xs font-bold", style: { color: colors.text } }, editingPollId ? t("gc_tadyl_alastltla") : t("gc_astltla_jdyd")),
                React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => { setShowPollForm(false); setEditingPollId(null); setPollQuestion(""); setPollOptions(["", ""]); setPollDeadlineMinutes(null); setPollAnonymous(false); }, className: "w-7 h-7 rounded-full flex items-center justify-center", style: { backgroundColor: colors.bg } },
                    React.createElement(X, { size: 14, color: colors.textMuted }))),
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
                React.createElement("button", { onClick: handleCreatePoll, className: "text-[11px] font-bold mr-auto", style: { color: colors.primary } }, editingPollId ? t("gc_hfz_altadyl") : t("gc_nshr"))))),
        showBillForm && (React.createElement("div", { className: "p-3 border-t", style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("aqtsam_fatwra")),
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
            React.createElement("button", { onClick: handleCreateBillSplit, disabled: !canCreateBillSplit, className: "text-[11px] font-bold", style: { color: colors.primary } }, t("insha_aqtsam_alfatwra")))),
        showFundraiserForm && (React.createElement("div", { className: "p-3 border-t", style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("jma_tbraat")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: fundCause, onChange: (e) => setFundCause(e.target.value), placeholder: t("alsbb_mthal_msaada_asra"), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement(NumericAmountInput, { value: fundGoal, onChange: setFundGoal, placeholder: t("alhdf_j_s"), className: `w-full border rounded-xl px-3 py-2 text-xs mb-2 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement("input", { dir: "ltr", type: "date", value: fundDeadline, onChange: (e) => setFundDeadline(e.target.value), className: "w-full border rounded-xl px-3 py-2 text-xs mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }),
            React.createElement("button", { onClick: () => { onCreateFundraiser(fundCause.trim(), Number(fundGoal), fundDeadline || null); setShowFundraiserForm(false); setFundCause(""); setFundGoal(""); setFundDeadline(""); }, disabled: !fundCause.trim() || !fundGoal, className: "text-[11px] font-bold", style: { color: colors.primary } }, t("bd_jma_altbraat")))),
        showTaskForm && (React.createElement("div", { className: "p-3 border-t", style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("qayma_mham")),
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
                    }, className: "text-[11px] font-bold mr-auto", style: { color: colors.primary } }, t("nshr_qayma_almham"))))),
        voiceChatActive && (React.createElement("div", { style: { borderTop: `1px solid ${colors.border}`, backgroundColor: colors.primaryLight } },
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
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-2 border-t relative`, style: { borderColor: colors.border, backgroundColor: colors.card } },
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
                    reader.onload = (ev) => onSendFile(file.name, file.size, ev.target.result, isVideo ? "video" : "image");
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
                    onSendFile(file.name, file.size, null, "file");
                }, className: "hidden" }),
            showAttachMenu && (React.createElement("div", { className: "absolute bottom-14 right-2 rounded-2xl border shadow-lg overflow-hidden z-10 backdrop-blur-md sawa-pop-in", style: { backgroundColor: colors.card + "ee", borderColor: colors.border } },
                React.createElement("button", { onClick: () => { var _a; return (_a = mediaInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 180 } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.accent + "22" } },
                        React.createElement(Image, { size: 15, color: colors.accent })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("swra_aw_fydyw"))),
                React.createElement("button", { onClick: () => { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3` },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary + "22" } },
                        React.createElement(FileIconLucide, { size: 15, color: colors.primary })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mstnd"))))),
            React.createElement("button", { "aria-label": t("irfaq"), onClick: () => { setShowToolsMenu(false); setShowAttachMenu(!showAttachMenu); }, className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: showAttachMenu ? colors.primary : colors.bg } },
                React.createElement(Paperclip, { size: 16, color: showAttachMenu ? "#fff" : colors.textMuted })),
            showToolsMenu && (React.createElement("div", { className: "absolute bottom-14 right-16 rounded-2xl border shadow-lg overflow-hidden z-10 backdrop-blur-md sawa-pop-in", style: { backgroundColor: colors.card + "ee", borderColor: colors.border } },
                React.createElement("button", { onClick: () => { setShowPollForm(true); setShowToolsMenu(false); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 190 } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.textMuted + "22" } },
                        React.createElement(BarChart3, { size: 15, color: colors.textMuted })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("asttlaa"))),
                React.createElement("button", { onClick: () => { setShowBillForm(true); setShowToolsMenu(false); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border, minWidth: 190 } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary + "22" } },
                        React.createElement(Banknote, { size: 15, color: colors.primary })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("aqtsam_fatwra"))),
                React.createElement("button", { onClick: () => { setShowFundraiserForm(true); setShowToolsMenu(false); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.accent + "22" } },
                        React.createElement(Gift, { size: 15, color: colors.accent })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("jma_tbraat"))),
                React.createElement("button", { onClick: () => { setShowTaskForm(true); setShowToolsMenu(false); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.success + "22" } },
                        React.createElement(CheckCircle2, { size: 15, color: colors.success })),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("qayma_mham"))),
                !voiceChatActive && (React.createElement("button", { onClick: () => { startVoiceChat(); setShowToolsMenu(false); }, className: `w-full flex ${rowStart()} items-center gap-2.5 px-4 py-3` },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary + "22" } },
                        React.createElement(Radio, { size: 15, color: colors.primary })),
                    React.createElement("div", { className: `${textStart()}` },
                        React.createElement("span", { className: "text-xs font-bold block", style: { color: colors.text } }, t("bd_mhadtha_swtya")),
                        React.createElement("span", { className: "text-[9px]", style: { color: colors.textMuted } }, t("ghrfa_mftwha_bla_rnyn"))))))),
            React.createElement("button", { "aria-label": t("idafa"), onClick: () => { setShowAttachMenu(false); setShowToolsMenu(!showToolsMenu); }, className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: showToolsMenu ? colors.primary : colors.bg } },
                React.createElement(Plus, { size: 16, color: showToolsMenu ? "#fff" : colors.textMuted })),
            React.createElement("button", { onClick: () => handleTextChange(text + "@"), className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: colors.bg } },
                React.createElement(AtSign, { size: 16, color: colors.textMuted })),
            React.createElement(ChatComposerInput, { value: text, onChange: handleTextChange, placeholder: t("aktb_rsala_lishara_adw"), disabled: recorder.isRecording, onEnter: handleSend }),
            text.trim() ? (React.createElement("button", { "aria-label": t("irsal"), onClick: handleSend, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary } },
                React.createElement(Send, { size: 16, color: "#fff", style: { transform: "scaleX(-1)" } }))) : recorder.isRecording ? (React.createElement("button", { onClick: recorder.stop, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger } },
                React.createElement(Square, { size: 14, color: "#fff", fill: "#fff" }))) : (React.createElement("button", { "aria-label": t("gc_tsjyl"), onClick: recorder.start, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.accent } },
                React.createElement(Mic, { size: 16, color: "#fff" })))),
        React.createElement(RecordingBar, { isRecording: recorder.isRecording, seconds: recorder.seconds, micError: recorder.micError, onCancel: recorder.cancel, maxSeconds: recorder.maxSeconds }),
        viewingImage && (React.createElement(MediaLightbox, { items: mediaItems, startIndex: Math.max(0, mediaItems.findIndex((it) => it.url === viewingImage)), onClose: () => setViewingImage(null), onForward: (it) => { setViewingImage(null); setForwardingText(it.url); } })),
        forwardingText && (React.createElement(ForwardPickerScreen, { conversations: allConversations, groups: allGroups, currentConversationId: group.id, onForward: (destinationIds) => { onForward(forwardingText, destinationIds); setForwardingText(null); }, onClose: () => setForwardingText(null) })),
        groupMsgMenu && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setGroupMsgMenu(null), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.35)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 12, overflow: "hidden" } },
                React.createElement("div", { className: "px-5 pt-3 pb-2 border-b", style: { borderColor: colors.border } },
                    React.createElement("span", { className: `block ${textStart()} text-[11px] truncate`, style: { color: colors.textMuted } }, groupMsgMenu.text || "")),
                [
                    { icon: MessageCircle, label: t("rd"), act: () => setText((groupMsgMenu.senderName ? "@" + groupMsgMenu.senderName + " " : "") + "") },
                    { icon: Share2, label: t("twjyh_2"), act: () => setForwardingText(groupMsgMenu.text) },
                    { icon: Copy, label: t("nskh"), act: () => { copyText(groupMsgMenu.text || ""); showToast(t("gc_tm_alnskh"), "success"); } },
                ].concat(groupMsgMenu.mine && groupMsgMenu.text ? [{ icon: Edit2, label: t("tadyl"), act: () => { setEditingMessageId(groupMsgMenu.id); setEditingText(groupMsgMenu.text || ""); } }] : [])
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
function NewConversationScreen({ onCreate, onClose }) {
    const { colors } = useTheme();
    const [name, setName] = useState("");
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
