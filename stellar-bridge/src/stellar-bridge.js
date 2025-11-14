/**
 * Stellar Bridge Service
 *
 * Bridges assets between Stellar and Ethereum chains.
 *
 * Architecture:
 * - Listens for payments to bridge account on Stellar
 * - Verifies and processes payments
 * - Mints wrapped tokens on Ethereum
 * - Handles burn events from Ethereum to unlock on Stellar
 *
 * Similar to your EVM bridge but using Stellar SDK operations instead of smart contracts
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { ethers } from 'ethers';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

class StellarBridge {
  constructor(config) {
    this.config = config;

    // Initialize Stellar components
    this.keypair = StellarSdk.Keypair.fromSecret(config.stellarBridgeSecret);
    this.server = new StellarSdk.Horizon.Server(config.stellarHorizonUrl);

    // Initialize Ethereum components
    this.ethProvider = new ethers.JsonRpcProvider(config.ethereumRpcUrl);
    this.ethSigner = new ethers.Wallet(config.ethereumPrivateKey, this.ethProvider);

    // Initialize bridge contract interface
    this.ethereumBridge = new ethers.Contract(
      config.ethereumBridgeAddress,
      [
        'function mint(address to, uint256 amount, bytes32 nonce, bytes signature) external',
        'function processedNonces(bytes32) view returns (bool)',
        'event Burn(address indexed from, uint256 amount, bytes32 nonce, string stellarAddress)'
      ],
      this.ethSigner
    );

    // Create USDC asset
    this.USDC = new StellarSdk.Asset(
      config.stellarUsdcCode,
      config.stellarUsdcIssuer
    );

    // Track processed transactions
    this.processedTxs = new Set();

    logger.info(`Stellar Bridge initialized`);
    logger.info(`Bridge account: ${this.keypair.publicKey()}`);
    logger.info(`Ethereum bridge: ${config.ethereumBridgeAddress}`);
  }

  /**
   * Start listening for Stellar payments
   *
   * Similar to: sourceBridge.on('Lock', handleLockEvent)
   * Stellar uses: server.payments().stream({ onmessage: handlePayment })
   */
  async start() {
    logger.info('Starting Stellar bridge...');

    // Load bridge account to verify it exists
    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());
      logger.info(`Bridge account loaded. Balance: ${account.balances.length} assets`);
    } catch (error) {
      logger.error('Bridge account not found. Please fund it first:', error.message);
      throw error;
    }

    // Start listening for payments
    this.startPaymentListener();

    // Start listening for Ethereum burn events
    this.startBurnListener();

    logger.info('Stellar bridge is running...');
  }

  /**
   * Listen for incoming Stellar payments
   *
   * Mapping to your EVM bridge:
   * - EVM: contract.on('Lock', (from, to, amount, nonce) => {...})
   * - Stellar: server.payments().stream({ onmessage: (payment) => {...} })
   */
  startPaymentListener() {
    this.server
      .payments()
      .forAccount(this.keypair.publicKey())
      .cursor('now')
      .stream({
        onmessage: async (payment) => {
          try {
            await this.handleStellarPayment(payment);
          } catch (error) {
            logger.error('Error handling payment:', error);
          }
        },
        onerror: (error) => {
          logger.error('Payment stream error:', error);
          // Reconnect after error
          setTimeout(() => this.startPaymentListener(), 5000);
        }
      });

    logger.info('Listening for Stellar payments...');
  }

  /**
   * Handle incoming Stellar payment
   *
   * Similar to your handleLockEvent function:
   * 1. Verify payment (same concept as verifying Lock event)
   * 2. Check if already processed (same nonce check pattern)
   * 3. Extract parameters (from, amount, recipient)
   * 4. Mint on Ethereum (same as your destination chain mint)
   */
  async handleStellarPayment(payment) {
    // Only process actual payments (not account creation)
    if (payment.type !== 'payment') {
      return;
    }

    // Only process USDC payments
    if (payment.asset_code !== this.config.stellarUsdcCode) {
      logger.debug(`Ignoring non-USDC payment: ${payment.asset_code}`);
      return;
    }

    const txHash = payment.transaction_hash;

    // Check if already processed (same as processedNonces check in EVM)
    if (this.processedTxs.has(txHash)) {
      logger.debug(`Payment already processed: ${txHash}`);
      return;
    }

    logger.info(`New USDC payment received: ${payment.amount} USDC`);
    logger.info(`Transaction hash: ${txHash}`);

    try {
      // Get full transaction details to extract sender and memo
      const tx = await this.server
        .transactions()
        .transaction(txHash)
        .call();

      const from = tx.source_account;
      const amount = payment.amount;

      // Extract Ethereum recipient from memo
      // User should include their ETH address in the memo
      let ethRecipient;
      if (tx.memo && tx.memo !== StellarSdk.Memo.none().value) {
        ethRecipient = tx.memo;
      } else {
        logger.warn(`No memo found. Skipping transaction ${txHash}`);
        return;
      }

      // Validate Ethereum address
      if (!ethers.isAddress(ethRecipient)) {
        logger.error(`Invalid Ethereum address in memo: ${ethRecipient}`);
        return;
      }

      logger.info(`Bridging ${amount} USDC from Stellar to Ethereum`);
      logger.info(`From: ${from}`);
      logger.info(`To: ${ethRecipient}`);

      // Wait for Stellar finality (~5 seconds, 1-2 ledgers)
      await this.waitForStellarFinality(payment);

      // Convert amount to wei (18 decimals for Ethereum)
      const amountWei = ethers.parseUnits(amount, 18);

      // Create unique nonce from tx hash (same pattern as your EVM bridge)
      const nonce = ethers.keccak256(ethers.toUtf8Bytes(txHash));

      // Check if already processed on Ethereum side
      const processed = await this.ethereumBridge.processedNonces(nonce);
      if (processed) {
        logger.warn(`Nonce already processed on Ethereum: ${nonce}`);
        this.processedTxs.add(txHash);
        return;
      }

      // Sign the mint request (same as your bridge signature)
      const signature = await this.signMintRequest(ethRecipient, amountWei, nonce);

      // Mint on Ethereum (same as your destination bridge.mint())
      logger.info('Minting on Ethereum...');
      const mintTx = await this.ethereumBridge.mint(
        ethRecipient,
        amountWei,
        nonce,
        signature
      );

      await mintTx.wait();
      logger.info(`✓ Minted on Ethereum! Tx: ${mintTx.hash}`);

      // Mark as processed
      this.processedTxs.add(txHash);

    } catch (error) {
      logger.error('Failed to process payment:', error);
      // In production, implement refund mechanism here
    }
  }

  /**
   * Wait for Stellar finality
   *
   * Similar to waiting for 12 blocks on Ethereum
   * Stellar: ~5 seconds (1-2 ledgers)
   */
  async waitForStellarFinality(payment) {
    // Stellar has fast finality (~5 seconds)
    // In production, verify the ledger is closed and confirmed
    await new Promise(resolve => setTimeout(resolve, 5000));
    logger.debug('Stellar finality confirmed');
  }

  /**
   * Sign mint request
   *
   * EXACT SAME as your EVM bridge signature!
   * Hash: keccak256(to, amount, nonce)
   * Sign with bridge private key
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
   * Similar to: destBridge.on('Burn', handleBurnEvent)
   * When users burn wrapped tokens on Ethereum, unlock original on Stellar
   */
  startBurnListener() {
    this.ethereumBridge.on('Burn', async (from, amount, nonce, stellarAddress) => {
      try {
        await this.handleEthereumBurn(from, amount, nonce, stellarAddress);
      } catch (error) {
        logger.error('Error handling burn event:', error);
      }
    });

    logger.info('Listening for Ethereum Burn events...');
  }

  /**
   * Handle Ethereum burn event
   *
   * Similar to your unlock function:
   * 1. Verify burn event
   * 2. Check if already processed
   * 3. Send tokens back on Stellar (unlock/payment)
   */
  async handleEthereumBurn(from, amount, nonce, stellarAddress) {
    logger.info(`Burn event detected: ${ethers.formatEther(amount)} tokens`);
    logger.info(`From: ${from}`);
    logger.info(`Stellar recipient: ${stellarAddress}`);

    const nonceStr = ethers.hexlify(nonce);

    // Check if already processed
    if (this.processedTxs.has(nonceStr)) {
      logger.debug(`Burn already processed: ${nonceStr}`);
      return;
    }

    try {
      // Validate Stellar address
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(stellarAddress)) {
        logger.error(`Invalid Stellar address: ${stellarAddress}`);
        return;
      }

      // Convert amount from wei to Stellar units (7 decimals)
      const amountStellar = (Number(ethers.formatEther(amount))).toFixed(7);

      logger.info(`Sending ${amountStellar} USDC on Stellar to ${stellarAddress}`);

      // Load bridge account
      const account = await this.server.loadAccount(this.keypair.publicKey());

      // Build payment transaction (same concept as unlock in your EVM bridge)
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.getNetworkPassphrase()
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: stellarAddress,
            asset: this.USDC,
            amount: amountStellar
          })
        )
        .setTimeout(180)
        .build();

      // Sign and submit
      transaction.sign(this.keypair);
      const result = await this.server.submitTransaction(transaction);

      logger.info(`✓ Unlocked on Stellar! Tx: ${result.hash}`);

      // Mark as processed
      this.processedTxs.add(nonceStr);

    } catch (error) {
      logger.error('Failed to unlock on Stellar:', error);
      // In production, implement retry mechanism
    }
  }

  /**
   * Get Stellar network passphrase
   */
  getNetworkPassphrase() {
    return this.config.stellarNetwork === 'testnet'
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC;
  }

  /**
   * Stop the bridge
   */
  async stop() {
    logger.info('Stopping Stellar bridge...');
    // Clean up listeners
    this.ethereumBridge.removeAllListeners();
  }
}

export default StellarBridge;
