const configUtil = require('../utils/config');
const logger = require('../utils/logger');

class PostGenerator {
  constructor() {
    this.maxPostLength = configUtil.get('content.maxPostLength', 280);
    this.maxHashtags = configUtil.get('content.maxHashtags', 8);
    this.hashtags = configUtil.get('hashtags', []);
  }

  /**
   * Generate engaging Facebook post text from article
   * @param {object} article - Article to create post from
   * @returns {object} Post data with text, hashtags, and metadata
   */
  generatePost(article) {
    try {
      const postText = this.createPostText(article);
      const hashtags = this.selectHashtags(article);
      const callToAction = this.generateCallToAction(article);
      
      const fullText = this.assemblePost(postText, hashtags, callToAction);
      
      return {
        text: fullText,
        hashtags,
        callToAction,
        article_url: article.url,
        image_url: article.image_url,
        scheduled_time: null, // To be set by scheduler
        metadata: {
          source: article.source,
          published_date: article.published_date,
          engagement_score: article.engagement_score,
          relevance_score: article.relevance_score
        }
      };
    } catch (error) {
      logger.error('Failed to generate post', { 
        article: article.title, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create the main post text with catchy headline and summary
   * @param {object} article - Article data
   * @returns {string} Post text
   */
  createPostText(article) {
    const headline = this.createCatchyHeadline(article.title);
    const summary = this.createSummary(article);
    
    return `${headline}\n\n${summary}`;
  }

  /**
   * Create a catchy headline from article title
   * @param {string} title - Original article title
   * @returns {string} Catchy headline
   */
  createCatchyHeadline(title) {
    if (!title) return '';
    
    // Remove common boring prefixes
    let headline = title
      .replace(/^(Breaking:|Update:|News:|Alert:)\s*/i, '')
      .trim();
    
    // Add urgency/interest markers for certain topics
    const urgentKeywords = ['shortage', 'increase', 'decrease', 'new regulation', 'accident', 'shutdown'];
    const excitingKeywords = ['technology', 'innovation', 'electric', 'autonomous', 'breakthrough'];
    
    const lowerTitle = headline.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerTitle.includes(keyword))) {
      if (!headline.startsWith('🚨')) {
        headline = `🚨 ${headline}`;
      }
    } else if (excitingKeywords.some(keyword => lowerTitle.includes(keyword))) {
      if (!headline.startsWith('🚀')) {
        headline = `🚀 ${headline}`;
      }
    }
    
    // Ensure it's not too long
    if (headline.length > 100) {
      headline = headline.substring(0, 97) + '...';
    }
    
    return headline;
  }

  /**
   * Create a summary from article content
   * @param {object} article - Article data
   * @returns {string} Summary text
   */
  createSummary(article) {
    let summary = article.summary || '';
    
    if (!summary && article.content) {
      // Extract first few sentences from content
      const sentences = article.content
        .split(/[.!?]+/)
        .filter(s => s.trim().length > 20)
        .slice(0, 2);
      
      summary = sentences.join('. ').trim();
      if (summary && !summary.endsWith('.')) {
        summary += '.';
      }
    }
    
    // Fallback to article title expansion
    if (!summary) {
      summary = `Learn more about this important development in the trucking industry.`;
    }
    
    // Ensure summary is appropriate length
    if (summary.length > 150) {
      summary = summary.substring(0, 147) + '...';
    }
    
    return summary;
  }

  /**
   * Select relevant hashtags for the article
   * @param {object} article - Article data
   * @returns {array} Selected hashtags
   */
  selectHashtags(article) {
    const selectedTags = new Set();
    const text = `${article.title} ${article.summary} ${article.content}`.toLowerCase();
    
    // Always include core trucking hashtags
    selectedTags.add('#trucking');
    selectedTags.add('#logistics');
    
    // Add hashtags based on content
    const hashtagMappings = {
      '#transportation': ['transport', 'transportation', 'shipping'],
      '#freight': ['freight', 'cargo', 'load'],
      '#truckdriver': ['driver', 'drivers', 'driving'],
      '#supplychain': ['supply chain', 'supply-chain', 'distribution'],
      '#truckingindustry': ['industry', 'commercial', 'business'],
      '#technology': ['technology', 'tech', 'innovation', 'digital'],
      '#safety': ['safety', 'accident', 'crash', 'secure'],
      '#regulation': ['regulation', 'regulatory', 'compliance', 'law'],
      '#fuel': ['fuel', 'gas', 'diesel', 'energy'],
      '#electric': ['electric', 'ev', 'battery', 'clean energy'],
      '#autonomous': ['autonomous', 'self-driving', 'automated'],
      '#rates': ['rates', 'pricing', 'cost', 'economic'],
      '#shortage': ['shortage', 'demand', 'shortage'],
    };
    
    Object.entries(hashtagMappings).forEach(([hashtag, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        selectedTags.add(hashtag);
      }
    });
    
    // Add source-specific hashtags
    if (article.source) {
      const sourceTag = `#${article.source.replace(/\s+/g, '').toLowerCase()}`;
      if (sourceTag.length <= 20) {
        selectedTags.add(sourceTag);
      }
    }
    
    // Convert to array and limit count
    const tagsArray = Array.from(selectedTags).slice(0, this.maxHashtags);
    
    return tagsArray;
  }

  /**
   * Generate call-to-action text
   * @param {object} article - Article data
   * @returns {string} Call-to-action text
   */
  generateCallToAction(article) {
    const ctas = [
      "What are your thoughts on this development?",
      "How do you think this will impact the industry?",
      "Share your experience in the comments below!",
      "What's your take on this trucking news?",
      "Drop a comment with your thoughts!",
      "Have you experienced something similar?",
      "What does this mean for truckers and logistics?",
      "Let us know your opinion in the comments!"
    ];
    
    // Select CTA based on article content
    const text = `${article.title} ${article.summary}`.toLowerCase();
    
    if (text.includes('regulation') || text.includes('law')) {
      return "How will these regulations affect your operations?";
    } else if (text.includes('technology') || text.includes('innovation')) {
      return "Are you excited about this new technology?";
    } else if (text.includes('shortage') || text.includes('hiring')) {
      return "How has this shortage impacted your business?";
    } else if (text.includes('accident') || text.includes('safety')) {
      return "Stay safe out there! What safety tips would you add?";
    } else if (text.includes('rates') || text.includes('cost')) {
      return "How are these changes affecting your bottom line?";
    }
    
    // Random selection for general articles
    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  /**
   * Assemble the final post with text, hashtags, and CTA
   * @param {string} postText - Main post content
   * @param {array} hashtags - Selected hashtags
   * @param {string} callToAction - Call-to-action text
   * @returns {string} Complete post text
   */
  assemblePost(postText, hashtags, callToAction) {
    let fullPost = postText;
    
    // Add call-to-action
    if (callToAction) {
      fullPost += `\n\n${callToAction}`;
    }
    
    // Add hashtags
    if (hashtags.length > 0) {
      fullPost += `\n\n${hashtags.join(' ')}`;
    }
    
    // Ensure post doesn't exceed length limit
    if (fullPost.length > this.maxPostLength) {
      // Trim from the summary part, keeping headline and hashtags
      const lines = fullPost.split('\n');
      const headline = lines[0];
      const hashtagLine = lines[lines.length - 1];
      
      const availableLength = this.maxPostLength - headline.length - hashtagLine.length - 10; // Buffer for newlines
      
      let summary = lines.slice(1, -2).join('\n').trim();
      if (summary.length > availableLength) {
        summary = summary.substring(0, availableLength - 3) + '...';
      }
      
      fullPost = `${headline}\n\n${summary}\n\n${callToAction}\n\n${hashtagLine}`;
    }
    
    return fullPost.trim();
  }

  /**
   * Generate multiple post variations for A/B testing
   * @param {object} article - Article data
   * @param {number} count - Number of variations to generate
   * @returns {array} Array of post variations
   */
  generateVariations(article, count = 3) {
    const variations = [];
    
    for (let i = 0; i < count; i++) {
      // Vary the approach for each version
      const originalGenerator = { ...this };
      
      if (i === 1) {
        // Version 2: More casual tone
        this.maxPostLength = Math.max(200, this.maxPostLength - 50);
      } else if (i === 2) {
        // Version 3: More formal tone
        this.maxHashtags = Math.max(3, this.maxHashtags - 2);
      }
      
      try {
        const variation = this.generatePost(article);
        variation.version = i + 1;
        variations.push(variation);
      } catch (error) {
        logger.warn('Failed to generate post variation', { 
          article: article.title, 
          version: i + 1, 
          error: error.message 
        });
      }
      
      // Restore original settings
      Object.assign(this, originalGenerator);
    }
    
    return variations;
  }

  /**
   * Validate post content before publishing
   * @param {string} postText - Post text to validate
   * @returns {object} Validation result
   */
  validatePost(postText) {
    const issues = [];
    
    if (!postText || postText.trim().length === 0) {
      issues.push('Post text is empty');
    }
    
    if (postText.length > this.maxPostLength) {
      issues.push(`Post exceeds maximum length of ${this.maxPostLength} characters`);
    }
    
    if (postText.length < 50) {
      issues.push('Post is too short for good engagement');
    }
    
    // Check for excessive caps
    const capsRatio = (postText.match(/[A-Z]/g) || []).length / postText.length;
    if (capsRatio > 0.3) {
      issues.push('Too many capital letters');
    }
    
    // Check for excessive punctuation
    if (postText.match(/[!?]{3,}/)) {
      issues.push('Excessive punctuation detected');
    }
    
    // Check for spam-like content
    const spamPatterns = [
      /click\s+here/i,
      /buy\s+now/i,
      /limited\s+time/i,
      /act\s+fast/i
    ];
    
    if (spamPatterns.some(pattern => pattern.test(postText))) {
      issues.push('Content may appear spam-like');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      score: Math.max(0, 1 - (issues.length * 0.2))
    };
  }
}

module.exports = PostGenerator;