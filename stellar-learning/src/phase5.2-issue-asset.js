/**
 * Phase 5.2: Issuing Custom Assets
 *
 * Learn how to create and issue your own tokens on Stellar.
 *
 * Key Concepts:
 * - Issuer account vs Distribution account
 * - Creating custom assets
 * - Issuing tokens to a distribution account
 * - Best practices for asset issuance
 */

const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Load account with retries (handles network delays)
 */
async function loadAccountWithRetry(publicKey, maxRetries = 3, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await server.loadAccount(publicKey);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`   ⏳ Waiting for account to be available (attempt ${i + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Issue a custom asset following best practices
 */
async function issueCustomAsset(assetCode, initialSupply) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  Issuing ${assetCode} Token                   ║`);
  console.log('╚════════════════════════════════════════╝\n');

  // Step 1: Create issuer account
  console.log('📝 Step 1: Creating issuer account...');
  const issuerKeypair = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
  console.log('✅ Issuer created');
  console.log('   Public:', issuerKeypair.publicKey());
  console.log('   Secret:', issuerKeypair.secret());

  // Wait for account to be available on Horizon
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 2: Create distribution account
  console.log('\n📝 Step 2: Creating distribution account...');
  const distributorKeypair = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${distributorKeypair.publicKey()}`);
  console.log('✅ Distributor created');
  console.log('   Public:', distributorKeypair.publicKey());

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 3: Create the asset
  const asset = new StellarSdk.Asset(assetCode, issuerKeypair.publicKey());
  console.log('\n📝 Step 3: Asset defined');
  console.log('   Code:', assetCode);
  console.log('   Issuer:', issuerKeypair.publicKey());

  // Step 4: Distribution account creates trustline to issuer's asset
  console.log('\n📝 Step 4: Distribution account trusts issuer...');
  const distributorAccount = await loadAccountWithRetry(distributorKeypair.publicKey());

  const trustTransaction = new StellarSdk.TransactionBuilder(distributorAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: initialSupply // Set limit to expected supply
      })
    )
    .setTimeout(30)
    .build();

  trustTransaction.sign(distributorKeypair);
  const trustResult = await server.submitTransaction(trustTransaction);
  console.log('✅ Trustline created');
  console.log('   TX:', trustResult.hash);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 5: Issuer sends tokens to distributor (this creates the tokens!)
  console.log(`\n📝 Step 5: Issuing ${initialSupply} ${assetCode}...`);
  const issuerAccount = await loadAccountWithRetry(issuerKeypair.publicKey());

  const issueTransaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: distributorKeypair.publicKey(),
        asset: asset,
        amount: initialSupply
      })
    )
    .setTimeout(30)
    .build();

  issueTransaction.sign(issuerKeypair);
  const issueResult = await server.submitTransaction(issueTransaction);
  console.log(`✅ ${initialSupply} ${assetCode} issued!`);
  console.log('   TX:', issueResult.hash);
  console.log('   View:', `https://stellar.expert/explorer/testnet/tx/${issueResult.hash}`);

  // Step 6: Verify balances
  console.log('\n📝 Step 6: Verifying balances...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const updatedDistributor = await server.loadAccount(distributorKeypair.publicKey());
    const balance = updatedDistributor.balances.find(
      b => b.asset_code === assetCode
    );

    if (balance) {
      console.log('✅ Distribution account balance:');
      console.log(`   ${balance.balance} ${assetCode}`);
    }
  } catch (error) {
    console.log('⚠️  Could not verify balance (check Stellar Expert)');
  }

  console.log('\n🎉 Asset issuance complete!\n');
  console.log('💡 Important Notes:');
  console.log('   • Issuer account should be secured (cold storage)');
  console.log('   • Distribution account handles daily operations');
  console.log('   • You can issue more tokens later from the issuer');
  console.log('   • Consider locking the issuer to fix total supply');

  return {
    issuer: issuerKeypair,
    distributor: distributorKeypair,
    asset: asset
  };
}

/**
 * Send custom asset from one account to another
 */
async function sendCustomAsset(senderSecret, recipientPublicKey, asset, amount) {
  console.log('\n=== Sending Custom Asset ===\n');

  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  console.log('From:', senderKeypair.publicKey());
  console.log('To:', recipientPublicKey);
  console.log('Amount:', amount, asset.code);

  // Check sender has sufficient balance
  const senderBalance = senderAccount.balances.find(
    b => b.asset_code === asset.code && b.asset_issuer === asset.issuer
  );

  if (!senderBalance) {
    throw new Error('Sender does not have a trustline to this asset');
  }

  if (parseFloat(senderBalance.balance) < parseFloat(amount)) {
    throw new Error(`Insufficient balance. Have: ${senderBalance.balance}, need: ${amount}`);
  }

  // Build payment transaction
  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: asset,
        amount: amount.toString()
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(senderKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('\n✅ Payment sent successfully!');
    console.log('TX:', result.hash);
    console.log('View:', `https://stellar.expert/explorer/testnet/tx/${result.hash}`);
    return result;
  } catch (error) {
    console.error('\n❌ Payment failed');

    if (error.response?.data?.extras?.result_codes) {
      const codes = error.response.data.extras.result_codes;
      console.error('Error codes:', codes);

      if (codes.operations?.includes('op_no_trust')) {
        console.error('\n💡 Recipient must create a trustline first!');
      }
    }
    throw error;
  }
}

/**
 * Demo: Complete asset issuance and distribution workflow
 */
async function demo() {
  try {
    // Issue a new token
    const { issuer, distributor, asset } = await issueCustomAsset('GOLD', '1000000');

    console.log('\n' + '='.repeat(50));
    console.log('DISTRIBUTION PHASE');
    console.log('='.repeat(50));

    // Now let's send some tokens to a user
    console.log('\n📝 Sending tokens to a user account...');

    // Get user account from environment
    const userSecret = process.env.TESTNET_SECRET_KEY;
    if (!userSecret) {
      throw new Error('Set TESTNET_SECRET_KEY to test distribution');
    }

    const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
    console.log('User account:', userKeypair.publicKey());

    // First, user must create trustline
    console.log('\n📝 User creating trustline to GOLD...');
    const userAccount = await server.loadAccount(userKeypair.publicKey());

    const trustTx = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: asset,
          limit: '10000'
        })
      )
      .setTimeout(30)
      .build();

    trustTx.sign(userKeypair);
    await server.submitTransaction(trustTx);
    console.log('✅ User trustline created');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Now distributor can send tokens to user
    console.log('\n📝 Distributor sending 100 GOLD to user...');
    await sendCustomAsset(
      distributor.secret(),
      userKeypair.publicKey(),
      asset,
      '100'
    );

    console.log('\n✅ Demo completed successfully!');
    console.log('\n📋 Save These Keys:\n');
    console.log('Issuer Secret:', issuer.secret());
    console.log('Distributor Secret:', distributor.secret());
    console.log('\nAsset Details:');
    console.log(`Code: ${asset.code}`);
    console.log(`Issuer: ${asset.issuer}`);

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
  }
}

// Export functions
module.exports = {
  issueCustomAsset,
  sendCustomAsset
};

// Run demo if executed directly
if (require.main === module) {
  demo()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
