const mongoose = require('mongoose');

const prayerTimeSchema = new mongoose.Schema({
    cityName: String,
    asciiName: String,
    country: String,
    latitude: Number,
    longitude: Number,
    timezone: String,
    date: Date,

    // 🕓 أوقات الصلاة الأساسية (زي ما هي)
    timings: {
        Fajr: String,
        Sunrise: String,
        Dhuhr: String,
        Asr: String,
        Maghrib: String,
        Isha: String,
        Imsak: String,
        Midnight: String,
        Lastthird: String
    },
    // أوقات رقمية (دقائق من منتصف الليل UTC)
    numericTimings: {
        Fajr: Number,
        Sunrise: Number,
        Dhuhr: Number,
        Asr: Number,
        Maghrib: Number,
        Isha: Number,
        Imsak: Number,
        Midnight: Number,
        Lastthird: Number
    },

    // نوافذ الأوقات (start/end بالدقائق من منتصف الليل UTC)
    prayerWindows: {
        Fajr: {
            start: Number,
            end: Number
        },
        Dhuhr: {
            start: Number,
            end: Number
        },
        Asr: {
            start: Number,
            end: Number
        },
        Maghrib: {
            start: Number,
            end: Number
        },
        Isha: {
            start: Number,
            end: Number
        }
    },

    // 🧭 اتجاه القبلة بالدرجات (من 0 إلى 360)
    qiblaDirection: Number,

    // 🌞 طول النهار و الليل بالدقائق (اختياريين)
    dayLengthMinutes: Number,
    nightLengthMinutes: Number,

    // ☀️ أوقات فلكية إضافية (UTC HH:MM)
    solar: {
        dawn: String,     // الفجر الفلكي
        sunrise: String,  // شروق حقيقي
        sunset: String,   // غروب حقيقي
        dusk: String,     // شفق العشاء
        transit: String   // الزوال / منتصف النهار الشمسي
    },

    // raw: نحط فيه أي معلومات إضافية تفصيلية أو باراميترات الحساب
    raw: Object
}, { timestamps: true });

module.exports = mongoose.model('PrayerTime', prayerTimeSchema);
