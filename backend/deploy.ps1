# Base Arcade Backend - Google Cloud Run Deployment Script (PowerShell)

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,
    [string]$Region = "us-central1",
    [string]$ServiceName = "base-arcade-backend"
)

# Configuration
$ImageName = "gcr.io/$ProjectId/$ServiceName"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if gcloud is installed
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Error "gcloud CLI is not installed. Please install it first."
    exit 1
}

# Check if user is authenticated
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if (-not $authCheck) {
    Write-Error "You are not authenticated with gcloud. Please run 'gcloud auth login'"
    exit 1
}

Write-Status "Starting deployment to Google Cloud Run..."

# Set the project
Write-Status "Setting project to $ProjectId..."
gcloud config set project $ProjectId

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set project. Please check if the project ID is correct."
    exit 1
}

# Enable required APIs
Write-Status "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to enable APIs. Please check your permissions."
    exit 1
}

# Deploy to Cloud Run using source-based deployment
Write-Status "Deploying to Cloud Run from source..."
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --timeout 300 `
    --concurrency 80 `
    --set-env-vars NODE_ENV=production

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to deploy to Cloud Run."
    exit 1
}

# Get the service URL
$ServiceUrl = gcloud run services describe $ServiceName --region=$Region --format='value(status.url)'

Write-Success "Deployment completed successfully!"
Write-Success "Service URL: $ServiceUrl"
Write-Status "Health check: $ServiceUrl/health"

Write-Warning "Don't forget to:"
Write-Warning "1. Set up your environment variables in Cloud Run"
Write-Warning "2. Configure your database connection"
Write-Warning "3. Update your frontend to use the new backend URL"

Write-Host ""
Write-Status "To set environment variables, run:"
Write-Host "gcloud run services update $ServiceName --region=$Region --set-env-vars KEY1=VALUE1,KEY2=VALUE2"