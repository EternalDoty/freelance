const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { query: dbQuery, transaction } = require('../database/connection');
const { cache } = require('../database/redis');
const { authenticateToken, requireOwnership } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/escrow/fund:
 *   post:
 *     summary: Fund escrow for task
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - task_id
 *               - amount
 *             properties:
 *               task_id:
 *                 type: integer
 *                 description: Task ID
 *               amount:
 *                 type: number
 *                 description: Amount to fund
 *     responses:
 *       200:
 *         description: Escrow funded successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Task not found
 *       403:
 *         description: Access denied
 */
router.post('/fund', [
  body('task_id').isInt({ min: 1 }).withMessage('Task ID must be a positive integer'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
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

    const { task_id, amount } = req.body;
    const customerId = req.user.userId;

    // Check if task exists and user is the customer
    const taskResult = await dbQuery(
      `SELECT id, customer_id, status, budget FROM tasks WHERE id = $1`,
      [task_id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found'
        }
      });
    }

    const task = taskResult.rows[0];

    if (task.customer_id !== customerId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only fund your own tasks'
        }
      });
    }

    if (task.status !== 'open') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TASK_NOT_AVAILABLE',
          message: 'Task is not available for funding'
        }
      });
    }

    if (amount > task.budget) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Amount cannot exceed task budget'
        }
      });
    }

    // Calculate commission
    const commissionRate = await getCommissionRate(amount);
    const commission = (amount * commissionRate) / 100;

    // Create escrow transaction
    const result = await transaction(async (client) => {
      // Create escrow transaction
      const escrowResult = await client.query(
        `INSERT INTO escrow_transactions (task_id, customer_id, executor_id, amount, commission, commission_rate, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'FUNDED')
         RETURNING id, amount, commission, commission_rate, status, created_at`,
        [task_id, customerId, null, amount, commission, commissionRate]
      );

      // Update task status
      await client.query(
        'UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['in_progress', task_id]
      );

      return escrowResult.rows[0];
    });

    // Clear cache
    await cache.del(`task:${task_id}`);
    await cache.del(`user:${customerId}`);

    logger.info('Escrow funded', {
      transactionId: result.id,
      taskId: task_id,
      customerId,
      amount,
      commission
    });

    res.status(201).json({
      success: true,
      data: {
        transaction_id: result.id,
        amount: parseFloat(result.amount),
        commission: parseFloat(result.commission),
        commission_rate: parseFloat(result.commission_rate),
        status: result.status,
        created_at: result.created_at
      },
      message: 'Escrow funded successfully'
    });
  } catch (error) {
    logger.error('Fund escrow error:', error);
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
 * /api/escrow/{id}/release:
 *   post:
 *     summary: Release funds to executor
 *     tags: [Escrow]
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
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to release
 *               reason:
 *                 type: string
 *                 description: Reason for release
 *     responses:
 *       200:
 *         description: Funds released successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Transaction not found
 *       403:
 *         description: Access denied
 */
router.post('/:id/release', [
  param('id').isInt({ min: 1 }).withMessage('Transaction ID must be a positive integer'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
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
    const { amount, reason } = req.body;
    const userId = req.user.userId;

    // Get transaction details
    const transactionResult = await dbQuery(
      `SELECT et.*, t.title as task_title, t.customer_id, t.executor_id
       FROM escrow_transactions et
       JOIN tasks t ON et.task_id = t.id
       WHERE et.id = $1`,
      [id]
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ESCROW_NOT_FOUND',
          message: 'Escrow transaction not found'
        }
      });
    }

    const transaction = transactionResult.rows[0];

    // Check if user is the customer
    if (transaction.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only release funds for your own transactions'
        }
      });
    }

    if (transaction.status !== 'PENDING_RELEASE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Transaction is not in pending release status'
        }
      });
    }

    if (amount > transaction.amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Amount cannot exceed transaction amount'
        }
      });
    }

    // Update transaction status
    await dbQuery(
      `UPDATE escrow_transactions 
       SET status = 'RELEASED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Update user earnings
    if (transaction.executor_id) {
      await dbQuery(
        `UPDATE users 
         SET total_earnings = total_earnings + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [amount, transaction.executor_id]
      );
    }

    // Clear cache
    await cache.del(`escrow:${id}`);
    await cache.del(`user:${transaction.customer_id}`);
    if (transaction.executor_id) {
      await cache.del(`user:${transaction.executor_id}`);
    }

    logger.info('Escrow released', {
      transactionId: id,
      customerId: transaction.customer_id,
      executorId: transaction.executor_id,
      amount,
      reason
    });

    res.json({
      success: true,
      data: {
        transaction_id: parseInt(id),
        status: 'RELEASED',
        released_amount: amount,
        commission: parseFloat(transaction.commission),
        updated_at: new Date().toISOString()
      },
      message: 'Funds released successfully'
    });
  } catch (error) {
    logger.error('Release escrow error:', error);
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
 * /api/escrow/{id}/refund:
 *   post:
 *     summary: Refund funds to customer
 *     tags: [Escrow]
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
 *                 description: Reason for refund
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Evidence files
 *     responses:
 *       200:
 *         description: Funds refunded successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Transaction not found
 *       403:
 *         description: Access denied
 */
router.post('/:id/refund', [
  param('id').isInt({ min: 1 }).withMessage('Transaction ID must be a positive integer'),
  body('reason').notEmpty().withMessage('Reason is required'),
  body('evidence').optional().isArray().withMessage('Evidence must be an array')
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
    const { reason, evidence = [] } = req.body;
    const userId = req.user.userId;

    // Get transaction details
    const transactionResult = await dbQuery(
      `SELECT et.*, t.customer_id, t.executor_id
       FROM escrow_transactions et
       JOIN tasks t ON et.task_id = t.id
       WHERE et.id = $1`,
      [id]
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ESCROW_NOT_FOUND',
          message: 'Escrow transaction not found'
        }
      });
    }

    const transaction = transactionResult.rows[0];

    // Check if user is the customer
    if (transaction.customer_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only refund your own transactions'
        }
      });
    }

    if (!['FUNDED', 'IN_PROGRESS'].includes(transaction.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Transaction cannot be refunded in current status'
        }
      });
    }

    // Update transaction status
    await dbQuery(
      `UPDATE escrow_transactions 
       SET status = 'REFUNDED', dispute_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [reason, id]
    );

    // Clear cache
    await cache.del(`escrow:${id}`);
    await cache.del(`user:${transaction.customer_id}`);

    logger.info('Escrow refunded', {
      transactionId: id,
      customerId: transaction.customer_id,
      reason,
      evidence: evidence.length
    });

    res.json({
      success: true,
      data: {
        transaction_id: parseInt(id),
        status: 'REFUNDED',
        refunded_amount: parseFloat(transaction.amount),
        reason,
        updated_at: new Date().toISOString()
      },
      message: 'Funds refunded successfully'
    });
  } catch (error) {
    logger.error('Refund escrow error:', error);
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
 * /api/escrow/transactions:
 *   get:
 *     summary: Get user's escrow transactions
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [INIT, FUNDED, IN_PROGRESS, PENDING_RELEASE, RELEASED, REFUNDED, DISPUTE]
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
 *         description: List of escrow transactions
 */
router.get('/transactions', [
  query('status').optional().isIn(['INIT', 'FUNDED', 'IN_PROGRESS', 'PENDING_RELEASE', 'RELEASED', 'REFUNDED', 'DISPUTE']),
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
    let whereClause = 'WHERE (et.customer_id = $1 OR et.executor_id = $1)';
    let queryParams = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND et.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Get transactions
    const transactionsResult = await dbQuery(
      `SELECT et.*, t.title as task_title, 
              CASE 
                WHEN et.customer_id = $1 THEN u2.username
                ELSE u1.username
              END as counterparty_username,
              CASE 
                WHEN et.customer_id = $1 THEN u2.rating
                ELSE u1.rating
              END as counterparty_rating
       FROM escrow_transactions et
       JOIN tasks t ON et.task_id = t.id
       LEFT JOIN users u1 ON et.customer_id = u1.id
       LEFT JOIN users u2 ON et.executor_id = u2.id
       ${whereClause}
       ORDER BY et.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total
       FROM escrow_transactions et
       ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Format transactions
    const transactions = transactionsResult.rows.map(row => ({
      id: row.id,
      task_id: row.task_id,
      task_title: row.task_title,
      amount: parseFloat(row.amount),
      commission: parseFloat(row.commission),
      commission_rate: parseFloat(row.commission_rate),
      status: row.status,
      counterparty: {
        username: row.counterparty_username,
        rating: parseFloat(row.counterparty_rating)
      },
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: totalPages
        }
      }
    });
  } catch (error) {
    logger.error('Get escrow transactions error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }
    });
  }
});

// Helper function to get commission rate
async function getCommissionRate(amount) {
  const result = await dbQuery(
    `SELECT rate FROM commission_rates 
     WHERE is_active = true 
     AND $1 >= min_amount 
     AND $1 < max_amount
     ORDER BY min_amount DESC
     LIMIT 1`,
    [amount]
  );

  return result.rows.length > 0 ? parseFloat(result.rows[0].rate) : 1.0;
}

module.exports = router;
