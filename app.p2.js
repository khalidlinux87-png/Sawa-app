function t(key, params) {
    let s;
    if (isRTL() === false) s = __SAWA_STRINGS_EN[key];
    if (s == null) s = __SAWA_STRINGS[key];
    if (s == null)
        return key;
    if (params)
        Object.keys(params).forEach(k => { s = s.replace(new RegExp('{' + k + '}', 'g'), params[k] == null ? "" : params[k]); });
    return (params && isRTL() !== false) ? arCountFix(s) : s;
}
function setLocale(lang) { try {
    window.__SAWA_LANG = lang;
    localStorage.setItem("sawaLang", lang);
    // اتجاه المستند نفسه — يؤثر على مربعات الإدخال والتمرير
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === "en") ? "ltr" : "rtl";
    window.dispatchEvent(new CustomEvent("sawa-lang", { detail: lang }));
}
catch (e) { } }
// ─── direction helpers ─────────────────────────────────────────
function isRTL() { try {
    return (window.__SAWA_LANG || "ar") !== "en";
}
catch (e) {
    return true;
} }
// وسم اللغة لتنسيق التواريخ والأوقات والأرقام. كان "ar-SD" مثبَّتاً في
// 117 موضعاً، فكانت الأرقام والتواريخ تبقى عربية في الواجهة الإنجليزية.
function loc() { return isRTL() ? "ar-SD" : "en-GB"; }
// لا تُغيّر هاتين الدالتين. جُرّب قلبهما في 3 سبتمبر فانقلب الشريط
// السفلي وترويسة استكشف وبطاقات صلة الرحم — أي أن 616 موضعاً تعتمد
// على هذا السلوك وهي صحيحة. الخلل كان في صفَّي قائمة المحادثات وحدهما
// (كُتبا بترتيب معكوس في الترميز) وأُصلحا موضعياً بـ flex-row صريحة.
const rowStart = () => isRTL() ? 'flex-row-reverse' : 'flex-row';
const rowEnd = () => isRTL() ? 'flex-row' : 'flex-row-reverse';
const textStart = () => isRTL() ? 'text-right' : 'text-left';
const textEnd = () => isRTL() ? 'text-left' : 'text-right';
const ms = (n) => isRTL() ? `mr-${n}` : `ml-${n}`;
const me = (n) => isRTL() ? `ml-${n}` : `mr-${n}`;
const ps = (n) => isRTL() ? `pr-${n}` : `pl-${n}`;
const pe = (n) => isRTL() ? `pl-${n}` : `pr-${n}`;
const flipIcon = () => isRTL() ? { transform: 'scaleX(-1)' } : undefined;
// ──────────────────────────────────────────────────────────────
// ============================================================
// ⚙️ إعدادات جمع الملاحظات — عدّل هنا فقط
// ============================================================
// رقم الواتساب الذي تصل عليه ملاحظات المجرِّبين.
// الصيغة: رمز الدولة بلا + وبلا أصفار بادئة، ثم الرقم.
//   السودان: 249 ثم الرقم بلا الصفر  →  "249912345678"
//   السعودية: 966 ثم الرقم بلا الصفر →  "966501234567"
// اتركه فارغاً "" لتعطيل واتساب واستعمال مشاركة النظام العامة.
const FEEDBACK_WHATSAPP = "447478682670";
// اسم النسخة يُرسَل مع كل ملاحظة — يميّز بلاغات النسخ القديمة
const APP_VERSION = "v17";
// ============================================================
// طبقة المنصّة — كل نداءات المتصفح تمر من هنا.
// عند الانتقال لـ React Native تُستبدل هذه الدوال الثلاث فقط:
//   copyText  → Clipboard.setString
//   shareText → Share.share
//   saveTextFile → RNFS.writeFile + Share.open
// ============================================================
function copyText(text) {
    var _a;
    // تُرجع Promise دائماً حتى تعمل .then/.await في كل مواضع الاستدعاء
    try {
        const p = (_a = navigator.clipboard) === null || _a === void 0 ? void 0 : _a.writeText(text);
        return p && typeof p.then === "function" ? p.catch(() => { }) : Promise.resolve();
    }
    catch (_b) {
        return Promise.resolve();
    }
}
function shareText(payload) {
    try {
        if (navigator.share) {
            navigator.share(payload);
            return true;
        }
    }
    catch (_a) { }
    copyText((payload === null || payload === void 0 ? void 0 : payload.text) || (payload === null || payload === void 0 ? void 0 : payload.url) || "");
    return false;
}
function saveTextFile(filename, content) {
    try { return saveFileOut(new Blob([content], { type: "text/plain;charset=utf-8" }), filename, "text/plain"); }
    catch (_a) { return false; }
}
// C129: حفظ ملفٍّ من الواجهة — WebView (أندرويد) وWKWebView (آيفون) لا ينزّلان روابط blob: فكان «تصدير الشجرة» لا يفعل شيئاً.
//       أندرويد ⇒ «التنزيلات» عبر الجسر · آيفون ⇒ ورقة المشاركة (منها «حفظ في الملفّات») · المتصفّح ⇒ رابط تنزيل.
function saveFileOut(blob, filename, mime) {
    try {
        const SC = window.SawaChat;
        if (SC && SC.saveBlob && (window.SawaNativeBridge || window.SawaIOS)) { SC.saveBlob(blob, filename, window.SawaIOS ? "share" : "save", mime || blob.type); return true; }
    } catch (e) { }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e) { } }, 4000);
    return true;
}
// ============================================================
// التخزين الدائم — طبقة واحدة تُستبدل بـ AsyncStorage في React Native
// ============================================================
const SAWA_STORE_PREFIX = "sawa:";
function loadPersisted(key, fallback) {
    var _a;
    try {
        const raw = (_a = window.localStorage) === null || _a === void 0 ? void 0 : _a.getItem(SAWA_STORE_PREFIX + key);
        if (raw == null)
            return fallback;
        const parsed = JSON.parse(raw);
        // نرفض أي بيانات محفوظة بشكل مخالف للمتوقَّع (نسخة قديمة أو تالفة)
        if (Array.isArray(fallback) && !Array.isArray(parsed))
            return fallback;
        if (fallback && typeof fallback === "object" && !Array.isArray(fallback)
            && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)))
            return fallback;
        if (typeof fallback === "boolean" && typeof parsed !== "boolean")
            return fallback;
        return parsed;
    }
    catch (_b) {
        return fallback;
    }
}
// محتوى الوسائط (base64) لا يُحفظ أبداً: صورة واحدة تتجاوز سعة التخزين كلها،
// فيفشل الحفظ وتضيع المحادثات. نحفظ البيانات الوصفية فقط ونضع علامة على المفقود.
// عند الانتقال لـ RN تُستبدل هذه بروابط ملفات على الخادم.
function stripMediaPayload(value) {
    if (Array.isArray(value))
        return value.map(stripMediaPayload);
    if (value && typeof value === "object") {
        const out = {};
        for (const k of Object.keys(value)) {
            if (k === "fileUrl" || k === "dataUrl" || k === "photoData") {
                if (value[k])
                    out.mediaDropped = true;
                out[k] = null;
            }
            else {
                out[k] = stripMediaPayload(value[k]);
            }
        }
        return out;
    }
    return value;
}
let storageWarned = false;
function savePersisted(key, value) {
    var _a;
    try {
        const safe = key === "messages" || key === "groupMessages" || key === "momentsPosts"
            ? stripMediaPayload(value)
            : value;
        (_a = window.localStorage) === null || _a === void 0 ? void 0 : _a.setItem(SAWA_STORE_PREFIX + key, JSON.stringify(safe));
        return true;
    }
    catch (e) {
        // التخزين ممتلئ أو محظور — لا ننهار، لكن لا نصمت أيضاً
        if (!storageWarned) {
            storageWarned = true;
            console.warn("سوا: تعذّر حفظ «" + key + "» — التخزين ممتلئ أو محظور.", e);
            try {
                window.dispatchEvent(new CustomEvent("sawa:storage-full", { detail: { key } }));
            }
            catch (_b) { }
        }
        return false;
    }
}
// مثل useState لكن يحفظ تلقائياً ويستعيد عند التشغيل.
// الحفظ مؤجَّل (debounce) حتى لا نكتب للتخزين مع كل ضغطة مفتاح.
function usePersistedState(key, initialValue, delay = 400) {
    const [value, setValue] = useState(() => loadPersisted(key, initialValue));
    const timer = useRef(null);
    const latest = useRef(value);
    latest.current = value;
    useEffect(() => {
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => savePersisted(key, latest.current), delay);
        return () => { if (timer.current)
            clearTimeout(timer.current); };
    }, [key, value, delay]);
    // نضمن الحفظ عند إغلاق الصفحة قبل انتهاء المهلة
    useEffect(() => {
        const flush = () => savePersisted(key, latest.current);
        window.addEventListener("pagehide", flush);
        return () => {
            window.removeEventListener("pagehide", flush);
            flush();
        };
    }, [key]);
    return [value, setValue];
}
// ============================================================
// ErrorBoundary — يمنع انهيار التطبيق كاملاً عند خطأ في أي مكوّن
// ============================================================
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("خطأ في سوا:", error, info === null || info === void 0 ? void 0 : info.componentStack);
    }
    render() {
        var _a;
        if (!this.state.error)
            return this.props.children;
        return (React.createElement("div", { style: {
                position: "fixed", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: 28,
                backgroundColor: "#F7F8FA", direction: "rtl", fontFamily: "inherit",
            } },
            React.createElement("div", { style: {
                    width: 64, height: 64, borderRadius: 32, display: "flex",
                    alignItems: "center", justifyContent: "center", marginBottom: 18,
                    backgroundColor: "#EF444422",
                } },
                React.createElement("span", { style: { fontSize: 30 } }, "\u26A0\uFE0F")),
            React.createElement("p", { style: { fontWeight: 800, fontSize: 17, color: "#0F172A", marginBottom: 8 } }, t("hsl_khta_ghyr_mtwqa")),
            React.createElement("p", { style: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 1.7, marginBottom: 22, maxWidth: 300 } }, t("byanatk_mhfwza_jrb_alawda")),
            React.createElement("div", { style: { display: "flex", flexDirection: "row-reverse", gap: 10, flexWrap: "wrap", justifyContent: "center" } },
                React.createElement("button", { onClick: () => {
                        try {
                            Object.keys(window.localStorage || {})
                                .filter((k) => k.startsWith(SAWA_STORE_PREFIX))
                                .forEach((k) => window.localStorage.removeItem(k));
                        }
                        catch (_a) { }
                        window.location.reload();
                    }, style: { padding: "11px 22px", borderRadius: 14, border: "none", backgroundColor: "#EF4444", color: "#fff", fontWeight: 800, fontSize: 13 } }, t("msh_albyanat_wiaada_altshghyl")),
                React.createElement("button", { onClick: () => this.setState({ error: null }), style: { padding: "11px 22px", borderRadius: 14, border: "none", backgroundColor: "#1E88E5", color: "#fff", fontWeight: 800, fontSize: 13 } }, t("almhawla_mra_akhra")),
                React.createElement("button", { onClick: () => window.location.reload(), style: { padding: "11px 22px", borderRadius: 14, border: "1px solid #CBD5E1", backgroundColor: "transparent", color: "#475569", fontWeight: 700, fontSize: 13 } }, t("iaada_altshghyl"))),
            React.createElement("details", { style: { marginTop: 26, maxWidth: 320, width: "100%" } },
                React.createElement("summary", { style: { fontSize: 11, color: "#94A3B8", cursor: "pointer", textAlign: "center" } }, t("tfasyl_tqnya")),
                React.createElement("pre", { style: {
                        fontSize: 10, color: "#64748B", backgroundColor: "#E2E8F0", padding: 10,
                        borderRadius: 10, marginTop: 8, overflow: "auto", maxHeight: 130,
                        whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left",
                    } }, String(((_a = this.state.error) === null || _a === void 0 ? void 0 : _a.message) || this.state.error)))));
    }
}
// رابط الدعوة — معرَّف في sawa-core.js (إعدادات النشر).
// القيمة الاحتياطية للحالة التي يُحمَّل فيها هذا الملف وحده.
// P2: رابط الدعوة = العنوان الرسميّ لسوا
const SAWA_INVITE_URL = "https://www.sawaaap.com";
const APP_LOGO_RAHIM = "./icons/icon-192.png"; // ⛔ مسار لا نصّ
const SAWA_LOGO = "data:image/webp;base64,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";
// C142: شعارٌ صغير (١٤٤ بكسل، مقصوص الهوامش، تصغيرٌ عالي الجودة مع شحذ) للأحجام الصغيرة (٣٨–٤٨ بكسل) — كان المتصفّح يصغّر شعار ٣٨٤ بكسل فتظهر الحوافّ متكسّرة
const SAWA_LOGO_SM = "data:image/webp;base64,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";
// ============================================================================
// نظام الثيم (نفس بنية سوا/صلة الرحم بالضبط)
// ============================================================================
// 4 مظاهر قابلة للتبديل — نفس القيم الموثّقة رسمياً بمستند سوا
const ACCENT_THEMES = {
    sawa: { labelKey: "acc_swa", accent: "#2F80C8", accentDark: "#1E3A63", accentTint: "#BFE0F5" },
    orange: { labelKey: "acc_brtqaly", accent: "#E8823D", accentDark: "#B5602B", accentTint: "#FBD9BA" },
    purple: { labelKey: "acc_bnfsjy", accent: "#8B5FA8", accentDark: "#5F3F78", accentTint: "#E3D3ED" },
    navy: { labelKey: "acc_khly", accent: "#1E3A63", accentDark: "#132743", accentTint: "#C7D4E3" },
    // مستخلَصة من شعار أرحام نفسه: أخضره وزيتيّه. افتراض أرحام، وخيارٌ في سوا.
    green: { labelKey: "acc_akhdr", accent: "#187854", accentDark: "#0C4854", accentTint: "#CFE9DD" },
};
const lightColors = {
    primary: "#2F80C8", primaryDark: "#1E3A63", primaryLight: "#BFE0F5",
    accent: "#D98E04", danger: "#C0392B", success: "#1B7A43",
    bg: "#F5F7FA", card: "#FFFFFF", text: "#111827", textMuted: "#6B7280", border: "#E2E5E9",
};
const darkColors = {
    primary: "#5AA9E6", primaryDark: "#2F5C8F", primaryLight: "#173049",
    accent: "#E8A93D", danger: "#E5695C", success: "#5CD692",
    bg: "#0E1116", card: "#171B21", text: "#EDEFF2", textMuted: "#8A93A0", border: "#262B33",
};
const ThemeContext = createContext(null);
const ToastContext = createContext(null);
function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx)
        throw new Error("useToast must be used within ToastProvider");
    return ctx;
}
function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    function showToast(message, type = "success") {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }
    return (React.createElement(ToastContext.Provider, { value: { showToast } },
        children,
        React.createElement(ToastHost, { toasts: toasts })));
}
function ToastHost({ toasts }) {
    const { colors } = useTheme();
    if (toasts.length === 0)
        return null;
    return (React.createElement("div", { className: "absolute bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none" }, toasts.map((toast) => (React.createElement("div", { key: toast.id, className: `rounded-full px-4 py-2 text-xs font-bold shadow-lg flex ${rowStart()} items-center gap-1.5`, style: {
            backgroundColor: toast.type === "error" ? colors.danger : colors.success,
            color: "#fff",
        } },
        toast.type === "error" ? React.createElement(AlertCircle, { size: 13, color: "#fff" }) : React.createElement(Check, { size: 13, color: "#fff" }),
        toast.message)))));
}
function SkeletonBox({ height = 16, width = "100%", rounded = "rounded-md" }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: `${rounded} animate-pulse`, style: { height, width, backgroundColor: colors.border, opacity: 0.5 } }));
}
const useTheme = () => useContext(ThemeContext);
// ============================================================================
// مكوّنات مشتركة
// ============================================================================
function Card({ children, style, className = "" }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: `rounded-2xl border p-3 ${className}`, style: { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10, ...style } }, children));
}
function Button({ label, icon: Icon, onPress, variant = "filled", disabled, className = "" }) {
    const { colors } = useTheme();
    const filled = variant === "filled";
    return (React.createElement("button", { onClick: onPress, disabled: disabled, className: `w-full flex ${rowStart()} items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-extrabold transition-transform active:scale-[0.98] ${className}`, style: {
            backgroundColor: filled ? colors.primary : colors.card,
            color: filled ? "#fff" : colors.primary,
            border: filled ? "none" : `1.5px solid ${colors.primary}`,
            opacity: disabled ? 0.5 : 1,
            boxShadow: filled && !disabled ? `0 4px 14px ${colors.primary}40` : "none",
        } },
        Icon && React.createElement(Icon, { size: 18 }),
        " ",
        label));
}
function Badge({ label, variant = "neutral", icon: Icon, size = "md" }) {
    const { isDark } = useTheme();
    const variants = {
        danger: { bg: isDark ? "#4A2420" : "#FBE9E7", fg: isDark ? "#FF8A7A" : "#C0392B" },
        warning: { bg: isDark ? "#4A3714" : "#FCEFD6", fg: isDark ? "#F2B953" : "#B8720A" },
        success: { bg: isDark ? "#173A26" : "#E3F3EA", fg: isDark ? "#5CD692" : "#1B7A43" },
        neutral: { bg: isDark ? "#232F2A" : "#F7F8FA", fg: isDark ? "#8FA39C" : "#6B7280" },
    };
    const v = variants[variant] || variants.neutral;
    const small = size === "sm";
    return (React.createElement("span", { className: `inline-flex ${rowStart()} items-center rounded-full font-bold ${small ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2.5 py-1"}`, style: { backgroundColor: v.bg, color: v.fg } },
        Icon && React.createElement(Icon, { size: small ? 10 : 12, className: `${ms("1")}` }),
        label));
}
function NumericAmountInput({ value, onChange, placeholder, className, style }) {
    const ref = useRef(null);
    function handleChange(e) {
        const rawCursor = e.target.selectionStart;
        const before = e.target.value.slice(0, rawCursor);
        // نحسب كم رقماً فعلياً قبل موضع المؤشر (بعد تصفية أي حرف غير رقمي)
        const digitsBeforeCursor = (before.match(/\d/g) || []).length;
        const filtered = e.target.value.replace(/\D/g, "");
        onChange(filtered);
        // نُعيد موضع المؤشر لمكانه الصحيح بعد إعادة الرسم — يمنع القفز
        // للنهاية أو التكرار الظاهري أثناء الكتابة بلوحات المفاتيح العربية
        requestAnimationFrame(() => {
            if (ref.current)
                ref.current.setSelectionRange(digitsBeforeCursor, digitsBeforeCursor);
        });
    }
    return (React.createElement("input", { ref: ref, dir: "ltr", value: value, onChange: handleChange, placeholder: placeholder, inputMode: "numeric", className: className, style: style }));
}
function Chip({ label, active, onPress, disabled = false }) {
    const { colors } = useTheme();
    return (React.createElement("button", { onClick: disabled ? undefined : onPress, disabled: disabled, className: "rounded-full text-xs px-3.5 py-2 border mb-2 whitespace-nowrap shrink-0", style: {
            backgroundColor: active ? colors.primary : colors.card,
            borderColor: active ? colors.primary : colors.border,
            color: active ? "#fff" : (disabled ? colors.textMuted : colors.text),
            fontWeight: active ? 700 : 400,
            opacity: disabled ? 0.45 : 1,
        } }, label));
}
function PinDots({ length = 6, filled = 0, error = false }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex justify-center my-6 gap-3" }, Array.from({ length }).map((_, i) => (React.createElement("div", { key: i, className: "w-4 h-4 rounded-full border-2", style: {
            borderColor: error ? colors.danger : colors.primary,
            backgroundColor: i < filled ? (error ? colors.danger : colors.primary) : "transparent",
        } })))));
}
function PinKeypad({ onDigit, onBackspace, onBiometric, showBiometric }) {
    const { colors } = useTheme();
    const keys = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["bio", "0", "back"]];
    return (React.createElement("div", { className: "flex flex-col items-center pb-4" }, keys.map((row, i) => (React.createElement("div", { key: i, className: "flex" }, row.map((k) => {
        if (k === "bio") {
            return (React.createElement("button", { key: k, onClick: onBiometric, disabled: !showBiometric, className: "w-16 h-16 rounded-full flex items-center justify-center m-2" }, showBiometric && React.createElement(Fingerprint, { size: 24, color: colors.primary })));
        }
        if (k === "back") {
            return (React.createElement("button", { key: k, onClick: onBackspace, className: "w-16 h-16 rounded-full flex items-center justify-center m-2" },
                React.createElement(Delete, { size: 20, color: colors.text })));
        }
        return (React.createElement("button", { key: k, onClick: () => onDigit(k), className: "w-16 h-16 rounded-full flex items-center justify-center m-2 text-2xl font-semibold", style: { color: colors.text } }, k));
    }))))));
}
function EmptyState({ icon: Icon, label }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex flex-col items-center justify-center py-16 px-6" },
        React.createElement(Icon, { size: 30, color: colors.border }),
        React.createElement("p", { className: "text-xs text-center mt-2", style: { color: colors.textMuted } }, label)));
}
// C25: صورة الحساب إن وُجدت (من SawaChat.photoOf) وإلّا الحرف الأوّل — بالحجم والألوان نفسها
function Pic({ photo, letter, size, bg, color, className, style, children }) {
    const base = Object.assign({ width: size, height: size, backgroundColor: bg }, style || {});
    if (photo) return React.createElement("div", { className: "rounded-full shrink-0 overflow-hidden flex items-center justify-center " + (className || ""), style: Object.assign({}, base, { backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center" }) }, children || null);
    return React.createElement("div", { className: "rounded-full shrink-0 flex items-center justify-center font-extrabold " + (className || ""), style: Object.assign({ color, fontSize: Math.round(size * 0.42) }, base) }, letter, children || null);
}
function TopBar({ title, subtitle, onBack, actions, avatar, photo, onTitlePress }) {
    const { colors } = useTheme();
    // C146: اتّجاهٌ صريح + ترتيبٌ طبيعيّ — «رجوع» ثمّ الصورة ثمّ الاسم من جهة البداية، والأزرار في الطرف الآخر:
    //       العربيّة: رجوع يميناً والأزرار يساراً · الإنجليزيّة: العكس. (كان flex-row-reverse داخل صفحةٍ عربيّة يقلبه فيصير الرجوع يساراً)
    const rtl = isRTL();
    return (React.createElement("div", { dir: rtl ? "rtl" : "ltr", className: "flex flex-row items-center px-3 pb-2.5", style: { backgroundColor: colors.primary, paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)", minHeight: 60 } },   // C117: كان pt-10 ثابتاً
        onBack && React.createElement("button", { "aria-label": tl("رجوع", "Back"), onClick: onBack, className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { marginInlineEnd: 4 } },
            React.createElement(rtl ? ChevronRight : ChevronLeft, { color: "#fff", size: 22 })),
        React.createElement("div", { className: "flex-1 min-w-0 flex flex-row items-center justify-start gap-2", onClick: onTitlePress || undefined, style: Object.assign({ marginInlineEnd: 12 }, onTitlePress ? { cursor: "pointer" } : {}) },
            avatar && React.createElement(Pic, { photo: photo || null, letter: ((avatar === true ? title : avatar) || "?").charAt(0), size: 36, bg: "rgba(255,255,255,0.22)", color: "#fff" }),
            React.createElement("div", { className: "min-w-0", style: { textAlign: "start" } },
                React.createElement("h1", { className: "text-white text-sm font-bold truncate" }, title),
                subtitle && React.createElement("p", { className: "text-[10px] truncate", style: { color: "#ffffffcc" } }, subtitle))),
        React.createElement("div", { className: "shrink-0" }, actions)));
}
// ============================================================================
// C34: عدّة تصميم «صلة الرحم» — النمط الحديث: رأس متدرّج، بطاقات ناعمة بظلال،
// صور/حروف ملوّنة، شرائح، ورقة سفليّة للنماذج. تخصّ شاشات العائلة وحدها.
// ============================================================================
// مزج لونٍ سداسيّ بالأبيض بنسبة t (0..1) — لتفتيح بداية التدرّج
function famMix(hex, t) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return hex;
    const n = parseInt(m[1], 16), ch = (s) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * t);
    return "#" + [ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function famGrad(colors) { return `linear-gradient(135deg, ${famMix(colors.primary, 0.14)} 0%, ${colors.primary} 45%, ${colors.primaryDark} 100%)`; }
function famShadow(isDark) { return isDark ? "0 6px 18px rgba(0,0,0,0.38)" : "0 6px 18px rgba(30,41,59,0.07)"; }
const FAM_AV_GRADS = [["#60a5fa", "#2563eb"], ["#34d399", "#0d9488"], ["#fbbf24", "#f97316"], ["#c084fc", "#7c3aed"], ["#f472b6", "#db2777"], ["#22d3ee", "#0e7490"], ["#a3e635", "#4d7c0f"], ["#fb7185", "#be123c"]];
function famAvGrad(name) {
    let h = 0; const s = String(name || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const g = FAM_AV_GRADS[h % FAM_AV_GRADS.length];
    return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}
// صورة الشخص إن وُجدت وإلّا حرفه الأوّل على تدرّجٍ ثابتٍ لاسمه (المتوفّى رماديّ)
function FamAvatar({ name, photo, size = 46, radius, gray, ring, className, style, children }) {
    const letter = (String(name || "").trim().charAt(0)) || "؟";
    const base = Object.assign({ width: size, height: size, borderRadius: radius == null ? "50%" : radius, flexShrink: 0, boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }, style || {});
    if (photo) return React.createElement("div", { className: "relative overflow-hidden " + (className || ""), style: Object.assign({}, base, { backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center", filter: gray ? "grayscale(1)" : undefined }) }, children || null);
    return React.createElement("div", { className: "relative flex items-center justify-center font-extrabold text-white " + (className || ""), style: Object.assign({}, base, { background: gray ? "linear-gradient(135deg,#9ca3af,#6b7280)" : famAvGrad(name), fontSize: Math.round(size * 0.4) }) }, letter, children || null);
}
function FamHeader({ title, subtitle, onBack, actions, children, compact }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "shrink-0 relative", style: { background: famGrad(colors), borderBottomLeftRadius: 26, borderBottomRightRadius: 26, padding: `${compact ? 40 : 44}px 18px ${children ? 16 : 18}px` } },
        // C146: «رجوع» في جهة البداية (يمين العربيّة) والأزرار في الطرف الآخر
        React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex flex-row items-center gap-2.5" },
            onBack && React.createElement("button", { "aria-label": tl("رجوع", "Back"), onClick: onBack, className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: "rgba(255,255,255,0.18)" } },
                React.createElement(isRTL() ? ChevronRight : ChevronLeft, { color: "#fff", size: 20 })),
            React.createElement("div", { className: `flex-1 min-w-0 ${textStart()}` },
                React.createElement("h1", { className: "text-white font-extrabold truncate", style: { fontSize: compact ? 17 : 21, lineHeight: 1.25 } }, title),
                subtitle && React.createElement("p", { className: "text-[12px] mt-0.5 truncate", style: { color: "rgba(255,255,255,0.85)" } }, subtitle)),
            actions && React.createElement("div", { className: "shrink-0 flex flex-row items-center gap-1.5" }, actions)),
        children && React.createElement("div", { className: "mt-4" }, children)));
}
// زرّ صغير فاتح فوق الرأس المتدرّج
function FamHeaderBtn({ icon: Icon, label, onPress, ariaLabel }) {
    return React.createElement("button", { "aria-label": ariaLabel || label, onClick: onPress, className: `flex ${rowStart()} items-center gap-1 rounded-full py-1.5 text-[11px] font-bold text-white`, style: { backgroundColor: "rgba(255,255,255,0.18)", paddingInline: label ? 10 : 8 } },
        Icon && React.createElement(Icon, { size: 15, color: "#fff" }), label || null);
}
function FamStat({ value, label, onPress, icon: Icon }) {
    return React.createElement(onPress ? "button" : "div", { onClick: onPress, className: "flex-1 rounded-2xl py-2.5 px-2 text-center min-w-0", style: { backgroundColor: "rgba(255,255,255,0.16)" } },
        React.createElement("div", { className: "text-white font-extrabold flex items-center justify-center gap-1", style: { fontSize: 20, lineHeight: 1.1 } }, Icon && React.createElement(Icon, { size: 15, color: "#fff" }), value),
        React.createElement("div", { className: "text-[10.5px] mt-1 truncate", style: { color: "rgba(255,255,255,0.88)" } }, label));
}
function FamCard({ children, className = "", style, onPress, onContextMenu, flat }) {
    const { colors, isDark } = useTheme();
    const Tag = onPress ? "button" : "div";
    return React.createElement(Tag, { onClick: onPress, onContextMenu: onContextMenu, className: `rounded-[20px] p-3.5 ${onPress ? "w-full " + textStart() + " active:scale-[0.99] transition-transform" : ""} ${className}`, style: Object.assign({ backgroundColor: colors.card, boxShadow: flat ? "none" : famShadow(isDark), marginBottom: 10 }, style || {}) }, children);
}
const FAM_TONES = { info: ["#e0f2fe", "#0369a1", "#0c3a52", "#7dd3fc"], warn: ["#fef3c7", "#b45309", "#3f2d0c", "#fcd34d"], ok: ["#dcfce7", "#15803d", "#0f3320", "#86efac"], muted: ["#f3f4f6", "#6b7280", "#262b33", "#9ca3af"], danger: ["#fee2e2", "#b91c1c", "#3f1515", "#fca5a5"], violet: ["#ede9fe", "#6d28d9", "#2e1065", "#c4b5fd"] };
function famTone(tone, isDark) { const tn = FAM_TONES[tone] || FAM_TONES.info; return { bg: isDark ? tn[2] : tn[0], fg: isDark ? tn[3] : tn[1] }; }
function FamChip({ label, tone = "info", icon: Icon, onPress, className = "" }) {
    const { isDark } = useTheme();
    const c = famTone(tone, isDark);
    return React.createElement(onPress ? "button" : "span", { onClick: onPress, className: `inline-flex ${rowStart()} items-center gap-1 text-[10.5px] font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap ${className}`, style: { backgroundColor: c.bg, color: c.fg } }, Icon && React.createElement(Icon, { size: 11 }), label);
}
function FamSection({ title, action, onAction, children, className = "" }) {
    const { colors } = useTheme();
    return React.createElement("div", { className: `px-4 pt-4 ${className}` },
        title && React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2.5 px-0.5` },
            React.createElement("h3", { className: "text-[13.5px] font-extrabold", style: { color: colors.text } }, title),
            action && React.createElement("button", { onClick: onAction, className: "text-[11.5px] font-bold", style: { color: colors.primary } }, action)),
        children);
}
// شرائح تصفية مستديرة قابلة للتمرير أفقيّاً
function FamTabs({ options, value, onChange, className = "" }) {
    const { colors, isDark } = useTheme();
    return React.createElement("div", { className: `flex ${rowStart()} gap-2 overflow-x-auto pb-1 ${className}`, style: { scrollbarWidth: "none" } }, options.map((o) => React.createElement("button", { key: o.k, onClick: () => onChange(o.k), className: `shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold whitespace-nowrap flex ${rowStart()} items-center gap-1`, style: value === o.k ? { backgroundColor: colors.primary, color: "#fff" } : { backgroundColor: colors.card, color: colors.textMuted, boxShadow: famShadow(isDark) } }, o.i ? React.createElement(o.i, { size: 12 }) : null, o.l, o.n != null ? React.createElement("span", { className: "text-[9.5px] px-1 rounded-full", style: { backgroundColor: value === o.k ? "rgba(255,255,255,0.25)" : colors.bg } }, o.n) : null)));
}
// مفتاح مقسوم (ذكر/أنثى، حيّ/متوفّى…)
function FamSeg({ options, value, onChange }) {
    const { colors, isDark } = useTheme();
    return React.createElement("div", { className: `flex ${rowStart()} rounded-2xl p-1`, style: { backgroundColor: colors.bg } }, options.map((o) => React.createElement("button", { key: o.k, onClick: () => onChange(o.k), className: "flex-1 text-center py-2 rounded-xl text-[13px] font-bold", style: value === o.k ? { backgroundColor: colors.card, color: colors.primary, boxShadow: famShadow(isDark) } : { color: colors.textMuted } }, o.l)));
}
function FamFab({ icon: Icon = Plus, label, ariaLabel, onPress, style }) {
    const { colors } = useTheme();
    return React.createElement("button", { "aria-label": ariaLabel || label || tl("إضافة", "Add"), title: ariaLabel || label || undefined, onClick: onPress, className: `absolute flex ${rowStart()} items-center justify-center gap-2 text-white font-extrabold text-sm active:scale-95 transition-transform`, style: Object.assign({ bottom: 22, [isRTL() ? "left" : "right"]: 18, height: 54, minWidth: 54, paddingInline: label ? 18 : 0, borderRadius: 20, background: famGrad(colors), boxShadow: `0 10px 24px ${colors.primary}59`, zIndex: 20 }, style || {}) }, React.createElement(Icon, { size: 24, color: "#fff" }), label || null);
}
// زرّ رئيسيّ متدرّج عريض
function FamButton({ label, icon: Icon, onPress, disabled, variant = "filled", className = "" }) {
    const { colors } = useTheme();
    const filled = variant === "filled";
    return React.createElement("button", { onClick: onPress, disabled: disabled, className: `w-full flex ${rowStart()} items-center justify-center gap-2 py-3.5 text-[15px] font-extrabold active:scale-[0.98] transition-transform ${className}`, style: filled
            ? { background: famGrad(colors), color: "#fff", borderRadius: 16, opacity: disabled ? 0.5 : 1, boxShadow: disabled ? "none" : `0 8px 20px ${colors.primary}40` }
            : variant === "danger" ? { backgroundColor: colors.danger + "14", color: colors.danger, borderRadius: 16, opacity: disabled ? 0.5 : 1 }
                : { backgroundColor: colors.bg, color: colors.primary, borderRadius: 16, opacity: disabled ? 0.5 : 1 } },
        Icon && React.createElement(Icon, { size: 18 }), label);
}
// حقل إدخال ناعم بلا حدود
function famInput(colors, extra) { return Object.assign({ backgroundColor: colors.bg, color: colors.text, border: "1.5px solid transparent", borderRadius: 14, outline: "none" }, extra || {}); }
function FamLabel({ children, hint }) {
    const { colors } = useTheme();
    return React.createElement("label", { className: `block text-[11.5px] font-bold mb-1.5 ${textStart()}`, style: { color: colors.textMuted } }, children, hint ? React.createElement("span", { className: "font-normal" }, " (" + hint + ")") : null);
}
// ورقة سفليّة للنماذج: مقبض، عنوان، زرّ إغلاق، جسم قابل للتمرير، وتذييل ثابت.
// Esc وزرّ الرجوع في أندرويد يغلقانها (كما في ToolSheet).
function famCssOnce() {
    if (document.getElementById("fam-css")) return;
    const el = document.createElement("style"); el.id = "fam-css";
    el.textContent = ".fam-in:focus{box-shadow:0 0 0 2px var(--fam-ring)!important;outline:none}.fam-in::placeholder{opacity:.7}";
    document.head.appendChild(el);
}
// C75: مكدّسٌ واحد للأوراق مع سجلّ المتصفّح — «رجوع» يغلق الورقة العليا فقط.
//      كانت كلّ ورقة تضيف خطوةً وتعود عند إغلاقها؛ فحين تُغلق ورقةٌ وتُفتح أخرى مكانها (قائمة الشخص ← «إضافة قريب»)
//      كانت عودة الأولى تصل الثانية كضغطة «رجوع» فتغلقها فوراً — فلا يعمل «إضافة قريب» من بطاقة الشجرة.
const FAM_SHEETS = [];
let famSheetSkipPop = 0;
let famSheetReusable = 0;
let famSheetPopBound = false;
function famSheetBindPop() {
    if (famSheetPopBound) return;
    famSheetPopBound = true;
    window.addEventListener("popstate", () => {
        if (famSheetSkipPop > 0) { famSheetSkipPop--; return; }
        const top = FAM_SHEETS[FAM_SHEETS.length - 1];
        if (top) { top.popped = true; try { top.close(); } catch (e) { } }
    });
}
// C99: زرّ الرجوع في أندرويد — التطبيق الأصليّ يسأل الواجهة أوّلاً: (١) ورقة/مكالمة لها خطوة في السجلّ ⇒ رجوع
//      (٢) ورقة أو قائمة مفتوحة ⇒ الضغط على خلفيّتها المعتمة (يغلقها) (٣) شاشةٌ فيها سهم رجوع ⇒ نضغطه. وإلّا يخرج التطبيق إلى الخلفيّة.
//      كان الرجوع من أيّ شاشةٍ بلا خطوة في السجلّ يُخرج من التطبيق نهائيّاً.
window.__sawaBack = function () {
    try {
        const st = history.state;
        if (st && (st.sawaSheet || st.sawaCall)) { history.back(); return true; }
        const vis = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && cs.pointerEvents !== "none"; };
        const zOf = (el) => { let z = 0; for (let e = el; e && e !== document.body; e = e.parentElement) { const v = parseInt(e.style && e.style.zIndex, 10); if (!isNaN(v)) z = Math.max(z, v); } return z; };
        const excluded = (el) => !!el.closest("#sawa-call,[data-no-back]");
        // (٢) خلفيّة ورقة: fixed تغطّي الشاشة بلونٍ شفّاف
        let best = null, bz = -1;
        document.querySelectorAll('div[style*="fixed"]').forEach((el) => {
            const sx = el.style;
            if (sx.position !== "fixed" || excluded(el)) return;
            const covers = sx.inset === "0px" || (sx.top === "0px" && sx.left === "0px" && sx.right === "0px" && sx.bottom === "0px");
            if (!covers || !/rgba\(/.test(sx.backgroundColor || sx.background || "") || !vis(el)) return;
            const z = zOf(el); if (z >= bz) { bz = z; best = el; }
        });
        if (best) { best.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); return true; }
        // (٣) سهم الرجوع في رأس الشاشة الظاهرة
        let btn = null, btz = -1;
        const cands = new Set(document.querySelectorAll('button[aria-label="رجوع"],button[aria-label="Back"]'));
        document.querySelectorAll('button svg[data-i="ChevronLeft"],button svg[data-i="ChevronRight"],button svg[data-i="ArrowRight"],button svg[data-i="ArrowLeft"]').forEach((svg) => { const b = svg.closest("button"); if (b && b.getBoundingClientRect().top < 150) cands.add(b); });
        cands.forEach((b) => { if (excluded(b) || b.disabled || !vis(b)) return; const z = zOf(b); if (z >= btz) { btz = z; btn = b; } });
        if (btn) { btn.click(); return true; }
    } catch (e) { }
    return false;
};
// C99: ضغطٌ مطوّل حقيقيّ على الرسالة — ٥٠٠ مللي ث بلا تحريك (> ١٠ px). كان أيّ لمسٍ طويل أثناء التمرير يفتح القائمة،
//      وضغطة النظام المطوّلة تحدّد النصّ للنسخ. الحالة عامّة (لمسةٌ واحدة في كلّ مرّة) فلا تضيع إن أُعيد رسم الفقاعة أثناء الضغط.
const LP = { t: null, x: 0, y: 0, fired: false, at: 0 };
function lpClear() { if (LP.t) { clearTimeout(LP.t); LP.t = null; } }
if (typeof window !== "undefined" && !window.__lpBound) {
    window.__lpBound = true;
    window.addEventListener("scroll", lpClear, true);
    try { const css = document.createElement("style"); css.textContent = "[data-message-id],[data-message-id] *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}"; document.head.appendChild(css); } catch (e) { }
}
// C119: لا تظليل نصٍّ بلمسةٍ طويلة في أيّ مكان (كانت القوائم والأسماء تُظلَّل ويظهر شريط «نسخ · تحديد الكلّ») —
//       النسخ من قائمة الرسالة «نسخ» أو من وضع التحديد. حقول الكتابة وحدها تبقى قابلةً للتحديد.
(function () {
    try {
        if (document.getElementById("sawa-noselect")) return;
        const css = document.createElement("style"); css.id = "sawa-noselect";
        css.textContent = "html,body,body *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}" +
            "input,textarea,select,[contenteditable],[contenteditable] *,.sawa-selectable,.sawa-selectable *{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}";
        (document.head || document.documentElement).appendChild(css);
    } catch (e) { }
})();
function longPress(open) {
    return {
        onTouchStart: (e) => {
            LP.at = Date.now(); lpClear(); LP.fired = false;
            if (!e.touches || e.touches.length !== 1) return;
            LP.x = e.touches[0].clientX; LP.y = e.touches[0].clientY;
            LP.t = setTimeout(() => { LP.t = null; LP.fired = true; try { navigator.vibrate && navigator.vibrate(12); } catch (er) { } open(); }, 500);
        },
        onTouchMove: (e) => { const t0 = e.touches && e.touches[0]; if (t0 && Math.hypot(t0.clientX - LP.x, t0.clientY - LP.y) > 10) lpClear(); },
        onTouchEnd: (e) => { lpClear(); if (LP.fired) { LP.fired = false; if (e.cancelable) e.preventDefault(); } },
        onTouchCancel: lpClear,
        // الفأرة (حاسوب): الزرّ الأيمن. وعلى اللمس نتجاهله (نافذة النظام وتحديد النصّ)
        onContextMenu: (e) => { e.preventDefault(); if (Date.now() - LP.at < 1500) return; open(); },
    };
}
// C99: على الهاتف Enter = سطرٌ جديد (الإرسال بالزرّ) — كان ينزل السطر فيُرسل الرسالة. على الحاسوب Enter يرسل و Shift+Enter سطر.
function enterSends() { try { return !(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) && !window.SawaNativeBridge; } catch (e) { return true; } }
function useSheetBack(onClose) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const k = (e) => { if (e.key === "Escape" && FAM_SHEETS[FAM_SHEETS.length - 1] === me) closeRef.current(); };
        window.addEventListener("keydown", k);
        const me = { close: () => closeRef.current(), popped: false };
        try {
            famSheetBindPop();
            // خطوةٌ لكلّ ورقة — وإن أُغلقت ورقةٌ للتوّ نرث خطوتها بدل أن نعود ثمّ نتقدّم
            if (famSheetReusable > 0) famSheetReusable--;
            else history.pushState({ sawaSheet: 1 }, "");
        } catch (e) { }
        FAM_SHEETS.push(me);
        return () => {
            window.removeEventListener("keydown", k);
            const i = FAM_SHEETS.indexOf(me); if (i >= 0) FAM_SHEETS.splice(i, 1);
            if (me.popped) return;
            famSheetReusable++;
            setTimeout(() => {
                if (famSheetReusable <= 0) return;   // ورثتها ورقةٌ جديدة
                famSheetReusable--;
                try { if (history.state && history.state.sawaSheet) { famSheetSkipPop++; history.back(); } } catch (e) { }
            }, 0);
        };
    }, []);
}
function FamSheet({ title, subtitle, onClose, children, footer, maxHeight = "92%", z = 40, hero }) {
    const { colors } = useTheme();
    famCssOnce();
    useSheetBack(onClose);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { onClick: onClose, className: "sawa-fade-in", style: { position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", zIndex: z } }),
        React.createElement("div", { role: "dialog", "aria-modal": "true", "aria-label": title, className: "sawa-pop-in", style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: z + 1, backgroundColor: colors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: maxHeight, display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: "0 -10px 30px rgba(0,0,0,0.14)", "--fam-ring": colors.primary + "55" } },
            React.createElement("div", { className: "flex justify-center pt-2.5 pb-1 shrink-0" },
                React.createElement("div", { style: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border } })),
            (title || onClose) && React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 px-5 pt-1 pb-2 shrink-0` },
                React.createElement("div", { className: `flex-1 min-w-0 ${textStart()}` },
                    React.createElement("p", { className: "text-[17px] font-extrabold truncate", style: { color: colors.text } }, title),
                    subtitle && React.createElement("p", { className: "text-[11px] mt-0.5", style: { color: colors.textMuted } }, subtitle)),
                React.createElement("button", { "aria-label": tl("إغلاق", "Close"), onClick: onClose, className: "w-9 h-9 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.bg } },
                    React.createElement(X, { size: 16, color: colors.textMuted }))),
            hero || null,
            React.createElement("div", { className: "px-5 pt-1 pb-4 overflow-y-auto", style: { flex: 1, minHeight: 0 } }, children),
            footer && React.createElement("div", { className: "px-5 pt-2 pb-3 shrink-0", style: { borderTop: `1px solid ${colors.border}` } }, footer))));
}
// زرّ إجراء دائريّ ملوّن مع تسمية (اتّصال/رسالة/تعديل…)
function FamAction({ icon: Icon, label, onPress, bg, href }) {
    const { colors } = useTheme();
    const Tag = href ? "a" : "button";
    const on = !!(onPress || href);
    // C74: الزرّ يشمل الدائرة واسمها — كان النقر على الكلمة («تعديل»، «مفضّلة») لا يفعل شيئاً
    return React.createElement(Tag, { "aria-label": label, href: href, onClick: onPress, disabled: !on, className: "flex flex-col items-center gap-1.5 active:scale-95 transition-transform", style: { opacity: on ? 1 : 0.4, background: "none", border: 0, padding: 0, textDecoration: "none" } },
        React.createElement("span", { className: "rounded-full flex items-center justify-center", style: { width: 50, height: 50, backgroundColor: bg || colors.primary, boxShadow: `0 6px 14px ${(bg || colors.primary)}55` } }, React.createElement(Icon, { size: 21, color: "#fff" })),
        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, label));
}
// صفّ قائمة داخل بطاقة: أيقونة + عنوان + وصف + سهم
function FamRow({ icon: Icon, title, sub, onPress, tone, right, last }) {
    const { colors, isDark } = useTheme();
    const c = tone ? famTone(tone, isDark) : null;
    return React.createElement("button", { onClick: onPress, className: `w-full flex ${rowStart()} items-center gap-3 py-3 ${textStart()}`, style: { borderBottom: last ? "none" : `1px solid ${colors.border}` } },
        Icon && React.createElement("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center shrink-0", style: { backgroundColor: c ? c.bg : colors.primary + "14" } }, React.createElement(Icon, { size: 17, color: c ? c.fg : colors.primary })),
        React.createElement("div", { className: "flex-1 min-w-0" },
            React.createElement("div", { className: "text-[13.5px] font-bold truncate", style: { color: c ? c.fg : colors.text } }, title),
            sub && React.createElement("div", { className: "text-[11px] mt-0.5", style: { color: colors.textMuted } }, sub)),
        right || React.createElement(ChevronLeft, { size: 15, color: colors.textMuted, style: { transform: isRTL() ? "none" : "scaleX(-1)" } }));
}
function generateRecoveryCodes() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 10 }, () => {
        let code = "";
        for (let i = 0; i < 8; i++) {
            if (i === 4)
                code += "-";
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    });
}
// ============================================================================
// شاشة إعداد PIN
// ============================================================================
function SetupPinScreen({ onDone }) {
    const { colors } = useTheme();
    const [step, setStep] = useState("enter");
    const [firstPin, setFirstPin] = useState("");
    const [pin, setPin] = useState("");
    const [mismatch, setMismatch] = useState(false);
    const [codes, setCodes] = useState([]);
    const [confirmed, setConfirmed] = useState(false);
    function handleDigit(d) {
        if (pin.length >= 6)
            return;
        const next = pin + d;
        setPin(next);
        setMismatch(false);
        if (next.length === 6) {
            if (step === "enter") {
                setFirstPin(next);
                setTimeout(() => { setStep("confirm"); setPin(""); }, 150);
            }
            else {
                if (next === firstPin) {
                    setCodes(generateRecoveryCodes());
                    setStep("codes");
                }
                else {
                    setMismatch(true);
                    setTimeout(() => { setPin(""); setStep("enter"); setFirstPin(""); }, 700);
                }
            }
        }
    }
    if (step === "codes") {
        return (React.createElement("div", { className: "flex-1 overflow-y-auto p-6", style: { backgroundColor: colors.bg } },
            React.createElement(Key, { size: 36, color: colors.primary, className: "mx-auto" }),
            React.createElement("h2", { className: "text-lg font-extrabold text-center mt-3", style: { color: colors.text } }, t("rmwz_alastrjaa_alahtyatya")),
            React.createElement("p", { className: "text-xs text-center mt-2 px-2", style: { color: colors.textMuted } }, t("ahfz_hdhh_alrmwz_fy")),
            React.createElement(Card, { style: { marginTop: 16 } }, codes.map((c, i) => (React.createElement("div", { key: i, className: "text-center font-bold my-1 tracking-widest", style: { color: colors.text } }, c)))),
            React.createElement("button", { onClick: () => setConfirmed(!confirmed), className: `flex ${rowStart()} items-center gap-2 justify-center mt-4 mx-auto` },
                React.createElement("div", { className: "w-5 h-5 rounded border-2 flex items-center justify-center", style: { borderColor: colors.primary, backgroundColor: confirmed ? colors.primary : "transparent" } }, confirmed && React.createElement(Check, { size: 12, color: "#fff" })),
                React.createElement("span", { className: "text-xs", style: { color: colors.text } }, t("hfzt_alrmwz_fy_mkan"))),
            React.createElement("div", { className: "mt-4" },
                React.createElement(Button, { label: t("mtabaa"), onPress: () => onDone(firstPin, codes), disabled: !confirmed }))));
    }
    return (React.createElement("div", { className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { className: "flex flex-col items-center justify-center py-4" },
            React.createElement(Lock, { size: 30, color: colors.primary }),
            React.createElement("h2", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, step === "enter" ? "أنشئ رمز قفل التطبيق" : "أكّد الرمز"),
            React.createElement("p", { className: "text-xs text-center mt-2 px-8", style: { color: colors.textMuted } }, step === "enter" ? "هذا الرمز يحميك أنت وجميع بيانات التطبيق" : "أدخل نفس الرمز مرة أخرى"),
            React.createElement(PinDots, { filled: pin.length, error: mismatch }),
            mismatch && React.createElement("p", { className: "text-xs font-bold", style: { color: colors.danger } }, t("alrmzan_ghyr_mttabqyn"))),
        React.createElement(PinKeypad, { onDigit: handleDigit, onBackspace: () => setPin((p) => p.slice(0, -1)), showBiometric: false })));
}
// ============================================================================
// شاشة القفل
// ============================================================================
function LockScreen({ onUnlock, onForgot, correctPin, biometricEnabled }) {
    const { colors } = useTheme();
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [lockMsg, setLockMsg] = useState("");
    function handleDigit(d) {
        if (pin.length >= 6)
            return;
        const next = pin + d;
        setPin(next);
        if (next.length === 6) {
            if (next === correctPin) {
                onUnlock();
            }
            else {
                const a = attempts + 1;
                setAttempts(a);
                setError(true);
                if (a === 4)
                    setLockMsg("محاولات كثيرة — انتظر 30 ثانية (محاكاة)");
                else if (a >= 5)
                    setLockMsg("محاولات كثيرة — انتظر 5 دقائق (محاكاة)");
                setTimeout(() => { setPin(""); setError(false); }, 500);
            }
        }
    }
    return (React.createElement("div", { className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { className: "flex flex-col items-center justify-center py-4" },
            React.createElement("div", { className: "w-16 h-16 rounded-full flex items-center justify-center mb-3", style: { backgroundColor: colors.primary } },
                React.createElement("span", { className: "text-white text-xl font-extrabold" }, appName())),
            React.createElement("h2", { className: "text-sm font-bold", style: { color: colors.text } }, t("adkhl_rmz_alqfl")),
            React.createElement(PinDots, { filled: pin.length, error: error }),
            lockMsg && React.createElement("p", { className: "text-xs font-bold text-center px-8", style: { color: colors.danger } }, lockMsg),
            React.createElement("button", { onClick: onForgot, className: "mt-3 text-xs font-bold", style: { color: colors.primary } }, t("nsyt_alrmz"))),
        React.createElement(PinKeypad, { onDigit: handleDigit, onBackspace: () => setPin((p) => p.slice(0, -1)), onBiometric: onUnlock, showBiometric: biometricEnabled })));
}
// ============================================================================
// شاشة نسيت الرمز
// ============================================================================
function ForgotPinScreen({ onBack, onRecovered, validCodes }) {
    const { colors } = useTheme();
    const [step, setStep] = useState("choose");
    const [codeInput, setCodeInput] = useState("");
    const [otpInput, setOtpInput] = useState("");
    const [error, setError] = useState("");
    const [pin, setPin] = useState("");
    const [firstPin, setFirstPin] = useState("");
    const [newPinStep, setNewPinStep] = useState("enter");
    const [mismatch, setMismatch] = useState(false);
    function verifyCode() {
        if (validCodes.includes(codeInput.trim().toUpperCase())) {
            setStep("newPin");
        }
        else {
            setError(t("alrmz_ghyr_shyh_aw"));
        }
    }
    function verifyOtp() {
        if (otpInput === "123456")
            setStep("newPin");
        else
            setError(t("rmz_althqq_ghyr_shyh"));
    }
    function handleNewPinDigit(d) {
        if (pin.length >= 6)
            return;
        const next = pin + d;
        setPin(next);
        setMismatch(false);
        if (next.length === 6) {
            if (newPinStep === "enter") {
                setFirstPin(next);
                setTimeout(() => { setNewPinStep("confirm"); setPin(""); }, 150);
            }
            else if (next === firstPin) {
                onRecovered(next, generateRecoveryCodes());
            }
            else {
                setMismatch(true);
                setTimeout(() => { setPin(""); setNewPinStep("enter"); }, 700);
            }
        }
    }
    if (step === "newPin") {
        return (React.createElement("div", { className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: "flex flex-col items-center justify-center py-4" },
                React.createElement(Lock, { size: 28, color: colors.primary }),
                React.createElement("h2", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, newPinStep === "enter" ? "عيّن رمزاً جديداً" : "أكّد الرمز الجديد"),
                React.createElement(PinDots, { filled: pin.length, error: mismatch })),
            React.createElement(PinKeypad, { onDigit: handleNewPinDigit, onBackspace: () => setPin((p) => p.slice(0, -1)), showBiometric: false })));
    }
    return (React.createElement("div", { className: "flex-1 overflow-y-auto p-6", style: { backgroundColor: colors.bg } },
        React.createElement("button", { "aria-label": t("ighlaq"), onClick: onBack, className: "mb-4" },
            React.createElement(X, { size: 20, color: colors.textMuted })),
        step === "choose" && (React.createElement(React.Fragment, null,
            React.createElement("h2", { className: "text-lg font-extrabold mb-1", style: { color: colors.text } }, t("astrjaa_alwswl")),
            React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("akhtr_tryqa_alastrjaa")),
            React.createElement("button", { onClick: () => setStep("code"), className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 border mb-3`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement(Key, { size: 20, color: colors.primary }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, t("rmz_astrjaa_ahtyaty")),
                    React.createElement("div", { className: "text-[11px]", style: { color: colors.textMuted } }, t("adkhl_ahd_alrmwz_alty")))),
            React.createElement("button", { onClick: () => setStep("otp"), className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 border mb-3`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement(Mail, { size: 20, color: colors.primary }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, t("rmz_thqq_abr_albryd")),
                    React.createElement("div", { className: "text-[11px]", style: { color: colors.textMuted } }, t("nrsl_rmza_ila_alqnaa")))),
            React.createElement("button", { onClick: () => setStep("reset"), className: `w-full flex ${rowStart()} items-center gap-3 rounded-xl p-3 border`, style: { borderColor: colors.danger, backgroundColor: colors.card } },
                React.createElement(AlertTriangle, { size: 20, color: colors.danger }),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.danger } }, t("iaada_tayyn_kamla_mladh")),
                    React.createElement("div", { className: "text-[11px]", style: { color: colors.textMuted } }, t("ymsh_jmya_albyanat_almhlya")))))),
        step === "code" && (React.createElement(React.Fragment, null,
            React.createElement("h2", { className: "text-lg font-extrabold mb-4", style: { color: colors.text } }, t("adkhl_alrmz_alahtyaty")),
            React.createElement("input", { dir: "ltr", value: codeInput, onChange: (e) => setCodeInput(e.target.value.toUpperCase()), placeholder: "XXXX-XXXX", className: "w-full border rounded-xl px-3 py-3 text-center tracking-widest mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            error && React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, error),
            React.createElement(Button, { label: t("thqq"), onPress: verifyCode }))),
        step === "otp" && (React.createElement(React.Fragment, null,
            React.createElement("h2", { className: "text-lg font-extrabold mb-1", style: { color: colors.text } }, t("adkhl_rmz_althqq")),
            React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("jrb_123456_mhakaa")),
            React.createElement("input", { dir: "ltr", value: otpInput, onChange: (e) => setOtpInput(e.target.value), placeholder: "000000", maxLength: 6, className: "w-full border rounded-xl px-3 py-3 text-center tracking-widest mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            error && React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, error),
            React.createElement(Button, { label: t("thqq"), onPress: verifyOtp }))),
        step === "reset" && (React.createElement(React.Fragment, null,
            React.createElement(AlertTriangle, { size: 32, color: colors.danger, className: "mx-auto mb-3" }),
            React.createElement("h2", { className: "text-base font-extrabold text-center mb-2", style: { color: colors.text } }, t("mtakd_mn_almsh_alkaml")),
            React.createElement("p", { className: "text-xs text-center mb-4 px-4", style: { color: colors.textMuted } }, t("hdha_ymsh_rmz_alqfl")),
            React.createElement(Button, { label: t("amsh_kl_shy"), variant: "filled", onPress: () => onRecovered(null, null, true), className: "mb-2", style: { backgroundColor: colors.danger } }),
            React.createElement(Button, { label: t("ilgha"), variant: "outline", onPress: () => setStep("choose") })))));
}
// ============================================================================
// شاشة رموز الاسترجاع بعد الاسترجاع
// ============================================================================
function PostRecoveryCodesScreen({ codes, onDone }) {
    const { colors } = useTheme();
    const [confirmed, setConfirmed] = useState(false);
    return (React.createElement("div", { className: "flex-1 overflow-y-auto p-6", style: { backgroundColor: colors.bg } },
        React.createElement(Key, { size: 36, color: colors.primary, className: "mx-auto" }),
        React.createElement("h2", { className: "text-lg font-extrabold text-center mt-3", style: { color: colors.text } }, t("rmwz_astrjaa_jdyda")),
        React.createElement("p", { className: "text-xs text-center mt-2 px-2", style: { color: colors.textMuted } }, t("alqdyma_asbht_laghya_tlqayya")),
        React.createElement(Card, { style: { marginTop: 16 } }, codes.map((c, i) => React.createElement("div", { key: i, className: "text-center font-bold my-1 tracking-widest", style: { color: colors.text } }, c))),
        React.createElement("button", { onClick: () => setConfirmed(!confirmed), className: `flex ${rowStart()} items-center gap-2 justify-center mt-4 mx-auto` },
            React.createElement("div", { className: "w-5 h-5 rounded border-2 flex items-center justify-center", style: { borderColor: colors.primary, backgroundColor: confirmed ? colors.primary : "transparent" } }, confirmed && React.createElement(Check, { size: 12, color: "#fff" })),
            React.createElement("span", { className: "text-xs", style: { color: colors.text } }, t("hfzt_alrmwz_bmkan_amn"))),
        React.createElement("div", { className: "mt-4" },
            React.createElement(Button, { label: t("mtabaa"), onPress: onDone, disabled: !confirmed }))));
}
// ============================================================================
// شاشات التطبيق الرئيسي
// ============================================================================
function ConnectBackendScreen({ onDone, onSkip }) {
    const { colors } = useTheme();
    const [phone, setPhone] = useState("");
    const [step, setStep] = useState("phone"); // phone | otp
    const [code, setCode] = useState("");
    const [error, setError] = useState(false);
    const DEMO_CODE = "1234";
    function handleVerify() {
        if (code.trim() === DEMO_CODE) {
            setError(false);
            onDone(t("mstkhdm_swa", { app: appName() }));
        }
        else {
            setError(true);
        }
    }
    return (React.createElement("div", { className: "flex-1 flex flex-col justify-center items-center p-6", style: { backgroundColor: colors.bg } },
        React.createElement("img", { src: IS_RAHIM ? APP_LOGO_RAHIM : SAWA_LOGO, alt: appName(), style: { width: 80, height: 80, objectFit: "contain", marginBottom: 16 } }),
        React.createElement("h2", { className: "text-xl font-extrabold text-center mb-1", style: { color: colors.text } }, t("mrhba_bk_fy_swa")),
        step === "phone" ? (React.createElement("div", { className: "w-full mt-6" },
            React.createElement("label", { className: `text-xs font-bold mb-1.5 block ${textStart()}`, style: { color: colors.textMuted } }, t("rqm_aljwal")),
            React.createElement("input", { dir: "ltr", value: phone, onChange: (e) => setPhone(e.target.value), placeholder: "09XXXXXXXX", inputMode: "tel", className: `w-full border rounded-2xl px-4 py-3 text-sm mb-4 ${textStart()}`, style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, minWidth: 0 } }),
            React.createElement(Button, { label: t("irsal_rmz_althqq"), onPress: () => phone.trim() && setStep("otp"), disabled: !phone.trim() }),
            React.createElement("button", { onClick: onSkip, className: "mt-3 text-xs font-bold w-full text-center", style: { color: colors.textMuted } }, t("tkhty")))) : (React.createElement("div", { className: "w-full mt-6" },
            React.createElement("p", { className: "text-xs text-center mb-4", style: { color: colors.textMuted } },
                t("arsl_rmz_althqq_ila"),
                React.createElement("span", { className: "font-bold", style: { color: colors.text } }, phone)),
            React.createElement("label", { className: `text-xs font-bold mb-1.5 block ${textStart()}`, style: { color: colors.textMuted } },
                t("rmz_althqq"),
                React.createElement("span", { style: { color: colors.primary } },
                    "(\u062A\u062C\u0631\u064A\u0628\u064A: ",
                    DEMO_CODE,
                    ")")),
            React.createElement("input", { dir: "ltr", value: code, onChange: (e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(false); }, placeholder: "1234", inputMode: "numeric", maxLength: 4, className: "w-full border rounded-2xl px-4 py-3 text-lg mb-1 tracking-widest text-center font-extrabold", style: { borderColor: error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.card, minWidth: 0 }, autoFocus: true }),
            error && React.createElement("p", { className: "text-xs text-center mb-2 font-bold", style: { color: colors.danger } },
                "\u0631\u0645\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u060C \u062C\u0631\u0651\u0628: ",
                DEMO_CODE),
            React.createElement("div", { className: "mt-3" },
                React.createElement(Button, { label: t("dkhwl"), onPress: handleVerify, disabled: code.length < 4 })),
            React.createElement("button", { onClick: () => setStep("phone"), className: "mt-3 text-xs font-bold w-full text-center", style: { color: colors.textMuted } }, t("tghyyr_alrqm"))))));
}
function PlaceholderTab({ icon: Icon, title, note }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex-1 overflow-y-auto flex flex-col items-center justify-center p-6", style: { backgroundColor: colors.bg } },
        React.createElement(Icon, { size: 40, color: colors.border }),
        React.createElement("h3", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, title),
        React.createElement("p", { className: "text-xs text-center mt-1", style: { color: colors.textMuted } }, note)));
}
function MeScreen({ onOpenSettings, onOpenNotifications, statusOption, profilePhoto, onLogout, onOpenLinkedDevices, onOpenWrapped, onOpenFeedback, onExportTree, onImportTree, myProfile = null }) {
    // حسابي الحقيقيّ (SawaChat): اسم «سوا» + الرقم (غير موثّق)؛ زرّ التعديل يفتح نافذة الحساب
    const sawaBuild = useSawaBuild();
    const reqCount = useSawaRequests();
    const cloudMe = !!(myProfile && window.SawaChat && window.SawaChat.editProfile);
    const SCm = window.SawaChat;
    // C24: «فحص الاتّصال» لمدير التطبيق وحده (الخادم يقرّر)
    const [isAdm, setIsAdm] = useState(() => !!(SCm && SCm.adminCached && SCm.adminCached()));
    const [updAvail, setUpdAvail] = useState(() => !!(SCm && SCm.updateAvailable && SCm.updateAvailable()));
    useEffect(() => { const on = (e) => setUpdAvail(!!(e.detail && e.detail.available)); window.addEventListener("sawa-update-state", on); return () => window.removeEventListener("sawa-update-state", on); }, []);
    useEffect(() => { let on = true; if (SCm && SCm.checkAdmin) SCm.checkAdmin().then((v) => { if (on) setIsAdm(!!v); }); return () => { on = false; }; }, [myProfile && myProfile.uid]);
    const myDisplayName = cloudMe ? (myProfile.name || myProfile.googleName || "") : "";
    const editMe = () => { if (cloudMe && window.SawaChat.editProfile()) return; onOpenSettings(); };
    // C13c: لا اسمَ ولا رقمَ وهميّين — حالةٌ صادقة حتّى يصل الحساب (تحميل · تعذّر · لم يُسجَّل الدخول)
    const [meT0] = useState(() => Date.now());
    const [, meTick] = useState(0);
    useEffect(() => { if (cloudMe || !SCm) return; const iv = setInterval(() => meTick((n) => n + 1), 1500); return () => clearInterval(iv); }, [cloudMe]);
    const meState = cloudMe || !SCm ? null
        : (SCm.uid && SCm.uid()) ? ((SCm.status && SCm.status().error) ? "err" : "loading")
        : (Date.now() - meT0 > 8000 ? "noauth" : "loading");
    const { colors } = useTheme();
    const statusMap = {
        online: { label: t("hala_mtsl"), color: colors.success },
        busy: { label: t("hala_mshghwl"), color: colors.danger },
        away: { label: t("hala_bayd"), color: colors.accent },
        unavailable: { label: t("hala_ghyr_mtah"), color: colors.textMuted },
    };
    const currentStatus = statusMap[statusOption] || statusMap.online;
    const listItems = [
        // C10: رمز سوا وطلبات التواصل
        ...(cloudMe && SCm.codeSheet ? [
            { key: "mycode", label: tl("رمزي في سوا", "My Sawa code"), icon: QrCode, onPress: () => SCm.codeSheet(), color: "#2F80C8" },
            // C59: الضيف يرى صفّاً بارزاً للربط (Google أو البريد) — كان مخفيّاً داخل «السحابة والمشاركة»
            ...((window.SawaSync && window.SawaSync.authInfo && (window.SawaSync.authInfo() || {}).anon && SCm.linkSheet) ? [{ key: "link", label: tl("اربط حسابك بـGoogle أو البريد — حتى لا يضيع", "Link to Google or email — so it isn't lost"), icon: Lock, onPress: () => SCm.linkSheet(), color: "#B45309" }] : []),
            // C56: فحص الإشعارات والمكالمات في الخلفية — إشعارٌ تجريبيّ حقيقيّ وإرشادات الهاتف
            { key: "pushcheck", label: tl("الإشعارات والمكالمات في الخلفية", "Notifications & background calls"), icon: BellIcon, onPress: () => { if (SCm && SCm.pushCheckSheet) SCm.pushCheckSheet(); }, color: "#F59E0B" },
            { key: "requests", label: tl("طلبات التواصل", "Contact requests") + (reqCount ? " (" + reqCount + ")" : ""), icon: UserPlus, onPress: () => SCm.requestsSheet(), color: reqCount ? "#E11D48" : "#2F80C8" },
        ] : []),
        // C39: تثبيت التطبيق على الشاشة الرئيسيّة — يظهر فقط حين يُفتح سوا من المتصفّح على هاتف
        ...(SCm && SCm.installable && SCm.installable() ? [{ key: "install", label: tl("ثبّت سوا على هاتفك", "Install Sawa on your phone"), icon: Download, onPress: () => SCm.installSheet(), color: "#2F80C8" }] : []),
        { key: "feedback", label: t("me_arsl_mlahza"), icon: Send, onPress: onOpenFeedback, color: "#10B981" },
        { key: "settings", label: t("me_iadadat_almlf"), icon: MoreHorizontal, onPress: onOpenSettings },
        { key: "notifications", label: RELEASE_UI ? tl("التذكيرات", "Reminders") : t("me_mrkz_altnbyhat"), icon: BellIcon, onPress: onOpenNotifications },
        // ⛔ الأجهزة المرتبطة ربطُ محادثات، والإحصائيات إحصاءُ رسائل
        // ومكالمات — كلاهما خارج صلة الرحم فيُسحبان من أرحام.
        ...(IS_RAHIM || RELEASE_UI ? [] : [
            { key: "devices", label: t("me_alajhza_almrtbta"), icon: Smartphone, onPress: onOpenLinkedDevices, color: "#3B82F6" },
            { key: "wrapped", label: t("me_ihsayyaty"), icon: BarChart3, onPress: onOpenWrapped, color: "#EC4899" },
        ]),
        { key: "export", label: t("me_tsdyr_alshjra"), icon: Download, onPress: onExportTree, color: "#0EA5E9" },
        { key: "import", label: t("me_astyrad_alshjra"), icon: Upload, onPress: onImportTree, color: "#8B5CF6" },
        // الجسر (B5): لوحة السحابة والمشاركة (رفع، Google، روابط، استعادة) — sawa-sync.js
        // فحص الاتّصال (diag.html): يعمل داخل التطبيق المثبّت أيضاً — زرّ «رجوع إلى سوا» في أسفله
        ...(isAdm ? [{ key: "diag", label: tl("فحص الاتّصال (للمدير)", "Connection check (admin)"), icon: Wifi, onPress: () => { location.href = "./diag.html"; }, color: "#64748B" }] : []),
        // C132: تنزيل تطبيق أندرويد (APK) — لمن يفتح سوا من المتصفّح على غير آيفون
        ...(!window.SawaNativeBridge && !window.SawaIOS && !/iPhone|iPad|iPod/.test(navigator.userAgent || "") ? [{ key: "apk", label: tl("تنزيل تطبيق أندرويد (APK)", "Download the Android app (APK)"), icon: Download, onPress: () => { location.href = "/download"; }, color: "#16A34A" }] : []),
        // C131: نتائج تقييم المكالمات (المحرّك · النسخة · التأخير · الصدى…) — للمدير
        ...(isAdm ? [{ key: "voip", label: tl("اختبار مكالمة الآيفون (للمدير)", "iPhone call test (admin)"), icon: Phone, onPress: () => { if (window.SawaChat && window.SawaChat.voipTest) window.SawaChat.voipTest(); }, color: "#2F80C8" }] : []),   // C151
        ...(isAdm ? [{ key: "reports", label: tl("البلاغات (للمدير)", "Reports (admin)"), icon: Flag, onPress: () => { if (window.SawaChat && window.SawaChat.adminReports) window.SawaChat.adminReports(); }, color: "#DC2626" }] : []),   // C150
        ...(isAdm ? [{ key: "qa", label: tl("تقييمات المكالمات (للمدير)", "Call ratings (admin)"), icon: Star, onPress: () => { if (window.SawaRTC && window.SawaRTC.qaReport) window.SawaRTC.qaReport(); }, color: "#F59E0B" }] : []),
        // C83: تحديث التطبيق لكلّ مستخدم — النسخة، ما الجديد، وتحديثٌ قسريّ آمن
        ...(SCm && SCm.updateSheet ? [{ key: "update", label: updAvail ? tl("تحديث التطبيق • نسخةٌ جديدة ✨", "App update • new ✨") : tl("تحديث التطبيق", "App update"), icon: RotateCcw, onPress: () => SCm.updateSheet(), color: updAvail ? "#D97706" : "#2F80C8" }] : []),
        // C11: صفحاتٌ عامّة على الموقع (Google Play يطلب رابطيها)
        { key: "legal", label: tl("الخصوصيّة والشروط", "Privacy & terms"), icon: ShieldCheck, onPress: () => { location.href = "/privacy"; }, color: "#64748B" },
        { key: "cloud", label: t("me_rfa_alshjra"), icon: Cloud, onPress: () => { if (window.SawaSync) (window.SawaSync.openPanel ? window.SawaSync.openPanel() : window.SawaSync.uploadCurrent()); }, color: "#187854" },
        // في مرحلة التجربة: الوصول للملاحظات من مكان ثابت يعرفه المجرِّب
    ];
    // اختبار قلب الاتجاه — شاشة ثانية
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 flex flex-col overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { style: { background: `linear-gradient(160deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`, paddingBottom: 132, position: "relative" } },
            React.createElement("div", { className: `flex ${rowStart()} items-center justify-between px-5 pt-5 pb-4` },
                React.createElement("span", { className: "text-base font-extrabold text-white tracking-wide" }, appName()),
                React.createElement("span", { className: "text-xs font-bold", style: { color: "rgba(255,255,255,0.6)" } }, t("hsaby")))),
        React.createElement("div", { className: "mx-4 rounded-2xl shadow-lg px-5 pt-5 pb-4", style: { backgroundColor: colors.card, marginTop: -120, position: "relative", zIndex: 2, border: `1px solid ${colors.border}` } },
            React.createElement("div", { className: `flex ${rowStart()} items-center gap-4` },
                React.createElement("div", { className: "shrink-0 rounded-2xl overflow-hidden flex items-center justify-center", style: { width: 68, height: 68, backgroundColor: colors.primaryLight, border: `3px solid ${colors.primary}` } },
                    myProfile && myProfile.photo && React.createElement("img", { src: myProfile.photo, alt: t("swrty"), className: "w-full h-full object-cover" }),
                    !(myProfile && myProfile.photo) && React.createElement("span", { className: "text-2xl font-extrabold", style: { color: colors.primary } }, myDisplayName ? myDisplayName.charAt(0) : t("s"))),
                React.createElement("div", { className: `flex-1 ${textStart()}`, style: { minWidth: 0 } },
                    React.createElement("h3", { className: "text-base font-extrabold truncate", style: { color: colors.text } }, myDisplayName || (meState === "loading" ? tl("جارٍ تحميل حسابك…", "Loading your account…") : meState === "err" ? tl("تعذّر تحميل حسابك", "Couldn't load your account") : meState === "noauth" ? tl("لم تسجّل الدخول", "Not signed in") : t("mstkhdm_swa", { app: appName() }))),
                    cloudMe ? (myProfile.phone
                        ? React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-0.5 flex-wrap`, style: { color: colors.textMuted } },
                            React.createElement("span", { className: "text-xs", dir: "ltr" }, myProfile.phone),
                            myProfile.phoneVerified
                                ? React.createElement("span", { className: "text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0", style: { color: "#187854", backgroundColor: "#E8F5EE" } }, myProfile.verifiedBy === "contacts" ? tl("مؤكَّد من معارفك ✓", "Confirmed by contacts ✓") : tl("موثّق ✓", "Verified ✓"))
                                : React.createElement("button", { onClick: () => { try { SCm.verifySheet(); } catch (e) {} }, className: "text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0", style: { color: "#B7791F", backgroundColor: "#FEF3C7" } }, tl("غير موثّق — وثّقه", "Unverified — verify")))
                        : React.createElement("button", { onClick: editMe, className: "text-xs mt-0.5 font-bold", style: { color: colors.primary } }, "+ أضف رقم هاتفك"))
                        : meState === "err" ? React.createElement("button", { onClick: () => { try { SCm.refresh(); } catch (e) {} meTick((n) => n + 1); }, className: "text-xs mt-0.5 font-bold", style: { color: colors.primary } }, tl("↻ إعادة المحاولة", "↻ Retry"))
                        : meState === "noauth" ? React.createElement("button", { onClick: () => { try { SCm.startOnboarding(); } catch (e) {} }, className: "text-xs mt-0.5 font-bold", style: { color: colors.primary } }, tl("تسجيل الدخول ←", "Sign in →"))
                        : React.createElement("p", { className: "text-xs mt-0.5 truncate", style: { color: colors.textMuted } }, meState === "loading" ? tl("لحظات…", "One moment…") : ""),
                    cloudMe && myProfile.code && SCm.fmtCode && React.createElement("button", { onClick: () => SCm.codeSheet(), className: `flex ${rowStart()} items-center gap-1.5 mt-1`, style: { color: colors.primary } },
                        React.createElement("span", { className: "text-[11px] font-bold" }, tl("رمزك:", "Code:")),
                        React.createElement("span", { className: "text-xs font-extrabold", dir: "ltr", style: { letterSpacing: 1, whiteSpace: "nowrap" } }, SCm.fmtCode(myProfile.code))),
                    cloudMe && myProfile.emailVerified && React.createElement("div", { className: "text-[10px] font-bold mt-1", style: { color: "#187854" } }, tl("✓ بريدك موثّق — يمكن لمعارفك إيجادك به", "✓ Email verified — people can find you by it")),
                    !RELEASE_UI && React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-2` },
                        React.createElement("span", { className: "w-2 h-2 rounded-full shrink-0", style: { backgroundColor: currentStatus.color } }),
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: currentStatus.color } }, currentStatus.label))),
                React.createElement("button", { "aria-label": t("tadyl"), onClick: editMe, className: "shrink-0 rounded-xl flex items-center justify-center", style: { width: 36, height: 36, backgroundColor: colors.primaryLight } },
                    React.createElement(Edit2, { size: 15, color: colors.primary })))),
        React.createElement("div", { className: "mt-4 flex flex-col", style: { backgroundColor: colors.card } }, listItems.map((item, i) => (React.createElement("button", { "aria-label": t("altaly"), key: item.key, onClick: item.onPress, className: `w-full flex ${rowStart()} items-center justify-between px-4 py-3.5`, style: { borderBottom: i < listItems.length - 1 ? `1px solid ${colors.border}` : "none" } },
            React.createElement(item.icon, { size: 18, color: item.color || colors.primary }),
            React.createElement("span", { className: `flex-1 text-sm font-bold ${textStart()} ${ms("2")}`, style: { color: colors.text } }, item.label),
            React.createElement(ChevronLeft, { size: 16, color: colors.textMuted, style: { transform: "scaleX(-1)" } }))))),
        React.createElement("div", { className: "mt-2", style: { backgroundColor: colors.card } },
            React.createElement("button", { onClick: onLogout, className: `w-full flex ${rowStart()} items-center gap-2 px-4 py-3.5` },
                React.createElement(LogOut, { size: 18, color: colors.danger }),
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("tsjyl_alkhrwj"))),
            // C11: حذف الحساب نهائيّاً (شرط Google Play) — نافذة تأكيد في SawaChat
            cloudMe && SCm.deleteAccountSheet && React.createElement("button", { onClick: () => SCm.deleteAccountSheet(), className: `w-full flex ${rowStart()} items-center gap-2 px-4 py-3`, style: { borderTop: `1px solid ${colors.border}` } },
                React.createElement(Trash2, { size: 16, color: colors.textMuted }),
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, tl("حذف حسابي", "Delete my account")))),
        // رقم النسخة — يُحقن آلياً من sw.js عند كل بناء (انظر build.sh)
        React.createElement("p", { className: "text-[10px] text-center py-4", style: { color: colors.textMuted } }, appName() + " " + sawaBuild + (window.SawaChat && window.SawaChat.version ? " · " + window.SawaChat.version : ""))));
}
// نظام الدعوة والمكافأة — رموز ثابتة مبرمجة بالكود (مو مولّدة عشوائياً)،
// و50 ج.س بالضبط لكل طرف عند استخدام رمز الطرف الآخر
// __SAWA_BUILD__ — يستبدلها build.sh برقم النسخة من sw.js
const SAWA_BUILD = "v190";
// C9b: رقم النسخة الفعليّ يُسأل عنه عامل الخدمة (VERSION في sw.js) — بدل رقمٍ مكتوبٍ يدويّاً يتقادم
// ⛔ الرسائل ليست مشفّرة طرفاً لطرف بعد (يقرؤها حساب الخدمة) — بطاقات «بصمة الأمان» و«التحقّق المتبادل» كانت شكليّة.
//    تُخفى حتّى يُبنى التشفير الحقيقيّ. المكالمات مشفّرة فعلاً بين الأجهزة (DTLS-SRTP في WebRTC).
const SHOW_E2E_UI = false;
// C20: نسخة الإطلاق — تُخفى الواجهات التجريبيّة (أجهزة مرتبطة وهميّة، إحصائيّات مكتوبة، قفل PIN بلا أثر، جلسات وهميّة،
//      دعوة بمكافأة، حالة لا تصل لأحد، مفاتيح تشفير غير موجودة…). الشيفرة باقية خلف هذا المفتاح.
const RELEASE_UI = true;
// C10: نصٌّ بلغتين لما يُضاف حديثاً (العربيّة افتراضيّاً)
function tl(ar, en) { return isRTL() ? arCountFix(ar) : en; }
// C10: عدد طلبات التواصل الواردة (من SawaChat — حدث sawa-requests)
function useSawaRequests() {
    const [n, setN] = React.useState(() => { try { return window.SawaChat && window.SawaChat.requestCount ? window.SawaChat.requestCount() : 0; } catch (e) { return 0; } });
    React.useEffect(() => {
        const on = (e) => setN(Number(e.detail) || 0);
        window.addEventListener("sawa-requests", on);
        return () => window.removeEventListener("sawa-requests", on);
    }, []);
    return n;
}
function useSawaBuild() {
    const [v, setV] = React.useState(() => { try { return localStorage.getItem("sawa_build") || SAWA_BUILD; } catch (e) { return SAWA_BUILD; } });
    React.useEffect(() => {
        const sw = navigator.serviceWorker;
        if (!sw || !sw.controller) return;
        const on = (e) => {
            const d = e.data || {};
            if (d.type !== "sawa-version" || !d.version) return;
            const n = String(d.version).replace(/^sawa-/, "");
            setV(n); try { localStorage.setItem("sawa_build", n); } catch (x) {}
        };
        sw.addEventListener("message", on);
        try { sw.controller.postMessage({ type: "sawa-version" }); } catch (e) {}
        return () => sw.removeEventListener("message", on);
    }, []);
    return v;
}
const SAWA_APP = (function () {
    try {
        const q = new URLSearchParams(location.search).get("app"); // ⛔ مُعرِّف لا نصّ
        if (q === "rahim" || q === "sawa")
            return q;
        const w = window.__SAWA_APP; // ⛔ يُتحقَّق منه كالرابط: مجهولٌ يسقط للافتراض
        return (w === "rahim" || w === "sawa") ? w : "sawa";
    }
    catch (e) {
        return "sawa";
    }
})();
const IS_RAHIM = SAWA_APP === "rahim";
// اسمٌ وشعارٌ لكلّ تطبيق. شعار أرحام ملفٌّ في موقعه لا base64 مضمّن،
// فلا يحمل سوا وزنَ شعارٍ لا يعرضه.
function appName() { return IS_RAHIM ? t("arham") : t("swa"); } // ⛔ لا تستبدل t("swa") هنا استبدالاً شاملاً
const MY_REFERRAL_CODE = "SAWA-SARA";
const OTHER_REFERRAL_CODE = "SAWA-KHALID";
const REFERRAL_REWARD_SDG = 50;
function ReferralSection({ myCode, redeemedCode, onRedeem }) {
    const { colors } = useTheme();
    const [codeInput, setCodeInput] = useState("");
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    function handleCopy() {
        copyText(myCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }
    function handleRedeem() {
        setError("");
        const normalized = codeInput.trim().toUpperCase();
        if (normalized === myCode) {
            setError(t("la_ymknk_astkhdam_rmzk"));
            return;
        }
        if (normalized !== OTHER_REFERRAL_CODE) {
            setError(t("rmz_aldawa_ghyr_shyh"));
            return;
        }
        if (redeemedCode) {
            setError(t("astkhdmt_rmz_dawa_mn"));
            return;
        }
        onRedeem(normalized);
        setCodeInput("");
    }
    return (React.createElement("div", { className: "w-[90%] mt-4" },
        React.createElement("h4", { className: `text-sm font-extrabold mb-2 flex ${rowStart()} items-center gap-1.5`, style: { color: colors.text } },
            React.createElement(Gift, { size: 16, color: colors.primary }),
            t("dawa_asdqa")),
        React.createElement(Card, null,
            React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-1` },
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, t("rmzk_alkhas")),
                React.createElement("button", { onClick: handleCopy, className: "text-[10px] font-bold", style: { color: colors.primary } }, copied ? t("ps_tm_alnskh") : t("ps_nskh"))),
            React.createElement("div", { className: "rounded-xl border px-3 py-2 text-center font-extrabold tracking-widest mb-3", style: { borderColor: colors.border, color: colors.primary, backgroundColor: colors.primaryLight } }, myCode),
            React.createElement("span", { className: "text-xs font-bold block mb-1.5", style: { color: colors.textMuted } }, t("andk_rmz_mn_sdyq")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                React.createElement("input", { dir: "ltr", value: codeInput, onChange: (e) => setCodeInput(e.target.value), placeholder: "SAWA-XXXXX", disabled: !!redeemedCode, className: "flex-1 border rounded-xl px-3 py-2 text-sm text-center tracking-widest", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card, opacity: redeemedCode ? 0.5 : 1 } }),
                React.createElement("button", { onClick: handleRedeem, disabled: !!redeemedCode || !codeInput.trim(), className: "rounded-xl px-4 py-2 text-xs font-bold", style: { backgroundColor: redeemedCode || !codeInput.trim() ? colors.border : colors.primary, color: redeemedCode || !codeInput.trim() ? colors.textMuted : "#fff" } }, t("astkhdm"))),
            !!error && React.createElement("p", { className: "text-[11px] font-bold mt-2 text-center", style: { color: colors.danger } }, error),
            redeemedCode && (React.createElement("p", { className: "text-[11px] font-bold mt-2 text-center", style: { color: colors.success } },
                t("ps_astkhdm_rmz"),
                redeemedCode,
                t("ps_rsydk_altshjyay"),
                REFERRAL_REWARD_SDG,
                t("ps_sdg_msjl"))))));
}
const MY_SAFETY_NUMBER = "2D23 4077 97D6 FD4D 1345"; // بصمة أمان تجريبية ثابتة — تُقارَن يدوياً مع جهة الاتصال عبر قناة آمنة أخرى
// C73: قفل التطبيق في تطبيق أندرويد الأصليّ — بالبصمة أو قفل شاشة الهاتف (يتحقّق منه الهاتف نفسه، لا رمزٌ يُحفظ هنا)
function NativeAppLockCard() {
    const { colors } = useTheme();
    const nb = (typeof window !== "undefined" && window.SawaNativeBridge && window.SawaNativeBridge.appLockState) ? window.SawaNativeBridge : null;
    const read = () => { try { return nb ? JSON.parse(nb.appLockState()) : null; } catch (e) { return null; } };
    const [st, setSt] = useState(read);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    useEffect(() => {
        if (!nb) return;
        const prev = window.__sawaNativeLock;
        window.__sawaNativeLock = (o) => { setSt(o || read()); if (typeof prev === "function") { try { prev(o); } catch (e) {} } };
        return () => { window.__sawaNativeLock = prev; };
    }, []);
    if (!nb || !st) return null;
    const ask = (on, after) => {
        if (busy) return;
        setBusy(true); setMsg("");
        const c = window.__sawaNatCbs = window.__sawaNatCbs || {};
        if (!window.__sawaNativeCb) window.__sawaNativeCb = (id, r) => { const f = c[id]; delete c[id]; if (f) f(r || {}); };
        const id = "lock_" + Date.now();
        const to = setTimeout(() => { delete c[id]; setBusy(false); }, 120000);
        c[id] = (r) => {
            clearTimeout(to); setBusy(false); setSt(read());
            if (!r.ok) {
                const e = String(r.error || "");
                if (e === "no-screen-lock") setMsg(tl("فعّل قفل شاشة الهاتف (بصمة أو رمز) من إعدادات الهاتف أوّلاً", "Set a screen lock (fingerprint or PIN) in your phone settings first"));
                else if (!/e(10|13|5):/.test(e)) setMsg(tl("لم يكتمل التحقّق", "Verification didn't complete"));
            }
        };
        try { nb.setAppLock(!!on, after, id); } catch (e) { clearTimeout(to); delete c[id]; setBusy(false); }
    };
    const opts = [{ v: 0, l: tl("فوراً", "Immediately") }, { v: 60000, l: tl("بعد دقيقة", "After 1 min") }, { v: 300000, l: tl("بعد ٥ دقائق", "After 5 min") }, { v: 1800000, l: tl("بعد ٣٠ دقيقة", "After 30 min") }];
    return React.createElement(Card, null,
        React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5` },
            React.createElement("button", { onClick: () => ask(!st.on, st.after || 60000), disabled: busy || (!st.available && !st.on), className: "w-11 h-6 rounded-full relative shrink-0", style: { backgroundColor: st.on ? colors.primary : colors.border, opacity: busy ? 0.6 : 1 }, "aria-label": tl("قفل التطبيق", "App lock") },
                React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [st.on ? "right" : "left"]: 2 } })),
            React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, tl("قفل التطبيق بالبصمة", "Fingerprint app lock")),
            React.createElement(Lock, { size: 16, color: colors.textMuted })),
        React.createElement("p", { className: `text-[10px] mt-2 ${textStart()}`, style: { color: colors.textMuted } },
            st.available || st.on
                ? tl("يُفتح سوا بالبصمة أو برمز قفل الهاتف. المكالمات والإشعارات تصلك وهو مقفل، والردّ على مكالمة لا ينتظر القفل.", "Sawa opens with your fingerprint or phone PIN. Calls and notifications still arrive while locked.")
                : tl("يحتاج قفل شاشة على الهاتف (بصمة أو رمز أو نمط). فعّله من إعدادات الهاتف ثمّ عُد هنا.", "Needs a phone screen lock (fingerprint, PIN or pattern).")),
        st.on && React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mt-3` }, opts.map((o) => React.createElement("button", { key: o.v, onClick: () => { if (o.v !== st.after) ask(true, o.v); }, disabled: busy, className: "rounded-full px-3 py-1.5 text-xs border", style: { backgroundColor: st.after === o.v ? colors.primary : colors.card, color: st.after === o.v ? "#fff" : colors.text, borderColor: st.after === o.v ? colors.primary : colors.border } }, o.l))),
        msg && React.createElement("p", { className: `text-[11px] mt-2 font-bold ${textStart()}`, style: { color: "#c0392b" } }, msg));
}
function ProfileSettingsScreen({ onBack, onChangePin, biometricEnabled, setBiometricEnabled, autoLockDelay, setAutoLockDelay, remainingCodes, onLockNow, onOpenSessions, profilePhoto, setProfilePhoto, interfaceLanguage, setInterfaceLanguage, pinLockEnabled, setPinLockEnabled, browserNotifEnabled, onToggleBrowserNotif, statusOption, setStatusOption, customStatusMessage, setCustomStatusMessage, redeemedReferralCode, onRedeemReferral, blockUnsolicited, setBlockUnsolicited, identityVerified, chatBackupEnabled, setChatBackupEnabled, onDeleteKeys, backendLinked, onUnlink, }) {
    const { colors, isDark, toggleDark, accentKey, setAccentKey, accentThemes, fontScale, setFontScale, highContrast, setHighContrast, dataSaver, setDataSaver } = useTheme();
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const options = [{ label: t("ps_fwra"), value: 0 }, { label: t("ps_bad_dqyqa"), value: 60 }, { label: t("ps_bad_5_dqayq"), value: 300 }];
    const statusMeta = {
        online: { label: t("ps_mtsl"), color: colors.success },
        busy: { label: t("ps_mshghwl"), color: colors.danger },
        away: { label: t("ps_bayd"), color: colors.accent },
        unavailable: { label: t("ps_ghyr_mtah"), color: colors.textMuted },
    };
    const photoInputRef = useRef(null);
    const [copiedSafety, setCopiedSafety] = useState(false);
    const [showQrNote, setShowQrNote] = useState(false);
    const [confirmDeleteKeys, setConfirmDeleteKeys] = useState(false);
    function handlePhotoChange(e) {
        var _a;
        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (ev) => setProfilePhoto(ev.target.result);
        reader.readAsDataURL(file);
    }
    // تجربة أولى لقلب الاتجاه على شاشة واحدة.
    // dir سمة موروثة من <html>، فنفرضها هنا لعزل الشاشة عن بقية التطبيق.
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col relative" },
        React.createElement(TopBar, { title: t("iadadat_almlf_alshkhsy"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            !RELEASE_UI && React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("alswra_alshkhsya")),
            !RELEASE_UI && React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 mb-5` },
                React.createElement("input", { ref: photoInputRef, type: "file", accept: "image/*", className: "hidden", onChange: handlePhotoChange }),
                React.createElement("div", { className: "w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden", style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } }, profilePhoto ? React.createElement("img", { src: profilePhoto, alt: t("swrty"), className: "w-full h-full object-cover" }) : React.createElement(Images, { size: 20, color: colors.textMuted })),
                React.createElement("button", { onClick: () => { var _a; return (_a = photoInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "text-sm font-bold", style: { color: colors.primary } }, profilePhoto ? t("ps_tghyyr_alswra") : t("ps_rfa_swra"))),
            React.createElement("p", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("lwn_mzhr_alttbyq")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-5` }, Object.entries(accentThemes).map(([key, theme]) => (React.createElement("button", { "aria-label": t("takyd"), key: key, onClick: () => setAccentKey(key), className: "w-9 h-9 rounded-full flex items-center justify-center", style: { backgroundColor: theme.accent, border: accentKey === key ? `3px solid ${colors.text}` : "none" } }, accentKey === key && React.createElement(Check, { size: 14, color: "#fff" }))))),
            React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2.5` },
                React.createElement("button", { onClick: toggleDark, className: "w-11 h-6 rounded-full relative", style: { backgroundColor: isDark ? colors.primary : colors.border } },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center", style: { [isDark ? "right" : "left"]: 2 } }, isDark ? React.createElement(Moon, { size: 11, color: colors.primary }) : React.createElement(Sun, { size: 11, color: colors.accent }))),
                React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("alwda_allyly"))),
            React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between` },
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("lgha_alwajha")),
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5` },
                        React.createElement(Globe, { size: 14, color: colors.primary }),
                        React.createElement("button", { onClick: () => setInterfaceLanguage("ar"), className: "text-xs font-bold", style: { color: interfaceLanguage === "ar" ? colors.primary : colors.textMuted } }, t("alarbya")),
                        React.createElement("span", { style: { color: colors.textMuted } }, "\u2039"),
                        React.createElement("button", { onClick: () => setInterfaceLanguage("en"), className: "text-xs font-bold", style: { color: interfaceLanguage === "en" ? colors.primary : colors.textMuted } }, "English"))),
                React.createElement("p", { className: "text-[10px] mt-2", style: { color: colors.textMuted } }, t("hdha_mthal_awly_ytrjm"))),
            React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("imkanya_alwswl")),
            React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("hjm_alkht"))),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-3` }, [{ v: 0.9, l: t("ps_sghyr") }, { v: 1, l: t("ps_aady") }, { v: 1.15, l: t("ps_kbyr") }, { v: 1.3, l: t("ps_akbr") }].map((s) => (React.createElement("button", { key: s.v, onClick: () => setFontScale(s.v), className: "flex-1 rounded-full border py-2", style: { backgroundColor: fontScale === s.v ? colors.primary : colors.card, borderColor: fontScale === s.v ? colors.primary : colors.border } },
                    React.createElement("span", { className: "text-xs font-bold", style: { color: fontScale === s.v ? "#fff" : colors.text } }, s.l))))),
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5` },
                    React.createElement("button", { onClick: () => setHighContrast(!highContrast), className: "w-11 h-6 rounded-full relative", style: { backgroundColor: highContrast ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [highContrast ? "right" : "left"]: 2 } })),
                    React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("wda_altbayn_alaaly")),
                    React.createElement(Eye, { size: 16, color: colors.textMuted }))),
            !IS_RAHIM && React.createElement(Card, { className: `flex ${rowStart()} items-start gap-2.5` },
                React.createElement("button", { onClick: () => setDataSaver(!dataSaver), className: "w-11 h-6 rounded-full relative shrink-0 mt-0.5", style: { backgroundColor: dataSaver ? colors.primary : colors.border }, "aria-label": t("twfyr_albyanat") },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [dataSaver ? "right" : "left"]: 2 } })),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("span", { className: "text-sm font-bold block mb-1", style: { color: colors.text } }, t("twfyr_albyanat")),
                    React.createElement("p", { className: "text-[10px]", style: { color: colors.textMuted } }, t("la_thml_alswr_walfydyw"))),
                React.createElement(Download, { size: 16, color: colors.textMuted, className: "shrink-0 mt-0.5" })),
            !RELEASE_UI && React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2.5` },
                React.createElement("button", { onClick: () => setPinLockEnabled(!pinLockEnabled), className: "w-11 h-6 rounded-full relative", style: { backgroundColor: pinLockEnabled ? colors.primary : colors.border } },
                    React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [pinLockEnabled ? "right" : "left"]: 2 } })),
                React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("qfl_alttbyq_brmz_pin")),
                React.createElement(Lock, { size: 16, color: colors.textMuted })),
            !RELEASE_UI && pinLockEnabled && (React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5 mb-2` },
                    React.createElement("button", { onClick: () => setBiometricEnabled(!biometricEnabled), className: "w-11 h-6 rounded-full relative", style: { backgroundColor: biometricEnabled ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [biometricEnabled ? "right" : "left"]: 2 } })),
                    React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, t("fth_balbsma_face_id"))),
                React.createElement("p", { className: `text-xs font-bold mb-2 ${textStart()}`, style: { color: colors.textMuted } }, t("alqfl_altlqayy_and_alkhlfya")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` }, options.map((o) => (React.createElement("button", { key: o.value, onClick: () => setAutoLockDelay(o.value), className: "rounded-full px-3 py-1.5 text-xs border", style: { backgroundColor: autoLockDelay === o.value ? colors.primary : colors.card, color: autoLockDelay === o.value ? "#fff" : colors.text, borderColor: autoLockDelay === o.value ? colors.primary : colors.border } }, o.label)))),
                React.createElement("button", { onClick: onChangePin, className: `w-full flex ${rowStart()} items-center gap-2 py-2 border-t`, style: { borderColor: colors.border } },
                    React.createElement(Key, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("tghyyr_rmz_alqfl"))),
                !IS_RAHIM && React.createElement("button", { onClick: onOpenSessions, className: `w-full flex ${rowStart()} items-center gap-2 py-2 border-t`, style: { borderColor: colors.border } },
                    React.createElement(Smartphone, { size: 15, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("alajhza_almsjla_alsyrfr"))),
                React.createElement("p", { className: `text-[11px] ${textStart()} pt-1`, style: { color: colors.textMuted } },
                    t("ps_tbqa_lk"),
                    remainingCodes,
                    t("ps_mn_10_rmwz")))),
            React.createElement(NativeAppLockCard, null),
            React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2.5` },
                    React.createElement("button", { onClick: onToggleBrowserNotif, className: "w-11 h-6 rounded-full relative", style: { backgroundColor: browserNotifEnabled ? colors.primary : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-5 h-5 rounded-full bg-white", style: { [browserNotifEnabled ? "right" : "left"]: 2 } })),
                    React.createElement("span", { className: `text-sm font-bold flex-1 ${textStart()}`, style: { color: colors.text } }, RELEASE_UI ? tl("الإشعارات", "Notifications") : t("ishaarat_almtsfh_alhqyqya")),
                    React.createElement(BellIcon, { size: 16, color: colors.textMuted })),
                React.createElement("p", { className: `text-[10px] mt-2 ${textStart()}`, style: { color: colors.textMuted } }, t("ystkhdm_idhn_alishaarat_alfaly"))),
            !IS_RAHIM && !RELEASE_UI && React.createElement(ReferralSection, { myCode: MY_REFERRAL_CODE, redeemedCode: redeemedReferralCode, onRedeem: onRedeemReferral }),
            !IS_RAHIM && !RELEASE_UI && React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("haltk")),
            !IS_RAHIM && !RELEASE_UI && React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` }, Object.entries(statusMeta).map(([key, s]) => (React.createElement("button", { key: key, onClick: () => setStatusOption(key), className: "rounded-full px-3 py-1.5 border", style: { backgroundColor: statusOption === key ? s.color : colors.card, borderColor: statusOption === key ? s.color : colors.border } },
                    React.createElement("span", { className: "text-xs font-bold", style: { color: statusOption === key ? "#fff" : colors.text } }, s.label))))),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: customStatusMessage, onChange: (e) => setCustomStatusMessage(e.target.value), placeholder: t("adf_rsala_hala_mkhssa"), className: "w-full border rounded-xl px-3 py-2 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } })),
            SHOW_E2E_UI && !IS_RAHIM && React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("mfatyh_altshfyr")),
            SHOW_E2E_UI && !IS_RAHIM && React.createElement(Card, null,
                React.createElement("p", { className: `text-[11px] ${textStart()} mb-1`, style: { color: colors.textMuted } }, t("bsma_alaman_safety_number")),
                React.createElement("p", { className: "text-center font-bold tracking-widest mb-1.5", style: { color: colors.text } }, MY_SAFETY_NUMBER),
                React.createElement("p", { className: `text-[10px] ${textStart()} mb-3`, style: { color: colors.textMuted } }, t("thqq_mn_hdha_alrqm")),
                React.createElement("div", { className: `rounded-xl p-2.5 mb-3 flex ${rowStart()} items-center gap-2`, style: { backgroundColor: colors.success + "22" } },
                    React.createElement(ShieldCheck, { size: 16, color: colors.success }),
                    React.createElement("div", { className: `flex-1 ${textStart()}` },
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.success } }, t("tshfyr_mn_trf_ila")),
                        React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } }, t("jmya_alrsayl_walmlfat_mshfra")))),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => setShowQrNote(true), className: `flex-1 flex ${rowStart()} items-center justify-center gap-1.5 rounded-xl py-2`, style: { backgroundColor: colors.primary } },
                        React.createElement(QrCode, { size: 14, color: "#fff" }),
                        React.createElement("span", { className: "text-xs font-bold text-white" }, "QR Code")),
                    React.createElement("button", { "aria-label": t("nskh"), onClick: () => { copyText(MY_SAFETY_NUMBER).then(() => { setCopiedSafety(true); setTimeout(() => setCopiedSafety(false), 1500); }); }, className: `flex-1 flex ${rowStart()} items-center justify-center gap-1.5 rounded-xl py-2`, style: { backgroundColor: colors.primary } },
                        React.createElement(Copy, { size: 14, color: "#fff" }),
                        React.createElement("span", { className: "text-xs font-bold text-white" }, copiedSafety ? "تم النسخ ✓" : "نسخ"))),
                showQrNote && React.createElement("p", { className: "text-[10px] text-center mt-2", style: { color: colors.textMuted } }, t("myza_ard_qr_code"))),
            React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("alkhswsya_walaman")),
            React.createElement(Card, { className: "p-0 overflow-hidden" },
                !IS_RAHIM && !RELEASE_UI && React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("span", { className: "text-sm", style: { color: colors.text } }, t("hzr_alrsayl_ghyr_almtlwba")),
                    React.createElement("button", { onClick: () => setBlockUnsolicited(!blockUnsolicited) },
                        React.createElement(Badge, { variant: blockUnsolicited ? "success" : "neutral", label: blockUnsolicited ? t("ps_mfaal") : t("ps_mattl") }))),
                !RELEASE_UI && React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                        React.createElement("span", { className: "text-sm", style: { color: colors.text } }, t("althqq_mn_alhwya")),
                        React.createElement(UserCheck, { size: 15, color: colors.textMuted })),
                    React.createElement(Badge, { variant: identityVerified ? "success" : "neutral", label: identityVerified ? t("ps_mwthq") : t("ps_ghyr_mwthq") })),
                React.createElement("button", { onClick: () => { if (RELEASE_UI) { location.href = "/privacy"; return; } setShowPrivacyPolicy(true); }, className: `w-full flex ${rowStart()} items-center justify-between p-3` },
                    React.createElement("span", { className: "text-sm", style: { color: colors.text } }, t("syasa_alkhswsya")),
                    React.createElement(ChevronLeft, { size: 14, color: colors.textMuted, style: { transform: "scaleX(-1)" } }))),
            showPrivacyPolicy && (React.createElement("div", { className: "absolute inset-0 z-50 flex flex-col", style: { backgroundColor: colors.bg } },
                React.createElement(TopBar, { title: t("syasa_alkhswsya"), onBack: () => setShowPrivacyPolicy(false) }),
                React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
                    React.createElement("div", { className: "rounded-xl border p-4", style: { borderColor: colors.border, backgroundColor: colors.card } },
                        React.createElement("p", { className: "text-sm leading-relaxed", style: { color: colors.text } }, t("hdhy_maayna_tjrybya_lttbyq")))))),
            !RELEASE_UI && React.createElement("p", { className: "text-xs font-bold mt-1 mb-2", style: { color: colors.textMuted } }, t("idara_alhsab")),
            !RELEASE_UI && React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2.5 mb-3` },
                backendLinked ? React.createElement(Cloud, { size: 16, color: colors.success }) : React.createElement(CloudOff, { size: 16, color: colors.textMuted }),
                React.createElement("span", { className: `flex-1 text-sm ${textStart()}`, style: { color: colors.text } }, backendLinked ? t("ps_mrbwt") : t("ps_ghyr_mrbwt")),
                backendLinked && React.createElement("button", { onClick: onUnlink, className: "text-xs font-bold", style: { color: colors.danger } }, t("ilgha_alrbt"))),
            RELEASE_UI ? null : !confirmDeleteKeys ? (React.createElement("button", { onClick: () => setConfirmDeleteKeys(true), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl p-3.5 border mb-3`, style: { backgroundColor: colors.card, borderColor: colors.danger } },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.danger } }, t("hdhf_mfatyh_altshfyr")),
                React.createElement(Trash2, { size: 16, color: colors.danger }))) : (React.createElement("div", { className: "rounded-xl border p-3 mb-3", style: { borderColor: colors.danger } },
                React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, t("takyd_hdha_ymsh_rmz")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => { onDeleteKeys(); setConfirmDeleteKeys(false); }, className: "flex-1 rounded-xl py-2", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-xs font-bold text-white" }, t("nam_ahdhf_nhayya"))),
                    React.createElement("button", { onClick: () => setConfirmDeleteKeys(false), className: "flex-1 rounded-xl py-2 border", style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("ilgha")))))))));
}
function EncryptedNotesDemoScreen({ onBack, notes, onAdd, onDelete }) {
    const { colors } = useTheme();
    const [text, setText] = useState("");
    return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("tjrba_altkhzyn_almshfr"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 min-h-0 flex flex-col", style: { backgroundColor: colors.bg } },
            React.createElement("p", { className: "text-[11px] p-4 pb-0", style: { color: colors.textMuted } }, t("smoke_test_bs_ythbt")),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 p-4` },
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: text, onChange: (e) => setText(e.target.value), placeholder: t("aktb_mlahza_tjrybya"), className: "flex-1 border rounded-xl px-3 py-2 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("button", { "aria-label": t("takyd"), onClick: () => { if (text.trim()) {
                        onAdd(text.trim());
                        setText("");
                    } }, className: "w-11 h-11 rounded-lg flex items-center justify-center", style: { backgroundColor: colors.primary } },
                    React.createElement(Check, { size: 18, color: "#fff" }))),
            React.createElement("div", { className: "flex-1 overflow-y-auto px-4" },
                notes.length === 0 && React.createElement(EmptyState, { icon: Server, label: t("la_twjd_mlahzat_mhfwza") }),
                notes.map((n) => (React.createElement("div", { key: n.id, className: `flex ${rowStart()} items-center justify-between rounded-xl p-3 border mb-2`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                    React.createElement("span", { className: `flex-1 text-sm ${textStart()}`, style: { color: colors.text } }, n.text),
                    React.createElement("button", { "aria-label": t("hdhf"), onClick: () => onDelete(n.id) },
                        React.createElement(Trash2, { size: 16, color: colors.danger })))))))));
}
// ============================================================================
// بيانات صلة الرحم — نفس الأسماء والبنية المستخدمة فعلياً بمشروع sawa-rn
// ============================================================================
// مجموعة واحدة فارغة — المستخدم يسمّي عائلته ويضيف مجموعات بنفسه
const initialFamilyGroups = [
    { id: "g-1", name: "عائلتي", description: "", role: "owner" },
];
const initialGroupPersons = {
    "g-1": []
};
const initialKinship = [];
const initialSchedules = [];

const initialEvents = [];

const initialMembers = {
    "g-1": [{ userId: "u-1", name: "أنت", role: "owner" }],
};
const initialSettings = { "g-1": { allowMemberEvents: true }, "g-2": { allowMemberEvents: false } };
const statusLabels = { sick: "مريض حالياً", travel: "مسافر حالياً", newlywed: "متزوج حديثاً", abroad: "مغترب خارج البلاد" };
const proximityVariant = { "A***": "danger", "A**": "danger", "A*": "warning", "A": "warning", B: "neutral", C: "neutral" };
// درجات القرب تُشتقّ آلياً من صلة القرابة — ليست خياراً يدوياً.
// كلما زادت النجوم قربت الدرجة وقصرت المدة المسموحة بلا تواصل.
const proximityLabels = {
    "A***": "الدرجة الأولى",
    "A**": "الدرجة الثانية",
    "A*": "الدرجة الثالثة",
    "A": "الدرجة الرابعة",
    "B": "الدرجة الخامسة",
    "C": "الدرجة السادسة",
};
const PROX_LABELS_EN = { "A***": "1st degree", "A**": "2nd degree", "A*": "3rd degree", "A": "4th degree", "B": "5th degree", "C": "6th degree" };
function proxLabel(code) { return code ? tl(proximityLabels[code] || "", PROX_LABELS_EN[code] || "") : ""; }
const proximityContactDays = {
    "A***": 7, // الوالدان والأبناء
    "A**": 10, // الإخوة والأخوات
    "A*": 14, // الأعمام والعمات والأخوال والخالات
    "A": 21, // أبناء الأعمام والعمات والأخوال والخالات
    "B": 30, // عمات وخالات الوالدين
    "C": 45, // أبناؤهم
};
// اشتقاق الدرجة من صلة القرابة — المصدر الوحيد للحقيقة
const KINSHIP_PROXIMITY = {
    "الوالد": "A***", "الوالدة": "A***", "الابن": "A***", "البنت": "A***",
    "الأخ": "A**", "الأخت": "A**",
    "الجد لأم": "A**", "الجدة لأم": "A**",
    "العم": "A*", "العمة": "A*", "الخال": "A*", "الخالة": "A*",
    "الجد": "A**", "الجدة": "A**",
    "ابن العم": "A", "بنت العم": "A", "ابن الخال": "A", "بنت الخال": "A",
    "ابن العمة": "A", "بنت العمة": "A", "ابن الخالة": "A", "بنت الخالة": "A",
    "عم الوالد": "B", "عمة الوالد": "B", "خال الوالد": "B", "خالة الوالد": "B",
    "عم الوالدة": "B", "عمة الوالدة": "B", "خال الوالدة": "B", "خالة الوالدة": "B",
    "ابن عم الوالد": "C", "بنت عم الوالد": "C", "ابن خال الوالدة": "C", "بنت خال الوالدة": "C",
    "الحفيد": "A**", "الحفيدة": "A**",
    "ابن الأخ": "A**", "بنت الأخ": "A**",
    "ابن الأخت": "A**", "بنت الأخت": "A**",
    "الزوج": "A***", "الزوجة": "A***",
    "زوجة الابن": "A**", "زوج البنت": "A**", // درجةً دون الابن/البنت — كما «زوجة الأخ» دون «الأخ»
    "الزوج السابق": "C", "الزوجة السابقة": "C", // ⛔ خاملة — البوّابة في isContactOverdue
    "زوج الأخت": "A*", "زوجة الأخ": "A*",
    "نفسي": "A***",   // صاحب الشجرة نفسه — أقرب ما يكون
    "أخرى": "A*",
};
// تجميع الصلات في أقسام — القائمة تجاوزت ثلاثين خياراً فصار التصفّح شاقاً
const KINSHIP_SECTIONS = [
    {
        key: "self", titleKey: "sec_self", icon: "🙋",
        items: ["نفسي"],
    },
    {
        key: "usul", titleKey: "sec_usul", icon: "👴",
        items: ["الوالد", "الوالدة", "الجد", "الجدة", "الجد لأم", "الجدة لأم"],
    },
    {
        key: "furu", titleKey: "sec_furu", icon: "👶",
        items: ["الابن", "البنت", "زوجة الابن", "زوج البنت", "الحفيد", "الحفيدة"],
    },
    {
        key: "ikhwa", titleKey: "sec_ikhwa", icon: "🧑‍🤝‍🧑",
        items: ["الأخ", "الأخت", "ابن الأخ", "بنت الأخ", "ابن الأخت", "بنت الأخت", "زوجة الأخ", "زوج الأخت"],
    },
    {
        key: "amm", titleKey: "sec_amm", icon: "🌿",
        items: ["العم", "العمة", "ابن العم", "بنت العم", "ابن العمة", "بنت العمة"],
    },
    {
        key: "khal", titleKey: "sec_khal", icon: "🌾",
        items: ["الخال", "الخالة", "ابن الخال", "بنت الخال", "ابن الخالة", "بنت الخالة"],
    },
    {
        key: "jeel3", titleKey: "sec_jeel3", icon: "🏛️",
        items: [
            "عم الوالد", "عمة الوالد", "خال الوالد", "خالة الوالد",
            "عم الوالدة", "عمة الوالدة", "خال الوالدة", "خالة الوالدة",
            "ابن عم الوالد", "بنت عم الوالد", "ابن خال الوالدة", "بنت خال الوالدة",
        ],
    },
    {
        key: "zawj", titleKey: "sec_zawj", icon: "💍",
        items: ["الزوج", "الزوجة", "الزوج السابق", "الزوجة السابقة"],
    },
    {
        key: "other", titleKey: "sec_other", icon: "•",
        items: ["أخرى"],
    },
];
function proximityForKinship(kinship) {
    if (KINSHIP_PROXIMITY[kinship]) return KINSHIP_PROXIMITY[kinship];
    // C75: القرابات المركّبة («بنت ابن ابن العم»، «زوجة ابن العم»): كلّ «ابن/بنت/زوج/زوجة» قبل قرابةٍ معروفة تُنزلها درجة
    const DOWN = { "A***": "A**", "A**": "A*", "A*": "A", "A": "B", "B": "C", "C": "C" };
    let k = String(kinship || ""), steps = 0;
    while (/^(ابن|بنت|زوج|زوجة|طليق|طليقة) /.test(k) && steps < 6) {
        k = k.replace(/^(ابن|بنت|زوج|زوجة|طليق|طليقة) /, "");
        steps++;
        if (KINSHIP_PROXIMITY[k]) { let p = KINSHIP_PROXIMITY[k]; for (let i = 0; i < steps; i++) p = DOWN[p]; return p; }
    }
    return "A*";
}
// ============================================================
// فرع العائلة — مشتقّ من الصلة كالدرجة والجنس، لا يُسأل عنه.
// «الخال» جهة أم بالضرورة، و«العم» جهة أب. أما الوالدان والإخوة
// والأبناء فهم أصل الفرعين معاً لا أحدهما — ولذلك «both».
// ============================================================
const KINSHIP_BRANCH = {
    // جهة الأب: العمومة وما تفرّع عنها
    "العم": "paternal", "العمة": "paternal",
    "ابن العم": "paternal", "بنت العم": "paternal",
    "ابن العمة": "paternal", "بنت العمة": "paternal",
    "الجد": "paternal", "الجدة": "paternal",
    "عم الوالد": "paternal", "عمة الوالد": "paternal",
    "ابن عم الوالد": "paternal", "بنت عم الوالد": "paternal",
    // جهة الأم: الخؤولة وما تفرّع عنها
    "الخال": "maternal", "الخالة": "maternal",
    "ابن الخال": "maternal", "بنت الخال": "maternal",
    "ابن الخالة": "maternal", "بنت الخالة": "maternal",
    "الجد لأم": "maternal", "الجدة لأم": "maternal",
    "خال الوالدة": "maternal", "خالة الوالدة": "maternal",
    "ابن خال الوالدة": "maternal", "بنت خال الوالدة": "maternal",
    // الصلات المتقاطعة: النسبة للوالد الذي جاءت منه لا لجنس القريب.
    // «خال الوالد» أخو أمّ أبي — فهو في خط الأب رغم أنه «خال».
    // و«عم الوالدة» أخو أبي أمّي — في خط الأم رغم أنه «عم».
    "خال الوالد": "paternal", "خالة الوالد": "paternal",
    "عم الوالدة": "maternal", "عمة الوالدة": "maternal",
    // الجذع المشترك — ينتمي للفرعين لا لأحدهما
    "نفسي": "both",
    "الوالد": "both", "الوالدة": "both",
    "الأخ": "both", "الأخت": "both",
    "الابن": "both", "البنت": "both",
    "الحفيد": "both", "الحفيدة": "both",
    "الزوج": "both", "الزوجة": "both",
    "زوجة الابن": "both", "زوج البنت": "both",
    "الزوج السابق": "both", "الزوجة السابقة": "both",
    // أبناء الإخوة وأزواجهم: جذع مشترك كالإخوة أنفسهم. كانت تسقط على
    // الافتراضي "both" — صحيحاً بالصدفة. صريحةٌ الآن فلا يعتمد صوابها عليه.
    "ابن الأخ": "both", "بنت الأخ": "both",
    "ابن الأخت": "both", "بنت الأخت": "both",
    "زوجة الأخ": "both", "زوج الأخت": "both",
    "أخرى": "both",
};
function branchForKinship(kinship) {
    return KINSHIP_BRANCH[kinship] || "both";
}
// نطاق وحدة: مفاتيح لا نصوص (t() هنا تتجمّد على لغة الإقلاع)
const branchLabelKeys = { paternal: "br_ab", maternal: "br_um", both: "br_mshtrk" };
// المدن المستخرجة من عناوين الأقارب — لا قائمة ثابتة، فالمستخدم قد
// يكون له أقارب في أي مكان. نعرض ما هو موجود فعلاً في بياناته.
function extractCities(persons) {
    const counts = {};
    (persons || []).forEach((p) => {
        (p.locations || []).forEach((loc) => {
            const txt = (loc.address_text || "").trim();
            if (!txt)
                return;
            // آخر مقطع بعد الفاصلة هو المدينة عادةً: «حي العمارات، الخرطوم»
            const city = txt.split(/[,،]/).map((s) => s.trim()).filter(Boolean).pop();
            if (city)
                counts[city] = (counts[city] || 0) + 1;
        });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([city, n]) => ({ city, n }));
}
function personInCity(p, city) {
    return (p.locations || []).some((loc) => (loc.address_text || "").includes(city));
}
// ============================================================
// دوال مساعدة لربط صلة الرحم بالمحادثات
// ============================================================
// حساب عدد الأيام منذ آخر تواصل
// C74: مرجع حساب التأخّر — آخر تواصلٍ مسجَّل، وإلّا وقت الإضافة (أو وقت وصول الشخص من شجرةٍ مشتركة).
//      كانت الإضافة تُسجَّل «تواصلاً اليوم»، ومن ينضمّ إلى عائلةٍ مشتركة يرى الجميع متأخّرين «منذ Infinity يوم».
function daysAr(n) { return arCountFix(n + " يوم"); }
function othersAr(n) { return n === 1 ? "واحدٍ آخر" : n === 2 ? "اثنين آخرين" : n + " آخرين"; }
function contactRef(p) { return (p && (p.lastContactDate || p.addedAt)) || null; }
function daysSinceRef(p) { return daysSinceContact(contactRef(p)); }
function daysSinceContact(lastContactDate) {
    if (!lastContactDate)
        return Infinity;
    return Math.floor((Date.now() - lastContactDate) / (1000 * 60 * 60 * 24));
}
// «آخر تواصل» بصياغةٍ عربية سليمة للعدد (أمس، يومين، أيام، يوماً)
function contactAgoLabel(lastContactDate) {
    const d = daysSinceContact(lastContactDate);
    if (d === Infinity) return t("ac_lm");
    if (d <= 0) return t("ac_0");
    if (d === 1) return t("ac_1");
    if (d === 2) return t("ac_2");
    return t(d <= 10 ? "ac_few" : "ac_many", { n: d });
}
// هل تجاوز حد التواصل بناءً على درجة القرب؟
// ⛔ مُعرِّف لا نصّ — يُطابَق مع p.kinship ولا يُترجَم.
const SELF_KINSHIP = "نفسي";
// ⛔ مُعرِّفات لا نصوص — لا تُترجَم ولا تُقارَن بالمعروض
const EX_SPOUSE_KINSHIPS = ["الزوجة السابقة", "الزوج السابق"]; // ⛔ مُعرِّفات لا نصوص
function isExSpouseKinship(k) { return EX_SPOUSE_KINSHIPS.indexOf(k) !== -1; }
function isExSpousePerson(p) { return !!p && isExSpouseKinship(p.kinship); } // ⛔ مقارنة لا عرض
// الدرجة وحدها تسقط بقرار خالد: المناسبات — ميلاد ومرض وذكرى ودعاء —
// تبقى، فالمطلَّقة شخصٌ آخر بخلاف «نفسي» وقد تكون أمَّ الأبناء.
function hasNoProximity(k) { return k === SELF_KINSHIP || isExSpouseKinship(k); }
function hasNoProximityPerson(p) { return !!p && hasNoProximity(p.kinship); } // ⛔ مقارنة لا عرض
function isSelfPerson(p) {
    return !!p && p.kinship === SELF_KINSHIP;
}
function daysSinceContact_(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : 9999; }
function isContactOverdue(person) {
    // صاحب الشجرة لا يُذكَّر بالتواصل مع نفسه. البوّابة هنا لأنها المخنق
    // الذي تمرّ منه كل عدّادات التأخّر وشاراتها وبطاقة التذكير.
    if (isSelfPerson(person) || isExSpousePerson(person))
        return false;
    if (!person.alive || !person.proximity)
        return false;
    const limit = proximityContactDays[person.proximity] || 30;
    if (!contactRef(person))
        return false;   // لا مرجع (بياناتٌ قديمة) ⇒ لا نحكم بالتأخّر
    const days = daysSinceRef(person);
    return days >= limit;
}
// احصل على كل الأشخاص الذين تأخر التواصل معهم
function getOverduePersons(groupPersons) {
    // الشخص الموجود في مجموعتين (نفسه ونسخته عند الأصهار) يُحتسب مرة واحدة —
    // نُبقي النسخة الأصلية ونُسقط الجسر المرتبط بها.
    const all = Object.values(groupPersons).flat();
    // نُسقط النسخة الجسر إن كان أصلها موجوداً فعلاً — الشرط السابق كان
    // يمرّر الاثنين معاً فيُحتسب الشخص مرتين في كل عدّاد يعتمد على هذه الدالة
    const allIds = new Set(all.map((p) => p.id));
    const unique = all.filter((p) => {
        const target = p.linkedTo && p.linkedTo.personId;
        return !target || !allIds.has(target);
    });
    return unique
        .filter(p => p.alive && isContactOverdue(p))
        .sort((a, b) => daysSinceRef(b) - daysSinceRef(a));
}
// احصل على الجداول المستحقة اليوم
function getDueSchedules(groupSchedules, groupPersons) {
    const allPersons = Object.values(groupPersons).flat();
    const now = Date.now();
    return Object.values(groupSchedules || {})
        .flat()
        .filter(s => s.dueTimestamp && s.dueTimestamp <= now + 24 * 60 * 60 * 1000)
        .map(s => ({
        ...s,
        person: allPersons.find(p => p.id === s.personId),
    }))
        .filter(s => { var _a; return (_a = s.person) === null || _a === void 0 ? void 0 : _a.alive; });
}

// ── أسماء القرابة بالإنجليزية ──
// قيم KINSHIP_OPTIONS تُخزَّن بالعربية في بيانات الشجرة ولا تُترجَم أبداً.
// هذه خريطة عرض فقط: kinshipLabel() تُستدعى عند الرسم لا عند الحفظ.
// الإنجليزية تفقد تمييزات العربية (ابن العم/العمة كلاهما Paternal Cousin)،
// فأُضيفت توضيحات بين قوسين حيث يلزم.
const KINSHIP_EN = {
    "\u0646\u0641\u0633\u064A": "Me",
    "\u0627\u0644\u0632\u0648\u062C \u0627\u0644\u0633\u0627\u0628\u0642": "Former husband",
    "\u0627\u0644\u0632\u0648\u062C\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629": "Former wife",
    "\u0627\u0644\u0648\u0627\u0644\u062F": "Father",
    "\u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother",
    "\u0627\u0644\u0627\u0628\u0646": "Son",
    "\u0627\u0644\u0628\u0646\u062A": "Daughter",
    "\u0627\u0644\u0623\u062E": "Brother",
    "\u0627\u0644\u0623\u062E\u062A": "Sister",
    "\u0627\u0644\u062C\u062F": "Grandfather (paternal)",
    "\u0627\u0644\u062C\u062F\u0629": "Grandmother (paternal)",
    "\u0627\u0644\u062C\u062F \u0644\u0623\u0645": "Grandfather (maternal)",
    "\u0627\u0644\u062C\u062F\u0629 \u0644\u0623\u0645": "Grandmother (maternal)",
    "\u0627\u0644\u0639\u0645": "Paternal Uncle",
    "\u0627\u0644\u0639\u0645\u0629": "Paternal Aunt",
    "\u0627\u0644\u062E\u0627\u0644": "Maternal Uncle",
    "\u0627\u0644\u062E\u0627\u0644\u0629": "Maternal Aunt",
    "\u0627\u0628\u0646 \u0627\u0644\u0639\u0645": "Paternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u0639\u0645": "Paternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u0639\u0645\u0629": "Paternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u0639\u0645\u0629": "Paternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u062E\u0627\u0644": "Maternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u062E\u0627\u0644": "Maternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u062E\u0627\u0644\u0629": "Maternal Cousin (Male)",
    "\u0628\u0646\u062A \u0627\u0644\u062E\u0627\u0644\u0629": "Maternal Cousin (Female)",
    "\u0627\u0628\u0646 \u0627\u0644\u0623\u062E": "Nephew (brother's son)",
    "\u0628\u0646\u062A \u0627\u0644\u0623\u062E": "Niece (brother's daughter)",
    "\u0627\u0628\u0646 \u0627\u0644\u0623\u062E\u062A": "Nephew (sister's son)",
    "\u0628\u0646\u062A \u0627\u0644\u0623\u062E\u062A": "Niece (sister's daughter)",
    "\u0632\u0648\u062C\u0629 \u0627\u0644\u0623\u062E": "Sister-in-law (brother's wife)",
    "\u0632\u0648\u062C \u0627\u0644\u0623\u062E\u062A": "Brother-in-law (sister's husband)",
    "\u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Uncle",
    "\u0639\u0645\u0629 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Aunt",
    "\u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Maternal Uncle",
    "\u062E\u0627\u0644\u0629 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Maternal Aunt",
    "\u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Paternal Uncle",
    "\u0639\u0645\u0629 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Paternal Aunt",
    "\u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Uncle",
    "\u062E\u0627\u0644\u0629 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Aunt",
    "\u0627\u0628\u0646 \u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Cousin (Male)",
    "\u0628\u0646\u062A \u0639\u0645 \u0627\u0644\u0648\u0627\u0644\u062F": "Father's Paternal Cousin (Female)",
    "\u0627\u0628\u0646 \u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Cousin (Male)",
    "\u0628\u0646\u062A \u062E\u0627\u0644 \u0627\u0644\u0648\u0627\u0644\u062F\u0629": "Mother's Maternal Cousin (Female)",
    "\u0632\u0648\u062C\u0629 \u0627\u0644\u0627\u0628\u0646": "Daughter-in-law (son's wife)",
    "\u0632\u0648\u062C \u0627\u0644\u0628\u0646\u062A": "Son-in-law (daughter's husband)",
    "\u0627\u0644\u062D\u0641\u064A\u062F": "Grandson",
    "\u0627\u0644\u062D\u0641\u064A\u062F\u0629": "Granddaughter",
    "\u0627\u0644\u0632\u0648\u062C": "Husband",
    "\u0627\u0644\u0632\u0648\u062C\u0629": "Wife",
    "\u0623\u062E\u0631\u0649": "Other",
};
// ── «ما قرابتي بفلان؟» ───────────────────────────────────────────
// لا نبحث عن مسار حرّ في الرسم — يُخرج مسارات بلا معنى قرابيّ. نصعد من
// الطرفين إلى أصولهما ونأخذ أقرب جدّ مشترك: القرابة الدموية تُوصف تماماً
// بـ(صعود u · نزول d) وجنس من على الطريق.
function kinBuildIndex(persons, relations) {
    const parentsOf = {}, childrenOf = {}, spousesOf = {}, exOf = {}, P = {};
    persons.forEach((p) => { P[p.id] = p; });
    relations.forEach((r) => {
        if (r.type === "parent") {
            (parentsOf[r.target] = parentsOf[r.target] || []).push(r.source);
            (childrenOf[r.source] = childrenOf[r.source] || []).push(r.target);
        }
        else if (r.type === "spouse") {
            (spousesOf[r.source] = spousesOf[r.source] || []).push(r.target);
            (spousesOf[r.target] = spousesOf[r.target] || []).push(r.source);
        }
        else if (r.type === "ex_spouse") {   // C33: الزواج المنتهي ليس زواجاً قائماً — لا يدخل في «زوجتك/زوجك» ولا في حساب الأصهار
            (exOf[r.source] = exOf[r.source] || []).push(r.target);
            (exOf[r.target] = exOf[r.target] || []).push(r.source);
        }
    });
    // أخوّة صريحة بلا والد مشترك: نصل الطرفين بوالد وهميّ لا يدخل البيانات،
    // وإلا ضاعت القرابة كلّها لمن سُجّل إخوةً فقط.
    relations.filter((r) => r.type === "sibling").forEach((r, i) => {
        const pa = parentsOf[r.source] || [], pb = parentsOf[r.target] || [];
        if (pa.some((x) => pb.includes(x)))
            return;
        const ghost = `__sib${i}`;
        (parentsOf[r.source] = parentsOf[r.source] || []).push(ghost);
        (parentsOf[r.target] = parentsOf[r.target] || []).push(ghost);
        (childrenOf[ghost] = childrenOf[ghost] || []).push(r.source, r.target);
    });
    return { P, parentsOf, childrenOf, spousesOf, exOf };
}
function kinAncestors(id, parentsOf, maxUp) {
    const out = new Map([[id, { d: 0, via: null }]]);
    let frontier = [[id, null]];
    for (let depth = 1; depth <= (maxUp || 8); depth++) {
        const next = [];
        for (const [cur, via] of frontier)
            for (const par of parentsOf[cur] || []) {
                if (out.has(par))
                    continue;
                const v = depth === 1 ? par : via;
                out.set(par, { d: depth, via: v });
                next.push([par, v]);
            }
        if (!next.length)
            break;
        frontier = next;
    }
    return out;
}
// أول نازل تحت الجدّ المشترك: هو الذي يفرّق «ابن أخيك» عن «ابن أختك»
function kinFirstDescender(from, to, childrenOf) {
    if (from === to)
        return null;
    const prev = new Map([[from, null]]);
    let frontier = [from];
    for (let depth = 1; depth <= 8; depth++) {
        const next = [];
        for (const cur of frontier)
            for (const kid of childrenOf[cur] || []) {
                if (prev.has(kid))
                    continue;
                prev.set(kid, cur);
                if (kid === to) {
                    let n = to, last = to;
                    while (n !== from) { last = n; n = prev.get(n); }
                    return last;
                }
                next.push(kid);
            }
        if (!next.length)
            break;
        frontier = next;
    }
    return null;
}
function kinBlood(aId, bId, idx) {
    const ancA = kinAncestors(aId, idx.parentsOf), ancB = kinAncestors(bId, idx.parentsOf);
    let best = null;
    ancA.forEach((ra, anc) => {
        const rb = ancB.get(anc);
        if (!rb)
            return;
        const score = ra.d + rb.d;
        if (!best || score < best.score || (score === best.score && ra.d < best.u))
            best = { anc, u: ra.d, d: rb.d, viaA: ra.via, score };
    });
    if (!best)
        return null;
    return { u: best.u, d: best.d, viaA: best.viaA, junction: kinFirstDescender(best.anc, bId, idx.childrenOf) };
}
// التاء المربوطة تُفتح عند لحاق ضمير: عمّة + ك ← عمّتك. قاعدة لا استثناء لها.
function kinSuffix(w, suf) {
    return (w.endsWith("\u0629") ? w.slice(0, -1) + "\u062A" : w) + suf;
}
function kinArabic(u, d, gB, viaFather, gJ) {
    const f = (g) => g === "female";
    const son = f(gB) ? "\u0628\u0646\u062A" : "\u0627\u0628\u0646";
    if (u === 0) {
        if (d === 0) return { self: 1 };
        if (d === 1) return { head: son };
        if (d === 2) return { head: f(gB) ? "\u062D\u0641\u064A\u062F\u0629" : "\u062D\u0641\u064A\u062F" };
        if (d === 3) return { head: son, of: "\u062D\u0641\u064A\u062F" };
        return null;
    }
    if (d === 0) {
        if (u === 1) return { head: f(gB) ? "\u0648\u0627\u0644\u062F\u0629" : "\u0648\u0627\u0644\u062F" };
        if (u === 2) return { head: f(gB) ? "\u062C\u062F\u0651\u0629" : "\u062C\u062F\u0651", side: viaFather };
        if (u === 3) return { head: f(gB) ? "\u062C\u062F\u0651\u0629" : "\u062C\u062F\u0651", of: viaFather ? "\u0648\u0627\u0644\u062F" : "\u0648\u0627\u0644\u062F\u0629" };
        return null;
    }
    if (u === 1) {
        if (d === 1) return { head: f(gB) ? "\u0623\u062E\u062A" : "\u0623\u062E" };
        const sib = f(gJ) ? "\u0623\u062E\u062A" : "\u0623\u062E";
        if (d === 2) return { head: son, of: sib };
        if (d === 3) return { head: f(gB) ? "\u062D\u0641\u064A\u062F\u0629" : "\u062D\u0641\u064A\u062F", of: sib };
        return null;
    }
    if (u === 2) {
        const unc = viaFather ? (f(gJ) ? "\u0639\u0645\u0651\u0629" : "\u0639\u0645\u0651") : (f(gJ) ? "\u062E\u0627\u0644\u0629" : "\u062E\u0627\u0644");
        if (d === 1) return { head: unc };
        if (d === 2) return { head: son, of: unc };
        if (d === 3) return { head: f(gB) ? "\u062D\u0641\u064A\u062F\u0629" : "\u062D\u0641\u064A\u062F", of: unc };
        return null;
    }
    if (u === 3 && d >= 1 && d <= 2) {
        const inner = kinArabic(2, d, gB, viaFather, gJ);
        if (!inner)
            return null;
        const par = viaFather ? "\u0648\u0627\u0644\u062F" : "\u0648\u0627\u0644\u062F\u0629";
        return { head: inner.head, of: inner.of ? `${inner.of} ${par}` : par };
    }
    return null;
}
function kinEnglish(u, d, gB, viaFather, gJ) {
    const f = (g) => g === "female";
    const side = viaFather ? "paternal" : "maternal";
    if (u === 0) {
        if (d === 0) return "you";
        if (d === 1) return f(gB) ? "your daughter" : "your son";
        if (d === 2) return f(gB) ? "your granddaughter" : "your grandson";
        if (d === 3) return f(gB) ? "your great-granddaughter" : "your great-grandson";
        return null;
    }
    if (d === 0) {
        if (u === 1) return f(gB) ? "your mother" : "your father";
        if (u === 2) return `your ${side} ${f(gB) ? "grandmother" : "grandfather"}`;
        if (u === 3) return `your ${side} ${f(gB) ? "great-grandmother" : "great-grandfather"}`;
        return null;
    }
    if (u === 1) {
        if (d === 1) return f(gB) ? "your sister" : "your brother";
        if (d === 2) return f(gB) ? "your niece" : "your nephew";
        if (d === 3) return f(gB) ? "your grand-niece" : "your grand-nephew";
        return null;
    }
    if (u === 2) {
        if (d === 1) return `your ${side} ${f(gB) ? "aunt" : "uncle"}`;
        if (d === 2) return `your ${side} cousin`;
        if (d === 3) return `your ${side} cousin's ${f(gB) ? "daughter" : "son"}`;
        return null;
    }
    if (u === 3 && d >= 1 && d <= 2)
        return d === 1
            ? `your ${side} ${f(gB) ? "great-aunt" : "great-uncle"}`
            : `your parent's ${side} cousin`;
    return null;
}
/** يصف قرابة b بالنسبة إلى a، أو null إن تعذّر الوصف */
function describeKinship(aId, bId, persons, relations) {
    if (!aId || !bId)
        return null;
    const idx = kinBuildIndex(persons, relations);
    const P = idx.P;
    if (!P[aId] || !P[bId])
        return null;
    if (aId === bId)
        return isRTL() ? "\u0623\u0646\u062A" : "you";
    // الزوجية أولاً: أقرب من أي نسب وأكثر ما يُسأل عنه
    if ((idx.spousesOf[aId] || []).includes(bId))
        return t(P[bId].gender === "female" ? "kin_your_wife" : "kin_your_husband");
    if ((idx.exOf[aId] || []).includes(bId))
        return P[bId].gender === "female" ? tl("زوجتك السابقة", "your ex-wife") : tl("زوجك السابق", "your ex-husband");
    // ⛔ جنسُ من نصفه هو جنس نهاية المسار لا جنس الهدف الأصلي: في مسار
    // المصاهرة نصف الزوج (العمّ) لا الزوجة، وإلا صار «عمّك» aunt.
    const say = (rel, whoId) => {
        if (!rel)
            return null;
        const viaFather = rel.viaA && P[rel.viaA] ? P[rel.viaA].gender !== "female" : true;
        const gJ = rel.junction && P[rel.junction] ? P[rel.junction].gender : null;
        const gWho = P[whoId] && P[whoId].gender;
        if (!isRTL())
            return kinEnglish(rel.u, rel.d, gWho, viaFather, gJ);
        const n = kinArabic(rel.u, rel.d, gWho, viaFather, gJ);
        if (!n)
            return null;
        if (n.self)
            return "\u0623\u0646\u062A";
        if (n.of)
            return `${n.head} ${kinSuffix(n.of, "\u0643")}`;
        const sd = n.side === undefined ? "" : (n.side ? " \u0644\u0623\u0628\u064A\u0643" : " \u0644\u0623\u0645\u0651\u0643");
        return `${kinSuffix(n.head, "\u0643")}${sd}`;
    };
    const direct = say(kinBlood(aId, bId, idx), bId);
    if (direct)
        return direct;
    // لا نسب مباشر: نجرّب المصاهرة — «زوجة عمّك» أقرب وصف صحيح
    for (const sp of idx.spousesOf[bId] || []) {
        const viaSpouse = say(kinBlood(aId, sp, idx), sp);
        if (viaSpouse)
            return t(P[bId].gender === "female" ? "kin_wife_of" : "kin_husband_of", { of: viaSpouse });
    }
    return null;
}
// C75: القرابة كما تُعرض لشخص — المحسوبة بوصفها الكامل («الأخ الشقيق»، «بنت ابن العم»)، وإلّا المخزَّنة
// C80: الاسم الأوّل — إلّا المركّب: «أم كلثوم»، «عبد الله»، «أبو بكر» (كان يظهر «أبناء أم»)
function shortName(n) {
    const w = String(n || "").trim().split(/\s+/);
    return (w.length > 1 && /^(أم|ام|أبو|ابو|أبي|عبد|ست|نور|سيد|شيخ)$/.test(w[0])) ? w[0] + " " + w[1] : w[0];
}
function personKinLabel(p) {
    if (!p) return "";
    if (p.kinLabel && isRTL()) return p.kinLabel;
    return kinshipLabel(p.kinship);
}
function personKinAlso(p) { return (p && p.kinAlso && p.kinAlso.length && isRTL()) ? p.kinAlso : []; }
//@@sawa-part:2
