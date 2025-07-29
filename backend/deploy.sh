#!/bin/bash

# Base Arcade Backend - Google Cloud Run Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="base-arcade-backend"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    print_error "Please set PROJECT_ID in this script before running"
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_error "You are not authenticated with gcloud. Please run 'gcloud auth login'"
    exit 1
fi

print_status "Starting deployment to Google Cloud Run..."

# Set the project
print_status "Setting project to ${PROJECT_ID}..."
gcloud config set project $PROJECT_ID

# Enable required APIs
print_status "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Deploy to Cloud Run using source-based deployment
print_status "Deploying to Cloud Run from source..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --concurrency 80 \
    --set-env-vars NODE_ENV=production

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

print_success "Deployment completed successfully!"
print_success "Service URL: $SERVICE_URL"
print_status "Health check: $SERVICE_URL/health"

print_warning "Don't forget to:"
print_warning "1. Set up your environment variables in Cloud Run"
print_warning "2. Configure your database connection"
print_warning "3. Update your frontend to use the new backen