const RSSParser = require('rss-parser');
const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');

class RSSFeedScraper {
  constructor() {
    this.parser = new RSSParser({
      timeout: config.get('scraping.timeout', 10000),
      maxRedirects: 3,
      headers: {
        'User-Agent': config.get('scraping.userAgent', 'TruckingNewsBot/1.0')
      }
    });
  }

  /**
   * Scrape articles from RSS feed
   * @param {object} source - Source configuration
   * @returns {array} Array of articles
   */
  async scrapeSource(source) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting RSS scrape', { source: source.name, url: source.url });
      
      const feed = await this.parser.parseURL(source.url);
      const articles = [];
      
      const maxArticles = config.get('content.maxArticlesPerSource', 10);
      const articleAgeHours = config.get('content.articleAgeHours', 24);
      const cutoffDate = new Date(Date.now() - articleAgeHours * 60 * 60 * 1000);
      
      for (const item of feed.items.slice(0, maxArticles)) {
        try {
          const article = await this.processRSSItem(item, source);
          
          // Filter by date
          if (article.published_date < cutoffDate) {
            logger.debug('Article too old, skipping', { 
              title: article.title, 
              published: article.published_date 
            });
            continue;
          }
          
          articles.push(article);
        } catch (error) {
          logger.warn('Failed to process RSS item', { 
            source: source.name, 
            title: item.title,
            error: error.message 
          });
        }
      }
      
      const duration = Date.now() - startTime;
      logger.info('RSS scrape completed', { 
        source: source.name, 
        articles: articles.length, 
        duration: `${duration}ms` 
      });
      
      return articles;
      
    } catch (error) {
      logger.error('RSS scrape failed', { 
        source: source.name, 
        url: source.url, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Process individual RSS item into article format
   * @param {object} item - RSS item
   * @param {object} source - Source configuration
   * @returns {object} Processed article
   */
  async processRSSItem(item, source) {
    const published_date = new Date(item.pubDate || item.isoDate || Date.now());
    
    // Extract image URL from various possible locations
    let image_url = null;
    if (item.enclosure && item.enclosure.url) {
      image_url = item.enclosure.url;
    } else if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
      image_url = item['media:content'].$.url;
    } else if (item.content && item.content.includes('<img')) {
      // Extract first image from content
      const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) {
        image_url = imgMatch[1];
      }
    }
    
    // Clean and truncate content
    const summary = this.extractSummary(item.contentSnippet || item.content || item.summary || '');
    const content = this.cleanContent(item.content || item.contentSnippet || item.summary || '');
    
    // Extract tags/categories
    const tags = [];
    if (item.categories) {
      tags.push(...item.categories);
    }
    if (item['dc:subject']) {
      tags.push(item['dc:subject']);
    }
    
    return {
      url: item.link || item.guid,
      title: this.cleanText(item.title || ''),
      summary,
      content,
      source: source.name,
      published_date: published_date.toISOString(),
      image_url,
      tags: tags.filter(Boolean),
      engagement_score: this.calculateEngagementScore(item, source)
    };
  }

  /**
   * Extract summary from content
   * @param {string} content - Full content
   * @returns {string} Summary text
   */
  extractSummary(content) {
    if (!content) return '';
    
    // Remove HTML tags
    const text = content.replace(/<[^>]*>/g, ' ').trim();
    
    // Get first 2-3 sentences or 150 characters
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2) {
      return sentences.slice(0, 2).join('. ').trim() + '.';
    }
    
    // Fallback to character limit
    if (text.length > 150) {
      return text.substring(0, 147).trim() + '...';
    }
    
    return text;
  }

  /**
   * Clean content by removing HTML and normalizing text
   * @param {string} content - Raw content
   * @returns {string} Cleaned content
   */
  cleanContent(content) {
    if (!content) return '';
    
    return content
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .replace(/&[^;]+;/g, ' ')  // Remove HTML entities
      .trim();
  }

  /**
   * Clean text by removing extra whitespace and special characters
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .trim();
  }

  /**
   * Calculate engagement score based on various factors
   * @param {object} item - RSS item
   * @param {object} source - Source configuration
   * @returns {number} Engagement score (0-1)
   */
  calculateEngagementScore(item, source) {
    let score = 0.5; // Base score
    
    // Source priority bonus
    if (source.priority === 1) {
      score += 0.2;
    } else if (source.priority === 2) {
      score += 0.1;
    }
    
    // Recent articles get higher score
    const published = new Date(item.pubDate || item.isoDate || Date.now());
    const hoursOld = (Date.now() - published.getTime()) / (1000 * 60 * 60);
    if (hoursOld < 2) {
      score += 0.2;
    } else if (hoursOld < 6) {
      score += 0.1;
    }
    
    // Title keywords bonus
    const title = (item.title || '').toLowerCase();
    const highValueKeywords = ['breaking', 'urgent', 'major', 'new', 'update', 'alert'];
    const truckingKeywords = ['truck', 'trucking', 'freight', 'logistics', 'driver', 'transportation'];
    
    highValueKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 0.05;
    });
    
    truckingKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 0.02;
    });
    
    // Image bonus
    if (item.enclosure || (item.content && item.content.includes('<img'))) {
      score += 0.1;
    }
    
    // Content length bonus (not too short, not too long)
    const contentLength = (item.contentSnippet || item.content || '').length;
    if (contentLength > 100 && contentLength < 2000) {
      score += 0.05;
    }
    
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Scrape all enabled RSS sources
   * @returns {array} Array of all articles from all sources
   */
  async scrapeAllSources() {
    const sources = config.get('sources', []).filter(source => 
      source.enabled && source.type === 'rss'
    );
    
    if (sources.length === 0) {
      logger.warn('No enabled RSS sources found');
      return [];
    }
    
    logger.info('Starting RSS scrape for all sources', { sources: sources.length });
    
    const allArticles = [];
    const maxConcurrent = config.get('scraping.maxConcurrent', 3);
    const requestDelay = config.get('scraping.requestDelay', 1000);
    
    // Process sources in batches to respect rate limits
    for (let i = 0; i < sources.length; i += maxConcurrent) {
      const batch = sources.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (source) => {
        try {
          const articles = await this.scrapeSource(source);
          return articles;
        } catch (error) {
          logger.error('Source scrape failed', { 
            source: source.name, 
            error: error.message 
          });
          return [];
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allArticles.push(...result.value);
        } else {
          logger.error('Batch scrape failed', { 
            source: batch[index].name, 
            error: result.reason.message 
          });
        }
      });
      
      // Delay between batches
      if (i + maxConcurrent < sources.length) {
        await new Promise(resolve => setTimeout(resolve, requestDelay));
      }
    }
    
    logger.info('RSS scrape completed for all sources', { 
      sources: sources.length,
      totalArticles: allArticles.length 
    });
    
    return allArticles;
  }
}

module.exports = RSSFeedScraper;

const config = require('../utils/config');
const articleAgeHours = config.get('content.articleAgeHours', 24);

function isRecentArticle(pubDate) {
  const now = new Date();
  const published = new Date(pubDate);
  const ageHours = (now - published) / (1000 * 60 * 60);
  return ageHours <= articleAgeHours;
}

// ...when filtering articles...
const filteredArticles = articles.filter(article => isRecentArticle(article.publishedAt));