const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const prayerService = require('../services/prayerService');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(adminAuth);

router.get('/status', asyncHandler(async (req, res) => {
  const status = await prayerService.getStatus();
  res.json(status);
}));

router.post('/recompute', asyncHandler(async (req, res) => {
  const result = await prayerService.forceRecompute();
  res.json(result);
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await prayerService.getDataStats();
  res.json(stats);
}));

module.exports = router;
