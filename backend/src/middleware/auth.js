const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication token required'
        }
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Check if user exists and is not blocked
    const userResult = await query(
      'SELECT id, username, role, is_blocked, blocked_until FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token - user not found'
        }
      });
    }

    const user = userResult.rows[0];

    // Check if user is blocked
    if (user.is_blocked) {
      const now = new Date();
      const blockedUntil = user.blocked_until ? new Date(user.blocked_until) : null;
      
      if (blockedUntil && blockedUntil > now) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'USER_BLOCKED',
            message: 'User account is blocked',
            details: {
              blockedUntil: blockedUntil.toISOString(),
              reason: 'Account temporarily suspended'
            }
          }
        });
      }
    }

    // Add user info to request
    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      });
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
};

// Check if user has required role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Insufficient permissions',
          details: {
            required: allowedRoles,
            current: userRole
          }
        }
      });
    }

    next();
  };
};

// Check if user is admin
const requireAdmin = requireRole(['admin']);

// Check if user is moderator or admin
const requireModerator = requireRole(['moderator', 'admin']);

// Check if user is not blocked
const requireActiveUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      }
    });
  }

  // This check is already done in authenticateToken
  // but we can add additional checks here if needed
  next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const userResult = await query(
      'SELECT id, username, role, is_blocked FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length > 0 && !userResult.rows[0].is_blocked) {
      req.user = {
        userId: userResult.rows[0].id,
        username: userResult.rows[0].username,
        role: userResult.rows[0].role
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

// Rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.userId;
    const key = `rate_limit:user:${userId}`;
    
    try {
      const current = await cache.incr(key, Math.ceil(windowMs / 1000));
      
      if (current === 1) {
        await cache.expire(key, Math.ceil(windowMs / 1000));
      }
      
      if (current > maxRequests) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this user',
            details: {
              limit: maxRequests,
              window: windowMs,
              retryAfter: Math.ceil(windowMs / 1000)
            }
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Rate limit error:', error);
      next(); // Continue on error
    }
  };
};

// Check if user owns resource
const requireOwnership = (resourceType, idParam = 'id') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const userId = req.user.userId;
    const resourceId = req.params[idParam];

    try {
      let queryText;
      let queryParams;

      switch (resourceType) {
        case 'task':
          queryText = 'SELECT customer_id FROM tasks WHERE id = $1';
          queryParams = [resourceId];
          break;
        case 'proposal':
          queryText = 'SELECT executor_id FROM proposals WHERE id = $1';
          queryParams = [resourceId];
          break;
        case 'user':
          queryText = 'SELECT id FROM users WHERE id = $1';
          queryParams = [resourceId];
          break;
        default:
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_RESOURCE_TYPE',
              message: 'Invalid resource type'
            }
          });
      }

      const result = await query(queryText, queryParams);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Resource not found'
          }
        });
      }

      const ownerId = result.rows[0][Object.keys(result.rows[0])[0]];

      if (ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only access your own resources'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error'
        }
      });
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireModerator,
  requireActiveUser,
  optionalAuth,
  userRateLimit,
  requireOwnership
};
