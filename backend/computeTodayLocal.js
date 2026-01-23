// computeTodayLocal_fast.js
// نحسب أوقات "اليوم + بكرة" لكل المدن ونخزّنهم في MongoDB
// - ما منمسح الكولكشن كله
// - منشيّك إذا اليوم + بكرة موجودين كاملين، ساعتها ما نعمل إشي
// - مصمّم يشتغل كـ Script مستقل أو كدالة تستدعى من الباك إند

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const adhan = require("adhan");

const PrayerTime = require("./models/PrayerTime");
const countriesMap = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "countries.json"), "utf8")
);

const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/azan";

// ============= helpers =============
function pad(n) {
    return n < 10 ? "0" + n : "" + n;
}
function isValidDate(d) {
    return d instanceof Date && !isNaN(d.getTime());
}
function formatUtc(dateObj) {
    if (!isValidDate(dateObj)) return null;
    const h = dateObj.getUTCHours();
    const m = dateObj.getUTCMinutes();
    return `${pad(h)}:${pad(m)}`;
}
function toMinutesSinceMidnightUtc(dateObj) {
    if (!isValidDate(dateObj)) return null;
    return dateObj.getUTCHours() * 60 + dateObj.getUTCMinutes();
}
function minusMinutes(dateObj, minutes) {
    if (!isValidDate(dateObj)) return null;
    return new Date(dateObj.getTime() - minutes * 60000);
}
function makeWindow(startMinutes, endMinutes) {
    if (
        typeof startMinutes === "number" &&
        typeof endMinutes === "number" &&
        endMinutes > startMinutes
    ) {
        return { start: startMinutes, end: endMinutes };
    }
    return null;
}

// نحسب دوكيومنت كامل لمدينة معيَّنة في تاريخ معيَّن (targetDate = Date UTC لليوم)
function computeForCity(city, targetDate, params) {
    const { name, ascii, lat, lng, country, timezone } = city;

    if (
        lat === undefined ||
        lng === undefined ||
        isNaN(lat) ||
        isNaN(lng)
    ) {
        return null;
    }

    let pt, sunnah;
    let qiblaDirection = null;

    try {
        const coords = new adhan.Coordinates(lat, lng);
        pt = new adhan.PrayerTimes(coords, targetDate, params);
        sunnah = new adhan.SunnahTimes(pt);

        if (typeof adhan.Qibla === "function") {
            qiblaDirection = adhan.Qibla(coords);
        }
    } catch (e) {
        console.warn(
            "❌ Failed to build PrayerTimes for city:",
            name,
            country,
            e.message
        );
        return null;
    }

    const timings = {
        Fajr: formatUtc(pt.fajr),
        Sunrise: formatUtc(pt.sunrise),
        Dhuhr: formatUtc(pt.dhuhr),
        Asr: formatUtc(pt.asr),
        Maghrib: formatUtc(pt.maghrib),
        Isha: formatUtc(pt.isha),
        Imsak: formatUtc(minusMinutes(pt.fajr, 10)),
        Midnight: formatUtc(sunnah.middleOfTheNight),
        Lastthird: formatUtc(sunnah.lastThirdOfTheNight),
    };

    const numericTimings = {
        Fajr: toMinutesSinceMidnightUtc(pt.fajr),
        Sunrise: toMinutesSinceMidnightUtc(pt.sunrise),
        Dhuhr: toMinutesSinceMidnightUtc(pt.dhuhr),
        Asr: toMinutesSinceMidnightUtc(pt.asr),
        Maghrib: toMinutesSinceMidnightUtc(pt.maghrib),
        Isha: toMinutesSinceMidnightUtc(pt.isha),
        Imsak: toMinutesSinceMidnightUtc(minusMinutes(pt.fajr, 10)),
        Midnight: toMinutesSinceMidnightUtc(sunnah.middleOfTheNight),
        Lastthird: toMinutesSinceMidnightUtc(sunnah.lastThirdOfTheNight),
    };

    const prayerWindows = {
        Fajr: makeWindow(numericTimings.Fajr, numericTimings.Sunrise),
        Dhuhr: makeWindow(numericTimings.Dhuhr, numericTimings.Asr),
        Asr: makeWindow(numericTimings.Asr, numericTimings.Maghrib),
        Maghrib: makeWindow(numericTimings.Maghrib, numericTimings.Isha),
        Isha: makeWindow(numericTimings.Isha, 1440),
    };

    let dayLengthMinutes = null;
    let nightLengthMinutes = null;
    if (isValidDate(pt.sunrise) && isValidDate(pt.maghrib)) {
        const dayMs = pt.maghrib.getTime() - pt.sunrise.getTime();
        if (!Number.isNaN(dayMs) && dayMs > 0) {
            dayLengthMinutes = Math.round(dayMs / 60000);
            nightLengthMinutes = 1440 - dayLengthMinutes;
        }
    }

    const solar = {
        dawn: timings.Fajr,
        sunrise: timings.Sunrise,
        sunset: timings.Maghrib,
        dusk: timings.Isha,
        transit: timings.Dhuhr,
    };

    return {
        cityName: name,
        asciiName: ascii,
        country: countriesMap[country],
        latitude: lat,
        longitude: lng,
        timezone,
        date: targetDate,
        timings,
        numericTimings,
        prayerWindows,
        qiblaDirection,
        dayLengthMinutes,
        nightLengthMinutes,
        solar,
        raw: {
            method: "adhan-js-local",
            paramsUsed: { method: "MuslimWorldLeague", madhab: "Shafi" },
        },
    };
}

// ============= MAIN RUN FUNCTION =============
async function run() {
    // لو مفيش اتصال، احنا نفتح ونسكّر
    const shouldManageConnection = mongoose.connection.readyState === 0;

    try {
        if (shouldManageConnection) {
            console.log("🔌 Connecting to MongoDB...");
            await mongoose.connect(MONGODB_URI);
            console.log("✅ Connected");
        } else {
            console.log("🔌 Using existing MongoDB connection");
        }

        // باراميترات الحساب
        const params = adhan.CalculationMethod.MuslimWorldLeague();
        params.madhab = adhan.Madhab.Shafi;

        // نقرأ المدن أولاً عشان نعرف expected count
        const citiesPath = path.join(__dirname, "cities.json");
        if (!fs.existsSync(citiesPath)) {
            console.error("❌ ملف cities.json مش موجود");
            throw new Error("cities.json not found");
        }
        const allCities = JSON.parse(fs.readFileSync(citiesPath, "utf8"));
        const expectedCities = allCities.length;
        console.log("🌍 Total cities:", expectedCities);

        const now = new Date();
        const today = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        ));
        const tomorrow = new Date(Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate() + 1
        ));

        console.log("📅 Today UTC:", today.toISOString().slice(0, 10));
        console.log("📅 Tomorrow UTC:", tomorrow.toISOString().slice(0, 10));

        // نشوف كم دوكيومنت لليوم و بكره
        const [todayCount, tomorrowCount] = await Promise.all([
            PrayerTime.countDocuments({ date: today }),
            PrayerTime.countDocuments({ date: tomorrow }),
        ]);

        console.log(`ℹ️ Today docs: ${todayCount}, Tomorrow docs: ${tomorrowCount}`);

        // لو اليوم و بكره موجودين كاملين -> ما نعمل إشي
        if (todayCount >= expectedCities && tomorrowCount >= expectedCities) {
            console.log("✅ Today & Tomorrow already complete, nothing to do.");
            return;
        }

        // نمسح بس الأيام الأقدم من اليوم (تنظيف)
        const deleteOld = await PrayerTime.deleteMany({ date: { $lt: today } });
        console.log(`🧹 Removed old docs (before today): ${deleteOld.deletedCount}`);

        // نحدد إيش لازم نعيد حسابه
        let needToday = todayCount < expectedCities;
        let needTomorrow = tomorrowCount < expectedCities;

        // لو اليوم ناقص -> نمسح الموجود لليوم حتى نعيده نظيف
        if (needToday) {
            const delToday = await PrayerTime.deleteMany({ date: today });
            console.log(`🧹 Removed incomplete TODAY docs: ${delToday.deletedCount}`);
        }

        // لو بكرة ناقص -> نمسح الموجود لبكره حتى نعيده نظيف
        if (needTomorrow) {
            const delTomorrow = await PrayerTime.deleteMany({ date: tomorrow });
            console.log(`🧹 Removed incomplete TOMORROW docs: ${delTomorrow.deletedCount}`);
        }

        // لو ولا واحد ناقص بعد التنظيف
        if (!needToday && !needTomorrow) {
            console.log("ℹ️ Nothing to recompute after clean-up.");
            return;
        }

        const docs = [];
        let processed = 0;

        for (const city of allCities) {
            if (needToday) {
                const docToday = computeForCity(city, today, params);
                if (docToday) docs.push(docToday);
            }

            if (needTomorrow) {
                const docTomorrow = computeForCity(city, tomorrow, params);
                if (docTomorrow) docs.push(docTomorrow);
            }

            processed++;
            if (processed % 10000 === 0) {
                console.log(`⏳ Processed cities: ${processed}/${expectedCities}`);
            }
        }

        console.log(`📦 Inserting ${docs.length} documents...`);
        if (docs.length > 0) {
            await PrayerTime.insertMany(docs, { ordered: false });
        }

        console.log("🎉 DONE. Today & Tomorrow ready in DB.");
    } catch (err) {
        console.error("🔥 Fatal error in computeTodayLocal_fast:", err);
        throw err;
    } finally {
        // لو احنا اللي فتحنا الكونكشن، نسكّره
        if (shouldManageConnection && mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log("🔌 Disconnected from MongoDB");
        }
    }
}

// نصدّر الدالة عشان نقدر نستدعيها من جوّا الباك إند
module.exports = run;

// لو الملف انشغّل مباشرة بـ: node computeTodayLocal_fast.js
if (require.main === module) {
    run()
        .then(() => {
            console.log("✅ computeTodayLocal_fast finished (standalone)");
            process.exit(0);
        })
        .catch(() => {
            process.exit(1);
        });
}
