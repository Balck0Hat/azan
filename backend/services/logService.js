const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

function readLogs(file = 'combined', options = {}) {
  const { lines = 100, level, search } = options;
  const maxLines = Math.min(Number(lines) || 100, 500);
  const filePath = path.join(LOGS_DIR, file === 'error' ? 'error.log' : 'combined.log');

  try {
    if (!fs.existsSync(filePath)) return [];

    const content = fs.readFileSync(filePath, 'utf8');
    let entries = content.trim().split('\n').filter(Boolean);

    // Parse each line: "2025-03-04 10:33:00 [info]: message"
    entries = entries.map(line => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s\[(\w+)\]:\s(.*)$/);
      if (match) {
        return { timestamp: match[1], level: match[2], message: match[3] };
      }
      return { timestamp: '', level: 'unknown', message: line };
    });

    // Filter by level
    if (level && level !== 'all') {
      entries = entries.filter(e => e.level === level);
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e => e.message.toLowerCase().includes(q));
    }

    // Return most recent first, limited
    return entries.reverse().slice(0, maxLines);
  } catch {
    return [];
  }
}

module.exports = { readLogs };
