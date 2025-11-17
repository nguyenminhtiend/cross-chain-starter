/**
 * Phase 6.6: Path Finder (Fixed)
 *
 * Direct Horizon API calls to avoid SDK issues
 */

require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Find paths using direct Horizon API call (workaround for SDK bug)
 */
async function findPathsDirectAPI(sourceAsset, sourceAmount, destinationAccounts) {
  console.log('\n🔍 Finding Send Paths (Direct API)');
  console.log('═══════════════════════════════════════');
  console.log('Source asset:', sourceAsset.code || 'XLM');
  console.log('Source amount:', sourceAmount);
  console.log('Destinations:', destinationAccounts.length);

  // Build the URL manually
  const baseUrl = 'https://horizon-testnet.stellar.org/paths/strict-send';

  // Build query parameters
  const params = new URLSearchParams();

  // Add source asset
  if (sourceAsset.isNative()) {
    params.append('source_asset_type', 'native');
  } else {
    params.append('source_asset_type', sourceAsset.getAssetType());
    params.append('source_asset_code', sourceAsset.getCode());
    params.append('source_asset_issuer', sourceAsset.getIssuer());
  }

  params.append('source_amount', sourceAmount);

  // Add destination accounts
  destinationAccounts.forEach(account => {
    params.append('destination_assets', account);
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data._embedded && data._embedded.records) {
      const paths = data._embedded.records;

      console.log(`\n✅ Found ${paths.length} path(s):\n`);

      paths.slice(0, 5).forEach((path, index) => {
        console.log(`📍 Path ${index + 1}:`);
        console.log('  Source amount:', path.source_amount, sourceAsset.code || 'XLM');
        console.log('  Dest amount:', path.destination_amount);
        console.log('  Dest asset:', path.destination_asset_code || 'XLM');

        if (path.path && path.path.length > 0) {
          const pathStr = path.path.map(p => p.asset_code || 'XLM').join(' → ');
          console.log('  Path:', sourceAsset.code || 'XLM', '→', pathStr, '→', path.destination_asset_code || 'XLM');
        } else {
          console.log('  Path: Direct');
        }
        console.log('');
      });

      return paths;
    } else {
      console.log('\nℹ️  No paths found');
      return [];
    }
  } catch (error) {
    console.error('Error:', error.message);
    return [];
  }
}

/**
 * Test path finding with various scenarios
 */
async function testPathScenarios() {
  const myPublic = process.env.TESTNET_PUBLIC_KEY;

  if (!myPublic) {
    console.error('❌ Please set TESTNET_PUBLIC_KEY in .env file');
    return;
  }

  console.log('\n🎯 Path Finding Tests');
  console.log('═══════════════════════════════════════════════════');
  console.log('Account:', myPublic);

  const XLM = StellarSdk.Asset.native();
  const USDC = new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');

  // Test 1: XLM to any asset the destination can receive
  console.log('\n' + '='.repeat(50));
  console.log('TEST 1: XLM → Any Asset (Strict Send)');
  console.log('='.repeat(50));
  await findPathsDirectAPI(XLM, '100', [myPublic]);

  // Test 2: Strict Receive - works with SDK
  console.log('\n' + '='.repeat(50));
  console.log('TEST 2: Any Asset → USDC (Strict Receive)');
  console.log('='.repeat(50));

  try {
    const paths = await server
      .strictReceivePaths(myPublic, USDC, '10')
      .call();

    console.log(`\n✅ Found ${paths.records.length} path(s):\n`);

    paths.records.slice(0, 3).forEach((path, idx) => {
      const sourceAsset = path.source_asset_type === 'native' ? 'XLM' : path.source_asset_code;
      console.log(`📍 Path ${idx + 1}:`);
      console.log('  Send:', path.source_amount, sourceAsset);
      console.log('  Receive: 10 USDC (exact)');
      console.log('  Rate:', (parseFloat(path.source_amount) / 10).toFixed(4), sourceAsset, 'per USDC');
      console.log('');
    });
  } catch (error) {
    console.log('ℹ️  No paths found:', error.message);
  }

  // Test 3: Check what assets you can receive
  console.log('\n' + '='.repeat(50));
  console.log('TEST 3: What Can I Receive for 100 XLM?');
  console.log('='.repeat(50));

  console.log('\n💡 Checking order book to see available assets...\n');

  const testPairs = [
    { asset: USDC, name: 'USDC' },
    { asset: new StellarSdk.Asset('yUSDC', 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF'), name: 'yUSDC' }
  ];

  for (const pair of testPairs) {
    try {
      const orderbook = await server
        .orderbook(XLM, pair.asset)
        .limit(1)
        .call();

      if (orderbook.asks.length > 0) {
        const bestAsk = parseFloat(orderbook.asks[0].price);
        const wouldReceive = 100 / bestAsk;
        console.log(`✅ ${pair.name}: ~${wouldReceive.toFixed(2)} ${pair.name} (at ${bestAsk} XLM per ${pair.name})`);
      } else {
        console.log(`ℹ️  ${pair.name}: No sellers available`);
      }
    } catch (error) {
      console.log(`⚠️  ${pair.name}: Error checking`);
    }
  }
}

/**
 * Show practical example of using path payments
 */
async function showPracticalExample() {
  console.log('\n\n' + '='.repeat(50));
  console.log('PRACTICAL EXAMPLE: How to Use Path Payments');
  console.log('='.repeat(50));

  console.log(`
📖 SCENARIO: Cross-Currency Payment
───────────────────────────────────

You want to send money where:
  • You have: XLM
  • Recipient wants: USDC
  • Stellar finds the best path automatically

STEP-BY-STEP PROCESS:

1️⃣  Find Available Paths
   Use: strictReceivePaths (more reliable)

   const paths = await server
     .strictReceivePaths(
       yourPublicKey,
       recipientAsset,  // USDC
       '100'            // They receive 100 USDC
     )
     .call();

2️⃣  Choose Best Path

   const bestPath = paths.records[0];
   console.log('You will send:', bestPath.source_amount, 'XLM');
   console.log('They will receive: 100 USDC');

3️⃣  Add Slippage Protection (1-2%)

   const maxSend = parseFloat(bestPath.source_amount) * 1.02;

4️⃣  Execute Path Payment

   const transaction = new StellarSdk.TransactionBuilder(account, {...})
     .addOperation(
       StellarSdk.Operation.pathPaymentStrictReceive({
         sendAsset: XLM,
         sendMax: maxSend.toString(),
         destination: recipientKey,
         destAsset: USDC,
         destAmount: '100',
         path: bestPath.path  // Intermediate assets
       })
     )
     .build();

✅ RESULT:
   • You send at most ~102-103 XLM (with slippage)
   • They receive exactly 100 USDC
   • If price moves unfavorably, transaction fails (no partial fills)
   • All happens atomically (can't fail halfway)

🎯 KEY POINTS:
   • Use strictReceive for exact recipient amounts
   • Always add slippage tolerance
   • Path payment = send + exchange in one operation
   • No intermediaries needed
   • Works across any assets on Stellar
  `);
}

/**
 * Main function
 */
async function main() {
  try {
    await testPathScenarios();
    await showPracticalExample();

    console.log('\n' + '='.repeat(50));
    console.log('📚 Summary');
    console.log('='.repeat(50));
    console.log(`
✅ What Works:
   • strictReceivePaths (specify exact receive amount)
   • Order book queries
   • Direct Horizon API calls

⚠️  Known Issue:
   • strictSendPaths has a SDK bug with asset type checking
   • Workaround: Use strictReceive or direct API

💡 Best Practice:
   • Use strictReceive for most use cases
   • Add 1-2% slippage tolerance
   • Check order book before large trades
   • Test on testnet first

🚀 Next Steps:
   1. Try the phase6.2-path-payments.js pathPaymentStrictReceive function
   2. Use the working strictReceive endpoint
   3. Execute actual cross-currency payments on testnet
    `);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  findPathsDirectAPI,
  testPathScenarios
};
