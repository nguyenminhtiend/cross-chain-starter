const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

/**
 * Phase 4.4: Memos and Error Handling
 *
 * Memos: Attach metadata to transactions
 * Error Handling: Gracefully handle failures
 */

// ============ MEMOS ============

async function demonstrateMemos() {
  console.log('=== TRANSACTION MEMOS ===\n');

  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

  process.env.TESTNET_SECRET_KEY = 'SCJMORFLDYJ3UDXTLJSP444L6GBFC3LACSCG3T374DDPN7KE2TU6VDAT';

  const sourceKeypair = StellarSdk.Keypair.fromSecret(process.env.TESTNET_SECRET_KEY);
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  const recipient = StellarSdk.Keypair.random().publicKey();

  console.log('📝 Memo Types:\n');

  // 1. Text Memo (most common)
  console.log('1️⃣  TEXT Memo (up to 28 bytes)');
  const textMemo = StellarSdk.Memo.text('Invoice #12345');
  console.log('   Value:', textMemo.value.toString());
  console.log('   Use case: Invoice numbers, notes');

  // 2. ID Memo (for exchanges)
  console.log('\n2️⃣  ID Memo (64-bit unsigned integer)');
  const idMemo = StellarSdk.Memo.id('987654321');
  console.log('   Value:', idMemo.value);
  console.log('   Use case: Exchange deposit IDs, user IDs');

  // 3. Hash Memo
  console.log('\n3️⃣  HASH Memo (32-byte hash)');
  const hashBuffer = Buffer.from('a'.repeat(64), 'hex'); // 32 bytes
  const hashMemo = StellarSdk.Memo.hash(hashBuffer);
  console.log('   Value:', hashMemo.value.toString('hex').substring(0, 20) + '...');
  console.log('   Use case: Document hashes, commitments');

  // 4. Return Memo
  console.log('\n4️⃣  RETURN Memo (for refunds)');
  const returnMemo = StellarSdk.Memo.return(hashBuffer);
  console.log('   Value:', returnMemo.value.toString('hex').substring(0, 20) + '...');
  console.log('   Use case: Refunds, error returns');

  // Build transaction with memo
  console.log('\n\n🔨 Building Transaction with TEXT Memo...\n');

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: recipient,
        startingBalance: '2'
      })
    )
    .addMemo(StellarSdk.Memo.text('Test Memo'))
    .setTimeout(30)
    .build();

  console.log('Transaction Details:');
  console.log('Memo Type:', transaction.memo.type);
  console.log('Memo Value:', transaction.memo.value?.toString() || 'none');

  transaction.sign(sourceKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('\n✅ Transaction successful!');
    console.log('Hash:', result.hash);
    console.log(`View: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
  } catch (error) {
    console.error('Error:', error.response?.data?.extras?.result_codes);
  }
}

// ============ ERROR HANDLING ============

async function demonstrateErrorHandling() {
  console.log('\n\n=== ERROR HANDLING ===\n');

  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

  const sourceKeypair = StellarSdk.Keypair.fromSecret(process.env.TESTNET_SECRET_KEY);

  // Test 1: Insufficient Balance
  console.log('🧪 Test 1: Insufficient Balance\n');

  try {
    const account = await server.loadAccount(sourceKeypair.publicKey());

    const recipient = StellarSdk.Keypair.random().publicKey();

    const tx1 = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: recipient,
          startingBalance: '999999' // Way too much!
        })
      )
      .setTimeout(30)
      .build();

    tx1.sign(sourceKeypair);
    await server.submitTransaction(tx1);
  } catch (error) {
    console.log('❌ Transaction Failed (expected)');
    const codes = error.response?.data?.extras?.result_codes;
    if (codes) {
      console.log('Transaction Result:', codes.transaction);
      console.log('Operation Results:', codes.operations);

      if (codes.transaction === 'tx_insufficient_balance') {
        console.log('\n💡 Explanation: Not enough XLM to create account + pay fees');
      }
    }
  }

  // Test 2: Payment to non-existent account
  console.log('\n\n🧪 Test 2: Payment to Non-Existent Account\n');

  try {
    const account = await server.loadAccount(sourceKeypair.publicKey());

    const nonExistentAccount = StellarSdk.Keypair.random().publicKey();

    const tx2 = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: nonExistentAccount,
          asset: StellarSdk.Asset.native(),
          amount: '1'
        })
      )
      .setTimeout(30)
      .build();

    tx2.sign(sourceKeypair);
    await server.submitTransaction(tx2);
  } catch (error) {
    console.log('❌ Transaction Failed (expected)');
    const codes = error.response?.data?.extras?.result_codes;
    if (codes) {
      console.log('Transaction Result:', codes.transaction);
      console.log('Operation Results:', codes.operations);

      if (codes.operations[0] === 'op_no_destination') {
        console.log("\n💡 Explanation: Cannot send payment to account that doesn't exist");
        console.log('   Solution: Use createAccount operation instead');
      }
    }
  }

  // Test 3: Bad Sequence Number
  console.log('\n\n🧪 Test 3: Bad Sequence Number\n');

  try {
    const account = await server.loadAccount(sourceKeypair.publicKey());

    // Manually mess with the sequence
    account.sequence = '99999999999';

    const tx3 = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: StellarSdk.Keypair.random().publicKey(),
          startingBalance: '2'
        })
      )
      .setTimeout(30)
      .build();

    tx3.sign(sourceKeypair);
    await server.submitTransaction(tx3);
  } catch (error) {
    console.log('❌ Transaction Failed (expected)');
    const codes = error.response?.data?.extras?.result_codes;
    if (codes) {
      console.log('Transaction Result:', codes.transaction);

      if (codes.transaction === 'tx_bad_seq') {
        console.log("\n💡 Explanation: Sequence number doesn't match account state");
        console.log('   Solution: Reload account with server.loadAccount()');
      }
    }
  }

  console.log('\n\n📚 Common Error Codes:\n');
  console.log('Transaction Errors:');
  console.log('  tx_failed          - One or more operations failed');
  console.log('  tx_insufficient_balance - Not enough XLM for transaction + fees');
  console.log('  tx_bad_seq         - Sequence number mismatch');
  console.log('  tx_insufficient_fee - Fee too low');
  console.log('  tx_too_late        - Transaction expired (time bounds)');

  console.log('\nOperation Errors:');
  console.log('  op_success         - Operation succeeded');
  console.log('  op_underfunded     - Insufficient balance for operation');
  console.log("  op_no_destination  - Destination account doesn't exist");
  console.log('  op_already_exists  - Account already exists');
  console.log('  op_line_full       - Trustline limit exceeded');
}

// Run all demos
async function runAll() {
  await demonstrateMemos();
  await demonstrateErrorHandling();
}

runAll().catch((error) => {
  console.error('Fatal Error:', error.message);
});
