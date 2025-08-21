require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const configUtil = require('./utils/config');
const logger = require('./utils/logger');
const db = require('./database/db');
const CronJobs = require('./scheduler/cronJobs');
const PostManager = require('./facebook/postManager');
const FacebookGraphAPI = require('./facebook/graphApi');

class TruckingNewsForwarder {
  constructor() {
    this.app = express();
    this.graphApi = new FacebookGraphAPI();
    this.postManager = new PostManager(this.graphApi);
    this.cronJobs = new CronJobs(this.postManager);
    this.server = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      logger.info('Initializing Trucking News Forwarder');

      // Validate configuration
      configUtil.validateConfig();

      // Initialize database
      await db.init();

      // Setup Express app
      this.setupExpress();

      // Initialize cron jobs
      await this.cronJobs.init();

      // Test Facebook API connection
      await this.testFacebookConnection();

      logger.info('Trucking News Forwarder initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application', error);
      throw error;
    }
  }

  /**
   * Setup Express application
   */
  setupExpress() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Setup routes
    this.setupRoutes();

    // Error handling middleware
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          jobs: this.cronJobs.getJobsStatus(),
          facebook: await this.postManager.testConnection()
        };

        res.json(health);
      } catch (error) {
        logger.error('Health check failed', error);
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });

    // Manual job execution
    this.app.post('/jobs/:jobName/run', async (req, res) => {
      const { jobName } = req.params;

      try {
        await this.cronJobs.runJobManually(jobName);
        res.json({ 
          success: true, 
          message: `Job ${jobName} executed successfully` 
        });
      } catch (error) {
        logger.error('Manual job execution failed', { jobName, error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get posting statistics
    this.app.get('/stats/posts', async (req, res) => {
      try {
        const days = parseInt(req.query.days) || 7;
        const stats = await this.postManager.getPostingStats(days);
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get posting stats', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get recent articles
    this.app.get('/articles', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 10;
        const { Article } = require('./database/models');
        
        const articles = await Article.all(
          'SELECT * FROM articles ORDER BY created_at DESC LIMIT ?',
          [limit]
        );

        res.json(articles);
      } catch (error) {
        logger.error('Failed to get articles', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get pending posts
    this.app.get('/posts/pending', async (req, res) => {
      try {
        const { FacebookPost } = require('./database/models');
        const posts = await FacebookPost.getPending();
        res.json(posts);
      } catch (error) {
        logger.error('Failed to get pending posts', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get configuration (sanitized)
    this.app.get('/config', (req, res) => {
      const config = configUtil.getAll();
      
      // Remove sensitive information
      delete config.facebook.accessToken;
      
      res.json(config);
    });

    // Test Facebook connection
    this.app.post('/test/facebook', async (req, res) => {
      try {
        const result = await this.postManager.testConnection();
        res.json(result);
      } catch (error) {
        logger.error('Facebook test failed', error);
        res.status(500).json({ error: error.message });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
      });
    });
  }

  /**
   * Error handling middleware
   */
  errorHandler(err, req, res, next) {
    logger.error('Express error', {
      url: req.url,
      method: req.method,
      error: err.message,
      stack: err.stack
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }

  /**
   * Test Facebook API connection
   */
  async testFacebookConnection() {
    try {
      const isValid = await this.postManager.validateCredentials();
      
      if (isValid) {
        logger.info('Facebook API connection validated');
      } else {
        logger.warn('Facebook API credentials are invalid');
      }
    } catch (error) {
      logger.error('Facebook API connection test failed', error);
      // Don't throw error here - the app can still run without Facebook
    }
  }

  /**
   * Start the application
   */
  async start() {
    try {
      const port = configUtil.get('app.port', 3000);
      
      this.server = this.app.listen(port, () => {
        logger.info(`Trucking News Forwarder started on port ${port}`);
      });

      // Start cron jobs
      this.cronJobs.start();

      // Handle graceful shutdown
      this.setupGracefulShutdown();

      return this.server;
    } catch (error) {
      logger.error('Failed to start application', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        // Stop cron jobs
        this.cronJobs.stop();

        // Close HTTP server
        if (this.server) {
          await new Promise((resolve, reject) => {
            this.server.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }

        // Close database connection
        await db.close();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  }

  /**
   * Stop the application
   */
  async stop() {
    if (this.server) {
      this.cronJobs.stop();
      await new Promise(resolve => this.server.close(resolve));
      await db.close();
    }
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  const app = new TruckingNewsForwarder();
  
  app.init()
    .then(() => app.start())
    .catch((error) => {
      logger.error('Application startup failed', error);
      process.exit(1);
    });
}

module.exports = TruckingNewsForwarder;