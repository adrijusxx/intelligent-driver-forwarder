const { FacebookPost } = require('../database/models');
const logger = require('../utils/logger');
const configUtil = require('../utils/config');

class PostManager {
  constructor(graphApi) {
    this.graphApi = graphApi;
    this.lastTokenRefresh = Date.now();
    this.tokenRefreshInterval = 3600000; // 1 hour in milliseconds
  }

  /**
   * Process all scheduled posts that are ready to be published
   */
  async processScheduledPosts() {
    try {
      logger.debug('Starting to process scheduled posts');
      const readyPosts = await FacebookPost.getReadyToPost() || [];
      logger.info('Processing posts', { count: readyPosts.length });
      
      let processed = 0;
      let failed = 0;
      
      for (const post of readyPosts) {
        try {
          await this.publishPost(post);
          logger.info('Successfully published post', { postId: post.id });
          processed++;
        } catch (error) {
          logger.error('Failed to process post', { 
            postId: post.id, 
            error: error.message 
          });
          failed++;
        }
      }
      
      return { processed, failed, total: readyPosts.length };
    } catch (error) {
      logger.error('Failed to process scheduled posts', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Publish a post to Facebook
   * @param {object} post Post data
   */
  async publishPost(post) {
    try {
      await this.graphApi.createPost(post.content);
      await FacebookPost.markAsPosted(post.id);
    } catch (error) {
      logger.error('Failed to publish post', { 
        postId: post.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Validate Facebook credentials
   */
  async validateCredentials() {
    try {
      // Check if we need to refresh the token
      if (this.shouldRefreshToken()) {
        await this.refreshToken();
      }
      
      const pageInfo = await this.graphApi.getPageInfo();
      logger.info('Facebook credentials validated', {
        pageId: pageInfo.id,
        pageName: pageInfo.name
      });
      return pageInfo;
    } catch (error) {
      if (error.message.includes('Session has expired')) {
        logger.warn('Session expired, attempting to refresh token');
        try {
          await this.refreshToken();
          // Retry the validation after refresh
          return await this.validateCredentials();
        } catch (refreshError) {
          logger.error('Failed to refresh token', {
            error: refreshError.message
          });
          throw refreshError;
        }
      }
      logger.error('Facebook credential validation failed', {
        error: error.message
      });
      throw error;
    }
  }

  shouldRefreshToken() {
    const now = Date.now();
    const timeSinceLastRefresh = now - this.lastTokenRefresh;
    return timeSinceLastRefresh >= this.tokenRefreshInterval;
  }

  async refreshToken() {
    try {
      // Get new long-lived token
      const newToken = await this.graphApi.exchangeToken();
      
      // Update the configuration
      configUtil.set('facebook.accessToken', newToken);
      
      // Update the GraphAPI instance
      this.graphApi.updateAccessToken(newToken);
      
      // Update last refresh time
      this.lastTokenRefresh = Date.now();
      
      logger.info('Successfully refreshed Facebook access token');
    } catch (error) {
      logger.error('Failed to refresh Facebook access token', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Schedule a new post
   * @param {object} article Article data
   * @param {string} postContent Post content
   * @param {string} scheduledTime Scheduled time
   */
  async schedulePost(article, postContent, scheduledTime) {
    try {
      await FacebookPost.create({
        articleId: article.id,
        content: postContent,
        scheduledTime: scheduledTime
      });
      logger.info('Post scheduled', { 
        articleId: article.id, 
        scheduledTime 
      });
    } catch (error) {
      logger.error('Failed to schedule post', { 
        articleId: article.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update engagement metrics for published posts
   * @returns {Promise<Object>} Update results
   */
  async updateEngagementMetrics() {
    try {
      logger.debug('Starting engagement metrics update');
      
      // Get published posts that need metrics updates
      const posts = await FacebookPost.getPublishedPosts();
      
      let updated = 0;
      let failed = 0;
      
      for (const post of posts) {
        try {
          // Get post metrics from Facebook API
          const metrics = await this.graphApi.getPostMetrics(post.facebook_post_id);
          
          // Update post with metrics
          await FacebookPost.updateMetrics(post.id, metrics);
          updated++;
        } catch (error) {
          logger.error('Failed to update metrics for post', {
            postId: post.id,
            facebookPostId: post.facebook_post_id,
            error: error.message
          });
          failed++;
        }
      }
      
      return { updated, failed, total: posts.length };
    } catch (error) {
      logger.error('Failed to update engagement metrics', { error: error.message });
      return { updated: 0, failed: 0, total: 0 };
    }
  }
}

module.exports = PostManager;
