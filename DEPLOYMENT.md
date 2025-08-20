# Trucking News to Facebook Automation - Deployment Guide

## Prerequisites

### System Requirements
- **Node.js**: Version 18.0.0 or higher
- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 512MB RAM (1GB recommended)
- **Storage**: 1GB free space for logs and database

### Facebook Requirements
- **Facebook Business Page**: With admin access
- **Facebook App**: For API access (recommended)
- **Access Token**: Long-lived page access token

## Getting Facebook Credentials

### 1. Create Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App" → "Business" → "Continue"
3. Enter app name and contact email
4. Add "Facebook Login" and "Pages API" products

### 2. Get Page Access Token
1. Go to Graph API Explorer
2. Select your app
3. Generate User Access Token with `pages_manage_posts` permission
4. Exchange for long-lived Page Access Token
5. Save the token securely

### 3. Get Page ID
1. Go to your Facebook business page
2. Click "About" → "Page Info"
3. Copy the Page ID number

## Installation Options

### Option 1: Quick Setup (Recommended)

```bash
# Clone and setup
git clone https://github.com/your-username/intelligent-driver-forwarder.git
cd intelligent-driver-forwarder
npm install
npm run setup
npm start
```

### Option 2: Manual Setup

```bash
# Clone repository
git clone https://github.com/your-username/intelligent-driver-forwarder.git
cd intelligent-driver-forwarder

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run migrate migrate

# Start application
npm start
```

## Configuration

### Environment Variables (.env)

```env
# Required
FACEBOOK_PAGE_ID=your_page_id_here
FACEBOOK_ACCESS_TOKEN=your_access_token_here

# Optional
NODE_ENV=production
PORT=3000
DATABASE_PATH=./data/articles.db
LOG_LEVEL=info
```

### News Sources

Edit `config/default.json` to customize news sources:

```json
{
  "sources": [
    {
      "name": "FreightWaves",
      "url": "https://www.freightwaves.com/feed",
      "enabled": true,
      "priority": 1
    }
  ]
}
```

## Deployment Options

### Option 1: Local Server

```bash
# Start application
npm start

# Use PM2 for production (recommended)
npm install -g pm2
pm2 start src/index.js --name trucking-news
pm2 startup
pm2 save
```

### Option 2: Docker

```bash
# Build image
docker build -t trucking-news-forwarder .

# Run container
docker run -d \
  --name trucking-news \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  trucking-news-forwarder
```

### Option 3: Cloud Deployment (AWS)

1. **EC2 Instance**:
   - Launch t3.micro instance
   - Install Node.js 18+
   - Clone repository and setup
   - Configure security group for port 3000

2. **Elastic Beanstalk**:
   - Create Node.js application
   - Upload application zip
   - Configure environment variables

3. **ECS/Fargate**:
   - Create task definition
   - Set up service with load balancer
   - Configure CloudWatch logs

## Monitoring and Maintenance

### Health Monitoring

```bash
# Check system health
curl http://localhost:3000/health

# View logs
tail -f logs/combined.log

# Check post statistics
curl http://localhost:3000/stats/posts?days=7
```

### Database Maintenance

```bash
# Backup database
npm run migrate backup

# Check migration status
npm run migrate status

# Reset database (caution!)
npm run migrate reset -- --confirm
```

### Log Management

Configure log rotation in production:

```bash
# Install logrotate (Linux)
sudo apt-get install logrotate

# Create logrotate config
sudo tee /etc/logrotate.d/trucking-news << EOF
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0644 ubuntu ubuntu
    postrotate
        pm2 reload trucking-news
    endscript
}
EOF
```

## Security Best Practices

### 1. Environment Security
- Never commit `.env` files to version control
- Use strong, unique Facebook access tokens
- Regularly rotate access tokens
- Limit file permissions: `chmod 600 .env`

### 2. Network Security
- Use HTTPS in production
- Configure firewall (only allow necessary ports)
- Use reverse proxy (Nginx/Apache) for SSL termination

### 3. Application Security
- Keep dependencies updated: `npm audit`
- Monitor for security vulnerabilities
- Use process managers (PM2) for restart on failure

## Troubleshooting

### Common Issues

#### 1. Facebook API Errors
```bash
# Test Facebook connection
curl -X POST http://localhost:3000/test/facebook

# Check access token validity
curl "https://graph.facebook.com/me?access_token=YOUR_TOKEN"
```

#### 2. No Articles Being Scraped
- Check RSS feed URLs are accessible
- Verify content filters in config
- Check network connectivity
- Review logs for scraping errors

#### 3. Database Issues
```bash
# Check database file permissions
ls -la data/articles.db

# Reset database if corrupted
npm run migrate reset -- --confirm
npm run migrate migrate
```

#### 4. Memory Issues
```bash
# Monitor memory usage
ps aux | grep node

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=1024"
npm start
```

### Log Analysis

Important log patterns to monitor:

```bash
# Error patterns
grep -i error logs/combined.log

# Facebook API issues
grep -i facebook logs/combined.log

# Scraping failures
grep -i "scrape failed" logs/combined.log

# Post publishing issues
grep -i "post.*failed" logs/combined.log
```

## Performance Optimization

### 1. Database Optimization
- Regular cleanup of old articles
- Index optimization for queries
- Consider PostgreSQL for high volume

### 2. Scraping Optimization
- Adjust concurrent request limits
- Implement intelligent retry logic
- Cache RSS feed responses

### 3. Memory Management
- Monitor memory leaks
- Implement graceful garbage collection
- Use streaming for large datasets

## Scaling Considerations

### Horizontal Scaling
- Deploy multiple instances behind load balancer
- Use shared database (PostgreSQL/MySQL)
- Implement distributed locking for cron jobs

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Use caching layers (Redis)

### Multi-Platform Support
- Extend to LinkedIn, Twitter
- Implement platform-specific optimizations
- Share content processing pipeline

## Backup and Recovery

### Regular Backups
```bash
# Automated daily backup
0 2 * * * /usr/bin/npm run migrate backup

# Backup to cloud storage
aws s3 cp data/backups/ s3://your-backup-bucket/ --recursive
```

### Disaster Recovery
1. Restore database from backup
2. Reconfigure environment variables
3. Restart application services
4. Verify Facebook API connectivity

## Support and Updates

### Getting Updates
```bash
# Update to latest version
git pull origin main
npm install
npm run migrate migrate
pm2 restart trucking-news
```

### Community Support
- GitHub Issues for bug reports
- Documentation wiki for guides
- Community forum for questions

---

**Need help?** Contact support or check the troubleshooting guide above.