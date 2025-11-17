/**
 * Main Relayer Service
 * Coordinates both Ethereum and Stellar monitors
 * Handles cross-chain message relay
 */

const { ethers } = require('ethers');
const EthereumMonitor = require('../ethereum/ethereum-monitor');
const StellarMonitor = require('../stellar/stellar-monitor');
const { config, validateConfig } = require('../config');

// Import bridge ABI (you'll need to compile the Solidity contract to get this)
// For now, we'll use a minimal ABI
const BRIDGE_ABI = [
  'event Locked(uint256 indexed lockId, address indexed sender, uint256 amount, string stellarAddress, uint256 timestamp)',
  'event Unlocked(bytes32 indexed requestId, address indexed recipient, uint256 amount, bytes32 stellarTxHash)',
  'event UnlockApproved(bytes32 indexed requestId, address indexed validator, uint256 currentApprovals, uint256 requiredApprovals)',
  'function lock(string memory stellarAddress) external payable',
  'function approveUnlock(bytes32 requestId, address recipient, uint256 amount, bytes32 stellarTxHash) external',
  'function getUnlockRequest(bytes32 requestId) external view returns (address recipient, uint256 amount, bytes32 stellarTxHash, uint256 approvals, bool executed)',
  'function lockNonce() external view returns (uint256)',
  'function requiredApprovals() external view returns (uint256)',
  'function getBalance() external view returns (uint256)',
];

class BridgeRelayer {
  constructor() {
    this.ethMonitor = null;
    this.stellarMonitor = null;
    this.isRunning = false;
  }

  /**
   * Initialize the relayer
   */
  async initialize() {
    console.log('🌉 Cross-Chain Bridge Relayer');
    console.log('═'.repeat(50));
    console.log();

    // Validate configuration
    if (!validateConfig()) {
      console.log('⚠️  Relayer starting with incomplete configuration');
      console.log('   Some features may not work\n');
    }

    try {
      // Initialize Ethereum components
      console.log('🔗 Connecting to Ethereum...');
      const ethProvider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
      const network = await ethProvider.getNetwork();
      console.log('   Network:', network.name, `(Chain ID: ${network.chainId})`);

      if (!config.ethereum.bridgeAddress) {
        throw new Error('ETH_BRIDGE_ADDRESS not configured');
      }

      // Initialize Ethereum monitor
      this.ethMonitor = new EthereumMonitor(
        config.ethereum.bridgeAddress,
        BRIDGE_ABI
      );

      // Initialize Stellar monitor (with validator)
      if (config.ethereum.validatorKey) {
        console.log('🔗 Connecting to Stellar...');
        console.log('   Network:', config.stellar.networkPassphrase.split(';')[0].trim());

        const validatorWallet = new ethers.Wallet(
          config.ethereum.validatorKey,
          ethProvider
        );

        const bridgeContract = new ethers.Contract(
          config.ethereum.bridgeAddress,
          BRIDGE_ABI,
          validatorWallet
        );

        this.stellarMonitor = new StellarMonitor(
          bridgeContract,
          validatorWallet
        );

        console.log('   Validator Address:', validatorWallet.address);
      } else {
        console.warn('⚠️  No validator key configured');
        console.warn('   Stellar->Ethereum bridging disabled\n');
      }

      console.log();
      console.log('✅ Relayer Initialized Successfully\n');

    } catch (error) {
      console.error('❌ Initialization Error:', error.message);
      throw error;
    }
  }

  /**
   * Start the relayer service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Relayer is already running');
      return;
    }

    try {
      console.log('🚀 Starting Bridge Relayer...\n');

      // Start Ethereum monitor
      await this.ethMonitor.start();

      // Start Stellar monitor if configured
      if (this.stellarMonitor) {
        await this.stellarMonitor.start();
      }

      this.isRunning = true;

      // Display bridge info
      await this.displayBridgeInfo();

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      console.log('═'.repeat(50));
      console.log('✅ Bridge Relayer is now running!');
      console.log('═'.repeat(50));
      console.log();

    } catch (error) {
      console.error('❌ Failed to start relayer:', error.message);
      throw error;
    }
  }

  /**
   * Display current bridge information
   */
  async displayBridgeInfo() {
    try {
      console.log('📊 Bridge Information');
      console.log('─'.repeat(50));

      // Ethereum stats
      const ethStats = await this.ethMonitor.getStats();
      if (ethStats) {
        console.log('   ETH Side:');
        console.log('      Total Locked:', ethStats.totalLocked, 'ETH');
        console.log('      Lock Count:', ethStats.lockCount);
        console.log('      Processed:', ethStats.processedLocks);
      }

      // Stellar stats
      if (this.stellarMonitor) {
        const stellarStats = this.stellarMonitor.getStats();
        console.log('   Stellar Side:');
        console.log('      Asset:', config.bridge.assetCode);
        console.log('      Issuer:', stellarStats.issuer.slice(0, 8) + '...');
        console.log('      Processed Burns:', stellarStats.processedBurns);
      }

      console.log();
    } catch (error) {
      console.error('⚠️  Could not fetch bridge stats:', error.message);
    }
  }

  /**
   * Stop the relayer service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('\n🛑 Stopping Bridge Relayer...');

    if (this.ethMonitor) {
      this.ethMonitor.stop();
    }

    if (this.stellarMonitor) {
      this.stellarMonitor.stop();
    }

    this.isRunning = false;
    console.log('✅ Relayer stopped successfully\n');
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const shutdown = () => {
      this.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Get relayer status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      ethereum: {
        configured: !!this.ethMonitor,
        bridgeAddress: config.ethereum.bridgeAddress,
      },
      stellar: {
        configured: !!this.stellarMonitor,
        issuer: config.stellar.issuerPublic,
        asset: config.bridge.assetCode,
      },
    };
  }
}

/**
 * Start relayer if run directly
 */
async function main() {
  const relayer = new BridgeRelayer();

  try {
    await relayer.initialize();
    await relayer.start();
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = BridgeRelayer;
