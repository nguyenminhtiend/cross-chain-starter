const logger = require("../utils/logger");

class StateManager {
  constructor() {
    this.processedTransactions = new Set();
    this.pendingTransactions = new Map();
    this.failedTransactions = new Map();
  }

  /**
   * Check if transaction has been processed
   * @param {string} txId - Unique transaction identifier
   * @returns {boolean}
   */
  isProcessed(txId) {
    return this.processedTransactions.has(txId);
  }

  /**
   * Mark transaction as processed
   * @param {string} txId - Unique transaction identifier
   */
  markProcessed(txId) {
    this.processedTransactions.add(txId);
    this.pendingTransactions.delete(txId);

    logger.debug(`Transaction marked as processed: ${txId}`);
  }

  /**
   * Add pending transaction
   * @param {string} txId - Unique transaction identifier
   * @param {Object} data - Transaction data
   */
  addPending(txId, data) {
    this.pendingTransactions.set(txId, {
      ...data,
      timestamp: Date.now()
    });

    logger.debug(`Transaction added to pending: ${txId}`);
  }

  /**
   * Mark transaction as failed
   * @param {string} txId - Unique transaction identifier
   * @param {Error} error - Error object
   */
  markFailed(txId, error) {
    const data = this.pendingTransactions.get(txId) || {};
    this.failedTransactions.set(txId, {
      ...data,
      error: error.message,
      failedAt: Date.now()
    });

    this.pendingTransactions.delete(txId);

    logger.error(`Transaction marked as failed: ${txId}`, {
      error: error.message
    });
  }

  /**
   * Get statistics
   * @returns {Object} State statistics
   */
  getStats() {
    return {
      processed: this.processedTransactions.size,
      pending: this.pendingTransactions.size,
      failed: this.failedTransactions.size
    };
  }

  /**
   * Clear old processed transactions (keep last 1000)
   */
  cleanup() {
    if (this.processedTransactions.size > 1000) {
      const toRemove = this.processedTransactions.size - 1000;
      const iterator = this.processedTransactions.values();

      for (let i = 0; i < toRemove; i++) {
        this.processedTransactions.delete(iterator.next().value);
      }

      logger.info(`Cleaned up ${toRemove} old processed transactions`);
    }
  }
}

module.exports = StateManager;
