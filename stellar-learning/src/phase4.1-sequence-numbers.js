const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

/**
 * Phase 4.1: Understanding Sequence Numbers
 *
 * Sequence numbers are Stellar's way of preventing replay attacks.
 * Every account has a sequence number that increments with each transaction.
 */

async function demonstrateSequence() {
  console.log('=== SEQUENCE NUMBERS DEMO ===\n');

  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const keypair = StellarSdk.Keypair.fromSecret(process.env.TESTNET_SECRET_KEY);
  console.log('Account:', keypair.publicKey());

  // Load account to get current sequence
  const account = await server.loadAccount(keypair.publicKey());

  console.log('\n📊 Sequence Number Info:');
  console.log('Current sequence:', account.sequence);
  console.log('Type:', typeof account.sequence);

  // The sequence number is stored as a string to handle large numbers
  const currentSeq = BigInt(account.sequence);
  const nextSeq = currentSeq + 1n;

  console.log('\n🔢 Next Transaction:');
  console.log('Will use sequence:', nextSeq.toString());
  console.log('(Current + 1)');

  // Show what happens with manual increment
  console.log('\n🧪 Manual Increment (for testing):');
  console.log('Before increment:', account.sequence);
  account.incrementSequenceNumber();
  console.log('After increment:', account.sequence);
  account.incrementSequenceNumber();
  console.log('After 2nd increment:', account.sequence);

  console.log('\n⚠️  Note: TransactionBuilder increments sequence automatically!');
  console.log('Manual increment is only for testing/simulation.');

  // Reload to get fresh sequence
  const freshAccount = await server.loadAccount(keypair.publicKey());
  console.log('\n✅ Fresh account sequence:', freshAccount.sequence);
}

// Run the demo
demonstrateSequence().catch(error => {
  console.error('Error:', error.message);
});
