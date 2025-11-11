const { ethers } = require("ethers");
const logger = require("../utils/logger");
const { retryWithBackoff } = require("../utils/retry");

class TransactionExecutor {
  constructor(wallet, contract) {
    this.wallet = wallet;
    this.contract = contract;
  }

  /**
   * Execute a transaction with retry logic
   * @param {string} functionName - Contract function to call
   * @param {Array} args - Function arguments
   * @param {Object} options - Transaction options
   * @returns {Promise<Object>} Transaction receipt
   */
  async execute(functionName, args, options = {}) {
    const executeFn = async () => {
      logger.info(`Executing ${functionName}...`);

      try {
        // Send transaction
        const tx = await this.contract[functionName](...args, {
          gasLimit: options.gasLimit || 200000,
          ...options
        });

        logger.info(`Transaction sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();

        logger.info(`Transaction confirmed in block ${receipt.blockNumber}`, {
          hash: tx.hash,
          gasUsed: receipt.gasUsed.toString()
        });

        return receipt;
      } catch (error) {
        logger.error(`Transaction ${functionName} failed:`, {
          error: error.message,
          reason: error.reason,
          code: error.code,
          method: error.method,
          transaction: error.transaction
        });
        throw error;
      }
    };

    return retryWithBackoff(executeFn, 3, 2000);
  }

  /**
   * Create signature for transaction authorization
   * @param {string} to - Recipient address
   * @param {BigNumber} amount - Amount
   * @param {number} nonce - Transaction nonce
   * @returns {Promise<string>} Signature
   */
  async createSignature(to, amount, nonce) {
    const message = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [to, amount, nonce]
    );

    const signature = await this.wallet.signMessage(ethers.getBytes(message));

    return signature;
  }
}

module.exports = TransactionExecutor;
