/**
 * Phase 6.5: Test Path Finding
 *
 * A focused script to test path finding with real testnet assets
 */

require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Test finding paths with better error handling
 */
async function testPathFinding() {
  const myPublic = process.env.TESTNET_PUBLIC_KEY;

  if (!myPublic) {
    console.error('❌ Please set TESTNET_PUBLIC_KEY in .env file');
    return;
  }

  console.log('\n🔍 Testing Path Finding on Stellar Testnet');
  console.log('═══════════════════════════════════════════════════');
  console.log('Your account:', myPublic);
  console.log('');

  // Define assets
  const XLM = StellarSdk.Asset.native();

  // Well-known testnet assets
  const testAssets = [
    {
      name: 'USDC (CircleCI)',
      asset: new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')
    },
    {
      name: 'USDC (AnchorUSD)',
      asset: new StellarSdk.Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN')
    },
    {
      name: 'yUSDC (Test)',
      asset: new StellarSdk.Asset('yUSDC', 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF')
    }
  ];

  console.log('💡 Testing paths from XLM to various assets...\n');

  for (const testAsset of testAssets) {
    console.log(`\n📍 Testing: XLM → ${testAsset.name}`);
    console.log('─────────────────────────────────────────────────');

    try {
      // Use the Horizon API directly for more control
      const pathsUrl = server.strictSendPaths(XLM, '100', [myPublic]);

      console.log(`   Querying: ${pathsUrl.url}...`);

      const paths = await pathsUrl.call();

      if (paths.records.length === 0) {
        console.log('   ℹ️  No paths found (no liquidity)');
      } else {
        console.log(`   ✅ Found ${paths.records.length} path(s)!\n`);

        // Show first 3 paths
        paths.records.slice(0, 3).forEach((path, idx) => {
          console.log(`   Path ${idx + 1}:`);
          console.log(`     Send: 100 XLM`);
          console.log(`     Receive: ${path.destination_amount} ${path.destination_asset_code || 'XLM'}`);

          if (path.path && path.path.length > 0) {
            const pathStr = path.path.map(p => p.asset_code || 'XLM').join(' → ');
            console.log(`     Route: XLM → ${pathStr} → ${path.destination_asset_code || 'XLM'}`);
          } else {
            console.log(`     Route: Direct`);
          }
          console.log('');
        });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('   ℹ️  No paths available');
      } else {
        console.log('   ⚠️  Error:', error.message);
      }
    }
  }

  // Test reverse: various assets to XLM
  console.log('\n\n💡 Testing paths from various assets to XLM...\n');

  for (const testAsset of testAssets) {
    console.log(`\n📍 Testing: ${testAsset.name} → XLM`);
    console.log('─────────────────────────────────────────────────');

    try {
      const paths = await server
        .strictSendPaths(testAsset.asset, '100', [myPublic])
        .call();

      if (paths.records.length === 0) {
        console.log('   ℹ️  No paths found (no liquidity)');
      } else {
        console.log(`   ✅ Found ${paths.records.length} path(s)!`);

        const xlmPaths = paths.records.filter(p => p.destination_asset_type === 'native');
        if (xlmPaths.length > 0) {
          console.log(`   ${xlmPaths.length} path(s) to XLM:`);
          xlmPaths.slice(0, 2).forEach((path, idx) => {
            console.log(`     Path ${idx + 1}: 100 ${testAsset.asset.code} → ${path.destination_amount} XLM`);
          });
        }
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('   ℹ️  No paths available');
      } else {
        console.log('   ⚠️  Error:', error.message);
      }
    }
  }
}

/**
 * Test strict receive paths (specify what you want to receive)
 */
async function testStrictReceivePaths() {
  const myPublic = process.env.TESTNET_PUBLIC_KEY;

  console.log('\n\n🎯 Testing Strict Receive Paths');
  console.log('═══════════════════════════════════════════════════');
  console.log('(Specify exact amount to receive)\n');

  const XLM = StellarSdk.Asset.native();
  const USDC = new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');

  try {
    console.log('📍 Finding paths to receive exactly 10 USDC');
    console.log('   (How much XLM would I need to send?)\n');

    const paths = await server
      .strictReceivePaths(myPublic, USDC, '10')
      .call();

    if (paths.records.length === 0) {
      console.log('   ℹ️  No paths found');
    } else {
      console.log(`   ✅ Found ${paths.records.length} path(s):\n`);

      paths.records.slice(0, 3).forEach((path, idx) => {
        const sourceAsset = path.source_asset_type === 'native' ? 'XLM' : path.source_asset_code;
        console.log(`   Path ${idx + 1}:`);
        console.log(`     Send: ${path.source_amount} ${sourceAsset}`);
        console.log(`     Receive: 10 USDC (exact)`);
        console.log(`     Rate: ${(parseFloat(path.source_amount) / 10).toFixed(4)} ${sourceAsset} per USDC\n`);
      });
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('   ℹ️  No paths available (no liquidity in DEX)');
    } else {
      console.log('   ⚠️  Error:', error.message);
    }
  }
}

/**
 * Show available trading pairs with liquidity
 */
async function showAvailablePairs() {
  console.log('\n\n📊 Checking Available Trading Pairs');
  console.log('═══════════════════════════════════════════════════\n');

  const pairs = [
    {
      base: StellarSdk.Asset.native(),
      counter: new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
      name: 'XLM/USDC'
    },
    {
      base: StellarSdk.Asset.native(),
      counter: new StellarSdk.Asset('yUSDC', 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF'),
      name: 'XLM/yUSDC'
    }
  ];

  for (const pair of pairs) {
    try {
      console.log(`📍 ${pair.name}`);

      const orderbook = await server
        .orderbook(pair.base, pair.counter)
        .limit(5)
        .call();

      const hasBids = orderbook.bids.length > 0;
      const hasAsks = orderbook.asks.length > 0;

      if (hasBids || hasAsks) {
        console.log(`   ✅ Active market`);
        console.log(`   Bids: ${orderbook.bids.length} | Asks: ${orderbook.asks.length}`);

        if (hasBids && hasAsks) {
          const bestBid = parseFloat(orderbook.bids[0].price);
          const bestAsk = parseFloat(orderbook.asks[0].price);
          const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(2);
          console.log(`   Best bid: ${bestBid.toFixed(7)} | Best ask: ${bestAsk.toFixed(7)}`);
          console.log(`   Spread: ${spread}%`);
        }
      } else {
        console.log(`   ℹ️  No active orders`);
      }
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Error checking pair: ${error.message}\n`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Test path finding
    await testPathFinding();

    // Test strict receive paths
    await testStrictReceivePaths();

    // Show available pairs
    await showAvailablePairs();

    console.log('\n✅ Path finding tests complete!');
    console.log('\n💡 Tips:');
    console.log('   • Path finding requires liquidity in the DEX');
    console.log('   • Testnet may have limited trading activity');
    console.log('   • Try mainnet for more active markets');
    console.log('   • You can create your own liquidity for testing');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  testPathFinding,
  testStrictReceivePaths,
  showAvailablePairs
};
