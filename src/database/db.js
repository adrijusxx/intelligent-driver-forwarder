const sqlite3 = require('sqlite3').verbose();
const config = require('../utils/config');
const logger = require('../utils/logger');

let db;

function init() {
  const dbPath = config.get('database.path', './data/articles.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error('Failed to connect to SQLite database', { error: err.message, path: dbPath });
      throw err;
    }
    logger.info('Connected to SQLite database', { path: dbPath });
    createTables();
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  return db;
}

function createTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        url TEXT UNIQUE,
        summary TEXT,
        content TEXT,
        source TEXT,
        published_at TEXT,
        published_date TEXT,
        image_url TEXT,
        tags TEXT,
        engagement_score REAL,
        is_processed INTEGER DEFAULT 0,
        is_duplicate INTEGER DEFAULT 0,
        processed INTEGER DEFAULT 0
      )
    `, (err) => {
      if (err) {
        logger.error('Failed to create articles table', { error: err.message });
      } else {
        logger.info('Database tables created successfully');
      }
    });

    // Create facebook_posts table
    db.run(`
      CREATE TABLE IF NOT EXISTS facebook_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        media_url TEXT,
        scheduled_time TEXT,
        status TEXT DEFAULT 'pending',
        facebook_post_id TEXT,
        article_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles (id)
      )
    `, (err) => {
      if (err) {
        logger.error('Failed to create facebook_posts table', { error: err.message });
      }
    });

    // Create processing_queue table
    db.run(`
      CREATE TABLE IF NOT EXISTS processing_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER,
        processor_type TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT,
        error_message TEXT,
        FOREIGN KEY (article_id) REFERENCES articles (id)
      )
    `, (err) => {
      if (err) {
        logger.error('Failed to create processing_queue table', { error: err.message });
      }
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  init,
  getDb,
  dbAll,
  dbGet,
  dbRun,
  // ...other exports...
};