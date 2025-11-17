/**
 * Phase 6.3: Order Book Querying
 *
 * Learn how to:
 * - Query the order book for a trading pair
 * - Find the best bid/ask prices
 * - Monitor market depth
 * - Track trades in real-time
 */

require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Get the order book for a trading pair
 * @param {Asset} sellingAsset - Asset being sold
 * @param {Asset} buyingAsset - Asset being bought
 * @param {number} limit - Number of orders to fetch (default 20)
 */
async function getOrderBook(sellingAsset, buyingAsset, limit = 20) {
  console.log('\n📖 Order Book');
  console.log('═══════════════════════════════════════');
  console.log('Trading pair:', `${sellingAsset.code || 'XLM'}/${buyingAsset.code || 'XLM'}`);
  console.log('');

  const orderbook = await server
    .orderbook(sellingAsset, buyingAsset)
    .limit(limit)
    .call();

  // Bids: People buying the selling asset (offering buying asset)
  console.log(`📊 Bids (people buying ${sellingAsset.code || 'XLM'}):`);
  console.log('   Price                    Amount');
  console.log('   ─────────────────────────────────────');

  if (orderbook.bids.length === 0) {
    console.log('   No bids available');
  } else {
    orderbook.bids.slice(0, 10).forEach(bid => {
      const price = parseFloat(bid.price).toFixed(7);
      const amount = parseFloat(bid.amount).toFixed(2);
      console.log(`   ${price.padEnd(24)} ${amount}`);
    });
  }

  console.log('');

  // Asks: People selling the selling asset (wanting buying asset)
  console.log(`📊 Asks (people selling ${sellingAsset.code || 'XLM'}):`);
  console.log('   Price                    Amount');
  console.log('   ─────────────────────────────────────');

  if (orderbook.asks.length === 0) {
    console.log('   No asks available');
  } else {
    orderbook.asks.slice(0, 10).forEach(ask => {
      const price = parseFloat(ask.price).toFixed(7);
      const amount = parseFloat(ask.amount).toFixed(2);
      console.log(`   ${price.padEnd(24)} ${amount}`);
    });
  }

  // Calculate spread
  if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
    const bestBid = parseFloat(orderbook.bids[0].price);
    const bestAsk = parseFloat(orderbook.asks[0].price);
    const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(2);

    console.log('');
    console.log('📈 Market Stats:');
    console.log(`   Best bid: ${bestBid.toFixed(7)}`);
    console.log(`   Best ask: ${bestAsk.toFixed(7)}`);
    console.log(`   Spread: ${spread}%`);
    console.log(`   Mid price: ${((bestBid + bestAsk) / 2).toFixed(7)}`);
  }

  return orderbook;
}

/**
 * Get market depth (total liquidity at each price level)
 * @param {Asset} sellingAsset - Asset being sold
 * @param {Asset} buyingAsset - Asset being bought
 */
async function getMarketDepth(sellingAsset, buyingAsset) {
  const orderbook = await server
    .orderbook(sellingAsset, buyingAsset)
    .limit(200)
    .call();

  console.log('\n📊 Market Depth Analysis');
  console.log('═══════════════════════════════════════');

  // Calculate cumulative depth for bids
  let bidDepth = 0;
  const bidLevels = orderbook.bids.slice(0, 10).map(bid => {
    bidDepth += parseFloat(bid.amount);
    return {
      price: parseFloat(bid.price),
      amount: parseFloat(bid.amount),
      cumulative: bidDepth
    };
  });

  // Calculate cumulative depth for asks
  let askDepth = 0;
  const askLevels = orderbook.asks.slice(0, 10).map(ask => {
    askDepth += parseFloat(ask.amount);
    return {
      price: parseFloat(ask.price),
      amount: parseFloat(ask.amount),
      cumulative: askDepth
    };
  });

  console.log('\n💰 Bid Depth:');
  console.log('   Price        Amount       Cumulative');
  console.log('   ──────────────────────────────────────────');
  bidLevels.forEach(level => {
    console.log(
      `   ${level.price.toFixed(7)}  ` +
      `${level.amount.toFixed(2).padEnd(12)} ` +
      `${level.cumulative.toFixed(2)}`
    );
  });

  console.log('\n💵 Ask Depth:');
  console.log('   Price        Amount       Cumulative');
  console.log('   ──────────────────────────────────────────');
  askLevels.forEach(level => {
    console.log(
      `   ${level.price.toFixed(7)}  ` +
      `${level.amount.toFixed(2).padEnd(12)} ` +
      `${level.cumulative.toFixed(2)}`
    );
  });

  return { bids: bidLevels, asks: askLevels };
}

/**
 * Get recent trades for a trading pair
 * @param {Asset} baseAsset - Base asset
 * @param {Asset} counterAsset - Counter asset
 * @param {number} limit - Number of trades to fetch
 */
async function getRecentTrades(baseAsset, counterAsset, limit = 10) {
  console.log('\n📜 Recent Trades');
  console.log('═══════════════════════════════════════');
  console.log('Trading pair:', `${baseAsset.code || 'XLM'}/${counterAsset.code || 'XLM'}`);
  console.log('');

  const trades = await server
    .trades()
    .forAssetPair(baseAsset, counterAsset)
    .limit(limit)
    .order('desc')
    .call();

  if (trades.records.length === 0) {
    console.log('No recent trades found');
    return [];
  }

  console.log('   Time                  Price       Amount      Type');
  console.log('   ───────────────────────────────────────────────────────');

  trades.records.forEach(trade => {
    const time = new Date(trade.ledger_close_time).toLocaleTimeString();
    const price = parseFloat(trade.price.n / trade.price.d).toFixed(7);
    const amount = parseFloat(trade.base_amount).toFixed(2);
    const type = trade.base_is_seller ? 'SELL' : 'BUY ';

    console.log(`   ${time}  ${price}  ${amount.padEnd(10)}  ${type}`);
  });

  return trades.records;
}

/**
 * Monitor order book changes in real-time
 * @param {Asset} sellingAsset - Asset being sold
 * @param {Asset} buyingAsset - Asset being bought
 * @param {Function} callback - Callback function for updates
 */
function streamOrderBook(sellingAsset, buyingAsset, callback) {
  console.log('\n🔄 Streaming Order Book Updates');
  console.log('═══════════════════════════════════════');
  console.log('Trading pair:', `${sellingAsset.code || 'XLM'}/${buyingAsset.code || 'XLM'}`);
  console.log('Listening for changes... (Press Ctrl+C to stop)');
  console.log('');

  const stream = server
    .orderbook(sellingAsset, buyingAsset)
    .stream({
      onmessage: (orderbook) => {
        const timestamp = new Date().toLocaleTimeString();

        if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
          const bestBid = parseFloat(orderbook.bids[0].price);
          const bestAsk = parseFloat(orderbook.asks[0].price);
          const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(2);

          console.log(`[${timestamp}] Bid: ${bestBid.toFixed(7)} | Ask: ${bestAsk.toFixed(7)} | Spread: ${spread}%`);

          if (callback) {
            callback(orderbook);
          }
        }
      },
      onerror: (error) => {
        console.error('Stream error:', error);
      }
    });

  return stream;
}

/**
 * Monitor trades in real-time
 * @param {Asset} baseAsset - Base asset
 * @param {Asset} counterAsset - Counter asset
 * @param {Function} callback - Callback function for new trades
 */
function streamTrades(baseAsset, counterAsset, callback) {
  console.log('\n🔄 Streaming Trades');
  console.log('═══════════════════════════════════════');
  console.log('Trading pair:', `${baseAsset.code || 'XLM'}/${counterAsset.code || 'XLM'}`);
  console.log('Listening for trades... (Press Ctrl+C to stop)');
  console.log('');

  const stream = server
    .trades()
    .forAssetPair(baseAsset, counterAsset)
    .cursor('now')
    .stream({
      onmessage: (trade) => {
        const time = new Date(trade.ledger_close_time).toLocaleTimeString();
        const price = parseFloat(trade.price.n / trade.price.d).toFixed(7);
        const amount = parseFloat(trade.base_amount).toFixed(2);
        const type = trade.base_is_seller ? 'SELL' : 'BUY';

        console.log(`[${time}] ${type} ${amount} @ ${price}`);

        if (callback) {
          callback(trade);
        }
      },
      onerror: (error) => {
        console.error('Stream error:', error);
      }
    });

  return stream;
}

/**
 * Get trading statistics for a pair
 * @param {Asset} baseAsset - Base asset
 * @param {Asset} counterAsset - Counter asset
 * @param {number} hours - Number of hours to analyze (default 24)
 */
async function getTradingStats(baseAsset, counterAsset, hours = 24) {
  console.log('\n📊 Trading Statistics');
  console.log('═══════════════════════════════════════');
  console.log('Trading pair:', `${baseAsset.code || 'XLM'}/${counterAsset.code || 'XLM'}`);
  console.log('Period: Last', hours, 'hours');
  console.log('');

  // Get trades from the last N hours
  const trades = await server
    .trades()
    .forAssetPair(baseAsset, counterAsset)
    .limit(200)
    .order('desc')
    .call();

  if (trades.records.length === 0) {
    console.log('No trading data available');
    return null;
  }

  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
  const recentTrades = trades.records.filter(trade => {
    return new Date(trade.ledger_close_time).getTime() > cutoffTime;
  });

  if (recentTrades.length === 0) {
    console.log('No trades in the specified period');
    return null;
  }

  // Calculate statistics
  const prices = recentTrades.map(t => parseFloat(t.price.n / t.price.d));
  const volumes = recentTrades.map(t => parseFloat(t.base_amount));

  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const lastPrice = prices[0];
  const firstPrice = prices[prices.length - 1];
  const change = ((lastPrice - firstPrice) / firstPrice * 100);
  const volume = volumes.reduce((sum, v) => sum + v, 0);
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  console.log('   Trades:', recentTrades.length);
  console.log('   Volume:', volume.toFixed(2), baseAsset.code || 'XLM');
  console.log('   Last:', lastPrice.toFixed(7));
  console.log('   High:', high.toFixed(7));
  console.log('   Low:', low.toFixed(7));
  console.log('   Average:', avgPrice.toFixed(7));
  console.log('   Change:', change.toFixed(2) + '%');

  return {
    trades: recentTrades.length,
    volume,
    lastPrice,
    high,
    low,
    avgPrice,
    change
  };
}

// Demo
async function demo() {
  try {
    console.log('\n🎯 Phase 6.3: Order Book Querying Demo');
    console.log('═══════════════════════════════════════');

    const nativeAsset = StellarSdk.Asset.native();

    // Use well-known testnet assets for demo
    // USDC on testnet
    const usdcIssuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const assetUSDC = new StellarSdk.Asset('USDC', usdcIssuer);

    console.log('\n💡 Demo: Querying XLM/USDC order book on testnet');

    try {
      // Get order book
      await getOrderBook(nativeAsset, assetUSDC, 10);

      // Get market depth
      // await getMarketDepth(nativeAsset, assetUSDC);

      // Get recent trades
      // await getRecentTrades(nativeAsset, assetUSDC, 10);

      // Get trading stats
      // await getTradingStats(nativeAsset, assetUSDC, 24);

    } catch (error) {
      console.log('\nℹ️  This trading pair may not have active orders on testnet');
      console.log('   Try with different assets that have active markets');
    }

    console.log('\n📖 Other functions available:');
    console.log('   • getMarketDepth() - Analyze liquidity depth');
    console.log('   • getRecentTrades() - View recent trade history');
    console.log('   • getTradingStats() - Get trading statistics');
    console.log('   • streamOrderBook() - Real-time order book updates');
    console.log('   • streamTrades() - Real-time trade notifications');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data?.extras) {
      console.error('Details:', JSON.stringify(error.response.data.extras, null, 2));
    }
  }
}

// Export functions
module.exports = {
  getOrderBook,
  getMarketDepth,
  getRecentTrades,
  streamOrderBook,
  streamTrades,
  getTradingStats
};

// Run demo if executed directly
if (require.main === module) {
  demo();
}
