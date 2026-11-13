// ═══ C263: المحاسب الشخصيّ (Personal Accountant, P1) ═══
// Onboarding (base currency, time zone, month start) · Overview (KPIs, cash flow, categories, 6-month trend) · Ledger (add/edit/delete).
// Server: pfm.* ops in the Worker (Sawa-deploy-test/pfm). The client never computes stored totals; it shows what the server returns.
// One top-level name only (AccountantScreen) so nothing collides with the rest of the joined app script.
const AccountantScreen = (function () {
    const h = React.createElement;
    const TEAL = "#0f766e";
    // Teal as text/icon colour: #0f766e is only 3.2:1 on the dark card, so dark mode uses a light teal (≥ 4.5:1).
    // Read from the root's data-theme (set by the theme provider); callers re-render on theme change via useTheme.
    const tealInk = () => { try { return document.documentElement.getAttribute("data-theme") === "dark" ? "#5EEAD4" : TEAL; } catch (e) { return TEAL; } };
    const L = window.__L || {};
    const Repeat = L.Repeat || L.RefreshCw;   // not in the shared icon list of app.p1
    const ICONS = { cart: "ShoppingBag", home: "Home", bolt: "Zap", car: "Car", phone: "Smartphone", heart: "Heart", book: "Bookmark", users: "Users",
        wrench: "Settings", percent: "Target", dots: "MoreHorizontal", briefcase: "Briefcase", laptop: "Server", receipt: "FileText", gift: "Gift",
        plus: "Plus", tag: "Bookmark", cup: "Coffee" };
    const iconOf = (name) => L[ICONS[name]] || L.Circle || L.Bookmark;
    const ar = () => isRTL();
    const locale = () => (ar() ? "ar-u-nu-latn" : "en");
    // An amount as the user typed it, as a number for the "is it > 0" checks. The inputs let Arabic digits (٠-٩) and
    // the Arabic decimal mark (٫) through, which Number() reads as NaN. The server parses the text itself (toMinor).
    const num = (v) => Number(String(v == null ? "" : v).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/٫/g, ".").replace(/[,\s٬]/g, ""));
    const call = (op, payload) => {
        if (!window.SawaSync || !SawaSync.call) return Promise.reject(new Error(tl("الخدمة غير متاحة دون اتصال", "Not available offline")));
        return SawaSync.call(op, payload || {});
    };
    const ERR = {
        pfm_not_configured: ["الخدمة لم تُفعَّل على الخادم بعد", "This service isn't switched on yet"],
        bad_amount: ["المبلغ غير صحيح", "Enter a valid amount"],
        too_precise: ["عدد الخانات العشريّة أكثر ممّا تسمح به العملة", "Too many decimal places for this currency"],
        bad_fx_rate: ["سعر الصرف غير صحيح", "Enter a valid exchange rate"],
        bad_category: ["اختر فئة", "Choose a category"],
        category_kind_mismatch: ["الفئة لا تناسب نوع الحركة", "That category doesn't match the entry type"],
        category_archived: ["هذه الفئة مؤرشفة", "That category is archived"],
        stale: ["تغيّرت هذه الحركة من جهازٍ آخر — أعد فتحها", "This entry changed on another device — reopen it"],
        locked_after_first_entry: ["لا يمكن تغيير هذا بعد تسجيل أوّل حركة", "This can't change after the first entry"],
        too_long: ["النصّ طويل جدّاً", "Text is too long"],
        busy: ["الخادم مشغول — حاول ثانيةً", "Server busy — try again"],
        tax_not_registered: ["فعّل «أفرض ضريبة» في بيانات النشاط أوّلاً", "Turn on “I charge tax” in business details first"],
        business_name_missing: ["أضف اسم نشاطك في بيانات النشاط قبل الإرسال", "Add your business name in business details before sending"],
        not_draft: ["الفاتورة المُرسلة لا تُعدَّل — ألغها وأصدر جديدة", "A sent invoice can't be edited — cancel it and issue a new one"],
        has_payments: ["عليها دفعات مسجّلة، فلا تُلغى", "It has recorded payments, so it can't be cancelled"],
        overpay: ["المبلغ أكبر من المستحقّ", "That's more than the amount due"],
        claims_open: ["هناك بلاغات دفع من العميل لم تُراجعها — أكّدها أو ارفضها أوّلاً", "A payer reported payments you haven't checked — confirm or reject them first"],
        not_payable: ["لا يمكن تسجيل دفعة على هذه الفاتورة", "Payments can't be recorded on this invoice"],
        bad_items: ["أكمل وصف كلّ بندٍ وسعره", "Give every line a description and a price"],
        bad_client: ["اكتب اسم العميل", "Enter the client's name"],
        bad_sawa_id: ["رمز سوا عشرة أرقام، مثل 136-860-8541", "A Sawa ID is 10 digits, like 136-860-8541"],
        bad_logo: ["الشعار يجب أن يكون صورة PNG أو JPEG أو WebP صغيرة", "The logo must be a small PNG, JPEG or WebP image"],
        bad_account: ["تحقّق من بيانات الحساب (الرقم أو الآيبان)", "Check the account details (number or IBAN)"],
        bad_prefix: ["البادئة حروف إنجليزيّة كبيرة أو أرقام، حتّى 8", "The prefix is up to 8 capital letters or digits"],
        bad_rate: ["النسبة بين 0 و100", "Rates are between 0 and 100"],
        bad_date: ["تاريخ الاستحقاق قبل تاريخ الإصدار", "The due date is before the issue date"],
        bad_receipt: ["الإيصال يجب أن يكون صورة (JPEG أو PNG أو WebP) حتّى 400 كيلوبايت", "The receipt must be a JPEG, PNG or WebP photo up to 400 KB"],
        range_too_long: ["الفترة أطول من 24 شهراً", "Pick 24 months or fewer"],
        bad_month: ["بداية الفترة بعد نهايتها", "The start month is after the end month"],
        pfm_not_initialised: ["أعدّ المحاسب الشخصيّ أوّلاً", "Set up the personal accountant first"],
        forbidden: ["ليس لديك صلاحيّة لهذا الإجراء", "You don't have permission for this"],
        not_found: ["غير متاح — ربما أُزيل من المشروع", "Not available — you may have been removed from it"],
        bad_name: ["اكتب اسم المشروع", "Enter the project name"],
        bad_budget: ["الميزانيّة يجب أن تكون أكبر من صفر", "The budget must be more than zero"],
        bad_dates: ["تاريخ النهاية قبل البداية", "The end date is before the start date"],
        bad_template: ["اختر نوع المشروع", "Choose the project type"],
        currency_locked: ["لا يمكن تغيير عملة المشروع بعد إنشائه", "The project currency can't change after it's created"],
        bad_transition: ["لا يمكن الانتقال إلى هذه الحالة", "The project can't move to that status"],
        bad_line: ["هذا البند ليس في التقدير المعتمد", "That line isn't in the approved estimate"],
        line_on_non_expense: ["البند يُربط بالمصروف فقط", "A line can only be set on an expense"],
        fx_rate_required: ["أدخل سعر الصرف للعملة المختلفة", "Enter the exchange rate for the other currency"],
        // C287
        bad_file: ["الملفّ يجب أن يكون صورة (JPEG أو PNG أو WebP) أو PDF حتّى 4 ميغابايت", "The file must be a JPEG, PNG or WebP photo or a PDF up to 4 MB"],
        bad_price_date: ["تاريخ السعر يجب ألّا يكون بعد اليوم", "The price date can't be after today"],
        too_many_files: ["بلغ عدد المرفقات الحدّ الأقصى", "The attachment limit is reached"],
        file_removed: ["أُزيل هذا المرفق", "This attachment was removed"],
        bad_quote: ["السعر المعروض يُسجَّل مع عرض سعرٍ على بند", "A quoted price goes with a quote on a line"],
        reason_required: ["اكتب السبب", "Enter a reason"],
        copy_expense_only: ["يُنسخ المصروف فقط إلى محاسبك الشخصي", "Only expenses can be copied to your personal accountant"],
        draft_exists: ["أنهِ المراجعة المفتوحة أوّلاً", "Finish the open revision first"],
        reason_required: ["اكتب سبب المراجعة", "Enter the reason for the change"],
        baseline_locked: ["التقدير المعتمد لا يُعدَّل — أنشئ مراجعة جديدة", "The approved estimate can't be edited — start a new revision"],
        empty_estimate: ["أضف بنداً واحداً على الأقلّ", "Add at least one item"],
        dup_line_key: ["بند مكرّر", "Duplicate item"],
        too_many_lines: ["عدد البنود أكثر من 400", "More than 400 items"],
        no_baseline: ["لا يوجد تقدير معتمد بعد", "There is no approved estimate yet"],
        bad_project_status: ["لا يمكن تعديل التقدير في هذه الحالة", "The estimate can't change in this status"],
        linked_project_entry: ["هذه الحركة مرتبطة بمشروع — عدّلها من المشروع", "This entry belongs to a project — edit it there"],
        owner_cannot_leave: ["المالك لا يغادر مشروعه — احذفه إن أردت", "The owner can't leave — delete the project instead"],
        owner_role_fixed: ["لا يمكن تغيير دور المالك", "The owner's role can't change"],
        invite_used: ["استُخدمت هذه الدعوة كلّها", "This invite has no uses left"],
        invite_expired: ["انتهت صلاحيّة الدعوة", "This invite has expired"],
        bad_invite: ["رمز الدعوة غير صحيح", "That invite code isn't valid"],
        bad_role: ["الدور غير مسموح", "That role isn't allowed"],
        bad_max_uses: ["عدد الاستخدامات من 1 إلى 10", "Uses must be from 1 to 10"],
        bad_days: ["مدّة الصلاحيّة من 1 إلى 30 يوماً", "Validity must be from 1 to 30 days"],
        confirm_required: ["تأكيد الحذف غير مكتمل", "The deletion wasn't confirmed"],
        bad_idem_key: ["أعد المحاولة", "Try again"],
        bad_qty: ["الكمّيّة يجب أن تكون أكبر من صفر", "The quantity must be more than zero"],
        bad_category: ["اختر فئة", "Choose a category"],
    };
    const errText = (e) => { const m = String((e && e.message) || e || ""); const k = m.split(":")[0]; return ERR[k] ? tl(ERR[k][0], ERR[k][1]) : m; };

    // ── money and dates ──
    const expOf = (cur) => { try { return new Intl.NumberFormat("en", { style: "currency", currency: cur }).resolvedOptions().maximumFractionDigits; } catch (e) { return 2; } };
    const fmtCache = {};
    function money(minor, cur, opts) {
        const k = locale() + cur + (opts && opts.compact ? "c" : "");
        let f = fmtCache[k];
        if (!f) { try { f = new Intl.NumberFormat(locale(), Object.assign({ style: "currency", currency: cur, currencyDisplay: "narrowSymbol" }, opts && opts.compact ? { notation: "compact", maximumFractionDigits: 1 } : {})); } catch (e) { f = new Intl.NumberFormat(locale(), { style: "currency", currency: cur }); } fmtCache[k] = f; }
        return f.format((minor || 0) / Math.pow(10, expOf(cur))).replace(/[‎‏؜]/g, "");
    }
    // Typed numbers: Arabic-Indic (٠-٩) and Persian (۰-۹) digits become 0-9 and the Arabic decimal mark (٫) a dot, so an
    // Arabic keyboard works in every amount field and Number() can read the value (it returns NaN for ٠-٩, which kept Save disabled).
    const numIn = (v, keepCommas) => String(v || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6F0))
        .replace(/٫/g, ".").replace(/٬/g, keepCommas ? "," : "").replace(keepCommas ? /[^0-9.,]/g : /[^0-9.]/g, "");   // commas (thousands) are dropped unless the field keeps them
    const pct = (bp) => (bp == null ? "—" : (bp / 100).toFixed(Math.abs(bp) >= 1000 ? 0 : 1) + "%");
    const monthName = (m) => { const [y, mo] = m.split("-").map(Number); return new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, 1)); };
    const monthShort = (m) => { const [y, mo] = m.split("-").map(Number); return new Intl.DateTimeFormat(locale(), { month: "short", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, 1)); };
    const dayLabel = (d) => { const [y, mo, da] = d.split("-").map(Number); return new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, da)); };
    const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
    const newKey = () => { try { return crypto.randomUUID(); } catch (e) { return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); } };
    const catName = (c) => (c ? (ar() ? c.nameAr || c.name : c.name) : tl("بلا فئة", "Uncategorised"));

    // ── currencies: the twelve Sawa accepts (the Worker enforces the same list: pfm-core.mjs ALLOWED_CURRENCIES) ──
    const CURS = ["SDG", "USD", "CNY", "QAR", "SAR", "AED", "GBP", "CAD", "OMR", "EGP", "KWD", "JPY"];
    function currencyList() {
        let names = null; try { names = new Intl.DisplayNames([ar() ? "ar" : "en"], { type: "currency" }); } catch (e) {}
        return CURS.map((c) => ({ code: c, label: c + (names ? " — " + names.of(c) : "") }));
    }
    // a suggestion only: the user always confirms the currency
    const REGION_CUR = { US: "USD", GB: "GBP", SA: "SAR", AE: "AED", EG: "EGP", SD: "SDG", QA: "QAR", OM: "OMR", CN: "CNY", CA: "CAD", KW: "KWD", JP: "JPY" };
    function guessCurrency() {
        try { const r = new Intl.Locale(navigator.language).maximize().region; if (REGION_CUR[r]) return REGION_CUR[r]; } catch (e) {}
        return "USD";
    }

    // ── P2 helpers: same matching as the server (pfm-core normText / matchCategoryRule), and labels ──
    const normText = (v) => String(v || "").toLowerCase().normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "")
        .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627").replace(/\u0649/g, "\u064A").replace(/\u0629/g, "\u0647").replace(/\s+/g, " ").trim();
    function matchRule(rules, kind, who, note) {
        const hay = normText((who || "") + " | " + (note || "")); let best = null;
        (rules || []).forEach((r) => { const n = normText(r.contains); if (!n || (r.kind && r.kind !== kind) || hay.indexOf(n) < 0) return; if (!best || n.length > best.n.length) best = { n, r }; });
        return best && best.r;
    }
    const weekdayName = (i) => new Intl.DateTimeFormat(locale(), { weekday: "long", timeZone: "UTC" }).format(Date.UTC(2026, 10, 1 + i));   // 1 Nov 2026 is a Sunday
    function ruleText(rule) {
        if (!rule) return "";
        if (rule.freq === "weekly") return (rule.interval > 1 ? tl(`كلّ ${rule.interval} أسابيع`, `Every ${rule.interval} weeks`) : tl("أسبوعيّاً", "Weekly")) + " · " + weekdayName(rule.weekday);
        if (rule.freq === "yearly") return tl("سنويّاً", "Yearly") + " · " + new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long", timeZone: "UTC" }).format(Date.UTC(2026, rule.month - 1, rule.day));
        return (rule.interval > 1 ? tl(`كلّ ${rule.interval} أشهر`, `Every ${rule.interval} months`) : tl("شهريّاً", "Monthly")) + " · " + tl("يوم ", "day ") + rule.day;
    }
    const ruleFromDate = (freq, date) => { const [y, m, d] = date.split("-").map(Number);
        return freq === "weekly" ? { freq, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() } : freq === "yearly" ? { freq, month: m, day: d } : { freq: "monthly", day: d }; };
    const TOTAL = "_total";
    const budgetName = (id, cats) => (id === TOTAL ? tl("كلّ المصروفات", "All spending") : catName(cats[id]));
    function alertLine(a, cats, cur) {
        const name = budgetName(a.categoryId, cats), p = Math.round((a.spent * 100) / a.limit);
        if (a.kind === "pace") return tl(`${name}: بهذه الوتيرة ستصل إلى ${money(a.projected, cur)} من ${money(a.limit, cur)}`, `${name}: at this pace you'll reach ${money(a.projected, cur)} of ${money(a.limit, cur)}`);
        if (a.bp >= 10000 || a.spent > a.limit) return tl(`تجاوزت ميزانيّة ${name}: ${money(a.spent, cur)} من ${money(a.limit, cur)}`, `Over budget: ${name} — ${money(a.spent, cur)} of ${money(a.limit, cur)}`);
        return tl(`${name}: استُهلك ${p}% — بقي ${money(a.limit - a.spent, cur)}`, `${name}: ${p}% used — ${money(a.limit - a.spent, cur)} left`);
    }
    // Several thresholds can fire in one write (e.g. a budget set after spending): show only the most serious per budget.
    const sevOf = (a) => (a.kind === "pace" ? 9000 : a.bp);
    function topAlerts(list) { const by = {}; list.forEach((a) => { const c = by[a.categoryId]; if (!c || sevOf(a) > sevOf(c)) by[a.categoryId] = a; }); return Object.values(by).sort((a, b) => sevOf(b) - sevOf(a)); }
    // "spent / limit": each amount isolated, so Arabic symbols with dots don't reorder across the slash
    const ofLimit = (a, b, cur) => h("span", { style: { whiteSpace: "nowrap" } }, h("bdi", null, money(a, cur)), " / ", h("bdi", null, money(b, cur)));
    function Check({ checked, onChange, children }) {
        const { colors } = useTheme();
        return h("label", { style: { display: "flex", alignItems: "center", gap: 10, minHeight: 44, marginBottom: 8, fontSize: 13, color: colors.text, cursor: "pointer" } },
            h("input", { type: "checkbox", checked: !!checked, onChange: (e) => onChange(e.target.checked), style: { width: 20, height: 20, accentColor: TEAL } }), h("span", { dir: "auto" }, children));
    }
    // label: what the meter measures, e.g. "Food: 320 of 500" — without it a screen reader hears only "meter 64".
    function Meter({ usedBp, colors, label }) {
        const c = usedBp >= 10000 ? colors.danger : usedBp >= 8000 ? colors.warning : colors.success;
        const now = Math.round(usedBp / 100);
        return h("div", { role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.min(100, now), "aria-valuetext": now + "%", style: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: "hidden", border: "1px solid " + colors.border } },
            h("div", { style: { width: Math.min(100, usedBp / 100) + "%", height: "100%", backgroundColor: c, borderRadius: 4 } }));
    }

    // ── shared bits ──
    function Card({ children, style }) {
        const { colors } = useTheme();
        return h("div", { style: Object.assign({ backgroundColor: colors.card, border: "1px solid " + colors.border, borderRadius: 16, padding: 14 }, style) }, children);
    }
    function Btn({ children, onClick, kind, disabled, style, label, describedBy }) {
        const { colors } = useTheme();
        const primary = kind !== "ghost" && kind !== "danger";
        return h("button", { type: "button", onClick, disabled, "aria-label": label, "aria-describedby": describedBy, style: Object.assign({
            minHeight: 44, padding: "10px 16px", borderRadius: 12, border: primary ? 0 : "1px solid " + (kind === "danger" ? colors.danger : colors.border),
            backgroundColor: primary ? colors.primary : "transparent", color: primary ? "#fff" : kind === "danger" ? colors.danger : colors.text,
            fontWeight: 700, fontSize: 14, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }, style) }, children);
    }
    // A <label> wrapping several buttons would name (and click) only the first one, so groups get role="group".
    function Field({ label, children, hint, group }) {
        const { colors } = useTheme();
        return h(group ? "div" : "label", group ? { role: "group", "aria-label": label, style: { display: "block", marginBottom: 12 } } : { style: { display: "block", marginBottom: 12 } },
            h("div", { style: { fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 6 } }, label),
            children,
            hint && h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 4 } }, hint));
    }
    const inputStyle = (colors) => ({ width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 12, border: "1px solid " + colors.border, backgroundColor: colors.bg, color: colors.text, fontSize: 15, boxSizing: "border-box" });
    // A segmented control. tabs: it switches views (tablist/tab; idBase links each tab to its panel, see panelProps).
    // Otherwise it's a choice (radiogroup/radio), e.g. Spending | Income. Either way: one tab stop, arrow keys move (mirrored in Arabic), Home/End.
    function Seg({ options, value, onChange, tabs, idBase, label }) {
        const { colors } = useTheme();
        const ref = useRef(null);
        const onKey = (e) => {
            const i = options.findIndex((o) => o.value === value); let j = -1;
            const fwd = ar() ? "ArrowLeft" : "ArrowRight", back = ar() ? "ArrowRight" : "ArrowLeft";
            if (e.key === fwd || e.key === "ArrowDown") j = (i + 1) % options.length;
            else if (e.key === back || e.key === "ArrowUp") j = (i - 1 + options.length) % options.length;
            else if (e.key === "Home") j = 0; else if (e.key === "End") j = options.length - 1;
            if (j < 0) return;
            e.preventDefault(); onChange(options[j].value);
            const b = ref.current && ref.current.querySelectorAll("button")[j]; if (b) b.focus();
        };
        return h("div", { ref, role: tabs ? "tablist" : "radiogroup", "aria-label": label, onKeyDown: onKey, style: { display: "flex", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.bg, border: "1px solid " + colors.border } },
            options.map((o) => h("button", Object.assign({ key: o.value, type: "button", onClick: () => onChange(o.value), tabIndex: value === o.value ? 0 : -1 },
                tabs ? { role: "tab", "aria-selected": value === o.value, id: idBase ? idBase + "-tab-" + o.value : undefined, "aria-controls": idBase ? idBase + "-panel" : undefined }
                    : { role: "radio", "aria-checked": value === o.value }, {
                style: { flex: 1, minHeight: 44, borderRadius: 9, border: 0, fontWeight: 700, fontSize: 13, cursor: "pointer",
                    backgroundColor: value === o.value ? colors.card : "transparent", color: value === o.value ? (o.color || colors.text) : colors.textMuted,
                    boxShadow: value === o.value ? "0 1px 2px rgba(0,0,0,.12)" : "none" } }), o.label)));
    }
    // An in-app "are you sure?" row. Replaces window.confirm, which the Android/iOS WebViews may block and which isn't laid out right-to-left.
    // dark mode's danger red is light (#E5695C): white on it is 3.2:1, so the label is dark there (as the app's toasts do)
    const onDangerInk = (colors, isDark) => (isDark ? colors.bg : "#fff");
    function ConfirmRow({ text, confirmLabel, onConfirm, onCancel, danger = true }) {
        const { colors, isDark } = useTheme();
        const yes = useRef(null);
        useEffect(() => { if (yes.current) yes.current.focus(); }, []);
        return h("div", { role: "alertdialog", "aria-label": text, style: { padding: 12, marginBottom: 12, borderRadius: 12, border: "1px solid " + (danger ? colors.danger : colors.border), backgroundColor: colors.bg } },
            h("div", { style: { fontSize: 14, fontWeight: 700, marginBottom: 10, color: colors.text } }, text),
            h("div", { style: { display: "flex", gap: 8 } },
                h(Btn, { kind: "ghost", onClick: onCancel, style: { flex: 1 } }, tl("إلغاء", "Cancel")),
                h("button", { ref: yes, type: "button", onClick: onConfirm, style: { flex: 1, minHeight: 44, borderRadius: 12, border: 0, fontWeight: 700, fontSize: 14, cursor: "pointer",
                    backgroundColor: danger ? colors.danger : colors.primary, color: danger ? onDangerInk(colors, isDark) : "#fff" } }, confirmLabel)));
    }
    // ask(text, confirmLabel, fn) shows a ConfirmRow; `node` is where it renders.
    function useConfirm() {
        const [q, setQ] = useState(null);
        const node = q && h(ConfirmRow, { text: q.text, confirmLabel: q.label, onCancel: () => setQ(null), onConfirm: () => { const fn = q.fn; setQ(null); fn(); } });
        return [(text, label, fn) => setQ({ text, label, fn }), node];
    }
    // ask({ text, confirmLabel, danger, input: { label, required, decimal } }) → Promise: the typed text (or true), or null if cancelled.
    // An in-app replacement for window.confirm / window.prompt (blocked or unstyled in the Android/iOS WebViews, never right-to-left).
    // Rendered by the DialogHost inside the accountant screen; without one it falls back to the browser dialogs.
    let dlgSet = null;
    function ask(o) {
        return new Promise((res) => {
            if (!dlgSet) { const v = o.input ? window.prompt(o.text, "") : window.confirm(o.text); res(o.input ? v : v ? true : null); return; }
            dlgSet(Object.assign({}, o, { res }));
        });
    }
    function AskDialog({ d, done }) {
        const { colors, isDark } = useTheme();
        const box = useRef(null), first = useRef(null);
        const [v, setV] = useState("");
        const inp = d.input, ok = !inp || !inp.required || v.trim().length > 0;
        const finish = (yes) => done(yes ? (inp ? (inp.decimal ? numIn(v) : v.trim()) : true) : null);
        useEffect(() => {
            const prev = document.activeElement; if (first.current) first.current.focus();
            // capture on window: runs before the sheet's own Escape/Tab handlers and stops them
            const k = (e) => {
                if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); finish(false); return; }
                if (e.key !== "Tab" || !box.current) return;
                e.stopPropagation();
                const els = Array.from(box.current.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null); if (!els.length) return;
                const a = els[0], z = els[els.length - 1];
                if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
            };
            window.addEventListener("keydown", k, true);
            return () => { window.removeEventListener("keydown", k, true); try { if (prev && prev.focus) prev.focus(); } catch (e) {} };
        }, []);
        const tid = "pfm-ask-text";
        return h("div", { dir: ar() ? "rtl" : "ltr", onClick: (e) => { if (e.target === e.currentTarget) finish(false); },
            style: { position: "fixed", inset: 0, zIndex: 80, backgroundColor: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            h("div", { ref: box, role: "alertdialog", "aria-modal": true, "aria-labelledby": tid, style: { width: "100%", maxWidth: 400, backgroundColor: colors.card, color: colors.text, borderRadius: 16, padding: 18,
                border: "1px solid " + (d.danger ? colors.danger : colors.border) } },
                h("div", { id: tid, style: { fontSize: 15, fontWeight: 700, lineHeight: 1.6, marginBottom: 14 } }, d.text),
                inp && h("label", { style: { display: "block", marginBottom: 14 } },
                    h("div", { style: { fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 6 } }, inp.label + (inp.required ? "" : tl(" (اختياريّ)", " (optional)"))),
                    h("input", { ref: first, value: v, dir: inp.decimal ? "ltr" : "auto", inputMode: inp.decimal ? "decimal" : undefined, maxLength: 300,
                        onChange: (e) => setV(inp.decimal ? numIn(e.target.value) : e.target.value), onKeyDown: (e) => { if (e.key === "Enter" && ok) finish(true); }, style: inputStyle(colors) })),
                h("div", { style: { display: "flex", gap: 8 } },
                    h("button", { ref: inp ? null : first, type: "button", onClick: () => finish(false), style: { flex: 1, minHeight: 44, borderRadius: 12, border: "1px solid " + colors.border, backgroundColor: "transparent", color: colors.text, fontWeight: 700, fontSize: 14, cursor: "pointer" } }, d.cancelLabel || tl("إلغاء", "Cancel")),
                    h("button", { type: "button", disabled: !ok, onClick: () => finish(true), style: { flex: 1, minHeight: 44, borderRadius: 12, border: 0, fontWeight: 700, fontSize: 14, cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.5,
                        backgroundColor: d.danger ? colors.danger : colors.primary, color: d.danger ? onDangerInk(colors, isDark) : "#fff" } }, d.confirmLabel || tl("متابعة", "Continue")))));
    }
    function DialogHost() {
        const [d, setD] = useState(null);
        useEffect(() => { dlgSet = setD; return () => { if (dlgSet === setD) dlgSet = null; }; }, []);
        return d ? h(AskDialog, { key: d.text, d, done: (val) => { setD(null); d.res(val); } }) : null;
    }
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    // dirty: the form has unsaved input — closing by backdrop, Escape or ✕ asks first instead of dropping it.
    function Sheet({ title, onClose, children, dirty }) {
        const { colors } = useTheme();
        const panel = useRef(null);
        const [asking, setAsking] = useState(false);
        const tryClose = () => { if (dirty) setAsking(true); else onClose(); };
        const closeRef = useRef(tryClose); closeRef.current = tryClose;
        useEffect(() => {
            const prev = document.activeElement;
            // focus moves into the sheet (unless a field took it with autoFocus) and returns where it was on close
            const p = panel.current; if (p && !p.contains(document.activeElement)) { const f = p.querySelector(FOCUSABLE); (f || p).focus(); }
            const k = (e) => {
                if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
                if (e.key !== "Tab" || !panel.current) return;
                const els = Array.from(panel.current.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
                if (!els.length) return;
                const first = els[0], last = els[els.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            };
            window.addEventListener("keydown", k);
            return () => { window.removeEventListener("keydown", k); try { if (prev && prev.focus) prev.focus(); } catch (e) {} };
        }, []);
        return h("div", { role: "dialog", "aria-modal": true, "aria-label": title, dir: ar() ? "rtl" : "ltr", onClick: (e) => { if (e.target === e.currentTarget) tryClose(); },
            style: { position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" } },
            h("div", { ref: panel, tabIndex: -1, style: { width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", backgroundColor: colors.card, color: colors.text, outline: "none",
                borderRadius: "20px 20px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom,0px) + 16px)" } },
                h("div", { style: { display: "flex", alignItems: "center", marginBottom: 12 } },
                    h("div", { style: { flex: 1, fontWeight: 800, fontSize: 17 } }, title),
                    h("button", { type: "button", onClick: tryClose, "aria-label": tl("إغلاق", "Close"), style: { width: 44, height: 44, border: 0, borderRadius: 22, backgroundColor: colors.bg, color: colors.text, cursor: "pointer" } }, h(X, { size: 18 }))),
                asking && h(ConfirmRow, { text: tl("تجاهل ما كتبته؟", "Discard what you've entered?"), confirmLabel: tl("تجاهل", "Discard"), onCancel: () => setAsking(false), onConfirm: onClose }),
                children));
    }

    // ── onboarding ──
    function Onboarding({ onDone }) {
        const { colors } = useTheme();
        const [cur, setCur] = useState(guessCurrency);
        const tz0 = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } })();
        const [tz, setTz] = useState(tz0);
        const [start, setStart] = useState(1);
        const [busy, setBusy] = useState(false), [err, setErr] = useState("");
        const tzs = useMemo(() => { try { return Intl.supportedValuesOf("timeZone"); } catch (e) { return [tz0, "UTC"]; } }, []);
        const curs = useMemo(currencyList, []);
        const go = () => { setBusy(true); setErr(""); call("pfm.init", { baseCurrency: cur, tz, monthStartDay: start, locale: ar() ? "ar" : "en" }).then(onDone, (e) => { setErr(errText(e)); setBusy(false); }); };
        return h("div", { style: { padding: 16 } },
            h(Card, null,
                h("div", { style: { fontWeight: 800, fontSize: 18, marginBottom: 4 } }, tl("لنبدأ", "Let's set up")),
                h("p", { style: { fontSize: 13, color: colors.textMuted, margin: "0 0 16px", lineHeight: 1.6 } },
                    tl("اختر العملة التي تريد رؤية مجاميعك بها. يمكنك تسجيل أيّ حركة بأيّ عملة.", "Pick the currency you want your totals in. You can record any entry in any currency.")),
                h(Field, { label: tl("عملة التقارير", "Reporting currency"), hint: tl("لا يمكن تغييرها بعد تسجيل أوّل حركة", "Can't be changed after your first entry") },
                    h("select", { value: cur, onChange: (e) => setCur(e.target.value), style: inputStyle(colors) }, curs.map((c) => h("option", { key: c.code, value: c.code }, c.label)))),
                h(Field, { label: tl("المنطقة الزمنيّة", "Time zone") },
                    h("select", { value: tz, onChange: (e) => setTz(e.target.value), style: inputStyle(colors) }, tzs.map((z) => h("option", { key: z, value: z }, z)))),
                h(Field, { label: tl("يبدأ شهرك في يوم", "Your month starts on day"), hint: tl("مثلاً يوم الراتب. تُحسب الشهور والميزانيّات من هذا اليوم", "For example, payday. Months and budgets count from this day") },
                    h("select", { value: start, onChange: (e) => setStart(Number(e.target.value)), style: inputStyle(colors) },
                        Array.from({ length: 28 }, (_, i) => h("option", { key: i + 1, value: i + 1 }, String(i + 1))))),
                err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, err),
                h(Btn, { onClick: go, disabled: busy, style: { width: "100%" } }, busy ? tl("جارٍ الإعداد…", "Setting up…") : tl("ابدأ", "Start"))));
    }

    // ── overview ──
    // ── overview (C265 design pass): one sentence + the month's day ruler lead; only "Needs you" gets a box ──
    const T = { h1: 24, h2: 15, body: 15, small: 13, tiny: 12 };     // type scale, one family (Sawa Plex)
    const reduceMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
    function periodOf(month, startDay) {     // same as pfm-core budgetPeriod: { start, days }
        const [y, m] = month.split("-").map(Number), last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
        const s0 = Date.UTC(y, m - 1, Math.min(startDay, last(y, m))), ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
        const e0 = Date.UTC(ny, nm - 1, Math.min(startDay, last(ny, nm)));
        return { start: s0, days: Math.round((e0 - s0) / 86400000) };
    }
    const fig = (minor, cur) => h("bdi", { style: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } }, money(minor, cur));
    function Headline({ f, cur, past, monthLabel }) {
        const { colors } = useTheme();
        const net = f.net, kept = f.savingsRateBp, M = monthLabel;
        const amount = f.income === 0 ? f.expense : Math.abs(net);
        // [before the amount, after it] — six plain sentences: no income / money left / overspent, this month or a past one
        const kind = f.income === 0 ? "spent" : net >= 0 ? "left" : "over";
        const S = {
            spent: past ? tl(["صرفت ", " في " + M], ["You spent ", " in " + M]) : tl(["صرفت ", " هذا الشهر"], ["You've spent ", " this month"]),
            left: past ? tl(["ادّخرت ", " في " + M], ["You kept ", " in " + M]) : tl(["بقي لك ", " هذا الشهر"], ["", " left this month"]),
            over: past ? tl(["صرفت أكثر من دخلك بـ ", " في " + M], ["You spent ", " more than you earned in " + M]) : tl(["صرفت أكثر من دخلك بـ ", " هذا الشهر"], ["You've spent ", " more than you earned"]),
        }[kind];
        return h("div", { style: { marginBottom: 10 } },
            h("h2", { style: { margin: 0, fontSize: T.h1, lineHeight: 1.35, fontWeight: 800, color: colors.text } }, S[0], fig(amount, cur), S[1]),
            f.income > 0 && h("p", { style: { margin: "6px 0 0", fontSize: T.body, lineHeight: 1.6, color: colors.textMuted } },
                tl("دخلك ", "You earned "), fig(f.income, cur), tl(" وصرفت ", " and spent "), fig(f.expense, cur),
                kept != null && kept > 0 ? [tl("، فادّخرت ", ", keeping "), h("bdi", { key: "k" }, pct(kept))] : null, tl("", ".")));   // no Arabic full stop: it jumps to the line start after a figure
    }
    // The budget month as a row of days: past days filled, today marked, the rest empty. Fills once per month change.
    function DayRuler({ days, elapsed, past }) {
        const { colors } = useTheme();
        const [on, setOn] = useState(reduceMotion());
        useEffect(() => { if (reduceMotion()) { setOn(true); return; } setOn(false); const t = setTimeout(() => setOn(true), 30); return () => clearTimeout(t); }, [days, elapsed]);
        const left = days - elapsed;
        return h("div", { style: { margin: "14px 0 6px" } },
            h("div", { role: "img", "aria-label": past ? tl("الشهر انتهى", "Month complete") : tl(`مضى ${elapsed} من ${days} يوماً`, `Day ${elapsed} of ${days}`), style: { display: "flex", gap: 2, alignItems: "flex-end", height: 18 } },
                Array.from({ length: days }, (_, i) => {
                    const done = i < elapsed, today = !past && i === elapsed - 1;
                    return h("span", { key: i, "data-day": done ? (today ? "today" : "done") : "left", style: { flex: 1, height: today ? 18 : 10, borderRadius: 2,
                        backgroundColor: done && on ? TEAL : colors.border, opacity: done && on && !today ? 0.55 : 1,
                        transition: reduceMotion() ? "none" : `background-color 180ms ${i * 12}ms, opacity 180ms ${i * 12}ms` } });
                })),
            !past && h("div", { style: { fontSize: T.tiny, color: colors.textMuted, marginTop: 6 } },
                left === 0 ? tl("آخر يومٍ في الشهر", "Last day of the month") : tl(`بقي ${left} ${left === 1 ? "يوم" : left <= 10 ? "أيّام" : "يوماً"}`, `${left} ${left === 1 ? "day" : "days"} left`)));
    }
    function Section({ title, action, children }) {
        const { colors } = useTheme();
        return h("section", { style: { marginTop: 28 } },
            h("div", { style: { display: "flex", alignItems: "baseline", marginBottom: 10 } },
                h("h3", { style: { flex: 1, margin: 0, fontSize: T.h2, fontWeight: 800, color: colors.text } }, title), action || null),
            children);
    }
    // The figures behind a chart, as a list: the chart's values are otherwise reachable only by mouse or tap.
    // rows: [{ key, label, value }] — value is a node (keep figures inside <bdi>).
    function DataList({ rows }) {
        const { colors } = useTheme();
        if (!rows.length) return null;
        return h("details", { style: { marginTop: 8, fontSize: T.small, color: colors.text } },
            h("summary", { style: { cursor: "pointer", color: tealInk(), fontWeight: 700, minHeight: 44, display: "flex", alignItems: "center" } }, tl("عرض الأرقام", "Show the numbers")),
            h("ul", { style: { listStyle: "none", margin: 0, padding: 0 } },
                rows.map((r) => h("li", { key: r.key, style: { display: "flex", gap: 8, padding: "6px 0", borderTop: "1px solid " + colors.border } },
                    h("span", { style: { flex: 1, color: colors.textMuted } }, r.label), h("span", { style: { fontWeight: 700 } }, r.value)))));
    }
    const linkBtn = (label, onClick) => h("button", { type: "button", onClick, style: { border: 0, background: "none", color: tealInk(), fontWeight: 700, fontSize: T.small, minHeight: 44, padding: "0 4px", cursor: "pointer" } }, label);
    function CashFlow({ days, cur, month }) {
        const { colors } = useTheme();
        const [y, m] = month.split("-").map(Number); const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const by = {}; (days || []).forEach((d) => { by[d.day] = d; });
        const max = Math.max(1, ...(days || []).map((d) => Math.max(d.income, d.expense)));
        const W = 320, H = 120, bw = W / n;
        const [tip, setTip] = useState(null);
        const ink = colors.textMuted;   // spending is normal: ink, not red
        return h(Section, { title: tl("الداخل والخارج يوماً بيوم", "Money in and out, day by day") },
            h("svg", { viewBox: `0 0 ${W} ${H + 18}`, width: "100%", role: "img", "aria-label": tl("الدخل والمصروف لكلّ يوم", "Income and spending per day"), style: { display: "block", direction: "ltr" } },
                h("line", { x1: 0, x2: W, y1: H / 2, y2: H / 2, stroke: colors.border }),
                Array.from({ length: n }, (_, i) => { const d = by[i + 1] || { income: 0, expense: 0 }, x = i * bw;
                    const hi = (d.income / max) * (H / 2 - 4), he = (d.expense / max) * (H / 2 - 4);
                    return h("g", { key: i, onMouseEnter: () => setTip(i + 1), onClick: () => setTip(i + 1) },
                        h("rect", { x: x, y: 0, width: bw, height: H, fill: "transparent" }),
                        hi > 0 && h("rect", { x: x + 1, y: H / 2 - hi, width: Math.max(bw - 2, 1), height: hi, rx: 1.5, fill: colors.success }),
                        he > 0 && h("rect", { x: x + 1, y: H / 2, width: Math.max(bw - 2, 1), height: he, rx: 1.5, fill: ink })); }),
                [1, 10, 20, n].map((d) => h("text", { key: d, x: (d - 0.5) * bw, y: H + 15, fontSize: 12, fill: colors.textMuted, textAnchor: "middle" }, String(d)))),
            h("div", { style: { display: "flex", gap: 14, fontSize: 12, color: colors.textMuted, marginTop: 6, flexWrap: "wrap" } },
                h("span", null, h("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 2, backgroundColor: colors.success, marginInlineEnd: 6 } }), tl("داخل", "In")),
                h("span", null, h("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 2, backgroundColor: ink, marginInlineEnd: 6 } }), tl("خارج", "Out")),
                tip && h("span", { dir: "auto", style: { marginInlineStart: "auto", color: colors.text, fontWeight: 600 } },
                    `${tip}: +${money((by[tip] || {}).income || 0, cur)} / −${money((by[tip] || {}).expense || 0, cur)}`)),
            h(DataList, { rows: (days || []).filter((d) => d.income || d.expense).map((d) => ({ key: d.day,
                label: dayLabel(month + "-" + String(d.day).padStart(2, "0")),
                value: h("span", { style: { whiteSpace: "nowrap" } }, d.income ? h("bdi", { style: { color: colors.success } }, "+" + money(d.income, cur)) : null, d.income && d.expense ? "  " : null, d.expense ? h("bdi", null, "−" + money(d.expense, cur)) : null) })) }));
    }
    function Categories({ rows, cats, cur, onPick }) {
        const { colors } = useTheme();
        const spend = rows.filter((r) => r.expense > 0);
        if (!spend.length) return null;
        const max = spend[0].expense;
        return h(Section, { title: tl("أين ذهب المال", "Where the money went") },
            spend.map((r) => { const c = cats[r.categoryId]; const I = iconOf(c && c.icon);
                return h("button", { key: r.categoryId, type: "button", onClick: () => onPick(r.categoryId), style: { display: "block", width: "100%", textAlign: "start", border: 0, background: "none", padding: "6px 0", color: colors.text, cursor: "pointer" } },
                    h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: T.small } },
                        h(I, { size: 16, color: (c && c.color) || colors.textMuted }),
                        h("span", { style: { flex: 1, fontWeight: 600 } }, catName(c)),
                        h("span", { style: { fontWeight: 700 } }, fig(r.expense, cur)),
                        h("span", { style: { width: 44, textAlign: "end", color: colors.textMuted, fontSize: 12 } }, pct(r.shareBp))),
                    h("div", { style: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 7, overflow: "hidden" } },
                        h("div", { style: { width: Math.max(2, (r.expense / max) * 100) + "%", height: "100%", borderRadius: 3, backgroundColor: colors.textMuted } }))); }));
    }
    function Trend({ months, cur }) {
        const { colors } = useTheme();
        if (!months || months.length < 2) return null;
        const max = Math.max(1, ...months.map((m) => Math.abs(m.net)));
        const W = 320, H = 110, bw = W / months.length;
        return h(Section, { title: tl("ما بقي في آخر الشهور", "What was left, month by month") },
            h("svg", { viewBox: `0 0 ${W} ${H + 20}`, width: "100%", role: "img", "aria-label": tl("صافي كلّ شهر", "Net per month"), style: { display: "block", direction: "ltr" } },
                h("line", { x1: 0, x2: W, y1: H / 2, y2: H / 2, stroke: colors.border }),
                months.map((m, i) => { const v = (Math.abs(m.net) / max) * (H / 2 - 6), pos = m.net >= 0;
                    return h("g", { key: m.month },
                        h("title", null, monthName(m.month) + ": " + money(m.net, cur)),
                        v > 0 && h("rect", { x: i * bw + bw * 0.2, y: pos ? H / 2 - v : H / 2, width: bw * 0.6, height: v, rx: 3, fill: pos ? colors.success : colors.textMuted }),
                        h("text", { x: i * bw + bw / 2, y: H + 15, fontSize: 12, fill: colors.textMuted, textAnchor: "middle" }, monthShort(m.month))); })),
            h(DataList, { rows: months.map((m) => ({ key: m.month, label: monthName(m.month),
                value: h("bdi", { style: { color: m.net >= 0 ? colors.success : colors.text, fontVariantNumeric: "tabular-nums" } }, (m.net >= 0 ? "+" : "−") + money(Math.abs(m.net), cur)) })) }));
    }
    function Overview({ data, cats, cur, onPickCat, onAdd, alerts, suggestedCount, budgets, onDismissAlerts, onGoSuggested, onGoBudgets, onGoLedger, ruler, claimsCount, onGoInvoices, walletCount, onGoWallet }) {
        const { colors } = useTheme();
        if (!data) return h(Loading);
        const f = data.focus, past = f.month < data.currentMonth;
        const top = (budgets || []).slice().sort((a, b) => b.usedBp - a.usedBp).slice(0, 3);
        const al = topAlerts(alerts || []);
        const needs = al.length > 0 || suggestedCount > 0 || f.ratePending > 0 || claimsCount > 0 || walletCount > 0;
        const row = (key, text, onClick, tone) => h("button", { key, type: "button", onClick, style: { display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, padding: "6px 0",
            border: 0, background: "none", color: tone || colors.text, fontSize: T.body, textAlign: "start", cursor: onClick ? "pointer" : "default" } },
            h("span", { dir: "auto", style: { flex: 1, lineHeight: 1.5, textAlign: ar() ? "right" : "left" } }, text),
            onClick && h(ar() ? ChevronLeft : ChevronRight, { size: 16, color: colors.textMuted }));
        // The only container on the page: things waiting for the user.
        const needsYou = needs && h("section", { "aria-label": tl("يحتاجك", "Needs you"), style: { marginTop: 18, padding: "10px 14px 6px", backgroundColor: colors.card,
            borderInlineStart: "4px solid " + colors.warning, borderRadius: 4, boxShadow: "inset 0 0 0 1px " + colors.border } },
            h("div", { style: { display: "flex", alignItems: "center" } },
                h("h3", { style: { flex: 1, margin: 0, fontSize: T.h2, fontWeight: 800, color: colors.text } }, tl("يحتاجك", "Needs you")),
                al.length > 0 && linkBtn(tl("إخفاء التنبيهات", "Clear alerts"), onDismissAlerts)),
            walletCount > 0 && row("wl", tl(`${walletCount} ${walletCount === 1 ? "عمليّة" : "عمليّات"} من محفظة سوا لم تُسجَّل هنا — أضفها`, `${walletCount} Sawa Wallet ${walletCount === 1 ? "payment isn't" : "payments aren't"} recorded here — add ${walletCount === 1 ? "it" : "them"}`), onGoWallet),
            claimsCount > 0 && row("cl", tl(`${claimsCount} ${claimsCount === 1 ? "بلاغ دفع" : "بلاغات دفع"} من عملائك — تحقّق وأكّد`, `${claimsCount} payment ${claimsCount === 1 ? "report" : "reports"} from clients to check`), onGoInvoices),
            al.slice(0, 3).map((a) => row(a.id, alertLine(a, cats, cur), onGoBudgets, a.bp >= 10000 || a.spent > a.limit ? colors.danger : colors.text)),
            suggestedCount > 0 && row("sg", tl(`${suggestedCount} ${suggestedCount === 1 ? "حركة متكرّرة" : "حركات متكرّرة"} للتأكيد`, `${suggestedCount} recurring ${suggestedCount === 1 ? "entry" : "entries"} to confirm`), onGoSuggested),
            f.ratePending > 0 && row("rp", tl(`${f.ratePending} ${f.ratePending === 1 ? "حركة تحتاج" : "حركات تحتاج"} سعر صرف لتدخل المجاميع`, `${f.ratePending} ${f.ratePending === 1 ? "entry needs" : "entries need"} an exchange rate to count`), onGoLedger));
        if (!f.txCount) return h("div", null, needsYou, h("div", { style: { marginTop: 18 } }, h(Empty, { onAdd })));
        return h("div", null,
            h(Headline, { f, cur, past, monthLabel: monthName(f.month) }),
            ruler && h(DayRuler, ruler),
            needsYou,
            top.length > 0 && h(Section, { title: tl("الميزانيّات", "Budgets"), action: linkBtn(tl("كلّ الميزانيّات", "All budgets"), onGoBudgets) },
                top.map((b) => h("div", { key: b.categoryId, style: { marginBottom: 12 } },
                    h("div", { style: { display: "flex", fontSize: T.small, marginBottom: 6 } }, h("span", { style: { flex: 1, fontWeight: 600 } }, budgetName(b.categoryId, cats)),
                        h("span", { style: { color: b.remaining < 0 ? colors.danger : colors.textMuted } }, ofLimit(b.spent, b.limit, cur))),
                    h(Meter, { usedBp: b.usedBp, colors, label: budgetName(b.categoryId, cats) + tl(": ", ": ") + money(b.spent, cur) + tl(" من ", " of ") + money(b.limit, cur) })))),
            h(Categories, { rows: f.byCategory, cats, cur, onPick: onPickCat }),
            h(CashFlow, { days: f.days, cur, month: f.month }),
            h(Trend, { months: data.months, cur }));
    }
    function Loading() { const { colors } = useTheme(); return h("div", { role: "status", style: { padding: 32, textAlign: "center", color: colors.textMuted, fontSize: 13 } }, tl("جارٍ التحميل…", "Loading…")); }
    function Empty({ onAdd }) {
        const { colors } = useTheme();
        return h(Card, { style: { textAlign: "center", padding: 24 } },
            h(BarChart3, { size: 32, color: tealInk() }),
            h("div", { style: { fontWeight: 800, marginTop: 8 } }, tl("لا حركات في هذا الشهر", "No entries this month")),
            h("p", { style: { fontSize: 13, color: colors.textMuted, margin: "6px 0 14px" } }, tl("سجّل دخلك ومصروفاتك لترى أين يذهب مالك.", "Record income and spending to see where your money goes.")),
            h(Btn, { onClick: onAdd }, tl("سجّل أوّل حركة", "Add your first entry")));
    }

    // ── ledger ──
    function Ledger({ list, cats, base, filter, onClearFilter, onOpen, onAdd, onConfirm, onSkip, recurringCount, rulesCount, onRecurring, onRules, onExport, onImport, importCount }) {
        const { colors } = useTheme();
        const [q, setQ] = useState(""), [skipId, setSkipId] = useState(null);   // search text · the suggested entry awaiting "skip?" confirmation
        if (!list) return h(Loading);
        // search this month's entries by payee, note, category or amount (same text folding as the rules: hamza, taa marbuta, diacritics)
        const nq = normText(q);
        const hit = (t) => !nq || normText([t.counterparty, t.note, catName(cats[t.categoryId]), money(t.amount, t.currency), String(t.amount / Math.pow(10, expOf(t.currency)))].join(" | ")).indexOf(nq) >= 0;
        const items = (filter ? list.items.filter((t) => t.categoryId === filter) : list.items).filter(hit);
        // auto-fit: four across on wide screens, two rows of two on phones (labels and counts never squeeze)
        const tools = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 } },
            [[Repeat, tl("المتكرّرة", "Recurring"), recurringCount, onRecurring], [SlidersHorizontal, tl("القواعد", "Rules"), rulesCount, onRules], [Download, tl("تصدير", "Export"), 0, onExport], [Upload, tl("استيراد", "Import"), importCount || 0, onImport]].map(([I, label, n, fn], i) =>
                h("button", { key: i, type: "button", onClick: fn, style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: 12,
                    border: "1px solid " + colors.border, backgroundColor: colors.card, color: colors.text, fontWeight: 700, fontSize: 13, cursor: "pointer" } },
                    h(I, { size: 15, color: tealInk() }), label, n > 0 && h("span", { style: { fontSize: 12, color: colors.textMuted } }, "(" + n + ")"))));
        if (!list.items.length) return h("div", null, tools, h(Empty, { onAdd }));
        const groups = []; items.forEach((t) => { const g = groups[groups.length - 1]; if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] }); });
        const search = h("div", { role: "search", style: { position: "relative", marginBottom: 12 } },
            h(Search, { size: 16, color: colors.textMuted, "aria-hidden": true, style: { position: "absolute", insetInlineStart: 12, top: 14, pointerEvents: "none" } }),
            h("input", { type: "search", dir: "auto", value: q, onChange: (e) => setQ(e.target.value), "aria-label": tl("ابحث في حركات هذا الشهر", "Search this month's entries"),
                placeholder: tl("ابحث بالاسم أو الملاحظة أو المبلغ", "Search by name, note or amount"), style: Object.assign(inputStyle(colors), { paddingInlineStart: 36 }) }));
        return h("div", null, tools, search,
            nq && !items.length && h("p", { role: "status", style: { fontSize: 14, color: colors.textMuted, textAlign: "center", margin: "20px 0" } }, tl("لا نتائج في هذا الشهر", "No matches this month")),
            filter && h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13 } },
                h("span", { style: { color: colors.textMuted } }, tl("الفئة:", "Category:")), h("b", null, catName(cats[filter])),
                h("button", { type: "button", onClick: onClearFilter, style: { marginInlineStart: "auto", border: 0, background: "none", color: tealInk(), fontWeight: 700, cursor: "pointer", minHeight: 44 } }, tl("عرض الكلّ", "Show all"))),
            groups.map((g) => h("div", { key: g.date, style: { marginBottom: 12 } },
                h("div", { style: { fontSize: 12, fontWeight: 700, color: colors.textMuted, margin: "0 4px 6px" } }, dayLabel(g.date)),
                h(Card, { style: { padding: 0 } }, g.items.map((t, i) => {
                    const c = cats[t.categoryId], I = iconOf(c && c.icon), inc = t.kind === "income", sug = t.status === "suggested";
                    const row = h("button", { key: t.id, type: "button", onClick: () => onOpen(t), style: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", border: 0,
                        borderTop: i && !sug ? "1px solid " + colors.border : 0, background: "none", color: colors.text, textAlign: "start", cursor: "pointer", minHeight: 56 } },   // suggested rows: the dashed outline marks them; no opacity (it dropped grey text below 4.5:1)
                        h("span", { style: { width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: ((c && c.color) || TEAL) + "22", flexShrink: 0 } }, h(I, { size: 17, color: (c && c.color) || TEAL })),
                        h("span", { style: { flex: 1, minWidth: 0 } },
                            h("div", { dir: "auto", style: { fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: ar() ? "right" : "left" } }, t.counterparty || catName(c)),   // Latin names in Arabic stay on the start side
                            h("div", { dir: "auto", style: { fontSize: 12, color: colors.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: ar() ? "right" : "left" } },
                                t.hasReceipt && h(Paperclip, { size: 11, "aria-label": tl("عليها إيصال", "Has a receipt"), style: { display: "inline-block", verticalAlign: "-1px", marginInlineEnd: 4 } }),
                                t.counterparty ? catName(c) + (t.note ? " · " + t.note : "") : t.note || "")),
                        h("span", { style: { textAlign: "end", flexShrink: 0 } },
                            h("div", { dir: "ltr", style: { fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums", color: inc ? colors.success : colors.text } }, (inc ? "+" : "−") + money(t.amount, t.currency)),
                            t.currency !== base && h("div", { dir: "ltr", style: { fontSize: 12, fontVariantNumeric: "tabular-nums", color: t.baseAmount == null ? colors.warning : colors.textMuted } },
                                t.baseAmount == null ? tl("بانتظار السعر", "rate needed") : "≈ " + money(t.baseAmount, base))));
                    if (!sug) return row;
                    // suggested by a recurring entry: not in the totals until confirmed
                    return h("div", { key: t.id, style: { borderTop: i ? "1px solid " + colors.border : 0, outline: "1.5px dashed " + TEAL, outlineOffset: -4, borderRadius: i ? 0 : 16 } }, row,
                        skipId === t.id ? h("div", { style: { padding: "0 14px 4px" } }, h(ConfirmRow, { text: tl("تخطّي هذه الحركة؟ لن تُسجَّل.", "Skip this one? It won't be recorded."), confirmLabel: tl("تخطّي", "Skip"),
                            onCancel: () => setSkipId(null), onConfirm: () => { setSkipId(null); onSkip(t); } })) :
                        h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "0 14px 12px" } },
                            h("span", { style: { flex: 1, fontSize: 12, color: tealInk(), fontWeight: 700 } }, tl("مقترحة — لم تُحسب بعد", "Suggested — not counted yet")),
                            h(Btn, { kind: "ghost", onClick: () => setSkipId(t.id), style: { minHeight: 44, padding: "6px 12px", fontSize: 13 } }, tl("تخطّي", "Skip")),
                            h(Btn, { onClick: () => onConfirm(t), style: { minHeight: 44, padding: "6px 14px", fontSize: 13 } }, tl("تأكيد", "Confirm"))));
                })))));
    }

    // ── add / edit sheet ──
    function TxSheet({ tx, settings, cats, today, rules, onClose, onSaved }) {
        const { colors } = useTheme();
        const base = settings.baseCurrency, editing = !!tx;
        const [kind, setKind] = useState(tx ? tx.kind : "expense");
        const [amount, setAmount] = useState(tx ? String(tx.amount / Math.pow(10, expOf(tx.currency))) : "");
        const [cur, setCur] = useState(tx ? tx.currency : base);
        const [rate, setRate] = useState(tx && tx.fxSource === "manual" ? tx.fxRate : "");
        const [catId, setCatId] = useState(tx ? tx.categoryId : "");
        const [date, setDate] = useState(tx ? tx.date : today);
        const [note, setNote] = useState(tx ? tx.note || "" : "");
        const [who, setWho] = useState(tx ? tx.counterparty || "" : "");
        const [busy, setBusy] = useState(false), [err, setErr] = useState("");
        const [newCat, setNewCat] = useState(null);
        const [autoRule, setAutoRule] = useState(null), [remember, setRemember] = useState(false);
        const [repeat, setRepeat] = useState("none"), [autoBook, setAutoBook] = useState(false);
        const suggested = !!(tx && tx.status === "suggested");
        // receipt photo: a new one is uploaded after the entry is saved; removing waits for Save too
        const [photo, setPhoto] = useState(null), [dropReceipt, setDropReceipt] = useState(false), [view, setView] = useState(null);
        const fileRef = useRef(null);
        const hasReceipt = editing && tx.hasReceipt && !dropReceipt;
        const pickPhoto = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; setErr("");
            shrinkImage(f, 1280, true).then((d) => { setPhoto(d); setDropReceipt(false); }, () => setErr(errText(new Error("bad_receipt")))); };
        const showReceipt = () => call("pfm.tx.receipt.get", { id: tx.id }).then((r) => (r.data ? setView(r.data) : setErr(tl("لا إيصال لهذه الحركة", "No receipt on this entry"))), (e) => setErr(errText(e)));
        // A rule picks the category while the user types the payee, unless they chose one themselves.
        useEffect(() => {
            if (editing) return;
            const r = matchRule(rules, kind, who, note);
            if (r && cats[r.categoryId] && (!catId || (autoRule && catId === autoRule.categoryId))) { setCatId(r.categoryId); setAutoRule(r); }
            else if (!r && autoRule && catId === autoRule.categoryId) { setCatId(""); setAutoRule(null); }
        }, [who, note, kind]);
        const key = useRef(newKey());
        const curs = useMemo(currencyList, []);
        useEffect(() => { // pre-fill the user's own last rate for this pair
            if (cur === base || rate) return;
            call("pfm.fx.last", { from: cur }).then((r) => { if (r && r.rate) setRate((v) => v || r.rate); }, () => {});
        }, [cur]);
        const list = Object.values(cats).filter((c) => c.kind === kind && (!c.archived || c.id === catId)).sort((a, b) => a.order - b.order);
        const preview = cur !== base && rate && num(amount) > 0 && num(rate) > 0 ? "≈ " + money(Math.round(num(amount) * num(rate) * Math.pow(10, expOf(base))), base) : "";
        const save = () => {
            setBusy(true); setErr("");
            const p = { kind, amount: amount.trim(), currency: cur, categoryId: catId, date, note: note.trim() || null, counterparty: who.trim() || null };
            if (cur !== base) p.fxRate = rate.trim() || null; else delete p.fxRate;
            const req = suggested ? call("pfm.tx.confirm", { id: tx.id, rev: tx.rev, amount: p.amount, date: p.date, categoryId: p.categoryId, note: p.note, fxRate: p.fxRate })
                : editing ? call("pfm.tx.update", Object.assign({ id: tx.id, rev: tx.rev }, p))
                : call("pfm.tx.add", Object.assign({ idemKey: key.current }, p));
            // Follow-ups never block the entry itself: it is saved first, then the rule and the repeat.
            req.then((r) => {
                const after = [];
                if (remember && who.trim()) after.push(call("pfm.rule.upsert", { contains: who.trim(), categoryId: catId, kind }));
                if (!editing && repeat !== "none") after.push(call("pfm.recurring.upsert", Object.assign({}, p, { rule: ruleFromDate(repeat, date), startDate: date, after: true, mode: autoBook ? "auto" : "suggest" })));
                const txId = (r && r.tx && r.tx.id) || (tx && tx.id);
                if (photo && txId) after.push(call("pfm.tx.receipt.set", { id: txId, data: photo }));
                else if (dropReceipt && txId) after.push(call("pfm.tx.receipt.delete", { id: txId }));
                return Promise.all(after).then(() => onSaved((r && r.tx) || true), (e) => { setErr(tl("حُفظت الحركة، لكن: ", "Entry saved, but: ") + errText(e)); setBusy(false); });
            }, (e) => { setErr(errText(e)); setBusy(false); });
        };
        const [ask, confirmNode] = useConfirm();
        const doDel = () => { setBusy(true); call("pfm.tx.delete", { id: tx.id, rev: tx.rev }).then(() => onSaved(null), (e) => { setErr(errText(e)); setBusy(false); }); };
        const del = () => (suggested ? doDel() : ask(tl("حذف هذه الحركة؟ لا يمكن التراجع.", "Delete this entry? This can't be undone."), tl("حذف", "Delete"), doDel));
        // unsaved input: closing the sheet asks first
        const snap = [kind, amount, cur, rate, catId, date, note, who, !!photo, dropReceipt].join("|");
        const snap0 = useRef(snap);
        const dirty = !busy && snap !== snap0.current;
        const addCat = () => {
            const name = (newCat || "").trim(); if (!name) return;
            call("pfm.cat.upsert", { name, nameAr: name, kind }).then((r) => { cats[r.category.id] = r.category; setCatId(r.category.id); setNewCat(null); }, (e) => setErr(errText(e)));
        };
        const canSave = !busy && num(amount) > 0 && catId && date;
        // say why Save is unavailable instead of only greying it out
        const missing = busy ? "" : !(num(amount) > 0) ? tl("أدخل المبلغ للحفظ", "Enter an amount to save") : !catId ? tl("اختر فئة للحفظ", "Choose a category to save") : !date ? tl("اختر التاريخ", "Pick a date") : "";
        const showRemember = who.trim().length >= 2 && catId && !(autoRule && autoRule.categoryId === catId && normText(autoRule.contains) && normText(who).indexOf(normText(autoRule.contains)) >= 0);
        return h(Sheet, { title: suggested ? tl("تأكيد حركة متكرّرة", "Confirm recurring entry") : editing ? tl("تعديل الحركة", "Edit entry") : tl("حركة جديدة", "New entry"), onClose, dirty },
            h("div", { style: { marginBottom: 14 } }, h(Seg, { label: tl("نوع الحركة", "Entry type"), value: kind, onChange: (v) => { setKind(v); setCatId(""); }, options: [
                { value: "expense", label: tl("مصروف", "Spending"), color: colors.danger }, { value: "income", label: tl("دخل", "Income"), color: colors.success }] })),
            h("div", { style: { display: "flex", gap: 8 } },
                h("div", { style: { flex: 2 } }, h(Field, { label: tl("المبلغ", "Amount") },
                    h("input", { dir: "ltr", inputMode: "decimal", autoFocus: !editing, value: amount, placeholder: "0", onChange: (e) => setAmount(numIn(e.target.value)),   // no commas: the server reads "," as a thousands separator
                        style: Object.assign(inputStyle(colors), { fontSize: 22, fontWeight: 800 }) }))),
                h("div", { style: { flex: 1 } }, h(Field, { label: tl("العملة", "Currency") },
                    h("select", { value: cur, onChange: (e) => { setCur(e.target.value); setRate(""); }, style: inputStyle(colors), "aria-label": tl("العملة", "Currency") },
                        curs.map((c) => h("option", { key: c.code, value: c.code }, c.code)))))),
            cur !== base && h(Field, { label: tl("سعر الصرف: ", "Exchange rate: ") + "\u2066" + `1 ${cur} = ? ${base}` + "\u2069",   // LRI…PDI: the formula stays left-to-right inside Arabic
                hint: preview || tl("اكتب السعر الذي حصلت عليه فعلاً. اتركه فارغاً لتضيفه لاحقاً", "Type the rate you actually got. Leave empty to add it later") },
                h("input", { dir: "ltr", inputMode: "decimal", value: rate, placeholder: "0.00", onChange: (e) => setRate(numIn(e.target.value)), style: inputStyle(colors) })),
            autoRule && catId === autoRule.categoryId && h("div", { style: { fontSize: 12, color: tealInk(), fontWeight: 700, margin: "-4px 0 6px" } },
                tl(`اختيرت الفئة بقاعدة «${autoRule.contains}»`, `Category picked by your rule “${autoRule.contains}”`)),
            h(Field, { label: tl("الفئة", "Category"), group: true },
                h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
                    list.map((c) => { const I = iconOf(c.icon), on = c.id === catId;
                        return h("button", { key: c.id, type: "button", "aria-pressed": on, onClick: () => { setCatId(c.id); setAutoRule(null); }, style: { display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "6px 12px",
                            borderRadius: 22, border: "1.5px solid " + (on ? c.color : colors.border), backgroundColor: on ? c.color + "1f" : "transparent", color: colors.text, fontSize: 13, fontWeight: 600, cursor: "pointer" } },
                            h(I, { size: 15, color: c.color }), catName(c)); }),
                    newCat == null
                        ? h("button", { type: "button", onClick: () => setNewCat(""), style: { minHeight: 44, padding: "6px 12px", borderRadius: 22, border: "1.5px dashed " + colors.border, background: "none", color: tealInk(), fontWeight: 700, fontSize: 13, cursor: "pointer" } }, "＋ " + tl("فئة جديدة", "New category"))
                        : h("span", { style: { display: "flex", gap: 6, width: "100%" } },
                            h("input", { autoFocus: true, value: newCat, maxLength: 40, placeholder: tl("اسم الفئة", "Category name"), onChange: (e) => setNewCat(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") addCat(); }, style: inputStyle(colors) }),
                            h(Btn, { onClick: addCat }, tl("إضافة", "Add"))))),
            h(Field, { label: tl("التاريخ", "Date") }, h("input", { type: "date", value: date, max: today, onChange: (e) => setDate(e.target.value), style: inputStyle(colors) })),
            h(Field, { label: kind === "income" ? tl("من (اختياريّ)", "From (optional)") : tl("إلى (اختياريّ)", "Paid to (optional)") },
                h("input", { dir: "auto", value: who, maxLength: 80, onChange: (e) => setWho(e.target.value), style: inputStyle(colors) })),
            showRemember && h(Check, { checked: remember, onChange: setRemember }, tl(`استعمل «${catName(cats[catId])}» دائماً لـ«${who.trim()}»`, `Always use “${catName(cats[catId])}” for “${who.trim()}”`)),
            h(Field, { label: tl("ملاحظة (اختياريّ)", "Note (optional)"), hint: tl("الملاحظات والأسماء تُحفظ مشفّرة", "Notes and names are stored encrypted") },
                h("input", { dir: "auto", value: note, maxLength: 300, onChange: (e) => setNote(e.target.value), style: inputStyle(colors) })),
            !suggested && h(Field, { label: tl("صورة الإيصال (اختياريّ)", "Receipt photo (optional)"), group: true, hint: tl("تُحفظ مشفّرة، وتُحذف مع الحركة", "Stored encrypted, and deleted with the entry") },
                h("input", { ref: fileRef, type: "file", accept: "image/jpeg,image/png,image/webp,image/*", onChange: pickPhoto, style: { display: "none" } }),
                h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                    photo && h("button", { type: "button", onClick: () => setView(photo), "aria-label": tl("عرض الإيصال الجديد", "View the new receipt"), style: { padding: 0, border: "1px solid " + colors.border, borderRadius: 8, background: "none", cursor: "pointer", lineHeight: 0 } },
                        h("img", { src: photo, alt: "", style: { width: 52, height: 52, objectFit: "cover", borderRadius: 8 } })),
                    hasReceipt && !photo && h(Btn, { kind: "ghost", onClick: showReceipt, style: { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "6px 12px", fontSize: 13 } }, h(Paperclip, { size: 14 }), tl("عرض الإيصال", "View receipt")),
                    h(Btn, { kind: "ghost", onClick: () => fileRef.current && fileRef.current.click(), style: { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "6px 12px", fontSize: 13 } },
                        h(Camera, { size: 14 }), photo || hasReceipt ? tl("استبدال", "Replace") : tl("إضافة صورة", "Add photo")),
                    (photo || hasReceipt) && linkBtn(tl("إزالة", "Remove"), () => { setPhoto(null); if (editing && tx.hasReceipt) setDropReceipt(true); }))),
            view && h(PhotoView, { src: view, onClose: () => setView(null) }),
            !editing && h(Field, { label: tl("التكرار", "Repeat"), hint: repeat !== "none" ? tl("تظهر الحركة القادمة مقترحةً في موعدها لتؤكّدها", "The next one appears as a suggestion on its date, for you to confirm") : undefined },
                h("select", { value: repeat, onChange: (e) => setRepeat(e.target.value), style: inputStyle(colors) },
                    h("option", { value: "none" }, tl("لا تتكرّر", "Doesn't repeat")),
                    h("option", { value: "monthly" }, tl("شهريّاً في يوم ", "Monthly on day ") + Number(date.slice(8, 10))),
                    h("option", { value: "weekly" }, tl("أسبوعيّاً يوم ", "Weekly on ") + weekdayName(new Date(date + "T00:00:00Z").getUTCDay())),
                    h("option", { value: "yearly" }, tl("سنويّاً", "Yearly")))),
            !editing && repeat !== "none" && h(Check, { checked: autoBook, onChange: setAutoBook }, tl("سجّلها تلقائيّاً دون أن تسألني", "Record it automatically, don't ask me")),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, err),
            confirmNode,
            missing && h("div", { id: "pfm-save-why", style: { fontSize: 13, color: colors.textMuted, marginBottom: 8, textAlign: "center" } }, missing),
            h("div", { style: { display: "flex", gap: 8 } },
                editing && h(Btn, { kind: suggested ? "ghost" : "danger", onClick: del, disabled: busy }, suggested ? tl("تخطّي", "Skip") : tl("حذف", "Delete")),
                h(Btn, { onClick: save, disabled: !canSave, describedBy: missing ? "pfm-save-why" : undefined, style: { flex: 1 } }, busy ? tl("جارٍ الحفظ…", "Saving…") : suggested ? tl("تأكيد", "Confirm") : tl("حفظ", "Save"))));
    }

    // ── budgets ──
    function Budgets({ data, cats, cur, onEdit, onAdd }) {
        const { colors } = useTheme();
        if (!data) return h(Loading);
        if (!data.budgets.length) return h(Card, { style: { textAlign: "center", padding: 24 } },
            h(Target, { size: 32, color: tealInk() }),
            h("div", { style: { fontWeight: 800, marginTop: 8 } }, tl("لا ميزانيّات بعد", "No budgets yet")),
            h("p", { style: { fontSize: 13, color: colors.textMuted, margin: "6px 0 14px", lineHeight: 1.6 } },
                tl("ضع حدّاً شهريّاً لفئة أو لكلّ مصروفاتك، ونُنبّهك عند 50% و80% و100%، وإن كان إنفاقك أسرع من المتوقّع.", "Set a monthly limit for a category or all spending. We'll alert you at 50%, 80% and 100%, and if you're spending faster than planned.")),
            h(Btn, { onClick: onAdd }, tl("أضف ميزانيّة", "Add a budget")));
        return h("div", { style: { display: "grid", gap: 10 } },
            data.budgets.map((b) => {
                const over = b.remaining < 0, done = b.elapsed >= b.period.days;
                const paceTxt = done ? "" : b.onPace ? tl("ضمن المسار", "On track") : tl(`بهذه الوتيرة ≈ ${money(b.projected, cur)} بنهاية الشهر`, `At this pace ≈ ${money(b.projected, cur)} by month end`);
                return h("button", { key: b.categoryId, type: "button", onClick: () => onEdit(b), style: { display: "block", width: "100%", textAlign: "start", padding: 14, borderRadius: 16,
                    border: "1px solid " + (over ? colors.danger : colors.border), backgroundColor: colors.card, color: colors.text, cursor: "pointer" } },
                    h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 } },
                        h("b", { style: { flex: 1, fontSize: 15 } }, budgetName(b.categoryId, cats)),
                        h("span", { dir: "ltr", style: { fontSize: 13, color: colors.textMuted } }, pct(b.usedBp))),
                    h(Meter, { usedBp: b.usedBp, colors, label: budgetName(b.categoryId, cats) + tl(": ", ": ") + money(b.spent, cur) + tl(" من ", " of ") + money(b.limit, cur) }),
                    h("div", { style: { display: "flex", gap: 8, marginTop: 8, fontSize: 13 } },
                        h("span", { style: { flex: 1 } }, ofLimit(b.spent, b.limit, cur)),
                        h("span", { style: { fontWeight: 700, color: over ? colors.danger : colors.success } },
                            over ? tl("تجاوز بـ ", "Over by ") + money(-b.remaining, cur) : tl("بقي ", "Left ") + money(b.remaining, cur))),
                    paceTxt && h("div", { style: { fontSize: 12, marginTop: 4, color: b.onPace ? colors.textMuted : colors.warning } }, paceTxt));
            }),
            h(Btn, { kind: "ghost", onClick: onAdd }, "＋ " + tl("ميزانيّة أخرى", "Another budget")));
    }
    function BudgetSheet({ budget, existing, cats, cur, onClose, onSaved }) {
        const { colors } = useTheme();
        const editing = !!budget;
        const free = [{ id: TOTAL }].concat(Object.values(cats).filter((c) => c.kind === "expense" && !c.archived).sort((a, b) => a.order - b.order))
            .filter((c) => editing ? c.id === budget.categoryId : existing.indexOf(c.id) < 0);
        const [catId, setCatId] = useState(editing ? budget.categoryId : (free[0] && free[0].id) || "");
        const [limit, setLimit] = useState(editing ? String(budget.limit / Math.pow(10, expOf(cur))) : "");
        const [th, setTh] = useState(editing ? budget.alertsBp : [5000, 8000, 10000]);
        const [busy, setBusy] = useState(false), [err, setErr] = useState("");
        const save = () => { setBusy(true); setErr(""); call("pfm.budget.set", { categoryId: catId, limit: limit.trim(), alertsBp: th }).then(onSaved, (e) => { setErr(errText(e)); setBusy(false); }); };
        const [ask, confirmNode] = useConfirm();
        const del = () => ask(tl("حذف هذه الميزانيّة؟", "Delete this budget?"), tl("حذف", "Delete"), () => { setBusy(true); call("pfm.budget.delete", { categoryId: catId }).then(onSaved, (e) => { setErr(errText(e)); setBusy(false); }); });
        const snap = [catId, limit, th.join(",")].join("|"), snap0 = useRef(snap);
        return h(Sheet, { title: editing ? tl("تعديل الميزانيّة", "Edit budget") : tl("ميزانيّة جديدة", "New budget"), onClose, dirty: !busy && snap !== snap0.current },
            h(Field, { label: tl("الفئة", "Category") },
                h("select", { value: catId, disabled: editing, onChange: (e) => setCatId(e.target.value), style: inputStyle(colors) },
                    free.map((c) => h("option", { key: c.id, value: c.id }, budgetName(c.id, cats))))),
            h(Field, { label: tl("الحدّ الشهريّ", "Monthly limit") + " (" + cur + ")" },
                h("input", { dir: "ltr", inputMode: "decimal", value: limit, placeholder: "0", onChange: (e) => setLimit(numIn(e.target.value)), style: Object.assign(inputStyle(colors), { fontSize: 20, fontWeight: 800 }) })),
            h(Field, { label: tl("نبّهني عند", "Alert me at"), group: true },
                h("div", { style: { display: "flex", gap: 8 } }, [5000, 8000, 10000].map((b) => { const on = th.indexOf(b) >= 0;
                    return h("button", { key: b, type: "button", "aria-pressed": on, onClick: () => setTh(on ? th.filter((x) => x !== b) : th.concat(b).sort((a, c) => a - c)),
                        style: { flex: 1, minHeight: 44, borderRadius: 12, border: "1.5px solid " + (on ? TEAL : colors.border), backgroundColor: on ? TEAL + "1f" : "transparent", color: colors.text, fontWeight: 700, cursor: "pointer" } }, b / 100 + "%"); }))),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, err),
            confirmNode,
            h("div", { style: { display: "flex", gap: 8 } },
                editing && h(Btn, { kind: "danger", onClick: del, disabled: busy }, tl("حذف", "Delete")),
                h(Btn, { onClick: save, disabled: busy || !(num(limit) > 0) || !catId, style: { flex: 1 } }, busy ? tl("جارٍ الحفظ…", "Saving…") : tl("حفظ", "Save"))));
    }

    // ── recurring entries and rules ──
    function RecurringSheet({ items, cats, onClose, onChanged }) {
        const { colors } = useTheme();
        const [busy, setBusy] = useState(""), [err, setErr] = useState("");
        const [askConfirm, confirmNode] = useConfirm();
        const run = (id, op, payload) => { setBusy(id); setErr(""); call(op, payload).then(() => { setBusy(""); onChanged(); }, (e) => { setErr(errText(e)); setBusy(""); }); };
        const act = (id, op, payload, ask) => (ask ? askConfirm(ask, tl("حذف", "Delete"), () => run(id, op, payload)) : run(id, op, payload));
        return h(Sheet, { title: tl("الحركات المتكرّرة", "Recurring entries"), onClose },
            confirmNode,
            !items.length && h("p", { style: { fontSize: 13, color: colors.textMuted, lineHeight: 1.6 } },
                tl("لا شيء بعد. عند إضافة حركة اختر «التكرار» (الراتب، الإيجار، الاشتراكات…)، فتظهر القادمة مقترحةً في موعدها.", "Nothing yet. When adding an entry, choose “Repeat” (salary, rent, subscriptions…) and the next one appears as a suggestion on its date.")),
            items.map((r) => { const c = cats[r.categoryId], I = iconOf(c && c.icon);
                return h(Card, { key: r.id, style: { marginBottom: 10, padding: 12, opacity: r.paused ? 0.65 : 1 } },
                    h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                        h(I, { size: 18, color: (c && c.color) || TEAL }),
                        h("div", { style: { flex: 1, minWidth: 0 } },
                            h("div", { dir: "auto", style: { fontWeight: 700, fontSize: 14, textAlign: ar() ? "right" : "left" } }, r.counterparty || catName(c)),
                            h("div", { style: { fontSize: 12, color: colors.textMuted } }, ruleText(r.rule) + (r.mode === "auto" ? " · " + tl("تلقائيّ", "automatic") : ""))),
                        h("div", { dir: "ltr", style: { fontWeight: 800, color: r.kind === "income" ? colors.success : colors.text } }, (r.kind === "income" ? "+" : "−") + money(r.amount, r.currency))),
                    h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 } },
                        h("span", { style: { flex: 1, fontSize: 12, color: colors.textMuted } }, r.paused ? tl("متوقّفة", "Paused") : tl("القادمة: ", "Next: ") + dayLabel(r.nextDate)),
                        h(Btn, { kind: "ghost", disabled: busy === r.id, onClick: () => act(r.id, "pfm.recurring.pause", { id: r.id, paused: !r.paused }), style: { minHeight: 44, padding: "6px 12px", fontSize: 13 } }, r.paused ? tl("استئناف", "Resume") : tl("إيقاف", "Pause")),
                        h(Btn, { kind: "danger", disabled: busy === r.id, onClick: () => act(r.id, "pfm.recurring.delete", { id: r.id }, tl("حذف هذا التكرار؟ الحركات المسجّلة تبقى.", "Delete this repeat? Entries already recorded stay.")), style: { minHeight: 44, padding: "6px 12px", fontSize: 13 } }, tl("حذف", "Delete")))); }),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13 } }, err));
    }
    function RulesSheet({ rules, cats, onClose, onChanged }) {
        const { colors } = useTheme();
        const [err, setErr] = useState("");
        return h(Sheet, { title: tl("قواعد التصنيف", "Category rules"), onClose },
            h("p", { style: { fontSize: 13, color: colors.textMuted, lineHeight: 1.6, marginTop: 0 } },
                tl("إذا احتوى اسم الطرف أو الملاحظة على النصّ، تُختار الفئة تلقائيّاً. أضف قاعدة من نموذج الحركة: «استعمل هذه الفئة دائماً».", "If the payee or note contains the text, the category is picked for you. Add a rule from the entry form: “Always use this category”.")),
            !rules.length && h("p", { style: { fontSize: 13, color: colors.textMuted } }, tl("لا قواعد بعد.", "No rules yet.")),
            rules.map((r) => h(Card, { key: r.id, style: { marginBottom: 8, padding: 12, display: "flex", alignItems: "center", gap: 10 } },
                h("span", { dir: "auto", style: { flex: 1, fontSize: 14 } }, h("b", null, "«" + r.contains + "»"), "  →  ", catName(cats[r.categoryId])),
                h(Btn, { kind: "danger", onClick: () => call("pfm.rule.delete", { id: r.id }).then(onChanged, (e) => setErr(errText(e))), style: { minHeight: 44, padding: "6px 12px", fontSize: 13 } }, tl("حذف", "Delete")))),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13 } }, err));
    }

    // ── invoices (C266, P3) ──
    const STATUS = {
        draft: [["مسوّدة", "Draft"], "textMuted"], sent: [["مُرسلة", "Sent"], null], overdue: [["متأخّرة", "Overdue"], "danger"],
        paid: [["مدفوعة", "Paid"], "success"], cancelled: [["ملغاة", "Cancelled"], "textMuted"],
        // C287: money reported or confirmed but not the whole total
        partially_paid: [["مدفوعة جزئيّاً", "Partially paid"], "warning"], pending_verification: [["مدفوعة — بانتظار تحقّقك", "Paid — pending verification"], "warning"],
    };
    const shownStatus = (status, payState) => (payState === "partially_paid" || payState === "pending_verification") && status !== "paid" && status !== "cancelled" ? payState : status;
    function Badge({ status, payState }) {
        const { colors } = useTheme();
        const [label, tone] = STATUS[shownStatus(status, payState)] || [[status, status]];
        const c = tone ? colors[tone] : colors.primary;
        return h("span", { style: { fontSize: T.tiny, fontWeight: 700, color: c, border: "1px solid " + c, borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap" } }, tl(label[0], label[1]));
    }
    const minorToText = (m, cur) => (m == null ? "" : String(m / Math.pow(10, expOf(cur))));
    const addDaysISO = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

    function Invoices({ cur, today, onOpen, onNew, onBiz }) {
        const { colors } = useTheme();
        const [data, setData] = useState(null), [biz, setBiz] = useState(null), [f, setF] = useState("all"), [err, setErr] = useState("");
        useEffect(() => { call("inv.list", {}).then(setData, (e) => setErr(errText(e))); call("pfm.biz.get").then(setBiz, () => setBiz({ biz: {} })); }, []);
        if (err) return h("div", { role: "alert", style: { color: colors.danger } }, err);
        if (!data || !biz) return h(Loading);
        const items = f === "all" ? data.items : data.items.filter((i) => i.status === f);
        const owed = data.outstanding;
        return h("div", null,
            !biz.biz.name && h("section", { style: { padding: "12px 0", marginBottom: 16, borderTop: "1px solid " + colors.border } },
                h("p", { style: { margin: "0 0 8px", fontSize: T.body, lineHeight: 1.6 } }, tl("أضف اسم نشاطك وحسابات الاستلام لتظهر على فواتيرك.", "Add your business name and receiving accounts to show on your invoices.")),
                h(Btn, { onClick: onBiz }, tl("بيانات النشاط", "Business details"))),
            h("h2", { style: { margin: 0, fontSize: T.h1, lineHeight: 1.35, fontWeight: 800 } },
                owed.length ? [tl("لك ", "Clients owe you "), owed.map((o, i) => [i ? tl(" و", " and ") : "", h("bdi", { key: o.currency }, money(o.amount, o.currency))]), tl(" عند عملائك", "")]
                    : tl("لا مبالغ مستحقّة لك الآن", "Nothing is owed to you right now")),
            data.claims > 0 && h("p", { style: { margin: "6px 0 0", color: colors.warning, fontSize: T.body, fontWeight: 700 } },
                tl(`${data.claims} ${data.claims === 1 ? "بلاغ دفع ينتظر" : "بلاغات دفع تنتظر"} تحقّقك`, `${data.claims} payment ${data.claims === 1 ? "report" : "reports"} waiting for you`)),
            data.overdue > 0 && h("p", { style: { margin: "6px 0 0", color: colors.danger, fontSize: T.body } },
                tl(`${data.overdue} ${data.overdue === 1 ? "فاتورة متأخّرة" : "فواتير متأخّرة"}`, `${data.overdue} overdue`)),
            h("div", { style: { display: "flex", gap: 8, margin: "16px 0 12px" } },
                h(Btn, { onClick: onNew, style: { flex: 1 } }, "＋ " + tl("فاتورة جديدة", "New invoice")),
                h(Btn, { kind: "ghost", onClick: onBiz }, tl("بيانات النشاط", "Business details"))),
            h("div", { role: "tablist", "aria-label": tl("الحالة", "Status"), style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 } },
                ["all", "draft", "sent", "overdue", "paid", "cancelled"].map((k) => { const on = f === k, n = k === "all" ? data.items.length : data.items.filter((i) => i.status === k).length;
                    if (k !== "all" && !n) return null;
                    return h("button", { key: k, role: "tab", "aria-selected": on, type: "button", onClick: () => setF(k), style: { flexShrink: 0, minHeight: 44, padding: "4px 12px", borderRadius: 18,
                        border: "1.5px solid " + (on ? colors.primary : colors.border), backgroundColor: on ? colors.primary + "1f" : "transparent", color: colors.text, fontWeight: 700, fontSize: T.small, cursor: "pointer" } },
                        (k === "all" ? tl("الكلّ", "All") : tl(STATUS[k][0][0], STATUS[k][0][1])) + " " + n); })),
            !data.items.length ? h("p", { style: { color: colors.textMuted, fontSize: T.body, lineHeight: 1.6 } }, tl("لم تُصدر فواتير بعد. أنشئ أوّل فاتورة لعميلك، وستظهر هنا مع حالتها.", "No invoices yet. Create your first one and it shows here with its status."))
            : h(Card, { style: { padding: 0 } }, items.map((i, n) => h("button", { key: i.id, type: "button", onClick: () => onOpen(i.id), style: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px",
                border: 0, borderTop: n ? "1px solid " + colors.border : 0, background: "none", color: colors.text, textAlign: "start", cursor: "pointer", minHeight: 60 } },
                h("span", { style: { flex: 1, minWidth: 0 } },
                    h("div", { dir: "auto", style: { fontWeight: 700, fontSize: T.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: ar() ? "right" : "left" } }, i.clientName || "—"),
                    h("div", { style: { fontSize: T.tiny, color: colors.textMuted, marginTop: 2 } }, h("bdi", null, i.number || tl("بلا رقم", "No number")), "  ", i.status === "draft" ? "" : tl("يستحقّ ", "due ") + dayLabel(i.dueDate)),
                    i.openClaims > 0 && h("div", { style: { fontSize: T.tiny, color: colors.warning, fontWeight: 700, marginTop: 2 } }, tl("أبلغ العميل عن دفع", "Client reported a payment"))),
                h("span", { style: { textAlign: "end", flexShrink: 0 } },
                    h("div", { style: { fontWeight: 800, fontSize: T.body } }, fig(i.status === "paid" || i.status === "cancelled" || i.status === "draft" ? i.total : i.amountDue, i.currency)),
                    h("div", { style: { marginTop: 4 } }, h(Badge, { status: i.status, payState: i.payState })))))));
    }

    // Editor for a new or draft invoice. Totals come from the server (inv.preview), never from the browser.
    function InvoiceEditor({ inv, base, today, onClose, onSaved }) {
        const { colors } = useTheme();
        const [biz, setBiz] = useState(null);
        const [cur, setCur] = useState(inv ? inv.currency : null);
        const [client, setClient] = useState(Object.assign({ name: "", contact: "", taxId: "", address: "", phone: "", sawaId: "" }, inv ? inv.client : {}));
        const [items, setItems] = useState(null);
        const [disc, setDisc] = useState(inv && inv.invoiceDiscount && inv.invoiceDiscount.type === "pct" ? inv.invoiceDiscount.rate : "");
        const [issue, setIssue] = useState(inv ? inv.issueDate : today), [due, setDue] = useState(inv ? inv.dueDate : null);
        const [partial, setPartial] = useState(inv ? inv.allowPartial : true), [accts, setAccts] = useState(inv ? inv.payoutAccountIds || [] : null);
        const [notes, setNotes] = useState(inv ? inv.notes || "" : ""), [lang, setLang] = useState(inv ? inv.lang : (ar() ? "ar" : "en"));
        const [totals, setTotals] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
        const curs = useMemo(currencyList, []);
        useEffect(() => { call("pfm.biz.get").then((b) => {
            setBiz(b);
            const B = b.biz, defTax = B.taxRegistered && B.defaultTaxRateId ? { mode: "saved", id: B.defaultTaxRateId } : { mode: "none" };
            if (!inv) { setCur(B.defaultInvoiceCurrency || base); setDue(addDaysISO(today, B.defaultDueDays == null ? 14 : B.defaultDueDays)); setPartial(B.defaultAllowPartial !== false);
                setAccts(B.defaultPayoutAccountIds || []); setItems([{ k: newKey(), d: "", q: "1", p: "", tax: defTax }]); }
            else setItems(inv.items.map((it) => { const saved = (B.taxRates || []).find((r) => r.rate === it.taxRate && it.taxRate !== "0");
                return { k: newKey(), d: it.description, q: it.qty, p: minorToText(it.unitPrice, inv.currency), tax: !it.taxRate || it.taxRate === "0" ? { mode: "none" } : saved ? { mode: "saved", id: saved.id } : { mode: "custom", rate: it.taxRate } }; }));
        }, (e) => setErr(errText(e))); }, []);
        const B = biz && biz.biz;
        const payloadItems = () => (items || []).map((it) => Object.assign({ description: it.d.trim() || "—", qty: it.q || "1", unitPrice: it.p || "0" },
            it.tax.mode === "saved" ? { taxRateId: it.tax.id } : it.tax.mode === "custom" ? { taxRate: it.tax.rate || "0" } : {}));
        const discount = () => (disc && num(disc) > 0 ? { type: "pct", rate: disc } : null);
        // live totals, debounced
        useEffect(() => { if (!items || !cur) return; const t = setTimeout(() => {
            if (!items.some((it) => num(it.p) > 0)) { setTotals(null); return; }
            call("inv.preview", { currency: cur, items: payloadItems(), invoiceDiscount: discount() }).then((r) => { setTotals(r.totals); setErr(""); }, (e) => setErr(errText(e))); }, 300);
            return () => clearTimeout(t); }, [items, cur, disc]);
        if (!biz || !items) return h(Sheet, { title: tl("فاتورة", "Invoice"), onClose }, err ? h("div", { role: "alert", style: { color: colors.danger } }, err) : h(Loading));
        const setItem = (i, patch) => setItems(items.map((it, j) => (j === i ? Object.assign({}, it, patch) : it)));
        const accounts = (biz.accounts || []).filter((a) => !a.archived && (a.currency === "ANY" || a.currency === cur));
        const save = async (andSend) => {
            if (andSend && !(await ask({ text: tl("ستأخذ الفاتورة رقماً ولن تُعدَّل بعد الإرسال. متابعة؟", "The invoice gets its number and can't be edited after sending. Continue?"), confirmLabel: tl("إرسال", "Send") }))) return;
            setBusy(true); setErr("");
            const p = { currency: cur, client: { name: client.name.trim(), contact: (client.contact || "").trim(), taxId: (client.taxId || "").trim(), address: (client.address || "").trim(), phone: (client.phone || "").trim(), sawaId: (client.sawaId || "").trim() }, items: payloadItems(), invoiceDiscount: discount(),
                issueDate: issue, dueDate: due, allowPartial: partial, payoutAccountIds: accts, notes: notes.trim(), lang };
            (inv ? call("inv.update", Object.assign({ id: inv.id, rev: inv.rev }, p)) : call("inv.create", p))
                .then((r) => (andSend ? call("inv.send", { id: r.invoice.id }) : r))
                .then((r) => onSaved(r.invoice), (e) => { setErr(errText(e)); setBusy(false); });
        };
        const rateOpts = [h("option", { key: "n", value: "none" }, tl("بلا ضريبة", "No tax"))].concat((B.taxRates || []).map((r) => h("option", { key: r.id, value: "saved:" + r.id, title: r.label || undefined }, "\u200E" + r.rate + "%\u200E")),   // rate only (the menu is narrow); LRM marks keep "15%" in order — dropdowns ignore isolates
            [h("option", { key: "c", value: "custom" }, tl("نسبة أخرى…", "Other rate…"))]);
        const small = Object.assign(inputStyle(colors), { minHeight: 44, padding: "8px 10px", fontSize: 14 });
        return h(Sheet, { title: inv ? tl("تعديل المسوّدة", "Edit draft") : tl("فاتورة جديدة", "New invoice"), onClose },
            h(Field, { label: tl("العميل", "Client") },
                h("input", { dir: "auto", value: client.name, maxLength: 120, placeholder: tl("الاسم", "Name"), onChange: (e) => setClient(Object.assign({}, client, { name: e.target.value })), style: Object.assign(inputStyle(colors), { marginBottom: 8 }) }),
                h("input", { dir: "ltr", type: "tel", inputMode: "tel", value: client.phone, maxLength: 30, placeholder: tl("الهاتف (اختياريّ)", "Phone (optional)"), "aria-label": tl("هاتف العميل", "Client phone"), onChange: (e) => setClient(Object.assign({}, client, { phone: e.target.value })), style: Object.assign(inputStyle(colors), { marginBottom: 8, textAlign: ar() ? "right" : "left" }) }),
                h("input", { dir: "auto", value: client.contact, maxLength: 120, placeholder: tl("البريد الإلكترونيّ (اختياريّ)", "Email (optional)"), "aria-label": tl("بريد العميل", "Client email"), onChange: (e) => setClient(Object.assign({}, client, { contact: e.target.value })), style: Object.assign(inputStyle(colors), { marginBottom: 8 }) }),
                h("input", { dir: "auto", value: client.address, maxLength: 200, placeholder: tl("العنوان (اختياريّ)", "Address (optional)"), "aria-label": tl("عنوان العميل", "Client address"), onChange: (e) => setClient(Object.assign({}, client, { address: e.target.value })), style: Object.assign(inputStyle(colors), { marginBottom: 8 }) }),
                h("input", { dir: "ltr", inputMode: "numeric", value: client.sawaId, maxLength: 14, placeholder: tl("رمز سوا للعميل (اختياريّ)", "Client's Sawa ID (optional)"), "aria-label": tl("رمز سوا للعميل", "Client's Sawa ID"), onChange: (e) => setClient(Object.assign({}, client, { sawaId: e.target.value.replace(/[^\d-]/g, "") })), style: Object.assign(inputStyle(colors), { marginBottom: 8, textAlign: ar() ? "right" : "left" }) }),
                B.taxRegistered && h("input", { dir: "ltr", value: client.taxId, maxLength: 40, placeholder: tl("الرقم الضريبيّ للعميل (اختياريّ)", "Client tax ID (optional)"), onChange: (e) => setClient(Object.assign({}, client, { taxId: e.target.value })), style: inputStyle(colors) })),
            h(Field, { label: tl("العملة", "Currency") }, h("select", { value: cur, onChange: (e) => setCur(e.target.value), style: inputStyle(colors) }, curs.map((c) => h("option", { key: c.code, value: c.code }, c.label)))),
            h(Field, { label: tl("البنود", "Items"), group: true },
                items.map((it, i) => h("div", { key: it.k, style: { padding: "10px 0", borderTop: i ? "1px solid " + colors.border : 0 } },
                    h("input", { dir: "auto", value: it.d, maxLength: 200, placeholder: tl("الوصف", "Description"), "aria-label": tl("الوصف", "Description"), onChange: (e) => setItem(i, { d: e.target.value }), style: Object.assign({}, small, { marginBottom: 6 }) }),
                    h("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                        h("input", { dir: "ltr", inputMode: "decimal", value: it.q, "aria-label": tl("الكمّيّة", "Quantity"), onChange: (e) => setItem(i, { q: numIn(e.target.value) }), style: Object.assign({}, small, { width: 64, flex: "none" }) }),
                        h("span", { "aria-hidden": true, style: { color: colors.textMuted } }, "×"),
                        h("input", { dir: "ltr", inputMode: "decimal", value: it.p, placeholder: tl("سعر الوحدة", "Unit price"), "aria-label": tl("سعر الوحدة", "Unit price"), onChange: (e) => setItem(i, { p: numIn(e.target.value) }), style: Object.assign({}, small, { flex: 1 }) }),
                        B.taxRegistered && h("select", { "aria-label": B.taxLabel || tl("الضريبة", "Tax"), value: it.tax.mode === "saved" ? "saved:" + it.tax.id : it.tax.mode, onChange: (e) => { const v = e.target.value; setItem(i, { tax: v === "none" ? { mode: "none" } : v === "custom" ? { mode: "custom", rate: "" } : { mode: "saved", id: v.slice(6) } }); }, style: Object.assign({}, small, { width: 110, flex: "none" }) }, rateOpts),
                        items.length > 1 && h("button", { type: "button", "aria-label": tl("حذف البند", "Remove line"), onClick: () => setItems(items.filter((_, j) => j !== i)), style: { width: 44, height: 44, border: 0, background: "none", color: colors.textMuted, cursor: "pointer", flex: "none" } }, h(X, { size: 18 }))),
                    it.tax.mode === "custom" && h("input", { dir: "ltr", inputMode: "decimal", value: it.tax.rate, placeholder: tl("النسبة %", "Rate %"), "aria-label": tl("نسبة الضريبة", "Tax rate"), onChange: (e) => setItem(i, { tax: { mode: "custom", rate: numIn(e.target.value) } }), style: Object.assign({}, small, { marginTop: 6, width: 120 }) }))),
                h("button", { type: "button", onClick: () => setItems(items.concat({ k: newKey(), d: "", q: "1", p: "", tax: B.taxRegistered && B.defaultTaxRateId ? { mode: "saved", id: B.defaultTaxRateId } : { mode: "none" } })),
                    style: { minHeight: 44, border: 0, background: "none", color: tealInk(), fontWeight: 700, cursor: "pointer", padding: 0 } }, "＋ " + tl("بند آخر", "Another line"))),
            !B.taxRegistered && h("p", { style: { fontSize: T.tiny, color: colors.textMuted, margin: "-6px 0 12px" } }, tl("لا ضريبة على فواتيرك. إن كنت تفرضها، فعّلها في بيانات النشاط.", "Your invoices carry no tax. If you charge tax, turn it on in business details.")),
            h(Field, { label: tl("خصمٌ على الفاتورة كلّها (%)", "Discount on the whole invoice (%)") }, h("input", { dir: "ltr", inputMode: "decimal", value: disc, placeholder: "0", onChange: (e) => setDisc(numIn(e.target.value)), style: inputStyle(colors) })),
            h("div", { style: { display: "flex", gap: 8 } },
                h("div", { style: { flex: 1 } }, h(Field, { label: tl("تاريخ الإصدار", "Issue date") }, h("input", { type: "date", value: issue, onChange: (e) => setIssue(e.target.value), style: inputStyle(colors) }))),
                h("div", { style: { flex: 1 } }, h(Field, { label: tl("يستحقّ في", "Due on") }, h("input", { type: "date", value: due || "", min: issue, onChange: (e) => setDue(e.target.value), style: inputStyle(colors) })))),
            h("div", { style: { display: "flex", gap: 6, margin: "-4px 0 12px", flexWrap: "wrap" } }, [0, 7, 14, 30].map((n) => h("button", { key: n, type: "button", onClick: () => setDue(addDaysISO(issue, n)),
                style: { minHeight: 44, padding: "4px 10px", borderRadius: 17, border: "1px solid " + colors.border, background: "none", color: colors.text, fontSize: T.small, cursor: "pointer" } },
                n === 0 ? tl("عند الاستلام", "On receipt") : tl(`بعد ${n} يوماً`, `In ${n} days`)))),
            h(Field, { label: tl("يدفع لك العميل في", "The client pays you into"), group: true, hint: accounts.length ? null : tl("لا حسابات بهذه العملة — أضفها في بيانات النشاط، أو اترك الفاتورة للدفع نقداً.", "No accounts in this currency — add them in business details, or leave it for cash payment.") },
                h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, accounts.map((a) => { const on = accts.indexOf(a.id) >= 0;
                    return h("button", { key: a.id, type: "button", "aria-pressed": on, onClick: () => setAccts(on ? accts.filter((x) => x !== a.id) : accts.concat(a.id)), style: { minHeight: 44, padding: "6px 12px", borderRadius: 19,
                        border: "1.5px solid " + (on ? colors.primary : colors.border), backgroundColor: on ? colors.primary + "1f" : "transparent", color: colors.text, fontSize: T.small, fontWeight: 600, cursor: "pointer" } },
                        (a.bankName || a.provider || a.label) + " ", h("bdi", null, a.number)); }))),
            h(Check, { checked: partial, onChange: setPartial }, tl("يجوز للعميل الدفع على دفعات", "The client may pay in parts")),
            h(Field, { label: tl("ملاحظات على الفاتورة (اختياريّ)", "Notes on the invoice (optional)") }, h("textarea", { dir: "auto", value: notes, maxLength: 1000, rows: 2, onChange: (e) => setNotes(e.target.value), style: Object.assign(inputStyle(colors), { resize: "vertical" }) })),
            h(Field, { label: tl("لغة الفاتورة", "Invoice language") }, h(Seg, { value: lang, onChange: setLang, options: [{ value: "ar", label: "العربيّة" }, { value: "en", label: "English" }] })),
            // totals bar: server-computed
            h("div", { "aria-live": "polite", style: { position: "sticky", bottom: 0, margin: "8px -16px 0", padding: "12px 16px", backgroundColor: colors.card, borderTop: "1px solid " + colors.border } },
                totals ? h("div", { style: { display: "grid", gap: 2, fontSize: T.small, color: colors.textMuted, marginBottom: 10 } },
                    h("div", { style: { display: "flex" } }, h("span", { style: { flex: 1 } }, tl("المجموع الفرعيّ", "Subtotal")), fig(totals.subtotal, cur)),
                    totals.invoiceDiscount > 0 && h("div", { style: { display: "flex" } }, h("span", { style: { flex: 1 } }, tl("الخصم", "Discount")), h("span", null, "−", fig(totals.invoiceDiscount, cur))),
                    totals.taxBreakdown.map((t0) => h("div", { key: t0.taxRate, style: { display: "flex" } }, h("span", { style: { flex: 1 } }, (B.taxLabel || tl("الضريبة", "Tax")) + " ", h("bdi", null, t0.taxRate + "%")), fig(t0.tax, cur))),
                    h("div", { style: { display: "flex", fontSize: T.h2 + 2, fontWeight: 800, color: colors.text, marginTop: 4 } }, h("span", { style: { flex: 1 } }, tl("الإجماليّ", "Total")), fig(totals.total, cur)))
                    : h("p", { style: { margin: "0 0 10px", fontSize: T.small, color: colors.textMuted } }, tl("أضف سعراً ليظهر الإجماليّ", "Add a price to see the total")),
                err && h("div", { role: "alert", style: { color: colors.danger, fontSize: T.small, marginBottom: 8 } }, err),
                h("div", { style: { display: "flex", gap: 8 } },
                    h(Btn, { kind: "ghost", onClick: () => save(false), disabled: busy || !client.name.trim() }, tl("حفظ كمسوّدة", "Save draft")),
                    h(Btn, { onClick: () => save(true), disabled: busy || !client.name.trim() || !totals, style: { flex: 1 } }, busy ? tl("جارٍ…", "Working…") : tl("إرسال", "Send")))));
    }

    // Printing in a browser: the server renders the page and a frame prints it. C287: the frame has a real A4 width
    // off-screen (a 0×0 frame printed blank pages in Chrome) and is removed after printing, not after a fixed minute.
    function printHtml(html) {
        const f = document.createElement("iframe");
        f.setAttribute("aria-hidden", "true"); f.tabIndex = -1; f.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0";
        document.body.appendChild(f);
        f.onload = () => {
            const w = f.contentWindow, gone = () => setTimeout(() => { try { f.remove(); } catch (e) { } }, 1000);
            try { w.addEventListener("afterprint", gone); w.focus(); w.print(); } catch (e) { gone(); }
            setTimeout(() => { try { f.remove(); } catch (e) { } }, 10 * 60000);   // a print dialog left open
        };
        f.srcdoc = html;
    }
    const inApp = () => !!(window.SawaNativeBridge || window.SawaIOS);
    // C287: HTML → PDF file on the phone. Android's WebView and iOS's WKWebView ignore window.print(), so "Print or PDF"
    // did nothing in the Sawa apps. The page is laid out in an off-screen frame (scripts off), drawn with html2canvas,
    // cut into A4 pages between rows, and written as a PDF of JPEG pages. The text is drawn by the browser itself, so
    // Arabic shaping and right-to-left order are exactly what the screen shows.
    var SAWA_H2C = { src: "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js", sri: "sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H" };
    var sawaH2cP = null, sawaH2cDoc = null;
    // html2canvas measures font baselines (and runs its feature tests) in the global `document`. In the app that page has
    // Tailwind and app styles (img display:block, line heights), the baselines came out wrong and every word was drawn
    // ~9 px high: the header was cut off and the totals' rule ran through the text. Its `document` is this proxy, which
    // points at the invoice's own frame while a page is drawn.
    var sawaDocProxy = new Proxy({}, { get: function (_, k) { var d = sawaH2cDoc || window.document, v = d[k]; return typeof v === "function" ? v.bind(d) : v; } });
    // C288: app.p1 declares `const { Image, … } = window.__L` (an icon) at the top level, and that name shadows the
    // browser's Image in every later classic script. html2canvas loads pictures with `new Image()`, so in the app it got
    // the icon, the logo never loaded and the invoice PDF came out without it. The library is fetched, checked against the
    // same SRI hash a <script integrity> would use, and run with the real Image constructor (and the document proxy) passed in.
    function sawaLoadH2c() {
        if (window.html2canvas) return Promise.resolve(window.html2canvas);
        if (sawaH2cP) return sawaH2cP;
        sawaH2cP = fetch(SAWA_H2C.src, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" })
            .then(function (r) { if (!r.ok) throw new Error("pdf_lib"); return r.arrayBuffer(); })
            .then(function (buf) {
                return crypto.subtle.digest("SHA-384", buf).then(function (d) {
                    var u = new Uint8Array(d), b = ""; for (var i = 0; i < u.length; i++) b += String.fromCharCode(u[i]);
                    if ("sha384-" + btoa(b) !== SAWA_H2C.sri) throw new Error("pdf_lib");
                    // eslint-disable-next-line no-new-func
                    new Function("Image", "document", "module", "exports", "define", new TextDecoder().decode(buf)).call(window, window.Image, sawaDocProxy, undefined, undefined, undefined);
                    if (!window.html2canvas) throw new Error("pdf_lib");
                    return window.html2canvas;
                });
            })
            .catch(function (e) { sawaH2cP = null; throw e && e.message === "pdf_lib" ? e : new Error("pdf_lib"); });
        return sawaH2cP;
    }
    // A4 at 96 css px per inch, with the invoice template's own print margins (16 mm × 14 mm).
    var SAWA_MM = 96 / 25.4, SAWA_PAGE = { w: 210, h: 297, mx: 14, my: 16 };
    function sawaPdfBytes(pages) {   // pages: [{ jpeg: Uint8Array, w, h }] → Uint8Array (a PDF 1.4 file of JPEG pages)
        var enc = new TextEncoder(), parts = [], size = 0, offs = [];
        function put(x) { var u = typeof x === "string" ? enc.encode(x) : x; parts.push(u); size += u.length; }
        function obj(num, dict, stream) {
            offs[num] = size; put(num + " 0 obj\n");
            if (stream) { put(dict.slice(0, -2) + "/Length " + stream.length + ">>\nstream\n"); put(stream); put("\nendstream"); } else put(dict);
            put("\nendobj\n");
        }
        var pt = 72 / 25.4, pw = SAWA_PAGE.w * pt, ph = SAWA_PAGE.h * pt, mx = SAWA_PAGE.mx * pt, my = SAWA_PAGE.my * pt, cw = pw - 2 * mx;
        var kids = pages.map(function (_, i) { return (5 + 3 * i) + " 0 R"; }).join(" "), last = 2 + 3 * pages.length;
        put("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
        obj(1, "<</Type/Catalog/Pages 2 0 R>>");
        obj(2, "<</Type/Pages/Count " + pages.length + "/Kids[" + kids + "]>>");
        pages.forEach(function (p, i) {
            var im = 3 + 3 * i, ct = 4 + 3 * i, pg = 5 + 3 * i, dh = cw * p.h / p.w;
            obj(im, "<</Type/XObject/Subtype/Image/Width " + p.w + "/Height " + p.h + "/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode>>", p.jpeg);
            obj(ct, "<<>>", enc.encode("q " + cw.toFixed(2) + " 0 0 " + dh.toFixed(2) + " " + mx.toFixed(2) + " " + (ph - my - dh).toFixed(2) + " cm /I0 Do Q"));
            obj(pg, "<</Type/Page/Parent 2 0 R/MediaBox[0 0 " + pw.toFixed(2) + " " + ph.toFixed(2) + "]/Resources<</XObject<</I0 " + im + " 0 R>>>>/Contents " + ct + " 0 R>>");
        });
        var xref = size, x = "xref\n0 " + (last + 1) + "\n0000000000 65535 f \n";
        for (var k = 1; k <= last; k++) x += ("000000000" + offs[k]).slice(-10) + " 00000 n \n";
        put(x + "trailer\n<</Size " + (last + 1) + "/Root 1 0 R>>\nstartxref\n" + xref + "\n%%EOF\n");
        var all = new Uint8Array(size), at = 0;
        parts.forEach(function (u) { all.set(u, at); at += u.length; });
        return all;
    }
    function sawaB64ToBytes(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
    // Where a page may end: the bottom of a table row or of a block, never through a line of text.
    function sawaBreaks(doc) {
        var out = [], els = doc.body.querySelectorAll("tr,header,section,table,.bottom,.notes,.accts,.acct,.party,.meta div,p,li,h1,h2,h3,.card,.row,div");
        for (var i = 0; i < els.length; i++) { var r = els[i].getBoundingClientRect(); if (r.height > 0) out.push(r.bottom); }
        return out.sort(function (a, b) { return a - b; });
    }
    function sawaPdf(html) {   // → Promise<Blob application/pdf>
        return sawaLoadH2c().then(function (h2c) {
            return new Promise(function (ok, no) {
                var cssW = Math.round((SAWA_PAGE.w - 2 * SAWA_PAGE.mx) * SAWA_MM);
                var f = document.createElement("iframe");
                f.setAttribute("aria-hidden", "true"); f.setAttribute("sandbox", "allow-same-origin"); f.tabIndex = -1;
                f.style.cssText = "position:fixed;left:-10000px;top:0;width:" + cssW + "px;height:40px;border:0;background:#fff";
                f.style.setProperty("display", "block", "important"); f.style.setProperty("visibility", "visible", "important");   // C288: laid out even if a page rule hides iframes; 40 px tall, so the height measured is the content's
                var done = false, cleanup = function () { try { f.remove(); } catch (e) { } };
                var timer = setTimeout(function () { if (!done) { done = true; cleanup(); no(new Error("pdf_timeout")); } }, 45000);
                f.onload = function () {
                    var doc = f.contentDocument;
                    if (done) return;
                    if (doc && doc.URL === "about:blank" && !(doc.body && doc.body.firstChild)) return;   // C288: the empty first load, not the invoice
                    if (!doc || !doc.body) { done = true; clearTimeout(timer); cleanup(); no(new Error("pdf_frame")); return; }
                    var st = doc.createElement("style");
                    st.textContent = "html,body{margin:0!important;padding:0!important;background:#fff!important;width:" + cssW + "px}";
                    doc.head.appendChild(st);
                    var fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
                    // C288: the logo is a data: image; wait until it is decoded, or html2canvas may draw the header without it.
                    var imgs = Array.prototype.slice.call(doc.images || []).map(function (im) {
                        if (im.complete && im.naturalWidth) return im.decode ? im.decode().catch(function () { }) : null;
                        return new Promise(function (r) { im.onload = im.onerror = function () { r(); }; setTimeout(r, 5000); });
                    });
                    Promise.all([fontsReady].concat(imgs)).then(function () {
                        // C288: the content's own height. The frame was 1200 px tall and documentElement.scrollHeight is never
                        // less than the frame, so a one-page invoice (≈ 1001 px of A4 content area) came out as two pages.
                        var H = Math.ceil(Math.max(doc.body.scrollHeight, doc.body.getBoundingClientRect().bottom, 1));
                        f.style.height = H + "px";
                        try { doc.defaultView.scrollTo(0, 0); } catch (e) { }   // C288: draw from the top of the page
                        var scale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
                        var breaks = sawaBreaks(doc);
                        sawaH2cDoc = doc;   // C288: fonts are measured in the invoice's frame, not in the app page
                        var unfix = function (x) { sawaH2cDoc = null; return x; };
                        return h2c(doc.documentElement, { scale: scale, backgroundColor: "#ffffff", useCORS: false, logging: false, width: cssW, height: H, windowWidth: cssW, windowHeight: H, x: 0, y: 0, scrollX: 0, scrollY: 0 }).then(function (canvas) {
                            var pageH = (SAWA_PAGE.h - 2 * SAWA_PAGE.my) * SAWA_MM, pages = [], top = 0;
                            while (H - top > 4) {   // C288: a sliver of a few px is not a page
                                var end = Math.min(H, top + pageH);
                                if (end < H) { var best = 0; for (var i = 0; i < breaks.length; i++) { var b = breaks[i]; if (b > top + pageH * 0.6 && b <= end) best = b; } if (best) end = best; }
                                var sy = Math.round(top * scale), sh = Math.max(1, Math.round(end * scale) - sy);
                                var c = document.createElement("canvas"); c.width = canvas.width; c.height = sh;
                                var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
                                pages.push({ jpeg: sawaB64ToBytes(c.toDataURL("image/jpeg", 0.88).split(",")[1]), w: c.width, h: sh });
                                top = end;
                            }
                            done = true; clearTimeout(timer); cleanup();
                            ok(new Blob([sawaPdfBytes(pages)], { type: "application/pdf" }));
                        }).then(unfix, function (e) { unfix(); throw e; });
                    }).catch(function (e) { if (!done) { done = true; clearTimeout(timer); cleanup(); no(e); } });
                };
                f.srcdoc = html;   // C288: before the frame is attached, so its one load is the invoice
                document.body.appendChild(f);
            });
        });
    }
    const pdfBlob = (b64) => new Blob([sawaB64ToBytes(b64)], { type: "application/pdf" });
    // C287: a PDF file from an op that answers { pdf | html, filename } (inv.pdf, pfm.proj.report.pdf): the server's file
    // when Browser Rendering is set up, otherwise made here. Saved through saveFileOut (Android saves, iOS shares).
    function pdfFromOp(op, payload) {
        return call(op, payload).then((r) => (r.pdf ? { blob: pdfBlob(r.pdf), r } : sawaPdf(r.html).then((blob) => ({ blob, r }), (e) => { e.html = r.html; throw e; })))
            .then(({ blob, r }) => { saveFileOut(blob, r.filename, "application/pdf"); return r; });
    }
    const payLink = (inv) => "https://www.sawaaap.com/pay/" + inv.payLinkToken;
    function shareText(inv, bizName) {
        const L2 = inv.lang === "en" ? (a, b) => b : (a) => a, cur = inv.currency, due = inv.totals.amountDue;
        const lines = [L2(`فاتورة ${inv.number} من ${bizName}`, `Invoice ${inv.number} from ${bizName}`),
            L2(`المستحقّ: ${money(due, cur)} — قبل ${inv.dueDate}`, `Amount due: ${money(due, cur)} by ${inv.dueDate}`)];
        if ((inv.payoutAccounts || []).length) {
            lines.push("", L2("الدفع إلى:", "Pay to:"));
            inv.payoutAccounts.forEach((a) => lines.push([a.bankName || a.provider || a.label, a.holderName, a.number, a.branch].filter(Boolean).join(" — ")));
            lines.push(L2(`اكتب ${inv.number} في خانة البيان.`, `Use ${inv.number} as the payment reference.`));
        }
        if (inv.payLinkToken) lines.push("", L2("الفاتورة، وأبلغ عن دفعك هنا:", "The invoice, and report your payment here:"), payLink(inv));
        return lines.join("\n");
    }

    function InvoiceDetail({ id, base, today, onClose, onChanged, onEdit }) {
        const { colors } = useTheme();
        const [inv, setInv] = useState(null), [biz, setBiz] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
        const [pay, setPay] = useState(null), [proof, setProof] = useState(null), [pdfBusy, setPdfBusy] = useState(false);
        const load = () => call("inv.get", { id }).then((r) => setInv(r.invoice), (e) => setErr(errText(e)));
        // C287: invoices sent before pay links existed get one here (inv.link makes it on first request)
        const withLink = () => (inv.payLinkToken ? Promise.resolve(inv) : call("inv.link", { id }).then((r) => { const nx = Object.assign({}, inv, { payLinkToken: r.token }); setInv(nx); return nx; }, () => inv));
        useEffect(() => { load(); call("pfm.biz.get").then(setBiz, () => {}); }, [id]);
        if (!inv) return h(Sheet, { title: tl("فاتورة", "Invoice"), onClose }, err ? h("div", { role: "alert", style: { color: colors.danger } }, err) : h(Loading));
        const cur = inv.currency, t0 = inv.totals, st = inv.status;
        const run = (p, done) => { setBusy(true); setErr(""); return p.then((r) => { setBusy(false); if (r && r.invoice) setInv(r.invoice); onChanged(); if (done) done(r); }, (e) => { setErr(errText(e)); setBusy(false); }); };
        const doPrint = () => run(call("inv.html", { id }), (r) => printHtml(r.html));
        const doPdf = () => {
            if (pdfBusy) return; setPdfBusy(true); setErr(""); setMsg("");
            pdfFromOp("inv.pdf", { id }).then(() => { setPdfBusy(false); setMsg(inApp() ? tl("جُهّز ملفّ PDF للفاتورة", "The invoice PDF is ready") : tl("نُزّل ملفّ PDF للفاتورة", "The invoice PDF was downloaded")); },
                (e) => { setPdfBusy(false); if (!inApp() && e && e.html) { printHtml(e.html); return; } setErr(tl("تعذّر تجهيز ملفّ PDF. تحقّق من الاتصال وأعد المحاولة.", "Couldn't make the PDF. Check your connection and try again.")); });
        };
        const doShare = () => withLink().then((iv) => { const text = shareText(iv, (biz && biz.biz.name) || "");
            if (navigator.share) navigator.share({ title: iv.number, text }).catch(() => {});
            else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => setMsg(tl("نُسخ نصّ الفاتورة — الصقه في المحادثة", "Invoice text copied — paste it in a chat")), () => {}); });
        const payForm = pay && h("section", { "aria-label": tl("تسجيل دفعة", "Record a payment"), style: { padding: "12px 0", margin: "12px 0", borderTop: "1px solid " + colors.border } },
            h(Field, { label: tl("المبلغ المستلم", "Amount received") + " (" + cur + ")" }, h("input", { dir: "ltr", inputMode: "decimal", value: pay.amount, onChange: (e) => setPay(Object.assign({}, pay, { amount: numIn(e.target.value) })), style: inputStyle(colors) })),
            h(Field, { label: tl("كيف وصلك", "How it arrived") }, h("select", { value: pay.method, onChange: (e) => setPay(Object.assign({}, pay, { method: e.target.value })), style: inputStyle(colors) },
                [["bank_transfer", "تحويل بنكيّ", "Bank transfer"], ["mobile_money", "محفظة جوّال", "Mobile money"], ["cash", "نقداً", "Cash"], ["other", "أخرى", "Other"]].map(([v, a, b]) => h("option", { key: v, value: v }, tl(a, b))))),
            h("div", { style: { display: "flex", gap: 8 } },
                h("div", { style: { flex: 1 } }, h(Field, { label: tl("التاريخ", "Date") }, h("input", { type: "date", value: pay.date, max: today, onChange: (e) => setPay(Object.assign({}, pay, { date: e.target.value })), style: inputStyle(colors) }))),
                h("div", { style: { flex: 1 } }, h(Field, { label: tl("المرجع (اختياريّ)", "Reference (optional)") }, h("input", { dir: "auto", value: pay.reference, maxLength: 80, onChange: (e) => setPay(Object.assign({}, pay, { reference: e.target.value })), style: inputStyle(colors) })))),
            cur !== base && h(Field, { label: tl("سعر الصرف: ", "Exchange rate: ") + "\u2066" + `1 ${cur} = ? ${base}` + "\u2069", hint: tl("لتدخل الدفعة مجاميعك. اتركه فارغاً لتضيفه لاحقاً", "So the payment counts in your totals. Leave empty to add it later") },
                h("input", { dir: "ltr", inputMode: "decimal", value: pay.fxRate, onChange: (e) => setPay(Object.assign({}, pay, { fxRate: numIn(e.target.value) })), style: inputStyle(colors) })),
            h("div", { style: { display: "flex", gap: 8 } },
                h(Btn, { kind: "ghost", onClick: () => setPay(null) }, tl("إلغاء", "Cancel")),
                h(Btn, { style: { flex: 1 }, disabled: busy || !(num(pay.amount) > 0), onClick: () => run(call("inv.markPaid", { id, amount: pay.amount, method: pay.method, paidAt: pay.date, reference: pay.reference || null, fxRate: pay.fxRate || undefined, idemKey: pay.key }), () => setPay(null)) },
                    tl("سجّل الدفعة", "Record payment"))));
        return h(Sheet, { title: inv.number || tl("مسوّدة فاتورة", "Draft invoice"), onClose },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } }, h(Badge, { status: st, payState: inv.payState }),
                st !== "draft" && st !== "cancelled" && h("span", { style: { fontSize: T.small, color: st === "overdue" ? colors.danger : colors.textMuted } }, tl("يستحقّ ", "Due ") + dayLabel(inv.dueDate))),
            h("h2", { style: { margin: "6px 0 2px", fontSize: 32, fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" } },
                st === "paid" ? [tl("دُفعت كاملةً: ", "Paid in full: "), fig(t0.total, cur)] : st === "cancelled" ? tl("ملغاة", "Cancelled")
                    : t0.amountPaid > 0 ? [fig(t0.amountDue, cur), tl(" متبقٍّ من ", " left of "), fig(t0.total, cur)] : fig(t0.total, cur)),
            h("p", { dir: "auto", style: { margin: "0 0 12px", color: colors.textMuted, fontSize: T.body, textAlign: ar() ? "right" : "left" } }, tl("إلى ", "To ") + inv.client.name),
            h("div", { style: { fontSize: T.small, display: "grid", gap: 4, marginBottom: 12 } },
                inv.items.map((it, i) => h("div", { key: i, style: { display: "flex", gap: 8 } }, h("span", { dir: "auto", style: { flex: 1 } }, it.description, " ", h("bdi", { style: { color: colors.textMuted } }, "× " + it.qty)), fig(t0.lines[i].amount, cur))),
                t0.taxTotal > 0 && h("div", { style: { display: "flex", color: colors.textMuted } }, h("span", { style: { flex: 1 } }, inv.taxLabel || tl("الضريبة", "Tax")), fig(t0.taxTotal, cur))),
            (inv.payments || []).filter((p) => p.state === "claimed").map((p) => { const acct = (inv.payoutAccounts || []).find((a) => a.id === p.payoutAccountId);
                return h("section", { key: p.id, "aria-label": tl("بلاغ دفع", "Payment report"), style: { padding: "12px 0 0", margin: "14px 0 0", borderTop: "1px solid " + colors.border } },
                    h("div", { style: { fontWeight: 800, fontSize: T.body } }, h("bdi", null, p.payer && p.payer.name), tl(" يقول إنّه دفع ", " says they paid "), fig(p.amount, cur),
                        p.payType && h("span", { style: { fontWeight: 400, color: colors.textMuted, fontSize: T.small } }, p.payType === "full" ? tl(" — كامل المتبقّي", " — everything left") : tl(" — دفعة جزئيّة", " — part payment"))),
                    h("div", { style: { fontSize: T.small, color: colors.textMuted, marginTop: 4, lineHeight: 1.6 } },
                        dayLabel(p.at), acct ? [tl("، إلى ", ", to "), h("bdi", { key: "a", style: { whiteSpace: "nowrap" } }, (acct.bankName || acct.provider || acct.label) + " " + (acct.number || "").slice(-4))] : null,
                        p.reference ? [tl("، المرجع ", ", reference "), h("bdi", { key: "r", style: { whiteSpace: "nowrap" } }, p.reference)] : null, p.payer && p.payer.phone ? [tl("، هاتفه ", ", phone "), h("bdi", { key: "p", style: { whiteSpace: "nowrap" } }, p.payer.phone)] : null),
                    h("p", { style: { fontSize: T.tiny, color: colors.textMuted, margin: "6px 0 8px" } }, tl("تأكّد أنّ المبلغ وصل حسابك قبل التأكيد.", "Check the money reached your account before confirming.")),
                    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                        p.hasProof && h(Btn, { kind: "ghost", disabled: busy, onClick: () => call("inv.claim.proof", { id, payId: p.id }).then((r) => {
                            if (!r.data) return;
                            // C287: a PDF receipt opens as a file (an <img> cannot show it)
                            if (/^data:application\/pdf;/.test(r.data)) saveFileOut(pdfBlob(r.data.split(",")[1]), (r.name && /\.pdf$/i.test(r.name) ? r.name : "receipt-" + (inv.number || "invoice") + ".pdf").replace(/[\\/:*?"<>|]+/g, "-"), "application/pdf");
                            else setProof(r.data); }, (e) => setErr(errText(e))), style: { minHeight: 44, padding: "6px 12px", fontSize: T.small } }, p.proofType === "application/pdf" ? tl("الإيصال (PDF)", "Receipt (PDF)") : tl("الإيصال", "Receipt")),
                        h(Btn, { kind: "danger", disabled: busy, onClick: async () => { const r = await ask({ text: tl("لم يصلك هذا الدفع؟", "This payment didn't arrive?"), confirmLabel: tl("لم يصل", "Not received"), danger: true,
                            input: { label: tl("السبب — يراه العميل لاحقاً", "Reason — the client sees it later") } }); if (r !== null) run(call("inv.claim.decide", { id, payId: p.id, decision: "reject", note: r || null })); }, style: { minHeight: 44, padding: "6px 12px", fontSize: T.small } }, tl("لم يصل", "Not received")),
                        h(Btn, { disabled: busy, onClick: async () => { let fx; if (cur !== base) { fx = await ask({ text: tl("وصل الدفع — أكّد الاستلام", "Payment received — confirm it"), confirmLabel: tl("تأكيد", "Confirm"),
                            input: { label: tl("سعر الصرف: ", "Exchange rate: ") + "\u2066" + `1 ${cur} = ? ${base}` + "\u2069" + tl(" — اتركه فارغاً لتضيفه لاحقاً", " — leave empty to add later"), decimal: true } }); if (fx === null) return; }
                            run(call("inv.claim.decide", { id, payId: p.id, decision: "confirm", fxRate: fx || undefined })); }, style: { flex: 1, minHeight: 44, fontSize: T.small } }, tl("وصل — أكّد", "Received — confirm")))); }),
            proof && h("div", { role: "dialog", "aria-modal": true, "aria-label": tl("الإيصال", "Receipt"), onClick: () => setProof(null), style: { position: "fixed", inset: 0, zIndex: 70, backgroundColor: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
                h("img", { src: proof, alt: tl("صورة الإيصال", "Receipt photo"), style: { maxWidth: "100%", maxHeight: "90vh", objectFit: "contain" } })),
            (inv.payments || []).filter((p) => p.state !== "claimed").length > 0 && h(Section, { title: tl("الدفعات", "Payments") },
                inv.payments.filter((p) => p.state !== "claimed").map((p, i) => h("div", { key: i, style: { display: "flex", fontSize: T.small, padding: "4px 0", color: p.state === "rejected" ? colors.textMuted : colors.text, textDecoration: p.state === "rejected" ? "line-through" : "none" } },
                    h("span", { style: { flex: 1 } }, dayLabel(p.at), " · ", tl({ cash: "نقداً", bank_transfer: "تحويل بنكيّ", mobile_money: "محفظة جوّال", other: "أخرى" }[p.method] || p.method, { cash: "Cash", bank_transfer: "Bank transfer", mobile_money: "Mobile money", other: "Other" }[p.method] || p.method)),
                    fig(p.amount, cur)))),
            payForm,
            msg && h("div", { role: "status", style: { color: colors.primary, fontSize: T.small, margin: "8px 0" } }, msg),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: T.small, margin: "8px 0" } }, err),
            h("div", { style: { display: "grid", gap: 8, marginTop: 16 } },
                st === "draft" && [
                    h(Btn, { key: "s", disabled: busy, onClick: async () => { if (await ask({ text: tl("ستأخذ الفاتورة رقماً ولن تُعدَّل بعد الإرسال. متابعة؟", "The invoice gets its number and can't be edited after sending. Continue?"), confirmLabel: tl("إرسال", "Send") })) run(call("inv.send", { id })); } }, tl("إرسال", "Send")),
                    h(Btn, { key: "e", kind: "ghost", onClick: () => onEdit(inv) }, tl("تعديل", "Edit"))],
                (st === "sent" || st === "overdue") && !pay && h(Btn, { onClick: () => setPay({ amount: minorToText(t0.amountDue, cur), method: "bank_transfer", date: today, reference: "", fxRate: "", key: newKey() }) }, tl("تسجيل دفعة", "Record a payment")),
                h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                    h(Btn, { kind: "ghost", disabled: busy || pdfBusy, onClick: doPdf, style: { flex: 1 } }, pdfBusy ? tl("جارٍ تجهيز PDF…", "Making the PDF…") : tl("تنزيل PDF", "Download PDF")),
                    !inApp() && h(Btn, { kind: "ghost", disabled: busy, onClick: doPrint, style: { flex: 1 } }, tl("طباعة", "Print")),
                    st !== "draft" && st !== "cancelled" && h(Btn, { kind: "ghost", onClick: doShare, style: { flex: 1 } }, tl("مشاركة", "Share"))),
                (st === "sent" || st === "overdue") && h(Btn, { kind: "ghost", onClick: () => withLink().then((iv) => { if (!iv.payLinkToken) { setErr(tl("تعذّر تجهيز رابط الدفع. أعد المحاولة.", "Couldn't make the pay link. Try again.")); return; } const u = payLink(iv);
                    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => setMsg(tl("نُسخ رابط الدفع — يفتحه العميل دون حساب", "Pay link copied — the client opens it without an account")), () => setMsg(u)); }) }, tl("نسخ رابط الدفع", "Copy pay link")),
                st === "draft" && h(Btn, { kind: "danger", disabled: busy, onClick: async () => { if (await ask({ text: tl("حذف المسوّدة؟", "Delete this draft?"), confirmLabel: tl("حذف", "Delete"), danger: true })) run(call("inv.delete", { id }), () => onClose()); } }, tl("حذف المسوّدة", "Delete draft")),
                (st === "sent" || st === "overdue") && !(t0.amountPaid > 0) && !(inv.claimedAmount > 0) && h(Btn, { kind: "danger", disabled: busy, onClick: async () => { const r = await ask({ text: tl("إلغاء هذه الفاتورة؟", "Cancel this invoice?"), confirmLabel: tl("إلغاء الفاتورة", "Cancel invoice"), cancelLabel: tl("رجوع", "Back"), danger: true,
                    input: { label: tl("سبب الإلغاء", "Reason for cancelling") } }); if (r !== null) run(call("inv.cancel", { id, reason: r })); } }, tl("إلغاء الفاتورة", "Cancel invoice"))));
    }

    // CSV of the ledger (booked entries) for a range of budget months, saved as a file. The server builds the file.
    function ExportSheet({ month, latest, onClose }) {
        const { colors } = useTheme();
        const [to, setTo] = useState(month), [from, setFrom] = useState(shiftMonth(month, -11));
        const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [msg, setMsg] = useState("");
        const preset = (n) => { setTo(latest); setFrom(shiftMonth(latest, -n)); setMsg(""); };
        const go = () => {
            setBusy(true); setErr(""); setMsg("");
            call("pfm.export", { from, to, lang: ar() ? "ar" : "en" }).then((r) => {
                setBusy(false);
                if (!r.rows) { setMsg(tl("لا حركات في هذه الفترة", "No entries in this period")); return; }
                saveFileOut(new Blob([r.csv], { type: "text/csv;charset=utf-8" }), r.filename, "text/csv");
                setMsg(tl(`صُدِّرت ${r.rows} حركة في ${r.filename}`, `Exported ${r.rows} ${r.rows === 1 ? "entry" : "entries"} to ${r.filename}`) +
                    (r.truncated ? tl(" — الملفّ ناقص (أكثر من 5000 حركة)؛ اختر فترةً أقصر", " — the file is incomplete (over 5,000 entries); pick a shorter range") : ""));
            }, (e) => { setErr(errText(e)); setBusy(false); });
        };
        const monthInput = (value, set, label) => h(Field, { label }, h("input", { type: "month", dir: "ltr", value, max: latest, onChange: (e) => { if (e.target.value) { set(e.target.value); setMsg(""); } }, style: inputStyle(colors) }));
        return h(Sheet, { title: tl("تصدير السجلّ", "Export the ledger"), onClose },
            h("p", { style: { margin: "0 0 12px", fontSize: T.small, color: colors.textMuted, lineHeight: 1.6 } },
                tl("ملفّ CSV يفتح في Excel أو Google Sheets أو Numbers: التاريخ، النوع، الفئة، المبلغ وعملته، وقيمته بعملة التقارير، والطرف والملاحظة. الحركات المقترحة غير المؤكّدة لا تدخل.",
                    "A CSV file for Excel, Google Sheets or Numbers: date, type, category, amount and currency, the amount in your reporting currency, payee and note. Suggested entries you haven't confirmed are left out.")),
            h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 } },
                [[tl("هذا الشهر", "This month"), 0], [tl("آخر 3 أشهر", "Last 3 months"), 2], [tl("آخر 12 شهراً", "Last 12 months"), 11]].map(([label, n]) =>
                    h(Btn, { key: n, kind: from === shiftMonth(latest, -n) && to === latest ? undefined : "ghost", onClick: () => preset(n), style: { minHeight: 44, padding: "6px 12px", fontSize: 13 } }, label))),
            h("div", { style: { display: "flex", gap: 8 } },
                h("div", { style: { flex: 1 } }, monthInput(from, setFrom, tl("من", "From"))),
                h("div", { style: { flex: 1 } }, monthInput(to, setTo, tl("إلى", "To")))),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, err),
            msg && h("div", { role: "status", style: { color: colors.textMuted, fontSize: 13, marginBottom: 10 } }, msg),
            h(Btn, { onClick: go, disabled: busy || !from || !to, style: { width: "100%" } }, busy ? tl("جارٍ التجهيز…", "Preparing…") : tl("تنزيل CSV", "Download CSV")));
    }

    // Business details: identity on the invoice, logo, tax, numbering, defaults and receiving accounts.
    // Logo: ≤ 512 px WebP (PNG fallback). Receipt (jpeg = true): ≤ 1280 px JPEG on white, quality stepped down until it fits 400 KB.
    function shrinkImage(file, max, jpeg) {
        max = max || 512;
        return new Promise((resolve, reject) => {
            const img = document.createElement("img"), url = URL.createObjectURL(file);   // not new Image(): app.p1 defines Image as an icon component
            img.onload = () => { URL.revokeObjectURL(url);
                const draw = (px) => { const k = Math.min(1, px / Math.max(img.width, img.height)), c = document.createElement("canvas");
                    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); const g = c.getContext("2d");
                    if (jpeg) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); } g.drawImage(img, 0, 0, c.width, c.height); return c; };
                if (!jpeg) { const c = draw(max); let d = c.toDataURL("image/webp", 0.85); if (d.indexOf("data:image/webp") !== 0) d = c.toDataURL("image/png"); return resolve(d); }
                const fits = (d) => (d.length - d.indexOf(",") - 1) * 0.75 <= 400 * 1024;
                for (const px of [max, 960, 720]) { const c = draw(px); for (const q of [0.82, 0.68, 0.55]) { const d = c.toDataURL("image/jpeg", q); if (fits(d)) return resolve(d); } }
                reject(new Error("bad_receipt")); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(jpeg ? "bad_receipt" : "bad_logo")); };
            img.src = url;
        });
    }
    // Full-screen photo; a tap closes it.
    const PhotoView = ({ src, onClose }) => h("div", { role: "dialog", "aria-modal": true, "aria-label": tl("الإيصال", "Receipt"), onClick: onClose,
        style: { position: "fixed", inset: 0, zIndex: 70, backgroundColor: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        h("img", { src, alt: tl("صورة الإيصال", "Receipt photo"), style: { maxWidth: "100%", maxHeight: "90vh", objectFit: "contain" } }));
    function BizSheet({ base, onClose, onSaved }) {
        const { colors } = useTheme();
        const [b, setB] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [acct, setAcct] = useState(null);
        const load = () => call("pfm.biz.get").then((r) => { setB(r); setForm((f) => f || Object.assign({}, r.biz, { taxRates: (r.biz.taxRates || []).map((x) => Object.assign({}, x)) })); }, (e) => setErr(errText(e)));
        useEffect(() => { load(); }, []);
        if (!b || !form) return h(Sheet, { title: tl("بيانات النشاط", "Business details"), onClose }, err ? h("div", { role: "alert", style: { color: colors.danger } }, err) : h(Loading));
        const set = (k, v) => setForm(Object.assign({}, form, { [k]: v }));
        const curs = currencyList();
        // C288: the user's own Sawa code (from the contacts module) fills "Sawa ID" with one tap.
        let myCode = null; try { const me = window.SawaChat && window.SawaChat.me && window.SawaChat.me(); myCode = me && /^\d{10}$/.test(String(me.code || "")) ? String(me.code) : null; } catch (e) { }
        const save = () => { setBusy(true); setErr("");
            call("pfm.biz.set", { name: form.name, contact: form.contact, address: form.address, phone: form.phone || "", sawaId: (form.sawaId || "").trim(), taxId: form.taxId, taxRegistered: form.taxRegistered, taxLabel: form.taxLabel,
                taxRates: form.taxRates.filter((r) => r.rate !== ""), defaultTaxRateId: form.defaultTaxRateId, invoicePrefix: (form.invoicePrefix || "INV").toUpperCase(),
                defaultDueDays: Number(form.defaultDueDays) || 0, defaultAllowPartial: form.defaultAllowPartial, defaultInvoiceCurrency: form.defaultInvoiceCurrency,
                defaultPayoutAccountIds: (b.accounts || []).filter((a) => !a.archived).map((a) => a.id), lang: form.lang })
                .then(() => { setBusy(false); onSaved(); }, (e) => { setErr(errText(e)); setBusy(false); }); };
        const pickLogo = (e) => { const f0 = e.target.files && e.target.files[0]; if (!f0) return; setBusy(true); setErr("");
            shrinkImage(f0).then((data) => call("pfm.logo.set", { data })).then(load).then(() => setBusy(false), (er) => { setErr(errText(er)); setBusy(false); }); };
        const inp = (k, label, extra) => h(Field, { label }, h("input", Object.assign({ dir: "auto", value: form[k] || "", onChange: (e) => set(k, e.target.value), style: inputStyle(colors) }, extra || {})));
        return h(Sheet, { title: tl("بيانات النشاط", "Business details"), onClose },
            h("p", { style: { margin: "0 0 14px", fontSize: T.small, color: colors.textMuted, lineHeight: 1.6 } }, tl("تظهر على كلّ فاتورة تصدرها. العنوان والرقم الضريبيّ يُحفظان مشفّرين.", "Shown on every invoice you send. The address and tax ID are stored encrypted.")),
            h(Field, { label: tl("الشعار", "Logo"), group: true },
                h("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
                    b.logo ? h("img", { src: b.logo, alt: tl("الشعار الحاليّ", "Current logo"), style: { maxHeight: 56, maxWidth: 140, objectFit: "contain", border: "1px solid " + colors.border, borderRadius: 8, padding: 4, backgroundColor: "#fff" } })
                        : h("span", { style: { fontSize: T.small, color: colors.textMuted } }, tl("بلا شعار", "No logo")),
                    h("label", { style: { minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 12, border: "1px solid " + colors.border, cursor: "pointer", fontWeight: 700, fontSize: T.small } },
                        b.logo ? tl("تغيير", "Change") : tl("اختر صورة", "Choose image"), h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", onChange: pickLogo, style: { display: "none" } })),
                    b.logo && h("button", { type: "button", onClick: () => call("pfm.logo.delete").then(load), style: { border: 0, background: "none", color: colors.danger, fontWeight: 700, minHeight: 44, cursor: "pointer" } }, tl("إزالة", "Remove")))),
            inp("name", tl("اسم النشاط", "Business name"), { maxLength: 80 }),
            inp("phone", tl("الهاتف", "Phone"), { dir: "ltr", type: "tel", inputMode: "tel", maxLength: 30, placeholder: "+249…", style: Object.assign(inputStyle(colors), { textAlign: ar() ? "right" : "left" }) }),
            inp("contact", tl("البريد الإلكترونيّ (اختياريّ)", "Email (optional)"), { maxLength: 120 }),
            inp("address", tl("العنوان", "Address"), { maxLength: 200 }),
            h(Field, { label: tl("رمز سوا", "Sawa ID"), hint: tl("يظهر على الفاتورة ليصل إليك العميل في سوا", "Shown on the invoice so the client can reach you on Sawa") },
                h("div", { style: { display: "flex", gap: 8 } },
                    h("input", { dir: "ltr", inputMode: "numeric", value: form.sawaId || "", maxLength: 14, placeholder: "136-860-8541", "aria-label": tl("رمز سوا", "Sawa ID"), onChange: (e) => set("sawaId", e.target.value.replace(/[^\d-]/g, "")), style: Object.assign(inputStyle(colors), { flex: 1, textAlign: ar() ? "right" : "left" }) }),
                    myCode && myCode !== String(form.sawaId || "").replace(/\D/g, "") && h("button", { type: "button", onClick: () => set("sawaId", myCode), style: { minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid " + colors.border, background: "none", color: tealInk(), fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" } }, tl("رمزي", "My code")))),
            h(Check, { checked: form.taxRegistered, onChange: (v) => set("taxRegistered", v) }, tl("أفرض ضريبة على فواتيري", "I charge tax on my invoices")),
            form.taxRegistered && h("div", { style: { paddingInlineStart: 30, marginBottom: 8 } },
                inp("taxId", tl("رقمي الضريبيّ", "My tax ID"), { dir: "ltr", maxLength: 40 }),
                inp("taxLabel", tl("اسم الضريبة كما يظهر على الفاتورة", "Tax name as shown on the invoice"), { maxLength: 24, placeholder: tl("مثلاً: ضريبة القيمة المضافة", "e.g. VAT, GST, TVA") }),
                h(Field, { label: tl("نِسَبي المحفوظة (تكتبها بنفسك)", "My saved rates (you type them)"), group: true },
                    form.taxRates.map((r, i) => h("div", { key: r.id || i, style: { display: "flex", gap: 6, marginBottom: 6 } },
                        h("input", { dir: "auto", value: r.label, maxLength: 24, placeholder: tl("الاسم", "Name"), "aria-label": tl("اسم النسبة", "Rate name"), onChange: (e) => set("taxRates", form.taxRates.map((x, j) => (j === i ? Object.assign({}, x, { label: e.target.value }) : x))), style: Object.assign(inputStyle(colors), { flex: 1 }) }),
                        h("input", { dir: "ltr", inputMode: "decimal", value: r.rate, placeholder: "%", "aria-label": tl("النسبة", "Rate"), onChange: (e) => set("taxRates", form.taxRates.map((x, j) => (j === i ? Object.assign({}, x, { rate: numIn(e.target.value) }) : x))), style: Object.assign(inputStyle(colors), { width: 90 }) }),
                        h("label", { style: { display: "flex", alignItems: "center", gap: 4, fontSize: T.tiny } }, h("input", { type: "radio", name: "deftax", checked: form.defaultTaxRateId === r.id, onChange: () => set("defaultTaxRateId", r.id) }), tl("افتراضيّة", "Default")),
                        h("button", { type: "button", "aria-label": tl("حذف", "Remove"), onClick: () => set("taxRates", form.taxRates.filter((_, j) => j !== i)), style: { width: 40, border: 0, background: "none", color: colors.textMuted, cursor: "pointer" } }, h(X, { size: 16 })))),
                    h("button", { type: "button", onClick: () => set("taxRates", form.taxRates.concat({ id: "r" + Date.now().toString(36), label: "", rate: "" })), style: { minHeight: 44, border: 0, background: "none", color: tealInk(), fontWeight: 700, cursor: "pointer", padding: 0 } }, "＋ " + tl("نسبة", "Rate")))),
            h("div", { style: { display: "flex", gap: 8 } },
                h("div", { style: { flex: 1 } }, inp("invoicePrefix", tl("بادئة رقم الفاتورة", "Invoice number prefix"), { dir: "ltr", maxLength: 8, onChange: (e) => set("invoicePrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")) })),
                h("div", { style: { flex: 1 } }, h(Field, { label: tl("الاستحقاق بعد (أيّام)", "Due after (days)") }, h("input", { dir: "ltr", inputMode: "numeric", value: String(form.defaultDueDays), onChange: (e) => set("defaultDueDays", e.target.value.replace(/[^0-9]/g, "")), style: inputStyle(colors) })))),
            h("p", { style: { margin: "-6px 0 12px", fontSize: T.tiny, color: colors.textMuted } }, tl("الرقم القادم: ", "Next number: "), h("bdi", null, b.nextNumber), tl(" — يبدأ من 0001 كلّ سنة", " — starts again at 0001 each year")),
            h(Field, { label: tl("عملة الفواتير الافتراضيّة", "Default invoice currency") }, h("select", { value: form.defaultInvoiceCurrency || base, onChange: (e) => set("defaultInvoiceCurrency", e.target.value), style: inputStyle(colors) }, curs.map((c) => h("option", { key: c.code, value: c.code }, c.label)))),
            h(Check, { checked: form.defaultAllowPartial !== false, onChange: (v) => set("defaultAllowPartial", v) }, tl("أسمح بالدفع على دفعات افتراضيّاً", "Allow paying in parts by default")),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: T.small, marginBottom: 8 } }, err),
            h(Btn, { onClick: save, disabled: busy, style: { width: "100%" } }, busy ? tl("جارٍ الحفظ…", "Saving…") : tl("حفظ بيانات النشاط", "Save business details")),
            h(Section, { title: tl("حسابات الاستلام", "Receiving accounts"), action: !acct && linkBtn("＋ " + tl("حساب", "Account"), () => setAcct({ type: "bank", currency: base, label: "", holderName: form.name || "", bankName: "", provider: "", number: "", branch: "", details: "" })) },
                h("p", { style: { margin: "0 0 10px", fontSize: T.small, color: colors.textMuted, lineHeight: 1.6 } }, tl("تظهر على الفاتورة حين تختارها. الأرقام مشفّرة، ونُعلمك إن تغيّر رقم حساب.", "Shown on an invoice when you pick them. Numbers are encrypted, and you're told if a number changes.")),
                (b.accounts || []).map((a) => h("div", { key: a.id, style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid " + colors.border, opacity: a.archived ? 0.5 : 1 } },
                    h("span", { style: { flex: 1, fontSize: T.body } }, h("b", null, a.bankName || a.provider || a.label), " ", h("bdi", { style: { color: colors.textMuted } }, a.number), " ", h("span", { style: { fontSize: T.tiny, color: colors.textMuted } }, a.currency === "ANY" ? "" : a.currency)),
                    h("button", { type: "button", onClick: () => call("pfm.account.archive", { id: a.id, archived: !a.archived }).then(load, (e) => setErr(errText(e))), style: { border: 0, background: "none", color: tealInk(), fontWeight: 700, minHeight: 44, cursor: "pointer" } }, a.archived ? tl("إعادة", "Restore") : tl("إخفاء", "Hide")))),
                acct && h("div", { style: { padding: "10px 0" } },
                    h(Seg, { value: acct.type, onChange: (v) => setAcct(Object.assign({}, acct, { type: v })), options: [{ value: "bank", label: tl("بنك", "Bank") }, { value: "mobile_money", label: tl("محفظة جوّال", "Mobile money") }, { value: "other", label: tl("أخرى", "Other") }] }),
                    h("div", { style: { height: 10 } }),
                    acct.type === "bank" && h(Field, { label: tl("اسم البنك", "Bank name") }, h("input", { dir: "auto", value: acct.bankName, onChange: (e) => setAcct(Object.assign({}, acct, { bankName: e.target.value })), style: inputStyle(colors) })),
                    acct.type === "mobile_money" && h(Field, { label: tl("المزوّد", "Provider") }, h("input", { dir: "auto", value: acct.provider, placeholder: "M-Pesa, STC Pay, Bankak…", onChange: (e) => setAcct(Object.assign({}, acct, { provider: e.target.value })), style: inputStyle(colors) })),
                    h(Field, { label: tl("اسم مختصر لك", "A short name for you") }, h("input", { dir: "auto", value: acct.label, maxLength: 40, onChange: (e) => setAcct(Object.assign({}, acct, { label: e.target.value })), style: inputStyle(colors) })),
                    acct.type !== "other" && h(Field, { label: tl("اسم صاحب الحساب", "Account holder") }, h("input", { dir: "auto", value: acct.holderName, maxLength: 80, onChange: (e) => setAcct(Object.assign({}, acct, { holderName: e.target.value })), style: inputStyle(colors) })),
                    acct.type !== "other" && h(Field, { label: acct.type === "bank" ? tl("رقم الحساب أو الآيبان", "Account number or IBAN") : tl("رقم الهاتف", "Phone number") }, h("input", { dir: "ltr", value: acct.number, onChange: (e) => setAcct(Object.assign({}, acct, { number: e.target.value })), style: inputStyle(colors) })),
                    acct.type === "bank" && h(Field, { label: tl("الفرع أو SWIFT (اختياريّ)", "Branch or SWIFT (optional)") }, h("input", { dir: "auto", value: acct.branch, onChange: (e) => setAcct(Object.assign({}, acct, { branch: e.target.value })), style: inputStyle(colors) })),
                    acct.type === "other" && h(Field, { label: tl("التفاصيل", "Details") }, h("textarea", { dir: "auto", rows: 2, value: acct.details, maxLength: 200, onChange: (e) => setAcct(Object.assign({}, acct, { details: e.target.value })), style: inputStyle(colors) })),
                    h(Field, { label: tl("العملة التي يستقبلها", "Currency it receives") }, h("select", { value: acct.currency, onChange: (e) => setAcct(Object.assign({}, acct, { currency: e.target.value })), style: inputStyle(colors) },
                        [h("option", { key: "ANY", value: "ANY" }, tl("أيّ عملة", "Any currency"))].concat(curs.map((c) => h("option", { key: c.code, value: c.code }, c.label))))),
                    h("div", { style: { display: "flex", gap: 8 } },
                        h(Btn, { kind: "ghost", onClick: () => setAcct(null) }, tl("إلغاء", "Cancel")),
                        h(Btn, { style: { flex: 1 }, disabled: busy, onClick: () => { setBusy(true); setErr("");
                            call("pfm.account.upsert", Object.assign({}, acct, { label: acct.label || acct.bankName || acct.provider || tl("حساب", "Account") })).then(() => { setAcct(null); setBusy(false); return load(); }, (e) => { setErr(errText(e)); setBusy(false); }); } }, tl("إضافة الحساب", "Add account"))))));
    }

    // ── P6c: المشاريع (PROJECTS.md). Shared projects: list, create, join by invite, estimate, ledger, charts, people.
    // Every number comes from pfm.proj.* on the server; the screen only shows it and sends inputs.
    const PJ_TEMPLATES = [["house_construction", "بناء منزل", "House construction"], ["event", "فعالية", "Event"], ["small_business", "نشاط تجاري صغير", "Small business"], ["agri_season", "موسم زراعي", "Agricultural season"], ["custom", "مخصّص", "Custom"]];
    const PJ_BOQ = [["raw_materials", "مواد خام", "Raw materials"], ["labor", "عمالة", "Labour"], ["equipment_rental", "تأجير معدّات", "Equipment rental"], ["permits", "تصاريح", "Permits"], ["other", "أخرى", "Other"]];
    const PJ_KINDS = [["expense", "مصروف", "Expense"], ["revenue", "إيراد", "Revenue"], ["capital_injection", "رأس مال", "Capital"], ["partner_contribution", "مساهمة شريك", "Partner"], ["grant", "منحة", "Grant"], ["loan_draw", "قرض مستلم", "Loan received"], ["loan_repayment", "سداد قرض", "Loan repayment"]];
    const PJ_INFLOW = ["revenue", "capital_injection", "partner_contribution", "grant", "loan_draw"];
    const PJ_STATUS = [["planning", "قيد التخطيط", "Planning"], ["active", "نشط", "Active"], ["on_hold", "متوقّف", "On hold"], ["completed", "مكتمل", "Completed"], ["archived", "مؤرشف", "Archived"]];
    const PJ_HEALTH = { green: ["#15803d", "ضمن الميزانيّة", "On budget"], amber: ["#b45309", "يقترب من الحدّ", "Approaching budget"], red: ["#b91c1c", "تجاوز الميزانيّة", "Over budget"] };
    const PJ_LINE = { on_budget: ["#15803d", "ضمن التقدير", "On estimate"], warning: ["#b45309", "فوق التقدير", "Above estimate"], over_budget: ["#b91c1c", "تجاوز التسامح", "Over tolerance"], not_started: ["#64748b", "لم يبدأ", "Not started"] };
    const pjName = (list, v) => { const r = list.find((x) => x[0] === v); return r ? tl(r[1], r[2]) : v; };
    const pjHealthText = (st) => { const t = PJ_HEALTH[st] || PJ_HEALTH.green; return tl(t[1], t[2]); };
    const pjBarFill = (bp) => Math.max(0, Math.min(100, bp / 100));
    const pjPeople = { owner: ["المالك", "Owner"], editor: ["محرّر", "Editor"], viewer: ["مشاهد", "Viewer"] };
    const pjLineKey = () => "l" + newKey().replace(/-/g, "").slice(0, 14);
    const pjMinor = (m, cur) => (m == null ? "" : String(m / Math.pow(10, expOf(cur))));

    function PjBar({ bp, color }) {
        const { colors } = useTheme();
        return h("div", { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(pjBarFill(bp)), style: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" } },
            h("div", { style: { width: pjBarFill(bp) + "%", height: "100%", backgroundColor: color } }));
    }
    function PjPill({ st }) {
        const t = PJ_HEALTH[st] || PJ_HEALTH.green;
        return h("span", { style: { display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, color: "#fff", backgroundColor: t[0] } }, pjHealthText(st));
    }
    const pjSelect = (colors, value, onChange, options, label) => h("select", { "aria-label": label, value, onChange: (e) => onChange(e.target.value), style: inputStyle(colors) },
        options.map((o) => h("option", { key: o[0], value: o[0] }, o[1])));

    // ── list, create, join ──
    function ProjectsView({ base, today, cats }) {
        const { colors } = useTheme();
        const [items, setItems] = useState(null), [err, setErr] = useState(""), [mode, setMode] = useState({ k: "list" });
        const load = useCallback(() => { setErr(""); call("pfm.proj.list").then((r) => setItems(r.items), (e) => setErr(errText(e))); }, []);
        useEffect(load, [load]);
        const back = () => { setMode({ k: "list" }); load(); };
        if (mode.k === "new") return h(ProjectNew, { base, today, onDone: (pid) => setMode({ k: "detail", pid }), onBack: back });
        if (mode.k === "join") return h(ProjectJoin, { onDone: (pid) => setMode({ k: "detail", pid }), onBack: back });
        if (mode.k === "detail") return h(ProjectDetail, { key: mode.pid, pid: mode.pid, today, cats, base, onBack: back });
        return h("div", { style: { padding: 16, paddingBottom: 96 } },
            h("div", { style: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" } },
                h(Btn, { onClick: () => setMode({ k: "new" }) }, tl("مشروع جديد", "New project")),
                h(Btn, { kind: "ghost", onClick: () => setMode({ k: "join" }) }, tl("انضمام بدعوة", "Join with invite"))),
            err && h(Card, { style: { marginBottom: 12 } }, h("div", { role: "alert", style: { color: colors.danger, fontSize: 14 } }, err), h(Btn, { kind: "ghost", onClick: load, style: { marginTop: 8 } }, tl("إعادة المحاولة", "Try again"))),
            !items && !err && h(Loading),
            items && items.length === 0 && h(Card, null, h("div", { style: { color: colors.textMuted, fontSize: 14, textAlign: "center", padding: 12 } },
                tl("لا توجد مشاريع بعد. أنشئ مشروعاً أو انضمّ بدعوة.", "No projects yet. Create one or join with an invite."))),
            items && items.map((p) => {
                const spent = p.health ? p.health.actualSpend : 0, target = p.targetBudget;
                return h("button", { key: p.id, type: "button", onClick: () => setMode({ k: "detail", pid: p.id }), style: { display: "block", width: "100%", textAlign: "start", cursor: "pointer",
                    backgroundColor: colors.card, color: colors.text, border: "1px solid " + colors.border, borderRadius: 16, padding: 14, marginBottom: 10 } },
                    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 } },
                        h("div", { style: { fontWeight: 800, fontSize: 16 } }, p.name),
                        p.health && h(PjPill, { st: p.health.status })),
                    h("div", { style: { fontSize: 12, color: colors.textMuted, marginBottom: 8 } }, tl("دورك: ", "Your role: ") + (pjPeople[p.role] ? tl(pjPeople[p.role][0], pjPeople[p.role][1]) : p.role)),
                    p.health && h(PjBar, { bp: p.health.utilizationBp, color: (PJ_HEALTH[p.health.status] || PJ_HEALTH.green)[0] }),
                    h("div", { style: { fontSize: 13, marginTop: 6 } }, money(spent, p.currency) + " / " + money(target, p.currency)));
            }));
    }

    function ProjectNew({ base, today, onDone, onBack }) {
        const { colors } = useTheme();
        const [f, setF] = useState({ name: "", template: "house_construction", currency: base || "SDG", targetBudget: "", startDate: today || "", endDate: "", description: "", displayName: "" });
        const [busy, setBusy] = useState(false), [err, setErr] = useState("");
        const key = useRef(newKey());
        const set = (k) => (v) => setF((x) => Object.assign({}, x, { [k]: v }));
        const save = () => {
            if (busy) return;
            setBusy(true); setErr("");
            const body = Object.assign({ idemKey: key.current }, f);
            ["endDate", "startDate", "description", "displayName"].forEach((k) => { if (!body[k]) delete body[k]; });
            call("pfm.proj.create", body).then((r) => onDone(r.project.id), (e) => { setErr(errText(e)); setBusy(false); });
        };
        return h("div", { style: { padding: 16, paddingBottom: 96 } },
            h(Card, null,
                h(Field, { label: tl("اسم المشروع", "Project name") }, h("input", { value: f.name, maxLength: 120, onChange: (e) => set("name")(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("النوع", "Type") }, pjSelect(colors, f.template, set("template"), PJ_TEMPLATES.map((t) => [t[0], tl(t[1], t[2])]), tl("النوع", "Type"))),
                h(Field, { label: tl("العملة (ثابتة بعد الإنشاء)", "Currency (fixed once created)") }, pjSelect(colors, f.currency, set("currency"), CURS.map((c) => [c, c]), tl("العملة", "Currency"))),
                h(Field, { label: tl("الميزانيّة المستهدفة", "Target budget") }, h("input", { inputMode: "decimal", value: f.targetBudget, onChange: (e) => set("targetBudget")(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("تاريخ البداية", "Start date") }, h("input", { type: "date", value: f.startDate, onChange: (e) => set("startDate")(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("تاريخ النهاية (اختياري)", "End date (optional)") }, h("input", { type: "date", value: f.endDate, onChange: (e) => set("endDate")(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("وصف (اختياري)", "Description (optional)") }, h("input", { value: f.description, maxLength: 500, onChange: (e) => set("description")(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("اسمك في المشروع (اختياري)", "Your name on the project (optional)") }, h("input", { value: f.displayName, maxLength: 40, onChange: (e) => set("displayName")(e.target.value), style: inputStyle(colors) }))),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, margin: "12px 0" } }, err),
            h("div", { style: { display: "flex", gap: 8, marginTop: 12 } },
                h(Btn, { kind: "ghost", onClick: onBack }, tl("إلغاء", "Cancel")),
                h(Btn, { onClick: save, disabled: busy || !f.name.trim() || !f.targetBudget.trim() }, tl("إنشاء المشروع", "Create project"))));
    }

    function ProjectJoin({ onDone, onBack }) {
        const { colors } = useTheme();
        const [token, setToken] = useState(""), [name, setName] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
        const join = () => {
            if (busy) return;
            setBusy(true); setErr("");
            call("pfm.proj.invite.accept", { token: token.trim(), displayName: name.trim() || undefined }).then((r) => onDone(r.project.id), (e) => { setErr(errText(e)); setBusy(false); });
        };
        return h("div", { style: { padding: 16 } },
            h(Card, null,
                h(Field, { label: tl("رمز الدعوة", "Invite code") }, h("input", { value: token, autoCapitalize: "none", onChange: (e) => setToken(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("اسمك في المشروع (اختياري)", "Your name on the project (optional)") }, h("input", { value: name, maxLength: 40, onChange: (e) => setName(e.target.value), style: inputStyle(colors) }))),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, margin: "12px 0" } }, err),
            h("div", { style: { display: "flex", gap: 8, marginTop: 12 } },
                h(Btn, { kind: "ghost", onClick: onBack }, tl("إلغاء", "Cancel")),
                h(Btn, { onClick: join, disabled: busy || !token.trim() }, tl("انضمام", "Join"))));
    }

    // ── one project: overview (budget, charts, alerts), estimate, ledger, people ──
    function ProjectDetail({ pid, today, cats, base, onBack }) {
        const { colors } = useTheme();
        const [g, setG] = useState(null), [ch, setCh] = useState(null), [base0, setBase0] = useState(null), [al, setAl] = useState([]), [mem, setMem] = useState(null), [txs, setTxs] = useState(null);
        const [tab, setTab] = useState("overview"), [err, setErr] = useState(""), [sheet, setSheet] = useState(null), [busy, setBusy] = useState(false);
        const reload = useCallback(() => {
            setErr("");
            call("pfm.proj.get", { pid }).then(setG, (e) => setErr(errText(e)));
            call("pfm.proj.charts", { pid }).then(setCh, () => {});
            call("pfm.proj.variance", { pid }).then(setBase0, () => setBase0({ lines: [] }));
            call("pfm.proj.alerts.list", { pid, unacknowledged: true }).then((r) => setAl(r.items), () => setAl([]));
            call("pfm.proj.members.list", { pid }).then((r) => setMem(r.items), () => setMem([]));
            call("pfm.proj.tx.list", { pid }).then((r) => setTxs(r.items), () => setTxs([]));
        }, [pid]);
        useEffect(reload, [reload]);
        const act = (p) => { if (busy) return Promise.resolve(); setBusy(true); setErr(""); return p.then(() => { setBusy(false); reload(); }, (e) => { setBusy(false); setErr(errText(e)); }); };

        if (err && !g) return h("div", { style: { padding: 16 } }, h(Card, null, h("div", { role: "alert", style: { color: colors.danger, fontSize: 14 } }, err)), h(Btn, { kind: "ghost", onClick: onBack, style: { marginTop: 12 } }, tl("رجوع", "Back")));
        if (!g) return h(Loading);
        const p = g.project, role = g.role, canEdit = role !== "viewer", isOwner = role === "owner";
        const cur = p.currency, hl = g.health || {}, st = hl.status || "green";
        const title = (k) => h("div", { style: { fontWeight: 800, fontSize: 14, margin: "18px 0 8px" } }, k);
        const linesOfBase = (base0 && base0.lines) || [];

        const overview = h("div", null,
            h(Card, null,
                h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 } },
                    h("div", { style: { fontWeight: 800, fontSize: 16 } }, tl("الميزانيّة", "Budget")), h(PjPill, { st })),
                h(PjBar, { bp: hl.utilizationBp || 0, color: (PJ_HEALTH[st] || PJ_HEALTH.green)[0] }),
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 13 } },
                    h("div", null, tl("صُرف", "Spent"), h("div", { style: { fontWeight: 800 } }, money(hl.actualSpend || 0, cur))),
                    h("div", null, tl("المستهدف", "Target"), h("div", { style: { fontWeight: 800 } }, money(p.targetBudget, cur))),
                    h("div", null, tl("التوقّع عند الإتمام", "Forecast at completion"), h("div", { style: { fontWeight: 800 } }, money(hl.forecastAtCompletion || 0, cur))),
                    h("div", null, tl("الفرق عن الميزانيّة", "Versus budget"), h("div", { style: { fontWeight: 800, color: (hl.forecastVsBudget || 0) > 0 ? colors.danger : colors.text } }, money(hl.forecastVsBudget || 0, cur))),
                    h("div", null, tl("الرصيد النقدي", "Cash position"), h("div", { style: { fontWeight: 800 } }, money(hl.cashPosition || 0, cur))),
                    h("div", null, tl("الهامش", "Margin"), h("div", { style: { fontWeight: 800 } }, hl.marginBp == null ? "—" : pct(hl.marginBp))))),
            canEdit && h(Card, { style: { marginTop: 12 } },
                h(Field, { label: tl("الحالة", "Status") }, pjSelect(colors, p.status, (to) => act(call("pfm.proj.status", { pid, rev: p.rev, to })), PJ_STATUS.map((s) => [s[0], tl(s[1], s[2])]), tl("الحالة", "Status")))),
            title(tl("تصدير", "Export")),
            h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                h(Btn, { kind: "ghost", disabled: busy, onClick: () => { setBusy(true); pdfFromOp("pfm.proj.report.pdf", { pid, lang: ar() ? "ar" : "en" }).then(() => setBusy(false), (e) => { setBusy(false); setErr(e && e.html ? tl("تعذّر تجهيز ملفّ PDF. أعد المحاولة.", "Couldn't make the PDF. Try again.") : errText(e)); }); } },
                    tl("تقرير PDF", "PDF report")),
                h(Btn, { kind: "ghost", onClick: () => setSheet({ k: "files", target: { type: "project" }, title: tl("مرفقات المشروع", "Project attachments") }) }, tl("مرفقات المشروع", "Project attachments")),
                h(Btn, { kind: "ghost", onClick: () => call("pfm.proj.export", { pid, lang: ar() ? "ar" : "en" }).then((r) => saveFileOut(new Blob([r.csv], { type: "text/csv;charset=utf-8" }), r.filename, "text/csv"), (e) => setErr(errText(e))) },
                    tl("جدول CSV", "CSV spreadsheet"))),
            h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 6 } }, tl("التقرير ملفّ PDF جاهز للمشاركة. ملفّ CSV يفتح في Excel وGoogle Sheets.", "The report is a PDF ready to share. The CSV opens in Excel and Google Sheets.")),
            title(tl("الرسوم البيانية", "Charts")),
            ch && h(Card, null,
                h("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 8 } }, tl("التقدير مقابل الفعلي لكل فئة", "Estimate vs actual by category")),
                ch.byCategory.filter((c) => c.estimated || c.actual).map((c) => {
                    const max = Math.max(1, ...ch.byCategory.map((x) => Math.max(x.estimated, x.actual)));
                    return h("div", { key: c.category, style: { marginBottom: 10 } },
                        h("div", { style: { fontSize: 12, marginBottom: 4 } }, pjName(PJ_BOQ, c.category)),
                        h("div", { style: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginBottom: 3 } }, h("div", { title: tl("التقدير", "Estimate"), style: { width: (c.estimated / max * 100) + "%", height: "100%", borderRadius: 4, backgroundColor: "#94a3b8" } })),
                        h("div", { style: { height: 8, borderRadius: 4, backgroundColor: colors.border } }, h("div", { title: tl("الفعلي", "Actual"), style: { width: (c.actual / max * 100) + "%", height: "100%", borderRadius: 4, backgroundColor: c.actual > c.estimated ? "#b91c1c" : colors.primary } })),
                        h("div", { style: { fontSize: 11, color: colors.textMuted, marginTop: 2 } }, money(c.actual, cur) + " / " + money(c.estimated, cur)));
                }),
                h("div", { style: { display: "flex", gap: 12, fontSize: 11, color: colors.textMuted, marginTop: 4 } }, h("span", null, "■ ", tl("التقدير", "Estimate")), h("span", { style: { color: colors.primary } }, "■ ", tl("الفعلي", "Actual")))),
            ch && ch.byMonth.length > 0 && h(Card, { style: { marginTop: 12 } },
                h("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 8 } }, tl("المصروف والدخل شهراً بشهر", "Spend and inflows by month")),
                (() => { const max = Math.max(1, ...ch.byMonth.map((m) => Math.max(m.actual, m.inflow)));
                    return ch.byMonth.map((m) => h("div", { key: m.month, style: { display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 12 } },
                        h("div", { style: { color: colors.textMuted } }, m.month),
                        h("div", null,
                            h("div", { style: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginBottom: 3 } }, h("div", { style: { width: (m.inflow / max * 100) + "%", height: "100%", borderRadius: 4, backgroundColor: "#15803d" } })),
                            h("div", { style: { height: 8, borderRadius: 4, backgroundColor: colors.border } }, h("div", { style: { width: (m.actual / max * 100) + "%", height: "100%", borderRadius: 4, backgroundColor: "#b91c1c" } })))));
                })()),
            ch && ch.daily.length > 1 && h(Card, { style: { marginTop: 12 } },
                h("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 8 } }, tl("الرصيد التراكمي يوماً بيوم", "Running balance by day")),
                (() => { const bs = ch.daily.map((d) => d.balance), lo = Math.min(...bs), hi = Math.max(...bs), W = 300, H = 110, span = hi - lo || 1;
                    const pts = ch.daily.map((d, i) => [(i / (ch.daily.length - 1)) * W, H - ((d.balance - lo) / span) * H].join(",")).join(" ");
                    return h("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": tl("مخطّط الرصيد", "Balance chart"), style: { width: "100%", height: 130 } },
                        h("polyline", { points: pts, fill: "none", stroke: colors.primary, strokeWidth: 2.5, strokeLinejoin: "round" })); })(),
                h("div", { style: { fontSize: 11, color: colors.textMuted, marginTop: 4 } }, ch.daily[0].date + " → " + ch.daily[ch.daily.length - 1].date)),
            title(tl("التنبيهات", "Alerts")),
            al.length === 0 && h("div", { style: { fontSize: 13, color: colors.textMuted } }, tl("لا تنبيهات مفتوحة", "No open alerts")),
            al.map((a) => h(Card, { key: a.id, style: { marginBottom: 8 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" } },
                    h("div", { style: { fontSize: 13, fontWeight: 700, color: a.severity === "critical" ? colors.danger : colors.text } },
                        a.rule === "budget_threshold" ? tl("بلغ " + a.thresholdPct + "٪ من الميزانيّة", "Reached " + a.thresholdPct + "% of budget")
                            : a.rule === "forecast_overrun" ? tl("التوقّع يتجاوز الميزانيّة", "Forecast is over budget")
                            : tl("بند تجاوز تقديره", "A line is over its estimate")),
                    canEdit && h(Btn, { kind: "ghost", onClick: () => act(call("pfm.proj.alerts.ack", { pid, key: a.id })) }, tl("تمّ", "Done"))))));

        const draft = (g.estimates || []).find((e) => e.status === "draft");
        const estimate = h("div", null,
            title(tl("التقدير", "Estimate")),
            (g.estimates || []).map((e) => h("div", { key: e.id, style: { fontSize: 13, marginBottom: 6 } },
                tl("مراجعة ", "Revision ") + e.revision + " — " + ({ draft: tl("مسوّدة", "Draft"), baseline: tl("معتمد", "Approved"), superseded: tl("مستبدل", "Superseded") })[e.status] +
                " · " + (e.lineCount || 0) + " " + tl("بند", "lines") + " · " + money(e.total || 0, cur) + (e.reason ? " · " + e.reason : ""))),
            !draft && canEdit && h(EstimateStart, { hasBaseline: !!p.baselineEstimateId, pid, onStarted: reload, call, act }),
            draft && canEdit && h(EstimateEditor, { key: draft.id, pid, draft, cur, cats, onChanged: reload, call, act, today }),
            draft && !canEdit && h("div", { style: { fontSize: 13, color: colors.textMuted } }, tl("المسوّدة مفتوحة للتحرير من المحرّرين فقط.", "The draft is open to editors only.")),
            title(tl("البنود المعتمدة والفعلي", "Approved lines and actual")),
            linesOfBase.length === 0 && h("div", { style: { fontSize: 13, color: colors.textMuted } }, tl("لم يُعتمد تقدير بعد.", "No approved estimate yet.")),
            linesOfBase.map((l) => h(Card, { key: l.lineKey, style: { marginBottom: 8 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" } },
                    h("div", { style: { fontWeight: 700, fontSize: 14 } }, l.name),
                    h("span", { style: { fontSize: 11, fontWeight: 800, color: (PJ_LINE[l.status] || PJ_LINE.not_started)[0] } }, tl(PJ_LINE[l.status][1], PJ_LINE[l.status][2]))),
                h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 4 } }, l.estQty + " " + (l.unit || "") + " × " + money(l.estUnitPrice, cur) + " = " + money(l.estTotal, cur)),
                l.priceDate && h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 2 } }, tl("السعر بتاريخ ", "Price as of ") + pjDay(l.priceDate) + (l.supplier ? " · " + l.supplier : "")),
                h("div", { style: { fontSize: 12, marginTop: 2 } }, tl("الفعلي: ", "Actual: ") + l.actualQty + " · " + money(l.actualCost, cur) + " · " + tl("انحراف ", "variance ") + money(l.totalVariance, cur)),
                h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 } },
                    h(Btn, { kind: "ghost", style: pjSmallBtn, onClick: () => setSheet({ k: "prices", lineKey: l.lineKey, name: l.name }) }, tl("سجلّ الأسعار", "Price history")),
                    h(Btn, { kind: "ghost", style: pjSmallBtn, onClick: () => setSheet({ k: "files", target: { type: "line", estimateId: base0.estimateId, lineKey: l.lineKey }, title: l.name }) },
                        tl("المرفقات", "Attachments") + (l.files ? " (" + l.files + ")" : ""))))));

        const ledger = h("div", null,
            canEdit && h(Btn, { onClick: () => setSheet({ k: "entry" }), style: { marginBottom: 12 } }, tl("حركة جديدة", "New entry")),
            !txs && h(Loading),
            txs && txs.length === 0 && h("div", { style: { fontSize: 13, color: colors.textMuted } }, tl("لا حركات بعد.", "No entries yet.")),
            txs && txs.map((t) => {
                const inflow = PJ_INFLOW.includes(t.kind), voided = t.status === "voided";
                return h(Card, { key: t.id, style: { marginBottom: 8, opacity: voided ? 0.55 : 1 } },
                    h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8 } },
                        h("div", { style: { fontWeight: 700, fontSize: 14, textDecoration: voided ? "line-through" : "none" } }, t.description || pjName(PJ_KINDS, t.kind)),
                        h("div", { style: { fontWeight: 800, fontSize: 14, color: inflow ? "#15803d" : colors.text, whiteSpace: "nowrap" } }, (inflow ? "+" : "−") + money(t.amount, cur))),
                    h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 4 } },
                        t.occurredOn + " · " + pjName(PJ_KINDS, t.kind) + (t.lineKey ? " · " + ((linesOfBase.find((l) => l.lineKey === t.lineKey) || {}).name || "") : t.category ? " · " + pjName(PJ_BOQ, t.category) : "") +
                        (t.originalCurrency && t.originalCurrency !== cur ? " · " + t.originalAmount / Math.pow(10, expOf(t.originalCurrency)) + " " + t.originalCurrency : "") +
                        (t.counterparty ? " · " + t.counterparty : "") + (t.unitPrice != null ? " · " + money(t.unitPrice, cur) + tl(" للوحدة", " a unit") : "")),
                    h(Btn, { kind: "ghost", style: Object.assign({ marginTop: 8, marginInlineEnd: 8 }, pjSmallBtn), onClick: () => setSheet({ k: "files", target: { type: "tx", txId: t.id }, title: t.description || pjName(PJ_KINDS, t.kind) }) },
                        tl("المرفقات", "Attachments") + (t.files ? " (" + t.files + ")" : "")),
                    voided ? h("div", { style: { fontSize: 12, color: colors.danger, marginTop: 4 } }, tl("ملغاة: ", "Voided: ") + (t.voidReason || ""))
                        : canEdit && h(Btn, { kind: "ghost", style: Object.assign({ marginTop: 8 }, pjSmallBtn), onClick: async () => { const r = await ask({ text: tl("إلغاء هذه الحركة؟ تبقى في السجلّ ملغاة.", "Void this entry? It stays in the record as voided."), confirmLabel: tl("إلغاء الحركة", "Void entry"), cancelLabel: tl("رجوع", "Back"), danger: true,
                            input: { label: tl("سبب الإلغاء", "Reason for voiding"), required: true } }); if (r && r.trim()) act(call("pfm.proj.tx.void", { pid, txId: t.id, reason: r.trim() })); } }, tl("إلغاء الحركة", "Void entry")));
            }),
            sheet && sheet.k === "entry" && h(ProjectEntrySheet, { pid, cur, base, cats, lines: linesOfBase, today,
                onClose: () => setSheet(null), onSaved: () => { setSheet(null); reload(); } }));

        const people = h("div", null,
            title(tl("الأعضاء", "Members")),
            !mem && h(Loading),
            mem && mem.map((m) => h(Card, { key: m.uid, style: { marginBottom: 8 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" } },
                    h("div", { style: { fontWeight: 700 } }, m.displayName || (m.uid === p.ownerUid ? tl("المالك", "Owner") : tl("عضو", "Member"))),
                    m.role === "owner" || !isOwner
                        ? h("span", { style: { fontSize: 12, color: colors.textMuted } }, tl(pjPeople[m.role][0], pjPeople[m.role][1]))
                        : h("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                            h("select", { "aria-label": tl("الدور", "Role"), value: m.role, onChange: (e) => act(call("pfm.proj.members.role", { pid, uid: m.uid, role: e.target.value })), style: Object.assign({}, inputStyle(colors), { minHeight: 44, width: "auto" }) },
                                ["editor", "viewer"].map((r) => h("option", { key: r, value: r }, tl(pjPeople[r][0], pjPeople[r][1])))),
                            h(Btn, { kind: "danger", onClick: async () => { if (await ask({ text: tl("إزالة هذا العضو؟", "Remove this member?"), confirmLabel: tl("إزالة", "Remove"), danger: true })) act(call("pfm.proj.members.remove", { pid, uid: m.uid })); } }, tl("إزالة", "Remove")))))),
            isOwner && h(InviteBox, { pid, call, colors }),
            !isOwner && h(Btn, { kind: "danger", style: { marginTop: 12 }, onClick: async () => { if (await ask({ text: tl("مغادرة المشروع؟", "Leave this project?"), confirmLabel: tl("مغادرة", "Leave"), danger: true })) call("pfm.proj.members.remove", { pid }).then(onBack, (e) => setErr(errText(e))); } }, tl("مغادرة المشروع", "Leave project")),
            isOwner && h(DeleteBox, { pid, call, onDeleted: onBack, colors }));

        const tabs = [["overview", tl("الملخّص", "Summary")], ["estimate", tl("التقدير", "Estimate")], ["ledger", tl("الحركات", "Ledger")], ["people", tl("الأعضاء", "People")]];
        return h("div", { style: { paddingBottom: 96 } },
            h("div", { style: { padding: "12px 16px 0", display: "flex", alignItems: "center", gap: 8 } },
                h(Btn, { kind: "ghost", onClick: onBack }, tl("رجوع", "Back")),
                h("div", { style: { fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)),
            h("div", { style: { padding: 16 } },
                err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 12 } }, err),
                h("div", { style: { marginBottom: 14 } }, h(Seg, { tabs: true, value: tab, onChange: setTab, options: tabs.map((t) => ({ value: t[0], label: t[1] })) })),
                tab === "overview" ? overview : tab === "estimate" ? estimate : tab === "ledger" ? ledger : people),
            sheet && sheet.k === "files" && h(PjFiles, { pid, target: sheet.target, title: sheet.title, canEdit, cur, today, onClose: () => setSheet(null), onChanged: reload }),
            sheet && sheet.k === "prices" && h(PjPrices, { pid, lineKey: sheet.lineKey, name: sheet.name, cur, onClose: () => setSheet(null) }));
    }

    // ── estimate: start a revision, edit the draft, approve ──
    function EstimateStart({ hasBaseline, pid, act }) {
        const { colors } = useTheme();
        const [reason, setReason] = useState(""), key = useRef(newKey());
        return h("div", { style: { marginBottom: 12 } },
            hasBaseline && h(Field, { label: tl("سبب المراجعة (أمر تغيير)", "Reason for the change order") }, h("input", { value: reason, maxLength: 200, onChange: (e) => setReason(e.target.value), style: inputStyle(colors) })),
            h(Btn, { disabled: hasBaseline && !reason.trim(), onClick: () => act(call("pfm.proj.estimate.create", { pid, idemKey: key.current, fromBaseline: hasBaseline, reason: reason.trim() || undefined })) },
                hasBaseline ? tl("مراجعة جديدة من التقدير المعتمد", "New revision from the approved estimate") : tl("إنشاء تقدير", "Create estimate")));
    }

    function EstimateEditor({ pid, draft, cur, act, today }) {
        const { colors } = useTheme();
        const [rows, setRows] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
        useEffect(() => {
            call("pfm.proj.variance", { pid, estimateId: draft.id }).then((r) => setRows(r.lines.map((l) => ({ k: l.lineKey, name: l.name || "", category: l.category || "other", unit: l.unit || "", qty: l.estQty, price: pjMinor(l.estUnitPrice, cur),
                priceDate: l.priceDate || today || "", supplier: l.supplier || "", pricedAt: l.pricedAt || null }))), (e) => setErr(errText(e)));
        }, [draft.id, draft.rev]);
        const upd = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? Object.assign({}, r, { [k]: v }) : r)));
        const save = () => {
            if (busy || !rows) return;
            if (rows.some((r) => !r.name.trim() || !r.qty.trim() || !r.price.trim())) { setErr(tl("أكمل اسم كلّ بند وكمّيته وسعره", "Give every line a name, quantity and price")); return; }
            setBusy(true); setErr("");
            act(call("pfm.proj.estimate.lines", { pid, eid: draft.id, rev: draft.rev, lines: rows.map((r) => ({ lineKey: r.k, category: r.category, name: r.name.trim(), unit: r.unit.trim(), estQty: r.qty.trim(), estUnitPrice: r.price.trim(),
                priceDate: r.priceDate || undefined, supplier: r.supplier.trim() || undefined })) }))
                .then(() => setBusy(false), () => setBusy(false));
        };
        if (!rows) return err ? h("div", { role: "alert", style: { color: colors.danger, fontSize: 14 } }, err) : h(Loading);
        return h("div", null,
            rows.map((r, i) => h(Card, { key: r.k, style: { marginBottom: 8 } },
                h(Field, { label: tl("البند", "Item") }, h("input", { value: r.name, maxLength: 160, onChange: (e) => upd(i, "name", e.target.value), style: inputStyle(colors) })),
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                    h(Field, { label: tl("الفئة", "Category") }, pjSelect(colors, r.category, (v) => upd(i, "category", v), PJ_BOQ.map((c) => [c[0], tl(c[1], c[2])]), tl("الفئة", "Category"))),
                    h(Field, { label: tl("الوحدة", "Unit") }, h("input", { value: r.unit, maxLength: 16, onChange: (e) => upd(i, "unit", e.target.value), style: inputStyle(colors) }))),
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                    h(Field, { label: tl("الكمّيّة", "Quantity") }, h("input", { inputMode: "decimal", value: r.qty, onChange: (e) => upd(i, "qty", e.target.value), style: inputStyle(colors) })),
                    h(Field, { label: tl("سعر الوحدة", "Unit price") }, h("input", { inputMode: "decimal", value: r.price, onChange: (e) => upd(i, "price", e.target.value), style: inputStyle(colors) }))),
                // C287: the date of the quote and who gave it; the server stamps when it was entered and keeps every earlier price
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                    h(Field, { label: tl("تاريخ السعر", "Price date") }, h("input", { type: "date", value: r.priceDate, max: today || undefined, onChange: (e) => upd(i, "priceDate", e.target.value), style: inputStyle(colors) })),
                    h(Field, { label: tl("المورّد (اختياري)", "Supplier (optional)") }, h("input", { value: r.supplier, maxLength: 120, onChange: (e) => upd(i, "supplier", e.target.value), style: inputStyle(colors) }))),
                r.pricedAt && h("div", { style: { fontSize: 11, color: colors.textMuted, margin: "-4px 0 8px" } }, tl("سُجّل هذا السعر ", "This price was entered ") + pjStamp(r.pricedAt)),
                h(Btn, { kind: "ghost", onClick: () => setRows((rs) => rs.filter((_, j) => j !== i)) }, tl("حذف البند", "Remove item")))),
            h(Btn, { kind: "ghost", onClick: () => setRows((rs) => rs.concat([{ k: pjLineKey(), name: "", category: "other", unit: "", qty: "", price: "", priceDate: today || "", supplier: "", pricedAt: null }])), style: { marginBottom: 12 } }, tl("إضافة بند", "Add item")),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 10 } }, err),
            h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                h(Btn, { onClick: save, disabled: busy }, tl("حفظ المسوّدة", "Save draft")),
                h(Btn, { kind: "ghost", disabled: busy, onClick: async () => { if (await ask({ text: tl("اعتماد هذا التقدير؟ يصبح الأساس ولا يُعدَّل إلّا بمراجعة جديدة.", "Approve this estimate? It becomes the baseline and changes only through a new revision."), confirmLabel: tl("اعتماد", "Approve") })) act(call("pfm.proj.estimate.approve", { pid, eid: draft.id, rev: draft.rev })); } }, tl("اعتماد التقدير", "Approve estimate"))));
    }

    // ── a ledger entry: expense on a line or unbudgeted, optional copy to the personal ledger ──
    function ProjectEntrySheet({ pid, cur, base, cats, lines, today, onClose, onSaved }) {
        const { colors } = useTheme();
        const [f, setF] = useState({ kind: "expense", amount: "", currency: cur, fxRate: "", occurredOn: today || "", description: "", counterparty: "", lineKey: "", category: "other", quantity: "", unit: "", copy: false, personalCat: "", personalFxRate: "" });
        const [busy, setBusy] = useState(false), [err, setErr] = useState(""), key = useRef(newKey()), [files, setFiles] = useState([]);
        const set = (k) => (v) => setF((x) => Object.assign({}, x, { [k]: v }));
        const isExp = f.kind === "expense", curDiff = f.currency !== cur, notBase = f.currency !== base;
        const personalCats = Object.values(cats || {}).filter((c) => c.kind === "expense" && !c.archived);
        const save = () => {
            if (busy) return; setBusy(true); setErr("");
            const b = { pid, idemKey: key.current, kind: f.kind, amount: f.amount.trim(), occurredOn: f.occurredOn, description: f.description.trim() };
            if (f.counterparty.trim()) b.counterparty = f.counterparty.trim();
            if (curDiff) { b.currency = f.currency; b.fxRate = f.fxRate.trim(); }
            if (isExp) {
                if (f.lineKey) b.lineKey = f.lineKey; else b.category = f.category;
                if (f.quantity.trim()) { b.quantity = f.quantity.trim(); b.unit = f.unit.trim(); }
                if (f.copy) { b.copyToPersonal = { categoryId: f.personalCat || (personalCats[0] && personalCats[0].id) }; if (notBase) b.personalFxRate = f.personalFxRate.trim(); }
            }
            // C287: receipts and supplier invoices go up after the entry exists, dated with the entry's date
            call("pfm.proj.tx.add", b).then((r) => files.reduce((pr, file, i) => pr.then(() => pjFileData(file).then((data) =>
                call("pfm.proj.file.add", { pid, idemKey: key.current.slice(0, 30) + "-" + i, target: { type: "tx", txId: r.tx.id }, kind: isExp ? "receipt" : "other", name: file.name.slice(0, 120), docDate: f.occurredOn <= (today || f.occurredOn) ? f.occurredOn : today, data }))), Promise.resolve())
                .then(onSaved, (e) => { setBusy(false); setErr(tl("حُفظت الحركة، لكن تعذّر رفع مرفق: ", "The entry was saved, but an attachment failed: ") + pjFileErr(e)); }),
                (e) => { setErr(errText(e)); setBusy(false); });
        };
        const need = !f.amount.trim() || !f.description.trim() || !f.occurredOn;
        return h(Sheet, { title: tl("حركة في المشروع", "Project entry"), onClose },
            h(Field, { label: tl("النوع", "Type") }, pjSelect(colors, f.kind, set("kind"), PJ_KINDS.map((k) => [k[0], tl(k[1], k[2])]), tl("النوع", "Type"))),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                h(Field, { label: tl("المبلغ", "Amount") }, h("input", { inputMode: "decimal", value: f.amount, onChange: (e) => set("amount")(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("العملة", "Currency") }, pjSelect(colors, f.currency, set("currency"), CURS.map((c) => [c, c]), tl("العملة", "Currency")))),
            curDiff && h(Field, { label: tl("سعر الصرف: 1 " + f.currency + " = ? " + cur, "Exchange rate: 1 " + f.currency + " = ? " + cur) }, h("input", { inputMode: "decimal", value: f.fxRate, onChange: (e) => set("fxRate")(e.target.value), style: inputStyle(colors) })),
            h(Field, { label: tl("التاريخ", "Date") }, h("input", { type: "date", value: f.occurredOn, onChange: (e) => set("occurredOn")(e.target.value), style: inputStyle(colors) })),
            h(Field, { label: tl("الوصف", "Description") }, h("input", { value: f.description, maxLength: 200, onChange: (e) => set("description")(e.target.value), style: inputStyle(colors) })),
            h(Field, { label: tl("الطرف الآخر (اختياري)", "Counterparty (optional)") }, h("input", { value: f.counterparty, maxLength: 120, onChange: (e) => set("counterparty")(e.target.value), style: inputStyle(colors) })),
            isExp && h(Field, { label: tl("البند", "Line") }, pjSelect(colors, f.lineKey, set("lineKey"), [["", tl("بدون بند (مصروف غير مخطّط)", "No line (unbudgeted)")]].concat(lines.map((l) => [l.lineKey, l.name])), tl("البند", "Line"))),
            isExp && !f.lineKey && h(Field, { label: tl("الفئة", "Category") }, pjSelect(colors, f.category, set("category"), PJ_BOQ.map((c) => [c[0], tl(c[1], c[2])]), tl("الفئة", "Category"))),
            isExp && h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                h(Field, { label: tl("الكمّيّة (اختياري)", "Quantity (optional)") }, h("input", { inputMode: "decimal", value: f.quantity, onChange: (e) => set("quantity")(e.target.value), style: inputStyle(colors) })),
                h(Field, { label: tl("الوحدة", "Unit") }, h("input", { value: f.unit, maxLength: 16, onChange: (e) => set("unit")(e.target.value), style: inputStyle(colors) }))),
            isExp && h("label", { style: { display: "flex", gap: 8, alignItems: "center", margin: "6px 0 12px", fontSize: 14 } },
                h("input", { type: "checkbox", checked: f.copy, onChange: (e) => set("copy")(e.target.checked) }),
                tl("نسخ المصروف إلى محاسبي الشخصي", "Also record in my personal accountant")),
            isExp && f.copy && h(Field, { label: tl("فئة المحاسب الشخصي", "Personal category") }, pjSelect(colors, f.personalCat || (personalCats[0] && personalCats[0].id) || "", set("personalCat"), personalCats.map((c) => [c.id, tl(c.nameAr || c.name, c.name)]), tl("فئة المحاسب الشخصي", "Personal category"))),
            isExp && f.copy && notBase && h(Field, { label: tl("سعر الصرف إلى عملة محاسبك", "Rate to your personal currency") }, h("input", { inputMode: "decimal", value: f.personalFxRate, onChange: (e) => set("personalFxRate")(e.target.value), style: inputStyle(colors) })),
            h(Field, { label: tl("إيصال أو فاتورة مورّد (اختياري)", "Receipt or supplier invoice (optional)"), hint: tl("صورة أو PDF، يبقى مع الحركة وتاريخها", "A photo or PDF, kept with the entry and its date") },
                h("input", { type: "file", accept: "image/*,application/pdf", multiple: true, onChange: (e) => setFiles(Array.from(e.target.files || []).slice(0, 5)), style: { fontSize: 14 } })),
            files.length > 0 && h("div", { style: { fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px" } }, files.map((x) => x.name).join("، ")),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 10 } }, err),
            h("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
                h(Btn, { kind: "ghost", onClick: onClose }, tl("إلغاء", "Cancel")),
                h(Btn, { onClick: save, disabled: busy || need }, busy ? tl("جارٍ الحفظ…", "Saving…") : tl("حفظ", "Save"))));
    }


    // ── C287: attachments with fixed dates, and the price history of a BOQ line ──
    const PJ_FILE_KINDS = [["photo", "صورة", "Photo"], ["quote", "عرض سعر", "Quote"], ["supplier_invoice", "فاتورة مورّد", "Supplier invoice"], ["receipt", "إيصال", "Receipt"], ["other", "أخرى", "Other"]];
    const PJ_FILE_MAX = 4 * 1024 * 1024;
    const pjSmallBtn = { minHeight: 44, padding: "4px 12px", fontSize: 13 };
    const pjDay = (d) => { if (!d) return ""; const [y, mo, da] = d.split("-").map(Number); return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, da)); };
    const pjStamp = (iso) => { try { return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)); } catch (e) { return iso; } };
    const pjFileErr = (e) => (e && e.message === "too_big" ? tl("الملفّ أكبر من 4 ميغابايت", "The file is over 4 MB") : e && e.message === "bad_type" ? tl("اختر صورة أو ملفّ PDF", "Choose a photo or a PDF") : errText(e));
    // A picked file → a data: URI the server accepts. Photos are shrunk on the phone (JPEG ≤ 400 KB); PDFs go as they are (≤ 4 MB).
    function pjFileData(file) {
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
        if (isPdf) {
            if (file.size > PJ_FILE_MAX) return Promise.reject(new Error("too_big"));
            return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, "data:application/pdf;base64,")); r.onerror = () => no(new Error("bad_type")); r.readAsDataURL(file); });
        }
        if (/^image\//.test(file.type || "")) return shrinkImage(file, 1600, true).catch(() => { throw new Error("bad_type"); });
        return Promise.reject(new Error("bad_type"));
    }

    function PjFiles({ pid, target, title, canEdit, cur, today, onClose, onChanged }) {
        const { colors } = useTheme();
        const [items, setItems] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [view, setView] = useState(null), [removed, setRemoved] = useState(false);
        const [f, setF] = useState({ kind: target.type === "tx" ? "receipt" : target.type === "line" ? "quote" : "photo", docDate: today || "", note: "", price: "" });
        const tkey = JSON.stringify(target);
        const load = () => call("pfm.proj.file.list", { pid, target, withRemoved: true }).then((r) => setItems(r.items), (e) => setErr(errText(e)));
        useEffect(() => { load(); }, [pid, tkey]);
        const set = (k) => (v) => setF((x) => Object.assign({}, x, { [k]: v }));
        const pick = (e) => {
            const file = e.target.files && e.target.files[0]; e.target.value = "";
            if (!file || busy) return;
            if (!f.docDate) { setErr(tl("اختر تاريخ المستند أوّلاً", "Choose the document date first")); return; }
            setBusy(true); setErr("");
            pjFileData(file).then((data) => call("pfm.proj.file.add", { pid, idemKey: newKey(), target, kind: f.kind, name: (file.name || "").slice(0, 120) || undefined, note: f.note.trim() || undefined,
                docDate: f.docDate, data, quotedUnitPrice: f.kind === "quote" && target.type === "line" && f.price.trim() ? f.price.trim() : undefined }))
                .then(() => { setBusy(false); setF((x) => Object.assign({}, x, { note: "", price: "" })); load(); if (onChanged) onChanged(); }, (e2) => { setBusy(false); setErr(pjFileErr(e2)); });
        };
        const open = (it) => call("pfm.proj.file.get", { pid, fid: it.id }).then((r) => {
            if (it.type === "application/pdf") saveFileOut(pdfBlob(r.data.split(",")[1]), (it.name && /\.pdf$/i.test(it.name) ? it.name : "attachment-" + it.docDate + ".pdf").replace(/[\\/:*?"<>|]+/g, "-"), "application/pdf");
            else setView(r.data); }, (e) => setErr(errText(e)));
        const remove = async (it) => { const r = await ask({ text: tl("إزالة هذا المرفق؟ يبقى في السجلّ بلا محتواه.", "Remove this attachment? The record stays, without the file."), confirmLabel: tl("إزالة", "Remove"), danger: true,
                input: { label: tl("سبب الإزالة", "Why remove it"), required: true } });
            if (r == null) return; if (!r.trim()) { setErr(ERR.reason_required ? tl(ERR.reason_required[0], ERR.reason_required[1]) : "reason"); return; }
            call("pfm.proj.file.remove", { pid, fid: it.id, reason: r.trim() }).then(() => { load(); if (onChanged) onChanged(); }, (e) => setErr(errText(e))); };
        const live = (items || []).filter((x) => !x.removedAt), gone = (items || []).filter((x) => x.removedAt);
        const row = (it) => h(Card, { key: it.id, style: { marginBottom: 8, opacity: it.removedAt ? 0.6 : 1 } },
            h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" } },
                h("div", { dir: "auto", style: { fontWeight: 700, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, it.name || pjName(PJ_FILE_KINDS, it.kind)),
                h("span", { style: { fontSize: 12, color: colors.textMuted, whiteSpace: "nowrap" } }, pjName(PJ_FILE_KINDS, it.kind) + (it.type === "application/pdf" ? " · PDF" : ""))),
            h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 1.6 } },
                tl("بتاريخ ", "Dated ") + pjDay(it.docDate) + " · " + tl("رُفع ", "uploaded ") + pjStamp(it.uploadedAt) + " · " + Math.max(1, Math.round(it.size / 1024)) + " KB",
                it.quotedUnitPrice != null ? " · " + tl("السعر المعروض ", "quoted ") + money(it.quotedUnitPrice, cur) : ""),
            it.note && h("div", { dir: "auto", style: { fontSize: 13, marginTop: 4 } }, it.note),
            it.removedAt ? h("div", { style: { fontSize: 12, color: colors.danger, marginTop: 4 } }, tl("أُزيل ", "Removed ") + pjStamp(it.removedAt) + (it.removeReason ? " — " + it.removeReason : ""))
                : h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
                    h(Btn, { kind: "ghost", style: pjSmallBtn, onClick: () => open(it) }, it.type === "application/pdf" ? tl("فتح PDF", "Open PDF") : tl("عرض", "View")),
                    canEdit && h(Btn, { kind: "ghost", style: pjSmallBtn, onClick: () => remove(it) }, tl("إزالة", "Remove"))));
        return h(Sheet, { title: tl("المرفقات: ", "Attachments: ") + (title || ""), onClose },
            canEdit && h("section", { "aria-label": tl("إضافة مرفق", "Add an attachment"), style: { paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid " + colors.border } },
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                    h(Field, { label: tl("النوع", "Type") }, pjSelect(colors, f.kind, set("kind"), PJ_FILE_KINDS.map((k) => [k[0], tl(k[1], k[2])]), tl("النوع", "Type"))),
                    h(Field, { label: tl("تاريخ المستند", "Document date"), hint: tl("التاريخ المكتوب على العرض أو الإيصال", "The date printed on the quote or receipt") },
                        h("input", { type: "date", value: f.docDate, max: today || undefined, onChange: (e) => set("docDate")(e.target.value), style: inputStyle(colors) }))),
                f.kind === "quote" && target.type === "line" && h(Field, { label: tl("سعر الوحدة في العرض (اختياري)", "Unit price on the quote (optional)") + " (" + cur + ")", hint: tl("يدخل سجلّ أسعار البند بتاريخ العرض", "Goes into the line's price history on the quote's date") },
                    h("input", { inputMode: "decimal", dir: "ltr", value: f.price, onChange: (e) => set("price")(numIn(e.target.value, true)), style: inputStyle(colors) })),
                h(Field, { label: tl("ملاحظة (اختياري)", "Note (optional)") }, h("input", { value: f.note, maxLength: 300, onChange: (e) => set("note")(e.target.value), style: inputStyle(colors) })),
                h("label", { style: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 10, border: "1.5px dashed " + colors.primary, color: colors.primary, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 } },
                    busy ? tl("جارٍ الرفع…", "Uploading…") : tl("اختر صورة أو PDF", "Choose a photo or PDF"),
                    h("input", { type: "file", accept: "image/*,application/pdf", disabled: busy, onChange: pick, style: { position: "absolute", width: 1, height: 1, opacity: 0 } })),
                h("div", { style: { fontSize: 11, color: colors.textMuted, marginTop: 6 } }, tl("الصور تُصغَّر على جهازك، وملفّات PDF حتّى 4 ميغابايت. لا يُعدَّل المرفق بعد رفعه؛ تاريخه ووقت رفعه ثابتان.", "Photos are shrunk on your device; PDFs up to 4 MB. An attachment can't be edited after upload: its dates are fixed."))),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 10 } }, err),
            !items ? h(Loading) : live.length === 0 ? h("div", { style: { fontSize: 13, color: colors.textMuted } }, tl("لا مرفقات بعد.", "No attachments yet.")) : live.map(row),
            gone.length > 0 && h("button", { type: "button", onClick: () => setRemoved(!removed), style: { background: "none", border: 0, color: colors.primary, fontSize: 13, padding: "8px 0", cursor: "pointer" } },
                (removed ? tl("إخفاء", "Hide") : tl("عرض", "Show")) + " " + tl("المرفقات المُزالة", "removed attachments") + " (" + gone.length + ")"),
            removed && gone.map(row),
            view && h(PhotoView, { src: view, onClose: () => setView(null) }));
    }

    function PjPrices({ pid, lineKey, name, cur, onClose }) {
        const { colors } = useTheme();
        const [d, setD] = useState(null), [err, setErr] = useState("");
        useEffect(() => { call("pfm.proj.prices", { pid, lineKey }).then((r) => setD(r.lines[0] || { estimates: [], quotes: [], actual: [] }), (e) => setErr(errText(e))); }, [pid, lineKey]);
        const ev = d ? [].concat(
            d.estimates.map((e) => ({ day: e.priceDate, at: e.pricedAt, price: e.unitPrice, kind: "est", text: tl("تقدير — مراجعة ", "Estimate — revision ") + e.revision + (e.supplier ? " · " + e.supplier : ""), sub: tl("سُجّل ", "entered ") + pjStamp(e.pricedAt) })),
            d.quotes.map((q) => ({ day: q.docDate, at: q.uploadedAt, price: q.unitPrice, kind: "quote", text: tl("عرض سعر مرفق", "Attached quote"), sub: tl("رُفع ", "uploaded ") + pjStamp(q.uploadedAt) })),
            d.actual.map((a) => ({ day: a.occurredOn, at: a.createdAt, price: a.unitPrice, kind: "paid", text: tl("مدفوع فعلاً — ", "Actually paid — ") + a.quantity, sub: money(a.amount, cur) })))
            .sort((a, b) => (a.day === b.day ? (a.at < b.at ? -1 : 1) : a.day < b.day ? -1 : 1)) : [];
        const sign = (bp) => (bp > 0 ? "+" : "") + pct(bp);
        return h(Sheet, { title: tl("سجلّ الأسعار: ", "Price history: ") + (name || ""), onClose },
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14 } }, err),
            !d && !err && h(Loading),
            d && h("div", null,
                d.changeBp != null && d.estimates.length > 1 && h("p", { style: { margin: "0 0 6px", fontSize: 14 } },
                    tl("تغيّر السعر المقدَّر ", "The estimated price moved ") + sign(d.changeBp) + tl(" منذ أوّل تقدير (", " since the first estimate (") + money(d.firstEstimate.unitPrice, cur) + " → " + money(d.latestEstimate.unitPrice, cur) + ")."),
                d.actualVsEstimateBp != null && h("p", { style: { margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: d.actualVsEstimateBp > 0 ? colors.danger : colors.text } },
                    tl("ما دُفع فعلاً ", "What was actually paid is ") + sign(d.actualVsEstimateBp) + tl(" عن السعر المقدَّر في يوم الشراء.", " against the estimate in force on the day of purchase.")),
                ev.length === 0 ? h("div", { style: { fontSize: 13, color: colors.textMuted } }, tl("لا أسعار بعد.", "No prices yet."))
                    : h("ol", { style: { listStyle: "none", margin: 0, padding: 0 } }, ev.map((e, i) => h("li", { key: i, style: { display: "flex", gap: 10, padding: "10px 0", borderTop: i ? "1px solid " + colors.border : 0 } },
                        h("span", { "aria-hidden": true, style: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, backgroundColor: e.kind === "paid" ? colors.text : e.kind === "quote" ? colors.warning : colors.primary } }),
                        h("div", { style: { flex: 1, minWidth: 0 } },
                            h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8 } }, h("span", { style: { fontWeight: 700, fontSize: 14 } }, pjDay(e.day)), h("span", { style: { fontWeight: 800, fontSize: 14 } }, money(e.price, cur))),
                            h("div", { dir: "auto", style: { fontSize: 12, color: colors.textMuted, marginTop: 2 } }, e.text + " · " + e.sub)))))));
    }

    // ── people: invite codes (owner) and the delete action (owner) ──
    function InviteBox({ pid, colors }) {
        const [role, setRole] = useState("viewer"), [maxUses, setMaxUses] = useState(1), [days, setDays] = useState(7);
        const [res, setRes] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
        const make = () => {
            if (busy) return; setBusy(true); setErr("");
            call("pfm.proj.invite.create", { pid, role, maxUses, days }).then((r) => { setRes(r.invite); setBusy(false); }, (e) => { setErr(errText(e)); setBusy(false); });
        };
        const num = (v, set, opts) => h("select", { "aria-label": tl("عدد", "Count"), value: String(v), onChange: (e) => set(Number(e.target.value)), style: inputStyle(colors) }, opts.map((o) => h("option", { key: o, value: String(o) }, String(o))));
        return h(Card, { style: { marginTop: 12 } },
            h("div", { style: { fontWeight: 800, marginBottom: 8 } }, tl("دعوة شخص", "Invite someone")),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } },
                h(Field, { label: tl("الدور", "Role") }, pjSelect(colors, role, setRole, [["viewer", tl("مشاهد", "Viewer")], ["editor", tl("محرّر", "Editor")]], tl("الدور", "Role"))),
                h(Field, { label: tl("مرّات الاستخدام", "Uses") }, num(maxUses, setMaxUses, [1, 2, 3, 5, 10])),
                h(Field, { label: tl("أيّام الصلاحيّة", "Days valid") }, num(days, setDays, [1, 3, 7, 14, 30]))),
            res && h("div", { style: { border: "1px dashed " + colors.border, borderRadius: 12, padding: 10, marginBottom: 10 } },
                h("div", { style: { fontSize: 13, marginBottom: 6 } }, tl("انسخ الرمز الآن. لن يُعرض مرّة أخرى.", "Copy the code now. It won't be shown again.")),
                h("code", { style: { display: "block", wordBreak: "break-all", userSelect: "all", fontSize: 14 } }, res.token),
                h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 6 } }, tl("ينتهي: ", "Expires: ") + new Date(res.expiresAt).toLocaleString(locale()))),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 8 } }, err),
            h(Btn, { onClick: make, disabled: busy }, tl("إنشاء رمز دعوة", "Create invite code")));
    }
    function DeleteBox({ pid, onDeleted, colors }) {
        const [arm, setArm] = useState(false), [err, setErr] = useState("");
        const del = () => call("pfm.proj.delete", { pid, confirm: pid }).then(onDeleted, (e) => setErr(errText(e)));
        return h("div", { style: { marginTop: 18 } },
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 8 } }, err),
            h(Btn, { kind: "danger", onClick: () => (arm ? del() : setArm(true)) }, arm ? tl("اضغط مرّة أخرى للحذف النهائي", "Tap again to delete permanently") : tl("حذف المشروع", "Delete project")),
            arm && h("div", { style: { fontSize: 12, color: colors.textMuted, marginTop: 6 } }, tl("يُحذف للجميع: التقديرات والحركات والأعضاء.", "Deletes it for everyone: estimates, entries and members.")));
    }


    // ── screen ──
    // ── C273: import receipts (Sawa-deploy-test/pfm/IMPORT-DESIGN.md §4.7) ──
    // Screenshots are read ON THE PHONE by the Sawa reader (/ocr/v1/, tesseract.js): no service sees them. Each row the user
    // confirms becomes an ordinary entry (pfm.tx.add) with the screenshot as its sealed receipt. A bank reference makes the
    // entry id on the server, so the same transfer imported twice is booked once.
    const OCR_BASE = "/ocr/v1/";                       // the OCR engine (never changes inside v1)
    const READER_JS = "/ocr/sawa-reader-4.js";         // C276: the reader carries its version in its name (phones cache /ocr/ for good)
    let readerLoad = null;
    const loadReader = () => readerLoad || (readerLoad = new Promise((res, rej) => {
        if (window.SawaReader) return res(window.SawaReader);
        const s = document.createElement("script"); s.src = READER_JS;
        s.onload = () => res(window.SawaReader); s.onerror = () => { readerLoad = null; rej(new Error("ocr_load_failed")); };
        document.head.appendChild(s);
    }));
    // C276: one set of OCR engines for the whole app session (each start compiles a 4 MB engine three times).
    // C292: they used to stop 3 minutes after the Import sheet closed, so the next import paid the whole start again.
    // Now they stay while the app is in use and stop only after 10 minutes in the background (to give the phone its
    // memory back). A device that has read receipts before also starts them quietly when Personal Accountant opens,
    // so Import opens "ready".
    const OCR_USED_KEY = "sawa_ocr_used";
    let ocrShared = null, ocrIdle = null, ocrProgress = null;
    const ocrStat = { ms: null };
    function startOcr() {
        if (ocrIdle) { clearTimeout(ocrIdle); ocrIdle = null; }
        if (!ocrShared) {
            const t0 = Date.now();
            ocrShared = loadReader().then((R) => R.makeOcr({ base: OCR_BASE, onProgress: (st, pr) => ocrProgress && ocrProgress(st, pr) }))
                .then((o) => o.warm().then(() => { ocrStat.ms = Date.now() - t0; try { localStorage.setItem(OCR_USED_KEY, "1"); } catch (e) {} return o; }));   // C279: all three engines (each image uses them at once)
            ocrShared.catch(() => { ocrShared = null; });
        }
        return ocrShared;
    }
    function stopOcr() {
        if (ocrIdle) { clearTimeout(ocrIdle); ocrIdle = null; }
        if (!ocrShared || imp.busy) return;
        const p = ocrShared; ocrShared = null; p.then((o) => o.close()).catch(() => {});
    }
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") { if (ocrShared && !ocrIdle) ocrIdle = setTimeout(stopOcr, 600000); }
        else if (ocrIdle) { clearTimeout(ocrIdle); ocrIdle = null; }
    });
    // C292: Personal Accountant opened on a device that has used the reader: start it after the screen has loaded
    function prewarmOcr() {
        let used = false; try { used = localStorage.getItem(OCR_USED_KEY) === "1"; } catch (e) {}
        if (!used || ocrShared) return;
        const go = () => { if (document.visibilityState === "visible") startOcr().catch(() => {}); };
        if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 6000 }); else setTimeout(go, 3000);
    }
    const secs = (ms) => (ms / 1000).toFixed(ms < 10000 ? 1 : 0);
    const digitsOf = (a) => String(a || "").replace(/\D/g, "");
    const SERVICE_AR = { fuel: "وقود", logistics: "نقل وترحيل", utility: "خدمات", telecom: "اتصالات", retail: "مشتريات", rent: "إيجار", bank_transfer: "تحويل بنكيّ", other: "أخرى" };
    // What a flag means for the user, by field (the reader's own reasons are technical English).
    function flagText(v) {
        const m = {
            transaction_id: tl("رقم العمليّة غير ظاهر في الصورة", "No transaction number on the screenshot"),
            timestamp: tl("التاريخ غير مقروء — أدخله", "Date unreadable — enter it"),
            amount: tl("المبلغ غير مؤكَّد — اكتبه كما في الإيصال", "Amount not certain — type it as on the receipt"),
            sender: tl("حساب المرسل غير واضح", "Sender account unclear"),
            recipient: /name unclear/.test(v.reason) ? tl("الاسم غير واضح — صحّحه إن لزم", "Name unclear — correct it if needed") : tl("حساب المستقبل أو اسمه غير واضح", "Recipient account or name unclear"),
            kind: /status is/.test(v.reason) ? tl("العمليّة لم تنجح في البنك", "The bank says this transfer did not succeed")
                : /confirm it is yours/.test(v.reason) ? tl("أكّد أنّ حساب المرسل حسابك (في الأعلى)", "Confirm the sender account is yours (above)")
                : tl("هل هو دخل أم مصروف؟ اختر", "Income or spending? Choose"),
        };
        return m[v.field] || v.field;
    }
    function rowFromResult(r, cats) {
        const kind = r.kind === "income" ? "income" : "expense";
        const other = kind === "income" ? r.sender : r.recipient;
        const who = other.name || (other.account_identifier ? tl("حساب ", "Account ") + other.account_identifier : "");
        const hint = cats[r.category_id] && cats[r.category_id].kind === kind ? r.category_id : kind === "income" ? "c_other_in" : "c_other_out";
        return { amount: r.amount.value || "", date: r.timestamp ? r.timestamp.slice(0, 10) : "", kind, who, note: r.note || "", catId: cats[hint] ? hint : "",
            include: r.status === "verified" && (r.kind === "income" || r.kind === "expense") };
    }
    // C280: the import batch lives here, outside the sheet, for the whole app session: closing the sheet or leaving the
    // accountant screen does not stop the reading or lose the rows. The sheet and the screen's banner show it.
    const imp = { rows: [], prefs: null, stage: "", busy: false, err: "", done: null, noHint: {}, open: false, onSaved: null, cats: null };
    const impSubs = new Set();
    const impSet = (p) => { Object.assign(imp, typeof p === "function" ? p(imp) : p); impSubs.forEach((f) => f()); impLater(); };
    const impPatch = (key, p) => impSet((st) => ({ rows: st.rows.map((r) => (r.key === key ? Object.assign({}, r, typeof p === "function" ? p(r) : p) : r)) }));
    // C281: the batch is also kept on the phone (IndexedDB «sawa-import»), so it survives an app restart: each image until
    // it is read, then its reading, the user's edits and the shrunk receipt. Unread images are read again on the next start.
    // Signing out wipes it (sawa-chat wipeLocal), and so does another account signing in on this phone.
    let impDbP = null, impSaved = new Map(), impT = null, impRestoreP = null, impReady = false;
    const impDb = () => impDbP || (impDbP = new Promise((res, rej) => {
        const q = indexedDB.open("sawa-import", 1);
        q.onupgradeneeded = () => q.result.createObjectStore("rows", { keyPath: "key" });
        q.onsuccess = () => { const db = q.result; db.onversionchange = () => { db.close(); impDbP = null; }; res(db); };
        q.onerror = () => { impDbP = null; rej(q.error); };
    }));
    const impTx = (mode, fn) => impDb().then((db) => new Promise((res, rej) => {
        const tx = db.transaction("rows", mode), q = fn(tx.objectStore("rows"));
        tx.oncomplete = () => res(q && q.result); tx.onerror = tx.onabort = () => rej(tx.error);
    }));
    const impRec = (r, order) => ({ key: r.key, order, name: r.name || (r.file && r.file.name) || "",
        file: r.state === "wait" || r.state === "read" ? r.file : null,       // read ⇒ the shrunk receipt (photo) is enough
        state: r.state === "read" ? "wait" : r.state, r: r.r || null, edit: r.edit || null, ms: r.ms == null ? null : r.ms,
        photo: r.photo || null, saved: r.saved || null, saveErr: r.saveErr || null });
    function impLater() {
        if (!impReady) return;
        if (imp.rows.some((r) => !impSaved.has(r.key))) { clearTimeout(impT); impFlush(); }   // new images: written at once
        else if (!impT) impT = setTimeout(impFlush, 300);                                        // edits: a moment later
    }
    try { window.addEventListener("pagehide", () => { if (impReady) { clearTimeout(impT); impFlush(); } }); } catch (e) {}
    function impFlush() {
        impT = null;
        const now = new Map(imp.rows.map((r) => [r.key, r]));
        const put = imp.rows.map((r, i) => [r, i]).filter(([r]) => impSaved.get(r.key) !== r), del = [...impSaved.keys()].filter((k) => !now.has(k));
        if (!put.length && !del.length) return;
        impSaved = now;
        impTx("readwrite", (st) => { put.forEach(([r, i]) => st.put(impRec(r, i))); del.forEach((k) => st.delete(k)); }).catch(() => {});
    }
    function impRestore() {
        if (impRestoreP) return impRestoreP;
        const load = window.indexedDB ? impTx("readonly", (st) => st.getAll()).catch(() => []) : Promise.resolve([]);
        return (impRestoreP = load.then((recs) => {
            const rows = (recs || []).sort((a, b) => a.order - b.order).map((x) => Object.assign({}, x, {
                state: x.state === "wait" && !x.file ? "error" : x.state, url: x.file ? URL.createObjectURL(x.file) : x.photo || "" }));
            rows.forEach((r) => impSaved.set(r.key, r));
            impReady = true;
            impSet({ rows: rows.concat(imp.rows) });
            const todo = rows.filter((r) => r.state === "wait");
            if (todo.length) impRun(todo);
        }));
    }
    // The reading loop, outside the sheet. Images picked while it runs join its queue.
    let impQ = [], impN = 0, impI = 0;
    async function impRun(items) {
        impQ = impQ.concat(items); impN += items.length;
        if (imp.busy) return;
        impSet({ busy: true, err: "", done: null });
        try {
            if (!imp.prefs) imp.prefs = await call("pfm.import.prefs.get").catch(() => ({ accounts: [], names: {} }));
            const R = await loadReader();
            const ocr = await startOcr();
            while (impQ.length) {
                const it = impQ.shift(); impI++;
                if (!imp.rows.some((r) => r.key === it.key)) continue;   // cleared meanwhile
                const ctx = { myAccounts: imp.prefs.accounts, knownAccounts: imp.prefs.names, source: "image_ocr" }, cats = imp.cats || {};
                impSet({ stage: tl(`قراءة ${impI} من ${impN}…`, `Reading ${impI} of ${impN}…`) });
                impPatch(it.key, { state: "read" });
                try {
                    const t0 = Date.now();
                    // C292: the receipt photo is made while the engines read, not after (it held up the next image)
                    const photoP = shrinkImage(it.file, 1280, true).catch(() => null);
                    const r = await R.readFile(it.file, ocr, ctx);
                    const ms = Date.now() - t0;
                    const photo = await photoP;
                    if (!r) { impPatch(it.key, { state: "none", photo, ms }); continue; }
                    // the same transfer twice in this batch: keep the first
                    const twin = r.transaction_id && imp.rows.find((x) => x.key !== it.key && x.r && x.r.transaction_id === r.transaction_id);
                    impPatch(it.key, { state: twin ? "twin" : "done", r, photo, ms, edit: Object.assign(rowFromResult(r, cats), twin ? { include: false } : {}) });
                } catch (x) { impPatch(it.key, { state: "error" }); }
            }
        } catch (x) {
            impQ.forEach((it) => impPatch(it.key, { state: "error" })); impQ = [];
            impSet({ err: tl("تعذّر تحميل القارئ — تحقّق من الاتّصال وحاول ثانيةً", "Couldn't load the reader — check your connection and try again") });
        }
        impN = 0; impI = 0;
        impSet({ stage: "", busy: false });
    }
    function useImport() {
        const [, tick] = useState(0);
        useEffect(() => { const f = () => tick((n) => n + 1); impSubs.add(f); return () => { impSubs.delete(f); }; }, []);
        return imp;
    }
    // rows still being read, or read and not yet added (a row the user left unticked counts until the batch is cleared)
    const impWaiting = () => imp.rows.filter((r) => !r.saved && (r.state === "wait" || r.state === "read" || r.state === "done")).length;
    function impClear() {
        if (imp.busy) return;
        imp.rows.forEach((r) => r.url && /^blob:/.test(r.url) && URL.revokeObjectURL(r.url));
        impSet({ rows: [], stage: "", err: "", done: null, noHint: {} });
        if (window.indexedDB) impTx("readwrite", (st) => st.clear()).catch(() => {});
    }
    function ImportSheet({ cats, onClose }) {
        const { colors } = useTheme();
        const { rows, prefs, stage, busy, err, done, noHint } = useImport();
        const setPrefs = (v) => impSet({ prefs: v }), setErr = (v) => impSet({ err: v }), setDone = (v) => impSet({ done: v }), setBusy = (v) => impSet({ busy: v });
        const setStage = (v) => impSet({ stage: v }), setNoHint = (v) => impSet({ noHint: v });
        const setRows = (f) => impSet((st) => ({ rows: f(st.rows) }));
        const [view, setView] = useState(null);
        const [engine, setEngine] = useState({ state: "starting", pct: null });
        const fileRef = useRef(null);
        useEffect(() => { impSet({ open: true });
            if (!imp.prefs) call("pfm.import.prefs.get").then(setPrefs, () => setPrefs({ accounts: [], names: {} }));
            // start the engines now, while the user picks images
            ocrProgress = (st, pr) => { if (/traineddata/.test(st || "") && pr != null) setEngine((e) => (e.state === "ready" ? e : { state: "starting", pct: Math.round(pr * 100) })); };
            startOcr().then(() => setEngine({ state: "ready", ms: ocrStat.ms }), () => setEngine({ state: "error" }));
            // closing does not cancel: a batch still reading keeps the engines until it ends; nothing left to do ⇒ cleared
            return () => { ocrProgress = null; impSet({ open: false }); if (!imp.busy && !impWaiting()) impClear(); }; }, []);
        const patch = (key, p) => setRows((rs) => rs.map((r) => (r.key === key ? Object.assign({}, r, typeof p === "function" ? p(r) : p) : r)));
        const patchEdit = (key, p) => patch(key, (r) => ({ edit: Object.assign({}, r.edit, p) }));
        const pick = (e) => {
            const files = Array.from((e.target.files) || []).slice(0, 50); e.target.value = "";
            if (!files.length || !prefs) return;
            const fresh = files.map((f) => ({ key: newKey(), file: f, name: f.name, url: URL.createObjectURL(f), state: "wait" }));
            setRows((rs) => rs.concat(fresh));
            impRun(fresh);
        };
        // A new account seen as the sender on a success screen: one question, then every row is decided again.
        const hints = {};
        rows.forEach((r) => { const a = r.r && r.r.own_account_hint; if (a && !noHint[a] && !(prefs && prefs.accounts.indexOf(a) >= 0)) hints[a] = (hints[a] || 0) + 1; });
        const confirmOwn = (acct) => {
            const accounts = prefs.accounts.concat([acct]);
            setPrefs(Object.assign({}, prefs, { accounts }));
            call("pfm.import.prefs.set", { accounts, names: prefs.names }).catch((e) => setErr(errText(e)));
            setRows((rs) => rs.map((r) => {
                if (!r.r) return r;
                const nr = window.SawaReader.recomputeKind(r.r, accounts), fresh = rowFromResult(nr, cats);
                // the type may flip (spending → income): category and the other party follow it; amount, date and note stay as edited
                const keep = fresh.kind === r.edit.kind ? { catId: r.edit.catId, who: r.edit.who } : {};
                return Object.assign({}, r, { r: nr, edit: Object.assign({}, r.edit, { kind: fresh.kind, catId: fresh.catId, who: fresh.who }, keep,
                    { include: r.state === "done" && fresh.include }) });
            }));
        };
        const ready = (r) => { const e = r.edit; return e && num(e.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.catId && cats[e.catId] && cats[e.catId].kind === e.kind; };
        const chosen = rows.filter((r) => r.edit && r.edit.include && !r.saved);
        const save = async () => {
            setBusy(true); setErr("");
            let added = 0, dup = 0, failed = 0;
            const names = Object.assign({}, prefs.names);
            for (const row of chosen) {
                if (!ready(row)) { failed++; continue; }
                const e = row.edit, r = row.r;
                const p = { kind: e.kind, amount: e.amount, currency: r.amount.currency || "SDG", categoryId: e.catId, date: e.date, note: e.note.trim() || null, counterparty: e.who.trim() || null };
                if (r.transaction_id) p.ref = { issuer: r.template.split("@")[0], id: r.transaction_id }; else p.idemKey = newKey();
                try {
                    const res = await call("pfm.tx.add", p);
                    if (res.duplicate) { dup++; patch(row.key, { saved: "dup" }); continue; }
                    if (row.photo) await call("pfm.tx.receipt.set", { id: res.tx.id, data: row.photo }).catch(() => {});
                    added++; patch(row.key, { saved: "ok" });
                    // remember the name the user confirmed for that account (next time it wins over the OCR)
                    const acct = e.kind === "income" ? r.sender.account_identifier : r.recipient.account_identifier;
                    if (acct && e.who.trim() && !/^(حساب|Account) /.test(e.who.trim())) names[digitsOf(acct)] = e.who.trim().slice(0, 80);
                } catch (x) { failed++; patch(row.key, { saved: "error", saveErr: errText(x) }); }
            }
            if (added) { setPrefs(Object.assign({}, prefs, { names })); call("pfm.import.prefs.set", { accounts: prefs.accounts, names }).catch(() => {}); }
            impSet({ done: { added, dup, failed }, busy: false });
            if (added && imp.onSaved) imp.onSaved();
        };
        const chip = (text, color) => h("span", { style: { fontSize: 11, fontWeight: 800, color, border: "1px solid " + color, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" } }, text);
        const small = (style) => Object.assign(inputStyle(colors), { minHeight: 44, padding: "8px 10px", fontSize: 14 }, style);
        const rowView = (row) => {
            const r = row.r, e = row.edit;
            const head = (status) => h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
                h("button", { type: "button", onClick: () => setView(row.url), "aria-label": tl("عرض الصورة", "View the image"),
                    style: { width: 44, height: 56, flexShrink: 0, border: "1px solid " + colors.border, borderRadius: 8, padding: 0, background: "none", overflow: "hidden", cursor: "pointer" } },
                    h("img", { src: row.url, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } })),
                h("div", { style: { flex: 1, minWidth: 0, fontSize: 12, color: colors.textMuted } },
                    h("div", { dir: "auto", style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, row.name || (row.file && row.file.name) || ""),
                    r && h("div", { dir: "ltr", style: { textAlign: ar() ? "right" : "left" } }, r.transaction_id ? "#" + r.transaction_id : ""),
                    row.ms != null && h("div", null, tl(`قُرئت في ${secs(row.ms)} ث`, `Read in ${secs(row.ms)} s`))),
                status);
            if (row.state === "wait" || row.state === "read") return head(chip(row.state === "read" ? tl("يُقرأ…", "Reading…") : tl("في الانتظار", "Waiting"), colors.textMuted));
            if (row.state === "none") return head(chip(tl("لم يُتعرَّف عليه", "Not recognised"), colors.warning));
            if (row.state === "error") return head(chip(tl("تعذّرت القراءة", "Couldn't read"), colors.danger));
            const flagged = r.verify.length > 0, transfer = r.kind === "transfer";
            const status = row.saved === "ok" ? chip(tl("أُضيفت", "Added"), colors.success)
                : row.saved === "dup" ? chip(tl("مسجّلة من قبل", "Already recorded"), colors.textMuted)
                : row.saved === "error" ? chip(tl("لم تُحفظ", "Not saved"), colors.danger)
                : row.state === "twin" ? chip(tl("مكرّرة في هذه الدفعة", "Repeated in this batch"), colors.textMuted)
                : transfer ? chip(tl("بين حساباتك", "Between your accounts"), colors.textMuted)
                : flagged ? chip(tl("يحتاج مراجعة", "Needs checking"), colors.warning) : chip(tl("جاهز", "Ready"), colors.success);
            const list = Object.values(cats).filter((c) => c.kind === e.kind && !c.archived).sort((a, b) => a.order - b.order);
            const locked = !!row.saved;
            return h("div", null, head(status),
                flagged && !locked && h("ul", { style: { margin: "0 0 8px", padding: "8px 12px", listStyle: "none", borderRadius: 10, backgroundColor: colors.warning + "18", color: colors.text, fontSize: 12, lineHeight: 1.7 } },
                    r.verify.map((v, i) => h("li", { key: i, style: { display: "flex", gap: 6, alignItems: "baseline" } }, h(AlertTriangle, { size: 12, color: colors.warning, style: { flexShrink: 0 } }), flagText(v)))),
                !r.transaction_id && !locked && h("div", { style: { fontSize: 11, color: colors.textMuted, marginBottom: 6 } }, tl("بلا رقم عمليّة: إن أضفتها مرّتين لن يُكتشف التكرار", "No transaction number: adding it twice won't be caught")),
                transfer && !locked && h("div", { style: { fontSize: 12, color: colors.textMuted, marginBottom: 6 } }, tl("تحويل بين حسابين لك: لا يُعدّ دخلاً ولا مصروفاً، فلا يُضاف إلّا إن اخترت.", "A transfer between two of your accounts is neither income nor spending, so it is added only if you choose.")),
                h("fieldset", { disabled: locked || busy, style: { border: 0, padding: 0, margin: 0 } },
                    h("div", { style: { marginBottom: 8 } }, h(Seg, { value: e.kind, onChange: (v) => patchEdit(row.key, { kind: v, catId: v === "income" ? "c_other_in" : "c_other_out" }), options: [
                        { value: "expense", label: tl("مصروف", "Spending"), color: colors.danger }, { value: "income", label: tl("دخل", "Income"), color: colors.success }] })),
                    h("div", { style: { display: "flex", gap: 8, marginBottom: 8 } },
                        h("input", { dir: "ltr", inputMode: "decimal", value: e.amount, "aria-label": tl("المبلغ", "Amount"), placeholder: "0.00",
                            onChange: (x) => patchEdit(row.key, { amount: x.target.value.replace(/[^0-9.]/g, "") }), style: small({ flex: 2, fontWeight: 800, borderColor: r.verify.some((v) => v.field === "amount") ? colors.warning : colors.border }) }),
                        h("span", { style: { alignSelf: "center", fontSize: 13, fontWeight: 700, color: colors.textMuted } }, r.amount.currency || "SDG"),
                        h("input", { type: "date", dir: "ltr", value: e.date, "aria-label": tl("التاريخ", "Date"), onChange: (x) => patchEdit(row.key, { date: x.target.value }),
                            style: small({ flex: 2, borderColor: r.verify.some((v) => v.field === "timestamp") ? colors.warning : colors.border }) })),
                    h("input", { dir: "auto", value: e.who, "aria-label": e.kind === "income" ? tl("من", "From") : tl("إلى", "To"), placeholder: e.kind === "income" ? tl("من", "From") : tl("إلى", "To"),
                        onChange: (x) => patchEdit(row.key, { who: x.target.value }), style: small({ marginBottom: 8 }) }),
                    h("div", { style: { display: "flex", gap: 8, marginBottom: 8 } },
                        h("select", { value: e.catId, "aria-label": tl("الفئة", "Category"), onChange: (x) => patchEdit(row.key, { catId: x.target.value }), style: small({ flex: 1 }) },
                            h("option", { value: "" }, tl("اختر فئة", "Choose a category")), list.map((c) => h("option", { key: c.id, value: c.id }, catName(c)))),
                        h("input", { dir: "auto", value: e.note, "aria-label": tl("ملاحظة", "Note"), placeholder: tl("ملاحظة", "Note"), onChange: (x) => patchEdit(row.key, { note: x.target.value }), style: small({ flex: 1 }) })),
                    r.service_type && r.service_type !== "bank_transfer" && h("div", { style: { fontSize: 11, color: colors.textMuted, marginBottom: 6 } }, tl("النوع المقترح: ", "Suggested type: ") + tl(SERVICE_AR[r.service_type] || r.service_type, r.service_type.replace("_", " "))),
                    h(Check, { checked: e.include, onChange: (v) => patchEdit(row.key, { include: v }) },
                        flagged ? tl("راجعتُها — أضِفها", "I've checked it — add it") : tl("أضِفها إلى السجلّ", "Add it to the ledger"))),
                e.include && !locked && !ready(row) && h("div", { style: { color: colors.danger, fontSize: 12 } }, tl("أكمل المبلغ والتاريخ والفئة", "Complete the amount, date and category")),
                row.saveErr && h("div", { role: "alert", style: { color: colors.danger, fontSize: 12 } }, row.saveErr));
        };
        const counts = { ready: rows.filter((r) => r.state === "done" && r.r.verify.length === 0).length, check: rows.filter((r) => r.state === "done" && r.r.verify.length > 0).length };
        return h(Sheet, { title: tl("استيراد إيصالات", "Import receipts"), onClose },
            h("p", { style: { margin: "0 0 12px", fontSize: T.small, color: colors.textMuted, lineHeight: 1.6 } },
                tl("اختر لقطات شاشة من «بنكك»: تحويل (تفاصيله أو شاشة النجاح) أو سداد فاتورة. تُقرأ على هاتفك ولا تُرسَل الصورة إلى أيّ جهة لقراءتها؛ ثمّ تُحفظ مشفّرةً إيصالاً للحركة. راجع كلّ صفّ قبل الإضافة.",
                    "Pick screenshots from Bankak: a transfer (its details or the success screen) or a bill payment. They are read on your phone; no service sees them to read them. Each one is then kept, encrypted, as the entry's receipt. Check every row before adding.")),
            h("input", { ref: fileRef, type: "file", accept: "image/*", multiple: true, onChange: pick, style: { display: "none" } }),
            h(Btn, { onClick: () => fileRef.current && fileRef.current.click(), disabled: busy || !prefs, style: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 } },
                h(Upload, { size: 18 }), rows.length ? tl("إضافة صور أخرى", "Add more images") : tl("اختيار الصور", "Choose images")),
            engine.state === "starting" && h("div", { role: "status", style: { fontSize: 13, color: tealInk(), fontWeight: 700, marginBottom: 10 } },
                tl("تجهيز القارئ…", "Getting the reader ready…") + (engine.pct != null ? ` ${engine.pct}%` : "") +
                tl(" (أوّل مرّة فقط: تنزيل نحو 9 ميغابايت)", " (first time only: about 9 MB to download)")),
            engine.state === "ready" && engine.ms != null && h("div", { style: { fontSize: 12, color: colors.textMuted, marginBottom: 10 } },
                tl(`القارئ جاهز (${secs(engine.ms)} ث)`, `Reader ready (${secs(engine.ms)} s)`)),
            engine.state === "error" && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, tl("تعذّر تجهيز القارئ — تحقّق من الاتّصال", "Couldn't get the reader ready — check your connection")),
            stage && engine.state !== "starting" && h("div", { role: "status", style: { fontSize: 13, color: tealInk(), fontWeight: 700, marginBottom: 10 } }, stage),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, err),
            Object.keys(hints).map((a) => h(Card, { key: a, style: { marginBottom: 10, borderColor: TEAL } },
                h("div", { style: { fontSize: 13, marginBottom: 8, lineHeight: 1.6 } },
                    tl(`الحساب `, `Account `), h("b", { dir: "ltr", style: { unicodeBidi: "isolate" } }, a),
                    tl(` دُفع منه ${hints[a]} من هذه العمليّات. هل هو حسابك؟ (يُسأل مرّة واحدة، وبه يُعرف الدخل من المصروف)`, ` paid ${hints[a]} of these. Is it yours? (Asked once; it tells income from spending)`)),
                h("div", { style: { display: "flex", gap: 8 } },
                    h(Btn, { onClick: () => confirmOwn(a), style: { flex: 1, minHeight: 44 } }, tl("نعم، حسابي", "Yes, mine")),
                    h(Btn, { kind: "ghost", onClick: () => setNoHint(Object.assign({}, noHint, { [a]: true })), style: { flex: 1, minHeight: 44 } }, tl("لا", "No"))))),
            rows.length > 0 && h("div", { style: { fontSize: 12, color: colors.textMuted, marginBottom: 8 } },
                tl(`${rows.length} صورة · ${counts.ready} جاهزة · ${counts.check} تحتاج مراجعة`, `${rows.length} images · ${counts.ready} ready · ${counts.check} need checking`)),
            rows.map((row) => h(Card, { key: row.key, style: { marginBottom: 10, padding: 12, opacity: row.saved === "dup" || row.state === "twin" ? 0.7 : 1 } }, rowView(row))),
            done && h("div", { role: "status", style: { fontSize: 13, fontWeight: 700, color: done.failed ? colors.warning : colors.success, marginBottom: 10 } },
                [done.added && tl(`أُضيفت ${done.added}`, `Added ${done.added}`), done.dup && tl(`${done.dup} كانت مسجّلة من قبل فلم تُكرَّر`, `${done.dup} already recorded, not added again`),
                    done.failed && tl(`${done.failed} لم تُحفظ (أكمل المبلغ والتاريخ والفئة)`, `${done.failed} not saved (complete amount, date and category)`)].filter(Boolean).join(" · ")),
            rows.length > 0 && h(Btn, { onClick: save, disabled: busy || !chosen.length, style: { width: "100%" } },
                busy && !stage ? tl("جارٍ الحفظ…", "Saving…") : tl(`إضافة ${chosen.length} إلى السجلّ`, `Add ${chosen.length} to the ledger`)),
            rows.length > 0 && h(Btn, { kind: "ghost", onClick: impClear, disabled: busy, style: { width: "100%", marginTop: 8 } }, tl("إنهاء الدفعة ومسح القائمة", "Finish this batch and clear the list")),
            rows.length > 0 && h("div", { style: { fontSize: 11, color: colors.textMuted, marginTop: 8, textAlign: "center", lineHeight: 1.6 } },
                tl("يمكنك إغلاق هذه الشاشة: القراءة تستمرّ، وتعود إليها من شريط «الاستيراد» في المحاسب. القائمة محفوظة على هاتفك حتى بعد إعادة تشغيل التطبيق.",
                    "You can close this screen: reading goes on, and the «Import» bar in the accountant brings you back. The list is kept on your phone, even after the app restarts.")),
            view && h(PhotoView, { src: view, onClose: () => setView(null) }));
    }

    // ── Sawa Wallet payments → entries. The wallet keeps its own history; here the user picks which ones to record and their
    // category (rules pre-fill it). Handled ones (added or hidden) are remembered on this device; the idemKey stops a double add.
    const WALLET_DONE_KEY = "pfmWalletDone";
    const walletDone = () => { try { return JSON.parse(localStorage.getItem(WALLET_DONE_KEY) || "[]"); } catch (e) { return []; } };
    const markWalletDone = (ids) => { try { const d = walletDone(); localStorage.setItem(WALLET_DONE_KEY, JSON.stringify(d.concat(ids.filter((x) => d.indexOf(x) < 0)).slice(-500))); } catch (e) {} };
    // A stable, UUID-shaped key per wallet payment (same shape as newKey()), so adding the same payment twice is a server no-op.
    function walletKey(id) {
        let hex = "";
        for (let seed = 0; seed < 4; seed++) { let x = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0;
            for (const ch of "wallet:" + id) { x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; }
            hex += x.toString(16).padStart(8, "0"); }
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) + "-a" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
    }
    const WALLET_DAYS = 60;   // offer the last two months only
    function walletPending(walletTx, today) {
        const since = Date.parse(today + "T00:00:00Z") - WALLET_DAYS * 86400000, done = walletDone();
        return (walletTx || []).filter((w) => w && w.id && Number(w.amount) > 0 && w.ts >= since && done.indexOf(w.id) < 0);
    }
    function WalletSheet({ items, cats, rules, tz, today, onClose, onDone }) {
        const { colors } = useTheme();
        const dateOf = (ts) => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(ts); } catch (e) { return new Date(ts).toISOString().slice(0, 10); } };
        const kindOf = (w) => (w.type === "credit" ? "income" : "expense");
        const [rows, setRows] = useState(() => items.map((w) => { const r = matchRule(rules, kindOf(w), w.to || "", w.note || "");
            return { w, on: true, catId: r && cats[r.categoryId] ? r.categoryId : "" }; }));
        const [busy, setBusy] = useState(false), [err, setErr] = useState("");
        const patch = (id, p) => setRows((rs) => rs.map((r) => (r.w.id === id ? Object.assign({}, r, p) : r)));
        const chosen = rows.filter((r) => r.on), ready = chosen.length > 0 && chosen.every((r) => r.catId);
        const add = async () => {
            setBusy(true); setErr(""); const added = [];
            try {
                for (const r of chosen) {
                    const d = dateOf(r.w.ts);
                    await call("pfm.tx.add", { idemKey: walletKey(r.w.id), kind: kindOf(r.w), amount: String(r.w.amount), currency: "SDG", categoryId: r.catId,
                        date: d > today ? today : d, note: r.w.note || null, counterparty: r.w.to || null });
                    added.push(r.w.id);
                }
                markWalletDone(added); onDone(added.length);
            } catch (e) { markWalletDone(added); setErr((added.length ? tl(`أُضيف ${added.length}، ثمّ: `, `Added ${added.length}, then: `) : "") + errText(e)); setBusy(false); }
        };
        const hide = () => { markWalletDone(rows.filter((r) => !r.on).map((r) => r.w.id)); setRows((rs) => rs.filter((r) => r.on)); };
        return h(Sheet, { title: tl("من محفظة سوا", "From Sawa Wallet"), onClose },
            h("p", { style: { fontSize: 13, color: colors.textMuted, lineHeight: 1.6, marginTop: 0 } },
                tl("عمليّات المحفظة في آخر شهرين ولم تُسجَّل هنا. اختر فئة كلٍّ منها ثمّ أضفها. ما لا تريده ألغِ تحديده.", "Wallet payments from the last two months that aren't recorded here. Pick a category for each and add them. Untick any you don't want.")),
            !rows.length && h("p", { style: { fontSize: 14, color: colors.textMuted } }, tl("لا شيء جديد.", "Nothing new.")),
            rows.map((r) => { const inc = r.w.type === "credit";
                const list = Object.values(cats).filter((c) => c.kind === kindOf(r.w) && !c.archived).sort((a, b) => a.order - b.order);
                return h(Card, { key: r.w.id, style: { marginBottom: 10, padding: 12, opacity: r.on ? 1 : 0.6 } },
                    h(Check, { checked: r.on, onChange: (v) => patch(r.w.id, { on: v }) },
                        h("span", { style: { display: "flex", gap: 8, width: "100%" } },
                            h("span", { dir: "auto", style: { flex: 1, fontWeight: 700 } }, r.w.note || r.w.to || tl("عمليّة محفظة", "Wallet payment")),
                            h("bdi", { style: { fontWeight: 800, fontVariantNumeric: "tabular-nums", color: inc ? colors.success : colors.text } }, (inc ? "+" : "−") + money(r.w.amount * Math.pow(10, expOf("SDG")), "SDG")))),
                    h("div", { style: { fontSize: 12, color: colors.textMuted, margin: "-4px 0 8px" } }, dayLabel(dateOf(r.w.ts))),
                    r.on && h("select", { value: r.catId, "aria-label": tl("الفئة", "Category"), onChange: (e) => patch(r.w.id, { catId: e.target.value }), style: inputStyle(colors) },
                        h("option", { value: "" }, tl("اختر فئة…", "Choose a category…")),
                        list.map((c) => h("option", { key: c.id, value: c.id }, catName(c))))); }),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, err),
            chosen.length > 0 && !ready && h("div", { id: "pfm-wallet-why", style: { fontSize: 13, color: colors.textMuted, marginBottom: 8, textAlign: "center" } }, tl("اختر فئة لكلّ عمليّة محدّدة", "Choose a category for each ticked payment")),
            rows.length > 0 && h("div", { style: { display: "flex", gap: 8 } },
                rows.some((r) => !r.on) && h(Btn, { kind: "ghost", onClick: hide, disabled: busy }, tl("إخفاء غير المحدّدة", "Hide unticked")),
                h(Btn, { onClick: add, disabled: busy || !ready, describedBy: chosen.length > 0 && !ready ? "pfm-wallet-why" : undefined, style: { flex: 1 } },
                    busy ? tl("جارٍ الإضافة…", "Adding…") : tl(`أضف ${chosen.length}`, `Add ${chosen.length}`))));
    }
    function Screen({ onBack, walletTx }) {
        const { colors } = useTheme();
        const [boot, setBoot] = useState(null), [bootErr, setBootErr] = useState("");
        const [tab, setTab] = useState("overview");
        const [bizTab, setBizTab] = useState("invoices");   // inside the Business tab: invoices | projects (kept out of the personal tabs)
        const [month, setMonth] = useState(null);
        const [summary, setSummary] = useState(null), [list, setList] = useState(null), [budgets, setBudgets] = useState(null);
        const [sheet, setSheet] = useState(null), [filter, setFilter] = useState(null), [invTick, setInvTick] = useState(0);
        const job = useImport(), jobWaiting = impWaiting();
        const invChanged = () => { setInvTick((n) => n + 1); refresh(); };
        const load = () => { setBootErr(""); call("pfm.get").then((r) => { setBoot(r); if (r.settings) setMonth((m) => m || r.month); }, (e) => setBootErr(errText(e))); };
        useEffect(load, []);
        useEffect(() => { const t = setTimeout(prewarmOcr, 2500); return () => clearTimeout(t); }, []);   // C292
        // Refreshing the same month keeps what's on screen until the new figures arrive (no "Loading…" flash, scroll kept);
        // only a different month clears it. Late replies for a month no longer shown are dropped.
        const shown = useRef(null);
        const refresh = useCallback(() => {
            if (!month) return;
            if (shown.current !== month) { setSummary(null); setList(null); setBudgets(null); shown.current = month; }
            const still = (fn) => (r) => { if (shown.current === month) fn(r); };
            call("pfm.summary", { from: shiftMonth(month, -5), to: month, focus: month }).then(still(setSummary), (e) => setBootErr(errText(e)));
            call("pfm.tx.list", { month }).then(still(setList), (e) => setBootErr(errText(e)));
            call("pfm.budget.list", { month }).then(still(setBudgets), () => setBudgets({ budgets: [] }));
        }, [month]);
        const { showToast } = useToast();
        const reloadAll = () => { load(); refresh(); };
        imp.onSaved = reloadAll;   // a batch saved while this screen is open refreshes it (a screen opened later loads anyway)
        useEffect(() => () => { imp.onSaved = null; }, []);
        const confirmTx = (t) => call("pfm.tx.confirm", { id: t.id, rev: t.rev }).then(reloadAll, (e) => setBootErr(errText(e)));
        const skipTx = (t) => call("pfm.tx.delete", { id: t.id, rev: t.rev }).then(reloadAll, (e) => setBootErr(errText(e)));
        const dismissAlerts = () => { const ids = ((boot && boot.alerts) || []).map((a) => a.id); setBoot(Object.assign({}, boot, { alerts: [] })); call("pfm.alerts.read", { ids }).catch(() => {}); };
        const goSuggested = () => { const m = boot.month; setFilter(null); setTab("ledger"); if (month !== m) setMonth(m); };
        useEffect(refresh, [refresh]);
        const cats = useMemo(() => { const m = {}; ((boot && boot.categories) || []).forEach((c) => { m[c.id] = c; }); return m; }, [boot]);
        const s = boot && boot.settings;
        imp.cats = cats;
        useEffect(() => { if (s) impRestore(); }, [!!s]);   // C281: a batch kept from before the app restarted
        const cur = s && s.baseCurrency;
        const [walletTick, setWalletTick] = useState(0);   // re-reads the "handled" list after the wallet sheet adds or hides
        const walletItems = useMemo(() => (boot && boot.today ? walletPending(walletTx, boot.today) : []), [walletTx, boot, walletTick]);
        const body = bootErr ? h(Card, { style: { margin: 16 } }, h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 10 } }, bootErr), h(Btn, { onClick: () => { load(); refresh(); } }, tl("إعادة المحاولة", "Try again")))
            : !boot ? h(Loading)
            : !s ? h(Onboarding, { onDone: (r) => { setBoot(r); setMonth(r.month); } })
            : h("div", { style: { padding: 16, paddingBottom: 96 } },
                (job.busy || jobWaiting > 0) && !(sheet && sheet.type === "import") && h("button", { type: "button", onClick: () => setSheet({ type: "import" }),
                    style: { width: "100%", display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid " + TEAL,
                        backgroundColor: TEAL + "14", color: colors.text, fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "start" } },
                    h(Upload, { size: 18, color: tealInk(), style: { flexShrink: 0 } }),
                    h("span", { "aria-live": "polite", style: { flex: 1 } }, job.busy && job.stage ? tl("استيراد الإيصالات: ", "Importing receipts: ") + job.stage
                        : tl(`استيراد الإيصالات: ${jobWaiting} بانتظار المراجعة والإضافة`, `Importing receipts: ${jobWaiting} waiting for review`)),
                    h("span", { style: { color: tealInk(), whiteSpace: "nowrap" } }, tl("فتح", "Open"))),
                h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 } },
                    h("button", { type: "button", "aria-label": tl("الشهر السابق", "Previous month"), onClick: () => setMonth(shiftMonth(month, -1)), style: navBtn(colors) }, h(ar() ? ChevronRight : ChevronLeft, { size: 20 })),
                    h("div", { style: { flex: 1, textAlign: "center", fontWeight: 800, fontSize: 16 } }, monthName(month)),
                    h("button", { type: "button", "aria-label": tl("الشهر التالي", "Next month"), disabled: month >= boot.month, onClick: () => setMonth(shiftMonth(month, 1)), style: Object.assign(navBtn(colors), { opacity: month >= boot.month ? 0.35 : 1 }) }, h(ar() ? ChevronLeft : ChevronRight, { size: 20 }))),
                h("div", { style: { marginBottom: 14 } }, h(Seg, { tabs: true, idBase: "pfm", label: tl("أقسام المحاسب", "Accountant sections"), value: tab, onChange: setTab, options: [{ value: "overview", label: tl("نظرة عامّة", "Overview") }, { value: "ledger", label: tl("السجلّ", "Ledger") }, { value: "budgets", label: tl("الميزانيّات", "Budgets") }, { value: "business", label: tl("الأعمال", "Business") }] })),
                h("div", { role: "tabpanel", id: "pfm-panel", "aria-labelledby": "pfm-tab-" + tab },
                tab === "business" && h("div", { style: { marginBottom: 14 } }, h(Seg, { tabs: true, idBase: "pfm-biz", label: tl("الأعمال", "Business"), value: bizTab, onChange: setBizTab, options: [{ value: "invoices", label: tl("الفواتير", "Invoices") }, { value: "projects", label: tl("المشاريع", "Projects") }] })),
                tab === "overview"
                    ? h(Overview, { data: summary, cats, cur, onAdd: () => setSheet({}), onPickCat: (id) => { setFilter(id); setTab("ledger"); },
                        alerts: boot.month === month ? boot.alerts : [], suggestedCount: boot.suggestedCount, budgets: budgets && budgets.budgets,
                        onDismissAlerts: dismissAlerts, onGoSuggested: goSuggested, onGoBudgets: () => setTab("budgets"), onGoLedger: () => setTab("ledger"), claimsCount: boot.claimsCount || 0, onGoInvoices: () => { setBizTab("invoices"); setTab("business"); }, walletCount: walletItems.length, onGoWallet: () => setSheet({ type: "wallet" }),
                        ruler: (() => { const per = periodOf(month, s.monthStartDay), past = month < boot.month;
                            const t = Date.parse(boot.today + "T00:00:00Z"); const el = past ? per.days : Math.min(per.days, Math.max(0, Math.round((t - per.start) / 86400000) + 1));
                            return month > boot.month ? null : { days: per.days, elapsed: el, past }; })() })
                    : tab === "ledger"
                    ? h(Ledger, { list, cats, base: cur, filter, onClearFilter: () => setFilter(null), onOpen: (t) => setSheet({ tx: t }), onAdd: () => setSheet({}),
                        onConfirm: confirmTx, onSkip: skipTx, recurringCount: (boot.recurring || []).length, rulesCount: (boot.rules || []).length,
                        onRecurring: () => setSheet({ type: "recurring" }), onRules: () => setSheet({ type: "rules" }), onExport: () => setSheet({ type: "export" }), onImport: () => setSheet({ type: "import" }), importCount: jobWaiting })
                    : tab === "budgets"
                    ? h(Budgets, { data: budgets, cats, cur, onAdd: () => setSheet({ type: "budget" }), onEdit: (b) => setSheet({ type: "budget", budget: b }) })
                    : h("div", { role: "tabpanel", id: "pfm-biz-panel", "aria-labelledby": "pfm-biz-tab-" + bizTab }, bizTab === "projects"
                    ? h(ProjectsView, { base: cur, today: boot.today, cats })
                    : h(Invoices, { key: invTick, cur, today: boot.today, onOpen: (id) => setSheet({ type: "invoice", id }), onNew: () => setSheet({ type: "editor" }), onBiz: () => setSheet({ type: "biz" }) }))));
        return h(ServiceTheme, { color: TEAL },
            h("div", { dir: ar() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col", style: { color: colors.text } },
                h(DialogHost),
                h(TopBar, { title: tl("المحاسب الشخصيّ", "Personal accountant"), subtitle: cur ? tl("المجاميع بـ", "Totals in ") + cur : undefined, onBack }),
                h("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } }, body),
                s && tab !== "budgets" && tab !== "business" && h("button", { type: "button", "aria-label": tl("حركة جديدة", "New entry"), onClick: () => setSheet({}),
                    style: { position: "fixed", insetInlineEnd: 20, bottom: "calc(env(safe-area-inset-bottom,0px) + 24px)", width: 56, height: 56, borderRadius: 28, border: 0,
                        backgroundColor: TEAL, color: "#fff", boxShadow: "0 6px 16px rgba(15,118,110,.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 40 } }, h(Plus, { size: 26 })),
                sheet && s && !sheet.type && h(TxSheet, { tx: sheet.tx, settings: s, cats, today: boot.today, rules: boot.rules, onClose: () => setSheet(null),
                    onSaved: (t) => { setSheet(null); reloadAll(); showToast(t ? tl("حُفظت الحركة", "Entry saved") : tl("حُذفت الحركة", "Entry deleted")); } }),
                sheet && s && sheet.type === "budget" && h(BudgetSheet, { budget: sheet.budget, existing: ((budgets && budgets.budgets) || []).map((b) => b.categoryId), cats, cur,
                    onClose: () => setSheet(null), onSaved: () => { setSheet(null); refresh(); showToast(tl("حُفظت الميزانيّات", "Budgets updated")); } }),
                sheet && s && sheet.type === "recurring" && h(RecurringSheet, { items: boot.recurring || [], cats, onClose: () => setSheet(null), onChanged: reloadAll }),
                sheet && s && sheet.type === "invoice" && h(InvoiceDetail, { id: sheet.id, base: cur, today: boot.today, onClose: () => setSheet(null), onChanged: invChanged,
                    onEdit: (inv) => setSheet({ type: "editor", inv }) }),
                sheet && s && sheet.type === "editor" && h(InvoiceEditor, { inv: sheet.inv, base: cur, today: boot.today, onClose: () => setSheet(null),
                    onSaved: (inv) => { invChanged(); setSheet({ type: "invoice", id: inv.id }); } }),
                sheet && s && sheet.type === "biz" && h(BizSheet, { base: cur, onClose: () => { setSheet(null); invChanged(); }, onSaved: () => { setSheet(null); invChanged(); } }),
                sheet && s && sheet.type === "export" && h(ExportSheet, { month, latest: boot.month, onClose: () => setSheet(null) }),
                sheet && s && sheet.type === "import" && h(ImportSheet, { cats, onClose: () => setSheet(null) }),
                sheet && s && sheet.type === "wallet" && h(WalletSheet, { items: walletItems, cats, rules: boot.rules || [], tz: s.tz, today: boot.today,
                    onClose: () => { setSheet(null); setWalletTick((n) => n + 1); },
                    onDone: (n) => { setSheet(null); setWalletTick((x) => x + 1); reloadAll(); showToast(tl(`أُضيفت ${n} من المحفظة`, `Added ${n} from the wallet`)); } }),
                sheet && s && sheet.type === "rules" && h(RulesSheet, { rules: boot.rules || [], cats, onClose: () => setSheet(null), onChanged: reloadAll })));
    }
    const navBtn = (colors) => ({ width: 44, height: 44, borderRadius: 22, border: "1px solid " + colors.border, backgroundColor: colors.card, color: colors.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" });
    return Screen;
})();

function App() {
    // C26: المظهر كان في useState فيضيع مع كلّ إعادة تحميل (ومنها التحديث) — صار محفوظاً
    // C192: أوّل تشغيل يتبع مظهر الهاتف (null = لم يختر)، حتّى يختار المستخدم بنفسه. من اختار سابقاً يبقى على اختياره.
    const [darkPref, setDarkPref] = usePersistedState("ui.dark", null, 50);
    const [sysDark, setSysDark] = useState(() => { try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; } });
    useEffect(() => {
        let mq; try { mq = window.matchMedia("(prefers-color-scheme: dark)"); } catch (e) { return; }
        const on = (e) => setSysDark(e.matches);
        if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on);
        return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else if (mq.removeListener) mq.removeListener(on); };
    }, []);
    const isDark = typeof darkPref === "boolean" ? darkPref : sysDark;
    // مفتاح إعادة البناء عند تبديل اللغة. اللغة تعيش في window لا في
    // حالة React، فنستمع لحدث يبثّه setLocale.
    const [langTick, setLangTick] = useState(function () { try { return localStorage.getItem("sawaLang") || "ar"; } catch (e) { return "ar"; } });
    useEffect(function () {
        function onLang(e) { setLangTick((e && e.detail) || Math.random()); }
        window.addEventListener("sawa-lang", onLang);
        return function () { window.removeEventListener("sawa-lang", onLang); };
    }, []);
    // ⛔ سطرٌ واحد يميّز هويّة التطبيقين بصرياً: كلّ الألوان تُشتقّ منه،
    // فلا حاجة إلى تجهيل عشرات المواضع بـIS_RAHIM.
    const [accentKey0, setAccentKey] = usePersistedState("ui.accent", IS_RAHIM ? "green" : "sawa", 50);
    const accentKey = ACCENT_THEMES[accentKey0] ? accentKey0 : (IS_RAHIM ? "green" : "sawa");
    const [fontScale0, setFontScale] = usePersistedState("ui.fontScale", 1, 50);
    const fontScale = typeof fontScale0 === "number" && fontScale0 >= 0.8 && fontScale0 <= 1.4 ? (fontScale0 === 1.3 ? 1.35 : fontScale0) : 1;   // C154: «أكبر» صار 1.35
    const [highContrast, setHighContrast] = usePersistedState("ui.contrast", false, 50);
    const [dataSaver, setDataSaver] = usePersistedState("dataSaver", false);
    const accent = ACCENT_THEMES[accentKey];
    const base = isDark ? darkColors : lightColors;
    const colors = {
        ...base,
        primary: isDark ? (accent.accentOnDark || accent.accent) : accent.accent,   // C192
        primaryDark: accent.accentDark,
        // C193: نصٌّ على الخلفيّة الملوّنة الفاتحة (primaryLight). في الفاتح = primaryDark كما كان؛ في الداكن الخلفيّة داكنة فيصير فاتحاً — كان الحرف في صور المحادثات لا يُرى.
        primaryInk: isDark ? accent.accentTint : accent.accentDark,
        primaryLight: isDark ? base.primaryLight : accent.accentTint,
        // C204: تعبئة الزرّ الثانويّ المحايد (إلغاء/رجوع…) — صلبٌ بلا حدّ رفيع. يُنشر ‎--sawa-btn-fill‎ لنوافذ sawa-chat أيضاً
        btnFill: isDark ? "#2B323C" : "#E7ECF2",
        // تباين عالٍ: نص أسود/أبيض خالص + حدود أوضح، بدل الدرجات المتوسطة
        ...(highContrast
            ? { text: isDark ? "#FFFFFF" : "#000000", border: isDark ? "#5B6B7C" : "#8A93A0", textMuted: isDark ? "#DFE5EC" : "#3D4450" }
            : {}),
    };
    const theme = {
        colors, isDark, toggleDark: () => setDarkPref(!isDark),
        accentKey, setAccentKey, accentThemes: ACCENT_THEMES,
        fontScale, setFontScale, highContrast, setHighContrast,
        dataSaver, setDataSaver,
    };
    // C187: الألوان متغيّراتُ CSS على الجذر (‎--sawa-primary‎، ‎--sawa-text-muted‎…) + color-scheme، لما ليس داخل React
    //   (شاشة التحميل، واجهات sawa-chat/sawa-rtc). ونحفظ المظهر لشاشة التحميل في الزيارة التالية.
    useEffect(() => {
        const r = document.documentElement;
        Object.keys(colors).forEach((k) => { r.style.setProperty("--sawa-" + k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), colors[k]); });
        r.style.colorScheme = isDark ? "dark" : "light";
        r.setAttribute("data-theme", isDark ? "dark" : "light");
        try { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", isDark ? colors.bg : colors.primary); } catch (e) {}
    }, [isDark, accentKey, highContrast]);
    // حجم الخط: نطبّقه على الجذر عشان يؤثّر على كل وحدات rem المستخدمة بكل مكوّنات
    // Tailwind (text-xs/text-sm/...) — تأثير حقيقي وشامل، مو محلي لشاشة وحدة بس
    useEffect(() => {
        // C154: الخطّ وحده يكبر (لا الأزرار والمسافات) — كان الجذر كلّه يكبر فتضيق رؤوس الشاشات وحقل الكتابة بينما نصوص البكسل لا تتغيّر
        document.documentElement.style.fontSize = "";
        // C154: النصوص المحدّدة بالبكسل (text-[11px]… وخطوط شاشات المحادثات واللحظات) والأيقونات كانت لا تكبر ⇒ متغيّر --sfs
        document.documentElement.style.setProperty("--sfs", String(fontScale));
        if (!document.getElementById("sawa-fs-css")) {
            const st = document.createElement("style"); st.id = "sawa-fs-css";
            // C188: الحرف العربيّ يحتاج حجماً أكبر من اللاتينيّ ليُقرأ — النصوص الصغيرة تكبر (9 ⇐ 11، 10 ⇐ 11.5، 11 ⇐ 12، 12 ⇐ 13)، و13 فما فوق بلا تغيير.
            //   الاسم يبقى (text-[10px]) والحجم المعروض من هذا الجدول؛ 7 و8 للشارات الصغيرة فتكبر قليلاً فقط.
            // C289: أصغر نصٍّ معروض صار 12 بكسل (كان 11): 9 و9.5 و10 ⇐ 12، و10.5 و11 ⇐ 12.5، و11.5 ⇐ 13. الشارات (7 و8) تكبر قليلاً.
            const SFS_MAP = { "7": 9, "8": 10, "9": 12, "9.5": 12, "10": 12, "10.5": 12.5, "11": 12.5, "11.5": 13, "12": 13, "12.5": 13.5 };
            st.textContent = ["7", "8", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14", "14.5", "15", "16", "17", "19", "22"].map((n) => `.text-\\[${n.replace(".", "\\.")}px\\]{font-size:calc(${SFS_MAP[n] || n}px * var(--sfs, 1))}`).join("")
                + [["xs", .8125, 1.125], ["sm", .875, 1.3125], ["base", 1, 1.5], ["lg", 1.125, 1.75], ["xl", 1.25, 1.75], ["2xl", 1.5, 2], ["3xl", 1.875, 2.25], ["4xl", 2.25, 2.5]].map(([k, f, l]) => `.text-${k}{font-size:calc(${f}rem * var(--sfs, 1));line-height:calc(${l}rem * var(--sfs, 1))}`).join("")
                + [["4", 1], ["5", 1.25], ["7", 1.75], ["8", 2]].map(([k, l]) => `.leading-${k}{line-height:calc(${l}rem * var(--sfs, 1))}`).join("")
                + "body{font-size:calc(1rem * var(--sfs, 1))}";
            document.head.appendChild(st);
        }
        return () => { document.documentElement.style.fontSize = ""; document.documentElement.style.removeProperty("--sfs"); };
    }, [fontScale]);
    return (React.createElement(ErrorBoundary, null,
        React.createElement(ThemeContext.Provider, { value: theme },
            React.createElement(ToastProvider, null,
                // key باللغة: تغييرها يعيد بناء الشجرة كاملة، فتُقرأ
                // rowStart/textStart/t من جديد. بدونه لا يتغيّر شيء
                // لأن اللغة تعيش في window لا في حالة React.
                React.createElement(AppInner, { key: langTick })))));
}

window.SawaApp = App;

// ═══ التركيب ═══
const rootEl = document.getElementById('root');
ReactDOM.createRoot(rootEl).render(React.createElement(window.SawaApp));
setTimeout(() => {
  const b = document.getElementById('boot');
  if (b) { b.style.opacity = '0'; setTimeout(() => b.remove(), 300); }
}, 400);

//@@sawa-part:9
