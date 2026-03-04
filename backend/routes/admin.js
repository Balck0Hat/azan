const express = require('express');
const router = express.Router();
const { adminAuth, generateToken } = require('../middleware/adminAuth');
const Task = require('../models/Task');
const worker = require('../services/taskWorker');

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    const token = generateToken();
    return res.json({ token });
  }
  res.status(401).json({ message: 'Invalid credentials' });
});

// All routes below require auth
router.use(adminAuth);

// GET /api/admin/tasks — with filters
router.get('/tasks', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.batch) filter.batchNumber = parseInt(req.query.batch);

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ batchNumber: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Task.countDocuments(filter)
  ]);

  res.json({ tasks, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/admin/stats — enhanced
router.get('/stats', async (req, res) => {
  const [total, completed, failed, running, pending] = await Promise.all([
    Task.countDocuments(),
    Task.countDocuments({ status: 'completed' }),
    Task.countDocuments({ status: 'failed' }),
    Task.countDocuments({ status: 'running' }),
    Task.countDocuments({ status: 'pending' })
  ]);

  const lastTask = await Task.findOne().sort({ batchNumber: -1 }).lean();
  const currentBatch = lastTask?.batchNumber || 0;
  const successRate = total > 0 ? Math.round((completed / (completed + failed || 1)) * 100) : 0;

  const avgResult = await Task.aggregate([
    { $match: { status: 'completed', startedAt: { $exists: true }, completedAt: { $exists: true } } },
    { $project: { duration: { $subtract: ['$completedAt', '$startedAt'] } } },
    { $group: { _id: null, avg: { $avg: '$duration' } } }
  ]);
  const avgDuration = avgResult[0]?.avg || 0;

  res.json({ total, completed, failed, running, pending, currentBatch, successRate, avgDuration });
});

// GET /api/admin/current
router.get('/current', async (req, res) => {
  const task = await Task.findOne({ status: 'running' }).lean();
  res.json({ task });
});

// POST /api/admin/worker/start
router.post('/worker/start', (req, res) => {
  if (worker.running) return res.json({ message: 'Worker already running' });
  worker.start();
  res.json({ message: 'Worker started' });
});

// POST /api/admin/worker/stop
router.post('/worker/stop', (req, res) => {
  worker.stop();
  res.json({ message: 'Worker stop requested' });
});

// GET /api/admin/worker/status
router.get('/worker/status', (req, res) => {
  res.json(worker.getStatus());
});

// GET /api/admin/events — SSE
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`data: ${JSON.stringify({ type: 'connected', data: worker.getStatus() })}\n\n`);
  const onEvent = (evt) => { res.write(`data: ${JSON.stringify(evt)}\n\n`); };
  worker.on('sse', onEvent);
  const heartbeat = setInterval(() => { res.write(': heartbeat\n\n'); }, 30000);
  req.on('close', () => { worker.off('sse', onEvent); clearInterval(heartbeat); });
});

module.exports = router;
