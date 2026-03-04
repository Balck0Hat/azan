const Task = require('../models/Task');
const { CATEGORIES } = require('../models/Task');
const { runClaude } = require('../utils/claudeRunner');
const logger = require('../utils/logger');

const GENERATE_PROMPT = `You are a senior full-stack engineer analyzing the Azan (azanlive.com) project at /root/azan.
This is a MERN stack prayer times app with React 19 frontend and Express backend.

Analyze the entire codebase and generate exactly 10 improvement tasks — one per category:
${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each task:
- Be SPECIFIC: reference actual files, components, or endpoints
- Be ACTIONABLE: describe exactly what to do
- Keep scope small enough to complete in one Claude CLI session (~5 min)
- Focus on real improvements, not hypothetical ones

Return ONLY valid JSON — an array of 10 objects:
[{"title":"Short title","description":"Detailed description of what to change and why","category":"one_of_the_categories"}]

IMPORTANT: Return ONLY the JSON array, no markdown, no explanation.`;

async function generateTasks(batchNumber) {
  logger.info(`Generating task batch #${batchNumber}`);

  const raw = await runClaude(GENERATE_PROMPT);

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude did not return valid JSON array');

  let tasks;
  try { tasks = JSON.parse(match[0]); }
  catch (e) { throw new Error(`Failed to parse tasks JSON: ${e.message}`); }

  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error('No tasks generated');

  const saved = [];
  for (const t of tasks.slice(0, 10)) {
    const category = CATEGORIES.includes(t.category) ? t.category : CATEGORIES[saved.length % 10];
    const task = await Task.create({
      title: t.title || 'Untitled task',
      description: t.description || t.title,
      category,
      batchNumber,
      status: 'pending'
    });
    saved.push(task);
  }

  logger.info(`Generated ${saved.length} tasks for batch #${batchNumber}`);
  return saved;
}

module.exports = { generateTasks };
