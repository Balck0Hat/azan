const moment = require("moment-timezone");

module.exports = function calcNextPrayer(times, timezone, baseDateUTC = null) {
    const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

    // التاريخ اليوم من الداتابيس (UTC)
    const base = baseDateUTC ? moment.utc(baseDateUTC) : moment.utc();

    const now = moment().tz(timezone);

    for (let p of order) {
        const [H, M] = times[p].split(":").map(Number);

        // نبني وقت الأذان كـ UTC
        const prayerUtc = moment.utc(base).hour(H).minute(M).second(0);

        // نعمله تحويل للـ timezone
        const prayerLocal = prayerUtc.clone().tz(timezone);

        if (prayerLocal.isAfter(now)) {
            return {
                prayerName: p,
                localTime: prayerLocal.format("HH:mm"),
                countdownHuman: prayerLocal.from(now),
            };
        }
    }

    // لو كلهم مرقوا — فجر بكرة
    const [fh, fm] = times["Fajr"].split(":").map(Number);
    const tomorrowUtc = moment.utc(base).add(1, "day").hour(fh).minute(fm);

    const fajrLocal = tomorrowUtc.clone().tz(timezone);

    return {
        prayerName: "Fajr (Tomorrow)",
        localTime: fajrLocal.format("HH:mm"),
        countdownHuman: fajrLocal.from(now),
    };
};
