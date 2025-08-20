const ContentFilter = require('../../src/processors/contentFilter');

describe('ContentFilter', () => {
  let contentFilter;

  beforeEach(() => {
    contentFilter = new ContentFilter();
  });

  describe('isValidArticle', () => {
    it('should accept valid trucking articles', () => {
      const article = {
        title: 'New Trucking Regulations Announced',
        url: 'https://example.com/article',
        content: 'The Federal Motor Carrier Safety Administration announced new regulations for truck drivers regarding hours of service. This will impact the trucking industry significantly and affect freight transportation operations across the country. The new rules are designed to improve safety and reduce driver fatigue. Companies will need to adjust their logistics operations accordingly.',
        summary: 'New regulations announced for trucking industry.',
        published_date: new Date().toISOString(),
        source: 'Test Source'
      };

      expect(contentFilter.isValidArticle(article)).toBe(true);
    });

    it('should reject articles without required keywords', () => {
      const article = {
        title: 'Cooking Recipe for Dinner',
        url: 'https://example.com/article',
        content: 'Here is a great recipe for making dinner with your family. It involves cooking vegetables and meat together.',
        summary: 'Cooking recipe article.',
        published_date: new Date().toISOString(),
        source: 'Test Source'
      };

      expect(contentFilter.isValidArticle(article)).toBe(false);
    });

    it('should reject articles with spam keywords', () => {
      const article = {
        title: 'Trucking Advertisement Special Sale',
        url: 'https://example.com/article',
        content: 'Buy now and get a discount on trucking equipment! This sponsored post offers great deals on trucks and trailers.',
        summary: 'Advertisement for trucking equipment.',
        published_date: new Date().toISOString(),
        source: 'Test Source'
      };

      expect(contentFilter.isValidArticle(article)).toBe(false);
    });

    it('should reject articles that are too short', () => {
      const article = {
        title: 'Trucking News',
        url: 'https://example.com/article',
        content: 'Short trucking news.',
        summary: 'Short.',
        published_date: new Date().toISOString(),
        source: 'Test Source'
      };

      expect(contentFilter.isValidArticle(article)).toBe(false);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should give higher scores to breaking news', () => {
      const breakingArticle = {
        title: 'Breaking: Major Truck Accident Shuts Down Highway',
        content: 'A major accident involving multiple trucks has shut down Interstate 95.',
        summary: 'Highway shutdown due to truck accident.',
        published_date: new Date().toISOString(),
        engagement_score: 0.5,
        image_url: 'https://example.com/image.jpg'
      };

      const regularArticle = {
        title: 'Truck Maintenance Tips',
        content: 'Here are some tips for maintaining your truck in good condition.',
        summary: 'Truck maintenance tips.',
        published_date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        engagement_score: 0.5,
        image_url: null
      };

      const breakingScore = contentFilter.calculateRelevanceScore(breakingArticle);
      const regularScore = contentFilter.calculateRelevanceScore(regularArticle);

      expect(breakingScore).toBeGreaterThan(regularScore);
    });

    it('should give bonus for recent articles', () => {
      const recentArticle = {
        title: 'Trucking Industry Update',
        content: 'Latest update from the trucking industry regarding new technology.',
        summary: 'Industry update.',
        published_date: new Date().toISOString(), // Now
        engagement_score: 0.5,
        image_url: null
      };

      const oldArticle = {
        title: 'Trucking Industry Update',
        content: 'Latest update from the trucking industry regarding new technology.',
        summary: 'Industry update.',
        published_date: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 20 hours ago
        engagement_score: 0.5,
        image_url: null
      };

      const recentScore = contentFilter.calculateRelevanceScore(recentArticle);
      const oldScore = contentFilter.calculateRelevanceScore(oldArticle);

      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('sortByEngagement', () => {
    it('should sort articles by relevance score', () => {
      const articles = [
        {
          title: 'Regular Trucking News',
          content: 'Regular update about trucking industry.',
          summary: 'Regular news.',
          published_date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          engagement_score: 0.3
        },
        {
          title: 'Breaking: Emergency Trucking Alert',
          content: 'Breaking news about urgent trucking situation.',
          summary: 'Breaking news.',
          published_date: new Date().toISOString(),
          engagement_score: 0.7
        }
      ];

      const sorted = contentFilter.sortByEngagement(articles);

      expect(sorted[0].title).toContain('Breaking');
      expect(sorted[1].title).toContain('Regular');
    });
  });
});