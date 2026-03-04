const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    error: err.stack,
    query: req.query,
    body: req.body,
    ip: req.ip
  });

  const isDev = process.env.NODE_ENV !== 'production';

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'خطأ في البيانات المدخلة',
      details: isDev ? err.message : undefined
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      message: 'معرّف غير صحيح',
      details: isDev ? err.message : undefined
    });
  }

  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      message: 'الخدمة غير متاحة حالياً، حاول لاحقاً'
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'مشكلة داخلية في السيرفر',
    details: isDev ? err.stack : undefined
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
