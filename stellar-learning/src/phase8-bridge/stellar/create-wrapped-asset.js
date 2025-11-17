/**
 * Create Wrapped ETH Asset on Stellar
 * This script creates a wETH asset that represents ETH locked on Ethereum
 */

const StellarSdk = require('@stellar/stellar-sdk');
const { config } = require('../config');

async function createWrappedETH() {
  console.log('🌟 Creating Wrapped ETH Asset on Stellar\n');

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

  // Check if issuer account exists
  if (!config.stellar.issuerSecret) {
    console.error('❌ STELLAR_ISSUER_SECRET not configured');
    console.log('\n📝 Steps to create issuer account:');
    console.log('1. Generate new keypair:');
    console.log('   const keypair = StellarSdk.Keypair.random();');
    console.log('2. Fund on testnet: https://laboratory.stellar.org/#account-creator');
    console.log('3. Add to .env file\n');
    return;
  }

  const issuerKeypair = StellarSdk.Keypair.fromSecret(config.stellar.issuerSecret);

  try {
    // Load issuer account
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    console.log('✅ Issuer Account Found');
    console.log('   Public Key:', issuerKeypair.publicKey());
    console.log('   Balances:', issuerAccount.balances.map(b =>
      `${b.balance} ${b.asset_code || 'XLM'}`
    ).join(', '));

    // Create wETH asset
    const wETH = new StellarSdk.Asset(config.bridge.assetCode, issuerKeypair.publicKey());

    console.log('\n✅ Wrapped ETH Asset Created');
    console.log('   Asset Code:', config.bridge.assetCode);
    console.log('   Issuer:', issuerKeypair.publicKey());
    console.log('\n📋 Asset Info:');
    console.log(`   Full Asset: ${config.bridge.assetCode}:${issuerKeypair.publicKey()}`);
    console.log('\n🔗 View on Stellar Expert:');
    console.log(`   https://stellar.expert/explorer/testnet/asset/${config.bridge.assetCode}-${issuerKeypair.publicKey()}`);

    // Check if issuer has set home domain or other asset properties
    const accountData = await server.loadAccount(issuerKeypair.publicKey());
    if (accountData.home_domain) {
      console.log('\n🏠 Home Domain:', accountData.home_domain);
    }

    console.log('\n✨ Asset is ready for bridge operations!');
    console.log('\n📖 Next steps:');
    console.log('1. Users must establish trustlines to receive wETH');
    console.log('2. Deploy Ethereum bridge contract');
    console.log('3. Start the relayer service');

    return wETH;

  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('❌ Issuer account not found on network');
      console.log('\n📝 To create issuer account:');
      console.log('1. Visit: https://laboratory.stellar.org/#account-creator?network=test');
      console.log('2. Enter public key:', issuerKeypair.publicKey());
      console.log('3. Click "Get test network lumens"');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

/**
 * Setup trustline for a user to receive wETH
 */
async function setupTrustline(userSecret) {
  console.log('\n💫 Setting up wETH trustline\n');

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);
  const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
  const issuerPublicKey = config.stellar.issuerPublic;

  try {
    const userAccount = await server.loadAccount(userKeypair.publicKey());
    const wETH = new StellarSdk.Asset(config.bridge.assetCode, issuerPublicKey);

    // Check if trustline already exists
    const existingTrust = userAccount.balances.find(
      b => b.asset_code === config.bridge.assetCode && b.asset_issuer === issuerPublicKey
    );

    if (existingTrust) {
      console.log('✅ Trustline already exists');
      console.log('   Balance:', existingTrust.balance, config.bridge.assetCode);
      return;
    }

    // Create trustline
    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: wETH,
          limit: '1000000', // Max 1M wETH
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(userKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('✅ Trustline established!');
    console.log('   Transaction:', result.hash);
    console.log('   User can now receive', config.bridge.assetCode);

  } catch (error) {
    console.error('❌ Error setting up trustline:', error.message);
  }
}

// Run if executed directly
if (require.main === module) {
  createWrappedETH().catch(console.error);
}

module.exports = {
  createWrappedETH,
  setupTrustline,
};
