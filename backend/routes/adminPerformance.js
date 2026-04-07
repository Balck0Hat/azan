const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiMetric = require('../models/ApiMetric');

router.use(adminAuth);

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

router.get('/overview', asyncHandler(async (req, res) => {
  const today = daysAgo(0);
  const [totalToday, avgDuration, errorCount] = await Promise.all([
    ApiMetric.countDocuments({ date: today }),
    ApiMetric.aggregate([
      { $match: { date: today } },
      { $group: { _id: null, avg: { $avg: '$duration' } } },
    ]),
    ApiMetric.countDocuments({ date: today, statusCode: { $gte: 400 } }),
  ]);

  res.json({
    totalToday,
    avgResponseTime: Math.round(avgDuration[0]?.avg || 0),
    errorCount,
    errorRate: totalToday ? ((errorCount / totalToday) * 100).toFixed(1) : '0',
  });
}));

router.get('/slowest', asyncHandler(async (req, res) => {
  const weekAgo = daysAgo(7);
  const results = await ApiMetric.aggregate([
    { $match: { date: { $gte: weekAgo } } },
    { $group: { _id: { path: '$path', method: '$method' }, avgDuration: { $avg: '$duration' }, count: { $sum: 1 } } },
    { $sort: { avgDuration: -1 } },
    { $limit: 10 },
  ]);
  res.json(results.map(r => ({ path: r._id.path, method: r._id.method, avgDuration: Math.round(r.avgDuration), count: r.count })));
}));

router.get('/errors', asyncHandler(async (req, res) => {
  const weekAgo = daysAgo(7);
  const results = await ApiMetric.aggregate([
    { $match: { date: { $gte: weekAgo }, statusCode: { $gte: 400 } } },
    { $group: { _id: { path: '$path', statusCode: '$statusCode' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);
  res.json(results.map(r => ({ path: r._id.path, statusCode: r._id.statusCode, count: r.count })));
}));

router.get('/hourly', asyncHandler(async (req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const results = await ApiMetric.aggregate([
    { $match: { createdAt: { $gte: dayAgo } } },
    { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 }, avgDuration: { $avg: '$duration' } } },
    { $sort: { _id: 1 } },
  ]);
  res.json(results.map(r => ({ hour: r._id, count: r.count, avgDuration: Math.round(r.avgDuration) })));
}));

module.exports = router;
