const TAXI_DESTINATION_KEYS = ["tx_almtar", "tx_kwrnthya", "tx_swq", "tx_jamaa"];
const TAXI_STAGE_KEYS = ["tx_tm_takyd", "tx_alsayq_fy_altryq", "tx_bdat_alrhla", "tx_wslt"];
const TAXI_ESTIMATED_KM = 8; // تقدير بسيط للمسافة بالمعاينة (الأصلي يحسبها من الإحداثيات الفعلية)
const TAXI_BASE_FARE = 8;
const TAXI_PER_KM = 2.3;
function taxiFare(km, multiplier) {
    return Math.round((TAXI_BASE_FARE + km * TAXI_PER_KM) * multiplier);
}
function taxiFareBreakdown(km, multiplier) {
    const base = Math.round(TAXI_BASE_FARE * multiplier);
    const distance = Math.round(km * TAXI_PER_KM * multiplier);
    return { base, distance, total: base + distance };
}
function ScheduledRidesScreen({ scheduledRides, onCancel, onTrigger, onBack }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "absolute inset-0 z-30 flex flex-col", style: { backgroundColor: colors.bg, top: 78 } },
        React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("alrhlat_almjdwla")),
            React.createElement("button", { "aria-label": t("ighlaq"), onClick: onBack },
                React.createElement(X, { size: 18, color: colors.textMuted }))),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            scheduledRides.length === 0 && React.createElement(EmptyState, { icon: Clock, label: t("ma_fyh_rhlat_mjdwla") }),
            scheduledRides.map((r) => (React.createElement(Card, { key: r.id },
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-1.5` },
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, r.destination),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.primary } },
                        r.fare.toLocaleString(loc()),
                        t("w_sdg_sp"))),
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-2` },
                    React.createElement(Clock, { size: 12, color: colors.textMuted }),
                    React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, new Date(r.scheduledFor).toLocaleString(loc(), { day: "numeric", month: "long", hour: "numeric", minute: "numeric" }))),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => onTrigger(r.id), className: "flex-1 rounded-xl py-2 border text-center", style: { borderColor: colors.primary } },
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primary } }, t("mhakaa_han_almwad_akhtbar"))),
                    React.createElement("button", { "aria-label": t("hdhf"), onClick: () => onCancel(r.id), className: "rounded-xl py-2 px-3 border", style: { borderColor: colors.danger } },
                        React.createElement(Trash2, { size: 14, color: colors.danger })))))))));
}
function TaxiHistoryScreen({ history, onBack }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "absolute inset-0 z-30 flex flex-col", style: { backgroundColor: colors.bg, top: 78 } },
        React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border, backgroundColor: colors.card } },
            React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("sjl_alrhlat")),
            React.createElement("button", { "aria-label": t("ighlaq"), onClick: onBack },
                React.createElement(X, { size: 18, color: colors.textMuted }))),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4" },
            history.length === 0 && React.createElement(EmptyState, { icon: Car, label: t("la_twjd_rhlat_sabqa") }),
            history.map((trip) => {
                var _a;
                const vehicle = TAXI_VEHICLE_TYPES.find((v) => v.key === trip.vehicleKey);
                return (React.createElement(Card, { key: trip.id, className: `flex ${rowStart()} items-center` },
                    React.createElement("div", { className: `w-10 h-10 rounded-full flex items-center justify-center ${ms("3")}`, style: { backgroundColor: colors.primaryLight } },
                        React.createElement(Car, { size: 18, color: colors.primaryInk })),
                    React.createElement("div", { className: "flex-1" },
                        React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, trip.destination),
                        React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, (_a = trip.driver) === null || _a === void 0 ? void 0 :
                            _a.name,
                            " \u00B7 ", vehicle === null || vehicle === void 0 ? void 0 :
                            vehicle.label,
                            " \u00B7 ",
                            new Date(trip.completedAt).toLocaleDateString(loc(), { day: "numeric", month: "long" })),
                        trip.rating && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-0.5 mt-1` }, [1, 2, 3, 4, 5].map((n) => (React.createElement(Star, { key: n, size: 10, color: colors.accent, fill: n <= trip.rating ? colors.accent : "none" })))))),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.primary } },
                        trip.fare,
                        t("w_sdg_sp"))));
            }))));
}
function TaxiScreen({ ride, tripsHistory, scheduledRides, onRequestRide, onScheduleRide, onCancelScheduledRide, onTriggerScheduledRide, onCancelRide, onNewRide, onRateDriver, onBack }) {
    var _a, _b, _c;
    const { colors } = useTheme();
    const { showToast } = useToast();
    const [pickup, setPickup] = useState(null);
    const [destPoint, setDestPoint] = useState(null);
    const [destIdx, setDestIdx] = useState(0);
    const [activeMapPicker, setActiveMapPicker] = useState(null); // null | "pickup" | "destination"
    const [paymentMethod, setPaymentMethod] = useState("cash"); // cash | wallet
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    const [vehicleKey, setVehicleKey] = useState("economy");
    const [rideMessages, setRideMessages] = useState([]);
    const [showRideChat, setShowRideChat] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [rated, setRated] = useState(false);
    const [selectedRating, setSelectedRating] = useState(0);
    const [ratingComment, setRatingComment] = useState("");
    const [showFareDetail, setShowFareDetail] = useState(false);
    const [bookingMode, setBookingMode] = useState("now"); // now | later
    const [scheduledDateTime, setScheduledDateTime] = useState("");
    const [showScheduled, setShowScheduled] = useState(false);
    const [womenOnly, setWomenOnly] = useState(false);
    const [showSosConfirm, setShowSosConfirm] = useState(false);
    const [sosActivated, setSosActivated] = useState(false);
    const vehicle = TAXI_VEHICLE_TYPES.find((v) => v.key === vehicleKey);
    const fare = taxiFare(TAXI_ESTIMATED_KM, vehicle.multiplier);
    const fareBreakdown = taxiFareBreakdown(TAXI_ESTIMATED_KM, vehicle.multiplier);
    // محادثة الرحلة تُدمَّر نهائياً فور وصول الرحلة للمرحلة الأخيرة — نفس
    // الآلية الموثّقة رسمياً بالضبط. نراقب stageIdx ونصفّر الرسائل عند الوصول
    useEffect(() => {
        if (ride && ride.stageIdx === TAXI_STAGE_KEYS.length - 1) {
            setRideMessages([]);
            setShowRideChat(false);
        }
        if (!ride) {
            setRideMessages([]);
            setShowRideChat(false);
            setRated(false);
            setSelectedRating(0);
            setRatingComment("");
            setShowSosConfirm(false);
            setSosActivated(false);
        }
    }, [ride === null || ride === void 0 ? void 0 : ride.stageIdx, ride]);
    function sendToDriver(text, isLocation = false) {
        setRideMessages((prev) => [...prev, { id: `rm-${Date.now()}`, text, senderIsMe: true, isLocation }]);
        setTimeout(() => {
            const reply = TAXI_DRIVER_REPLIES[Math.floor(Math.random() * TAXI_DRIVER_REPLIES.length)];
            setRideMessages((prev) => [...prev, { id: `rm-${Date.now()}-r`, text: reply, senderIsMe: false, isLocation: false }]);
        }, 1000);
    }
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col relative" },
        React.createElement(TopBar, { title: t("taksy_swa"), onBack: onBack, actions: (!ride || ride.stageIdx === TAXI_STAGE_KEYS.length - 1) && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 ${ms("2")}` },
                scheduledRides.length > 0 && (React.createElement("button", { onClick: () => setShowScheduled(true), className: "relative" },
                    React.createElement(Clock, { size: 18, color: "#fff" }),
                    React.createElement("span", { className: "absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white", style: { backgroundColor: colors.danger } }, scheduledRides.length))),
                React.createElement("button", { "aria-label": tl("السجلّ", "History"), onClick: () => setShowHistory(true) },
                    React.createElement(FileClock, { size: 18, color: "#fff" })))) }),
        showHistory && React.createElement(TaxiHistoryScreen, { history: tripsHistory, onBack: () => setShowHistory(false) }),
        showScheduled && (React.createElement(ScheduledRidesScreen, { scheduledRides: scheduledRides, onCancel: onCancelScheduledRide, onTrigger: (id) => { onTriggerScheduledRide(id); setShowScheduled(false); }, onBack: () => setShowScheduled(false) })),
        React.createElement("div", { className: "flex-1 flex flex-col p-4 overflow-y-auto", style: { backgroundColor: colors.bg, display: (showHistory || showScheduled) ? "none" : "flex" } }, !ride ? (React.createElement(React.Fragment, null,
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("mwqak_wwjhtk")),
            React.createElement("button", { onClick: () => setActiveMapPicker("pickup"), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl border p-3 mb-2`, style: { borderColor: pickup ? colors.success : colors.border, backgroundColor: colors.card } },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                    React.createElement("div", { className: "w-7 h-7 rounded-full flex items-center justify-center", style: { backgroundColor: colors.success + "22" } },
                        React.createElement(MapPin, { size: 13, color: colors.success })),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, pickup ? t("tx_nqta_mhdda") : t("tx_hdd_nqta"))),
                React.createElement(ChevronLeft, { size: 15, color: colors.textMuted, style: { transform: isRTL() ? "none" : "scaleX(-1)" } })),
            React.createElement("button", { onClick: () => setActiveMapPicker("destination"), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl border p-3 mb-3`, style: { borderColor: destPoint ? colors.danger : colors.border, backgroundColor: colors.card } },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                    React.createElement("div", { className: "w-7 h-7 rounded-full flex items-center justify-center", style: { backgroundColor: colors.danger + "22" } },
                        React.createElement(Navigation, { size: 13, color: colors.danger })),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, destPoint ? (destIdx >= 0 ? t(TAXI_DESTINATION_KEYS[destIdx]) : t("tx_alwjha_mhdda")) : t("tx_hdd_alwjha"))),
                React.createElement(ChevronLeft, { size: 15, color: colors.textMuted, style: { transform: isRTL() ? "none" : "scaleX(-1)" } })),
            activeMapPicker === "pickup" && (React.createElement(MapPickerModal, { title: t("hdd_nqta_alastlam"), initialPoint: pickup || { x: 30, y: 75 }, showLocateMe: true, onConfirm: (p) => { setPickup(p); setActiveMapPicker(null); }, onClose: () => setActiveMapPicker(null) })),
            activeMapPicker === "destination" && (React.createElement(MapPickerModal, { title: t("hdd_alwjha"), initialPoint: destPoint || { x: 60, y: 30 }, onConfirm: (p) => { setDestPoint(p); setDestIdx(-1); setActiveMapPicker(null); }, onClose: () => setActiveMapPicker(null) })),
            pickup && !destPoint && (React.createElement(React.Fragment, null,
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("aw_akhtr_wjha_sryaa")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-4` }, TAXI_DESTINATION_KEYS.map((d, i) => (React.createElement(Chip, { key: d, label: t(d), active: destIdx === i, onPress: () => { setDestIdx(i); setDestPoint({ x: 20 + i * 18, y: 30 + i * 12 }); } })))))),
            pickup && destPoint && (React.createElement(React.Fragment, null,
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("alsayqwn_alqrybwn_mnk")),
                React.createElement(NearbyDriversPreview, { pickup: pickup }),
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("nwa_almrkba")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2.5 mb-4` }, TAXI_VEHICLE_TYPES.map((v) => {
                    const active = vehicleKey === v.key;
                    const vFare = taxiFare(TAXI_ESTIMATED_KM, v.multiplier);
                    return (React.createElement("button", { key: v.key, onClick: () => setVehicleKey(v.key), className: "flex-1 rounded-2xl border-2 p-3 flex flex-col items-center gap-1", style: {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primaryLight : colors.card,
                            boxShadow: active ? `0 4px 12px ${colors.primary}33` : "none",
                        } },
                        React.createElement("span", { className: "text-2xl" }, v.icon),
                        React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.text } }, v.label),
                        React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } },
                            v.seats,
                            t("tx_mqaad"),
                            v.eta,
                            t("tx_d")),
                        React.createElement("span", { className: "text-xs font-bold mt-0.5", style: { color: active ? colors.primary : colors.textMuted } },
                            vFare.toLocaleString(loc()),
                            t("w_sdg_sp"))));
                })),
                React.createElement("div", { className: "rounded-2xl p-4 mb-4", style: { background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})` } },
                    React.createElement("div", { className: `flex ${rowStart()} justify-between items-center` },
                        React.createElement("button", { onClick: () => setShowFareDetail(!showFareDetail), className: `flex ${rowStart()} items-center gap-1` },
                            React.createElement("span", { className: "text-xs font-bold text-white" }, t("alsar_altqdyry")),
                            React.createElement(ChevronDown, { size: 12, color: "#fff", style: { transform: showFareDetail ? "rotate(180deg)" : "none" } })),
                        React.createElement("span", { className: "text-lg font-extrabold text-white" },
                            fare.toLocaleString(loc()),
                            t("w_sdg_sp"))),
                    showFareDetail && (React.createElement("div", { className: "mt-2 pt-2 border-t", style: { borderColor: "#ffffff33" } },
                        React.createElement("div", { className: `flex ${rowStart()} justify-between text-[11px]`, style: { color: "#ffffffdd" } },
                            React.createElement("span", null, t("ajra_asasya")),
                            React.createElement("span", null,
                                fareBreakdown.base.toLocaleString(loc()),
                                t("w_sdg_sp"))),
                        React.createElement("div", { className: `flex ${rowStart()} justify-between text-[11px] mt-0.5`, style: { color: "#ffffffdd" } },
                            React.createElement("span", null,
                                t("tx_almsafa"),
                                TAXI_ESTIMATED_KM,
                                t("tx_km")),
                            React.createElement("span", null,
                                fareBreakdown.distance.toLocaleString(loc()),
                                t("w_sdg_sp"))))),
                    React.createElement("div", { className: `text-[11px] mt-1 ${textStart()}`, style: { color: "#ffffffcc" } },
                        t("tx_ila"),
                        destIdx >= 0 ? t(TAXI_DESTINATION_KEYS[destIdx]) : t("tx_nqta_ydwya"),
                        " \u00B7 ",
                        vehicle.label,
                        " \u00B7 ",
                        vehicle.eta,
                        t("tx_dqayq"))),
                React.createElement("button", { onClick: () => setWomenOnly(!womenOnly), className: `w-full flex ${rowStart()} items-center justify-between rounded-xl border-2 p-3 mb-4`, style: { borderColor: womenOnly ? colors.accent : colors.border, backgroundColor: womenOnly ? colors.accent + "15" : colors.card } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2` },
                        React.createElement(UserCheck, { size: 16, color: womenOnly ? colors.accent : colors.textMuted }),
                        React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, t("tfdyl_sayqa_fqt"))),
                    React.createElement("div", { className: "w-10 h-5 rounded-full relative", style: { backgroundColor: womenOnly ? colors.accent : colors.border } },
                        React.createElement("span", { className: "absolute top-0.5 w-4 h-4 rounded-full bg-white", style: { [womenOnly ? "right" : "left"]: 2 } }))),
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("mwad_alrhla")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-3` },
                    React.createElement("button", { onClick: () => setBookingMode("now"), className: `flex-1 rounded-xl border-2 p-2.5 flex ${rowStart()} items-center justify-center gap-1.5`, style: { borderColor: bookingMode === "now" ? colors.primary : colors.border, backgroundColor: bookingMode === "now" ? colors.primaryLight : colors.card } },
                        React.createElement(Navigation, { size: 14, color: bookingMode === "now" ? colors.primary : colors.textMuted }),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("alan"))),
                    React.createElement("button", { onClick: () => setBookingMode("later"), className: `flex-1 rounded-xl border-2 p-2.5 flex ${rowStart()} items-center justify-center gap-1.5`, style: { borderColor: bookingMode === "later" ? colors.primary : colors.border, backgroundColor: bookingMode === "later" ? colors.primaryLight : colors.card } },
                        React.createElement(Clock, { size: 14, color: bookingMode === "later" ? colors.primary : colors.textMuted }),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("lahqa_2")))),
                bookingMode === "later" && (React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", type: "datetime-local", value: scheduledDateTime, onChange: (e) => setScheduledDateTime(e.target.value), min: new Date(Date.now() + 10 * 60000).toISOString().slice(0, 16), className: "w-full border rounded-xl px-3 py-2.5 text-sm mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } })),
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("tryqa_aldfa")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` },
                    React.createElement("button", { onClick: () => setPaymentMethod("cash"), className: `flex-1 rounded-xl border-2 p-3 flex ${rowStart()} items-center justify-center gap-2`, style: { borderColor: paymentMethod === "cash" ? colors.primary : colors.border, backgroundColor: paymentMethod === "cash" ? colors.primaryLight : colors.card } },
                        React.createElement(Banknote, { size: 16, color: paymentMethod === "cash" ? colors.primary : colors.textMuted }),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("kash_nqda"))),
                    React.createElement("button", { onClick: () => setPaymentMethod("wallet"), className: `flex-1 rounded-xl border-2 p-3 flex ${rowStart()} items-center justify-center gap-2`, style: { borderColor: paymentMethod === "wallet" ? colors.primary : colors.border, backgroundColor: paymentMethod === "wallet" ? colors.primaryLight : colors.card } },
                        React.createElement(Wallet, { size: 16, color: paymentMethod === "wallet" ? colors.primary : colors.textMuted }),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("mhfza_swa")))),
                React.createElement(Button, { icon: bookingMode === "later" ? Clock : Navigation, label: bookingMode === "later" ? t("tx_jdwla") : t("tx_atlb"), disabled: bookingMode === "later" && !scheduledDateTime, onPress: () => {
                        const dest = destIdx >= 0 ? t(TAXI_DESTINATION_KEYS[destIdx]) : t("tx_nqta_khryta");
                        if (bookingMode === "later")
                            onScheduleRide(vehicleKey, dest, fare, paymentMethod, scheduledDateTime, womenOnly);
                        else
                            onRequestRide(vehicleKey, dest, fare, paymentMethod, womenOnly);
                    }, className: "mt-1" }))))) : showRideChat ? (React.createElement(RideChatScreen, { driverName: ((_a = ride.driver) === null || _a === void 0 ? void 0 : _a.name) || t("tx_alsayq"), messages: rideMessages, onSendToDriver: sendToDriver, onClose: () => setShowRideChat(false) })) : (React.createElement("div", { className: "flex-1 overflow-y-auto flex flex-col items-center" },
            React.createElement(AnimatedTrackingMap, { progress: ride.stageIdx <= 1 ? ride.stageIdx : (ride.stageIdx - 1) / (TAXI_STAGE_KEYS.length - 2), icon: Car, pickup: pickup, destination: destPoint, driverApproaching: ride.stageIdx <= 1 }),
            React.createElement("div", { className: `w-full rounded-full px-4 py-2 mt-3 flex ${rowStart()} items-center justify-center gap-2`, style: { backgroundColor: colors.primaryLight } },
                React.createElement(Car, { size: 15, color: colors.primaryInk }),
                React.createElement("span", { className: "text-sm font-extrabold", style: { color: colors.primaryInk } }, t(TAXI_STAGE_KEYS[ride.stageIdx]))),
            ride.stageIdx < 2 && (React.createElement("div", { className: `w-full rounded-2xl border-2 mt-3 p-3 flex ${rowStart()} items-center justify-between`, style: { borderColor: colors.accent, backgroundColor: colors.accent + "11" } },
                React.createElement("div", { className: `${textStart()}` },
                    React.createElement("div", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, t("rmz_althqq_adhkrh_llsayq")),
                    React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, t("ymna_alrkwb_bsyara_ghlt"))),
                React.createElement("span", { className: "text-2xl font-extrabold tracking-widest", style: { color: colors.accent }, dir: "ltr" }, ride.pin))),
            ride.driver && (React.createElement("div", { className: "w-full rounded-2xl border mt-3 p-4", style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-3` },
                    React.createElement("div", { className: "w-14 h-14 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.primary } },
                        React.createElement("span", { className: "text-xl font-extrabold text-white" }, (_b = ride.driver.name) === null || _b === void 0 ? void 0 : _b.charAt(0))),
                    React.createElement("div", { className: `flex-1 ${textStart()}` },
                        React.createElement("div", { className: "text-sm font-extrabold", style: { color: colors.text } }, ride.driver.name),
                        React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, ride.driver.car),
                        React.createElement("div", { className: `flex ${rowStart()} items-center gap-1 mt-1` },
                            React.createElement(Star, { size: 12, color: colors.accent, fill: colors.accent }),
                            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, ride.driver.rating),
                            React.createElement("span", { className: "text-xs mx-1", style: { color: colors.border } }, "|"),
                            React.createElement("span", { className: "text-xs", style: { color: colors.textMuted }, dir: "ltr" }, ride.driver.plate)))),
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mt-3 pt-3 border-t`, style: { borderColor: colors.border } },
                    React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("alajra")),
                    React.createElement("span", { className: "text-base font-extrabold", style: { color: colors.primary } },
                        ride.fare.toLocaleString(loc()),
                        t("w_sdg_sp"))),
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mt-1.5` },
                    React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("tryqa_aldfa")),
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1` },
                        ride.paymentMethod === "wallet" ? React.createElement(Wallet, { size: 12, color: colors.textMuted }) : React.createElement(Banknote, { size: 12, color: colors.textMuted }),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, ride.paymentMethod === "wallet" ? t("tx_mhfza") : t("tx_kash")))))),
            ride.driver && ride.stageIdx < TAXI_STAGE_KEYS.length - 1 && (React.createElement("div", { className: `flex ${rowStart()} gap-2 w-full mt-3` },
                React.createElement(Button, { icon: Phone, label: t("atsal"), variant: "outline", style: { flex: 1 }, onPress: () => { } }),
                React.createElement(Button, { icon: MessageCircle, label: t("rasl_alsayq"), onPress: () => setShowRideChat(true), style: { flex: 1 } }))),
            ride.driver && ride.stageIdx < TAXI_STAGE_KEYS.length - 1 && (React.createElement("div", { className: `flex ${rowStart()} gap-2 w-full mt-2` },
                React.createElement("button", { onClick: async () => {
                        const text = `أنا براكب مع سوا تاكسي\nالسائق: ${ride.driver.name} — ${ride.driver.car} (${ride.driver.plate})\nالوجهة: ${ride.destination}\nرمز التحقق: ${ride.pin}`;
                        if (navigator.share) {
                            try {
                                await navigator.share({ text });
                            }
                            catch (err) { }
                        }
                        else {
                            await copyText(text);
                            showToast(t("tm_nskh_tfasyl_alrhla"), "success");
                        }
                    }, className: `flex-1 flex ${rowStart()} items-center justify-center gap-1.5 rounded-xl py-2.5 border`, style: { borderColor: colors.primary } },
                    React.createElement(Share2, { size: 14, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("shark_rhltk"))),
                React.createElement("button", { onClick: () => setShowSosConfirm(true), className: `flex-1 flex ${rowStart()} items-center justify-center gap-1.5 rounded-xl py-2.5`, style: { backgroundColor: colors.danger } },
                    React.createElement(AlertTriangle, { size: 14, color: "#fff" }),
                    React.createElement("span", { className: "text-xs font-bold text-white" }, t("twary"))))),
            showSosConfirm && (React.createElement("div", { className: "w-full rounded-xl border-2 mt-2 p-3", style: { borderColor: colors.danger, backgroundColor: colors.danger + "11" } },
                React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, t("tfayl_tnbyh_altwary_snshark")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement("button", { onClick: () => { setShowSosConfirm(false); setSosActivated(true); showToast(t("tm_tfayl_tnbyh_altwary"), "error"); }, className: "flex-1 rounded-xl py-2", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-xs font-bold text-white" }, t("takyd_altwary"))),
                    React.createElement("button", { onClick: () => setShowSosConfirm(false), className: "flex-1 rounded-xl py-2 border", style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("ilgha")))))),
            sosActivated && (React.createElement("div", { className: `w-full rounded-xl mt-2 p-3 flex ${rowStart()} items-center gap-2`, style: { backgroundColor: colors.danger } },
                React.createElement(AlertTriangle, { size: 14, color: "#fff" }),
                React.createElement("span", { className: "text-xs font-bold text-white" }, t("tnbyh_altwary_mfal_hdhy")))),
            ride.stageIdx < TAXI_STAGE_KEYS.length - 1 && (!confirmingCancel ? (React.createElement("button", { onClick: () => setConfirmingCancel(true), className: "w-full text-center mt-3 py-2" },
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.danger } }, t("ilgha_alrhla")))) : (React.createElement("div", { className: "w-full rounded-xl border mt-3 p-3", style: { borderColor: colors.danger } },
                React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, t("mtakd_mn_ilgha_alrhla")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement(Button, { label: t("nam_algh"), onPress: () => { onCancelRide(); setConfirmingCancel(false); }, style: { flex: 1, backgroundColor: colors.danger } }),
                    React.createElement(Button, { label: t("traja"), variant: "outline", onPress: () => setConfirmingCancel(false), style: { flex: 1 } }))))),
            React.createElement("div", { className: `flex ${rowStart()} gap-1 mt-4 w-full` }, TAXI_STAGE_KEYS.map((st, i) => (React.createElement("div", { key: st, className: "flex-1 h-1.5 rounded-full", style: { backgroundColor: ride.stageIdx >= i ? colors.primary : colors.border } })))),
            ride.stageIdx === TAXI_STAGE_KEYS.length - 1 && !rated && (React.createElement("div", { className: "w-full rounded-2xl border mt-4 p-4", style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement("p", { className: "text-sm font-extrabold text-center mb-3", style: { color: colors.text } },
                    t("tx_kyf_kant"), (_c = ride.driver) === null || _c === void 0 ? void 0 :
                    _c.name,
                    t("tx_swal")),
                React.createElement("div", { className: `flex ${rowStart()} justify-center gap-1.5 mb-3` }, [1, 2, 3, 4, 5].map((n) => (React.createElement("button", { "aria-label": t("almfdla"), key: n, onClick: () => setSelectedRating(n) },
                    React.createElement(Star, { size: 30, color: colors.accent, fill: n <= selectedRating ? colors.accent : "none" }))))),
                selectedRating > 0 && (React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: ratingComment, onChange: (e) => setRatingComment(e.target.value), placeholder: t("talyq_akhtyary"), className: "w-full border rounded-xl px-3 py-2 text-sm mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg } })),
                React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                    React.createElement(Button, { label: t("irsal_altqyym"), disabled: selectedRating === 0, onPress: () => { onRateDriver(ride.id, selectedRating, ratingComment.trim()); setRated(true); }, style: { flex: 1 } }),
                    React.createElement(Button, { label: t("tkhty"), variant: "outline", onPress: () => setRated(true), style: { flex: 1 } })))),
            ride.stageIdx === TAXI_STAGE_KEYS.length - 1 && rated && (React.createElement(Button, { label: t("tlb_rhla_jdyda"), onPress: onNewRide, style: { marginTop: 16, width: "100%" } })))))));
}
// ============================================================================
// المحفظة (Wallet) — بسوا الأصلي مقفولة ببصمة/PIN منفصل، نفس المبدأ هنا
// ============================================================================
// ============================================================================
// المحفظة الإلكترونية — بيانات حقيقية مستخرجة من الكود الأصلي بالضبط
// ============================================================================
const WALLET_BANKS = ["بنك الخرطوم", "بنك فيصل الإسلامي السوداني", "البنك الزراعي السوداني", "بنك أم درمان الوطني", "بنك النيلين"];
const WALLET_MERCHANTS = [
    { name: "كافيه اللوزتين", icon: "☕" },
    { name: "سوبرماركت النخيل", icon: "🛒" },
    { name: "صيدلية الشفاء", icon: "💊" },
];
// ══════════════════════════════════════════════════════════════════════════
// طاقة — مكوّن شاشة الشراء
// ══════════════════════════════════════════════════════════════════════════
function TaqaPurchaseScreen({ company, walletBalance, colors, onBack, onBuy }) {
    const [fuelType, setFuelType] = useState("benzin");
    const [selectedAmt, setSelectedAmt] = useState(5000);
    const [customAmt, setCustomAmt] = useState("");
    const [showCustom, setShowCustom] = useState(false);
    const [shareOn, setShareOn] = useState(false);
    const [refundOn, setRefundOn] = useState(true);
    const [phone, setPhone] = useState("");
    const price = fuelType === "benzin" ? company.priceB : company.priceD;
    const finalAmt = showCustom ? (parseInt(customAmt) || 0) : selectedAmt;
    const liters = finalAmt > 0 ? Math.round(finalAmt / price) : 0;
    const AMOUNTS = [1000, 2500, 5000, 10000, 20000];
    function generateToken() {
        const part1 = String(Math.floor(1000 + Math.random() * 9000));
        const part2 = String(Math.floor(1000 + Math.random() * 9000));
        return `${part1}-${part2}`;
    }
    function handleBuy() {
        if (finalAmt <= 0)
            return;
        const token = generateToken();
        const rawToken = token.replace("-", "");
        onBuy({
            token,
            rawToken,
            company: company.name,
            companyCode: company.code,
            fuelType: fuelType === "benzin" ? t("tq_bnzyn") : t("tq_dyzl"),
            fuelTag: fuelType,
            amount: finalAmt,
            liters,
            refundOn,
            sharePhone: shareOn ? phone : null,
            qrData: `TAQA-${rawToken}-${company.code}-${fuelType.toUpperCase()}-${finalAmt}SDG`,
            expiresLabel: t("tq_aljma"),
            createdAt: Date.now(),
        });
    }
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("tq_shra_wqwd"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-3 rounded-2xl p-3 border mb-4`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement("div", { className: "w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 gap-0.5", style: { backgroundColor: company.bg } },
                    React.createElement("span", { className: "text-base" }, company.emoji),
                    React.createElement("span", { className: "text-[7px] font-black", style: { color: company.color } }, company.code)),
                React.createElement("div", { className: "flex-1" },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, company.name),
                    React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                        t("tq_bnzyn_"),
                        company.priceB,
                        t("tq_j_dyzl"),
                        company.priceD,
                        t("tq_j_ltr"))),
                React.createElement("button", { onClick: onBack, className: "text-xs font-bold", style: { color: colors.primary } }, t("tq_tghyyr"))),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("tq_nwa_alwqwd")),
            React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} gap-2 mb-4` }, [
                { id: "benzin", label: t("tq_bnzyn"), emoji: "🟡", price: company.priceB },
                { id: "diesel", label: t("tq_dyzl"), emoji: "🟤", price: company.priceD },
            ].map((f) => (React.createElement("button", { key: f.id, onClick: () => setFuelType(f.id), className: "flex-1 rounded-xl py-3 border-2 text-center", style: { borderColor: fuelType === f.id ? colors.primary : colors.border, backgroundColor: fuelType === f.id ? colors.primaryLight : colors.card } },
                React.createElement("div", { className: "text-xl mb-0.5" }, f.emoji),
                React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, f.label),
                React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                    f.price,
                    t("tq_j_ltr_sp")))))),
            React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("tq_almblgh")),
            React.createElement("div", { className: "grid grid-cols-3 gap-2 mb-3" },
                AMOUNTS.map((a) => (React.createElement("button", { key: a, onClick: () => { setSelectedAmt(a); setShowCustom(false); }, className: "rounded-xl py-2.5 border-2 text-center", style: { borderColor: (!showCustom && selectedAmt === a) ? "#EF4444" : colors.border, backgroundColor: (!showCustom && selectedAmt === a) ? "#FDECEC" : colors.card } },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, a.toLocaleString(wLoc())),
                    React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                        "~",
                        Math.round(a / price),
                        t("tq_ltr"))))),
                React.createElement("button", { onClick: () => { setShowCustom(true); setSelectedAmt(0); }, className: "rounded-xl py-2.5 border-2 text-center", style: { borderColor: showCustom ? "#EF4444" : colors.border, backgroundColor: showCustom ? "#FDECEC" : colors.card } },
                    React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, t("tq_mblgh_akhr")),
                    React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } }, t("tq_ydwy")))),
            showCustom && (React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-2 rounded-xl border p-3 mb-3`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement("input", { type: "number", value: customAmt, onChange: (e) => setCustomAmt(e.target.value), placeholder: t("tq_adkhl_almblgh"), dir: isRTL() ? "rtl" : "ltr", className: "flex-1 text-sm outline-none bg-transparent text-right", style: { color: colors.text } }),
                React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("tq_jnyh")))),
            React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center justify-between rounded-xl p-3 border mb-2`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-2` },
                    React.createElement("div", { className: "w-8 h-8 rounded-lg flex items-center justify-center", style: { backgroundColor: walletTone(walletDarkNow()).tint } },
                        React.createElement(Send, { size: 14, color: walletTone(walletDarkNow()).ink })),
                    React.createElement("div", null,
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, t("tq_irsal_lshkhs")),
                        React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } }, t("tq_sms_aw")))),
                React.createElement("button", { onClick: () => setShareOn(!shareOn), className: "w-10 h-5 rounded-full relative transition-colors", style: { backgroundColor: shareOn ? colors.primary : "#CBD5E1" } },
                    React.createElement("div", { className: "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow", style: { right: shareOn ? "2px" : "22px" } }))),
            shareOn && (React.createElement("div", { className: "rounded-xl border mb-2 overflow-hidden", style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-2 p-3 border-b`, style: { borderColor: colors.border } },
                    React.createElement("input", { type: "tel", value: phone, onChange: (e) => setPhone(e.target.value), placeholder: t("tq_adkhl_rqm"), dir: isRTL() ? "rtl" : "ltr", className: "flex-1 text-sm outline-none bg-transparent text-right", style: { color: colors.text } }),
                    React.createElement("span", { className: "text-base flex-shrink-0" }, "\uD83D\uDCF1")),
                React.createElement("button", { onClick: () => {
                        // محاكاة اختيار جهة اتصال
                        setPhone("0912345678");
                    }, className: `w-full flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-2 px-3 py-2.5` },
                    React.createElement(Users, { size: 14, color: colors.primary, className: "flex-shrink-0" }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("tq_akhtr_mn_jhat"))),
                phone === "" && (React.createElement("div", { className: `border-t px-3 py-2`, style: { borderColor: colors.border } },
                    React.createElement("div", { className: "text-[10px] mb-1.5", style: { color: colors.textMuted } }, t("tq_alakhyrwn")),
                    React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} gap-2` }, [
                        { name: t("tq_ahmd"), phone: "0911234567" },
                        { name: t("tq_mhmd"), phone: "0922345678" },
                        { name: t("tq_fatma"), phone: "0933456789" },
                    ].map(c => (React.createElement("button", { key: c.phone, onClick: () => setPhone(c.phone), className: "flex flex-col items-center gap-1 rounded-xl px-3 py-2 border flex-shrink-0", style: { backgroundColor: colors.bg, borderColor: colors.border } },
                        React.createElement("div", { className: "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold", style: { backgroundColor: colors.primaryLight, color: colors.primary } }, c.name[0]),
                        React.createElement("span", { className: "text-[9px] font-bold", style: { color: colors.text } }, c.name))))))),
                phone !== "" && (React.createElement("div", { className: `border-t flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center justify-between px-3 py-2`, style: { borderColor: colors.border } },
                    React.createElement("span", { className: "text-[10px]", style: { color: colors.textMuted } },
                        t("tq_syrsl_alrmz"),
                        React.createElement("span", { className: "font-bold", style: { color: colors.text } }, phone)),
                    React.createElement("button", { onClick: () => setPhone(""), className: "text-[10px]", style: { color: colors.danger } }, t("tq_msh")))))),
            React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center justify-between rounded-xl p-3 border mb-4`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-2` },
                    React.createElement("div", { className: "w-8 h-8 rounded-lg flex items-center justify-center", style: { backgroundColor: walletTone(walletDarkNow()).tint } },
                        React.createElement(RotateCcw, { size: 14, color: walletTone(walletDarkNow()).ink })),
                    React.createElement("div", null,
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, t("tq_rsyd_mtbqy_tlqayy")),
                        React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } }, t("tq_rmz_jdyd")))),
                React.createElement("button", { onClick: () => setRefundOn(!refundOn), className: "w-10 h-5 rounded-full relative transition-colors", style: { backgroundColor: refundOn ? colors.primary : "#CBD5E1" } },
                    React.createElement("div", { className: "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow", style: { right: refundOn ? "2px" : "22px" } }))),
            React.createElement("button", { onClick: handleBuy, disabled: finalAmt <= 0, className: "w-full rounded-2xl py-4 font-bold text-sm text-white", style: { backgroundColor: finalAmt > 0 ? "#EF4444" : "#CBD5E1" } },
                t("tq_shra_rmz"),
                finalAmt > 0 ? finalAmt.toLocaleString(wLoc()) : t("tq_sfr"),
                t("tq_jnyh_em")),
            React.createElement("div", { className: "mt-2 text-center text-[10px]", style: { color: colors.textMuted } },
                t("tq_alrsyd_almtah"),
                (walletBalance || 0).toLocaleString(wLoc()),
                t("w_sdg_sp")))));
}
// ══════════════════════════════════════════════════════════════════════════
// طاقة — مكوّن شاشة الرمز + QR
// ══════════════════════════════════════════════════════════════════════════
function TaqaTokenScreen({ token, colors, onBack, onHistory }) {
    const qrRef = useRef(null);
    const qrGenRef = useRef(null);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!qrRef.current || !token.qrData)
            return;
        qrRef.current.innerHTML = "";
        const size = 140;
        const data = token.qrData;
        // رسم QR بسيط كـ SVG placeholder أو نص
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.style.borderRadius = "8px";
        qrRef.current.appendChild(canvas);
        try {
            if (window.QRCode) {
                new window.QRCode(canvas, { text: data, width: size, height: size, colorDark: "#1A1A2E", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M });
            }
            else {
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#F0F4FF";
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = "#1A1A2E";
                ctx.font = "bold 11px monospace";
                ctx.textAlign = "center";
                ctx.fillText("QR Code", size / 2, size / 2 - 8);
                ctx.font = "9px monospace";
                ctx.fillText(token.token || "", size / 2, size / 2 + 8);
            }
        }
        catch (e) { }
    }, [token]);
    function handleCopy() {
        copyText(token.token || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    const fuelTagStyle = token.fuelTag === "benzin"
        ? { bg: "#E3F2FD", color: "#1565C0" }
        : { bg: "#FCE4EC", color: "#880E4F" };
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("tq_rmz_alwqwd"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: "text-center py-3 mb-3" },
                React.createElement("div", { className: "text-4xl mb-1" }, "\u2705"),
                React.createElement("div", { className: "text-sm font-bold", style: { color: "#1B7A43" } }, t("tq_tm_alshra")),
                React.createElement("div", { className: "text-xs mt-1", style: { color: colors.textMuted } }, t("tq_adkhl_alrmz"))),
            React.createElement("div", { className: "rounded-2xl border-2 border-dashed p-4 mb-3", style: { backgroundColor: colors.card, borderColor: colors.primary } },
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} justify-between items-start mb-3` },
                    React.createElement("div", null,
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } },
                            t("tq_taqa_"),
                            token.company,
                            " \u00B7 ",
                            token.fuelType),
                        React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } },
                            t("tq_salh_72"),
                            token.expiresLabel)),
                    React.createElement("div", { className: "rounded-full px-2 py-0.5 text-[9px] font-bold", style: { backgroundColor: "#E8F5E9", color: "#1B7A43" } }, t("tq_nsht"))),
                React.createElement("div", { className: "rounded-xl py-3 mb-3 text-center", style: { backgroundColor: "#F0F4FF" } },
                    React.createElement("div", { className: "text-[10px] mb-1", style: { color: colors.textMuted } }, t("tq_rmz_alwqwd")),
                    React.createElement("div", { className: "font-black text-2xl tracking-widest", style: { color: "#1A1A2E", fontFamily: "monospace" } }, token.token),
                    React.createElement("button", { onClick: handleCopy, className: "mt-1 text-[10px] font-bold", style: { color: colors.primary } }, copied ? t("tq_tm_alnskh") : t("tq_anskh"))),
                React.createElement("div", { className: "flex justify-center mb-1", ref: qrRef }),
                React.createElement("div", { className: "text-center text-[10px] mb-3", style: { color: colors.textMuted } }, t("tq_amsh_qr")),
                [
                    { label: t("tq_alshrka"), val: token.company },
                    { label: t("tq_almblgh"), val: `${(token.amount || 0).toLocaleString(wLoc())} جنيه` },
                    { label: t("tq_alkmya"), val: `~${token.liters} لتر` },
                    { label: t("tq_nwa_alwqwd"), val: React.createElement("span", { className: "rounded-full px-2 py-0.5 text-[9px] font-bold", style: { backgroundColor: fuelTagStyle.bg, color: fuelTagStyle.color } }, token.fuelType) },
                    { label: t("tq_rsyd_mtbqy"), val: React.createElement("span", { style: { color: colors.primary } }, token.refundOn ? t("tq_mfaal") : t("tq_mattl")) },
                ].map((row, i) => (React.createElement("div", { key: i, className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} justify-between py-1.5 border-b`, style: { borderColor: i === 4 ? "transparent" : colors.border } },
                    React.createElement("span", { className: "text-[11px]", style: { color: colors.textMuted } }, row.label),
                    React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, row.val)))),
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} gap-2 mt-3` }, [
                    { label: "SMS", emoji: "💬", bg: "#F0F4FF", color: "#0F3460", border: "#C5D5F5" },
                    { label: t("tq_watsab"), emoji: "📱", bg: "#E8F5E1", color: "#1B5E20", border: "#A5D6A7" },
                    { label: t("tq_nskh"), emoji: "📋", bg: "#FFF3E0", color: "#E65100", border: "#FFCC80", action: handleCopy },
                ].map((btn) => (React.createElement("button", { key: btn.label, onClick: btn.action || undefined, className: "flex-1 rounded-xl py-2 flex flex-col items-center gap-1 border text-[10px] font-bold", style: { backgroundColor: btn.bg, color: btn.color, borderColor: btn.border } },
                    React.createElement("span", { className: "text-base" }, btn.emoji),
                    btn.label))))),
            token.refundOn && (React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} gap-2 rounded-xl p-3 mb-3 border-r-4`, style: { backgroundColor: "#FFF3E0", borderRightColor: "#F59E0B" } },
                React.createElement(RotateCcw, { size: 16, color: "#E65100", className: "flex-shrink-0 mt-0.5" }),
                React.createElement("p", { className: "text-[11px] leading-relaxed", style: { color: "#E65100" } },
                    React.createElement("span", { className: "font-bold" }, t("tq_rsyd_mfaal")),
                    t("tq_and_amtla")))),
            React.createElement("div", { className: "rounded-2xl p-3 mb-2", style: { backgroundColor: colors.card } },
                React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("tq_tryqa_alastkhdam")),
                [
                    t("tq_adhhb"),
                    t("tq_amsh_aw"),
                    t("tq_tabya"),
                ].map((step, i) => (React.createElement("div", { key: i, className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-2 mb-2 last:mb-0` },
                    React.createElement("div", { className: "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0", style: { backgroundColor: colors.primaryLight, color: colors.primary } }, i + 1),
                    React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, step))))),
            React.createElement("button", { onClick: onHistory, className: "w-full rounded-xl py-2.5 border text-xs font-bold", style: { borderColor: colors.border, color: colors.textMuted, backgroundColor: colors.card } }, t("tq_sjl_rmwz")))));
}
// ══════════════════════════════════════════════════════════════════════════
// طاقة — مكوّن سجل الرموز
// ══════════════════════════════════════════════════════════════════════════
function TaqaHistoryScreen({ colors, onBack, onSelect }) {
    const MOCK_HISTORY = [
        { token: "4729-8316", company: t("tq_nayl"), fuelType: t("tq_bnzyn"), fuelTag: "benzin", amount: 5000, liters: 20, status: "active", statusLabel: t("tq_nsht"), statusColor: "#1B7A43", ico: "⛽", icoBg: "#E8F5E9", refundOn: true, qrData: "TAQA-47298316-NILEOIL-BENZIN-5000SDG", expiresLabel: t("tq_aljma"), createdAt: Date.now() - 3600000 },
        { token: "8812-4407", company: t("tq_nayl"), fuelType: t("tq_bnzyn"), fuelTag: "benzin", amount: 1200, liters: 5, status: "refund", statusLabel: t("tq_rsyd_mtbqy_em"), statusColor: "#E65100", ico: "🔄", icoBg: "#FFF3E0", refundOn: false, qrData: "TAQA-88124407-NILEOIL-BENZIN-1200SDG", expiresLabel: t("tq_alsbt"), createdAt: Date.now() - 86400000 },
        { token: "3351-9920", company: t("tq_shl"), fuelType: t("tq_dyzl"), fuelTag: "diesel", amount: 10000, liters: 50, status: "used", statusLabel: t("tq_mstkhdm_balkaml"), statusColor: "#9AA0AB", ico: "⛽", icoBg: "#FCE4EC", refundOn: false, qrData: "TAQA-33519920-SHELL-DIESEL-10000SDG", expiresLabel: t("tq_mnthy"), createdAt: Date.now() - 345600000 },
        { token: "2244-7731", company: t("tq_twtal"), fuelType: t("tq_bnzyn"), fuelTag: "benzin", amount: 2500, liters: 10, status: "sent", statusLabel: t("tq_arsl_l"), statusColor: "#1565C0", ico: "📤", icoBg: "#E3F2FD", refundOn: false, qrData: "TAQA-22447731-TOTAL-BENZIN-2500SDG", expiresLabel: t("tq_mnthy"), createdAt: Date.now() - 604800000 },
    ];
    const [filter, setFilter] = useState("all");
    const [spendLimit, setSpendLimit] = useState(20000);
    const [editingLimit, setEditingLimit] = useState(false);
    const [limitInput, setLimitInput] = useState("20000");
    const FILTERS = [
        { id: "all", label: t("tq_alkl") },
        { id: "active", label: t("tq_nsht_2") },
        { id: "used", label: t("tq_mstkhdm") },
    ];
    const filtered = filter === "all" ? MOCK_HISTORY
        : filter === "active" ? MOCK_HISTORY.filter(i => i.status === "active" || i.status === "refund")
            : MOCK_HISTORY.filter(i => i.status === "used" || i.status === "sent");
    const now = new Date();
    const thisMonth = MOCK_HISTORY.filter(i => {
        const d = new Date(i.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalSpent = thisMonth.reduce((s, i) => s + i.amount, 0);
    const tokenCount = thisMonth.length;
    const companyCounts = {};
    thisMonth.forEach(i => { companyCounts[i.company] = (companyCounts[i.company] || 0) + i.amount; });
    const topCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0];
    const pct = Math.min(100, Math.round((totalSpent / spendLimit) * 100));
    const barColor = pct >= 80 ? "#EF4444" : pct >= 60 ? "#F59E0B" : "#4CAF50";
    const WEEKS = [
        { label: t("tq_w4"), amount: 2500 },
        { label: t("tq_w3"), amount: 6200 },
        { label: t("tq_w2"), amount: 4800 },
        { label: t("tq_w1"), amount: 7400 },
    ];
    const maxWeek = Math.max(...WEEKS.map(w => w.amount));
    return (React.createElement("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } },
        React.createElement("div", { className: "mx-4 mt-3 mb-2 rounded-2xl overflow-hidden", style: { background: walletTone(false).grad } },
            React.createElement("div", { className: "px-4 pt-3 pb-3" },
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center justify-between mb-2` },
                    React.createElement("div", { className: "text-[10px] font-bold", style: { color: "rgba(255,255,255,0.6)" } }, t("tq_infaqk")),
                    editingLimit ? (React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-1` },
                        React.createElement("input", { type: "number", value: limitInput, onChange: e => setLimitInput(e.target.value), className: "w-20 text-xs text-center rounded-lg px-2 py-1 outline-none", style: { backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }, dir: "ltr" }),
                        React.createElement("button", { onClick: () => { setSpendLimit(parseInt(limitInput) || 20000); setEditingLimit(false); }, className: "text-[9px] font-bold px-2 py-1 rounded-lg", style: { backgroundColor: "#4CAF50", color: "#fff" } }, t("tq_hfz")),
                        React.createElement("button", { onClick: () => setEditingLimit(false), className: "text-[9px] px-1.5 py-1 rounded-lg", style: { backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" } }, "\u2715"))) : (React.createElement("button", { onClick: () => { setLimitInput(String(spendLimit)); setEditingLimit(true); }, className: "text-[9px] font-bold px-2 py-1 rounded-lg", style: { backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" } }, t("tq_dbt_alhd")))),
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} gap-2 mb-3` },
                    React.createElement("div", { className: "flex-1 rounded-xl p-2.5", style: { backgroundColor: "rgba(255,255,255,0.1)" } },
                        React.createElement("div", { className: "text-[9px] mb-0.5", style: { color: "rgba(255,255,255,0.55)" } }, t("tq_alinfaq")),
                        React.createElement("div", { className: "text-sm font-black text-white" }, totalSpent.toLocaleString(wLoc())),
                        React.createElement("div", { className: "text-[8px]", style: { color: "rgba(255,255,255,0.45)" } }, t("tq_jnyh"))),
                    React.createElement("div", { className: "flex-1 rounded-xl p-2.5", style: { backgroundColor: "rgba(255,255,255,0.1)" } },
                        React.createElement("div", { className: "text-[9px] mb-0.5", style: { color: "rgba(255,255,255,0.55)" } }, t("tq_alrmwz")),
                        React.createElement("div", { className: "text-sm font-black text-white" }, tokenCount),
                        React.createElement("div", { className: "text-[8px]", style: { color: "rgba(255,255,255,0.45)" } }, t("tq_rmz"))),
                    React.createElement("div", { className: "flex-1 rounded-xl p-2.5", style: { backgroundColor: "rgba(255,255,255,0.1)" } },
                        React.createElement("div", { className: "text-[9px] mb-0.5", style: { color: "rgba(255,255,255,0.55)" } }, t("tq_akthr_shrka")),
                        React.createElement("div", { className: "text-[10px] font-black text-white leading-tight" }, topCompany ? topCompany[0] : "—"),
                        React.createElement("div", { className: "text-[8px]", style: { color: "rgba(255,255,255,0.45)" } }, topCompany ? t("mblgh_jnyh", { amount: topCompany[1].toLocaleString(wLoc()) }) : ""))),
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} justify-between mb-1` },
                    React.createElement("span", { className: "text-[9px]", style: { color: "rgba(255,255,255,0.5)" } },
                        t("tq_alhd"),
                        spendLimit.toLocaleString(wLoc()),
                        t("tq_j_sfx")),
                    React.createElement("span", { className: "text-[9px] font-bold", style: { color: pct >= 80 ? "#F87171" : "rgba(255,255,255,0.8)" } },
                        pct,
                        "%")),
                React.createElement("div", { className: "h-1.5 rounded-full mb-3", style: { backgroundColor: "rgba(255,255,255,0.15)" } },
                    React.createElement("div", { className: "h-1.5 rounded-full", style: { width: `${pct}%`, backgroundColor: barColor } })),
                React.createElement("div", { className: "text-[9px] mb-2", style: { color: "rgba(255,255,255,0.5)" } }, t("tq_infaq_akhr")),
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-end gap-2`, style: { height: 76 } }, WEEKS.map((w, i) => {
                    const h = Math.max(4, Math.round((w.amount / maxWeek) * 44));
                    const isLatest = i === WEEKS.length - 1;
                    return (React.createElement("div", { key: i, className: "flex-1 flex flex-col items-center justify-end gap-1" },
                        React.createElement("div", { className: "text-[7px] font-bold", style: { color: isLatest ? "#fff" : "rgba(255,255,255,0.5)" } },
                            Math.round(w.amount / 1000),
                            "k"),
                        React.createElement("div", { className: "w-full rounded-t-md", style: { height: h, backgroundColor: isLatest ? "#EF4444" : "rgba(255,255,255,0.25)", minHeight: 4 } }),
                        React.createElement("div", { className: "text-[8px]", style: { color: isLatest ? "#fff" : "rgba(255,255,255,0.45)" } }, w.label)));
                })))),
        React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} gap-2 px-4 pt-1 pb-2` }, FILTERS.map(f => (React.createElement("button", { key: f.id, onClick: () => setFilter(f.id), className: "rounded-full px-4 py-1.5 text-xs font-bold border", style: {
                backgroundColor: filter === f.id ? "#1A1A2E" : colors.card,
                color: filter === f.id ? "#fff" : colors.textMuted,
                borderColor: filter === f.id ? "#1A1A2E" : colors.border,
            } }, f.label)))),
        React.createElement("div", { className: "px-4 pb-4" }, filtered.length === 0 ? (React.createElement("div", { className: "flex flex-col items-center py-12 gap-2" },
            React.createElement("span", { className: "text-3xl" }, "\u26FD"),
            React.createElement("span", { className: "text-sm", style: { color: colors.textMuted } }, t("tq_la_twjd_rmwz")))) : filtered.map((item, idx) => (React.createElement("button", { key: idx, onClick: () => onSelect(item), className: `w-full flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-3 rounded-2xl p-3 border mb-2 text-start`, style: { backgroundColor: colors.card, borderColor: colors.border } },
            React.createElement("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0", style: { backgroundColor: item.icoBg } }, item.ico),
            React.createElement("div", { className: "flex-1 min-w-0" },
                React.createElement("div", { className: "text-xs font-bold truncate", style: { color: colors.text } },
                    item.fuelType,
                    " \u2014 ",
                    item.company,
                    " #",
                    item.token.split("-")[0]),
                React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: item.statusColor } }, item.statusLabel)),
            React.createElement("div", { className: "text-right flex-shrink-0" },
                React.createElement("div", { className: "text-sm font-bold", style: { color: item.status === "used" || item.status === "sent" ? colors.textMuted : "#EF4444" } },
                    (item.amount).toLocaleString(wLoc()),
                    t("tq_j_sfx")),
                React.createElement("div", { className: "text-[9px] mt-0.5" },
                    React.createElement("span", { className: "rounded-full px-1.5 py-0.5 font-bold", style: { backgroundColor: item.fuelTag === "benzin" ? "#E3F2FD" : "#FCE4EC", color: item.fuelTag === "benzin" ? "#1565C0" : "#880E4F" } }, item.fuelType)))))))));
}
// ══════════════════════════════════════════════════════════════════════════
// TaqaScreen — الشاشة الرئيسية لخدمة الوقود بتبويب خاص (⛽ وقود | 🕒 سجلاتي)
// ══════════════════════════════════════════════════════════════════════════
function TaqaScreen({ balance, colors, onBack }) {
    const [tab, setTab] = useState("fuel"); // fuel | history
    const [subView, setSubView] = useState("home"); // home | companies | purchase | token
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [activeToken, setActiveToken] = useState({
        token: "4729-8316", company: t("tq_nayl"), fuelType: t("tq_bnzyn"), fuelTag: "benzin",
        amount: 5000, liters: 20, status: "active", refundOn: true,
        qrData: "TAQA-47298316-NILEOIL-BENZIN-5000SDG", expiresLabel: t("tq_aljma"),
        createdAt: Date.now() - 3600000,
    });
    const [currentToken, setCurrentToken] = useState(null);
    const TAQA_COMPANIES = [
        { id: "nile", name: t("tq_nayl"), code: "NILEOIL", priceB: 250, priceD: 200, bg: "#E8EAF6", color: "#1A237E", emoji: "🛢️" },
        { id: "agip", name: t("tq_ajyb"), code: "AGIP", priceB: 255, priceD: 205, bg: "#FFEBEE", color: "#B42318", emoji: "🔴" },
        { id: "shell", name: t("tq_shl"), code: "SHELL", priceB: 248, priceD: 198, bg: "#FFF3E0", color: "#E65100", emoji: "🐚", nearest: true },
        { id: "sudapet", name: t("tq_swdabyt"), code: "SUDAPET", priceB: 245, priceD: 195, bg: "#E8F5E9", color: "#1B5E20", emoji: "🇸🇩" },
        { id: "total", name: t("tq_twtal"), code: "TOTAL", priceB: 252, priceD: 202, bg: "#E3F2FD", color: "#0D47A1", emoji: "⭕" },
        { id: "caroil", name: t("tq_kar"), code: "CAROIL", priceB: 250, priceD: 200, bg: "#F3E5F5", color: "#4A148C", emoji: "🚗" },
    ];
    // ── شريط التنقل الخاص بالوقود ──
    function TaqaNavBar() {
        return (// ⚠️ اتجاه الشريط ثابت لا يتبع اللغة: خاصية dir على <html> تقلب المحور
                // أصلاً، فتبديل flex-direction بحسب اللغة يُلغي القلب ويُبقي الترتيب
                // الفيزيائي كما هو في اللغتين. الثابت المختار هو ما يُنتج ترتيب
                // العربية الحالي؛ والإنجليزية تصير مرآته تلقائياً.
                React.createElement("div", { className: "flex flex-row border-t", style: { backgroundColor: colors.card, borderColor: colors.border } }, [
            { id: "fuel", emoji: "⛽", label: t("tq_wqwd") },
            { id: "history", emoji: "🕒", label: t("tq_sjlaty") },
        ].map(t => {
            const active = tab === t.id;
            return (React.createElement("button", { key: t.id, onClick: () => { setTab(t.id); if (t.id === "fuel")
                    setSubView("home"); }, className: "flex-1 flex flex-col items-center gap-1 py-2.5" },
                React.createElement("span", { style: { fontSize: 20, lineHeight: 1 } }, t.emoji),
                React.createElement("span", { className: "text-[10px] font-bold", style: { color: active ? "#1A1A2E" : colors.textMuted } }, t.label),
                active && React.createElement("div", { className: "w-5 h-0.5 rounded-full", style: { backgroundColor: "#1A1A2E" } })));
        })));
    }
    // ── تاب الوقود: الشاشة الرئيسية ──
    if (tab === "fuel" && subView === "home") {
        const NEARBY_STATIONS = [
            { name: t("tq_mhta_alnyl"), company: t("tq_nayl"), dist: t("tq_300m"), coId: "nile", open: true },
            { name: t("tq_mhta_alkhrtwm"), company: t("tq_shl"), dist: t("tq_800m"), coId: "shell", open: true },
            { name: t("tq_mhta_almqrn"), company: t("tq_swdabyt"), dist: t("tq_12km"), coId: "sudapet", open: false },
        ];
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("wqwd"), onBack: onBack }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                activeToken ? (React.createElement("div", { className: "rounded-2xl border-2 border-dashed p-4 mb-4", style: { backgroundColor: colors.card, borderColor: "#1A1A2E" } },
                    React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} justify-between items-center mb-2` },
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, t("rmz_nsht")),
                        React.createElement("div", { className: "rounded-full px-2 py-0.5 text-[9px] font-bold", style: { backgroundColor: "#E8F5E9", color: "#1B7A43" } }, t("nsht_2"))),
                    React.createElement("div", { className: "text-2xl font-black tracking-widest text-center mb-1", style: { color: "#1A1A2E", fontFamily: "monospace" } }, activeToken.token),
                    React.createElement("div", { className: "text-center text-[10px] mb-3", style: { color: colors.textMuted } },
                        activeToken.company,
                        " \u00B7 ",
                        activeToken.fuelType,
                        " \u00B7 ",
                        activeToken.amount.toLocaleString(wLoc()),
                        t("tq_j_sfx")),
                    React.createElement("button", { onClick: () => { setCurrentToken(activeToken); setSubView("token"); }, className: "w-full rounded-xl py-2 text-xs font-bold text-white", style: { backgroundColor: "#1A1A2E" } }, t("ard_alrmz_qr")))) : (React.createElement("div", { className: "rounded-2xl border border-dashed p-6 mb-4 text-center", style: { borderColor: colors.border, backgroundColor: colors.card } },
                    React.createElement("div", { className: "text-3xl mb-2" }, "\u26FD"),
                    React.createElement("div", { className: "text-sm", style: { color: colors.textMuted } }, t("la_ywjd_rmz_wqwd")))),
                React.createElement("button", { onClick: () => setSubView("companies"), className: "w-full rounded-2xl py-4 font-bold text-base text-white mb-4", style: { backgroundColor: "#EF4444" } }, t("tq_shra_jdyd")),
                React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.text } }, t("wswl_sry_llshrkat")),
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} gap-2 overflow-x-auto pb-2 mb-4`, style: { scrollbarWidth: "none" } }, TAQA_COMPANIES.map(co => (React.createElement("button", { key: co.id, onClick: () => { setSelectedCompany(co); setSubView("purchase"); }, className: "flex flex-col items-center gap-1 flex-shrink-0 rounded-xl p-2 border", style: { backgroundColor: colors.card, borderColor: colors.border, minWidth: 62 } },
                    React.createElement("div", { className: "w-10 h-10 rounded-lg flex items-center justify-center text-xl", style: { backgroundColor: co.bg } }, co.emoji),
                    React.createElement("span", { className: "text-[9px] font-bold text-center leading-tight", style: { color: colors.text } }, co.name))))),
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center justify-between mb-2` },
                    React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, t("tq_mhtat_qryba")),
                    React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } }, t("tq_alkhrtwm"))),
                NEARBY_STATIONS.map((st, i) => {
                    const co = TAQA_COMPANIES.find(c => c.id === st.coId) || TAQA_COMPANIES[0];
                    return (React.createElement("button", { key: i, onClick: () => { setSelectedCompany(co); setSubView("purchase"); }, className: `w-full flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-3 rounded-2xl p-3 border mb-2 text-start`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                        React.createElement("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg", style: { backgroundColor: co.bg } }, co.emoji),
                        React.createElement("div", { className: "flex-1 min-w-0" },
                            React.createElement("div", { className: "text-xs font-bold truncate", style: { color: colors.text } }, st.name),
                            React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, st.company)),
                        React.createElement("div", { className: "flex flex-col items-end gap-1 flex-shrink-0" },
                            React.createElement("div", { className: "text-xs font-bold", style: { color: colors.primary } }, st.dist),
                            React.createElement("div", { className: "rounded-full px-1.5 py-0.5 text-[8px] font-bold", style: { backgroundColor: st.open ? "#E8F5E9" : "#FFF3E0", color: st.open ? "#1B7A43" : "#E65100" } }, st.open ? t("tq_mftwha") : t("tq_mghlqa")))));
                })),
            React.createElement(TaqaNavBar, null)));
    }
    // ── تاب الوقود: اختيار الشركة ──
    if (tab === "fuel" && subView === "companies") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("akhtr_shrka_alwqwd"), onBack: () => setSubView("home") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("div", { className: `flex ${isRTL() ? "flex-row" : "flex-row-reverse"} items-center gap-2 rounded-xl p-3 mb-4 border-r-4`, style: { backgroundColor: "#FDEEE4", borderRightColor: "#F59E0B" } },
                    React.createElement(Droplet, { size: 14, color: "#E65100" }),
                    React.createElement("p", { className: "text-xs leading-relaxed", style: { color: "#E65100" } },
                        t("tq_alasar"),
                        React.createElement("span", { className: "font-bold" }, t("tq_alwlaya")),
                        t("tq_alrmz_yhml"))),
                React.createElement("div", { className: "grid grid-cols-2 gap-3" }, TAQA_COMPANIES.map(co => (React.createElement("button", { key: co.id, onClick: () => { setSelectedCompany(co); setSubView("purchase"); }, className: "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center", style: { backgroundColor: colors.card, borderColor: colors.border } },
                    React.createElement("div", { className: "w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5", style: { backgroundColor: co.bg } },
                        React.createElement("span", { className: "text-2xl" }, co.emoji),
                        React.createElement("span", { className: "text-[8px] font-black", style: { color: co.color } }, co.code)),
                    React.createElement("div", { className: "font-bold text-sm", style: { color: colors.text } }, co.name),
                    React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                        t("tq_bnzyn_c"),
                        co.priceB,
                        t("tq_dyzl_c"),
                        co.priceD,
                        t("tq_j_ltr_sp")),
                    React.createElement("div", { className: `text-[9px] font-bold px-2 py-0.5 rounded-full ${co.nearest ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}` }, co.nearest ? t("tq_alaqrb") : t("tq_mtaha"))))))),
            React.createElement(TaqaNavBar, null)));
    }
    // ── تاب الوقود: شاشة الشراء ──
    if (tab === "fuel" && subView === "purchase") {
        const co = selectedCompany || TAQA_COMPANIES[0];
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TaqaPurchaseScreen, { company: co, walletBalance: balance, colors: colors, onBack: () => setSubView("companies"), onBuy: (tok) => { setCurrentToken(tok); setActiveToken(tok); setSubView("token"); } }),
            React.createElement(TaqaNavBar, null)));
    }
    // ── تاب الوقود: شاشة الرمز + QR ──
    if (tab === "fuel" && subView === "token") {
        const tok = currentToken || activeToken || {};
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TaqaTokenScreen, { token: tok, colors: colors, onBack: () => setSubView("home"), onHistory: () => setTab("history") }),
            React.createElement(TaqaNavBar, null)));
    }
    // ── تاب السجل ──
    if (tab === "history") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("sjl_alwqwd"), onBack: onBack }),
            React.createElement(TaqaHistoryScreen, { colors: colors, onBack: onBack, onSelect: (tok) => { setCurrentToken(tok); setTab("fuel"); setSubView("token"); } }),
            React.createElement(TaqaNavBar, null)));
    }
    return null;
}
// ── شريط التنقل السفلي المشترك للمحفظة ──
function WalletNavBar({ navTab, setNavTab, colors }) {
    const TABS = [
        { id: "home", Icon: Wallet, label: t("almhfza") },
        { id: "history", Icon: Clock, label: t("alhrkat") },
        { id: "services", Icon: Grid3x3, label: t("alkhdmat") },
        { id: "settings", Icon: SettingsIcon, label: t("aliadadat") },
    ];
    return (// ⚠️ اتجاه الشريط ثابت لا يتبع اللغة: خاصية dir على <html> تقلب المحور
                // أصلاً، فتبديل flex-direction بحسب اللغة يُلغي القلب ويُبقي الترتيب
                // الفيزيائي كما هو في اللغتين. الثابت المختار هو ما يُنتج ترتيب
                // العربية الحالي؛ والإنجليزية تصير مرآته تلقائياً.
                React.createElement("div", { className: "flex flex-row border-t", style: { backgroundColor: colors.card, borderColor: colors.border } }, TABS.map((tab) => {
        const active = navTab === tab.id;
        return (React.createElement("button", { key: tab.id, onClick: () => setNavTab(tab.id), className: "flex-1 flex flex-col items-center py-2.5" },
            React.createElement(tab.Icon, { size: 20, color: active ? colors.primary : colors.textMuted }),
            React.createElement("span", { className: "text-[10px] mt-1", style: { color: active ? colors.primary : colors.textMuted, fontWeight: active ? 700 : 400 } }, tab.label),
            active && React.createElement("div", { className: "w-1 h-1 rounded-full mt-0.5", style: { backgroundColor: colors.primary } })));
    })));
}
// خدمات المحفظة — شاشة رئيسية بعمودين
// كل خدمة: id، label، desc، Icon (مكوّن Lucide)، bgColor، iconColor، onPress
const buildWalletServices = (colors, setView) => [
    {
        id: "electricity",
        label: t("w_alkhrba"),
        desc: t("w_hyya_alkhrba"),
        Icon: Zap,
        bgColor: "#FFF3CD",
        iconColor: "#B8720A",
        onPress: () => setView("electricityBill"),
    },
    {
        id: "telecom",
        label: t("w_atsalat"),
        desc: t("w_shhn_fatwra"),
        Icon: Smartphone,
        bgColor: "#E3F3EA",
        iconColor: "#1B7A43",
        onPress: () => setView("telecomServices"),
    },
    {
        id: "transfer",
        label: t("w_irsal_mal"),
        desc: t("w_thwyl_lay_shkhs"),
        Icon: Send,
        bgColor: "#E3F3EA",
        iconColor: "#1B7A43",
        onPress: () => setView("transfer"),
    },
    {
        id: "topup",
        label: t("w_tghdhya"),
        desc: t("w_btaqa_bnkya"),
        Icon: CreditCard,
        bgColor: "#EEF2FF",
        iconColor: "#534AB7",
        onPress: () => setView("topup"),
    },
    {
        id: "jamiya",
        label: t("w_aljmya"),
        desc: t("w_idkhar_jmay"),
        Icon: Users,
        bgColor: "#FBE9E7",
        iconColor: "#B42318",
        onPress: () => setView("jamiya"),
    },
    {
        id: "scanpay",
        label: t("w_msh_wdfa"),
        desc: t("w_adfa_b_qr"),
        Icon: QrCode,
        bgColor: "#F0F7FF",
        iconColor: colors.primary,
        onPress: () => setView("scanPay"),
    },
    {
        id: "taqa",
        label: t("w_wqwd"),
        desc: t("w_shra_wqwd"),
        Icon: Droplet,
        bgColor: "#FCE4EC",
        iconColor: "#B42318",
        isNew: true,
        onPress: () => setView("taqaCompanies"),
    },
];
function walletMaskCard(num) {
    const digits = (num || "").replace(/\D/g, "");
    const last4 = digits.slice(-4) || "0000";
    return `•••• •••• •••• ${last4}`;
}
// C221: مبلغٌ بإشارته — الإشارة يسار الأرقام دائماً (عزلٌ ثنائيّ الاتّجاه؛ كانت «3,000-» في العربيّة) والعملة بعده بخطٍّ أصغر
function walletAmt(sign, n, cur) {
    return React.createElement("span", { className: "inline-flex items-baseline gap-1 whitespace-nowrap" },
        React.createElement("span", { dir: "ltr", style: { unicodeBidi: "isolate" } }, (sign || "") + Number(n || 0).toLocaleString(wLoc())),
        cur !== false && React.createElement("span", { className: "text-[10px] font-bold", style: { opacity: 0.75 } }, tl("ج.س", "SDG")));
}
// C221: «منذ ساعتين» بدل «منذ 2 س» — كلماتٌ عربيّة بالعدد الصحيح، وأرقامٌ بلغة الواجهة (كانت لاتينيّة بجانب مبالغ عربيّة)
function walletAgoAr(n, one, two, few, many) { const d = n.toLocaleString(wLoc()); return n === 1 ? "منذ " + one : n === 2 ? "منذ " + two : n <= 10 ? "منذ " + d + " " + few : "منذ " + d + " " + many; }
function walletTimeAgo(ts) {
    const mins0 = Math.floor((Date.now() - ts) / 60000);
    if (isRTL()) {
        if (mins0 < 1) return "الآن";
        if (mins0 < 60) return walletAgoAr(mins0, "دقيقة", "دقيقتين", "دقائق", "دقيقة");
        const h0 = Math.floor(mins0 / 60);
        if (h0 < 24) return walletAgoAr(h0, "ساعة", "ساعتين", "ساعات", "ساعة");
        const d0 = Math.floor(h0 / 24);
        return d0 === 1 ? "أمس" : walletAgoAr(d0, "يوم", "يومين", "أيّام", "يوماً");
    }
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1)
        return t("wqt_alan");
    if (mins < 60)
        return t("mndh_d", { mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return t("mndh_s", { hours });
    const days = Math.floor(hours / 24);
    if (days === 1)
        return t("wqt_ams");
    return t("mndh_ayam", { days });
}
// ============================================================================
// قفل المحفظة — منفصل تماماً عن قفل التطبيق (نفس فصل الاهتمامات الموثّق
// رسمياً: قفل التطبيق يفتح كل الواجهة، قفل المحفظة أمان إضافي طبقة ثانية).
// WebAuthn هنا حقيقي 100% — استدعاء API المتصفح الفعلي
// (navigator.credentials.create/get)، مو محاكاة بزر وهمي.
// ============================================================================
async function registerWalletPasskey() {
    if (!window.PublicKeyCredential)
        return { ok: false, error: t("w_la_ydam_webauthn") };
    try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = crypto.getRandomValues(new Uint8Array(16));
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge,
                rp: { name: t("w_swa_almhfza") },
                user: { id: userId, name: "wallet-owner", displayName: t("w_shb_almhfza") },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                authenticatorSelection: { userVerification: "preferred" },
                timeout: 60000,
            },
        });
        return { ok: !!credential, credentialId: (credential === null || credential === void 0 ? void 0 : credential.id) || null };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
}
async function authenticateWalletPasskey(credentialId) {
    if (!window.PublicKeyCredential)
        return { ok: false, error: t("w_la_ydam_webauthn") };
    try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                allowCredentials: credentialId ? [{ id: Uint8Array.from(atob(credentialId.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)), type: "public-key" }] : [],
                userVerification: "preferred",
                timeout: 60000,
            },
        });
        return { ok: !!assertion };
    }
    catch (err) {
        return { ok: false, error: err.message };
    }
}
function SelfieCapture({ onCaptured }) {
    const { colors } = useTheme();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [status, setStatus] = useState("idle"); // idle | requesting | streaming | error | captured
    const [errorMsg, setErrorMsg] = useState("");
    const [capturedUrl, setCapturedUrl] = useState(null);
    async function startCamera() {
        setStatus("requesting");
        setErrorMsg("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setStatus("streaming");
        }
        catch (err) {
            setErrorMsg(err.name === "NotAllowedError" ? t("w_rfd_alkamyra") : t("tadhr_tshghyl_alkamyra", { message: err.message }));
            setStatus("error");
        }
    }
    function capture() {
        var _a;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas)
            return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        setCapturedUrl(dataUrl);
        setStatus("captured");
        (_a = streamRef.current) === null || _a === void 0 ? void 0 : _a.getTracks().forEach((t) => t.stop());
        onCaptured(dataUrl);
    }
    function retake() {
        setCapturedUrl(null);
        setStatus("idle");
        if (onCaptured) onCaptured(null);   // C223: إعادة الالتقاط تُبطل الصورة السابقة عند الأب
    }
    useEffect(() => () => { var _a; return (_a = streamRef.current) === null || _a === void 0 ? void 0 : _a.getTracks().forEach((t) => t.stop()); }, []);
    return (React.createElement("div", { className: "flex flex-col items-center" },
        React.createElement("div", { className: "w-40 h-40 rounded-full overflow-hidden border-2 flex items-center justify-center mb-3", style: { borderColor: colors.primary, backgroundColor: colors.bg } },
            status === "captured" && capturedUrl ? (React.createElement("img", { src: capturedUrl, alt: t("sylfy"), className: "w-full h-full object-cover" })) : (React.createElement("video", { ref: videoRef, className: "w-full h-full object-cover", style: { display: status === "streaming" ? "block" : "none", transform: "scaleX(-1)" }, muted: true, playsInline: true })),
            status === "idle" && React.createElement(UserCircle, { size: 48, color: colors.textMuted })),
        React.createElement("canvas", { ref: canvasRef, className: "hidden" }),
        status === "idle" && React.createElement(Button, { icon: Camera, label: t("fal_alkamyra"), onPress: startCamera, style: { width: 220 } }),
        status === "requesting" && React.createElement("p", { className: "text-xs", style: { color: colors.textMuted } }, t("bantzar_idhn_alkamyra")),
        status === "streaming" && React.createElement(Button, { icon: Camera, label: t("altqt_alswra"), onPress: capture, style: { width: 220 } }),
        status === "captured" && React.createElement("button", { onClick: retake, className: "text-xs font-bold underline", style: { color: colors.primary } }, t("iaada_alaltqat")),
        status === "error" && (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "text-xs font-bold text-center mb-2", style: { color: colors.danger } }, errorMsg),
            React.createElement(Button, { label: t("hawl_mra_thanya"), onPress: startCamera, variant: "outline", style: { width: 220 } })))));
}
// ============================================================================
// C223: توثيق الهويّة — نوع المستند · الوجهان · معاينة وإعادة التقاط · فحص جودةٍ تلقائيّ في الهاتف · مراجعة وموافقة
// الصور لا تغادر الهاتف (نسخةٌ تجريبيّة): تُفحص هنا وتُعرض للمراجعة ثمّ تُمحى بعد الإرسال، ويُحفظ وصفها فقط.
// ============================================================================
const KYC_DOCS = [
    { id: "nid", ar: "البطاقة القوميّة", en: "National ID card", sides: ["front", "back"] },
    { id: "passport", ar: "جواز السفر", en: "Passport", sides: ["data"] },
    { id: "license", ar: "رخصة القيادة", en: "Driving licence", sides: ["front", "back"] },
    { id: "residence", ar: "بطاقة الإقامة", en: "Residence permit", sides: ["front", "back"] },
];
const KYC_SIDE_TX = { front: ["الوجه الأماميّ", "Front"], back: ["الوجه الخلفيّ", "Back"], data: ["صفحة البيانات (التي فيها الصورة)", "Data page (with photo)"] };
// حدود الفحص — المستند: دقّةٌ تُقرأ بها الأحرف الصغيرة · الحجم: لا لقطةً مصغّرة ولا ملفّاً ضخماً
const KYC_LIMITS = { minLong: 1000, minShort: 600, minBytes: 30 * 1024, maxBytes: 10 * 1024 * 1024, dark: 60, bright: 215, blurErr: 15, blurWarn: 50 };
function kycLoadImage(src) {
    // ⚠️ لا new Image(): «Image» في التطبيق أيقونة Lucide (من window.__L) تحجب منشئ المتصفّح
    return new Promise((res, rej) => { const im = document.createElement("img"); im.onload = () => res(im); im.onerror = () => rej(new Error("decode")); im.src = src; });
}
// إضاءةٌ متوسّطة (0–255) ووضوحٌ (تباين لابلاسيان على صورةٍ مصغّرة بعرض 480) — مقياسان بسيطان يكشفان المظلمة والمهزوزة
function kycMeasure(im) {
    const W = Math.min(480, im.naturalWidth || im.width), H = Math.max(1, Math.round(W * (im.naturalHeight || im.height) / (im.naturalWidth || im.width)));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
    let sum = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; g[j] = v; sum += v; }
    let n = 0, m = 0, m2 = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const k = y * W + x, L = g[k - W] + g[k + W] + g[k - 1] + g[k + 1] - 4 * g[k];
        n++; m += L; m2 += L * L;
    }
    const mean = n ? m / n : 0;
    return { lum: Math.round(sum / (W * H)), sharp: n ? Math.round(m2 / n - mean * mean) : 0 };
}
// صورةٌ للمعاينة (أطول ضلع 1280، JPEG) — للعرض في الهاتف فقط
function kycPreview(im) {
    const s = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement("canvas"); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.85);
}
// يعيد { ok, url, w, h, lum, sharp, sig, issues:[{lvl:"err"|"warn", ar, en}] }
async function kycCheckFile(file, kind) {
    const issues = [];
    const add = (lvl, ar, en) => issues.push({ lvl, ar, en });
    if (!file || !/^image\//.test(file.type || "")) { add("err", "الملفّ ليس صورة — اختر صورة JPG أو PNG", "Not an image — choose a JPG or PNG"); return { ok: false, issues }; }
    if (file.size > KYC_LIMITS.maxBytes) add("err", "الصورة أكبر من 10 م.ب", "Image is larger than 10 MB");
    if (file.size < KYC_LIMITS.minBytes) add("err", "الصورة صغيرةٌ جدّاً — يبدو أنّها مصغّرة أو لقطة شاشة", "Image is too small — looks like a thumbnail or screenshot");
    const url0 = URL.createObjectURL(file);
    let im;
    try { im = await kycLoadImage(url0); }
    catch (e) { URL.revokeObjectURL(url0); add("err", "تعذّرت قراءة الصورة — استعمل JPG أو PNG", "Couldn't read the image — use JPG or PNG"); return { ok: false, issues }; }
    const w = im.naturalWidth, h = im.naturalHeight, lng = Math.max(w, h), sht = Math.min(w, h);
    if (kind === "doc" && (lng < KYC_LIMITS.minLong || sht < KYC_LIMITS.minShort)) add("err", "الدقّة منخفضة (" + w + "×" + h + ") — اقترب من المستند أو استعمل الكاميرا الخلفيّة", "Resolution too low (" + w + "×" + h + ") — move closer or use the rear camera");
    const ms = kycMeasure(im);
    if (ms.lum < KYC_LIMITS.dark) add("err", "الصورة مظلمة — صوّر في مكانٍ مضيء", "Too dark — take it in better light");
    else if (ms.lum > KYC_LIMITS.bright) add("err", "الصورة شديدة الإضاءة أو فيها انعكاس — أبعد الفلاش أو غيّر الزاوية", "Too bright or glare — avoid flash or change the angle");
    if (kind === "doc") {
        if (ms.sharp < KYC_LIMITS.blurErr) add("err", "الصورة مهزوزة وغير واضحة — ثبّت الهاتف وأعد الالتقاط", "Blurry — hold the phone steady and retake");
        else if (ms.sharp < KYC_LIMITS.blurWarn) add("warn", "الوضوح أقلّ من المطلوب — تأكّد أنّ الأحرف مقروءة", "Sharpness is low — make sure the text is readable");
        const r = lng / sht;
        if (r > 2.2) add("warn", "أبعاد غير معتادة — يجب أن يظهر المستند كاملاً بلا قصّ", "Unusual proportions — the whole document should be visible");
    }
    const url = kycPreview(im);
    URL.revokeObjectURL(url0);
    // بصمةٌ بسيطة لكشف رفع الصورة نفسها للوجهين
    const sig = file.size + ":" + w + "x" + h + ":" + ms.lum + ":" + ms.sharp;
    return { ok: !issues.some((x) => x.lvl === "err"), url, w, h, lum: ms.lum, sharp: ms.sharp, sig, issues };
}
async function kycCheckSelfie(dataUrl) {
    const issues = [];
    try {
        const im = await kycLoadImage(dataUrl), ms = kycMeasure(im);
        if (ms.lum < KYC_LIMITS.dark) issues.push({ lvl: "err", ar: "الصورة الشخصيّة مظلمة — قف قرب مصدر ضوء", en: "Selfie too dark — face a light source" });
        else if (ms.lum > KYC_LIMITS.bright) issues.push({ lvl: "err", ar: "الصورة الشخصيّة شديدة الإضاءة", en: "Selfie too bright" });
        return { ok: !issues.length, url: dataUrl, lum: ms.lum, issues };
    }
    catch (e) { return { ok: false, issues: [{ lvl: "err", ar: "تعذّرت قراءة الصورة الشخصيّة", en: "Couldn't read the selfie" }] }; }
}
function KycIssues({ res }) {
    const { colors } = useTheme();
    if (!res) return null;
    const list = res.issues || [];
    if (!list.length) return React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-2 text-[11px] font-bold`, style: { color: colors.success } }, React.createElement(CheckCircle2, { size: 13, color: colors.success }), tl("الصورة واضحة ومقبولة", "Clear and acceptable"));
    return React.createElement("div", { className: "mt-2 flex flex-col gap-1" }, list.map((x, i) => React.createElement("div", { key: i, className: `flex ${rowStart()} items-start gap-1.5 text-[11px] font-bold leading-snug ${textStart()}`, style: { color: x.lvl === "err" ? colors.danger : colors.accent } },
        React.createElement(x.lvl === "err" ? X : AlertTriangle, { size: 13, color: x.lvl === "err" ? colors.danger : colors.accent, className: "shrink-0 mt-0.5" }), tl(x.ar, x.en))));
}
function KycStepper({ step }) {
    const { colors } = useTheme();
    const S = [tl("المستند", "Document"), tl("الصور", "Photos"), tl("صورتك", "Selfie"), tl("المراجعة", "Review")];
    return React.createElement("div", { className: `flex ${rowStart()} items-center gap-1 mb-4` }, S.map((s, i) => {
        const n = i + 1, done = n < step, on = n === step;
        return React.createElement(React.Fragment, { key: n },
            React.createElement("div", { className: "flex flex-col items-center gap-1", style: { minWidth: 54 } },
                React.createElement("div", { className: "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold", style: { backgroundColor: done || on ? colors.primary : colors.card, color: done || on ? "#fff" : colors.textMuted, border: `1px solid ${done || on ? colors.primary : colors.border}` } },
                    done ? React.createElement(Check, { size: 13, color: "#fff" }) : n.toLocaleString(wLoc())),
                React.createElement("span", { className: "text-[10px] font-bold", style: { color: on ? colors.primary : colors.textMuted } }, s)),
            n < S.length && React.createElement("div", { className: "flex-1 h-0.5 rounded-full mb-4", style: { backgroundColor: done ? colors.primary : colors.border } }));
    }));
}
function KycFlowScreen({ kycStatus, kycMeta, onSubmit, onBack }) {
    const { colors } = useTheme();
    const [step, setStep] = useState(1);
    const [docType, setDocType] = useState(null);
    const [shots, setShots] = useState({});   // side -> نتيجة الفحص
    const [busy, setBusy] = useState(null);
    const [selfie, setSelfie] = useState(null);
    const [consent, setConsent] = useState(false);
    const [, tick] = useState(0);
    const camRef = useRef(null), galRef = useRef(null), sideRef = useRef(null);
    useEffect(() => { if (kycStatus !== "pending") return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [kycStatus]);
    const doc = KYC_DOCS.find((d) => d.id === docType) || null;
    const docLabel = (id) => { const d = KYC_DOCS.find((x) => x.id === id); return d ? tl(d.ar, d.en) : ""; };
    const shell = (body, back) => React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("twthyq_alhwya"), onBack: back || onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } }, body));
    if (kycStatus === "verified") {
        return shell(React.createElement("div", { className: "flex flex-col items-center text-center pt-10" },
            React.createElement("div", { className: "w-16 h-16 rounded-full flex items-center justify-center", style: { backgroundColor: colors.success + "1A" } }, React.createElement(ShieldCheck, { size: 34, color: colors.success })),
            React.createElement("h3", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, t("hsabk_mwthq")),
            kycMeta && React.createElement("p", { className: "text-xs mt-1", style: { color: colors.textMuted } }, docLabel(kycMeta.type) + " · " + new Date(kycMeta.at).toLocaleDateString(wLoc(), { day: "numeric", month: "long", year: "numeric" })),
            React.createElement("p", { className: "text-[11px] mt-3", style: { color: colors.textMuted } }, tl("نسخةٌ تجريبيّة: القبول محاكاة، ولم تُرسَل صورك إلى أيّ خادم.", "Demo: approval is simulated and your photos were not sent to any server."))));
    }
    if (kycStatus === "pending") {
        const el = kycMeta ? (Date.now() - kycMeta.at) / 1000 : 0;
        const T = [[tl("استُلم الطلب", "Request received"), 0], [tl("فحص المستندات", "Checking documents"), 1.5], [tl("مطابقة الصورة الشخصيّة", "Matching your selfie"), 3], [tl("القرار", "Decision"), 4.5]];
        return shell(React.createElement("div", null,
            React.createElement("div", { className: "flex flex-col items-center text-center pt-6 mb-5" },
                React.createElement(Clock, { size: 36, color: colors.accent }),
                React.createElement("h3", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, t("tlbk_qyd_almrajaa")),
                React.createElement("p", { className: "text-[11px] mt-1", style: { color: colors.textMuted } }, tl("مراجعة محاكاة في النسخة التجريبيّة", "Simulated review in this demo"))),
            React.createElement(Card, null, T.map((x, i) => {
                const done = el >= (T[i + 1] ? T[i + 1][1] : 99), on = !done && el >= x[1];
                return React.createElement("div", { key: i, className: `flex ${rowStart()} items-center gap-3 py-2` },
                    React.createElement("div", { className: "w-6 h-6 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: done ? colors.success : on ? colors.accent : colors.border } },
                        done ? React.createElement(Check, { size: 13, color: "#fff" }) : on ? React.createElement(Clock, { size: 12, color: "#fff" }) : null),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: done || on ? colors.text : colors.textMuted } }, x[0]));
            }))));
    }
    // ---------- الإدخال ----------
    const pick = (side, cam) => { sideRef.current = side; const r = cam ? camRef.current : galRef.current; if (r) { r.value = ""; r.click(); } };
    const onFile = async (e) => {
        const f = e.target.files && e.target.files[0], side = sideRef.current;
        if (!f || !side) return;
        setBusy(side);
        const res = await kycCheckFile(f, "doc");
        const other = Object.keys(shots).find((k) => k !== side && shots[k] && shots[k].sig && shots[k].sig === res.sig);
        if (other) { res.ok = false; res.issues = [{ lvl: "err", ar: "هذه الصورة نفسها مرفوعةٌ للوجه الآخر", en: "Same photo as the other side" }].concat(res.issues || []); }
        setShots((p) => ({ ...p, [side]: res })); setBusy(null);
    };
    const sidesOk = !!doc && doc.sides.every((s) => shots[s] && shots[s].ok);
    const fileInputs = [
        React.createElement("input", { key: "cam", ref: camRef, type: "file", accept: "image/*", capture: "environment", className: "hidden", onChange: onFile }),
        React.createElement("input", { key: "gal", ref: galRef, type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: onFile }),
    ];
    const privacy = React.createElement("div", { className: `flex ${rowStart()} items-start gap-2 rounded-xl border p-2.5 mb-3`, style: { borderColor: colors.border, backgroundColor: colors.card } },
        React.createElement(Lock, { size: 14, color: colors.textMuted, className: "shrink-0 mt-0.5" }),
        React.createElement("span", { className: `text-[11px] leading-snug ${textStart()}`, style: { color: colors.textMuted } }, tl("تُفحص صورك على هذا الهاتف ولا تُرسَل إلى أيّ خادم في هذه النسخة، وتُمحى بعد الإرسال للمراجعة.", "Your photos are checked on this phone, not sent to any server in this version, and erased after you submit.")));
    if (step === 1) {
        return shell(React.createElement("div", null,
            React.createElement(KycStepper, { step: 1 }),
            React.createElement("h3", { className: `text-sm font-extrabold mb-3 ${textStart()}`, style: { color: colors.text } }, tl("اختر المستند الذي ستوثّق به", "Choose the document you'll use")),
            KYC_DOCS.map((d) => React.createElement("button", { key: d.id, onClick: () => { setDocType(d.id); setShots({}); }, className: `w-full flex ${rowStart()} items-center gap-3 rounded-2xl border p-3 mb-2 ${textStart()}`, style: { backgroundColor: colors.card, borderColor: docType === d.id ? colors.primary : colors.border, borderWidth: docType === d.id ? 2 : 1 } },
                React.createElement("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style: { backgroundColor: colors.primaryLight } }, React.createElement(FileIconLucide, { size: 18, color: colors.primary })),
                React.createElement("div", { className: "flex-1 min-w-0" },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, tl(d.ar, d.en)),
                    React.createElement("div", { className: "text-[11px] mt-0.5", style: { color: colors.textMuted } }, d.sides.length === 2 ? tl("صورتان: الوجه الأماميّ والخلفيّ", "Two photos: front and back") : tl("صورةٌ واحدة: صفحة البيانات", "One photo: the data page"))),
                docType === d.id && React.createElement(CheckCircle2, { size: 18, color: colors.primary, className: "shrink-0" }))),
            React.createElement("div", { className: "h-2" }),
            privacy,
            React.createElement(Button, { label: tl("التالي", "Next"), disabled: !doc, onPress: () => setStep(2) })));
    }
    if (step === 2 && doc) {
        return shell(React.createElement("div", null,
            fileInputs,
            React.createElement(KycStepper, { step: 2 }),
            React.createElement("div", { className: `rounded-xl border p-3 mb-3 ${textStart()}`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                React.createElement("div", { className: "text-xs font-extrabold mb-1.5", style: { color: colors.text } }, tl("نصائح لصورةٍ مقبولة", "Tips for an accepted photo")),
                [tl("ضع المستند على سطحٍ داكن ومستوٍ", "Place it on a dark, flat surface"), tl("أظهر الحواف الأربع كاملةً بلا قصّ", "Show all four edges"), tl("صوّر في ضوءٍ جيّد بلا فلاش ولا انعكاس", "Good light, no flash or glare"), tl("ثبّت الهاتف حتّى تكون الأحرف مقروءة", "Hold steady so text is readable")].map((x, i) => React.createElement("div", { key: i, className: `flex ${rowStart()} items-center gap-1.5 text-[11px]`, style: { color: colors.textMuted } }, React.createElement(Check, { size: 11, color: colors.success, className: "shrink-0" }), x))),
            doc.sides.map((side) => {
                const r = shots[side];
                return React.createElement(Card, { key: side },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                        React.createElement("span", { className: "text-sm font-bold", style: { color: colors.text } }, tl(doc.ar, doc.en) + " — " + tl(KYC_SIDE_TX[side][0], KYC_SIDE_TX[side][1])),
                        r && React.createElement("span", { className: "text-[10px] font-extrabold px-2 py-0.5 rounded-full", style: { backgroundColor: (r.ok ? colors.success : colors.danger) + "1A", color: r.ok ? colors.success : colors.danger } }, r.ok ? tl("مقبولة", "Accepted") : tl("أعد الالتقاط", "Retake"))),
                    r && r.url && React.createElement("img", { src: r.url, alt: tl(KYC_SIDE_TX[side][0], KYC_SIDE_TX[side][1]), className: "w-full rounded-xl object-contain mb-1", style: { maxHeight: 180, backgroundColor: colors.bg } }),
                    busy === side && React.createElement("div", { className: "text-[11px] font-bold py-2", style: { color: colors.textMuted } }, tl("جارٍ فحص الصورة…", "Checking the photo…")),
                    React.createElement(KycIssues, { res: r }),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2 mt-3` },
                        React.createElement("button", { onClick: () => pick(side, true), className: "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold", style: { backgroundColor: colors.primary, color: "#fff" } }, React.createElement(Camera, { size: 14, color: "#fff" }), r ? tl("إعادة التقاط", "Retake") : tl("التقاط بالكاميرا", "Use camera")),
                        React.createElement("button", { onClick: () => pick(side, false), className: "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold border", style: { borderColor: colors.primary, color: colors.primary, backgroundColor: colors.card } }, React.createElement(Upload, { size: 14, color: colors.primary }), tl("من المعرض", "From gallery"))));
            }),
            React.createElement(Button, { label: tl("التالي", "Next"), disabled: !sidesOk, onPress: () => setStep(3) }),
            React.createElement("div", { className: "h-2" }),
            React.createElement(Button, { label: tl("رجوع", "Back"), variant: "outline", onPress: () => setStep(1) })), () => setStep(1));
    }
    if (step === 3) {
        return shell(React.createElement("div", null,
            React.createElement(KycStepper, { step: 3 }),
            React.createElement(Card, null,
                React.createElement("div", { className: `text-sm font-bold mb-1 ${textStart()}`, style: { color: colors.text } }, tl("صورةٌ شخصيّة حيّة", "A live selfie")),
                React.createElement("div", { className: `text-[11px] mb-3 ${textStart()}`, style: { color: colors.textMuted } }, tl("انظر إلى الكاميرا مباشرةً، بلا نظّارةٍ شمسيّة ولا غطاءٍ للوجه، في ضوءٍ جيّد.", "Look straight at the camera — no sunglasses or face covering, good light.")),
                React.createElement(SelfieCapture, { onCaptured: async (u) => { if (!u) { setSelfie(null); return; } setSelfie({ checking: true }); setSelfie(await kycCheckSelfie(u)); } }),
                selfie && !selfie.checking && React.createElement(KycIssues, { res: selfie })),
            React.createElement(Button, { label: tl("التالي", "Next"), disabled: !(selfie && selfie.ok), onPress: () => setStep(4) }),
            React.createElement("div", { className: "h-2" }),
            React.createElement(Button, { label: tl("رجوع", "Back"), variant: "outline", onPress: () => setStep(2) })), () => setStep(2));
    }
    if (step === 4 && doc) {
        const thumbs = doc.sides.map((s) => ({ k: s, url: shots[s] && shots[s].url, label: tl(KYC_SIDE_TX[s][0], KYC_SIDE_TX[s][1]) })).concat([{ k: "selfie", url: selfie && selfie.url, label: tl("الصورة الشخصيّة", "Selfie") }]);
        return shell(React.createElement("div", null,
            React.createElement(KycStepper, { step: 4 }),
            React.createElement(Card, null,
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-3` },
                    React.createElement("span", { className: "text-sm font-extrabold", style: { color: colors.text } }, tl(doc.ar, doc.en)),
                    React.createElement("button", { onClick: () => setStep(1), className: "text-[11px] font-bold", style: { color: colors.primary } }, tl("تغيير", "Change"))),
                React.createElement("div", { className: "grid grid-cols-3 gap-2" }, thumbs.map((x) => React.createElement("button", { key: x.k, onClick: () => setStep(x.k === "selfie" ? 3 : 2), className: "flex flex-col items-center gap-1" },
                    React.createElement("div", { className: "w-full rounded-xl overflow-hidden border", style: { aspectRatio: "1 / 1", borderColor: colors.border, backgroundColor: colors.bg } }, x.url && React.createElement("img", { src: x.url, alt: x.label, className: "w-full h-full object-cover" })),
                    React.createElement("span", { className: "text-[10px] font-bold text-center leading-tight", style: { color: colors.textMuted } }, x.label)))),
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mt-3 text-[11px] font-bold`, style: { color: colors.success } }, React.createElement(CheckCircle2, { size: 13, color: colors.success }), tl("اجتازت كلّ الصور فحص الجودة", "All photos passed the quality check"))),
            React.createElement("button", { onClick: () => setConsent((v) => !v), className: `w-full flex ${rowStart()} items-start gap-2.5 rounded-xl border p-3 mb-3 ${textStart()}`, style: { borderColor: consent ? colors.primary : colors.border, backgroundColor: colors.card } },
                React.createElement("div", { className: "w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5", style: { backgroundColor: consent ? colors.primary : "transparent", border: `1.5px solid ${consent ? colors.primary : colors.textMuted}` } }, consent && React.createElement(Check, { size: 13, color: "#fff" })),
                React.createElement("span", { className: "text-xs leading-snug", style: { color: colors.text } }, tl("أقرّ بأنّ هذه المستندات صحيحةٌ وتخصّني، وأوافق على استعمالها للتحقّق من هويّتي فقط.", "I confirm these documents are genuine and mine, and I agree to their use for identity verification only."))),
            privacy,
            React.createElement(Button, { label: t("irsal_llmrajaa"), disabled: !consent || !sidesOk || !(selfie && selfie.ok), onPress: () => {
                    const meta = { type: doc.id, sides: doc.sides.length, at: Date.now(), checks: doc.sides.map((s) => ({ side: s, w: shots[s].w, h: shots[s].h, lum: shots[s].lum, sharp: shots[s].sharp, warn: (shots[s].issues || []).length })) };
                    setShots({}); setSelfie(null);   // تُمحى الصور من الذاكرة — يبقى الوصف
                    onSubmit(meta);
                } }),
            React.createElement("div", { className: "h-2" }),
            React.createElement(Button, { label: tl("رجوع", "Back"), variant: "outline", onPress: () => setStep(3) })), () => setStep(3));
    }
    return shell(React.createElement("div", null));
}
// ============================================================================
// الجمعية الإلكترونية — نظام الادخار الجماعي الأسري
// ============================================================================
function JamiyaDetailScreen({ jamiya, currentUserId, onPay, onBack }) {
    var _a, _b, _c;
    const { colors } = useTheme();
    const now = new Date();
    const currentRound = jamiya.rounds.findIndex((r) => !r.paid);
    const myRoundIdx = jamiya.rounds.findIndex((r) => r.memberId === currentUserId);
    const myRound = jamiya.rounds[myRoundIdx];
    const currentMember = jamiya.members.find((m) => { var _a; return m.id === ((_a = jamiya.rounds[currentRound >= 0 ? currentRound : 0]) === null || _a === void 0 ? void 0 : _a.memberId); });
    const iMyTurnNow = currentRound >= 0 && ((_a = jamiya.rounds[currentRound]) === null || _a === void 0 ? void 0 : _a.memberId) === currentUserId;
    const didIPay = currentRound >= 0 ? (_c = (_b = jamiya.rounds[currentRound]) === null || _b === void 0 ? void 0 : _b.payments) === null || _c === void 0 ? void 0 : _c[currentUserId] : false;
    const totalPerRound = jamiya.amountPerMember * jamiya.members.length;
    const completedRounds = jamiya.rounds.filter((r) => r.paid).length;
    const monthNames = [t("w_m1"), t("w_m2"), t("w_m3"), t("w_m4"), t("w_m5"), t("w_m6"), t("w_m7"), t("w_m8"), t("w_m9"), t("w_m10"), t("w_m11"), t("w_m12")];
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: jamiya.name, onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: "p-4 pb-2" },
                React.createElement("div", { className: "rounded-2xl p-4", style: { background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})` } },
                    React.createElement("div", { className: "flex items-center justify-between mb-3" },
                        React.createElement("div", null,
                            React.createElement("div", { className: "text-xs font-bold", style: { color: "#ffffffaa" } }, t("w_almblgh_alkly")),
                            React.createElement("div", { className: "text-2xl font-extrabold text-white mt-0.5" },
                                totalPerRound.toLocaleString(wLoc()),
                                t("w_sdg_sp"))),
                        React.createElement("div", { className: "text-left" },
                            React.createElement("div", { className: "text-xs font-bold", style: { color: "#ffffffaa" } }, t("w_dwrk")),
                            React.createElement("div", { className: "text-sm font-extrabold text-white mt-0.5" }, myRoundIdx >= 0 ? `شهر ${myRoundIdx + 1}` : "—"))),
                    React.createElement("div", { className: "h-1.5 rounded-full mb-1", style: { backgroundColor: "rgba(255,255,255,0.2)" } },
                        React.createElement("div", { className: "h-1.5 rounded-full", style: { width: `${Math.round((completedRounds / jamiya.rounds.length) * 100)}%`, backgroundColor: "#fff" } })),
                    React.createElement("div", { className: "text-xs text-white/70" },
                        completedRounds,
                        t("w_mn_"),
                        jamiya.rounds.length,
                        t("w_dwra_mktmla")))),
            currentRound >= 0 && !didIPay && (React.createElement("div", { className: "px-4 mb-2" },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 rounded-xl p-3 border`, style: { backgroundColor: colors.card, borderColor: iMyTurnNow ? colors.success : colors.accent } },
                    React.createElement("div", { className: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", style: { backgroundColor: iMyTurnNow ? "#E3F3EA" : "#FFF3E0" } }, iMyTurnNow ? React.createElement(Crown, { size: 16, color: colors.success }) : React.createElement(AlertTriangle, { size: 16, color: colors.accent })),
                    React.createElement("div", { className: "flex-1" },
                        React.createElement("div", { className: "text-xs font-extrabold", style: { color: colors.text } }, iMyTurnNow ? t("w_dwrk_fy_astlam") : `موعد دفع حصتك — ${jamiya.amountPerMember.toLocaleString(wLoc())} ج.س`),
                        React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, iMyTurnNow ? `ستستلم ${totalPerRound.toLocaleString(wLoc())} ج.س بعد دفع الجميع` : t("w_adfa_alan_ldman"))),
                    !iMyTurnNow && (React.createElement("button", { onClick: () => onPay(jamiya.id, jamiya.amountPerMember), className: "rounded-xl px-3 py-2 flex-shrink-0", style: { backgroundColor: colors.primary } },
                        React.createElement("span", { className: "text-xs font-extrabold text-white" }, t("w_adfa"))))))),
            didIPay && currentRound >= 0 && (React.createElement("div", { className: "px-4 mb-2" },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-xl p-3`, style: { backgroundColor: "#E3F3EA", borderColor: colors.success } },
                    React.createElement(CheckCheck, { size: 16, color: colors.success }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.success } }, t("w_dfat_hstk"))))),
            React.createElement("div", { className: "px-4 mb-2" },
                React.createElement("div", { className: "text-sm font-extrabold mb-2", style: { color: colors.text } }, t("w_aljdwl_alzmny")),
                React.createElement("div", { className: "rounded-2xl overflow-hidden border", style: { borderColor: colors.border, backgroundColor: colors.card } }, jamiya.rounds.map((round, idx) => {
                    const member = jamiya.members.find((m) => m.id === round.memberId);
                    const isCurrentRound = idx === currentRound;
                    const isPast = round.paid;
                    const isMyRound = round.memberId === currentUserId;
                    return (React.createElement("div", { key: idx, className: `flex ${rowStart()} items-center gap-3 px-3 py-2.5`, style: {
                            borderBottom: idx < jamiya.rounds.length - 1 ? `0.5px solid ${colors.border}` : "none",
                            backgroundColor: isCurrentRound ? colors.primaryLight + "44" : "transparent",
                        } },
                        React.createElement("div", { className: "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", style: { backgroundColor: isPast ? "#E3F3EA" : isCurrentRound ? colors.primaryLight : colors.bg } }, isPast
                            ? React.createElement(Check, { size: 13, color: colors.success })
                            : isCurrentRound
                                ? React.createElement(Star, { size: 13, color: colors.primary })
                                : React.createElement("span", { className: "text-[10px] font-bold", style: { color: colors.textMuted } }, idx + 1)),
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("div", { className: "text-xs font-bold", style: { color: isMyRound ? colors.primary : colors.text } },
                                (member === null || member === void 0 ? void 0 : member.name) || "—",
                                isMyRound ? t("w_ant_qws") : ""),
                            React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                                t("w_shhr_"),
                                idx + 1)),
                        React.createElement("div", { className: "text-xs font-bold", style: { color: isPast ? colors.success : isCurrentRound ? colors.primary : colors.textMuted } }, isPast ? t("w_astlm") : isCurrentRound ? t("w_hdha_alshhr") : "")));
                }))),
            currentRound >= 0 && (React.createElement("div", { className: "px-4 pb-4" },
                React.createElement("div", { className: "text-sm font-extrabold mb-2", style: { color: colors.text } },
                    t("w_hala_alaada"),
                    currentRound + 1),
                React.createElement("div", { className: "rounded-2xl overflow-hidden border", style: { borderColor: colors.border, backgroundColor: colors.card } }, jamiya.members.map((member, idx) => {
                    var _a, _b, _c;
                    const paid = (_b = (_a = jamiya.rounds[currentRound]) === null || _a === void 0 ? void 0 : _a.payments) === null || _b === void 0 ? void 0 : _b[member.id];
                    const isMe = member.id === currentUserId;
                    const isWinner = ((_c = jamiya.rounds[currentRound]) === null || _c === void 0 ? void 0 : _c.memberId) === member.id;
                    return (React.createElement("div", { key: member.id, className: `flex ${rowStart()} items-center gap-3 px-3 py-2.5`, style: { borderBottom: idx < jamiya.members.length - 1 ? `0.5px solid ${colors.border}` : "none" } },
                        React.createElement("div", { className: "w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: paid ? colors.success : colors.border } }),
                        React.createElement("div", { className: "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold", style: { backgroundColor: colors.primaryLight, color: colors.primary } }, member.name.slice(0, 2)),
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } },
                                member.name,
                                isMe ? t("w_ant_qws") : "")),
                        isWinner && (React.createElement("div", { className: "rounded-full px-2 py-0.5 text-[10px] font-bold", style: { backgroundColor: colors.primaryLight, color: colors.primary } }, t("w_almstfyd"))),
                        !isWinner && (React.createElement("div", { className: "text-[11px] font-bold", style: { color: paid ? colors.success : colors.textMuted } }, paid ? t("w_dfa") : t("w_lm_ydfa")))));
                })))))));
}
function JamiyaScreen({ jamiyaList, currentUserId, walletBalance, onPay, onCreateJamiya, onBack }) {
    const { colors } = useTheme();
    const [view, setView] = useState("list"); // list | create | detail
    const [selectedJamiya, setSelectedJamiya] = useState(null);
    const [form, setForm] = useState({ name: "", amountPerMember: "", memberCount: "6" });
    const [formError, setFormError] = useState("");
    if (view === "detail" && selectedJamiya) {
        return (React.createElement(JamiyaDetailScreen, { jamiya: selectedJamiya, currentUserId: currentUserId, onPay: (jamiyaId, amount) => { onPay(jamiyaId, amount); setView("list"); }, onBack: () => setView("list") }));
    }
    if (view === "create") {
        const handleCreate = () => {
            if (!form.name.trim()) {
                setFormError(t("w_adkhl_asm_aljmya"));
                return;
            }
            const amt = Number(form.amountPerMember);
            if (!amt || amt < 100) {
                setFormError(t("w_almblgh_100"));
                return;
            }
            const cnt = Number(form.memberCount);
            if (!cnt || cnt < 2 || cnt > 20) {
                setFormError(t("w_adad_2_20"));
                return;
            }
            setFormError("");
            onCreateJamiya({ name: form.name.trim(), amountPerMember: amt, memberCount: cnt });
            setForm({ name: "", amountPerMember: "", memberCount: "6" });
            setView("list");
        };
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("w_jmya_jdyda"), onBack: () => setView("list") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("w_asm_aljmya")),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: form.name, onChange: (e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormError(""); }, placeholder: t("w_mthal_jmya"), className: "w-full border rounded-xl px-3 py-3 text-sm mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("w_hsa_kl_adw")),
                React.createElement("input", { dir: "ltr", value: form.amountPerMember, onChange: (e) => { setForm((f) => ({ ...f, amountPerMember: e.target.value.replace(/\D/g, "") })); setFormError(""); }, placeholder: t("w_mthal_5000"), inputMode: "numeric", className: "w-full border rounded-xl px-3 py-3 text-sm mb-3 text-center font-bold", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("w_adad_alaada")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` }, ["4", "6", "8", "10", "12"].map((n) => (React.createElement("button", { key: n, onClick: () => setForm((f) => ({ ...f, memberCount: n })), className: "flex-1 rounded-xl py-2 border text-sm font-bold", style: {
                        borderColor: form.memberCount === n ? colors.primary : colors.border,
                        backgroundColor: form.memberCount === n ? colors.primaryLight : colors.card,
                        color: form.memberCount === n ? colors.primary : colors.text,
                    } }, n)))),
                form.amountPerMember && Number(form.memberCount) > 0 && (React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-xl p-3 mb-3`, style: { backgroundColor: colors.primaryLight } },
                    React.createElement(Star, { size: 14, color: colors.primary }),
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } },
                        t("w_ijmaly_kl_dwra"),
                        (Number(form.amountPerMember) * Number(form.memberCount)).toLocaleString(wLoc()),
                        t("w_sdg_sp")))),
                formError ? React.createElement("div", { className: "text-xs font-bold mb-3 text-center", style: { color: colors.danger } }, formError) : null,
                React.createElement(Button, { label: t("w_insha_aljmya"), onPress: handleCreate }),
                React.createElement("div", { className: "text-[10px] text-center mt-3", style: { color: colors.textMuted } }, t("w_strsl_dawa")))));
    }
    // قائمة الجمعيات
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("w_aljmya_alilktrwnya"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            jamiyaList.length === 0 ? (React.createElement("div", { className: "flex flex-col items-center justify-center py-16 gap-3" },
                React.createElement("div", { className: "w-16 h-16 rounded-full flex items-center justify-center", style: { backgroundColor: colors.primaryLight } },
                    React.createElement(Users, { size: 32, color: colors.primary })),
                React.createElement("div", { className: "text-sm font-bold text-center", style: { color: colors.text } }, t("w_la_twjd_jmyat")),
                React.createElement("div", { className: "text-xs text-center px-6", style: { color: colors.textMuted } }, t("w_abda_jmya")))) : (jamiyaList.map((j) => {
                var _a, _b;
                const currentRound = j.rounds.findIndex((r) => !r.paid);
                const myRoundIdx = j.rounds.findIndex((r) => r.memberId === currentUserId);
                const completedRounds = j.rounds.filter((r) => r.paid).length;
                const totalPerRound = j.amountPerMember * j.members.length;
                const didIPay = currentRound >= 0 ? (_b = (_a = j.rounds[currentRound]) === null || _a === void 0 ? void 0 : _a.payments) === null || _b === void 0 ? void 0 : _b[currentUserId] : false;
                return (React.createElement("button", { key: j.id, onClick: () => { setSelectedJamiya(j); setView("detail"); }, className: `w-full ${textStart()} block mb-3` },
                    React.createElement("div", { className: "rounded-2xl border p-4", style: { backgroundColor: colors.card, borderColor: colors.border } },
                        React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                            React.createElement("span", { className: "text-sm font-extrabold", style: { color: colors.text } }, j.name),
                            !didIPay && currentRound >= 0 && (React.createElement("span", { className: "text-[10px] font-bold rounded-full px-2 py-0.5", style: { backgroundColor: "#FFF3CD", color: "#B8720A" } }, t("w_mwad_aldfa"))),
                            didIPay && (React.createElement("span", { className: "text-[10px] font-bold rounded-full px-2 py-0.5", style: { backgroundColor: "#E3F3EA", color: colors.success } }, t("w_dfat")))),
                        React.createElement("div", { className: `flex ${rowStart()} gap-3 text-[11px] mb-3`, style: { color: colors.textMuted } },
                            React.createElement("span", null,
                                j.members.length,
                                t("w_aada_sfx")),
                            React.createElement("span", null, "\u00B7"),
                            React.createElement("span", null,
                                j.amountPerMember.toLocaleString(wLoc()),
                                t("w_sdg_adw")),
                            React.createElement("span", null, "\u00B7"),
                            React.createElement("span", null,
                                t("w_dwrk_shhr"),
                                myRoundIdx + 1)),
                        React.createElement("div", { className: "h-1.5 rounded-full mb-1", style: { backgroundColor: colors.border } },
                            React.createElement("div", { className: "h-1.5 rounded-full", style: { width: `${Math.round((completedRounds / j.rounds.length) * 100)}%`, backgroundColor: colors.primary } })),
                        React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                            completedRounds,
                            t("w_mn_"),
                            j.rounds.length,
                            t("w_dwra_ijmaly"),
                            totalPerRound.toLocaleString(wLoc()),
                            t("w_sdg_sp")))));
            })),
            React.createElement("button", { onClick: () => setView("create"), className: "w-full rounded-2xl border-2 border-dashed py-4 flex flex-col items-center gap-1.5 mt-2", style: { borderColor: colors.primary } },
                React.createElement(Plus, { size: 20, color: colors.primary }),
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.primary } }, t("w_insha_jmya_jdyda"))))));
}
function PaymentMethodsScreen({ methods, onAddNew, onRemove, onBack }) {
    const { colors } = useTheme();
    const [confirmingId, setConfirmingId] = useState(null);
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("wsayl_aldfa"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } }, methods.length === 0 ? (React.createElement(React.Fragment, null,
            React.createElement("p", { className: "text-sm text-center mt-6 mb-4", style: { color: colors.textMuted } }, t("ma_rbtt_ay_wsyla")),
            React.createElement("button", { onClick: onAddNew, className: "w-full rounded-full border border-dashed py-3", style: { borderColor: colors.primary } },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.primary } }, t("rbt_wsyla_dfa_jdyda"))))) : (React.createElement(React.Fragment, null,
            methods.map((m) => (React.createElement(Card, { key: m.id, className: `flex ${rowStart()} items-center` },
                m.type === "card" ? React.createElement(CreditCard, { size: 20, color: colors.primary }) : React.createElement(Building2, { size: 20, color: colors.primary }),
                React.createElement("div", { className: `flex-1 ${textStart()} ${me("3")}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, m.type === "card" ? t("btaqa_tnthy_b", { last4: m.last4 }) : m.bankName),
                    React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, m.type === "card" ? m.cardholderName : t("ayban", { ibanMasked: m.ibanMasked }))),
                confirmingId === m.id ? (React.createElement("div", { className: `flex ${rowStart()} gap-1.5 shrink-0` },
                    React.createElement("button", { onClick: () => { onRemove(m.id); setConfirmingId(null); }, className: "rounded-xl px-2.5 py-1.5", style: { backgroundColor: colors.danger } },
                        React.createElement("span", { className: "text-[11px] font-bold text-white" }, t("takyd"))),
                    React.createElement("button", { onClick: () => setConfirmingId(null), className: "rounded-xl px-2.5 py-1.5 border", style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, t("ilgha"))))) : (React.createElement("button", { "aria-label": t("hdhf"), onClick: () => setConfirmingId(m.id), className: "shrink-0" },
                    React.createElement(Trash2, { size: 16, color: colors.danger })))))),
            React.createElement("button", { onClick: onAddNew, className: "w-full rounded-full border border-dashed py-3 mt-2", style: { borderColor: colors.primary } },
                React.createElement("span", { className: "text-sm font-bold", style: { color: colors.primary } }, t("rbt_wsyla_dfa_jdyda"))))))));
}
function LinkPaymentMethodScreen({ onChooseCard, onChooseBank, onBack }) {
    const { colors } = useTheme();
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("rbt_wsyla_dfa"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("p", { className: "text-xs mb-3", style: { color: colors.textMuted } }, t("akhtr_nwa_wsyla_aldfa")),
            React.createElement("button", { onClick: onChooseCard, className: `w-full flex ${rowStart()} items-center justify-between rounded-xl p-4 border mb-3`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement(CreditCard, { size: 22, color: colors.primary }),
                React.createElement("div", { className: `flex-1 ${textStart()} ${me("3")}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, t("btaqa_bnkya")),
                    React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, t("mda_fyza_mastrkard")))),
            React.createElement("button", { onClick: onChooseBank, className: `w-full flex ${rowStart()} items-center justify-between rounded-xl p-4 border`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement(Building2, { size: 22, color: colors.primary }),
                React.createElement("div", { className: `flex-1 ${textStart()} ${me("3")}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, t("hsab_bnky")),
                    React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, t("abr_rqm_alayban_iban")))))));
}
// تنسيق رقم البطاقة أثناء الكتابة — مجموعات من 4 أرقام، أساس المعاينة الحية
function formatCardNumberInput(value) {
    var _a;
    return ((_a = value.replace(/\D/g, "").slice(0, 16).match(/.{1,4}/g)) === null || _a === void 0 ? void 0 : _a.join(" ")) || "";
}
function formatExpiryInput(value) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}
function CardDetailsScreen({ onBack, onContinue }) {
    const { colors } = useTheme();
    const [cardNumber, setCardNumber] = useState("");
    const [cardName, setCardName] = useState("");
    const [expiry, setExpiry] = useState("");
    const digitsOnly = cardNumber.replace(/\s/g, "");
    const isValid = digitsOnly.length === 16 && cardName.trim().length > 1 && /^\d{2}\/\d{2}$/.test(expiry);
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("byanat_albtaqa"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("div", { className: "rounded-2xl p-5 mb-5", style: { background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})` } },
                React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-8` },
                    React.createElement("span", { className: "text-sm font-bold text-white" }, t("btaqa_swa")),
                    React.createElement(CreditCard, { size: 22, color: "#fff" })),
                React.createElement("div", { className: `text-lg font-bold tracking-widest text-white ${textStart()} mb-6`, dir: "ltr" }, cardNumber ? formatCardNumberInput(cardNumber).padEnd(19, "•").slice(0, 19) : "•••• •••• •••• ••••"),
                React.createElement("div", { className: `flex ${rowStart()} items-end justify-between` },
                    React.createElement("div", { className: `${textStart()}` },
                        React.createElement("div", { className: "text-[10px]", style: { color: "#ffffffaa" } }, t("tnthy_fy")),
                        React.createElement("div", { className: "text-sm font-bold text-white", dir: "ltr" }, expiry || "MM/YY")),
                    React.createElement("div", { className: `${textStart()}` },
                        React.createElement("div", { className: "text-[10px]", style: { color: "#ffffffaa" } }, t("sahb_albtaqa")),
                        React.createElement("div", { className: "text-sm font-bold text-white" }, cardName.trim() || t("w_alasm_ala_albtaqa"))))),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("rqm_albtaqa")),
            React.createElement("input", { value: formatCardNumberInput(cardNumber), onChange: (e) => setCardNumber(e.target.value), placeholder: "0000 0000 0000 0000", inputMode: "numeric", dir: "ltr", className: "w-full border rounded-xl px-3 py-3 text-sm mb-3 text-center tracking-widest", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` },
                React.createElement("div", { className: "flex-1" },
                    React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("alasm_ala_albtaqa")),
                    React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: cardName, onChange: (e) => setCardName(e.target.value), placeholder: t("kma_hw_mktwb_ala"), className: "w-full border rounded-xl px-3 py-3 text-sm", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } })),
                React.createElement("div", { className: "w-28" },
                    React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("tarykh_alantha")),
                    React.createElement("input", { value: expiry, onChange: (e) => setExpiry(formatExpiryInput(e.target.value)), placeholder: "MM/YY", dir: "ltr", className: "w-full border rounded-xl px-3 py-3 text-sm text-center", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }))),
            React.createElement(Button, { label: t("mtabaa_ila_althqq_mn"), disabled: !isValid, onPress: () => onContinue({ type: "card", last4: digitsOnly.slice(-4), cardholderName: cardName.trim().toUpperCase() }) }),
            React.createElement("p", { className: "text-[11px] text-center mt-3", style: { color: colors.textMuted } }, t("byanatk_mshfra_wln_tstkhdm")))));
}
function BankAccountDetailsScreen({ onBack, onContinue }) {
    const { colors } = useTheme();
    const [bank, setBank] = useState(WALLET_BANKS[0]);
    const [iban, setIban] = useState("");
    const isValid = iban.trim().length >= 10;
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("byanat_alhsab_albnky"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("asm_albnk")),
            React.createElement("select", { value: bank, onChange: (e) => setBank(e.target.value), className: "w-full border rounded-xl px-3 py-3 text-sm mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }, WALLET_BANKS.map((b) => React.createElement("option", { key: b, value: b }, b))),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("rqm_alayban_iban")),
            React.createElement("input", { value: iban, onChange: (e) => setIban(e.target.value.toUpperCase()), placeholder: "SD00 0000 0000 0000 0000 00", dir: "ltr", className: "w-full border rounded-xl px-3 py-3 text-sm mb-4 tracking-wide", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement(Button, { label: t("mtabaa_ila_althqq_mn"), disabled: !isValid, onPress: () => onContinue({ type: "bank", bankName: bank, ibanMasked: `••••${iban.trim().slice(-4)}` }) }),
            React.createElement("p", { className: "text-[11px] text-center mt-3", style: { color: colors.textMuted } }, t("byanatk_mshfra_wln_tstkhdm")))));
}
function ScanPayScreen({ onBack, onPay }) {
    const { colors } = useTheme();
    const [scannedMerchant, setScannedMerchant] = useState(null);
    const [amount, setAmount] = useState("");
    if (!scannedMerchant) {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("msh_wdfa"), onBack: onBack }),
            React.createElement("div", { className: "flex-1 flex flex-col items-center justify-center p-6", style: { backgroundColor: "#000" } },
                React.createElement("div", { className: "w-56 h-56 rounded-2xl border-2 border-dashed flex items-center justify-center mb-6", style: { borderColor: "#fff" } },
                    React.createElement(QrCode, { size: 64, color: "#fff" })),
                React.createElement("p", { className: "text-xs text-center mb-5", style: { color: "#fff" } }, t("wjh_alkamyra_nhw_rmz")),
                React.createElement(Button, { label: t("mhakaa_altqat_rmz_qr"), onPress: () => setScannedMerchant(WALLET_MERCHANTS[Math.floor(Math.random() * WALLET_MERCHANTS.length)]) }),
                React.createElement("p", { className: "text-[10px] text-center mt-3", style: { color: "#ffffffaa" } }, t("msh_alkamyra_alfaly_yhtaj")))));
    }
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("msh_wdfa"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement(Card, { className: `flex ${rowStart()} items-center mb-4` },
                React.createElement("span", { className: `text-2xl ${ms("2.5")}` }, scannedMerchant.icon),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, scannedMerchant.name),
                    React.createElement("div", { className: "text-[11px]", style: { color: colors.textMuted } }, t("tm_altarf_ala_rmz")))),
            React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("almblgh_j_s")),
            React.createElement("input", { dir: "ltr", value: amount, onChange: (e) => setAmount(e.target.value.replace(/\D/g, "")), placeholder: "0", inputMode: "numeric", className: "w-full border rounded-xl px-3 py-3 text-lg font-bold text-center mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement(Button, { label: `ادفع ${amount || 0} ج.س لـ${scannedMerchant.name}`, disabled: !amount || Number(amount) <= 0, onPress: () => onPay(scannedMerchant.name, Number(amount)) }),
            React.createElement("button", { onClick: () => setScannedMerchant(null), className: "w-full text-center mt-3" },
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, t("msh_rmz_akhr"))))));
}
// ============================================================================
// C220: التحويل الدوليّ — نموذجٌ تجريبيّ داخل «محفظة سوا» (لا أموال حقيقيّة)
// يظهر للمشرف والمدير والمالك فقط (useAdminAtLeast("moderator")) — مخفيٌّ عن المستخدمين ومراجعي المتاجر.
// الأسعار والرسوم والحالات كلّها ثابتةٌ للتجربة، ومعلَّمةٌ «تجريبيّ» في كلّ شاشة. الربط بمزوّدٍ مرخَّص لاحقاً يستبدل
// INTL_DEMO_* وonSend فقط (الشاشات والتحقّق تبقى).
// ============================================================================
const INTL_DEMO_COUNTRIES = [
    { code: "SA", flag: "🇸🇦", ar: "السعوديّة", en: "Saudi Arabia", cur: "SAR", rate: 160, methods: ["bank", "mobile"] },
    { code: "AE", flag: "🇦🇪", ar: "الإمارات", en: "UAE", cur: "AED", rate: 163, methods: ["bank", "mobile", "cash"] },
    { code: "QA", flag: "🇶🇦", ar: "قطر", en: "Qatar", cur: "QAR", rate: 165, methods: ["bank", "cash"] },
    { code: "EG", flag: "🇪🇬", ar: "مصر", en: "Egypt", cur: "EGP", rate: 12, methods: ["bank", "mobile", "cash"] },
    { code: "OM", flag: "🇴🇲", ar: "عُمان", en: "Oman", cur: "OMR", rate: 1560, methods: ["bank"] },
    { code: "KW", flag: "🇰🇼", ar: "الكويت", en: "Kuwait", cur: "KWD", rate: 1950, methods: ["bank"] },
    { code: "TR", flag: "🇹🇷", ar: "تركيا", en: "Türkiye", cur: "TRY", rate: 17, methods: ["bank", "cash"] },
    { code: "GB", flag: "🇬🇧", ar: "المملكة المتّحدة", en: "United Kingdom", cur: "GBP", rate: 760, methods: ["bank"] },
    { code: "DE", flag: "🇩🇪", ar: "ألمانيا", en: "Germany", cur: "EUR", rate: 650, methods: ["bank"] },
    { code: "US", flag: "🇺🇸", ar: "الولايات المتّحدة", en: "United States", cur: "USD", rate: 600, methods: ["bank"] },
];
const INTL_DEMO_FEE = { pct: 0.015, min: 2000 };   // 1.5٪ وحدّ أدنى 2,000 ج.س (تجريبيّ)
const INTL_DEMO_LIMITS = { min: 5000, max: 2000000 };   // لكلّ تحويل (تجريبيّ)
const INTL_METHODS = {
    bank: { ar: "حساب مصرفيّ", en: "Bank account", Icon: Landmark },
    mobile: { ar: "محفظة جوّال", en: "Mobile wallet", Icon: Smartphone },
    cash: { ar: "استلام نقديّ", en: "Cash pickup", Icon: Banknote },
};
const INTL_PURPOSES = [
    ["family", "إعالة الأسرة", "Family support"], ["education", "رسوم دراسيّة", "Education"], ["medical", "علاج", "Medical"],
    ["business", "تجارة", "Business"], ["other", "أخرى", "Other"],
];
function intlFee(amount) { return amount > 0 ? Math.max(INTL_DEMO_FEE.min, Math.round(amount * INTL_DEMO_FEE.pct)) : 0; }
function intlRecv(amount, rate) { return rate > 0 ? Math.floor((amount / rate) * 100) / 100 : 0; }
// الحالة محاكاةٌ بالزمن منذ الإرسال (للعرض فقط): قيد المراجعة ← أُرسل ← وصل
function intlStatus(rec, now) {
    const m = ((now || Date.now()) - (rec.ts || 0)) / 60000;
    return m < 1 ? "review" : m < 5 ? "sent" : "delivered";
}
const INTL_STATUS_TX = { review: ["قيد المراجعة", "Under review"], sent: ["أُرسل", "Sent"], delivered: ["وصل", "Delivered"] };
// التحقّق من حقول المستلم بحسب طريقة الاستلام — يعيد رسالة الخطأ الأولى أو null
function intlValidate(f) {
    if (!f.country) return tl("اختر الدولة", "Choose a country");
    if (!f.method) return tl("اختر طريقة الاستلام", "Choose how they receive it");
    const nm = String(f.name || "").trim();
    if (nm.split(/\s+/).filter(Boolean).length < 2 || nm.length < 5) return tl("اكتب اسم المستلم الكامل كما في هويّته", "Enter the recipient's full legal name");
    if (!/^\+?[0-9]{8,15}$/.test(String(f.phone || "").replace(/[\s-]/g, ""))) return tl("رقم هاتف المستلم غير صحيح (مع رمز الدولة)", "Invalid recipient phone (with country code)");
    if (f.method === "bank" && !/^[A-Za-z0-9]{8,34}$/.test(String(f.account || "").replace(/\s/g, ""))) return tl("رقم الحساب أو IBAN غير صحيح", "Invalid account number or IBAN");
    if (f.method === "cash" && String(f.city || "").trim().length < 2) return tl("اكتب مدينة الاستلام", "Enter the pickup city");
    if (!f.purpose) return tl("اختر الغرض من التحويل", "Choose the purpose");
    const a = Number(f.amount) || 0;
    if (a < INTL_DEMO_LIMITS.min) return tl("الحدّ الأدنى ", "Minimum ") + INTL_DEMO_LIMITS.min.toLocaleString(wLoc()) + tl(" ج.س", " SDG");
    if (a > INTL_DEMO_LIMITS.max) return tl("الحدّ الأعلى للتحويل الواحد ", "Maximum per transfer ") + INTL_DEMO_LIMITS.max.toLocaleString(wLoc()) + tl(" ج.س", " SDG");
    if (a + intlFee(a) > (Number(f.balance) || 0)) return tl("الرصيد لا يكفي للمبلغ والرسوم", "Balance doesn't cover amount + fee");
    return null;
}
function IntlDemoBanner() {
    const { colors } = useTheme();
    return React.createElement("div", { className: `flex ${rowStart()} items-start gap-2 rounded-xl border p-2.5 mb-3`, style: { borderColor: colors.accent, backgroundColor: colors.card } },
        React.createElement(Info, { size: 15, color: colors.accent, className: "shrink-0 mt-0.5" }),
        React.createElement("span", { className: `text-[11px] font-bold leading-snug ${textStart()}`, style: { color: colors.accent } },
            tl("نموذجٌ تجريبيّ — لا تُحوَّل أموالٌ حقيقيّة، والأسعار والرسوم ثابتةٌ للاختبار. ظاهرٌ للمشرف والمدير فقط.",
                "Demo only — no real money moves; rates and fees are fixed test values. Visible to moderators and admins only.")));
}
function IntlTransferScreen({ balance, walletPinForConfirm, kycStatus, history, onSend, onBack }) {
    const { colors } = useTheme();
    const [step, setStep] = useState("form");   // form | review | done | history
    const [f, setF] = useState({ country: "", method: "", name: "", phone: "", account: "", city: "", purpose: "", amount: "" });
    const [pin, setPin] = useState("");
    const [err, setErr] = useState(null);
    const [last, setLast] = useState(null);
    const [, tick] = useState(0);
    useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);   // تحديث الحالة المحاكاة
    const set = (k, v) => { setErr(null); setF((p) => ({ ...p, [k]: v })); };
    const ctry = INTL_DEMO_COUNTRIES.find((c) => c.code === f.country) || null;
    const amt = Number(f.amount) || 0, fee = intlFee(amt), total = amt + fee, recv = ctry ? intlRecv(amt, ctry.rate) : 0;
    const fmt = (n) => Number(n || 0).toLocaleString(wLoc());
    const inputCls = "w-full border rounded-xl px-3 py-3 text-sm mb-3";
    const inputSt = { borderColor: colors.border, color: colors.text, backgroundColor: colors.card };
    const label = (txt) => React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, txt);
    const row = (k, v, strong) => React.createElement("div", { className: `flex ${rowStart()} items-center justify-between gap-3 p-3 border-b`, style: { borderColor: colors.border } },
        React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, k),
        React.createElement("span", { className: `text-xs ${strong ? "font-extrabold" : "font-bold"} ${textStart()}`, style: { color: colors.text } }, v));
    const histBtn = React.createElement("button", { key: "h", onClick: () => setStep("history"), className: "text-xs font-bold px-3 py-1.5 rounded-full", style: { backgroundColor: colors.primaryLight, color: colors.primary } },
        tl("السجلّ", "History") + (history.length ? " (" + history.length + ")" : ""));
    if (step === "history") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: tl("التحويلات الدوليّة", "International transfers"), onBack: () => setStep("form") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement(IntlDemoBanner, null),
                !history.length && React.createElement("div", { className: "text-center text-xs py-10", style: { color: colors.textMuted } }, tl("لا تحويلات بعد", "No transfers yet")),
                history.map((r) => {
                    const st = intlStatus(r), c = INTL_DEMO_COUNTRIES.find((x) => x.code === r.country) || {};
                    const stColor = st === "delivered" ? colors.success : st === "sent" ? colors.primary : colors.accent;
                    return React.createElement(Card, { key: r.ref },
                        React.createElement("div", { className: `flex ${rowStart()} items-center justify-between gap-2` },
                            React.createElement("span", { className: `text-sm font-extrabold ${textStart()}`, style: { color: colors.text } }, (c.flag || "") + " " + r.name),
                            React.createElement("span", { className: "text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0", style: { backgroundColor: colors.bg, color: stColor } }, tl(INTL_STATUS_TX[st][0], INTL_STATUS_TX[st][1]))),
                        React.createElement("div", { className: `text-xs mt-1 ${textStart()}`, style: { color: colors.textMuted } },
                            fmt(r.amount) + tl(" ج.س ← ", " SDG → ") + fmt(r.recv) + " " + r.cur + " · " + tl(INTL_METHODS[r.method].ar, INTL_METHODS[r.method].en)),
                        React.createElement("div", { className: `text-[10px] mt-1 ${textStart()}`, style: { color: colors.textMuted }, dir: "ltr" },
                            r.ref + " · " + new Date(r.ts).toLocaleString(wLoc(), { day: "numeric", month: "short", hour: "numeric", minute: "numeric" })));
                }))));
    }
    if (step === "done" && last) {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: tl("تحويل دوليّ", "International transfer"), onBack }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement(IntlDemoBanner, null),
                React.createElement(Card, { className: "items-center flex flex-col py-6" },
                    React.createElement(CheckCircle2, { size: 44, color: colors.success }),
                    React.createElement("div", { className: "text-base font-extrabold mt-3", style: { color: colors.text } }, tl("أُرسل طلب التحويل (تجريبيّ)", "Transfer submitted (demo)")),
                    React.createElement("div", { className: "text-xs mt-1 text-center", style: { color: colors.textMuted } },
                        fmt(last.recv) + " " + last.cur + tl(" إلى ", " to ") + last.name),
                    React.createElement("div", { className: "text-xs font-bold mt-3 px-3 py-1.5 rounded-full", dir: "ltr", style: { backgroundColor: colors.bg, color: colors.text } }, last.ref)),
                React.createElement(Button, { label: tl("سجلّ التحويلات الدوليّة", "International transfer history"), onPress: () => setStep("history") }),
                React.createElement("div", { className: "h-2" }),
                React.createElement(Button, { label: tl("تحويلٌ جديد", "New transfer"), variant: "outline", onPress: () => { setF({ country: "", method: "", name: "", phone: "", account: "", city: "", purpose: "", amount: "" }); setPin(""); setStep("form"); } }))));
    }
    if (step === "review" && ctry) {
        const pinOk = !!walletPinForConfirm && pin === walletPinForConfirm;
        const m = INTL_METHODS[f.method];
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: tl("مراجعة التحويل", "Review transfer"), onBack: () => { setPin(""); setStep("form"); } }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement(IntlDemoBanner, null),
                React.createElement(Card, { className: "p-0 overflow-hidden" },
                    row(tl("المستلم", "Recipient"), f.name.trim(), true),
                    row(tl("الدولة", "Country"), ctry.flag + " " + tl(ctry.ar, ctry.en)),
                    row(tl("طريقة الاستلام", "Receive method"), tl(m.ar, m.en)),
                    f.method === "bank" && row(tl("الحساب / IBAN", "Account / IBAN"), React.createElement("span", { dir: "ltr" }, f.account.replace(/\s/g, "").toUpperCase())),
                    f.method === "cash" && row(tl("مدينة الاستلام", "Pickup city"), f.city.trim()),
                    row(tl("هاتف المستلم", "Recipient phone"), React.createElement("span", { dir: "ltr" }, f.phone.replace(/[\s-]/g, ""))),
                    row(tl("الغرض", "Purpose"), (() => { const p = INTL_PURPOSES.find((x) => x[0] === f.purpose); return p ? tl(p[1], p[2]) : ""; })()),
                    row(tl("المبلغ المُرسَل", "You send"), fmt(amt) + tl(" ج.س", " SDG")),
                    row(tl("الرسوم (تجريبيّة)", "Fee (demo)"), fmt(fee) + tl(" ج.س", " SDG")),
                    row(tl("سعر الصرف (تجريبيّ)", "Rate (demo)"), "\u2066" + "1 " + ctry.cur + "\u2069" + " = " + fmt(ctry.rate) + tl(" ج.س", " SDG")),   // عزلٌ ثنائيّ الاتّجاه: «1 SAR» لا ينقلب في العربيّة
                    row(tl("يُخصَم من رصيدك", "Total debited"), fmt(total) + tl(" ج.س", " SDG"), true),
                    row(tl("يستلم", "They receive"), fmt(recv) + " " + ctry.cur, true)),
                kycStatus !== "verified" && React.createElement("div", { className: `flex ${rowStart()} items-start gap-2 rounded-xl border p-2.5 mb-3`, style: { borderColor: colors.border, backgroundColor: colors.card } },
                    React.createElement(ShieldCheck, { size: 15, color: colors.textMuted, className: "shrink-0 mt-0.5" }),
                    React.createElement("span", { className: `text-[11px] leading-snug ${textStart()}`, style: { color: colors.textMuted } }, tl("في الإطلاق الحقيقيّ يُشترط توثيق الهويّة قبل أيّ تحويلٍ دوليّ.", "A real launch would require identity verification before any international transfer."))),
                label(tl("رمز المحفظة للتأكيد", "Wallet PIN to confirm")),
                !walletPinForConfirm
                    ? React.createElement("div", { className: "text-xs font-bold mb-3", style: { color: colors.danger } }, tl("عيّن رمز المحفظة أوّلاً من إعداداتها", "Set a wallet PIN first in wallet settings"))
                    : React.createElement("input", { dir: "ltr", value: pin, onChange: (e) => setPin(e.target.value.replace(/[^0-9]/g, "")), type: "password", inputMode: "numeric", maxLength: 6, placeholder: tl("رمز المحفظة", "Wallet PIN"), className: inputCls + " text-center tracking-widest", style: inputSt }),
                pin.length >= 4 && !pinOk && React.createElement("div", { className: "text-xs font-bold mb-3 text-center", style: { color: colors.danger } }, tl("رمز المحفظة غير صحيح", "Incorrect wallet PIN")),
                React.createElement(Button, { label: tl("تأكيد التحويل", "Confirm transfer"), disabled: !pinOk, onPress: () => {
                        const e = intlValidate({ ...f, balance });
                        if (e) { setErr(e); setStep("form"); return; }
                        const rec = { ref: "SW-INT-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(), ts: Date.now(),
                            country: ctry.code, cur: ctry.cur, rate: ctry.rate, method: f.method, name: f.name.trim(), phone: f.phone.replace(/[\s-]/g, ""),
                            account: f.method === "bank" ? f.account.replace(/\s/g, "").toUpperCase() : "", city: f.method === "cash" ? f.city.trim() : "",
                            purpose: f.purpose, amount: amt, fee, total, recv, demo: true };
                        onSend(rec); setLast(rec); setPin(""); setStep("done");
                    } }))));
    }
    // ---------- النموذج ----------
    const e0 = intlValidate({ ...f, balance });
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: tl("تحويل دوليّ", "International transfer"), onBack, actions: [histBtn] }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
            React.createElement(IntlDemoBanner, null),
            label(tl("إلى أيّ دولة؟", "To which country?")),
            React.createElement("div", { className: "grid grid-cols-2 gap-2 mb-3" }, INTL_DEMO_COUNTRIES.map((c) => React.createElement("button", { key: c.code, onClick: () => { set("country", c.code); if (f.method && c.methods.indexOf(f.method) < 0) set("method", ""); }, className: `flex ${rowStart()} items-center gap-2 rounded-xl border px-3 py-2.5 ${textStart()}`, style: { borderColor: f.country === c.code ? colors.primary : colors.border, borderWidth: f.country === c.code ? 2 : 1, backgroundColor: colors.card } },
                React.createElement("span", { className: "text-lg" }, c.flag),
                React.createElement("span", { className: "flex-1 min-w-0" },
                    React.createElement("span", { className: "block text-xs font-extrabold truncate", style: { color: colors.text } }, tl(c.ar, c.en)),
                    React.createElement("span", { className: "block text-[10px]", style: { color: colors.textMuted }, dir: "ltr" }, c.cur))))),
            ctry && label(tl("طريقة الاستلام", "How they receive it")),
            ctry && React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-3` }, ctry.methods.map((k) => { const m = INTL_METHODS[k]; const on = f.method === k; return React.createElement("button", { key: k, onClick: () => set("method", k), className: "flex-1 flex flex-col items-center gap-1 rounded-xl border py-2.5", style: { borderColor: on ? colors.primary : colors.border, borderWidth: on ? 2 : 1, backgroundColor: colors.card } },
                React.createElement(m.Icon, { size: 18, color: on ? colors.primary : colors.textMuted }),
                React.createElement("span", { className: "text-[11px] font-bold", style: { color: on ? colors.primary : colors.text } }, tl(m.ar, m.en))); })),
            ctry && f.method && React.createElement(React.Fragment, null,
                label(tl("اسم المستلم الكامل (كما في هويّته)", "Recipient's full legal name")),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: f.name, onChange: (e) => set("name", e.target.value), placeholder: tl("مثال: أحمد محمّد علي", "e.g. Ahmed Mohamed Ali"), className: inputCls, style: inputSt }),
                label(tl("هاتف المستلم (مع رمز الدولة)", "Recipient phone (with country code)")),
                React.createElement("input", { dir: "ltr", value: f.phone, onChange: (e) => set("phone", e.target.value.replace(/[^0-9+\s-]/g, "")), inputMode: "tel", placeholder: "+966 5X XXX XXXX", className: inputCls + " text-center font-bold", style: inputSt }),
                f.method === "bank" && label(tl("رقم الحساب أو IBAN", "Account number or IBAN")),
                f.method === "bank" && React.createElement("input", { dir: "ltr", value: f.account, onChange: (e) => set("account", e.target.value.replace(/[^0-9A-Za-z\s]/g, "")), placeholder: "SA00 0000 0000 0000 0000 0000", className: inputCls + " font-bold tracking-wider", style: inputSt }),
                f.method === "cash" && label(tl("مدينة الاستلام", "Pickup city")),
                f.method === "cash" && React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: f.city, onChange: (e) => set("city", e.target.value), className: inputCls, style: inputSt }),
                label(tl("الغرض من التحويل", "Purpose of transfer")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` }, INTL_PURPOSES.map((p) => React.createElement("button", { key: p[0], onClick: () => set("purpose", p[0]), className: "text-[11px] font-bold px-3 py-1.5 rounded-full border", style: { borderColor: f.purpose === p[0] ? colors.primary : colors.border, color: f.purpose === p[0] ? colors.primary : colors.text, backgroundColor: colors.card } }, tl(p[1], p[2])))),
                label(tl("المبلغ المُرسَل (ج.س)", "Amount you send (SDG)")),
                React.createElement("input", { dir: "ltr", value: f.amount, onChange: (e) => set("amount", e.target.value.replace(/[^0-9]/g, "")), inputMode: "numeric", placeholder: "0", className: inputCls + " text-lg font-bold text-center", style: inputSt }),
                amt > 0 && React.createElement(Card, { className: "p-0 overflow-hidden" },
                    row(tl("الرسوم (تجريبيّة)", "Fee (demo)"), fmt(fee) + tl(" ج.س", " SDG")),
                    row(tl("يُخصَم من رصيدك", "Total debited"), fmt(total) + tl(" ج.س", " SDG"), true),
                    row(tl("يستلم", "They receive"), fmt(recv) + " " + ctry.cur, true)),
                React.createElement("div", { className: "text-[10px] text-center mb-3", style: { color: colors.textMuted } },
                    tl("رصيدك ", "Your balance ") + fmt(balance) + tl(" ج.س · الحدّ ", " SDG · limits ") + fmt(INTL_DEMO_LIMITS.min) + "–" + fmt(INTL_DEMO_LIMITS.max) + tl(" ج.س", " SDG"))),
            (err || (f.amount && e0)) && React.createElement("div", { className: "text-xs font-bold mb-3 text-center", style: { color: colors.danger } }, err || e0),
            React.createElement(Button, { label: tl("متابعة للمراجعة", "Continue to review"), disabled: !!e0, onPress: () => { const e = intlValidate({ ...f, balance }); if (e) { setErr(e); return; } setStep("review"); } }))));
}
// ============================================================================
// C224: حسابات العملات والبطاقات الافتراضيّة — نموذجٌ تجريبيّ داخل «محفظة سوا» (لا أموال حقيقيّة)
// • حسابٌ لكلّ عملة برقمٍ تجريبيّ بصيغة SAWA-USD-…(ليس IBAN) · تحويلٌ بين العملات بأسعارٍ ثابتة ورسوم 1٪
// • بطاقاتٌ افتراضيّة: أرقامها تبدأ بـ0000 (لا تطابق أيّ بطاقةٍ حقيقيّة) · إظهار التفاصيل برمز المحفظة · تجميد · حدٌّ شهريّ · حذف
// الربط الحقيقيّ يحتاج مصرفاً شريكاً أو مُصدِر بطاقاتٍ مرخَّصاً — يُستبدل FX_CURS والدوالّ في AppInner فقط.
// ============================================================================
const FX_CURS = [
    { cur: "USD", flag: "🇺🇸", ar: "دولار أمريكيّ", en: "US dollar", rate: 600 },
    { cur: "SAR", flag: "🇸🇦", ar: "ريال سعوديّ", en: "Saudi riyal", rate: 160 },
    { cur: "AED", flag: "🇦🇪", ar: "درهم إماراتيّ", en: "UAE dirham", rate: 163 },
    { cur: "EUR", flag: "🇪🇺", ar: "يورو", en: "Euro", rate: 650 },
    { cur: "GBP", flag: "🇬🇧", ar: "جنيه إسترلينيّ", en: "British pound", rate: 760 },
    { cur: "QAR", flag: "🇶🇦", ar: "ريال قطريّ", en: "Qatari riyal", rate: 165 },
    { cur: "EGP", flag: "🇪🇬", ar: "جنيه مصريّ", en: "Egyptian pound", rate: 12 },
];
const FX_FEE = 0.01;   // 1٪ (تجريبيّ)
const VCARD_MAX = 5;
const VCARD_COLORS = [["#1E3A63", "#2774BA"], ["#0C4854", "#187854"], ["#5F3F78", "#8B5FA8"], ["#7A431E", "#E8823D"]];
function fxInfo(cur) { return cur === "SDG" ? { cur: "SDG", flag: "🇸🇩", ar: "جنيه سودانيّ", en: "Sudanese pound", rate: 1 } : (FX_CURS.find((c) => c.cur === cur) || null); }
function fxRate(cur) { const c = fxInfo(cur); return c ? c.rate : 0; }
function fxFmt(n, cur) { const d = cur === "SDG" ? 0 : 2; return Number(n || 0).toLocaleString(wLoc(), { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fxCode(cur) { return cur === "SDG" ? tl("ج.س", "SDG") : cur; }
function fxRound(n, cur) { return cur === "SDG" ? Math.round(n) : Math.round(n * 100) / 100; }
// المبلغ بعملة المصدر ⇒ { fee (بعملة المصدر), out (بعملة الهدف) }
function fxQuote(amt, from, to) {
    const a = Number(amt) || 0, rf = fxRate(from), rt = fxRate(to);
    if (!(a > 0) || !rf || !rt || from === to) return { fee: 0, out: 0 };
    const fee = fxRound(a * FX_FEE, from), net = a - fee;
    const out = to === "SDG" ? Math.floor(net * rf / rt) : Math.floor(net * rf / rt * 100) / 100;
    return { fee, out };
}
function fxDigits(n) { let s = ""; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; }
function vcardNew(name, cur, colorIx) {
    const num = "0000" + fxDigits(12), d = new Date(); d.setFullYear(d.getFullYear() + 3);
    return { id: "vc" + Date.now().toString(36) + fxDigits(3), name: String(name || "").trim().slice(0, 24), cur, num, exp: String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getFullYear()).slice(2), cvv: fxDigits(3), color: colorIx || 0, frozen: false, limit: 0, createdAt: Date.now(), demo: true };
}
function vcardGroup(num) { return String(num).replace(/(\d{4})(?=\d)/g, "$1 "); }
// C199: نغمة المحفظة — لونها (SERVICE_COLORS.wallet) في كلّ أيقونات خدماتها وبنوكها وإعداداتها وبطاقاتها الكبيرة، بدل ألوان باستيل ثابتة
//   (أخضر/أزرق/بنفسجيّ/أصفر…) كانت تسطع في الوضع الداكن، وبطاقاتٍ كحليّة بخلاف رأسها. الأحمر/الأخضر للمبالغ الداخلة والخارجة فقط.
// C199: المحفظة بالأرقام الغربيّة (45,200) مثل رقم البطاقة والأوقات وأرقام الهواتف والرموز — كانت المبالغ عربيّة هنديّة (45,200) فيجتمع النظامان في سطرٍ واحد
function wLoc() { return loc(); }   // C200: صار loc() نفسه غربيّ الأرقام
function walletDarkNow() { try { return document.documentElement.getAttribute("data-theme") === "dark"; } catch (e) { return false; } }   // للمكوّنات التي تأخذ colors دون useTheme
function walletTone(isDark) {
    const c = SERVICE_COLORS.wallet;
    return { tint: c + (isDark ? "40" : "1A"), ink: isDark ? "#5EEAD4" : c, grad: `linear-gradient(135deg, ${c} 0%, #0B4F4A 100%)` };
}
function WalletDemoNote({ ar, en }) {
    const { colors, isDark } = useTheme(); const WT = walletTone(isDark);
    return React.createElement("div", { className: `flex ${rowStart()} items-start gap-2 rounded-xl border p-2.5 mb-3`, style: { borderColor: colors.accent, backgroundColor: colors.card } },
        React.createElement(Info, { size: 15, color: colors.accent, className: "shrink-0 mt-0.5" }),
        React.createElement("span", { className: `text-[11px] font-bold leading-snug ${textStart()}`, style: { color: colors.accent } }, tl(ar, en)));
}
// البطاقة كما تظهر (الرقم مخفيّ إلّا عند الإظهار)
function VirtualCardFace({ card, reveal, small }) {
    const c = VCARD_COLORS[card.color] || VCARD_COLORS[0];
    return React.createElement("div", { className: "relative rounded-2xl overflow-hidden text-white", style: { background: `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 100%)`, aspectRatio: "1.586 / 1", padding: small ? 12 : 18 } },
        React.createElement("div", { className: "flex items-center justify-between", dir: "ltr" },
            React.createElement("span", { className: small ? "text-xs font-black tracking-widest" : "text-sm font-black tracking-widest" }, "SAWA"),
            React.createElement("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full", style: { backgroundColor: "rgba(255,255,255,0.18)" } }, card.cur)),
        React.createElement("div", { className: "rounded-md mt-3", style: { width: small ? 26 : 36, height: small ? 18 : 26, background: "linear-gradient(135deg,#E9D8A6,#B8955A)" } }),
        React.createElement("div", { className: small ? "text-sm font-bold mt-2 tracking-widest" : "text-lg font-bold mt-3 tracking-widest", dir: "ltr", style: { fontVariantNumeric: "tabular-nums" } }, reveal ? vcardGroup(card.num) : "•••• •••• •••• " + card.num.slice(-4)),
        React.createElement("div", { className: "flex items-end justify-between mt-2", dir: "ltr" },
            React.createElement("span", { className: "text-[11px] font-bold truncate", style: { maxWidth: "60%" } }, card.name || "SAWA"),
            React.createElement("span", { className: "text-[11px] font-bold" }, (reveal ? card.exp + "  CVV " + card.cvv : card.exp))),
        React.createElement("div", { className: "absolute text-[9px] font-bold", style: { bottom: small ? 6 : 8, insetInlineStart: small ? 12 : 18, opacity: 0.6 } }, tl("افتراضيّة · تجريبيّة", "Virtual · demo")),
        card.frozen && React.createElement("div", { className: "absolute inset-0 flex flex-col items-center justify-center", style: { backgroundColor: "rgba(10,20,40,0.6)" } },
            React.createElement(Snowflake, { size: small ? 18 : 26, color: "#fff" }),
            React.createElement("span", { className: "text-xs font-extrabold mt-1" }, tl("مجمَّدة", "Frozen"))));
}
// شاشات العملات والبطاقات — تُفتح من WalletScreen بحسب view
function FxCardsScreens({ view, setView, balance, fxAccounts, cards, walletPinForConfirm, selFx, setSelFx, selCard, setSelCard, onOpenFx, onExchange, onCardsChange, holder }) {
    const { colors, isDark } = useTheme(); const WT = walletTone(isDark);
    const [from, setFrom] = useState("SDG");
    const [to, setTo] = useState((fxAccounts[0] && fxAccounts[0].cur) || "");
    const [amt, setAmt] = useState("");
    const [cName, setCName] = useState("");
    const [cCur, setCCur] = useState("SDG");
    const [cColor, setCColor] = useState(0);
    const [pin, setPin] = useState("");
    const [revealUntil, setRevealUntil] = useState(0);
    const [limitIn, setLimitIn] = useState("");
    const [confirmDel, setConfirmDel] = useState(false);
    const [, tick] = useState(0);
    useEffect(() => { if (!revealUntil) return; const t = setInterval(() => { tick((x) => x + 1); if (Date.now() > revealUntil) setRevealUntil(0); }, 1000); return () => clearInterval(t); }, [revealUntil]);
    const balOf = (cur) => cur === "SDG" ? balance : ((fxAccounts.find((a) => a.cur === cur) || {}).bal || 0);
    const owned = ["SDG"].concat(fxAccounts.map((a) => a.cur));
    const shell = (title, body, back) => React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title, onBack: back || (() => setView("home")) }),
        React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } }, body));
    const curChip = (cur, on, onClick, key) => { const c = fxInfo(cur); return React.createElement("button", { key: key || cur, onClick, className: `flex ${rowStart()} items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold`, style: { borderColor: on ? colors.primary : colors.border, borderWidth: on ? 2 : 1, color: on ? colors.primary : colors.text, backgroundColor: colors.card } }, React.createElement("span", null, c.flag), cur); };
    const row = (k, v, strong) => React.createElement("div", { className: `flex ${rowStart()} items-center justify-between gap-3 p-3 border-b`, style: { borderColor: colors.border } },
        React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, k),
        React.createElement("span", { className: `text-xs ${strong ? "font-extrabold" : "font-bold"}`, style: { color: colors.text } }, v));
    const copy = (txt) => { try { navigator.clipboard.writeText(txt); } catch (e) {} };
    // ---------- فتح حساب عملة ----------
    if (view === "fxAdd") {
        const avail = FX_CURS.filter((c) => !fxAccounts.some((a) => a.cur === c.cur));
        return shell(tl("حساب عملةٍ جديد", "New currency account"), React.createElement("div", null,
            React.createElement(WalletDemoNote, { ar: "حساباتٌ تجريبيّة — أرقامها للعرض وليست أرقاماً مصرفيّة، ولا تستقبل أموالاً حقيقيّة.", en: "Demo accounts — numbers are for display, not bank numbers, and can't receive real money." }),
            !avail.length && React.createElement("div", { className: "text-center text-xs py-8", style: { color: colors.textMuted } }, tl("فتحتَ كلّ العملات المتاحة", "You've opened every available currency")),
            avail.map((c) => React.createElement("button", { key: c.cur, onClick: () => { onOpenFx(c.cur); setSelFx(c.cur); setView("fxAcct"); }, className: `w-full flex ${rowStart()} items-center gap-3 rounded-2xl border p-3 mb-2 ${textStart()}`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement("span", { className: "text-2xl shrink-0" }, c.flag),
                React.createElement("div", { className: "flex-1 min-w-0" },
                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, tl(c.ar, c.en) + " · " + c.cur),
                    React.createElement("div", { className: "text-[11px] mt-0.5", dir: "ltr", style: { color: colors.textMuted, textAlign: isRTL() ? "right" : "left" } }, "1 " + c.cur + " = " + fxFmt(c.rate, "SDG") + " " + fxCode("SDG"))),
                React.createElement(Plus, { size: 18, color: colors.primary, className: "shrink-0" })))));
    }
    // ---------- حساب عملة ----------
    if (view === "fxAcct") {
        const a = fxAccounts.find((x) => x.cur === selFx), c = a && fxInfo(a.cur);
        if (!a) return shell(tl("حساب العملة", "Currency account"), null);
        return shell(tl(c.ar, c.en), React.createElement("div", null,
            React.createElement("div", { className: "rounded-2xl p-5 mb-3 text-white", style: { background: WT.grad } },
                React.createElement("div", { className: "text-xs mb-1", style: { color: "rgba(255,255,255,0.65)" } }, c.flag + " " + tl("رصيد ", "Balance · ") + a.cur),
                React.createElement("div", { className: "text-3xl font-black", dir: "ltr", style: { textAlign: isRTL() ? "right" : "left" } }, fxFmt(a.bal, a.cur) + " " + a.cur),
                React.createElement("div", { className: "text-[11px] mt-1", dir: "ltr", style: { color: "rgba(255,255,255,0.6)", textAlign: isRTL() ? "right" : "left" } }, "≈ " + fxFmt(a.bal * c.rate, "SDG") + " " + fxCode("SDG"))),
            React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-3` },
                React.createElement("button", { onClick: () => { setFrom("SDG"); setTo(a.cur); setAmt(""); setView("fxConvert"); }, className: "flex-1 flex flex-col items-center gap-1 rounded-2xl border py-3", style: { borderColor: colors.border, backgroundColor: colors.card } }, React.createElement(ArrowDownLeft, { size: 18, color: colors.primary }), React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, tl("تحويلٌ إليه", "Convert in"))),
                React.createElement("button", { onClick: () => { setFrom(a.cur); setTo("SDG"); setAmt(""); setView("fxConvert"); }, className: "flex-1 flex flex-col items-center gap-1 rounded-2xl border py-3", style: { borderColor: colors.border, backgroundColor: colors.card } }, React.createElement(ArrowUpRight, { size: 18, color: colors.primary }), React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, tl("تحويلٌ منه", "Convert out"))),
                React.createElement("button", { onClick: () => { setCCur(a.cur); setCName(""); setView("cardNew"); }, className: "flex-1 flex flex-col items-center gap-1 rounded-2xl border py-3", style: { borderColor: colors.border, backgroundColor: colors.card } }, React.createElement(CreditCard, { size: 18, color: colors.primary }), React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.text } }, tl("بطاقةٌ بالعملة", "Card in " + a.cur)))),
            React.createElement("h4", { className: `text-sm font-extrabold mb-2 ${textStart()}`, style: { color: colors.text } }, tl("تفاصيل الحساب", "Account details")),
            React.createElement(Card, { className: "p-0 overflow-hidden" },
                row(tl("صاحب الحساب", "Holder"), holder || tl("أنت", "You")),
                row(tl("رقم الحساب (تجريبيّ)", "Account no. (demo)"), React.createElement("span", { className: `flex ${rowStart()} items-center gap-2`, dir: "ltr" }, a.acct, React.createElement("button", { onClick: () => copy(a.acct), "aria-label": tl("نسخ", "Copy") }, React.createElement(Copy, { size: 13, color: colors.primary })))),
                row(tl("العملة", "Currency"), a.cur + " · " + tl(c.ar, c.en)),
                row(tl("سعر الصرف (تجريبيّ)", "Rate (demo)"), "⁦" + "1 " + a.cur + "⁩" + " = " + fxFmt(c.rate, "SDG") + " " + fxCode("SDG"))),
            React.createElement(WalletDemoNote, { ar: "رقم الحساب للعرض فقط — ليس رقماً مصرفيّاً ولا يستقبل تحويلاتٍ حقيقيّة.", en: "The account number is for display only — not a bank number and can't receive real transfers." }),
            React.createElement("h4", { className: `text-sm font-extrabold mb-2 ${textStart()}`, style: { color: colors.text } }, tl("الحركات", "Activity")),
            !(a.hist || []).length && React.createElement("div", { className: "text-center text-xs py-6", style: { color: colors.textMuted } }, tl("لا حركات بعد", "No activity yet")),
            (a.hist || []).map((h, i) => React.createElement("div", { key: i, className: `flex ${rowStart()} items-center gap-3 rounded-2xl p-3 mb-1.5`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement("div", { className: "flex-1 min-w-0 text-xs font-bold", style: { color: colors.text } }, h.note),
                React.createElement("span", { className: "text-xs font-extrabold shrink-0", dir: "ltr", style: { color: h.amt >= 0 ? colors.success : colors.danger } }, (h.amt >= 0 ? "+" : "−") + fxFmt(Math.abs(h.amt), a.cur) + " " + a.cur)))));
    }
    // ---------- تحويل بين العملات ----------
    if (view === "fxConvert") {
        const q = fxQuote(amt, from, to), a0 = Number(amt) || 0, have = balOf(from);
        const err = !to || from === to ? tl("اختر عملتين مختلفتين", "Pick two different currencies") : a0 > have ? tl("الرصيد لا يكفي", "Insufficient balance") : null;
        return shell(tl("تحويل العملات", "Convert currency"), React.createElement("div", null,
            React.createElement(WalletDemoNote, { ar: "أسعارٌ ثابتة للتجربة وليست أسعار السوق · رسوم 1٪.", en: "Fixed demo rates, not market rates · 1% fee." }),
            fxAccounts.length === 0 && React.createElement(Card, null,
                React.createElement("div", { className: `text-xs mb-2 ${textStart()}`, style: { color: colors.textMuted } }, tl("افتح حساب عملةٍ أوّلاً لتحوّل إليه.", "Open a currency account first.")),
                React.createElement(Button, { label: tl("فتح حساب عملة", "Open a currency account"), onPress: () => setView("fxAdd") })),
            fxAccounts.length > 0 && React.createElement(React.Fragment, null,
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, tl("من", "From")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-1` }, owned.map((cur) => curChip(cur, from === cur, () => { setFrom(cur); if (to === cur) setTo(owned.find((x) => x !== cur) || ""); }, "f" + cur))),
                React.createElement("div", { className: `text-[11px] mb-3 ${textStart()}`, style: { color: colors.textMuted } }, tl("المتاح: ", "Available: ") + fxFmt(have, from) + " " + fxCode(from)),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, tl("إلى", "To")),
                React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-3` }, owned.filter((cur) => cur !== from).map((cur) => curChip(cur, to === cur, () => setTo(cur), "t" + cur))),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, tl("المبلغ بـ", "Amount in ") + fxCode(from)),
                React.createElement("input", { dir: "ltr", value: amt, onChange: (e) => setAmt(e.target.value.replace(from === "SDG" ? /[^0-9]/g : /[^0-9.]/g, "")), inputMode: "decimal", placeholder: "0", className: "w-full border rounded-xl px-3 py-3 text-lg font-bold text-center mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                a0 > 0 && to && from !== to && React.createElement(Card, { className: "p-0 overflow-hidden" },
                    row(tl("السعر (تجريبيّ)", "Rate (demo)"), "⁦" + "1 " + (from === "SDG" ? to : from) + "⁩" + " = " + fxFmt(fxRate(from === "SDG" ? to : from) / fxRate(from === "SDG" ? "SDG" : to), from === "SDG" || to === "SDG" ? "SDG" : to) + " " + fxCode(from === "SDG" || to === "SDG" ? "SDG" : to)),
                    row(tl("الرسوم 1٪", "Fee 1%"), fxFmt(q.fee, from) + " " + fxCode(from)),
                    row(tl("تستلم", "You get"), fxFmt(q.out, to) + " " + fxCode(to), true)),
                err && a0 > 0 && React.createElement("div", { className: "text-xs font-bold text-center mb-3", style: { color: colors.danger } }, err),
                React.createElement(Button, { label: tl("تحويل", "Convert"), disabled: !!err || !(a0 > 0) || !(q.out > 0), onPress: () => { onExchange({ from, to, amt: fxRound(a0, from), fee: q.fee, out: q.out }); setAmt(""); setSelFx(from === "SDG" ? to : from); setView(to === "SDG" && from === "SDG" ? "home" : "fxAcct"); } }))));
    }
    // ---------- البطاقات ----------
    if (view === "cards") {
        return shell(tl("البطاقات الافتراضيّة", "Virtual cards"), React.createElement("div", null,
            React.createElement(WalletDemoNote, { ar: "بطاقاتٌ تجريبيّة — أرقامها تبدأ بـ0000 ولا تعمل في أيّ متجر.", en: "Demo cards — numbers start with 0000 and don't work at any merchant." }),
            !cards.length && React.createElement("div", { className: "text-center py-8" },
                React.createElement(CreditCard, { size: 34, color: colors.textMuted }),
                React.createElement("div", { className: "text-xs mt-2", style: { color: colors.textMuted } }, tl("لا بطاقات بعد — أنشئ بطاقةً للشراء عبر الإنترنت", "No cards yet — create one for online purchases"))),
            cards.map((cd) => React.createElement("button", { key: cd.id, onClick: () => { setSelCard(cd.id); setRevealUntil(0); setPin(""); setConfirmDel(false); setLimitIn(cd.limit ? String(cd.limit) : ""); setView("cardDetail"); }, className: "w-full block mb-3" }, React.createElement(VirtualCardFace, { card: cd }))),
            React.createElement(Button, { label: cards.length >= VCARD_MAX ? tl("الحدّ 5 بطاقات", "Limit: 5 cards") : tl("بطاقةٌ جديدة", "New card"), icon: Plus, disabled: cards.length >= VCARD_MAX, onPress: () => { setCName(""); setCCur("SDG"); setCColor(cards.length % VCARD_COLORS.length); setView("cardNew"); } })));
    }
    if (view === "cardNew") {
        const preview = { name: cName || tl("بطاقتي", "My card"), cur: cCur, num: "0000000000000000", exp: "••/••", color: cColor, frozen: false };
        return shell(tl("بطاقةٌ افتراضيّة جديدة", "New virtual card"), React.createElement("div", null,
            React.createElement("div", { className: "mb-4" }, React.createElement(VirtualCardFace, { card: preview })),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, tl("اسم البطاقة", "Card name")),
            React.createElement("input", { value: cName, onChange: (e) => setCName(e.target.value.slice(0, 24)), placeholder: tl("مثال: مشتريات الإنترنت", "e.g. Online shopping"), dir: isRTL() ? "rtl" : "ltr", className: "w-full border rounded-xl px-3 py-3 text-sm mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, tl("عملة البطاقة", "Card currency")),
            React.createElement("div", { className: `flex ${rowStart()} flex-wrap gap-2 mb-1` }, owned.map((cur) => curChip(cur, cCur === cur, () => setCCur(cur), "c" + cur))),
            React.createElement("div", { className: `text-[11px] mb-3 ${textStart()}`, style: { color: colors.textMuted } }, tl("تُخصم مشتريات البطاقة من حساب عملتها.", "Purchases are charged to the card's currency account.")),
            React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, tl("اللون", "Colour")),
            React.createElement("div", { className: `flex ${rowStart()} gap-3 mb-4` }, VCARD_COLORS.map((c, i) => React.createElement("button", { key: i, onClick: () => setCColor(i), "aria-label": tl("لون ", "Colour ") + (i + 1), className: "w-9 h-9 rounded-full", style: { background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`, outline: cColor === i ? `3px solid ${colors.primary}` : "none", outlineOffset: 2 } }))),
            React.createElement(Button, { label: tl("إنشاء البطاقة", "Create card"), disabled: !cName.trim() || cards.length >= VCARD_MAX, onPress: () => { const cd = vcardNew(cName, cCur, cColor); onCardsChange([cd].concat(cards)); setSelCard(cd.id); setRevealUntil(0); setPin(""); setLimitIn(""); setView("cardDetail"); } })), () => setView("cards"));
    }
    if (view === "cardDetail") {
        const cd = cards.find((x) => x.id === selCard);
        if (!cd) return shell(tl("البطاقة", "Card"), null, () => setView("cards"));
        const reveal = revealUntil > Date.now();
        const upd = (patch) => onCardsChange(cards.map((x) => x.id === cd.id ? Object.assign({}, x, patch) : x));
        return shell(cd.name || tl("البطاقة", "Card"), React.createElement("div", null,
            React.createElement("div", { className: "mb-3" }, React.createElement(VirtualCardFace, { card: cd, reveal })),
            !reveal && React.createElement(Card, null,
                React.createElement("div", { className: `text-xs font-bold mb-2 ${textStart()}`, style: { color: colors.text } }, tl("إظهار رقم البطاقة ورمز CVV", "Show card number and CVV")),
                !walletPinForConfirm ? React.createElement("div", { className: "text-xs", style: { color: colors.danger } }, tl("عيّن رمز المحفظة أوّلاً", "Set a wallet PIN first"))
                    : React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("input", { dir: "ltr", type: "password", inputMode: "numeric", maxLength: 6, value: pin, onChange: (e) => setPin(e.target.value.replace(/[^0-9]/g, "")), placeholder: tl("رمز المحفظة", "Wallet PIN"), className: "flex-1 min-w-0 border rounded-xl px-3 py-2.5 text-sm text-center tracking-widest", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                        React.createElement("button", { disabled: pin !== walletPinForConfirm, onClick: () => { setRevealUntil(Date.now() + 30000); setPin(""); }, className: "shrink-0 flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white", style: { backgroundColor: colors.primary, opacity: pin === walletPinForConfirm ? 1 : 0.5 } }, React.createElement(Eye, { size: 14, color: "#fff" }), tl("إظهار", "Show"))),
                pin.length >= 4 && pin !== walletPinForConfirm && React.createElement("div", { className: "text-[11px] font-bold mt-1.5", style: { color: colors.danger } }, tl("رمز المحفظة غير صحيح", "Incorrect wallet PIN"))),
            reveal && React.createElement("div", { className: `flex ${rowStart()} items-center justify-between rounded-xl p-3 mb-3`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                React.createElement("span", { className: "text-xs font-bold", style: { color: colors.textMuted } }, tl("تُخفى التفاصيل بعد ", "Hidden again in ") + Math.max(0, Math.ceil((revealUntil - Date.now()) / 1000)).toLocaleString(wLoc()) + tl(" ث", "s")),
                React.createElement("div", { className: `flex ${rowStart()} gap-3` },
                    React.createElement("button", { onClick: () => copy(cd.num), className: "flex items-center gap-1 text-xs font-bold", style: { color: colors.primary } }, React.createElement(Copy, { size: 13, color: colors.primary }), tl("نسخ الرقم", "Copy number")),
                    React.createElement("button", { onClick: () => setRevealUntil(0), className: "flex items-center gap-1 text-xs font-bold", style: { color: colors.textMuted } }, React.createElement(Lock, { size: 13, color: colors.textMuted }), tl("إخفاء", "Hide")))),
            React.createElement(Card, { className: "p-0 overflow-hidden" },
                React.createElement("button", { onClick: () => upd({ frozen: !cd.frozen }), className: `w-full flex ${rowStart()} items-center justify-between gap-3 p-3 border-b ${textStart()}`, style: { borderColor: colors.border } },
                    React.createElement("span", { className: `flex ${rowStart()} items-center gap-2 text-sm font-bold`, style: { color: colors.text } }, React.createElement(cd.frozen ? Unlock : Snowflake, { size: 16, color: colors.primary }), cd.frozen ? tl("إلغاء التجميد", "Unfreeze") : tl("تجميد البطاقة", "Freeze card")),
                    React.createElement("span", { className: "text-[11px] font-bold px-2 py-0.5 rounded-full", style: { backgroundColor: (cd.frozen ? colors.accent : colors.success) + "1A", color: cd.frozen ? colors.accent : colors.success } }, cd.frozen ? tl("مجمَّدة", "Frozen") : tl("نشطة", "Active"))),
                React.createElement("div", { className: "p-3 border-b", style: { borderColor: colors.border } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 text-sm font-bold mb-2`, style: { color: colors.text } }, React.createElement(SlidersHorizontal, { size: 16, color: colors.primary }), tl("الحدّ الشهريّ (", "Monthly limit (") + fxCode(cd.cur) + ")"),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                        React.createElement("input", { dir: "ltr", value: limitIn, onChange: (e) => setLimitIn(e.target.value.replace(/[^0-9]/g, "")), inputMode: "numeric", placeholder: tl("بلا حدّ", "No limit"), className: "flex-1 min-w-0 border rounded-xl px-3 py-2.5 text-sm text-center", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                        React.createElement("button", { onClick: () => upd({ limit: Number(limitIn) || 0 }), disabled: (Number(limitIn) || 0) === (cd.limit || 0), className: "shrink-0 rounded-xl px-4 text-xs font-bold text-white", style: { backgroundColor: colors.primary, opacity: (Number(limitIn) || 0) === (cd.limit || 0) ? 0.5 : 1 } }, tl("حفظ", "Save"))),
                    React.createElement("div", { className: `text-[11px] mt-1.5 ${textStart()}`, style: { color: colors.textMuted } }, cd.limit ? tl("الحدّ الحاليّ: ", "Current limit: ") + fxFmt(cd.limit, cd.cur) + " " + fxCode(cd.cur) : tl("لا حدّ حاليّاً", "No limit set"))),
                React.createElement("div", { className: "p-3" },
                    !confirmDel ? React.createElement("button", { onClick: () => setConfirmDel(true), className: `flex ${rowStart()} items-center gap-2 text-sm font-bold`, style: { color: colors.danger } }, React.createElement(Trash2, { size: 16, color: colors.danger }), tl("حذف البطاقة", "Delete card"))
                        : React.createElement("div", null,
                            React.createElement("div", { className: `text-xs font-bold mb-2 ${textStart()}`, style: { color: colors.danger } }, tl("حذف نهائيّ — لا يمكن استعادة البطاقة.", "Permanent — the card can't be restored.")),
                            React.createElement("div", { className: `flex ${rowStart()} gap-2` },
                                React.createElement("button", { onClick: () => { onCardsChange(cards.filter((x) => x.id !== cd.id)); setView("cards"); }, className: "flex-1 rounded-xl py-2.5 text-xs font-bold text-white", style: { backgroundColor: colors.danger } }, tl("نعم، احذفها", "Yes, delete")),
                                React.createElement("button", { onClick: () => setConfirmDel(false), className: "flex-1 rounded-xl py-2.5 text-xs font-bold border", style: { borderColor: colors.border, color: colors.text } }, tl("إلغاء", "Cancel")))))),
            React.createElement(WalletDemoNote, { ar: "بطاقةٌ تجريبيّة — لا تعمل في أيّ متجر.", en: "Demo card — doesn't work at any merchant." })), () => setView("cards"));
    }
    return null;
}
function WalletScreen({ balance, transactions, cardNumber, walletPinForConfirm, kycStatus, kycDismissed, onDismissKyc, onSubmitKyc, onTopUp, onTransfer, onScanPay, onBack, linkedMethods, onAddPaymentMethod, onRemovePaymentMethod, spendingLimit, onSetSpendingLimit, jamiyaList, onPayJamiya, onCreateJamiya, CURRENT_USER_ID, canIntl = false, intlHistory = [], onIntlTransfer, kycMeta = null, fxAccounts = [], onOpenFx, onExchange, cards = [], onCardsChange, holder = "" }) {
    const { colors, isDark } = useTheme(); const WT = walletTone(isDark);
    const [view, setView] = useState("home");
    const [selFx, setSelFx] = useState("");   // C224
    const [selCard, setSelCard] = useState("");
    const WALLET_SERVICES = buildWalletServices(colors, setView);
    if (canIntl) WALLET_SERVICES.unshift({ id: "intl", label: tl("تحويل دوليّ", "International transfer"), desc: tl("تجريبيّ — للمشرف والمدير", "Demo — moderators & admins"), Icon: Globe, bgColor: colors.primaryLight, iconColor: colors.primary, onPress: () => setView("intl") });   // C221
    // C224: العملات والبطاقات الافتراضيّة — بعد «تحويل دوليّ» وقبل باقي الخدمات
    if (canIntl) WALLET_SERVICES.splice(1, 0,
        { id: "fx", label: tl("حسابات العملات", "Currency accounts"), desc: tl("دولار · ريال · درهم · يورو", "USD · SAR · AED · EUR"), Icon: Banknote, bgColor: "#E8F5E9", iconColor: "#1B7A43", onPress: () => { if (fxAccounts.length) { setSelFx(fxAccounts[0].cur); setView("fxAcct"); } else setView("fxAdd"); } },
        { id: "fxconv", label: tl("تحويل العملات", "Convert currency"), desc: tl("بين الجنيه والعملات", "Between SDG and currencies"), Icon: RotateCcw, bgColor: "#E3F2FD", iconColor: "#1565C0", onPress: () => setView("fxConvert") },
        { id: "vcards", label: tl("البطاقات الافتراضيّة", "Virtual cards"), desc: tl("للشراء عبر الإنترنت", "For online purchases"), Icon: CreditCard, bgColor: "#F1E9F7", iconColor: "#5E35B1", onPress: () => setView("cards") });
    const [selectedBank, setSelectedBank] = useState(WALLET_BANKS[0]);
    const [transferTo, setTransferTo] = useState("");
    const [transferPhone, setTransferPhone] = useState("");
    const [transferAmount, setTransferAmount] = useState("");
    const [transferPinConfirm, setTransferPinConfirm] = useState("");
    const [limitInput, setLimitInput] = useState(spendingLimit ? String(spendingLimit) : "");
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [navTab, setNavTab] = useState("home");
    // شحن الموبايل
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [mobileNumber, setMobileNumber] = useState("");
    const [topupAmount, setTopupAmount] = useState("");
    // فاتورة الكهرباء
    const [elecMeter, setElecMeter] = useState("");
    const [elecAmount, setElecAmount] = useState("");
    // فاتورة الإنترنت
    const [netOperator, setNetOperator] = useState(null);
    const [netAccount, setNetAccount] = useState("");
    // تجميد المحفظة
    const [walletFrozen, setWalletFrozen] = useState(false);
    const [confirmFreeze, setConfirmFreeze] = useState(false);
    // فلاتر الحركات
    const [txFilter, setTxFilter] = useState("all"); // all | credit | debit | services | family
    const [txSearch, setTxSearch] = useState("");
    // الأخيرون في الإرسال
    const recentRecipients = useMemo(() => {
        const seen = new Set();
        return transactions
            .filter((t) => t.type === "debit" && t.to && !seen.has(t.to) && seen.add(t.to))   // C221: المستلمون من التحويلات وحدها (كانت أيّ حركة خصمٍ تظهر «مستلماً»)
            .slice(0, 4)
            .map((t) => ({ name: t.to, initial: String(t.to).trim().charAt(0) }));
    }, [transactions]);
    const now = new Date();
    const monthlySpent = transactions
        .filter((t) => t.type === "debit" && new Date(t.ts).getMonth() === now.getMonth() && new Date(t.ts).getFullYear() === now.getFullYear())
        .reduce((sum, txn) => sum + txn.amount, 0);
    const limitExceeded = spendingLimit && monthlySpent >= spendingLimit;
    const limitNearing = spendingLimit && !limitExceeded && monthlySpent >= spendingLimit * 0.8;
    const LOW_BALANCE_THRESHOLD = 2000;
    // ── شاشات الـ view (تُعالَج قبل navTab) ──
    if (view === "topup") {
        const TOPUP_AMOUNTS = [5000, 10000, 20000, 50000];
        return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("tghdhya_almhfza"), onBack: () => setView("home") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 rounded-2xl p-3 border mb-4`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                    React.createElement(CreditCard, { size: 18, color: colors.primary }),
                    React.createElement("div", { className: "flex-1" },
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.text } }, walletMaskCard(cardNumber)),
                        React.createElement("div", { className: "text-[10px]", style: { color: colors.textMuted } },
                            t("w_rsydk_alhaly"),
                            balance.toLocaleString(wLoc()),
                            t("w_sdg_sp")))),
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("mblgh_altghdhya")),
                React.createElement("div", { className: "grid grid-cols-2 gap-2 mb-3" }, TOPUP_AMOUNTS.map((a) => (React.createElement("button", { key: a, onClick: () => setTransferAmount(String(a)), className: "rounded-xl py-3 border text-sm font-bold", style: { borderColor: transferAmount === String(a) ? colors.primary : colors.border, backgroundColor: transferAmount === String(a) ? colors.primaryLight : colors.card, color: transferAmount === String(a) ? colors.primary : colors.text } }, a.toLocaleString(wLoc()))))),
                React.createElement("input", { dir: "ltr", value: transferAmount, onChange: (e) => setTransferAmount(e.target.value.replace(/[^0-9]/g, "")), placeholder: t("aw_adkhl_mblgh_akhr"), inputMode: "numeric", className: "w-full border rounded-xl px-3 py-3 text-sm mb-4 text-center font-bold", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("akhtr_tryqa_althwyl")),
                React.createElement("div", { className: "flex flex-col gap-2 mb-4" },
                    [
                        { name: t("w_bnk_alkhrtwm"), desc: t("w_thwyl_fwry"), color: "#1B7A43", bg: "#E3F3EA", linked: true },
                        { name: t("w_bnk_fysl"), desc: t("w_thwyl_fwry"), color: "#0D47A1", bg: "#E8F4FF", linked: false },
                        { name: t("w_albnk_alzray"), desc: t("w_thwyl_fwry"), color: "#B8720A", bg: "#FFF3CD", linked: false },
                        { name: t("w_albnk_alahly"), desc: t("w_thwyl_fwry"), color: "#1B7A43", bg: "#E8F5E9", linked: false },
                        { name: t("w_bnk_am_drman"), desc: t("w_thwyl_fwry"), color: "#6A1B9A", bg: "#F3E5F5", linked: false },
                    ].map((b) => (React.createElement("button", { key: b.name, onClick: () => setSelectedBank(b.name), className: `w-full flex items-center gap-3 p-3 rounded-2xl border text-start`, style: { backgroundColor: colors.card, borderWidth: selectedBank === b.name ? 2 : 1, borderColor: selectedBank === b.name ? colors.primary : colors.border, borderWidth: selectedBank === b.name ? 2 : 1 } },
                        React.createElement("div", { className: "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", style: { borderColor: selectedBank === b.name ? colors.primary : colors.border } }, selectedBank === b.name && React.createElement("div", { className: "w-2.5 h-2.5 rounded-full", style: { backgroundColor: colors.primary } })),
                        React.createElement("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", style: { backgroundColor: WT.tint } },
                            React.createElement(Landmark, { size: 18, color: WT.ink })),
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("div", { className: "text-xs font-extrabold", style: { color: colors.text } }, b.name),
                            React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, b.desc)),
                        b.linked && (React.createElement("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full", style: { backgroundColor: WT.tint, color: WT.ink } }, t("mrbwt")))))),
                    React.createElement("button", { onClick: () => setView("linkMethod"), className: `w-full flex items-center gap-3 p-3 rounded-2xl border-dashed border text-start`, style: { backgroundColor: colors.card, borderColor: colors.primary } },
                        React.createElement("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", style: { backgroundColor: colors.primaryLight } },
                            React.createElement(Plus, { size: 18, color: colors.primary })),
                        React.createElement("div", { className: "text-xs font-bold", style: { color: colors.primary } }, t("rbt_bnk_jdyd")))),
                React.createElement(Button, { label: Number(transferAmount) > 0 ? `تغذية ${Number(transferAmount).toLocaleString(wLoc())} ج.س ←` : t("w_adkhl_almblgh"), disabled: !(Number(transferAmount) > 0), onPress: () => { onTopUp(selectedBank, Number(transferAmount)); setTransferAmount(""); setView("home"); } }))));
    }
    // C220: التحويل الدوليّ (تجريبيّ) — للمشرف والمدير فقط
    // C224: حسابات العملات والبطاقات الافتراضيّة (تجريبيّة)
    if (canIntl && ["fxAdd", "fxAcct", "fxConvert", "cards", "cardNew", "cardDetail"].indexOf(view) >= 0) {
        return React.createElement(FxCardsScreens, { view, setView, balance, fxAccounts, cards, walletPinForConfirm, selFx, setSelFx, selCard, setSelCard, onOpenFx: (c) => onOpenFx && onOpenFx(c), onExchange: (x) => onExchange && onExchange(x), onCardsChange: (l) => onCardsChange && onCardsChange(l), holder });
    }
    if (view === "intl" && canIntl) {
        return React.createElement(IntlTransferScreen, { balance, walletPinForConfirm, kycStatus, history: intlHistory, onSend: (rec) => onIntlTransfer && onIntlTransfer(rec), onBack: () => setView("home") });
    }
    if (view === "transfer") {
        const amountNum = Number(transferAmount) || 0;
        const needsPinConfirm = amountNum > 1000;
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("irsal_mal"), onBack: () => setView("home") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                // C222: لا يتكرّر عنوان الشريط العلويّ — البطاقة تحمل التعليمة
                React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 rounded-2xl p-4 mb-4`, style: { background: WT.grad } },
                    React.createElement("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style: { backgroundColor: "rgba(255,255,255,0.12)" } }, React.createElement(Send, { size: 18, color: "#fff" })),
                    React.createElement("div", { className: "flex-1 min-w-0 text-sm font-bold text-white" }, t("adkhl_rqm_almstlm"))),   // الرصيد يبقى تحت حقل المبلغ وحده (بلا تكرار)
                recentRecipients.length > 0 && (React.createElement("div", { className: "mb-4" },
                    React.createElement("div", { className: "text-xs font-bold mb-2", style: { color: colors.textMuted } }, t("alakhyrwn")),
                    React.createElement("div", { className: `flex ${rowStart()} gap-3 overflow-x-auto pb-1` }, recentRecipients.map((r, i) => (React.createElement("button", { key: i, onClick: () => setTransferTo(r.name), className: "flex flex-col items-center gap-1 shrink-0" },
                        React.createElement("div", { className: "w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-white text-sm", style: { backgroundColor: colors.primary } }, r.initial),
                        React.createElement("span", { className: "text-[9px] font-bold max-w-[44px] truncate text-center", style: { color: colors.textMuted } }, r.name))))))),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("rqm_alhatf_aw_swa")),
                React.createElement("input", { dir: "ltr", value: transferPhone, onChange: (e) => setTransferPhone(e.target.value.replace(/[^0-9A-Za-z-]/g, "")), placeholder: tl("09XXXXXXXX أو رمز من 10 أرقام", "09XXXXXXXX or a 10-digit code"),   /* C199: كانت الصيغة القديمة SAWA-XXXXXX */ inputMode: "tel", className: "w-full border rounded-xl px-3 py-3 text-sm mb-3 text-center font-bold tracking-wider", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("asm_almstlm_akhtyary")),
                React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: transferTo, onChange: (e) => setTransferTo(e.target.value), placeholder: t("mthal_namat_babkr"), className: "w-full border rounded-xl px-3 py-3 text-sm mb-3", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("almblgh_j_s")),
                React.createElement("input", { dir: "ltr", value: transferAmount, onChange: (e) => setTransferAmount(e.target.value), type: "number", placeholder: "0", className: "w-full border rounded-xl px-3 py-3 text-lg font-bold text-center mb-2", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("div", { className: "text-[10px] text-center mb-3", style: { color: colors.textMuted } },
                    t("w_rsydk"),
                    balance.toLocaleString(wLoc()),
                    t("w_sdg_sp")),
                needsPinConfirm && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-1.5 mb-2 rounded-xl border p-2`, style: { borderColor: colors.accent, backgroundColor: colors.card } },
                        React.createElement(ShieldCheck, { size: 13, color: colors.accent }),
                        React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.accent } }, t("mblgh_fwq_1_000"))),
                    React.createElement("input", { dir: "ltr", value: transferPinConfirm, onChange: (e) => setTransferPinConfirm(e.target.value), type: "password", maxLength: 6, placeholder: t("rmz_almhfza"), className: "w-full border rounded-xl px-3 py-3 text-sm mb-3 text-center tracking-widest", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }))),
                React.createElement(Button, { label: transferPhone ? `إرسال إلى ${transferTo || transferPhone}` : t("w_adkhl_rqm_almstlm"), disabled: !transferPhone.trim() || !transferAmount || amountNum <= 0 || amountNum > balance || (needsPinConfirm && transferPinConfirm !== walletPinForConfirm), onPress: () => {
                        onTransfer(transferTo.trim() || transferPhone, amountNum);
                        setTransferTo("");
                        setTransferPhone("");
                        setTransferAmount("");
                        setTransferPinConfirm("");
                        setView("home");
                    } }),
                amountNum > balance && React.createElement("p", { className: "text-xs font-bold mt-2 text-center", style: { color: colors.danger } }, t("alrsyd_ghyr_kaf")))));
    }
    if (view === "transactionDetail" && selectedTransaction) {
        const txn = selectedTransaction;
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("tfasyl_alamlya"), onBack: () => setView("home") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement(Card, { className: "items-center flex flex-col py-6 mb-4" },
                    React.createElement("div", { className: "w-14 h-14 rounded-full flex items-center justify-center mb-3", style: { backgroundColor: colors.primaryLight } }, txn.type === "credit" ? React.createElement(ArrowDownLeft, { size: 24, color: colors.success }) : React.createElement(ArrowUpRight, { size: 24, color: colors.danger })),
                    React.createElement("span", { className: "text-2xl font-extrabold", style: { color: txn.type === "credit" ? colors.success : colors.danger } }, walletAmt(txn.type === "credit" ? "+" : "\u2212", txn.amount)),   // C221
                    React.createElement("span", { className: "text-sm mt-2", style: { color: colors.text } }, txn.note)),
                React.createElement(Card, { className: "p-0 overflow-hidden" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("rqm_alamlya")),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text }, dir: "ltr" }, txn.ref || ("SW-" + String(txn.id || "").replace(/\D/g, "").padStart(6, "0")))),   // C199: مرجعٌ مقروء بدل المعرّف الداخليّ «w1»
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3 border-b`, style: { borderColor: colors.border } },
                        React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("altarykh_walwqt")),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, new Date(txn.ts).toLocaleString(wLoc(), { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "numeric" }))),
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between p-3` },
                        React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("alnwa")),
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, txn.type === "credit" ? t("w_iyda") : t("w_shb")))),
                React.createElement("button", { onClick: async () => {
                        const text = `إيصال سوا
${txn.note}
المبلغ: ${txn.type === "credit" ? "+" : "-"}${txn.amount.toLocaleString(wLoc())} ج.س
رقم العملية: ${txn.id}
التاريخ: ${new Date(txn.ts).toLocaleString(wLoc())}`;
                        if (navigator.share) {
                            try {
                                await navigator.share({ text });
                            }
                            catch (err) { }
                        }
                    }, className: `w-full flex ${rowStart()} items-center justify-center gap-2 rounded-xl p-3 border mt-4`, style: { borderColor: colors.primary } },
                    React.createElement(Share2, { size: 16, color: colors.primary }),
                    React.createElement("span", { className: "text-sm font-bold", style: { color: colors.primary } }, t("msharka_aliysal"))))));
    }
    if (view === "limit") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("hd_alinfaq_alshhry"), onBack: () => setView("home") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("p", { className: "text-xs mb-4", style: { color: colors.textMuted } }, t("lma_infaqk_alshhry_yqtrb")),
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("alhd_alshhry_j_s")),
                React.createElement("input", { dir: "ltr", value: limitInput, onChange: (e) => setLimitInput(e.target.value.replace(/[^0-9]/g, "")), placeholder: t("mthal_2000"), inputMode: "numeric", className: "w-full border rounded-xl px-3 py-3 text-lg font-bold text-center mb-4", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement(Button, { label: t("hfz"), onPress: () => { onSetSpendingLimit(limitInput ? Number(limitInput) : null); setView("home"); } }))));
    }
    if (view === "kyc") {
        return React.createElement(KycFlowScreen, { kycStatus: kycStatus, kycMeta: kycMeta, onSubmit: onSubmitKyc, onBack: () => setView("home") });
    }
    if (view === "paymentMethods") {
        return React.createElement(PaymentMethodsScreen, { methods: linkedMethods, onAddNew: () => setView("linkMethod"), onRemove: onRemovePaymentMethod, onBack: () => setView("home") });
    }
    if (view === "linkMethod") {
        return React.createElement(LinkPaymentMethodScreen, { onChooseCard: () => setView("cardDetails"), onChooseBank: () => setView("bankDetails"), onBack: () => setView("paymentMethods") });
    }
    if (view === "cardDetails") {
        return React.createElement(CardDetailsScreen, { onBack: () => setView("linkMethod"), onContinue: (data) => { onAddPaymentMethod(data); setView("paymentMethods"); } });
    }
    if (view === "bankDetails") {
        return React.createElement(BankAccountDetailsScreen, { onBack: () => setView("linkMethod"), onContinue: (data) => { onAddPaymentMethod(data); setView("paymentMethods"); } });
    }
    if (view === "scanPay") {
        return React.createElement(ScanPayScreen, { onBack: () => setView("home"), onPay: (merchantName, amount) => { onScanPay(merchantName, amount); setView("home"); } });
    }
    // ══════════════════════════════════════════════════════════════
    // طاقة — شاشة اختيار شركة الوقود
    // ══════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════
    // وقود — شاشة موحدة بتبويب خاص
    // ══════════════════════════════════════════════════════════════
    if (view === "taqaCompanies" || view === "taqaPurchase" || view === "taqaToken" || view === "taqaHistory") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TaqaScreen, { balance: balance, colors: colors, onBack: () => { setView("home"); setNavTab("services"); } })));
    }
    if (view === "jamiya") {
        return (React.createElement(JamiyaScreen, { jamiyaList: jamiyaList, currentUserId: CURRENT_USER_ID, walletBalance: balance, onPay: onPayJamiya, onCreateJamiya: onCreateJamiya, onBack: () => setView("home") }));
    }
    if (view === "electricityBill") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("fatwra_alkhrba"), onBack: () => setView("home") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("div", { className: "rounded-2xl p-4 mb-4 flex items-center gap-3", style: { background: WT.grad } },
                    React.createElement(Zap, { size: 28, color: "#fff" }),
                    React.createElement("div", null,
                        React.createElement("div", { className: "text-sm font-extrabold text-white" }, t("hyya_alkhrba_alswdanya")),
                        React.createElement("div", { className: "text-[10px] text-white opacity-80" }, t("dfa_fatwra_alkhrba")))),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("rqm_aladad")),
                React.createElement("input", { dir: "ltr", value: elecMeter, onChange: (e) => setElecMeter(e.target.value.replace(/\D/g, "")), placeholder: t("adkhl_rqm_aladad"), inputMode: "numeric", className: "w-full border rounded-xl px-3 py-3 text-sm mb-3 text-center font-bold tracking-wider", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("almblgh_j_s")),
                React.createElement("div", { className: "grid grid-cols-3 gap-2 mb-3" }, [1000, 2000, 5000, 10000, 20000, 50000].map((a) => (React.createElement("button", { key: a, onClick: () => setElecAmount(String(a)), className: "rounded-xl py-2.5 border text-sm font-bold", style: { borderColor: elecAmount === String(a) ? colors.accent : colors.border, backgroundColor: elecAmount === String(a) ? "#FFF3CD" : colors.card, color: elecAmount === String(a) ? "#B8720A" : colors.text } }, a.toLocaleString(wLoc()))))),
                React.createElement("input", { dir: "ltr", value: elecAmount, onChange: (e) => setElecAmount(e.target.value.replace(/\D/g, "")), placeholder: t("aw_adkhl_mblgh_akhr"), inputMode: "numeric", className: "w-full border rounded-xl px-3 py-3 text-sm mb-4 text-center font-bold", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement(Button, { label: Number(elecAmount) > 0 && elecMeter ? `دفع ${Number(elecAmount).toLocaleString(wLoc())} ج.س ←` : t("w_adkhl_rqm_aladad"), disabled: !elecMeter || !Number(elecAmount), onPress: () => { onTransfer(t("w_hyya_adad") + elecMeter, Number(elecAmount)); setElecMeter(""); setElecAmount(""); setView("home"); } }))));
    }
    if (view === "telecomServices") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("khdmat_alatsalat"), onBack: () => setView("home") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } }, [
                { id: "mobile", label: t("w_shhn_almwbayl"), desc: "MTN · Zain · Sudani", Icon: Smartphone, bg: colors.primaryLight, ic: colors.primary, view: "mobileTopup" },
                { id: "internet", label: t("w_fatwra_intrnt"), desc: "Zain · Sudani · Canar", Icon: Wifi, bg: "#E3F3EA", ic: "#1B7A43", view: "internetBill" },
            ].map((svc) => (React.createElement("button", { key: svc.id, onClick: () => setView(svc.view), className: `w-full flex ${rowStart()} items-center gap-3 rounded-2xl p-4 border mb-2 text-start`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                React.createElement("div", { className: "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", style: { backgroundColor: WT.tint } }, React.createElement(svc.Icon, { size: 22, color: WT.ink })),
                React.createElement("div", { className: `flex-1 ${textStart()}` },
                    React.createElement("div", { className: "text-sm font-extrabold", style: { color: colors.text } }, svc.label),
                    React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, svc.desc)),
                React.createElement(ChevronLeft, { size: 16, color: colors.textMuted, style: { transform: isRTL() ? "none" : "scaleX(-1)" } })))))));
    }
    if (view === "internetBill") {
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("fatwra_alintrnt"), onBack: () => setView("telecomServices") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("akhtr_almzwd")),
                React.createElement("div", { className: "flex gap-2 mb-4" }, [
                    { id: "Zain", color: "#EF4444" },
                    { id: "Sudani", color: colors.primary },
                    { id: "Canar", color: "#1B7A43" },
                ].map((op) => (React.createElement("button", { key: op.id, onClick: () => setNetOperator(op.id), className: "flex-1 rounded-xl border-2 py-3 flex flex-col items-center gap-1", style: { borderColor: netOperator === op.id ? op.color : colors.border, backgroundColor: netOperator === op.id ? op.color + "15" : colors.card } },
                    React.createElement("span", { className: "text-sm font-extrabold", style: { color: netOperator === op.id ? op.color : colors.textMuted } }, op.id))))),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("rqm_alhsab_aljwal")),
                React.createElement("input", { dir: "ltr", value: netAccount, onChange: (e) => setNetAccount(e.target.value), placeholder: "09XXXXXXXXX", inputMode: "tel", className: "w-full border rounded-xl px-3 py-3 text-sm mb-4 text-center tracking-wider font-bold", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement(Button, { label: netOperator && netAccount ? `استعلام ودفع — ${netOperator} ←` : t("w_akhtr_almzwd"), disabled: !netOperator || !netAccount, onPress: () => { onTransfer(t("w_fatwra_intrnt_sp") + netOperator, 0); setNetAccount(""); setNetOperator(null); setView("home"); } }))));
    }
    if (view === "mobileTopup") {
        const operators = [
            { id: "mtn", label: "MTN", color: "#F59E0B" },
            { id: "zain", label: "Zain", color: "#EF4444" },
            { id: "sudani", label: "Sudani", color: colors.primary },
        ];
        const amounts = [1000, 2000, 5000, 10000];
        return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("shhn_almwbayl"), onBack: () => setView("telecomServices") }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("akhtr_alshbka")),
                React.createElement("div", { className: `flex ${rowStart()} gap-2 mb-4` }, operators.map((op) => (React.createElement("button", { key: op.id, onClick: () => setSelectedOperator(op.id), className: "flex-1 rounded-xl border-2 py-3 flex flex-col items-center gap-1", style: { borderColor: selectedOperator === op.id ? op.color : colors.border, backgroundColor: selectedOperator === op.id ? op.color + "15" : colors.card } },
                    React.createElement("span", { className: "text-sm font-extrabold", style: { color: selectedOperator === op.id ? op.color : colors.textMuted } }, op.label))))),
                React.createElement("label", { className: "text-xs font-bold mb-1.5 block", style: { color: colors.text } }, t("rqm_almwbayl")),
                React.createElement("input", { dir: "ltr", value: mobileNumber, onChange: (e) => setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10)), placeholder: "09XXXXXXXXX", inputMode: "tel", className: "w-full border rounded-xl px-3 py-3 text-sm mb-4 text-center tracking-wider font-bold", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement("label", { className: "text-xs font-bold mb-2 block", style: { color: colors.text } }, t("almblgh_j_s")),
                React.createElement("div", { className: "grid grid-cols-2 gap-2 mb-3" }, amounts.map((a) => (React.createElement("button", { key: a, onClick: () => setTopupAmount(String(a)), className: "rounded-xl py-3 border text-sm font-bold", style: { borderColor: topupAmount === String(a) ? colors.primary : colors.border, backgroundColor: topupAmount === String(a) ? colors.primaryLight : colors.card, color: topupAmount === String(a) ? colors.primary : colors.text } }, a.toLocaleString(wLoc()))))),
                React.createElement("input", { dir: "ltr", value: topupAmount, onChange: (e) => setTopupAmount(e.target.value.replace(/\D/g, "")), placeholder: t("aw_adkhl_mblgh_akhr"), inputMode: "numeric", className: "w-full border rounded-xl px-3 py-3 text-sm mb-4 text-center font-bold", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement(Button, { label: selectedOperator && mobileNumber && Number(topupAmount) > 0 ? `شحن ${Number(topupAmount).toLocaleString(wLoc())} ج.س ←` : t("w_akml_albyanat"), disabled: !selectedOperator || !mobileNumber || !Number(topupAmount), onPress: () => {
                        const op = operators.find((o) => o.id === selectedOperator);
                        onTransfer(t("w_shhn_") + (op === null || op === void 0 ? void 0 : op.label) + " — " + mobileNumber, Number(topupAmount));
                        setMobileNumber("");
                        setTopupAmount("");
                        setSelectedOperator(null);
                        setView("home");
                    } }))));
    }
    const NAV_TABS = [
        { id: "home", iconName: "Wallet", label: t("w_almhfza") },
        { id: "history", iconName: "Clock", label: t("w_alhrkat") },   // C221: كان سهم «مدفوع» نفسه
        { id: "services", iconName: "Grid3x3", label: t("w_alkhdmat_nav") },
        { id: "settings", iconName: "SettingsIcon", label: t("w_aliadadat") },
    ];
    const NAV_ICONS = { Wallet, ArrowUpRight, Clock, Grid3x3, SettingsIcon };
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        navTab === "home" && (React.createElement(React.Fragment, null,
            React.createElement(TopBar, { title: t("almhfza"), onBack: onBack }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("div", { className: "rounded-2xl p-5 mb-4 relative overflow-hidden", style: { background: WT.grad } },
                    walletFrozen && (React.createElement("div", { className: "absolute inset-0 flex flex-col items-center justify-center rounded-2xl", style: { backgroundColor: "rgba(0,0,0,0.65)", zIndex: 2 } },
                        React.createElement(Snowflake, { size: 28, color: "#fff" }),
                        React.createElement("span", { className: "text-sm font-extrabold text-white mt-2" }, t("almhfza_mjmda")),
                        React.createElement("button", { onClick: () => setWalletFrozen(false), className: "mt-2 px-4 py-1.5 rounded-full text-xs font-bold text-white", style: { backgroundColor: colors.accent } }, t("ilgha_altjmyd")))),
                    React.createElement("div", { className: "relative", style: { zIndex: 1 } },
                        React.createElement("div", { className: "text-xs mb-1", style: { color: "rgba(255,255,255,0.65)" } }, t("alrsyd_alhaly")),
                        React.createElement("div", { className: "text-3xl font-black text-white mb-1 tracking-tight" },
                            balance.toLocaleString(wLoc()),
                            " ",
                            React.createElement("span", { className: "text-lg font-bold" }, t("w_sdg"))),
                        React.createElement("div", { className: "text-[10px] mb-4", style: { color: "rgba(255,255,255,0.5)" } },
                            walletMaskCard(cardNumber),
                            t("w_alkhrtwm")),
                        React.createElement("div", { className: `flex ${rowStart()} gap-2 mt-4` }, [
                            { label: t("tghdhya"), Icon: CreditCard, action: () => setView("topup"), bg: "rgba(255,255,255,0.2)" },
                            { label: t("irsal_mal"), Icon: Send, action: () => setView("transfer"), bg: "rgba(255,255,255,0.2)" },
                            { label: t("msh_wdfa"), Icon: QrCode, action: () => setView("scanPay"), bg: "rgba(255,255,255,0.2)" },
                        ].filter(Boolean).map((btn) => (React.createElement("button", { key: btn.label, onClick: btn.action, className: "flex-1 flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1", style: { backgroundColor: btn.bg, backdropFilter: "blur(4px)" } },
                            React.createElement(btn.Icon, { size: 18, color: "#fff" }),
                            React.createElement("span", { className: "text-[10px] font-extrabold text-white" }, btn.label))))))),
                balance < LOW_BALANCE_THRESHOLD && (React.createElement(Card, { className: `flex ${rowStart()} items-center gap-2.5 mt-3`, style: { borderColor: colors.accent } },
                    React.createElement(AlertTriangle, { size: 18, color: colors.accent }),
                    React.createElement("span", { className: `flex-1 text-xs font-bold ${textStart()}`, style: { color: colors.accent } },
                        t("w_rsydk_mnkhfd"),
                        balance.toLocaleString(wLoc()),
                        t("w_fkr_btghdhya")))),
                // C224: «حساباتي» — الجنيه ثمّ حسابات العملات ثمّ البطاقات
                canIntl && React.createElement("div", { className: "mt-4" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-2` },
                        React.createElement("h4", { className: "text-sm font-extrabold", style: { color: colors.text } }, tl("حساباتي", "My accounts")),
                        React.createElement("button", { onClick: () => setView("cards"), className: `flex ${rowStart()} items-center gap-1 text-xs font-bold`, style: { color: colors.primary } }, React.createElement(CreditCard, { size: 13, color: colors.primary }), tl("البطاقات", "Cards") + (cards.length ? " (" + cards.length.toLocaleString(wLoc()) + ")" : ""))),
                    React.createElement("div", { className: `flex ${rowStart()} gap-2 overflow-x-auto pb-1`, style: { scrollbarWidth: "none" } },
                        React.createElement("div", { className: "shrink-0 rounded-2xl border px-3 py-2.5", style: { minWidth: 112, backgroundColor: colors.card, borderColor: colors.primary } },
                            React.createElement("div", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, "🇸🇩 SDG"),
                            React.createElement("div", { className: "text-sm font-extrabold tabular-nums", style: { color: colors.text } }, fxFmt(balance, "SDG"))),
                        fxAccounts.map((a) => React.createElement("button", { key: a.cur, onClick: () => { setSelFx(a.cur); setView("fxAcct"); }, className: `shrink-0 rounded-2xl border px-3 py-2.5 ${textStart()}`, style: { minWidth: 112, backgroundColor: colors.card, borderColor: colors.border } },
                            React.createElement("div", { className: "text-[11px] font-bold", style: { color: colors.textMuted } }, (fxInfo(a.cur) || {}).flag + " " + a.cur),
                            React.createElement("div", { className: "text-sm font-extrabold tabular-nums", style: { color: colors.text } }, fxFmt(a.bal, a.cur)))),
                        fxAccounts.length < FX_CURS.length && React.createElement("button", { onClick: () => setView("fxAdd"), className: "shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed px-3 py-2.5", style: { minWidth: 88, borderColor: colors.primary, backgroundColor: colors.primaryLight } },
                            React.createElement(Plus, { size: 16, color: colors.primary }),
                            React.createElement("span", { className: "text-[11px] font-bold", style: { color: colors.primary } }, tl("عملة", "Currency"))))),
                kycStatus !== "verified" && (kycStatus === "pending" || !kycDismissed) && (React.createElement("div", { className: `w-full flex ${rowStart()} items-center gap-2 rounded-xl p-3 border mt-3`, style: { backgroundColor: colors.card, borderColor: colors.accent } },
                    React.createElement("button", { onClick: () => setView("kyc"), className: `flex-1 flex ${rowStart()} items-center gap-2`, style: { minWidth: 0 } },
                        React.createElement(ShieldCheck, { size: 18, color: colors.accent, className: "shrink-0" }),
                        React.createElement("span", { className: `flex-1 text-xs font-bold ${textStart()}`, style: { color: colors.text } }, kycStatus === "pending" ? t("w_twthyq_qyd") : t("w_wthq_hwytk")),
                        React.createElement(ChevronLeft, { size: 14, color: colors.textMuted, className: "shrink-0", style: { transform: isRTL() ? "none" : "scaleX(-1)" } })),
                    kycStatus !== "pending" && React.createElement("button", { "aria-label": t("ighlaq"), onClick: () => onDismissKyc && onDismissKyc(), className: "w-7 h-7 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: colors.bg } },
                        React.createElement(X, { size: 13, color: colors.textMuted })))),
                React.createElement("h4", { className: "text-sm font-extrabold mt-4 mb-2", style: { color: colors.text } }, t("akhr_alhrkat")),
                transactions.slice(0, 5).map((txn) => (React.createElement("button", { key: txn.id, onClick: () => { setSelectedTransaction(txn); setView("transactionDetail"); }, className: `w-full ${textStart()} block mb-1.5` },
                    // C221: صفّ الحركة كما في «الحركات»: لونٌ بحسب النوع · العنوان سطران على الأكثر لا يلتصق بالمبلغ · المبلغ بإشارته وعملته
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 rounded-2xl p-3`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                        React.createElement("div", { className: "w-10 h-10 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: txn.type === "credit" ? colors.success + "18" : colors.danger + "18" } }, txn.type === "credit" ? React.createElement(ArrowDownLeft, { size: 16, color: colors.success }) : React.createElement(ArrowUpRight, { size: 16, color: colors.danger })),
                        React.createElement("div", { className: "flex-1 min-w-0" },
                            React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35 } }, txn.note),
                            React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, walletTimeAgo(txn.ts))),
                        React.createElement("span", { className: "text-sm font-extrabold tabular-nums shrink-0", style: { color: txn.type === "credit" ? colors.success : colors.danger } }, walletAmt(txn.type === "credit" ? "+" : "\u2212", txn.amount)))))),
                transactions.length > 5 && (React.createElement("button", { onClick: () => setNavTab("history"), className: "w-full py-3 text-center" },
                    React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } }, t("ard_kl_alhrkat"))))))),
        navTab === "history" && (React.createElement(React.Fragment, null,
            React.createElement(TopBar, { title: t("sjl_alhrkat"), onBack: onBack }),
            React.createElement("div", { className: "flex-1 overflow-y-auto", style: { backgroundColor: colors.bg } },
                transactions.length > 0 && (() => {
                    const debits = transactions.filter((t) => t.type === "debit").slice(0, 7).reverse();
                    const credits = transactions.filter((t) => t.type === "credit");
                    const inSum = credits.reduce((a, x) => a + x.amount, 0);
                    const outSum = transactions.filter((t) => t.type === "debit").reduce((a, x) => a + x.amount, 0);
                    const max = Math.max(...debits.map((t) => t.amount), 1);
                    return (React.createElement("div", { className: "mx-4 mt-4 rounded-2xl p-4 mb-3", style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                        React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-3` },
                            React.createElement("span", { className: "text-xs font-extrabold", style: { color: colors.text } }, t("alinfaq_alakhyr")),
                            React.createElement("span", { className: "text-xs font-bold", style: { color: colors.primary } },
                                monthlySpent.toLocaleString(wLoc()),
                                t("w_sdg_hdha_alshhr"))),
                        debits.length >= 3
                            ? React.createElement("div", { className: `flex ${rowStart()} items-end gap-1.5`, style: { height: 52 } }, debits.map((txn) => (React.createElement("div", { key: txn.id, className: "flex-1 rounded-t-lg", style: { height: `${Math.max(8, (txn.amount / max) * 52)}px`, backgroundColor: colors.primary + "88" } }))))
                            : React.createElement("div", { className: `flex ${rowStart()} items-stretch gap-2` },
                                [
                                    { label: t("w_dkhl"), value: inSum, color: colors.success },
                                    { label: t("w_msrwf"), value: outSum, color: colors.danger },
                                    { label: t("w_alsafy"), value: inSum - outSum, color: colors.text },
                                ].map((box) => React.createElement("div", { key: box.label, className: "flex-1 rounded-xl px-2 py-2 text-center", style: { backgroundColor: colors.bg } },
                                    React.createElement("div", { className: "text-[9px] mb-0.5", style: { color: colors.textMuted } }, box.label),
                                    React.createElement("div", { className: "text-[11px] font-extrabold tabular-nums", style: { color: box.color } },
                                        walletAmt(box.value > 0 && box.label === t("w_alsafy") ? "+" : (box.value < 0 || (box.value > 0 && box.label === t("w_msrwf"))) ? "\u2212" : "", Math.abs(box.value), false)   /* C222: «مصروف» بإشارة الطرح */))))));   // C221
                })(),
                spendingLimit && (React.createElement("div", { className: "mx-4 mb-3 rounded-xl p-3", style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center justify-between mb-1.5` },
                        React.createElement("span", { className: "text-xs font-bold", style: { color: colors.text } }, t("hd_alinfaq_alshhry")),
                        React.createElement("button", { onClick: () => setView("limit"), className: "rounded-lg px-2 py-1", style: { backgroundColor: colors.primary } },
                            React.createElement("span", { className: "text-[10px] font-bold text-white" }, t("dbt")))),
                    React.createElement("div", { className: "h-2 rounded-full mb-1", style: { backgroundColor: colors.border } },
                        React.createElement("div", { className: "h-2 rounded-full transition-all", style: {
                                width: `${Math.min(100, (monthlySpent / spendingLimit) * 100)}%`,
                                backgroundColor: limitExceeded ? colors.danger : limitNearing ? colors.accent : colors.success,
                            } })),
                    React.createElement("span", { className: "text-[10px]", style: { color: limitExceeded ? colors.danger : colors.textMuted } },
                        monthlySpent.toLocaleString(wLoc()),
                        t("w_mn_"),
                        spendingLimit.toLocaleString(wLoc()),
                        t("w_sdg_sp"),
                        limitExceeded && t("w_tjawzt_alhd")))),
                React.createElement("div", { className: "px-4 mb-2" },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 rounded-xl px-3 py-2`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                        React.createElement(Search, { size: 14, color: colors.textMuted }),
                        React.createElement("input", { dir: isRTL() ? "rtl" : "ltr", value: txSearch, onChange: (e) => setTxSearch(e.target.value), placeholder: t("abhth_fy_alhrkat"), className: "flex-1 text-sm bg-transparent outline-none", style: { color: colors.text } }),
                        txSearch && React.createElement("button", { "aria-label": tl("إغلاق", "Close"), onClick: () => setTxSearch("") },
                            React.createElement(X, { size: 13, color: colors.textMuted })))),
                React.createElement("div", { dir: "rtl", className: "px-4 mb-3 overflow-x-auto", style: { scrollbarWidth: "none", msOverflowStyle: "none" } },
                    React.createElement("div", { className: "flex gap-2", style: { width: "max-content" } }, [
                        // C222: أيقونات Lucide بدل الرموز التعبيريّة (📥 📤 ⚡ 🤍) — كبقيّة التطبيق
                        { id: "all", label: t("w_alkl") },
                        { id: "credit", label: tl("إيداع", "Deposits"), Icon: ArrowDownLeft },
                        { id: "debit", label: tl("سحب", "Withdrawals"), Icon: ArrowUpRight },
                        { id: "services", label: tl("خدمات", "Services"), Icon: Zap },
                        { id: "family", label: tl("عائلة", "Family"), Icon: Users },
                    ].map((f) => (React.createElement("button", { key: f.id, onClick: () => setTxFilter(f.id), className: "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap", style: {
                            backgroundColor: txFilter === f.id ? colors.primary : colors.card,
                            color: txFilter === f.id ? "#fff" : colors.textMuted,
                            border: `1px solid ${txFilter === f.id ? colors.primary : colors.border}`,
                        } }, f.Icon && React.createElement(f.Icon, { size: 12, color: txFilter === f.id ? "#fff" : colors.textMuted }), f.label))))),
                React.createElement("div", { className: "px-4 pb-6" }, (() => {
                    const now2 = new Date();
                    const today = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate());
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    const weekAgo = new Date(today);
                    weekAgo.setDate(today.getDate() - 7);
                    let filtered = transactions.filter((txn) => {
                        var _a, _b, _c, _d, _e, _f;
                        if (txFilter === "credit")
                            return txn.type === "credit";
                        if (txFilter === "debit")
                            return txn.type === "debit";
                        if (txFilter === "services")
                            return txn.type === "debit" && (((_a = txn.note) === null || _a === void 0 ? void 0 : _a.includes(t("w_c_khrba"))) || ((_b = txn.note) === null || _b === void 0 ? void 0 : _b.includes(t("w_c_shhn"))) || ((_c = txn.note) === null || _c === void 0 ? void 0 : _c.includes(t("w_c_intrnt"))) || ((_d = txn.note) === null || _d === void 0 ? void 0 : _d.includes(t("w_wqwd"))));
                        if (txFilter === "family")
                            return ((_e = txn.note) === null || _e === void 0 ? void 0 : _e.includes(t("w_c_aayla"))) || ((_f = txn.note) === null || _f === void 0 ? void 0 : _f.includes(t("w_c_jmya")));
                        return true;
                    });
                    if (txSearch.trim()) {
                        const q = txSearch.trim().toLowerCase();
                        filtered = filtered.filter((t) => { var _a; return ((_a = t.note) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q)) || String(t.amount).includes(q); });
                    }
                    if (filtered.length === 0)
                        return (React.createElement("div", { className: "flex flex-col items-center py-10 gap-2" },
                            React.createElement(Search, { size: 28, color: colors.border }),
                            React.createElement("span", { className: "text-xs", style: { color: colors.textMuted } }, t("la_twjd_ntayj_2"))));
                    const groups = [];
                    const seen2 = {};
                    filtered.forEach((txn) => {
                        const d = new Date(txn.ts);
                        const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        let label;
                        if (dDay.getTime() === today.getTime())
                            label = t("w_alywm");
                        else if (dDay.getTime() === yesterday.getTime())
                            label = t("wqt_ams");
                        else if (dDay >= weekAgo)
                            label = t("w_hdha_alasbwa");
                        else
                            label = d.toLocaleDateString(wLoc(), { month: "long", year: "numeric" });
                        if (!seen2[label]) {
                            seen2[label] = true;
                            groups.push({ label, items: [] });
                        }
                        groups[groups.length - 1].items.push(txn);
                    });
                    return groups.map((g) => (React.createElement(React.Fragment, { key: g.label },
                        React.createElement("div", { className: "text-[11px] font-extrabold mb-2 mt-3", style: { color: colors.textMuted } }, g.label),
                        g.items.map((txn) => (React.createElement("button", { key: txn.id, onClick: () => { setSelectedTransaction(txn); setView("transactionDetail"); }, className: `w-full ${textStart()} block mb-1.5` },
                            React.createElement("div", { className: `flex ${rowStart()} items-center gap-3 rounded-2xl p-3`, style: { backgroundColor: colors.card, border: `1px solid ${colors.border}` } },
                                React.createElement("div", { className: "w-10 h-10 rounded-full flex items-center justify-center shrink-0", style: { backgroundColor: txn.type === "credit" ? colors.success + "18" : colors.danger + "18" } }, txn.type === "credit" ? React.createElement(ArrowDownLeft, { size: 16, color: colors.success }) : React.createElement(ArrowUpRight, { size: 16, color: colors.danger })),
                                React.createElement("div", { className: "flex-1 min-w-0" },
                                    React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35 } }, txn.note),
                                    React.createElement("div", { className: "text-[10px] mt-0.5", style: { color: colors.textMuted } }, new Date(txn.ts).toLocaleTimeString(wLoc(), { hour: "numeric", minute: "2-digit" }))),
                                React.createElement("span", { className: "text-sm font-extrabold tabular-nums shrink-0", style: { color: txn.type === "credit" ? colors.success : colors.danger } }, walletAmt(txn.type === "credit" ? "+" : "\u2212", txn.amount)))))))));
                })())))),
        navTab === "services" && (React.createElement(React.Fragment, null,
            React.createElement(TopBar, { title: t("alkhdmat"), onBack: onBack }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("div", { className: "rounded-2xl p-4 mb-4 relative overflow-hidden", style: { background: WT.grad } },
                    React.createElement("div", { className: "text-xs font-bold text-white mb-0.5" }, t("khdmat_swa")),
                    React.createElement("div", { className: "text-[10px]", style: { color: "rgba(255,255,255,0.6)" } }, t("kl_khdmatk_almalya"))),
                React.createElement("div", { className: "grid grid-cols-2 gap-3 mb-4" }, WALLET_SERVICES.map((svc) => (React.createElement("button", { key: svc.id, onClick: svc.onPress ? svc.onPress : undefined, className: "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center w-full", style: { backgroundColor: colors.card, borderColor: colors.border } },
                    React.createElement("div", { className: "relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0", style: { backgroundColor: WT.tint } },
                        React.createElement(svc.Icon, { size: 26, color: WT.ink }),
                        svc.isNew && (React.createElement("div", { className: "absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-black text-white leading-none", style: { backgroundColor: "#EF4444" } }, t("jdyd")))),
                    React.createElement("div", { className: "min-w-0 w-full" },
                        React.createElement("div", { className: "text-xs font-extrabold", style: { color: svc.isNew ? "#B42318" : colors.text } }, svc.label),
                        React.createElement("div", { className: "text-[10px] mt-0.5 leading-snug", style: { color: colors.textMuted } }, svc.desc))))))))),
        navTab === "settings" && (React.createElement(React.Fragment, null,
            React.createElement(TopBar, { title: t("iadadat_almhfza"), onBack: onBack }),
            React.createElement("div", { className: "flex-1 overflow-y-auto p-4", style: { backgroundColor: colors.bg } },
                React.createElement("div", { className: "rounded-2xl p-4 mb-4 relative overflow-hidden", style: { background: WT.grad } },
                    // C222: الحالة هي العنوان (كان «إعدادات المحفظة» مكرّراً تحت الشريط العلويّ)
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-2 relative` },
                        React.createElement(ShieldCheck, { size: 18, color: kycStatus === "verified" ? "#5CD692" : "#E8A93D", className: "shrink-0" }),
                        React.createElement("div", { className: "text-sm font-bold text-white" }, kycStatus === "verified" ? t("hsabk_mwthq") : t("wthq_hwytk_lfth")))),
                [
                    { label: t("hd_alinfaq_alshhry"), desc: spendingLimit ? `${spendingLimit.toLocaleString(wLoc())} ${t("j_s")}` : t("ghyr_mhdd"), Icon: SlidersHorizontal, bg: "#E3F2FD", ic: "#1565C0", onPress: () => setView("limit") },
                    { label: t("wsayl_aldfa_almrbwta"), desc: (() => { const n = (linkedMethods || []).length; return isRTL() ? (n === 0 ? "لا وسائل بعد" : n === 1 ? "وسيلةٌ واحدة" : n === 2 ? "وسيلتان" : n.toLocaleString(wLoc()) + (n <= 10 ? " وسائل" : " وسيلة")) : n + " " + (n === 1 ? "method" : "methods"); })(), /* C221: كان «0 وسيلة» */ Icon: CreditCard, bg: "#E8F5E9", ic: "#1B5E20", onPress: () => setView("paymentMethods") },
                    { label: t("twthyq_alhwya_kyc"), desc: kycStatus === "verified" ? t("mwthq") : kycStatus === "pending" ? t("qyd_almrajaa") : t("ghyr_mwthq"), Icon: ShieldCheck, bg: "#FFF3E0", ic: "#E65100", onPress: () => setView("kyc") },
                    { label: t("ihsayyat_alinfaq"), desc: `${monthlySpent.toLocaleString(wLoc())} ${t("j_s")} ${t("hdha_alshhr")}`, Icon: BarChart3, bg: "#F3E5F5", ic: "#6A1B9A", onPress: () => setNavTab("history") },
                ].map((item, idx) => (React.createElement("button", { key: idx, onClick: item.onPress, className: `w-full flex ${rowStart()} items-center gap-3 rounded-2xl p-4 border mb-2 text-start`, style: { backgroundColor: colors.card, borderColor: colors.border } },
                    React.createElement("div", { className: "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", style: { backgroundColor: WT.tint } }, React.createElement(item.Icon, { size: 20, color: WT.ink })),
                    React.createElement("div", { className: "flex-1" },
                        React.createElement("div", { className: "text-sm font-bold", style: { color: colors.text } }, item.label),
                        React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, item.desc)),
                    React.createElement(ChevronLeft, { size: 14, color: colors.textMuted, style: { transform: isRTL() ? "none" : "scaleX(-1)" } })))),
                React.createElement("div", { className: "mt-2 rounded-2xl p-4 border", style: { backgroundColor: walletFrozen ? colors.warning + "1F" : colors.card, borderColor: walletFrozen ? colors.accent : colors.border } },
                    React.createElement("div", { className: `flex ${rowStart()} items-center gap-3` },
                        React.createElement("div", { className: "w-11 h-11 rounded-xl flex items-center justify-center shrink-0", style: { backgroundColor: walletFrozen ? colors.accent + "26" : colors.danger + "1F" } }, walletFrozen ? React.createElement(Lock, { size: 20, color: colors.accent }) : React.createElement(Snowflake, { size: 20, color: colors.danger })),
                        React.createElement("div", { className: "flex-1" },
                            React.createElement("div", { className: "text-sm font-bold", style: { color: walletFrozen ? colors.accent : colors.danger } }, walletFrozen ? t("w_almhfza_mjmda") : t("w_tjmyd_almhfza")),
                            React.createElement("div", { className: "text-xs mt-0.5", style: { color: colors.textMuted } }, walletFrozen ? t("w_kl_alamlyat") : t("w_awqf_kl"))),
                        React.createElement("button", { onClick: () => { if (walletFrozen)
                                setWalletFrozen(false);
                            else
                                setConfirmFreeze(true); }, className: "rounded-xl px-3 py-2 text-xs font-extrabold", style: { backgroundColor: walletFrozen ? colors.accent : colors.danger, color: "#fff" } }, walletFrozen ? t("w_ilgha") : t("w_tjmyd")))),
                confirmFreeze && (React.createElement(React.Fragment, null,
                    React.createElement("div", { onClick: () => setConfirmFreeze(false), style: { position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,0.5)" } }),
                    React.createElement("div", { className: "sawa-pop-in", style: { position: "fixed", left: 20, right: 20, top: "30%", zIndex: 51, backgroundColor: colors.card, borderRadius: 20, padding: 20 } },
                        React.createElement("div", { className: "flex flex-col items-center mb-4" },
                            React.createElement("div", { className: "w-14 h-14 rounded-full flex items-center justify-center mb-3", style: { backgroundColor: colors.danger + "1F" } },
                                React.createElement(Snowflake, { size: 28, color: colors.danger })),
                            React.createElement("p", { className: "text-sm font-extrabold text-center", style: { color: colors.text } }, t("tjmyd_almhfza_swal")),
                            React.createElement("p", { className: "text-xs text-center mt-2", style: { color: colors.textMuted } }, t("stwqf_kl_amlyat"))),
                        React.createElement("button", { onClick: () => { setWalletFrozen(true); setConfirmFreeze(false); }, className: "w-full py-3 rounded-xl text-sm font-extrabold text-white mb-2", style: { backgroundColor: colors.danger } }, t("nam_jmd_almhfza")),
                        React.createElement("button", { onClick: () => setConfirmFreeze(false), className: "w-full py-3 rounded-xl text-sm font-bold", style: { color: colors.textMuted, border: `1px solid ${colors.border}` } }, t("ilgha")))))))),
        React.createElement(WalletNavBar, { navTab: navTab, setNavTab: setNavTab, colors: colors })));
}
function WalletLockScreen({ onUnlock, onBack, walletPasskeyId, onPasskeyRegistered, walletPin, onSetWalletPin }) {
    const { colors } = useTheme();
    const [webauthnStatus, setWebauthnStatus] = useState("");
    const [pinInput, setPinInput] = useState("");
    const [setupPin, setSetupPin] = useState("");
    const [webauthnSupported] = useState(() => !!window.PublicKeyCredential);
    async function handleRegisterPasskey() {
        setWebauthnStatus(tl("جاري التسجيل...", "Registering..."));
        const result = await registerWalletPasskey();
        if (result.ok) {
            onPasskeyRegistered(result.credentialId);
            setWebauthnStatus(tl("تم التسجيل! اضغط 'افتح ببصمة الجهاز' الآن", "Registered! Now tap 'Unlock with device biometrics'"));
        }
        else {
            setWebauthnStatus(t("tadhr_altsjyl", { error: result.error }));
        }
    }
    async function handleAuthenticate() {
        setWebauthnStatus(tl("جاري التحقق...", "Verifying..."));
        const result = await authenticateWalletPasskey(walletPasskeyId);
        if (result.ok)
            onUnlock();
        else
            setWebauthnStatus(t("fshl_althqq", { error: result.error }));
    }
    if (!walletPin && !walletPasskeyId) {
        // أول استخدام — لازم يُعدّ رمز المحفظة أو بصمة الجهاز قبل أي دخول
        return (React.createElement("div", { dir: isRTL() ? "rtl" : "ltr", className: "flex-1 min-h-0 flex flex-col" },
            React.createElement(TopBar, { title: t("iadad_aman_almhfza"), onBack: onBack }),
            React.createElement("div", { className: "flex-1 overflow-y-auto flex flex-col items-center justify-center p-6", style: { backgroundColor: colors.bg } },
                React.createElement(Wallet, { size: 40, color: colors.primary }),
                React.createElement("h3", { className: "text-base font-extrabold mt-3 mb-1", style: { color: colors.text } }, t("amn_mhfztk_awla")),
                React.createElement("p", { className: "text-xs mb-4 text-center", style: { color: colors.textMuted } }, t("rmz_mnfsl_tmama_an")),
                React.createElement("input", { dir: "ltr", value: setupPin, onChange: (e) => setSetupPin(e.target.value.replace(/\D/g, "").slice(0, 6)), placeholder: t("rmz_almhfza_4_6"), className: "w-full max-w-[240px] border rounded-xl px-3 py-3 text-sm mb-3 text-center tracking-widest", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
                React.createElement(Button, { label: t("hfz_rmz_almhfza"), onPress: () => setupPin.length >= 4 && onSetWalletPin(setupPin), disabled: setupPin.length < 4, style: { width: 240 } }),
                webauthnSupported && (React.createElement(React.Fragment, null,
                    React.createElement("span", { className: "text-xs my-3", style: { color: colors.textMuted } }, t("aw")),
                    React.createElement(Button, { icon: Fingerprint, label: t("sjl_bsma_aljhaz_webauthn"), onPress: handleRegisterPasskey, variant: "outline", style: { width: 240 } }))),
                !!webauthnStatus && React.createElement("p", { className: "text-[11px] mt-3 text-center", style: { color: colors.textMuted } }, webauthnStatus))));
    }
    // شاشة الدخول — PIN موجود أو بصمة مسجّلة
    return (React.createElement("div", { className: "flex-1 min-h-0 flex flex-col" },
        React.createElement(TopBar, { title: t("almhfza"), onBack: onBack }),
        React.createElement("div", { className: "flex-1 overflow-y-auto flex flex-col items-center justify-center p-6", style: { backgroundColor: colors.bg } },
            React.createElement(Wallet, { size: 40, color: colors.primary }),
            React.createElement("h3", { className: "text-base font-extrabold mt-3 mb-1", style: { color: colors.text } }, t("fth_almhfza")),
            React.createElement("p", { className: "text-xs mb-4 text-center", style: { color: colors.textMuted } }, t("adkhl_rmz_almhfza")),
            React.createElement("input", { dir: "ltr", type: "password", value: pinInput, onChange: (e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)), placeholder: "\u2022\u2022\u2022\u2022", maxLength: 6, className: "w-full max-w-[240px] border rounded-xl px-3 py-3 text-sm mb-3 text-center tracking-widest font-bold", style: { borderColor: colors.border, color: colors.text, backgroundColor: colors.card } }),
            React.createElement(Button, { label: t("fth_balrmz"), disabled: pinInput.length < 4, onPress: () => { if (pinInput === walletPin) {
                    onUnlock();
                    setPinInput("");
                }
                else {
                    setWebauthnStatus(t("rmz_almhfza_ghyr_shyh"));
                    setPinInput("");
                } }, style: { width: 240 } }),
            walletPasskeyId && (React.createElement(Button, { icon: Fingerprint, label: t("fth_bbsma_aljhaz"), onPress: handleAuthenticate, variant: "outline", style: { width: 240, marginTop: 8 } })),
            !!webauthnStatus && React.createElement("p", { className: "text-[11px] mt-3 text-center", style: { color: colors.danger } }, webauthnStatus))));
}
// ============================================================================
// إطار الجوال — مطابق تماماً لإطار سوا الحقيقي
// ============================================================================
function PhoneFrame({ children, dir: framedir = "rtl" }) {
    const { colors } = useTheme();
    useEffect(() => {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
      @keyframes sawaPopIn {
        from { opacity: 0; transform: scale(0.94) translateY(-4px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .sawa-pop-in { animation: sawaPopIn 0.16s ease-out; transform-origin: top left; }
      @keyframes sawaFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .sawa-fade-in { animation: sawaFadeIn 0.18s ease-out; }
    `;
        document.head.appendChild(styleEl);
        return () => document.head.removeChild(styleEl);
    }, []);
    // C62: على الهاتف (أو التطبيق المثبّت، أو أيّ شاشةٍ أضيق من 640 أو أقصر من 780) يملأ التطبيق الشاشة كلّها —
    //      كان يُعرض داخل «بطاقة هاتف» بحوافّ زرقاء وزوايا مدوّرة (تصميم معاينة لسطح المكتب) فيضيع جزءٌ من الشاشة.
    const fullNow = () => {
        try {
            const w = window.innerWidth, h = window.innerHeight;
            const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true || String(document.referrer || "").indexOf("android-app://") === 0;
            const touch = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
            return standalone || touch || w < 640 || h < 780;
        } catch (e) { return true; }
    };
    const [full, setFull] = useState(fullNow);
    useEffect(() => {
        const on = () => setFull(fullNow());
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, []);
    useEffect(() => {
        // شريط الحالة ولون خلفيّة الصفحة يطابقان التطبيق حين يملأ الشاشة
        try { document.documentElement.style.background = document.body.style.background = full ? colors.bg : ""; } catch (e) { }
    }, [full, colors.bg]);
    if (full) {
        return (React.createElement("div", { dir: framedir, className: "w-full flex flex-col", style: { height: "100%", backgroundColor: colors.bg, paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)", boxSizing: "border-box" } },
            React.createElement("div", { className: "w-full flex-1 min-h-0 flex flex-col overflow-hidden relative", style: { backgroundColor: colors.bg, transform: "translateZ(0)" } }, children)));
    }
    return (React.createElement("div", { dir: framedir, className: "w-full flex items-center justify-center p-4", style: { height: "100vh", background: `radial-gradient(circle at 25% 15%, ${colors.primary}, ${colors.primaryDark} 70%)` } },
        React.createElement("div", { className: "w-full max-w-md flex flex-col overflow-hidden relative", style: { height: "min(700px, calc(100vh - 32px))", borderRadius: "28px", backgroundColor: colors.bg, boxShadow: "0 30px 60px rgba(0,0,0,0.45)", transform: "translateZ(0)" } }, children)));
}
// labelKey لا label: هذه المصفوفة تُقيَّم مرة واحدة عند تحميل الملف،
// فاستدعاء t() هنا يتجمّد على لغة الإقلاع ولا يتبدّل مع تغيير اللغة.
// الترجمة تتم وقت الرسم في الشريط السفلي.
const tabs = [
    { key: "me", labelKey: "nav_hsaby", icon: User },
    { key: "discover", labelKey: "nav_istkshf", icon: Compass },
    { key: "contacts", labelKey: "nav_jhat_alatsal", icon: Users },
    { key: "calls", labelKey: "nav_mkalmat", icon: Phone },
    { key: "chats", labelKey: "nav_mhadthat", icon: MessageCircle },
];
// جولة التعريف الأولى — 5 شرائح، بنفس المعنى الموثّق (مُعاد صياغته وليس نسخاً حرفياً)
//@@sawa-part:7
