const PrayerTime = require('../models/PrayerTime');
const computeTodayLocal = require('../computeTodayLocal');

function getDateRange() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  return { today, tomorrow };
}

async function getStatus() {
  const { today, tomorrow } = getDateRange();

  const [todayCount, tomorrowCount, totalCities, latestDoc] = await Promise.all([
    PrayerTime.countDocuments({ date: today }),
    PrayerTime.countDocuments({ date: tomorrow }),
    PrayerTime.distinct('cityName').then(arr => arr.length),
    PrayerTime.findOne().sort({ _id: -1 }).select('date').lean(),
  ]);

  return {
    todayCount,
    tomorrowCount,
    totalCities,
    lastComputeDate: latestDoc?.date || null,
    todayDate: today.toISOString().slice(0, 10),
    tomorrowDate: tomorrow.toISOString().slice(0, 10),
  };
}

async function forceRecompute() {
  const start = Date.now();
  try {
    await computeTodayLocal();
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const status = await getStatus();
    return { success: true, duration: `${duration}s`, ...status };
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    return { success: false, duration: `${duration}s`, error: err.message };
  }
}

async function getDataStats() {
  const { today } = getDateRange();

  const [totalDocs, dateBreakdown, oldestDoc, newestDoc] = await Promise.all([
    PrayerTime.countDocuments(),
    PrayerTime.aggregate([
      { $group: { _id: '$date', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    PrayerTime.findOne().sort({ date: 1 }).select('date').lean(),
    PrayerTime.findOne().sort({ date: -1 }).select('date').lean(),
  ]);

  return {
    totalDocs,
    dateBreakdown: dateBreakdown.map(d => ({
      date: d._id?.toISOString?.().slice(0, 10) || d._id,
      count: d.count,
    })),
    oldestDate: oldestDoc?.date || null,
    newestDate: newestDoc?.date || null,
  };
}

module.exports = { getStatus, forceRecompute, getDataStats };
