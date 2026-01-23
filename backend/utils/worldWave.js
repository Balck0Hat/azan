// backend/utils/worldWave.js
const moment = require("moment-timezone");
const PrayerTime = require("../models/PrayerTime");

module.exports = async function worldWave(limit = 5) {
    const now = moment.utc();
    const today = now.clone().startOf("day");
    const tomorrow = today.clone().add(1, "day");

    // جلب صلوات اليوم لكل المدن
    const docs = await PrayerTime.find({
        date: { $gte: today.toDate(), $lt: tomorrow.toDate() }
    }).limit(5000).lean();

    const results = [];
    const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

    for (let d of docs) {
        const tz = d.timezone;
        const times = d.timings;
        const city = d.cityName;
        const country = d.country;

        let found = false;

        for (let pName of order) {
            const pTime = times[pName];
            if (!pTime) continue;

            // بناء وقت الصلاة مع التاريخ الصحيح
            const prayerLocal = moment.tz(`${d.date.toISOString().slice(0,10)} ${pTime}`, "YYYY-MM-DD HH:mm", tz);
            const nowTz = moment().tz(tz);

            if (prayerLocal.isAfter(nowTz)) {
                results.push({
                    city,
                    country,
                    prayerName: pName,
                    localTime: prayerLocal.format("HH:mm"),
                    countdownHuman: prayerLocal.from(nowTz)
                });
                found = true;
                break;
            }
        }

        // إذا انتهت كل الصلوات اليوم، أضف فجر الغد
        if (!found && times["Fajr"]) {
            const nextDay = moment(d.date).add(1, "day").toISOString().slice(0,10);
            const fajrLocal = moment.tz(`${nextDay} ${times["Fajr"]}`, "YYYY-MM-DD HH:mm", tz);
            const nowTz = moment().tz(tz);

            results.push({
                city,
                country,
                prayerName: "Fajr (Tomorrow)",
                localTime: fajrLocal.format("HH:mm"),
                countdownHuman: fajrLocal.from(nowTz)
            });
        }
    }

    // ترتيب النتائج حسب أقرب وقت فعلي (مع التاريخ)
    results.sort((a, b) => {
        const ta = moment(a.localTime, "HH:mm");
        const tb = moment(b.localTime, "HH:mm");
        return ta - tb;
    });

    return results.slice(0, limit);
};
