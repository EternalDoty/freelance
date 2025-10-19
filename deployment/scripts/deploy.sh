#!/bin/bash

# B2C Freelance Platform Deployment Script
# This script handles the complete deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
DOCKER_COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/deployment.log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if required environment variables are set
    if [ -z "$JWT_SECRET" ]; then
        error "JWT_SECRET environment variable is not set"
    fi
    
    if [ -z "$GITHUB_CLIENT_ID" ]; then
        error "GITHUB_CLIENT_ID environment variable is not set"
    fi
    
    if [ -z "$GITHUB_CLIENT_SECRET" ]; then
        error "GITHUB_CLIENT_SECRET environment variable is not set"
    fi
    
    success "Prerequisites check passed"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup database
    if docker-compose ps postgres | grep -q "Up"; then
        log "Backing up database..."
        docker-compose exec -T postgres pg_dump -U postgres freelance_platform > "$backup_path/database.sql"
        success "Database backup created"
    fi
    
    # Backup uploads
    if docker-compose ps backend | grep -q "Up"; then
        log "Backing up uploads..."
        docker cp $(docker-compose ps -q backend):/app/uploads "$backup_path/" 2>/dev/null || true
        success "Uploads backup created"
    fi
    
    # Backup configuration
    cp docker-compose.yml "$backup_path/"
    cp -r nginx/ "$backup_path/" 2>/dev/null || true
    cp -r monitoring/ "$backup_path/" 2>/dev/null || true
    
    success "Backup created: $backup_path"
}

# Pull latest images
pull_images() {
    log "Pulling latest images..."
    
    docker-compose pull
    success "Images pulled successfully"
}

# Build custom images
build_images() {
    log "Building custom images..."
    
    docker-compose build --no-cache
    success "Images built successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    timeout 60 bash -c 'until docker-compose exec postgres pg_isready -U postgres; do sleep 2; done'
    
    # Run migrations
    docker-compose exec backend npm run db:migrate
    success "Database migrations completed"
}

# Start services
start_services() {
    log "Starting services..."
    
    # Start services in order
    docker-compose up -d postgres redis
    sleep 10
    
    docker-compose up -d backend
    sleep 10
    
    docker-compose up -d frontend
    sleep 5
    
    docker-compose up -d nginx
    sleep 5
    
    # Start monitoring services
    docker-compose up -d prometheus grafana loki promtail
    
    success "Services started successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Health check attempt $attempt/$max_attempts"
        
        # Check backend
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            success "Backend is healthy"
        else
            warning "Backend health check failed"
        fi
        
        # Check frontend
        if curl -f http://localhost:3001 > /dev/null 2>&1; then
            success "Frontend is healthy"
        else
            warning "Frontend health check failed"
        fi
        
        # Check nginx
        if curl -f http://localhost/health > /dev/null 2>&1; then
            success "Nginx is healthy"
            break
        else
            warning "Nginx health check failed"
        fi
        
        sleep 10
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error "Health check failed after $max_attempts attempts"
    fi
}

# Run tests
run_tests() {
    log "Running deployment tests..."
    
    # Run smoke tests
    docker-compose exec backend npm test -- --grep "smoke"
    
    # Run API tests
    docker-compose exec backend npm test -- --grep "api"
    
    success "Tests passed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Wait for Grafana to be ready
    sleep 30
    
    # Import dashboards
    if [ -d "monitoring/grafana/dashboards" ]; then
        log "Importing Grafana dashboards..."
        # Dashboard import would be handled by Grafana provisioning
    fi
    
    success "Monitoring setup completed"
}

# Cleanup old containers and images
cleanup() {
    log "Cleaning up old containers and images..."
    
    # Remove stopped containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful with this)
    # docker volume prune -f
    
    success "Cleanup completed"
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Stop current services
    docker-compose down
    
    # Restore from backup
    local latest_backup=$(ls -t $BACKUP_DIR | head -n1)
    if [ -n "$latest_backup" ]; then
        log "Restoring from backup: $latest_backup"
        
        # Restore database
        if [ -f "$BACKUP_DIR/$latest_backup/database.sql" ]; then
            docker-compose up -d postgres
            sleep 10
            docker-compose exec -T postgres psql -U postgres -d freelance_platform < "$BACKUP_DIR/$latest_backup/database.sql"
        fi
        
        # Restore configuration
        cp "$BACKUP_DIR/$latest_backup/docker-compose.yml" .
        cp -r "$BACKUP_DIR/$latest_backup/nginx/" . 2>/dev/null || true
        cp -r "$BACKUP_DIR/$latest_backup/monitoring/" . 2>/dev/null || true
        
        # Start services
        docker-compose up -d
    else
        error "No backup found for rollback"
    fi
    
    success "Rollback completed"
}

# Main deployment function
deploy() {
    log "Starting deployment to $ENVIRONMENT environment..."
    
    # Pre-deployment checks
    check_prerequisites
    
    # Create backup
    create_backup
    
    # Pull and build images
    pull_images
    build_images
    
    # Run migrations
    run_migrations
    
    # Start services
    start_services
    
    # Health check
    health_check
    
    # Run tests
    run_tests
    
    # Setup monitoring
    setup_monitoring
    
    # Cleanup
    cleanup
    
    success "Deployment completed successfully!"
    
    # Display service URLs
    log "Service URLs:"
    log "  Frontend: http://localhost:3001"
    log "  Backend API: http://localhost:3000"
    log "  Grafana: http://localhost:3002"
    log "  Prometheus: http://localhost:9090"
}

# Handle command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    health)
        health_check
        ;;
    backup)
        create_backup
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health|backup|cleanup}"
        echo "  deploy   - Deploy the application"
        echo "  rollback - Rollback to previous version"
        echo "  health   - Check service health"
        echo "  backup   - Create backup"
        echo "  cleanup  - Clean up old containers and images"
        exit 1
        ;;
esac
