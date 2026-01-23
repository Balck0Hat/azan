require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const City = require('./models/City');
const PrayerTime = require('./models/PrayerTime');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/azan';

// ------------ تحديد تاريخ اليوم (22 الشهر الحالي) -------------
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;      // 1-12
const day = 22;                        // انت حكيّت بدك 22 الشهر

// لو بدك اليوم الحالي بدل 22، استبدل السطر اللي فوق بـ:
// const day = now.getDate();

const dayStr = String(day).padStart(2, '0');
const monthStr = String(month).padStart(2, '0');
const dateStr = `${dayStr}-${monthStr}-${year}`; // فورمات Aladhan: DD-MM-YYYY

console.log('📅 Using date:', dateStr);

// ------------ تحميل ملف المدن -------------
const citiesPath = path.join(__dirname, 'data', 'cities.json');
if (!fs.existsSync(citiesPath)) {
    console.error('❌ data/cities.json مش موجود');
    process.exit(1);
}
const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));

// ------------ دالة تجيب أوقات اليوم لمدينة واحدة -------------
async function fetchTodayForCity(city) {
    const { name, country, latitude, longitude, timezone } = city;
    console.log(`➡️  Fetching ${name}, ${country} ...`);

    const url = 'https://api.aladhan.com/v1/timings';
    const params = {
        date: "22-11-2025",
        latitude: city.lat,
        longitude: city.lng,
        method: 2
    };

    const res = await axios.get(url, { params });

    if (res.data.code !== 200 || !res.data.data) {
        console.error('⚠️ Unexpected response for', name, country, res.data);
        return;
    }

    const data = res.data.data;
    const timings = data.timings;

    // حفظ/تحديث المدينة
    const cityDoc = await City.findOneAndUpdate(
        { name, country },
        { name, country, latitude, longitude, timezone },
        { upsert: true, new: true }
    );

    // نحول التاريخ القادم من API ل Date حقيقية
    const [dd, mm, yyyy] = data.date.gregorian.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(yyyy, mm - 1, dd));

    const clean = (val) => val.split(' ')[0];

    // نحذف أي سجل قديم لنفس المدينة ونفس اليوم (عشان ما يتكرر)
    await PrayerTime.deleteMany({
        city: cityDoc._id,
        date: {
            $gte: dateObj,
            $lt: new Date(Date.UTC(yyyy, mm - 1, dd + 1))
        }
    });

    // نضيف السجل
    await PrayerTime.create({
        city: cityDoc._id,
        cityName: cityDoc.name,
        country: cityDoc.country,
        timezone: cityDoc.timezone,
        date: dateObj,
        raw: data   // نخزن كل شيء داخل raw
    });

    console.log(`✅ Saved today timings for ${name}, ${country}`);
}

// ------------ المين -------------
(async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        for (const city of cities) {
            try {
                await fetchTodayForCity(city);
            } catch (err) {
                console.error(`❌ Error for ${city.name}, ${city.country}:`, err.message);
            }
        }

        console.log('🎉 DONE: all cities processed for', dateStr);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('🔥 Fatal error:', err);
        process.exit(1);
    }
})();
