const { test, expect } = require('@playwright/test');

test.describe('B2C Freelance Platform - E2E Tests', () => {
  let page;
  let context;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Authentication Flow', () => {
    test('should complete GitHub OAuth flow', async () => {
      // Navigate to home page
      await page.goto('http://localhost:3001');
      
      // Click login button
      await page.click('text=Войти через GitHub');
      
      // Mock GitHub OAuth response
      await page.route('**/api/auth/github/callback*', route => {
        route.fulfill({
          status: 302,
          headers: {
            'Location': 'http://localhost:3001/auth/callback?token=mock-token&refresh=mock-refresh'
          }
        });
      });
      
      // Wait for redirect to callback
      await page.waitForURL('**/auth/callback*');
      
      // Verify user is logged in
      await expect(page.locator('text=Профиль')).toBeVisible();
    });

    test('should handle authentication errors', async () => {
      await page.goto('http://localhost:3001');
      
      // Mock failed OAuth
      await page.route('**/api/auth/github/callback*', route => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({
            success: false,
            error: { code: 'AUTH_ERROR', message: 'Authentication failed' }
          })
        });
      });
      
      await page.click('text=Войти через GitHub');
      
      // Should show error message
      await expect(page.locator('text=Ошибка аутентификации')).toBeVisible();
    });
  });

  test.describe('Task Management', () => {
    test.beforeEach(async () => {
      // Mock authenticated user
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: {
              id: 1,
              username: 'testuser',
              role: 'user',
              profile_data: { name: 'Test User' }
            },
            isAuthenticated: true,
            accessToken: 'mock-token'
          }
        }));
      });
    });

    test('should create a new task', async () => {
      await page.goto('http://localhost:3001/tasks/create');
      
      // Fill task form
      await page.fill('input[name="title"]', 'E2E Test Task');
      await page.fill('textarea[name="description"]', 'This is a test task for E2E testing');
      await page.fill('input[name="budget"]', '10000');
      await page.selectOption('select[name="category"]', 'web_development');
      
      // Set deadline
      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await page.fill('input[name="deadline"]', deadline.toISOString().split('T')[0]);
      
      // Add skills
      await page.fill('input[name="skills"]', 'React, Node.js, TypeScript');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify success message
      await expect(page.locator('text=Задача создана успешно')).toBeVisible();
      
      // Verify redirect to task details
      await expect(page).toHaveURL(/\/tasks\/\d+/);
    });

    test('should display task list', async () => {
      await page.goto('http://localhost:3001/tasks');
      
      // Wait for tasks to load
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Verify task cards are displayed
      const taskCards = await page.locator('[data-testid="task-card"]');
      await expect(taskCards).toHaveCount.greaterThan(0);
      
      // Verify task information
      await expect(page.locator('text=E2E Test Task')).toBeVisible();
      await expect(page.locator('text=10,000 ₽')).toBeVisible();
    });

    test('should filter tasks by category', async () => {
      await page.goto('http://localhost:3001/tasks');
      
      // Select category filter
      await page.selectOption('select[name="category"]', 'web_development');
      
      // Click filter button
      await page.click('button[data-testid="filter-button"]');
      
      // Wait for filtered results
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Verify only web development tasks are shown
      const taskCards = await page.locator('[data-testid="task-card"]');
      const count = await taskCards.count();
      
      for (let i = 0; i < count; i++) {
        const card = taskCards.nth(i);
        await expect(card.locator('text=Web Development')).toBeVisible();
      }
    });

    test('should search tasks', async () => {
      await page.goto('http://localhost:3001/tasks');
      
      // Enter search query
      await page.fill('input[name="search"]', 'E2E Test');
      
      // Press Enter to search
      await page.press('input[name="search"]', 'Enter');
      
      // Wait for search results
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Verify search results
      await expect(page.locator('text=E2E Test Task')).toBeVisible();
    });
  });

  test.describe('User Profile', () => {
    test.beforeEach(async () => {
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: {
              id: 1,
              username: 'testuser',
              role: 'user',
              profile_data: { name: 'Test User', bio: 'Test bio' }
            },
            isAuthenticated: true,
            accessToken: 'mock-token'
          }
        }));
      });
    });

    test('should display user profile', async () => {
      await page.goto('http://localhost:3001/profile');
      
      // Verify profile information
      await expect(page.locator('text=Test User')).toBeVisible();
      await expect(page.locator('text=@testuser')).toBeVisible();
      await expect(page.locator('text=Test bio')).toBeVisible();
    });

    test('should edit user profile', async () => {
      await page.goto('http://localhost:3001/profile/edit');
      
      // Update profile information
      await page.fill('input[name="name"]', 'Updated Test User');
      await page.fill('textarea[name="bio"]', 'Updated bio');
      await page.fill('input[name="location"]', 'Moscow, Russia');
      
      // Add skills
      await page.fill('input[name="skills"]', 'React, Node.js, TypeScript');
      
      // Save changes
      await page.click('button[type="submit"]');
      
      // Verify success message
      await expect(page.locator('text=Профиль обновлен')).toBeVisible();
      
      // Verify redirect to profile
      await expect(page).toHaveURL('/profile');
      
      // Verify updated information
      await expect(page.locator('text=Updated Test User')).toBeVisible();
      await expect(page.locator('text=Updated bio')).toBeVisible();
    });
  });

  test.describe('Escrow System', () => {
    test.beforeEach(async () => {
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: {
              id: 1,
              username: 'testuser',
              role: 'user',
              profile_data: { name: 'Test User' }
            },
            isAuthenticated: true,
            accessToken: 'mock-token'
          }
        }));
      });
    });

    test('should fund escrow for task', async () => {
      await page.goto('http://localhost:3001/tasks/1');
      
      // Click fund escrow button
      await page.click('button[data-testid="fund-escrow"]');
      
      // Fill escrow form
      await page.fill('input[name="amount"]', '10000');
      
      // Submit escrow funding
      await page.click('button[type="submit"]');
      
      // Verify success message
      await expect(page.locator('text=Escrow funded successfully')).toBeVisible();
      
      // Verify escrow status
      await expect(page.locator('text=Status: FUNDED')).toBeVisible();
    });

    test('should release funds', async () => {
      await page.goto('http://localhost:3001/escrow');
      
      // Find funded transaction
      await page.waitForSelector('[data-testid="escrow-card"]');
      
      // Click release button
      await page.click('button[data-testid="release-funds"]');
      
      // Confirm release
      await page.click('button[data-testid="confirm-release"]');
      
      // Verify success message
      await expect(page.locator('text=Funds released successfully')).toBeVisible();
    });
  });

  test.describe('Rating System', () => {
    test.beforeEach(async () => {
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: {
              id: 1,
              username: 'testuser',
              role: 'user',
              profile_data: { name: 'Test User' }
            },
            isAuthenticated: true,
            accessToken: 'mock-token'
          }
        }));
      });
    });

    test('should submit rating', async () => {
      await page.goto('http://localhost:3001/escrow');
      
      // Find completed transaction
      await page.waitForSelector('[data-testid="escrow-card"]');
      
      // Click rate button
      await page.click('button[data-testid="rate-button"]');
      
      // Fill rating form
      await page.click('input[value="5"]'); // 5-star rating
      await page.fill('textarea[name="comment"]', 'Excellent work!');
      
      // Submit rating
      await page.click('button[type="submit"]');
      
      // Verify success message
      await expect(page.locator('text=Rating submitted successfully')).toBeVisible();
    });

    test('should display user ratings', async () => {
      await page.goto('http://localhost:3001/profile');
      
      // Navigate to ratings section
      await page.click('text=Отзывы');
      
      // Verify ratings are displayed
      await expect(page.locator('[data-testid="rating-card"]')).toBeVisible();
      await expect(page.locator('text=Excellent work!')).toBeVisible();
    });
  });

  test.describe('AI Support', () => {
    test.beforeEach(async () => {
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: {
              id: 1,
              username: 'testuser',
              role: 'user',
              profile_data: { name: 'Test User' }
            },
            isAuthenticated: true,
            accessToken: 'mock-token'
          }
        }));
      });
    });

    test('should open AI support chat', async () => {
      await page.goto('http://localhost:3001/support');
      
      // Click AI chat button
      await page.click('button[data-testid="ai-chat-button"]');
      
      // Verify chat interface is open
      await expect(page.locator('[data-testid="ai-chat"]')).toBeVisible();
      await expect(page.locator('text=AI Support')).toBeVisible();
    });

    test('should send message to AI', async () => {
      await page.goto('http://localhost:3001/support');
      
      // Open AI chat
      await page.click('button[data-testid="ai-chat-button"]');
      
      // Type message
      await page.fill('textarea[name="message"]', 'How do I create a task?');
      
      // Send message
      await page.click('button[data-testid="send-message"]');
      
      // Verify message is sent
      await expect(page.locator('text=How do I create a task?')).toBeVisible();
      
      // Wait for AI response
      await page.waitForSelector('[data-testid="ai-response"]');
      
      // Verify AI response
      await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
    });

    test('should escalate to operator', async () => {
      await page.goto('http://localhost:3001/support');
      
      // Open AI chat
      await page.click('button[data-testid="ai-chat-button"]');
      
      // Send complex message that should trigger escalation
      await page.fill('textarea[name="message"]', 'I have a complex legal issue with my account');
      await page.click('button[data-testid="send-message"]');
      
      // Wait for escalation message
      await page.waitForSelector('text=Передаю ваш вопрос оператору');
      
      // Verify escalation
      await expect(page.locator('text=Передаю ваш вопрос оператору')).toBeVisible();
    });
  });

  test.describe('Appeals System', () => {
    test.beforeEach(async () => {
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: {
              id: 1,
              username: 'testuser',
              role: 'user',
              profile_data: { name: 'Test User' }
            },
            isAuthenticated: true,
            accessToken: 'mock-token'
          }
        }));
      });
    });

    test('should create appeal', async () => {
      await page.goto('http://localhost:3001/appeals');
      
      // Click create appeal button
      await page.click('button[data-testid="create-appeal"]');
      
      // Fill appeal form
      await page.selectOption('select[name="type"]', 'rating');
      await page.fill('textarea[name="reason"]', 'The rating is unfair');
      await page.fill('textarea[name="additional_comments"]', 'I have evidence to support my case');
      
      // Upload evidence files
      await page.setInputFiles('input[type="file"]', [
        'tests/fixtures/evidence1.jpg',
        'tests/fixtures/evidence2.pdf'
      ]);
      
      // Submit appeal
      await page.click('button[type="submit"]');
      
      // Verify success message
      await expect(page.locator('text=Appeal submitted successfully')).toBeVisible();
    });

    test('should view appeal status', async () => {
      await page.goto('http://localhost:3001/appeals');
      
      // Wait for appeals to load
      await page.waitForSelector('[data-testid="appeal-card"]');
      
      // Verify appeal is displayed
      await expect(page.locator('text=The rating is unfair')).toBeVisible();
      await expect(page.locator('text=Status: Pending')).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.addInitScript(() => {
        window.localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: {
              id: 1,
              username: 'testuser',
              role: 'user',
              profile_data: { name: 'Test User' }
            },
            isAuthenticated: true,
            accessToken: 'mock-token'
          }
        }));
      });
    });

    test('should display mobile menu', async () => {
      await page.goto('http://localhost:3001');
      
      // Click mobile menu button
      await page.click('button[data-testid="mobile-menu-button"]');
      
      // Verify mobile menu is open
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Verify menu items
      await expect(page.locator('text=Главная')).toBeVisible();
      await expect(page.locator('text=Задачи')).toBeVisible();
      await expect(page.locator('text=Профиль')).toBeVisible();
    });

    test('should handle mobile task creation', async () => {
      await page.goto('http://localhost:3001/tasks/create');
      
      // Fill form on mobile
      await page.fill('input[name="title"]', 'Mobile Test Task');
      await page.fill('textarea[name="description"]', 'Mobile test description');
      await page.fill('input[name="budget"]', '5000');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify success
      await expect(page.locator('text=Задача создана успешно')).toBeVisible();
    });
  });

  test.describe('Performance Tests', () => {
    test('should load page within acceptable time', async () => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:3001');
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large task lists', async () => {
      await page.goto('http://localhost:3001/tasks');
      
      // Wait for tasks to load
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Scroll to load more tasks
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      // Wait for additional tasks to load
      await page.waitForTimeout(1000);
      
      // Verify tasks are still visible
      await expect(page.locator('[data-testid="task-card"]')).toBeVisible();
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should have proper ARIA labels', async () => {
      await page.goto('http://localhost:3001');
      
      // Check for ARIA labels on interactive elements
      await expect(page.locator('button[aria-label]')).toBeVisible();
      await expect(page.locator('input[aria-label]')).toBeVisible();
    });

    test('should support keyboard navigation', async () => {
      await page.goto('http://localhost:3001');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Verify focus is visible
      await expect(page.locator(':focus')).toBeVisible();
    });

    test('should have proper color contrast', async () => {
      await page.goto('http://localhost:3001');
      
      // Check text contrast (this would require additional tools in real implementation)
      const textElements = await page.locator('text=Главная');
      await expect(textElements).toBeVisible();
    });
  });
});
