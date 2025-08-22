const cron = require('node-cron');
const configUtil = require('../utils/config');
const logger = require('../utils/logger');
const RSSFeedScraper = require('../scrapers/rssFeeds');
const ContentFilter = require('../processors/contentFilter');
const DuplicateDetector = require('../processors/duplicateDetector');
const PostGenerator = require('../processors/postGenerator');
const PostManager = require('../facebook/postManager');
const { Article, ProcessingQueue } = require('../database/models');

class CronJobs {
  constructor(postManager) {
    this.scraper = new RSSFeedScraper();
    this.contentFilter = new ContentFilter();
    this.duplicateDetector = new DuplicateDetector();
    this.postGenerator = new PostGenerator();
    this.postManager = postManager;
    
    this.jobs = new Map();
    this.isProcessing = false;
  }

  /**
   * Initialize and start all cron jobs
   */
  async init() {
    const scheduleConfig = configUtil.get('schedule');
    
    if (!scheduleConfig.enabled) {
      logger.info('Scheduling is disabled');
      return;
    }

    logger.info('Initializing cron jobs', scheduleConfig);

    // News scraping job - every 30 minutes
    this.setupJob('news-scraping', '*/30 * * * *', () => this.runNewsScraping());

    // Post creation jobs - 3 times daily
    this.setupJob('morning-post', scheduleConfig.morning, () => this.runPostCreation('morning'));
    this.setupJob('afternoon-post', scheduleConfig.afternoon, () => this.runPostCreation('afternoon'));
    this.setupJob('evening-post', scheduleConfig.evening, () => this.runPostCreation('evening'));

    // Post publishing job - every 5 minutes
    this.setupJob('post-publishing', '*/5 * * * *', () => this.runPostPublishing());

    // Metrics update job - every hour
    this.setupJob('metrics-update', '0 * * * *', () => this.runMetricsUpdate());

    // Cleanup job - daily at 2 AM
    this.setupJob('cleanup', '0 2 * * *', () => this.runCleanup());

    logger.info('All cron jobs initialized', { jobs: this.jobs.size });
  }

  /**
   * Setup individual cron job
   * @param {string} name - Job name
   * @param {string} schedule - Cron schedule
   * @param {function} handler - Job handler function
   */
  setupJob(name, schedule, handler) {
    try {
      const job = cron.schedule(schedule, async () => {
        const startTime = Date.now();
        
        try {
          logger.info(`Starting cron job: ${name}`);
          await handler();
          
          const duration = Date.now() - startTime;
          logger.info(`Cron job completed: ${name}`, { duration: `${duration}ms` });
        } catch (error) {
          logger.error(`Cron job failed: ${name}`, error);
        }
      }, {
        scheduled: false,
        timezone: configUtil.get('app.timezone', 'America/New_York')
      });

      this.jobs.set(name, job);
      logger.debug('Cron job setup', { name, schedule });
    } catch (error) {
      logger.error('Failed to setup cron job', { name, schedule, error: error.message });
    }
  }

  /**
   * Start all cron jobs
   */
  start() {
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Started cron job: ${name}`);
    });
    
    logger.info('All cron jobs started', { count: this.jobs.size });
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
    
    logger.info('All cron jobs stopped');
  }

  /**
   * Run news scraping process
   */
  async runNewsScraping() {
    if (this.isProcessing) {
      logger.info('News scraping already in progress, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      logger.info('Starting news scraping process');

      // 1. Scrape articles from RSS feeds
      const rawArticles = await this.scraper.scrapeAllSources();
      
      if (rawArticles.length === 0) {
        logger.info('No new articles found');
        return;
      }

      // 2. Filter content for quality and relevance
      const filteredArticles = this.contentFilter.filterArticles(rawArticles);
      
      // 3. Get recent articles for duplicate detection
      const recentArticles = await Article.getRecent(24);
      
      // 4. Remove duplicates
      const uniqueArticles = this.duplicateDetector.removeDuplicates(filteredArticles, recentArticles);
      
      // 5. Sort by engagement potential
      const sortedArticles = this.contentFilter.sortByEngagement(uniqueArticles);
      
      // 6. Save articles to database
      const savedArticles = [];
      for (const article of sortedArticles) {
        try {
          const saved = await Article.create(article);
          savedArticles.push(saved);
          
          // Add to processing queue
          await ProcessingQueue.add(saved.id, 1);
        } catch (error) {
          logger.warn('Failed to save article', { 
            title: article.title, 
            error: error.message 
          });
        }
      }

      logger.info('News scraping completed', {
        scraped: rawArticles.length,
        filtered: filteredArticles.length,
        unique: uniqueArticles.length,
        saved: savedArticles.length
      });

    } catch (error) {
      logger.error('News scraping process failed', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Run post creation process
   * @param {string} timeSlot - Time slot identifier (morning, afternoon, evening)
   */
  async runPostCreation(timeSlot) {
    try {
      logger.info('Starting post creation process', { timeSlot });

      // Get top unprocessed articles
      const articles = await Article.getUnprocessed(5);
      
      if (articles.length === 0) {
        logger.info('No unprocessed articles available for posting');
        return;
      }

      // Select best article for this time slot
      const article = articles[0];
      
      // Generate post content
      const postContent = this.postGenerator.generatePost(article);
      
      // Validate post content
      const validation = this.postGenerator.validatePost(postContent.text);
      if (!validation.isValid) {
        logger.warn('Generated post failed validation', {
          article: article.title,
          issues: validation.issues
        });
        
        // Mark as processed but don't post
        await Article.markAsProcessed(article.id);
        return;
      }

      // Calculate posting time based on time slot
      const postTime = this.calculatePostTime(timeSlot);
      
      // Schedule the post
      await this.postManager.schedulePost(article, postContent, postTime);
      
      // Mark article as processed
      await Article.markAsProcessed(article.id);

      logger.info('Post creation completed', {
        timeSlot,
        article: article.title,
        scheduledTime: postTime.toISOString()
      });

    } catch (error) {
      logger.error('Post creation process failed', { timeSlot, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate optimal posting time for time slot
   * @param {string} timeSlot - Time slot identifier
   * @returns {Date} Calculated post time
   */
  calculatePostTime(timeSlot) {
    const now = new Date();
    const postTime = new Date(now);

    // Add some randomization to avoid posting at exact same times
    const randomMinutes = Math.floor(Math.random() * 30); // 0-29 minutes

    switch (timeSlot) {
      case 'morning':
        postTime.setHours(8, randomMinutes, 0, 0);
        break;
      case 'afternoon':
        postTime.setHours(13, randomMinutes, 0, 0);
        break;
      case 'evening':
        postTime.setHours(18, randomMinutes, 0, 0);
        break;
      default:
        // Default to 1 hour from now
        postTime.setTime(now.getTime() + 60 * 60 * 1000);
    }

    // If the calculated time is in the past, move to next day
    if (postTime <= now) {
      postTime.setDate(postTime.getDate() + 1);
    }

    return postTime;
  }

  /**
   * Run post publishing process
   */
  async runPostPublishing() {
    try {
      const results = await this.postManager.processScheduledPosts();
      
      if (results && results.processed > 0) {
        logger.info('Post publishing completed', results);
      }
    } catch (error) {
      logger.error('Post publishing process failed', error);
    }
  }

  /**
   * Run metrics update process
   */
  async runMetricsUpdate() {
    try {
      const results = await this.postManager.updateEngagementMetrics();
      
      if (results.updated > 0) {
        logger.info('Metrics update completed', results);
      }
    } catch (error) {
      logger.error('Metrics update process failed', error);
    }
  }

  /**
   * Run cleanup process
   */
  async runCleanup() {
    try {
      logger.info('Starting cleanup process');

      // Clean up old articles (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const deletedArticles = await db.run(
        'DELETE FROM articles WHERE created_at < ? AND is_processed = 1',
        [thirtyDaysAgo]
      );

      // Clean up old completed queue items
      const deletedQueueItems = await db.run(
        'DELETE FROM processing_queue WHERE created_at < ? AND status = "completed"',
        [thirtyDaysAgo]
      );

      // Clean up old failed posts
      const deletedPosts = await db.run(
        'DELETE FROM facebook_posts WHERE created_at < ? AND status = "failed"',
        [thirtyDaysAgo]
      );

      logger.info('Cleanup completed', {
        deletedArticles: deletedArticles.changes,
        deletedQueueItems: deletedQueueItems.changes,
        deletedPosts: deletedPosts.changes
      });

    } catch (error) {
      logger.error('Cleanup process failed', error);
    }
  }

  /**
   * Run a specific job manually
   * @param {string} jobName - Name of the job to run
   */
  async runJobManually(jobName) {
    if (!this.jobs.has(jobName)) {
      throw new Error(`Job not found: ${jobName}`);
    }

    logger.info(`Running job manually: ${jobName}`);

    switch (jobName) {
      case 'news-scraping':
        await this.runNewsScraping();
        break;
      case 'morning-post':
      case 'afternoon-post':
      case 'evening-post':
        const timeSlot = jobName.split('-')[0];
        await this.runPostCreation(timeSlot);
        break;
      case 'post-publishing':
        await this.runPostPublishing();
        break;
      case 'metrics-update':
        await this.runMetricsUpdate();
        break;
      case 'cleanup':
        await this.runCleanup();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Get status of all jobs
   * @returns {object} Job status information
   */
  getJobsStatus() {
    const status = {
      total: this.jobs.size,
      running: 0,
      jobs: {}
    };

    this.jobs.forEach((job, name) => {
      const isRunning = job.running || false;
      status.jobs[name] = {
        running: isRunning,
        scheduled: true
      };
      
      if (isRunning) {
        status.running++;
      }
    });

    status.isProcessing = this.isProcessing;

    return status;
  }
}

module.exports = CronJobs;