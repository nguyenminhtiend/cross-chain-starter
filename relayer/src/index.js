require("dotenv").config({ path: "../.env" });
const { ethers } = require("ethers");
const logger = require("./utils/logger");
const EventListener = require("./services/EventListener");
const TransactionExecutor = require("./services/TransactionExecutor");
const StateManager = require("./services/StateManager");
const chainsConfig = require("./config/chains.config");
const contractsConfig = require("./config/contracts.config");

class BridgeRelayer {
  constructor() {
    this.stateManager = new StateManager();
    this.setupConnections();
  }

  setupConnections() {
    logger.info("Setting up blockchain connections...");

    // Chain 1 (Ethereum) setup
    this.chain1Provider = new ethers.JsonRpcProvider(chainsConfig.chain1.rpcUrl);
    this.chain1Wallet = new ethers.Wallet(
      chainsConfig.relayer.privateKey,
      this.chain1Provider
    );
    this.chain1Bridge = new ethers.Contract(
      contractsConfig.chain1.bridgeAddress,
      contractsConfig.chain1.bridgeABI,
      this.chain1Wallet
    );
    this.chain1Executor = new TransactionExecutor(
      this.chain1Wallet,
      this.chain1Bridge
    );

    logger.info(`Connected to Chain 1: ${chainsConfig.chain1.name}`, {
      rpc: chainsConfig.chain1.rpcUrl,
      bridge: contractsConfig.chain1.bridgeAddress,
      wallet: this.chain1Wallet.address
    });

    // Chain 2 (BSC) setup
    this.chain2Provider = new ethers.JsonRpcProvider(chainsConfig.chain2.rpcUrl);
    this.chain2Wallet = new ethers.Wallet(
      chainsConfig.relayer.privateKey,
      this.chain2Provider
    );
    this.chain2Bridge = new ethers.Contract(
      contractsConfig.chain2.bridgeAddress,
      contractsConfig.chain2.bridgeABI,
      this.chain2Wallet
    );
    this.chain2Executor = new TransactionExecutor(
      this.chain2Wallet,
      this.chain2Bridge
    );

    logger.info(`Connected to Chain 2: ${chainsConfig.chain2.name}`, {
      rpc: chainsConfig.chain2.rpcUrl,
      bridge: contractsConfig.chain2.bridgeAddress,
      wallet: this.chain2Wallet.address
    });
  }

  async start() {
    logger.info("=".repeat(80));
    logger.info("STARTING CROSS-CHAIN BRIDGE RELAYER");
    logger.info("=".repeat(80));

    // Check balances
    await this.checkBalances();

    // Setup event listeners
    await this.setupEventListeners();

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Log statistics periodically
    this.startPeriodicStats();

    logger.info("Relayer is running and listening for events...");
    logger.info("Press Ctrl+C to stop");
  }

  async checkBalances() {
    const chain1Balance = await this.chain1Provider.getBalance(
      this.chain1Wallet.address
    );
    const chain2Balance = await this.chain2Provider.getBalance(
      this.chain2Wallet.address
    );

    logger.info("Relayer wallet balances:", {
      chain1: ethers.formatEther(chain1Balance) + " ETH",
      chain2: ethers.formatEther(chain2Balance) + " BNB"
    });

    if (chain1Balance === 0n || chain2Balance === 0n) {
      logger.warn("Low balance detected on one or both chains!");
    }
  }

  async setupEventListeners() {
    // Listen for Lock events on Chain 1
    this.lockListener = new EventListener(
      this.chain1Provider,
      this.chain1Bridge,
      "Lock",
      this.handleLockEvent.bind(this)
    );
    await this.lockListener.start();

    // Listen for Burn events on Chain 2
    this.burnListener = new EventListener(
      this.chain2Provider,
      this.chain2Bridge,
      "Burn",
      this.handleBurnEvent.bind(this)
    );
    await this.burnListener.start();
  }

  async handleLockEvent(from, to, amount, timestamp, nonce, targetChain, event) {
    const txHash = event.transactionHash;
    const txId = `chain1-lock-${nonce}-${txHash}`;

    logger.info("=".repeat(80));
    logger.info("🔒 LOCK EVENT DETECTED ON CHAIN 1", {
      from,
      to,
      amount: ethers.formatEther(amount),
      nonce: nonce.toString(),
      txHash
    });
    logger.info("=".repeat(80));

    // Check if already processed
    if (this.stateManager.isProcessed(txId)) {
      logger.warn("Transaction already processed, skipping", { txId });
      return;
    }

    try {
      // Add to pending
      this.stateManager.addPending(txId, {
        from,
        to,
        amount: amount.toString(),
        nonce: nonce.toString(),
        chain: "chain1"
      });

      // Check if nonce already processed on Chain 2
      const alreadyProcessed = await this.chain2Bridge.processedNonces(nonce);
      if (alreadyProcessed) {
        logger.warn("Nonce already processed on Chain 2, skipping", {
          nonce: nonce.toString()
        });
        this.stateManager.markProcessed(txId);
        return;
      }

      // Create signature
      const signature = await this.chain2Executor.createSignature(
        to,
        amount,
        nonce
      );

      // Mint on Chain 2
      logger.info("Minting wrapped tokens on Chain 2...");
      await this.chain2Executor.execute("mint", [to, amount, nonce, signature]);

      logger.info("✅ Mint successful!", {
        to,
        amount: ethers.formatEther(amount),
        nonce: nonce.toString()
      });

      // Mark as processed
      this.stateManager.markProcessed(txId);
    } catch (error) {
      logger.error("Failed to process Lock event", {
        error: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data,
        stack: error.stack
      });
      this.stateManager.markFailed(txId, error);
    }
  }

  async handleBurnEvent(from, to, amount, timestamp, nonce, targetChain, event) {
    const txHash = event.transactionHash;
    const txId = `chain2-burn-${nonce}-${txHash}`;

    logger.info("=".repeat(80));
    logger.info("🔥 BURN EVENT DETECTED ON CHAIN 2", {
      from,
      to,
      amount: ethers.formatEther(amount),
      nonce: nonce.toString(),
      txHash
    });
    logger.info("=".repeat(80));

    // Check if already processed
    if (this.stateManager.isProcessed(txId)) {
      logger.warn("Transaction already processed, skipping", { txId });
      return;
    }

    try {
      // Add to pending
      this.stateManager.addPending(txId, {
        from,
        to,
        amount: amount.toString(),
        nonce: nonce.toString(),
        chain: "chain2"
      });

      // Check if nonce already processed on Chain 1
      const alreadyProcessed = await this.chain1Bridge.processedNonces(nonce);
      if (alreadyProcessed) {
        logger.warn("Nonce already processed on Chain 1, skipping", {
          nonce: nonce.toString()
        });
        this.stateManager.markProcessed(txId);
        return;
      }

      // Create signature
      const signature = await this.chain1Executor.createSignature(
        to,
        amount,
        nonce
      );

      // Unlock on Chain 1
      logger.info("Unlocking tokens on Chain 1...");
      await this.chain1Executor.execute("unlock", [to, amount, nonce, signature]);

      logger.info("✅ Unlock successful!", {
        to,
        amount: ethers.formatEther(amount),
        nonce: nonce.toString()
      });

      // Mark as processed
      this.stateManager.markProcessed(txId);
    } catch (error) {
      logger.error("Failed to process Burn event", {
        error: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data,
        stack: error.stack
      });
      this.stateManager.markFailed(txId, error);
    }
  }

  startPeriodicCleanup() {
    // Cleanup every hour
    setInterval(() => {
      this.stateManager.cleanup();
    }, 60 * 60 * 1000);
  }

  startPeriodicStats() {
    // Log stats every 5 minutes
    setInterval(() => {
      const stats = this.stateManager.getStats();
      logger.info("Relayer Statistics:", stats);
    }, 5 * 60 * 1000);
  }

  async stop() {
    logger.info("Stopping relayer...");

    if (this.lockListener) {
      this.lockListener.stop();
    }

    if (this.burnListener) {
      this.burnListener.stop();
    }

    logger.info("Relayer stopped");
    process.exit(0);
  }
}

// Main execution
async function main() {
  // Validate configuration
  if (
    !contractsConfig.chain1.bridgeAddress ||
    !contractsConfig.chain2.bridgeAddress
  ) {
    logger.error("Bridge addresses not configured in .env file");
    logger.error("Run deployment scripts first: pnpm run deploy:all");
    process.exit(1);
  }

  const relayer = new BridgeRelayer();

  // Graceful shutdown
  process.on("SIGINT", () => relayer.stop());
  process.on("SIGTERM", () => relayer.stop());

  // Handle unhandled rejections
  process.on("unhandledRejection", (error) => {
    logger.error("Unhandled promise rejection:", {
      error: error.message,
      stack: error.stack
    });
  });

  await relayer.start();
}

// Start relayer
if (require.main === module) {
  main().catch((error) => {
    logger.error("Fatal error:", { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = BridgeRelayer;
