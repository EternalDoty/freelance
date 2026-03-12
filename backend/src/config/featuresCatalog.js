const featuresCatalog = {
  platform: {
    name: 'B2C Freelance Platform API',
    version: '1.0.0',
  },
  features: [
    {
      key: 'auth',
      name: 'Authentication',
      description: 'JWT and GitHub OAuth authorization flows.',
      basePath: '/api/auth',
    },
    {
      key: 'users',
      name: 'Users',
      description: 'User profile management and account operations.',
      basePath: '/api/users',
    },
    {
      key: 'tasks',
      name: 'Tasks',
      description: 'Task publishing, browsing and execution lifecycle.',
      basePath: '/api/tasks',
    },
    {
      key: 'proposals',
      name: 'Proposals',
      description: 'Submission and moderation of responses to tasks.',
      basePath: '/api/proposals',
    },
    {
      key: 'escrow',
      name: 'Escrow',
      description: 'Deal funding, release and dispute hold operations.',
      basePath: '/api/escrow',
    },
    {
      key: 'ratings',
      name: 'Ratings',
      description: 'Post-deal ratings and reputation metrics.',
      basePath: '/api/ratings',
    },
    {
      key: 'appeals',
      name: 'Appeals',
      description: 'Appeal filing and moderation decision tracking.',
      basePath: '/api/appeals',
    },
    {
      key: 'support',
      name: 'AI Support',
      description: 'Support tickets with AI triage and operator escalation.',
      basePath: '/api/support',
    },
    {
      key: 'notifications',
      name: 'Notifications',
      description: 'User alerts, status updates and delivery management.',
      basePath: '/api/notifications',
    },
    {
      key: 'admin',
      name: 'Administration',
      description: 'Moderation, user restrictions and platform control actions.',
      basePath: '/api/admin',
    },
  ],
};

module.exports = featuresCatalog;
