const ApiMetric = require('../models/ApiMetric');

const SKIP_PATTERNS = ['/api/admin', '/health', '/sitemap', '/favicon'];

function apiMetricsMiddleware(req, res, next) {
  if (SKIP_PATTERNS.some(p => req.path.startsWith(p))) return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // ms
    const date = new Date().toISOString().slice(0, 10);

    ApiMetric.create({
      path: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      date,
    }).catch(() => {}); // silent — metrics should never break the app
  });

  next();
}

module.exports = apiMetricsMiddleware;
