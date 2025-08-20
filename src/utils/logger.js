const winston = require('winston');
const path = require('path');
const fs = require('fs');
const configUtil = require('./config');

// Ensure log directory exists
const logDir = configUtil.get('logging.dir', './logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create logger
const logger = winston.createLogger({
  level: configUtil.get('logging.level', 'info'),
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'trucking-news-forwarder' },
  transports: [
    // Write all logs to `combined.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: configUtil.get('logging.maxSize', '10m'),
      maxFiles: configUtil.get('logging.maxFiles', 7),
      tailable: true
    }),
    // Write all logs with level `error` and below to `error.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: configUtil.get('logging.maxSize', '10m'),
      maxFiles: configUtil.get('logging.maxFiles', 7),
      tailable: true
    }),
  ],
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log info message
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function info(message, meta = {}) {
  logger.info(message, meta);
}

/**
 * Log error message
 * @param {string} message - Log message
 * @param {Error|object} error - Error object or metadata
 */
function error(message, error = {}) {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack });
  } else {
    logger.error(message, error);
  }
}

/**
 * Log warning message
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function warn(message, meta = {}) {
  logger.warn(message, meta);
}

/**
 * Log debug message
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function debug(message, meta = {}) {
  logger.debug(message, meta);
}

/**
 * Create child logger with additional context
 * @param {object} defaultMeta - Default metadata for all logs
 * @returns {object} Child logger
 */
function child(defaultMeta) {
  return logger.child(defaultMeta);
}

module.exports = {
  info,
  error,
  warn,
  debug,
  child,
  logger
};