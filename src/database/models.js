const { dbAll, dbGet, dbRun, getDb } = require('./db');

/**
 * Article model for database operations
 */
class Article {
  /**
   * Save new article to database
   * @param {object} const { dbAll, dbGet, dbRun, getDb } = require('./db');
const logger = require('../utils/logger');

class FacebookPost {
  static async create(data) {
    const result = await dbRun(
      `INSERT INTO facebook_posts (article_id, content, scheduled_time, processed) 
       VALUES (?, ?, ?, ?)`,Data - Article data
   * @returns {object} Created article with ID
   */
  static async create(articleData) {
    const {
      url,
      title,
      summary,
      content,
      source,
      published_date,
      image_url,
      engagement_score = 0,
      tags = []
    } = articleData;

    try {
      const result = await dbRun(
        `INSERT INTO articles (
          url, title, summary, content, source, published_date, 
          image_url, engagement_score, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          url,
          title,
          summary,
          content,
          source,
          published_date,
          image_url,
          engagement_score,
          JSON.stringify(tags)
        ]
      );

      logger.info('Article created', { id: result.id, url, title });
      return { id: result.id, ...articleData };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        logger.debug('Article already exists', { url });
        return await this.findByUrl(url);
      }
      throw error;
    }
  }

  /**
   * Find article by URL
   * @param {string} url - Article URL
   * @returns {object|null} Article or null if not found
   */
  static async findByUrl(url) {
    const article = await dbGet('SELECT * FROM articles WHERE url = ?', [url]);
    if (article && article.tags) {
      article.tags = JSON.parse(article.tags);
    }
    return article;
  }

  /**
   * Find article by ID
   * @param {number} id - Article ID
   * @returns {object|null} Article or null if not found
   */
  static async findById(id) {
    const db = getDb();
    const article = await db.get('SELECT * FROM articles WHERE id = ?', [id]);
    if (article && article.tags) {
      article.tags = JSON.parse(article.tags);
    }
    return article;
  }

  /**
   * Get unprocessed articles ordered by engagement score
   * @param {number} limit - Maximum number of articles to return
   * @returns {array} Array of articles
   */
  static async getUnprocessed(limit = 10) {
    const articles = await dbAll(
      `SELECT * FROM articles 
       WHERE is_processed = 0 AND is_duplicate = 0
       ORDER BY engagement_score DESC, published_date DESC 
       LIMIT ?`,
      [limit]
    );

    return articles.map(article => {
      if (article.tags) {
        article.tags = JSON.parse(article.tags);
      }
      return article;
    });
  }

  /**
   * Get recent articles for duplicate detection
   * @param {number} hours - Hours to look back
   * @returns {array} Array of articles
   */
  static async getRecent(hours = 24) {
    const db = getDb();
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const articles = await db.all(
      'SELECT * FROM articles WHERE published_date >= ? ORDER BY published_date DESC',
      [cutoffDate]
    );

    return articles.map(article => {
      if (article.tags) {
        article.tags = JSON.parse(article.tags);
      }
      return article;
    });
  }

  /**
   * Mark article as processed
   * @param {number} id - Article ID
   */
  static async markAsProcessed(id) {
    const db = getDb();
    await db.run(
      'UPDATE articles SET is_processed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    logger.debug('Article marked as processed', { id });
  }

  /**
   * Mark article as duplicate
   * @param {number} id - Article ID
   */
  static async markAsDuplicate(id) {
    const db = getDb();
    await db.run(
      'UPDATE articles SET is_duplicate = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    logger.debug('Article marked as duplicate', { id });
  }

  /**
   * Update engagement score
   * @param {number} id - Article ID
   * @param {number} score - Engagement score
   */
  static async updateEngagementScore(id, score) {
    const db = getDb();
    await db.run(
      'UPDATE articles SET engagement_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [score, id]
    );
  }
}

/**
 * Facebook Post model for database operations
 */
class FacebookPost {
  /**
   * Create new Facebook post record
   * @param {object} postData - Post data
   * @returns {object} Created post with ID
   */
  static async create(postData) {
    const {
      article_id,
      post_text,
      scheduled_time,
      facebook_post_id = null,
      post_url = null,
      status = 'pending'
    } = postData;

    const result = await dbRun(
      `INSERT INTO facebook_posts (
        article_id, post_text, scheduled_time, facebook_post_id, 
        post_url, status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [article_id, post_text, scheduled_time, facebook_post_id, post_url, status]
    );

    logger.info('Facebook post created', { id: result.id, article_id });
    return { id: result.id, ...postData };
  }

  /**
   * Update post status
   * @param {number} id - Post ID
   * @param {string} status - New status
   * @param {object} updates - Additional updates
   */
  static async updateStatus(id, status, updates = {}) {
    const db = getDb();
    const fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    values.push(id);

    await db.run(
      `UPDATE facebook_posts SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    logger.debug('Facebook post status updated', { id, status, updates });
  }

  /**
   * Get pending posts for scheduling
   * @returns {array} Array of pending posts
   */
  static async getPending() {
    const db = getDb();
    return await db.all(
      `SELECT fp.*, a.title, a.url as article_url, a.image_url 
       FROM facebook_posts fp 
       JOIN articles a ON fp.article_id = a.id 
       WHERE fp.status = 'pending' 
       ORDER BY fp.scheduled_time ASC`
    );
  }

  /**
   * Get posts ready to be published
   * @returns {array} Array of posts ready for publishing
   */
  static async getReadyToPost() {
    const db = getDb();
    const now = new Date().toISOString();
    return await db.all(
      `SELECT fp.*, a.title, a.url as article_url, a.image_url 
       FROM facebook_posts fp 
       JOIN articles a ON fp.article_id = a.id 
       WHERE fp.status = 'pending' AND fp.scheduled_time <= ? 
       ORDER BY fp.scheduled_time ASC`,
      [now]
    );
  }
}

/**
 * Processing Queue model for managing article processing
 */
class ProcessingQueue {
  /**
   * Add article to processing queue
   * @param {number} article_id - Article ID
   * @param {number} priority - Priority (1 = highest)
   */
  static async add(article_id, priority = 1) {
    const db = getDb();
    try {
      const result = await db.run(
        'INSERT INTO processing_queue (article_id, priority) VALUES (?, ?)',
        [article_id, priority]
      );
      logger.debug('Article added to processing queue', { article_id, priority });
      return result.id;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGN_KEY') {
        logger.warn('Attempted to queue non-existent article', { article_id });
      }
      throw error;
    }
  }

  /**
   * Get next item from queue
   * @returns {object|null} Queue item or null if empty
   */
  static async getNext() {
    const db = getDb();
    return await db.get(
      `SELECT pq.*, a.title, a.url 
       FROM processing_queue pq 
       JOIN articles a ON pq.article_id = a.id 
       WHERE pq.status = 'pending' 
       ORDER BY pq.priority ASC, pq.created_at ASC 
       LIMIT 1`
    );
  }

  /**
   * Update queue item status
   * @param {number} id - Queue ID
   * @param {string} status - New status
   * @param {string} error_message - Error message if failed
   */
  static async updateStatus(id, status, error_message = null) {
    const db = getDb();
    await db.run(
      `UPDATE processing_queue 
       SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [status, error_message, id]
    );
  }

  /**
   * Increment retry count
   * @param {number} id - Queue ID
   */
  static async incrementRetry(id) {
    const db = getDb();
    await db.run(
      `UPDATE processing_queue 
       SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );
  }
}

module.exports = {
  Article,
  FacebookPost,
  ProcessingQueue
};