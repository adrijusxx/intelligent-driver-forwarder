#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logger = require('../src/utils/logger');
const db = require('../src/database/db');

/**
 * Interactive setup script for the Trucking News Forwarder
 */
class SetupWizard {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Ask a question and get user input
   */
  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  /**
   * Run the complete setup process
   */
  async run() {
    console.log('🚛 Welcome to Trucking News Forwarder Setup Wizard\n');
    
    try {
      // Check if .env file exists
      const envPath = path.join(process.cwd(), '.env');
      const envExists = fs.existsSync(envPath);
      
      if (envExists) {
        const overwrite = await this.question('❓ .env file already exists. Do you want to overwrite it? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
          console.log('✅ Setup cancelled. Using existing .env file.');
          this.rl.close();
          return;
        }
      }

      // Collect configuration
      const config = await this.collectConfiguration();
      
      // Write .env file
      await this.writeEnvFile(config);
      
      // Initialize database
      await this.initializeDatabase();
      
      // Test Facebook connection
      await this.testFacebookConnection(config);
      
      console.log('\n🎉 Setup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Run: npm start');
      console.log('2. Visit: http://localhost:' + (config.PORT || 3000) + '/health');
      console.log('3. Check logs in the ./logs directory');
      console.log('\n📖 For more information, see the README.md file');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Collect configuration from user
   */
  async collectConfiguration() {
    console.log('📝 Please provide the following configuration:\n');
    
    const config = {};
    
    // Basic settings
    console.log('--- Basic Settings ---');
    config.NODE_ENV = await this.question('Environment (development/production) [development]: ') || 'development';
    config.PORT = await this.question('Port number [3000]: ') || '3000';
    
    // Facebook API settings
    console.log('\n--- Facebook API Settings ---');
    console.log('ℹ️  You need a Facebook App and Page Access Token');
    console.log('📖 See: https://developers.facebook.com/docs/facebook-login/access-tokens/');
    
    config.FACEBOOK_PAGE_ID = await this.question('Facebook Page ID: ');
    config.FACEBOOK_ACCESS_TOKEN = await this.question('Facebook Page Access Token: ');
    config.FACEBOOK_APP_ID = await this.question('Facebook App ID (optional): ') || '';
    config.FACEBOOK_APP_SECRET = await this.question('Facebook App Secret (optional): ') || '';
    
    // Database settings
    console.log('\n--- Database Settings ---');
    config.DATABASE_PATH = await this.question('Database file path [./data/articles.db]: ') || './data/articles.db';
    
    // Logging settings
    console.log('\n--- Logging Settings ---');
    config.LOG_LEVEL = await this.question('Log level (error/warn/info/debug) [info]: ') || 'info';
    config.LOG_DIR = await this.question('Log directory [./logs]: ') || './logs';
    
    // Content settings
    console.log('\n--- Content Settings ---');
    config.MAX_ARTICLES_PER_SOURCE = await this.question('Max articles per source [10]: ') || '10';
    config.ARTICLE_AGE_HOURS = await this.question('Maximum article age in hours [24]: ') || '24';
    config.MIN_ENGAGEMENT_SCORE = await this.question('Minimum engagement score (0-1) [0.7]: ') || '0.7';
    
    return config;
  }

  /**
   * Write configuration to .env file
   */
  async writeEnvFile(config) {
    console.log('\n💾 Writing configuration to .env file...');
    
    const envContent = `# Trucking News Forwarder Configuration
# Generated on ${new Date().toISOString()}

# Environment Configuration
NODE_ENV=${config.NODE_ENV}
PORT=${config.PORT}

# Facebook API Configuration
FACEBOOK_PAGE_ID=${config.FACEBOOK_PAGE_ID}
FACEBOOK_ACCESS_TOKEN=${config.FACEBOOK_ACCESS_TOKEN}
FACEBOOK_APP_ID=${config.FACEBOOK_APP_ID}
FACEBOOK_APP_SECRET=${config.FACEBOOK_APP_SECRET}

# Database Configuration
DATABASE_PATH=${config.DATABASE_PATH}

# Logging Configuration
LOG_LEVEL=${config.LOG_LEVEL}
LOG_DIR=${config.LOG_DIR}

# Scheduling Configuration (24-hour format, timezone: America/New_York)
SCHEDULE_MORNING=0 8 * * *
SCHEDULE_AFTERNOON=0 13 * * *
SCHEDULE_EVENING=0 18 * * *

# News Sources Configuration
MAX_ARTICLES_PER_SOURCE=${config.MAX_ARTICLES_PER_SOURCE}
ARTICLE_AGE_HOURS=${config.ARTICLE_AGE_HOURS}
MIN_ENGAGEMENT_SCORE=${config.MIN_ENGAGEMENT_SCORE}

# Content Filtering
SPAM_KEYWORDS=advertisement,sponsored,promotion,sale
REQUIRED_KEYWORDS=truck,trucking,freight,logistics,transportation,shipping,driver
`;

    const envPath = path.join(process.cwd(), '.env');
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ Configuration saved to .env file');
  }

  /**
   * Initialize database
   */
  async initializeDatabase() {
    console.log('\n🗄️  Initializing database...');
    
    try {
      await db.init();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Test Facebook connection
   */
  async testFacebookConnection(config) {
    console.log('\n🔗 Testing Facebook API connection...');
    
    try {
      // Set temporary environment variables for testing
      process.env.FACEBOOK_PAGE_ID = config.FACEBOOK_PAGE_ID;
      process.env.FACEBOOK_ACCESS_TOKEN = config.FACEBOOK_ACCESS_TOKEN;
      
      const PostManager = require('../src/facebook/postManager');
      const postManager = new PostManager();
      
      const result = await postManager.testConnection();
      
      if (result.success) {
        console.log('✅ Facebook API connection successful');
        console.log(`📄 Page: ${result.pageInfo.name} (${result.pageInfo.fanCount} followers)`);
      } else {
        console.log('⚠️  Facebook API connection failed:', result.error);
        console.log('💡 The application will still work, but won\'t be able to post to Facebook');
      }
    } catch (error) {
      console.log('⚠️  Could not test Facebook connection:', error.message);
      console.log('💡 You can test it later using: npm run test-facebook');
    }
  }
}

// Run setup if script is executed directly
if (require.main === module) {
  const wizard = new SetupWizard();
  wizard.run();
}

module.exports = SetupWizard;