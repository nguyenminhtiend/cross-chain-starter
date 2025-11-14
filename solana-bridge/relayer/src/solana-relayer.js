/**
 * Solana Bridge Relayer
 *
 * EXACT SAME PATTERN as your Ethereum relayer!
 *
 * Your Ethereum relayer:
 * 1. Listen for Lock events on source chain
 * 2. Wait for finality
 * 3. Verify event
 * 4. Mint on destination chain
 *
 * Solana relayer:
 * 1. Listen for LockEvent on Solana program (SAME)
 * 2. Wait for finality (SAME)
 * 3. Verify event (SAME)
 * 4. Mint on Ethereum (SAME)
 */

import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import pino from 'pino';
import fs from 'fs';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

class SolanaRelayer {
  constructor(config) {
    this.config = config;

    // Initialize Solana connection
    this.connection = new Connection(config.solanaRpcUrl, 'confirmed');

    // Load keypair
    const keypairData = JSON.parse(
      fs.readFileSync(config.solanaKeypairPath, 'utf-8')
    );
    this.wallet = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(keypairData)
    );

    // Initialize Ethereum components
    this.ethProvider = new ethers.JsonRpcProvider(config.ethereumRpcUrl);
    this.ethSigner = new ethers.Wallet(config.ethereumPrivateKey, this.ethProvider);

    // Initialize Ethereum bridge contract
    this.ethereumBridge = new ethers.Contract(
      config.ethereumBridgeAddress,
      [
        'function mint(address to, uint256 amount, bytes32 nonce, bytes signature) external',
        'function processedNonces(bytes32) view returns (bool)',
        'event Burn(address indexed from, uint256 amount, bytes32 nonce, string solanaAddress)'
      ],
      this.ethSigner
    );

    // Track processed events
    this.processedEvents = new Set();

    logger.info('Solana Relayer initialized');
    logger.info(`Solana wallet: ${this.wallet.publicKey.toString()}`);
    logger.info(`Ethereum bridge: ${config.ethereumBridgeAddress}`);
  }

  /**
   * Start the relayer
   *
   * Listen for events on both chains
   */
  async start() {
    logger.info('Starting Solana relayer...');

    // Start listening for Solana Lock events
    await this.startSolanaListener();

    // Start listening for Ethereum Burn events
    this.startEthereumListener();

    logger.info('Solana relayer is running...');
  }

  /**
   * Listen for Lock events on Solana
   *
   * Similar to: sourceBridge.on('Lock', handleLockEvent)
   * Solana uses: program.addEventListener('LockEvent', handleEvent)
   */
  async startSolanaListener() {
    // Load program
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.wallet),
      { commitment: 'confirmed' }
    );

    // Load IDL (Interface Definition Language - like ABI in Ethereum)
    const programId = new PublicKey(this.config.solanaProgramId);

    // For production, load from file or generated IDL
    // For now, we'll simulate event listening via transaction parsing
    logger.info('Listening for Solana Lock events...');

    // Poll for transactions (in production, use WebSocket or geyser plugin)
    this.pollSolanaTransactions();
  }

  /**
   * Poll for Solana transactions
   *
   * In production, use WebSocket subscriptions or Geyser plugin
   * This is simplified for demonstration
   */
  async pollSolanaTransactions() {
    const programId = new PublicKey(this.config.solanaProgramId);

    setInterval(async () => {
      try {
        // Get recent transactions for the program
        const signatures = await this.connection.getSignaturesForAddress(
          programId,
          { limit: 10 }
        );

        for (const sig of signatures) {
          if (this.processedEvents.has(sig.signature)) {
            continue;
          }

          // Get transaction details
          const tx = await this.connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });

          if (!tx || !tx.meta) continue;

          // Parse logs for Lock event
          const lockEvent = this.parseLockEvent(tx.meta.logMessages);

          if (lockEvent) {
            await this.handleSolanaLock(lockEvent, sig.signature, sig.slot);
            this.processedEvents.add(sig.signature);
          }
        }
      } catch (error) {
        logger.error('Error polling transactions:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Parse Lock event from logs
   *
   * Solana emits events in logs
   * Similar to parsing Ethereum event logs
   */
  parseLockEvent(logs) {
    if (!logs) return null;

    // Look for lock event in logs
    for (const log of logs) {
      if (log.includes('Locked') && log.includes('tokens for')) {
        // Parse log message
        // Format: "Locked {amount} tokens for {eth_recipient} (nonce: {nonce})"
        const match = log.match(/Locked (\d+) tokens for (0x[a-fA-F0-9]{40}) \(nonce: (\d+)\)/);
        if (match) {
          return {
            amount: match[1],
            ethRecipient: match[2],
            nonce: match[3]
          };
        }
      }
    }

    return null;
  }

  /**
   * Handle Solana Lock event
   *
   * IDENTICAL LOGIC to your Ethereum relayer handleLockEvent:
   * 1. Verify event
   * 2. Wait for finality
   * 3. Check not processed
   * 4. Mint on Ethereum
   */
  async handleSolanaLock(event, signature, slot) {
    logger.info(`Lock event detected: ${event.amount} tokens`);
    logger.info(`Signature: ${signature}`);
    logger.info(`Ethereum recipient: ${event.ethRecipient}`);
    logger.info(`Nonce: ${event.nonce}`);

    try {
      // Wait for Solana finality (~400ms, 32 slots)
      await this.waitForSolanaFinality(slot);

      // Convert amount (Solana uses u64, Ethereum uses uint256)
      const amountWei = ethers.parseUnits(event.amount, 0); // Already in smallest unit

      // Create nonce for Ethereum
      const nonce = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(event.nonce)),
        32
      );

      // Check if already processed on Ethereum (SAME AS YOUR RELAYER!)
      const processed = await this.ethereumBridge.processedNonces(nonce);
      if (processed) {
        logger.warn(`Nonce already processed: ${nonce}`);
        return;
      }

      // Sign mint request (SAME AS YOUR RELAYER!)
      const signature = await this.signMintRequest(
        event.ethRecipient,
        amountWei,
        nonce
      );

      // Mint on Ethereum (SAME AS YOUR RELAYER!)
      logger.info('Minting on Ethereum...');
      const tx = await this.ethereumBridge.mint(
        event.ethRecipient,
        amountWei,
        nonce,
        signature
      );

      await tx.wait();
      logger.info(`✓ Minted on Ethereum! Tx: ${tx.hash}`);

    } catch (error) {
      logger.error('Failed to process lock event:', error);
    }
  }

  /**
   * Wait for Solana finality
   *
   * Solana finality: ~400ms (32 slots)
   * Much faster than Ethereum's 12 blocks!
   */
  async waitForSolanaFinality(eventSlot) {
    const FINALITY_SLOTS = 32;

    while (true) {
      const currentSlot = await this.connection.getSlot();
      const confirmations = currentSlot - eventSlot;

      if (confirmations >= FINALITY_SLOTS) {
        logger.debug(`Solana finality reached: ${confirmations} slots`);
        break;
      }

      logger.debug(`Waiting for finality: ${confirmations}/${FINALITY_SLOTS} slots`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Sign mint request
   *
   * EXACT SAME as your Ethereum relayer!
   */
  async signMintRequest(to, amount, nonce) {
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'bytes32'],
      [to, amount, nonce]
    );

    const signature = await this.ethSigner.signMessage(
      ethers.getBytes(messageHash)
    );

    return signature;
  }

  /**
   * Listen for Ethereum Burn events
   *
   * SAME AS: sourceBridge.on('Burn', handleBurnEvent)
   */
  startEthereumListener() {
    this.ethereumBridge.on('Burn', async (from, amount, nonce, solanaAddress) => {
      try {
        await this.handleEthereumBurn(from, amount, nonce, solanaAddress);
      } catch (error) {
        logger.error('Error handling burn event:', error);
      }
    });

    logger.info('Listening for Ethereum Burn events...');
  }

  /**
   * Handle Ethereum Burn event
   *
   * Similar to your unlock function:
   * 1. Verify burn event
   * 2. Check if processed
   * 3. Unlock tokens on Solana
   */
  async handleEthereumBurn(from, amount, nonce, solanaAddress) {
    logger.info(`Burn event detected: ${ethers.formatEther(amount)} tokens`);
    logger.info(`From: ${from}`);
    logger.info(`Solana recipient: ${solanaAddress}`);

    const nonceStr = ethers.hexlify(nonce);

    if (this.processedEvents.has(nonceStr)) {
      logger.debug(`Burn already processed: ${nonceStr}`);
      return;
    }

    try {
      // Validate Solana address
      const recipient = new PublicKey(solanaAddress);

      // In production, call the Solana program to unlock tokens
      // This would be similar to calling unlock() in your EVM bridge

      logger.info(`Would unlock tokens on Solana for ${solanaAddress}`);
      logger.info('(Unlock implementation requires program interaction)');

      this.processedEvents.add(nonceStr);

    } catch (error) {
      logger.error('Failed to process burn event:', error);
    }
  }

  /**
   * Stop the relayer
   */
  async stop() {
    logger.info('Stopping Solana relayer...');
    this.ethereumBridge.removeAllListeners();
  }
}

export default SolanaRelayer;
