require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

console.log('='.repeat(70));
console.log('PHASE 3: Multi-Signature Accounts');
console.log('='.repeat(70));

// ============================================================
// WHY MULTI-SIG?
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('WHY MULTI-SIGNATURE ACCOUNTS?');
console.log('═'.repeat(70));

console.log(`
Use Cases:
  1. Security: Require multiple approvals for transactions
  2. Business: Board members must approve large transfers
  3. Recovery: Backup keys if primary is lost
  4. Compliance: Dual control for regulated operations
  5. DAOs: Decentralized governance

Example Scenarios:
  - 2-of-3: You + 2 business partners
  - 3-of-5: Company with 5 executives
  - 1-of-2: Personal account with backup key
`);

// ============================================================
// UNDERSTANDING WEIGHTS AND THRESHOLDS
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('WEIGHTS AND THRESHOLDS');
console.log('═'.repeat(70));

console.log(`
Signer Weights (0-255):
  - Each signer has a weight
  - Master key starts with weight 1
  - Can add signers with any weight

Thresholds (0-255):
  - Low: Allow Trust, Bump Sequence
  - Medium: Payments, Offers, Path Payments
  - High: Set Options, Account Merge, Manage Data

Formula:
  Sum(signer weights) >= Threshold for operation

Example 2-of-3:
  - 3 signers, each weight 1
  - Thresholds: Low=2, Med=2, High=2
  - Need 2 signatures for any operation
`);

// ============================================================
// SETUP 2-OF-3 MULTI-SIG
// ============================================================
async function setup2of3MultiSig(masterSecret) {
  console.log('\n' + '═'.repeat(70));
  console.log('SETUP: 2-OF-3 MULTI-SIGNATURE');
  console.log('═'.repeat(70));

  try {
    const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);
    const masterAccount = await server.loadAccount(masterKeypair.publicKey());

    // Generate two additional signers
    const signer1 = StellarSdk.Keypair.random();
    const signer2 = StellarSdk.Keypair.random();

    console.log('\n🔐 Setting up 2-of-3 multi-sig');
    console.log('\nMaster Account: ' + masterKeypair.publicKey());
    console.log('Signer 1:       ' + signer1.publicKey());
    console.log('Signer 2:       ' + signer2.publicKey());

    console.log('\nConfiguration:');
    console.log('  - Each signer has weight 1');
    console.log('  - All thresholds set to 2');
    console.log('  - Need 2 out of 3 signatures for any operation');

    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(masterAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      // Add signer 1
      .addOperation(
        StellarSdk.Operation.setOptions({
          signer: {
            ed25519PublicKey: signer1.publicKey(),
            weight: 1
          }
        })
      )
      // Add signer 2
      .addOperation(
        StellarSdk.Operation.setOptions({
          signer: {
            ed25519PublicKey: signer2.publicKey(),
            weight: 1
          }
        })
      )
      // Set thresholds (requires weight 2 for all operations)
      .addOperation(
        StellarSdk.Operation.setOptions({
          masterWeight: 1,     // Master key weight
          lowThreshold: 2,     // Require weight 2
          medThreshold: 2,     // Require weight 2
          highThreshold: 2     // Require weight 2
        })
      )
      .setTimeout(30)
      .build();

    console.log('\nTransaction:');
    console.log('  Operations: ' + transaction.operations.length);
    console.log('  Fee: ' + transaction.fee + ' stroops');

    // Sign and submit
    transaction.sign(masterKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('\n✅ Multi-sig configured successfully!');
    console.log('   Transaction: ' + result.hash);

    // Verify configuration
    const updatedAccount = await server.loadAccount(masterKeypair.publicKey());
    console.log('\nVerification:');
    console.log('  Signers: ' + updatedAccount.signers.length);
    console.log('  Low threshold: ' + updatedAccount.thresholds.low_threshold);
    console.log('  Med threshold: ' + updatedAccount.thresholds.med_threshold);
    console.log('  High threshold: ' + updatedAccount.thresholds.high_threshold);

    return {
      master: masterKeypair,
      signer1: signer1,
      signer2: signer2
    };

  } catch (error) {
    console.log('\n❌ Error:', error.message);
    throw error;
  }
}

// ============================================================
// MULTI-SIG PAYMENT
// ============================================================
async function multiSigPayment(masterKeypair, signer1, recipientPublicKey, amount) {
  console.log('\n' + '═'.repeat(70));
  console.log('EXECUTING MULTI-SIG PAYMENT');
  console.log('═'.repeat(70));

  try {
    const sourceAccount = await server.loadAccount(masterKeypair.publicKey());

    console.log('\nPayment details:');
    console.log('  From: ' + masterKeypair.publicKey());
    console.log('  To: ' + recipientPublicKey);
    console.log('  Amount: ' + amount + ' XLM');

    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: recipientPublicKey,
          asset: StellarSdk.Asset.native(),
          amount: amount.toString()
        })
      )
      .setTimeout(30)
      .build();

    console.log('\nSigning with 2 keys (master + signer1)...');

    // Sign with master and signer1 (2 of 3)
    transaction.sign(masterKeypair);
    transaction.sign(signer1);

    console.log('  Signatures: ' + transaction.signatures.length);
    console.log('  Total weight: 2 (meets threshold!)');

    // Submit
    const result = await server.submitTransaction(transaction);

    console.log('\n✅ Multi-sig payment successful!');
    console.log('   Transaction: ' + result.hash);

    return result;

  } catch (error) {
    console.log('\n❌ Payment failed:', error.message);
    throw error;
  }
}

// ============================================================
// WEIGHTED MULTI-SIG (CEO + CFO + CTO)
// ============================================================
async function setupWeightedMultiSig(masterSecret) {
  console.log('\n' + '═'.repeat(70));
  console.log('SETUP: WEIGHTED MULTI-SIGNATURE');
  console.log('═'.repeat(70));

  console.log(`
Scenario: Company with different authority levels
  - CEO: Weight 10 (can approve alone)
  - CFO: Weight 5
  - CTO: Weight 5
  - Threshold: 10

Rules:
  - CEO can sign alone (10 >= 10)
  - CFO + CTO together (5 + 5 = 10)
  - Any 2 of CFO/CTO requires CEO
`);

  try {
    const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);
    const masterAccount = await server.loadAccount(masterKeypair.publicKey());

    const ceo = StellarSdk.Keypair.random();
    const cfo = StellarSdk.Keypair.random();
    const cto = StellarSdk.Keypair.random();

    console.log('\nKeys:');
    console.log('  CEO: ' + ceo.publicKey());
    console.log('  CFO: ' + cfo.publicKey());
    console.log('  CTO: ' + cto.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(masterAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.setOptions({
          signer: { ed25519PublicKey: ceo.publicKey(), weight: 10 }
        })
      )
      .addOperation(
        StellarSdk.Operation.setOptions({
          signer: { ed25519PublicKey: cfo.publicKey(), weight: 5 }
        })
      )
      .addOperation(
        StellarSdk.Operation.setOptions({
          signer: { ed25519PublicKey: cto.publicKey(), weight: 5 }
        })
      )
      .addOperation(
        StellarSdk.Operation.setOptions({
          masterWeight: 0,      // Disable master key
          lowThreshold: 10,
          medThreshold: 10,
          highThreshold: 10
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(masterKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('\n✅ Weighted multi-sig configured!');
    console.log('   Transaction: ' + result.hash);

    return { master: masterKeypair, ceo, cfo, cto };

  } catch (error) {
    console.log('\n❌ Error:', error.message);
    throw error;
  }
}

// ============================================================
// REMOVE A SIGNER
// ============================================================
async function removeSigner(masterSecret, signerPublicKey) {
  console.log('\n' + '═'.repeat(70));
  console.log('REMOVING A SIGNER');
  console.log('═'.repeat(70));

  try {
    const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);
    const masterAccount = await server.loadAccount(masterKeypair.publicKey());

    console.log('\nRemoving signer: ' + signerPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(masterAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.setOptions({
          signer: {
            ed25519PublicKey: signerPublicKey,
            weight: 0  // Setting weight to 0 removes the signer
          }
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(masterKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('✅ Signer removed!');
    console.log('   Transaction: ' + result.hash);

    return result;

  } catch (error) {
    console.log('❌ Error:', error.message);
    throw error;
  }
}

// ============================================================
// LOCK MASTER KEY (ADVANCED)
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('ADVANCED: LOCKING THE MASTER KEY');
console.log('═'.repeat(70));

console.log(`
WARNING: Use with extreme caution!

Setting master weight to 0 disables the master key.
This means:
  ✅ More secure (even if master key leaks, can't do anything)
  ❌ Must rely entirely on other signers
  ❌ If you lose other signers, account is LOCKED FOREVER

Best Practice:
  - Set master weight to 1 (keep it active)
  - Add backup signers
  - Store master key separately
  - Never set all weights to 0!
`);

// ============================================================
// MULTI-SIG PATTERNS
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('COMMON MULTI-SIG PATTERNS');
console.log('═'.repeat(70));

console.log(`
1. Personal Account with Backup (1-of-2)
   - Master: weight 1
   - Backup: weight 1
   - Thresholds: 1
   - Either key can sign alone

2. Joint Account (2-of-2)
   - Partner 1: weight 1
   - Partner 2: weight 1
   - Thresholds: 2
   - Both must sign

3. Escrow (2-of-3)
   - Buyer: weight 1
   - Seller: weight 1
   - Arbiter: weight 1
   - Thresholds: 2
   - Buyer + Seller = release
   - Buyer + Arbiter = refund
   - Seller + Arbiter = dispute

4. Corporate (3-of-5)
   - 5 board members, weight 1 each
   - Thresholds: 3
   - Need majority approval

5. Hierarchical (Weighted)
   - CEO: weight 10
   - Managers: weight 5 each
   - Threshold: 10
   - CEO alone OR 2 managers
`);

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('DEMONSTRATION');
  console.log('═'.repeat(70));

  if (!process.env.TESTNET_SECRET_KEY) {
    console.log('\n⚠️  Add TESTNET_SECRET_KEY to .env to run live demos');
    console.log('\nTo get started:');
    console.log('  1. Generate a keypair');
    console.log('  2. Fund it with friendbot');
    console.log('  3. Add secret to .env');
    return;
  }

  console.log('\n📝 Examples shown above demonstrate:');
  console.log('  ✓ 2-of-3 multi-sig setup');
  console.log('  ✓ Weighted multi-sig (CEO/CFO/CTO)');
  console.log('  ✓ Multi-sig payments');
  console.log('  ✓ Removing signers');
  console.log('  ✓ Common patterns');

  console.log('\n' + '='.repeat(70));
  console.log('✅ Multi-Signature Accounts Complete!');
  console.log('='.repeat(70));

  console.log('\nKey Takeaways:');
  console.log('  1. Signers have weights (0-255)');
  console.log('  2. Operations have thresholds (0-255)');
  console.log('  3. Sum of signer weights must >= threshold');
  console.log('  4. 3 threshold levels: Low, Medium, High');
  console.log('  5. Setting weight to 0 removes a signer');
  console.log('  6. Master weight 0 = disabled (use carefully!)');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  });
}

// Export functions
module.exports = {
  setup2of3MultiSig,
  multiSigPayment,
  setupWeightedMultiSig,
  removeSigner
};
