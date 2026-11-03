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
            // C188: الحرف العربيّ يحتاج حجماً أكبر من اللاتينيّ ليُقرأ — النصوص الصغيرة تكبر (٩ ⇐ ١١، ١٠ ⇐ ١١٫٥، ١١ ⇐ ١٢، ١٢ ⇐ ١٣)، و١٣ فما فوق بلا تغيير.
            //   الاسم يبقى (text-[10px]) والحجم المعروض من هذا الجدول؛ ٧ و٨ للشارات الصغيرة فتكبر قليلاً فقط.
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
