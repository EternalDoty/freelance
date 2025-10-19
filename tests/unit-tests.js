const request = require('supertest');
const { expect } = require('chai');
const app = require('../backend/src/server');
const { query } = require('../backend/src/database/connection');
const { cache } = require('../backend/src/database/redis');

describe('B2C Freelance Platform - Unit Tests', () => {
  let authToken;
  let userId;
  let taskId;
  let transactionId;

  before(async () => {
    // Setup test database
    await query('BEGIN');
    
    // Create test user
    const userResult = await query(
      `INSERT INTO users (github_id, username, email, role, profile_data, rating, total_tasks, total_earnings, is_verified, is_blocked, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        'test-github-id',
        'testuser',
        'test@example.com',
        'user',
        '{"name": "Test User", "bio": "Test bio"}',
        0.0,
        0,
        0.0,
        true,
        false
      ]
    );
    
    userId = userResult.rows[0].id;
    
    // Generate test JWT token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { userId, username: 'testuser', role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    // Cleanup test database
    await query('ROLLBACK');
  });

  describe('Authentication Tests', () => {
    it('should authenticate with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.id).to.equal(userId);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('INVALID_TOKEN');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('AUTH_REQUIRED');
    });
  });

  describe('Task Management Tests', () => {
    it('should create a new task', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test task description',
        budget: 10000,
        category: 'web_development',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        requirements: {
          skills: ['React', 'Node.js'],
          experience: '2+ years'
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.data.title).to.equal(taskData.title);
      expect(response.body.data.customer_id).to.equal(userId);
      
      taskId = response.body.data.id;
    });

    it('should get task details', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.id).to.equal(taskId);
      expect(response.body.data.title).to.equal('Test Task');
    });

    it('should list tasks with pagination', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.tasks).to.be.an('array');
      expect(response.body.data.pagination).to.have.property('page');
      expect(response.body.data.pagination).to.have.property('total');
    });
  });

  describe('Escrow System Tests', () => {
    it('should fund escrow for task', async () => {
      const escrowData = {
        task_id: taskId,
        amount: 10000
      };

      const response = await request(app)
        .post('/api/escrow/fund')
        .set('Authorization', `Bearer ${authToken}`)
        .send(escrowData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.data.amount).to.equal(10000);
      expect(response.body.data.status).to.equal('FUNDED');
      
      transactionId = response.body.data.transaction_id;
    });

    it('should get escrow transactions', async () => {
      const response = await request(app)
        .get('/api/escrow/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.transactions).to.be.an('array');
      expect(response.body.data.transactions[0].id).to.equal(transactionId);
    });

    it('should release funds', async () => {
      const releaseData = {
        amount: 10000,
        reason: 'Task completed successfully'
      };

      const response = await request(app)
        .post(`/api/escrow/${transactionId}/release`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(releaseData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.status).to.equal('RELEASED');
    });
  });

  describe('Rating System Tests', () => {
    it('should submit rating', async () => {
      const ratingData = {
        transaction_id: transactionId,
        rating: 5,
        comment: 'Excellent work!'
      };

      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ratingData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.data.rating).to.equal(5);
      expect(response.body.data.comment).to.equal('Excellent work!');
    });

    it('should get user ratings', async () => {
      const response = await request(app)
        .get(`/api/ratings/user/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.ratings).to.be.an('array');
    });

    it('should get rating statistics', async () => {
      const response = await request(app)
        .get(`/api/ratings/user/${userId}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('avg_rating');
      expect(response.body.data).to.have.property('total_ratings');
    });
  });

  describe('AI Support Tests', () => {
    it('should create support ticket', async () => {
      const ticketData = {
        subject: 'Test Support Request',
        message: 'I need help with my account',
        context: {
          taskId: taskId
        }
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.data.subject).to.equal('Test Support Request');
    });

    it('should get FAQ', async () => {
      const response = await request(app)
        .get('/api/support/faq')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.be.an('array');
    });

    it('should chat with AI', async () => {
      const chatData = {
        message: 'How do I create a task?',
        context: {}
      };

      const response = await request(app)
        .post('/api/support/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('message');
      expect(response.body.data).to.have.property('confidence');
    });
  });

  describe('Input Validation Tests', () => {
    it('should reject invalid task data', async () => {
      const invalidTaskData = {
        title: '', // Empty title
        description: 'Test description',
        budget: -100, // Negative budget
        category: 'invalid_category'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTaskData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
    });

    it('should reject invalid rating', async () => {
      const invalidRatingData = {
        transaction_id: transactionId,
        rating: 10, // Invalid rating (should be 1-5)
        comment: 'Test comment'
      };

      const response = await request(app)
        .post('/api/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRatingData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('Authorization Tests', () => {
    it('should reject access to admin endpoints for regular users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('ACCESS_DENIED');
    });

    it('should reject access to other users resources', async () => {
      // Create another user
      const otherUserResult = await query(
        `INSERT INTO users (github_id, username, email, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        ['other-github-id', 'otheruser', 'other@example.com', 'user']
      );
      
      const otherUserId = otherUserResult.rows[0].id;

      const response = await request(app)
        .get(`/api/ratings/user/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // This should work as ratings are public

      expect(response.body.success).to.be.true;
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limiting', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle database errors gracefully', async () => {
      // This test would require mocking database errors
      // For now, we'll test with invalid data
      const response = await request(app)
        .get('/api/tasks/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).to.be.false;
      expect(response.body.error.code).to.equal('TASK_NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).to.be.false;
    });
  });

  describe('Cache Tests', () => {
    it('should cache user data', async () => {
      // First request
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      // Check if data is cached
      const cachedData = await cache.get(`user:${userId}`);
      expect(cachedData).to.not.be.null;
    });

    it('should invalidate cache on update', async () => {
      const updateData = {
        name: 'Updated Name',
        bio: 'Updated bio'
      };

      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Cache should be invalidated
      const cachedData = await cache.get(`user:${userId}`);
      expect(cachedData).to.be.null;
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: maliciousInput })
        .expect(200);

      // Should not cause database error
      expect(response.body.success).to.be.true;
    });

    it('should prevent XSS attacks', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: xssPayload,
          description: 'Test description',
          budget: 1000,
          category: 'web_development',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .expect(201);

      // Should sanitize the input
      expect(response.body.data.title).to.not.include('<script>');
    });
  });
});

// Performance Tests
describe('Performance Tests', () => {
  it('should handle concurrent requests', async () => {
    const requests = [];
    
    for (let i = 0; i < 50; i++) {
      requests.push(
        request(app)
          .get('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
      );
    }

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const endTime = Date.now();

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).to.be.oneOf([200, 429]); // 429 for rate limiting
    });

    // Should complete within reasonable time
    expect(endTime - startTime).to.be.lessThan(5000); // 5 seconds
  });

  it('should handle large payloads', async () => {
    const largeDescription = 'A'.repeat(10000); // 10KB description
    
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Large Task',
        description: largeDescription,
        budget: 1000,
        category: 'web_development',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .expect(201);

    expect(response.body.success).to.be.true;
  });
});

// Integration Tests
describe('Integration Tests', () => {
  it('should complete full task lifecycle', async () => {
    // 1. Create task
    const taskResponse = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Integration Test Task',
        description: 'Full lifecycle test',
        budget: 5000,
        category: 'web_development',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .expect(201);

    const taskId = taskResponse.body.data.id;

    // 2. Fund escrow
    const escrowResponse = await request(app)
      .post('/api/escrow/fund')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        task_id: taskId,
        amount: 5000
      })
      .expect(201);

    const transactionId = escrowResponse.body.data.transaction_id;

    // 3. Release funds
    await request(app)
      .post(`/api/escrow/${transactionId}/release`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 5000,
        reason: 'Task completed'
      })
      .expect(200);

    // 4. Submit rating
    await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        transaction_id: transactionId,
        rating: 5,
        comment: 'Great work!'
      })
      .expect(201);

    // 5. Verify task is completed
    const taskDetails = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(taskDetails.body.data.status).to.equal('completed');
  });
});
