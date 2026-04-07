const mongoose = require('mongoose');

const cronRunSchema = new mongoose.Schema({
  jobName: { type: String, required: true, default: 'computePrayerData' },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date },
  status: { type: String, enum: ['success', 'failed', 'running'], default: 'running' },
  error: { type: String, default: '' },
  duration: { type: Number, default: 0 }, // ms
  createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 }, // 30-day TTL
});

cronRunSchema.index({ jobName: 1, createdAt: -1 });

module.exports = mongoose.model('CronRun', cronRunSchema);
