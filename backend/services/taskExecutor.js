const Task = require('../models/Task');
const { runClaudeWithTools } = require('../utils/claudeRunner');
const { commitChanges, rollback, hasChanges } = require('../utils/gitSafety');
const logger = require('../utils/logger');

const EXECUTE_PROMPT = (task) => `You are working on the Azan project at /root/azan.
This is a MERN stack prayer times website (React 19 frontend, Express backend, MongoDB).

Your task:
Title: ${task.title}
Category: ${task.category}
Description: ${task.description}

Instructions:
- Read relevant files first to understand the current code
- Make minimal, focused changes
- Do NOT break existing functionality
- Do NOT modify .env files or secrets
- Do NOT modify package.json dependencies unless absolutely necessary
- Do NOT delete existing features
- Do NOT modify any files in backend/routes/admin.js, backend/middleware/adminAuth.js, backend/services/taskWorker.js, backend/services/taskExecutor.js, backend/services/taskGenerator.js, backend/utils/claudeRunner.js, backend/utils/gitSafety.js, backend/models/Task.js, or frontend/src/admin/ — these are the admin system files
- Keep all files under 150 lines when possible
- Work fast — complete the task efficiently

Complete the task now.`;

async function executeTask(task, emitEvent) {
  logger.info(`Executing task: ${task.title} [${task._id}]`);

  task.status = 'running';
  task.startedAt = new Date();
  task.error = '';
  task.output = '';
  await task.save();
  emitEvent('task:update', task.toObject());

  try {
    const output = await runClaudeWithTools(EXECUTE_PROMPT(task), undefined, 300000);

    // SUCCESS — commit so changes are safe from future rollbacks
    commitChanges(`auto-task: ${task.title}`);

    task.status = 'completed';
    task.output = output.slice(0, 10000);
    task.completedAt = new Date();
    await task.save();

    const duration = Math.round((task.completedAt - task.startedAt) / 1000);
    logger.info(`Task completed: ${task.title} (${duration}s)`);
    emitEvent('task:update', task.toObject());
    return true;
  } catch (err) {
    // FAILURE — rollback modified tracked files only (safe)
    if (hasChanges()) {
      logger.warn(`Task failed with changes — rolling back modified files`);
      rollback();
    }

    task.status = 'failed';
    task.error = err.message.slice(0, 2000);
    task.completedAt = new Date();
    await task.save();

    const duration = Math.round((task.completedAt - task.startedAt) / 1000);
    logger.error(`Task failed: ${task.title} (${duration}s) — ${err.message}`);
    emitEvent('task:update', task.toObject());
    return false;
  }
}

module.exports = { executeTask };
