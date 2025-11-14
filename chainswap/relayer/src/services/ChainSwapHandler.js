const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { retry } = require('../utils/retry');

/**
 * ChainSwapHandler
 * Handles lock events and executes mint+swap on destination chain
 * Extends the basic bridge relayer with swap functionality
 */
class ChainSwapHandler {
  constructor(sourceChain, destChain, config) {
    this.sourceChain = sourceChain;
    this.destChain = destChain;
    this.config = config;

    // Track processed events to prevent duplicates
    this.processedEvents = new Set();
  }

  /**
   * Handle Lock event from source chain
   * Extended from basic bridge to support swaps
   */
  async handleLockEvent(event) {
    const { from, to, amount, timestamp, nonce, targetToken, targetChain } = event.args;

    const eventId = `${event.transactionHash}-${nonce}`;

    // Check if already processed
    if (this.processedEvents.has(eventId)) {
      logger.info(`Event ${eventId} already processed, skipping`);
      return;
    }

    logger.info(`\n========== Processing Lock Event ==========`);
    logger.info(`Nonce: ${nonce}`);
    logger.info(`From: ${from}`);
    logger.info(`To: ${to}`);
    logger.info(`Amount: ${ethers.utils.formatEther(amount)}`);
    logger.info(`Target Token: ${targetToken}`);
    logger.info(`Target Chain: ${targetChain}`);

    try {
      // Step 1: Verify not already processed on destination
      const processed = await this.destChain.bridge.isProcessed(nonce);
      if (processed) {
        logger.info(`Nonce ${nonce} already processed on destination chain`);
        this.processedEvents.add(eventId);
        return;
      }

      // Step 2: Wait for block finality
      const currentBlock = await this.sourceChain.provider.getBlockNumber();
      const confirmations = currentBlock - event.blockNumber;
      const requiredConfirmations = this.config.requiredConfirmations || 12;

      if (confirmations < requiredConfirmations) {
        logger.info(`Waiting for finality: ${confirmations}/${requiredConfirmations} blocks`);
        return;
      }

      logger.info(`Block finalized with ${confirmations} confirmations`);

      // Step 3: Check if swap is needed
      const needsSwap = targetToken !== ethers.constants.AddressZero;

      if (needsSwap) {
        await this.handleMintAndSwap(to, amount, nonce, targetToken);
      } else {
        await this.handleMint(to, amount, nonce);
      }

      // Mark as processed
      this.processedEvents.add(eventId);
      logger.info(`✓ Event ${eventId} processed successfully\n`);

    } catch (error) {
      logger.error(`Error processing event ${eventId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle regular mint (no swap)
   */
  async handleMint(to, amount, nonce) {
    logger.info(`Executing mint (no swap)...`);

    // Create message hash
    const messageHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'uint256'],
      [to, amount, nonce]
    );

    // Sign message
    const signature = await this.destChain.signer.signMessage(
      ethers.utils.arrayify(messageHash)
    );

    // Execute mint with retry
    await retry(async () => {
      const tx = await this.destChain.bridge.mint(
        to,
        amount,
        nonce,
        signature,
        {
          gasLimit: 300000
        }
      );

      logger.info(`Mint tx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`Mint tx confirmed in block ${receipt.blockNumber}`);

      return receipt;
    });
  }

  /**
   * Handle mint and swap
   */
  async handleMintAndSwap(to, amount, nonce, targetToken) {
    logger.info(`Executing mint and swap...`);

    // Step 1: Get expected swap output
    const expectedOut = await this.getExpectedOutput(amount, targetToken);
    logger.info(`Expected output: ${ethers.utils.formatEther(expectedOut)}`);

    // Step 2: Calculate minimum output with slippage protection
    const slippageBps = this.config.slippageTolerance || 100; // 1% default
    const minOut = expectedOut.mul(10000 - slippageBps).div(10000);
    logger.info(`Min output (${slippageBps/100}% slippage): ${ethers.utils.formatEther(minOut)}`);

    // Step 3: Create message hash with swap parameters
    const messageHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'uint256', 'address', 'uint256'],
      [to, amount, nonce, targetToken, minOut]
    );

    // Step 4: Sign message
    const signature = await this.destChain.signer.signMessage(
      ethers.utils.arrayify(messageHash)
    );

    // Step 5: Execute mint and swap with retry
    await retry(async () => {
      const tx = await this.destChain.bridge.mintAndSwap(
        to,
        amount,
        nonce,
        signature,
        targetToken,
        minOut,
        {
          gasLimit: 500000 // Higher gas for swap
        }
      );

      logger.info(`MintAndSwap tx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`MintAndSwap tx confirmed in block ${receipt.blockNumber}`);

      // Parse events to get actual output
      const swapEvent = receipt.events?.find(e => e.event === 'MintAndSwap');
      if (swapEvent) {
        const actualOut = swapEvent.args.amountOut;
        logger.info(`Actual output: ${ethers.utils.formatEther(actualOut)}`);
      }

      return receipt;
    });
  }

  /**
   * Get expected swap output from Uniswap
   */
  async getExpectedOutput(amountIn, targetToken) {
    try {
      const wrappedToken = await this.destChain.bridge.wrappedToken();

      const expectedOut = await this.destChain.bridge.getExpectedOutput(
        amountIn,
        wrappedToken,
        targetToken
      );

      return expectedOut;
    } catch (error) {
      logger.error(`Error getting expected output: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get processed events count
   */
  getProcessedCount() {
    return this.processedEvents.size;
  }

  /**
   * Clear processed events (for testing)
   */
  clearProcessedEvents() {
    this.processedEvents.clear();
  }
}

module.exports = ChainSwapHandler;

