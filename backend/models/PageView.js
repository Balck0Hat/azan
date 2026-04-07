const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
  path: { type: String, required: true },
  country: { type: String, default: 'Unknown' },
  city: { type: String, default: '' },
  referrer: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  ipHash: { type: String, default: '' },
  date: { type: String, required: true }, // YYYY-MM-DD for easy grouping
  createdAt: { type: Date, default: Date.now, expires: 90 * 24 * 60 * 60 }, // 90-day TTL
});

pageViewSchema.index({ date: 1 });
pageViewSchema.index({ path: 1, date: 1 });
pageViewSchema.index({ ipHash: 1, date: 1 });

module.exports = mongoose.model('PageView', pageViewSchema);
