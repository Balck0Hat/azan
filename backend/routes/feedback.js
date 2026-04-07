const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Feedback = require('../models/Feedback');
const { validateFeedback } = require('../validators/feedbackValidator');
const { asyncHandler } = require('../middleware/errorHandler');

// Strict rate limit for public feedback
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many submissions, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', feedbackLimiter, asyncHandler(async (req, res) => {
  const { valid, errors } = validateFeedback(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(', ') });
  }

  const { name, email, message, type } = req.body;
  const feedback = await Feedback.create({
    name: name?.trim() || 'Anonymous',
    email: email?.trim() || '',
    message: message.trim(),
    type: type || 'general',
  });

  res.status(201).json({ message: 'Feedback submitted', id: feedback._id });
}));

module.exports = router;
