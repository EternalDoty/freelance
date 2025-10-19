const logger = require('../utils/logger');

// 404 Not Found middleware
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  
  logger.warn('404 Not Found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      details: {
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    }
  });
};

module.exports = notFound;
