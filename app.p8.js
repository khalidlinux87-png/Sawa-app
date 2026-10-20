const ONBOARDING_SLIDES = [
    { icon: Compass, titleKey: "ob1_t", bodyKey: "ob1_b" },
    { icon: Lock, titleKey: "ob2_t", bodyKey: "ob2_b" },
    { icon: Users2, titleKey: "ob3_t", bodyKey: "ob3_b" },
    { icon: Image, titleKey: "ob4_t", bodyKey: "ob4_b" },
    { icon: Palette, titleKey: "ob5_t", bodyKey: "ob5_b" },
];
// ============================================================================
// غرف سوا — محادثة جماعية صوتية/مرئية بدعوة رابط
// ============================================================================
function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
const DEMO_PARTICIPANTS = [
    { id: "p-1", name: "أنت", mic: true, cam: true, host: true, avatar: "أ" },
    { id: "p-2", name: "نعمات بابكر", mic: true, cam: false, host: false, avatar: "ن" },
    { id: "p-3", name: "عثمان بابكر", mic: false, cam: true, host: false, avatar: "ع" },
];
// ============================================================
// LinkedDevicesScreen — الأجهزة المرتبطة (مثل واتساب Web)
// ============================================================
function LinkedDevicesScreen({ onBack }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    // online علم منطقي لا نصّ: كان اللون يُحسب بـ lastSeen.includes("متصل")
    // فتنكسر الحالة الخضراء بمجرّد ترجمة النصّ. والترجمة تتم وقت الرسم
    // لأن useState يُقيَّم مرّة واحدة عند التركيب فيتجمّد على لغة الدخول.
    const [devices, setDevices] = useState([
        { id: "d1", name: "Chrome على Windows", online: true, icon: "🖥️" },
        { id: "d2", name: "سوا Desktop — Mac", online: false, lastSeenKey: "dv_mndh_saatyn", icon: "💻" },
    ]);
    const [showQr, setShowQr] = useState(false);
    function removeDevice(id) {
        setDevices(prev => prev.filter(d => d.id !== id));
        showToast(t("tm_ilgha_rbt_aljhaz"), "success");
    }
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("alajhza_almrtbta"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto" },
            React.createElement("div", { className: "mx-4 mt-4 p-4 rounded-2xl", style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement("p", { className: `text-xs ${textStart()} leading-relaxed`, style: { color: colors.textMuted } }, t("arbt_swa_bmtsfhk_aw"))),
            React.createElement("div", { className: "px-4 mt-4" },
                React.createElement("button", { "aria-label": t("idafa"), onClick: () => setShowQr(!showQr), className: `w-full flex ${rowStart()} items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm`, style: { backgroundColor: colors.primary, color: "#fff" } },
                    React.createElement(Plus, { size: 16, color: "#fff" }),
                    t("rbt_jhaz_jdyd"))),
            showQr && (React.createElement("div", { className: "mx-4 mt-4 p-5 rounded-2xl flex flex-col items-center gap-3", style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement("p", { className: "text-xs font-bold", style: { color: colors.text } }, t("amsh_alrmz_mn_almtsfh")),
                React.createElement("div", { className: "w-36 h-36 rounded-xl flex items-center justify-center", style: { backgroundColor: "#fff", border: `1px solid ${colors.border}` } },
                    React.createElement(QrCode, { size: 100, color: "#000" })),
                React.createElement("p", { className: "text-[10px] text-center", style: { color: colors.textMuted } }, t("afth_sawa_app_web")))),
            devices.length > 0 && (React.createElement("div", { className: "px-4 mt-4" },
                React.createElement("p", { className: `text-xs font-extrabold mb-2 ${textStart()}`, style: { color: colors.textMuted } },
                    t("dv_alajhza_adad"),
                    devices.length,
                    ")"),
                devices.map(d => (React.createElement(Card, { key: d.id, className: "mb-2" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-3` },
                        React.createElement("span", { style: { fontSize: 28 } }, d.icon),
                        React.createElement("div", { className: `flex-1 ${textStart()}` },
                            React.createElement("p", { className: "text-sm font-bold", style: { color: colors.text } }, d.name),
                            React.createElement("p", { className: "text-[11px] mt-0.5", style: { color: d.online ? "#22C55E" : colors.textMuted } }, d.online ? t("dv_mtsl_alan") : t(d.lastSeenKey))),
                        React.createElement("button", { onClick: () => removeDevice(d.id), className: "px-3 py-1.5 rounded-xl text-xs font-bold", style: { backgroundColor: "#ef444420", color: "#ef4444" } }, t("ilgha_alrbt")))))))),
            React.createElement("div", { className: "h-6" }))));
}
// ============================================================
// SawaWrapped — إحصائيات الاستخدام (مثل Spotify Wrapped)
// ============================================================
function SawaWrappedScreen({ onBack, conversations, groups, showToast = () => { } }) {
    var _a;
    const { colors } = useTheme();
    const totalConvs = ((conversations === null || conversations === void 0 ? void 0 : conversations.length) || 0) + ((groups === null || groups === void 0 ? void 0 : groups.length) || 0);
    const stats = [
        { label: t("sw_rsala_arslt"), value: "342", icon: "💬", color: colors.primary },
        { label: t("sw_dqyqa_mkalmat"), value: "87", icon: "📞", color: "#22C55E" },
        { label: t("sw_swra_wwthyqa"), value: "24", icon: "📎", color: colors.accent },
        { label: t("sw_mhadtha_nshta"), value: String(totalConvs), icon: "🗂️", color: "#8B5CF6" },
        { label: t("sw_rsala_swtya"), value: "15", icon: "🎙️", color: "#F59E0B" },
        { label: t("sw_lhza_nshrtha"), value: "6", icon: "✨", color: "#EC4899" },
    ];
    // إحصائيات العائلة
    const allFamilyP = Object.values((groups === null || groups === void 0 ? void 0 : groups.reduce) ? {} : {}).flat();
    const overdueFamily = typeof getOverduePersons !== "undefined" ? getOverduePersons({}) : [];
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("ihsayyaty"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            React.createElement("div", { className: "rounded-2xl p-5 mb-4 text-center", style: { background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` } },
                React.createElement("p", { className: "text-white text-xs font-bold mb-1 opacity-80" }, t("swa_mlkhsk_hdha_alshhr")),
                React.createElement("p", { className: "text-white text-2xl font-extrabold" }, t("342_rsala")),
                React.createElement("p", { className: "text-white text-xs opacity-75 mt-1" }, t("ant_mn_akthr_almstkhdmyn"))),
            React.createElement("div", { className: "grid grid-cols-2 gap-3" }, stats.map((s, i) => (React.createElement("div", { key: i, className: `p-4 rounded-2xl ${textStart()}`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement("span", { style: { fontSize: 24 } }, s.icon),
                React.createElement("p", { className: "text-2xl font-extrabold mt-1", style: { color: s.color } }, s.value),
                React.createElement("p", { className: "text-[11px] mt-0.5 leading-snug", style: { color: colors.textMuted } }, s.label))))),
            React.createElement("div", { className: `mt-4 p-4 rounded-2xl ${textStart()}`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement("p", { className: "text-xs font-extrabold mb-2", style: { color: colors.text } }, t("akthr_mhadtha_hdha_alshhr")),
                React.createElement("p", { className: "text-sm font-bold", style: { color: colors.primary } }, ((_a = conversations === null || conversations === void 0 ? void 0 : conversations[1]) === null || _a === void 0 ? void 0 : _a.name) || "نعمات بابكر"),
                React.createElement("p", { className: "text-[11px] mt-0.5", style: { color: colors.textMuted } }, t("118_rsala_mtbadla"))),
            React.createElement("div", { className: `mt-3 p-4 rounded-2xl ${textStart()}`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement("p", { className: "text-xs font-extrabold mb-3", style: { color: colors.text } }, t("sla_alrhm_hdha_alshhr")),
                React.createElement("div", { className: `flex ${rowStart()} gap-3` },
                    React.createElement("div", { className: "flex-1 p-2.5 rounded-xl text-center", style: { backgroundColor: "#22C55E15" } },
                        React.createElement("p", { className: "text-lg font-extrabold", style: { color: "#22C55E" } }, "12"),
                        React.createElement("p", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, t("twasl_fy_alwqt"))),
                    React.createElement("div", { className: "flex-1 p-2.5 rounded-xl text-center", style: { backgroundColor: "#ef444415" } },
                        React.createElement("p", { className: "text-lg font-extrabold", style: { color: "#ef4444" } }, "2"),
                        React.createElement("p", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, t("fathm_altwasl"))),
                    React.createElement("div", { className: "flex-1 p-2.5 rounded-xl text-center", style: { backgroundColor: colors.primary + "15" } },
                        React.createElement("p", { className: "text-lg font-extrabold", style: { color: colors.primary } }, "3"),
                        React.createElement("p", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, t("mnasbat_hnat"))))),
            React.createElement("button", { "aria-label": t("msharka"), onClick: () => showToast(t("tm_nskh_almlkhs_jahz"), "success"), className: `w-full mt-4 py-3 rounded-2xl font-bold text-sm flex ${rowStart()} items-center justify-center gap-2`, style: { backgroundColor: colors.primaryLight, color: colors.primary } },
                React.createElement(Share2, { size: 15, color: colors.primary }),
                t("shark_mlkhsk")),
            React.createElement("div", { className: "h-6" }))));
}
// ============================================================
// ScheduleRoomModal — جدولة غرفة سوا مسبقاً
// ============================================================
function ScheduleRoomModal({ onSave, onClose }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const code = useMemo(() => generateRoomCode(), []);
    const link = window.SawaRTC && window.SawaRTC.roomLink ? window.SawaRTC.roomLink(code) : "sawa.app/room/" + code;
    function save() {
        if (!title.trim() || !date || !time) {
            showToast(t("akml_alanwan_waltarykh_walwqt"), "error");
            return;
        }
        onSave({ id: "sr-" + Date.now(), code, link, title: title.trim(), at: new Date(date + "T" + time).getTime() });
        showToast(t("jdwlt_alghrfa_alrabt_jahz"), "success");
        onClose();
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { onClick: onClose, style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.45)" } }),
        React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 16 } },
            React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto my-3", style: { backgroundColor: colors.border } }),
            React.createElement("p", { className: "text-sm font-extrabold text-center mb-4", style: { color: colors.text } }, t("jdwla_ghrfa_swa")),
            React.createElement("div", { className: "px-5" },
                React.createElement("label", { className: `text-[11px] font-bold block ${textStart()} mb-1`, style: { color: colors.textMuted } }, t("anwan_alajtmaa")),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: title, onChange: (e) => setTitle(e.target.value), placeholder: t("mthal_ajtmaa_alaayla_alasbway"), className: "w-full rounded-xl px-3 py-2.5 text-sm mb-3", style: { backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, minWidth: 0 } }),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-3` },
                    React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                        React.createElement("label", { className: `text-[11px] font-bold block ${textStart()} mb-1`, style: { color: colors.textMuted } }, t("altarykh")),
                        React.createElement("input", { dir: "ltr", type: "date", value: date, onChange: (e) => setDate(e.target.value), className: "w-full rounded-xl px-3 py-2.5 text-sm", style: { backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, minWidth: 0 } })),
                    React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                        React.createElement("label", { className: `text-[11px] font-bold block ${textStart()} mb-1`, style: { color: colors.textMuted } }, t("alwqt")),
                        React.createElement("input", { dir: "ltr", type: "time", value: time, onChange: (e) => setTime(e.target.value), className: "w-full rounded-xl px-3 py-2.5 text-sm", style: { backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, minWidth: 0 } }))),
                React.createElement("div", { className: `rounded-xl px-3 py-2.5 mb-4 flex ${rowStart()} items-center gap-2`, style: { backgroundColor: colors.primaryLight, border: `1px solid ${colors.primary}33` } },
                    React.createElement(Link2, { size: 14, color: colors.primary }),
                    React.createElement("span", { className: `flex-1 ${textStart()} text-xs font-bold truncate`, style: { color: colors.primary }, dir: "ltr" }, link),
                    React.createElement("button", { onClick: () => { copyText(link); showToast(t("nskh_alrabt_2"), "success"); }, className: "text-[10px] font-extrabold px-2 py-1 rounded-lg", "aria-label": t("nskh"), style: { backgroundColor: colors.primary, color: "#fff" } }, t("nskh"))),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: save, className: "flex-1 py-3 rounded-xl text-sm font-extrabold", style: { backgroundColor: colors.primary, color: "#fff" } }, t("hfz_almwad")),
                    React.createElement("button", { onClick: onClose, className: "flex-1 py-3 rounded-xl text-sm font-bold", style: { backgroundColor: colors.bg, color: colors.textMuted, border: `1px solid ${colors.border}` } }, t("ilgha")))))));
}
function SawaRoomScreen({ roomCode, onBack, familyMembers = [], onInviteFamily, groups = [], onSendTasksToGroup }) {
    var _a, _b, _c;
    const { colors, dataSaver } = useTheme();
    const { showToast } = useToast();
    const [participants, setParticipants] = useState([DEMO_PARTICIPANTS[0]]);
    const [myMic, setMyMic] = useState(true);
    const [myCam, setMyCam] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatText, setChatText] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [handRaised, setHandRaised] = useState(false);
    const [joining, setJoining] = useState(true);
    const [showQr, setShowQr] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [unreadChat, setUnreadChat] = useState(0);
    const [raisedHands, setRaisedHands] = useState([]); // معرّفات من رفعوا أيديهم
    const [roomLocked, setRoomLocked] = useState(false);
    const [hostMenu, setHostMenu] = useState(null); // المشارك المختار | null
    const [hostConfirm, setHostConfirm] = useState(null); // {action, participant} | null
    const [chatMode, setChatMode] = useState("casual"); // casual | business
    const [floatingReactions, setFloatingReactions] = useState([]);
    const [showReactionBar, setShowReactionBar] = useState(false);
    const [lowDataMode, setLowDataMode] = useState(dataSaver);
    const [activeSpeaker, setActiveSpeaker] = useState(null);
    const [noteKind, setNoteKind] = useState("point"); // decision | task | point
    const [showSummary, setShowSummary] = useState(false);
    const [sendingTasks, setSendingTasks] = useState(false);
    const [durationLimit, setDurationLimit] = useState(0); // بالدقائق، 0 = بلا حد
    const [showDurationPick, setShowDurationPick] = useState(false);
    const [expiryWarned, setExpiryWarned] = useState(false);
    const [showFamilyInvite, setShowFamilyInvite] = useState(false);
    const [pickedFamily, setPickedFamily] = useState([]);
    // ⚠️ غرفة الانتظار والرابط المخصص واجهة فقط — التحقق الفعلي يلزم الخادم عند كل طلب انضمام
    const [waitingRoomOn, setWaitingRoomOn] = useState(false);
    const [waitingQueue, setWaitingQueue] = useState([]);
    const [customSlug, setCustomSlug] = useState("");
    const [editingSlug, setEditingSlug] = useState(false);
    const [slugDraft, setSlugDraft] = useState("");
    const [isTyping, setIsTyping] = useState(false); // حالة الكتابة — تُصغّر شبكة المشاركين
    const amHost = (_a = participants.find((p) => p.id === "p-1")) === null || _a === void 0 ? void 0 : _a.host;
    const liveHostTarget = hostMenu ? participants.find((p) => p.id === hostMenu.id) : null;
    // المضيف يكتم مباشرة، لكن لا يفتح ميكروفون أحد بالقوة — يطلب فقط
    function muteParticipant(id) {
        const p = participants.find((x) => x.id === id);
        setParticipants((ps) => ps.map((x) => x.id === id ? { ...x, mic: false } : x));
        showToast(t("ktm_2", { name: p === null || p === void 0 ? void 0 : p.name }), "success");
    }
    function requestUnmute(id) {
        const p = participants.find((x) => x.id === id);
        setChatMessages((m) => [...m, {
                id: Date.now(), sender: t("rm_alnzam"), system: true,
                text: t("rm_tlb_almdyf_mn") + (p === null || p === void 0 ? void 0 : p.name) + t("rm_fth_almyk_sfx"),
                time: new Date().toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }),
            }]);
        if (!chatOpen)
            setUnreadChat((u) => u + 1);
        showToast(t("arsl_altlb_ila", { name: p === null || p === void 0 ? void 0 : p.name }), "success");
    }
    function muteEveryone() {
        setParticipants((ps) => ps.map((x) => x.id === "p-1" ? x : { ...x, mic: false }));
        showToast(t("ktm_jmya_almsharkyn"), "success");
    }
    function removeParticipant(id) {
        const p = participants.find((x) => x.id === id);
        setParticipants((ps) => ps.filter((x) => x.id !== id));
        setRaisedHands((r) => r.filter((x) => x !== id));
        if (id === "p-1")
            setHandRaised(false);
        showToast(t("azyl", { name: p === null || p === void 0 ? void 0 : p.name }), "success");
    }
    function transferHost(id) {
        var _a;
        setParticipants((ps) => ps.map((p) => ({ ...p, host: p.id === id })));
        showToast(t("nqlt_alastdafa_ila", { name: (_a = participants.find((x) => x.id === id)) === null || _a === void 0 ? void 0 : _a.name }), "info");
    }
    const roomLink = `sawa.app/room/${customSlug || roomCode}`;
    function saveSlug() {
        const clean = slugDraft.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "");
        if (clean.length < 3) {
            showToast(t("alasm_qsyr_jda"), "error");
            return;
        }
        setCustomSlug(clean);
        setEditingSlug(false);
        showToast(t("sar_rabtk_sawa_app", { slug: clean }), "success");
    }
    function admitGuest(g) {
        setWaitingQueue((q) => q.filter((x) => x.id !== g.id));
        setParticipants((p) => [...p, { id: g.id, name: g.name, mic: true, cam: false, host: false, avatar: g.name.charAt(0) }]);
        showToast(t("dkhl_2", { name: g.name }), "success");
    }
    function denyGuest(g) {
        setWaitingQueue((q) => q.filter((x) => x.id !== g.id));
        showToast(t("rfd_dkhwl", { name: g.name }), "info");
    }
    // محاكاة انضمام مشاركين تدريجياً
    useEffect(() => {
        const t1 = setTimeout(() => {
            setParticipants((p) => [...p, DEMO_PARTICIPANTS[1]]);
            setJoining(false);
        }, 2000);
        const t2 = setTimeout(() => {
            const g = DEMO_PARTICIPANTS[2];
            if (waitingRoomOn) {
                setWaitingQueue((q) => q.some((x) => x.id === g.id) ? q : [...q, { id: g.id, name: g.name }]);
            }
            else {
                setParticipants((p) => p.some((x) => x.id === g.id) ? p : [...p, g]);
            }
        }, 5000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);
    // مؤقت الغرفة
    useEffect(() => {
        const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    const remainingSec = durationLimit ? durationLimit * 60 - elapsed : null;
    useEffect(() => {
        if (remainingSec === null)
            return;
        if (remainingSec === 300 && !expiryWarned) {
            setExpiryWarned(true);
            showToast(t("tbqt_dqayq_ala"), "info");
        }
        if (remainingSec <= 0) {
            showToast(t("antha_wqt_alghrfa"), "info");
            onBack();
        }
    }, [remainingSec, expiryWarned, showToast, onBack]);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    function copyLink() {
        copyText(roomLink);
        showToast(t("tm_nskh_rabt_alghrfa"), "success");
    }
    function toggleHand() {
        const next = !handRaised;
        setHandRaised(next);
        setRaisedHands((r) => next ? [...r, "p-1"] : r.filter((x) => x !== "p-1"));
        showToast(next ? t("rm_rft_ydk") : t("rm_anzlt_ydk"), next ? "success" : "info");
    }
    const ROOM_REACTIONS = ["👏", "❤️", "😂", "👍", "🤲", "🎉"];
    function sendReaction(emoji) {
        const id = Date.now() + Math.random();
        setFloatingReactions((r) => [...r, { id, emoji, left: 12 + Math.random() * 70 }]);
        setTimeout(() => setFloatingReactions((r) => r.filter((x) => x.id !== id)), 2600);
    }
    // محاكاة المتحدث الحالي: يتغيّر بين من ميكروفونهم مفتوح
    useEffect(() => {
        const tmr = setInterval(() => {
            const speaking = participants.filter((p) => p.mic);
            setActiveSpeaker(speaking.length ? speaking[Math.floor(Math.random() * speaking.length)].id : null);
        }, 3200);
        return () => clearInterval(tmr);
    }, [participants]);
    const NOTE_KINDS = {
        decision: { label: t("rm_qrar"), icon: "✅", color: "#22C55E" },
        task: { label: t("rm_mhma"), icon: "📌", color: "#F59E0B" },
        point: { label: t("rm_nqta"), icon: "💬", color: "#60A5FA" },
    };
    function sendChat() {
        if (!chatText.trim())
            return;
        setChatMessages((m) => [...m, {
                id: Date.now(),
                sender: t("rm_ant"),
                text: chatText.trim(),
                kind: chatMode === "business" ? noteKind : null,
                atSecond: elapsed,
                time: new Date().toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }),
            }]);
        setChatText("");
    }
    const businessNotes = chatMessages.filter((m) => m.kind && !m.system);
    const taskNotes = businessNotes.filter((m) => m.kind === "task");
    function exportSummary() {
        const stamp = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
        let out = t("rm_mhdr_anwan");
        out += t("rm_altarykh") + new Date().toLocaleString(loc()) + "\n";
        out += t("rm_almda") + mins + ":" + secs + "\n";
        out += t("rm_alhdwr") + participants.map((p) => p.name).join(t("fasl_qayma")) + "\n";
        out += "=".repeat(40) + "\n\n";
        ["decision", "task", "point"].forEach((k) => {
            const items = businessNotes.filter((m) => m.kind === k);
            if (!items.length)
                return;
            out += NOTE_KINDS[k].label + " (" + items.length + "):\n";
            items.forEach((m, i) => { out += "  " + (i + 1) + ". [" + stamp(m.atSecond) + "] " + m.text + " — " + m.sender + "\n"; });
            out += "\n";
        });
        if (!businessNotes.length)
            out += t("rm_lm_tsjl");
        saveTextFile(t("rm_mlf_mhdr") + roomCode + ".txt", out);
        showToast(t("nzl_almhdr", { count: businessNotes.length }), "success");
    }
    // شاشة الانتظار
    if (joining) {
        return (React.createElement("div", { className: "flex-1 flex flex-col items-center justify-center", style: { backgroundColor: "#0f172a" } },
            React.createElement("div", { className: "w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-pulse", style: { backgroundColor: colors.primary + "33", border: `2px solid ${colors.primary}` } },
                React.createElement(Video, { size: 36, color: colors.primary })),
            React.cr