const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const SiteSetting = require('../models/SiteSetting');

// Public endpoint — no auth needed
router.get('/public', asyncHandler(async (req, res) => {
  const settings = await SiteSetting.find().lean();
  const obj = {};
  for (const s of settings) obj[s.key] = s.value;
  res.json(obj);
}));

// Admin endpoints
router.get('/', adminAuth, asyncHandler(async (req, res) => {
  const settings = await SiteSetting.find().lean();
  const obj = {};
  for (const s of settings) {
    obj[s.key] = { value: s.value, updatedAt: s.updatedAt };
  }
  res.json(obj);
}));

router.put('/', adminAuth, asyncHandler(async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const ops = Object.entries(updates).map(([key, value]) => ({
    updateOne: {
      filter: { key },
      update: { $set: { key, value, updatedAt: new Date() } },
      upsert: true,
    },
  }));

  await SiteSetting.bulkWrite(ops);
  res.json({ message: 'Settings updated', count: ops.length });
}));

module.exports = router;
