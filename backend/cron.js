// cron.js
// ملف خاص للكرون جوب بدون ما نخرب app.js

const computePrayerData = require("./computeTodayLocal");

// دالة تعمل سكيجول مرة يومياً
function scheduleDailyJob(hour = 3, minute = 5) {

    const now = new Date();
    const firstRun = new Date(now);
    console.log("⏰ cron job started: ", firstRun);

    firstRun.setHours(hour, minute, 0, 0);

    // لو الوقت مرّ اليوم → نخليه لبكره
    if (firstRun <= now) {
        firstRun.setDate(firstRun.getDate() + 1);
    }

    const initialDelay = firstRun.getTime() - now.getTime();

    console.log("⏰ First scheduled compute at:", firstRun.toString());

    // تشغيل أول مرة
    setTimeout(() => {
        console.log("🚀 Running computeTodayLocal_fast (first run)...");
        computePrayerData().catch(console.error);

        // بعدها كل 24 ساعة
        setInterval(() => {
            console.log("🚀 Running computeTodayLocal_fast (interval)...");
            computePrayerData().catch(console.error);
        }, 24 * 60 * 60 * 1000);

    }, initialDelay);
}

// نعمل export عشان app.js يقدر يشغّلها
module.exports = {
    scheduleDailyJob
};
