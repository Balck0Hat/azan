const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  name: { type: String, default: 'Anonymous', maxlength: 100 },
  email: { type: String, default: '', maxlength: 200 },
  message: { type: String, required: true, maxlength: 2000 },
  type: { type: String, enum: ['bug', 'suggestion', 'general'], default: 'general' },
  status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new' },
  createdAt: { type: Date, default: Date.now, expires: 365 * 24 * 60 * 60 }, // 1-year TTL
});

feedbackSchema.index({ status: 1 });
feedbackSchema.index({ type: 1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
