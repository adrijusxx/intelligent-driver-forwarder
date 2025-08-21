const { FacebookPost } = require('../database/models');
const logger = require('../utils/logger');

class PostManager {
  constructor(graphApi) {
    this.graphApi = graphApi;
  }

  /**
   * Process all scheduled posts that are ready to be published
   */
  async processScheduledPosts() {
    try {
      logger.debug('Starting to process scheduled posts');
      const readyPosts = await FacebookPost.getReadyToPost() || [];
      logger.info('Processing posts', { count: readyPosts.length });
      
      for (const post of readyPosts) {
        try {
          await this.publishPost(post);
          logger.info('Successfully published post', { postId: post.id });
        } catch (error) {
          logger.error('Failed to process post', { 
            postId: post.id, 
            error: error.message 
          });
        }
      }
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
      const pageInfo = await this.graphApi.getPageInfo();
      logger.info('Facebook credentials validated', {
        pageId: pageInfo.id,
        pageName: pageInfo.name
      });
      return pageInfo;
    } catch (error) {
      logger.error('Facebook credential validation failed', {
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
}

module.exports = PostManager;
