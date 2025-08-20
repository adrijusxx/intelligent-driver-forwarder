const configUtil = require('../utils/config');
const logger = require('../utils/logger');

class ContentFilter {
  constructor() {
    this.spamKeywords = configUtil.get('filters.spamKeywords', []);
    this.requiredKeywords = configUtil.get('filters.requiredKeywords', []);
    this.blockedDomains = configUtil.get('filters.blockedDomains', []);
    this.minWordCount = configUtil.get('filters.minWordCount', 50);
  }

  /**
   * Filter articles based on content quality and relevance
   * @param {array} articles - Array of articles to filter
   * @returns {array} Filtered articles
   */
  filterArticles(articles) {
    const startTime = Date.now();
    
    logger.info('Starting content filtering', { articles: articles.length });
    
    const filtered = articles.filter(article => {
      try {
        return this.isValidArticle(article);
      } catch (error) {
        logger.warn('Error filtering article', { 
          title: article.title, 
          error: error.message 
        });
        return false;
      }
    });
    
    const duration = Date.now() - startTime;
    logger.info('Content filtering completed', { 
      original: articles.length,
      filtered: filtered.length,
      removed: articles.length - filtered.length,
      duration: `${duration}ms`
    });
    
    return filtered;
  }

  /**
   * Check if article meets quality and relevance criteria
   * @param {object} article - Article to validate
   * @returns {boolean} True if article is valid
   */
  isValidArticle(article) {
    // Check required fields
    if (!article.title || !article.url || !article.content) {
      logger.debug('Article missing required fields', { url: article.url });
      return false;
    }

    // Check minimum word count
    const wordCount = this.getWordCount(article.content);
    if (wordCount < this.minWordCount) {
      logger.debug('Article too short', { 
        url: article.url, 
        wordCount, 
        required: this.minWordCount 
      });
      return false;
    }

    // Check for spam keywords
    if (this.containsSpamKeywords(article)) {
      logger.debug('Article contains spam keywords', { url: article.url });
      return false;
    }

    // Check for required trucking keywords
    if (!this.containsRequiredKeywords(article)) {
      logger.debug('Article missing required keywords', { url: article.url });
      return false;
    }

    // Check blocked domains
    if (this.isFromBlockedDomain(article.url)) {
      logger.debug('Article from blocked domain', { url: article.url });
      return false;
    }

    // Check content quality
    if (!this.hasGoodContentQuality(article)) {
      logger.debug('Article has poor content quality', { url: article.url });
      return false;
    }

    return true;
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number} Word count
   */
  getWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Check if article contains spam keywords
   * @param {object} article - Article to check
   * @returns {boolean} True if contains spam
   */
  containsSpamKeywords(article) {
    const text = `${article.title} ${article.summary} ${article.content}`.toLowerCase();
    
    return this.spamKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
      return regex.test(text);
    });
  }

  /**
   * Check if article contains required trucking keywords
   * @param {object} article - Article to check
   * @returns {boolean} True if contains required keywords
   */
  containsRequiredKeywords(article) {
    const text = `${article.title} ${article.summary} ${article.content}`.toLowerCase();
    
    return this.requiredKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
      return regex.test(text);
    });
  }

  /**
   * Check if URL is from blocked domain
   * @param {string} url - URL to check
   * @returns {boolean} True if from blocked domain
   */
  isFromBlockedDomain(url) {
    if (!url) return false;
    
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return this.blockedDomains.some(blocked => 
        domain.includes(blocked.toLowerCase())
      );
    } catch (error) {
      logger.warn('Invalid URL format', { url });
      return true; // Block invalid URLs
    }
  }

  /**
   * Check overall content quality
   * @param {object} article - Article to check
   * @returns {boolean} True if good quality
   */
  hasGoodContentQuality(article) {
    // Check title quality
    if (article.title.length < 10 || article.title.length > 200) {
      return false;
    }

    // Check for excessive caps
    const capsRatio = (article.title.match(/[A-Z]/g) || []).length / article.title.length;
    if (capsRatio > 0.5) {
      return false;
    }

    // Check for excessive punctuation
    const punctuationRatio = (article.title.match(/[!?]{2,}/g) || []).length;
    if (punctuationRatio > 0) {
      return false;
    }

    // Check content diversity (not just repeated phrases)
    const sentences = article.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 3) {
      return false;
    }

    // Check for reasonable sentence length
    const avgSentenceLength = sentences.reduce((sum, sentence) => {
      return sum + sentence.trim().split(/\s+/).length;
    }, 0) / sentences.length;
    
    if (avgSentenceLength < 5 || avgSentenceLength > 50) {
      return false;
    }

    return true;
  }

  /**
   * Rate article relevance and engagement potential
   * @param {object} article - Article to rate
   * @returns {number} Relevance score (0-1)
   */
  calculateRelevanceScore(article) {
    let score = 0.5; // Base score

    const title = article.title.toLowerCase();
    const content = `${article.summary} ${article.content}`.toLowerCase();

    // High-value trucking keywords
    const highValueKeywords = [
      'freight rates', 'truck driver shortage', 'supply chain', 'logistics',
      'transportation technology', 'autonomous trucks', 'electric trucks',
      'trucking regulations', 'fuel prices', 'truck safety'
    ];

    // Industry-specific terms
    const industryTerms = [
      'ltl', 'ftl', 'intermodal', 'drayage', 'cross-docking',
      'eld', 'dot', 'fmcsa', 'hours of service', 'cdl'
    ];

    // Breaking news indicators
    const breakingIndicators = [
      'breaking', 'urgent', 'just in', 'developing', 'alert',
      'emergency', 'accident', 'crash', 'shutdown'
    ];

    // Score based on keyword presence
    highValueKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 0.1;
      if (content.includes(keyword)) score += 0.05;
    });

    industryTerms.forEach(term => {
      if (title.includes(term)) score += 0.05;
      if (content.includes(term)) score += 0.02;
    });

    breakingIndicators.forEach(indicator => {
      if (title.includes(indicator)) score += 0.15;
    });

    // Recency bonus
    const published = new Date(article.published_date);
    const hoursOld = (Date.now() - published.getTime()) / (1000 * 60 * 60);
    
    if (hoursOld < 1) score += 0.2;
    else if (hoursOld < 6) score += 0.1;
    else if (hoursOld < 12) score += 0.05;

    // Image bonus
    if (article.image_url) score += 0.1;

    // Source credibility bonus (already factored in engagement_score)
    score += article.engagement_score * 0.2;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Sort articles by engagement potential
   * @param {array} articles - Articles to sort
   * @returns {array} Sorted articles
   */
  sortByEngagement(articles) {
    return articles
      .map(article => ({
        ...article,
        relevance_score: this.calculateRelevanceScore(article)
      }))
      .sort((a, b) => {
        // Primary sort: relevance score
        if (b.relevance_score !== a.relevance_score) {
          return b.relevance_score - a.relevance_score;
        }
        
        // Secondary sort: engagement score
        if (b.engagement_score !== a.engagement_score) {
          return b.engagement_score - a.engagement_score;
        }
        
        // Tertiary sort: published date (newer first)
        return new Date(b.published_date) - new Date(a.published_date);
      });
  }
}

module.exports = ContentFilter;