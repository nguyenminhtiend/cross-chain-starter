/**
 * Phase 5: Complete End-to-End Asset Example
 *
 * This example demonstrates a complete token lifecycle:
 * 1. Create issuer and distributor accounts
 * 2. Issue a custom token
 * 3. Distribute tokens to users
 * 4. Handle multi-currency payments
 *
 * Run each step individually to avoid testnet delays.
 */

const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

// Helper: Wait for account to be available
async function waitForAccount(publicKey, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await server.loadAccount(publicKey);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`   Waiting for account... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

/**
 * STEP 1: Setup - Create issuer and distributor
 */
async function step1_setup() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  STEP 1: Account Setup                ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Create issuer
  console.log('Creating issuer account...');
  const issuerKeypair = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
  console.log('✅ Issuer:', issuerKeypair.publicKey());

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Create distributor
  console.log('\nCreating distributor account...');
  const distributorKeypair = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${distributorKeypair.publicKey()}`);
  console.log('✅ Distributor:', distributorKeypair.publicKey());

  console.log('\n🔐 SAVE THESE KEYS:\n');
  console.log('export ISSUER_SECRET="' + issuerKeypair.secret() + '"');
  console.log('export DISTRIBUTOR_SECRET="' + distributorKeypair.secret() + '"');
  console.log('export ISSUER_PUBLIC="' + issuerKeypair.publicKey() + '"');
  console.log('export DISTRIBUTOR_PUBLIC="' + distributorKeypair.publicKey() + '"');

  return { issuerKeypair, distributorKeypair };
}

/**
 * STEP 2: Issue the token
 */
async function step2_issueToken(issuerSecret, distributorSecret, assetCode, amount) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  STEP 2: Issuing ${assetCode} Tokens           ║`);
  console.log('╚════════════════════════════════════════╝\n');

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  const distributorKeypair = StellarSdk.Keypair.fromSecret(distributorSecret);

  const asset = new StellarSdk.Asset(assetCode, issuerKeypair.publicKey());
  console.log('Asset:', assetCode);
  console.log('Issuer:', issuerKeypair.publicKey());

  // Distributor creates trustline
  console.log('\n1. Distributor creating trustline...');
  const distributorAccount = await waitForAccount(distributorKeypair.publicKey());

  const trustTx = new StellarSdk.TransactionBuilder(distributorAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: amount
      })
    )
    .setTimeout(30)
    .build();

  trustTx.sign(distributorKeypair);
  await server.submitTransaction(trustTx);
  console.log('   ✅ Trustline created');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Issuer issues tokens
  console.log(`\n2. Issuing ${amount} ${assetCode}...`);
  const issuerAccount = await waitForAccount(issuerKeypair.publicKey());

  const issueTx = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: distributorKeypair.publicKey(),
        asset: asset,
        amount: amount
      })
    )
    .setTimeout(30)
    .build();

  issueTx.sign(issuerKeypair);
  const result = await server.submitTransaction(issueTx);
  console.log(`   ✅ ${amount} ${assetCode} issued!`);
  console.log('   TX:', result.hash);

  return asset;
}

/**
 * STEP 3: Distribute to a user
 */
async function step3_distributeToUser(distributorSecret, userPublicKey, asset, amount) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  STEP 3: Distribute to User           ║');
  console.log('╚════════════════════════════════════════╝\n');

  const distributorKeypair = StellarSdk.Keypair.fromSecret(distributorSecret);

  console.log('Distributor:', distributorKeypair.publicKey());
  console.log('User:', userPublicKey);
  console.log('Amount:', amount, asset.code);

  // Check if user has trustline
  console.log('\n1. Checking user trustline...');
  const userAccount = await server.loadAccount(userPublicKey);
  const hasTrustline = userAccount.balances.some(
    b => b.asset_code === asset.code && b.asset_issuer === asset.issuer
  );

  if (!hasTrustline) {
    console.log('   ❌ User must create trustline first!');
    console.log('\n   User should run:');
    console.log(`   const asset = new StellarSdk.Asset('${asset.code}', '${asset.issuer}');`);
    console.log('   // Then create trustline with changeTrust operation');
    return;
  }

  console.log('   ✅ User has trustline');

  // Send tokens
  console.log('\n2. Sending tokens...');
  const distributorAccount = await server.loadAccount(distributorKeypair.publicKey());

  const paymentTx = new StellarSdk.TransactionBuilder(distributorAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: userPublicKey,
        asset: asset,
        amount: amount
      })
    )
    .setTimeout(30)
    .build();

  paymentTx.sign(distributorKeypair);
  const result = await server.submitTransaction(paymentTx);
  console.log(`   ✅ Sent ${amount} ${asset.code}!`);
  console.log('   TX:', result.hash);
}

/**
 * STEP 4: User creates trustline (helper for users)
 */
async function step4_userCreateTrustline(userSecret, assetCode, issuerPublicKey, limit = '10000') {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  STEP 4: User Creates Trustline       ║');
  console.log('╚════════════════════════════════════════╝\n');

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
  const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

  console.log('User:', userKeypair.publicKey());
  console.log('Asset:', assetCode);
  console.log('Issuer:', issuerPublicKey);

  const userAccount = await server.loadAccount(userKeypair.publicKey());

  const trustTx = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: limit
      })
    )
    .setTimeout(30)
    .build();

  trustTx.sign(userKeypair);
  const result = await server.submitTransaction(trustTx);
  console.log('✅ Trustline created!');
  console.log('TX:', result.hash);
}

/**
 * Complete workflow demonstration
 */
async function completeWorkflow() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Complete Token Workflow              ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log('This workflow will:');
  console.log('1. Create issuer and distributor accounts');
  console.log('2. Issue DEMO tokens');
  console.log('3. Send tokens to your account\n');

  const userSecret = process.env.TESTNET_SECRET_KEY;
  if (!userSecret) {
    console.log('❌ Set TESTNET_SECRET_KEY environment variable');
    return;
  }

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
  console.log('Your account:', userKeypair.publicKey(), '\n');

  try {
    // Step 1: Setup
    const { issuerKeypair, distributorKeypair } = await step1_setup();

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Issue tokens
    const asset = await step2_issueToken(
      issuerKeypair.secret(),
      distributorKeypair.secret(),
      'DEMO',
      '1000000'
    );

    // Step 3: User creates trustline
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  STEP 3: User Creates Trustline       ║');
    console.log('╚════════════════════════════════════════╝\n');

    await step4_userCreateTrustline(
      userSecret,
      'DEMO',
      issuerKeypair.publicKey()
    );

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 4: Distribute to user
    await step3_distributeToUser(
      distributorKeypair.secret(),
      userKeypair.publicKey(),
      asset,
      '100'
    );

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  ✅ Workflow Complete!                 ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('You now have 100 DEMO tokens!');
    console.log('Check your balance on Stellar Expert:');
    console.log(`https://stellar.expert/explorer/testnet/account/${userKeypair.publicKey()}`);

  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    if (error.response?.data?.extras?.result_codes) {
      console.error('Error codes:', error.response.data.extras.result_codes);
    }
  }
}

// Export all functions
module.exports = {
  step1_setup,
  step2_issueToken,
  step3_distributeToUser,
  step4_userCreateTrustline,
  completeWorkflow
};

// Run complete workflow if executed directly
if (require.main === module) {
  completeWorkflow()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
