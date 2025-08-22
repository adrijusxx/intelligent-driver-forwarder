const axios = require('axios');
const configUtil = require('../src/utils/config');
const logger = require('../src/utils/logger');

async function checkToken() {
  try {
    const accessToken = configUtil.get('facebook.accessToken');
    const appId = configUtil.get('facebook.appId');
    const appSecret = configUtil.get('facebook.appSecret');
    
    // Debug the token to see what permissions it has
    const debugResponse = await axios.get('https://graph.facebook.com/debug_token', {
      params: {
        input_token: accessToken,
        access_token: `${appId}|${appSecret}`
      }
    });

    console.log('Token Debug Info:');
    console.log(JSON.stringify(debugResponse.data, null, 2));

    // Check what the token can access
    const meResponse = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token: accessToken
      }
    });

    console.log('\nToken "me" response:');
    console.log(JSON.stringify(meResponse.data, null, 2));

  } catch (error) {
    console.error('Error checking token:', error.response?.data || error.message);
  }
}

checkToken();
