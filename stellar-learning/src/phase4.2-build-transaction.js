const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

/**
 * Phase 4.2: Building Your First Transaction
 *
 * Learn the complete flow:
 * 1. Load account (gets sequence number)
 * 2. Build transaction
 * 3. Sign transaction
 * 4. Submit to network
 */

async function buildFirstTransaction() {
  console.log('=== BUILDING A TRANSACTION ===\n');

  // Step 1: Configure network
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );
  const networkPassphrase = StellarSdk.Networks.TESTNET;

  console.log('🌐 Network: Testnet');
  console.log('📡 Horizon:', server.serverURL.toString());

  // Step 2: Load source account
  const sourceKeypair = StellarSdk.Keypair.fromSecret(
    process.env.TESTNET_SECRET_KEY
  );
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  console.log('\n👤 Source Account:');
  console.log('Public Key:', sourceKeypair.publicKey());
  console.log('Current Sequence:', sourceAccount.sequence);

  // For demo: send to self (account already exists)
  const recipientPublicKey = sourceKeypair.publicKey();
  console.log('\n💸 Payment Details:');
  console.log('Recipient:', recipientPublicKey);
  console.log('Amount: 5 XLM');

  // Step 3: Build transaction
  console.log('\n🔨 Building Transaction...');

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,          // 100 stroops = 0.00001 XLM
    networkPassphrase: networkPassphrase
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: StellarSdk.Asset.native(), // XLM
        amount: '5'
      })
    )
    .setTimeout(30) // Transaction valid for 30 seconds
    .build();

  console.log('✅ Transaction built!');
  console.log('\n📋 Transaction Details:');
  console.log('Hash:', transaction.hash().toString('hex'));
  console.log('Fee:', transaction.fee, 'stroops');
  console.log('Operations:', transaction.operations.length);
  console.log('Sequence:', transaction.sequence);

  // Step 4: Inspect the operation
  const operation = transaction.operations[0];
  console.log('\n🔍 Operation Details:');
  console.log('Type:', operation.type);
  console.log('Destination:', operation.destination);
  console.log('Asset:', operation.asset.isNative() ? 'XLM' : operation.asset.code);
  console.log('Amount:', operation.amount);

  // Step 5: Sign transaction
  console.log('\n🔐 Signing Transaction...');
  transaction.sign(sourceKeypair);
  console.log('✅ Transaction signed!');
  console.log('Signatures:', transaction.signatures.length);

  // Step 6: Show XDR (the encoded transaction)
  const xdr = transaction.toEnvelope().toXDR('base64');
  console.log('\n📦 Transaction XDR (encoded):');
  console.log(xdr.substring(0, 80) + '...');

  // Step 7: Submit to network
  console.log('\n📤 Submitting Transaction...');
  console.log('⚠️  This will actually send the transaction!');

  try {
    const result = await server.submitTransaction(transaction);

    console.log('\n🎉 SUCCESS!');
    console.log('Transaction Hash:', result.hash);
    console.log('Ledger:', result.ledger);
    console.log('Fee Charged:', result.fee_charged, 'stroops');

    console.log('\n🔗 View on StellarExpert:');
    console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);

    // Show new balance
    console.log('\n💰 Checking new balance...');
    const updatedAccount = await server.loadAccount(sourceKeypair.publicKey());
    const xlmBalance = updatedAccount.balances.find(b => b.asset_type === 'native');
    console.log('New XLM Balance:', xlmBalance.balance);
    console.log('New Sequence:', updatedAccount.sequence);

  } catch (error) {
    console.error('\n❌ Transaction Failed!');

    // Parse error details
    const resultCodes = error.response?.data?.extras?.result_codes;
    if (resultCodes) {
      console.error('Transaction Result:', resultCodes.transaction);
      console.error('Operation Results:', resultCodes.operations);

      // Common errors explained
      if (resultCodes.transaction === 'tx_insufficient_balance') {
        console.error('\n💡 Not enough XLM for transaction + fees');
      } else if (resultCodes.transaction === 'tx_bad_seq') {
        console.error('\n💡 Sequence number mismatch - account state changed');
      }
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the transaction builder
buildFirstTransaction().catch(error => {
  console.error('Fatal Error:', error.message);
});
