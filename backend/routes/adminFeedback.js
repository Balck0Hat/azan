const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const Feedback = require('../models/Feedback');

router.use(adminAuth);

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  const [feedback, total] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Feedback.countDocuments(filter),
  ]);

  res.json({ feedback, total, page, pages: Math.ceil(total / limit) });
}));

router.put('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['new', 'read', 'resolved'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const doc = await Feedback.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json(doc);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await Feedback.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted' });
}));

module.exports = router;
