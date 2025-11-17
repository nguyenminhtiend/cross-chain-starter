/**
 * Phase 5.3: Working with Real-World Assets
 *
 * Learn to interact with real assets on Stellar like USDC.
 *
 * Key Concepts:
 * - Finding popular assets
 * - Creating trustlines to real assets
 * - Checking asset information
 * - Understanding asset issuers
 */

const StellarSdk = require('@stellar/stellar-sdk');
const { StellarTomlResolver } = require('@stellar/stellar-sdk');

require('dotenv').config();

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

// Popular assets on Stellar Mainnet
const MAINNET_ASSETS = {
  USDC: new StellarSdk.Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
  yXLM: new StellarSdk.Asset('yXLM', 'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55'),
  AQUA: new StellarSdk.Asset('AQUA', 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA')
};

/**
 * Get asset information from stellar.toml
 */
async function getAssetInfo(domain) {
  console.log(`\n=== Fetching Asset Info from ${domain} ===\n`);

  try {
    const toml = await StellarTomlResolver.resolve(domain);

    console.log('Organization:', toml.DOCUMENTATION?.ORG_NAME);
    console.log('URL:', toml.DOCUMENTATION?.ORG_URL);
    console.log('\nCurrencies:');

    if (toml.CURRENCIES) {
      toml.CURRENCIES.forEach((currency, index) => {
        console.log(`\n${index + 1}. ${currency.code}`);
        console.log('   Issuer:', currency.issuer);
        console.log('   Description:', currency.desc);
        if (currency.conditions) {
          console.log('   Terms:', currency.conditions);
        }
      });
    }

    return toml;
  } catch (error) {
    console.error('❌ Failed to fetch stellar.toml');
    console.error(error.message);
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Explore an asset on the network
 */
async function exploreAsset(assetCode, issuer) {
  console.log('\n=== Exploring Asset ===\n');
  console.log('Code:', assetCode);
  console.log('Issuer:', issuer);

  try {
    // Get asset details from Horizon
    const asset = await server.assets().forCode(assetCode).forIssuer(issuer).call();

    if (asset.records.length > 0) {
      const assetData = asset.records[0];

      console.log('\n📊 Asset Statistics:');
      console.log('Number of accounts:', assetData.num_accounts);
      console.log('Number of claimable balances:', assetData.num_claimable_balances);
      console.log('Total supply:', assetData.amount);
      console.log('Authorization required:', assetData.flags.auth_required);
      console.log('Authorization revocable:', assetData.flags.auth_revocable);

      return assetData;
    } else {
      console.log('\n⚠️  No data found for this asset');
      console.log('   It may be new or on testnet');
    }
  } catch (error) {
    console.error('\n❌ Error exploring asset:', error.message);
  }
}

/**
 * Get all balances for an account (including all trusted assets)
 */
async function getAllBalances(publicKey) {
  console.log('\n=== Account Balances ===\n');
  console.log('Account:', publicKey);

  try {
    const account = await server.loadAccount(publicKey);

    console.log('\n💰 Balances:');
    account.balances.forEach((balance, index) => {
      console.log(`\n${index + 1}.`);

      if (balance.asset_type === 'native') {
        console.log('   Asset: XLM (native)');
        console.log('   Balance:', balance.balance);
      } else {
        console.log('   Asset:', balance.asset_code);
        console.log('   Issuer:', balance.asset_issuer);
        console.log('   Balance:', balance.balance);
        console.log('   Limit:', balance.limit);
        console.log('   Authorized:', balance.is_authorized !== false);
      }
    });

    console.log('\n📈 Account Stats:');
    console.log('Sequence:', account.sequence);
    console.log('Subentry count:', account.subentry_count);
    console.log('Number of signers:', account.signers.length);

    return account.balances;
  } catch (error) {
    console.error('\n❌ Error fetching balances:', error.message);
  }
}

/**
 * Create trustline to a well-known asset
 */
async function trustWellKnownAsset(userSecret, assetCode, issuer, limit = '100000') {
  console.log('\n=== Creating Trustline to Well-Known Asset ===\n');

  const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
  const asset = new StellarSdk.Asset(assetCode, issuer);

  console.log('User:', userKeypair.publicKey());
  console.log('Asset:', assetCode);
  console.log('Issuer:', issuer);

  try {
    const userAccount = await server.loadAccount(userKeypair.publicKey());

    // Check if trustline already exists
    const existingTrustline = userAccount.balances.find(
      (b) => b.asset_code === assetCode && b.asset_issuer === issuer
    );

    if (existingTrustline) {
      console.log('\n✅ Trustline already exists!');
      console.log('Current balance:', existingTrustline.balance);
      console.log('Current limit:', existingTrustline.limit);
      return;
    }

    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
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

    transaction.sign(userKeypair);

    const result = await server.submitTransaction(transaction);
    console.log('\n✅ Trustline created successfully!');
    console.log('Transaction:', result.hash);
    console.log('View:', `https://stellar.expert/explorer/testnet/tx/${result.hash}`);
  } catch (error) {
    console.error('\n❌ Failed to create trustline');
    if (error.response?.data?.extras?.result_codes) {
      console.error('Error codes:', error.response.data.extras.result_codes);
    } else {
      console.error(error.message);
    }
  }
}

/**
 * Search for assets by code
 */
async function searchAssets(assetCode) {
  console.log(`\n=== Searching for "${assetCode}" Assets ===\n`);

  try {
    const assets = await server.assets().forCode(assetCode).limit(10).call();

    console.log(`Found ${assets.records.length} issuers of ${assetCode}:\n`);

    assets.records.forEach((asset, index) => {
      console.log(`${index + 1}. Issuer: ${asset.asset_issuer}`);
      console.log(`   Accounts: ${asset.num_accounts}`);
      console.log(`   Supply: ${asset.amount}`);
      console.log(`   Auth required: ${asset.flags.auth_required}`);
      console.log('');
    });

    return assets.records;
  } catch (error) {
    console.error('❌ Error searching assets:', error.message);
  }
}

/**
 * Demo: Explore real-world assets
 */
async function demo() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Phase 5.3: Real-World Assets         ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    // 1. Show popular mainnet assets
    console.log('\n📋 Popular Assets on Stellar Mainnet:\n');
    console.log('1. USDC - Circle USD Coin');
    console.log('   Issuer:', MAINNET_ASSETS.USDC.issuer);
    console.log('   Use: Stablecoin pegged to USD');

    console.log('\n2. yXLM - Ultra Stellar (Yield XLM)');
    console.log('   Issuer:', MAINNET_ASSETS.yXLM.issuer);
    console.log('   Use: Liquid staking derivative');

    console.log('\n3. AQUA - AquariusMarket');
    console.log('   Issuer:', MAINNET_ASSETS.AQUA.issuer);
    console.log('   Use: Governance and rewards token');

    // 2. Get info from stellar.toml (optional - may fail if domain is unavailable)
    console.log('\n' + '='.repeat(50));
    console.log('Example: Fetching USDC issuer info');
    console.log('='.repeat(50));

    try {
      await getAssetInfo('centre.io'); // USDC issuer
    } catch (error) {
      console.log('\n⚠️  Note: stellar.toml fetching may fail due to:');
      console.log('   - Domain no longer serving stellar.toml');
      console.log('   - CORS restrictions');
      console.log('   - Network connectivity issues');
      console.log('\n💡 You can still verify assets by checking:');
      console.log('   - Asset statistics on Horizon');
      console.log('   - stellar.expert explorer');
      console.log('   - Official project documentation');
    }

    // 3. Check your balances
    const userSecret = process.env.TESTNET_SECRET_KEY;
    if (userSecret) {
      const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
      await getAllBalances(userKeypair.publicKey());
    } else {
      console.log('\n💡 Set TESTNET_SECRET_KEY to check your balances');
    }

    // 4. Search for assets
    console.log('\n' + '='.repeat(50));
    console.log('Searching for USD assets on testnet');
    console.log('='.repeat(50));

    await searchAssets('USD');

    console.log('\n✅ Demo completed!');
    console.log('\n💡 Key Takeaways:');
    console.log('1. Always verify asset issuers before trusting');
    console.log('2. Check stellar.toml for official asset information');
    console.log('3. Popular assets have high account counts and supply');
    console.log('4. Be cautious of fake assets with similar names');
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
  }
}

// Export functions
module.exports = {
  getAssetInfo,
  exploreAsset,
  getAllBalances,
  trustWellKnownAsset,
  searchAssets,
  MAINNET_ASSETS
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
