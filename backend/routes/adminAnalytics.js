const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const PageView = require('../models/PageView');

router.use(adminAuth);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

router.get('/overview', asyncHandler(async (req, res) => {
  const today = daysAgo(0);
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);

  const [todayViews, weekViews, monthViews, todayUnique, monthUnique] = await Promise.all([
    PageView.countDocuments({ date: today }),
    PageView.countDocuments({ date: { $gte: weekAgo } }),
    PageView.countDocuments({ date: { $gte: monthAgo } }),
    PageView.distinct('ipHash', { date: today }).then(a => a.length),
    PageView.distinct('ipHash', { date: { $gte: monthAgo } }).then(a => a.length),
  ]);

  res.json({ todayViews, weekViews, monthViews, todayUnique, monthUnique });
}));

router.get('/top-pages', asyncHandler(async (req, res) => {
  const monthAgo = daysAgo(30);
  const pages = await PageView.aggregate([
    { $match: { date: { $gte: monthAgo } } },
    { $group: { _id: '$path', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  res.json(pages.map(p => ({ path: p._id, count: p.count })));
}));

router.get('/countries', asyncHandler(async (req, res) => {
  const monthAgo = daysAgo(30);
  const countries = await PageView.aggregate([
    { $match: { date: { $gte: monthAgo } } },
    { $group: { _id: '$country', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);
  res.json(countries.map(c => ({ country: c._id, count: c.count })));
}));

router.get('/daily', asyncHandler(async (req, res) => {
  const monthAgo = daysAgo(30);
  const daily = await PageView.aggregate([
    { $match: { date: { $gte: monthAgo } } },
    { $group: { _id: '$date', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  res.json(daily.map(d => ({ date: d._id, count: d.count })));
}));

module.exports = router;
