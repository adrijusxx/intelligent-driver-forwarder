const configUtil = require('../src/utils/config');
const logger = require('../src/utils/logger');
const db = require('../src/database/db');
const FacebookGraphAPI = require('../src/facebook/graphApi');
const PostManager = require('../src/facebook/postManager');
const RSSFeedScraper = require('../src/scrapers/rssFeeds');
const ContentFilter = require('../src/processors/contentFilter');
const DuplicateDetector = require('../src/processors/duplicateDetector');
const PostGenerator = require('../src/processors/postGenerator');

async function runManualPosting() {
  try {
    logger.info('Starting manual news posting process');

    // Initialize components
    await db.init();
    
    const graphApi = new FacebookGraphAPI();
    await graphApi.init();
    
    const postManager = new PostManager(graphApi);
    const scraper = new RSSFeedScraper();
    const contentFilter = new ContentFilter();
    const duplicateDetector = new DuplicateDetector();
    const postGenerator = new PostGenerator();

    // 1. Scrape fresh news
    logger.info('Scraping RSS feeds for fresh news...');
    const articles = await scraper.scrapeAllSources();
    logger.info(`Found ${articles.length} articles`);

    if (articles.length === 0) {
      logger.info('No new articles found');
      return;
    }

    // 2. Filter content
    logger.info('Filtering content...');
    const filteredArticles = await contentFilter.filterArticles(articles);
    logger.info(`${filteredArticles.length} articles passed filtering`);

    // 3. Check for duplicates
    logger.info('Checking for duplicates...');
    const uniqueArticles = await duplicateDetector.removeDuplicates(filteredArticles);
    logger.info(`${uniqueArticles.length} unique articles found`);

    if (uniqueArticles.length === 0) {
      logger.info('No unique articles to post');
      return;
    }

    // 4. Generate and post content
    logger.info('Generating and posting content...');
    let postsCreated = 0;
    
    for (const article of uniqueArticles.slice(0, 3)) { // Limit to 3 posts
      try {
        logger.info(`Processing article: ${article.title}`);
        
        const postContent = await postGenerator.generatePost(article);
        const result = await graphApi.createPost(postContent);
        
        logger.info('Post created successfully', {
          title: article.title,
          postId: result.facebook_post_id
        });
        
        postsCreated++;
        
        // Wait 30 seconds between posts to avoid rate limiting
        if (postsCreated < uniqueArticles.length && postsCreated < 3) {
          logger.info('Waiting 30 seconds before next post...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
        
      } catch (error) {
        logger.error('Failed to create post for article', {
          title: article.title,
          error: error.message
        });
      }
    }

    logger.info(`Manual posting completed. Created ${postsCreated} posts.`);

  } catch (error) {
    logger.error('Manual posting failed', { error: error.message });
    throw error;
  }
}

runManualPosting()
  .then(() => {
    logger.info('Manual posting process completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Manual posting process failed', { error: error.message });
    process.exit(1);
  });
