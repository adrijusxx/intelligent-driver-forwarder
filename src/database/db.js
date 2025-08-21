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
        image_url TEXT,
        tags TEXT,
        engagement_score REAL,
        processed INTEGER DEFAULT 0
      )
    `, (err) => {
      if (err) {
        logger.error('Failed to create articles table', { error: err.message });
      } else {
        logger.info('Database tables created successfully');
      }
    });
  });
}

const dbInstance = getDb();

// Example query using the db instance
dbInstance.all('SELECT * FROM articles', [], (err, rows) => {
  if (err) {
    logger.error('Failed to fetch articles', { error: err.message });
    return;
  }
  logger.info('Fetched articles successfully', { count: rows.length });
});

module.exports = {
  init,
  getDb,
  // ...other exports...
};