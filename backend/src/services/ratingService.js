const { query, transaction } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');

class RatingService {
  constructor() {
    this.minRating = 1;
    this.maxRating = 5;
    this.freezeThreshold = 0.3; // Freeze rating if confidence < 0.3
  }

  /**
   * Submit rating for completed task
   * @param {Object} ratingData - Rating data
   * @returns {Promise<Object>} Created rating
   */
  async submitRating(ratingData) {
    const { transactionId, raterId, ratedUserId, rating, comment } = ratingData;

    try {
      // Validate rating
      if (rating < this.minRating || rating > this.maxRating) {
        throw new Error('Rating must be between 1 and 5');
      }

      // Check if rating already exists
      const existingRating = await query(
        'SELECT id FROM ratings WHERE transaction_id = $1 AND rater_id = $2',
        [transactionId, raterId]
      );

      if (existingRating.rows.length > 0) {
        throw new Error('Rating already exists for this transaction');
      }

      // Check if transaction is completed
      const transactionResult = await query(
        'SELECT status FROM escrow_transactions WHERE id = $1',
        [transactionId]
      );

      if (transactionResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      if (transactionResult.rows[0].status !== 'RELEASED') {
        throw new Error('Rating can only be submitted for completed transactions');
      }

      // Calculate rating confidence
      const confidence = await this.calculateRatingConfidence(ratingData);

      // Create rating
      const result = await transaction(async (client) => {
        // Insert rating
        const ratingResult = await client.query(
          `INSERT INTO ratings (transaction_id, rater_id, rated_user_id, rating, comment, is_frozen)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, rating, comment, is_frozen, created_at`,
          [transactionId, raterId, ratedUserId, rating, comment, confidence < this.freezeThreshold]
        );

        // Update user rating if not frozen
        if (confidence >= this.freezeThreshold) {
          await this.updateUserRating(client, ratedUserId);
        }

        return ratingResult.rows[0];
      });

      // Clear cache
      await cache.del(`user:${ratedUserId}:ratings`);
      await cache.del(`user:${ratedUserId}`);

      logger.info('Rating submitted', {
        ratingId: result.id,
        raterId,
        ratedUserId,
        rating,
        confidence,
        frozen: confidence < this.freezeThreshold
      });

      return {
        id: result.id,
        rating: result.rating,
        comment: result.comment,
        is_frozen: result.is_frozen,
        created_at: result.created_at
      };
    } catch (error) {
      logger.error('Submit rating error:', error);
      throw error;
    }
  }

  /**
   * Calculate rating confidence based on various factors
   * @param {Object} ratingData - Rating data
   * @returns {Promise<number>} Confidence score (0-1)
   */
  async calculateRatingConfidence(ratingData) {
    const { raterId, ratedUserId, rating, comment } = ratingData;
    
    let confidence = 0.8; // Base confidence

    try {
      // Get rater's rating history
      const raterHistory = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
         FROM ratings 
         WHERE rater_id = $1 AND is_frozen = false`,
        [raterId]
      );

      if (raterHistory.rows.length > 0) {
        const avgRating = parseFloat(raterHistory.rows[0].avg_rating || 0);
        const totalRatings = parseInt(raterHistory.rows[0].total_ratings || 0);
        
        // Adjust confidence based on rater's history
        if (totalRatings > 10) {
          confidence += 0.1; // Experienced rater
        }
        
        // Check for rating patterns
        if (Math.abs(rating - avgRating) > 2) {
          confidence -= 0.2; // Unusual rating
        }
      }

      // Get rated user's rating history
      const ratedUserHistory = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
         FROM ratings 
         WHERE rated_user_id = $1 AND is_frozen = false`,
        [ratedUserId]
      );

      if (ratedUserHistory.rows.length > 0) {
        const avgRating = parseFloat(ratedUserHistory.rows[0].avg_rating || 0);
        
        // Check for rating consistency
        if (Math.abs(rating - avgRating) > 1.5) {
          confidence -= 0.1; // Inconsistent with user's average
        }
      }

      // Check comment quality
      if (comment && comment.length > 10) {
        confidence += 0.1; // Detailed comment
      } else if (!comment || comment.length < 5) {
        confidence -= 0.1; // No or very short comment
      }

      // Check for suspicious patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(raterId, ratedUserId);
      if (suspiciousPatterns.length > 0) {
        confidence -= 0.3; // Suspicious activity detected
      }

      // Check for recent interactions
      const recentInteraction = await query(
        `SELECT COUNT(*) as count
         FROM escrow_transactions 
         WHERE (customer_id = $1 AND executor_id = $2) 
         OR (customer_id = $2 AND executor_id = $1)
         AND created_at > NOW() - INTERVAL '30 days'`,
        [raterId, ratedUserId]
      );

      if (parseInt(recentInteraction.rows[0].count) > 3) {
        confidence += 0.1; // Frequent collaborators
      }

      return Math.max(0, Math.min(1, confidence));
    } catch (error) {
      logger.error('Calculate rating confidence error:', error);
      return 0.5; // Default confidence
    }
  }

  /**
   * Detect suspicious rating patterns
   * @param {number} raterId - Rater ID
   * @param {number} ratedUserId - Rated user ID
   * @returns {Promise<Array>} List of suspicious patterns
   */
  async detectSuspiciousPatterns(raterId, ratedUserId) {
    const patterns = [];

    try {
      // Check for mutual high ratings
      const mutualRatings = await query(
        `SELECT r1.rating as rater_rating, r2.rating as rated_rating
         FROM ratings r1
         JOIN ratings r2 ON r1.rated_user_id = r2.rater_id AND r1.rater_id = r2.rated_user_id
         WHERE r1.rater_id = $1 AND r1.rated_user_id = $2
         AND r1.rating >= 4 AND r2.rating >= 4`,
        [raterId, ratedUserId]
      );

      if (mutualRatings.rows.length > 0) {
        patterns.push('mutual_high_ratings');
      }

      // Check for rating timing
      const recentRatings = await query(
        `SELECT COUNT(*) as count
         FROM ratings 
         WHERE rater_id = $1 
         AND created_at > NOW() - INTERVAL '1 hour'`,
        [raterId]
      );

      if (parseInt(recentRatings.rows[0].count) > 5) {
        patterns.push('rapid_rating_submission');
      }

      // Check for same IP ratings (if available)
      // This would require additional IP tracking in the database

      return patterns;
    } catch (error) {
      logger.error('Detect suspicious patterns error:', error);
      return [];
    }
  }

  /**
   * Update user's overall rating
   * @param {Object} client - Database client
   * @param {number} userId - User ID
   */
  async updateUserRating(client, userId) {
    try {
      const result = await client.query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
         FROM ratings 
         WHERE rated_user_id = $1 AND is_frozen = false`,
        [userId]
      );

      if (result.rows.length > 0) {
        const avgRating = parseFloat(result.rows[0].avg_rating || 0);
        const totalRatings = parseInt(result.rows[0].total_ratings || 0);

        await client.query(
          'UPDATE users SET rating = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [avgRating, userId]
        );

        logger.info('User rating updated', {
          userId,
          newRating: avgRating,
          totalRatings
        });
      }
    } catch (error) {
      logger.error('Update user rating error:', error);
    }
  }

  /**
   * Get user's ratings
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User ratings
   */
  async getUserRatings(userId, options = {}) {
    const { page = 1, limit = 20, includeFrozen = false } = options;
    const offset = (page - 1) * limit;

    try {
      let whereClause = 'WHERE r.rated_user_id = $1';
      let queryParams = [userId];
      let paramIndex = 2;

      if (!includeFrozen) {
        whereClause += ' AND r.is_frozen = false';
      }

      const ratingsResult = await query(
        `SELECT r.*, u.username as rater_username, u.rating as rater_rating,
                t.title as task_title, et.amount as transaction_amount
         FROM ratings r
         JOIN users u ON r.rater_id = u.id
         JOIN escrow_transactions et ON r.transaction_id = et.id
         JOIN tasks t ON et.task_id = t.id
         ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      const countResult = await query(
        `SELECT COUNT(*) as total
         FROM ratings r
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const ratings = ratingsResult.rows.map(row => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        is_frozen: row.is_frozen,
        rater: {
          username: row.rater_username,
          rating: parseFloat(row.rater_rating || 0)
        },
        task: {
          title: row.task_title,
          amount: parseFloat(row.transaction_amount || 0)
        },
        created_at: row.created_at
      }));

      return {
        ratings,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages
        }
      };
    } catch (error) {
      logger.error('Get user ratings error:', error);
      throw error;
    }
  }

  /**
   * Freeze rating due to suspicious activity
   * @param {number} ratingId - Rating ID
   * @param {string} reason - Freeze reason
   */
  async freezeRating(ratingId, reason) {
    try {
      await query(
        'UPDATE ratings SET is_frozen = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ratingId]
      );

      // Recalculate user rating
      const rating = await query(
        'SELECT rated_user_id FROM ratings WHERE id = $1',
        [ratingId]
      );

      if (rating.rows.length > 0) {
        await this.updateUserRating(null, rating.rows[0].rated_user_id);
      }

      logger.info('Rating frozen', {
        ratingId,
        reason
      });
    } catch (error) {
      logger.error('Freeze rating error:', error);
      throw error;
    }
  }

  /**
   * Unfreeze rating
   * @param {number} ratingId - Rating ID
   */
  async unfreezeRating(ratingId) {
    try {
      await query(
        'UPDATE ratings SET is_frozen = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ratingId]
      );

      // Recalculate user rating
      const rating = await query(
        'SELECT rated_user_id FROM ratings WHERE id = $1',
        [ratingId]
      );

      if (rating.rows.length > 0) {
        await this.updateUserRating(null, rating.rows[0].rated_user_id);
      }

      logger.info('Rating unfrozen', { ratingId });
    } catch (error) {
      logger.error('Unfreeze rating error:', error);
      throw error;
    }
  }

  /**
   * Get rating statistics
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Rating statistics
   */
  async getRatingStats(userId) {
    try {
      const result = await query(
        `SELECT 
           AVG(rating) as avg_rating,
           COUNT(*) as total_ratings,
           COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
           COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
           COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
           COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
           COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
           COUNT(CASE WHEN is_frozen = true THEN 1 END) as frozen_ratings
         FROM ratings 
         WHERE rated_user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return {
          avg_rating: 0,
          total_ratings: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          frozen_ratings: 0
        };
      }

      const stats = result.rows[0];
      const total = parseInt(stats.total_ratings || 0);

      return {
        avg_rating: parseFloat(stats.avg_rating || 0),
        total_ratings: total,
        distribution: {
          5: parseInt(stats.five_star || 0),
          4: parseInt(stats.four_star || 0),
          3: parseInt(stats.three_star || 0),
          2: parseInt(stats.two_star || 0),
          1: parseInt(stats.one_star || 0)
        },
        frozen_ratings: parseInt(stats.frozen_ratings || 0)
      };
    } catch (error) {
      logger.error('Get rating stats error:', error);
      throw error;
    }
  }
}

module.exports = new RatingService();
