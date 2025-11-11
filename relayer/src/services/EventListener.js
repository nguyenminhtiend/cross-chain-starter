const { ethers } = require("ethers");
const logger = require("../utils/logger");

class EventListener {
  constructor(provider, contract, eventName, callback, pollingInterval = 5000) {
    this.provider = provider;
    this.contract = contract;
    this.eventName = eventName;
    this.callback = callback;
    this.isListening = false;
    this.pollingInterval = pollingInterval;
    this.lastBlock = null;
    this.pollTimer = null;
  }

  async start() {
    if (this.isListening) {
      logger.warn(`Already listening to ${this.eventName} events`);
      return;
    }

    this.isListening = true;

    // Get current block number
    this.lastBlock = await this.provider.getBlockNumber();
    logger.info(`Starting event listener for ${this.eventName} from block ${this.lastBlock}`);

    // Start polling for events
    this.poll();

    logger.info(`Started listening to ${this.eventName} events (polling every ${this.pollingInterval}ms)`);
  }

  async poll() {
    if (!this.isListening) {
      return;
    }

    try {
      const currentBlock = await this.provider.getBlockNumber();

      if (currentBlock > this.lastBlock) {
        // Query for events in the new blocks
        const eventFilter = this.contract.filters[this.eventName]();
        const events = await this.contract.queryFilter(
          eventFilter,
          this.lastBlock + 1,
          currentBlock
        );

        // Process each event
        for (const event of events) {
          try {
            // Extract event arguments
            // event.args is an array-like object with both indexed and named properties
            const args = [];
            for (let i = 0; i < event.args.length; i++) {
              args.push(event.args[i]);
            }
            // Add the event object as the last argument
            args.push(event);

            await this.callback(...args);
          } catch (error) {
            logger.error(`Error processing ${this.eventName} event:`, {
              error: error.message,
              stack: error.stack,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash
            });
          }
        }

        this.lastBlock = currentBlock;
      }
    } catch (error) {
      logger.error(`Error polling for ${this.eventName} events:`, {
        error: error.message,
        stack: error.stack
      });
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.pollingInterval);
  }

  stop() {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    logger.info(`Stopped listening to ${this.eventName} events`);
  }
}

module.exports = EventListener;
