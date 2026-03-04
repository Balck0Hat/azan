const mongoose = require('mongoose');

const CATEGORIES = [
  'frontend', 'backend', 'performance', 'security', 'ux',
  'feature', 'refactor', 'testing', 'accessibility', 'seo'
];

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: CATEGORIES, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  batchNumber: { type: Number, required: true, index: true },
  output: { type: String, default: '' },
  error: { type: String, default: '' },
  startedAt: Date,
  completedAt: Date
}, { timestamps: true });

taskSchema.index({ status: 1 });
taskSchema.index({ batchNumber: 1, category: 1 });

module.exports = mongoose.model('Task', taskSchema);
module.exports.CATEGORIES = CATEGORIES;
