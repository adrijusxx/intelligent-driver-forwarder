const axios = require('axios');
const configUtil = require('../utils/config');
const logger = require('../utils/logger');

class FacebookGraphAPI {
  constructor() {
    this.userAccessToken = configUtil.get('facebook.accessToken');
    this.pageId = configUtil.get('facebook.pageId');
    this.apiVersion = configUtil.get('facebook.apiVersion', 'v18.0');
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.retryAttempts = configUtil.get('facebook.retryAttempts', 3);
    this.retryDelay = configUtil.get('facebook.retryDelay', 5000);
    this.appId = configUtil.get('facebook.appId');
    this.appSecret = configUtil.get('facebook.appSecret');
    this.pageAccessToken = null;
  }

  async init() {
    try {
      // First, get the page access token using the user access token
      const pageTokenResponse = await axios.get(`https://graph.facebook.com/${this.apiVersion}/${this.pageId}`, {
        params: {
          fields: 'access_token',
          access_token: this.userAccessToken
        }
      });

      if (!pageTokenResponse.data?.access_token) {
        throw new Error('Failed to get page access token');
      }

      this.pageAccessToken = pageTokenResponse.data.access_token;

      // Verify the page token by getting basic page info
      const response = await axios.get(`https://graph.facebook.com/${this.apiVersion}/${this.pageId}`, {
        params: {
          fields: 'name,id',
          access_token: this.pageAccessToken
        }
      });

      if (!response.data?.id) {
        throw new Error('Failed to verify page access token');
      }

      logger.info('Successfully verified page access token', {
        pageName: response.data.name,
        pageId: response.data.id
      });

      logger.info('Successfully obtained page access token');
    } catch (error) {
      logger.error('Failed to initialize Facebook API', { error: error.message });
      throw error;
    }
  }

  updateAccessToken(newToken) {
    this.accessToken = newToken;
    logger.info('Updated Facebook access token');
  }

  async exchangeToken() {
    try {
      // Exchange the current token for a long-lived token
      const longLivedResponse = await axios({
        method: 'GET',
        url: 'https://graph.facebook.com/v18.0/oauth/access_token',
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: this.accessToken
        }
      });

      if (!longLivedResponse.data?.access_token) {
        throw new Error('Failed to get long-lived access token');
      }

      logger.info('Successfully obtained long-lived access token');

      // Get the page access token
      const pageResponse = await axios({
        method: 'GET',
        url: `https://graph.facebook.com/v18.0/${this.pageId}`,
        params: {
          fields: 'access_token',
          access_token: longLivedResponse.data.access_token
        }
      });

      if (!pageResponse.data?.access_token) {
        throw new Error('Failed to get page access token');
      }

      // Get a permanent page access token
      const permanentResponse = await axios({
        method: 'GET',
        url: `https://graph.facebook.com/v18.0/${this.pageId}`,
        params: {
          fields: 'access_token',
          access_token: pageResponse.data.access_token,
          expires: 'never'
        }
      });

      if (!permanentResponse.data?.access_token) {
        throw new Error('Failed to get permanent page access token');
      }

      // Save the permanent token to configuration
      this.accessToken = permanentResponse.data.access_token;
      configUtil.set('facebook.accessToken', permanentResponse.data.access_token);
      
      logger.info('Successfully obtained permanent page access token');
      return permanentResponse.data.access_token;
    } catch (error) {
      logger.error('Failed to exchange Facebook token', {
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Validate Facebook API credentials
   * @returns {boolean} True if credentials are valid
   */
  async validateCredentials() {
    try {
      const pageInfo = await this.getPageInfo();
      logger.info('Facebook credentials validated', { 
        pageId: pageInfo.id, 
        pageName: pageInfo.name 
      });
      return true;
    } catch (error) {
      logger.error('Facebook credential validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get Facebook page information
   * @returns {Promise<Object>} Page information
   */
  async getPageInfo() {
    try {
      const response = await this.makeRequest('GET', `/${this.pageId}`, {
        fields: 'id,name,access_token,fan_count,about,website,phone,emails,location'
      });
      return response;
    } catch (error) {
      logger.error('Failed to get page info', { error: error.message });
      throw error;
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
        textLength: text?.length,
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
    // Use the page's post endpoint with proper version
    const response = await this.makeRequest('POST', `/v18.0/${this.pageId}/feed`, {
      ...postParams,
      published: true, // Ensure the post is published immediately
      access_token: this.pageAccessToken // Use the page access token
    });
    
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

      const response = await this.makeRequest('POST', `/v18.0/${this.pageId}/photos`, {
        ...photoParams,
        published: true,
        access_token: this.accessToken
      });
      
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
    // If endpoint already includes version, use it directly, otherwise prepend baseUrl
    const url = endpoint.startsWith('/v') ? 
      `https://graph.facebook.com${endpoint}` : 
      `${this.baseUrl}${endpoint}`;
      
    // Use page access token for all requests
    const requestParams = {
      ...params,
      access_token: this.pageAccessToken || this.userAccessToken
    };
    
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
          config.params = requestParams;
        } else {
          config.data = requestParams;
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
          // Handle different types of errors
          if (data?.error?.code === 190 || data?.error?.code === 463) {
            // Token expired or invalid - let the calling code handle it
            throw new Error(`Token error (${data.error.code}): ${data.error.message}`);
          } else if (status === 400 || status === 403) {
            // Other client errors - don't retry
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

  async testPost() {
    try {
      const testPost = {
        text: "🚛 Test post from Trucking News Forwarder\n\n" +
              "Testing our automated posting system. This post was created on " +
              new Date().toLocaleString() + "\n\n" +
              "#testing #trucking",
        article_url: "https://github.com/adrijusxx/intelligent-driver-forwarder"
      };

      logger.info('Creating test post', { content: testPost });
      const result = await this.createPost(testPost);
      logger.info('Test post created successfully', { result });
      return result;
    } catch (error) {
      logger.error('Test post failed', { error: error.message });
      throw error;
    }
  }


}

module.exports = FacebookGraphAPI;