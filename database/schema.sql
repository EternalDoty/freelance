-- B2C Freelance Platform Database Schema
-- PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    github_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
    profile_data JSONB DEFAULT '{}',
    rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    total_tasks INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    budget DECIMAL(12,2) NOT NULL CHECK (budget > 0),
    category VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled', 'disputed')),
    requirements JSONB DEFAULT '{}',
    deadline TIMESTAMP NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proposals table
CREATE TABLE proposals (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    executor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    proposed_budget DECIMAL(12,2) NOT NULL CHECK (proposed_budget > 0),
    proposed_deadline TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, executor_id)
);

-- Escrow transactions table
CREATE TABLE escrow_transactions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    executor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    commission DECIMAL(12,2) NOT NULL CHECK (commission >= 0),
    commission_rate DECIMAL(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    status VARCHAR(20) DEFAULT 'INIT' CHECK (status IN ('INIT', 'FUNDED', 'IN_PROGRESS', 'PENDING_RELEASE', 'RELEASED', 'REFUNDED', 'DISPUTE')),
    payment_data JSONB DEFAULT '{}',
    dispute_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ratings table
CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
    rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_frozen BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id, rater_id)
);

-- Appeals table
CREATE TABLE appeals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id INTEGER NULL REFERENCES escrow_transactions(id) ON DELETE SET NULL,
    rating_id INTEGER NULL REFERENCES ratings(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('transaction', 'rating', 'block', 'other')),
    reason TEXT NOT NULL,
    evidence JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
    moderator_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    moderator_comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blocks table
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moderator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    block_type VARCHAR(20) NOT NULL CHECK (block_type IN ('temporary', 'permanent', 'hardware')),
    duration_hours INTEGER NULL,
    hardware_fingerprint VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Support tickets table
CREATE TABLE ai_support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'ai_handling', 'escalated', 'resolved', 'closed')),
    ai_confidence DECIMAL(3,2) NULL CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    operator_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    resolution TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commission rates table (for dynamic commission management)
CREATE TABLE commission_rates (
    id SERIAL PRIMARY KEY,
    min_amount DECIMAL(12,2) NOT NULL,
    max_amount DECIMAL(12,2) NOT NULL,
    rate DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_rating ON users(rating);
CREATE INDEX idx_users_is_blocked ON users(is_blocked);

CREATE INDEX idx_tasks_customer_id ON tasks(customer_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_budget ON tasks(budget);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

CREATE INDEX idx_proposals_task_id ON proposals(task_id);
CREATE INDEX idx_proposals_executor_id ON proposals(executor_id);
CREATE INDEX idx_proposals_status ON proposals(status);

CREATE INDEX idx_escrow_transactions_task_id ON escrow_transactions(task_id);
CREATE INDEX idx_escrow_transactions_customer_id ON escrow_transactions(customer_id);
CREATE INDEX idx_escrow_transactions_executor_id ON escrow_transactions(executor_id);
CREATE INDEX idx_escrow_transactions_status ON escrow_transactions(status);

CREATE INDEX idx_ratings_transaction_id ON ratings(transaction_id);
CREATE INDEX idx_ratings_rated_user_id ON ratings(rated_user_id);
CREATE INDEX idx_ratings_rating ON ratings(rating);

CREATE INDEX idx_appeals_user_id ON appeals(user_id);
CREATE INDEX idx_appeals_status ON appeals(status);
CREATE INDEX idx_appeals_type ON appeals(type);

CREATE INDEX idx_blocks_user_id ON blocks(user_id);
CREATE INDEX idx_blocks_is_active ON blocks(is_active);

CREATE INDEX idx_ai_support_tickets_user_id ON ai_support_tickets(user_id);
CREATE INDEX idx_ai_support_tickets_status ON ai_support_tickets(status);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Insert default commission rates
INSERT INTO commission_rates (min_amount, max_amount, rate, created_by) VALUES
(0, 10000, 1.0, 1),
(10000, 50000, 0.8, 1),
(50000, 999999999, 0.5, 1);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escrow_transactions_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appeals_updated_at BEFORE UPDATE ON appeals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_support_tickets_updated_at BEFORE UPDATE ON ai_support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_commission_rates_updated_at BEFORE UPDATE ON commission_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate user rating
CREATE OR REPLACE FUNCTION calculate_user_rating(user_id INTEGER)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    avg_rating DECIMAL(3,2);
BEGIN
    SELECT COALESCE(AVG(rating), 0.00) INTO avg_rating
    FROM ratings r
    JOIN escrow_transactions et ON r.transaction_id = et.id
    WHERE r.rated_user_id = user_id
    AND et.status = 'RELEASED'
    AND r.is_frozen = FALSE;
    
    RETURN avg_rating;
END;
$$ LANGUAGE plpgsql;

-- Create function to get commission rate for amount
CREATE OR REPLACE FUNCTION get_commission_rate(amount DECIMAL(12,2))
RETURNS DECIMAL(5,2) AS $$
DECLARE
    rate DECIMAL(5,2);
BEGIN
    SELECT cr.rate INTO rate
    FROM commission_rates cr
    WHERE cr.is_active = TRUE
    AND amount >= cr.min_amount
    AND amount < cr.max_amount
    ORDER BY cr.min_amount DESC
    LIMIT 1;
    
    RETURN COALESCE(rate, 1.0);
END;
$$ LANGUAGE plpgsql;
