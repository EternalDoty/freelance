const redis = require('redis');
const logger = require('../utils/logger');

const client = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis server connection refused');
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error('Redis max retry attempts reached');
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
});

// Event handlers
client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('error', (err) => {
  logger.error('Redis client error:', err);
});

client.on('end', () => {
  logger.info('Redis client connection ended');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await client.connect();
    logger.info('Redis connected successfully');
    return true;
  } catch (error) {
    logger.error('Redis connection failed:', error.message);
    return false;
  }
};

// Cache helper functions
const cache = {
  // Set cache with TTL
  set: async (key, value, ttl = 3600) => {
    try {
      const serializedValue = JSON.stringify(value);
      await client.setEx(key, ttl, serializedValue);
      logger.debug('Cache set', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  },

  // Get cache
  get: async (key) => {
    try {
      const value = await client.get(key);
      if (value) {
        logger.debug('Cache hit', { key });
        return JSON.parse(value);
      }
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  // Delete cache
  del: async (key) => {
    try {
      const result = await client.del(key);
      logger.debug('Cache deleted', { key, result });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  },

  // Set multiple keys
  mset: async (keyValuePairs, ttl = 3600) => {
    try {
      const pipeline = client.multi();
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        pipeline.setEx(key, ttl, JSON.stringify(value));
      });
      await pipeline.exec();
      logger.debug('Cache mset', { keys: Object.keys(keyValuePairs) });
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  },

  // Get multiple keys
  mget: async (keys) => {
    try {
      const values = await client.mGet(keys);
      const result = {};
      keys.forEach((key, index) => {
        if (values[index]) {
          result[key] = JSON.parse(values[index]);
        }
      });
      logger.debug('Cache mget', { keys, found: Object.keys(result).length });
      return result;
    } catch (error) {
      logger.error('Cache mget error:', error);
      return {};
    }
  },

  // Increment counter
  incr: async (key, ttl = 3600) => {
    try {
      const pipeline = client.multi();
      pipeline.incr(key);
      pipeline.expire(key, ttl);
      const result = await pipeline.exec();
      return result[0][1];
    } catch (error) {
      logger.error('Cache incr error:', error);
      return 0;
    }
  },

  // Set expiration
  expire: async (key, ttl) => {
    try {
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error:', error);
      return false;
    }
  },

  // Get TTL
  ttl: async (key) => {
    try {
      return await client.ttl(key);
    } catch (error) {
      logger.error('Cache ttl error:', error);
      return -1;
    }
  },

  // Clear all cache
  flushall: async () => {
    try {
      await client.flushAll();
      logger.info('All cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache flushall error:', error);
      return false;
    }
  },
};

// Session store for express-session
const sessionStore = {
  get: async (sid) => {
    try {
      const session = await client.get(`sess:${sid}`);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      logger.error('Session get error:', error);
      return null;
    }
  },

  set: async (sid, session, ttl = 86400) => {
    try {
      await client.setEx(`sess:${sid}`, ttl, JSON.stringify(session));
      return true;
    } catch (error) {
      logger.error('Session set error:', error);
      return false;
    }
  },

  destroy: async (sid) => {
    try {
      await client.del(`sess:${sid}`);
      return true;
    } catch (error) {
      logger.error('Session destroy error:', error);
      return false;
    }
  },

  touch: async (sid, ttl = 86400) => {
    try {
      await client.expire(`sess:${sid}`, ttl);
      return true;
    } catch (error) {
      logger.error('Session touch error:', error);
      return false;
    }
  },
};

// Close Redis connection
const closeRedis = async () => {
  try {
    await client.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
};

module.exports = {
  client,
  cache,
  sessionStore,
  connectRedis,
  closeRedis,
};
