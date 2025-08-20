const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const configUtil = require('../utils/config');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = configUtil.get('database.path', './data/articles.db');
    
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Initialize database connection and create tables
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('Failed to connect to database', err);
          reject(err);
        } else {
          logger.info('Connected to SQLite database', { path: this.dbPath });
          this.createTables()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  /**
   * Create necessary tables
   */
  async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        content TEXT,
        source TEXT NOT NULL,
        published_date DATETIME NOT NULL,
        scraped_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        image_url TEXT,
        engagement_score REAL DEFAULT 0,
        tags TEXT, -- JSON array of tags
        is_duplicate BOOLEAN DEFAULT 0,
        is_processed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS facebook_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        facebook_post_id TEXT,
        post_text TEXT NOT NULL,
        post_url TEXT,
        status TEXT DEFAULT 'pending', -- pending, posted, failed
        scheduled_time DATETIME,
        posted_time DATETIME,
        engagement_metrics TEXT, -- JSON object
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS processing_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        priority INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles (id)
      )`,

      // Create indexes for better performance
      `CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url)`,
      `CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source)`,
      `CREATE INDEX IF NOT EXISTS idx_articles_published_date ON articles(published_date)`,
      `CREATE INDEX IF NOT EXISTS idx_articles_is_processed ON articles(is_processed)`,
      `CREATE INDEX IF NOT EXISTS idx_facebook_posts_status ON facebook_posts(status)`,
      `CREATE INDEX IF NOT EXISTS idx_facebook_posts_scheduled_time ON facebook_posts(scheduled_time)`,
      `CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status)`
    ];

    for (const query of queries) {
      await this.run(query);
    }
    
    logger.info('Database tables created successfully');
  }

  /**
   * Execute a query that doesn't return results
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('Database run error', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Execute a query that returns a single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database get error', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Execute a query that returns multiple rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database all error', { sql, params, error: err.message });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database', err);
            reject(err);
          } else {
            logger.info('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    await this.run('BEGIN TRANSACTION');
  }

  /**
   * Commit transaction
   */
  async commit() {
    await this.run('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollback() {
    await this.run('ROLLBACK');
  }
}

// Create singleton instance
const db = new Database();

module.exports = db;