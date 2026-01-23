const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
    name: { type: String, index: true },   // الاسم الأصلي
    asciiName: String,                     // city_ascii (بدون حروف خاصة)
    country: String,                       // كود الدولة ISO2 (مثلاً: JO, SA, TR)
    latitude: Number,
    longitude: Number,
    timezone: String,
    population: Number
}, { timestamps: true });

module.exports = mongoose.model('City', citySchema);
