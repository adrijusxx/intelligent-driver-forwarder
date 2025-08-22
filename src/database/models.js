const { dbAll, dbGet, dbRun, getDb } = require('./db');
const logger = require('../utils/logger');

/**
 * Article model for database operations
 */
class Article {
  /**
   * Save new article to database
   * @param {object} articleData Article data to save
   * @returns {Promise} Database result
   */
  static async create(articleData) {
    return await dbRun(
      `INSERT INTO articles (
        title, url, summary, content, source, 
        published_at, image_url, tags, 
        engagement_score, processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        articleData.title,
        articleData.url,
        articleData.summary,
        articleData.content,
        articleData.source,
        articleData.publishedAt,
        articleData.imageUrl,
        articleData.tags,
        articleData.engagementScore || 0,
        0
      ]
    );
  }

  /**
   * Find article by URL
   * @param {string} url Article URL
   * @returns {Promise<object>} Article data
   */
  static async findByUrl(url) {
    return await dbGet('SELECT * FROM articles WHERE url = ?', [url]);
  }

  /**
   * Get unprocessed articles
   * @param {number} limit Maximum number of articles to return
   * @returns {Promise<Array>} Array of articles
   */
  static async getUnprocessed(limit = 10) {
    try {
      const articles = await dbAll(
        `SELECT * FROM articles 
         WHERE processed = 0 
         ORDER BY published_at DESC 
         LIMIT ?`,
        [limit]
      );
      return articles || [];
    } catch (error) {
      logger.error('Error getting unprocessed articles', { error: error.message });
      return [];
    }
  }

  /**
   * Mark article as processed
   * @param {number} id Article ID
   */
  static async markAsProcessed(id) {
    await dbRun(
      'UPDATE articles SET processed = 1 WHERE id = ?',
      [id]
    );
  }

  /**
   * Get recent articles within specified hours
   * @param {number} hours Number of hours to look back
   * @returns {Promise<Array>} Array of recent articles
   */
  static async getRecent(hours = 24) {
    try {
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
      const articles = await dbAll(
        `SELECT * FROM articles 
         WHERE published_at >= ? OR created_at >= datetime('now', '-${hours} hours')
         ORDER BY published_at DESC`,
        [cutoffDate.toISOString()]
      );
      return articles || [];
    } catch (error) {
      logger.error('Error getting recent articles', { error: error.message });
      return [];
    }
  }
}

class FacebookPost {
  /**
   * Create a new Facebook post
   * @param {object} data Post data
   * @returns {Promise} Database result
   */
  static async create(data) {
    try {
      const result = await dbRun(
        `INSERT INTO facebook_posts (
          article_id, content, scheduled_time, processed
        ) VALUES (?, ?, ?, ?)`,
        [data.articleId, data.content, data.scheduledTime, 0]
      );
      logger.info('Created Facebook post', { articleId: data.articleId });
      return result;
    } catch (error) {
      logger.error('Error creating Facebook post', { error: error.message });
      throw error;
    }
  }

  /**
   * Get posts that are ready to be published
   * @returns {Promise<Array>} Array of posts
   */
  static async getReadyToPost() {
    try {
      logger.debug('Fetching ready to post items');
      const posts = await dbAll(`
        SELECT * FROM facebook_posts 
        WHERE processed = 0 
        AND scheduled_time <= datetime('now')
        ORDER BY scheduled_time ASC
      `);
      logger.info('Found ready posts', { count: posts?.length || 0 });
      return posts || [];
    } catch (error) {
      logger.error('Error getting ready posts', { error: error.message });
      return [];
    }
  }

  /**
   * Get all Facebook posts
   * @returns {Promise<Array>} Array of posts
   */
  static async all() {
    try {
      const posts = await dbAll('SELECT * FROM facebook_posts');
      return posts || [];
    } catch (error) {
      logger.error('Error getting all posts', { error: error.message });
      return [];
    }
  }

  /**
   * Mark post as published
   * @param {number} id Post ID
   */
  static async markAsPosted(id) {
    try {
      await dbRun(
        'UPDATE facebook_posts SET processed = 1 WHERE id = ?',
        [id]
      );
      logger.info('Marked post as published', { postId: id });
    } catch (error) {
      logger.error('Error marking post as published', { 
        postId: id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get published posts for metrics updates
   * @returns {Promise<Array>} Array of published posts
   */
  static async getPublishedPosts() {
    try {
      const posts = await dbAll(`
        SELECT * FROM facebook_posts 
        WHERE processed = 1 
        AND facebook_post_id IS NOT NULL
        AND facebook_post_id != ''
        ORDER BY created_at DESC
        LIMIT 50
      `);
      return posts || [];
    } catch (error) {
      logger.error('Error getting published posts', { error: error.message });
      return [];
    }
  }

  /**
   * Update post engagement metrics
   * @param {number} id Post ID
   * @param {object} metrics Engagement metrics
   */
  static async updateMetrics(id, metrics) {
    try {
      await dbRun(
        'UPDATE facebook_posts SET engagement_metrics = ?, updated_at = datetime("now") WHERE id = ?',
        [JSON.stringify(metrics), id]
      );
      logger.debug('Updated post metrics', { postId: id });
    } catch (error) {
      logger.error('Error updating post metrics', { 
        postId: id, 
        error: error.message 
      });
      throw error;
    }
  }
}

/**
 * Processing Queue model for managing article processing tasks
 */
class ProcessingQueue {
  /**
   * Add item to processing queue
   * @param {number} articleId Article ID
   * @param {number} priority Priority level
   * @returns {Promise} Database result
   */
  static async add(articleId, priority = 1) {
    try {
      const result = await dbRun(
        `INSERT INTO processing_queue (article_id, priority) VALUES (?, ?)`,
        [articleId, priority]
      );
      logger.debug('Added to processing queue', { articleId, priority });
      return result;
    } catch (error) {
      logger.error('Error adding to processing queue', { 
        articleId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get next items from processing queue
   * @param {number} limit Maximum number of items
   * @returns {Promise<Array>} Array of queue items
   */
  static async getNext(limit = 10) {
    try {
      const items = await dbAll(
        `SELECT * FROM processing_queue 
         WHERE status = 'pending' 
         ORDER BY priority DESC, created_at ASC 
         LIMIT ?`,
        [limit]
      );
      return items || [];
    } catch (error) {
      logger.error('Error getting next queue items', { error: error.message });
      return [];
    }
  }

  /**
   * Mark queue item as processed
   * @param {number} id Queue item ID
   */
  static async markAsProcessed(id) {
    try {
      await dbRun(
        `UPDATE processing_queue 
         SET status = 'processed', processed_at = datetime('now') 
         WHERE id = ?`,
        [id]
      );
      logger.debug('Marked queue item as processed', { id });
    } catch (error) {
      logger.error('Error marking queue item as processed', { 
        id, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = {
  Article,
  FacebookPost,
  ProcessingQueue
};
