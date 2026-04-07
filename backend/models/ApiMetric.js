const mongoose = require('mongoose');

const apiMetricSchema = new mongoose.Schema({
  path: { type: String, required: true },
  method: { type: String, required: true },
  statusCode: { type: Number, required: true },
  duration: { type: Number, required: true }, // ms
  date: { type: String, required: true }, // YYYY-MM-DD
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 }, // 7-day TTL
});

apiMetricSchema.index({ path: 1, date: 1 });
apiMetricSchema.index({ date: 1 });

module.exports = mongoose.model('ApiMetric', apiMetricSchema);
