const cache = new Map();

const CACHE_TTLS = {
  '/api/prayertimes/now/summary': 30000,
  '/api/prayertimes/today': 300000,
  '/api/prayertimes/adhan-wave': 30000
};

function cacheMiddleware(req, res, next) {
  const ttl = Object.entries(CACHE_TTLS).find(([path]) => req.originalUrl.startsWith(path));
  if (!ttl) return next();

  const key = req.originalUrl;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < ttl[1]) {
    return res.json(cached.data);
  }

  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode === 200) {
      cache.set(key, { data, timestamp: Date.now() });
    }
    return originalJson(data);
  };

  next();
}

// Cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (now - value.timestamp > 300000) cache.delete(key);
  }
}, 60000);

module.exports = cacheMiddleware;
