/**
 * Stellar Event Monitor
 * Monitors Stellar for wETH burn events (payments to issuer)
 * Triggers unlock of ETH on Ethereum
 */

const StellarSdk = require('@stellar/stellar-sdk');
const { ethers } = require('ethers');
const { config } = require('../config');

class StellarMonitor {
  constructor(bridgeContract, validatorWallet) {
    this.server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
    this.issuerPublicKey = config.stellar.issuerPublic;
    this.bridge = bridgeContract;
    this.validator = validatorWallet;

    this.processedBurns = new Set();
    this.isRunning = false;
  }

  /**
   * Start monitoring Stellar for burn events
   */
  async start() {
    console.log('🔍 Stellar Monitor Started');
    console.log('   Issuer Address:', this.issuerPublicKey);
    console.log('   Asset:', config.bridge.assetCode);
    console.log('   Monitoring for burn events...\n');

    this.isRunning = true;

    try {
      // Stream payments to the issuer (burns)
      const paymentsStream = this.server
        .payments()
        .forAccount(this.issuerPublicKey)
        .cursor('now')
        .stream({
          onmessage: async (payment) => {
            await this.handlePayment(payment);
          },
          onerror: (error) => {
            console.error('⚠️  Stream error:', error);
            // Implement reconnection logic
            if (this.isRunning) {
              console.log('🔄 Reconnecting in 5 seconds...');
              setTimeout(() => this.start(), 5000);
            }
          },
        });

      this.stream = paymentsStream;
      console.log('✅ Monitor is running. Press Ctrl+C to stop.\n');

    } catch (error) {
      console.error('❌ Failed to start monitor:', error.message);
      throw error;
    }
  }

  /**
   * Handle payment operations
   */
  async handlePayment(payment) {
    try {
      // Only process payments (burns) sent TO the issuer
      if (payment.type !== 'payment' || payment.to !== this.issuerPublicKey) {
        return;
      }

      // Check if it's wETH
      if (payment.asset_code !== config.bridge.assetCode ||
          payment.asset_issuer !== this.issuerPublicKey) {
        return;
      }

      // Prevent duplicate processing
      if (this.processedBurns.has(payment.id)) {
        return;
      }

      console.log('\n🔥 Burn Event Detected!');
      console.log('─'.repeat(50));
      console.log('   From:', payment.from);
      console.log('   Amount:', payment.amount, config.bridge.assetCode);
      console.log('   TX Hash:', payment.transaction_hash);

      await this.handleBurn(payment);
      this.processedBurns.add(payment.id);

    } catch (error) {
      console.error('❌ Error handling payment:', error.message);
    }
  }

  /**
   * Process burn event and trigger unlock on Ethereum
   */
  async handleBurn(payment) {
    try {
      // Get full transaction details
      const transaction = await this.server
        .transactions()
        .transaction(payment.transaction_hash)
        .call();

      // Extract ETH address from memo
      let ethAddress;
      if (transaction.memo_type === 'text' && transaction.memo) {
        ethAddress = transaction.memo;
      } else {
        console.error('❌ No ETH address in transaction memo');
        console.log('   Transaction must include ETH address in memo field');
        return;
      }

      // Validate ETH address
      if (!ethers.isAddress(ethAddress)) {
        console.error('❌ Invalid Ethereum address in memo:', ethAddress);
        return;
      }

      console.log('   ETH Address:', ethAddress);

      // Convert wETH amount to Wei
      const amount = ethers.parseEther(payment.amount);

      console.log('\n🔓 Requesting ETH unlock on Ethereum...');
      console.log('   Amount:', payment.amount, 'ETH');
      console.log('   Recipient:', ethAddress);

      // Create unlock request ID
      const requestId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'address', 'uint256'],
          [ethers.zeroPadValue(ethers.toUtf8Bytes(payment.transaction_hash.slice(0, 32)), 32),
           ethAddress,
           amount]
        )
      );

      console.log('   Request ID:', requestId);

      // Check if already processed on Ethereum
      const existingRequest = await this.bridge.getUnlockRequest(requestId);
      if (existingRequest.executed) {
        console.log('✅ Unlock already executed on Ethereum');
        return;
      }

      // Validator approves the unlock
      const stellarTxHashBytes = ethers.zeroPadValue(
        ethers.toUtf8Bytes(payment.transaction_hash.slice(0, 32)),
        32
      );

      const tx = await this.bridge.approveUnlock(
        requestId,
        ethAddress,
        amount,
        stellarTxHashBytes,
        {
          gasLimit: 500000,
        }
      );

      console.log('   TX sent:', tx.hash);
      console.log('   Waiting for confirmation...');

      const receipt = await tx.wait();

      console.log('✅ Unlock Approved by Validator!');
      console.log('   Block:', receipt.blockNumber);
      console.log('   Gas Used:', receipt.gasUsed.toString());

      // Check unlock status
      const updatedRequest = await this.bridge.getUnlockRequest(requestId);
      console.log('   Approvals:', updatedRequest.approvals.toString(), '/', config.ethereum.requiredApprovals);

      if (updatedRequest.executed) {
        console.log('✅ ETH Unlocked Successfully!');
        console.log(`   View on Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
      } else {
        console.log('⏳ Waiting for more validator approvals...\n');
      }

    } catch (error) {
      console.error('❌ Unlock Error:', error.message);
      if (error.data) {
        console.error('   Error data:', error.data);
      }
      if (error.reason) {
        console.error('   Reason:', error.reason);
      }
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    if (this.stream) {
      this.stream();
    }
    console.log('\n🛑 Stellar Monitor Stopped');
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      processedBurns: this.processedBurns.size,
      isRunning: this.isRunning,
      issuer: this.issuerPublicKey,
    };
  }
}

module.exports = StellarMonitor;
