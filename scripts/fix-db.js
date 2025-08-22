const sqlite3 = require('sqlite3').verbose();
const config = require('../src/utils/config');
const logger = require('../src/utils/logger');

async function fixProcessedColumn() {
  const dbPath = config.get('database.path', './data/articles.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Failed to connect to database', { error: err.message });
        return reject(err);
      }
      
      logger.info('Connected to database for column fix');
      
      // Check if processed column exists
      db.all("PRAGMA table_info(articles)", (err, columns) => {
        if (err) {
          logger.error('Failed to get table info', { error: err.message });
          return reject(err);
        }
        
        const hasProcessed = columns.some(col => col.name === 'processed');
        
        logger.info('Current columns:', columns.map(c => c.name));
        
        if (!hasProcessed) {
          logger.info('Adding processed column...');
          db.run("ALTER TABLE articles ADD COLUMN processed INTEGER DEFAULT 0", (err) => {
            if (err) {
              logger.error('Failed to add processed column', { error: err.message });
              return reject(err);
            }
            
            logger.info('Successfully added processed column');
            db.close();
            resolve();
          });
        } else {
          logger.info('Processed column already exists');
          db.close();
          resolve();
        }
      });
    });
  });
}

fixProcessedColumn()
  .then(() => {
    logger.info('Database schema fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Database schema fix failed', { error: error.message });
    process.exit(1);
  });
