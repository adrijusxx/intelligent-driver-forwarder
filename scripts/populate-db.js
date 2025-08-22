const configUtil = require('../src/utils/config');
const logger = require('../src/utils/logger');
const db = require('../src/database/db');
const RSSFeedScraper = require('../src/scrapers/rssFeeds');
const ContentFilter = require('../src/processors/contentFilter');
const DuplicateDetector = require('../src/processors/duplicateDetector');
const { Article } = require('../src/database/models');

async function populateDatabase() {
  try {
    logger.info('Starting database population with articles');

    // Initialize components
    await db.init();
    
    const scraper = new RSSFeedScraper();
    const contentFilter = new ContentFilter();
    const duplicateDetector = new DuplicateDetector();

    // 1. Scrape fresh news
    logger.info('Scraping RSS feeds for articles...');
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
      logger.info('No unique articles to save');
      return;
    }

    // 4. Save articles to database (but don't post them)
    logger.info('Saving articles to database...');
    let savedCount = 0;
    
    for (const article of uniqueArticles) {
      try {
        // Create article object for database
        const articleData = {
          title: article.title,
          url: article.url,
          summary: article.summary || article.description,
          content: article.content || article.description,
          source: article.source,
          publishedAt: article.published_date || article.pubDate,
          imageUrl: article.image_url || article.enclosure?.url,
          tags: JSON.stringify(article.tags || []),
          engagementScore: article.engagement_score || 0.5
        };
        
        await Article.create(articleData);
        savedCount++;
        
        logger.info(`Saved article: ${article.title}`);
        
      } catch (error) {
        logger.error('Failed to save article', {
          title: article.title,
          error: error.message
        });
      }
    }

    logger.info(`Database population completed. Saved ${savedCount} articles.`);

  } catch (error) {
    logger.error('Database population failed', { error: error.message });
    throw error;
  }
}

populateDatabase()
  .then(() => {
    logger.info('Database population process completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Database population process failed', { error: error.message });
    process.exit(1);
  });
