const EventEmitter = require('events');
const Task = require('../models/Task');
const { generateTasks } = require('./taskGenerator');
const { executeTask } = require('./taskExecutor');
const { rollback } = require('../utils/gitSafety');
const logger = require('../utils/logger');

class TaskWorker extends EventEmitter {
  constructor() {
    super();
    this.running = false;
    this.shouldStop = false;
    this.currentBatch = 0;
  }

  emitEvent(type, data) {
    this.emit('sse', { type, data });
  }

  // Reset orphaned "running" tasks + rollback partial changes
  async cleanupStale() {
    const stale = await Task.updateMany(
      { status: 'running' },
      { $set: { status: 'pending' }, $unset: { startedAt: 1 } }
    );
    if (stale.modifiedCount > 0) {
      logger.info(`Reset ${stale.modifiedCount} stale tasks — rolling back`);
      rollback();
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.shouldStop = false;

    logger.info('Task worker started');
    this.emitEvent('worker:status', { running: true });
    await this.cleanupStale();

    try {
      await this.loop();
    } catch (err) {
      logger.error(`Worker error: ${err.message}`);
      this.emitEvent('worker:error', { message: err.message });
    } finally {
      this.running = false;
      this.shouldStop = false;
      this.emitEvent('worker:status', { running: false });
      logger.info('Task worker stopped');
    }
  }

  // Graceful stop — lets current task finish
  stop() {
    this.shouldStop = true;
    logger.info('Task worker stop requested — finishing current task');
    this.emitEvent('worker:status', { running: true, stopping: true });
  }

  async loop() {
    while (!this.shouldStop) {
      const pendingTasks = await Task.find({
        status: 'pending'
      }).sort({ batchNumber: 1, createdAt: 1 });

      let tasks;
      if (pendingTasks.length > 0) {
        tasks = pendingTasks;
        this.currentBatch = pendingTasks[0].batchNumber;
        logger.info(`Resuming ${pendingTasks.length} pending tasks`);
        this.emitEvent('batch:resuming', {
          batchNumber: this.currentBatch, count: pendingTasks.length
        });
      } else {
        const lastTask = await Task.findOne().sort({ batchNumber: -1 }).lean();
        this.currentBatch = lastTask ? lastTask.batchNumber + 1 : 1;
        this.emitEvent('batch:generating', { batchNumber: this.currentBatch });
        tasks = await generateTasks(this.currentBatch);
        this.emitEvent('batch:generated', {
          batchNumber: this.currentBatch, count: tasks.length
        });
      }

      for (const task of tasks) {
        if (this.shouldStop) break;
        await executeTask(task, this.emitEvent.bind(this));
      }

      if (this.shouldStop) break;
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  getStatus() {
    return {
      running: this.running,
      currentBatch: this.currentBatch,
      stopping: this.shouldStop
    };
  }
}

const worker = new TaskWorker();
module.exports = worker;
