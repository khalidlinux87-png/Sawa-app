function kinshipLabel(ar) {
    if (isRTL()) return ar;
    // «سلف (4)» مُعرِّف مُولَّد بعمق متغيّر فلا يسع KINSHIP_EN حصره
    const m = /^سلف \((\d+)\)$/.exec(ar || "");
    if (m) return t("fc_slf", { i: m[1] });
    return KINSHIP_EN[ar] || ar;
}

const KINSHIP_OPTIONS = [
    "نفسي",
    "الوالد", "الوالدة", "الابن", "البنت", "الأخ", "الأخت",
    "الجد", "الجدة", "الجد لأم", "الجدة لأم",
    "العم", "العمة", "الخال", "الخالة",
    "ابن العم", "بنت العم", "ابن العمة", "بنت العمة",
    "ابن الخال", "بنت الخال", "ابن الخالة", "بنت الخالة",
    "ابن الأخ", "بنت الأخ", "ابن الأخت", "بنت الأخت",
    "زوجة الأخ", "زوج الأخت",
    "عم الوالد", "عمة الوالد", "خال الوالد", "خالة الوالد",
    "عم الوالدة", "عمة الوالدة", "خال الوالدة", "خالة الوالدة",
    "ابن عم الوالد", "بنت عم الوالد", "ابن خال الوالدة", "بنت خال الوالدة",
    "الحفيد", "الحفيدة",
    "الزوج", "الزوجة",
    "زوجة الابن", "زوج البنت",
    "الزوج السابق", "الزوجة السابقة",
    "أخرى",
];
// كل قرابة ولها نوع علاقة منطقي افتراضي — العم/الخال أخ للوالد (مو ابن للجد)،
// الجد أب للوالد (مو أخيه)، وهكذا — يمنع نفس خطأ "العم نزل موازي الجد"
const KINSHIP_RELATION_DEFAULTS = {
    "الوالد": "sibling", "الوالدة": "sibling",
    "الأخ": "sibling", "الأخت": "sibling",
    "الابن": "child", "البنت": "child",
    "العم": "sibling", "العمة": "sibling", "الخال": "sibling", "الخالة": "sibling",
    "الجد": "parent", "الجدة": "parent",
    "الجد لأم": "parent", "الجدة لأم": "parent",
    "ابن العم": "child", "بنت العم": "child", "ابن العمة": "child", "بنت العمة": "child",
    "ابن الخال": "child", "بنت الخال": "child", "ابن الخالة": "child", "بنت الخالة": "child",
    "عم الوالد": "sibling", "عمة الوالد": "sibling", "خال الوالد": "sibling", "خالة الوالد": "sibling",
    "عم الوالدة": "sibling", "عمة الوالدة": "sibling", "خال الوالدة": "sibling", "خالة الوالدة": "sibling",
    "ابن عم الوالد": "child", "بنت عم الوالد": "child",
    "ابن خال الوالدة": "child", "بنت خال الوالدة": "child",
    "الحفيد": "child", "الحفيدة": "child",
    "ابن الأخ": "child", "بنت الأخ": "child",
    "ابن الأخت": "child", "بنت الأخت": "child",
    "زوجة الأخ": "spouse", "زوج الأخت": "spouse",
    "الزوج": "spouse", "الزوجة": "spouse",
    "زوجة الابن": "spouse", "زوج البنت": "spouse",
    "الزوج السابق": "ex_spouse", "الزوجة السابقة": "ex_spouse",
    "نفسي": "sibling",
    "أخرى": "sibling",
};
// نطاق وحدة: مفاتيح لا نصوص — تُترجَم وقت الرسم عبر roleLabel()
const roleLabelKeys = { owner: "rl_owner", admin: "rl_admin", editor: "rl_admin", member: "rl_member", viewer: "rl_viewer" };
const roleLabel = (r) => (roleLabelKeys[r] ? t(roleLabelKeys[r]) : r);
function myAccountName() { try { const p = window.SawaChat && window.SawaChat.me && window.SawaChat.me() && window.SawaChat.profile ? window.SawaChat.profile() : null; return (p && (p.name || p.displayName)) || ""; } catch (e) { return ""; } }
function membersCountLabel(nStr) { const x = nStr + t("fg_frd_fasl"); return isRTL() ? arCountFix(x) : x; }   // C74: «٧ أفراد ·»
// استدلال افتراضي للجنس من صلة القرابة المُختارة — يمكن للمستخدم تغييره
// يدوياً؛ "أخرى" و"ابن العم/الخال" بلا استدلال واضح فنتركها بلا افتراض
const KINSHIP_GENDER_DEFAULTS = {
    "الوالد": "male", "الوالدة": "female",
    "الأخ": "male", "الأخت": "female",
    "الابن": "male", "البنت": "female",
    "العم": "male", "العمة": "female", "الخال": "male", "الخالة": "female",
    "الجد": "male", "الجدة": "female",
    "الجد لأم": "male", "الجدة لأم": "female",
    "ابن العم": "male", "بنت العم": "female", "ابن العمة": "male", "بنت العمة": "female",
    "ابن الخال": "male", "بنت الخال": "female", "ابن الخالة": "male", "بنت الخالة": "female",
    "عم الوالد": "male", "عمة الوالد": "female", "خال الوالد": "male", "خالة الوالد": "female",
    "عم الوالدة": "male", "عمة الوالدة": "female", "خال الوالدة": "male", "خالة الوالدة": "female",
    "ابن عم الوالد": "male", "بنت عم الوالد": "female",
    "ابن خال الوالدة": "male", "بنت خال الوالدة": "female",
    "الحفيد": "male", "الحفيدة": "female",
    "ابن الأخ": "male", "بنت الأخ": "female",
    "ابن الأخت": "male", "بنت الأخت": "female",
    "زوجة الأخ": "female", "زوج الأخت": "male",
    "الزوج": "male", "الزوجة": "female",
    "زوجة الابن": "female", "زوج البنت": "male",
    "الزوج السابق": "male", "الزوجة السابقة": "female",
};
// ⛔ مفاتيح لا نصوص. هذه التسميات تُعرض للمستخدم، ونطاق الوحدة يُقيَّم
// مرّة واحدة عند التحميل — فالنصّ الخام هنا يتجمّد على لغة الإقلاع (فخّ 1).
const actionLabelKeys = { call: "fac_call", visit: "fac_visit", message: "fac_message" };
function actionLabel(k) {
    return actionLabelKeys[k] ? t(actionLabelKeys[k]) : "";
}
const eventTypeLabelKeys = { success: "fev_success", travel: "fev_travel", death: "fev_death", marriage: "fev_marriage", sickness: "fev_sickness", newborn: "fev_newborn", engagement: "fev_engagement", surgery: "fev_surgery" };
function eventTypeLabel(k) {
    return eventTypeLabelKeys[k] ? t(eventTypeLabelKeys[k]) : "";
}
const eventTypeIcons = { success: Trophy, travel: Plane, death: Flower2, marriage: Star, sickness: AlertCircle, newborn: Baby, engagement: Gift, surgery: Stethoscope };
// إجراء مقترح لكل نوع حدث — يُستخدم بنص الاقتراح الذكي بدل عبارة عامة، تماماً
// حسب المواصفات الأصلية (eventRules بالتطبيق الأصلي)
const eventSuggestedActionKeys = { marriage: "fsa_gift", newborn: "fsa_gift", engagement: "fsa_congrats", success: "fsa_congrats", death: "fsa_condolence", sickness: "fsa_checkin", surgery: "fsa_checkin", travel: "fsa_checkin" };
function eventSuggestedActionLabel(k) {
    return eventSuggestedActionKeys[k] ? t(eventSuggestedActionKeys[k]) : "";
}
// تواريخ فلكية متوقّعة للمناسبات الدينية القادمة (قد تختلف يوماً حسب رؤية
// الهلال بكل دولة) — تُستخدم لاقتراح "تهنئة جماعية للعائلة" قبل يومين
const RELIGIOUS_OCCASIONS = [
    { key: "eid_fitr_2027", labelKey: "occ_eid_fitr", date: "2027-03-20" },
    { key: "eid_adha_2027", labelKey: "occ_eid_adha", date: "2027-05-16" },
];
// ============================================================================
// شاشات صلة الرحم — نفس بنية سوا الحقيقية (Discover > صلة الرحم)
// ============================================================================
function DiscoverHomeScreen({ onOpenFamily, personCount, groupPersons = {}, onOpenMoments, onOpenErsal, onOpenTaxi, onOpenWallet }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    // الخدمات غير الجاهزة: «قريباً» بدل شاشاتٍ تجريبيّة توهم بأنها تعمل — صلة الرحم وحدها مفعّلة
    const soon = () => showToast(tl("قريباً في سوا ✨", "Coming soon to Sawa ✨"));
    const soonBadge = () => React.createElement("span", { className: "absolute top-2 text-[9px] font-extrabold px-2 py-0.5 rounded-full", style: { insetInlineEnd: 8, backgroundColor: colors.border, color: colors.textMuted } }, tl("قريباً", "Soon"));
    const [loading, setLoading] = useState(true);
    // معلومة حيّة تُغني عن عدّاد ساكن: الأقرب استحقاقاً للتواصل أو أقرب مناسبة
    const familyHint = useMemo(function () {
        const persons = Object.values(groupPersons).flat();
        if (!persons.length) return null;
        const now0 = new Date(), today = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate());   // C33: منتصف الليل — كان عيد الميلاد «اليوم» يُدفع سنةً
        let nearest = null;
        persons.forEach(function (p) {
            if (!p.birthday || !p.alive) return;
            const parts = String(p.birthday).split("-").map(Number);
            if (parts.length !== 2 || !(parts[0] >= 1 && parts[0] <= 12 && parts[1] >= 1 && parts[1] <= 31)) return;
            const next = new Date(today.getFullYear(), parts[0] - 1, parts[1]);
            if (next < today) next.setFullYear(today.getFullYear() + 1);
            const days = Math.ceil((next - today) / 86400000);
            if (days <= 7 && (!nearest || days < nearest.days)) nearest = { name: p.local_name, days: days };
        });
        if (nearest) {
            return { urgent: false, text: nearest.days === 0
                ? tl("عيد ميلاد " + nearest.name + " اليوم", nearest.name + "'s birthday is today")
                : tl("عيد ميلاد " + nearest.name + " بعد " + nearest.days + " يوم", nearest.name + "'s birthday in " + nearest.days + " days") };
        }
        const overdue = getOverduePersons(groupPersons).length;
        if (overdue > 0) {
            return { urgent: true, text: overdue === 1 ? tl("قريب واحد يحتاج تواصلاً", "1 relative to reach out to") : tl(overdue + " أقارب يحتاجون تواصلاً", overdue + " relatives to reach out to") };
        }
        return { urgent: false, text: tl(persons.length + " فرد بالعائلة", persons.length + " family members") };
    }, [groupPersons]);
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 0);   // C33: لا تأخير مصطنع
        return () => clearTimeout(timer);
    }, []);
    if (loading) {
        return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: `flex ${rowStart()} items-center px-4 pt-5 pb-2 gap-2` },
                React.createElement("img", { src: IS_RAHIM ? APP_LOGO_RAHIM : SAWA_LOGO, alt: appName(), style: { width: 38, height: 38, objectFit: "contain" } }),
                React.createElement("div", null,
                    React.createElement(SkeletonBox, { height: 18, width: 80 }),
                    React.createElement("div", { className: "mt-1" },
                        React.createElement(SkeletonBox, { height: 11, width: 140 })))),
            React.createElement("div", { className: "px-4" },
                React.createElement(SkeletonBox, { height: 148, rounded: "rounded-2xl", style: { marginBottom: 12 } }),
                React.createElement("div", { className: "grid grid-cols-2 gap-3" }, [1, 2, 3, 4].map(i => React.createElement(SkeletonBox, { key: i, height: 120, rounded: "rounded-2xl" }))))));
    }
    return (React.createElement("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { className: `flex ${rowStart()} items-center px-4 pt-5 pb-2 gap-2` },
            React.createElement("img", { src: IS_RAHIM ? APP_LOGO_RAHIM : SAWA_LOGO, alt: appName(), style: { width: 38, height: 38, objectFit: "contain" } }),
            React.createElement("div", null,
                React.createElement("h2", { className: "text-xl font-extrabold", style: { color: colors.text } }, t("astkshf")),
                React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("kl_khdmat_swa_bmkan")))),
        React.createElement("div", { className: "px-4 pb-4" },
            React.createElement("button", { onClick: onOpenFamily, className: `w-full ${textStart()} rounded-2xl p-4 relative overflow-hidden mb-3`, style: { background: famGrad(colors), boxShadow: `0 10px 24px ${colors.primary}40` } },
                React.createElement("div", { className: `relative z-10 flex ${rowStart()} items-center gap-3` },
                    React.createElement("div", { className: "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", style: { backgroundColor: "rgba(255,255,255,0.15)" } },
                        React.createElement(UsersRound, { size: 24, color: "#fff" })),
                    React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                        React.createElement("span", { className: "block text-lg font-extrabold text-white" }, t("sla_alrhm")),
                        React.createElement("span", { className: "block text-[11px] mt-0.5", style: { color: "rgba(255,255,255,0.65)" } }, t("nzm_twaslk_ma_aqarbk"))),
                    React.createElement(ChevronLeft, { size: 18, color: "rgba(255,255,255,0.5)", className: "shrink-0", style: { transform: isRTL() ? "none" : "scaleX(-1)" } })),
                familyHint && (React.createElement("div", { className: `relative z-10 mt-3 flex ${rowStart()} items-center gap-1.5 rounded-xl px-3 py-2`, style: { backgroundColor: familyHint.urgent ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.12)" } },
                    familyHint.urgent
                        ? React.createElement(AlertCircle, { size: 13, color: "#fca5a5", className: "shrink-0" })
                        : React.createElement(Sparkles, { size: 13, color: "rgba(255,255,255,0.8)", className: "shrink-0" }),
                    React.createElement("span", { className: "text-[11px] font-bold", style: { color: familyHint.urgent ? "#fca5a5" : "rgba(255,255,255,0.9)" } }, familyHint.text)))),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("alkhdmat")),
            React.createElement("div", { className: "grid grid-cols-2 gap-3" },
                React.createElement("button", { onClick: soon, "aria-disabled": true, className: "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center", style: { position: "relative", opacity: 0.55, backgroundColor: colors.card, borderColor: colors.border, minHeight: 138, justifyContent: "center" } },
                    soonBadge(),
                    React.createElement("div", { className: "w-14 h-14 rounded-xl flex items-center justify-center", style: { backgroundColor: colors.primaryLight } },
                        React.createElement(Wallet, { size: 26, color: colors.primary })),
                    React.createElement("div", { className: "text-xs font-extrabold", style: { color: colors.text } }, t("almhfza")),
                    React.createElement("div", { className: "text-[10px] leading-snug", style: { color: colors.textMuted } }, t("rsydk_wkhdmatk"))),
                React.createElement("button", { onClick: soon, "aria-disabled": true, className: "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center", style: { position: "relative", opacity: 0.55, backgroundColor: colors.card, borderColor: colors.border, minHeight: 138, justifyContent: "center" } },
                    soonBadge(),
                    React.createElement("div", { className: "w-14 h-14 rounded-xl flex items-center justify-center", style: { backgroundColor: "#F3E5F5" } },
                        React.createElement(Image, { size: 26, color: "#7B1FA2" })),
                    React.createElement("div", { className: "text-xs font-extrabold", style: { color: colors.text } }, t("lhzat_alasdqa")),
                    React.createElement("div", { className: "text-[10px] leading-snug", style: { color: colors.textMuted } }, t("shark_swra_aw_khatra")))),
                React.createElement("div", { className: "grid grid-cols-2 gap-3 mt-3" },
                    React.createElement("button", { onClick: soon, "aria-disabled": true, className: "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center", style: { position: "relative", opacity: 0.55, backgroundColor: colors.card, borderColor: colors.border } },
                    soonBadge(),
                        React.createElement("div", { className: "w-14 h-14 rounded-xl flex items-center justify-center", style: { backgroundColor: "#E0F2F1" } },
                            React.createElement(Truck, { size: 26, color: "#00695C" })),
                        React.createElement("div", { className: "text-xs font-extrabold", style: { color: colors.text } }, t("irsal_iksbrys")),
                        React.createElement("div", { className: "text-[10px] leading-snug", style: { color: colors.textMuted } }, t("dsc_irsal_wsf"))),
                    React.createElement("button", { onClick: soon, "aria-disabled": true, className: "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center", style: { position: "relative", opacity: 0.55, backgroundColor: colors.card, borderColor: colors.border } },
                    soonBadge(),
                        React.createElement("div", { className: "w-14 h-14 rounded-xl flex items-center justify-center", style: { backgroundColor: "#FFF3E0" } },
                            React.createElement(Car, { size: 26, color: "#E65100" })),
                        React.createElement("div", { className: "text-xs font-extrabold", style: { color: colors.text } }, t("taksy_swa")),
                        React.createElement("div", { className: "text-[10px] leading-snug", style: { color: colors.textMuted } }, t("dsc_taksy_wsf")))))));
}
function FamilyGroupsScreen({ groups, groupPersons, currentGroupId, onSetCurrent, onOpenGroup, onOpenGroupOverdue, onCreateGroup, onRenameGroup, onDeleteGroup, onBack, proxEnabled, onEnableProx, onDisableProx, proxRadius = 1000, onSetProxRadius }) {
    // C34: الرئيسية بالنمط الحديث — رأس متدرّج بإحصاءات، بطاقات العائلات، المناسبات القريبة، ومن ينتظر تواصلك
    const { colors, isDark } = useTheme();
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [menuFor, setMenuFor] = useState(null); // المجموعة المفتوحة ورقتها (تسمية/حذف/تعيين)
    const [renameText, setRenameText] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [showRadius, setShowRadius] = useState(false);   // C37b: ورقة نطاق التنبيه العامّ
    const [customR, setCustomR] = useState("");
    const allPersons = useMemo(() => groups.flatMap((g) => (groupPersons[g.id] || []).map((p) => Object.assign({ __g: g }, p))), [groups, groupPersons]);
    const overdueAll = useMemo(() => allPersons.filter(isContactOverdue), [allPersons]);
    // مناسبات الثلاثين يوماً القادمة (أعياد الميلاد) — منتصف الليل المحلّيّ كما في C33
    const upcoming = useMemo(() => {
        const now0 = new Date(), today = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate());
        const out = [];
        allPersons.forEach((p) => {
            if (!p.birthday || !p.alive) return;
            const parts = String(p.birthday).split("-").map(Number);
            if (parts.length !== 2 || !(parts[0] >= 1 && parts[0] <= 12 && parts[1] >= 1 && parts[1] <= 31)) return;
            const next = new Date(today.getFullYear(), parts[0] - 1, parts[1]);
            if (next < today) next.setFullYear(today.getFullYear() + 1);
            const days = Math.round((next - today) / 86400000);
            if (days <= 30) out.push({ p, days, date: next });
        });
        return out.sort((a, b) => a.days - b.days).slice(0, 6);
    }, [allPersons]);
    const menuGroup = menuFor ? groups.find((g) => g.id === menuFor) : null;
    const dayLabel = (d) => d === 0 ? tl("اليوم 🎉", "Today 🎉") : d === 1 ? tl("غداً", "Tomorrow") : tl("بعد " + d.toLocaleString(loc()) + " يوم", "in " + d + " days");
    const fmtDate = (d) => d.toLocaleDateString(loc(), { day: "numeric", month: "long" });
    const n = (x) => Number(x || 0).toLocaleString(loc());
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col relative", style: { backgroundColor: colors.bg } },
        React.createElement(FamHeader, { title: t("sla_alrhm"), onBack: onBack,
            subtitle: groups.length === 0 ? t("nzm_twaslk_ma_aqarbk") : tl(n(groups.length) + (groups.length === 1 ? " عائلة" : groups.length === 2 ? " عائلتان" : " عائلات") + " · " + n(allPersons.length) + " قريباً", n(groups.length) + (groups.length === 1 ? " family" : " families") + " · " + n(allPersons.length) + " relatives") },
            groups.length > 0 && React.createElement("div", { className: `flex ${rowStart()} gap-2.5` },
                React.createElement(FamStat, { value: n(allPersons.length), label: tl("الأقارب", "Relatives") }),
                React.createElement(FamStat, { value: n(upcoming.length), label: tl("مناسبات قريبة", "Upcoming") }),
                React.createElement(FamStat, { value: n(overdueAll.length), label: tl("تواصل متأخّر", "Overdue") }))),
        React.createElement("div", { className: "flex-1 overflow-y-auto", style: { paddingBottom: 96 } },
            // C37: تنبيهات القرب — بطاقة تفعيل، ثمّ سطر حالة
            groups.length > 0 && onEnableProx && (!proxEnabled
                ? React.createElement("div", { className: "px-4 pt-4" }, React.createElement(FamCard, { className: `flex ${rowStart()} items-center gap-3`, style: { marginBottom: 0 } },
                    React.createElement("div", { className: "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0", style: { backgroundColor: "#22C55E18" } }, React.createElement(MapPin, { size: 20, color: "#16a34a" })),
                    React.createElement("div", { className: `flex-1 min-w-0 ${textStart()}` },
                        React.createElement("div", { className: "text-[13.5px] font-extrabold", style: { color: colors.text } }, tl("تنبيهات القرب", "Nearby alerts")),
                        React.createElement("div", { className: "text-[11px] leading-relaxed", style: { color: colors.textMuted } }, tl("حين تمرّ ضمن " + fmtDist(proxRadius) + " من منزل قريبٍ أذكّرك: زيارةٌ أو اتّصال. حدّد منازلهم من ملفّاتهم، والمسافة تُضبط بعد التفعيل.", "When you pass within " + fmtDist(proxRadius) + " of a relative's home, I'll suggest a visit or a call."))),
                    React.createElement("button", { onClick: onEnableProx, className: "shrink-0 rounded-full px-3.5 py-2 text-[12px] font-extrabold text-white", style: { background: famGrad(colors) } }, tl("تفعيل", "Enable"))))
                : React.createElement("div", { className: `px-5 pt-3 flex ${rowStart()} items-center gap-2 text-[11px] font-bold flex-wrap`, style: { color: colors.textMuted } },
                    React.createElement(MapPin, { size: 12, color: "#16a34a" }),
                    React.createElement("span", { className: "flex-1" }, tl("تنبيهات القرب مفعّلة · " + n(allPersons.filter(homeOf).length) + " منزلاً", "Nearby alerts on · " + n(allPersons.filter(homeOf).length) + " homes")),
                    React.createElement("button", { onClick: () => setShowRadius(true), className: "rounded-full px-2.5 py-1", style: { color: colors.primary, backgroundColor: colors.primary + "12" } }, tl("النطاق: ", "Within: ") + fmtDist(proxRadius)),
                    React.createElement("button", { onClick: onDisableProx, style: { color: colors.primary } }, tl("إيقاف", "Turn off")))),
            showRadius && React.createElement(FamSheet, { title: tl("نطاق التنبيه لكلّ الأقارب", "Alert distance for all relatives"), subtitle: tl("كم تكون المسافة من منزل القريب ليُنبّهك؟ يمكن تخصيصها لقريبٍ بعينه من نموذجه.", "How close to a relative's home before alerting? Per-relative override in their form."), onClose: () => setShowRadius(false), maxHeight: "72%" },
                PROX_RADII.map((r, i) => React.createElement(FamRow, { key: r, icon: MapPin, title: fmtDist(r), sub: r <= 500 ? tl("مشياً في الحيّ", "Walking distance") : r <= 1000 ? tl("الحيّ وما حوله", "The neighborhood") : tl("بالسيّارة", "By car"), onPress: () => { onSetProxRadius(r); setShowRadius(false); }, right: proxRadius === r ? React.createElement(Check, { size: 17, color: colors.primary }) : React.createElement("span", null) })),
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 pt-3` },
                    React.createElement("input", { dir: "ltr", inputMode: "numeric", value: customR, onChange: (e) => setCustomR(e.target.value.replace(/\D/g, "").slice(0, 4)), placeholder: tl("مسافة أخرى بالمتر (١٠٠–٥٠٠٠)", "Other, meters (100–5000)"), className: "fam-in flex-1 min-w-0 px-3.5 py-3 text-sm", style: famInput(colors) }),
                    React.createElement("button", { disabled: !(Number(customR) >= 100 && Number(customR) <= 5000), onClick: () => { onSetProxRadius(Number(customR)); setCustomR(""); setShowRadius(false); }, className: "rounded-2xl px-4 py-3 text-sm font-bold text-white", style: { background: famGrad(colors), opacity: (Number(customR) >= 100 && Number(customR) <= 5000) ? 1 : 0.4 } }, t("takyd")))),
            React.createElement(FamSection, { title: tl("عائلاتي", "My families"), action: tl("+ عائلة جديدة", "+ New family"), onAction: () => setShowCreate(true) },
                groups.length === 0 && React.createElement(FamCard, { className: "text-center", style: { padding: 24 } },
                    React.createElement("div", { className: "mx-auto mb-3 rounded-full flex items-center justify-center", style: { width: 64, height: 64, background: famGrad(colors) } }, React.createElement(UsersRound, { size: 30, color: "#fff" })),
                    React.createElement("p", { className: "text-[15px] font-extrabold mb-1", style: { color: colors.text } }, tl("ابدأ عائلتك الأولى", "Start your first family")),
                    React.createElement("p", { className: "text-[11.5px] leading-relaxed mb-4", style: { color: colors.textMuted } }, tl("أضف أقاربك، وستذكّرك سوا بالتواصل معهم وبمناسباتهم.", "Add your relatives and Sawa will remind you to keep in touch.")),
                    React.createElement(FamButton, { label: tl("عائلة جديدة", "New family"), icon: Plus, onPress: () => setShowCreate(true) })),
                groups.map((g) => {
                    const list = groupPersons[g.id] || [];
                    const overdueN = list.filter(isContactOverdue).length;   // العدّ بـisContactOverdue نفسها التي يصفّي بها فلتر «متأخّر»
                    const isCurrent = g.id === currentGroupId;
                    return (React.createElement(FamCard, { key: g.id, style: isCurrent ? { boxShadow: `0 0 0 2px ${colors.primary}55, ${famShadow(isDark)}` } : undefined },
                        React.createElement("div", { className: `flex ${rowStart()} items-center gap-3` },
                            React.createElement("button", { onClick: () => onOpenGroup(g), className: `flex-1 min-w-0 flex ${rowStart()} items-center gap-3 ${textStart()}` },
                                React.createElement(FamAvatar, { name: g.name, size: 50, radius: 16 }),
                                React.createElement("div", { className: "flex-1 min-w-0" },
                                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                                        React.createElement("span", { className: "text-[14.5px] font-extrabold truncate", style: { color: colors.text } }, g.name),
                                        isCurrent && React.createElement(FamChip, { tone: "ok", label: t("alhalya") })),
                                    g.description && React.createElement("div", { className: "text-[11px] mt-0.5 truncate", style: { color: colors.textMuted } }, g.description),
                                    React.createElement("div", { className: "text-[11.5px] mt-0.5", style: { color: colors.textMuted } }, membersCountLabel(n(list.length)), roleLabel(g.role)))),
                            onDeleteGroup && g.role === "owner"
                                ? React.createElement("button", { "aria-label": t("fg_khyarat"), onClick: () => { setMenuFor(g.id); setRenameText(g.name); setConfirming(false); }, className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.bg } }, React.createElement(MoreHorizontal, { size: 17, color: colors.textMuted }))
                                : React.createElement(ChevronLeft, { size: 18, color: colors.textMuted, className: "shrink-0", style: { transform: isRTL() ? "none" : "scaleX(-1)" } })),
                        (overdueN > 0 || !isCurrent) && React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mt-3 pt-2.5 flex-wrap`, style: { borderTop: `1px solid ${colors.border}` } },
                            overdueN > 0 && onOpenGroupOverdue && React.createElement(FamChip, { tone: "warn", icon: Clock, label: t("fg_yntzr_twaslk", { n: n(overdueN) }), onPress: () => onOpenGroupOverdue(g) }),
                            !isCurrent && React.createElement(FamChip, { tone: "info", label: t("tayyn_khalya"), onPress: () => onSetCurrent(g.id) }))));
                })),
            upcoming.length > 0 && React.createElement(FamSection, { title: tl("مناسبات قريبة", "Upcoming occasions") },
                upcoming.map(({ p, days, date }) => React.createElement(FamCard, { key: p.id, onPress: () => onOpenGroup(p.__g) },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-3` },
                        React.createElement(FamAvatar, { name: p.local_name, photo: p.photo, size: 46 }),
                        React.createElement("div", { className: "flex-1 min-w-0" },
                            React.createElement("div", { className: "text-[14px] font-extrabold truncate", style: { color: colors.text } }, tl("عيد ميلاد " + p.local_name, p.local_name + "'s birthday")),
                            React.createElement("div", { className: "text-[11.5px] mt-0.5", style: { color: days === 0 ? colors.primary : colors.textMuted } }, dayLabel(days), " · ", fmtDate(date), " · ", p.__g.name)),
                        React.createElement(Cake, { size: 18, color: "#f43f5e", className: "shrink-0" }))))),
            overdueAll.length > 0 && React.createElement(FamSection, { title: tl("ينتظرون تواصلك", "Waiting to hear from you") },
                overdueAll.slice(0, 4).map((p) => React.createElement(FamCard, { key: p.id, onPress: () => onOpenGroupOverdue ? onOpenGroupOverdue(p.__g) : onOpenGroup(p.__g) },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-3` },
                        React.createElement(FamAvatar, { name: p.local_name, photo: p.photo, size: 46 }),
                        React.createElement("div", { className: "flex-1 min-w-0" },
                            React.createElement("div", { className: "text-[14px] font-extrabold truncate", style: { color: colors.text } }, p.local_name),
                            React.createElement("div", { className: "text-[11.5px] mt-0.5 truncate", style: { color: colors.textMuted } }, personKinLabel(p), " · ", contactAgoLabel(p.lastContactDate))),
                        React.createElement(FamChip, { tone: "warn", icon: Phone, label: tl("اتّصل", "Call") })))),
                overdueAll.length > 4 && React.createElement("p", { className: `text-[11px] px-1 ${textStart()}`, style: { color: colors.textMuted } }, tl("و" + n(overdueAll.length - 4) + " آخرون — افتح العائلة ثمّ «متأخّر»", "+" + n(overdueAll.length - 4) + " more — open the family, then “Overdue”")))),
        React.createElement(FamFab, { label: groups.length === 0 ? tl("عائلة جديدة", "New family") : null, ariaLabel: tl("عائلة جديدة", "New family"), onPress: () => setShowCreate(true) }),
        showCreate && React.createElement(FamSheet, { title: tl("عائلة جديدة", "New family"), subtitle: tl("اسمٌ تعرفها به: آل فلان، عائلة الزوجة…", "A name you know it by"), onClose: () => { setShowCreate(false); setName(""); }, maxHeight: "60%",
            footer: React.createElement(FamButton, { label: t("takyd"), icon: Check, disabled: !name.trim(), onPress: () => { if (name.trim()) { onCreateGroup(name.trim()); setName(""); setShowCreate(false); } } }) },
            React.createElement(FamLabel, null, tl("اسم العائلة", "Family name")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: name, onChange: (e) => setName(e.target.value), onKeyDown: (e) => { if (e.key === "Enter" && name.trim()) { onCreateGroup(name.trim()); setName(""); setShowCreate(false); } }, placeholder: tl("اسم العائلة", "Family name"), className: "fam-in w-full px-3.5 py-3 text-sm", style: famInput(colors), autoFocus: true })),
        menuGroup && React.createElement(FamSheet, { title: menuGroup.name, subtitle: membersCountLabel(n((groupPersons[menuGroup.id] || []).length)) + roleLabel(menuGroup.role), onClose: () => setMenuFor(null), maxHeight: "72%" },
            React.createElement(FamLabel, null, t("fg_iada_tsmya")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` },
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: renameText, onChange: (e) => setRenameText(e.target.value), placeholder: tl("اسم العائلة", "Family name"), className: "fam-in flex-1 min-w-0 px-3.5 py-3 text-sm", style: famInput(colors) }),
                React.createElement("button", { "aria-label": t("takyd"), disabled: !renameText.trim() || renameText.trim() === menuGroup.name, onClick: () => { onRenameGroup(menuGroup.id, renameText.trim()); setMenuFor(null); }, className: "w-12 rounded-2xl flex items-center justify-center shrink-0", style: { background: famGrad(colors), opacity: (!renameText.trim() || renameText.trim() === menuGroup.name) ? 0.4 : 1 } }, React.createElement(Check, { size: 18, color: "#fff" }))),
            menuGroup.id !== currentGroupId && React.createElement(FamButton, { variant: "soft", label: t("tayyn_khalya"), icon: Star, onPress: () => { onSetCurrent(menuGroup.id); setMenuFor(null); }, className: "mb-3" }),
            !confirming
                ? React.createElement(FamButton, { variant: "danger", label: t("hdhf"), icon: Trash2, onPress: () => setConfirming(true) })
                : React.createElement("div", { className: "rounded-2xl p-3.5", style: { backgroundColor: colors.danger + "0f", border: `1px solid ${colors.danger}33` } },
                    React.createElement("p", { className: `text-[12px] font-bold mb-3 leading-relaxed ${textStart()}`, style: { color: colors.text } }, t("fg_thdhyr_alhdhf", { name: menuGroup.name, n: n((groupPersons[menuGroup.id] || []).length) })),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("button", { onClick: () => { const id = menuGroup.id; setMenuFor(null); setConfirming(false); onDeleteGroup(id); }, className: "flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white", style: { backgroundColor: colors.danger } }, t("hdhf")),
                        React.createElement("button", { onClick: () => setConfirming(false), className: "flex-1 py-2.5 rounded-xl text-sm font-bold", style: { backgroundColor: colors.card, color: colors.text, border: `1px solid ${colors.border}` } }, t("ilgha")))))));
}
// ============================================================
// اشتقاق صلة القرابة نسبةً لصاحب الشجرة (الجذر السفلي = "أنا").
// أخو الوالد عمّي لا أخي؛ أخت الوالدة خالتي؛ ابن العم ابن عمّي.
// نحسب الصلة من: صلة الشخص المُضاف إليه + نوع العلاقة + الجنس.
// ============================================================
const RELATIVE_KINSHIP_MAP = {
    // الوالدان
    "الوالد": {
        sibling: { male: "العم", female: "العمة" }, // أخو أبي = عمّي
        parent: { male: "الجد", female: "الجدة" },
        child: { male: "الأخ", female: "الأخت" },
        spouse: { male: "أخرى", female: "أخرى" },   // C33: زوجةٌ أخرى للوالد ليست «الوالدة» — تُضبط يدويّاً (كانت تُسجَّل والدةً)
    },
    "الوالدة": {
        sibling: { male: "الخال", female: "الخالة" }, // أخو أمي = خالي
        parent: { male: "الجد لأم", female: "الجدة لأم" },
        child: { male: "الأخ", female: "الأخت" },
        spouse: { male: "أخرى", female: "أخرى" },
    },
    // الأجداد — الخط الأبوي: إخوتهم أجداد لي، وأبناؤهم أعمام
    "الجد": {
        sibling: { male: "عم الوالد", female: "عمة الوالد" }, // أخو جدي = عم والدي
        parent: { male: "الجد", female: "الجدة" },
        child: { male: "العم", female: "العمة" }, // ابن جدي = عمّي
        spouse: { male: "الجد", female: "الجدة" },
    },
    "الجدة": {
        sibling: { male: "خال الوالد", female: "خالة الوالد" },   // C33: أخو جدّتي (أمّ أبي) = خال والدي
        parent: { male: "الجد", female: "الجدة" },
        child: { male: "العم", female: "العمة" },
        spouse: { male: "الجد", female: "الجدة" },
    },
    // الأجداد — الخط الأمومي: أبناؤهم أخوال
    "الجد لأم": {
        sibling: { male: "خال الوالدة", female: "خالة الوالدة" }, // أخو جد أمي
        parent: { male: "الجد لأم", female: "الجدة لأم" },
        child: { male: "الخال", female: "الخالة" }, // ابن جد أمي = خالي
        spouse: { male: "الجد لأم", female: "الجدة لأم" },
    },
    "الجدة لأم": {
        sibling: { male: "خال الوالدة", female: "خالة الوالدة" },   // C33
        parent: { male: "الجد لأم", female: "الجدة لأم" },
        child: { male: "الخال", female: "الخالة" },
        spouse: { male: "الجد لأم", female: "الجدة لأم" },
    },
    // الأعمام والعمات — إخوتهم أعمام، وأبناؤهم أبناء عم
    "العم": {
        sibling: { male: "العم", female: "العمة" },
        child: { male: "ابن العم", female: "بنت العم" },
        parent: { male: "الجد", female: "الجدة" },
        spouse: { male: "العم", female: "العمة" },
    },
    "العمة": {
        sibling: { male: "العم", female: "العمة" },
        child: { male: "ابن العمة", female: "بنت العمة" },
        parent: { male: "الجد", female: "الجدة" },
        spouse: { male: "العم", female: "العمة" },
    },
    "الخال": {
        sibling: { male: "الخال", female: "الخالة" },
        child: { male: "ابن الخال", female: "بنت الخال" },
        parent: { male: "الجد لأم", female: "الجدة لأم" },
        spouse: { male: "الخال", female: "الخالة" },
    },
    "الخالة": {
        sibling: { male: "الخال", female: "الخالة" },
        child: { male: "ابن الخالة", female: "بنت الخالة" },
        parent: { male: "الجد لأم", female: "الجدة لأم" },
        spouse: { male: "الخال", female: "الخالة" },
    },
    // أبناء الأعمام والأخوال — أبناؤهم يبقون في نفس التصنيف
    "ابن العم": { child: { male: "ابن العم", female: "بنت العم" }, sibling: { male: "ابن العم", female: "بنت العم" }, spouse: { male: "أخرى", female: "أخرى" } },
    "بنت العم": { child: { male: "ابن العم", female: "بنت العم" }, sibling: { male: "ابن العم", female: "بنت العم" } },
    "ابن العمة": { child: { male: "ابن العمة", female: "بنت العمة" }, sibling: { male: "ابن العمة", female: "بنت العمة" } },
    "بنت العمة": { child: { male: "ابن العمة", female: "بنت العمة" }, sibling: { male: "ابن العمة", female: "بنت العمة" } },
    "ابن الخال": { child: { male: "ابن الخال", female: "بنت الخال" }, sibling: { male: "ابن الخال", female: "بنت الخال" } },
    "بنت الخال": { child: { male: "ابن الخال", female: "بنت الخال" }, sibling: { male: "ابن الخال", female: "بنت الخال" } },
    "ابن الخالة": { child: { male: "ابن الخالة", female: "بنت الخالة" }, sibling: { male: "ابن الخالة", female: "بنت الخالة" } },
    "بنت الخالة": { child: { male: "ابن الخالة", female: "بنت الخالة" }, sibling: { male: "ابن الخالة", female: "بنت الخالة" } },
    "ابن الأخ": { sibling: { male: "ابن الأخ", female: "بنت الأخ" }, parent: { male: "الأخ", female: "زوجة الأخ" } },
    "بنت الأخ": { sibling: { male: "ابن الأخ", female: "بنت الأخ" }, parent: { male: "الأخ", female: "زوجة الأخ" } },
    "ابن الأخت": { sibling: { male: "ابن الأخت", female: "بنت الأخت" }, parent: { male: "زوج الأخت", female: "الأخت" } },
    "بنت الأخت": { sibling: { male: "ابن الأخت", female: "بنت الأخت" }, parent: { male: "زوج الأخت", female: "الأخت" } },
    // ⛔ ابن الكنّة حفيدُك. بلا هذه المرساة يُشتقّ «الابن» — أي ابنُك أنت.
    "زوجة الابن": { spouse: { male: "الابن" }, child: { male: "الحفيد", female: "الحفيدة" } },
    "زوج البنت": { spouse: { female: "البنت" }, child: { male: "الحفيد", female: "الحفيدة" } },
    "زوجة الأخ": { spouse: { male: "الأخ", female: "الزوجة" }, child: { male: "ابن الأخ", female: "بنت الأخ" } },
    "زوج الأخت": { spouse: { male: "الزوج", female: "الأخت" }, child: { male: "ابن الأخت", female: "بنت الأخت" } },
    // الإخوة — التسمية بمنظور صاحب الشجرة
    "الأخ": {
        sibling: { male: "الأخ", female: "الأخت" },
        // ابن أخي هو ابن أخي — لا ابن عمي. الشجرة منسوبة لصاحبها،
        // فالتسمية تتبع منظوره لا منظور الطفل.
        child: { male: "ابن الأخ", female: "بنت الأخ" },
        parent: { male: "الوالد", female: "الوالدة" },
        spouse: { male: "الزوج", female: "زوجة الأخ" },
    },
    "الأخت": {
        sibling: { male: "الأخ", female: "الأخت" },
        child: { male: "ابن الأخت", female: "بنت الأخت" },
        parent: { male: "الوالد", female: "الوالدة" },
        spouse: { male: "زوج الأخت", female: "الزوجة" },
    },
    // الأبناء وأحفادهم
    "الابن": { child: { male: "الحفيد", female: "الحفيدة" }, sibling: { male: "الابن", female: "البنت" }, spouse: { female: "زوجة الابن" } },
    "البنت": { child: { male: "الحفيد", female: "الحفيدة" }, sibling: { male: "الابن", female: "البنت" }, spouse: { male: "زوج البنت" } },
    // جيل الأجداد الجانبي — إخوة الجد وأخواته تصنيفهم مستقل
    "عم الوالد": { sibling: { male: "عم الوالد", female: "عمة الوالد" }, child: { male: "ابن عم الوالد", female: "بنت عم الوالد" } },
    "عمة الوالد": { sibling: { male: "عم الوالد", female: "عمة الوالد" }, child: { male: "ابن عم الوالد", female: "بنت عم الوالد" } },
    "خال الوالد": { sibling: { male: "خال الوالد", female: "خالة الوالد" }, child: { male: "ابن عم الوالد", female: "بنت عم الوالد" } },
    "خالة الوالد": { sibling: { male: "خال الوالد", female: "خالة الوالد" }, child: { male: "ابن عم الوالد", female: "بنت عم الوالد" } },
    "عم الوالدة": { sibling: { male: "عم الوالدة", female: "عمة الوالدة" }, child: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" } },
    "عمة الوالدة": { sibling: { male: "عم الوالدة", female: "عمة الوالدة" }, child: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" } },
    "خال الوالدة": { sibling: { male: "خال الوالدة", female: "خالة الوالدة" }, child: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" } },
    "خالة الوالدة": { sibling: { male: "خال الوالدة", female: "خالة الوالدة" }, child: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" } },
    // أبناؤهم — يستمرون في نفس التصنيف
    "ابن عم الوالد": { child: { male: "ابن عم الوالد", female: "بنت عم الوالد" }, sibling: { male: "ابن عم الوالد", female: "بنت عم الوالد" } },
    "بنت عم الوالد": { child: { male: "ابن عم الوالد", female: "بنت عم الوالد" }, sibling: { male: "ابن عم الوالد", female: "بنت عم الوالد" } },
    "ابن خال الوالدة": { child: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" }, sibling: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" } },
    "بنت خال الوالدة": { child: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" }, sibling: { male: "ابن خال الوالدة", female: "بنت خال الوالدة" } },
    // الأحفاد
    "الحفيد": { child: { male: "الحفيد", female: "الحفيدة" }, sibling: { male: "الحفيد", female: "الحفيدة" } },
    "الحفيدة": { child: { male: "الحفيد", female: "الحفيدة" }, sibling: { male: "الحفيد", female: "الحفيدة" } },
    // الأزواج
    "الزوج": { child: { male: "الابن", female: "البنت" } },
    "الزوجة": { child: { male: "الابن", female: "البنت" } },
};
// الصلة الافتراضية حين لا توجد قاعدة (نستعمل الصلة المباشرة كما هي)
const DIRECT_KINSHIP = {
    sibling: { male: "الأخ", female: "الأخت" },
    child: { male: "الابن", female: "البنت" },
    parent: { male: "الوالد", female: "الوالدة" },
    spouse: { male: "الزوج", female: "الزوجة" },
    ex_spouse: { male: "الزوج السابق", female: "الزوجة السابقة" },
};
function deriveKinship(anchorKinship, relationKey, gender) {
    const g = gender === "female" ? "female" : "male";
    // ⛔ الزواج المنتهي نوعٌ قائم بذاته — لكن حين تكون المرساة قريباً لا
    // صاحبَ الشجرة، تبقى «زوجة الأخ». لا مفردة لمطلَّقة الأخ، وطيّها إلى
    // «الزوجة السابقة» يجعل مطلَّقةَ أخيك مطلَّقتَك أنت.
    const fallbackKey = relationKey === "ex_spouse" ? "spouse" : relationKey;
    const byAnchor = RELATIVE_KINSHIP_MAP[anchorKinship];
    const pick = (map, k) => (map && map[k] && map[k][g]) || null;
    // C33: الإسقاط إلى قرابتي المباشرة (زوجي/والدي/أخي) لا يصحّ إلّا إذا كانت المرساة أنا — زوجُ بنت العم ليس «زوجي»
    const mine = !anchorKinship || anchorKinship === "نفسي";
    return pick(byAnchor, relationKey)
        || pick(byAnchor, fallbackKey)
        || (mine ? pick(DIRECT_KINSHIP, relationKey) : null)
        || (mine ? pick(DIRECT_KINSHIP, fallbackKey) : null)
        || "أخرى";
}

// ============================================================
// C75: محرّك القرابة — يُحسب من الصلات نفسها (والد/زوج/أخ) لا من نصٍّ كُتب لحظة الإضافة.
//   • الاسم يُبنى من عدد الأجيال صعوداً إلى الجدّ المشترك ونزولاً منه: «بنت ابن العم» لا «بنت العم»،
//     «ابن عم الوالد»، «ابن بنت الأخت»… بلا حدّ.
//   • الأشقّاء ومن الأب ومن الأم من الوالدين المشتركين (أو من وسم الصلة half).
//   • الشخص الواحد قد يصلك من أكثر من طريق: «بنت الخال · وأيضاً: زوجة ابن العم» — سجلٌّ واحد، لا دمج ولا تكرار.
//   • المنظور لأيّ شخص: صاحب الشجرة («نفسي») أو من انضمّ واختار «هذا أنا».
//   ما لا طريق له يبقى على القرابة المكتوبة يدويّاً.
// ============================================================
function kinGraph(persons, relations) {
    const byId = {};
    (persons || []).forEach((p) => { if (p && p.id) byId[p.id] = p; });
    const parents = {}, children = {}, spouses = {}, exes = {}, sibEdges = [];
    const push = (m, k, v) => { (m[k] || (m[k] = [])).indexOf(v) < 0 && m[k].push(v); };
    (relations || []).forEach((r) => {
        if (!r || !byId[r.source] || !byId[r.target] || r.source === r.target) return;
        if (r.type === "parent") { push(parents, r.target, r.source); push(children, r.source, r.target); }
        else if (r.type === "spouse") { push(spouses, r.source, r.target); push(spouses, r.target, r.source); }
        else if (r.type === "ex_spouse") { push(exes, r.source, r.target); push(exes, r.target, r.source); }
        else if (r.type === "sibling") sibEdges.push(r);
    });
    // أخوّةٌ مسجَّلة بلا والدين مشتركين: والدٌ افتراضيّ يجمعهم (يكفي لحساب «ابن الأخ» و«ابن العم»)
    const half = {};
    const uf = {}; const find = (x) => (uf[x] === undefined || uf[x] === x) ? x : (uf[x] = find(uf[x]));
    sibEdges.forEach((r) => {
        if (r.half) { half[r.source + "|" + r.target] = r.half; half[r.target + "|" + r.source] = r.half; }
        const pa = parents[r.source] || [], pb = parents[r.target] || [];
        if (pa.some((x) => pb.indexOf(x) >= 0)) return;     // والدٌ مشترك مسجَّل — يكفي
        const a = find(r.source), b = find(r.target); if (a !== b) uf[a] = b;
    });
    sibEdges.forEach((r) => {
        const pa = parents[r.source] || [], pb = parents[r.target] || [];
        if (pa.some((x) => pb.indexOf(x) >= 0)) return;
        const v = "~v:" + find(r.source);
        [r.source, r.target].forEach((id) => { if (!(parents[id] || []).some((x) => x.startsWith("~v:"))) { push(parents, id, v); push(children, v, id); } });
    });
    return { byId, parents, children, spouses, exes, half };
}
function kgAncestors(G, id) {
    // كلّ سلفٍ بأقصر طريق: id → { d, path:[id, …, السلف] }
    const out = {}; out[id] = { d: 0, path: [id] };
    let frontier = [id];
    for (let d = 1; d <= 12 && frontier.length; d++) {
        const next = [];
        frontier.forEach((x) => (G.parents[x] || []).forEach((p) => {
            if (out[p]) return;
            out[p] = { d, path: out[x].path.concat([p]) };
            next.push(p);
        }));
        frontier = next;
    }
    return out;
}
const KIN_CHILD = (g) => (g === "female" ? "بنت" : "ابن");
function kinOf(label, owner) {
    // «الوالد» + «الزوجة» ⇒ «والد الزوجة» · «ابن العم» + «الوالد» ⇒ «ابن عم الوالد»
    const w = label.split(" "); w[w.length - 1] = w[w.length - 1].replace(/^ال/, "");
    return w.join(" ") + " " + owner;
}
function kinBloodName(G, up, down, pM, pT, nested) {
    const g = (id) => (G.byId[id] && G.byId[id].gender) === "female" ? "female" : "male";
    const T = pT[0];
    if (up === 0 && down === 0) return "نفسي";
    if (down === 0) {
        if (up === 1) return g(T) === "female" ? "الوالدة" : "الوالد";
        if (up === 2) {
            const viaMother = g(pM[1]) === "female";
            return (g(T) === "female" ? "الجدة" : "الجد") + (viaMother && !nested ? " لأم" : "");
        }
        // أبعد: «جدّ الوالد»… نسبةً إلى والدي على الطريق
        return kinOf(kinBloodName(G, up - 1, 0, pM.slice(1), pT, true), g(pM[1]) === "female" ? "الوالدة" : "الوالد");
    }
    if (up === 0) {
        if (down === 1) return g(T) === "female" ? "البنت" : "الابن";
        return KIN_CHILD(g(T)) + " " + kinBloodName(G, 0, down - 1, pM, pT.slice(1), true);
    }
    if (down === 1) {
        if (up === 1) return g(T) === "female" ? "الأخت" : "الأخ";
        if (up === 2) {
            const paternal = g(pM[1]) !== "female";
            return paternal ? (g(T) === "female" ? "العمة" : "العم") : (g(T) === "female" ? "الخالة" : "الخال");
        }
        return kinOf(kinBloodName(G, up - 1, 1, pM.slice(1), pT, true), g(pM[1]) === "female" ? "الوالدة" : "الوالد");
    }
    return KIN_CHILD(g(T)) + " " + kinBloodName(G, up, down - 1, pM, pT.slice(1), true);
}
function kinProx(up, down) {
    const k = up + "," + down;
    if (k === "1,0" || k === "0,1" || k === "0,0") return "A***";
    if (["1,1", "2,0", "0,2", "1,2"].indexOf(k) >= 0) return "A**";
    if (["2,1", "3,0", "0,3", "1,3"].indexOf(k) >= 0) return "A*";
    if (k === "2,2") return "A";
    if (["3,1", "2,3", "4,0", "0,4", "1,4"].indexOf(k) >= 0) return "B";
    return "C";
}
const KIN_PROX_DOWN = { "A***": "A**", "A**": "A*", "A*": "A", "A": "B", "B": "C", "C": "C" };
function kinSection(up, down, pM, G) {
    if (up === 0 && down === 0) return "self";
    if (down === 0) return "usul";
    if (up === 0) return "furu";
    if (up === 1) return "ikhwa";
    if (up === 2) return ((G.byId[pM[1]] || {}).gender === "female") ? "khal" : "amm";
    return "jeel3";
}
// كلّ طرق الدم بين M وT (أقربها أوّلاً)
function kinBloodPaths(G, ancM, T) {
    const ancT = kgAncestors(G, T);
    const commons = Object.keys(ancT).filter((a) => ancM[a]).sort((a, b) => (ancM[a].d + ancT[a].d) - (ancM[b].d + ancT[b].d));
    const accepted = [];
    commons.forEach((c) => {
        // نقبل الجدّ المشترك الأدنى فقط: من كان سلفاً لجدٍّ مقبول فهو الطريق نفسه أطول
        if (accepted.some((a) => kgAncestors(G, a)[c])) return;
        accepted.push(c);
    });
    return accepted.map((c) => ({ c, up: ancM[c].d, down: ancT[c].d, pM: ancM[c].path, pT: ancT[c].path }));
}
function kinSiblingQualifier(G, M, T, commonsAtOne) {
    const h = G.half[M + "|" + T];
    if (h) return h === "mother" ? " من الأم" : " من الأب";
    const real = (id) => (G.parents[id] || []).filter((x) => !x.startsWith("~v:"));
    const pm = real(M), pt = real(T);
    const shared = commonsAtOne.filter((c) => !c.startsWith("~v:"));
    if (pm.length >= 2 && pt.length >= 2) {
        if (shared.length >= 2) return " الشقيق";
        if (shared.length === 1) return (G.byId[shared[0]] || {}).gender === "female" ? " من الأم" : " من الأب";
    }
    return "";
}
// C75: ماذا سيكون القريب الجديد لي؟ — نضيفه افتراضيّاً إلى الشجرة ونحسب. (بديل deriveKinship الذي يقف عند جيلٍ واحد)
function kinPreview(persons, relations, anchor, relKey, gender) {
    try {
        const me = (persons || []).find(isSelfPerson);
        if (!me || !anchor) return null;
        const NEW = "~new";
        const P = (persons || []).concat([{ id: NEW, gender }]);
        const e = relKey === "parent" ? { type: "parent", source: NEW, target: anchor.id }
            : relKey === "child" ? { type: "parent", source: anchor.id, target: NEW }
                : { type: relKey === "ex_spouse" ? "ex_spouse" : relKey, source: anchor.id, target: NEW };
        const R = (relations || []).concat([e]);
        // الإخوة يرثون والدي المرساة (كما يفعل الحفظ)
        if (relKey === "sibling") (relations || []).filter((r) => r.type === "parent" && r.target === anchor.id).forEach((r) => R.push({ type: "parent", source: r.source, target: NEW }));
        const k = kinCompute(P, R, me.id)[NEW];
        return k ? k.kinship : null;
    } catch (err) { return null; }
}
function kinCompute(persons, relations, meId) {
    const G = kinGraph(persons, relations);
    const out = {};
    if (!meId || !G.byId[meId]) return out;
    const ancM = kgAncestors(G, meId);
    const blood = {};
    Object.keys(G.byId).forEach((T) => {
        const paths = kinBloodPaths(G, ancM, T);
        if (!paths.length) return;
        const labels = [];
        paths.forEach((p) => {
            let base = kinBloodName(G, p.up, p.down, p.pM, p.pT), label = base;
            if (p.up === 1 && p.down === 1) {
                const atOne = paths.filter((q) => q.up === 1 && q.down === 1).map((q) => q.c);
                const qual = kinSiblingQualifier(G, meId, T, atOne);
                if (qual) label = base + (G.byId[T].gender === "female" && qual === " الشقيق" ? " الشقيقة" : qual);
            }
            if (!labels.some((l) => l.base === base)) labels.push({ base, label, up: p.up, down: p.down, pM: p.pM, prox: kinProx(p.up, p.down), section: kinSection(p.up, p.down, p.pM, G) });
        });
        blood[T] = labels;
    });
    const fem = (id) => (G.byId[id] || {}).gender === "female";
    Object.keys(G.byId).forEach((T) => {
        const L = (blood[T] || []).slice();
        // زواج: زوجي/زوجتي · زوج قريبٍ بالدم · قريبٌ بالدم لزوجي
        if ((G.spouses[meId] || []).indexOf(T) >= 0) L.push({ base: fem(T) ? "الزوجة" : "الزوج", prox: "A***", section: "zawj", marriage: true });
        if ((G.exes[meId] || []).indexOf(T) >= 0) L.push({ base: fem(T) ? "الزوجة السابقة" : "الزوج السابق", prox: "C", section: "zawj", marriage: true });
        const isAncestorOfMe = !!ancM[T] && T !== meId;
        (G.exes[T] || []).forEach((X) => {
            if (X === meId || !blood[X] || blood[X][0].base === "نفسي") return;
            L.push({ base: (fem(T) ? "طليقة " : "طليق ") + blood[X][0].base, prox: "C", section: blood[X][0].section, marriage: true });
        });
        (G.spouses[T] || []).forEach((X) => {
            if (X === meId || isAncestorOfMe || !blood[X]) return;
            // زوجة أبي وهي أمّي = لا شيء جديد؛ وزوج البنت قد يكون ابن العم أيضاً — يبقى الاثنان
            const xb = blood[X][0];
            if (xb.base === "نفسي") return;
            if (xb.down === 0 && (blood[T] || []).some((b) => b.down === 0)) return;
            L.push({ base: (fem(T) ? "زوجة " : "زوج ") + xb.base, prox: KIN_PROX_DOWN[xb.prox], section: xb.section, marriage: true });
        });
        if (!blood[T]) {
            (G.spouses[meId] || []).forEach((S) => {
                if (S === T) return;
                const ancS = kgAncestors(G, S);
                const ps = kinBloodPaths(G, ancS, T);
                if (!ps.length) return;
                const p = ps[0];
                L.push({ base: kinOf(kinBloodName(G, p.up, p.down, p.pM, p.pT), fem(S) ? "الزوجة" : "الزوج"), prox: KIN_PROX_DOWN[kinProx(p.up, p.down)], section: "other", marriage: true });
            });
        }
        if (!L.length) return;
        const seen = {}, uniq = L.filter((x) => (seen[x.base] ? false : (seen[x.base] = true)));
        out[T] = { kinship: uniq[0].base, label: uniq[0].label || uniq[0].base, proximity: uniq[0].prox, section: uniq[0].section, also: uniq.slice(1).map((x) => x.label || x.base) };
    });
    return out;
}


// ============================================================
// ترتيب الأشخاص للاختيار: من الأبناء (الأعمق) إلى الأجداد، مع عرض
// النسب الكامل — يميّز المتشابهين في الاسم عند ربط العلاقات والدمج.
// ============================================================
// ⛔ وصلة النسب جزءٌ من الاسم لا نصّ واجهة: تبقى عربيةً في الإنجليزية.
// وصورتُها تتبدّل بأمرين: جنسِ الابن (بن/بنت) وجنسِ الوالد. فإن كان
// الوالد أنثى فالصورة بالألف — «عيسى ابن مريم» — وهو اصطلاح عربيّ قائم
// يميّز الأمّ في السلسلة دون أن يقطعها، فلا تُقرأ الأمّ والدَ ابنها.
function lineageLink(childGender, parentGenderValue) {
    const she = childGender === "female";
    if (parentGenderValue === "female")
        return she ? "ابنة" : "ابن";
    return she ? "بنت" : "بن";
}
function buildLineageHelpers(persons, relations) {
    // النسب أبوي: نُفضّل الأب على الأم حين يُسجَّل الوالدان معاً
    const parentOf = {};
    const parentGender = {};
    (persons || []).forEach((p) => { parentGender[p.id] = p.gender; });
    (relations || []).filter((r) => r.type === "parent").forEach((r) => {
        const cur = parentOf[r.target];
        if (!cur) {
            parentOf[r.target] = r.source;
            return;
        }
        // إن كان المسجَّل أنثى والجديد ذكر، نستبدله
        if (parentGender[cur] === "female" && parentGender[r.source] !== "female") {
            parentOf[r.target] = r.source;
        }
    });
    const nameById = Object.fromEntries((persons || []).map((p) => [p.id, p.local_name]));
    // تُرجع المعرّفات لا الأسماء: الوصلة تتبدّل بجنس الوالد، فيلزم معرفته
    function ancestors(id, maxDepth = 3) {
        const chain = [];
        let cur = parentOf[id];
        const guard = new Set([id]);
        while (cur && chain.length < maxDepth && !guard.has(cur)) {
            guard.add(cur);
            chain.push(cur);
            cur = parentOf[cur];
        }
        return chain;
    }
    function lineageLabel(p) {
        const anc = ancestors(p.id);
        if (!anc.length)
            return p.local_name;
        let out = p.local_name, childGender = p.gender;
        anc.forEach((aid) => {
            out += " " + lineageLink(childGender, parentGender[aid]) + " " + (nameById[aid] || "؟");
            childGender = parentGender[aid];
        });
        return out;
    }
    // تسمية مميِّزة لمن لا أصول له: نُعرّفه بزوجه أو ابنه أو أخيه.
    // الزوجة المضافة مثلاً تظهر باسمها وحده فتلتبس بغيرها.
    function distinctLabel(p) {
        const lineage = lineageLabel(p);
        if (lineage !== p.local_name)
            return lineage;
        const rels = relations || [];
        const she = p.gender === "female";
        const touches = (r) => r.source === p.id || r.target === p.id;
        const otherOf = (r) => persons.find((x) => x.id === (r.source === p.id ? r.target : r.source));
        // الزواج القائم أعرف من المنتهي — يُقدَّم، ولا نكتفي بأوّل ما نجد.
        // وتمييز السابق ضرورة لا تحسيناً: بدونه تتطابق الضرّة والمطلَّقة حرفاً بحرف.
        const sp = rels.find((r) => r.type === "spouse" && touches(r)) || rels.find((r) => r.type === "ex_spouse" && touches(r));
        if (sp) {
            const o = otherOf(sp);
            if (o) {
                const ex = sp.type === "ex_spouse";
                const key = ex ? (she ? "fl_ex_wife_of" : "fl_ex_husband_of") : (she ? "fl_wife_of" : "fl_husband_of");
                return t(key, { name: p.local_name, of: lineageLabel(o) });
            }
        }
        const par = rels.find((r) => r.type === "parent" && r.source === p.id);
        if (par) {
            const kid = persons.find((x) => x.id === par.target);
            if (kid)
                return t(she ? "fl_mother_of" : "fl_father_of", { name: p.local_name, of: lineageLabel(kid) });
        }
        // بلا زواج ولا أبناء: نُعرّفه بأخيه قبل السقوط إلى «الاسم (صلته)»
        const sib = rels.find((r) => r.type === "sibling" && touches(r));
        if (sib) {
            const o = otherOf(sib);
            if (o)
                return t(she ? "fl_sister_of" : "fl_brother_of", { name: p.local_name, of: lineageLabel(o) });
        }
        return p.kinship && p.kinship !== "أخرى" ? `${p.local_name} (${personKinLabel(p)})` : p.local_name;
    }
    function generationDepth(id) {
        let d = 0, cur = parentOf[id];
        const guard = new Set([id]);
        while (cur && !guard.has(cur) && d < 20) {
            guard.add(cur);
            d++;
            cur = parentOf[cur];
        }
        return d;
    }
    // الأبناء أولاً (عمق أكبر) ثم صعوداً للأجداد
    function sortedByGeneration(list) {
        return [...(list || [])].sort((a, b) => {
            const diff = generationDepth(b.id) - generationDepth(a.id);
            return diff !== 0 ? diff : a.local_name.localeCompare(b.local_name, "ar");
        });
    }
    return { lineageLabel, distinctLabel, generationDepth, sortedByGeneration };
}
function FamilyMergeSheet({ persons, relations = [], onMerge, onClose }) {
    var _a, _b;
    const { colors } = useTheme();
    const [keepId, setKeepId] = useState((_a = persons[0]) === null || _a === void 0 ? void 0 : _a.id);
    const [removeId, setRemoveId] = useState((_b = persons[1]) === null || _b === void 0 ? void 0 : _b.id);
    const [confirming, setConfirming] = useState(false);
    const [search, setSearch] = useState("");
    const keepPerson = persons.find((p) => p.id === keepId);
    const removePerson = persons.find((p) => p.id === removeId);
    const { distinctLabel: fullLineage, sortedByGeneration } = buildLineageHelpers(persons, relations);
    const sortedPersons = sortedByGeneration(persons);
    const visiblePersons = search.trim()
        ? sortedPersons.filter((p) => fullLineage(p).includes(search.trim()))
        : sortedPersons;
    return (React.createElement(FamSheet, { title: t("dmj_qrybyn_mkrryn"), onClose: onClose, z: 30, maxHeight: "92%" },
        React.createElement("div", { className: "pt-1" },
            React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("lw_adft_nfs_alqryb")),
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-full border px-3 py-1.5 mb-4`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement(Search, { size: 13, color: colors.textMuted }),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t("abhth_balasm_aw_alnsb"), className: "flex-1 bg-transparent text-xs outline-none", style: { color: colors.text, minWidth: 0 } })),
            React.createElement("label", { className: `text-[11.5px] font-bold mb-1.5 block ${textStart()}`, style: { color: colors.textMuted } }, t("alshkhs_alasly_ybqa")),
            React.createElement("div", { className: "mb-4" }, visiblePersons.map((p) => (React.createElement("button", { key: p.id, onClick: () => setKeepId(p.id), className: `w-full flex ${rowStart()} items-center gap-2 px-3 py-2 rounded-xl mb-1 ${textStart()}`, style: {
                    backgroundColor: keepId === p.id ? colors.primaryLight : colors.card,
                    border: `1px solid ${keepId === p.id ? colors.primary : colors.border}`,
                } },
                React.createElement("span", { className: "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2", style: { borderColor: keepId === p.id ? colors.primary : colors.border, backgroundColor: keepId === p.id ? colors.primary : "transparent" } }, keepId === p.id && React.createElement(Check, { size: 11, color: "#fff" })),
                React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                    React.createElement("p", { className: "text-xs font-bold truncate", style: { color: colors.text } }, fullLineage(p)),
                    React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } },
                        personKinLabel(p),
                        p.alive === false ? " · متوفّى" : "")))))),
            React.createElement("label", { className: `text-[11.5px] font-bold mb-1.5 block ${textStart()}`, style: { color: colors.textMuted } }, t("alshkhs_almkrr_ydmj_wyhdhf")),
            React.createElement("div", { className: "mb-4" }, visiblePersons.filter((p) => p.id !== keepId).map((p) => (React.createElement("button", { key: p.id, onClick: () => setRemoveId(p.id), className: `w-full flex ${rowStart()} items-center gap-2 px-3 py-2 rounded-xl mb-1 ${textStart()}`, style: {
                    backgroundColor: removeId === p.id ? colors.danger + "18" : colors.card,
                    border: `1px solid ${removeId === p.id ? colors.danger : colors.border}`,
                } },
                React.createElement("span", { className: "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2", style: { borderColor: removeId === p.id ? colors.danger : colors.border, backgroundColor: removeId === p.id ? colors.danger : "transparent" } }, removeId === p.id && React.createElement(Check, { size: 11, color: "#fff" })),
                React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                    React.createElement("p", { className: "text-xs font-bold truncate", style: { color: colors.text } }, fullLineage(p)),
                    React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } },
                        personKinLabel(p),
                        p.alive === false ? " · متوفّى" : "")))))),
            keepPerson && removePerson && (React.createElement(FamCard, { className: "mb-4" },
                React.createElement("p", { className: "text-xs", style: { color: colors.text } },
                    t("kl_alaqat"),
                    React.createElement("b", null, removePerson.local_name),
                    t("balshjra_ab_abn_akh"),
                    React.createElement("b", null, keepPerson.local_name),
                    " \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B. \u0623\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629 \u0639\u0646\u062F ",
                    keepPerson.local_name,
                    " (\u0647\u0627\u062A\u0641\u060C \u0645\u064A\u0644\u0627\u062F\u060C \u0635\u0648\u0631\u0629) \u0647\u062A\u062A\u0643\u0645\u0651\u0644 \u0645\u0646 ",
                    removePerson.local_name,
                    " \u0644\u0648 \u0645\u0648\u062C\u0648\u062F\u0629."))),
            !confirming ? (React.createElement(FamButton, { label: t("dmj_alqrybyn"), disabled: !keepId || !removeId || keepId === removeId, onPress: () => setConfirming(true) })) : (React.createElement("div", { className: "rounded-xl border p-3", style: { borderColor: colors.danger } },
                React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } },
                    "\u062A\u0623\u0643\u064A\u062F\u061F \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646\u0647 \u2014 ", removePerson === null || removePerson === void 0 ? void 0 :
                    removePerson.local_name,
                    " \u0633\u062A\u064F\u062D\u0630\u0641 \u0646\u0647\u0627\u0626\u064A\u0627\u064B"),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => { onMerge(keepId, removeId); onClose(); }, className: "flex-1 rounded-xl py-2", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-xs font-bold text-white" }, t("nam_admj_wahdhf"))),
                    React.createElement("button", { onClick: () => setConfirming(false), className: "flex-1 rounded-xl py-2 border", style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("ilgha")))))))));
}
// ============================================================
// البحث المتقدّم في الشجرة — أربعة محاور: الاسم، الدرجة، الفرع، الموقع.
// الدرجة والفرع كلاهما مشتقّ من الصلة لا مُدخَل، فالمرشِّح يقرأ الحقل
// المشتقّ ولا يعيد حسابه — وإلا تباين الفرز عن العرض.
// ============================================================
function AdvancedSearchScreen({ persons, relations = [], onBack, onOpenPerson }) {
    const { colors } = useTheme();
    const [query, setQuery] = useState("");
    const [proximity, setProximity] = useState("all");
    const [branch, setBranch] = useState("all");
    const [city, setCity] = useState("all");
    const [statusKeys, setStatusKeys] = useState([]); // اختيار متعدّد
    const [showAllCities, setShowAllCities] = useState(false);
    const { distinctLabel } = buildLineageHelpers(persons, relations);
    const cities = extractCities(persons);
    const visibleCities = showAllCities ? cities : cities.slice(0, 5);
    // الدرجات الست كما هي في مصدر الحقيقة — لا تُختصر ولا تُخلط بالصلات.
    // (التصميم عرض أربعة خيارات أحدها «أبناء العمومة»، وهي صلة لا درجة.)
    const proximityOptions = [
        { k: "all", label: "الكل" },
        ...Object.entries(proximityLabels).map(([k, label]) => ({
            k, label, days: proximityContactDays[k],
        })),
    ];
    const branchOptions = [
        { k: "all", label: "الكل" },
        { k: "paternal", label: "جهة الأب" },
        { k: "maternal", label: "جهة الأم" },
        { k: "both", label: "الجذع المشترك" },
    ];
    const statusOptions = [
        { k: "alive", label: "على قيد الحياة" },
        { k: "deceased", label: "متوفّى" },
        { k: "overdue", label: "تأخّر التواصل" },
        { k: "favorite", label: "مفضّل" },
    ];
    const toggleStatus = (k) => setStatusKeys((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
    const results = persons.filter((p) => {
        const q = query.trim().toLowerCase();
        if (q) {
            const hay = `${p.local_name} ${p.kinship || ""} ${kinshipLabel(p.kinship || "")} ${distinctLabel(p)}`.toLowerCase(); // ⛔ المُعرِّف والتسمية معاً: يُبحَث باللغتين
            if (!hay.includes(q))
                return false;
        }
        if (proximity !== "all" && p.proximity !== proximity)
            return false;
        if (branch !== "all" && branchForKinship(p.kinship) !== branch)
            return false;
        if (city !== "all" && !personInCity(p, city))
            return false;
        // الحالات اختيار متعدّد بمنطق «أو» داخل المجموعة
        if (statusKeys.length > 0) {
            const hit = statusKeys.some((k) => k === "alive" ? p.alive !== false
                : k === "deceased" ? p.alive === false
                    : k === "overdue" ? isContactOverdue(p)
                        : k === "favorite" ? !!p.favorite
                            : false);
            if (!hit)
                return false;
        }
        return true;
    });
    const activeCount = (proximity !== "all" ? 1 : 0) + (branch !== "all" ? 1 : 0) +
        (city !== "all" ? 1 : 0) + statusKeys.length;
    const resetAll = () => {
        setQuery("");
        setProximity("all");
        setBranch("all");
        setCity("all");
        setStatusKeys([]);
    };
    // شريحة اختيار — نفس الشكل في كل المجموعات لتقليل الحمل الإدراكي
    const Pill = ({ active, label, sub, onPress }) => (React.createElement("button", { onClick: onPress, className: "rounded-full px-3 py-1.5 text-[11px] font-bold shrink-0", style: {
            backgroundColor: active ? colors.primary : colors.card,
            color: active ? "#fff" : colors.text,
            border: `1px solid ${active ? colors.primary : colors.border}`,
        } },
        label,
        sub && (React.createElement("span", { className: `text-[9px] ${me("1")}`, style: { color: active ? "#ffffffcc" : colors.textMuted } }, sub))));
    const Group = ({ icon: Icon, title, action, children }) => (React.createElement(FamCard, { className: "mb-3" },
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mb-2.5` },
            React.createElement(Icon, { size: 14, color: colors.primary }),
            React.createElement("span", { className: `text-xs font-extrabold flex-1 ${textStart()}`, style: { color: colors.primary } }, title),
            action),
        React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-1.5` }, children)));
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(FamHeader, { compact: true, title: t("albhth_almtqdm"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-xl px-3 py-2.5 mb-3`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement(Search, { size: 15, color: colors.textMuted }),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: query, onChange: (e) => setQuery(e.target.value), placeholder: t("abhth_balasm_aw_alnsb_2"), className: `flex-1 bg-transparent text-xs outline-none ${textStart()}`, style: { color: colors.text } }),
                query && (React.createElement("button", { onClick: () => setQuery("") },
                    React.createElement(X, { size: 14, color: colors.textMuted })))),
            React.createElement(Group, { icon: Users2, title: t("drja_alqraba") }, proximityOptions.map((o) => (React.createElement(Pill, { key: o.k, active: proximity === o.k, label: o.label, sub: o.days ? t("y_days", { days: o.days }) : null, onPress: () => setProximity(o.k) })))),
            React.createElement(Group, { icon: GitBranch, title: t("fra_alaayla") }, branchOptions.map((o) => (React.createElement(Pill, { key: o.k, active: branch === o.k, label: o.label, onPress: () => setBranch(o.k) })))),
            cities.length > 0 && (React.createElement(Group, { icon: MapPin, title: t("almwqa"), action: cities.length > 5 && (React.createElement("button", { onClick: () => setShowAllCities((v) => !v), className: "text-[10px] font-bold", style: { color: colors.accent } }, showAllCities ? "أقل" : `+${cities.length - 5}`)) },
                React.createElement(Pill, { active: city === "all", label: t("alkl"), onPress: () => setCity("all") }),
                visibleCities.map((c) => (React.createElement(Pill, { key: c.city, active: city === c.city, label: c.city, sub: `${c.n}`, onPress: () => setCity(c.city) }))))),
            React.createElement(Group, { icon: AlertCircle, title: t("alhala") }, statusOptions.map((o) => (React.createElement(Pill, { key: o.k, active: statusKeys.includes(o.k), label: o.label, onPress: () => toggleStatus(o.k) })))),
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mb-3` },
                React.createElement("div", { className: "flex-1 rounded-xl px-3 py-2.5 text-center", style: { backgroundColor: colors.primaryLight, border: `1px solid ${colors.primary}44` } },
                    React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.primaryDark } },
                        results.length,
                        " \u0646\u062A\u064A\u062C\u0629"),
                    activeCount > 0 && (React.createElement("span", { className: `text-[10px] ${me("1.5")}`, style: { color: colors.primaryDark } },
                        "(",
                        activeCount,
                        " \u0645\u0631\u0634\u0650\u0651\u062D)"))),
                activeCount > 0 && (React.createElement("button", { onClick: resetAll, className: "rounded-xl px-3 py-2.5 text-[11px] font-bold shrink-0", style: { backgroundColor: colors.card, color: colors.danger, border: `1px solid ${colors.border}` } }, t("msh_alkl")))),
            results.length === 0 ? (React.createElement(FamCard, null,
                React.createElement("p", { className: "text-xs text-center py-4", style: { color: colors.textMuted } }, t("la_ntayj_mtabqa_jrb")))) : (results.map((p) => {
                var _a;
                return (React.createElement("button", { key: p.id, onClick: () => onOpenPerson === null || onOpenPerson === void 0 ? void 0 : onOpenPerson(p), className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 mb-2`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                    React.createElement("div", { className: "rounded-full flex items-center justify-center shrink-0", style: {
                            width: 42, height: 42,
                            backgroundColor: colors.primaryLight,
                            opacity: p.alive === false ? 0.6 : 1,
                        } },
                        React.createElement("span", { className: "text-sm font-extrabold", style: { color: colors.primary } }, p.local_name.trim().charAt(0))),
                    React.createElement("div", { className: `flex-1 ${textStart()} min-w-0` },
                        React.createElement("p", { className: "text-xs font-extrabold truncate", style: { color: colors.text } }, distinctLabel(p)),
                        React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-0.5 flex-wrap` },
                            React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, personKinLabel(p)),
                            React.createElement("span", { style: { color: colors.border } }, "\u00B7"),
                            React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, proxLabel(p.proximity)),
                            branchForKinship(p.kinship) !== "both" && (React.createElement(React.Fragment, null,
                                React.createElement("span", { style: { color: colors.border } }, "\u00B7"),
                                React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, t(branchLabelKeys[branchForKinship(p.kinship)])))),
                            ((_a = (p.locations || [])[0]) === null || _a === void 0 ? void 0 : _a.address_text) && (React.createElement(React.Fragment, null,
                                React.createElement("span", { style: { color: colors.border } }, "\u00B7"),
                                React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, p.locations[0].address_text.split(/[,،]/).pop().trim()))))),
                    isContactOverdue(p) && (React.createElement("span", { className: "rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0", style: { backgroundColor: colors.accent + "22", color: colors.accent } }, t("mtakhr"))),
                    React.createElement(ChevronLeft, { size: 14, color: colors.textMuted, className: "shrink-0" })));
            })))));
}
// ⛔ أدوات الصيانة تُصلح بياناتٍ أُدخلت قبل الاستنتاج التلقائي. مكانها شيتٌ لا
// صفّ القائمة: هي للإصلاح حين يختلّ شيء، لا للاستعمال اليوميّ. والرقم على
// زرّها يكفي ليُعلَم أنّ فيها ما ينتظر.
function FamilyTreeToolsSheet({ personsCount, missingSpouseLinks, mismatchedCount, onMerge, onInferSpouses, onRecalcProximity, onClose }) {
    const { colors } = useTheme();
    const items = [
        { key: "merge", icon: Combine, title: t("dmj_qrybyn_mkrryn"), sub: t("fg_dmj_shrh"), n: 0, enabled: personsCount >= 2, act: onMerge },
        { key: "links", icon: LinkIcon, title: t("fg_islah_alrwabt"), sub: t("rbt_alwaldyn_bzwaj_wisra"), done: t("ai_kl_alrwabt"), n: missingSpouseLinks, enabled: missingSpouseLinks > 0, act: onInferSpouses },
        { key: "levels", icon: RotateCcw, title: t("fg_mwamaa_aldrjat"), sub: t("fg_mwamaa_shrh"), done: t("fg_aldrjat_mtwaima"), n: mismatchedCount, enabled: mismatchedCount > 0, act: onRecalcProximity },
    ];
    return (React.createElement("div", { className: "absolute inset-0 z-50 flex items-end justify-center", style: { backgroundColor: "rgba(0,0,0,0.5)" }, onClick: onClose },
        React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "w-full rounded-t-2xl p-4", style: { backgroundColor: colors.card }, onClick: (e) => e.stopPropagation() },
            React.createElement("p", { className: `text-sm font-extrabold ${textStart()}`, style: { color: colors.text } }, t("fg_adwat_alshjra")),
            React.createElement("p", { className: `text-[11px] mt-0.5 mb-3 ${textStart()}`, style: { color: colors.textMuted } }, t("fg_adwat_shrh")),
            items.map((it) => (React.createElement("button", { key: it.key, disabled: !it.enabled, onClick: () => { onClose(); if (it.act)
                    it.act(); }, className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 mb-2 ${textStart()}`, style: { backgroundColor: colors.bg, border: `1px solid ${colors.border}`, opacity: it.enabled ? 1 : 0.6 } },
                React.createElement("span", { className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primaryLight } },
                    React.createElement(it.icon, { size: 16, color: colors.primaryDark })),
                React.createElement("span", { className: "flex-1 min-w-0" },
                    React.createElement("span", { className: "block text-xs font-extrabold", style: { color: colors.text } }, it.title),
                    React.createElement("span", { className: "block text-[10px] mt-0.5 leading-relaxed", style: { color: colors.textMuted } }, !it.enabled && it.done ? it.done : it.sub)),
                it.n > 0 && (React.createElement("span", { className: "shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-extrabold", style: { backgroundColor: colors.accent + "22", color: colors.accent } }, it.n.toLocaleString(loc())))))),
            React.createElement("button", { onClick: onClose, className: "w-full rounded-xl py-2.5 mt-1 text-xs font-bold", style: { color: colors.textMuted } }, t("ighlaq")))));
}
// C33: من يملك تعديل الشجرة؟ كلّ من ليس «مشاهداً» (المالك والمحرّر، والعائلة المحلّيّة لصاحبها)
function famCanEdit(group) { return !!group && group.role !== "viewer"; }
function FamilyGroupDetailScreen({ meId, onPickMe, group, persons, relations = [], favorites, otherGroups = [], onToggleFav, onOpenPerson, onBack, onOpenGroups, onAddPerson, onAddPersonChain, onMergePersons, onOpenTree, onOpenSuggestions, onOpenSchedules, onOpenEvents, onOpenMembers, onAddRelativesBulk, onExportSelected, onPrioritizeSelected, onSuggestForSelected, onDeletePerson, onDeletePersonsBulk, onMarkContactBulk, onRecalcProximity, onInferSpouses, groupAllowsMemberEvents = false, initialFilterStatus = "all", }) {
    const { colors, isDark } = useTheme();
    const [showAddForm, setShowAddForm] = useState(false);
    const [showChainAdd, setShowChainAdd] = useState(false);
    const [showMerge, setShowMerge] = useState(false);
    const [showTools, setShowTools] = useState(false);
    const [bulkFor, setBulkFor] = useState(null); // شخص لإضافة عدة أقارب له
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("default"); // default | proximity | lastContact | alphabetical
    // الإضافة والحذف: للمالك دائماً، وللمشرف، ولمن مُنح صلاحية التحرير صراحةً.
    // بقية الأعضاء يضيفون الأحداث فقط إن أذن المالك بذلك.
    const canEdit = famCanEdit(group);   // C33: تعريفٌ واحد في كلّ الشاشات
    const canAddEvents = canEdit || groupAllowsMemberEvents;
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [filterProximity, setFilterProximity] = useState("all");
    const [showProximityHelp, setShowProximityHelp] = useState(false); // all | A | B | C
    const [filterStatus, setFilterStatus] = useState(initialFilterStatus); // all | overdue | alive | deceased — يُمهَّد من بطاقة المجموعة
    const [selectedIds, setSelectedIds] = useState([]);
    const longPressRef = useRef(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const pressTimer = useRef(null);
    const pressPos = useRef(null);
    // أشخاص درجتهم لا تطابق صلة قرابتهم (بيانات أُنشئت قبل تثبيت التصنيف)
    const mismatchedCount = persons.filter((p) => p.proximity !== proximityForKinship(p.kinship)).length;
    // من ليس له أي علاقة — لا يظهر في الشجرة إطلاقاً
    const linkedIds = new Set(relations.flatMap((r) => [r.source, r.target]));
    // C74: «نفسي» وحدها ليست قريباً بلا علاقة — هي أصل الشجرة (كان أوّل ما يظهر بعد إضافة نفسك تحذيرٌ عنك)
    const [pickingMe, setPickingMe] = useState(false);
    const unlinkedCount = persons.length < 2 ? 0 : persons.filter((p) => !linkedIds.has(p.id)).length;
    // والدان مسجَّلان لنفس الشخص بلا رابط زواج — بيانات أُدخلت قبل الاستنتاج التلقائي
    const missingSpouseLinks = (() => {
        const byChild = {};
        relations.filter((r) => r.type === "parent").forEach((r) => { var _a; var _b; ((_a = byChild[_b = r.target]) !== null && _a !== void 0 ? _a : (byChild[_b] = [])).push(r.source); });
        let n = Object.values(byChild).filter((ps) => {
            if (ps.length !== 2)
                return false;
            const [a, b] = ps;
            return !relations.some((r) => (r.type === "spouse" || r.type === "ex_spouse")
                && ((r.source === a && r.target === b) || (r.source === b && r.target === a)));
        }).length;
        // إخوة بلا والد بينما لأحد إخوتهم والد مسجَّل
        const sibE = relations.filter((r) => r.type === "sibling").map((r) => [r.source, r.target]);
        const seen = new Set();
        persons.forEach((p) => {
            if (seen.has(p.id))
                return;
            const grp = new Set([p.id]);
            const q = [p.id];
            while (q.length) {
                const cur = q.pop();
                sibE.forEach(([a, b]) => {
                    if (a === cur && !grp.has(b)) {
                        grp.add(b);
                        q.push(b);
                    }
                    if (b === cur && !grp.has(a)) {
                        grp.add(a);
                        q.push(a);
                    }
                });
            }
            grp.forEach((id) => seen.add(id));
            if (grp.size < 2)
                return;
            const withParent = [...grp].filter((id) => relations.some((r) => r.type === "parent" && r.target === id));
            if (withParent.length > 0 && withParent.length < grp.size)
                n += grp.size - withParent.length;
        });
        return n;
    })();
    const selectionMode = selectedIds.length > 0;
    function toggleSelect(id) {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }
    // مسح التحديد عند تغيير الفلاتر أو البحث — وإلا بقيت أسماء محدَّدة
    // خارج القائمة المعروضة فتُحذف أو تُصدَّر دون أن يراها المستخدم.
    useEffect(() => { setSelectedIds([]); }, [filterProximity, filterStatus, searchQuery]);
    const filteredPersons = persons.filter((p) => {
        var _a;
        const q = searchQuery.trim().toLowerCase();
        if (q && !(p.local_name.toLowerCase().includes(q) || ((_a = p.kinship) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q)) || kinshipLabel(p.kinship || "").toLowerCase().includes(q) /* ⛔ المُعرِّف والتسمية معاً */))
            return false;
        if (filterProximity !== "all" && p.proximity !== filterProximity)
            return false;
        if (filterStatus === "overdue" && !isContactOverdue(p))
            return false;
        if (filterStatus === "alive" && !p.alive)
            return false;
        if (filterStatus === "deceased" && p.alive)
            return false;
        return true;
    });
    const proximityOrder = { "A***": 0, "A**": 1, "A*": 2, "A": 3, B: 4, C: 5 };
    // C51: نافذة عرض للقائمة — أوّل ٦٠ ثمّ ٦٠ أخرى كلّما اقترب التمرير من الأسفل؛ تعود للبداية عند تغيّر البحث/التصفية
    const [listN, setListN] = useState(60);
    useEffect(() => { setListN(60); }, [searchQuery, filteredPersons.length]);
    const sortedPersons = [...filteredPersons].sort((a, b) => {
        var _a, _b;
        if (sortBy === "proximity")
            return ((_a = proximityOrder[a.proximity]) !== null && _a !== void 0 ? _a : 3) - ((_b = proximityOrder[b.proximity]) !== null && _b !== void 0 ? _b : 3);
        if (sortBy === "lastContact")
            return (a.lastContactDate || 0) - (b.lastContactDate || 0); // الأبعد (الأقدم تواصلاً) أولاً
        if (sortBy === "alphabetical")
            return a.local_name.localeCompare(b.local_name, "ar");
        return 0; // default: ترتيب الإضافة الأصلي
    });
    const treeFixCount = missingSpouseLinks + mismatchedCount;
    const [showSort, setShowSort] = useState(false);   // C34: الترتيب في ورقةٍ بدل صفّ شرائح
    const SORTS = [{ key: "default", label: t("alasly") }, { key: "proximity", label: t("ft_drja_alqrb") }, { key: "lastContact", label: t("akhr_twasl") }, { key: "alphabetical", label: t("abjdy") }];
    const nL = (x) => Number(x || 0).toLocaleString(loc());
    // C34: النمط الحديث — رأس متدرّج يحوي البحث، شرائح مستديرة، بطاقات ناعمة، وزرّ إضافة عائم
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col relative", style: { backgroundColor: colors.bg } },
        React.createElement(FamHeader, { title: group.name, onBack: onBack, compact: true,
            // C74: كان يظهر «دورك: مشاهدة فقط · · مشاهدة فقط» — الدور يكفي، ويُضاف «تضيف الأحداث» وحده إن سُمح
            subtitle: membersCountLabel(nL(persons.length)) + t("ft_dwrk") + roleLabel(group.role) + (!canEdit && canAddEvents ? t("fg_tdyf_alahdath") : ""),
            // ⛔ حين تُطوى قائمة المجموعات وتصير هذه الشاشة جذراً، يبقى هذا
            // الزرّ سبيلها الوحيد — وفيه الإنشاء والتسمية والحذف.
            actions: React.createElement(React.Fragment, null,
                onOpenGroups && React.createElement(FamHeaderBtn, { icon: Users, label: t("fg_almjmwaat"), onPress: onOpenGroups }),
                !canEdit && canAddEvents && React.createElement(FamHeaderBtn, { icon: Calendar, label: t("idafa_hdth"), onPress: onOpenEvents })) },
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-2xl px-3.5 py-2.5`, style: { backgroundColor: "rgba(255,255,255,0.94)" } },
                React.createElement(Search, { size: 15, color: "#6B7280" }),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: t("bhth_balasm_aw_sla"), className: "flex-1 bg-transparent text-[13px] outline-none min-w-0", style: { color: "#111827" } }),
                React.createElement("button", { "aria-label": t("bhth_mtqdm"), onClick: () => setShowAdvancedSearch(true), className: "shrink-0", title: t("bhth_mtqdm") },
                    React.createElement(SlidersHorizontal, { size: 16, color: colors.primary })))),
        canEdit && !selectionMode && !showAddForm && !showChainAdd && !bulkFor && React.createElement(FamFab, { label: t("idafa_qryb"), icon: UserPlus, onPress: () => setShowAddForm(true), style: { bottom: 92 } }),
        showSort && React.createElement(FamSheet, { title: tl("ترتيب الأقارب", "Sort relatives"), onClose: () => setShowSort(false), maxHeight: "60%" },
            SORTS.map((o, i) => React.createElement(FamRow, { key: o.key, icon: i === 0 ? Users : i === 1 ? Target : i === 2 ? Clock : FileText, title: o.label, last: i === SORTS.length - 1, onPress: () => { setSortBy(o.key); setShowSort(false); }, right: sortBy === o.key ? React.createElement(Check, { size: 17, color: colors.primary }) : React.createElement("span", null) }))),
        bulkFor && (React.createElement(QuickRelativesSheet, { person: bulkFor, existingPersons: persons, relations: relations, onSave: (pp, relKey, names, decisions) => onAddRelativesBulk === null || onAddRelativesBulk === void 0 ? void 0 : onAddRelativesBulk(group.id, pp, relKey, names, decisions), onClose: () => setBulkFor(null) })),
        showTools && React.createElement(FamilyTreeToolsSheet, { personsCount: persons.length, missingSpouseLinks: missingSpouseLinks, mismatchedCount: mismatchedCount, onMerge: () => setShowMerge(true), onInferSpouses: onInferSpouses, onRecalcProximity: onRecalcProximity, onClose: () => setShowTools(false) }),
        showMerge && React.createElement(FamilyMergeSheet, { persons: persons, relations: relations, onMerge: onMergePersons, onClose: () => setShowMerge(false) }),
        showAddForm && React.createElement(FamilyPersonFormSheet, { persons: persons, relations: relations, otherGroups: otherGroups, onSave: (data) => onAddPerson(data), onClose: () => setShowAddForm(false) }),
        showChainAdd && React.createElement(FamilyChainAddSheet, { existingPersons: persons, relations: relations, onSave: (chainNames, groupsOfRelatives, targetIndex, matchDecisions, firstGender, firstIsSelf) => { onAddPersonChain(chainNames, groupsOfRelatives, targetIndex, matchDecisions, firstGender, firstIsSelf); setShowChainAdd(false); }, onClose: () => setShowChainAdd(false) }),
        showAdvancedSearch && (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
            React.createElement(AdvancedSearchScreen, { persons: persons, relations: relations, onBack: () => setShowAdvancedSearch(false), onOpenPerson: (p) => { setShowAdvancedSearch(false); onOpenPerson === null || onOpenPerson === void 0 ? void 0 : onOpenPerson(p); } }))),

        confirmBulkDelete && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setConfirmBulkDelete(false), style: { position: "fixed", inset: 0, zIndex: 44, backgroundColor: "rgba(0,0,0,0.45)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 24, right: 24, top: "32%", zIndex: 45, backgroundColor: colors.card, borderRadius: 20, padding: 20 } },
                React.createElement("p", { className: "text-sm font-extrabold text-center mb-1", style: { color: colors.text } },
                    t("fg_hdhf"),
                    selectedIds.length,
                    t("fg_mn_alaqarb")),
                React.createElement("p", { className: "text-[11px] text-center mb-5 leading-relaxed", style: { color: colors.textMuted } }, t("sthdhf_alaqathm_fy_alshjra")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => { onDeletePersonsBulk === null || onDeletePersonsBulk === void 0 ? void 0 : onDeletePersonsBulk(selectedIds); setSelectedIds([]); setConfirmBulkDelete(false); }, className: "flex-1 py-2.5 rounded-xl text-xs font-extrabold", style: { backgroundColor: colors.danger, color: "#fff" } }, t("hdhf")),
                    React.createElement("button", { onClick: () => setConfirmBulkDelete(false), className: "flex-1 py-2.5 rounded-xl text-xs font-bold", style: { backgroundColor: colors.bg, color: colors.textMuted, border: `1px solid ${colors.border}` } }, t("ilgha")))))),
        selectionMode && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 px-4 py-2.5 mx-4 mt-3 rounded-2xl`, style: { backgroundColor: colors.primaryLight, boxShadow: famShadow(isDark) } },
            React.createElement("button", { onClick: () => setSelectedIds([]), "aria-label": t("ilgha_althdyd") },
                React.createElement(X, { size: 17, color: colors.primary })),
            React.createElement("span", { className: `flex-1 text-xs font-extrabold ${textStart()}`, style: { color: colors.primary } },
                selectedIds.length,
                t("fg_mhdd")),
            React.createElement("button", { onClick: () => setSelectedIds(selectedIds.length === sortedPersons.length ? [] : sortedPersons.map((p) => p.id)), className: "text-[10px] font-bold", style: { color: colors.primary } }, selectedIds.length === sortedPersons.length ? t("ilgha_alkl") : t("thdyd_alkl")),
            React.createElement("button", { onClick: () => onExportSelected === null || onExportSelected === void 0 ? void 0 : onExportSelected(persons.filter((p) => selectedIds.includes(p.id))), "aria-label": t("tsdyr") },
                React.createElement(Download, { size: 16, color: colors.primary })),
            React.createElement("button", { onClick: () => { onPrioritizeSelected === null || onPrioritizeSelected === void 0 ? void 0 : onPrioritizeSelected(selectedIds); setSelectedIds([]); }, "aria-label": t("awlwya_twasl"), title: t("rfa_drja_alqrb") },
                React.createElement(Star, { size: 16, color: colors.accent })),
            React.createElement("button", { onClick: () => onSuggestForSelected === null || onSuggestForSelected === void 0 ? void 0 : onSuggestForSelected(persons.filter((p) => selectedIds.includes(p.id))), "aria-label": t("aqtrahat_dhkya") },
                React.createElement(Lightbulb, { size: 16, color: colors.primary })),
            React.createElement("button", { onClick: () => { onMarkContactBulk === null || onMarkContactBulk === void 0 ? void 0 : onMarkContactBulk(selectedIds); setSelectedIds([]); }, "aria-label": t("tsjyl_twasl"), title: t("sjl_ank_twaslt_mahm") },
                React.createElement(CheckCheck, { size: 16, color: colors.success || colors.primary })),
            canEdit && (React.createElement("button", { onClick: () => setConfirmBulkDelete(true), "aria-label": t("hdhf") },
                React.createElement(Trash2, { size: 16, color: colors.danger }))))),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4 pt-3", style: { backgroundColor: colors.bg, paddingBottom: canEdit ? 140 : 90 }, onScroll: (e) => { const el = e.currentTarget; if (listN < sortedPersons.length && el.scrollHeight - el.scrollTop - el.clientHeight < 600) setListN((n) => n + 60); } },
            // شرح يُفتح عند الطلب: النظام لا يحتاج تعلّماً للاستعمال،
            // لكن من يتساءل "من أين جاءت هذه المدد؟" يجد الجواب
            showProximityHelp && React.createElement("div", { className: "rounded-2xl p-3.5 mb-3", style: { backgroundColor: colors.primaryLight } },
                React.createElement("div", { className: `flex ${rowStart()} items-start justify-between gap-2 mb-2` },
                    React.createElement("span", { className: "text-[11px] font-extrabold", style: { color: colors.primaryDark } }, t("kyf_thsb_mda_altdhkyr")),
                    React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => setShowProximityHelp(false) },
                        React.createElement(X, { size: 13, color: colors.primaryDark }))),
                React.createElement("p", { className: `text-[10px] leading-relaxed mb-2 ${textStart()}`, style: { color: colors.primaryDark } },
                    t("fg_almda_thsb")),
                [
                    { l: t("alwaldan_walabna"), d: 7 },
                    { l: t("alikhwa_wabnawhm"), d: 10 },
                    { l: t("alamam_walakhwal"), d: 14 },
                    { l: t("abna_alam_walkhal"), d: 21 },
                    { l: t("aqarb_alwaldyn"), d: 30 },
                    { l: t("abad_mn_dhlk"), d: 45 },
                ].map((r) => React.createElement("div", { key: r.l, className: `flex ${rowStart()} items-center justify-between py-0.5` },
                    React.createElement("span", { className: "text-[10px]", style: { color: colors.primaryDark } }, r.l),
                    React.createElement("span", { className: "text-[10px] font-bold tabular-nums", style: { color: colors.primaryDark } }, t("fg_kl") + r.d + t("fg_ywm"))))),
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 -mx-1 px-1` },
                React.createElement("div", { className: "flex-1 min-w-0" },
                    // درجة القرب آلية داخلية تُنتج التذكيرات — المستخدم يفلتر
                    // بصلة القرابة التي يفهمها، لا برمز A***‎ ولا بمدّة التذكير
                    React.createElement(FamTabs, { value: filterProximity, onChange: setFilterProximity, options: [
                            { k: "all", l: t("alkl") },
                            { k: "A***", l: t("alwaldan_walabna") },
                            { k: "A**", l: t("alikhwa") },
                            { k: "A*", l: t("alamam_walakhwal") },
                            { k: "A", l: t("abna_alam_walkhal") },
                            { k: "B", l: t("aqarb_alwaldyn") },
                            { k: "C", l: t("abad") },
                        ] })),
                React.createElement("button", { "aria-label": t("kyf_thsb_mda_altdhkyr"), onClick: () => setShowProximityHelp(function (v) { return !v; }), className: "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-1", style: { backgroundColor: showProximityHelp ? colors.primary : colors.card, boxShadow: famShadow(isDark) } },
                    React.createElement("span", { className: "text-[12px] font-extrabold", style: { color: showProximityHelp ? "#fff" : colors.textMuted } }, t("fg_swal")))),
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mt-1.5 mb-2 -mx-1 px-1` },
                React.createElement("div", { className: "flex-1 min-w-0" },
                    React.createElement(FamTabs, { value: filterStatus, onChange: (k) => setFilterStatus(filterStatus === k ? "all" : k), options: [
                            { k: "overdue", l: t("fg_takhr"), n: persons.filter(isContactOverdue).length || undefined },
                            { k: "alive", l: t("ahya") },
                            { k: "deceased", l: t("mtwfwn") },
                        ] })),
                React.createElement("button", { onClick: () => setShowSort(true), className: `shrink-0 mb-1 flex ${rowStart()} items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold`, style: { backgroundColor: colors.card, color: colors.primary, boxShadow: famShadow(isDark) } },
                    React.createElement(ChevronsDownUp, { size: 12 }), (SORTS.find((o) => o.key === sortBy) || SORTS[0]).label)),
            // C75: من انضمّ إلى شجرة غيره يختار «هذا أنا» فتُحسب القرابات منه هو — لا يتغيّر شيءٌ عند غيره
            group.role && group.role !== "owner" && !selectionMode && onPickMe && (() => {
                const me = meId ? persons.find((p) => p.id === meId) : null;
                const owner = persons.find((p) => p.kinStored === SELF_KINSHIP || (!p.kinStored && isSelfPerson(p)));
                return React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-3.5 py-2.5 rounded-2xl mb-2`, style: { backgroundColor: colors.primary + "0d" } },
                    React.createElement(Info, { size: 14, color: colors.primary, className: "shrink-0" }),
                    React.createElement("span", { className: `flex-1 ${textStart()} text-[11px] font-bold leading-relaxed`, style: { color: colors.primary } },
                        me ? tl("القرابات محسوبةٌ منك (" + me.local_name + ")", "Relations are shown from you (" + me.local_name + ")")
                           : tl((owner ? "هذه شجرة " + owner.local_name + ". " : "") + "من أنت فيها؟ اختر نفسك لتظهر القرابات منك.", "Who are you in this tree? Pick yourself to see relations from you.")),
                    React.createElement("button", { onClick: () => setPickingMe(true), className: "shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-extrabold", style: { backgroundColor: colors.primary, color: "#fff" } }, me ? tl("تغيير", "Change") : tl("هذا أنا", "That's me")));
            })(),
            pickingMe && React.createElement(FamSheet, { title: tl("من أنت في هذه الشجرة؟", "Who are you in this tree?"), onClose: () => setPickingMe(false) },
                React.createElement("p", { className: `text-[11.5px] mb-2 ${textStart()}`, style: { color: colors.textMuted } }, tl("اختيارك يبقى على جهازك ويغيّر طريقة عرض القرابات لك وحدك.", "Your choice stays on your device and only changes how relations are shown to you.")),
                persons.filter((p) => p.alive !== false).slice().sort((a, b) => a.local_name.localeCompare(b.local_name, "ar")).map((p) => React.createElement("button", { key: p.id, onClick: () => { onPickMe(p.id); setPickingMe(false); }, className: `w-full flex ${rowStart()} items-center gap-3 py-2.5 ${textStart()}`, style: { borderBottom: `1px solid ${colors.border}`, background: "none" } },
                    React.createElement(FamAvatar, { name: p.local_name, photo: p.photo, size: 34 }),
                    React.createElement("span", { className: "flex-1 text-[13.5px] font-bold", style: { color: colors.text } }, p.local_name),
                    p.id === meId && React.createElement(Check, { size: 16, color: colors.primary }))),
                meId && React.createElement("button", { onClick: () => { onPickMe(null); setPickingMe(false); }, className: "w-full mt-3 text-[12px] font-bold py-2", style: { color: colors.danger, background: "none" } }, tl("إلغاء الاختيار (عرض القرابات كما يراها صاحب الشجرة)", "Clear (show the owner's view)"))),
            unlinkedCount > 0 && !selectionMode && (React.createElement("button", { onClick: onOpenTree, className: `w-full flex ${rowStart()} items-center gap-2 px-3.5 py-2.5 rounded-2xl mb-2`, style: { backgroundColor: famTone("warn", isDark).bg } },
                React.createElement(GitBranch, { size: 14, color: colors.accent }),
                React.createElement("span", { className: `flex-1 ${textStart()} text-[11px] font-bold`, style: { color: colors.accent } },
                    (isRTL() ? arCountFix : (x) => x)(unlinkedCount + t("fg_bla_alaqa"))),
                React.createElement(ChevronLeft, { size: 13, color: colors.accent, style: { transform: "scaleX(-1)" } }))),
            !selectionMode && sortedPersons.length > 0 && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-2.5 px-0.5` },
                React.createElement("p", { className: `text-[11px] font-bold flex-1 ${textStart()}`, style: { color: colors.textMuted } }, (filterProximity !== "all" || filterStatus !== "all" || searchQuery.trim())
                    ? t("mn_length_length", { shown: filteredPersons.length, total: persons.length })
                    : t("qryb_length", { length: persons.length })),
                canEdit && React.createElement("button", { "aria-label": t("idafa_sryaa_nsb"), title: t("idafa_sryaa_nsb"), onClick: () => setShowChainAdd(true), className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.card, boxShadow: famShadow(isDark) } },
                    React.createElement(GitBranch, { size: 14, color: colors.primary })),
                React.createElement("button", { "aria-label": t("tsdyr"), title: t("tsdyr"), onClick: () => onExportSelected === null || onExportSelected === void 0 ? void 0 : onExportSelected(sortedPersons), className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.card, boxShadow: famShadow(isDark) } },
                    React.createElement(Download, { size: 14, color: colors.primary })),
                // ⛔ الصيانة للمحرِّر وحده: كان زرّا الإصلاح يظهران لمن دوره «مشاهدة فقط»
                // فيعدّل الشجرة وهو لا يملك التعديل.
                canEdit && (persons.length >= 2 || treeFixCount > 0) && (React.createElement("button", { "aria-label": t("fg_adwat_alshjra"), title: t("fg_adwat_alshjra"), onClick: () => setShowTools(true), className: "w-8 h-8 rounded-full flex items-center justify-center relative", style: { backgroundColor: colors.card, boxShadow: famShadow(isDark) } },
                    React.createElement(SettingsIcon, { size: 14, color: colors.primary }),
                    treeFixCount > 0 && (React.createElement("span", { className: "absolute -top-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white", style: { insetInlineEnd: -4, backgroundColor: colors.accent } }, treeFixCount.toLocaleString(loc()))))),
                React.createElement("button", { onClick: () => setSelectedIds(sortedPersons.length ? [sortedPersons[0].id] : []), className: `h-8 flex ${rowStart()} items-center gap-1 text-[11px] font-bold px-3 rounded-full`, style: { backgroundColor: colors.card, color: colors.primary, boxShadow: famShadow(isDark) } },
                    React.createElement(CheckCheck, { size: 13, color: colors.primary }),
                    t("thdyd")))),
            persons.length === 0 && React.createElement("div", { className: "mt-4" },
                React.createElement(FamCard, { className: "text-center", style: { padding: 24 } },
                    React.createElement("div", { className: "mx-auto mb-3 rounded-full flex items-center justify-center", style: { width: 64, height: 64, background: famGrad(colors) } },
                        React.createElement(Users, { size: 30, color: "#fff" })),
                    React.createElement("h2", { className: "text-[16px] font-extrabold mb-1.5", style: { color: colors.text } }, t("albdaya_bmn_ttwasl")),
                    React.createElement("p", { className: "text-[11.5px] mb-4 leading-relaxed", style: { color: colors.textMuted } },
                        t("adf_khmsa_aw_sta")),
                    React.createElement(FamButton, { icon: UserPlus, label: t("idafa_awl_qryb"), onPress: function () { setShowAddForm(true); } })),
                React.createElement(FamCard, null,
                    React.createElement("p", { className: `text-[12px] font-extrabold mb-1 ${textStart()}`, style: { color: colors.text } }, t("andk_shjra_nsb_jahza")),
                    React.createElement("p", { className: `text-[11px] mb-3 leading-relaxed ${textStart()}`, style: { color: colors.textMuted } },
                        t("ft_aktb_slsltk")),
                    React.createElement(FamButton, { variant: "soft", icon: GitBranch, label: t("adf_slsla_nsb"), onPress: function () { setShowChainAdd(true); } }))),
            persons.length > 0 && filteredPersons.length === 0 && React.createElement(EmptyState, { icon: Search, label: t("la_twjd_ntayj_mtabqa") }),
            sortedPersons.slice(0, listN).map((p) => {
                var _a;
                const fav = (_a = favorites[p.id]) !== null && _a !== void 0 ? _a : p.favorite;
                const showContact = p.alive && p.proximity && !hasNoProximityPerson(p);
                const overdue = showContact && isContactOverdue(p);
                return (React.createElement(FamCard, { key: p.id, className: `flex ${rowStart()} items-center flex-wrap`, style: selectedIds.includes(p.id) ? { boxShadow: `0 0 0 2px ${colors.primary}, ${famShadow(isDark)}` } : undefined },
                    selectionMode && (React.createElement("button", { onClick: () => toggleSelect(p.id), className: `${ms("2")} shrink-0`, "aria-label": t("thdyd") },
                        React.createElement("span", { className: "w-5 h-5 rounded-full flex items-center justify-center border-2", style: { borderColor: selectedIds.includes(p.id) ? colors.primary : colors.border, backgroundColor: selectedIds.includes(p.id) ? colors.primary : "transparent" } }, selectedIds.includes(p.id) && React.createElement(Check, { size: 11, color: "#fff" })))),
                    React.createElement("button", { onClick: () => {
                            // بعد الضغط المطوّل يُطلق المتصفح onClick أيضاً — نتجاهله
                            // مرة واحدة وإلا أُلغي التحديد فور إنشائه.
                            if (longPressRef.current) {
                                longPressRef.current = false;
                                return;
                            }
                            if (selectionMode)
                                toggleSelect(p.id);
                            else
                                onOpenPerson(p);
                        }, onContextMenu: (e) => { e.preventDefault(); longPressRef.current = true; toggleSelect(p.id); }, 
                        // ضغط مطوّل: مؤقّت يبدأ عند اللمس ويُلغى عند الرفع أو التمرير
                        // الفعلي. نستخدم خصائص React مباشرة لا addEventListener،
                        // لأن الأخير لم يكن يلتقط الأحداث بثبات على كل الأجهزة.
                        onPointerDown: (e) => {
                            if (e.pointerType === "mouse" && e.button !== 0)
                                return;
                            pressPos.current = { x: e.clientX, y: e.clientY };
                            clearTimeout(pressTimer.current);
                            pressTimer.current = setTimeout(() => {
                                longPressRef.current = true;
                                toggleSelect(p.id);
                            }, 450);
                        }, onPointerUp: () => clearTimeout(pressTimer.current), onPointerCancel: () => clearTimeout(pressTimer.current), onPointerLeave: () => clearTimeout(pressTimer.current), onPointerMove: (e) => {
                            const s = pressPos.current;
                            if (!s)
                                return;
                            if (Math.abs(e.clientX - s.x) > 14 || Math.abs(e.clientY - s.y) > 14) {
                                clearTimeout(pressTimer.current);
                            }
                        }, className: `flex-1 min-w-0 flex ${rowStart()} items-center gap-3 ${textStart()}` },
                        React.createElement(FamAvatar, { name: p.local_name, photo: p.photo, size: 48, gray: !p.alive }),
                        React.createElement("div", { className: "flex-1 min-w-0" },
                            React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 flex-wrap` },
                                React.createElement("span", { className: "font-extrabold text-[14.5px]", style: { color: colors.text } }, p.local_name),
                                // C106: مربوطٌ بحساب سوا
                                p.acctUid && React.createElement("span", { title: tl("في سوا", "On Sawa"), className: "text-[10px] font-extrabold rounded-full px-1.5 py-0.5", style: { backgroundColor: "#E3F4EC", color: "#0F7A55" } }, p.acctMe ? tl("أنت", "You") : tl("سوا ✓", "Sawa ✓")),
                                p.alive && p.proximity && !hasNoProximityPerson(p) && React.createElement(FamChip, { tone: isContactOverdue(p) ? "danger" : "muted", label: t("kl_n_ywm", { n: proximityContactDays[p.proximity] || 30 }) })),
                            React.createElement("div", { className: "text-[12px] mt-0.5", style: { color: colors.textMuted } },
                                personKinLabel(p),
                                personKinAlso(p).length ? " · " + personKinAlso(p).join(" · ") : "",
                                !p.alive ? t("fg_mtwfa") : ""),
                            p.status_detail && p.alive && React.createElement("div", { className: "mt-1.5" },
                                React.createElement(FamChip, { tone: "warn", icon: AlertCircle, label: statusLabels[p.status_detail] })))),
                    canEdit && React.createElement("button", { "aria-label": t("idafa_aqarb"), onClick: () => setBulkFor(p), className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primary + "12" } },
                        React.createElement(UserPlus, { size: 16, color: colors.primary })),
                    React.createElement("button", { "aria-label": t("almfdla"), onClick: () => onToggleFav(p.id), className: `w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${ms("1")}`, style: { backgroundColor: fav ? colors.accent + "18" : "transparent" } },
                        React.createElement(Star, { size: 18, color: fav ? colors.accent : colors.textMuted, fill: fav ? colors.accent : "none" })),
                    // سطرٌ مستقلّ بعرض البطاقة: «آخر تواصل» (أحمر إن حان الوقت) + «✓ تواصلت» بضغطةٍ واحدة
                    // (يسجّل تاريخ اليوم ويتزامن بين أجهزتك). مستقلّ حتّى لا يضيّق الاسم وصلة القرابة.
                    showContact && React.createElement("div", { className: `basis-full flex ${rowStart()} items-center justify-between mt-3 pt-2.5`, style: { borderTop: `1px solid ${colors.border}` } },
                        React.createElement("span", { className: `flex ${rowStart()} items-center gap-1 text-[12px] font-bold`, style: { color: overdue ? colors.danger : colors.textMuted } }, React.createElement(Clock, { size: 12 }), contactAgoLabel(p.lastContactDate)),
                        !selectionMode && onMarkContactBulk && canEdit && React.createElement("button", { "aria-label": t("twaslt"), onClick: () => onMarkContactBulk([p.id]), className: "shrink-0 flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold", style: overdue ? { background: famGrad(colors), color: "#fff", boxShadow: `0 4px 10px ${colors.primary}40` } : { backgroundColor: colors.primary + "12", color: colors.primary } },
                            React.createElement(Check, { size: 14, color: overdue ? "#fff" : colors.primary }),
                            t("twaslt")))));
            })),
        React.createElement("div", { className: `absolute left-3 right-3 flex ${rowStart()} rounded-[22px] px-1 py-1.5`, style: { bottom: 10, backgroundColor: colors.card, boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(30,41,59,0.14)", zIndex: 15 } }, [
            { key: "tree", icon: GitBranch, label: t("alshjra"), onPress: onOpenTree },
            { key: "suggestions", icon: Lightbulb, label: t("aqtrahat"), onPress: onOpenSuggestions },
            { key: "schedules", icon: Clock, label: t("mwaayd"), onPress: onOpenSchedules },
            { key: "events", icon: Calendar, label: t("ahdath_2"), onPress: onOpenEvents },
            { key: "members", icon: UsersRound, label: t("ft_aada"), onPress: onOpenMembers },
        ].map((item) => (React.createElement("button", { key: item.key, onClick: item.onPress, className: "flex-1 flex flex-col items-center py-1 gap-0.5" },
            React.createElement("span", { className: "w-8 h-8 rounded-xl flex items-center justify-center", style: { backgroundColor: item.key === "tree" ? colors.primary + "14" : "transparent" } }, React.createElement(item.icon, { size: 17, color: item.key === "tree" ? colors.primary : colors.textMuted })),
            React.createElement("span", { className: "text-[9.5px] font-bold", style: { color: item.key === "tree" ? colors.primary : colors.textMuted } }, item.label)))))));
}
function FamilyPersonDetailScreen({ onChangeParent, person, persons = [], relations = [], favorites, otherGroups = [], linkedGroupName, linkedPersonName, canEdit = true, onToggleFav, onEdit, onDelete, onOpenLinkedPerson, onSimulateProximity, onMarkContact, onCreateInLaws, onClearFacts, onBack, }) {
    var _a, _b, _c;
    const { colors, isDark } = useTheme();
    const [showEditForm, setShowEditForm] = useState(false);
    const [changingParentD, setChangingParentD] = useState(null);   // C79
    // لا نحمّل النصوص إلا لمتوفّى: لا طلب شبكة في بطاقة حيّ
    const [duaa, setDuaa] = useState(DUAA_FALLBACK);
    React.useEffect(() => {
        if (person && person.alive === false)
            loadDuaa().then(setDuaa);
    }, [person && person.id, person && person.alive]);
    const [simulated, setSimulated] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
    const fav = (_a = favorites[person.id]) !== null && _a !== void 0 ? _a : person.favorite;
    const birthdayLabel = (() => { if (!person.birthday) return null; const [bm, bd] = String(person.birthday).split("-").map(Number); if (!(bm >= 1 && bm <= 12 && bd >= 1 && bd <= 31)) return null; return new Date(new Date().getFullYear(), bm - 1, bd).toLocaleDateString(loc(), { day: "numeric", month: "long" }); })();   // C33: تاريخٌ محلّيّ لا UTC
    const age = (() => {
        if (!person.birthYear)
            return null;
        const today = new Date();
        let calculated = today.getFullYear() - person.birthYear;
        if (person.birthday) {
            const [bMonth, bDay] = person.birthday.split("-").map(Number);
            const hasHadBirthdayThisYear = today.getMonth() + 1 > bMonth || (today.getMonth() + 1 === bMonth && today.getDate() >= bDay);
            if (!hasHadBirthdayThisYear)
                calculated -= 1;
        }
        return calculated;
    })();
    const locationTypeLabels = { home: t("fp_almnzl"), work: t("fp_alaml") };
    // C34: النمط الحديث — رأس متدرّج تعلوه بطاقة تعريف بصورةٍ كبيرة وأزرار إجراءٍ دائريّة
    const phoneStr = person.contacts && person.contacts.phone ? String(person.contacts.phone) : "";
    const derived = (() => {
        // القرابة المحسوبة من الشجرة لا من الحقل المخزَّن: الحقل
        // يقول «أخرى» أو «الجد»، وهذا يقول «ابن عمّك» فعلاً.
        const selfP = persons.find(isSelfPerson);
        if (!selfP || selfP.id === person.id) return null;
        const d = describeKinship(selfP.id, person.id, persons, relations);
        return d ? `${t("kin_qraba")}: ${d}` : t("kin_ghyr_maarwfa");
    })();
    const overdueP = person.alive && person.proximity && !hasNoProximityPerson(person) && isContactOverdue(person);
    const share = async () => {
        const text = `${person.local_name}${person.kinship ? " — " + personKinLabel(person) : ""}${phoneStr ? "\n" + t("fp_share_phone", { phone: phoneStr }) : ""}`;
        if (navigator.share) {
            try { await navigator.share({ text }); } catch (err) { /* المستخدم ألغى المشاركة */ }
        }
        else { await copyText(text); setShareCopied(true); setTimeout(() => setShareCopied(false), 1500); }
    };
    const kv = (label, value, Icon) => React.createElement(FamCard, { className: "flex-1 min-w-0", style: { marginBottom: 0, padding: 12 } },
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-1 text-[10.5px] font-bold mb-1`, style: { color: colors.textMuted } }, Icon && React.createElement(Icon, { size: 11 }), label),
        React.createElement("div", { className: `text-[13px] font-extrabold truncate ${textStart()}`, style: { color: colors.text } }, value));
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(FamHeader, { title: person.local_name, subtitle: personKinLabel(person) + (!person.alive ? t("fg_mtwfa") : ""), onBack: onBack, compact: true },
            React.createElement("div", { style: { height: 30 } })),
        showEditForm && (React.createElement(FamilyPersonFormSheet, { person: person, persons: persons, relations: relations, otherGroups: otherGroups, onSave: (data) => onEdit(person.id, data), onDelete: () => onDelete(person.id), onClose: () => setShowEditForm(false) })),
        React.createElement("div", { className: "flex-1 overflow-y-auto px-4 pb-6", style: { backgroundColor: "transparent", marginTop: -46 } },
            React.createElement(FamCard, { className: "text-center", style: { padding: 18, paddingTop: 18 } },
                React.createElement("div", { className: "flex flex-col items-center" },
                    React.createElement(FamAvatar, { name: person.local_name, photo: person.photo, size: 92, radius: 30, gray: !person.alive, style: { boxShadow: "0 8px 20px rgba(30,41,59,0.18)" } }),
                    React.createElement("span", { className: "text-[19px] font-extrabold mt-3", style: { color: colors.text } }, person.local_name),
                    React.createElement("span", { className: "text-[12.5px] mt-0.5", style: { color: colors.textMuted } }, personKinLabel(person)),
                    personKinAlso(person).length > 0 && React.createElement("span", { className: "text-[11.5px] mt-0.5 font-bold", style: { color: colors.primary } }, tl("وأيضاً: ", "Also: ") + personKinAlso(person).join(" · ")),
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-center gap-1.5 mt-2.5 flex-wrap` },
                        derived && React.createElement(FamChip, { tone: "info", label: derived }),
                        person.acctUid && React.createElement(FamChip, { tone: "ok", label: person.acctMe ? tl("هذا أنت · حسابك مربوط", "This is you · linked") : tl("✓ في سوا", "✓ On Sawa") }),   // C106
                        !person.alive && React.createElement(FamChip, { tone: "muted", icon: Flower2, label: t("fg_mtwfa").replace(/^[\s·]+/, "") }),
                        person.alive && person.proximity && !hasNoProximityPerson(person) && React.createElement(FamChip, { tone: overdueP ? "danger" : "ok", icon: Clock, label: contactAgoLabel(person.lastContactDate) }),
                        person.status_detail && person.alive && React.createElement(FamChip, { tone: "warn", icon: AlertCircle, label: statusLabels[person.status_detail] })),
                    React.createElement("div", { className: `flex ${rowStart()} items-start justify-center gap-5 mt-4` },
                        React.createElement(FamAction, { icon: Phone, label: tl("اتّصال", "Call"), bg: "#22C55E", href: phoneStr && person.alive ? "tel:" + phoneStr.replace(/[^\d+]/g, "") : undefined, onPress: phoneStr && person.alive ? () => { try { onMarkContact(person.id); } catch (e) { } } : undefined }),
                        React.createElement(FamAction, { icon: Star, label: fav ? t("fp_mfdl") : tl("مفضّلة", "Favorite"), bg: fav ? colors.accent : "#9CA3AF", onPress: () => onToggleFav(person.id) }),
                        canEdit && React.createElement(FamAction, { icon: Edit2, label: t("tadyl"), bg: "#F59E0B", onPress: () => setShowEditForm(true) }),
                        React.createElement(FamAction, { icon: Share2, label: shareCopied ? t("fp_tm_alnskh") : t("fp_msharka"), bg: colors.primary, onPress: share })))),
            // C106: قريبٌ ربط حسابه في سوا ⇒ رسالة واتّصال وفيديو داخل سوا مباشرةً
            person.acctUid && !person.acctMe && person.alive !== false && React.createElement(FamCard, { style: { padding: 14 } },
                React.createElement("p", { className: `text-[12px] font-extrabold mb-3 ${textStart()}`, style: { color: colors.text } }, tl("تواصل عبر سوا", "Reach on Sawa")),
                React.createElement("div", { className: `flex ${rowStart()} items-start justify-center gap-6` },
                    React.createElement(FamAction, { icon: MessageCircle, label: tl("رسالة", "Message"), bg: colors.primary, onPress: () => { try { onMarkContact && onMarkContact(person.id); } catch (e) { } window.__sawaFamContact && window.__sawaFamContact(person.acctUid, person.local_name, "msg"); } }),
                    React.createElement(FamAction, { icon: Phone, label: tl("اتّصال سوا", "Sawa call"), bg: "#16A34A", onPress: () => { try { onMarkContact && onMarkContact(person.id); } catch (e) { } window.__sawaFamContact && window.__sawaFamContact(person.acctUid, person.local_name, "audio"); } }),
                    React.createElement(FamAction, { icon: Video, label: tl("فيديو", "Video"), bg: "#7C3AED", onPress: () => { try { onMarkContact && onMarkContact(person.id); } catch (e) { } window.__sawaFamContact && window.__sawaFamContact(person.acctUid, person.local_name, "video"); } }))),
            // C106: لم يُربط بعد وأنا لم أربط نفسي ⇒ «هذا أنا»
            !person.acctUid && person.alive !== false && person._gid && window.SawaSync && window.SawaSync.isCloud && window.SawaSync.isCloud(person._gid) && !(persons || []).some((x) => x.acctMe) && React.createElement(FamCard, { style: { paddingTop: 2, paddingBottom: 2 } },
                React.createElement(FamRow, { icon: UserCheck, last: true, title: tl("هذا أنا — اربط حسابي بهذا الشخص", "This is me — link my account"), sub: tl("تظهر القرابات منك، ويراسلك أقاربك ويتّصلون بك من الشجرة", "Relations show from you, and relatives can message or call you from the tree"), onPress: () => window.__sawaFamClaim && window.__sawaFamClaim(person._gid, person.id) })),
            (birthdayLabel || age !== null) && React.createElement("div", { className: `flex ${rowStart()} gap-2.5 mb-2.5` },
                birthdayLabel && kv(tl("عيد الميلاد", "Birthday"), birthdayLabel, Cake),
                age !== null && kv(tl("العمر", "Age"), tl(age.toLocaleString(loc()) + " سنة", String(age)), Calendar),
                person.birthYear && kv(tl("سنة الميلاد", "Born"), String(person.birthYear), Calendar)),
            linkedGroupName && React.createElement(FamCard, { style: { paddingTop: 2, paddingBottom: 2 } },
                React.createElement(FamRow, { icon: LinkIcon, last: true, onPress: onOpenLinkedPerson, title: t("fp_nfs") + (linkedPersonName || t("fp_shkhs")) + t("fp_bmjmwaa") + linkedGroupName, sub: t("fp_almtzamnwn") })),
            // C79: الأب والأمّ — عرضٌ وتغيير
            onChangeParent && (() => {
                const rowsP = ["male", "female"].map((g) => {
                    const cur = relations.find((x) => x.type === "parent" && x.target === person.id && ((persons.find((pp) => pp.id === x.source) || {}).gender === "female") === (g === "female"));
                    const curP = cur && persons.find((pp) => pp.id === cur.source);
                    return React.createElement(FamRow, { key: "pp-" + g, icon: RotateCcw, last: g === "female", title: (g === "female" ? tl("الأم: ", "Mother: ") : tl("الأب: ", "Father: ")) + (curP ? curP.local_name : tl("غير مسجَّل", "not set")), sub: curP ? tl("اضغط للتغيير أو الإزالة", "Tap to change or remove") : tl("اضغط لاختيار شخصٍ من الشجرة", "Tap to pick someone from the tree"), onPress: () => setChangingParentD(g) });
                });
                return React.createElement(FamCard, { style: { paddingTop: 2, paddingBottom: 2 } }, rowsP);
            })(),
            changingParentD && React.createElement(ChangeParentSheet, { persons: persons, relations: relations, child: person, gender: changingParentD, onPick: (pid) => onChangeParent(person.id, changingParentD, pid), onClose: () => setChangingParentD(null) }),
            // C74: الأصهار لمن دخل العائلة بالزواج فقط (زوجة/زوج، زوجة الابن، زوج البنت…) — كانت تظهر على الأخ الشقيق،
            //      وعائلة أخيك هي عائلتك. والنصّ بحسب الجنس.
            !linkedGroupName && person.alive && canEdit && onCreateInLaws && /زوج/.test(person.kinship || "") && React.createElement(FamCard, { style: { paddingTop: 2, paddingBottom: 2 } },
                React.createElement(FamRow, { icon: Users2, tone: "warn", last: true, onPress: () => onCreateInLaws(person),
                    title: person.gender === "female" ? tl("إضافة عائلتها (الأصهار)", "Add her family (in-laws)") : tl("إضافة عائلته (الأصهار)", "Add his family (in-laws)"),
                    sub: person.gender === "female" ? tl("مجموعة مستقلة لوالدها وإخوتها وأسلافها — تبقى صلة الرحم شاملة للطرفين", "A separate group for her father, siblings and ancestors") : t("mjmwaa_mstqla_lwaldh_wikhwth") })),
            (person.noChildren || person.neverMarried) && (React.createElement(FamCard, { className: `flex ${rowStart()} items-start gap-2` },
                React.createElement(Info, { size: 15, color: colors.textMuted, className: "mt-0.5 shrink-0" }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("p", { className: "text-[11px] font-bold mb-0.5", style: { color: colors.text } }, t("malwmat_mwkda")),
                    person.neverMarried && (React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("lm_ytzwj_ln_ysal"))),
                    person.noChildren && (React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("bla_abna_ln_ysal")))),
                canEdit && (React.createElement("button", { onClick: () => onClearFacts === null || onClearFacts === void 0 ? void 0 : onClearFacts(person.id), className: "text-[10px] font-bold shrink-0", style: { color: colors.primary } }, t("traja"))))),
            !person.alive && (React.createElement(FamCard, { className: `flex ${rowStart()} items-center gap-2` },
                React.createElement(Flower2, { size: 18, color: colors.textMuted }),
                React.createElement("span", { className: "text-sm", style: { color: colors.textMuted } },
                    t("fp_twfy_btarykh"),
                    person.death_date))),
            // نصّ الدعاء يبقى عربياً في الواجهتين: الصيغة الدينية تُنقل
            // ولا تُترجَم. المترجَم عنوانها وحده.
            !person.alive && (React.createElement(FamCard, { className: textStart(), style: { background: isDark ? colors.card : `linear-gradient(160deg, ${colors.primary}10, ${colors.card} 60%)` } },
                React.createElement("div", { className: "text-[11px] font-bold mb-2", style: { color: colors.textMuted } }, t("du_title")),
                React.createElement("p", { dir: "rtl", className: "text-base leading-8 font-bold", style: { color: colors.text } }, duaaForPerson(person, duaa)),
                React.createElement("div", { className: "text-[10px] font-bold mt-3 mb-1", style: { color: colors.textMuted } }, t("du_general")),
                React.createElement("p", { dir: "rtl", className: "text-sm leading-7", style: { color: colors.textMuted } }, ((duaa && duaa.general) || DUAA_FALLBACK.general)[0]))),
            ((_b = person.contacts) === null || _b === void 0 ? void 0 : _b.phone) && (React.createElement(FamCard, { className: `flex ${rowStart()} items-center gap-3` },
                React.createElement("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style: { backgroundColor: "#22C55E18" } }, React.createElement(Phone, { size: 17, color: "#16a34a" })),
                React.createElement("div", { className: `flex-1 min-w-0 ${textStart()}` },
                    React.createElement("div", { className: "text-[10.5px] font-bold", style: { color: colors.textMuted } }, t("altwasl")),
                    React.createElement("div", { dir: "ltr", className: `text-[14px] font-extrabold ${textStart()}`, style: { color: colors.text } }, person.contacts.phone)),
                React.createElement("button", { "aria-label": t("nskh"), onClick: () => {
                        copyText(person.contacts.phone).then(() => { setCopiedPhone("success"); setTimeout(() => setCopiedPhone(false), 1500); }, () => { setCopiedPhone("failed"); setTimeout(() => setCopiedPhone(false), 1500); });
                    }, className: `shrink-0 flex ${rowStart()} items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold`, style: { backgroundColor: colors.bg, color: copiedPhone === "failed" ? colors.danger : colors.primary } },
                    React.createElement(Copy, { size: 12 }),
                    copiedPhone === "success" ? t("fp_tm_alnskh") : copiedPhone === "failed" ? t("fp_tadhr_alnskh") : t("fp_nskh_alrqm")))),
            // C37: منزله — المسافة من آخر موقعٍ معروف لي، وفتح في الخرائط، وتحديده إن لم يكن
            (() => {
                const h = homeOf(person);
                let last = null; try { last = JSON.parse(localStorage.getItem("sawa_lastpos") || "null"); } catch (e) { }
                const d = h && last && geoValid(Number(last.lat), Number(last.lng)) ? geoDist(last, h) : null;
                if (!h) return canEdit && person.alive ? React.createElement(FamCard, { style: { paddingTop: 2, paddingBottom: 2 } },
                    React.createElement(FamRow, { icon: MapPin, title: tl("حدّد منزله", "Set home location"), sub: tl("لتنبيهك حين تمرّ قربه — فرصة زيارةٍ أو اتّصال", "Get alerted when you pass nearby"), last: true, onPress: () => setShowEditForm(true) })) : null;
                const url = window.SawaChat && window.SawaChat.mapsUrl ? window.SawaChat.mapsUrl(h.lat, h.lng) : `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`;
                return React.createElement(FamCard, { className: `flex ${rowStart()} items-center gap-3` },
                    React.createElement("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style: { backgroundColor: "#22C55E18" } }, React.createElement(MapPin, { size: 17, color: "#16a34a" })),
                    React.createElement("div", { className: `flex-1 min-w-0 ${textStart()}` },
                        React.createElement("div", { className: "text-[10.5px] font-bold", style: { color: colors.textMuted } }, tl("منزله", "Home")),
                        React.createElement("div", { className: "text-[13px] font-extrabold truncate", style: { color: colors.text } }, h.label || tl("موقعٌ محدَّد", "Location set")),
                        React.createElement("div", { className: "text-[11px] mt-0.5", style: { color: colors.textMuted } }, d !== null ? tl("على بعد " + fmtDist(d) + " من آخر موقعٍ لك", fmtDist(d) + " from your last location") : tl("التنبيه ضمن " + fmtDist(h.radius), "Alert within " + fmtDist(h.radius)))),
                    React.createElement("a", { href: url, target: "_blank", rel: "noopener", className: `shrink-0 flex ${rowStart()} items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold`, style: { backgroundColor: colors.bg, color: colors.primary } }, React.createElement(Navigation, { size: 12 }), tl("الخرائط", "Maps")));
            })(),
            person.notes && (React.createElement(FamCard, null,
                React.createElement("div", { className: `font-bold mb-1 text-[12.5px] ${textStart()}`, style: { color: colors.text } }, t("mlahzat")),
                React.createElement("p", { className: `text-[12px] leading-relaxed ${textStart()}`, style: { color: colors.textMuted } }, person.notes))))));
}
const KINSHIP_RELATION_TYPES = [
    { key: "parent", labelKey: "rel_parent" },
    { key: "child", labelKey: "rel_child" }, // عكس منطقي لـ"parent" — نفس نوع العلاقة بالتخزين، بس بالاتجاه المعاكس
    { key: "sibling", labelKey: "rel_sibling" },
    { key: "spouse", labelKey: "rel_spouse" },
    { key: "ex_spouse", labelKey: "rel_ex_spouse" }, // يوثّق زواجاً منتهياً بطلاق دون حذف السجل — أبناء هذا الزواج يبقون مرتبطين صحيحاً بالشجرة
];
// يحوّل نوع العلاقة المختار من الواجهة لصيغة التخزين الفعلية (parent/sibling/spouse
// بس)، مع عكس source/target تلقائياً لو اختار المستخدم "ابن/بنت لِـ"
function resolveRelationEdge(sourceId, targetId, relType) {
    if (relType === "child")
        return { source: targetId, target: sourceId, type: "parent" };
    return { source: sourceId, target: targetId, type: relType };
}
function FamilyStatsScreen({ persons, relations, onBack }) {
    const { colors } = useTheme();
    const aliveCount = persons.filter((p) => p.alive).length;
    const deceasedCount = persons.length - aliveCount;
    // توزيع الأجيال — نفس منطق حساب العمق المستخدم بالشجرة (أب/ابن + أخوّة/زواج لنفس المستوى)
    const parentEdges = relations.filter((r) => r.type === "parent").map((r) => ({ parent: r.source, child: r.target }));
    const sameLevelEdges = relations.filter((r) => r.type === "sibling" || r.type === "spouse" || r.type === "ex_spouse").map((r) => [r.source, r.target]);
    const depth = {};
    for (let i = 0; i < persons.length + 2; i++) {
        let changed = false;
        parentEdges.forEach(({ parent, child }) => {
            var _a;
            const d = ((_a = depth[parent]) !== null && _a !== void 0 ? _a : 0) + 1;
            if (depth[child] === undefined || depth[child] < d) {
                depth[child] = d;
                changed = true;
            }
        });
        sameLevelEdges.forEach(([a, b]) => {
            if (depth[a] !== undefined && depth[b] === undefined) {
                depth[b] = depth[a];
                changed = true;
            }
            else if (depth[b] !== undefined && depth[a] === undefined) {
                depth[a] = depth[b];
                changed = true;
            }
        });
        if (!changed)
            break;
    }
    persons.forEach((p) => { if (depth[p.id] === undefined)
        depth[p.id] = 0; });
    const min = Math.min(0, ...persons.map((p) => depth[p.id]));
    const genCounts = {};
    persons.forEach((p) => { const g = depth[p.id] - min; genCounts[g] = (genCounts[g] || 0) + 1; });
    const genLabels = [t("ft_gen_1"), t("ft_gen_2"), t("ft_gen_3"), t("ft_gen_4"), t("ft_gen_5")];
    // أطول شخص بدون تواصل (حي، عنده تاريخ تواصل مسجَّل)
    const withContact = persons.filter((p) => p.alive && p.lastContactDate);
    const longestNoContact = withContact.length > 0
        ? withContact.reduce((max, p) => (p.lastContactDate < max.lastContactDate ? p : max))
        : null;
    const daysSinceLongest = longestNoContact ? Math.floor((Date.now() - longestNoContact.lastContactDate) / (1000 * 60 * 60 * 24)) : 0;
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(FamHeader, { compact: true, title: t("ihsayyat_alaayla"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` },
                React.createElement(FamCard,