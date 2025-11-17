/**
 * Ethereum Event Monitor
 * Monitors Ethereum bridge contract for Lock events
 * Mints wETH on Stellar when ETH is locked
 */

const { ethers } = require('ethers');
const StellarSdk = require('@stellar/stellar-sdk');
const { config } = require('../config');

class EthereumMonitor {
  constructor(bridgeAddress, bridgeABI) {
    this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    this.bridge = new ethers.Contract(bridgeAddress, bridgeABI, this.provider);

    this.stellarServer = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
    this.stellarIssuer = StellarSdk.Keypair.fromSecret(config.stellar.issuerSecret);
    this.wETH = new StellarSdk.Asset(
      config.bridge.assetCode,
      this.stellarIssuer.publicKey()
    );

    this.processedLocks = new Set();
    this.isRunning = false;
  }

  /**
   * Start monitoring Ethereum for Lock events
   */
  async start() {
    console.log('🔍 Ethereum Monitor Started');
    console.log('   Bridge Address:', await this.bridge.getAddress());
    console.log('   Monitoring for Lock events...\n');

    this.isRunning = true;

    // Listen for new Lock events
    this.bridge.on('Locked', async (lockId, sender, amount, stellarAddress, timestamp, event) => {
      const lockIdStr = lockId.toString();

      // Prevent duplicate processing
      if (this.processedLocks.has(lockIdStr)) {
        return;
      }

      console.log('\n🔒 Lock Event Detected!');
      console.log('─'.repeat(50));
      console.log('   Lock ID:', lockIdStr);
      console.log('   Sender:', sender);
      console.log('   Amount:', ethers.formatEther(amount), 'ETH');
      console.log('   Stellar Address:', stellarAddress);
      console.log('   Timestamp:', new Date(Number(timestamp) * 1000).toISOString());
      console.log('   Block:', event.log.blockNumber);
      console.log('   TX Hash:', event.log.transactionHash);

      try {
        await this.mintOnStellar(stellarAddress, amount, lockIdStr);
        this.processedLocks.add(lockIdStr);
      } catch (error) {
        console.error('❌ Failed to mint on Stellar:', error.message);
        // In production, implement retry logic and alerting
      }
    });

    // Error handling
    this.bridge.on('error', (error) => {
      console.error('⚠️  Bridge event error:', error.message);
    });

    // Keep process alive
    console.log('✅ Monitor is running. Press Ctrl+C to stop.\n');
  }

  /**
   * Mint wETH on Stellar when ETH is locked
   */
  async mintOnStellar(destinationAddress, ethAmount, lockId) {
    try {
      // Convert Wei to wETH amount (7 decimal places on Stellar)
      const ethValue = ethers.formatEther(ethAmount);
      const wethAmount = parseFloat(ethValue).toFixed(7);

      console.log('\n💫 Minting wETH on Stellar...');
      console.log('   Amount:', wethAmount, config.bridge.assetCode);
      console.log('   Destination:', destinationAddress);

      // Validate Stellar address
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(destinationAddress)) {
        throw new Error('Invalid Stellar address format');
      }

      // Load issuer account
      const issuerAccount = await this.stellarServer.loadAccount(
        this.stellarIssuer.publicKey()
      );

      // Check if destination has trustline
      try {
        const destAccount = await this.stellarServer.loadAccount(destinationAddress);
        const hasTrustline = destAccount.balances.some(
          b => b.asset_code === config.bridge.assetCode &&
               b.asset_issuer === this.stellarIssuer.publicKey()
        );

        if (!hasTrustline) {
          console.warn('⚠️  Destination account has no trustline for', config.bridge.assetCode);
          console.warn('   User must establish trustline first');
          return;
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.error('❌ Destination account does not exist');
          return;
        }
        throw error;
      }

      // Build payment transaction
      const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationAddress,
            asset: this.wETH,
            amount: wethAmount,
          })
        )
        .addMemo(StellarSdk.Memo.text(`Lock ID: ${lockId}`))
        .setTimeout(30)
        .build();

      // Sign and submit
      transaction.sign(this.stellarIssuer);
      const result = await this.stellarServer.submitTransaction(transaction);

      console.log('✅ wETH Minted Successfully!');
      console.log('   Stellar TX Hash:', result.hash);
      console.log('   View on Stellar Expert:');
      console.log(`   https://stellar.expert/explorer/testnet/tx/${result.hash}\n`);

    } catch (error) {
      console.error('❌ Mint Error:', error.message);
      if (error.response) {
        console.error('   Details:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    this.bridge.removeAllListeners();
    console.log('\n🛑 Ethereum Monitor Stopped');
  }

  /**
   * Get bridge statistics
   */
  async getStats() {
    try {
      const balance = await this.provider.getBalance(await this.bridge.getAddress());
      const lockNonce = await this.bridge.lockNonce();

      return {
        totalLocked: ethers.formatEther(balance),
        lockCount: lockNonce.toString(),
        processedLocks: this.processedLocks.size,
      };
    } catch (error) {
      console.error('Error fetching stats:', error.message);
      return null;
    }
  }
}

module.exports = EthereumMonitor;
