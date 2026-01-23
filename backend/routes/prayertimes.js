// routes/prayertimes.js
const express = require('express');
const router = express.Router();
const PrayerTime = require('../models/PrayerTime');
const WINDOW_MINUTES = 5;

const getClientLocation = require("../utils/getClientLocation");
const calcNextPrayer = require("../utils/calcNextPrayer");
const worldWave = require("../utils/worldWave");

// helper للفورمات تبع تاريخ اليوم UTC
function getDayRangeLocal(date) {
    const y = date.getFullYear();   // محلي (نفس وقت السيرفر)
    const m = date.getMonth();
    const d = date.getDate();

    // نخزن كبداية اليوم لكن بصيغة UTC، زي ما عملت في السكربت
    const start = new Date(Date.UTC(y, m, d));
    const end = new Date(Date.UTC(y, m, d + 1));

    return {start, end};
}

// حوّل HH:MM (UTC) إلى وقت محلي حسب timezone المدينة
function utcStringToLocal(str, baseDate, timeZone) {
    if (!str) return null;
    const parts = str.split(":");
    if (parts.length !== 2) return str;

    const H = Number(parts[0]);
    const M = Number(parts[1]);
    if (Number.isNaN(H) || Number.isNaN(M)) return str;

    const d = baseDate || new Date();
    const utcDate = new Date(
        Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            H,
            M
        )
    );

    try {
        return new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: timeZone || "UTC",
        }).format(utcDate);
    } catch (e) {
        console.warn("⚠️ /today timezone unsupported, fallback UTC:", timeZone);
        // لو التايمزون مش مدعوم (زي بعض الحالات على وندوز) نرجع نفس UTC
        return str;
    }
}


// ================== GET /api/prayertimes/today ==================
// مثال: /api/prayertimes/today?city=Amman
// أو  /api/prayertimes/today?city=Amman&date=2025-11-22
router.get('/today', async (req, res) => {
    try {
        const {city, date} = req.query;

        if (!city) {
            return res.status(400).json({message: 'param city مطلوب'});
        }

        let start, end;

        if (date) {
            // نتوقع yyyy-mm-dd
            const [y, m, d] = date.split('-').map(Number);
            if (!y || !m || !d) {
                return res.status(400).json({message: 'صيغة التاريخ لازم تكون yyyy-mm-dd'});
            }
            start = new Date(Date.UTC(y, m - 1, d));
            end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 1);
        } else {
            const now = new Date();
            ({start, end} = getDayRangeLocal(now));
        }

        // أولاً نحاول اسم مطابق تماماً (case insensitive)
        let doc = await PrayerTime.findOne({
            cityName: new RegExp(`^${city}$`, 'i'),
            date: {$gte: start, $lt: end}
        });

        // لو ما لقينا، نعمل contains search بسيط
        if (!doc) {
            doc = await PrayerTime.findOne({
                cityName: new RegExp(city, 'i'),
                date: {$gte: start, $lt: end}
            });
        }

        if (!doc) {
            return res.status(404).json({message: 'ما لقينا أوقات صلاة لهاي المدينة في هذا اليوم'});
        }

        const localTimings = {};
        for (const [key, value] of Object.entries(doc.timings || {})) {
            localTimings[key] = utcStringToLocal(value, doc.date, doc.timezone);
        }

        return res.json({
            cityName: doc.cityName,
            country: doc.country,
            timezone: doc.timezone,
            date: doc.date,
            timings: localTimings    // أوقات محلية للمدينة
        });

    } catch (err) {
        console.error('GET /today error:', err);
        return res.status(500).json({message: 'مشكلة داخلية في السيرفر'});
    }
});

// ================== GET /api/prayertimes/now ==================
// مثال: /api/prayertimes/now?prayer=Maghrib
router.get('/now', async (req, res) => {
    try {
        let {prayer} = req.query;
        const allowed = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        if (!prayer) prayer = 'Maghrib';
        if (!allowed.includes(prayer)) {
            return res
                .status(400)
                .json({message: 'prayer لازم تكون وحدة من: Fajr, Dhuhr, Asr, Maghrib, Isha'});
        }

        const now = new Date();
        const {start, end} = getDayRangeLocal(now); // نفس الفانكشن اللي عدلناها قبل

        // نحسب window ±10 دقائق حوالين الوقت الحالي (UTC)
        const pad = (n) => (n < 10 ? '0' + n : '' + n);
        const toMinutes = (h, m) => h * 60 + m;

        const hh = now.getUTCHours();
        const mm = now.getUTCMinutes();
        const nowMin = toMinutes(hh, mm);
        const minMin = nowMin - WINDOW_MINUTES;
        const maxMin = nowMin + WINDOW_MINUTES;


        const targets = [];
        for (let t = minMin; t <= maxMin; t++) {
            if (t < 0 || t >= 24 * 60) continue;
            const H = Math.floor(t / 60);
            const M = t % 60;
            targets.push(`${pad(H)}:${pad(M)}`); // أوقات الأذان المخزنة في الداتابيس (UTC)
        }

        const field = `timings.${prayer}`;

        const docs = await PrayerTime.find({
            date: {$gte: start, $lt: end},
            [field]: {$in: targets}
        })
            // .limit(200)
            .lean();

        // نحول الوقت من UTC → Local لكل مدينة حسب الـ timezone
        const cities = docs.map((d) => {
            const utcStr = d.timings?.[prayer]; // مثلا "22:28"
            if (!utcStr) {
                return {
                    cityName: d.cityName,
                    country: d.country,
                    timezone: d.timezone,
                    timeUtc: null,
                    timeLocal: null
                };
            }

            const [H, M] = utcStr.split(':').map(Number);
            // نبني Date UTC باستخدام تاريخ الدوكمنت ووقت الأذان
            const baseDate = d.date || start;
            const utcDate = new Date(
                Date.UTC(
                    baseDate.getUTCFullYear(),
                    baseDate.getUTCMonth(),
                    baseDate.getUTCDate(),
                    H,
                    M
                )
            );

            // نعمل فورمات حسب timezone المدينة (وقت محلي)
            let localTime = utcStr;
            try {
                localTime = new Intl.DateTimeFormat('en-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: d.timezone || 'UTC'
                }).format(utcDate);
            } catch (e) {
                // لو صار أي خطأ في الـ timezone نخليها نفس utcStr
                localTime = utcStr;
            }

            return {
                cityName: d.cityName,
                country: d.country,
                timezone: d.timezone,
                lat : d.latitude,
                lng : d.longitude,
                timeUtc: utcStr,   // وقت الأذان بالـ UTC
                timeLocal: localTime // وقت الأذان المحلي للمدينة
            };
        });

        return res.json({
            prayer,
            count: cities.length,
            cities
        });
    } catch (err) {
        console.error('GET /now error:', err);
        return res.status(500).json({message: 'مشكلة داخلية في السيرفر'});
    }
});

// ================== GET /api/prayertimes/now/summary ==================
// يرجع عدد المدن التي يُؤذَّن فيها الآن لكل صلاة + المجموع الكلي
router.get('/now/summary', async (req, res) => {
    try {
        const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        const now = new Date();
        const {start, end} = getDayRangeLocal(now); // نفس الهيلبر اللي مستخدمه فوق

        // window ±10 دقائق حوالين الوقت الحالي (UTC)
        const pad = (n) => (n < 10 ? '0' + n : '' + n);
        const toMinutes = (h, m) => h * 60 + m;

        const hh = now.getUTCHours();
        const mm = now.getUTCMinutes();
        const nowMin = toMinutes(hh, mm);
        const minMin = nowMin - WINDOW_MINUTES;
        const maxMin = nowMin + WINDOW_MINUTES;

        const targets = [];
        for (let t = minMin; t <= maxMin; t++) {
            if (t < 0 || t >= 24 * 60) continue;
            const H = Math.floor(t / 60);
            const M = t % 60;
            targets.push(`${pad(H)}:${pad(M)}`);
        }

        // نعدّ لكل صلاة لحال
        const counts = {};
        await Promise.all(
            PRAYERS.map(async (p) => {
                const field = `timings.${p}`;
                const c = await PrayerTime.countDocuments({
                    date: {$gte: start, $lt: end},
                    [field]: {$in: targets}
                });
                counts[p] = c;
            })
        );

        // عدد المدن اللي فيها أي صلاة الآن (بدون ما نهتم أي وحدة)
        const anyFilter = {
            date: {$gte: start, $lt: end},
            $or: PRAYERS.map((p) => ({
                [`timings.${p}`]: {$in: targets}
            }))
        };

        const totalAny = await PrayerTime.countDocuments(anyFilter);

        return res.json({
            nowUtc: now.toISOString(),
            windowMinutes: WINDOW_MINUTES,
            perPrayer: counts,
            totalAny
        });
    } catch (err) {
        console.error('GET /now/summary error:', err);
        return res.status(500).json({message: 'مشكلة داخلية في السيرفر'});
    }
});


// ================== GET /api/prayertimes/local/today ==================
router.get('/local/today', async (req, res) => {
    try {
        const loc = await getClientLocation(req);
        if (!loc) {
            return res.status(400).json({message: "تعذّر تحديد موقعك."});
        }

        const {city} = loc;

        // نجيب أوقات الصلاة لمدينتك من الداتابيس
        const now = new Date();
        const {start, end} = getDayRangeLocal(now);

        let doc = await PrayerTime.findOne({
            cityName: new RegExp(`^${city}$`, "i"),
            date: {$gte: start, $lt: end}
        });

        if (!doc) {
            return res.status(404).json({message: "لا يوجد بيانات لهذه المدينة اليوم."});
        }

        const localTimings = {};
        for (const [k, v] of Object.entries(doc.timings)) {
            localTimings[k] = utcStringToLocal(v, doc.date, doc.timezone);
        }

        return res.json({
            city,
            country: doc.country,
            timezone: doc.timezone,
            times: localTimings
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({message: "خطأ أثناء جلب وقت مدينتك."});
    }
});

const axios = require("axios");
const moment = require("moment-timezone");

// لحساب مسافة بين نقطتين (بالكيلومتر)
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // نصف قطر الأرض
    const toRad = (x) => (x * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(a));
}

// ================== GET /api/prayertimes/next-for-me ==================
router.get("/next-for-me", async (req, res) => {
    try {
        // ------------ 1) نجيب IP المستخدم ------------
        let ip =
            req.headers["x-forwarded-for"] ||
            req.connection.remoteAddress ||
            req.ip;

// لو شغّال لوكال، استخدم auto-detect
        if (
            !ip ||
            ip === "127.0.0.1" ||
            ip === "::1" ||
            ip === "::ffff:127.0.0.1"
        ) {
            ip = ""; // ipwho.is سيعرف IP الحقيقي تلقائياً
        }


        // ------------ 2) نجيب الإحداثيات من ip-api ------------
        // const locRes = await axios.get(`http://ip-api.com/json/${ip}`);
        const locRes = await axios.get(`https://ipwho.is/${ip}`);

        const userLat = locRes.data.latitude;
        const userLon = locRes.data.longitude;
        const country = locRes.data.country;
        const city = locRes.data.city;

        if (!locRes.data.success) {
            return res.status(400).json({
                message: "تعذّر تحديد موقعك.",
                "ip": ip,
                "city": city,
                "country": country,
                "userLat":userLat,
                "userLon":userLon
            });
        }



        // ------------ 3) نجيب كل مدن اليوم من DB ------------
        // const now = new Date();
        // const y = now.getUTCFullYear();
        // const m = now.getUTCMonth();
        // const d = now.getUTCDate();
        //
        // const start = new Date(Date.UTC(y, m, d));
        // const end = new Date(Date.UTC(y, m, d + 1));
        const { start, end } = getDayRangeLocal(new Date());

        const cities = await PrayerTime.find({
            date: {$gte: start, $lt: end}
        }).lean();

        if (!cities.length) {
            return res.status(500).json({
                message: "لا يوجد بيانات لليوم.",
                "ip": ip,
                "city": city,
                "country": country,
                "userLat":userLat,
                "userLon":userLon
            });
        }

        // ------------ 4) نلاقي أقرب مدينة للمستخدم ------------
        let closest = null;
        let minDist = Infinity;

        for (let c of cities) {
            const dist = haversine(
                userLat,
                userLon,
                c.latitude,
                c.longitude
            );

            if (dist < minDist) {
                minDist = dist;
                closest = c;
            }
        }

        if (!closest) {
            return res.status(500).json({
                message: "تعذّر إيجاد مدينة قريبة.",
                "ip": ip,
                "city": city,
                "country": country
            });
        }

        // ------------ 5) حساب أوقات الصلاة المحلية ------------
        const tz = closest.timezone;
        const times = closest.timings;

        const nowLocal = moment().tz(tz);
        const baseUtc = moment.utc(closest.date);

        const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
        let nextPrayer = null;

        for (let p of order) {
            const [H, M] = times[p].split(":").map(Number);

            const prayerUtc = baseUtc.clone().hour(H).minute(M).second(0);
            const prayerLocal = prayerUtc.clone().tz(tz);

            if (prayerLocal.isAfter(nowLocal)) {
                nextPrayer = {
                    prayerName: p,
                    localTime: prayerLocal.format("HH:mm"),
                    countdownHuman: prayerLocal.from(nowLocal)
                };
                break;
            }
        }

        // ------------ 6) لو كل اليوم خلص → فجر بكرة ------------
        if (!nextPrayer) {
            const [fh, fm] = times["Fajr"].split(":").map(Number);
            const tomorrowUtc = baseUtc.clone().add(1, "day").hour(fh).minute(fm);
            const fajrLocal = tomorrowUtc.clone().tz(tz);

            nextPrayer = {
                prayerName: "Fajr (Tomorrow)",
                localTime: fajrLocal.format("HH:mm"),
                countdownHuman: fajrLocal.from(nowLocal)
            };
        }

        // ------------ 7) النتيجة النهائية ------------
        return res.json({
            city: closest.cityName,
            country: closest.country,
            timezone: tz,
            nextPrayer
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({message: "خطأ داخلي في السيرفر."});
    }
});

// ================== GET /api/prayertimes/adhan-wave ==================
router.get("/adhan-wave", async (req, res) => {
    try {
        const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
        const COLORS = {
            Fajr: "#3B82F6",     // أزرق
            Dhuhr: "#FACC15",   // أصفر
            Asr: "#FB923C",     // برتقالي
            Maghrib: "#EF4444", // أحمر
            Isha: "#8B5CF6"     // بنفسجي
        };

        const now = new Date();
        const { start, end } = getDayRangeLocal(now);

        const hh = now.getUTCHours();
        const mm = now.getUTCMinutes();
        const nowMinutes = hh * 60 + mm;

        const windowMin = nowMinutes - 10;
        const windowMax = nowMinutes + 10;

        const targets = [];
        for (let m = windowMin; m <= windowMax; m++) {
            if (m < 0 || m >= 24 * 60) continue;
            const H = Math.floor(m / 60);
            const M = m % 60;
            targets.push(
                `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`
            );
        }

        const waves = [];

        for (let p of PRAYERS) {
            const field = `timings.${p}`;

            const docs = await PrayerTime.find({
                date: { $gte: start, $lt: end },
                [field]: { $in: targets }
            })
                .select("longitude country cityName")
                .lean();

            if (!docs.length) continue;

            waves.push({
                prayer: p,
                color: COLORS[p],
                longitudes: docs.map((d) => d.longitude).sort((a, b) => a - b),
                count: docs.length
            });
        }

        return res.json({
            nowUtc: now.toISOString(),
            waves
        });

    } catch (err) {
        console.error("ADHAN-WAVE ERROR:", err);
        return res.status(500).json({ message: "خطأ داخلي في السيرفر." });
    }
});


module.exports = router;
