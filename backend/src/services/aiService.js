const OpenAI = require('openai');
const { query } = require('../database/connection');
const { cache } = require('../database/redis');
const logger = require('../utils/logger');

// Initialize OpenAI client (optional)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    logger.warn('OpenAI client initialization failed:', error.message);
  }
}

class AIService {
  constructor() {
    this.confidenceThreshold = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.7;
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 1000;
  }

  /**
   * Process user message and generate AI response
   * @param {string} message - User message
   * @param {Object} context - User context (taskId, transactionId, userId)
   * @returns {Promise<Object>} AI response with confidence score
   */
  async processMessage(message, context = {}) {
    try {
      // Get user context
      const userContext = await this.getUserContext(context.userId);
      
      // Build prompt with context
      const prompt = this.buildPrompt(message, userContext, context);
      
      // Generate AI response
      const response = await this.generateResponse(prompt);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(message, response);
      
      // Store interaction
      await this.storeInteraction({
        userId: context.userId,
        message,
        response: response.content,
        confidence,
        context
      });

      return {
        content: response.content,
        confidence,
        shouldEscalate: confidence < this.confidenceThreshold,
        suggestions: this.generateSuggestions(message, confidence)
      };
    } catch (error) {
      logger.error('AI Service error:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  /**
   * Get user context for better AI responses
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User context
   */
  async getUserContext(userId) {
    try {
      // Check cache first
      const cacheKey = `ai_context:${userId}`;
      const cachedContext = await cache.get(cacheKey);
      if (cachedContext) {
        return cachedContext;
      }

      // Get user data
      const userResult = await query(
        `SELECT u.*, 
                COUNT(DISTINCT t.id) as total_tasks,
                COUNT(DISTINCT et.id) as total_transactions,
                AVG(r.rating) as avg_rating
         FROM users u
         LEFT JOIN tasks t ON u.id = t.customer_id
         LEFT JOIN escrow_transactions et ON u.id = et.customer_id OR u.id = et.executor_id
         LEFT JOIN ratings r ON r.rated_user_id = u.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return {};
      }

      const user = userResult.rows[0];

      // Get recent tasks
      const tasksResult = await query(
        `SELECT id, title, status, budget, created_at
         FROM tasks 
         WHERE customer_id = $1 OR id IN (
           SELECT task_id FROM proposals WHERE executor_id = $1
         )
         ORDER BY created_at DESC 
         LIMIT 5`,
        [userId]
      );

      // Get recent transactions
      const transactionsResult = await query(
        `SELECT et.*, t.title as task_title
         FROM escrow_transactions et
         JOIN tasks t ON et.task_id = t.id
         WHERE et.customer_id = $1 OR et.executor_id = $1
         ORDER BY et.created_at DESC 
         LIMIT 5`,
        [userId]
      );

      // Get recent support tickets
      const ticketsResult = await query(
        `SELECT id, subject, status, created_at
         FROM ai_support_tickets 
         WHERE user_id = $1
         ORDER BY created_at DESC 
         LIMIT 3`,
        [userId]
      );

      const context = {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          rating: parseFloat(user.avg_rating || 0),
          totalTasks: parseInt(user.total_tasks || 0),
          totalTransactions: parseInt(user.total_transactions || 0),
          isVerified: user.is_verified,
          isBlocked: user.is_blocked
        },
        recentTasks: tasksResult.rows,
        recentTransactions: transactionsResult.rows,
        recentTickets: ticketsResult.rows
      };

      // Cache context for 5 minutes
      await cache.set(cacheKey, context, 300);

      return context;
    } catch (error) {
      logger.error('Get user context error:', error);
      return {};
    }
  }

  /**
   * Build prompt for AI
   * @param {string} message - User message
   * @param {Object} userContext - User context
   * @param {Object} context - Additional context
   * @returns {string} Formatted prompt
   */
  buildPrompt(message, userContext, context) {
    const systemPrompt = `Ты - AI помощник платформы фриланса. Твоя задача - помочь пользователям с вопросами о платформе.

Контекст пользователя:
- Роль: ${userContext.user?.role || 'user'}
- Рейтинг: ${userContext.user?.rating || 0}
- Завершенных задач: ${userContext.user?.totalTasks || 0}
- Транзакций: ${userContext.user?.totalTransactions || 0}
- Верифицирован: ${userContext.user?.isVerified ? 'Да' : 'Нет'}

Правила:
1. Отвечай на русском языке
2. Будь дружелюбным и профессиональным
3. Если не уверен в ответе, скажи об этом
4. При сложных вопросах рекомендую обратиться к оператору
5. Не давай финансовых советов
6. Не решай споры между пользователями

Типы вопросов, с которыми ты можешь помочь:
- Как создать задачу
- Как подать предложение
- Как работает escrow
- Как получить выплату
- Как оставить отзыв
- Как подать апелляцию
- Технические проблемы
- Общие вопросы о платформе`;

    const contextPrompt = context.taskId ? 
      `\n\nКонтекст: Пользователь задает вопрос в контексте задачи #${context.taskId}` : '';
    
    const transactionContext = context.transactionId ? 
      `\n\nКонтекст: Пользователь задает вопрос в контексте транзакции #${context.transactionId}` : '';

    return `${systemPrompt}${contextPrompt}${transactionContext}

Вопрос пользователя: ${message}

Ответ:`;
  }

  /**
   * Generate AI response using OpenAI
   * @param {string} prompt - Formatted prompt
   * @returns {Promise<Object>} AI response
   */
  async generateResponse(prompt) {
    if (!openai) {
      return {
        content: 'AI сервис недоступен. Обратитесь к оператору поддержки.',
        usage: { total_tokens: 0 }
      };
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Ты - AI помощник платформы фриланса. Отвечай на русском языке, будь дружелюбным и профессиональным.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      return {
        content: response.choices[0].message.content,
        usage: response.usage
      };
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  /**
   * Calculate confidence score for AI response
   * @param {string} message - User message
   * @param {Object} response - AI response
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(message, response) {
    const messageLength = message.length;
    const responseLength = response.content.length;
    
    // Base confidence
    let confidence = 0.8;
    
    // Adjust based on message complexity
    if (messageLength < 10) confidence -= 0.2;
    if (messageLength > 100) confidence += 0.1;
    
    // Adjust based on response quality
    if (responseLength < 50) confidence -= 0.3;
    if (responseLength > 200) confidence += 0.1;
    
    // Check for uncertainty indicators
    const uncertaintyWords = ['не уверен', 'возможно', 'скорее всего', 'вероятно'];
    const hasUncertainty = uncertaintyWords.some(word => 
      response.content.toLowerCase().includes(word)
    );
    
    if (hasUncertainty) confidence -= 0.2;
    
    // Check for escalation indicators
    const escalationWords = ['оператор', 'модератор', 'поддержка', 'связаться'];
    const hasEscalation = escalationWords.some(word => 
      response.content.toLowerCase().includes(word)
    );
    
    if (hasEscalation) confidence -= 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate suggestions based on message and confidence
   * @param {string} message - User message
   * @param {number} confidence - Confidence score
   * @returns {Array} Array of suggestions
   */
  generateSuggestions(message, confidence) {
    const suggestions = [];
    
    if (confidence < 0.5) {
      suggestions.push('Связаться с оператором');
      suggestions.push('Создать тикет поддержки');
    }
    
    if (message.toLowerCase().includes('платеж') || message.toLowerCase().includes('деньги')) {
      suggestions.push('Проверить статус escrow');
      suggestions.push('Обратиться в поддержку по платежам');
    }
    
    if (message.toLowerCase().includes('задача') || message.toLowerCase().includes('проект')) {
      suggestions.push('Посмотреть мои задачи');
      suggestions.push('Создать новую задачу');
    }
    
    if (message.toLowerCase().includes('рейтинг') || message.toLowerCase().includes('отзыв')) {
      suggestions.push('Посмотреть мои отзывы');
      suggestions.push('Подать апелляцию на рейтинг');
    }
    
    return suggestions;
  }

  /**
   * Store AI interaction
   * @param {Object} interaction - Interaction data
   */
  async storeInteraction(interaction) {
    try {
      await query(
        `INSERT INTO ai_support_tickets 
         (user_id, subject, message, context, status, ai_confidence)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          interaction.userId,
          'AI Support',
          interaction.message,
          JSON.stringify(interaction.context),
          interaction.confidence < this.confidenceThreshold ? 'escalated' : 'ai_handling',
          interaction.confidence
        ]
      );
    } catch (error) {
      logger.error('Store interaction error:', error);
    }
  }

  /**
   * Get FAQ suggestions
   * @returns {Promise<Array>} FAQ items
   */
  async getFAQ() {
    try {
      const cacheKey = 'ai_faq';
      const cachedFAQ = await cache.get(cacheKey);
      if (cachedFAQ) {
        return cachedFAQ;
      }

      const faq = [
        {
          question: 'Как создать задачу?',
          answer: 'Перейдите в раздел "Задачи" и нажмите "Создать задачу". Заполните описание, укажите бюджет и сроки.',
          category: 'tasks'
        },
        {
          question: 'Как работает escrow?',
          answer: 'Escrow - это защищенная система платежей. Средства блокируются до завершения работы, затем переводятся исполнителю.',
          category: 'payments'
        },
        {
          question: 'Как получить выплату?',
          answer: 'После завершения задачи заказчик подтверждает выполнение, и средства автоматически переводятся на ваш счет.',
          category: 'payments'
        },
        {
          question: 'Как оставить отзыв?',
          answer: 'После завершения задачи вы можете оценить работу исполнителя и оставить комментарий.',
          category: 'ratings'
        },
        {
          question: 'Как подать апелляцию?',
          answer: 'Если вы не согласны с решением, перейдите в раздел "Апелляции" и создайте заявку с доказательствами.',
          category: 'appeals'
        }
      ];

      await cache.set(cacheKey, faq, 3600); // Cache for 1 hour
      return faq;
    } catch (error) {
      logger.error('Get FAQ error:', error);
      return [];
    }
  }

  /**
   * Analyze user sentiment
   * @param {string} message - User message
   * @returns {Object} Sentiment analysis
   */
  async analyzeSentiment(message) {
    if (!openai) {
      return { sentiment: 'neutral', confidence: 0.5 };
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Проанализируй эмоциональную окраску сообщения. Ответь только одним словом: positive, negative, neutral'
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const sentiment = response.choices[0].message.content.toLowerCase().trim();
      return {
        sentiment: ['positive', 'negative', 'neutral'].includes(sentiment) ? sentiment : 'neutral',
        confidence: 0.8
      };
    } catch (error) {
      logger.error('Sentiment analysis error:', error);
      return { sentiment: 'neutral', confidence: 0.5 };
    }
  }
}

module.exports = new AIService();
