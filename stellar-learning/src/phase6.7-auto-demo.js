/**
 * Phase 6.7: Automated DEX & Path Payments Demo
 *
 * A fully automated demo with hardcoded values - no user input needed!
 * Just run and watch it work.
 */

require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

// Hardcoded test values
const MY_PUBLIC = process.env.TESTNET_PUBLIC_KEY;
const MY_SECRET = process.env.TESTNET_SECRET_KEY;

// Well-known testnet assets
const XLM = StellarSdk.Asset.native();
const USDC = new StellarSdk.Asset(
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
);

/**
 * Delay helper for readable output
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Demo 1: Check Order Book
 */
async function demo1_OrderBook() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              DEMO 1: View Order Book                ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('📖 Checking XLM/USDC order book...\n');

  try {
    const orderbook = await server
      .orderbook(XLM, USDC)
      .limit(5)
      .call();

    console.log('✅ Order Book Retrieved!\n');

    console.log('📊 BIDS (people buying XLM):');
    console.log('   Price          Amount');
    console.log('   ──────────────────────────');
    if (orderbook.bids.length === 0) {
      console.log('   No bids available');
    } else {
      orderbook.bids.slice(0, 5).forEach(bid => {
        console.log(`   ${parseFloat(bid.price).toFixed(7)}  ${parseFloat(bid.amount).toFixed(2)}`);
      });
    }

    console.log('\n📊 ASKS (people selling XLM):');
    console.log('   Price          Amount');
    console.log('   ──────────────────────────');
    if (orderbook.asks.length === 0) {
      console.log('   No asks available');
    } else {
      orderbook.asks.slice(0, 5).forEach(ask => {
        console.log(`   ${parseFloat(ask.price).toFixed(7)}  ${parseFloat(ask.amount).toFixed(2)}`);
      });
    }

    if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
      const bestBid = parseFloat(orderbook.bids[0].price);
      const bestAsk = parseFloat(orderbook.asks[0].price);
      const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(2);
      const midPrice = ((bestBid + bestAsk) / 2).toFixed(7);

      console.log('\n💡 Market Summary:');
      console.log(`   Best bid: ${bestBid.toFixed(7)}`);
      console.log(`   Best ask: ${bestAsk.toFixed(7)}`);
      console.log(`   Mid price: ${midPrice}`);
      console.log(`   Spread: ${spread}%`);
    }

    console.log('\n✅ Demo 1 Complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Demo 2: Check My Active Offers
 */
async function demo2_MyOffers() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║            DEMO 2: View My Active Offers            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('📋 Checking your active offers...');
  console.log(`   Account: ${MY_PUBLIC}\n`);

  try {
    const offers = await server
      .offers()
      .forAccount(MY_PUBLIC)
      .limit(10)
      .call();

    console.log(`✅ Found ${offers.records.length} active offer(s)\n`);

    if (offers.records.length === 0) {
      console.log('   No active offers (this is normal if you haven\'t placed any)');
    } else {
      offers.records.forEach((offer, index) => {
        console.log(`📌 Offer ${index + 1}:`);
        console.log(`   ID: ${offer.id}`);
        console.log(`   Selling: ${offer.amount} ${offer.selling.asset_code || 'XLM'}`);
        console.log(`   Buying: ${offer.buying.asset_code || 'XLM'}`);
        console.log(`   Price: ${offer.price}`);
        console.log('');
      });
    }

    console.log('✅ Demo 2 Complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Demo 3: Find Payment Paths
 */
async function demo3_FindPaths() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           DEMO 3: Find Payment Paths                ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('🔍 Finding paths: "How much XLM to send for 10 USDC?"\n');

  try {
    const paths = await server
      .strictReceivePaths(MY_PUBLIC, USDC, '10')
      .call();

    if (paths.records.length === 0) {
      console.log('ℹ️  No paths found (need DEX liquidity)');
    } else {
      console.log(`✅ Found ${paths.records.length} path(s)!\n`);

      paths.records.slice(0, 3).forEach((path, idx) => {
        const sourceAsset = path.source_asset_type === 'native' ? 'XLM' : path.source_asset_code;
        console.log(`📍 Path ${idx + 1}:`);
        console.log(`   Send: ${path.source_amount} ${sourceAsset}`);
        console.log(`   Receive: 10 USDC (exact)`);
        console.log(`   Rate: ${(parseFloat(path.source_amount) / 10).toFixed(4)} ${sourceAsset} per USDC`);

        if (path.path && path.path.length > 0) {
          const pathStr = path.path.map(p => p.asset_code || 'XLM').join(' → ');
          console.log(`   Route: ${sourceAsset} → ${pathStr} → USDC`);
        } else {
          console.log(`   Route: Direct`);
        }
        console.log('');
      });

      // Show what you'd need to send with slippage
      if (paths.records.length > 0) {
        const bestPath = paths.records[0];
        const xlmNeeded = parseFloat(bestPath.source_amount);
        const with1Pct = (xlmNeeded * 1.01).toFixed(4);
        const with2Pct = (xlmNeeded * 1.02).toFixed(4);

        console.log('💡 Recommended amounts (with slippage protection):');
        console.log(`   Exact: ${xlmNeeded} XLM`);
        console.log(`   +1% slippage: ${with1Pct} XLM`);
        console.log(`   +2% slippage: ${with2Pct} XLM`);
      }
    }

    console.log('\n✅ Demo 3 Complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Demo 4: Check Recent Trades
 */
async function demo4_RecentTrades() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║            DEMO 4: View Recent Trades               ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('📜 Checking recent XLM/USDC trades...\n');

  try {
    const trades = await server
      .trades()
      .forAssetPair(XLM, USDC)
      .limit(5)
      .order('desc')
      .call();

    if (trades.records.length === 0) {
      console.log('ℹ️  No recent trades found');
    } else {
      console.log(`✅ Found ${trades.records.length} recent trade(s):\n`);

      console.log('   Time               Price       Amount      Type');
      console.log('   ─────────────────────────────────────────────────');

      trades.records.forEach(trade => {
        const time = new Date(trade.ledger_close_time).toLocaleTimeString();
        const price = parseFloat(trade.price.n / trade.price.d).toFixed(7);
        const amount = parseFloat(trade.base_amount).toFixed(2);
        const type = trade.base_is_seller ? 'SELL' : 'BUY';

        console.log(`   ${time}  ${price}  ${amount.padEnd(10)}  ${type}`);
      });
    }

    console.log('\n✅ Demo 4 Complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Demo 5: Check Account Balances
 */
async function demo5_AccountBalances() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          DEMO 5: Check Account Balances             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('💰 Checking your account balances...\n');

  try {
    const account = await server.loadAccount(MY_PUBLIC);

    console.log('✅ Account balances:\n');

    account.balances.forEach(balance => {
      if (balance.asset_type === 'native') {
        console.log(`   ${balance.balance} XLM (native)`);
      } else {
        console.log(`   ${balance.balance} ${balance.asset_code} (${balance.asset_issuer.slice(0, 8)}...)`);
      }
    });

    console.log('\n💡 Account Info:');
    console.log(`   Sequence: ${account.sequence}`);
    console.log(`   Subentry Count: ${account.subentry_count}`);

    console.log('\n✅ Demo 5 Complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Demo 6: Market Depth Analysis
 */
async function demo6_MarketDepth() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           DEMO 6: Market Depth Analysis             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('📊 Analyzing market depth for XLM/USDC...\n');

  try {
    const orderbook = await server
      .orderbook(XLM, USDC)
      .limit(10)
      .call();

    // Calculate cumulative depth
    let bidDepth = 0;
    const bidLevels = orderbook.bids.slice(0, 5).map(bid => {
      bidDepth += parseFloat(bid.amount);
      return {
        price: parseFloat(bid.price),
        amount: parseFloat(bid.amount),
        cumulative: bidDepth
      };
    });

    let askDepth = 0;
    const askLevels = orderbook.asks.slice(0, 5).map(ask => {
      askDepth += parseFloat(ask.amount);
      return {
        price: parseFloat(ask.price),
        amount: parseFloat(ask.amount),
        cumulative: askDepth
      };
    });

    if (bidLevels.length > 0) {
      console.log('💰 BID DEPTH:');
      console.log('   Price        Amount     Cumulative');
      console.log('   ─────────────────────────────────────');
      bidLevels.forEach(level => {
        console.log(
          `   ${level.price.toFixed(7)}  ${level.amount.toFixed(2).padEnd(9)}  ${level.cumulative.toFixed(2)}`
        );
      });
      console.log(`\n   Total bid liquidity: ${bidDepth.toFixed(2)} XLM`);
    }

    if (askLevels.length > 0) {
      console.log('\n💵 ASK DEPTH:');
      console.log('   Price        Amount     Cumulative');
      console.log('   ─────────────────────────────────────');
      askLevels.forEach(level => {
        console.log(
          `   ${level.price.toFixed(7)}  ${level.amount.toFixed(2).padEnd(9)}  ${level.cumulative.toFixed(2)}`
        );
      });
      console.log(`\n   Total ask liquidity: ${askDepth.toFixed(2)} XLM`);
    }

    console.log('\n✅ Demo 6 Complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Main demo runner
 */
async function main() {
  if (!MY_PUBLIC || !MY_SECRET) {
    console.error('\n❌ Error: Missing environment variables');
    console.error('Please set TESTNET_PUBLIC_KEY and TESTNET_SECRET_KEY in your .env file\n');
    return;
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     STELLAR DEX & PATH PAYMENTS - AUTO DEMO         ║');
  console.log('║              (No Input Required!)                   ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  console.log('\n🎯 This demo will automatically showcase Phase 6 features');
  console.log('   using hardcoded test values. Just sit back and watch!\n');
  console.log(`📍 Your Account: ${MY_PUBLIC}\n`);

  console.log('🚀 Starting automated demo in 2 seconds...');
  await sleep(2000);

  try {
    // Run all demos sequentially
    await demo1_OrderBook();
    await sleep(2000);

    await demo2_MyOffers();
    await sleep(2000);

    await demo3_FindPaths();
    await sleep(2000);

    await demo4_RecentTrades();
    await sleep(2000);

    await demo5_AccountBalances();
    await sleep(2000);

    await demo6_MarketDepth();

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                  🎉 ALL DEMOS COMPLETE!              ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log('✅ What we demonstrated:');
    console.log('   1. Order book queries');
    console.log('   2. Active offers management');
    console.log('   3. Path finding (strict receive)');
    console.log('   4. Recent trade history');
    console.log('   5. Account balances');
    console.log('   6. Market depth analysis\n');

    console.log('💡 Next Steps:');
    console.log('   • Modify the hardcoded values to test different scenarios');
    console.log('   • Run individual demo functions');
    console.log('   • Try executing actual trades (requires setup)');
    console.log('   • Check other Phase 6 scripts for more features\n');

    console.log('📚 Other Phase 6 Scripts:');
    console.log('   • phase6.1-dex-offers.js      - DEX order management');
    console.log('   • phase6.2-path-payments.js   - Path payment operations');
    console.log('   • phase6.3-order-book.js      - Market data queries');
    console.log('   • phase6.5-test-paths.js      - Path finding tests');
    console.log('   • phase6.6-path-finder-fixed.js - Working examples\n');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    if (error.response?.data?.extras) {
      console.error('Details:', JSON.stringify(error.response.data.extras, null, 2));
    }
  }
}

// Export individual demo functions
module.exports = {
  demo1_OrderBook,
  demo2_MyOffers,
  demo3_FindPaths,
  demo4_RecentTrades,
  demo5_AccountBalances,
  demo6_MarketDepth
};

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
