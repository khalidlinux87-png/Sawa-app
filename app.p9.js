// ═══ C263: المحاسب الشخصيّ (Personal Accountant, P1) ═══
// Onboarding (base currency, time zone, month start) · Overview (KPIs, cash flow, categories, 6-month trend) · Ledger (add/edit/delete).
// Server: pfm.* ops in the Worker (Sawa-deploy-test/pfm). The client never computes stored totals; it shows what the server returns.
// One top-level name only (AccountantScreen) so nothing collides with the rest of the joined app script.
const AccountantScreen = (function () {
    const h = React.createElement;
    const TEAL = "#0f766e";
    const L = window.__L || {};
    const ICONS = { cart: "ShoppingBag", home: "Home", bolt: "Zap", car: "Car", phone: "Smartphone", heart: "Heart", book: "Bookmark", users: "Users",
        wrench: "Settings", percent: "Target", dots: "MoreHorizontal", briefcase: "Briefcase", laptop: "Server", receipt: "FileText", gift: "Gift",
        plus: "Plus", tag: "Bookmark", cup: "Coffee" };
    const iconOf = (name) => L[ICONS[name]] || L.Circle || L.Bookmark;
    const ar = () => isRTL();
    const locale = () => (ar() ? "ar-u-nu-latn" : "en");
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
    const pct = (bp) => (bp == null ? "—" : (bp / 100).toFixed(Math.abs(bp) >= 1000 ? 0 : 1) + "%");
    const monthName = (m) => { const [y, mo] = m.split("-").map(Number); return new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, 1)); };
    const monthShort = (m) => { const [y, mo] = m.split("-").map(Number); return new Intl.DateTimeFormat(locale(), { month: "short", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, 1)); };
    const dayLabel = (d) => { const [y, mo, da] = d.split("-").map(Number); return new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, da)); };
    const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
    const newKey = () => { try { return crypto.randomUUID(); } catch (e) { return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); } };
    const catName = (c) => (c ? (ar() ? c.nameAr || c.name : c.name) : tl("بلا فئة", "Uncategorised"));

    // ── currencies: common ones first, then every currency the browser knows ──
    const COMMON = ["USD", "EUR", "GBP", "SAR", "AED", "EGP", "SDG", "QAR", "KWD", "BHD", "OMR", "JOD", "MAD", "TRY", "INR", "PKR", "NGN", "KES", "JPY", "CNY", "CAD", "AUD"];
    function currencyList() {
        let all = COMMON;
        try { if (Intl.supportedValuesOf) all = Intl.supportedValuesOf("currency"); } catch (e) {}
        let names = null; try { names = new Intl.DisplayNames([ar() ? "ar" : "en"], { type: "currency" }); } catch (e) {}
        const label = (c) => c + (names ? " — " + names.of(c) : "");
        const rest = all.filter((c) => COMMON.indexOf(c) < 0);
        return COMMON.filter((c) => all.indexOf(c) >= 0 || all === COMMON).concat(rest).map((c) => ({ code: c, label: label(c) }));
    }
    // a suggestion only: the user always confirms the currency
    const REGION_CUR = { US: "USD", GB: "GBP", SA: "SAR", AE: "AED", EG: "EGP", SD: "SDG", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD", MA: "MAD",
        TR: "TRY", IN: "INR", PK: "PKR", NG: "NGN", KE: "KES", JP: "JPY", CN: "CNY", CA: "CAD", AU: "AUD", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
        IE: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", IQ: "IQD", LB: "LBP", LY: "LYD", TN: "TND", DZ: "DZD", YE: "YER", SY: "SYP", SS: "SSP", ET: "ETB", ZA: "ZAR", BR: "BRL", MX: "MXN", ID: "IDR", MY: "MYR", SE: "SEK", NO: "NOK", CH: "CHF" };
    function guessCurrency() {
        try { const r = new Intl.Locale(navigator.language).maximize().region; if (REGION_CUR[r]) return REGION_CUR[r]; } catch (e) {}
        return "USD";
    }

    // ── shared bits ──
    function Card({ children, style }) {
        const { colors } = useTheme();
        return h("div", { style: Object.assign({ backgroundColor: colors.card, border: "1px solid " + colors.border, borderRadius: 16, padding: 14 }, style) }, children);
    }
    function Btn({ children, onClick, kind, disabled, style, label }) {
        const { colors } = useTheme();
        const primary = kind !== "ghost" && kind !== "danger";
        return h("button", { type: "button", onClick, disabled, "aria-label": label, style: Object.assign({
            minHeight: 44, padding: "10px 16px", borderRadius: 12, border: primary ? 0 : "1px solid " + (kind === "danger" ? colors.danger : colors.border),
            backgroundColor: primary ? TEAL : "transparent", color: primary ? "#fff" : kind === "danger" ? colors.danger : colors.text,
            fontWeight: 700, fontSize: 14, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }, style) }, children);
    }
    // A <label> wrapping several buttons would name (and click) only the first one, so groups get role="group".
    function Field({ label, children, hint, group }) {
        const { colors } = useTheme();
        return h(group ? "div" : "label", group ? { role: "group", "aria-label": label, style: { display: "block", marginBottom: 12 } } : { style: { display: "block", marginBottom: 12 } },
            h("div", { style: { fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 6 } }, label),
            children,
            hint && h("div", { style: { fontSize: 11, color: colors.textMuted, marginTop: 4 } }, hint));
    }
    const inputStyle = (colors) => ({ width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 12, border: "1px solid " + colors.border, backgroundColor: colors.bg, color: colors.text, fontSize: 15, boxSizing: "border-box" });
    function Seg({ options, value, onChange }) {
        const { colors } = useTheme();
        return h("div", { role: "tablist", style: { display: "flex", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.bg, border: "1px solid " + colors.border } },
            options.map((o) => h("button", { key: o.value, role: "tab", "aria-selected": value === o.value, type: "button", onClick: () => onChange(o.value),
                style: { flex: 1, minHeight: 36, borderRadius: 9, border: 0, fontWeight: 700, fontSize: 13, cursor: "pointer",
                    backgroundColor: value === o.value ? colors.card : "transparent", color: value === o.value ? (o.color || colors.text) : colors.textMuted,
                    boxShadow: value === o.value ? "0 1px 2px rgba(0,0,0,.12)" : "none" } }, o.label)));
    }
    function Sheet({ title, onClose, children }) {
        const { colors } = useTheme();
        useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
        return h("div", { role: "dialog", "aria-modal": true, "aria-label": title, dir: ar() ? "rtl" : "ltr", onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
            style: { position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" } },
            h("div", { style: { width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", backgroundColor: colors.card, color: colors.text,
                borderRadius: "20px 20px 0 0", padding: "16px 16px calc(env(safe-area-inset-bottom,0px) + 16px)" } },
                h("div", { style: { display: "flex", alignItems: "center", marginBottom: 12 } },
                    h("div", { style: { flex: 1, fontWeight: 800, fontSize: 17 } }, title),
                    h("button", { type: "button", onClick: onClose, "aria-label": tl("إغلاق", "Close"), style: { width: 40, height: 40, border: 0, borderRadius: 20, backgroundColor: colors.bg, color: colors.text, cursor: "pointer" } }, h(X, { size: 18 }))),
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
    function Kpi({ label, value, color, sub }) {
        const { colors } = useTheme();
        return h(Card, { style: { padding: 12, minWidth: 0 } },
            h("div", { style: { fontSize: 12, color: colors.textMuted, fontWeight: 600 } }, label),
            h("div", { dir: "ltr", style: { fontSize: 18, fontWeight: 800, color: color || colors.text, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: ar() ? "right" : "left" } }, value),
            sub && h("div", { style: { fontSize: 11, color: colors.textMuted, marginTop: 2 } }, sub));
    }
    function CashFlow({ days, cur, month }) {
        const { colors } = useTheme();
        const [y, m] = month.split("-").map(Number); const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const by = {}; (days || []).forEach((d) => { by[d.day] = d; });
        const max = Math.max(1, ...(days || []).map((d) => Math.max(d.income, d.expense)));
        const W = 320, H = 120, bw = W / n;
        const [tip, setTip] = useState(null);
        return h(Card, null,
            h("div", { style: { fontWeight: 800, fontSize: 14, marginBottom: 8 } }, tl("التدفّق النقديّ اليوميّ", "Daily cash flow")),
            h("svg", { viewBox: `0 0 ${W} ${H + 16}`, width: "100%", role: "img", "aria-label": tl("الدخل والمصروف لكلّ يوم", "Income and spending per day"), style: { display: "block", direction: "ltr" } },
                h("line", { x1: 0, x2: W, y1: H / 2, y2: H / 2, stroke: colors.border }),
                Array.from({ length: n }, (_, i) => { const d = by[i + 1] || { income: 0, expense: 0 }, x = i * bw;
                    const hi = (d.income / max) * (H / 2 - 4), he = (d.expense / max) * (H / 2 - 4);
                    return h("g", { key: i, onMouseEnter: () => setTip(i + 1), onClick: () => setTip(i + 1) },
                        h("rect", { x: x, y: 0, width: bw, height: H, fill: "transparent" }),
                        hi > 0 && h("rect", { x: x + 1, y: H / 2 - hi, width: Math.max(bw - 2, 1), height: hi, rx: 1.5, fill: colors.success }),
                        he > 0 && h("rect", { x: x + 1, y: H / 2, width: Math.max(bw - 2, 1), height: he, rx: 1.5, fill: colors.danger, opacity: 0.85 })); }),
                [1, 10, 20, n].map((d) => h("text", { key: d, x: (d - 0.5) * bw, y: H + 12, fontSize: 9, fill: colors.textMuted, textAnchor: "middle" }, String(d)))),
            h("div", { style: { display: "flex", gap: 14, fontSize: 12, color: colors.textMuted, marginTop: 6, flexWrap: "wrap" } },
                h("span", null, h("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 2, backgroundColor: colors.success, marginInlineEnd: 6 } }), tl("دخل", "Income")),
                h("span", null, h("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 2, backgroundColor: colors.danger, marginInlineEnd: 6 } }), tl("مصروف", "Spending")),
                tip && h("span", { dir: "auto", style: { marginInlineStart: "auto", color: colors.text, fontWeight: 600 } },
                    `${tip}: +${money((by[tip] || {}).income || 0, cur)} / −${money((by[tip] || {}).expense || 0, cur)}`)));
    }
    function Categories({ rows, cats, cur, onPick }) {
        const { colors } = useTheme();
        const spend = rows.filter((r) => r.expense > 0);
        if (!spend.length) return null;
        const max = spend[0].expense;
        return h(Card, null,
            h("div", { style: { fontWeight: 800, fontSize: 14, marginBottom: 10 } }, tl("المصروف حسب الفئة", "Spending by category")),
            spend.map((r) => { const c = cats[r.categoryId]; const I = iconOf(c && c.icon);
                return h("button", { key: r.categoryId, type: "button", onClick: () => onPick(r.categoryId), style: { display: "block", width: "100%", textAlign: "start", border: 0, background: "none", padding: "6px 0", color: colors.text, cursor: "pointer" } },
                    h("div", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 } },
                        h(I, { size: 16, color: (c && c.color) || colors.textMuted }),
                        h("span", { style: { flex: 1, fontWeight: 600 } }, catName(c)),
                        h("span", { dir: "ltr", style: { fontWeight: 700 } }, money(r.expense, cur)),
                        h("span", { style: { width: 44, textAlign: "end", color: colors.textMuted, fontSize: 12 } }, pct(r.shareBp))),
                    h("div", { style: { height: 6, borderRadius: 3, backgroundColor: colors.bg, marginTop: 6, overflow: "hidden" } },
                        h("div", { style: { width: Math.max(2, (r.expense / max) * 100) + "%", height: "100%", borderRadius: 3, backgroundColor: (c && c.color) || TEAL } }))); }));
    }
    function Trend({ months, cur }) {
        const { colors } = useTheme();
        if (!months || months.length < 2) return null;
        const max = Math.max(1, ...months.map((m) => Math.abs(m.net)));
        const W = 320, H = 110, bw = W / months.length;
        return h(Card, null,
            h("div", { style: { fontWeight: 800, fontSize: 14, marginBottom: 8 } }, tl("صافي آخر الشهور", "Net by month")),
            h("svg", { viewBox: `0 0 ${W} ${H + 18}`, width: "100%", role: "img", "aria-label": tl("صافي كلّ شهر", "Net per month"), style: { display: "block", direction: "ltr" } },
                h("line", { x1: 0, x2: W, y1: H / 2, y2: H / 2, stroke: colors.border }),
                months.map((m, i) => { const v = (Math.abs(m.net) / max) * (H / 2 - 6), pos = m.net >= 0;
                    return h("g", { key: m.month },
                        h("title", null, monthName(m.month) + ": " + money(m.net, cur)),
                        v > 0 && h("rect", { x: i * bw + bw * 0.2, y: pos ? H / 2 - v : H / 2, width: bw * 0.6, height: v, rx: 3, fill: pos ? colors.success : colors.danger }),
                        h("text", { x: i * bw + bw / 2, y: H + 13, fontSize: 9.5, fill: colors.textMuted, textAnchor: "middle" }, monthShort(m.month))); })));
    }
    function Overview({ data, cats, cur, onPickCat, onAdd }) {
        const { colors } = useTheme();
        if (!data) return h(Loading);
        const f = data.focus;
        if (!f.txCount) return h(Empty, { onAdd });
        return h("div", { style: { display: "grid", gap: 12 } },
            f.ratePending > 0 && h(Card, { style: { borderColor: colors.warning, padding: 10, fontSize: 13 } },
                tl(`${f.ratePending} من الحركات تنتظر سعر صرف، ولم تُحسب في المجاميع`, `${f.ratePending} entries need an exchange rate and aren't in the totals yet`)),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } },
                h(Kpi, { label: tl("الدخل", "Income"), value: money(f.income, cur), color: colors.success }),
                h(Kpi, { label: tl("المصروف", "Spending"), value: money(f.expense, cur), color: colors.danger }),
                h(Kpi, { label: tl("الصافي", "Net"), value: money(f.net, cur), color: f.net < 0 ? colors.danger : colors.text }),
                h(Kpi, { label: tl("نسبة الادّخار", "Savings rate"), value: pct(f.savingsRateBp), sub: tl("من الدخل", "of income") })),
            h(CashFlow, { days: f.days, cur, month: f.month }),
            h(Categories, { rows: f.byCategory, cats, cur, onPick: onPickCat }),
            h(Trend, { months: data.months, cur }));
    }
    function Loading() { const { colors } = useTheme(); return h("div", { role: "status", style: { padding: 32, textAlign: "center", color: colors.textMuted, fontSize: 13 } }, tl("جارٍ التحميل…", "Loading…")); }
    function Empty({ onAdd }) {
        const { colors } = useTheme();
        return h(Card, { style: { textAlign: "center", padding: 24 } },
            h(BarChart3, { size: 32, color: TEAL }),
            h("div", { style: { fontWeight: 800, marginTop: 8 } }, tl("لا حركات في هذا الشهر", "No entries this month")),
            h("p", { style: { fontSize: 13, color: colors.textMuted, margin: "6px 0 14px" } }, tl("سجّل دخلك ومصروفاتك لترى أين يذهب مالك.", "Record income and spending to see where your money goes.")),
            h(Btn, { onClick: onAdd }, tl("سجّل أوّل حركة", "Add your first entry")));
    }

    // ── ledger ──
    function Ledger({ list, cats, base, filter, onClearFilter, onOpen, onAdd }) {
        const { colors } = useTheme();
        if (!list) return h(Loading);
        const items = filter ? list.items.filter((t) => t.categoryId === filter) : list.items;
        if (!list.items.length) return h(Empty, { onAdd });
        const groups = []; items.forEach((t) => { const g = groups[groups.length - 1]; if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] }); });
        return h("div", null,
            filter && h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13 } },
                h("span", { style: { color: colors.textMuted } }, tl("الفئة:", "Category:")), h("b", null, catName(cats[filter])),
                h("button", { type: "button", onClick: onClearFilter, style: { marginInlineStart: "auto", border: 0, background: "none", color: TEAL, fontWeight: 700, cursor: "pointer", minHeight: 36 } }, tl("عرض الكلّ", "Show all"))),
            groups.map((g) => h("div", { key: g.date, style: { marginBottom: 12 } },
                h("div", { style: { fontSize: 12, fontWeight: 700, color: colors.textMuted, margin: "0 4px 6px" } }, dayLabel(g.date)),
                h(Card, { style: { padding: 0 } }, g.items.map((t, i) => {
                    const c = cats[t.categoryId], I = iconOf(c && c.icon), inc = t.kind === "income";
                    return h("button", { key: t.id, type: "button", onClick: () => onOpen(t), style: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", border: 0,
                        borderTop: i ? "1px solid " + colors.border : 0, background: "none", color: colors.text, textAlign: "start", cursor: "pointer", minHeight: 56 } },
                        h("span", { style: { width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: ((c && c.color) || TEAL) + "22", flexShrink: 0 } }, h(I, { size: 17, color: (c && c.color) || TEAL })),
                        h("span", { style: { flex: 1, minWidth: 0 } },
                            h("div", { dir: "auto", style: { fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: ar() ? "right" : "left" } }, t.counterparty || catName(c)),   // Latin names in Arabic stay on the start side
                            h("div", { dir: "auto", style: { fontSize: 12, color: colors.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: ar() ? "right" : "left" } }, t.counterparty ? catName(c) + (t.note ? " · " + t.note : "") : t.note || "")),
                        h("span", { style: { textAlign: "end", flexShrink: 0 } },
                            h("div", { dir: "ltr", style: { fontWeight: 800, fontSize: 14, color: inc ? colors.success : colors.text } }, (inc ? "+" : "−") + money(t.amount, t.currency)),
                            t.currency !== base && h("div", { dir: "ltr", style: { fontSize: 11, color: t.baseAmount == null ? colors.warning : colors.textMuted } },
                                t.baseAmount == null ? tl("بانتظار السعر", "rate needed") : "≈ " + money(t.baseAmount, base))));
                })))));
    }

    // ── add / edit sheet ──
    function TxSheet({ tx, settings, cats, today, onClose, onSaved }) {
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
        const key = useRef(newKey());
        const curs = useMemo(currencyList, []);
        useEffect(() => { // pre-fill the user's own last rate for this pair
            if (cur === base || rate) return;
            call("pfm.fx.last", { from: cur }).then((r) => { if (r && r.rate) setRate((v) => v || r.rate); }, () => {});
        }, [cur]);
        const list = Object.values(cats).filter((c) => c.kind === kind && (!c.archived || c.id === catId)).sort((a, b) => a.order - b.order);
        const preview = cur !== base && rate && Number(amount) > 0 && Number(rate) > 0 ? "≈ " + money(Math.round(Number(amount) * Number(rate) * Math.pow(10, expOf(base))), base) : "";
        const save = () => {
            setBusy(true); setErr("");
            const p = { kind, amount: amount.trim(), currency: cur, categoryId: catId, date, note: note.trim() || null, counterparty: who.trim() || null };
            if (cur !== base) p.fxRate = rate.trim() || null; else delete p.fxRate;
            const req = editing ? call("pfm.tx.update", Object.assign({ id: tx.id, rev: tx.rev }, p))
                : call("pfm.tx.add", Object.assign({ idemKey: key.current }, p));
            req.then((r) => onSaved(r.tx), (e) => { setErr(errText(e)); setBusy(false); });
        };
        const del = () => {
            if (!window.confirm(tl("حذف هذه الحركة؟", "Delete this entry?"))) return;
            setBusy(true); call("pfm.tx.delete", { id: tx.id, rev: tx.rev }).then(() => onSaved(null), (e) => { setErr(errText(e)); setBusy(false); });
        };
        const addCat = () => {
            const name = (newCat || "").trim(); if (!name) return;
            call("pfm.cat.upsert", { name, nameAr: name, kind }).then((r) => { cats[r.category.id] = r.category; setCatId(r.category.id); setNewCat(null); }, (e) => setErr(errText(e)));
        };
        const canSave = !busy && Number(amount) > 0 && catId && date;
        return h(Sheet, { title: editing ? tl("تعديل الحركة", "Edit entry") : tl("حركة جديدة", "New entry"), onClose },
            h("div", { style: { marginBottom: 14 } }, h(Seg, { value: kind, onChange: (v) => { setKind(v); setCatId(""); }, options: [
                { value: "expense", label: tl("مصروف", "Spending"), color: colors.danger }, { value: "income", label: tl("دخل", "Income"), color: colors.success }] })),
            h("div", { style: { display: "flex", gap: 8 } },
                h("div", { style: { flex: 2 } }, h(Field, { label: tl("المبلغ", "Amount") },
                    h("input", { dir: "ltr", inputMode: "decimal", autoFocus: !editing, value: amount, placeholder: "0", onChange: (e) => setAmount(e.target.value.replace(/[^0-9.٠-٩٫]/g, "")),   // no commas: the server reads "," as a thousands separator
                        style: Object.assign(inputStyle(colors), { fontSize: 22, fontWeight: 800 }) }))),
                h("div", { style: { flex: 1 } }, h(Field, { label: tl("العملة", "Currency") },
                    h("select", { value: cur, onChange: (e) => { setCur(e.target.value); setRate(""); }, style: inputStyle(colors), "aria-label": tl("العملة", "Currency") },
                        curs.map((c) => h("option", { key: c.code, value: c.code }, c.code)))))),
            cur !== base && h(Field, { label: tl("سعر الصرف: ", "Exchange rate: ") + "\u2066" + `1 ${cur} = ? ${base}` + "\u2069",   // LRI…PDI: the formula stays left-to-right inside Arabic
                hint: preview || tl("اكتب السعر الذي حصلت عليه فعلاً. اتركه فارغاً لتضيفه لاحقاً", "Type the rate you actually got. Leave empty to add it later") },
                h("input", { dir: "ltr", inputMode: "decimal", value: rate, placeholder: "0.00", onChange: (e) => setRate(e.target.value.replace(/[^0-9.]/g, "")), style: inputStyle(colors) })),
            h(Field, { label: tl("الفئة", "Category"), group: true },
                h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
                    list.map((c) => { const I = iconOf(c.icon), on = c.id === catId;
                        return h("button", { key: c.id, type: "button", "aria-pressed": on, onClick: () => setCatId(c.id), style: { display: "flex", alignItems: "center", gap: 6, minHeight: 38, padding: "6px 12px",
                            borderRadius: 19, border: "1.5px solid " + (on ? c.color : colors.border), backgroundColor: on ? c.color + "1f" : "transparent", color: colors.text, fontSize: 13, fontWeight: 600, cursor: "pointer" } },
                            h(I, { size: 15, color: c.color }), catName(c)); }),
                    newCat == null
                        ? h("button", { type: "button", onClick: () => setNewCat(""), style: { minHeight: 38, padding: "6px 12px", borderRadius: 19, border: "1.5px dashed " + colors.border, background: "none", color: TEAL, fontWeight: 700, fontSize: 13, cursor: "pointer" } }, "＋ " + tl("فئة جديدة", "New category"))
                        : h("span", { style: { display: "flex", gap: 6, width: "100%" } },
                            h("input", { autoFocus: true, value: newCat, maxLength: 40, placeholder: tl("اسم الفئة", "Category name"), onChange: (e) => setNewCat(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") addCat(); }, style: inputStyle(colors) }),
                            h(Btn, { onClick: addCat }, tl("إضافة", "Add"))))),
            h(Field, { label: tl("التاريخ", "Date") }, h("input", { type: "date", value: date, max: today, onChange: (e) => setDate(e.target.value), style: inputStyle(colors) })),
            h(Field, { label: kind === "income" ? tl("من (اختياريّ)", "From (optional)") : tl("إلى (اختياريّ)", "Paid to (optional)") },
                h("input", { dir: "auto", value: who, maxLength: 80, onChange: (e) => setWho(e.target.value), style: inputStyle(colors) })),
            h(Field, { label: tl("ملاحظة (اختياريّ)", "Note (optional)"), hint: tl("الملاحظات والأسماء تُحفظ مشفّرة", "Notes and names are stored encrypted") },
                h("input", { dir: "auto", value: note, maxLength: 300, onChange: (e) => setNote(e.target.value), style: inputStyle(colors) })),
            err && h("div", { role: "alert", style: { color: colors.danger, fontSize: 13, marginBottom: 10 } }, err),
            h("div", { style: { display: "flex", gap: 8 } },
                editing && h(Btn, { kind: "danger", onClick: del, disabled: busy }, tl("حذف", "Delete")),
                h(Btn, { onClick: save, disabled: !canSave, style: { flex: 1 } }, busy ? tl("جارٍ الحفظ…", "Saving…") : tl("حفظ", "Save"))));
    }

    // ── screen ──
    function Screen({ onBack }) {
        const { colors } = useTheme();
        const [boot, setBoot] = useState(null), [bootErr, setBootErr] = useState("");
        const [tab, setTab] = useState("overview");
        const [month, setMonth] = useState(null);
        const [summary, setSummary] = useState(null), [list, setList] = useState(null);
        const [sheet, setSheet] = useState(null), [filter, setFilter] = useState(null);
        const load = () => { setBootErr(""); call("pfm.get").then((r) => { setBoot(r); if (r.settings) setMonth((m) => m || r.month); }, (e) => setBootErr(errText(e))); };
        useEffect(load, []);
        const refresh = useCallback(() => {
            if (!month) return;
            setSummary(null); setList(null);
            call("pfm.summary", { from: shiftMonth(month, -5), to: month, focus: month }).then(setSummary, (e) => setBootErr(errText(e)));
            call("pfm.tx.list", { month }).then(setList, (e) => setBootErr(errText(e)));
        }, [month]);
        useEffect(refresh, [refresh]);
        const cats = useMemo(() => { const m = {}; ((boot && boot.categories) || []).forEach((c) => { m[c.id] = c; }); return m; }, [boot]);
        const s = boot && boot.settings;
        const cur = s && s.baseCurrency;
        const body = bootErr ? h(Card, { style: { margin: 16 } }, h("div", { role: "alert", style: { color: colors.danger, fontSize: 14, marginBottom: 10 } }, bootErr), h(Btn, { onClick: () => { load(); refresh(); } }, tl("إعادة المحاولة", "Try again")))
            : !boot ? h(Loading)
            : !s ? h(Onboarding, { onDone: (r) => { setBoot(r); setMonth(r.month); } })
            : h("div", { style: { padding: 16, paddingBottom: 96 } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 } },
                    h("button", { type: "button", "aria-label": tl("الشهر السابق", "Previous month"), onClick: () => setMonth(shiftMonth(month, -1)), style: navBtn(colors) }, h(ar() ? ChevronRight : ChevronLeft, { size: 20 })),
                    h("div", { style: { flex: 1, textAlign: "center", fontWeight: 800, fontSize: 16 } }, monthName(month)),
                    h("button", { type: "button", "aria-label": tl("الشهر التالي", "Next month"), disabled: month >= boot.month, onClick: () => setMonth(shiftMonth(month, 1)), style: Object.assign(navBtn(colors), { opacity: month >= boot.month ? 0.35 : 1 }) }, h(ar() ? ChevronLeft : ChevronRight, { size: 20 }))),
                h("div", { style: { marginBottom: 14 } }, h(Seg, { value: tab, onChange: setTab, options: [{ value: "overview", label: tl("نظرة عامّة", "Overview") }, { value: "ledger", label: tl("السجلّ", "Ledger") }] })),
                tab === "overview"
                    ? h(Overview, { data: summary, cats, cur, onAdd: () => setSheet({}), onPickCat: (id) => { setFilter(id); setTab("ledger"); } })
                    : h(Ledger, { list, cats, base: cur, filter, onClearFilter: () => setFilter(null), onOpen: (t) => setSheet({ tx: t }), onAdd: () => setSheet({}) }));
        return h(ServiceTheme, { color: TEAL },
            h("div", { dir: ar() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col", style: { color: colors.text } },
                h(TopBar, { title: tl("المحاسب الشخصيّ", "Personal accountant"), subtitle: cur ? tl("المجاميع بـ", "Totals in ") + cur : undefined, onBack }),
                h("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } }, body),
                s && h("button", { type: "button", "aria-label": tl("حركة جديدة", "New entry"), onClick: () => setSheet({}),
                    style: { position: "fixed", insetInlineEnd: 20, bottom: "calc(env(safe-area-inset-bottom,0px) + 24px)", width: 56, height: 56, borderRadius: 28, border: 0,
                        backgroundColor: TEAL, color: "#fff", boxShadow: "0 6px 16px rgba(15,118,110,.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 40 } }, h(Plus, { size: 26 })),
                sheet && s && h(TxSheet, { tx: sheet.tx, settings: s, cats, today: boot.today, onClose: () => setSheet(null),
                    onSaved: () => { setSheet(null); refresh(); } })));
    }
    const navBtn = (colors) => ({ width: 40, height: 40, borderRadius: 20, border: "1px solid " + colors.border, backgroundColor: colors.card, color: colors.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" });
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
            const SFS_MAP = { "7": 8.5, "8": 9.5, "9": 11, "9.5": 11, "10": 11.5, "10.5": 12, "11": 12, "11.5": 12.5, "12": 13, "12.5": 13.5 };
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
