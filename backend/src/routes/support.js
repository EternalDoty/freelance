const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { query: dbQuery, transaction } = require('../database/connection');
const { cache } = require('../database/redis');
const { authenticateToken, requireModerator } = require('../middleware/auth');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/support/tickets:
 *   post:
 *     summary: Create support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Ticket subject
 *               message:
 *                 type: string
 *                 description: Ticket message
 *               context:
 *                 type: object
 *                 description: Additional context
 *     responses:
 *       200:
 *         description: Ticket created successfully
 *       400:
 *         description: Validation error
 */
router.post('/tickets', [
  body('subject').notEmpty().withMessage('Subject is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('context').optional().isObject().withMessage('Context must be an object')
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

    const { subject, message, context = {} } = req.body;
    const userId = req.user.userId;

    // Process with AI first
    const aiResponse = await aiService.processMessage(message, {
      userId,
      ...context
    });

    // Determine ticket status
    let status = 'ai_handling';
    let operatorId = null;
    let resolution = null;

    if (aiResponse.shouldEscalate) {
      status = 'escalated';
      // Find available operator
      const operatorResult = await dbQuery(
        `SELECT id FROM users 
         WHERE role IN ('moderator', 'admin') 
         AND is_blocked = false
         ORDER BY RANDOM()
         LIMIT 1`
      );
      
      if (operatorResult.rows.length > 0) {
        operatorId = operatorResult.rows[0].id;
      }
    }

    // Create ticket
    const result = await dbQuery(
      `INSERT INTO ai_support_tickets 
       (user_id, subject, message, context, status, ai_confidence, operator_id, resolution)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, status, ai_confidence, created_at`,
      [
        userId,
        subject,
        message,
        JSON.stringify(context),
        status,
        aiResponse.confidence,
        operatorId,
        resolution
      ]
    );

    const ticket = result.rows[0];

    // Clear cache
    await cache.del(`user:${userId}:tickets`);

    logger.info('Support ticket created', {
      ticketId: ticket.id,
      userId,
      status,
      confidence: aiResponse.confidence
    });

    res.status(201).json({
      success: true,
      data: {
        id: ticket.id,
        status: ticket.status,
        ai_confidence: parseFloat(ticket.ai_confidence),
        ai_response: aiResponse.content,
        suggestions: aiResponse.suggestions,
        created_at: ticket.created_at
      },
      message: 'Support ticket created successfully'
    });
  } catch (error) {
    logger.error('Create support ticket error:', error);
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
 * /api/support/tickets:
 *   get:
 *     summary: Get user's support tickets
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, ai_handling, escalated, resolved, closed]
 *         description: Filter by status
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
 *     responses:
 *       200:
 *         description: List of support tickets
 */
router.get('/tickets', [
  query('status').optional().isIn(['open', 'ai_handling', 'escalated', 'resolved', 'closed']),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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

    const { status, page = 1, limit = 20 } = req.query;
    const userId = req.user.userId;
    const offset = (page - 1) * limit;

    // Build query
    let whereClause = 'WHERE user_id = $1';
    let queryParams = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Get tickets
    const ticketsResult = await dbQuery(
      `SELECT t.*, u.username as operator_username
       FROM ai_support_tickets t
       LEFT JOIN users u ON t.operator_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM ai_support_tickets
       ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Format tickets
    const tickets = ticketsResult.rows.map(row => ({
      id: row.id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      ai_confidence: parseFloat(row.ai_confidence || 0),
      operator: row.operator_username ? {
        username: row.operator_username
      } : null,
      resolution: row.resolution,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: totalPages
        }
      }
    });
  } catch (error) {
    logger.error('Get support tickets error:', error);
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
 * /api/support/tickets/{id}:
 *   get:
 *     summary: Get support ticket details
 *     tags: [Support]
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
 *         description: Ticket details
 *       404:
 *         description: Ticket not found
 */
router.get('/tickets/:id', [
  param('id').isInt({ min: 1 }).withMessage('Ticket ID must be a positive integer')
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
    const userId = req.user.userId;

    const result = await dbQuery(
      `SELECT t.*, u.username as operator_username
       FROM ai_support_tickets t
       LEFT JOIN users u ON t.operator_id = u.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'Support ticket not found'
        }
      });
    }

    const ticket = result.rows[0];

    res.json({
      success: true,
      data: {
        id: ticket.id,
        subject: ticket.subject,
        message: ticket.message,
        context: JSON.parse(ticket.context || '{}'),
        status: ticket.status,
        ai_confidence: parseFloat(ticket.ai_confidence || 0),
        operator: ticket.operator_username ? {
          username: ticket.operator_username
        } : null,
        resolution: ticket.resolution,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at
      }
    });
  } catch (error) {
    logger.error('Get support ticket error:', error);
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
 * /api/support/faq:
 *   get:
 *     summary: Get FAQ
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FAQ list
 */
router.get('/faq', async (req, res) => {
  try {
    const faq = await aiService.getFAQ();

    res.json({
      success: true,
      data: faq
    });
  } catch (error) {
    logger.error('Get FAQ error:', error);
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
 * /api/support/chat:
 *   post:
 *     summary: Chat with AI
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message
 *               context:
 *                 type: object
 *                 description: Additional context
 *     responses:
 *       200:
 *         description: AI response
 */
router.post('/chat', [
  body('message').notEmpty().withMessage('Message is required'),
  body('context').optional().isObject().withMessage('Context must be an object')
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

    const { message, context = {} } = req.body;
    const userId = req.user.userId;

    // Process with AI
    const aiResponse = await aiService.processMessage(message, {
      userId,
      ...context
    });

    res.json({
      success: true,
      data: {
        message: aiResponse.content,
        confidence: aiResponse.confidence,
        should_escalate: aiResponse.shouldEscalate,
        suggestions: aiResponse.suggestions
      }
    });
  } catch (error) {
    logger.error('AI chat error:', error);
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
 * /api/support/admin/tickets:
 *   get:
 *     summary: Get all support tickets (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of all support tickets
 */
router.get('/admin/tickets', requireModerator, [
  query('status').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereClause = 'WHERE t.status = $1';
      queryParams.push(status);
      paramIndex++;
    }

    const ticketsResult = await dbQuery(
      `SELECT t.*, u.username as user_username, o.username as operator_username
       FROM ai_support_tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN users o ON t.operator_id = o.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM ai_support_tickets t
       ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const tickets = ticketsResult.rows.map(row => ({
      id: row.id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      ai_confidence: parseFloat(row.ai_confidence || 0),
      user: {
        id: row.user_id,
        username: row.user_username
      },
      operator: row.operator_username ? {
        username: row.operator_username
      } : null,
      resolution: row.resolution,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: totalPages
        }
      }
    });
  } catch (error) {
    logger.error('Get admin tickets error:', error);
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
 * /api/support/admin/tickets/{id}/resolve:
 *   put:
 *     summary: Resolve support ticket (admin)
 *     tags: [Support]
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
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Resolution message
 *     responses:
 *       200:
 *         description: Ticket resolved successfully
 */
router.put('/admin/tickets/:id/resolve', requireModerator, [
  param('id').isInt({ min: 1 }).withMessage('Ticket ID must be a positive integer'),
  body('resolution').notEmpty().withMessage('Resolution is required')
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
    const { resolution } = req.body;
    const operatorId = req.user.userId;

    const result = await dbQuery(
      `UPDATE ai_support_tickets 
       SET status = 'resolved', resolution = $1, operator_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, status, resolution`,
      [resolution, operatorId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'Support ticket not found'
        }
      });
    }

    const ticket = result.rows[0];

    logger.info('Support ticket resolved', {
      ticketId: ticket.id,
      operatorId,
      resolution
    });

    res.json({
      success: true,
      data: {
        id: ticket.id,
        status: ticket.status,
        resolution: ticket.resolution
      },
      message: 'Ticket resolved successfully'
    });
  } catch (error) {
    logger.error('Resolve ticket error:', error);
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
