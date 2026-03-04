const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SYSTEM_PROMPT = `You are an expert UX/UI auditor. Analyze the provided web page for:
- Visual design quality, spacing, alignment, color contrast
- Accessibility (ARIA, focus states, color contrast ratios)
- Mobile responsiveness issues
- Typography and readability
- Interaction patterns and affordances
- Performance concerns visible in DOM structure

Return ONLY valid JSON — an array of issues:
[{"severity":"red"|"yellow"|"green","title":"Short issue title","description":"Detailed explanation","file_hint":"Likely CSS/JSX filename based on class names","suggestion":"Specific code fix or improvement"}]

red = critical (broken layout, inaccessible, unusable)
yellow = moderate (poor UX, inconsistent, confusing)
green = minor (polish, nice-to-have improvements)

Order by severity (red first). Max 15 issues. Be specific and actionable.`;

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HOME: os.homedir() };
    delete env.CLAUDECODE;
    const child = spawn("claude", ["--print", "-"], { timeout: 180_000, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `Exit code ${code}`));
      resolve(stdout);
    });
    child.on("error", reject);
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function parseIssues(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch { return []; }
}

router.post("/ux-audit", express.json({ limit: "12mb" }), async (req, res) => {
  try {
    const { domText, screenshot } = req.body;
    if (!domText && !screenshot) {
      return res.status(400).json({ error: "domText or screenshot required" });
    }
    const promises = [];
    if (domText) {
      const prompt = `${SYSTEM_PROMPT}\n\nAnalyze this page DOM structure:\n\n${domText.slice(0, 60000)}`;
      promises.push(runClaude(prompt));
    }
    if (screenshot) {
      const tmpFile = path.join(os.tmpdir(), `ux-audit-${Date.now()}.png`);
      fs.writeFileSync(tmpFile, Buffer.from(screenshot, "base64"));
      const prompt = `${SYSTEM_PROMPT}\n\nAnalyze the screenshot at ${tmpFile} for UX/UI issues.`;
      promises.push(runClaude(prompt).finally(() => { try { fs.unlinkSync(tmpFile); } catch {} }));
    }
    const results = await Promise.all(promises);
    let allIssues = [];
    for (const text of results) allIssues = allIssues.concat(parseIssues(text));
    const seen = new Set();
    const unique = allIssues.filter((issue) => {
      const key = issue.title?.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const order = { red: 0, yellow: 1, green: 2 };
    unique.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    res.json({ issues: unique.slice(0, 15) });
  } catch (err) {
    console.error("UX audit error:", err.message);
    res.status(500).json({ error: "Audit failed: " + err.message });
  }
});

router.post("/ux-fix", express.json(), async (req, res) => {
  const { filename, issue, solution } = req.body;
  if (!issue || !solution) return res.status(400).json({ error: "issue and solution required" });
  const { execFile } = require("child_process");
  const prompt = `Fix this UX issue in /root/azan/frontend:\nIssue: ${issue}\n${filename ? `File hint: ${filename}` : ""}\nProposed fix: ${solution}\nKeep changes minimal.`;
  const fixEnv = { ...process.env, HOME: os.homedir() };
  delete fixEnv.CLAUDECODE;
  execFile("claude", ["--print", prompt, "--allowedTools", "Edit,Write,Glob,Grep,Read"],
    { timeout: 120_000, maxBuffer: 1024 * 1024, env: fixEnv },
    (err, stdout, stderr) => {
      if (err) return res.status(500).json({ error: "Fix failed", details: stderr || err.message });
      res.json({ success: true, output: stdout.slice(0, 2000) });
    });
});

module.exports = router;
