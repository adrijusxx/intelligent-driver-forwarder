const FacebookGraphAPI = require('../src/facebook/graphApi');
const logger = require('../src/utils/logger');

async function testFacebookPosting() {
    try {
        logger.info('Starting Facebook posting test');
        
        // Initialize the Facebook API
        const graphApi = new FacebookGraphAPI();
        
        // Initialize and get page access token
        logger.info('Initializing Facebook API');
        await graphApi.init();
        
        // Validate credentials
        logger.info('Validating Facebook credentials');
        await graphApi.getPageInfo();
        
        // Create a test post
        logger.info('Creating test post');
        const result = await graphApi.testPost();
        
        logger.info('Test completed successfully', { result });
        process.exit(0);
    } catch (error) {
        logger.error('Test failed', { 
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Run the test
testFacebookPosting();
