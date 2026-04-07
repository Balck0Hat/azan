const crypto = require('crypto');
const PageView = require('../models/PageView');

const SKIP_PATTERNS = ['/api/admin', '/health', '/sitemap', '/favicon'];
const BOT_PATTERN = /bot|crawler|spider|curl|wget|python|headless/i;

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + process.env.JWT_SECRET).digest('hex').slice(0, 16);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function analyticsMiddleware(req, res, next) {
  const path = req.path;

  // Skip admin, health, bots
  if (SKIP_PATTERNS.some(p => path.startsWith(p))) return next();
  if (req.method !== 'GET') return next();
  const ua = req.get('user-agent') || '';
  if (BOT_PATTERN.test(ua)) return next();

  // Record asynchronously — don't block the response
  const ip = req.ip || req.connection?.remoteAddress || '';
  const country = req.headers['cf-ipcountry'] || req.headers['x-country'] || 'Unknown';
  const city = req.headers['cf-ipcity'] || req.headers['x-city'] || '';

  PageView.create({
    path,
    country,
    city,
    referrer: req.get('referer') || '',
    userAgent: ua.slice(0, 200),
    ipHash: hashIp(ip),
    date: getToday(),
  }).catch(() => {}); // silent — analytics should never break the app

  next();
}

module.exports = analyticsMiddleware;
