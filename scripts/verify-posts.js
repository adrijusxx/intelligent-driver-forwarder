const axios = require('axios');
const configUtil = require('../src/utils/config');

async function verifyPost() {
  try {
    const FacebookGraphAPI = require('../src/facebook/graphApi');
    const api = new FacebookGraphAPI();
    await api.init();

    // Get recent posts from the page to verify our post exists
    const response = await axios.get(`https://graph.facebook.com/v18.0/${configUtil.get('facebook.pageId')}/posts`, {
      params: {
        access_token: api.pageAccessToken,
        fields: 'id,message,created_time,permalink_url',
        limit: 5
      }
    });

    console.log('Recent posts on the page:');
    response.data.data.forEach((post, index) => {
      console.log(`\n${index + 1}. Post ID: ${post.id}`);
      console.log(`   Created: ${post.created_time}`);
      console.log(`   Message: ${post.message?.substring(0, 100)}...`);
      console.log(`   URL: ${post.permalink_url}`);
    });

  } catch (error) {
    console.error('Error verifying posts:', error.response?.data || error.message);
  }
}

verifyPost();
