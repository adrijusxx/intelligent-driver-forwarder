# Intelligent Driver Forwarder

A smart service that intelligently forwards posts and automatically checks for new content every 5 minutes. Built with FastAPI and designed for easy deployment on Google Cloud Run.

## Features

- 🚀 **Intelligent Post Forwarding**: Automatically prioritizes and forwards posts based on content and priority
- ⏰ **Scheduled Processing**: Checks for new posts every 5 minutes
- 🔍 **Priority Detection**: Automatically detects high-priority content using keywords
- 📊 **REST API**: Full REST API with automatic documentation
- 🐳 **Containerized**: Ready for deployment with Docker
- ☁️ **Cloud Ready**: Optimized for Google Cloud Run deployment
- 📈 **Health Monitoring**: Built-in health checks and logging

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/adrijusxx/intelligent-driver-forwarder.git
   cd intelligent-driver-forwarder
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python main.py
   ```

4. **Access the API**
   - Service: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - Health Check: http://localhost:8000/health

### Docker Deployment

1. **Build the image**
   ```bash
   docker build -t intelligent-driver-forwarder .
   ```

2. **Run the container**
   ```bash
   docker run -p 8000:8000 intelligent-driver-forwarder
   ```

## Google Cloud Service Deployment

### Prerequisites

1. **Google Cloud Account**: Create a Google Cloud account at [cloud.google.com](https://cloud.google.com)
2. **Google Cloud SDK**: Install from [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install)
3. **Docker**: Install from [docker.com](https://docs.docker.com/get-docker/)
4. **Project Setup**: Create a new Google Cloud project or use an existing one

### Step-by-Step Deployment

#### Option 1: Automated Deployment (Recommended)

1. **Run the deployment script**
   ```bash
   ./deploy.sh YOUR_PROJECT_ID us-central1
   ```
   
   Replace `YOUR_PROJECT_ID` with your actual Google Cloud project ID.

#### Option 2: Manual Deployment

1. **Set up Google Cloud**
   ```bash
   # Authenticate with Google Cloud
   gcloud auth login
   
   # Set your project
   gcloud config set project YOUR_PROJECT_ID
   
   # Enable required APIs
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

2. **Build and push the image**
   ```bash
   # Configure Docker
   gcloud auth configure-docker
   
   # Build the image
   docker build -t gcr.io/YOUR_PROJECT_ID/intelligent-driver-forwarder:latest .
   
   # Push to Google Container Registry
   docker push gcr.io/YOUR_PROJECT_ID/intelligent-driver-forwarder:latest
   ```

3. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy intelligent-driver-forwarder \
     --image gcr.io/YOUR_PROJECT_ID/intelligent-driver-forwarder:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 1 \
     --max-instances 10 \
     --port 8000
   ```

### Post-Deployment

After successful deployment, you'll receive a service URL like:
`https://intelligent-driver-forwarder-xxx-uc.a.run.app`

## API Usage

### Send a Post
```bash
curl -X POST "https://your-service-url/posts" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Important Update",
       "content": "This is an urgent notification about system maintenance",
       "author": "System Admin",
       "priority": 5
     }'
```

### Get All Posts
```bash
curl "https://your-service-url/posts"
```

### Get Forwarded Posts
```bash
curl "https://your-service-url/posts/forwarded"
```

### Check Service Status
```bash
curl "https://your-service-url/"
```

## How It Works

### Intelligent Forwarding Logic

1. **Immediate Forwarding**: Posts with priority ≥ 4 or containing keywords like "urgent", "important", "breaking", "alert" are forwarded immediately

2. **Scheduled Processing**: Every 5 minutes, the service automatically:
   - Checks for unforwarded posts
   - Forwards pending posts
   - Logs activity and statistics

3. **Priority Keywords**: The system automatically detects high-priority content based on:
   - Priority level (1-5 scale)
   - Content keywords (urgent, important, breaking, alert)

### Monitoring and Logs

View real-time logs:
```bash
gcloud run logs tail intelligent-driver-forwarder --platform managed --region us-central1
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 8000)

### Scheduler Settings

The service checks for new posts every 5 minutes by default. This can be modified in `main.py`:

```python
scheduler.add_job(
    check_and_forward_posts,
    trigger=IntervalTrigger(minutes=5),  # Change this value
    id="post_forwarder",
    name="Check and forward posts every 5 minutes",
    replace_existing=True
)
```

## API Documentation

Once deployed, visit `/docs` on your service URL for interactive API documentation powered by Swagger UI.

## Cost Estimation

Google Cloud Run pricing (approximate):
- **CPU**: $0.000024 per vCPU-second
- **Memory**: $0.0000025 per GiB-second
- **Requests**: $0.40 per million requests
- **Free Tier**: 2 million requests per month

With minimal usage, the service should stay within the free tier.

## Troubleshooting

### Common Issues

1. **Authentication Error**
   ```bash
   gcloud auth login
   gcloud auth configure-docker
   ```

2. **Permission Denied**
   - Ensure APIs are enabled
   - Check IAM permissions for Cloud Run and Container Registry

3. **Service Not Starting**
   - Check logs: `gcloud run logs tail intelligent-driver-forwarder`
   - Verify health check endpoint

4. **Memory Issues**
   - Increase memory limit in `deploy.sh` or Cloud Run console

### Support

For issues and questions:
1. Check the logs using `gcloud run logs tail`
2. Verify the health check endpoint
3. Review the API documentation at `/docs`

## Development

### Running Tests
```bash
# Install test dependencies
pip install pytest httpx

# Run tests
pytest test_main.py
```

### Local Development with Auto-reload
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```