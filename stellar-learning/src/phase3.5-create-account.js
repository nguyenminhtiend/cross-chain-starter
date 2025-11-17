require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

console.log('='.repeat(70));
console.log('PHASE 3: Creating New Accounts');
console.log('='.repeat(70));

// ============================================================
// THE CHICKEN-AND-EGG PROBLEM
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('THE CHICKEN-AND-EGG PROBLEM');
console.log('═'.repeat(70));

console.log(`
Problem:
  - You can't create an account without XLM
  - But you need an account to hold XLM!

Solutions:
  1. Friendbot (Testnet only) - Free test XLM
  2. Create Account Operation - Someone sends you XLM
  3. Exchange Withdrawal - Buy XLM and withdraw
`);

// ============================================================
// SOLUTION 1: FRIENDBOT (TESTNET ONLY)
// ============================================================
async function fundWithFriendbot(publicKey) {
  console.log('\n' + '═'.repeat(70));
  console.log('SOLUTION 1: FRIENDBOT (Testnet Only)');
  console.log('═'.repeat(70));

  console.log('\nFunding address: ' + publicKey);
  console.log('Requesting from friendbot...');

  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS! Account funded with 10,000 XLM');
      console.log('   Transaction: ' + result.hash);

      // Verify account was created
      const account = await server.loadAccount(publicKey);
      const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
      console.log('   Balance: ' + xlmBalance.balance + ' XLM');

      return true;
    } else {
      console.log('❌ Friendbot request failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

// ============================================================
// SOLUTION 2: CREATE ACCOUNT OPERATION (MAINNET)
// ============================================================
async function createAccountWithOperation(fundingSecret, newPublicKey, startingBalance) {
  console.log('\n' + '═'.repeat(70));
  console.log('SOLUTION 2: CREATE ACCOUNT OPERATION');
  console.log('═'.repeat(70));

  console.log('\nThis is how you create accounts on mainnet or any network.');
  console.log('An existing account (funding account) creates a new account.\n');

  try {
    // 1. Load funding account
    console.log('Step 1: Loading funding account...');
    const fundingKeypair = StellarSdk.Keypair.fromSecret(fundingSecret);
    const fundingAccount = await server.loadAccount(fundingKeypair.publicKey());
    console.log('   Funding account: ' + fundingKeypair.publicKey());
    console.log('   Sequence: ' + fundingAccount.sequence);

    // 2. Check if destination already exists
    console.log('\nStep 2: Checking if destination account exists...');
    let destinationExists = false;
    try {
      await server.loadAccount(newPublicKey);
      destinationExists = true;
      console.log('   ⚠️  Account already exists!');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('   ✅ Account does not exist (good!)');
      } else {
        throw error;
      }
    }

    // 3. Build transaction
    console.log('\nStep 3: Building transaction...');
    const transaction = new StellarSdk.TransactionBuilder(fundingAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: newPublicKey,
          startingBalance: startingBalance.toString()
        })
      )
      .setTimeout(30)
      .build();

    console.log('   Operation: Create Account');
    console.log('   Destination: ' + newPublicKey);
    console.log('   Starting Balance: ' + startingBalance + ' XLM');
    console.log('   Fee: ' + transaction.fee + ' stroops');

    // 4. Sign transaction
    console.log('\nStep 4: Signing transaction...');
    transaction.sign(fundingKeypair);
    console.log('   Signatures: ' + transaction.signatures.length);

    // 5. Submit transaction
    console.log('\nStep 5: Submitting transaction...');
    const result = await server.submitTransaction(transaction);
    console.log('   ✅ Transaction successful!');
    console.log('   Hash: ' + result.hash);
    console.log('   Ledger: ' + result.ledger);

    // 6. Verify new account
    console.log('\nStep 6: Verifying new account...');
    const newAccount = await server.loadAccount(newPublicKey);
    const xlmBalance = newAccount.balances.find((b) => b.asset_type === 'native');
    console.log('   ✅ Account created successfully!');
    console.log('   Balance: ' + xlmBalance.balance + ' XLM');
    console.log('   Sequence: ' + newAccount.sequence);

    return result;
  } catch (error) {
    console.log('\n❌ Error creating account:', error.message);
    if (error.response && error.response.data) {
      console.log('   Details:', JSON.stringify(error.response.data.extras, null, 2));
    }
    throw error;
  }
}

// ============================================================
// MINIMUM STARTING BALANCE
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('MINIMUM STARTING BALANCE');
console.log('═'.repeat(70));

console.log(`
Why minimum 1 XLM?
  - Base reserve = 0.5 XLM
  - Account requires (2 + subentries) × 0.5 XLM
  - New account has 0 subentries
  - Minimum = (2 + 0) × 0.5 = 1 XLM

What happens if you send less?
  ❌ Transaction will fail
  ❌ Error: "op_underfunded"

Recommended starting balance:
  - Testnet: 2-5 XLM (safe for testing)
  - Mainnet: 2-10 XLM (room for operations)
`);

// ============================================================
// BATCH ACCOUNT CREATION
// ============================================================
async function batchCreateAccounts(fundingSecret, count, startingBalance) {
  console.log('\n' + '═'.repeat(70));
  console.log('BATCH ACCOUNT CREATION');
  console.log('═'.repeat(70));

  console.log(`\nCreating ${count} accounts with ${startingBalance} XLM each...\n`);

  const fundingKeypair = StellarSdk.Keypair.fromSecret(fundingSecret);
  const fundingAccount = await server.loadAccount(fundingKeypair.publicKey());

  // Generate keypairs
  const newAccounts = [];
  for (let i = 0; i < count; i++) {
    newAccounts.push(StellarSdk.Keypair.random());
  }

  // Build transaction with multiple create account operations
  let transactionBuilder = new StellarSdk.TransactionBuilder(fundingAccount, {
    fee: (StellarSdk.BASE_FEE * count).toString(),
    networkPassphrase: StellarSdk.Networks.TESTNET
  });

  newAccounts.forEach((keypair, index) => {
    transactionBuilder = transactionBuilder.addOperation(
      StellarSdk.Operation.createAccount({
        destination: keypair.publicKey(),
        startingBalance: startingBalance.toString()
      })
    );
    console.log(`Account ${index + 1}: ${keypair.publicKey()}`);
  });

  const transaction = transactionBuilder.setTimeout(30).build();

  transaction.sign(fundingKeypair);

  console.log(`\nTransaction details:`);
  console.log(`  Operations: ${count}`);
  console.log(`  Total fee: ${transaction.fee} stroops`);
  console.log(`  Total XLM needed: ${count * parseFloat(startingBalance)} XLM`);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('\n✅ All accounts created successfully!');
    console.log('   Transaction: ' + result.hash);

    return newAccounts;
  } catch (error) {
    console.log('\n❌ Batch creation failed:', error.message);
    throw error;
  }
}

// ============================================================
// ACCOUNT CREATION WITH MEMO
// ============================================================
async function createAccountWithMemo(fundingSecret, newPublicKey, startingBalance, memo) {
  console.log('\n' + '═'.repeat(70));
  console.log('CREATE ACCOUNT WITH MEMO');
  console.log('═'.repeat(70));

  console.log('\nMemos help identify transactions in exchange deposits, etc.\n');

  const fundingKeypair = StellarSdk.Keypair.fromSecret(fundingSecret);
  const fundingAccount = await server.loadAccount(fundingKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(fundingAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: newPublicKey,
        startingBalance: startingBalance.toString()
      })
    )
    .addMemo(StellarSdk.Memo.text(memo))
    .setTimeout(30)
    .build();

  transaction.sign(fundingKeypair);

  console.log('   Destination: ' + newPublicKey);
  console.log('   Amount: ' + startingBalance + ' XLM');
  console.log('   Memo: "' + memo + '"');

  const result = await server.submitTransaction(transaction);
  console.log('\n✅ Account created with memo!');
  console.log('   Transaction: ' + result.hash);

  return result;
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('DEMONSTRATION');
  console.log('═'.repeat(70));

  // Generate a new keypair for demonstration
  const newKeypair = StellarSdk.Keypair.random();
  console.log('\nGenerated new keypair:');
  console.log('  Public: ' + newKeypair.publicKey());
  console.log('  Secret: ' + newKeypair.secret());

  // Method 1: Friendbot (Testnet)
  console.log('\n' + '-'.repeat(70));
  console.log('METHOD 1: Using Friendbot');
  console.log('-'.repeat(70));
  await fundWithFriendbot(newKeypair.publicKey());

  process.env.TESTNET_SECRET_KEY = 'SCJMORFLDYJ3UDXTLJSP444L6GBFC3LACSCG3T374DDPN7KE2TU6VDAT';
  // Method 2: Create Account Operation
  if (process.env.TESTNET_SECRET_KEY) {
    console.log('\n' + '-'.repeat(70));
    console.log('METHOD 2: Create Account Operation');
    console.log('-'.repeat(70));

    const newKeypair2 = StellarSdk.Keypair.random();
    console.log('\nCreating another account: ' + newKeypair2.publicKey());

    try {
      await createAccountWithOperation(
        process.env.TESTNET_SECRET_KEY,
        newKeypair2.publicKey(),
        '2' // 2 XLM starting balance
      );
    } catch (error) {
      console.log('Note: This requires a funded account in .env');
    }
  } else {
    console.log('\n⚠️  Add TESTNET_SECRET_KEY to .env to test Method 2');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Account Creation Complete!');
  console.log('='.repeat(70));

  console.log('\nKey Takeaways:');
  console.log('  1. Minimum starting balance: 1 XLM (recommend 2+ XLM)');
  console.log('  2. Testnet: Use Friendbot');
  console.log('  3. Mainnet: Use Create Account operation');
  console.log('  4. Can create multiple accounts in one transaction');
  console.log('  5. Add memos for exchange deposits');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  });
}

// Export functions for use in other modules
module.exports = {
  fundWithFriendbot,
  createAccountWithOperation,
  batchCreateAccounts,
  createAccountWithMemo
};
