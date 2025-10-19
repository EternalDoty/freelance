const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { cache } = require('../database/redis');
const { authenticateToken, requireModerator } = require('../middleware/auth');
const ratingService = require('../services/ratingService');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/ratings:
 *   post:
 *     summary: Submit rating for completed task
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transaction_id
 *               - rating
 *             properties:
 *               transaction_id:
 *                 type: integer
 *                 description: Transaction ID
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating (1-5)
 *               comment:
 *                 type: string
 *                 description: Optional comment
 *     responses:
 *       200:
 *         description: Rating submitted successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Transaction not found
 */
router.post('/', [
  body('transaction_id').isInt({ min: 1 }).withMessage('Transaction ID must be a positive integer'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment must be less than 500 characters')
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

    const { transaction_id, rating, comment } = req.body;
    const raterId = req.user.userId;

    // Get transaction details
    const transactionResult = await dbQuery(
      `SELECT et.*, t.customer_id, t.executor_id
       FROM escrow_transactions et
       JOIN tasks t ON et.task_id = t.id
       WHERE et.id = $1`,
      [transaction_id]
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        }
      });
    }

    const transaction = transactionResult.rows[0];

    // Check if user is part of this transaction
    if (transaction.customer_id !== raterId && transaction.executor_id !== raterId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only rate transactions you participated in'
        }
      });
    }

    // Determine who to rate
    const ratedUserId = transaction.customer_id === raterId ? 
      transaction.executor_id : transaction.customer_id;

    // Submit rating
    const ratingData = {
      transactionId: transaction_id,
      raterId,
      ratedUserId,
      rating,
      comment
    };

    const result = await ratingService.submitRating(ratingData);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Rating submitted successfully'
    });
  } catch (error) {
    logger.error('Submit rating error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'RATING_ALREADY_EXISTS',
          message: 'Rating already exists for this transaction'
        }
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

/**
 * @swagger
 * /api/ratings/{id}:
 *   get:
 *     summary: Get rating details
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rating details
 *       404:
 *         description: Rating not found
 */
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Rating ID must be a positive integer')
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

    const { id } = req.params;

    const result = await dbQuery(
      `SELECT r.*, u.username as rater_username, u.rating as rater_rating,
              t.title as task_title, et.amount as transaction_amount
       FROM ratings r
       JOIN users u ON r.rater_id = u.id
       JOIN escrow_transactions et ON r.transaction_id = et.id
       JOIN tasks t ON et.task_id = t.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RATING_NOT_FOUND',
          message: 'Rating not found'
        }
      });
    }

    const rating = result.rows[0];

    res.json({
      success: true,
      data: {
        id: rating.id,
        rating: rating.rating,
        comment: rating.comment,
        is_frozen: rating.is_frozen,
        rater: {
          username: rating.rater_username,
          rating: parseFloat(rating.rater_rating || 0)
        },
        task: {
          title: rating.task_title,
          amount: parseFloat(rating.transaction_amount || 0)
        },
        created_at: rating.created_at
      }
    });
  } catch (error) {
    logger.error('Get rating error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

/**
 * @swagger
 * /api/ratings/user/{id}:
 *   get:
 *     summary: Get user's ratings
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: include_frozen
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include frozen ratings
 *     responses:
 *       200:
 *         description: User's ratings
 */
router.get('/user/:id', [
  param('id').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('include_frozen').optional().isBoolean().withMessage('Include frozen must be a boolean')
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

    const { id } = req.params;
    const { page = 1, limit = 20, include_frozen = false } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      includeFrozen: include_frozen === 'true'
    };

    const result = await ratingService.getUserRatings(parseInt(id), options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get user ratings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

/**
 * @swagger
 * /api/ratings/user/{id}/stats:
 *   get:
 *     summary: Get user's rating statistics
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User's rating statistics
 */
router.get('/user/:id/stats', [
  param('id').isInt({ min: 1 }).withMessage('User ID must be a positive integer')
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

    const { id } = req.params;

    const stats = await ratingService.getRatingStats(parseInt(id));

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get rating stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Admin routes
/**
 * @swagger
 * /api/ratings/admin/freeze/{id}:
 *   put:
 *     summary: Freeze rating (admin)
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for freezing
 *     responses:
 *       200:
 *         description: Rating frozen successfully
 */
router.put('/admin/freeze/:id', requireModerator, [
  param('id').isInt({ min: 1 }).withMessage('Rating ID must be a positive integer'),
  body('reason').notEmpty().withMessage('Reason is required')
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

    const { id } = req.params;
    const { reason } = req.body;

    await ratingService.freezeRating(parseInt(id), reason);

    res.json({
      success: true,
      message: 'Rating frozen successfully'
    });
  } catch (error) {
    logger.error('Freeze rating error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

/**
 * @swagger
 * /api/ratings/admin/unfreeze/{id}:
 *   put:
 *     summary: Unfreeze rating (admin)
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rating unfrozen successfully
 */
router.put('/admin/unfreeze/:id', requireModerator, [
  param('id').isInt({ min: 1 }).withMessage('Rating ID must be a positive integer')
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

    const { id } = req.params;

    await ratingService.unfreezeRating(parseInt(id));

    res.json({
      success: true,
      message: 'Rating unfrozen successfully'
    });
  } catch (error) {
    logger.error('Unfreeze rating error:', error);
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
