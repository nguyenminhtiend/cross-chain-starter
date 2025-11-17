/**
 * Phase 6.4: Interactive DEX & Path Payments Demo
 *
 * A comprehensive demo that combines all Phase 6 concepts:
 * - Order book analysis
 * - Creating offers
 * - Path payments
 * - Market monitoring
 */

require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');
const readline = require('readline');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

// Import Phase 6 modules
const { getOrderBook, getMarketDepth, getRecentTrades, getTradingStats } = require('./phase6.3-order-book');
const { placeBuyOffer, placeSellOffer, getMyOffers, cancelOffer } = require('./phase6.1-dex-offers');
const { pathPaymentStrictSend, pathPaymentStrictReceive, findPaymentPaths } = require('./phase6.2-path-payments');

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Main menu
 */
async function showMenu() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║    Stellar DEX & Path Payments Interactive Demo    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n📊 Market Analysis:');
  console.log('  1. View Order Book');
  console.log('  2. View Market Depth');
  console.log('  3. View Recent Trades');
  console.log('  4. View Trading Statistics');
  console.log('\n💼 Trading:');
  console.log('  5. View My Active Offers');
  console.log('  6. Place Buy Offer');
  console.log('  7. Place Sell Offer');
  console.log('  8. Cancel Offer');
  console.log('\n💱 Path Payments:');
  console.log('  9. Find Payment Paths (Strict Receive)');
  console.log(' 10. Send Path Payment (Strict Send)');
  console.log(' 11. Send Path Payment (Strict Receive - Recommended)');
  console.log('\n📚 Examples:');
  console.log(' 12. Run Complete Trading Example');
  console.log(' 13. Run Market Maker Example');
  console.log('\n  0. Exit');
  console.log('');
}

/**
 * Get asset from user input
 */
async function getAssetInput(assetName = 'asset') {
  console.log(`\nEnter ${assetName} details:`);
  const assetType = await question('  Is this native XLM? (y/n): ');

  if (assetType.toLowerCase() === 'y') {
    return StellarSdk.Asset.native();
  }

  const code = await question('  Asset code (e.g., USD, USDC): ');
  const issuer = await question('  Issuer public key: ');

  return new StellarSdk.Asset(code, issuer);
}

/**
 * View order book
 */
async function viewOrderBook() {
  console.log('\n📖 View Order Book');
  console.log('═══════════════════════════════════════');

  const sellingAsset = await getAssetInput('selling asset');
  const buyingAsset = await getAssetInput('buying asset');

  await getOrderBook(sellingAsset, buyingAsset, 10);
}

/**
 * View market depth
 */
async function viewMarketDepth() {
  console.log('\n📊 View Market Depth');
  console.log('═══════════════════════════════════════');

  const sellingAsset = await getAssetInput('selling asset');
  const buyingAsset = await getAssetInput('buying asset');

  await getMarketDepth(sellingAsset, buyingAsset);
}

/**
 * View recent trades
 */
async function viewRecentTrades() {
  console.log('\n📜 View Recent Trades');
  console.log('═══════════════════════════════════════');

  const baseAsset = await getAssetInput('base asset');
  const counterAsset = await getAssetInput('counter asset');
  const limit = await question('  Number of trades to show (default 10): ') || '10';

  await getRecentTrades(baseAsset, counterAsset, parseInt(limit));
}

/**
 * View trading statistics
 */
async function viewTradingStats() {
  console.log('\n📊 View Trading Statistics');
  console.log('═══════════════════════════════════════');

  const baseAsset = await getAssetInput('base asset');
  const counterAsset = await getAssetInput('counter asset');
  const hours = await question('  Hours to analyze (default 24): ') || '24';

  await getTradingStats(baseAsset, counterAsset, parseInt(hours));
}

/**
 * View my active offers
 */
async function viewMyOffers() {
  const publicKey = process.env.TESTNET_PUBLIC_KEY;
  if (!publicKey) {
    console.error('❌ TESTNET_PUBLIC_KEY not set in .env file');
    return;
  }

  await getMyOffers(publicKey);
}

/**
 * Place a buy offer
 */
async function placeBuyOfferInteractive() {
  const secretKey = process.env.TESTNET_SECRET_KEY;
  if (!secretKey) {
    console.error('❌ TESTNET_SECRET_KEY not set in .env file');
    return;
  }

  console.log('\n📈 Place Buy Offer');
  console.log('═══════════════════════════════════════');

  const sellingAsset = await getAssetInput('selling asset');
  const buyingAsset = await getAssetInput('buying asset');
  const buyAmount = await question('  Amount to buy: ');
  const price = await question('  Price (buying/selling): ');

  const confirm = await question('\n  Confirm? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    return;
  }

  await placeBuyOffer(secretKey, sellingAsset, buyingAsset, buyAmount, price);
}

/**
 * Place a sell offer
 */
async function placeSellOfferInteractive() {
  const secretKey = process.env.TESTNET_SECRET_KEY;
  if (!secretKey) {
    console.error('❌ TESTNET_SECRET_KEY not set in .env file');
    return;
  }

  console.log('\n📉 Place Sell Offer');
  console.log('═══════════════════════════════════════');

  const sellingAsset = await getAssetInput('selling asset');
  const buyingAsset = await getAssetInput('buying asset');
  const sellAmount = await question('  Amount to sell: ');
  const price = await question('  Price (buying/selling): ');

  const confirm = await question('\n  Confirm? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    return;
  }

  await placeSellOffer(secretKey, sellingAsset, buyingAsset, sellAmount, price);
}

/**
 * Cancel an offer
 */
async function cancelOfferInteractive() {
  const secretKey = process.env.TESTNET_SECRET_KEY;
  if (!secretKey) {
    console.error('❌ TESTNET_SECRET_KEY not set in .env file');
    return;
  }

  console.log('\n❌ Cancel Offer');
  console.log('═══════════════════════════════════════');

  // First show active offers
  await viewMyOffers();

  const offerId = await question('\n  Offer ID to cancel: ');
  const sellingAsset = await getAssetInput('selling asset');
  const buyingAsset = await getAssetInput('buying asset');

  const confirm = await question('\n  Confirm cancellation? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    return;
  }

  await cancelOffer(secretKey, offerId, sellingAsset, buyingAsset);
}

/**
 * Find payment paths
 */
async function findPaymentPathsInteractive() {
  console.log('\n🔍 Find Payment Paths (Strict Receive)');
  console.log('═══════════════════════════════════════');
  console.log('💡 Find out what you need to send for recipient to receive exact amount\n');

  const sourcePublic = process.env.TESTNET_PUBLIC_KEY;
  const destination = await question('  Destination public key (or press Enter for your account): ') || sourcePublic;
  const destAsset = await getAssetInput('asset recipient will receive');
  const destAmount = await question('  Amount recipient will receive: ');

  await findPaymentPaths(sourcePublic, destination, destAsset, destAmount);
}

/**
 * Send path payment
 */
async function sendPathPaymentInteractive() {
  const secretKey = process.env.TESTNET_SECRET_KEY;
  if (!secretKey) {
    console.error('❌ TESTNET_SECRET_KEY not set in .env file');
    return;
  }

  console.log('\n💱 Send Path Payment');
  console.log('═══════════════════════════════════════');

  const destination = await question('  Destination public key: ');
  const sendAsset = await getAssetInput('send asset');
  const sendAmount = await question('  Amount to send: ');
  const destAsset = await getAssetInput('destination asset');
  const destMin = await question('  Minimum destination amount: ');

  const confirm = await question('\n  Confirm? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    return;
  }

  await pathPaymentStrictSend(secretKey, destination, sendAsset, sendAmount, destAsset, destMin);
}

/**
 * Send path payment (Strict Receive - Recommended)
 */
async function sendPathPaymentStrictReceiveInteractive() {
  const secretKey = process.env.TESTNET_SECRET_KEY;
  if (!secretKey) {
    console.error('❌ TESTNET_SECRET_KEY not set in .env file');
    return;
  }

  console.log('\n💱 Send Path Payment (Strict Receive)');
  console.log('═══════════════════════════════════════');
  console.log('💡 Recipient gets exact amount, you send at most max\n');

  const destination = await question('  Destination public key: ');
  const sendAsset = await getAssetInput('send asset');
  const sendMax = await question('  Maximum amount to send: ');
  const destAsset = await getAssetInput('destination asset');
  const destAmount = await question('  Exact amount destination receives: ');

  const confirm = await question('\n  Confirm? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    return;
  }

  await pathPaymentStrictReceive(secretKey, destination, sendAsset, sendMax, destAsset, destAmount);
}

/**
 * Complete trading example
 */
async function runTradingExample() {
  console.log('\n🎯 Complete Trading Example');
  console.log('═══════════════════════════════════════');
  console.log('\nThis example demonstrates:');
  console.log('1. Checking order book');
  console.log('2. Placing a buy offer');
  console.log('3. Placing a sell offer');
  console.log('4. Viewing active offers');
  console.log('\n💡 You need to have trustlines and balances for custom assets');
  console.log('   For XLM, you only need a funded account');

  const proceed = await question('\nProceed with example? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    return;
  }

  // Example uses XLM and USDC
  const nativeAsset = StellarSdk.Asset.native();
  const usdcIssuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const assetUSDC = new StellarSdk.Asset('USDC', usdcIssuer);

  try {
    // Step 1: Check order book
    console.log('\n1️⃣ Checking XLM/USDC order book...');
    await getOrderBook(nativeAsset, assetUSDC, 5);

    // Step 2: View current offers
    console.log('\n2️⃣ Your current offers:');
    const publicKey = process.env.TESTNET_PUBLIC_KEY;
    await getMyOffers(publicKey);

    console.log('\n✅ Example completed!');
    console.log('   To actually place orders, use options 6 and 7 from the main menu');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Simple market maker example
 */
async function runMarketMakerExample() {
  console.log('\n🤖 Market Maker Example');
  console.log('═══════════════════════════════════════');
  console.log('\nA market maker places both buy and sell orders');
  console.log('around the mid-market price to profit from the spread.');
  console.log('\n📚 Concept:');
  console.log('  • Get mid-market price');
  console.log('  • Place buy order below mid (e.g., -0.5%)');
  console.log('  • Place sell order above mid (e.g., +0.5%)');
  console.log('  • Profit from the spread when both fill');
  console.log('\n⚠️  Warning: Market making carries risk!');
  console.log('  • Prices may move against you');
  console.log('  • You may accumulate unwanted inventory');
  console.log('  • Only use funds you can afford to lose');

  const proceed = await question('\nView example code? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    return;
  }

  console.log('\n📝 Example Market Maker Code:');
  console.log(`
class SimpleMarketMaker {
  async placeOrders(asset1, asset2, spread = 0.005) {
    // 1. Get current market price
    const orderbook = await getOrderBook(asset1, asset2);
    const bestBid = parseFloat(orderbook.bids[0].price);
    const bestAsk = parseFloat(orderbook.asks[0].price);
    const midPrice = (bestBid + bestAsk) / 2;

    // 2. Calculate buy and sell prices
    const buyPrice = midPrice * (1 - spread);
    const sellPrice = midPrice * (1 + spread);

    // 3. Place both orders
    await placeBuyOffer(secret, asset2, asset1, '100', buyPrice);
    await placeSellOffer(secret, asset1, asset2, '100', sellPrice);
  }
}
  `);

  console.log('\n💡 See plan/PHASE-6-PATH-PAYMENTS-DEX.md for full implementation');
}

/**
 * Main loop
 */
async function main() {
  console.clear();
  console.log('🌟 Welcome to Phase 6: DEX & Path Payments');

  // Check environment variables
  if (!process.env.TESTNET_SECRET_KEY || !process.env.TESTNET_PUBLIC_KEY) {
    console.error('\n❌ Error: Missing environment variables');
    console.error('Please set TESTNET_SECRET_KEY and TESTNET_PUBLIC_KEY in your .env file');
    rl.close();
    return;
  }

  let running = true;

  while (running) {
    await showMenu();
    const choice = await question('Select an option: ');

    try {
      switch (choice) {
        case '1':
          await viewOrderBook();
          break;
        case '2':
          await viewMarketDepth();
          break;
        case '3':
          await viewRecentTrades();
          break;
        case '4':
          await viewTradingStats();
          break;
        case '5':
          await viewMyOffers();
          break;
        case '6':
          await placeBuyOfferInteractive();
          break;
        case '7':
          await placeSellOfferInteractive();
          break;
        case '8':
          await cancelOfferInteractive();
          break;
        case '9':
          await findPaymentPathsInteractive();
          break;
        case '10':
          await sendPathPaymentInteractive();
          break;
        case '11':
          await sendPathPaymentStrictReceiveInteractive();
          break;
        case '12':
          await runTradingExample();
          break;
        case '13':
          await runMarketMakerExample();
          break;
        case '0':
          running = false;
          console.log('\n👋 Goodbye!');
          break;
        default:
          console.log('\n❌ Invalid option');
      }

      if (running && choice !== '0') {
        await question('\nPress Enter to continue...');
      }
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      if (error.response?.data?.extras) {
        console.error('Details:', JSON.stringify(error.response.data.extras, null, 2));
      }
      await question('\nPress Enter to continue...');
    }
  }

  rl.close();
}

// Run the interactive demo
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    rl.close();
  });
}

module.exports = { main };
