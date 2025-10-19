# API Specification - B2C Freelance Platform

## Base URL
```
https://api.freelance-platform.com/v1
```

## Authentication
All API requests require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format
All API responses follow this format:
```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Endpoints

### Authentication

#### POST /auth/github
GitHub OAuth authentication

**Request:**
```json
{
  "code": "github_oauth_code",
  "state": "random_state_string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "rating": 4.5,
      "is_verified": true
    }
  }
}
```

#### GET /auth/me
Get current user profile

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "github_id": "12345",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "profile_data": {
      "name": "John Doe",
      "bio": "Full-stack developer",
      "skills": ["React", "Node.js", "PostgreSQL"],
      "location": "Moscow, Russia"
    },
    "rating": 4.5,
    "total_tasks": 15,
    "total_earnings": 125000.00,
    "is_verified": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Tasks

#### GET /tasks
Get list of tasks with filtering

**Query Parameters:**
- `category` (string): Filter by category
- `budget_min` (number): Minimum budget
- `budget_max` (number): Maximum budget
- `status` (string): Task status
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 1,
        "title": "React Frontend Development",
        "description": "Need a React developer for e-commerce site",
        "budget": 50000.00,
        "category": "web_development",
        "status": "open",
        "deadline": "2024-02-01T00:00:00Z",
        "customer": {
          "id": 2,
          "username": "customer_name",
          "rating": 4.8
        },
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

#### POST /tasks
Create new task

**Request:**
```json
{
  "title": "React Frontend Development",
  "description": "Need a React developer for e-commerce site",
  "budget": 50000.00,
  "category": "web_development",
  "deadline": "2024-02-01T00:00:00Z",
  "requirements": {
    "skills": ["React", "TypeScript", "Tailwind CSS"],
    "experience": "3+ years",
    "timeline": "2 weeks"
  },
  "is_private": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "React Frontend Development",
    "status": "open",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /tasks/:id
Get task details

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "React Frontend Development",
    "description": "Need a React developer for e-commerce site",
    "budget": 50000.00,
    "category": "web_development",
    "status": "open",
    "deadline": "2024-02-01T00:00:00Z",
    "requirements": {
      "skills": ["React", "TypeScript", "Tailwind CSS"],
      "experience": "3+ years",
      "timeline": "2 weeks"
    },
    "customer": {
      "id": 2,
      "username": "customer_name",
      "rating": 4.8,
      "total_tasks": 25
    },
    "proposals_count": 5,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Proposals

#### POST /tasks/:id/proposals
Submit proposal for task

**Request:**
```json
{
  "message": "I have 5 years of React experience and can complete this project in 2 weeks",
  "proposed_budget": 45000.00,
  "proposed_deadline": "2024-01-25T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /tasks/:id/proposals
Get proposals for task (only for task owner)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "message": "I have 5 years of React experience...",
      "proposed_budget": 45000.00,
      "proposed_deadline": "2024-01-25T00:00:00Z",
      "status": "pending",
      "executor": {
        "id": 3,
        "username": "developer_name",
        "rating": 4.7,
        "total_tasks": 20
      },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### PUT /proposals/:id/accept
Accept proposal

**Response:**
```json
{
  "success": true,
  "data": {
    "proposal_id": 1,
    "task_id": 1,
    "escrow_transaction_id": 1,
    "status": "accepted"
  }
}
```

### Escrow

#### POST /escrow/fund
Fund escrow for task

**Request:**
```json
{
  "task_id": 1,
  "amount": 50000.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": 1,
    "amount": 50000.00,
    "commission": 500.00,
    "commission_rate": 1.0,
    "status": "FUNDED",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### POST /escrow/:id/release
Release funds to executor

**Request:**
```json
{
  "amount": 50000.00,
  "reason": "Task completed successfully"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": 1,
    "status": "RELEASED",
    "released_amount": 50000.00,
    "commission": 500.00,
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### POST /escrow/:id/refund
Refund funds to customer

**Request:**
```json
{
  "reason": "Task not completed on time",
  "evidence": ["screenshot1.jpg", "screenshot2.jpg"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": 1,
    "status": "REFUNDED",
    "refunded_amount": 50000.00,
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /escrow/transactions
Get user's escrow transactions

**Query Parameters:**
- `status` (string): Filter by status
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "task_id": 1,
        "amount": 50000.00,
        "commission": 500.00,
        "status": "RELEASED",
        "task_title": "React Frontend Development",
        "counterparty": {
          "id": 3,
          "username": "developer_name",
          "rating": 4.7
        },
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### Ratings

#### POST /ratings
Submit rating for completed task

**Request:**
```json
{
  "transaction_id": 1,
  "rating": 5,
  "comment": "Excellent work, delivered on time!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "rating": 5,
    "comment": "Excellent work, delivered on time!",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /users/:id/ratings
Get user's ratings

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 3,
      "username": "developer_name",
      "rating": 4.7
    },
    "ratings": [
      {
        "id": 1,
        "rating": 5,
        "comment": "Excellent work, delivered on time!",
        "rater": {
          "id": 2,
          "username": "customer_name"
        },
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "pages": 1
    }
  }
}
```

### Appeals

#### POST /appeals
Create appeal

**Request:**
```json
{
  "type": "rating",
  "rating_id": 1,
  "reason": "Rating is unfair, work was completed according to requirements",
  "evidence": {
    "screenshots": ["proof1.jpg", "proof2.jpg"],
    "messages": ["message1", "message2"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "rating",
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /appeals
Get user's appeals

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "rating",
      "reason": "Rating is unfair...",
      "status": "pending",
      "moderator_comment": null,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### AI Support

#### POST /support/tickets
Create support ticket

**Request:**
```json
{
  "subject": "Payment issue",
  "message": "I didn't receive payment for completed task",
  "context": {
    "task_id": 1,
    "transaction_id": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "ai_handling",
    "ai_confidence": 0.85,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### GET /support/tickets
Get user's support tickets

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subject": "Payment issue",
      "status": "resolved",
      "ai_confidence": 0.85,
      "resolution": "Payment has been processed successfully",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Notifications

#### GET /notifications
Get user notifications

**Query Parameters:**
- `is_read` (boolean): Filter by read status
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "type": "task_proposal",
        "title": "New proposal received",
        "message": "You received a new proposal for 'React Frontend Development'",
        "data": {
          "task_id": 1,
          "proposal_id": 1
        },
        "is_read": false,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### PUT /notifications/:id/read
Mark notification as read

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "is_read": true
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `INVALID_TOKEN` | Invalid or expired token |
| `ACCESS_DENIED` | Insufficient permissions |
| `VALIDATION_ERROR` | Request validation failed |
| `TASK_NOT_FOUND` | Task not found |
| `PROPOSAL_NOT_FOUND` | Proposal not found |
| `ESCROW_NOT_FOUND` | Escrow transaction not found |
| `INSUFFICIENT_FUNDS` | Insufficient funds for operation |
| `TASK_NOT_AVAILABLE` | Task is not available for proposals |
| `RATING_ALREADY_EXISTS` | Rating already exists for transaction |
| `APPEAL_NOT_FOUND` | Appeal not found |
| `USER_BLOCKED` | User is blocked |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |

## Rate Limiting

- **General API**: 1000 requests per hour per user
- **Authentication**: 10 requests per minute per IP
- **File uploads**: 10 requests per minute per user
- **Support tickets**: 5 requests per hour per user

## Webhooks

### Task Events
- `task.created` - New task created
- `task.updated` - Task updated
- `task.completed` - Task completed

### Proposal Events
- `proposal.submitted` - New proposal submitted
- `proposal.accepted` - Proposal accepted
- `proposal.rejected` - Proposal rejected

### Escrow Events
- `escrow.funded` - Escrow funded
- `escrow.released` - Funds released
- `escrow.refunded` - Funds refunded
- `escrow.disputed` - Escrow disputed

### Rating Events
- `rating.submitted` - New rating submitted
- `rating.appealed` - Rating appealed

### Appeal Events
- `appeal.created` - New appeal created
- `appeal.resolved` - Appeal resolved
