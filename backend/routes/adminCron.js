const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const cronService = require('../services/cronService');

router.use(adminAuth);

router.get('/status', asyncHandler(async (req, res) => {
  const state = cronService.getState();
  res.json(state);
}));

router.get('/history', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const history = await cronService.getHistory(limit);
  res.json(history);
}));

router.post('/trigger', asyncHandler(async (req, res) => {
  const result = await cronService.runAndRecord();
  res.json(result);
}));

module.exports = router;
