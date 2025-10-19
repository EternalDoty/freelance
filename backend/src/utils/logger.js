const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    )
  })
];

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
  exitOnError: false
});

// Create a stream object with a 'write' function that will be used by morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Add request logging middleware
logger.request = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

// Add error logging
logger.errorHandler = (error, req, res, next) => {
  logger.error('Unhandled Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next(error);
};

// Add database query logging
logger.query = (query, params, duration) => {
  logger.debug('Database Query', {
    query: query.replace(/\s+/g, ' ').trim(),
    params,
    duration: `${duration}ms`
  });
};

// Add cache logging
logger.cache = {
  hit: (key) => logger.debug('Cache Hit', { key }),
  miss: (key) => logger.debug('Cache Miss', { key }),
  set: (key, ttl) => logger.debug('Cache Set', { key, ttl }),
  del: (key) => logger.debug('Cache Delete', { key })
};

// Add authentication logging
logger.auth = {
  login: (userId, username, method) => logger.info('User Login', { userId, username, method }),
  logout: (userId, username) => logger.info('User Logout', { userId, username }),
  failed: (ip, reason) => logger.warn('Authentication Failed', { ip, reason }),
  blocked: (userId, reason) => logger.warn('User Blocked', { userId, reason })
};

// Add business logic logging
logger.business = {
  taskCreated: (taskId, customerId, title) => logger.info('Task Created', { taskId, customerId, title }),
  taskCompleted: (taskId, customerId, executorId) => logger.info('Task Completed', { taskId, customerId, executorId }),
  escrowFunded: (transactionId, taskId, amount) => logger.info('Escrow Funded', { transactionId, taskId, amount }),
  escrowReleased: (transactionId, amount) => logger.info('Escrow Released', { transactionId, amount }),
  escrowRefunded: (transactionId, reason) => logger.info('Escrow Refunded', { transactionId, reason }),
  ratingSubmitted: (ratingId, userId, rating) => logger.info('Rating Submitted', { ratingId, userId, rating }),
  appealCreated: (appealId, userId, type) => logger.info('Appeal Created', { appealId, userId, type }),
  userBlocked: (userId, reason, duration) => logger.warn('User Blocked', { userId, reason, duration })
};

// Add security logging
logger.security = {
  suspiciousActivity: (userId, activity, details) => logger.warn('Suspicious Activity', { userId, activity, details }),
  bruteForceAttempt: (ip, attempts) => logger.warn('Brute Force Attempt', { ip, attempts }),
  rateLimitExceeded: (ip, limit) => logger.warn('Rate Limit Exceeded', { ip, limit }),
  unauthorizedAccess: (ip, resource, userAgent) => logger.warn('Unauthorized Access', { ip, resource, userAgent })
};

// Add performance logging
logger.performance = {
  slowQuery: (query, duration, threshold = 1000) => {
    if (duration > threshold) {
      logger.warn('Slow Query', { query, duration: `${duration}ms`, threshold: `${threshold}ms` });
    }
  },
  memoryUsage: () => {
    const usage = process.memoryUsage();
    logger.debug('Memory Usage', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`
    });
  }
};

// Add system logging
logger.system = {
  startup: (port, env) => logger.info('Server Starting', { port, env }),
  shutdown: (signal) => logger.info('Server Shutting Down', { signal }),
  databaseConnected: () => logger.info('Database Connected'),
  redisConnected: () => logger.info('Redis Connected'),
  databaseError: (error) => logger.error('Database Error', { error: error.message }),
  redisError: (error) => logger.error('Redis Error', { error: error.message })
};

module.exports = logger;
