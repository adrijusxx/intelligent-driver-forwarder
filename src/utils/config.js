const config = require('config');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Configuration file paths
const CONFIG_FILE = path.resolve(__dirname, '../../config/default.json');

/**
 * Get configuration value with environment variable override
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Configuration value
 */
function get(key, defaultValue = null) {
  // Try environment variable first (convert dots to underscores and uppercase)
  const envKey = key.replace(/\./g, '_').toUpperCase();
  const envValue = process.env[envKey];
  
  if (envValue !== undefined) {
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(envValue);
    } catch {
      return envValue;
    }
  }
  
  // Fallback to config file
  try {
    return config.get(key);
  } catch {
    return defaultValue;
  }
}

/**
 * Validate required configuration
 */
function validateConfig() {
  const required = [
    'facebook.pageId',
    'facebook.accessToken'
  ];
  
  const missing = required.filter(key => !get(key));
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

/**
 * Get all configuration as object
 */
function getAll() {
  return {
    app: {
      name: get('app.name'),
      port: get('app.port'),
      timezone: get('app.timezone')
    },
    database: {
      path: path.resolve(get('database.path')),
      backupPath: path.resolve(get('database.backupPath'))
    },
    logging: get('logging'),
    facebook: {
      apiVersion: get('facebook.apiVersion'),
      pageId: get('facebook.pageId'),
      accessToken: get('facebook.accessToken'),
      retryAttempts: get('facebook.retryAttempts'),
      retryDelay: get('facebook.retryDelay')
    },
    scraping: get('scraping'),
    content: get('content'),
    sources: get('sources'),
    hashtags: get('hashtags'),
    filters: get('filters'),
    schedule: get('schedule')
  };
}

/**
 * Set configuration value and persist to file
 * @param {string} key - Configuration key
 * @param {*} value - Value to set
 */
function set(key, value) {
  try {
    // Read current config
    const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    // Update the value using the key path
    const keyParts = key.split('.');
    let current = configData;
    
    for (let i = 0; i < keyParts.length - 1; i++) {
      if (!current[keyParts[i]]) {
        current[keyParts[i]] = {};
      }
      current = current[keyParts[i]];
    }
    
    current[keyParts[keyParts.length - 1]] = value;

    // Write back to file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2));
    
    // Update runtime config
    process.env[key.replace(/\./g, '_').toUpperCase()] = value;
    
    console.log(`Configuration updated successfully: ${key}`);
  } catch (error) {
    console.error(`Failed to update configuration: ${key}`, error);
    throw error;
  }
}

module.exports = {
  get,
  set,
  getAll,
  validateConfig
};