const axios = require('axios');
const configUtil = require('../utils/config');
const logger = require('../utils/logger');

class FacebookGraphAPI {
  constructor() {
    this.accessToken = configUtil.get('facebook.accessToken');
    this.pageId = configUtil.get('facebook.pageId');
    this.apiVersion = configUtil.get('facebook.apiVersion', 'v18.0');
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.retryAttempts = configUtil.get('facebook.retryAttempts', 3);
    this.retryDelay = configUtil.get('facebook.retryDelay', 5000);
  }

  /**
   * Validate Facebook API credentials
   * @returns {boolean} True if credentials are valid
   */
  async validateCredentials() {
    try {
      const response = await this.makeRequest('GET', `/${this.pageId}`, {
        fields: 'id,name,access_token'
      });
      
      logger.info('Facebook credentials validated', { 
        pageId: response.id, 
        pageName: response.name 
      });
      
      return true;
    } catch (error) {
      logger.error('Facebook credential validation failed', error);
      return false;
    }
  }

  /**
   * Create a Facebook post
   * @param {object} postData - Post data
   * @returns {object} Facebook post response
   */
  async createPost(postData) {
    const { text, image_url, article_url } = postData;
    
    try {
      logger.info('Creating Facebook post', { 
        textLength: text.length,
        hasImage: !!image_url,
        hasLink: !!article_url
      });

      let postParams = {
        message: text,
        access_token: this.accessToken
      };

      // Add link if provided
      if (article_url) {
        postParams.link = article_url;
      }

      // Handle image posting
      if (image_url) {
        return await this.createPostWithImage(postParams, image_url);
      } else {
        return await this.createTextPost(postParams);
      }

    } catch (error) {
      logger.error('Failed to create Facebook post', error);
      throw error;
    }
  }

  /**
   * Create text-only post
   * @param {object} postParams - Post parameters
   * @returns {object} Facebook response
   */
  async createTextPost(postParams) {
    const response = await this.makeRequest('POST', `/${this.pageId}/feed`, postParams);
    
    logger.info('Text post created successfully', { 
      postId: response.id 
    });
    
    return {
      facebook_post_id: response.id,
      post_url: `https://facebook.com/${response.id}`,
      type: 'text'
    };
  }

  /**
   * Create post with image
   * @param {object} postParams - Post parameters
   * @param {string} imageUrl - Image URL
   * @returns {object} Facebook response
   */
  async createPostWithImage(postParams, imageUrl) {
    try {
      // First, try to post as a photo with the image URL
      const photoParams = {
        ...postParams,
        url: imageUrl,
        caption: postParams.message
      };
      delete photoParams.message;

      const response = await this.makeRequest('POST', `/${this.pageId}/photos`, photoParams);
      
      logger.info('Photo post created successfully', { 
        postId: response.id,
        imageUrl 
      });
      
      return {
        facebook_post_id: response.id,
        post_url: `https://facebook.com/${response.id}`,
        type: 'photo'
      };
      
    } catch (imageError) {
      logger.warn('Failed to post with image, falling back to text post', imageError);
      // Fallback to text post if image fails
      return await this.createTextPost(postParams);
    }
  }

  /**
   * Get post engagement metrics
   * @param {string} postId - Facebook post ID
   * @returns {object} Engagement metrics
   */
  async getPostMetrics(postId) {
    try {
      const response = await this.makeRequest('GET', `/${postId}`, {
        fields: 'likes.summary(true),comments.summary(true),shares,reactions.summary(true)'
      });
      
      const metrics = {
        likes: response.likes?.summary?.total_count || 0,
        comments: response.comments?.summary?.total_count || 0,
        shares: response.shares?.count || 0,
        reactions: response.reactions?.summary?.total_count || 0,
        retrieved_at: new Date().toISOString()
      };
      
      logger.debug('Post metrics retrieved', { postId, metrics });
      
      return metrics;
    } catch (error) {
      logger.warn('Failed to retrieve post metrics', { postId, error: error.message });
      return null;
    }
  }

  /**
   * Delete a post
   * @param {string} postId - Facebook post ID
   * @returns {boolean} True if successful
   */
  async deletePost(postId) {
    try {
      await this.makeRequest('DELETE', `/${postId}`);
      logger.info('Post deleted successfully', { postId });
      return true;
    } catch (error) {
      logger.error('Failed to delete post', { postId, error: error.message });
      return false;
    }
  }

  /**
   * Make HTTP request to Facebook Graph API with retry logic
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} params - Request parameters
   * @returns {object} API response
   */
  async makeRequest(method, endpoint, params = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const config = {
          method,
          url,
          timeout: 30000,
          headers: {
            'User-Agent': 'TruckingNewsBot/1.0'
          }
        };

        if (method === 'GET') {
          config.params = { ...params, access_token: this.accessToken };
        } else {
          config.data = { ...params, access_token: this.accessToken };
          config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        const response = await axios(config);
        
        logger.debug('Facebook API request successful', { 
          method, 
          endpoint, 
          attempt,
          status: response.status 
        });
        
        return response.data;

      } catch (error) {
        const isLastAttempt = attempt === this.retryAttempts;
        
        if (error.response) {
          const { status, data } = error.response;
          
          logger.error('Facebook API error response', {
            method,
            endpoint,
            attempt,
            status,
            error: data?.error || data
          });
          
          // Don't retry on certain errors
          if (status === 400 || status === 403) {
            throw new Error(`Facebook API error (${status}): ${data?.error?.message || 'Unknown error'}`);
          }
          
          if (isLastAttempt) {
            throw new Error(`Facebook API failed after ${this.retryAttempts} attempts: ${data?.error?.message || 'Unknown error'}`);
          }
        } else {
          logger.error('Facebook API network error', {
            method,
            endpoint,
            attempt,
            error: error.message
          });
          
          if (isLastAttempt) {
            throw new Error(`Facebook API network error after ${this.retryAttempts} attempts: ${error.message}`);
          }
        }
        
        // Wait before retry
        if (!isLastAttempt) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
  }

  /**
   * Test the API connection
   * @returns {object} Test result
   */
  async testConnection() {
    const startTime = Date.now();
    
    try {
      const pageInfo = await this.makeRequest('GET', `/${this.pageId}`, {
        fields: 'id,name,fan_count,about'
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        duration,
        pageInfo: {
          id: pageInfo.id,
          name: pageInfo.name,
          fanCount: pageInfo.fan_count,
          about: pageInfo.about
        }
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Get page information
   * @returns {object} Page information
   */
  async getPageInfo() {
    return await this.makeRequest('GET', `/${this.pageId}`, {
      fields: 'id,name,fan_count,about,website,phone,emails,location'
    });
  }
}

module.exports = FacebookGraphAPI;