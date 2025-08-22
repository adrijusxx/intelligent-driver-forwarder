const sqlite3 = require('sqlite3').verbose();
const config = require('../src/utils/config');
const logger = require('../src/utils/logger');

async function checkTables() {
  const dbPath = config.get('database.path', './data/articles.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Failed to connect to database', { error: err.message });
        return reject(err);
      }
      
      logger.info('Checking database tables...');
      
      // Check articles table
      db.all("PRAGMA table_info(articles)", (err, columns) => {
        if (err) {
          logger.error('Failed to get articles table info', { error: err.message });
          return reject(err);
        }
        
        logger.info('Articles table columns:', columns.map(c => c.name));
        
        // Check facebook_posts table
        db.all("PRAGMA table_info(facebook_posts)", (err, fbColumns) => {
          if (err) {
            logger.error('Failed to get facebook_posts table info', { error: err.message });
            return reject(err);
          }
          
          logger.info('Facebook_posts table columns:', fbColumns.map(c => c.name));
          
          // Check if processed column exists in facebook_posts
          const hasProcessed = fbColumns.some(col => col.name === 'processed');
          
          if (!hasProcessed) {
            logger.info('Adding processed column to facebook_posts table...');
            db.run("ALTER TABLE facebook_posts ADD COLUMN processed INTEGER DEFAULT 0", (err) => {
              if (err) {
                logger.error('Failed to add processed column to facebook_posts', { error: err.message });
                return reject(err);
              }
              
              logger.info('Successfully added processed column to facebook_posts');
              db.close();
              resolve();
            });
          } else {
            logger.info('Processed column already exists in facebook_posts');
            db.close();
            resolve();
          }
        });
      });
    });
  });
}

checkTables()
  .then(() => {
    logger.info('Database tables check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Database tables check failed', { error: error.message });
    process.exit(1);
  });
