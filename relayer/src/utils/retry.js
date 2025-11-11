const logger = require("./logger");

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        {
          error: error.message,
          reason: error.reason,
          code: error.code
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = { retryWithBackoff };
