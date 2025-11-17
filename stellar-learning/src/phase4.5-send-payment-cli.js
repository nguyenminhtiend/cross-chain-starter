const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

process.env.TESTNET_SECRET_KEY = 'SCJMORFLDYJ3UDXTLJSP444L6GBFC3LACSCG3T374DDPN7KE2TU6VDAT';

/**
 * Phase 4.5: Production-Ready Payment CLI
 *
 * A robust payment script with:
 * - Input validation
 * - Error handling
 * - Retry logic
 * - Detailed logging
 */

async function sendPayment(destination, amount, memo = null) {
  console.log('=== STELLAR PAYMENT CLI ===\n');

  // Validate inputs
  if (!destination || !amount) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage: node phase4.5-send-payment-cli.js <destination> <amount> [memo]');
    console.log('Example: node phase4.5-send-payment-cli.js GBXXX... 10 "Invoice #123"');
    process.exit(1);
  }

  // Validate public key format
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
    console.error('❌ Invalid destination public key');
    process.exit(1);
  }

  // Validate amount
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    console.error('❌ Invalid amount (must be positive number)');
    process.exit(1);
  }

  // Validate memo length if provided
  if (memo && memo.length > 28) {
    console.error('❌ Memo too long (max 28 bytes)');
    process.exit(1);
  }

  // Initialize
  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

  const sourceKeypair = StellarSdk.Keypair.fromSecret(process.env.TESTNET_SECRET_KEY);

  console.log('📤 Payment Details:');
  console.log('From:', sourceKeypair.publicKey());
  console.log('To:', destination);
  console.log('Amount:', amount, 'XLM');
  if (memo) console.log('Memo:', memo);
  console.log('');

  // Check if source account has enough balance
  console.log('🔍 Checking balance...');
  try {
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
    const xlmBalance = sourceAccount.balances.find((b) => b.asset_type === 'native');
    const currentBalance = parseFloat(xlmBalance.balance);

    console.log('Current Balance:', currentBalance, 'XLM');

    // Calculate required amount (payment + fee + minimum balance reserve)
    const fee = 0.00001; // BASE_FEE in XLM
    const required = amountNum + fee;

    console.log('Required:', required, 'XLM (payment + fee)');

    if (currentBalance < required) {
      console.error('\n❌ Insufficient balance!');
      console.error('Need at least', required, 'XLM');
      process.exit(1);
    }

    console.log('✅ Balance sufficient\n');
  } catch (error) {
    console.error('❌ Failed to load account:', error.message);
    process.exit(1);
  }

  // Check if destination exists
  console.log('🔍 Checking destination account...');
  let destinationExists = false;
  try {
    await server.loadAccount(destination);
    destinationExists = true;
    console.log('✅ Destination account exists\n');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Destination account does not exist');
      console.log('💡 Account will be created if amount >= 1 XLM');

      if (amountNum < 1) {
        console.error('\n❌ Cannot create account with less than 1 XLM');
        console.error('Minimum starting balance: 1 XLM');
        process.exit(1);
      }
      console.log('✅ Will create account with', amount, 'XLM\n');
    } else {
      console.error('❌ Failed to check destination:', error.message);
      process.exit(1);
    }
  }

  // Build transaction
  console.log('🔨 Building transaction...');

  try {
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    let txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    });

    // Choose operation based on whether destination exists
    if (destinationExists) {
      txBuilder = txBuilder.addOperation(
        StellarSdk.Operation.payment({
          destination: destination,
          asset: StellarSdk.Asset.native(),
          amount: amount.toString()
        })
      );
    } else {
      txBuilder = txBuilder.addOperation(
        StellarSdk.Operation.createAccount({
          destination: destination,
          startingBalance: amount.toString()
        })
      );
    }

    // Add memo if provided
    if (memo) {
      txBuilder = txBuilder.addMemo(StellarSdk.Memo.text(memo));
    }

    const transaction = txBuilder.setTimeout(30).build();

    console.log('✅ Transaction built');
    console.log('Hash:', transaction.hash().toString('hex'));
    console.log('Fee:', transaction.fee, 'stroops');

    // Sign transaction
    console.log('\n🔐 Signing transaction...');
    transaction.sign(sourceKeypair);
    console.log('✅ Transaction signed\n');

    // Submit with retry logic
    console.log('📤 Submitting to network...');

    const result = await submitWithRetry(server, transaction, 3);

    console.log('\n🎉 PAYMENT SUCCESSFUL!\n');
    console.log('Transaction Hash:', result.hash);
    console.log('Ledger:', result.ledger);
    console.log('Fee Charged:', result.fee_charged, 'stroops');

    console.log('\n🔗 View Transaction:');
    console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);

    // Show updated balance
    const updatedAccount = await server.loadAccount(sourceKeypair.publicKey());
    const newBalance = updatedAccount.balances.find((b) => b.asset_type === 'native');
    console.log('\n💰 New Balance:', newBalance.balance, 'XLM');
  } catch (error) {
    console.error('\n❌ PAYMENT FAILED\n');

    const resultCodes = error.response?.data?.extras?.result_codes;
    if (resultCodes) {
      console.error('Error Code:', resultCodes.transaction || resultCodes.operations);

      // Provide helpful explanations
      if (resultCodes.transaction === 'tx_insufficient_balance') {
        console.error('\n💡 Not enough XLM for transaction + fees');
      } else if (resultCodes.transaction === 'tx_bad_seq') {
        console.error('\n💡 Sequence number issue - account state changed');
        console.error('Try running the command again');
      } else if (resultCodes.operations?.[0] === 'op_underfunded') {
        console.error('\n💡 Insufficient balance for this payment');
      } else if (resultCodes.operations?.[0] === 'op_no_destination') {
        console.error("\n💡 Destination account doesn't exist");
        console.error('Use at least 1 XLM to create the account');
      }
    } else {
      console.error('Error:', error.message);
    }

    process.exit(1);
  }
}

// Retry logic for network issues
async function submitWithRetry(server, transaction, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await server.submitTransaction(transaction);
    } catch (error) {
      const code = error.response?.data?.extras?.result_codes?.transaction;

      // Don't retry on these errors
      if (code === 'tx_bad_seq' || code === 'tx_insufficient_balance' || code === 'tx_too_late') {
        throw error;
      }

      // Retry on network issues
      if (i < maxRetries - 1) {
        console.log(`⚠️  Network issue, retrying (${i + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      } else {
        throw error;
      }
    }
  }
}

// Parse command line arguments
const [destination, amount, ...memoWords] = process.argv.slice(2);
const memo = memoWords.length > 0 ? memoWords.join(' ') : null;

sendPayment(destination, amount, memo).catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
