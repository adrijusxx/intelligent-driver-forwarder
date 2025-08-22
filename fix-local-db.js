#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist (relative to current working directory)
const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = './data/articles.db';

console.log('🔧 Fixing database schema for local environment...');
console.log(`📁 Database: ${path.resolve(dbPath)}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
  
  console.log('� Connected to database successfully');
  
  db.serialize(() => {
    // First, create all tables if they don't exist
    console.log('🔨 Creating tables if they don\'t exist...');
    
    // Create articles table
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
        console.error('❌ Failed to create articles table:', err.message);
        process.exit(1);
      }
      console.log('✅ Articles table ready');
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
        processed INTEGER DEFAULT 0,
        engagement_metrics TEXT,
        FOREIGN KEY (article_id) REFERENCES articles (id)
      )
    `, (err) => {
      if (err) {
        console.error('❌ Failed to create facebook_posts table:', err.message);
        process.exit(1);
      }
      console.log('✅ Facebook_posts table ready');
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
        console.error('❌ Failed to create processing_queue table:', err.message);
        process.exit(1);
      }
      console.log('✅ Processing_queue table ready');
      
      // Now check and add missing columns
      checkAndAddColumns();
    });
  });
});

function checkAndAddColumns() {
  // Check if processed column exists in articles table
  db.all("PRAGMA table_info(articles)", (err, columns) => {
    if (err) {
      console.error('❌ Failed to get articles table info:', err.message);
      process.exit(1);
    }
    
    const hasProcessed = columns.some(col => col.name === 'processed');
    
    if (!hasProcessed) {
      console.log('➕ Adding processed column to articles table...');
      db.run("ALTER TABLE articles ADD COLUMN processed INTEGER DEFAULT 0", (err) => {
        if (err) {
          console.error('❌ Failed to add processed column to articles:', err.message);
          process.exit(1);
        }
        console.log('✅ Added processed column to articles table');
        checkFacebookPostsColumns();
      });
    } else {
      console.log('✅ Articles table already has processed column');
      checkFacebookPostsColumns();
    }
  });
}

function checkFacebookPostsColumns() {
  // Check if processed column exists in facebook_posts table
  db.all("PRAGMA table_info(facebook_posts)", (err, columns) => {
    if (err) {
      console.error('❌ Failed to get facebook_posts table info:', err.message);
      process.exit(1);
    }
    
    const hasProcessed = columns.some(col => col.name === 'processed');
    const hasEngagementMetrics = columns.some(col => col.name === 'engagement_metrics');
    
    let columnsToAdd = [];
    if (!hasProcessed) columnsToAdd.push('processed');
    if (!hasEngagementMetrics) columnsToAdd.push('engagement_metrics');
    
    if (columnsToAdd.length === 0) {
      console.log('✅ Facebook_posts table has all required columns');
      finishSetup();
      return;
    }
    
    addColumnsSequentially(columnsToAdd, 0);
  });
}

function addColumnsSequentially(columnsToAdd, index) {
  if (index >= columnsToAdd.length) {
    finishSetup();
    return;
  }
  
  const column = columnsToAdd[index];
  let sql, message;
  
  if (column === 'processed') {
    sql = "ALTER TABLE facebook_posts ADD COLUMN processed INTEGER DEFAULT 0";
    message = 'processed column';
  } else if (column === 'engagement_metrics') {
    sql = "ALTER TABLE facebook_posts ADD COLUMN engagement_metrics TEXT";
    message = 'engagement_metrics column';
  }
  
  console.log(`➕ Adding ${message} to facebook_posts table...`);
  db.run(sql, (err) => {
    if (err) {
      console.error(`❌ Failed to add ${message} to facebook_posts:`, err.message);
      process.exit(1);
    }
    console.log(`✅ Added ${message} to facebook_posts table`);
    
    // Add next column
    addColumnsSequentially(columnsToAdd, index + 1);
  });
}

function finishSetup() {
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
      process.exit(1);
    }
    console.log('🎉 Database schema fix completed successfully!');
    console.log('');
    console.log('✅ All tables and columns are ready');
    console.log('You can now run: npm start');
    process.exit(0);
  });
}
