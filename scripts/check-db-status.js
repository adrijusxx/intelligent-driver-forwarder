const sqlite3 = require('sqlite3').verbose();
const config = require('../src/utils/config');
const logger = require('../src/utils/logger');

async function checkDatabase() {
  const dbPath = config.get('database.path', './data/articles.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Failed to connect to database', { error: err.message });
        return reject(err);
      }
      
      logger.info('Checking database status...');
      
      // Check articles table
      db.all("SELECT COUNT(*) as total FROM articles", (err, result) => {
        if (err) {
          logger.error('Failed to count articles', { error: err.message });
          return reject(err);
        }
        
        logger.info(`Total articles: ${result[0].total}`);
        
        // Check unprocessed articles
        db.all("SELECT COUNT(*) as unprocessed FROM articles WHERE processed = 0", (err, result2) => {
          if (err) {
            logger.error('Failed to count unprocessed articles', { error: err.message });
            return reject(err);
          }
          
          logger.info(`Unprocessed articles: ${result2[0].unprocessed}`);
          
          // Check facebook_posts table
          db.all("SELECT COUNT(*) as total FROM facebook_posts", (err, result3) => {
            if (err) {
              logger.error('Failed to count facebook posts', { error: err.message });
              return reject(err);
            }
            
            logger.info(`Total Facebook posts: ${result3[0].total}`);
            
            // Check unprocessed facebook posts
            db.all("SELECT COUNT(*) as unprocessed FROM facebook_posts WHERE processed = 0", (err, result4) => {
              if (err) {
                logger.error('Failed to count unprocessed facebook posts', { error: err.message });
                return reject(err);
              }
              
              logger.info(`Unprocessed Facebook posts: ${result4[0].unprocessed}`);
              
              // Show some sample unprocessed articles
              db.all("SELECT id, title, processed FROM articles WHERE processed = 0 LIMIT 5", (err, articles) => {
                if (err) {
                  logger.error('Failed to get sample articles', { error: err.message });
                  return reject(err);
                }
                
                logger.info('Sample unprocessed articles:', articles);
                
                db.close();
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

checkDatabase()
  .then(() => {
    logger.info('Database check completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Database check failed', { error: error.message });
    process.exit(1);
  });
