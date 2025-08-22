#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'articles.db');

console.log('🔧 Fixing database schema for local environment...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
  
  console.log(`📁 Database: ${dbPath}`);
  
  db.serialize(() => {
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
        });
      } else {
        console.log('✅ Articles table already has processed column');
      }
    });

    // Check if processed column exists in facebook_posts table
    db.all("PRAGMA table_info(facebook_posts)", (err, columns) => {
      if (err) {
        // Table might not exist yet, create it
        console.log('📋 Creating facebook_posts table...');
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
            FOREIGN KEY (article_id) REFERENCES articles (id)
          )
        `, (err) => {
          if (err) {
            console.error('❌ Failed to create facebook_posts table:', err.message);
            process.exit(1);
          }
          console.log('✅ Created facebook_posts table with processed column');
          
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err.message);
              process.exit(1);
            }
            console.log('🎉 Database schema fix completed successfully!');
            console.log('');
            console.log('You can now run: npm start');
            process.exit(0);
          });
        });
        return;
      }
      
      const hasProcessed = columns.some(col => col.name === 'processed');
      
      if (!hasProcessed) {
        console.log('➕ Adding processed column to facebook_posts table...');
        db.run("ALTER TABLE facebook_posts ADD COLUMN processed INTEGER DEFAULT 0", (err) => {
          if (err) {
            console.error('❌ Failed to add processed column to facebook_posts:', err.message);
            process.exit(1);
          }
          console.log('✅ Added processed column to facebook_posts table');
          
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err.message);
              process.exit(1);
            }
            console.log('🎉 Database schema fix completed successfully!');
            console.log('');
            console.log('You can now run: npm start');
            process.exit(0);
          });
        });
      } else {
        console.log('✅ Facebook_posts table already has processed column');
        
        db.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err.message);
            process.exit(1);
          }
          console.log('🎉 Database schema check completed - everything looks good!');
          console.log('');
          console.log('You can now run: npm start');
          process.exit(0);
        });
      }
    });
  });
});
