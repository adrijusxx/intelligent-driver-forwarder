# Trucking News to Facebook Automation System

An intelligent automated system that monitors trucking industry news websites, processes content, and posts engaging updates to Facebook business pages 3 times daily.

## 🚛 Features

### Core Functionality
- **Multi-Source News Monitoring**: Automatically scrapes RSS feeds from major trucking news sources
- **Intelligent Content Processing**: Filters, deduplicates, and ranks articles by relevance
- **Automated Facebook Posting**: Posts 3 times daily at optimal engagement times
- **Smart Scheduling**: Queue system prevents duplicate posts and ensures content quality
- **Engagement Tracking**: Monitors post performance and metrics

### Content Quality Control
- **Relevance Filtering**: Ensures posts are trucking industry-specific
- **Duplicate Detection**: Advanced similarity matching to prevent repeated content  
- **Professional Tone**: Generates brand-appropriate social media posts
- **Engagement Optimization**: Creates compelling headlines and calls-to-action

### Technical Features
- **RESTful API**: Monitor and control the system via HTTP endpoints
- **Comprehensive Logging**: Detailed logs for monitoring and debugging
- **Robust Error Handling**: Graceful failure recovery and retry logic
- **Configurable Scheduling**: Flexible posting times and content filters
- **Database Storage**: SQLite database for article and post management

## 📋 Requirements

- **Node.js**: Version 18.0.0 or higher
- **Facebook Business Page**: With admin access
- **Facebook App**: For API access (optional but recommended)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/intelligent-driver-forwarder.git
cd intelligent-driver-forwarder

# Install dependencies
npm install

# Run setup wizard
npm run setup
```

### 2. Configuration

The setup wizard will guide you through configuration, or manually create a `.env` file:

```env
# Facebook API Configuration
FACEBOOK_PAGE_ID=your_facebook_page_id
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token

# Basic Settings
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_PATH=./data/articles.db

# Logging Configuration
LOG_LEVEL=info
LOG_DIR=./logs
```

### 3. Start the Application

```bash
# Production mode
npm start

# Development mode (with auto-restart)
npm run dev
```

### 4. Verify Operation

Visit `http://localhost:3000/health` to check system status.

## 🔧 Configuration

### News Sources

The system monitors these trucking news sources by default:
- **FreightWaves**: Industry-leading freight market analysis
- **Transport Topics**: Comprehensive trucking news coverage  
- **Trucking Info**: Equipment and technology focus
- **Land Line Magazine**: Owner-operator perspective

Sources can be configured in `config/default.json`:

```json
{
  "sources": [
    {
      "name": "FreightWaves",
      "url": "https://www.freightwaves.com/feed",
      "type": "rss",
      "enabled": true,
      "priority": 1
    }
  ]
}
```

### Posting Schedule

Default posting times (Eastern Time):
- **Morning**: 8:00 AM (peak commute engagement)
- **Afternoon**: 1:00 PM (lunch break engagement)  
- **Evening**: 6:00 PM (after-work engagement)

Configure in `.env`:
```env
SCHEDULE_MORNING=0 8 * * *
SCHEDULE_AFTERNOON=0 13 * * *
SCHEDULE_EVENING=0 18 * * *
```

### Content Filtering

Customize content filters in `config/default.json`:

```json
{
  "filters": {
    "requiredKeywords": ["truck", "trucking", "freight", "logistics"],
    "spamKeywords": ["advertisement", "sponsored"],
    "minWordCount": 50
  }
}
```

## 🎯 Usage

### Automated Operation

Once configured, the system runs automatically:

1. **News Scraping**: Every 30 minutes, scrapes latest articles
2. **Content Processing**: Filters and ranks articles by relevance
3. **Post Generation**: Creates engaging Facebook posts with hashtags
4. **Scheduled Posting**: Posts at configured times with safety checks
5. **Metrics Tracking**: Monitors engagement and performance

### Manual Control

#### API Endpoints

```bash
# Health check
GET /health

# Manual job execution
POST /jobs/news-scraping/run
POST /jobs/morning-post/run
POST /jobs/post-publishing/run

# Statistics
GET /stats/posts?days=7

# Recent articles
GET /articles?limit=10

# Pending posts
GET /posts/pending
```

#### Example Manual Operations

```bash
# Trigger immediate news scraping
curl -X POST http://localhost:3000/jobs/news-scraping/run

# Check posting statistics
curl http://localhost:3000/stats/posts?days=7

# Test Facebook connection
curl -X POST http://localhost:3000/test/facebook
```

### Command Line Tools

```bash
# Database management
npm run migrate status    # Check migration status
npm run migrate migrate   # Apply pending migrations
npm run migrate backup    # Create database backup

# Manual job execution
npm run job news-scraping
npm run job morning-post
```

## 🔍 Monitoring

### Logs

Logs are stored in the `./logs` directory:
- `combined.log`: All log messages
- `error.log`: Error messages only

Log levels: `error`, `warn`, `info`, `debug`

### Health Endpoint

The `/health` endpoint provides comprehensive system status:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 3600,
  "jobs": {
    "total": 6,
    "running": 0
  },
  "facebook": {
    "success": true,
    "pageInfo": {
      "name": "Your Trucking Page",
      "fanCount": 1500
    }
  }
}
```

### Performance Metrics

Track system performance:
- Articles processed per hour
- Post success rate
- Facebook engagement metrics
- Error rates and recovery times

## 🛠️ Development

### Project Structure

```
src/
├── database/           # Database models and connections
├── facebook/          # Facebook API integration
├── processors/        # Content filtering and processing
├── scrapers/          # News source scrapers
├── scheduler/         # Cron job management
└── utils/            # Logging, configuration utilities

config/               # Configuration files
scripts/             # Setup and migration scripts
tests/               # Test files
logs/                # Log output
data/                # Database and backups
```

### Adding News Sources

1. Add RSS feed to `config/default.json`
2. Test with manual scraping job
3. Monitor for content quality

### Extending Functionality

- **Additional Platforms**: Extend posting to LinkedIn, Twitter
- **Content Enhancement**: Add AI-powered summarization
- **Analytics Integration**: Connect to Google Analytics
- **Web Dashboard**: Build monitoring interface

### Testing

```bash
# Run tests
npm test

# Test specific component
npm run test:scrapers
npm run test:facebook
```

## 🔒 Security

### Best Practices

- **API Keys**: Store in environment variables, never commit to code
- **Rate Limiting**: Respects Facebook API limits with retry logic
- **Input Validation**: Sanitizes and validates all content
- **Error Handling**: Prevents sensitive data leakage in errors

### Facebook API Security

- Use page access tokens, not user tokens
- Implement token refresh mechanisms for long-lived tokens
- Monitor API usage to stay within limits
- Regularly audit API permissions

## 📊 Analytics & Optimization

### Engagement Metrics

The system tracks:
- **Likes**: Post popularity indicator
- **Comments**: Engagement depth
- **Shares**: Content virality
- **Click-through rates**: Article traffic generation

### Content Optimization

- A/B test different post formats
- Analyze hashtag performance
- Optimize posting times based on audience
- Monitor trending trucking topics

### Performance Tuning

- **Caching**: Implement Redis for frequently accessed data
- **Scaling**: Use PM2 for multi-process deployment
- **Monitoring**: Add Prometheus metrics collection
- **Alerting**: Set up automated error notifications

## 🚨 Troubleshooting

### Common Issues

#### Facebook API Errors
```bash
# Test connection
curl -X POST http://localhost:3000/test/facebook

# Check logs for API errors
tail -f logs/error.log | grep facebook
```

#### No Articles Being Scraped
1. Check RSS feed URLs are accessible
2. Verify content filters aren't too restrictive
3. Check for network connectivity issues

#### Posts Not Publishing
1. Verify Facebook permissions
2. Check post content validation
3. Monitor rate limiting issues

#### Database Issues
```bash
# Check database status
npm run migrate status

# Repair corrupted database
npm run migrate reset -- --confirm
npm run migrate migrate
```

### Performance Issues

- **High memory usage**: Increase Node.js heap size
- **Slow scraping**: Reduce concurrent requests
- **Database locks**: Check for long-running transactions

## 📞 Support

### Getting Help

1. **Documentation**: Check this README and code comments
2. **Logs**: Review error logs for specific issues
3. **Health Check**: Use `/health` endpoint for system status
4. **GitHub Issues**: Report bugs and feature requests

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **News Sources**: FreightWaves, Transport Topics, Trucking Info, Land Line Magazine
- **Technology Stack**: Node.js, Express, SQLite, Facebook Graph API
- **Community**: Trucking industry professionals and developers

---

**Built for the trucking industry, by developers who understand logistics.**