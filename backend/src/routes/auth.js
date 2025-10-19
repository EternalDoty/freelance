const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const user = req.user;
      
      // Generate JWT tokens
      const accessToken = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      // Store refresh token in cache
      await cache.set(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 60 * 60); // 7 days

      // Update last login
      await query(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      logger.info('User authenticated via GitHub', { userId: user.id, username: user.username });

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
    } catch (error) {
      logger.error('GitHub OAuth callback error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed'
        }
      });
    }
  }
);

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await query(
      `SELECT id, github_id, username, email, role, profile_data, rating, 
              total_tasks, total_earnings, is_verified, is_blocked, 
              blocked_until, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const user = result.rows[0];
    
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

    res.json({
      success: true,
      data: {
        id: user.id,
        github_id: user.github_id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile_data: user.profile_data,
        rating: parseFloat(user.rating),
        total_tasks: user.total_tasks,
        total_earnings: parseFloat(user.total_earnings),
        is_verified: user.is_verified,
        is_blocked: user.is_blocked,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Refresh token
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Check if refresh token exists in cache
    const cachedToken = await cache.get(`refresh_token:${userId}`);
    if (!cachedToken || cachedToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }

    // Get user data
    const result = await query(
      'SELECT id, username, role, is_blocked FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const user = result.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_BLOCKED',
          message: 'User account is blocked'
        }
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    logger.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Remove refresh token from cache
    await cache.del(`refresh_token:${userId}`);
    
    logger.info('User logged out', { userId });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('skills').optional().isArray().withMessage('Skills must be an array'),
  body('experience').optional().isLength({ max: 200 }).withMessage('Experience must be less than 200 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const userId = req.user.userId;
    const { name, bio, location, skills, experience } = req.body;

    // Get current profile data
    const currentResult = await query(
      'SELECT profile_data FROM users WHERE id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const currentProfileData = currentResult.rows[0].profile_data || {};
    
    // Update profile data
    const updatedProfileData = {
      ...currentProfileData,
      ...(name && { name }),
      ...(bio && { bio }),
      ...(location && { location }),
      ...(skills && { skills }),
      ...(experience && { experience })
    };

    await query(
      'UPDATE users SET profile_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(updatedProfileData), userId]
    );

    // Clear user cache
    await cache.del(`user:${userId}`);

    logger.info('User profile updated', { userId });

    res.json({
      success: true,
      data: {
        profile_data: updatedProfileData
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

module.exports = router;
