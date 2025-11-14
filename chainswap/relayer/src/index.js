require('dotenv').config();
const { ethers } = require('ethers');
const logger = require('./utils/logger');
const ChainSwapHandler = require('./services/ChainSwapHandler');

// Contract ABIs (simplified - load from artifacts in production)
const BRIDGE_SOURCE_ABI = [
  "event Lock(address indexed from, address indexed to, uint256 amount, uint256 timestamp, uint256 indexed nonce, address targetToken, uint256 targetChain)",
  "function currentNonce() view returns (uint256)",
  "function totalLocked() view returns (uint256)"
];

const CHAINSWAP_BRIDGE_ABI = [
  "function mint(address to, uint256 amount, uint256 sourceNonce, bytes signature) external",
  "function mintAndSwap(address to, uint256 amount, uint256 sourceNonce, bytes signature, address targetToken, uint256 minAmountOut) external",
  "function wrappedToken() view returns (address)",
  "function isProcessed(uint256 nonce) view returns (bool)",
  "function getExpectedOutput(uint256 amountIn, address tokenIn, address tokenOut) view returns (uint256)",
  "event Mint(address indexed to, uint256 amount, uint256 sourceNonce)",
  "event MintAndSwap(address indexed to, uint256 amountIn, uint256 amountOut, address indexed tokenOut, uint256 sourceNonce)"
];

class ChainSwapRelayer {
  constructor() {
    this.isRunning = false;
    this.handler = null;
  }

  async initialize() {
    logger.info('========== Initializing ChainSwap Relayer ==========');

    // Setup source chain
    const sourceProvider = new ethers.providers.JsonRpcProvider(
      process.env.SOURCE_CHAIN_RPC || 'http://localhost:8545'
    );
    const sourceChainId = (await sourceProvider.getNetwork()).chainId;
    logger.info(`Source Chain ID: ${sourceChainId}`);

    const sourceBridge = new ethers.Contract(
      process.env.SOURCE_BRIDGE_ADDRESS,
      BRIDGE_SOURCE_ABI,
      sourceProvider
    );

    // Setup destination chain
    const destProvider = new ethers.providers.JsonRpcProvider(
      process.env.DEST_CHAIN_RPC || 'http://localhost:9545'
    );
    const destChainId = (await destProvider.getNetwork()).chainId;
    logger.info(`Destination Chain ID: ${destChainId}`);

    const destSigner = new ethers.Wallet(
      process.env.RELAYER_PRIVATE_KEY,
      destProvider
    );
    logger.info(`Relayer Address: ${destSigner.address}`);

    const destBridge = new ethers.Contract(
      process.env.DEST_BRIDGE_ADDRESS,
      CHAINSWAP_BRIDGE_ABI,
      destSigner
    );

    // Verify contracts
    const sourceNonce = await sourceBridge.currentNonce();
    logger.info(`Source Bridge Current Nonce: ${sourceNonce}`);

    const wrappedToken = await destBridge.wrappedToken();
    logger.info(`Wrapped Token Address: ${wrappedToken}`);

    // Setup handler
    this.sourceChain = { provider: sourceProvider, bridge: sourceBridge };
    this.destChain = { provider: destProvider, signer: destSigner, bridge: destBridge };

    this.handler = new ChainSwapHandler(
      this.sourceChain,
      this.destChain,
      {
        requiredConfirmations: parseInt(process.env.REQUIRED_CONFIRMATIONS || '12'),
        slippageTolerance: parseInt(process.env.SLIPPAGE_TOLERANCE || '100') // 1%
      }
    );

    logger.info('✓ Relayer initialized successfully\n');
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Relayer is already running');
      return;
    }

    await this.initialize();

    logger.info('========== Starting Event Listener ==========');

    // Listen for Lock events
    this.sourceChain.bridge.on('Lock', async (...args) => {
      const event = args[args.length - 1]; // Last arg is the event object

      try {
        await this.handler.handleLockEvent(event);
      } catch (error) {
        logger.error(`Failed to handle event: ${error.message}`);
        logger.error(error.stack);
      }
    });

    // Also listen for past events (catch up)
    await this.catchUpPastEvents();

    this.isRunning = true;
    logger.info('✓ Relayer is now listening for events\n');

    // Keep process alive
    this.startHealthCheck();
  }

  async catchUpPastEvents() {
    logger.info('Checking for past events...');

    try {
      const currentBlock = await this.sourceChain.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks

      const filter = this.sourceChain.bridge.filters.Lock();
      const events = await this.sourceChain.bridge.queryFilter(filter, fromBlock, currentBlock);

      if (events.length > 0) {
        logger.info(`Found ${events.length} past events, processing...`);

        for (const event of events) {
          try {
            await this.handler.handleLockEvent(event);
          } catch (error) {
            logger.error(`Error processing past event: ${error.message}`);
          }
        }
      } else {
        logger.info('No past events found');
      }
    } catch (error) {
      logger.error(`Error catching up past events: ${error.message}`);
    }
  }

  startHealthCheck() {
    // Log health status every 60 seconds
    setInterval(async () => {
      try {
        const sourceBlock = await this.sourceChain.provider.getBlockNumber();
        const destBlock = await this.destChain.provider.getBlockNumber();
        const processedCount = this.handler.getProcessedCount();

        logger.info(`\n[Health Check] Source Block: ${sourceBlock} | Dest Block: ${destBlock} | Processed Events: ${processedCount}`);
      } catch (error) {
        logger.error(`Health check failed: ${error.message}`);
      }
    }, 60000);
  }

  async stop() {
    logger.info('Stopping relayer...');
    this.sourceChain.bridge.removeAllListeners('Lock');
    this.isRunning = false;
    logger.info('✓ Relayer stopped');
  }
}

// Main execution
async function main() {
  const relayer = new ChainSwapRelayer();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('\nReceived SIGINT, shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('\nReceived SIGTERM, shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  });

  // Start relayer
  try {
    await relayer.start();
  } catch (error) {
    logger.error(`Failed to start relayer: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ChainSwapRelayer;

