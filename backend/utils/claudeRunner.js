const { spawn } = require('child_process');
const os = require('os');
const logger = require('./logger');

let activeChild = null;

function runClaude(prompt, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HOME: os.homedir() };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn('claude', ['--print', '-'], {
      env, cwd: '/root/azan'
    });
    activeChild = child;

    let stdout = '';
    let stderr = '';
    let done = false;

    const finish = (error, result) => {
      if (done) return;
      done = true;
      activeChild = null;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      logger.warn(`Claude CLI timeout after ${timeoutMs / 1000}s — sending SIGTERM`);
      try { child.kill('SIGTERM'); } catch {}
      setTimeout(() => {
        if (!done) {
          try { child.kill('SIGKILL'); } catch {}
          finish(new Error(`Timeout after ${timeoutMs / 1000}s`));
        }
      }, 15000);
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (code !== 0) finish(new Error(stderr || `Exit code ${code}`));
      else finish(null, stdout);
    });
    child.on('error', (err) => finish(err));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function runClaudeWithTools(prompt, tools = 'Edit,Write,Glob,Grep,Read,Bash', timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HOME: os.homedir() };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn('claude', [
      '--print', '-', '--allowedTools', tools
    ], { env, cwd: '/root/azan' });
    activeChild = child;

    let stdout = '';
    let stderr = '';
    let done = false;

    const finish = (error, result) => {
      if (done) return;
      done = true;
      activeChild = null;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      logger.warn(`Claude CLI (tools) timeout — sending SIGTERM`);
      try { child.kill('SIGTERM'); } catch {}
      setTimeout(() => {
        if (!done) {
          try { child.kill('SIGKILL'); } catch {}
          finish(new Error(`Timeout after ${timeoutMs / 1000}s`));
        }
      }, 15000);
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (code !== 0) finish(new Error(stderr || `Exit code ${code}`));
      else finish(null, stdout);
    });
    child.on('error', (err) => finish(err));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function isRunning() {
  return activeChild !== null;
}

module.exports = { runClaude, runClaudeWithTools, isRunning };
