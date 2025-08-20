const PostGenerator = require('../../src/processors/postGenerator');

describe('PostGenerator', () => {
  let postGenerator;

  beforeEach(() => {
    postGenerator = new PostGenerator();
  });

  describe('generatePost', () => {
    it('should generate a complete Facebook post', () => {
      const article = {
        title: 'New Trucking Technology Announced',
        summary: 'A new technology for trucking automation has been announced.',
        content: 'Major trucking companies are adopting new technology to improve efficiency and safety.',
        url: 'https://example.com/article',
        image_url: 'https://example.com/image.jpg',
        source: 'FreightWaves',
        published_date: new Date().toISOString(),
        engagement_score: 0.8
      };

      const post = postGenerator.generatePost(article);

      expect(post.text).toBeTruthy();
      expect(post.hashtags).toBeInstanceOf(Array);
      expect(post.hashtags.length).toBeGreaterThan(0);
      expect(post.callToAction).toBeTruthy();
      expect(post.article_url).toBe(article.url);
      expect(post.image_url).toBe(article.image_url);
    });

    it('should include relevant hashtags', () => {
      const article = {
        title: 'Electric Trucks and Driver Safety Technology',
        summary: 'New electric trucks feature advanced safety technology.',
        content: 'The trucking industry is embracing electric vehicles with enhanced safety features.',
        url: 'https://example.com/article',
        source: 'Transport Topics',
        published_date: new Date().toISOString(),
        engagement_score: 0.7
      };

      const post = postGenerator.generatePost(article);

      expect(post.hashtags).toContain('#trucking');
      expect(post.hashtags).toContain('#electric');
      expect(post.hashtags).toContain('#safety');
      expect(post.hashtags).toContain('#technology');
    });

    it('should create appropriate call-to-action for different topics', () => {
      const regulationArticle = {
        title: 'New DOT Regulations for Truck Drivers',
        summary: 'Department of Transportation announces new regulations.',
        content: 'New regulations will affect how truck drivers operate.',
        url: 'https://example.com/article',
        source: 'Trucking Info',
        published_date: new Date().toISOString(),
        engagement_score: 0.6
      };

      const post = postGenerator.generatePost(regulationArticle);
      expect(post.callToAction).toContain('regulation');
    });
  });

  describe('createCatchyHeadline', () => {
    it('should add urgency markers for important news', () => {
      const title = 'Driver Shortage Affects Supply Chain';
      const headline = postGenerator.createCatchyHeadline(title);
      
      expect(headline).toContain('🚨');
    });

    it('should add excitement markers for technology news', () => {
      const title = 'Breakthrough Electric Truck Technology';
      const headline = postGenerator.createCatchyHeadline(title);
      
      expect(headline).toContain('🚀');
    });

    it('should remove boring prefixes', () => {
      const title = 'Breaking: Important Trucking News';
      const headline = postGenerator.createCatchyHeadline(title);
      
      expect(headline).not.toContain('Breaking:');
    });
  });

  describe('selectHashtags', () => {
    it('should always include core trucking hashtags', () => {
      const article = {
        title: 'General Industry News',
        summary: 'General trucking industry update.',
        content: 'The trucking industry continues to evolve.',
        source: 'Test Source'
      };

      const hashtags = postGenerator.selectHashtags(article);

      expect(hashtags).toContain('#trucking');
      expect(hashtags).toContain('#logistics');
    });

    it('should limit hashtag count', () => {
      const article = {
        title: 'Electric Autonomous Trucks with Advanced Safety Technology for Freight Transportation',
        summary: 'Electric autonomous trucks with safety tech.',
        content: 'Electric autonomous trucks safety technology freight transportation logistics supply chain.',
        source: 'Test Source'
      };

      const hashtags = postGenerator.selectHashtags(article);

      expect(hashtags.length).toBeLessThanOrEqual(postGenerator.maxHashtags);
    });
  });

  describe('validatePost', () => {
    it('should validate good posts', () => {
      const goodPost = 'This is a great trucking news update about the industry. What are your thoughts on this development? #trucking #logistics';
      const validation = postGenerator.validatePost(goodPost);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should reject posts that are too short', () => {
      const shortPost = 'Short post #trucking';
      const validation = postGenerator.validatePost(shortPost);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Post is too short for good engagement');
    });

    it('should reject posts with excessive caps', () => {
      const capsPost = 'THIS IS A VERY LOUD POST ABOUT TRUCKING NEWS WITH TOO MANY CAPITAL LETTERS #TRUCKING';
      const validation = postGenerator.validatePost(capsPost);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Too many capital letters');
    });
  });
});