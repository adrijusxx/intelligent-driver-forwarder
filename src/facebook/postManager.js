const FacebookGraphAPI = require('./graphApi');
const { FacebookPost } = require('../database/models');
const logger = require('../utils/logger');

class PostManager {
  constructor() {
    this.api = new FacebookGraphAPI();
  }

  /**
   * Publish a scheduled post to Facebook
   * @param {object} postData - Post data from database
   * @returns {object} Publication result
   */
  async publishPost(postData) {
    const startTime = Date.now();
    
    try {
      logger.info('Publishing post to Facebook', { 
        postId: postData.id,
        articleId: postData.article_id,
        textLength: postData.post_text.length
      });

      // Update status to posting
      await FacebookPost.updateStatus(postData.id, 'posting');

      // Create the Facebook post
      const facebookResult = await this.api.createPost({
        text: postData.post_text,
        image_url: postData.image_url,
        article_url: postData.article_url
      });

      // Update with success
      await FacebookPost.updateStatus(postData.id, 'posted', {
        facebook_post_id: facebookResult.facebook_post_id,
        post_url: facebookResult.post_url,
        posted_time: new Date().toISOString()
      });

      const duration = Date.now() - startTime;
      
      logger.info('Post published successfully', {
        postId: postData.id,
        facebookPostId: facebookResult.facebook_post_id,
        duration: `${duration}ms`
      });

      return {
        success: true,
        facebook_post_id: facebookResult.facebook_post_id,
        post_url: facebookResult.post_url,
        duration
      };

    } catch (error) {
      logger.error('Failed to publish post', {
        postId: postData.id,
        error: error.message
      });

      // Update with failure
      await FacebookPost.updateStatus(postData.id, 'failed', {
        error_message: error.message
      });

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Process all scheduled posts that are ready to be published
   */
  async processScheduledPosts() {
    try {
      const readyPosts = await FacebookPost.getReadyToPost() || [];
      logger.info('Processing posts', { count: readyPosts.length });
      for (const post of readyPosts) {

  /**
   * Update engagement metrics for existing posts
   * @param {number} hours - Hours back to check for posts
   * @returns {object} Update results
   */
  async updateEngagementMetrics(hours = 24) {
    const startTime = Date.now();
    
    try {
      // Get recently posted Facebook posts
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const recentPosts = await FacebookPost.all(
        `SELECT * FROM facebook_posts 
         WHERE status = 'posted' AND posted_time >= ? AND facebook_post_id IS NOT NULL`,
        [cutoffTime]
      );

      if (recentPosts.length === 0) {
        logger.debug('No recent posts to update metrics for');
        return { updated: 0, duration: Date.now() - startTime };
      }

      logger.info('Updating engagement metrics', { posts: recentPosts.length });

      let updated = 0;

      for (const post of recentPosts) {
        try {
          const metrics = await this.api.getPostMetrics(post.facebook_post_id);
          
          if (metrics) {
            await FacebookPost.updateStatus(post.id, 'posted', {
              engagement_metrics: JSON.stringify(metrics)
            });
            updated++;
            
            logger.debug('Metrics updated', {
              postId: post.id,
              facebookPostId: post.facebook_post_id,
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares
            });
          }
        } catch (error) {
          logger.warn('Failed to update metrics for post', {
            postId: post.id,
            facebookPostId: post.facebook_post_id,
            error: error.message
          });
        }

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const duration = Date.now() - startTime;
      
      logger.info('Engagement metrics update completed', {
        total: recentPosts.length,
        updated,
        duration: `${duration}ms`
      });

      return { updated, duration };

    } catch (error) {
      logger.error('Failed to update engagement metrics', error);
      throw error;
    }
  }

  /**
   * Create and schedule a Facebook post
   * @param {object} article - Article data
   * @param {object} postContent - Generated post content
   * @param {Date} scheduledTime - When to post
   * @returns {object} Created post record
   */
  async schedulePost(article, postContent, scheduledTime) {
    try {
      const postData = {
        article_id: article.id,
        post_text: postContent.text,
        scheduled_time: scheduledTime.toISOString(),
        status: 'pending'
      };

      const createdPost = await FacebookPost.create(postData);
      
      logger.info('Post scheduled successfully', {
        postId: createdPost.id,
        articleId: article.id,
        scheduledTime: scheduledTime.toISOString(),
        title: article.title
      });

      return createdPost;

    } catch (error) {
      logger.error('Failed to schedule post', {
        articleId: article.id,
        scheduledTime: scheduledTime.toISOString(),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get posting statistics
   * @param {number} days - Days back to analyze
   * @returns {object} Statistics
   */
  async getPostingStats(days = 7) {
    const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const stats = await FacebookPost.all(
      `SELECT 
         status,
         COUNT(*) as count,
         AVG(CASE WHEN engagement_metrics IS NOT NULL 
             THEN json_extract(engagement_metrics, '$.likes') 
             ELSE 0 END) as avg_likes,
         AVG(CASE WHEN engagement_metrics IS NOT NULL 
             THEN json_extract(engagement_metrics, '$.comments') 
             ELSE 0 END) as avg_comments,
         AVG(CASE WHEN engagement_metrics IS NOT NULL 
             THEN json_extract(engagement_metrics, '$.shares') 
             ELSE 0 END) as avg_shares
       FROM facebook_posts 
       WHERE created_at >= ? 
       GROUP BY status`,
      [cutoffTime]
    );

    const summary = {
      period_days: days,
      total_posts: 0,
      posted: 0,
      pending: 0,
      failed: 0,
      avg_engagement: {
        likes: 0,
        comments: 0,
        shares: 0
      }
    };

    stats.forEach(stat => {
      summary.total_posts += stat.count;
      summary[stat.status] = stat.count;
      
      if (stat.status === 'posted') {
        summary.avg_engagement.likes = Math.round(stat.avg_likes || 0);
        summary.avg_engagement.comments = Math.round(stat.avg_comments || 0);
        summary.avg_engagement.shares = Math.round(stat.avg_shares || 0);
      }
    });

    return summary;
  }

  /**
   * Test Facebook API connection
   * @returns {object} Test result
   */
  async testConnection() {
    return await this.api.testConnection();
  }

  /**
   * Validate API credentials
   * @returns {boolean} True if valid
   */
  async validateCredentials() {
    return await this.api.validateCredentials();
  }

  /**
   * Get Facebook page information
   * @returns {object} Page info
   */
  async getPageInfo() {
    return await this.api.getPageInfo();
  }
}

module.exports = PostManager;