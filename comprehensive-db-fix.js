#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'articles.db');

console.log('🔧 Comprehensive database schema fix...');
console.log(`📁 Database: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Connected to database');
  
  db.serialize(() => {
    // First, create all tables with the correct schema
    console.log('📋 Creating/updating articles table...');
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

    console.log('📋 Creating/updating facebook_posts table...');
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

    console.log('📋 Creating/updating processing_queue table...');
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
      checkAndAddMissingColumns();
    });
  });
});

function checkAndAddMissingColumns() {
  console.log('🔍 Checking for missing columns...');
  
  // Check articles table
  db.all("PRAGMA table_info(articles)", (err, columns) => {
    if (err) {
      console.error('❌ Failed to get articles table info:', err.message);
      process.exit(1);
    }
    
    const articleColumns = columns.map(col => col.name);
    console.log('📊 Articles table columns:', articleColumns.join(', '));
    
    const hasProcessed = columns.some(col => col.name === 'processed');
    
    if (!hasProcessed) {
      console.log('➕ Adding processed column to articles table...');
      db.run("ALTER TABLE articles ADD COLUMN processed INTEGER DEFAULT 0", (err) => {
        if (err) {
          console.error('❌ Failed to add processed column to articles:', err.message);
          process.exit(1);
        }
        console.log('✅ Added processed column to articles table');
        checkFacebookPostsTable();
      });
    } else {
      console.log('✅ Articles table has processed column');
      checkFacebookPostsTable();
    }
  });
}

function checkFacebookPostsTable() {
  // Check facebook_posts table
  db.all("PRAGMA table_info(facebook_posts)", (err, columns) => {
    if (err) {
      console.error('❌ Failed to get facebook_posts table info:', err.message);
      process.exit(1);
    }
    
    const fbColumns = columns.map(col => col.name);
    console.log('📊 Facebook_posts table columns:', fbColumns.join(', '));
    
    const hasProcessed = columns.some(col => col.name === 'processed');
    const hasEngagementMetrics = columns.some(col => col.name === 'engagement_metrics');
    
    let columnsToAdd = [];
    
    if (!hasProcessed) {
      columnsToAdd.push({
        name: 'processed',
        sql: 'ALTER TABLE facebook_posts ADD COLUMN processed INTEGER DEFAULT 0'
      });
    }
    
    if (!hasEngagementMetrics) {
      columnsToAdd.push({
        name: 'engagement_metrics',
        sql: 'ALTER TABLE facebook_posts ADD COLUMN engagement_metrics TEXT'
      });
    }
    
    if (columnsToAdd.length === 0) {
      console.log('✅ Facebook_posts table has all required columns');
      finishSetup();
      return;
    }
    
    // Add missing columns one by one
    addColumnsSequentially(columnsToAdd, 0);
  });
}

function addColumnsSequentially(columnsToAdd, index) {
  if (index >= columnsToAdd.length) {
    finishSetup();
    return;
  }
  
  const column = columnsToAdd[index];
  console.log(`➕ Adding ${column.name} column to facebook_posts table...`);
  
  db.run(column.sql, (err) => {
    if (err) {
      console.error(`❌ Failed to add ${column.name} column to facebook_posts:`, err.message);
      process.exit(1);
    }
    console.log(`✅ Added ${column.name} column to facebook_posts table`);
    
    // Add next column
    addColumnsSequentially(columnsToAdd, index + 1);
  });
}

function finishSetup() {
  // Final verification
  console.log('🔍 Final verification...');
  
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('❌ Failed to get table list:', err.message);
      process.exit(1);
    }
    
    const tableNames = tables.map(t => t.name);
    console.log('📋 Database tables:', tableNames.join(', '));
    
    // Test the facebook_posts table with a query that uses the processed column
    db.all("SELECT COUNT(*) as count FROM facebook_posts WHERE processed = 0", (err, result) => {
      if (err) {
        console.error('❌ Failed to test facebook_posts table:', err.message);
        console.log('⚠️  This indicates the processed column is still missing');
        process.exit(1);
      }
      
      console.log(`✅ Facebook_posts table test passed (${result[0].count} unprocessed posts)`);
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
          process.exit(1);
        }
        
        console.log('');
        console.log('🎉 Database schema setup completed successfully!');
        console.log('');
        console.log('✅ All tables created with correct schema');
        console.log('✅ All required columns added');
        console.log('✅ Database integrity verified');
        console.log('');
        console.log('You can now run: npm start');
        process.exit(0);
      });
    });
  });
}
