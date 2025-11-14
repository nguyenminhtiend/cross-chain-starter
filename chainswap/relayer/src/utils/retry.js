const logger = require('./logger');

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }

      const waitTime = delay * Math.pow(2, i);
      logger.warn(`Attempt ${i + 1} failed, retrying in ${waitTime}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

module.exports = { retry };

