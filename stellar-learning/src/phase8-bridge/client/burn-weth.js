/**
 * Burn wETH Client
 * User interface for burning wETH on Stellar to receive ETH on Ethereum
 */

const StellarSdk = require('@stellar/stellar-sdk');
const { config } = require('../config');

/**
 * Burn wETH on Stellar to unlock ETH on Ethereum
 */
async function burnWETH(amount, ethAddress, userSecret = null) {
  console.log('🔥 Burning wETH on Stellar');
  console.log('═'.repeat(50));

  try {
    // Setup Stellar connection
    const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
    const secretKey = userSecret || config.stellar.secretKey;

    if (!secretKey) {
      throw new Error('No user secret key provided. Set STELLAR_SECRET_KEY in .env or pass as parameter');
    }

    const userKeypair = StellarSdk.Keypair.fromSecret(secretKey);

    // Validate inputs
    const burnAmount = parseFloat(amount);
    if (isNaN(burnAmount) || burnAmount <= 0) {
      throw new Error('Invalid amount');
    }

    console.log('\n📋 Transaction Details:');
    console.log('   From:', userKeypair.publicKey());
    console.log('   Amount:', amount, config.bridge.assetCode);
    console.log('   ETH Address:', ethAddress);
    console.log('   Issuer:', config.stellar.issuerPublic);

    // Load user account
    console.log('\n🔍 Loading account...');
    const userAccount = await server.loadAccount(userKeypair.publicKey());

    // Check wETH balance
    const wETH = new StellarSdk.Asset(
      config.bridge.assetCode,
      config.stellar.issuerPublic
    );

    const wethBalance = userAccount.balances.find(
      b => b.asset_code === config.bridge.assetCode &&
           b.asset_issuer === config.stellar.issuerPublic
    );

    if (!wethBalance) {
      throw new Error(`No ${config.bridge.assetCode} trustline found. Please establish trustline first.`);
    }

    console.log('   Current Balance:', wethBalance.balance, config.bridge.assetCode);

    if (parseFloat(wethBalance.balance) < burnAmount) {
      throw new Error(`Insufficient ${config.bridge.assetCode} balance`);
    }

    // Build burn transaction (payment to issuer)
    console.log('\n📤 Building transaction...');

    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: config.stellar.issuerPublic, // Burn by sending to issuer
          asset: wETH,
          amount: amount.toString(),
        })
      )
      .addMemo(StellarSdk.Memo.text(ethAddress)) // ETH address in memo
      .setTimeout(30)
      .build();

    // Calculate approximate fee
    const fee = parseInt(transaction.fee);
    console.log('   Operation: Payment (Burn)');
    console.log('   Network Fee:', (fee / 10000000).toFixed(7), 'XLM');

    // Sign transaction
    console.log('\n✍️  Signing transaction...');
    transaction.sign(userKeypair);

    // Submit transaction
    console.log('📡 Submitting to network...');
    const result = await server.submitTransaction(transaction);

    console.log('\n✅ Transaction Successful!');
    console.log('   TX Hash:', result.hash);
    console.log('   Ledger:', result.ledger);
    console.log('   Stellar Expert: https://stellar.expert/explorer/testnet/tx/' + result.hash);

    // Display burn confirmation
    console.log('\n🔥 Burn Confirmed:');
    console.log('   Amount Burned:', amount, config.bridge.assetCode);
    console.log('   ETH Recipient:', ethAddress);

    console.log('\n⏳ Next Steps:');
    console.log(`   1. Wait for ${config.ethereum.requiredApprovals} validators to approve (~30-60 seconds)`);
    console.log('   2. ETH will be unlocked to your Ethereum address');
    console.log('   3. Check your Ethereum wallet for ETH');
    console.log('\n🔍 Monitor on Etherscan:');
    console.log(`   https://sepolia.etherscan.io/address/${ethAddress}`);

    return {
      txHash: result.hash,
      ledger: result.ledger,
      amount: amount,
      ethAddress: ethAddress,
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response && error.response.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Check wETH balance
 */
async function checkWETHBalance(stellarAddress = null) {
  try {
    const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
    const address = stellarAddress || config.stellar.publicKey;

    if (!address) {
      throw new Error('No Stellar address provided');
    }

    console.log('💰 Checking wETH Balance');
    console.log('─'.repeat(50));
    console.log('   Account:', address);

    const account = await server.loadAccount(address);

    // Find wETH balance
    const wethBalance = account.balances.find(
      b => b.asset_code === config.bridge.assetCode &&
           b.asset_issuer === config.stellar.issuerPublic
    );

    if (wethBalance) {
      console.log('\n✅ wETH Balance:', wethBalance.balance, config.bridge.assetCode);
      console.log('   Limit:', wethBalance.limit);
      return wethBalance;
    } else {
      console.log('\n⚠️  No wETH trustline found');
      console.log('   To receive wETH, establish a trustline first:');
      console.log(`   Asset: ${config.bridge.assetCode}:${config.stellar.issuerPublic}`);
      return null;
    }

  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('❌ Account not found on network');
    } else {
      console.error('❌ Error:', error.message);
    }
    throw error;
  }
}

/**
 * Setup trustline for wETH
 */
async function setupWETHTrustline(userSecret = null) {
  console.log('🤝 Setting up wETH Trustline');
  console.log('═'.repeat(50));

  try {
    const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
    const secretKey = userSecret || config.stellar.secretKey;

    if (!secretKey) {
      throw new Error('No user secret key provided');
    }

    const userKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    const userAccount = await server.loadAccount(userKeypair.publicKey());

    console.log('\n   Account:', userKeypair.publicKey());
    console.log('   Asset:', config.bridge.assetCode);
    console.log('   Issuer:', config.stellar.issuerPublic);

    // Check if trustline exists
    const existingTrust = userAccount.balances.find(
      b => b.asset_code === config.bridge.assetCode &&
           b.asset_issuer === config.stellar.issuerPublic
    );

    if (existingTrust) {
      console.log('\n✅ Trustline already exists');
      console.log('   Balance:', existingTrust.balance, config.bridge.assetCode);
      return;
    }

    // Create trustline
    console.log('\n📤 Creating trustline...');

    const wETH = new StellarSdk.Asset(
      config.bridge.assetCode,
      config.stellar.issuerPublic
    );

    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: wETH,
          limit: '1000000', // Max 1M wETH
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(userKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('\n✅ Trustline Established!');
    console.log('   TX Hash:', result.hash);
    console.log('   You can now receive', config.bridge.assetCode);

    return result;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'balance') {
    const address = args[1];
    checkWETHBalance(address).catch(console.error);
  } else if (command === 'trustline') {
    setupWETHTrustline().catch(console.error);
  } else if (args.length >= 2) {
    const [amount, ethAddress] = args;
    burnWETH(amount, ethAddress).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  Burn wETH:       node burn-weth.js <amount> <eth-address>');
    console.log('  Check balance:   node burn-weth.js balance [stellar-address]');
    console.log('  Setup trustline: node burn-weth.js trustline');
    console.log('\nExample:');
    console.log('  node burn-weth.js 0.01 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
  }
}

module.exports = {
  burnWETH,
  checkWETHBalance,
  setupWETHTrustline,
};
