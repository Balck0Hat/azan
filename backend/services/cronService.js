const CronRun = require('../models/CronRun');
const computePrayerData = require('../computeTodayLocal');

// In-memory state
const state = {
  nextRun: null,
  lastRunTime: null,
  lastRunResult: null,
  isRunning: false,
};

function getState() {
  return { ...state };
}

function setNextRun(date) {
  state.nextRun = date;
}

async function runAndRecord() {
  if (state.isRunning) {
    return { success: false, error: 'Already running' };
  }

  state.isRunning = true;
  const startedAt = new Date();
  const doc = await CronRun.create({ jobName: 'computePrayerData', startedAt });

  try {
    await computePrayerData();
    const duration = Date.now() - startedAt.getTime();

    doc.completedAt = new Date();
    doc.status = 'success';
    doc.duration = duration;
    await doc.save();

    state.lastRunTime = startedAt;
    state.lastRunResult = 'success';
    state.isRunning = false;

    return { success: true, duration };
  } catch (err) {
    const duration = Date.now() - startedAt.getTime();

    doc.completedAt = new Date();
    doc.status = 'failed';
    doc.error = err.message;
    doc.duration = duration;
    await doc.save();

    state.lastRunTime = startedAt;
    state.lastRunResult = 'failed';
    state.isRunning = false;

    return { success: false, error: err.message, duration };
  }
}

async function getHistory(limit = 20) {
  return CronRun.find()
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();
}

module.exports = { getState, setNextRun, runAndRecord, getHistory };
