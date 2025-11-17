/**
 * Phase 5.1: Trustlines
 *
 * Learn how to create and manage trustlines for custom assets.
 *
 * Key Concepts:
 * - Why trustlines are needed (prevent spam)
 * - Creating a trustline with changeTrust operation
 * - Setting trustline limits
 * - Removing trustlines
 * - Checking existing trustlines
 */

const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Create a trustline to an asset
 */
async function createTrustline(userSecret, assetCode, issuerPublicKey, limit = '10000') {
  console.log('\n=== Creating Trustline ===\n');

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
  const userAccount = await server.loadAccount(userKeypair.publicKey());

  // Create asset object
  const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

  console.log('User:', userKeypair.publicKey());
  console.log('Asset Code:', assetCode);
  console.log('Issuer:', issuerPublicKey);
  console.log('Limit:', limit);

  // Build transaction with changeTrust operation
  const transaction = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: limit // Maximum amount willing to hold
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(userKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('\n✅ Trustline created successfully!');
    console.log('Transaction hash:', result.hash);
    console.log(
      'View on Stellar Expert:',
      `https://stellar.expert/explorer/testnet/tx/${result.hash}`
    );

    // Wait a moment for the network to process
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify the trustline was created
    try {
      const updatedAccount = await server.loadAccount(userKeypair.publicKey());
      const trustline = updatedAccount.balances.find(
        (b) => b.asset_code === assetCode && b.asset_issuer === issuerPublicKey
      );

      if (trustline) {
        console.log('\n📊 Trustline Details:');
        console.log('Balance:', trustline.balance);
        console.log('Limit:', trustline.limit);
        console.log('Asset Type:', trustline.asset_type);
      }
    } catch (verifyError) {
      console.log('\n⚠️  Could not immediately verify (network delay)');
      console.log('   Check the transaction on Stellar Expert to confirm');
    }

    return result;
  } catch (error) {
    console.error('\n❌ Failed to create trustline');
    if (error.response?.data?.extras?.result_codes) {
      console.error('Error codes:', error.response.data.extras.result_codes);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * Check all trustlines for an account
 */
async function checkTrustlines(publicKey) {
  console.log('\n=== Checking Trustlines ===\n');

  const account = await server.loadAccount(publicKey);

  console.log('Account:', publicKey);
  console.log('\nBalances:');

  account.balances.forEach((balance, index) => {
    console.log(`\n${index + 1}.`);
    if (balance.asset_type === 'native') {
      console.log('  Asset: XLM (native)');
      console.log('  Balance:', balance.balance);
    } else {
      console.log('  Asset Code:', balance.asset_code);
      console.log('  Issuer:', balance.asset_issuer);
      console.log('  Balance:', balance.balance);
      console.log('  Limit:', balance.limit);
    }
  });

  return account.balances;
}

/**
 * Remove a trustline (balance must be 0)
 */
async function removeTrustline(userSecret, assetCode, issuerPublicKey) {
  console.log('\n=== Removing Trustline ===\n');

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
  const userAccount = await server.loadAccount(userKeypair.publicKey());

  const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

  // Check current balance
  const trustline = userAccount.balances.find(
    (b) => b.asset_code === assetCode && b.asset_issuer === issuerPublicKey
  );

  if (!trustline) {
    console.log('❌ No trustline found for this asset');
    return;
  }

  if (parseFloat(trustline.balance) > 0) {
    console.log('❌ Cannot remove trustline with non-zero balance');
    console.log('Current balance:', trustline.balance);
    console.log('You must send the balance back to the issuer first');
    return;
  }

  // Remove trustline by setting limit to 0
  const transaction = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: '0' // Setting limit to 0 removes the trustline
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(userKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('✅ Trustline removed successfully!');
    console.log('Transaction hash:', result.hash);
    return result;
  } catch (error) {
    console.error('❌ Failed to remove trustline');
    console.error(error.response?.data?.extras?.result_codes || error.message);
    throw error;
  }
}

/**
 * Demo: Complete trustline workflow
 */
async function demo() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Phase 5.1: Trustlines Demo          ║');
  console.log('╚════════════════════════════════════════╝');

  // You'll need two accounts for this demo
  // 1. Your user account (will create the trustline)
  // 2. An issuer account (we'll create one)

  try {
    // Create a test issuer account
    console.log('\n📝 Step 1: Creating test issuer account...');
    const issuerKeypair = StellarSdk.Keypair.random();
    console.log('Issuer public key:', issuerKeypair.publicKey());

    // Fund it via friendbot
    await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
    console.log('✅ Issuer account funded');

    // Use your existing account as the user
    const userSecret = process.env.TESTNET_SECRET_KEY;
    if (!userSecret) {
      throw new Error('Please set TESTNET_SECRET_KEY environment variable');
    }

    const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
    console.log('User public key:', userKeypair.publicKey());

    // Step 2: Check balances before
    await checkTrustlines(userKeypair.publicKey());

    // Step 3: Create trustline to issuer's USD
    console.log('\n📝 Step 2: Creating trustline to USD...');
    await createTrustline(
      userSecret,
      'USD',
      issuerKeypair.publicKey(),
      '100000' // Max 100,000 USD
    );

    // Step 4: Check balances after
    await checkTrustlines(userKeypair.publicKey());

    // Step 5: Optionally remove the trustline
    console.log('\n📝 Step 3: Would you like to remove the trustline?');
    console.log('(Uncomment the code below to test removal)');

    // await removeTrustline(userSecret, 'USD', issuerKeypair.publicKey());
    // await checkTrustlines(userKeypair.publicKey());

    console.log('\n✅ Demo completed!');
    console.log('\n💡 Key Takeaways:');
    console.log('1. Trustlines are required before receiving custom assets');
    console.log("2. You set a limit for how much you're willing to hold");
    console.log('3. Trustlines can only be removed when balance is 0');
    console.log('4. Each trustline increases your minimum balance requirement');
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
  }
}

// Export functions for use in other scripts
module.exports = {
  createTrustline,
  checkTrustlines,
  removeTrustline
};

// Run demo if executed directly
if (require.main === module) {
  demo()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
