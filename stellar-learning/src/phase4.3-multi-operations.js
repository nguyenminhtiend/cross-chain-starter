const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

/**
 * Phase 4.3: Multi-Operation Transactions
 *
 * Stellar transactions can contain 1-100 operations.
 * All operations execute atomically: ALL succeed or ALL fail.
 */

async function multiOperationDemo() {
  console.log('=== MULTI-OPERATION TRANSACTIONS ===\n');

  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

  const sourceKeypair = StellarSdk.Keypair.fromSecret(process.env.TESTNET_SECRET_KEY);
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  // Create multiple recipients for demo
  const recipient1 = StellarSdk.Keypair.random();
  const recipient2 = StellarSdk.Keypair.random();
  const recipient3 = StellarSdk.Keypair.random();

  console.log('🎯 Batch Operations Plan:');
  console.log('1. Create new account (recipient1) with 2 XLM');
  console.log('2. Create new account (recipient2) with 3 XLM');
  console.log('3. Send 1 XLM to recipient3 (will fail - not created yet)');
  console.log('');
  console.log('Expected: ALL operations will fail (atomic execution)');

  // Build multi-operation transaction
  console.log('\n🔨 Building Transaction with 3 Operations...');

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    // Operation 1: Create account 1
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: recipient1.publicKey(),
        startingBalance: '2'
      })
    )
    // Operation 2: Create account 2
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: recipient2.publicKey(),
        startingBalance: '3'
      })
    )
    // Operation 3: Payment to non-existent account (will fail)
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipient3.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '1'
      })
    )
    .setTimeout(30)
    .build();

  console.log('✅ Transaction built!');
  console.log('Total Operations:', transaction.operations.length);
  console.log(
    'Total Fee:',
    transaction.fee,
    'stroops (',
    parseInt(transaction.fee) / 10000000,
    'XLM)'
  );

  // Show each operation
  transaction.operations.forEach((op, index) => {
    console.log(`\nOperation ${index + 1}:`);
    console.log('  Type:', op.type);
    if (op.type === 'createAccount') {
      console.log('  Destination:', op.destination);
      console.log('  Starting Balance:', op.startingBalance, 'XLM');
    } else if (op.type === 'payment') {
      console.log('  Destination:', op.destination);
      console.log('  Amount:', op.amount, 'XLM');
    }
  });

  // Sign and submit
  transaction.sign(sourceKeypair);

  console.log('\n📤 Submitting Transaction...');

  try {
    const result = await server.submitTransaction(transaction);
    console.log('\n🎉 All operations succeeded!');
    console.log('Transaction Hash:', result.hash);
    console.log(`View: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
  } catch (error) {
    console.log('\n❌ Transaction Failed (as expected!)');

    const resultCodes = error.response?.data?.extras?.result_codes;
    if (resultCodes) {
      console.log('\n📊 Result Codes:');
      console.log('Transaction:', resultCodes.transaction);
      console.log('Operations:', resultCodes.operations);

      console.log('\n💡 Explanation:');
      resultCodes.operations.forEach((code, index) => {
        if (code === 'op_success') {
          console.log(`  Operation ${index + 1}: ✅ Would succeed`);
        } else {
          console.log(`  Operation ${index + 1}: ❌ Failed (${code})`);
          if (code === 'op_no_destination') {
            console.log('    → Cannot send payment to non-existent account');
          }
        }
      });

      console.log('\n🔒 Atomic Execution:');
      console.log('Because Operation 3 failed, Operations 1 & 2 were also rolled back.');
      console.log('Accounts were NOT created. State unchanged.');
    }
  }

  console.log('\n\n=== NOW TRY A SUCCESSFUL BATCH ===\n');

  // Try again with all valid operations
  const successAccount = await server.loadAccount(sourceKeypair.publicKey());

  const newRecipient1 = StellarSdk.Keypair.random();
  const newRecipient2 = StellarSdk.Keypair.random();

  console.log('✅ Creating 2 accounts in one transaction:');
  console.log('Account 1:', newRecipient1.publicKey());
  console.log('Account 2:', newRecipient2.publicKey());

  const successTx = new StellarSdk.TransactionBuilder(successAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: newRecipient1.publicKey(),
        startingBalance: '2'
      })
    )
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: newRecipient2.publicKey(),
        startingBalance: '2'
      })
    )
    .setTimeout(30)
    .build();

  successTx.sign(sourceKeypair);

  try {
    const result = await server.submitTransaction(successTx);
    console.log('\n🎉 SUCCESS! Both accounts created!');
    console.log('Transaction Hash:', result.hash);
    console.log(`View: https://stellar.expert/explorer/testnet/tx/${result.hash}`);

    console.log('\n✅ Both operations executed atomically in ledger', result.ledger);
  } catch (error) {
    console.error('Error:', error.response?.data?.extras?.result_codes);
  }
}

multiOperationDemo().catch((error) => {
  console.error('Fatal Error:', error.message);
});
