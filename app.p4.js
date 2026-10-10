function FamilySuggestionsScreen({ groupId, persons, relations, events, dismissed, onDismiss, onExecute, onQuickStatus, onOpenAddWithPreset, onOpenBulkAdd, onSetAlive, onConfirmNone, onBack, onOpenFamily, onStartSelf, }) {
    const { colors } = useTheme();
    const [simulateOccasion, setSimulateOccasion] = useState(false);
    const suggestions = [];
    events.filter((e) => e.groupId === groupId).forEach((e) => {
        var _a;
        const action = eventSuggestedActionLabel(e.type) || t("mtabaa_2");
        const personName = (_a = persons.find((p) => p.id === e.personId)) === null || _a === void 0 ? void 0 : _a.local_name;
        suggestions.push({
            id: `sugg-${e.id}`,
            title: `${action}${personName ? " — " + personName : ""}`,
            reason: `${eventTypeLabel(e.type) || t("fs_hdth")}: ${e.title}`,
        });
    });
    // اقتراح مناسبة دينية جماعية — قبل يومين من عيد الفطر/الأضحى (أو محاكاة للاختبار)
    const upcomingOccasion = RELIGIOUS_OCCASIONS.find((occ) => {
        const daysUntil = Math.ceil((new Date(occ.date) - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 2;
    });
    if (upcomingOccasion || simulateOccasion) {
        const occ = upcomingOccasion || RELIGIOUS_OCCASIONS[0];
        suggestions.push({
            id: `sugg-occasion-${occ.key}`,
            title: t("habb_trsl_thnya_lkl", { label: t(occ.labelKey) }),
            reason: t("mnasba_dynya_qryba"),
        });
    }
    persons.forEach((p) => {
        if (isSelfPerson(p))
            return; // لا تهنئة ولا اطمئنان ولا تذكير موجَّه لصاحب الشجرة
        if (p.status_detail === "sick" && p.alive) {
            suggestions.push({ id: `sugg-${p.id}`, title: t("alatmynan_ala_mryd_halya", { local_name: p.local_name }), reason: t("hala_shya_tstday_mtabaa") });
        }
        // اقتراح عيد ميلاد قريب (خلال 7 أيام القادمة) — يقارن الشهر واليوم بس، بغض النظر عن السنة
        if (p.birthday && p.alive) {
            const [bMonth, bDay] = p.birthday.split("-").map(Number);
            const today = new Date();
            const thisYearBday = new Date(today.getFullYear(), bMonth - 1, bDay);
            if (thisYearBday < today)
                thisYearBday.setFullYear(today.getFullYear() + 1);
            const daysUntil = Math.ceil((thisYearBday - today) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7) {
                suggestions.push({
                    id: `sugg-bday-${p.id}`,
                    title: daysUntil === 0 ? t("ayd_mylad_alywm", { local_name: p.local_name }) : t("ayd_mylad_bad_ywm", { local_name: p.local_name, daysUntil }),
                    reason: t("la_tns_althnya"),
                });
            }
        }
        // ذكرى الوفاة السنوية — الميلادي وحده، والحقل نصّ حرّ فنقبل
        // YYYY-MM-DD فقط. من كُتب تاريخه ناقصاً لا ذكرى له، وبطاقته
        // تعرض الدعاء عند الفتح على كل حال.
        if (!p.alive && /^\d{4}-\d{2}-\d{2}$/.test(String(p.death_date || "").trim())) {
            const [, dMonth, dDay] = String(p.death_date).trim().split("-").map(Number);
            const now = new Date();
            if (now.getMonth() + 1 === dMonth && now.getDate() === dDay) {
                suggestions.push({
                    id: `sugg-duaa-${p.id}`,
                    title: t("du_anniv", { name: p.local_name }),
                    reason: t("du_anniv_reason"),
                });
            }
        }
        // اقتراح t("ma_twaslt_mn_mda") — حسب عتبة الأيام المسموحة لدرجة القرب
        if (p.alive && p.lastContactDate && p.proximity) {
            const daysSinceContact = Math.floor((Date.now() - p.lastContactDate) / (1000 * 60 * 60 * 24));
            const threshold = proximityContactDays[p.proximity] || 30;
            if (daysSinceContact > threshold) {
                suggestions.push({
                    id: `sugg-contact-${p.id}`,
                    title: t("ma_twaslt_ma_mn", { local_name: p.local_name, daysSinceContact }),
                    reason: t("fs_tjawzt_almda", { level: proximityLabels[p.proximity], days: threshold }),
                });
            }
        }
    });
    const visible = suggestions.filter((s) => !dismissed[s.id]);
    // استكمال شجرة العائلة — يكتشف الفجوات تلقائياً: قريب حي، مو نفسه "ابن"،
    // بلا حالة زواج معروفة، بلا أبناء مسجَّلين، أو بلا معلومة عن وضعه الحالي
    const groupRelations = relations.filter((r) => r.groupId === groupId);
    const hasSpouseInfo = new Set();
    const hasChildrenInfo = new Set();
    groupRelations.forEach((r) => {
        if (r.type === "spouse" || r.type === "ex_spouse") {
            hasSpouseInfo.add(r.source);
            hasSpouseInfo.add(r.target);
        }
        if (r.type === "parent")
            hasChildrenInfo.add(r.source);
    });
    // اسم العرض موحَّد مع بقية شاشات صلة الرحم — نسخة واحدة لا نسختان.
    // النسخة المحلّية كانت لا تفرّق الزواج المنتهي في الإنجليزية («wife» بلا «of»).
    const { distinctLabel: fullName } = buildLineageHelpers(persons, groupRelations);
    // عمق الجيل: 0 = صاحب الشجرة، 1 = الوالد، 2 = الجد، 3+ = الأسلاف.
    // ⛔ كانت تُعدّ الأصول فوق الشخص، فينقلب المعنى: صاحب الشجرة أكثر
    // الناس أصولاً مسجَّلة فيأخذ أكبر رقم («سلف بعيد»)، والجدّ الأعلى
    // يأخذ صفراً («أنت»). القياس يكون بالإزاحة عن صاحب الشجرة.
    const parentOfMap = {};
    groupRelations.filter((r) => r.type === "parent").forEach((r) => { parentOfMap[r.target] = r.source; });
    const selfAnchor = persons.find(isSelfPerson);
    const genDepth = buildGenDepth(parentOfMap, persons, selfAnchor && selfAnchor.id);
    // ⛔ مُعرِّفات قرابة تُطابَق مع p.kinship — لا تُترجَم (انظر kinshipLabel)
    const ANCESTOR_KINSHIPS = new Set([
        "الوالد", "الوالدة", "الجد", "الجدة", "الجد لأم", "الجدة لأم",
        "عم الوالد", "عمة الوالد", "خال الوالد", "خالة الوالد",
        "عم الوالدة", "عمة الوالدة", "خال الوالدة", "خالة الوالدة",
    ]);
    const gapQuestions = [];
    // ⛔ من له والدٌ مسجَّل من هذا الجنس. الشرط بالجنس لا بالوجود: من
    // سُجّلت أمُّه وحدها يبقى بلا أب — وهو ما لم يكن يُسأل عنه قطّ،
    // فبقيت السلسلة تمرّ بالأمّ ولا شيء يلفت النظر إلى النقص.
    const hasParentOfGender = (id, gender) => relations.some((r) => r.type === "parent"
        && r.target === id
        && (persons.find((x) => x.id === r.source) || {}).gender === gender);
    persons.forEach((p) => {
        if (p.kinship === "الابن" || p.kinship === "البنت")
            return; // الأبناء غالباً صغار
        const name = fullName(p);
        const she = p.gender === "female";
        // من هو سلف؟ من ينحدر منه أحد في الشجرة، أو صلته من صلات الأصول.
        const isAncestor = ANCESTOR_KINSHIPS.has(p.kinship) || Object.values(parentOfMap).includes(p.id);
        // "بعيد" = الجد فصاعداً — وجوده في الشجرة يعني بالضرورة أنه تزوّج وأنجب
        // كل سلف في الشجرة تزوّج وأنجب بالضرورة — وإلا ما وُجد من ينحدر منه.
        // يشمل ذلك الوالد والوالدة (عمق ١)، لا الجدّ فصاعداً فقط.
        const isDeepAncestor = isAncestor && (genDepth(p.id) >= 1
            || /الوالد|الوالدة|الجد|الجدة|عم الوالد|خال الوالد|عم الوالدة|خال الوالدة/.test(p.kinship)
            // من سُجِّل أباً لأحد في الشجرة فهو سلف يقيناً مهما كانت صلته
            || Object.values(parentOfMap).includes(p.id));
        // ── الأسلاف البعيدون: لا نسأل عن أمر معلوم بالضرورة ──
        if (isDeepAncestor) {
            // حالة الحياة تُفترض وفاته؛ نطلب التأكيد لا الاختيار من الصفر
            if (p.alive) {
                gapQuestions.push({ id: `gap-alive-${p.id}`, personId: p.id, kind: "alive", presumeDeceased: true,
                    question: t("fs_alghalb_mtwfa", { name, w: she ? t("fs_mtwfya") : t("fs_mtwfa") }) });
            }
            // زوجه موجود قطعاً؛ السؤال عن اسمه لا عن وجوده.
            // ونصوغه صراحةً كطلب اسم حتى لا يُقرأ كسؤال «هل تزوّج؟» —
            // وهو ما شكا منه المستخدمون: سؤال عن زواج من هو أب أو جد مسجَّل.
            if (!hasSpouseInfo.has(p.id)) {
                const childName = (() => {
                    var _a;
                    const kid = (_a = Object.entries(parentOfMap).find(([, par]) => par === p.id)) === null || _a === void 0 ? void 0 : _a[0];
                    const kp = kid ? persons.find((x) => x.id === kid) : null;
                    return kp ? kp.local_name : null;
                })();
                // openEnded: الجواب اسم يُكتب، لا نعم/لا — يحدّد نصّ زرّ الإضافة.
                // كان يُستنتج من بادئة السؤال («ما اسم» · «من هم» · «هل لـ»)
                // وهو ما كان سينكسر صامتاً عند ترجمة الشاشة.
                gapQuestions.push({ id: `gap-marriage-${p.id}`, personId: p.id, kind: "marriage", openEnded: true,
                    question: childName
                        ? t("fs_ma_asm_walid", { sp: she ? t("fs_zwj") : t("fs_zwja"), name, par: she ? t("fs_wald_n") : t("fs_walda_n"), childName })
                        : t("fs_ma_asm", { sp: she ? t("fs_zwj") : t("fs_zwja"), name }) });
            }
            // له أبناء قطعاً — نسأل عن الإخوة الآخرين لمن نعرفه
            if (!hasChildrenInfo.has(p.id)) {
                gapQuestions.push({ id: `gap-children-${p.id}`, personId: p.id, kind: "children", openEnded: true,
                    question: t("mn_hm_abna", { name }) });
            }
            else {
                gapQuestions.push({ id: `gap-more-children-${p.id}`, personId: p.id, kind: "children", openEnded: true,
                    question: t("hl_l_abna_akhrwn", { name }) });
            }
            return;
        }
        // ── الوالدان: الشجرة كانت تتوسّع نزولاً وعرضاً ولا تصعد ──
        // ⛔ الحدّ ضروريّ: بلا سقفٍ للعمق تدعو الشجرة إلى صعودٍ لا ينتهي.
        if (genDepth(p.id) <= 3) {
            if (!hasParentOfGender(p.id, "male") && !p.unknownFather)
                gapQuestions.push({ id: `gap-father-${p.id}`, personId: p.id, kind: "parent",
                    parentGender: "male", question: t("fs_mn_wald", { name }) });
            if (!hasParentOfGender(p.id, "female") && !p.unknownMother)
                gapQuestions.push({ id: `gap-mother-${p.id}`, personId: p.id, kind: "parent",
                    parentGender: "female", question: t("fs_mn_walda", { name }) });
        }
        // ── المتوفّون من غير الأسلاف ──
        if (!p.alive) {
            if (!hasChildrenInfo.has(p.id)) {
                gapQuestions.push({ id: `gap-children-${p.id}`, personId: p.id, kind: "children",
                    question: t("hl_khlf_abna", { name }) });
            }
            return;
        }
        // ── الأحياء من الجيل القريب: الأسئلة المعتادة ──
        if (!hasSpouseInfo.has(p.id)) {
            gapQuestions.push({ id: `gap-marriage-${p.id}`, personId: p.id, kind: "marriage",
                question: t("fs_hl_mtzwj", { name, w: she ? t("fs_mtzwja") : t("fs_mtzwj") }) });
        }
        if (!hasChildrenInfo.has(p.id)) {
            gapQuestions.push({ id: `gap-children-${p.id}`, personId: p.id, kind: "children",
                question: t("hl_and_abna", { name }) });
        }
        if (!p.status_detail) {
            gapQuestions.push({ id: `gap-alive-${p.id}`, personId: p.id, kind: "alive",
                question: t("fs_hl_ala_qyd", { name, w: she ? t("fs_mtwfya_rhmha") : t("fs_mtwfa_rhmh") }) });
            gapQuestions.push({ id: `gap-status-${p.id}`, personId: p.id, kind: "status",
                question: t("wyn_halya", { name }) });
        }
    });
    // الأقرب أولاً: أسئلة الجيل القريب أنفع من أسئلة الأسلاف البعيدين
    gapQuestions.sort((a, b) => genDepth(a.personId) - genDepth(b.personId));
    // نُخفي السؤال إن سُجِّلت حقيقة مؤكَّدة عنه — لا مجرّد تجاهل مؤقت
    const visibleGaps = gapQuestions.filter((g) => {
        if (dismissed[g.id])
            return false;
        const p = persons.find((x) => x.id === g.personId);
        if (!p)
            return false;
        if (g.kind === "children" && p.noChildren)
            return false;
        if (g.kind === "marriage" && p.neverMarried)
            return false;
        return true;
    });
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("aqtrahat_alywm"), onBack: onBack,
            // ⛔ حين تصير هذه الشاشة جذراً، يبقى هذا الزرّ سبيلَ الشجرة
            // والأفراد والمواعيد والمجموعات — لا تُخفِه بلا بديل.
            actions: onOpenFamily && React.createElement("button", { "aria-label": t("fs_alaayla"), onClick: onOpenFamily, className: `flex ${rowStart()} items-center gap-1 rounded-xl px-2.5 py-1.5`, style: { backgroundColor: "rgba(255,255,255,0.18)" } },
                React.createElement(Users, { size: 14, color: "#fff" }),
                React.createElement("span", { className: "text-[11px] font-bold text-white" }, t("fs_alaayla"))) }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            // ⛔ زرّ محاكاةٍ للاختبار. كان مقبولاً وهو في شاشةٍ عميقة، فلمّا
            // صارت هذه الشاشة جذرَ أرحام وقع على أوّل ما يراه المستخدم.
            !IS_RAHIM && !upcomingOccasion && (React.createElement("button", { onClick: () => setSimulateOccasion(!simulateOccasion), className: "text-[10px] font-bold mb-2 block", style: { color: colors.textMuted } }, simulateOccasion ? t("ilgha_mhakaa_almnasba") : t("mhakaa_aqtrab_mnasba"))),
            // ⛔ شجرةٌ فارغة تُقابَل بدعوةٍ لا بفراغ. وبدءُ صاحب الشجرة
            // بنفسه يُعرّف «نفسي» بالتصميم، فينحلّ اشتباهه من جذره.
            persons.length === 0 && onStartSelf
                ? (React.createElement(Card, { className: textStart() },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mb-1.5` },
                        React.createElement(Users, { size: 18, color: colors.primary }),
                        React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("fs_abda_bnfsk"))),
                    React.createElement("p", { className: "text-[11px] leading-5 mb-3", style: { color: colors.textMuted } }, t("fs_abda_shrh")),
                    React.createElement("button", { onClick: onStartSelf, className: "w-full rounded-xl py-2.5 text-sm font-bold text-white", style: { backgroundColor: colors.primary } }, t("fs_arrf_bnfsk")),
                        onOpenFamily && React.createElement("button", { onClick: onOpenFamily, className: "w-full mt-2 text-[11px] font-bold", style: { color: colors.primary } }, t("fs_aw_slsla"))))
                : visible.length === 0 && visibleGaps.length === 0 && React.createElement(EmptyState, { icon: Sparkles, label: t("la_twjd_aqtrahat_jdyda") }),
            // قسمُ التواصل كان بلا عنوان: فإذا خلا بدت الشاشة للاستكمال وحده
            (visible.length > 0 || visibleGaps.length > 0) && persons.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-2` },
                    React.createElement(Phone, { size: 14, color: colors.primary }),
                    React.createElement("h3", { className: "text-sm font-extrabold", style: { color: colors.text } }, t("fs_awan_altwasl"))),
                visible.length === 0 && React.createElement("p", { className: `text-[11px] mb-3 ${textStart()}`, style: { color: colors.textMuted } }, t("fs_la_mtakhr")))),
            visible.map((s) => (React.createElement(Card, { key: s.id, className: `flex ${rowStart()} items-center` },
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, s.title),
                    React.createElement("div", { className: "text-xs mt-1", style: { color: colors.textMuted } }, s.reason)),
                React.createElement("div", { className: "flex flex-row gap-1.5" },
                    React.createElement("button", { "aria-label": t("takyd"), onClick: () => onExecute(s.id), className: "w-7 h-7 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary } },
                        React.createElement(Check, { size: 14, color: "#fff" })),
                    React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => onDismiss(s.id), className: "w-7 h-7 rounded-full flex items-center justify-center border", style: { borderColor: colors.border } },
                        React.createElement(X, { size: 14, color: colors.textMuted })))))),
            visibleGaps.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-2 mb-2` },
                    React.createElement(HelpCircle, { size: 14, color: colors.accent }),
                    React.createElement("h3", { className: "text-sm font-extrabold", style: { color: colors.text } }, t("astkmal_shjra_alaayla"))),
                React.createElement("p", { className: "text-[11px] mb-3", style: { color: colors.textMuted } }, t("mrtba_mn_alaqrb_ilyk")),
                visibleGaps.map((g) => (React.createElement(Card, { key: g.id },
                    React.createElement("div", { className: `flex ${rowStart()} items-start gap-2 mb-2` },
                        React.createElement("span", { className: "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5", style: { backgroundColor: colors.primaryLight, color: colors.primaryDark } }, [t("fs_ant"), t("fs_alwaldan"), t("fs_alajdad"), t("fs_slf_awl"), t("fs_slf_thany")][genDepth(g.personId)] || t("fs_slf_bayd")),
                        React.createElement("div", { className: `flex-1 text-sm font-bold ${textStart()}`, style: { color: colors.text } }, g.question)),
                    g.kind === "parent" ? (React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement(Button, { label: t("adf_alan"), onPress: () => { onOpenAddWithPreset && onOpenAddWithPreset(g.personId, "parent", g.parentGender); onDismiss(g.id); }, style: { flex: 1 } }),
                        React.createElement("button", { onClick: () => onDismiss(g.id), className: "text-[11px] font-bold px-2", style: { color: colors.textMuted } }, t("la_aarf"))))
                        : g.kind === "alive" ? (
                    // للأسلاف البعيدين نُقدّم التأكيد على الوفاة لأنه الغالب
                    g.presumeDeceased ? (React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement(Button, { label: t("nam_mtwfa"), onPress: () => { onSetAlive === null || onSetAlive === void 0 ? void 0 : onSetAlive(g.personId, false); onDismiss(g.id); onDismiss(`gap-status-${g.personId}`); }, style: { flex: 1 } }),
                        React.createElement(Button, { label: t("la_ala_qyd_alhyaa"), variant: "outline", onPress: () => { onSetAlive === null || onSetAlive === void 0 ? void 0 : onSetAlive(g.personId, true); onDismiss(g.id); }, style: { flex: 1 } }),
                        React.createElement("button", { onClick: () => onDismiss(g.id), className: "text-[11px] font-bold px-2", style: { color: colors.textMuted } }, t("la_aarf")))) : (React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement(Button, { label: t("ala_qyd_alhyaa"), onPress: () => { onSetAlive === null || onSetAlive === void 0 ? void 0 : onSetAlive(g.personId, true); onDismiss(g.id); }, style: { flex: 1 } }),
                        React.createElement(Button, { label: t("mtwfa_mtwfya"), variant: "outline", onPress: () => { onSetAlive === null || onSetAlive === void 0 ? void 0 : onSetAlive(g.personId, false); onDismiss(g.id); onDismiss(`gap-status-${g.personId}`); }, style: { flex: 1 } }),
                        React.createElement("button", { onClick: () => onDismiss(g.id), className: "text-[11px] font-bold px-2", style: { color: colors.textMuted } }, t("la_aarf"))))) : g.kind === "status" ? (React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2` },
                        React.createElement(Chip, { label: t("ala_qyd_alhyaa_bla"), onPress: () => { onQuickStatus(g.personId, null); onDismiss(g.id); } }),
                        Object.entries(statusLabels).map(([key, label]) => (React.createElement(Chip, { key: key, label: label, onPress: () => { onQuickStatus(g.personId, key); onDismiss(g.id); } }))),
                        React.createElement("button", { onClick: () => onDismiss(g.id), className: "text-[11px] font-bold px-2", style: { color: colors.textMuted } }, t("lahqa")))) : ((() => {
                        const person = persons.find((x) => x.id === g.personId);
                        const isOpenEnded = !!g.openEnded;
                        // الجواب هنا غالباً عدة أسماء (أبناء، بنات، زوجات) — نفتح
                        // الشيت الجماعي بدل نموذج شخص واحد.
                        const openBulk = () => { onOpenBulkAdd === null || onOpenBulkAdd === void 0 ? void 0 : onOpenBulkAdd(person, g.kind); onDismiss(g.id); };
                        return (React.createElement(React.Fragment, null,
                            React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                                React.createElement(Button, { label: isOpenEnded ? t("adf_alan") : t("nam_adfhm"), onPress: openBulk, style: { flex: 1 } }),
                                React.createElement(Button, { label: g.kind === "children" ? t("la_ywjd_abna") : t("lm_ytzwj"), variant: "outline", onPress: () => { onConfirmNone === null || onConfirmNone === void 0 ? void 0 : onConfirmNone(g.personId, g.kind); onDismiss(g.id); }, style: { flex: 1 } })),
                            React.createElement("button", { onClick: () => onDismiss(g.id), className: "w-full text-[11px] font-bold mt-1.5 py-1", style: { color: colors.textMuted } }, t("la_aarf_asalny_lahqa")),
                            React.createElement("p", { className: `text-[10px] ${textStart()} mt-1`, style: { color: colors.textMuted } }, g.kind === "children"
                                ? t("la_ywjd_abna_tsjl")
                                : t("lm_ytzwj_tsjl"))));
                    })())))))))));
}
function FamilySchedulesScreen({ groupId, schedules, persons, canAdd = true, onComplete, onAdd, onEdit, onDelete, onBack }) {
    const { colors } = useTheme();
    const [confirmingId, setConfirmingId] = useState(null);
    const items = schedules.filter((s) => s.groupId === groupId);
    function personName(id) { var _a; return ((_a = persons.find((p) => p.id === id)) === null || _a === void 0 ? void 0 : _a.local_name) || t("qryb_2"); }
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("mwaayd_altwasl"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            canAdd && (React.createElement("button", { "aria-label": t("idafa"), onClick: onAdd, className: `flex ${rowStart()} items-center gap-1 mb-3 border rounded-xl px-3 py-1.5 text-xs font-bold`, style: { borderColor: colors.primary, color: colors.primary } },
                React.createElement(Plus, { size: 14 }),
                t("mwad_jdyd"))),
            items.length === 0 && React.createElement(EmptyState, { icon: Clock, label: t("la_twjd_mwaayd_bad") }),
            items.map((s) => (React.createElement(Card, { key: s.id, className: `flex ${rowStart()} items-center` },
                React.createElement("div", { className: `w-9 h-9 rounded-full flex items-center justify-center ${ms("2.5")}`, style: { backgroundColor: colors.primaryLight } },
                    React.createElement(Clock, { size: 16, color: colors.primary })),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } },
                        actionLabel(s.action),
                        " \u2014 ",
                        personName(s.personId)),
                    React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } },
                        scheduleFreqLabel(scheduleFreqKey(s)),
                        " · ",
                        scheduleDueLabel(s),
                        scheduleLastDoneLabel(s) ? " · " + t("sc_akhr_twasl") + " " + scheduleLastDoneLabel(s) : "")),
                canAdd && onEdit && React.createElement("button", { "aria-label": t("sc_tadyl_mwad"), onClick: () => onEdit(s), className: `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ms("1")}`, style: { backgroundColor: colors.bg } },
                    React.createElement(Pencil, { size: 13, color: colors.textMuted })),
                canAdd && onDelete && (confirmingId === s.id
                    ? React.createElement("button", { onClick: () => { setConfirmingId(null); onDelete(s.id); }, className: `text-[10px] font-bold rounded-xl px-2 py-1.5 text-white shrink-0 ${ms("1")}`, style: { backgroundColor: colors.danger } }, t("takyd"))
                    : React.createElement("button", { "aria-label": t("hdhf"), onClick: () => setConfirmingId(s.id), className: `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ms("1")}`, style: { backgroundColor: colors.bg } },
                        React.createElement(Trash2, { size: 13, color: colors.danger }))),
                React.createElement("button", { "aria-label": t("takyd"), onClick: () => onComplete(s.id), className: "w-8 h-8 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary } },
                    React.createElement(Check, { size: 16, color: "#fff" }))))))));
}
function FamilyEventsScreen({ groupId, events, persons = [], canAdd, onAdd, onEdit, onDelete, onBack }) {
    const { colors } = useTheme();
    const [confirmingId, setConfirmingId] = useState(null);
    const items = events.filter((e) => e.groupId === groupId);
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("ahdath_alaayla"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            canAdd && (React.createElement("button", { "aria-label": t("idafa"), onClick: onAdd, className: `flex ${rowStart()} items-center gap-1 mb-3 border rounded-xl px-3 py-1.5 text-xs font-bold`, style: { borderColor: colors.primary, color: colors.primary } },
                React.createElement(Plus, { size: 14 }),
                t("hdth_jdyd"))),
            items.length === 0 && React.createElement(EmptyState, { icon: Calendar, label: t("la_twjd_ahdath_bad") }),
            items.map((e) => {
                const Icon = eventTypeIcons[e.type] || Star;
                return (React.createElement(Card, { key: e.id, className: `flex ${rowStart()} items-center` },
                    React.createElement("div", { className: `w-9 h-9 rounded-full flex items-center justify-center ${ms("2.5")}`, style: { backgroundColor: colors.primaryLight } },
                        React.createElement(Icon, { size: 16, color: colors.primary })),
                    React.createElement("div", { className: `flex-1 ${textStart()}` },
                        React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, e.title),
                        (() => { const ep = persons.find((p) => p.id === e.personId); return ep ? React.createElement("div", { className: "text-xs font-bold mt-0.5", style: { color: colors.primary } }, ep.local_name, ep.kinship ? " \u00B7 " + kinshipLabel(ep.kinship) : "") : null; })(),
                        React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } },
                            eventTypeLabel(e.type),
                            " \u00B7 ",
                            eventDateLabel(e)),
                        e.desc && React.createElement("div", { className: "text-xs mt-1", style: { color: colors.textMuted } }, e.desc)),
                    canAdd && onEdit && React.createElement("button", { "aria-label": t("ev_tadyl_hdth"), onClick: () => onEdit(e), className: `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ms("1")}`, style: { backgroundColor: colors.bg } },
                        React.createElement(Pencil, { size: 13, color: colors.textMuted })),
                    canAdd && onDelete && (confirmingId === e.id
                        ? React.createElement("button", { onClick: () => { setConfirmingId(null); onDelete(e.id); }, className: "text-[10px] font-bold rounded-xl px-2 py-1.5 text-white shrink-0", style: { backgroundColor: colors.danger } }, t("takyd"))
                        : React.createElement("button", { "aria-label": t("hdhf"), onClick: () => setConfirmingId(e.id), className: "w-8 h-8 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.bg } },
                            React.createElement(Trash2, { size: 13, color: colors.danger })))));
            }))));
}
function FamilyActivityLogScreen({ groupId, activityLog, onBack }) {
    const { colors } = useTheme();
    const entries = activityLog.filter((a) => a.groupId === groupId);
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("sjl_nshat_almjmwaa"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            entries.length === 0 && React.createElement(EmptyState, { icon: FileClock, label: t("la_ywjd_nshat_msjl") }),
            entries.map((a) => (React.createElement(Card, { key: a.id, className: `flex ${rowStart()} items-start gap-2.5` },
                React.createElement(FileClock, { size: 15, color: colors.primary, className: "mt-0.5" }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, a.text),
                    React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, new Date(a.ts).toLocaleString(loc(), { day: "numeric", month: "long", hour: "numeric", minute: "numeric" })))))))));
}
function FamilyMembersScreen({ groupId, members, canManage, settings, onCycleRole, onToggleSetting, onOpenActivityLog, onBack }) {
    var _a, _b;
    const { colors } = useTheme();
    // ⛔ لا سيرفر، فلا عضوية حقيقية: كانت «دعوة عضو» تُلحق الاسم بالقائمة فوراً
    // وتُعلن «انضمّ للمجموعة» ولم يُرسَل شيء. والرمز SAWA-GRP لم يكن يقرؤه
    // شيء. أُزيلا (v190)، وتُخفى الأسماء التي ألحقتها تلك الدعوة الشكلية —
    // معرّفها `u-${Date.now()}` — دون حذفها من المخزن.
    const list = (members[groupId] || []).filter((m) => !/^u-\d{12,}$/.test(m.userId));
    // دعوةٌ إلى التطبيق لا إلى المجموعة: رابط الموقع نفسه، يبدأ به القريب
    // شجرته على جهازه. ⛔ t() هنا عند النقر لا عند التحميل.
    function inviteRelative() {
        const url = location.origin + location.pathname.replace(/index\.html$/, "");
        const text = t("inv_rsala", { app: appName(), url });
        try {
            if (navigator.share) {
                navigator.share({ text }).catch(() => { }); // الإلغاء ليس خطأً
                return;
            }
        }
        catch (_a) { }
        window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
    }
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("alaada_walslahyat"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: "p-4 border-b", style: { borderColor: colors.border } },
                React.createElement("div", { className: `text-sm font-extrabold ${textStart()}`, style: { color: colors.text } }, t("inv_aqarbk")),
                React.createElement("p", { className: `text-[11px] mt-1 mb-3 leading-relaxed ${textStart()}`, style: { color: colors.textMuted } }, t("inv_shrh", { app: appName() })),
                React.createElement(Button, { icon: Share2, label: t("inv_zr"), onPress: inviteRelative }),
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mt-3` },
                    React.createElement(Badge, { size: "sm", variant: "neutral", label: t("qryba") }),
                    React.createElement("span", { className: `flex-1 text-[10px] leading-relaxed ${textStart()}`, style: { color: colors.textMuted } }, t("inv_qryban")))),
            canManage && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 p-4`, style: { backgroundColor: colors.primaryLight } },
                    React.createElement("div", { className: `flex-1 ${textStart()}` },
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.primaryDark } }, t("alsmah_llaada_bidafa_ahdath"))),
                    React.createElement("button", { onClick: () => { var _a; return onToggleSetting(groupId, !((_a = settings[groupId]) === null || _a === void 0 ? void 0 : _a.allowMemberEvents)); }, className: "w-11 h-6 rounded-full relative shrink-0", style: { backgroundColor: ((_a = settings[groupId]) === null || _a === void 0 ? void 0 : _a.allowMemberEvents) ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [((_b = settings[groupId]) === null || _b === void 0 ? void 0 : _b.allowMemberEvents) ? "right" : "left"]: 2 } }))),
                React.createElement("button", { onClick: onOpenActivityLog, className: `w-full flex ${rowStart()} items-center justify-between p-4 border-b`, style: { borderColor: colors.border } },
                    React.createElement(FileClock, { size: 17, color: colors.primary }),
                    React.createElement("span", { className: `flex-1 text-xs font-bold ${textStart()} ${me("2.5")}`, style: { color: colors.text } }, t("sjl_nshat_almjmwaa")),
                    React.createElement(ChevronLeft, { size: 14, color: colors.textMuted, style: { transform: "scaleX(-1)" } })))),
            React.createElement("div", { className: "p-4" }, list.map((m) => (React.createElement(Card, { key: m.userId, className: `flex ${rowStart()} items-center` },
                React.createElement("span", { className: `flex-1 text-sm ${textStart()}`, style: { color: colors.text } }, m.userId === "u-1" ? t("ant") : m.name),
                canManage && m.role !== "owner" ? (React.createElement("button", { onClick: () => onCycleRole(groupId, m.userId) },
                    React.createElement(Badge, { variant: "neutral", label: roleLabel(m.role) }))) : (React.createElement(Badge, { variant: "neutral", label: roleLabel(m.role) })))))))));
}
// نافذة إضافة/تعديل قريب شاملة — تُستخدم لكلا الحالتين (person=null للإضافة،
// أو كائن شخص حقيقي للتعديل المسبق التعبئة)
// إضافة سريعة بالنسب المتسلسل — طريقة إضافية بجانب النموذج التفصيلي، مو
// بديلة عنه (النسب المتسلسل ما يوفّر تحكّم بالهاتف/الصورة/الحالة الصحية)
function FamilyChainAddSheet({ existingPersons, relations = [], onSave, onClose }) {
    const { colors } = useTheme();
    const [chainText, setChainText] = useState("");
    const [targetIndex, setTargetIndex] = useState(0); // "لمين؟" — أي جيل بالسلسلة تُضاف له الإخوة/الأبناء/الزوجات
    // الأول قد يكون ذكراً أو أنثى؛ بقية السلسلة آباء فذكور
    const [firstGender, setFirstGender] = useState("male");
    const [genderTouched, setGenderTouched] = useState(false);
    // "بنت" في أول السلسلة تعني أن صاحبها أنثى — ما لم يغيّرها المستخدم يدوياً
    useEffect(function () {
        if (genderTouched) return;
        if (/\s+(?:بنت|bint)\s+/i.test(chainText)) setFirstGender("female");
    }, [chainText, genderTouched]);
    // هل الاسم الأول هو صاحب الشجرة نفسه؟ الصلات تُشتقّ نسبةً إليه.
    // ⛔ «نفسي» واحدٌ للمجموعة. كان الافتراض `true` دائماً، فمن أضاف سلسلة
    // نسب زوجته ونسي الرقاقة أنشأ صاحب شجرة ثانياً صامتاً.
    const selfTaken = (existingPersons || []).some(isSelfPerson);
    const [firstIsSelf, setFirstIsSelf] = useState(!selfTaken);
    const [brothersText, setBrothersText] = useState("");
    const [sistersText, setSistersText] = useState("");
    const [sonsText, setSonsText] = useState("");
    const [daughtersText, setDaughtersText] = useState("");
    const [wivesText, setWivesText] = useState("");
    // اسم الابن → اسم أمّه. يظهر السؤال فقط عند تعدّد الزوجات.
    const [childMother, setChildMother] = useState({});
    // التقسيم بالفاصلة (عربية أو لاتينية) — مو بالمسافة، عشان الأسماء
    // المركّبة زي "محمد أحمد" أو "ست النفر" تفضل اسم واحد صحيح بدل ما
    // تنقسم غلط لشخصين منفصلين
    // التقسيم بالفاصلة، وأيضاً بـ"بن/بنت" لأن كتابة النسب بهذه الصيغة
    // هي الأشيع؛ بدونها يصير "خالد بن أحمد بن محمد" اسماً واحداً طويلاً.
    // "بنت" تعني أن الأول أنثى، فنلتقطها ونضبط الجنس تلقائياً.
    const chainNames = chainText
        .split(/[,،]|\s+(?:بن|بنت|bin|bint|ibn)\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
    const splitNames = (t) => t.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
    const brotherNames = splitNames(brothersText);
    const sisterNames = splitNames(sistersText);
    const sonNames = splitNames(sonsText);
    const daughterNames = splitNames(daughtersText);
    const wifeNames = splitNames(wivesText);
    // نُبقي المجاميع للتحقق من التكرار والعدّ
    const siblingNames = [...brotherNames, ...sisterNames];
    const childrenNames = [...sonNames, ...daughterNames];
    const existingNamesLower = existingPersons.map((p) => normalizeArabicName(p.local_name));
    const duplicates = [...chainNames, ...siblingNames, ...childrenNames, ...wifeNames].filter((n) => existingNamesLower.includes(normalizeArabicName(n)));
    // قرار المستخدم لكل اسم مطابق: "same" = هو نفسه (نعيد استخدام الموجود)
    // أو "new" = شخص آخر يحمل نفس الاسم (نُنشئ سجلاً منفصلاً)
    const [matchDecisions, setMatchDecisions] = useState({});
    // نُطابق كل اسم مكرّر بالشخص الموجود مع صلة قرابته — ليقرر المستخدم بوضوح
    // نعرض كل المتشابهين بنسبهم — لا واحداً فقط، فقد يكون بينهم عدة أشخاص
    const { distinctLabel: dupLabel } = buildLineageHelpers(existingPersons, relations);
    const matchCandidates = [...new Set(duplicates.map((d) => normalizeArabicName(d)))].map((low) => {
        const all = existingPersons.filter((p) => normalizeArabicName(p.local_name) === low);
        return {
            low,
            typed: [...chainNames, ...siblingNames, ...childrenNames, ...wifeNames].find((n) => n.toLowerCase() === low),
            existing: all[0],
            allMatches: all,
            label: all.map((p) => dupLabel(p)).join(" · "),
        };
    });
    const undecided = matchCandidates.filter((m) => !matchDecisions[m.low]);
    const totalCount = chainNames.length + siblingNames.length + childrenNames.length + wifeNames.length;
    const safeTargetIndex = Math.min(targetIndex, Math.max(0, chainNames.length - 1));
    const targetName = chainNames[safeTargetIndex] || t("fc_alasm_alawl");
    // الهدف أنثى فقط إن كان الاسم الأول وجنسه أنثى — ما بعده آباء وأجداد فذكور
    const targetIsFemale = safeTargetIndex === 0 && firstGender === "female";
    function kinshipLabelForIndex(i) {
        if (i === 0)
            return t("fc_alasm_nfsh");
        if (i === 1)
            return t("fc_alwald");
        if (i === 2)
            return t("fc_aljd");
        return t("fc_slf", { i: i + 1 });
    }
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("idafa_sryaa_balnsb_almtslsl"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 min-h-0 overflow-y-auto p-4" },
            React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("afsl_kl_jyl_bfasla")),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("alasm_alkaml_mtslsla_afsl")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: chainText, onChange: (e) => setChainText(e.target.value), placeholder: t("mthal_asama_ibrahym_mhmd"), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }, autoFocus: true }),
            chainNames.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("label", { className: `text-xs font-bold mb-2 block ${textStart()}`, style: { color: colors.text } },
                    t("fc_jns"),
                    chainNames[0],
                    "\u00BB"),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-1` },
                    React.createElement(Chip, { label: t("dhkr"), active: firstGender === "male", onPress: () => setFirstGender("male") }),
                    React.createElement(Chip, { label: t("antha"), active: firstGender === "female", onPress: () => setFirstGender("female") })),
                React.createElement("p", { className: `text-[10px] ${textStart()} mb-3`, style: { color: colors.textMuted } }, t("bqya_alslsla_aba_wajdad")),
                React.createElement("label", { className: `text-xs font-bold mb-2 block ${textStart()}`, style: { color: colors.text } },
                    t("fc_mn_hw"),
                    chainNames[0],
                    t("fc_balnsba_lk")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-1` },
                    React.createElement(Chip, { label: t("ana"), active: firstIsSelf, onPress: () => setFirstIsSelf(true), disabled: selfTaken }),
                    React.createElement(Chip, { label: t("qryb_akhr"), active: !firstIsSelf, onPress: () => setFirstIsSelf(false) })),
                selfTaken && React.createElement("p", { className: `text-[10px] ${textStart()} mb-1 font-bold`, style: { color: colors.accent } }, t("pf_nfsy_mkrr")),
                React.createElement("p", { className: `text-[10px] ${textStart()} mb-4`, style: { color: colors.textMuted } }, firstIsSelf
                    ? t("fc_alslat_thsb")
                    : t("fc_alslat_tsjl")))),
            chainNames.length > 1 && (React.createElement(React.Fragment, null,
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("lmn_akhtr_ay_jyl")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-4` }, chainNames.map((name, i) => (React.createElement(Chip, { key: i, label: `${name} — ${kinshipLabelForIndex(i)}`, active: safeTargetIndex === i, onPress: () => setTargetIndex(i) })))))),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } },
                t("fc_ikhwa_"),
                targetName,
                t("fc_dhkwr_opt")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: brothersText, onChange: (e) => setBrothersText(e.target.value), placeholder: t("mthal_khald_amr"), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } },
                t("fc_akhwat_"),
                targetName,
                t("fc_inath_opt")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: sistersText, onChange: (e) => setSistersText(e.target.value), placeholder: t("mthal_st_alnfr_amna"), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } },
                t("fc_abna_"),
                targetName,
                " \u2014 \u0630\u0643\u0648\u0631 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)"),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: sonsText, onChange: (e) => setSonsText(e.target.value), placeholder: t("mthal_mhmd_ahmd"), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } },
                t("fc_bnat_"),
                targetName,
                t("fc_inath_opt")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: daughtersText, onChange: (e) => setDaughtersText(e.target.value), placeholder: t("mthal_mrym_fatma"), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, targetIsFemale
                ? t("zwj_akhtyary", { targetName })
                : t("zwjat_akhtyary_afsl_bfasla", { targetName })),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: wivesText, onChange: (e) => setWivesText(e.target.value), placeholder: targetIsFemale ? t("fc_mthal_ibrahym") : t("fc_mthal_fatma"), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            wifeNames.length > 1 && childrenNames.length > 0 && (React.createElement(Card, { className: "mb-4" },
                React.createElement("div", { className: "text-[11px] font-bold mb-1", style: { color: colors.text } }, t("fc_om_title")),
                React.createElement("p", { className: `text-[10px] ${textStart()} mb-2`, style: { color: colors.textMuted } }, t("fc_om_hint")),
                childrenNames.map((cn) => (React.createElement("div", { key: cn, className: "mb-2" },
                    React.createElement("div", { className: `text-[11px] font-bold mb-1 ${textStart()}`, style: { color: colors.text } }, cn),
                    React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-1.5` },
                        wifeNames.map((wn) => (React.createElement(Chip, { key: wn, label: wn, active: childMother[cn] === wn, onPress: () => setChildMother((m) => ({ ...m, [cn]: wn })) }))),
                        React.createElement(Chip, { label: t("fc_om_unset"), active: !childMother[cn], onPress: () => setChildMother((m) => { const n = { ...m }; delete n[cn]; return n; }) }))))))),
            chainNames.length > 0 && (React.createElement(Card, { className: "mb-4" },
                React.createElement("div", { className: "text-[11px] font-bold mb-2", style: { color: colors.textMuted } }, t("maayna_alslsla")),
                chainNames.map((name, i) => (React.createElement("div", { key: i, className: `flex ${rowStart()} items-center gap-2 mb-1.5` },
                    React.createElement("div", { className: "w-1.5 h-1.5 rounded-full", style: { backgroundColor: colors.primary } }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, name),
                    React.createElement("span", { className: "text-[10px]", style: { color: colors.primary } }, kinshipLabelForIndex(i)),
                    React.createElement("span", { className: "text-[9px]", style: { color: colors.textMuted } }, i === 0 ? (firstGender === "female" ? t("fc_antha") : t("fc_dhkr")) : t("fc_dhkr"))))),
                [
                    { l: t("fc_ikhwa"), g: t("fc_dhkwr"), names: brotherNames },
                    { l: t("fc_akhwat"), g: t("fc_inath"), names: sisterNames },
                    { l: t("fc_abna"), g: t("fc_dhkwr"), names: sonNames },
                    { l: t("fc_bnat"), g: t("fc_inath"), names: daughterNames },
                    { l: targetIsFemale ? t("fc_zwj") : t("fc_zwjat"), g: targetIsFemale ? t("fc_dhkr") : t("fc_inath"), names: wifeNames },
                ].filter((x) => x.names.length > 0).map((x) => (React.createElement("div", { key: x.l, className: "mt-2 pt-2 border-t", style: { borderColor: colors.border } },
                    React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                        x.l,
                        " ",
                        targetName,
                        " ",
                        React.createElement("span", { style: { color: colors.primary } },
                            "(",
                            x.g,
                            ")"),
                        ": ",
                        x.names.join(t("fasl_qayma")))))))),
            matchCandidates.length > 0 && (React.createElement(Card, { className: "mb-4", style: { borderColor: colors.accent } },
                React.createElement("div", { className: `flex ${rowStart()} items-start gap-2 mb-3` },
                    React.createElement(AlertTriangle, { size: 14, color: colors.accent, className: "mt-0.5 shrink-0" }),
                    React.createElement("p", { className: `text-[11px] flex-1 ${textStart()}`, style: { color: colors.accent } }, t("hdhh_alasma_mwjwda_fy"))),
                matchCandidates.map((m) => {
                    var _a;
                    return (React.createElement("div", { key: m.low, className: "rounded-xl p-2.5 mb-2", style: { backgroundColor: colors.bg, border: `1px solid ${colors.border}` } },
                        React.createElement("p", { className: `text-xs font-bold ${textStart()} mb-0.5`, style: { color: colors.text } }, m.typed),
                        React.createElement("p", { className: `text-[10px] ${textStart()} mb-2 leading-relaxed`, style: { color: colors.textMuted } }, m.allMatches.length > 1
                            ? t("ashkhas_bhdha_alasm", { length: m.allMatches.length, label: m.label })
                            : t(((_a = m.existing) === null || _a === void 0 ? void 0 : _a.alive) === false ? "fc_existing_dead" : "fc_existing", { label: m.label })),
                        m.allMatches.length > 1 && (React.createElement("p", { className: `text-[10px] ${textStart()} mb-1.5`, style: { color: colors.danger } }, t("tshabh_fy_alasm_takd"))),
                        React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                            React.createElement("button", { onClick: () => setMatchDecisions((d) => ({ ...d, [m.low]: "same" })), className: "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold", style: {
                                    backgroundColor: matchDecisions[m.low] === "same" ? colors.primary : colors.card,
                                    color: matchDecisions[m.low] === "same" ? "#fff" : colors.text,
                                    border: `1px solid ${matchDecisions[m.low] === "same" ? colors.primary : colors.border}`,
                                } }, t("hw_nfsh")),
                            React.createElement("button", { onClick: () => setMatchDecisions((d) => ({ ...d, [m.low]: "new" })), className: "flex-1 py-1.5 rounded-lg text-[10px] font-bold", style: {
                                    backgroundColor: matchDecisions[m.low] === "new" ? colors.accent : colors.card,
                                    color: matchDecisions[m.low] === "new" ? "#fff" : colors.text,
                                    border: `1px solid ${matchDecisions[m.low] === "new" ? colors.accent : colors.border}`,
                                } }, t("shkhs_akhr")))));
                }),
                React.createElement("p", { className: `text-[10px] ${textStart()} mt-1`, style: { color: colors.textMuted } }, t("hw_nfsh_yrbt_alslsla")))),
            React.createElement(Button, { label: undecided.length > 0
                    ? t("hdd_asma_mkrra_awla", { length: undecided.length })
                    : t("fc_add_link", { count: totalCount - matchCandidates.filter((m) => matchDecisions[m.low] === "same").length }), disabled: chainNames.length === 0 || undecided.length > 0, onPress: () => onSave(chainNames, {
                    brothers: brotherNames, sisters: sisterNames,
                    sons: sonNames, daughters: daughterNames, wives: wifeNames,
                }, safeTargetIndex, matchDecisions, firstGender, firstIsSelf, childMother) }))));
}
function FamilyPersonFormSheet({ person, persons = [], relations = [], otherGroups = [], presetRelatedToId, presetRelationType, presetKinship, onSave, onDelete, onClose, }) {
    var _a, _b, _c, _d, _e, _f, _g;
    const { colors } = useTheme();
    const isEdit = !!person;
    // ── الأم في بيت متعدّد الزوجات ───────────────────────────────
    // v138 ربطت الأم عند إضافة السلسلة فقط. من أُضيف قبلها أو بغيرها
    // لا سبيل لتحديد أمّه — وحارس الإخوة غير الأشقاء يمنع استنتاجها عمداً.
    const parentIdsOfThis = isEdit ? relations.filter((r) => r.type === "parent" && r.target === person.id).map((r) => r.source) : [];
    const fatherOfThis = persons.find((x) => parentIdsOfThis.includes(x.id) && x.gender !== "female");
    const wivesOfFather = fatherOfThis
        ? relations
            .filter((r) => (r.type === "spouse" || r.type === "ex_spouse") && (r.source === fatherOfThis.id || r.target === fatherOfThis.id))
            .map((r) => persons.find((x) => x.id === (r.source === fatherOfThis.id ? r.target : r.source)))
            .filter(Boolean)
        : [];
    const motherApplicable = wivesOfFather.length > 1;
    const [motherId, setMotherId] = useState((wivesOfFather.find((w) => parentIdsOfThis.includes(w.id)) || {}).id || null);
    const existingPersons = persons.filter((p) => p.id !== (person === null || person === void 0 ? void 0 : person.id));
    const [localName, setLocalName] = useState((person === null || person === void 0 ? void 0 : person.local_name) || "");
    // نسب مكتوب داخل الاسم: «أسامة بن إبراهيم بن محمد» — نُفكّكه لسلسلة
    // فيُضاف الأصول تلقائياً بدل إدخال كل واحد على حدة.
    const chainParts = localName.split(/\s+(?:بن|بنت|bin|bint|ibn)\s+/i).map((s) => s.trim()).filter(Boolean);
    const hasChain = chainParts.length > 1;
    const [useChain, setUseChain] = useState(true);
    // عند فتح النموذج بعلاقة محدَّدة سلفاً (من الشجرة)، نضبط صلة القرابة لتوافقها
    // — وإلا ظهر الأب المُضاف بصلة "الابن" فبدا جزءاً من الأبناء.
    const KINSHIP_FOR_PRESET = {
        // ⛔ مُعرِّفات قرابة تُخزَّن في p.kinship — لا تُترجَم (kinshipLabel تعرضها)
    parent: "الوالد", child: "الابن", sibling: "الأخ",
        spouse: "الزوجة", ex_spouse: "الزوجة السابقة",
    };
    const [kinship, setKinship] = useState((person === null || person === void 0 ? void 0 : person.kinship) /* ⛔ تهيئة حالة من مُعرِّف مخزَّن */ || presetKinship || (presetRelationType && KINSHIP_FOR_PRESET[presetRelationType]) || KINSHIP_OPTIONS[0]);
    const [showKinshipPicker, setShowKinshipPicker] = useState(false);
    const [kinshipSearch, setKinshipSearch] = useState("");
    const [openKinshipSection, setOpenKinshipSection] = useState(null);
    const [gender, setGender] = useState((person === null || person === void 0 ? void 0 : person.gender)
        || KINSHIP_GENDER_DEFAULTS[person === null || person === void 0 ? void 0 : person.kinship]
        || (presetRelationType && KINSHIP_GENDER_DEFAULTS[KINSHIP_FOR_PRESET[presetRelationType]])
        || "male");
    const [phone, setPhone] = useState(((_a = person === null || person === void 0 ? void 0 : person.contacts) === null || _a === void 0 ? void 0 : _a.phone) || "");
    const [birthday, setBirthday] = useState((person === null || person === void 0 ? void 0 : person.birthday) || "");
    const [birthYear, setBirthYear] = useState((person === null || person === void 0 ? void 0 : person.birthYear) || "");
    const [statusDetail, setStatusDetail] = useState((person === null || person === void 0 ? void 0 : person.status_detail) || "");
    const [notes, setNotes] = useState((person === null || person === void 0 ? void 0 : person.notes) || "");
    const [photo, setPhoto] = useState((person === null || person === void 0 ? void 0 : person.photo) || null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [contactImportError, setContactImportError] = useState(false);
    const [isDeceased, setIsDeceased] = useState(person ? !person.alive : false);
    const [deathDate, setDeathDate] = useState((person === null || person === void 0 ? void 0 : person.death_date) || "");
    // ربط العلاقة مدمج هنا مباشرة — بدل ما يكون خطوة منفصلة بشاشة الشجرة، وهذا
    // بالضبط سبب شكوى "القريب ما ينزل بالشجرة" — كان ممكن يتوصف بس بدون ربط فعلي
    const [linkEnabled, setLinkEnabled] = useState(!isEdit && (existingPersons.length > 0 || !!presetRelatedToId));
    const [relatedToId, setRelatedToId] = useState(presetRelatedToId || ((_b = existingPersons[0]) === null || _b === void 0 ? void 0 : _b.id));
    const [relationType, setRelationType] = useState(presetRelationType || KINSHIP_RELATION_DEFAULTS[(person === null || person === void 0 ? void 0 : person.kinship) || KINSHIP_OPTIONS[0]] || "child");
    const photoInputRef = useRef(null);
    const { distinctLabel: lineageLabel, sortedByGeneration } = buildLineageHelpers(existingPersons, relations);
    const lineageSorted = sortedByGeneration(existingPersons);
    // الخيار الثالث المتّفق عليه: ربط خفيف بشخص موجود بمجموعة ثانية (بدل سجل
    // موحّد كامل) — يعرض شارة "نفس فلان بمجموعة كذا" ويزامن الهاتف/الميلاد بس
    const [crossLinkEnabled, setCrossLinkEnabled] = useState(!!(person === null || person === void 0 ? void 0 : person.linkedTo));
    const [crossLinkGroupId, setCrossLinkGroupId] = useState(((_c = person === null || person === void 0 ? void 0 : person.linkedTo) === null || _c === void 0 ? void 0 : _c.groupId) || ((_d = otherGroups[0]) === null || _d === void 0 ? void 0 : _d.groupId));
    const [crossLinkPersonId, setCrossLinkPersonId] = useState((_e = person === null || person === void 0 ? void 0 : person.linkedTo) === null || _e === void 0 ? void 0 : _e.personId);
    // كل المتشابهين بالاسم — نعرضهم بنسبهم ليختار المستخدم بوعي.
    // (المطابقة هنا للتحذير فقط، لا للدمج التلقائي)
    const duplicateMatches = !isEdit && localName.trim()
        ? existingPersons.filter((p) => p.local_name.trim().toLowerCase() === (hasChain ? chainParts[0] : localName).trim().toLowerCase())
        : [];
    const duplicateMatch = duplicateMatches[0] || null;
    const { distinctLabel: dupLineage } = buildLineageHelpers(existingPersons, relations);
    // ⛔ existingPersons تستثني المعروض نفسه، فتعديل صاحب الشجرة لا يُمنع
    const selfTaken = existingPersons.some(isSelfPerson);
    const crossLinkGroup = otherGroups.find((g) => g.groupId === crossLinkGroupId);
    function handlePhotoChange(e) {
        var _a;
        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (ev) => setPhoto(ev.target.result);
        reader.readAsDataURL(file);
    }
    function handleSave() {
        if (!localName.trim())
            return;
        onSave({
            // نمرّرها فقط حين ظهر الحقل فعلاً — وإلا حُذفت أمومة لم تُعرَض قطّ
            motherApplicable,
            motherId: motherApplicable ? motherId : null,
            motherCandidateIds: motherApplicable ? wivesOfFather.map((w) => w.id) : [],
            // عند تفكيك النسب نحفظ الاسم الأول فقط، والأصول تُضاف كأشخاص
            local_name: (hasChain && useChain && !isEdit ? chainParts[0] : localName).trim(),
            // سلسلة الأصول للمعالجة في AppInner
            ancestorChain: hasChain && useChain && !isEdit ? chainParts.slice(1) : null,
            kinship,
            gender: gender || null,
            proximity: proximityForKinship(kinship),
            birthday: birthday || null,
            birthYear: birthYear ? Number(birthYear) : null,
            status_detail: statusDetail || null,
            contacts: phone.trim() ? { phone: phone.trim() } : null,
            notes: notes.trim(),
            photo,
            alive: !isDeceased,
            death_date: isDeceased ? (deathDate || null) : null,
            relation: !isEdit && linkEnabled && relatedToId ? { relatedToId, relationType } : null,
            linkedTo: crossLinkEnabled && crossLinkGroupId && crossLinkPersonId ? { groupId: crossLinkGroupId, personId: crossLinkPersonId } : null,
        });
        onClose();
    }
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: isEdit ? t("pf_tadyl") : t("pf_idafa"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 min-h-0 overflow-y-auto p-4" },
            React.createElement("div", { className: "flex flex-col items-center mb-4" },
                React.createElement("input", { ref: photoInputRef, type: "file", accept: "image/*", className: "hidden", onChange: handlePhotoChange }),
                React.createElement("button", { onClick: () => { var _a; return (_a = photoInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "flex flex-col items-center" },
                    React.createElement("div", { className: "w-20 h-20 rounded-full flex items-center justify-center overflow-hidden mb-1.5", style: { backgroundColor: colors.primaryLight, border: `2px solid ${colors.primary}` } }, photo ? React.createElement("img", { src: photo, alt: t("swra"), className: "w-full h-full object-cover" }) : React.createElement(Camera, { size: 22, color: colors.primaryDark })),
                    React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primary } }, photo ? t("pf_tghyyr_alswra") : t("pf_idafa_swra"))),
                // إزالة الصورة: تُحذف من هذا الجهاز ومن الخادم فتختفي عند أهلك أيضاً
                photo && React.createElement("button", { type: "button", onClick: () => { setPhoto(null); if (photoInputRef.current) photoInputRef.current.value = ""; }, className: "mt-1 text-[11px] font-bold rounded-full px-3 py-1", style: { color: colors.danger, backgroundColor: colors.danger + "12" } }, t("pf_izalat_alswra"))),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("alasm")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-1` },
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: localName, onChange: (e) => setLocalName(e.target.value), placeholder: t("asama_aw_asama_bn"), className: "flex-1 border rounded-xl px-3 py-2.5 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, minWidth: 0 }, autoFocus: true }),
                React.createElement("button", { onClick: async () => {
                        var _a, _b;
                        if (!(navigator.contacts && window.ContactsManager)) {
                            setContactImportError(true);
                            return;
                        }
                        try {
                            const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
                            if (contacts.length > 0) {
                                const c = contacts[0];
                                if ((_a = c.name) === null || _a === void 0 ? void 0 : _a[0])
                                    setLocalName(c.name[0]);
                                if ((_b = c.tel) === null || _b === void 0 ? void 0 : _b[0])
                                    setPhone(c.tel[0]);
                            }
                        }
                        catch (err) { /* المستخدم ألغى الاختيار أو رفض الإذن — لا داعي لرسالة خطأ */ }
                    }, className: `flex ${rowStart()} items-center gap-1 rounded-xl px-3 border shrink-0`, style: { borderColor: colors.border } },
                    React.createElement(UserCircle, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primary } }, t("jhat_alatsal")))),
            contactImportError && (React.createElement("p", { className: "text-[10px] mb-3", style: { color: colors.textMuted } }, t("mtsfhk_ma_ydam_akhtyar"))),
            hasChain && !isEdit && (React.createElement(Card, { className: "mb-3", style: { borderColor: colors.primary } },
                React.createElement("div", { className: `flex ${rowStart()} items-start gap-2 mb-2` },
                    React.createElement(GitBranch, { size: 14, color: colors.primary, className: "mt-0.5 shrink-0" }),
                    React.createElement("div", { className: `flex-1 ${textStart()}` },
                        React.createElement("p", { className: "text-[11px] font-extrabold mb-1", style: { color: colors.primary } },
                            t("pf_aktshfna"),
                            chainParts.length,
                            t("pf_asma")),
                        chainParts.map((nm, i) => (React.createElement("p", { key: i, className: "text-[10px]", style: { color: colors.textMuted } }, i === 0 ? "• " + nm : "↑ " + nm + (i === 1 ? t("pf_alwald") : i === 2 ? t("pf_aljd") : t("pf_slf", { i }))))))),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => setUseChain(true), className: "flex-1 py-1.5 rounded-lg text-[10px] font-extrabold", style: {
                            backgroundColor: useChain ? colors.primary : colors.card,
                            color: useChain ? "#fff" : colors.text,
                            border: `1px solid ${useChain ? colors.primary : colors.border}`,
                        } }, t("adf_alaswl_ayda")),
                    React.createElement("button", { onClick: () => setUseChain(false), className: "flex-1 py-1.5 rounded-lg text-[10px] font-bold", style: {
                            backgroundColor: !useChain ? colors.accent : colors.card,
                            color: !useChain ? "#fff" : colors.text,
                            border: `1px solid ${!useChain ? colors.accent : colors.border}`,
                        } }, t("alasm_kamla_bla_tfkyk"))),
                React.createElement("p", { className: `text-[10px] ${textStart()} mt-1.5`, style: { color: colors.textMuted } }, useChain
                    ? t("pf_ydaf_wtrbt", { name: chainParts[0] })
                    : t("pf_yhfz_alasm")))),
            React.createElement("div", { className: "mb-4" }),
            duplicateMatch && (React.createElement(Card, { className: `mb-4 flex ${rowStart()} items-start gap-2`, style: { borderColor: colors.accent } },
                React.createElement(AlertTriangle, { size: 14, color: colors.accent, className: "mt-0.5" }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("p", { className: "text-[11px] font-bold mb-1", style: { color: colors.accent } }, duplicateMatches.length > 1
                        ? t("ashkhas_bnfs_alasm_fy", { length: duplicateMatches.length })
                        : t("pf_ywjd_shkhs")),
                    duplicateMatches.map((p) => (React.createElement("p", { key: p.id, className: "text-[10px]", style: { color: colors.textMuted } },
                        "\u2022 ",
                        dupLineage(p)))),
                    React.createElement("p", { className: "text-[10px] mt-1", style: { color: colors.textMuted } }, t("lw_kan_shkhsa_akhr"))))),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("sla_alqraba")),
            React.createElement("button", { "aria-label": t("altaly"), onClick: () => setShowKinshipPicker(true), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl border px-3 py-2.5 mb-4`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, kinship),
                React.createElement(ChevronLeft, { size: 15, color: colors.textMuted, style: { transform: "rotate(-90deg)" } })),
            showKinshipPicker && (React.createElement(React.Fragment, null,
                React.createElement("div", { onClick: () => setShowKinshipPicker(false), style: { position: "fixed", inset: 0, zIndex: 30, backgroundColor: "rgba(0,0,0,0.4)" } }),
                React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 31, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70vh", display: "flex", flexDirection: "column" } },
                    React.createElement("div", { className: "flex justify-center pt-3 pb-2" },
                        React.createElement("div", { style: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border } })),
                    React.createElement("h3", { className: "text-sm font-extrabold text-center mb-2", style: { color: colors.text } }, t("akhtr_sla_alqraba")),
                    React.createElement("div", { className: "px-4 pb-2" },
                        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-full border px-3 py-1.5`, style: { borderColor: colors.border, backgroundColor: colors.bg } },
                            React.createElement(Search, { size: 13, color: colors.textMuted }),
                            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: kinshipSearch, onChange: (e) => setKinshipSearch(e.target.value), placeholder: t("abhth_an_sla"), className: "flex-1 bg-transparent text-xs outline-none", style: { color: colors.text, minWidth: 0 } }),
                            kinshipSearch && (React.createElement("button", { onClick: () => setKinshipSearch(""), "aria-label": t("msh_albhth") },
                                React.createElement(X, { size: 12, color: colors.textMuted }))))),
                    React.createElement("div", { style: { overflowY: "auto", paddingBottom: 12 } },
                        KINSHIP_SECTIONS.map((sec) => {
                            const q = kinshipSearch.trim();
                            const items = q ? sec.items.filter((k) => k.includes(q) || kinshipLabel(k).toLowerCase().includes(q.toLowerCase())) : sec.items;
                            if (items.length === 0)
                                return null;
                            // البحث يفتح كل الأقسام؛ وإلا يُفتح القسم الحاوي للصلة الحالية
                            const open = q ? true : (openKinshipSection !== null && openKinshipSection !== void 0 ? openKinshipSection : (sec.items.includes(kinship) ? sec.key : "usul")) === sec.key;
                            return (React.createElement("div", { key: sec.key },
                                React.createElement("button", { onClick: () => setOpenKinshipSection(open ? "" : sec.key), className: `w-full flex ${rowStart()} items-center gap-2 px-5 py-2.5`, style: { backgroundColor: colors.bg, borderBottom: `1px solid ${colors.border}` } },
                                    React.createElement("span", { style: { fontSize: 13 } }, sec.icon),
                                    React.createElement("span", { className: `flex-1 ${textStart()} text-xs font-extrabold`, style: { color: colors.text } }, t(sec.titleKey)),
                                    React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, items.length),
                                    React.createElement(ChevronLeft, { size: 13, color: colors.textMuted, style: { transform: open ? "rotate(-90deg)" : "scaleX(-1)" } })),
                                open && items.map((k) => (React.createElement("button", { key: k, disabled: k === SELF_KINSHIP && selfTaken, onClick: () => {
                                        if (k === SELF_KINSHIP && selfTaken)
                                            return;
                                        setKinship(k);
                                        setRelationType(KINSHIP_RELATION_DEFAULTS[k] || "child");
                                        if (KINSHIP_GENDER_DEFAULTS[k])
                                            setGender(KINSHIP_GENDER_DEFAULTS[k]);
                                        setShowKinshipPicker(false);
                                        setKinshipSearch("");
                                    }, className: `w-full flex ${rowStart()} items-center justify-between px-7 py-2.5 border-b`, style: { borderColor: colors.border, opacity: (k === SELF_KINSHIP && selfTaken) ? 0.45 : 1 } },
                                    React.createElement("span", { className: `flex ${rowStart()} items-center gap-2` },
                                        React.createElement("span", { className: "text-sm", style: { color: kinship === k ? colors.primary : colors.text, fontWeight: kinship === k ? 700 : 400 } }, kinshipLabel(k)),
                                        ((k === SELF_KINSHIP && selfTaken)
                                            ? React.createElement("span", { className: "text-[9px] px-1.5 py-0.5 rounded-full font-bold", style: { backgroundColor: colors.bg, color: colors.textMuted } }, t("pf_nfsy_makhwdh"))
                                            : (!hasNoProximity(k) && React.createElement("span", { className: "text-[9px] px-1.5 py-0.5 rounded-full font-bold", style: { backgroundColor: colors.primaryLight, color: colors.primaryDark } }, proximityForKinship(k))))),
                                    kinship === k && React.createElement(Check, { size: 16, color: colors.primary }))))));
                        }),
                        kinshipSearch.trim() && KINSHIP_SECTIONS.every((s2) => s2.items.filter((k) => k.includes(kinshipSearch.trim()) || kinshipLabel(k).toLowerCase().includes(kinshipSearch.trim().toLowerCase())).length === 0) && (React.createElement("p", { className: "text-xs text-center py-6", style: { color: colors.textMuted } }, t("la_twjd_sla_bhdha"))))))),
            kinship === SELF_KINSHIP && existingPersons.some(isSelfPerson) && (React.createElement("div", { className: `mb-4 px-3 py-2 rounded-xl ${textStart()}`, style: { backgroundColor: colors.primaryLight, border: `1px solid ${colors.accent}` } },
                React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.accent } }, t("pf_nfsy_mkrr")))),
            KINSHIP_GENDER_DEFAULTS[kinship] ? (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mb-4 px-3 py-2 rounded-xl`, style: { backgroundColor: colors.bg, border: `1px solid ${colors.border}` } },
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, t("aljns")),
                React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.primary } }, gender === "female" ? t("pf_antha") : t("pf_dhkr")),
                React.createElement("span", { className: `text-[10px] flex-1 ${textEnd()}`, style: { color: colors.textMuted } },
                    t("pf_mstntj"),
                    kinshipLabel(kinship),
                    "\u00BB"))) : (React.createElement(React.Fragment, null,
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("aljns_2")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` },
                    React.createElement(Chip, { label: t("dhkr"), active: gender === "male", onPress: () => setGender("male") }),
                    React.createElement(Chip, { label: t("antha"), active: gender === "female", onPress: () => setGender("female") })))),
            hasNoProximity(kinship) ? (React.createElement("div", { className: `mb-4 px-3 py-2 rounded-xl ${textStart()}`, style: { backgroundColor: colors.bg, border: `1px solid ${colors.border}` } },
                React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, t(kinship === SELF_KINSHIP ? "pf_nfsy_la_qrb" : "pf_sabq_la_qrb")))) : (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 mb-4 px-3 py-2 rounded-xl`, style: { backgroundColor: colors.bg, border: `1px solid ${colors.border}` } },
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, t("drja_alqrb")),
                React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.primary } },
                    proximityForKinship(kinship),
                    " \u2014 ",
                    proximityLabels[proximityForKinship(kinship)]),
                React.createElement("span", { className: `text-[10px] flex-1 ${textEnd()}`, style: { color: colors.textMuted } },
                    t("pf_tdhkyr_kl"),
                    proximityContactDays[proximityForKinship(kinship)],
                    t("pf_ywm")))),
            motherApplicable && (React.createElement("div", { className: "mb-4" },
                React.createElement("label", { className: "text-xs font-bold mb-1 block", style: { color: colors.text } }, t("pf_alom")),
                React.createElement("p", { className: `text-[10px] mb-2 ${textStart()}`, style: { color: colors.textMuted } }, t("pf_alom_hint")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-1.5` },
                    wivesOfFather.map((w) => (React.createElement(Chip, { key: w.id, label: w.local_name, active: motherId === w.id, onPress: () => setMotherId(w.id) }))),
                    React.createElement(Chip, { label: t("pf_alom_unset"), active: !motherId, onPress: () => setMotherId(null) })))),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("rqm_alhatf_akhtyary")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: phone, onChange: (e) => setPhone(e.target.value), placeholder: "09XXXXXXXX", className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("tarykh_almylad_akhtyary")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` },
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: birthday, onChange: (e) => setBirthday(e.target.value), placeholder: t("mm_dd_mthal_07"), className: "flex-1 border rounded-xl px-3 py-2.5 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, minWidth: 0 } }),
                React.createElement("input", { dir: "ltr", value: birthYear, onChange: (e) => setBirthYear(e.target.value), placeholder: t("sna_almylad"), type: "number", className: "w-28 border rounded-xl px-3 py-2.5 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } })),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("hala_khasa_akhtyary")),
            React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-4` },
                React.createElement(Chip, { label: t("la_ywjd"), active: !statusDetail, onPress: () => setStatusDetail("") }),
                Object.entries(statusLabels).map(([key, label]) => (React.createElement(Chip, { key: key, label: label, active: statusDetail === key, onPress: () => setStatusDetail(key) })))),
            React.createElement(Card, { className: "mb-4" },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5` },
                    React.createElement("button", { onClick: () => setIsDeceased(!isDeceased), className: "w-11 h-6 rounded-full relative", style: { backgroundColor: isDeceased ? colors.danger : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [isDeceased ? "right" : "left"]: 2 } })),
                    React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("mtwfa_rhmh_allh")),
                    React.createElement(Flower2, { size: 16, color: colors.textMuted })),
                isDeceased && (React.createElement("input", { value: deathDate, onChange: (e) => setDeathDate(e.target.value), placeholder: t("tarykh_alwfaa_akhtyary_mthal"), dir: "ltr", className: "w-full border rounded-xl px-3 py-2.5 text-sm mt-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }))),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("mlahzat_hra_akhtyary")),
            React.createElement("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: t("akhr_mkalma_mnasba_ay"), rows: 3, className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4 resize-none", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            !isEdit && existingPersons.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                    React.createElement("label", { className: "text-xs font-bold", style: { color: colors.text } }, t("rbt_alaqa_qraba_yzhr")),
                    React.createElement("button", { onClick: () => setLinkEnabled(!linkEnabled), className: "w-10 h-5 rounded-full relative", style: { backgroundColor: linkEnabled ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-4 h-4 rounded-full bg-white", style: { [linkEnabled ? "right" : "left"]: 2 } }))),
                linkEnabled && (React.createElement(Card, { className: "mb-4" },
                    React.createElement("label", { className: "text-[11px] font-bold mb-1.5 block", style: { color: colors.textMuted } },
                        localName.trim() || t("pf_alqryb_aljdyd"),
                        t("pf_hw")),
                    React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` }, KINSHIP_RELATION_TYPES.map((rel) => React.createElement(Chip, { key: rel.key, label: t(rel.labelKey), active: relationType === rel.key, onPress: () => setRelationType(rel.key) }))),
                    React.createElement("label", { className: `text-[11px] font-bold mb-1.5 block ${textStart()}`, style: { color: colors.textMuted } }, t("alshkhs_almrtbt_bh_mrtbwn")),
                    React.createElement("div", { className: "mb-2", style: { maxHeight: 190, overflowY: "auto" } }, lineageSorted.map((p) => (React.createElement("button", { key: p.id, onClick: () => setRelatedToId(p.id), className: `w-full flex ${rowStart()} items-center gap-2 px-2.5 py-2 rounded-xl mb-1 ${textStart()}`, style: {
                            backgroundColor: relatedToId === p.id ? colors.primaryLight : colors.bg,
                            border: `1px solid ${relatedToId === p.id ? colors.primary : colors.border}`,
                        } },
                        React.createElement("span", { className: "w-4 h-4 rounded-full flex items-center justify-center shrink-0 border-2", style: { borderColor: relatedToId === p.id ? colors.primary : colors.border, backgroundColor: relatedToId === p.id ? colors.primary : "transparent" } }, relatedToId === p.id && React.createElement(Check, { size: 9, color: "#fff" })),
                        React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                            React.createElement("p", { className: "text-[11px] font-bold truncate", style: { color: colors.text } }, lineageLabel(p)),
                            React.createElement("p", { className: "text-[9px]", style: { color: colors.textMuted } }, kinshipLabel(p.kinship))))))),
                    React.createElement("p", { className: "text-[11px]", style: { color: colors.primary } },
                        localName.trim() || t("pf_alqryb_aljdyd"),
                        " ", (_f = KINSHIP_RELATION_TYPES.find((x) => x.key === relationType)) ? t(_f.labelKey) : "",
                        " ",
                        ((_g = existingPersons.find((p) => p.id === relatedToId)) === null || _g === void 0 ? void 0 : _g.local_name) || "؟"))))),
            otherGroups.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                    React.createElement("label", { className: "text-xs font-bold", style: { color: colors.text } }, t("nfs_hdha_alshkhs_mwjwd")),
                    React.createElement("button", { onClick: () => setCrossLinkEnabled(!crossLinkEnabled), className: "w-10 h-5 rounded-full relative", style: { backgroundColor: crossLinkEnabled ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-4 h-4 rounded-full bg-white", style: { [crossLinkEnabled ? "right" : "left"]: 2 } }))),
                crossLinkEnabled && (React.createElement(Card, { className: "mb-4" },
                    React.createElement("label", { className: "text-[11px] font-bold mb-1.5 block", style: { color: colors.textMuted } }, t("almjmwaa")),
                    React.createElement("select", { value: crossLinkGroupId, onChange: (e) => { var _a, _b; setCrossLinkGroupId(e.target.value); setCrossLinkPersonId((_b = (_a = otherGroups.find((g) => g.groupId === e.target.value)) === null || _a === void 0 ? void 0 : _a.persons[0]) === null || _b === void 0 ? void 0 : _b.id); }, className: "w-full border rounded-xl px-3 py-2 text-xs mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } }, otherGroups.map((g) => React.createElement("option", { key: g.groupId, value: g.groupId }, g.groupName))),
                    React.createElement("label", { className: "text-[11px] font-bold mb-1.5 block", style: { color: colors.textMuted } }, t("alshkhs")),
                    (crossLinkGroup === null || crossLinkGroup === void 0 ? void 0 : crossLinkGroup.persons.length) > 0 ? (React.createElement(FamilyPersonPicker, { persons: crossLinkGroup.persons,
                        // ⛔ صلات المجموعة الأخرى ليست بين يدي هذا النموذج، فيسقط
                        // التمييز إلى «الاسم (الصلة)» — أصدقُ من اختلاق نسبٍ لا نملكه
                        relations: [], value: crossLinkPersonId, onChange: setCrossLinkPersonId, maxHeight: 200 })) : (React.createElement("p", { className: "text-[11px]", style: { color: colors.textMuted } }, t("la_ywjd_ashkhas_bhdhh"))),
                    React.createElement("p", { className: "text-[10px] mt-1", style: { color: colors.primary } }, t("rqm_alhatf_wtarykh_almylad")))))),
            React.createElement(Button, { label: isEdit ? t("pf_hfz") : t("pf_idafa_alqryb"), onPress: handleSave, disabled: !localName.trim() }),
            isEdit && onDelete && (React.createElement("div", { className: "mt-4" }, !confirmDelete ? (React.createElement("button", { onClick: () => setConfirmDelete(true), className: `w-full flex ${rowStart()} items-center justify-center gap-2 rounded-xl p-3 border`, style: { borderColor: colors.danger } },
                React.createElement(Trash2, { size: 15, color: colors.danger }),
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.danger } }, t("hdhf_hdha_alqryb")))) : (React.createElement("div", { className: "rounded-xl border p-3", style: { borderColor: colors.danger } },
                React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, t("takyd_alhdhf_ma_ynrja")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => { onDelete(); onClose(); }, className: "flex-1 rounded-xl py-2", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-xs font-bold text-white" }, t("nam_ahdhf"))),
                    React.createElement("button", { onClick: () => setConfirmDelete(false), className: "flex-1 rounded-xl py-2 border", style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("ilgha")))))))))));
}
// ⛔ الرقاقة تصلح لثلاثة خيارات لا لاثنين وعشرين. ولاثنين وعشرين شخصاً
// تصير حائطاً بترتيب الإدخال، وتقصّ النسبَ الذي يميّز المتشابهين.
// القائمة تبحث وتصنّف وتُظهر النسب كاملاً في سطرٍ ثانٍ.
function personSectionKey(p) {
    const sec = KINSHIP_SECTIONS.find((x) => x.items.indexOf(p && p.kinship) !== -1); // ⛔ مقارنة لا عرض
    return sec ? sec.key : "other"; // ⛔ مُعرِّف لا نصّ
}
// أبجديّ بترتيب اللغة المعروضة لا بترتيب الشيفرة
function sortPersonsByName(list) {
    return (list || []).slice().sort((a, b) => String(a.local_name || "").localeCompare(String(b.local_name || ""), loc()));
}
function filterPersons(persons, section, needle, labelOf) {
    const q = String(needle || "").trim();
    return sortPersonsByName((persons || [])
        .filter((p) => section === "all" || personSectionKey(p) === section)
        .filter((p) => !q
            || String(p.local_name || "").indexOf(q) !== -1
            || String(labelOf ? labelOf(p) : "").indexOf(q) !== -1));
}
function FamilyPersonPicker({ persons, relations = [], value, onChange, maxHeight = 260 }) {
    const { colors } = useTheme();
    const [q, setQ] = useState("");
    const [section, setSection] = useState("all");
    const { distinctLabel } = buildLineageHelpers(persons, relations);
    const tabs = KINSHIP_SECTIONS.filter((sec) => persons.some((p) => personSectionKey(p) === sec.key));
    const shown = filterPersons(persons, section, q, distinctLabel);
    return (React.createElement("div", { className: "mb-4" },
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 border rounded-xl px-3 py-2 mb-2`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(Search, { size: 14, color: colors.textMuted }),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: q, onChange: (e) => setQ(e.target.value), placeholder: t("pp_bhth"), className: `flex-1 min-w-0 bg-transparent text-sm outline-none ${textStart()}`, style: { color: colors.text } })),
        tabs.length > 1 && React.createElement("div", { className: `flex ${rowStart()} gap-2 overflow-x-auto pb-1 mb-2` },
            React.createElement(Chip, { label: t("pp_alkl"), active: section === "all", onPress: () => setSection("all") }),
            tabs.map((sec) => React.createElement(Chip, { key: sec.key, label: sec.icon + " " + t(sec.titleKey), active: section === sec.key, onPress: () => setSection(sec.key) }))),
        React.createElement("div", { className: "rounded-xl border overflow-y-auto", style: { borderColor: colors.border, maxHeight } },
            shown.length === 0 && React.createElement("div", { className: `text-xs p-3 ${textStart()}`, style: { color: colors.textMuted } }, t("pp_la_ntayj")),
            shown.map((p) => {
                const label = distinctLabel(p);
                const sub = label === p.local_name ? kinshipLabel(p.kinship) : label;
                const active = value === p.id;
                return (React.createElement("button", { key: p.id, onClick: () => onChange(p.id), className: `w-full flex ${rowStart()} items-center gap-2 px-3 py-2.5 border-b ${textStart()}`, style: { borderColor: colors.border, backgroundColor: active ? colors.primaryLight : "transparent" } },
                    React.createElement("div", { className: "flex-1 min-w-0" },
                        React.createElement("div", { className: "text-sm font-bold truncate", style: { color: active ? colors.primaryDark : colors.text } }, p.local_name),
                        React.createElement("div", { className: "text-[10px] truncate", style: { color: colors.textMuted } }, sub)),
                    active && React.createElement(Check, { size: 15, color: colors.primary })));
            }))));
}
function FamilyAddEventSheet({ persons, relations = [], initial, onSave, onClose }) {
    var _a;
    const { colors } = useTheme();
    const [personId, setPersonId] = useState((initial && initial.personId) || ((_a = persons[0]) === null || _a === void 0 ? void 0 : _a.id));
    const [type, setType] = useState((initial && initial.type) || "success");
    const [title, setTitle] = useState((initial && initial.title) || "");
    const [desc, setDesc] = useState((initial && initial.desc) || "");
    // ⛔ حدثٌ قديم بلا طابع: يبدأ الحقل فارغاً ولا نختلق له تاريخاً
    const [dateStr, setDateStr] = useState(tsToDateInput(initial ? eventDateTs(initial) : Date.now()));
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t(initial ? "ev_tadyl_hdth" : "hdth_jdyd"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("alqryb")),
            React.createElement(FamilyPersonPicker, { persons: persons, relations: relations, value: personId, onChange: setPersonId }),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("nwa_alhdth")),
            React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-4` }, Object.keys(eventTypeLabelKeys).map((k) => React.createElement(Chip, { key: k, label: eventTypeLabel(k), active: type === k, onPress: () => setType(k) }))),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("anwan_alhdth")),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: title, onChange: (e) => setTitle(e.target.value), placeholder: t("mthal_tkhrj_sfr_lada"), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("ev_tarykh")),
            React.createElement("input", { type: "date", value: dateStr, onChange: (e) => setDateStr(e.target.value), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("ev_wsf")),
            React.createElement("textarea", { dir: isRTL() ? "rtl" : "ltr", value: desc, onChange: (e) => setDesc(e.target.value), rows: 3, className: `w-full border rounded-xl px-3 py-2.5 text-sm mb-4 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement(Card, { className: `mb-4 flex ${rowStart()} items-center gap-2` },
                React.createElement(Lightbulb, { size: 14, color: colors.accent }),
                React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } },
                    "\u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0645\u0642\u062A\u0631\u062D \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B: ",
                    eventSuggestedActionLabel(type))),
            React.createElement(Button, { label: t("hfz_alhdth"), disabled: !title.trim(), onPress: () => { onSave(personId, type, title.trim(), dateInputToTs(dateStr), desc.trim()); onClose(); } }))));
}
function FamilyAddScheduleSheet({ persons, relations = [], preselectedPersonId, initial, onSave, onClose }) {
    var _a;
    const { colors } = useTheme();
    const [personId, setPersonId] = useState((initial && initial.personId) || preselectedPersonId || ((_a = persons[0]) === null || _a === void 0 ? void 0 : _a.id));
    const [action, setAction] = useState((initial && initial.action) || "call");
    const [freqKey, setFreqKey] = useState(initial ? scheduleFreqKey(initial) : "weekly");
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t(initial ? "sc_tadyl_mwad" : "mwad_jdyd"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("alqryb")),
            React.createElement(FamilyPersonPicker, { persons: persons, relations: relations, value: personId, onChange: setPersonId }),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("tryqa_altwasl")),
            React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-4` }, Object.keys(actionLabelKeys).map((k) => React.createElement(Chip, { key: k, label: actionLabel(k), active: action === k, onPress: () => setAction(k) }))),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("sc_tkrar")),
            React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-4` }, SCHEDULE_FREQS.map((f) => React.createElement(Chip, { key: f.key, label: t(f.labelKey), active: freqKey === f.key, onPress: () => setFreqKey(f.key) }))),
            React.createElement(Button, { label: t("hfz_almwad"), onPress: () => { onSave(personId, action, freqKey); onClose(); } }))));
}
// ============================================================================
// شاشات المحادثات — مع تحذير بارز إنها غير مشفّرة طرف لطرف فعلياً بعد
// (نفس القرار المتّبع بمشروع RN الحقيقي: مو تشفير شكلي يبان آمن وما هو آمن)
// ============================================================================
function LockedChatsScreen({ conversations, lockedConversationIds, correctPin, onOpenChat, onClose }) {
    const { colors } = useTheme();
    const [enteredPin, setEnteredPin] = useState("");
    const [unlocked, setUnlocked] = useState(false);
    const [error, setError] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockedUntil, setLockedUntil] = useState(0);
    const [now, setNow] = useState(Date.now());
    const lockedConversations = conversations.filter((c) => lockedConversationIds.includes(c.id));
    useEffect(() => {
        if (lockedUntil > Date.now()) {
            const timer = setInterval(() => setNow(Date.now()), 1000);
            return () => clearInterval(timer);
        }
    }, [lockedUntil]);
    const isRateLocked = lockedUntil > now;
    const lockSecondsLeft = Math.ceil((lockedUntil - now) / 1000);
    function handleSubmit() {
        if (isRateLocked)
            return;
        if (enteredPin === correctPin) {
            setUnlocked(true);
            setError(false);
            setFailedAttempts(0);
        }
        else {
            const next = failedAttempts + 1;
            setFailedAttempts(next);
            setError(true);
            setEnteredPin("");
            if (next >= 3) {
                setLockedUntil(Date.now() + 30000);
                setFailedAttempts(0);
            }
        }
    }
    if (!unlocked) {
        return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
            React.createElement(TopBar, { title: t("mhadthat_mqfwla"), onBack: onClose }),
            React.createElement("div", { className: "flex-1 flex flex-col items-center justify-center p-6" },
                React.createElement(Lock, { size: 36, color: colors.primary, className: "mb-4" }),
                React.createElement("p", { className: "text-sm font-bold text-center mb-4", style: { color: colors.text } }, t("adkhl_rmz_qfl_alttbyq")),
                isRateLocked ? (React.createElement("div", { className: "flex flex-col items-center gap-3" },
                    React.createElement("div", { className: "w-14 h-14 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger + "22" } },
                        React.createElement(Lock, { size: 24, color: colors.danger })),
                    React.createElement("p", { className: "text-sm font-extrabold", style: { color: colors.danger } }, "\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0643\u062B\u064A\u0631\u0629 \u2014 \u0627\u0646\u062A\u0638\u0631"),
                    React.createElement("p", { className: "text-2xl font-extrabold tabular-nums", style: { color: colors.danger } },
                        lockSecondsLeft,
                        "\u062B"),
                    React.createElement("p", { className: "text-xs text-center", style: { color: colors.textMuted } },
                        "\u0628\u0639\u062F ",
                        lockSecondsLeft,
                        " \u062B\u0627\u0646\u064A\u0629 \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B"))) : (React.createElement(React.Fragment, null,
                    React.createElement("input", { dir: "ltr", type: "password", value: enteredPin, onChange: (e) => setEnteredPin(e.target.value.replace(/\D/g, "").slice(0, 6)), placeholder: t("rmz_qfl_alttbyq"), className: "w-40 border rounded-xl px-3 py-3 text-center text-lg tracking-widest mb-3", style: { borderColor: error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.card }, autoFocus: true, onKeyDown: (e) => { if (e.key === "Enter" && enteredPin)
                            handleSubmit(); } }),
                    error && (React.createElement("p", { className: "text-xs mb-3", style: { color: colors.danger } },
                        t("rmz_ghyr_shyh"),
                        " ",
                        failedAttempts > 0 && `(${failedAttempts}/3)`)),
                    React.createElement(Button, { label: t("fth"), onPress: handleSubmit, disabled: !enteredPin }))))));
    }
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("mhadthat_mqfwla"), onBack: onClose }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            lockedConversations.length === 0 && React.createElement(EmptyState, { icon: Lock, label: t("la_twjd_mhadthat_mqfwla") }),
            lockedConversations.map((c) => {
                var _a;
                return (React.createElement("button", { key: c.id, onClick: () => onOpenChat(c), className: `w-full ${textStart()}` },
                    React.createElement(Card, { className: `flex ${rowStart()} items-center` },
                        React.createElement("div", { className: `w-11 h-11 rounded-full flex items-center justify-center ${ms("3")}`, style: { backgroundColor: colors.primaryLight } },
                            React.createElement("span", { className: "text-base font-extrabold", style: { color: colors.primaryDark } }, (_a = c.name) === null || _a === void 0 ? void 0 : _a.charAt(0))),
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("div", { className: "font-bold text-sm", style: { color: colors.text } }, c.name),
                            React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, c.lastMessage || "لا رسائل بعد")))));
            }))));
}
function StarredMessagesScreen({ starredMessages, onOpenConversation, onBack }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("alrsayl_almhfwza"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            starredMessages.length === 0 && React.createElement(EmptyState, { icon: Star, label: t("ma_hfzt_ay_rsala") }),
            starredMessages.map((s) => (React.createElement("button", { "aria-label": t("almfdla"), key: s.id, onClick: () => onOpenConversation(s.conversationId), className: `w-full ${textStart()}` },
                React.createElement(Card, { className: "mb-2" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-1` },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, s.conversationName),
                        React.createElement(Star, { size: 12, color: colors.accent, fill: colors.accent })),
                    React.createElement("p", { className: "text-xs", style: { color: colors.text } }, s.text),
                    React.createElement("span", { className: "text-[10px] mt-1 block", style: { color: colors.textMuted } }, new Date(s.ts).toLocaleDateString(loc(), { day: "numeric", month: "long" })))))))));
}
const NOTIFICATION_TONES = [
    { key: "default", labelKey: "tone_aftradya" },
    { key: "chime", labelKey: "tone_jrs" },
    { key: "note", labelKey: "tone_nghma_qsyra" },
    { key: "silent", labelKey: "tone_samta" },
];
function ChatSettingsScreen({ chatBackupEnabled, setChatBackupEnabled, chatFolders, onAddFolder, onDeleteFolder, defaultNotificationTone, setDefaultNotificationTone, lockedCount, onOpenLockedChats, showStoriesRow, setShowStoriesRow, showFamilyReminders, setShowFamilyReminders, onBack, }) {
    const { colors } = useTheme();
    const [showAddFolder, setShowAddFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("iadadat_almhadthat"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("button", { onClick: () => {
                    if (!window.confirm(t("symsh_kl_ma_hw")))
                        return;
                    try {
                        Object.keys(window.localStorage || {})
                            .filter((k) => k.startsWith(SAWA_STORE_PREFIX))
                            .forEach((k) => window.localStorage.removeItem(k));
                    }
                    catch (_a) { }
                    window.location.reload();
                }, className: "w-full mb-4" },
                React.createElement(Card, { className: `flex ${rowStart()} items-center gap-3` },
                    React.createElement(Trash2, { size: 17, color: colors.danger }),
                    React.createElement("div", { className: `flex-1 ${textStart()}` },
                        React.createElement("span", { className: "text-sm font-bold block", style: { color: colors.danger } }, t("msh_albyanat_almhfwza")),
                        React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } }, t("iaada_alttbyq_lhalth_alawla"))))),
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("anasr_shasha_almhadthat")),
            React.createElement(Card, { className: `flex ${rowStart()} items-start gap-2.5 mb-2` },
                React.createElement("button", { onClick: () => setShowStoriesRow === null || setShowStoriesRow === void 0 ? void 0 : setShowStoriesRow(!showStoriesRow), className: "w-11 h-6 rounded-full relative shrink-0 mt-0.5", style: { backgroundColor: showStoriesRow ? colors.primary : colors.border } },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [showStoriesRow ? "right" : "left"]: 2 } })),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("span", { className: "text-sm font-bold block mb-1", style: { color: colors.text } }, t("shryt_allhzat")),
                    React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("izhar_dwayr_allhzat_aala")))),
            React.createElement(Card, { className: `flex ${rowStart()} items-start gap-2.5 mb-4` },
                React.createElement("button", { onClick: () => setShowFamilyReminders === null || setShowFamilyReminders === void 0 ? void 0 : setShowFamilyReminders(!showFamilyReminders), className: "w-11 h-6 rounded-full relative shrink-0 mt-0.5", style: { backgroundColor: showFamilyReminders ? colors.primary : colors.border } },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [showFamilyReminders ? "right" : "left"]: 2 } })),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("span", { className: "text-sm font-bold block mb-1", style: { color: colors.text } }, t("tdhkyrat_sla_alrhm")),
                    React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("btaqat_tdhkyr_altwasl_walmwaayd")))),
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("aam")),
            React.createElement(Card, { className: `flex ${rowStart()} items-start gap-2.5 mb-4` },
                React.createElement("button", { onClick: () => setChatBackupEnabled(!chatBackupEnabled), className: "w-11 h-6 rounded-full relative shrink-0 mt-0.5", style: { backgroundColor: chatBackupEnabled ? colors.primary : colors.border } },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [chatBackupEnabled ? "right" : "left"]: 2 } })),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("span", { className: "text-sm font-bold block mb-1", style: { color: colors.text } }, t("nskha_ahtyatya_llmhadthat")),
                    React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("matla_aftradya_alwda_alakthr")))),
            React.createElement("button", { onClick: onOpenLockedChats, className: `w-full ${textStart()} block mb-4` },
                React.createElement(Card, { className: `flex ${rowStart()} items-center justify-between` },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                        React.createElement(Lock, { size: 15, color: colors.primary }),
                        React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("almhadthat_almwmna"))),
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                        lockedCount > 0 && React.createElement(Badge, { size: "sm", variant: "neutral", label: String(lockedCount) }),
                        React.createElement(ChevronLeft, { size: 15, color: colors.textMuted, style: { transform: "scaleX(-1)" } })))),
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("alishaarat")),
            React.createElement("label", { className: "text-[11px] font-bold mb-1.5 block", style: { color: colors.text } }, t("nghma_alishaar_alaftradya_llmhadthat")),
            React.createElement("select", { value: defaultNotificationTone, onChange: (e) => setDefaultNotificationTone(e.target.value), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }, NOTIFICATION_TONES.map((tone) => React.createElement("option", { key: tone.key, value: tone.key }, t(tone.labelKey)))),
            React.createElement("p", { className: "text-[10px] mt-[-0.75rem] mb-4", style: { color: colors.textMuted } }, t("tqdr_tkhss_nghma_mkhtlfa")),
            React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                React.createElement("p", { className: "text-xs font-bold", style: { color: colors.textMuted } }, t("mjldat_almhadthat")),
                React.createElement("button", { "aria-label": t("idafa"), onClick: () => setShowAddFolder(!showAddFolder) },
                    React.createElement(Plus, { size: 15, color: colors.primary }))),
            showAddFolder && (React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-3` },
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: newFolderName, onChange: (e) => setNewFolderName(e.target.value), placeholder: t("asm_almjld_mthal_aayla"), className: "flex-1 border rounded-xl px-3 py-2 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("button", { "aria-label": t("takyd"), onClick: () => { if (newFolderName.trim()) {
                        onAddFolder(newFolderName.trim());
                        setNewFolderName("");
                        setShowAddFolder(false);
                    } }, className: "rounded-xl px-3", style: { backgroundColor: colors.primary } },
                    React.createElement(Check, { size: 16, color: "#fff" })))),
            chatFolders.length === 0 ? (React.createElement(Card, null,
                React.createElement("p", { className: "text-xs text-center", style: { color: colors.textMuted } }, t("ma_fyh_mjldat_bad")))) : (chatFolders.map((f) => (React.createElement(Card, { key: f.id, className: `flex ${rowStart()} items-center justify-between mb-2` },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, f.name),
                React.createElement("button", { "aria-label": t("hdhf"), onClick: () => onDeleteFolder(f.id) },
                    React.createElement(Trash2, { size: 14, color: colors.danger })))))))));
}
// ============================================================
// StoriesRow — دوائر اللحظات (Stories) فوق قائمة المحادثات
// ============================================================
// ============================================================
// FamilyReminderCard — بطاقة التذكير الذكية في المحادثات
// ============================================================
// ============================================================
// SwipeableConvCard — بطاقة محادثة قابلة للسحب
// ============================================================
function SwipeableConvCard({ children, onArchive, onMute, onPin, onDelete, isMuted, isPinned }) {
    const { colors } = useTheme();
    const [swipeX, setSwipeX] = useState(0);
    const [startX, setStartX] = useState(null);
    const startYRef = useRef(0);
    // null = لم يُحسم الاتجاه بعد · "x" = سحب أفقي · "y" = تمرير رأسي
    const axisRef = useRef(null);
    const THRESHOLD = 72;      // كان 48 — كان يفتح مع أي لمسة عابرة
    const LONG_SWIPE = 160;    // سحب مطوّل = تنفيذ مباشر بلا أزرار
    const REST_ARCHIVE = 72;   // زر واحد
    const REST_OPTIONS = 132;  // ثلاثة أزرار
    function onTouchStart(e) {
        setStartX(e.touches[0].clientX);
        startYRef.current = e.touches[0].clientY;
        axisRef.current = null;
    }
    function onTouchMove(e) {
        if (startX === null) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startYRef.current;
        // قفل الاتجاه بعد أول 10px: إمّا سحب أفقي وإمّا تمرير رأسي، لا الاثنان.
        // بدونه كان التمرير في القائمة يفتح أزرار البطاقات بالخطأ.
        if (axisRef.current === null) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            axisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }
        if (axisRef.current === "y") return;
        setSwipeX(Math.max(-LONG_SWIPE - 40, Math.min(LONG_SWIPE + 40, dx)));
    }
    function onTouchEnd() {
        // السحب يميناً يكشف ما تحت يسار البطاقة، والعكس صحيح
        if (swipeX >= LONG_SWIPE) { setSwipeX(0); setStartX(null); axisRef.current = null; if (onArchive) onArchive(); return; }
        if (swipeX <= -LONG_SWIPE) { setSwipeX(0); setStartX(null); axisRef.current = null; if (onDelete) onDelete(); return; }
        if (swipeX > THRESHOLD) setSwipeX(REST_ARCHIVE);
        else if (swipeX < -THRESHOLD) setSwipeX(-REST_OPTIONS);
        else setSwipeX(0);
        setStartX(null);
        axisRef.current = null;
    }
    // لون خلفية الحذف عند السحب المطوّل — إشارة بصرية قبل رفع الإصبع
    const deleteArmed = swipeX <= -LONG_SWIPE;
    const archiveArmed = swipeX >= LONG_SWIPE;
    function act(fn) { setSwipeX(0); if (fn) fn(); }
    return (React.createElement("div", { className: "relative overflow-hidden rounded-xl mb-1.5", style: { backgroundColor: colors.bg } },
        // يسار البطاقة: يظهر عند السحب يميناً — الأرشفة
        React.createElement("div", { className: "absolute inset-y-0 left-0 flex flex-row items-center justify-center", style: { width: archiveArmed ? Math.abs(swipeX) : REST_ARCHIVE, backgroundColor: swipeX > 6 ? "#8B5CF6" : "transparent", transition: "background 0.15s", borderRadius: 12 } },
            swipeX > 6 && React.createElement("button", { "aria-label": t("arshfa"), onClick: () => act(onArchive), className: "flex flex-col items-center justify-center gap-0.5 w-full h-full" },
                React.createElement(Archive, { size: 18, color: "#fff" }),
                React.createElement("span", { className: "text-[9px] font-bold", style: { color: "#fff" } }, t("arshfa")))),
        // يمين البطاقة: يظهر عند السحب يساراً — كتم · تثبيت · حذف
        React.createElement("div", { className: "absolute inset-y-0 right-0 flex flex-row items-center justify-center gap-2 px-2", style: { width: deleteArmed ? Math.abs(swipeX) : REST_OPTIONS, backgroundColor: deleteArmed ? "#EF4444" : (swipeX < -6 ? colors.card : "transparent"), transition: "background 0.15s", borderRadius: 12 } },
            deleteArmed && React.createElement(Trash2, { size: 20, color: "#fff" }),
            !deleteArmed && swipeX < -6 && React.createElement(React.Fragment, null,
                React.createElement("button", { "aria-label": t("ktm"), onClick: () => act(onMute), className: "w-10 h-10 rounded-xl flex items-center justify-center", style: { backgroundColor: isMuted ? "#6B7280" : "#3B82F6" } },
                    React.createElement(BellOff, { size: 16, color: "#fff" })),
                React.createElement("button", { "aria-label": t("tthbyt"), onClick: () => act(onPin), className: "w-10 h-10 rounded-xl flex items-center justify-center", style: { backgroundColor: isPinned ? "#6B7280" : "#F59E0B" } },
                    React.createElement(Pin, { size: 16, color: "#fff" })),
                React.createElement("button", { "aria-label": t("hdhf"), onClick: () => act(onDelete), className: "w-10 h-10 rounded-xl flex items-center justify-center", style: { backgroundColor: "#EF4444" } },
                    React.createElement(Trash2, { size: 16, color: "#fff" })))),
        React.createElement("div", { onTouchStart: onTouchStart, onTouchMove: onTouchMove, onTouchEnd: onTouchEnd, style: {
                transform: "translateX(" + swipeX + "px)",
                transition: startX === null ? "transform 0.2s ease" : "none",
                position: "relative",
                backgroundColor: colors.bg,
                borderRadius: 12,
            } }, children)));
}

const FamilyReminderCard = React.memo(function FamilyReminderCard({ groupPersons, groupSchedules, onStartChat, conversations }) {
    const { colors } = useTheme();
    const [dismissed, setDismissed] = usePersistedState("dismissedReminders", []);
    const [dragX, setDragX] = useState(0);
    const [dragStart, setDragStart] = useState(null);
    const overdue = useMemo(() => getOverduePersons(groupPersons).filter(p => !dismissed.includes(p.id)), [groupPersons, dismissed]);
    const dueSchedules = useMemo(() => getDueSchedules(groupSchedules, groupPersons).filter(s => !dismissed.includes(s.id)).slice(0, 2), [groupSchedules, groupPersons, dismissed]);
    // السحب لليسار لإزالة البطاقة
    function dragHandlers(id) {
        return {
            onTouchStart: (e) => setDragStart(e.touches[0].clientX),
            onTouchMove: (e) => {
                if (dragStart === null)
                    return;
                setDragX(Math.min(0, e.touches[0].clientX - dragStart));
            },
            onTouchEnd: () => {
                if (dragX < -90)
                    setDismissed(d => [...d, id]);
                setDragX(0);
                setDragStart(null);
            },
        };
    }
    const dragStyle = {
        transform: `translateX(${dragX}px)`,
        opacity: 1 - Math.min(1, Math.abs(dragX) / 160),
        transition: dragStart === null ? "transform .2s ease, opacity .2s ease" : "none",
    };
    if (overdue.length === 0 && dueSchedules.length === 0)
        return null;
    const urgentPerson = overdue[0];
    const days = urgentPerson ? daysSinceContact(urgentPerson.lastContactDate) : 0;
    const limit = urgentPerson ? (proximityContactDays[urgentPerson.proximity] || 30) : 0;
    const isVeryLate = days > limit * 1.5;
    function handleChat(person) {
        // ابحث عن محادثة موجودة بنفس الاسم أو أنشئ جديدة
        const existing = conversations === null || conversations === void 0 ? void 0 : conversations.find(c => c.name && person.local_name && c.name.includes(person.local_name.split(" ")[0]));
        if (existing && onStartChat) {
            onStartChat(existing);
        }
        else if (onStartChat) {
            // محادثة جديدة افتراضية
            onStartChat({ id: `family-${person.id}`, name: person.local_name, lastMessage: null });
        }
    }
    return (React.createElement("div", { className: "mx-3 mt-2 mb-1" },
        urgentPerson && (React.createElement("div", { ...dragHandlers(urgentPerson.id), className: `rounded-xl p-2.5 mb-1.5 flex ${rowStart()} items-start gap-2`, style: {
                ...dragStyle,
                backgroundColor: isVeryLate ? "#ef444415" : colors.accent + "15",
                border: `1px solid ${isVeryLate ? "#ef444440" : colors.accent + "40"}`,
            } },
            React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-extrabold text-xs", style: { backgroundColor: isVeryLate ? "#ef4444" : colors.accent, color: "#fff" } }, urgentPerson.local_name.charAt(0)),
            React.createElement("div", { className: `flex-1 ${textStart()} min-w-0` },
                React.createElement("p", { className: "text-xs font-extrabold", style: { color: isVeryLate ? "#ef4444" : colors.accent } }, isVeryLate ? "⚠️ تجاوزت حد التواصل!" : "💛 حان وقت التواصل"),
                React.createElement("p", { className: "text-[11px] mt-0.5", style: { color: colors.text } },
                    t("lm_ttwasl_ma"),
                    " ",
                    React.createElement("b", null, urgentPerson.local_name),
                    " ",
                    t("mndh"),
                    " ",
                    React.createElement("b", null,
                        days,
                        " \u064A\u0648\u0645"),
                    overdue.length > 1 && ` (و${overdue.length - 1} آخرين)`)),
            React.createElement("div", { className: "flex flex-col gap-1 shrink-0" },
                React.createElement("button", { onClick: () => handleChat(urgentPerson), className: "px-3 py-1.5 rounded-xl text-[10px] font-extrabold", style: { backgroundColor: isVeryLate ? "#ef4444" : colors.accent, color: "#fff" } }, t("raslh_alan")),
                React.createElement("button", { onClick: () => setDismissed(d => [...d, urgentPerson.id]), className: "text-[10px] text-center", style: { color: colors.textMuted } }, t("lahqa_2"))))),
        dueSchedules.map(s => {
            var _a;
            return (React.createElement("div", { key: s.id, ...dragHandlers(s.id), className: `rounded-2xl p-3 mb-2 flex ${rowStart()} items-center gap-3`, style: { ...dragStyle, backgroundColor: colors.primary + "12", border: `1px solid ${colors.primary}33` } },
                React.createElement("span", { style: { fontSize: 18 } }, s.action === "call" ? "📞" : s.action === "visit" ? "🤝" : s.action === "msg" ? "💬" : "📋"),
                React.createElement("div", { className: `flex-1 ${textStart()} min-w-0` },
                    React.createElement("p", { className: "text-[11px] font-bold", style: { color: colors.text } },
                        s.action === "call" ? "مكالمة" : s.action === "visit" ? "زيارة" : "تواصل",
                        " \u0645\u0639 ",
                        React.createElement("b", null, (_a = s.person) === null || _a === void 0 ? void 0 : _a.local_name)),
                    React.createElement("p", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } },
                        scheduleFreqLabel(scheduleFreqKey(s)),
                        " — ",
                        scheduleDueLabel(s))),
                React.createElement("button", { onClick: () => s.action !== "visit" && handleChat(s.person), className: "px-2.5 py-1.5 rounded-xl text-[10px] font-bold", style: { backgroundColor: colors.primary + "22", color: colors.primary } }, s.action === "visit" ? "خطط" : "ابدأ")));
        })));
});
const StoriesRow = React.memo(function StoriesRow({ momentsPosts, onOpenMoments, conversations, onOpenChat, myName = "أنت" }) {
    const { colors } = useTheme();
    // بناء قائمة الـ stories: "أنت" أولاً ثم أصحاب اللحظات
    const activePosts = momentsPosts.filter(p => !p.expiresAt || p.expiresAt > Date.now());
    const myPost = activePosts.find(p => p.authorId === "u-1");
    const others = activePosts.filter(p => p.authorId !== "u-1");
    const stories = [
        { id: "me", name: myName, hasStory: !!myPost, isMe: true },
        ...others.map(p => ({ id: p.id, name: p.authorName || "مستخدم", hasStory: true, isMe: false })),
    ];
    if (stories.length === 0 && activePosts.length === 0)
        return null;
    return (React.createElement("div", { className: "overflow-x-auto", style: { borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.bg } },
        React.createElement("div", { style: { display: "flex", flexDirection: "row", gap: 12, padding: "10px 14px", minWidth: "max-content" } }, stories.map((s) => (React.createElement("button", { key: s.id, onClick: onOpenMoments, className: "flex flex-col items-center gap-1 shrink-0" },
            React.createElement("div", { className: "relative w-14 h-14 rounded-full flex items-center justify-center", style: {
                    background: s.hasStory
                        ? `linear-gradient(135deg, ${colors.accent}, ${colors.primary})`
                        : `${colors.border}`,
                    padding: s.hasStory ? 2 : 0,
                } },
                React.createElement("div", { className: "w-full h-full rounded-full flex items-center justify-center", style: { backgroundColor: colors.card, padding: s.hasStory ? 2 : 0 } },
                    React.createElement("div", { className: "w-full h-full rounded-full flex items-center justify-center", style: { backgroundColor: colors.primaryLight } }, s.isMe ? (React.createElement("div", { className: "relative" },
                        React.createElement(User, { size: 22, color: colors.primaryDark }),
                        !s.hasStory && (React.createElement("div", { className: "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary, border: `2px solid ${colors.card}` } },
                            React.createElement(Plus, { size: 9, color: "#fff" }))))) : (React.createElement(User, { size: 22, color: colors.primaryDark }))))),
            React.createElement("span", { className: "text-[10px] font-bold truncate", style: { color: colors.textMuted, maxWidth: 52 } }, s.isMe ? t("qsty") : s.name.split(" ")[0])))))));
});
// ============================================================
// ArchivedChatsScreen — المحادثات المؤرشفة
// ============================================================
function ArchivedChatsScreen({ conversations, archivedIds, mutedIds, onOpenChat, onUnarchive, onBack }) {
    const { colors } = useTheme();
    const list = conversations
        .filter((c) => archivedIds.includes(c.id))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("almwrshfa"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto px-3 py-2" },
            list.length === 0 && React.createElement(EmptyState, { icon: Archive, label: t("ma_fy_mhadthat_mwrshfa") }),
            list.map((c) => (React.createElement(Card, { key: c.id, className: `flex ${rowStart()} items-center mb-1.5` },
                React.createElement("button", { onClick: () => onOpenChat(c), className: `flex-1 flex ${rowStart()} items-center ${textStart()}`, style: { minWidth: 0 } },
                    React.createElement("div", { className: `w-11 h-11 rounded-full flex items-center justify-center ${ms("3")} shrink-0`, style: { backgroundColor: colors.primaryLight } },
                        React.createElement(User, { size: 20, color: colors.primaryDark })),
                    React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                        React.createElement("div", { style: { display: "flex", flexDirection: "row", direction: "ltr", alignItems: "center", justifyContent: "space-between" } },
                            React.createElement("span", { className: "text-[10px] shrink-0", style: { color: colors.textMuted } }, formatChatTime(c.updatedAt)),
                            React.createElement("span", { className: "font-bold text-sm truncate", style: { color: colors.text, direction: "rtl" } }, c.isSavedMessages ? t("rsayly_almhfwza") : c.name)),
                        React.createElement("div", { className: `text-xs mt-0.5 truncate ${textStart()}`, style: { color: colors.textMuted } }, c.lastMessage || "اضغط لفتح المحادثة")),
                    mutedIds.includes(c.id) && React.createElement(BellOff, { size: 13, color: colors.textMuted, className: `shrink-0 ${ms("1.5")}` })),
                React.createElement("button", { onClick: () => onUnarchive(c.id), className: `px-2.5 py-1.5 rounded-xl text-[10px] font-bold shrink-0 ${me("2")}`, style: { backgroundColor: colors.primaryLight, color: colors.primary } }, t("astaada"))))))));
}
function ConversationsListScreen({ chatDrafts = {}, conversations, groups, broadcastLists, lockedConversationIds, connectionState, onOpenChat, onOpenGroup, onOpenBroadcastList, onNewConversation, onNewGroup, onNewBroadcastList, onOpenLockedChats, onOpenStarredMessages, onScanQr, onOpenSearch, onlineContacts, chatFolders, folderAssignments, onOpenChatSettings, typingConversations = [], momentsPosts = [], familyPersons = [], onOpenMoments, onOpenRoom, myName, groupPersons = {}, groupSchedules = {}, archivedConversations = [], mutedConversations = [], onArchiveConv, onMuteConv, showStoriesRow = true, showFamilyReminders = true, onOpenArchived, pinnedConversations = [], onPinConv, onDeleteConv, onToggleReadConv, onScheduleRoom, scheduledRooms = [], onJoinScheduled, onCancelScheduled, }) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all"); // all | unread | starred | groups
    const [ctxMenu, setCtxMenu] = useState(null); // {id, name} | null
    const [selectedIds, setSelectedIds] = useState([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const undoArchiveTimerRef = useRef(null);
    const selectionMode = selectedIds.length > 0;
    // كانت مستعملة في الضغط المطوّل والنقر بلا تعريف — فوضع التحديد لا يُفتح أصلاً
    function toggleSelect(id) {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
    function handleArchive(id, name) {
        onArchiveConv === null || onArchiveConv === void 0 ? void 0 : onArchiveConv(id);
        clearTimeout(undoArchiveTimerRef.current);
        showToast(`أُرشفت "${name}" — اضغط تراجع`, "info", {
            action: "تراجع",
            onAction: () => { onArchiveConv === null || onArchiveConv === void 0 ? void 0 : onArchiveConv(id); }, // second call = toggle back (parent handles)
        });
    }
    const visibleConversations = useMemo(() => conversations.filter((c) => !lockedConversationIds.includes(c.id) && !archivedConversations.includes(c.id)), [conversations, lockedConversationIds, archivedConversations]);
    const archivedCount = useMemo(() => conversations.filter((c) => archivedConversations.includes(c.id)).length, [conversations, archivedConversations]);
    const archivedUnreadCount = useMemo(() => conversations.filter((c) => archivedConversations.includes(c.id) && c.unread > 0).length, [conversations, archivedConversations]);
    const lockedCount = conversations.filter((c) => lockedConversationIds.includes(c.id)).length;
    // فلترة حسب التبويب النشط
    // أسماء أفراد العائلة من صلة الرحم للفلترة
    const familyNames = useMemo(() => Object.values(groupPersons).flat()
        .filter(p => p.alive)
        .map(p => p.local_name.split(" ")[0].toLowerCase()), [groupPersons]);
    const tabConversations = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const searched = q
            ? visibleConversations.filter((c) => ((c.name || "").toLowerCase().indexOf(q) !== -1) || ((c.lastMessage || "").toLowerCase().indexOf(q) !== -1))
            : visibleConversations;
        const base = [...searched].sort((a, b) => {
            if (b.isSavedMessages)
                return 1;
            if (a.isSavedMessages)
                return -1;
            const ap = pinnedConversations.includes(a.id) ? 1 : 0;
            const bp = pinnedConversations.includes(b.id) ? 1 : 0;
            if (ap !== bp)
                return bp - ap;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (activeTab === "unread")
            return base.filter((c) => c.unread > 0);
        if (activeTab === "starred")
            return base.filter((c) => c.starred);
        if (activeTab === "groups")
            return [];
        if (activeTab === "family") {
            return base.filter(c => !c.isSavedMessages &&
                familyNames.some(fn => { var _a; return (_a = c.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(fn); }));
        }
        return base;
    }, [visibleConversations, activeTab, pinnedConversations, familyNames, searchQuery]);
    const tabGroups = useMemo(() => {
        if (activeTab !== "all" && activeTab !== "groups")
            return [];
        return [...groups].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [groups, activeTab]);
    const tabBroadcasts = activeTab === "all" ? broadcastLists : [];
    // بادج عدد المتأخرين في صلة الرحم
    const overdueCount = useMemo(() => getOverduePersons(groupPersons).length, [groupPersons]);
    const unreadCount = useMemo(() => visibleConversations.filter(c => c.unread > 0).length, [visibleConversations]);
    const TABS = [
        { key: "all", label: t("tab_alkl") },
        { key: "unread", label: t("tab_ghyr_mqrwaa"), badge: unreadCount },
        { key: "starred", label: t("tab_almfdla") },
        { key: "groups", label: t("tab_mjmwaat") },
        { key: "family", label: t("tab_aayla"), badge: overdueCount, badgeColor: "#ef4444" },
    ];
    // مناسبات قادمة خلال 7 أيام من صلة الرحم
    const upcomingBirthdays = familyPersons.filter((p) => {
        if (!p.birthday || !p.alive)
            return false;
        const [m, d] = p.birthday.split("-").map(Number);
        const today = new Date();
        const next = new Date(today.getFullYear(), m - 1, d);
        if (next < today)
            next.setFullYear(today.getFullYear() + 1);
        const diffDays = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
    });
    const listScrollRef = useRef(null);
    const [showTabs, setShowTabs] = useState(true);
    const lastScrollY = useRef(0);
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col", style: { backgroundColor: colors.bg } },
        selectionMode && (React.createElement("div", { style: { display: "flex", flexDirection: "row", direction: "ltr", alignItems: "center", gap: 14, padding: "0.75rem 1rem", borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.primaryLight } },
            React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => setSelectedIds([]), className: "shrink-0" },
                React.createElement(X, { size: 19, color: colors.primary })),
            React.createElement("span", { className: "flex-1 text-sm font-extrabold", style: { color: colors.primary, textAlign: "right" } },
                selectedIds.length,
                " \u0645\u062D\u062F\u062F\u0629"),
            React.createElement("button", { "aria-label": t("mqrw"), onClick: () => { selectedIds.forEach((id) => onToggleReadConv === null || onToggleReadConv === void 0 ? void 0 : onToggleReadConv(id)); setSelectedIds([]); }, title: t("thdyd_kmqrw") },
                React.createElement(CheckCheck, { size: 18, color: colors.primary })),
            React.createElement("button", { "aria-label": t("ktm_altnbyhat"), onClick: () => { selectedIds.forEach((id) => onMuteConv === null || onMuteConv === void 0 ? void 0 : onMuteConv(id)); setSelectedIds([]); }, title: t("ktm") },
                React.createElement(BellOff, { size: 17, color: colors.primary })),
            React.createElement("button", { "aria-label": t("arshfa"), onClick: () => { selectedIds.forEach((id) => onArchiveConv === null || onArchiveConv === void 0 ? void 0 : onArchiveConv(id)); setSelectedIds([]); }, title: t("arshfa") },
                React.createElement(Archive, { size: 17, color: colors.primary })),
            React.createElement("button", { "aria-label": t("hdhf"), onClick: () => { selectedIds.forEach((id) => onDeleteConv === null || onDeleteConv === void 0 ? void 0 : onDeleteConv(id)); setSelectedIds([]); }, title: t("hdhf") },
                React.createElement(Trash2, { size: 17, color: colors.danger })))),
        !selectionMode && (React.createElement("div", { style: { display: "flex", flexDirection: isRTL() ? "row" : "row-reverse", direction: "ltr", alignItems: "center", padding: "0.75rem 1rem 0.5rem 1rem", position: "relative", borderBottom: `1px solid ${colors.border}` } },
            React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: isRTL() ? "row" : "row-reverse", justifyContent: "flex-start", alignItems: "center", gap: 8 } },
                React.createElement("button", { "aria-label": t("khyarat"), onClick: () => setShowNewMenu(!showNewMenu), className: "w-8 h-8 rounded-full flex items-center justify-center border", style: { borderColor: showNewMenu ? colors.primary : colors.border, backgroundColor: showNewMenu ? colors.primary : "transparent" } },
                    React.createElement(MoreVertical, { size: 18, color: showNewMenu ? "#fff" : colors.textMuted })),
                React.createElement("button", { onClick: () => { const nv = !showSearch; setShowSearch(nv); if (!nv) setSearchQuery(""); }, className: "w-8 h-8 rounded-full flex items-center justify-center border", style: { borderColor: showSearch ? colors.primary : colors.border, backgroundColor: showSearch ? colors.primaryLight : "transparent" } },
                    React.createElement(Search, { size: 16, color: showSearch ? colors.primary : colors.textMuted })),
                lockedCount > 0 && (React.createElement("button", { "aria-label": t("qfl"), onClick: onOpenLockedChats, className: "w-8 h-8 rounded-full flex items-center justify-center border relative", style: { borderColor: colors.border } },
                    React.createElement(Lock, { size: 14, color: colors.textMuted }),
                    React.createElement("span", { className: "absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white", style: { backgroundColor: colors.primary } }, lockedCount)))),
            React.createElement("div", { style: { flex: 1, display: "flex", justifyContent: "center" } }),
            React.createElement("div", { style: { flex: 1, display: "flex", justifyContent: isRTL() ? "flex-end" : "flex-start" } },
                React.createElement("h2", { dir: isRTL() ? "rtl" : "ltr", className: "text-xl font-extrabold", style: { color: colors.text } }, appName())),
            showNewMenu && (React.createElement(React.Fragment, null,
                React.createElement("div", { onClick: () => setShowNewMenu(false), style: { position: "fixed", inset: 0, zIndex: 15 } }),
                React.createElement("div", { className: "rounded-2xl border shadow-lg overflow-hidden backdrop-blur-md sawa-pop-in", style: { position: "fixed", top: "3.5rem", left: "1rem", zIndex: 20, backgroundColor: colors.card + "ee", borderColor: colors.border, minWidth: 200 } },
                    React.createElement("div", { className: "px-4 pt-2.5 pb-1" },
                        React.createElement("span", { className: "text-[9px] font-extrabold uppercase tracking-widest", style: { color: colors.textMuted } }, t("mnw_insha"))),
                    React.createElement("button", { onClick: () => { setShowNewMenu(false); onNewConversation(); }, className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                        React.createElement("div", { className: "w-7 h-7 rounded-xl flex items-center justify-center", style: { backgroundColor: colors.primary + "18" } },
                            React.createElement(MessageCircle, { size: 14, color: colors.primary })),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mhadtha_jdyda"))),
                    React.createElement("button", { onClick: () => { setShowNewMenu(false); onNewGroup(); }, className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                        React.createElement("div", { className: "w-7 h-7 rounded-xl flex items-center justify-center", style: { backgroundColor: colors.accent + "18" } },
                            React.createElement(Users2, { size: 14, color: colors.accent })),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mjmwaa_jdyda"))),
                    React.createElement("button", { onClick: () => { setShowNewMenu(false); onNewBroadcastList(); }, className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                        React.createElement("div", { className: "w-7 h-7 rounded-xl flex items-center justify-center", style: { backgroundColor: colors.primary + "18" } },
                            React.createElement(Send, { size: 13, color: colors.primary, style: { transform: "scaleX(-1)" } })),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("qayma_bth"))),
                    React.createElement("div", { style: { height: 1, backgroundColor: colors.border, margin: "6px 0" } }),
                    React.createElement("div", { className: "px-4 pt-1 pb-1" },
                        React.createElement("span", { className: "text-[9px] font-extrabold uppercase tracking-widest", style: { color: colors.textMuted } }, t("mnw_ghrf"))),
                    React.createElement("button", { onClick: () => { setShowNewMenu(false); onOpenRoom(); }, className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                        React.createElement("div", { className: "w-7 h-7 rounded-xl flex items-center justify-center", style: { backgroundColor: "#6366f118" } },
                            React.createElement(Video, { size: 14, color: "#6366f1" })),
                        React.createElement("div", { className: `flex-1 ${textStart()}` },
                            React.createElement("span", { className: "text-xs font-bold block", style: { color: colors.text } }, t("ghrfa_swa_jdyda")),
                            React.createElement("span", { className: "text-[9px]", style: { color: colors.textMuted } }, t("mnw_abda_alan")))),
                    React.createElement("button", { onClick: () => { setShowNewMenu(false); onScheduleRoom === null || onScheduleRoom === void 0 ? void 0 : onScheduleRoom(); }, className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                        React.createElement("div", { className: "w-7 h-7 rounded-xl flex items-center justify-center", style: { backgroundColor: "#6366f118" } },
                            React.createElement(CalendarDays, { size: 14, color: "#6366f1" })),
                        React.createElement("div", { className: `flex-1 ${textStart()}` },
                            React.createElement("span", { className: "text-xs font-bold block", style: { color: colors.text } }, t("jdwla_ghrfa")),
                            React.createElement("span", { className: "text-[9px]", style: { color: colors.textMuted } }, t("mnw_hdd_wqta_lahqa")))),
                    React.createElement("div", { style: { height: 1, backgroundColor: colors.border, margin: "6px 0" } }),
                    React.createElement("button", { onClick: () => { setShowNewMenu(false); onScanQr(); }, className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-2.5` },
                        React.createElement("div", { className: "w-7 h-7 rounded-xl flex items-center justify-center", style: { backgroundColor: colors.textMuted + "18" } },
                            React.createElement(QrCode, { size: 14, color: colors.textMuted })),
                        React.createElement("div", { className: `flex-1 ${textStart()}` },
                            React.createElement("span", { className: "text-xs font-bold block", style: { color: colors.text } }, t("msh_qr")),
                            React.createElement("span", { className: "text-[9px]", style: { color: colors.textMuted } }, t("mnw_thqq_mn_hwya")))),
                    React.createElement("button", { onClick: () => { setShowNewMenu(false); onOpenChatSettings(); }, className: `w-full flex ${rowStart()} items-center gap-3 px-4 py-2.5`, style: { paddingBottom: 12 } },
                        React.createElement("div", { className: "w-7 h-7 rounded-xl flex items-center justify-center", style: { backgroundColor: colors.textMuted + "18" } },
                            React.createElement(SettingsIcon, { size: 14, color: colors.textMuted })),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("iadadat_almhadthat")))))))),
        React.createElement("div", { style: { borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.bg } },
            showSearch && React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-4 py-2 border-b shrink-0`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement(Search, { size: 15, color: colors.textMuted }),
            React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", autoFocus: true, value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: t("bhth_2"), className: "flex-1 bg-transparent text-sm outline-none", style: { color: colors.text } }),
            searchQuery.length > 0 && React.createElement("button", { onClick: () => setSearchQuery("") }, React.createElement(X, { size: 14, color: colors.textMuted }))),
        React.createElement("div", { style: { display: "flex", flexDirection: "row", direction: "ltr", alignItems: "center", borderBottom: "1px solid " + colors.border, backgroundColor: colors.card, overflow: "hidden", maxHeight: showTabs ? "44px" : "0px", opacity: showTabs ? 1 : 0, transition: "max-height 0.25s ease, opacity 0.2s ease" } }, TABS.map(function(tab) { return (
            React.createElement("button", { key: tab.key, onClick: function() { setActiveTab(tab.key); }, style: { flex: 1, paddingBottom: 7, paddingTop: 6, borderBottom: activeTab === tab.key ? ("2px solid " + colors.primary) : "2px solid transparent", backgroundColor: "transparent" } },
                React.createElement("span", { className: "relative inline-flex items-center gap-1" },
                    React.createElement("span", { className: "text-[11px] font-bold whitespace-nowrap", style: { color: activeTab === tab.key ? colors.primary : colors.textMuted } }, tab.label),
                    tab.badge > 0 && React.createElement("span", { className: "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white", style: { backgroundColor: tab.badgeColor || colors.primary, minWidth: 16 } }, tab.badge > 9 ? "9+" : tab.badge)
                )
            )
        ); }))),
        React.createElement("div", { ref: listScrollRef, className: "flex-1 overflow-y-auto min-h-0",
            onScroll: function(e) {
                var el = e.currentTarget;
                var currentY = el.scrollTop;
                if (currentY <= 0) {
                    setShowTabs(true);
                } else if (currentY > lastScrollY.current + 5) {
                    setShowTabs(false);
                } else if (currentY < lastScrollY.current - 5) {
                    setShowTabs(true);
                }
                lastScrollY.current = currentY;
            } },
            showStoriesRow && (React.createElement(StoriesRow, { momentsPosts: momentsPosts, onOpenMoments: onOpenMoments, conversations: conversations, onOpenChat: onOpenChat, myName: myName })),
            showFamilyReminders && (React.createElement(FamilyReminderCard, { groupPersons: groupPersons, groupSchedules: groupSchedules, conversations: conversations, onStartChat: onOpenChat })),
            activeTab === "groups" && (React.createElement("div", { className: `flex ${rowStart()} items-center justify-between px-4 py-2`, style: { borderBottom: `1px solid ${colors.border}` } },
                React.createElement("button", { onClick: onNewGroup, className: `flex ${rowStart()} items-center gap-1.5 px-3 py-1.5 rounded-xl`, style: { backgroundColor: colors.primaryLight } },
                    React.createElement(Plus, { size: 14, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("mjmwaa_jdyda"))),
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } },
                    groups.length,
                    " \u0645\u062C\u0645\u0648\u0639\u0629"))),
            activeTab === "all" && upcomingBirthdays.length > 0 && (React.createElement("div", { className: `mx-4 mt-3 rounded-2xl px-4 py-3 flex ${rowStart()} items-center gap-3`, style: { backgroundColor: colors.accent + "18", border: `1px solid ${colors.accent}44` } },
                React.createElement("span", { style: { fontSize: 22 } }, "\uD83C\uDF82"),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.accent } },
                        "\u0639\u064A\u062F \u0645\u064A\u0644\u0627\u062F ",
                        upcomingBirthdays[0].local_name,
                        " \u0642\u0631\u064A\u0628\u0627\u064B!"),
                    upcomingBirthdays.length > 1 && (React.createElement("span", { className: "text-[10px] block mt-0.5", style: { color: colors.textMuted } },
                        "\u0648",
                        upcomingBirthdays.length - 1,
                        " \u0645\u0646\u0627\u0633\u0628\u0629 \u0623\u062E\u0631\u0649 \u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639"))),
                React.createElement("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", style: { backgroundColor: colors.accent, color: "#fff" } }, t("hdha_alasbwa")))),
            React.createElement("div", { className: "px-3 py-2" },
                visibleConversations.length === 0 && groups.length === 0 && broadcastLists.length === 0 && React.createElement(EmptyState, { icon: MessageCircle, label: t("la_twjd_mhadthat_bad") }),
                activeTab === "starred" && tabConversations.length === 0 && React.createElement(EmptyState, { icon: Star, label: t("ma_hfzt_ay_mhadtha") }),
                activeTab === "unread" && tabConversations.length === 0 && React.createElement(EmptyState, { icon: MessageCircle, label: t("kl_almhadthat_mqrwa") }),
                activeTab === "family" && tabConversations.length === 0 && (React.createElement("div", { className: "flex flex-col items-center gap-3 mt-8" },
                    React.createElement(EmptyState, { icon: Heart, label: t("ma_fy_mhadthat_ma") }),
                    React.createElement("p", { className: "text-[11px] text-center px-8", style: { color: colors.textMuted } }, t("adf_arqam_afrad_aayltk")))),
                activeTab === "groups" && tabGroups.length === 0 && (React.createElement("div", { className: "flex flex-col items-center gap-3 mt-8" },
                    React.createElement(EmptyState, { icon: Users2, label: t("ma_fyh_mjmwaat_bad") }),
                    React.createElement("button", { onClick: onNewGroup, className: `flex ${rowStart()} items-center gap-2 px-4 py-2.5 rounded-2xl`, style: { backgroundColor: colors.primary } },
                        React.createElement(Plus, { size: 16, color: "#fff" }),
                        React.createElement("span", { className: "text-sm font-bold text-white" }, t("insha_mjmwaa"))))),
                tabBroadcasts.map((b) => (React.createElement(Card, { key: b.id, className: `flex ${rowStart()} items-center cursor-pointer`, style: { cursor: "pointer" } },
                    React.createElement("button", { onClick: () => onOpenBroadcastList(b), /* flex-row صريحة لا rowStart(): ترميز هذا الصف مرتّب من اليمين
                               (صورة ← نص ← سهم) كأخويه — صفّ المحادثة وصفّ المجموعة */
                            className: `w-full flex flex-row items-center ${textStart()}` },
                        React.createElement("div", { className: `w-11 h-11 rounded-full flex items-center justify-center ${ms("3")}`, style: { backgroundColor: colors.accent + "22" } },
                            React.createElement(Send, { size: 18, color: colors.accent, style: { transform: "scaleX(-1)" } })),
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("div", { className: "font-bold text-sm", style: { color: colors.text } }, b.name),
                            React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } },
                                b.recipientIds.length,
                                " \u0645\u0633\u062A\u0644\u0645 \u00B7 \u0642\u0627\u0626\u0645\u0629 \u0628\u062B")),
                        React.createElement(isRTL() ? ChevronLeft : ChevronRight, { size: 16, color: colors.textMuted }))))),
                tabGroups.map((g) => (React.createElement(Card, { key: g.id, className: `flex ${rowStart()} items-center cursor-pointer`, style: { cursor: "pointer" } },
                    React.createElement("button", { onClick: () => onOpenGroup(g), /* flex-row صريحة لا rowStart(): ترميز هذا الصف مرتّب من اليمين
                               (صورة ← نص ← عدّاد ← سهم) فلا يحتاج عكساً */
                            className: `w-full flex flex-row items-center ${textStart()}` },
                        React.createElement("div", { className: `w-11 h-11 rounded-full flex items-center justify-center ${ms("3")} shrink-0`, style: { backgroundColor: colors.primaryLight } },
                            React.createElement(Users2, { size: 20, color: colors.primaryDark })),
                        React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                            React.createElement("div", { style: { display: "flex", flexDirection: "row", direction: "ltr", alignItems: "center", justifyContent: "space-between" } },
                                React.createElement("span", { className: "text-[10px] shrink-0", style: { color: colors.textMuted } }, formatChatTime(g.updatedAt)),
                                React.createElement("span", { className: "font-bold text-sm truncate", style: { color: colors.text, direction: "rtl" } }, g.name)),
                            React.createElement("div", { className: "text-xs mt-0.5 truncate", style: { color: colors.textMuted, direction: "rtl", textAlign: "right" } }, chatDrafts && chatDrafts["g:" + g.id] ? React.createElement(React.Fragment, null, React.createElement("span", { style: { color: colors.danger, fontWeight: 700 } }, "مسودّة: "), chatDrafts["g:" + g.id]) : (g.lastMessage || t("aada_mjmwaa", { length: g.members.length })))),
                        g.unread > 0 && (React.createElement("span", { className: `w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${ms("1.5")}`, style: { backgroundColor: colors.primary } }, g.unread)),
                        React.createElement(isRTL() ? ChevronLeft : ChevronRight, { size: 16, color: colors.textMuted, className: `shrink-0 ${ms("1")}` }))))),
                activeTab === "all" && scheduledRooms.filter((r) => r.at > Date.now()).slice(0, 2).map((r) => (React.createElement("div", { key: r.id, className: `rounded-xl px-3 py-2.5 mb-1.5 flex ${rowStart()} items-center gap-3`, style: { backgroundColor: colors.accent + "12", border: `1px solid ${colors.accent}40` } },
                    React.createElement(CalendarDays, { size: 17, color: colors.accent, className: "shrink-0" }),
                    React.createElement("div", { className: `flex-1 ${textStart()}`, style: { minWidth: 0 } },
                        React.createElement("p", { className: "text-xs font-extrabold truncate", style: { color: colors.text } }, r.title),
                        React.createElement("p", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, new Date(r.at).toLocaleString(loc(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))),
                    React.createElement("button", { onClick: () => onJoinScheduled === null || onJoinScheduled === void 0 ? void 0 : onJoinScheduled(r.code), className: "px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold shrink-0", style: { backgroundColor: colors.accent, color: "#fff" } }, t("abda")),
                    React.createElement("button", { onClick: () => onCancelScheduled === null || onCancelScheduled === void 0 ? void 0 : onCancelScheduled(r.id), className: "shrink-0", "aria-label": t("ilgha_almwad") },
                        React.createElement(X, { size: 14, color: colors.textMuted }))))),
                activeTab === "all" && archivedCount > 0 && (React.createElement("button", { onClick: onOpenArchived, className: `w-full flex ${rowStart()} items-center gap-3 px-3 py-2.5 mb-1.5 rounded-xl`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                    React.createElement(Archive, { size: 17, color: colors.textMuted }),
                    React.createElement("span", { className: `flex-1 ${textStart()} text-sm font-bold`, style: { color: colors.text } }, t("almwrshfa")),
                    archivedUnreadCount > 0 && (React.createElement("span", { className: "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0", style: { backgroundColor: colors.primary } }, archivedUnreadCount)),
                    React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.textMuted } }, archivedCount))),
                tabConversations.map((c) => (React.createElement(SwipeableConvCard, { key: c.id, isMuted: mutedConversations.includes(c.id), isPinned: pinnedConversations.includes(c.id), onArchive: () => handleArchive(c.id, c.name), onMute: () => onMuteConv === null || onMuteConv === void 0 ? void 0 : onMuteConv(c.id), onPin: () => onPinConv === null || onPinConv === void 0 ? void 0 : onPinConv(c.id), onDelete: () => setConfirmDeleteId(c.id) },
                    React.createElement(Card, { className: `flex ${rowStart()} items-center cursor-pointer`, style: { cursor: "pointer" } },
                        React.createElement("button", { onClick: () => { if (selectionMode) {
                                if (!c.isSavedMessages)
                                    toggleSelect(c.id);
                            }
                            else
                                onOpenChat(c); }, onContextMenu: (e) => { e.preventDefault(); if (!c.isSavedMessages)
                                setCtxMenu({ id: c.id, name: c.name, unread: c.unread }); }, onTouchStart: (e) => {
                                if (c.isSavedMessages)
                                    return;
                                const tmr = setTimeout(() => { if (selectionMode)
                                    toggleSelect(c.id);
                                else
                                    setCtxMenu({ id: c.id, name: c.name, unread: c.unread }); }, 550);
                                e.currentTarget.ontouchend = e.currentTarget.ontouchmove = () => clearTimeout(tmr);
                            }, /* flex-row صريحة لا rowStart(): ترميز هذا الصف مرتّب من اليمين
                               (صورة ← نص ← عدّاد ← سهم) فلا يحتاج عكساً */
                            className: `w-full flex flex-row items-center ${textStart()}`, style: { backgroundColor: selectedIds.includes(c.id) ? colors.primaryLight : "transparent", borderRadius: 12 } },
                            selectionMode && !c.isSavedMessages && (React.createElement("span", { className: `w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${ms("2")} border-2`, style: { borderColor: selectedIds.includes(c.id) ? colors.primary : colors.border, backgroundColor: selectedIds.includes(c.id) ? colors.primary : "transparent" } }, selectedIds.includes(c.id) && React.createElement(Check, { size: 11, color: "#fff" }))),
                            (() => {
                                // فحص إذا الشخص من صلة الرحم ومتأخر التواصل
                                const allFamilyPersons = Object.values(groupPersons).flat();
                                const matchedPerson = !c.isSavedMessages && allFamilyPersons.find(p => {
                                    var _a;
                                    return p.alive && c.name && ((_a = p.local_name) === null || _a === void 0 ? void 0 : _a.split(" ")[0]) &&
                                        c.name.toLowerCase().includes(p.local_name.split(" ")[0].toLowerCase());
                                });
                                const overdue = matchedPerson && isContactOverdue(matchedPerson);
                                return (React.createElement("div", { className: `w-11 h-11 rounded-full flex items-center justify-center ${ms("3")} relative`, style: {
                                        backgroundColor: c.isSavedMessages ? colors.accent : colors.primaryLight,
                                        outline: overdue ? `2px solid #ef4444` : matchedPerson ? `2px solid ${colors.accent}` : "none",
                                        outlineOffset: 1,
                                    } },
                                    c.isSavedMessages ? React.createElement(Bookmark, { size: 19, color: "#fff", fill: "#fff" }) : React.createElement(User, { size: 20, color: colors.primaryDark }),
                                    !c.isSavedMessages && onlineContacts.includes(c.name) && (React.createElement("span", { className: "absolute bottom-0 left-0 w-3 h-3 rounded-full border-2", style: { backgroundColor: "#22C55E", borderColor: colors.card } })),
                                    overdue && (React.createElement("span", { className: "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px]", style: { backgroundColor: "#ef4444", color: "#fff", border: `2px solid ${colors.card}` } }, "!")),
                                    matchedPerson && !overdue && (React.createElement("span", { className: "absolute -top-1 -right-1 text-[10px]" }, "\uD83E\uDD0D"))));
                            })(),
                            React.createElement("div", { className: "flex-1", style: { minWidth: 0 } },
                                React.createElement("div", { style: { display: "flex", flexDirection: "row", direction: "ltr", alignItems: "center", justifyContent: "space-between" } },
                                    React.createElement("span", { className: "text-[10px] shrink-0", style: { color: colors.textMuted } }, formatChatTime(c.updatedAt)),
                                    React.createElement("span", { className: "font-bold text-sm truncate", style: { color: colors.text, direction: "rtl" } }, c.isSavedMessages ? t("rsayly_almhfwza") : c.name)),
                                React.createElement("div", { className: "text-xs mt-0.5 flex items-center gap-1", style: { color: typingConversations.includes(c.id) ? colors.primary : colors.textMuted, direction: "rtl", justifyContent: "flex-start" } },
                                    (chatDrafts && chatDrafts[c.id] && !typingConversations.includes(c.id))
                                        ? React.createElement("span", { className: "truncate" },
                                            React.createElement("span", { style: { color: colors.danger, fontWeight: 700 } }, t("mswdda_")),
                                            chatDrafts[c.id])
                                        : React.createElement("span", { className: "truncate" }, c.isSavedMessages ? t("ahfz_mlahzatk_wmlfatk") : typingConversations.includes(c.id) ? t("yktb_alan") : (c.lastMessage || "اضغط لفتح المحادثة")),
                                    (!c.isSavedMessages && c.lastFromMe && c.lastMessage && !typingConversations.includes(c.id)) ? React.createElement(c.lastStatus === "sent" ? Check : CheckCheck, { size: 13, className: "shrink-0", color: c.lastStatus === "read" ? "#34B7F1" : colors.textMuted }) : null)),
                            pinnedConversations.includes(c.id) && (React.createElement(Pin, { size: 12, color: colors.textMuted, className: `shrink-0 ${ms("1.5")}` })),
                            mutedConversations.includes(c.id) && (React.createElement(BellOff, { size: 13, color: colors.textMuted, className: `shrink-0 ${ms("1.5")}` })),
                            !c.isSavedMessages && c.unread > 0 && (React.createElement("span", { className: `w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${ms("1.5")}`, style: { backgroundColor: mutedConversations.includes(c.id) ? colors.textMuted : colors.primary } }, c.unread)),
                            React.createElement(isRTL() ? ChevronLeft : ChevronRight, { size: 16, color: colors.textMuted, className: `shrink-0 ${ms("1")}` }),
))))))),
        ctxMenu && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setCtxMenu(null), style: { position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.35)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 12 } },
                React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto my-3", style: { backgroundColor: colors.border } }),
                React.createElement("p", { className: "text-sm font-extrabold text-center mb-2 px-4 truncate", style: { color: colors.text } }, ctxMenu.name),
                [
                    { icon: Check, label: "تحديد", act: () => setSelectedIds([ctxMenu.id]) },
                    { icon: Pin, label: pinnedConversations.includes(ctxMenu.id) ? "إلغاء التثبيت" : "تثبيت للأعلى", act: () => onPinConv === null || onPinConv === void 0 ? void 0 : onPinConv(ctxMenu.id) },
                    { icon: BellOff, label: mutedConversations.includes(ctxMenu.id) ? "رفع الكتم" : "كتم الإشعارات", act: () => onMuteConv === null || onMuteConv === void 0 ? void 0 : onMuteConv(ctxMenu.id) },
                    { icon: CheckCheck, label: ctxMenu.unread > 0 ? "تحديد كمقروء" : "تحديد كغير مقروء", act: () => onToggleReadConv === null || onToggleReadConv === void 0 ? void 0 : onToggleReadConv(ctxMenu.id) },
                    { icon: Archive, label: "أرشفة", act: () => onArchiveConv === null || onArchiveConv === void 0 ? void 0 : onArchiveConv(ctxMenu.id) },
                    { icon: Trash2, label: "حذف المحادثة", act: () => { setConfirmDeleteId(ctxMenu.id); }, danger: true },
                ].map((it) => (React.createElement("button", { key: it.label, onClick: () => { it.act(); setCtxMenu(null); }, className: `w-full flex ${rowStart()} items-center gap-3 px-5 py-3.5 border-t`, style: { borderColor: colors.border } },
                    React.createElement(it.icon, { size: 17, color: it.danger ? colors.danger : colors.textMuted }),
                    React.createElement("span", { className: `flex-1 ${textStart()} text-sm font-bold`, style: { color: it.danger ? colors.danger : colors.text } }, it.label))))))),
        confirmDeleteId && (React.createElement(React.Fragment, null,
            React.createElement("div", { onClick: () => setConfirmDeleteId(null), style: { position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.5)" } }),
            React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 51, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 16 } },
                React.createElement("div", { className: "w-10 h-1 rounded-full mx-auto my-3", style: { backgroundColor: colors.border } }),
                React.createElement("div", { className: "flex flex-col items-center px-5 pb-2" },
                    React.createElement("div", { className: "w-12 h-12 rounded-full flex items-center justify-center mb-3", style: { backgroundColor: colors.danger + "18" } },
                        React.createElement(Trash2, { size: 22, color: colors.danger })),
                    React.createElement("p", { className: "text-sm font-extrabold text-center mb-1", style: { color: colors.text } }, t("hdhf_almhadtha")),
                    React.createElement("p", { className: "text-xs text-center mb-4", style: { color: colors.textMuted } }, "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0627\u0644\u062D\u0630\u0641")),
                React.createElement("button", { onClick: () => { onDeleteConv === null || onDeleteConv === void 0 ? void 0 : onDeleteConv(confirmDeleteId); setConfirmDeleteId(null); }, className: "w-full px-5 py-3.5 border-t", style: { borderColor: colors.border } },
                    React.createElement("span", { className: `block ${textStart()} text-sm font-extrabold`, style: { color: colors.danger } }, t("hdhf_almhadtha"))),
                React.createElement("button", { onClick: () => setConfirmDeleteId(null), className: "w-full px-5 py-3.5 border-t", style: { borderColor: colors.border } },
                    React.createElement("span", { className: `block ${textStart()} text-sm font-bold`, style: { color: colors.textMuted } }, t("ilgha"))))))));
}
// نصوص التذكير اليوميّ — تُقرأ من daily.json ليمكن تعديلها بلا إعادة بناء.
// النسخة المدمجة أدناه احتياطية فقط (لو تعذّر تحميل الملف أو كان المستخدم دون اتصال).
const DAILY_REMINDERS_FALLBACK = [
    { kind: "آية", text: "وَاتَّقُوا اللَّهَ الَّذِي تَسَاءَلُونَ بِهِ وَالْأَرْحَامَ ۚ إِنَّ اللَّهَ كَانَ عَلَيْكُمْ رَقِيبًا", source: "النساء: 1" },
    { kind: "حديث", text: "مَن أحبَّ أن يُبسَط له في رزقه، ويُنسَأ له في أثره، فليَصِل رحِمَه", source: "متفق عليه" },
    { kind: "حديث", text: "الرَّحِمُ مُعلَّقةٌ بالعرش تقول: مَن وصَلني وصَلَه الله، ومَن قطَعني قطَعه الله", source: "متفق عليه" },
];
function loadDailyReminders() {
    // الشبكة أولاً حتى يظهر أي تعديل على daily.json فوراً،
    // والنسخة المخزّنة محلياً احتياط لحالة انقطاع الاتصال.
    function cached() {
        try {
            const raw = localStorage.getItem("dailyRemindersCache");
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && parsed.length) return parsed;
        } catch (e) { }
        return DAILY_REMINDERS_FALLBACK;
    }
    return fetch("./daily.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
            const items = data && Array.isArray(data.items)
                ? data.items.filter(function (x) { return x && x.text; })
                : null;
            if (!items || !items.length) return cached();
            try { localStorage.setItem("dailyRemindersCache", JSON.stringify(items)); } catch (e) { }
            return items;
        })
        .catch(cached);
}
// ── الدعاء للمتوفّين ─────────────────────────────────────────────
// تُقرأ من duaa.json كما تُقرأ نصوص الجمعة، فتُعدَّل برفع الملف وحده.
// الصيغ الدينية تُنقل ولا تُولَّد: ما هنا احتياط لما في الملف، وكلاهما
// من كتابة خالد لا من إنشاء الكود.
const DUAA_FALLBACK = {
    person: {
        male: "\u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0627\u063A\u0652\u0641\u0650\u0631\u0652 {lname} \u0648\u064E\u0627\u0631\u0652\u062D\u064E\u0645\u0652\u0647\u064F",
        female: "\u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0627\u063A\u0652\u0641\u0650\u0631\u0652 {lname} \u0648\u064E\u0627\u0631\u0652\u062D\u064E\u0645\u0652\u0647\u064E\u0627",
    },
    general: ["\u0627\u0644\u0644\u0651\u064E\u0647\u064F\u0645\u0651\u064E \u0627\u063A\u0652\u0641\u0650\u0631\u0652 \u0644\u0650\u0645\u064E\u0648\u0652\u062A\u064E\u0627\u0646\u064E\u0627 \u0648\u064E\u0645\u064E\u0648\u0652\u062A\u064E\u0649 \u0627\u0644\u0652\u0645\u064F\u0633\u0652\u0644\u0650\u0645\u0650\u064A\u0646"],
};
// لام الجرّ تُوصَل ولا تُفصَل: ل + أحمد ← لأحمد، و«ال» تُدغم: العباس ← للعباس.
// قاعدة صرفية كالتاء المربوطة في «عمّتك» — لا استثناء لها.
function lamName(name) {
    const n = String(name || "").trim();
    if (!n)
        return "";
    return n.startsWith("\u0627\u0644") ? "\u0644" + n.slice(1) : "\u0644" + n;
}
function duaaForPerson(person, duaa) {
    // بلا اسم لا دعاء: «اللهم اغفر  وارحمه» أسوأ من لا شيء
    if (!person || !String(person.local_name || "").trim())
        return "";
    const src = (duaa && duaa.person) || DUAA_FALLBACK.person;
    const tpl = person.gender === "female" ? src.female : src.male;
    return String(tpl || "").replace("{lname}", lamName(person.local_name));
}
function loadDuaa() {
    function cached() {
        try {
            const raw = localStorage.getItem("duaaCache");
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && parsed.person)
                return parsed;
        }
        catch (e) { }
        return DUAA_FALLBACK;
    }
    return fetch("./duaa.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
        if (!data || !data.person || !data.person.male)
            return cached();
        try { localStorage.setItem("duaaCache", JSON.stringify(data)); } catch (e) { }
        return data;
    })
        .catch(cached);
}
const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢"];
// ردود تلقائية ثابتة لمحاكاة استجابة "الطرف الآخر" بجهات الاتصال التجريبية
// تنسيق وقت آخر رسالة — مثل واتساب
function formatChatTime(ts) {
    if (!ts)
        return "";
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1)
        return t("wqt_alan");
    if (mins < 60)
        return t("d_mins", { mins });
    if (hours < 24)
        return new Date(ts).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" });
    if (days === 1)
        return t("wqt_ams");
    if (days < 7)
        return new Date(ts).toLocaleDateString(loc(), { weekday: "short" });
    return new Date(ts).toLocaleDateString(loc(), { day: "numeric", month: "numeric" });
}
const DEMO_REPLIES = [
    "تمام، وصلتني رسالتك 😊",
    "حاضر، بتواصل معك بعدين.",
    "يعطيك العافية!",
    "أكيد، خلّني أشوف وأرد عليك.",
];
// ردود سائق التاكسي — مجموعة منفصلة تماماً عن DEMO_REPLIES، تُستخدم حصراً
// بمحادثة الرحلة المؤقتة
const TAXI_DRIVER_REPLIES = [
    "تمام، أنا بالطريق ليك الحين.",
    "وصلت قريب، شوف السيارة البيضا.",
    "ماشي، خمس دقايق وأوصل.",
    "تمام كده، شكراً ليك.",
];
// صورة المرسل في المجموعات — تمييز المتحدّثين بالاسم وحده متعب
// حين يكونون عشرة. اللون مشتق من الاسم فيثبت لكل شخص عبر الجلسات.
const SENDER_COLORS = ["#2F80C8", "#8B5CF6", "#059669", "#D97706", "#DC2626", "#0891B2", "#7C3AED", "#B45309"];
function senderColor(name) {
    // جمع رموز الحروف وحده يعطي تصادماً كثيراً بالعربية (الحروف متقاربة)،
    // فنُدخل موضع الحرف في الحساب ليتوزّع اللون أفضل
    const t = String(name || "?");
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    return SENDER_COLORS[h % SENDER_COLORS.length];
}
function SenderAvatar({ name, size }) {
    const s = size || 26;
    return React.createElement("div", {
        className: "rounded-full flex items-center justify-center shrink-0 font-extrabold",
        style: { width: s, height: s, backgroundColor: senderColor(name), color: "#fff", fontSize: Math.round(s * 0.42) },
    }, String(name || "؟").trim().charAt(0) || "؟");
}

// حقل الكتابة — كان input بسطر واحد، فالرسالة الطويلة تنزلق أفقياً
// ولا يرى الكاتب إلا آخرها. يتمدّد الآن حتى خمسة أسطر ثم يمرّر داخلياً.
function ChatComposerInput({ value, onChange, placeholder, disabled, onEnter }) {
    const { colors } = useTheme();
    const ref = useRef(null);
    const MAX_LINES = 5;
    useEffect(function () {
        const el = ref.current;
        if (!el) return;
        const line = 20;                       // ارتفاع السطر التقريبي
        const min = line + 16;                 // سطر واحد + الحشو الرأسي
        const max = line * MAX_LINES + 16;
        // بلا نص = سطر واحد دائماً، بلا قياس.
        // القياس عند أول رسم كان يعطي رقماً كبيراً أحياناً فينتفخ الصندوق.
        if (!value) {
            el.style.height = min + "px";
            el.style.overflowY = "hidden";
            return;
        }
        el.style.height = "auto";
        el.style.height = Math.max(min, Math.min(el.scrollHeight, max)) + "px";
        el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    }, [value]);
    return React.createElement("textarea", {
        ref: ref,
        // الاتجاه يتبع اللغة: مع "rtl" مثبَّتة كان النصّ الإنجليزي
        // يُحاذى لليمين فيُقتطع أوّله («Type a…» بدل «Type a message…»)
        dir: isRTL() ? "rtl" : "ltr",
        rows: 1,
        value: value,
        onChange: (e) => onChange(e.target.value),
        onKeyDown: function (e) {
            // Enter يُرسل، و Shift+Enter سطر جديد — كما اعتاد المستخدم
            if (e.key === "Enter" && !e.shiftKey && onEnter) { e.preventDefault(); onEnter(); }
        },
        placeholder: placeholder,
        disabled: disabled,
        className: "flex-1 min-w-0 border rounded-2xl px-4 py-2 text-sm resize-none leading-5",
        style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg, minWidth: 0, maxHeight: 116 },
    });
}

function RideChatScreen({ driverName, onSendToDriver, messages, onClose }) {
    const { colors } = useTheme();
    const [text, setText] = useState("");
    function handleSend() {
        if (!text.trim())
            return;
        onSendToDriver(text.trim());
        setText("");
    }
    function handleShareLocation() {
        onSendToDriver("📍 موقع مُشارك", true);
    }
    return (React.createElement("div", { className: "absolute inset-0 z-40 flex flex-col", style: { backgroundColor: colors.bg } },
        React.createElement(TopBar, { title: t("mhadtha_ma", { driverName }), onBack: onClose }),
        React.createElement("div", { className: `p-2 border-b flex ${rowStart()} items-center gap-1.5`, style: { borderColor: colors.accent, backgroundColor: colors.card } },
            React.createElement(ShieldCheck, { size: 12, color: colors.accent }),
            React.createElement("span", { className: "text-[10px] font-bold flex-1", style: { color: colors.accent } }, t("mhadtha_khasa_bhdhy_alrhla"))),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            messages.length === 0 && (React.createElement("p", { className: "text-xs text-center mt-6", style: { color: colors.textMuted } }, t("rasl_sayqk_shark_swrtk"))),
            messages.map((m) => {
                const mine = m.senderIsMe;
                return (React.createElement("div", { key: m.id, className: "flex mb-2", style: { justifyContent: mine ? "flex-start" : "flex-end" } },
                    React.createElement("div", { className: "max-w-[78%] rounded-2xl border px-3 py-2", style: { backgroundColor: mine ? colors.primary : colors.card, borderColor: colors.border } }, m.isLocation ? (React.createElement("div", null,
                        React.createElement("span", { className: "text-sm", style: { color: mine ? "#fff" : colors.text } }, m.text),
                        React.createElement("div", { className: "text-[10px] mt-1 underline", style: { color: mine ? "#ffffffcc" : colors.primary } }, t("fth_fy_khrayt_jwjl")))) : (React.createElement("span", { className: "text-sm", style: { color: mine ? "#fff" : colors.text } }, m.text)))));
            })),
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 p-2 border-t`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("button", { onClick: handleShareLocation, className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: colors.bg } },
                React.createElement(MapPin, { size: 15, color: colors.textMuted })),
            React.createElement(ChatComposerInput, { value: text, onChange: setText, placeholder: t("aktb_rsala_llsayq"), onEnter: handleSend }),
            React.createElement("button", { "aria-label": t("irsal"), onClick: handleSend, className: "w-10 h-10 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primary } },
                React.createElement(Send, { size: 16, color: "#fff", style: { transform: "scaleX(-1)" } })))));
}
const STICKER_SET = ["🎉", "❤️", "😂", "👍", "🔥", "😢", "😮", "🎊", "🙏", "👏", "😴", "🥳"];
const DISAPPEARING_OPTIONS = [
    { key: 0, labelKey: "dis_mattl" },
    { key: 3600, labelKey: "dis_saa" },
    { key: 86400, labelKey: "dis_24_saa" },
    { key: 604800, labelKey: "dis_7_ayam" },
];
// 6 خيارات بالضبط — تدرّجات لونية، لا صور
const CHAT_THEMES = [
    { key: "default", labelKey: "thm_aftrady", gradient: null, bubbleColor: null },
    { key: "calmBlue", labelKey: "thm_azrq_hady", gradient: "linear-gradient(135deg, #E8F1FA, #D3E6F5)", bubbleColor: "#2E6FB8" },
    { key: "green", labelKey: "thm_akhdr", gradient: "linear-gradient(135deg, #E6F5EC, #D0EDDC)", bubbleColor: "#1F8B4C" },
    { key: "peach", labelKey: "thm_khwkhy", gradient: "linear-gradient(135deg, #FDEEE4, #FBDECB)", bubbleColor: "#D97B3F" },
    { key: "lightPurple", labelKey: "thm_bnfsjy_fath", gradient: "linear-gradient(135deg, #F1E9F7, #E4D3F0)", bubbleColor: "#8B5CB8" },
    { key: "dark", labelKey: "thm_dakn", gradient: "linear-gradient(135deg, #1A1D22, #24282E)", bubbleColor: "#3D4450" },
];
const CHAT_BACKGROUNDS = CHAT_THEMES; // اسم قديم محفوظ للتوافق مع أي استخدام متبقٍّ
const POLL_DEADLINE_OPTIONS = [
    { key: "none", labelKey: "mhl_bla", minutes: null },
    { key: "1h", labelKey: "mhl_saa", minutes: 60 },
    { key: "1d", labelKey: "mhl_ywm", minutes: 1440 },
    { key: "3d", labelKey: "mhl_3_ayam", minutes: 4320 },
    { key: "1w", labelKey: "mhl_asbwa", minutes: 10080 },
];
const BILL_SPLIT_TYPES = [
    { key: "equal", labelKey: "spl_baltsawy" },
    { key: "shares", labelKey: "spl_bhss" },
    { key: "custom", labelKey: "spl_bmbalgh" },
];
// حد المنتج المستهدَف 2 جيجابايت (كواتساب وتيليجرام)، لكن في معاينة الويب
// تُقرأ الوسائط كاملة إلى الذاكرة كـ base64 (+33% حجماً)، فنكتفي بحد آمن.
// عند الانتقال لـ RN يُرفع الملف بالبثّ إلى الخادم ويعود الحد لقيمته الكاملة.
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 ميجابايت — حد المعاينة
const MAX_FILE_SIZE_LABEL = "8 ميجابايت";
function formatFileSize(bytes) {
    if (bytes < 1024 * 1024)
        return `${Math.round(bytes / 1024)} كيلوبايت`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} جيجابايت`;
}
const MUTE_OPTIONS = [
    { key: 0, labelKey: "mut_ilgha" },
    { key: 3600, labelKey: "mut_saa" },
    { key: 28800, labelKey: "mut_8_saaat" },
    { key: -1, labelKey: "mut_daym" },
];
function ChatInfoScreen({ conversation, messages, background, setBackground, disappearing, setDisappearing, isBlocked, onBlock, onUnblock, onReport, isLocked, onToggleLock, chatFolders, folderId, onSetFolder, notificationTone, setNotificationTone, onBack, muteDuration: muteDurationProp = 0, onSetMute, groupPersons = {}, onOpenFamilyProfile, }) {
    var _a;
    const { colors } = useTheme();
    const [muteDuration, setMuteDuration] = useState(muteDurationProp);
    const { showToast } = useToast();
    function handleSetMute(val) {
        setMuteDuration(val);
        onSetMute === null || onSetMute === void 0 ? void 0 : onSetMute(val);
    }
    function exportChat() {
        const header = "محادثة سوا — " + conversation.name + "\n" +
            "صُدِّرت في " + new Date().toLocaleString(loc()) + "\n" +
            "عدد الرسائل: " + messages.length + "\n" + "=".repeat(40) + "\n\n";
        const body = messages.map((m) => {
            const ts = new Date(m.createdAt).toLocaleString(loc(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            const who = m.senderUserId === "me" ? "أنا" : conversation.name;
            const txt = m.type === "text" ? m.text
                : m.type === "voice" ? "[رسالة صوتية]"
                    : m.type === "image" ? "[صورة]"
                        : m.type === "video" ? "[فيديو]"
                            : m.type === "file" ? ("[ملف] " + (m.text || ""))
                                : m.type === "sticker" ? "[ملصق]"
                                    : (m.text || "[مرفق]");
            return "[" + ts + "] " + who + ": " + txt;
        }).join("\n");
        saveTextFile("sawa-" + conversation.name.replace(/\s+/g, "-") + ".txt", header + body);
        showToast(t("sdrt_almhadtha", { count: messages.length }), "success");
    }
    const [mediaTab, setMediaTab] = useState("media"); // media | files
    const [viewingMediaUrl, setViewingMediaUrl] = useState(null);
    const mediaMessages = messages.filter((m) => m.type === "image" || m.type === "video");
    // نفس القائمة بصيغة المعاينة — تمكّن التنقّل بين الوسائط داخل شاشة المعلومات
    const infoMediaItems = mediaMessages
        .filter((m) => m.fileUrl)
        .map((m) => ({ url: m.fileUrl, type: m.type, name: m.fileName || m.text || "" }));
    const fileMessages = messages.filter((m) => m.type === "file");
    const totalMediaCount = mediaMessages.length + fileMessages.length;
    const [hideReadReceipts, setHideReadReceipts] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState("idle"); // idle | scanning | matched | error
    const [confirmingBlock, setConfirmingBlock] = useState(false);
    const [reported, setReported] = useState(false);
    // تجريبي فقط — بالإنتاج يُشتق من مفاتيح التشفير الفعلية لكلا الطرفين
    const mySafetyNumber = "XXXX  XXXX  XXXX  XXXX (تجريبي)";
    function handleVerify() {
        setVerifyStatus("scanning");
        setTimeout(() => {
            // محاكاة: بالإنتاج الحقيقي يقارن رمز QR الممسوح فعلياً بمفتاحك العام المشتق محلياً
            setVerifyStatus("matched");
        }, 1800);
    }
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col relative sawa-pop-in" },
        React.createElement(TopBar, { title: t("malwmat_almhadtha"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: "flex flex-col items-center py-5" },
                React.createElement("div", { className: "w-16 h-16 rounded-full flex items-center justify-center mb-2", style: { backgroundColor: colors.primaryLight } },
                    React.createElement(User, { size: 26, color: colors.primaryDark })),
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, conversation.name),
                React.createElement("span", { className: "text-[11px] mt-1", style: { color: colors.textMuted } }, t("mhadtha_mshfra_mn_trf"))),
            React.createElement("div", { className: "p-4" },
                (() => {
                    if (conversation.isSavedMessages)
                        return null;
                    const allFP = Object.values(groupPersons || {}).flat();
                    const fp = allFP.find(p => {
                        var _a;
                        return p.alive && conversation.name &&
                            ((_a = p.local_name) === null || _a === void 0 ? void 0 : _a.split(" ")[0]) &&
                            conversation.name.toLowerCase().includes(p.local_name.split(" ")[0].toLowerCase());
                    });
                    if (!fp)
                        return null;
                    return (React.createElement("button", { onClick: () => onOpenFamilyProfile === null || onOpenFamilyProfile === void 0 ? void 0 : onOpenFamilyProfile(fp), className: "w-full mb-4" },
                        React.createElement(Card, { className: `flex ${rowStart()} items-center gap-3`, style: { borderColor: colors.accent + "50", backgroundColor: colors.accent + "08" } },
                            React.createElement("span", { style: { fontSize: 20 } }, "\uD83E\uDD0D"),
                            React.createElement("div", { className: `flex-1 ${textStart()}` },
                                React.createElement("span", { className: "text-sm font-bold block", style: { color: colors.accent } }, t("mn_sla_alrhm")),
                                React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } },
                                    kinshipLabel(fp.kinship),
                                    " \u00B7 \u0627\u0636\u063A\u0637 \u0644\u0639\u0631\u0636 \u0645\u0644\u0641\u0647 \u0641\u064A \u0635\u0644\u0629 \u0627\u0644\u0631\u062D\u0645")),
                            React.createElement(ChevronLeft, { size: 15, color: colors.accent, style: { transform: "scaleX(-1)" } }))));
                })(),
                React.createElement("button", { onClick: exportChat, className: "w-full mb-4" },
                    React.createElement(Card, { className: `flex ${rowStart()} items-center gap-3` },
                        React.createElement(Download, { size: 17, color: colors.primary }),
                        React.createElement("div", { className: `flex-1 ${textStart()}` },
                            React.createElement("span", { className: "text-sm font-bold block", style: { color: colors.text } }, t("tsdyr_almhadtha")),
                            React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } },
                                "\u062D\u0641\u0638 \u0646\u0633\u062E\u0629 \u0646\u0635\u064A\u0629 (",
                                messages.length,
                                " \u0631\u0633\u0627\u0644\u0629)")))),
                React.createElement("h4", { className: `text-xs font-extrabold mb-2 flex ${rowStart()} items-center gap-1.5`, style: { color: colors.text } },
                    React.createElement(Images, { size: 13, color: colors.primary }),
                    " \u0627\u0644\u0648\u0633\u0627\u0626\u0637 \u0627\u0644\u0645\u0634\u062A\u0631\u0643\u0629 (",
                    totalMediaCount,
                    ")"),
                totalMediaCount === 0 ? (React.createElement(Card, { className: "mb-3" },
                    React.createElement("p", { className: "text-xs text-center", style: { color: colors.textMuted } }, t("la_twjd_wsayt_mshtrka")))) : (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-2` },
                        React.createElement(Chip, { label: t("swr_wfydyw", { length: mediaMessages.length }), active: mediaTab === "media", onPress: () => setMediaTab("media") }),
                        React.createElement(Chip, { label: t("mlfat", { length: fileMessages.length }), active: mediaTab === "files", onPress: () => setMediaTab("files") })),
                    mediaTab === "media" ? (mediaMessages.length === 0 ? (React.createElement(Card, { className: "mb-3" },
                        React.createElement("p", { className: "text-xs text-center", style: { color: colors.textMuted } }, t("ma_fyh_swr_aw")))) : (React.createElement("div", { className: "grid grid-cols-3 gap-1.5 mb-3" }, mediaMessages.map((m) => (React.createElement("button", { key: m.id, onClick: () => setViewingMediaUrl(m.fileUrl), className: "aspect-square rounded-lg overflow-hidden relative", style: { backgroundColor: colors.card } }, m.type === "video" ? (React.createElement(React.Fragment, null,
                        m.fileUrl ? React.createElement("video", { src: m.fileUrl, className: "w-full h-full object-cover" }) : (React.createElement("div", { className: "w-full h-full flex items-center justify-center", style: { backgroundColor: colors.border + "44" } },
                            React.createElement(Video, { size: 16, color: colors.textMuted }))),
                        React.createElement("div", { className: "absolute inset-0 flex items-center justify-center", style: { backgroundColor: "rgba(0,0,0,0.25)" } },
                            React.createElement(Play, { size: 16, color: "#fff", fill: "#fff" })))) : m.fileUrl ? (React.createElement("img", { src: m.fileUrl, alt: m.text, className: "w-full h-full object-cover" })) : (React.createElement("div", { className: "w-full h-full flex items-center justify-center", style: { backgroundColor: colors.border + "44" } },
                        React.createElement(Images, { size: 16, color: colors.textMuted }))))))))) : (fileMessages.length === 0 ? (React.createElement(Card, { className: "mb-3" },
                        React.createElement("p", { className: "text-xs text-center", style: { color: colors.textMuted } }, t("ma_fyh_mlfat_mshtrka")))) : (React.createElement("div", { className: "mb-3" }, fileMessages.map((m) => (React.createElement(Card, { key: m.id, className: `flex ${rowStart()} items-center mb-1.5` },
                        React.createElement(FileIconLucide, { size: 16, color: colors.primary }),
                        React.createElement("div", { className: `flex-1 ${me("2")}` },
                            React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, m.text),
                            React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                                (m.fileSize / 1024).toFixed(0),
                                " \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A")))))))))),
                React.createElement("h4", { className: `text-xs font-extrabold mb-2 flex ${rowStart()} items-center gap-1.5`, style: { color: colors.text } },
                    React.createElement(ShieldCheck, { size: 13, color: colors.primary }),
                    t("altshfyr")),
                React.createElement(Card, { className: "mb-3" },
                    React.createElement("p", { className: "text-[10px] mb-1", style: { color: colors.textMuted } }, t("bsma_alaman")),
                    React.createElement("p", { className: "text-xs font-bold tracking-widest mb-3", style: { color: colors.text } }, mySafetyNumber),
                    verifyStatus === "idle" && (React.createElement(Button, { icon: QrCode, label: t("msh_rmz_llthqq_almtbadl", { name: conversation.name }), onPress: handleVerify, variant: "outline" })),
                    verifyStatus === "scanning" && React.createElement("p", { className: "text-xs text-center", style: { color: colors.accent } }, t("jar_almsh_abr_alkamyra")),
                    verifyStatus === "matched" && (React.createElement("p", { className: "text-xs text-center font-bold", style: { color: colors.success } },
                        "\u0645\u062A\u0637\u0627\u0628\u0642\u0629 \u2713 \u2014 \u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0647\u0648\u064A\u0629 ",
                        conversation.name)),
                    verifyStatus === "error" && React.createElement("p", { className: "text-xs text-center", style: { color: colors.danger } }, t("tadhr_alwswl_llkamyra"))),
                React.createElement(Card, { className: "mb-3" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("rsayl_dhatya_alakhtfa")),
                        React.createElement(Clock, { size: 14, color: colors.primary })),
                    React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2` }, DISAPPEARING_OPTIONS.map((o) => (React.createElement(Chip, { key: o.key, label: t(o.labelKey), active: disappearing === o.key, onPress: () => setDisappearing(o.key) }))))),
                React.createElement("h4", { className: `text-xs font-extrabold mb-2 flex ${rowStart()} items-center gap-1.5`, style: { color: colors.text } },
                    React.createElement(BellIcon, { size: 13, color: colors.primary }),
                    t("alishaarat")),
                React.createElement(Card, { className: "mb-3" },
                    React.createElement("p", { className: "text-[10px] mb-2", style: { color: colors.textMuted } }, t("ktm_alishaarat")),
                    React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-2` }, MUTE_OPTIONS.map((o) => (React.createElement(Chip, { key: o.key, label: t(o.labelKey), active: muteDuration === o.key, onPress: () => handleSetMute(o.key) })))),
                    React.createElement("p", { className: "text-[10px] mb-2", style: { color: colors.textMuted } }, t("ahtzaz_tlqayy_ythkm_bh")),
                    React.createElement("p", { className: "text-[10px] mb-1.5", style: { color: colors.textMuted } }, t("nghma_alishaar_lhdhy_almhadtha")),
                    React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2` }, NOTIFICATION_TONES.map((tone) => (React.createElement(Chip, { key: tone.key, label: t(tone.labelKey), active: notificationTone === tone.key, onPress: () => setNotificationTone(tone.key) }))))),
                chatFolders.length > 0 && (React.createElement(React.Fragment, null,
                    React.createElement("h4", { className: `text-xs font-extrabold mb-2 flex ${rowStart()} items-center gap-1.5`, style: { color: colors.text } },
                        React.createElement(FileText, { size: 13, color: colors.primary }),
                        t("almjld")),
                    React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` },
                        React.createElement(Chip, { label: t("bla_mjld"), active: !folderId, onPress: () => onSetFolder(null) }),
                        chatFolders.map((f) => (React.createElement(Chip, { key: f.id, label: f.name, active: folderId === f.id, onPress: () => onSetFolder(f.id) })))))),
                React.createElement("h4", { className: `text-xs font-extrabold mb-2 flex ${rowStart()} items-center gap-1.5`, style: { color: colors.text } },
                    React.createElement(Palette, { size: 13, color: colors.primary }),
                    t("nmt_almhadtha")),
                React.createElement("p", { className: "text-[10px] mb-2", style: { color: colors.textMuted } }, t("khas_byk_wbhdhy_almhadtha")),
                React.createElement("div", { className: "grid grid-cols-3 gap-2 mb-3" }, CHAT_THEMES.map((ctheme) => (React.createElement("button", { key: ctheme.key, onClick: () => setBackground(ctheme.key), className: "rounded-2xl overflow-hidden border-2 flex flex-col items-center py-2.5", style: { borderColor: background === ctheme.key ? colors.primary : colors.border, background: ctheme.gradient || colors.bg } },
                    React.createElement("div", { className: "rounded-full px-3 py-1 mb-1", style: { backgroundColor: ctheme.bubbleColor || colors.primary } },
                        React.createElement("span", { className: "text-[9px] font-bold text-white" }, t("ana"))),
                    React.createElement("span", { className: "text-[9px] font-bold", style: { color: ctheme.key === "dark" ? "#fff" : colors.text } }, ctheme.label))))),
                React.createElement("h4", { className: "text-xs font-extrabold mb-2", style: { color: colors.text } }, t("idara_almsaha")),
                React.createElement(Card, { className: "mb-2" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between` },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("qfl_hdhy_almhadtha")),
                        React.createElement("button", { onClick: onToggleLock, className: "w-10 h-5 rounded-full relative", style: { backgroundColor: isLocked ? colors.primary : colors.border } },
                            React.createElement("span", { className: "absolute top-0.5 w-4 h-4 rounded-full bg-white", style: { [isLocked ? "right" : "left"]: 2 } }))),
                    isLocked && (React.createElement("p", { className: `text-[10px] mt-2 ${textStart()}`, style: { color: colors.textMuted } }, t("hdhy_almhadtha_mkhfya_alan")))),
                React.createElement(Card, { className: "mb-2" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between` },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("ikhfa_alamat_alqraa")),
                        React.createElement("button", { onClick: () => setHideReadReceipts(!hideReadReceipts), className: "w-10 h-5 rounded-full relative", style: { backgroundColor: hideReadReceipts ? colors.primary : colors.border } },
                            React.createElement("span", { className: "absolute top-0.5 w-4 h-4 rounded-full bg-white", style: { [hideReadReceipts ? "right" : "left"]: 2 } })))),
                !isBlocked ? (React.createElement("button", { onClick: () => setConfirmingBlock(true), className: `w-full flex ${rowStart()} items-center justify-center gap-2 rounded-xl p-3 border`, style: { borderColor: colors.danger, backgroundColor: colors.card } },
                    React.createElement(Ban, { size: 15, color: colors.danger }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.danger } }, t("hzr_jha_alatsal")))) : (React.createElement("div", { className: `w-full flex ${rowStart()} items-center justify-center gap-2 rounded-xl p-3 border mb-2`, style: { borderColor: colors.danger, backgroundColor: colors.danger + "11" } },
                    React.createElement(ShieldCheck, { size: 15, color: colors.danger }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.danger } }, t("mhzwr_ma_rah_tstqbl")),
                    React.createElement("button", { onClick: onUnblock, className: "text-xs font-bold underline", style: { color: colors.primary } }, t("ilgha_alhzr")))),
                confirmingBlock && (React.createElement("div", { className: "rounded-xl border p-3 mt-2", style: { borderColor: colors.danger } },
                    React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } },
                        "\u0645\u062A\u0623\u0643\u062F \u0645\u0646 \u062D\u0638\u0631 ",
                        conversation.name,
                        "\u061F \u0644\u0646 \u064A\u0642\u062F\u0631 \u064A\u0631\u0633\u0644 \u0644\u0643 \u0631\u0633\u0627\u0626\u0644 \u0628\u0639\u062F\u0647\u0627"),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("button", { onClick: () => { onBlock(); setConfirmingBlock(false); }, className: "flex-1 rounded-xl py-2", style: { backgroundColor: colors.danger } },
                            React.createElement("span", { className: "text-xs font-bold text-white" }, t("nam_ahzr"))),
                        React.createElement("button", { onClick: () => setConfirmingBlock(false), className: "flex-1 rounded-xl py-2 border", style: { borderColor: colors.border } },
                            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("ilgha")))))),
                !reported ? (React.createElement("button", { onClick: () => { setReported(true); onReport(); }, className: `w-full flex ${rowStart()} items-center justify-center gap-2 rounded-xl p-3 border mt-2`, style: { borderColor: colors.danger, backgroundColor: colors.card } },
                    React.createElement(Flag, { size: 15, color: colors.danger }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.danger } }, t("iblagh_an_mshkla")))) : (React.createElement("p", { className: "text-xs text-center mt-2", style: { color: colors.textMuted } }, t("tm_irsal_blaghk_snrajah")))),
            viewingMediaUrl && (React.createElement(MediaLightbox, { items: infoMediaItems, startIndex: Math.max(0, infoMediaItems.findIndex((it) => it.url === viewingMediaUrl)), onClose: () => setViewingMediaUrl(null) }))))); 
}
// أسماء وهمية تُختار عشوائياً عند "مسح" رمز QR (مو اسم حقيقي يُدخله المستخدم)
//@@sawa-part:4
