/**
 * Phase 5.4: Asset Authorization and Control
 *
 * Learn how to control and secure custom assets.
 *
 * Key Concepts:
 * - Authorization flags (AUTH_REQUIRED, AUTH_REVOCABLE, AUTH_IMMUTABLE)
 * - Approving and revoking trustlines
 * - Locking the issuer account
 * - Fixed vs unlimited supply
 */

const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Set authorization flags on an issuer account
 */
async function setAuthorizationFlags(issuerSecret, flags = {}) {
  console.log('\n=== Setting Authorization Flags ===\n');

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  console.log('Issuer:', issuerKeypair.publicKey());
  console.log('Flags to set:', flags);

  // Build flags value
  let flagsValue = 0;

  if (flags.authRequired) {
    flagsValue |= StellarSdk.AuthRequiredFlag;
    console.log('  ✓ AUTH_REQUIRED: Trustlines need approval');
  }

  if (flags.authRevocable) {
    flagsValue |= StellarSdk.AuthRevocableFlag;
    console.log('  ✓ AUTH_REVOCABLE: Can freeze assets');
  }

  if (flags.authImmutable) {
    flagsValue |= StellarSdk.AuthImmutableFlag;
    console.log('  ✓ AUTH_IMMUTABLE: Cannot change flags (permanent!)');
  }

  const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.setOptions({
        setFlags: flagsValue
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuerKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('\n✅ Authorization flags set!');
    console.log('Transaction:', result.hash);
    return result;
  } catch (error) {
    console.error('\n❌ Failed to set flags');
    console.error(error.response?.data?.extras?.result_codes || error.message);
    throw error;
  }
}

/**
 * Authorize a trustline (when AUTH_REQUIRED is set)
 */
async function authorizeTrustline(issuerSecret, trustorPublicKey, assetCode, authorize = true) {
  console.log('\n=== Authorizing Trustline ===\n');

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  const asset = new StellarSdk.Asset(assetCode, issuerKeypair.publicKey());

  console.log('Issuer:', issuerKeypair.publicKey());
  console.log('Trustor:', trustorPublicKey);
  console.log('Asset:', assetCode);
  console.log('Action:', authorize ? 'AUTHORIZE' : 'REVOKE');

  const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.setTrustLineFlags({
        trustor: trustorPublicKey,
        asset: asset,
        flags: {
          authorized: authorize
        }
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuerKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log(`\n✅ Trustline ${authorize ? 'authorized' : 'revoked'}!`);
    console.log('Transaction:', result.hash);
    return result;
  } catch (error) {
    console.error('\n❌ Failed to authorize trustline');
    console.error(error.response?.data?.extras?.result_codes || error.message);
    throw error;
  }
}

/**
 * Lock the issuer account (permanently fixes supply)
 */
async function lockIssuerAccount(issuerSecret) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  ⚠️  LOCKING ISSUER ACCOUNT  ⚠️          ║');
  console.log('╚════════════════════════════════════════╝\n');

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  console.log('Issuer:', issuerKeypair.publicKey());
  console.log('\n⚠️  WARNING: This action is IRREVERSIBLE!');
  console.log('   • No more tokens can be issued');
  console.log('   • The issuer account cannot sign transactions');
  console.log('   • Total supply becomes permanently fixed');
  console.log('   • Make sure you have issued all intended tokens!\n');

  // Calculate total supply issued
  let totalSupply = 0;
  issuerAccount.balances.forEach((balance) => {
    if (balance.asset_type !== 'native') {
      totalSupply += parseFloat(balance.balance);
    }
  });

  console.log('Current XLM balance:', issuerAccount.balances[0].balance);
  console.log('This will be the final, fixed supply.\n');

  const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.setOptions({
        masterWeight: 0, // Remove all signing power
        lowThreshold: 1,
        medThreshold: 1,
        highThreshold: 1
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuerKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('🔒 Issuer account locked successfully!');
    console.log('Transaction:', result.hash);
    console.log('\n✅ Total supply is now fixed');
    console.log('   No more tokens can ever be created');
    return result;
  } catch (error) {
    console.error('\n❌ Failed to lock account');
    console.error(error.response?.data?.extras?.result_codes || error.message);
    throw error;
  }
}

/**
 * Check if an account is locked
 */
async function checkIfLocked(publicKey) {
  console.log('\n=== Checking Account Lock Status ===\n');

  const account = await server.loadAccount(publicKey);

  console.log('Account:', publicKey);

  // Check master weight
  const masterSigner = account.signers.find((s) => s.key === publicKey);

  if (!masterSigner || masterSigner.weight === 0) {
    console.log('🔒 Account is LOCKED');
    console.log('   Master key weight: 0');
    console.log('   This account cannot sign transactions');
    return true;
  } else {
    console.log('🔓 Account is UNLOCKED');
    console.log('   Master key weight:', masterSigner.weight);
    console.log('   This account can still sign transactions');
    return false;
  }
}

/**
 * Get account flags
 */
async function getAccountFlags(publicKey) {
  console.log('\n=== Account Authorization Flags ===\n');

  const account = await server.loadAccount(publicKey);

  console.log('Account:', publicKey);
  console.log('\nFlags:');

  console.log('  AUTH_REQUIRED:', account.flags.auth_required);
  console.log('    → Users need approval to hold assets');

  console.log('  AUTH_REVOCABLE:', account.flags.auth_revocable);
  console.log('    → Issuer can freeze/unfreeze assets');

  console.log('  AUTH_IMMUTABLE:', account.flags.auth_immutable);
  console.log('    → Authorization flags are locked');

  return account.flags;
}

/**
 * Demo: Asset control workflow
 */
async function demo() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Phase 5.4: Asset Control             ║');
  console.log('╚════════════════════════════════════════╝');

  console.log('\n💡 This demo shows asset control concepts.');
  console.log('   Run individual functions to test specific features.\n');

  console.log('Key Functions:\n');

  console.log('1. setAuthorizationFlags(issuerSecret, flags)');
  console.log('   Set AUTH_REQUIRED, AUTH_REVOCABLE, or AUTH_IMMUTABLE');
  console.log('   Example: { authRequired: true, authRevocable: true }\n');

  console.log('2. authorizeTrustline(issuerSecret, trustorPubKey, assetCode, true/false)');
  console.log("   Approve or revoke a user's trustline\n");

  console.log('3. lockIssuerAccount(issuerSecret)');
  console.log('   Permanently lock the issuer (fixes supply forever!)\n');

  console.log('4. checkIfLocked(publicKey)');
  console.log('   Check if an account is locked\n');

  console.log('5. getAccountFlags(publicKey)');
  console.log('   View current authorization flags\n');

  // Example: Check flags on your account
  const userSecret = process.env.TESTNET_SECRET_KEY;
  if (userSecret) {
    const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
    await getAccountFlags(userKeypair.publicKey());
    await checkIfLocked(userKeypair.publicKey());
  }

  console.log('\n✅ Phase 5.4 concepts covered!');
  console.log('\n🔒 Authorization Best Practices:');
  console.log('   • Use AUTH_REQUIRED for KYC/AML compliance');
  console.log('   • Use AUTH_REVOCABLE for fraud prevention');
  console.log('   • Use AUTH_IMMUTABLE to lock settings permanently');
  console.log('   • Lock issuer after final issuance for fixed supply');
  console.log('   • Test thoroughly on testnet before locking!');
}

// Export functions
module.exports = {
  setAuthorizationFlags,
  authorizeTrustline,
  lockIssuerAccount,
  checkIfLocked,
  getAccountFlags
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
