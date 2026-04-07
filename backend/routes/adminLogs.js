const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const { readLogs } = require('../services/logService');

router.use(adminAuth);

router.get('/combined', asyncHandler(async (req, res) => {
  const { lines, level, search } = req.query;
  const logs = readLogs('combined', { lines, level, search });
  res.json(logs);
}));

router.get('/error', asyncHandler(async (req, res) => {
  const { lines, search } = req.query;
  const logs = readLogs('error', { lines, search });
  res.json(logs);
}));

module.exports = router;
