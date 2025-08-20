const logger = require('../utils/logger');

class DuplicateDetector {
  constructor() {
    this.similarityThreshold = 0.7;
    this.titleSimilarityWeight = 0.5;
    this.contentSimilarityWeight = 0.3;
    this.urlSimilarityWeight = 0.2;
  }

  /**
   * Remove duplicate articles from array
   * @param {array} articles - Array of articles
   * @param {array} existingArticles - Previously processed articles for comparison
   * @returns {array} Articles with duplicates removed
   */
  removeDuplicates(articles, existingArticles = []) {
    const startTime = Date.now();
    
    logger.info('Starting duplicate detection', { 
      newArticles: articles.length,
      existingArticles: existingArticles.length 
    });
    
    const allArticles = [...existingArticles, ...articles];
    const duplicates = new Set();
    const urlMap = new Map();
    
    // First pass: exact URL matches
    articles.forEach((article, index) => {
      const normalizedUrl = this.normalizeUrl(article.url);
      
      if (urlMap.has(normalizedUrl)) {
        duplicates.add(index);
        logger.debug('Exact URL duplicate found', { 
          url: article.url,
          title: article.title 
        });
      } else {
        urlMap.set(normalizedUrl, index);
      }
      
      // Check against existing articles
      existingArticles.forEach(existing => {
        if (this.normalizeUrl(existing.url) === normalizedUrl) {
          duplicates.add(index);
          logger.debug('URL duplicate with existing article', { 
            url: article.url,
            title: article.title 
          });
        }
      });
    });
    
    // Second pass: content similarity
    for (let i = 0; i < articles.length; i++) {
      if (duplicates.has(i)) continue;
      
      const articleA = articles[i];
      
      // Compare with other new articles
      for (let j = i + 1; j < articles.length; j++) {
        if (duplicates.has(j)) continue;
        
        const articleB = articles[j];
        const similarity = this.calculateSimilarity(articleA, articleB);
        
        if (similarity >= this.similarityThreshold) {
          // Keep the one with higher engagement score
          if (articleA.engagement_score >= articleB.engagement_score) {
            duplicates.add(j);
          } else {
            duplicates.add(i);
            break; // Article A is duplicate, no need to compare further
          }
          
          logger.debug('Content similarity duplicate found', {
            titleA: articleA.title,
            titleB: articleB.title,
            similarity: similarity.toFixed(3)
          });
        }
      }
      
      // Compare with existing articles
      if (!duplicates.has(i)) {
        existingArticles.forEach(existing => {
          const similarity = this.calculateSimilarity(articleA, existing);
          
          if (similarity >= this.similarityThreshold) {
            duplicates.add(i);
            logger.debug('Content similarity with existing article', {
              newTitle: articleA.title,
              existingTitle: existing.title,
              similarity: similarity.toFixed(3)
            });
          }
        });
      }
    }
    
    // Filter out duplicates
    const unique = articles.filter((_, index) => !duplicates.has(index));
    
    const duration = Date.now() - startTime;
    logger.info('Duplicate detection completed', {
      original: articles.length,
      unique: unique.length,
      duplicates: duplicates.size,
      duration: `${duration}ms`
    });
    
    return unique;
  }

  /**
   * Calculate similarity between two articles
   * @param {object} articleA - First article
   * @param {object} articleB - Second article
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(articleA, articleB) {
    const titleSim = this.calculateTextSimilarity(
      this.normalizeText(articleA.title),
      this.normalizeText(articleB.title)
    );
    
    const contentSim = this.calculateTextSimilarity(
      this.normalizeText(articleA.content || articleA.summary || ''),
      this.normalizeText(articleB.content || articleB.summary || '')
    );
    
    const urlSim = this.calculateUrlSimilarity(articleA.url, articleB.url);
    
    const overallSimilarity = 
      (titleSim * this.titleSimilarityWeight) +
      (contentSim * this.contentSimilarityWeight) +
      (urlSim * this.urlSimilarityWeight);
    
    return overallSimilarity;
  }

  /**
   * Calculate text similarity using Jaccard similarity
   * @param {string} textA - First text
   * @param {string} textB - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateTextSimilarity(textA, textB) {
    if (!textA || !textB) return 0;
    
    const wordsA = new Set(textA.split(/\s+/).filter(word => word.length > 3));
    const wordsB = new Set(textB.split(/\s+/).filter(word => word.length > 3));
    
    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    
    const intersection = new Set([...wordsA].filter(word => wordsB.has(word)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate URL similarity
   * @param {string} urlA - First URL
   * @param {string} urlB - Second URL
   * @returns {number} Similarity score (0-1)
   */
  calculateUrlSimilarity(urlA, urlB) {
    const normalizedA = this.normalizeUrl(urlA);
    const normalizedB = this.normalizeUrl(urlB);
    
    if (normalizedA === normalizedB) return 1;
    
    // Check if one URL is a subset of another (redirects, etc.)
    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
      return 0.8;
    }
    
    // Compare path similarity
    try {
      const pathA = new URL(urlA).pathname;
      const pathB = new URL(urlB).pathname;
      
      const pathSimilarity = this.calculateTextSimilarity(
        pathA.replace(/[^a-z0-9]/gi, ' '),
        pathB.replace(/[^a-z0-9]/gi, ' ')
      );
      
      return pathSimilarity * 0.5; // Reduce weight for path-only similarity
    } catch {
      return 0;
    }
  }

  /**
   * Normalize URL for comparison
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    
    try {
      const parsedUrl = new URL(url);
      
      // Remove common tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'fbclid', 'gclid', 'ref', 'referrer', 'source', 'campaign'
      ];
      
      trackingParams.forEach(param => {
        parsedUrl.searchParams.delete(param);
      });
      
      // Remove fragment
      parsedUrl.hash = '';
      
      // Remove trailing slash
      let pathname = parsedUrl.pathname;
      if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }
      parsedUrl.pathname = pathname;
      
      return parsedUrl.toString().toLowerCase();
    } catch {
      return url.toLowerCase().trim();
    }
  }

  /**
   * Normalize text for comparison
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  /**
   * Group similar articles together
   * @param {array} articles - Articles to group
   * @returns {array} Array of article groups
   */
  groupSimilarArticles(articles) {
    const groups = [];
    const processed = new Set();
    
    articles.forEach((article, index) => {
      if (processed.has(index)) return;
      
      const group = [article];
      processed.add(index);
      
      // Find similar articles
      articles.forEach((other, otherIndex) => {
        if (otherIndex <= index || processed.has(otherIndex)) return;
        
        const similarity = this.calculateSimilarity(article, other);
        if (similarity >= this.similarityThreshold) {
          group.push(other);
          processed.add(otherIndex);
        }
      });
      
      groups.push(group);
    });
    
    return groups;
  }

  /**
   * Find the best article from a group of similar articles
   * @param {array} articleGroup - Group of similar articles
   * @returns {object} Best article from the group
   */
  selectBestFromGroup(articleGroup) {
    if (articleGroup.length === 1) return articleGroup[0];
    
    // Sort by engagement score, then by published date
    return articleGroup.sort((a, b) => {
      if (b.engagement_score !== a.engagement_score) {
        return b.engagement_score - a.engagement_score;
      }
      return new Date(b.published_date) - new Date(a.published_date);
    })[0];
  }

  /**
   * Advanced duplicate removal with grouping
   * @param {array} articles - Articles to process
   * @param {array} existingArticles - Existing articles for comparison
   * @returns {array} Best articles with duplicates removed
   */
  advancedDuplicateRemoval(articles, existingArticles = []) {
    // First remove exact duplicates
    const noDuplicates = this.removeDuplicates(articles, existingArticles);
    
    // Group similar articles
    const groups = this.groupSimilarArticles(noDuplicates);
    
    // Select best from each group
    const bestArticles = groups.map(group => this.selectBestFromGroup(group));
    
    logger.info('Advanced duplicate removal completed', {
      original: articles.length,
      groups: groups.length,
      final: bestArticles.length
    });
    
    return bestArticles;
  }
}

module.exports = DuplicateDetector;