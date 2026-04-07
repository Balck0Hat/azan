const mongoose = require('mongoose');

const siteSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
});

siteSettingSchema.pre('save', function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('SiteSetting', siteSettingSchema);
