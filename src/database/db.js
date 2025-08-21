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