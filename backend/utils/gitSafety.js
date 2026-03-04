const { execFileSync } = require('child_process');
const logger = require('./logger');

const GIT_OPTS = { cwd: '/root/azan', timeout: 30000 };

// Commit current state as a checkpoint
function commitChanges(message) {
  try {
    execFileSync('git', ['add', '-A'], GIT_OPTS);
    const status = execFileSync('git', ['status', '--porcelain'], GIT_OPTS).toString().trim();
    if (!status) return false;
    execFileSync('git', ['commit', '-m', message], GIT_OPTS);
    logger.info(`Git committed: ${message}`);
    return true;
  } catch (err) {
    logger.warn(`Git commit failed: ${err.message}`);
    return false;
  }
}

// Rollback ONLY modified tracked files (safe — never deletes untracked files)
function rollback() {
  try {
    execFileSync('git', ['checkout', '.'], GIT_OPTS);
    logger.info('Git rollback: reverted modified tracked files');
    return true;
  } catch (err) {
    logger.error(`Git rollback failed: ${err.message}`);
    return false;
  }
}

// Check if there are uncommitted changes
function hasChanges() {
  try {
    const status = execFileSync('git', ['diff', '--name-only'], GIT_OPTS).toString().trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

module.exports = { commitChanges, rollback, hasChanges };
