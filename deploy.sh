#!/bin/bash

# Intelligent Driver Forwarder - Google Cloud Deployment Script

set -e

# Configuration
PROJECT_ID=${1:-"your-project-id"}
SERVICE_NAME="intelligent-driver-forwarder"
REGION=${2:-"us-central1"}
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo "🚀 Deploying Intelligent Driver Forwarder to Google Cloud Run"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Authenticate with Google Cloud (if needed)
echo "🔐 Checking Google Cloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo "Please authenticate with Google Cloud:"
    gcloud auth login
fi

# Set the project
echo "📋 Setting project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Configure Docker to use gcloud as a credential helper
echo "🐳 Configuring Docker authentication..."
gcloud auth configure-docker

# Build the Docker image
echo "🏗️  Building Docker image..."
docker build -t ${IMAGE_NAME} .

# Push the image to Google Container Registry
echo "📤 Pushing image to Google Container Registry..."
docker push ${IMAGE_NAME}

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --port 8000

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "📖 API Documentation: ${SERVICE_URL}/docs"
echo ""
echo "🧪 Test the service:"
echo "curl ${SERVICE_URL}/"
echo ""
echo "📝 To send a test post:"
echo "curl -X POST \"${SERVICE_URL}/posts\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"title\":\"Test Post\",\"content\":\"This is a test post\",\"author\":\"Test User\",\"priority\":3}'"
echo ""
echo "📊 Monitor logs:"
echo "gcloud run logs tail ${SERVICE_NAME} --platform managed --region ${REGION}"