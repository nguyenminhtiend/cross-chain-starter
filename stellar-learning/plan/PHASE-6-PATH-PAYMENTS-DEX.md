# Phase 6: Path Payments and DEX

## Overview
This phase explores Stellar's built-in Decentralized Exchange (DEX) and path payment system. You'll learn to trade assets, create offers, and perform cross-currency payments using automatic pathfinding.

---

## The Stellar DEX: Built Into the Protocol

### What Makes It Special?

Unlike Ethereum (Uniswap, Sushiswap require smart contracts), Stellar has a **native DEX** built directly into the protocol.

**Benefits:**
- No third-party risk
- Lower fees (0.00001 XLM per trade)
- Atomic operations
- Automatic path finding
- No liquidity pool attacks

### Order Book Model

Stellar uses a **Central Limit Order Book (CLOB)**, not AMM (Automated Market Maker).

**CLOB vs AMM:**
| Feature | CLOB (Stellar) | AMM (Uniswap) |
|---------|---------------|---------------|
| Price discovery | Order book | Algorithmic |
| Slippage | Only for large orders | Always present |
| Capital efficiency | High | Low |
| Impermanent loss | No | Yes |

---

## Creating Offers (Limit Orders)

### Manage Buy Offer

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function placeBuyOffer(
  sellerSecret,
  sellingAsset,
  buyingAsset,
  buyAmount,
  price
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  console.log('📈 Placing Buy Offer');
  console.log('Buying:', buyAmount, buyingAsset.code);
  console.log('Selling:', sellingAsset.code);
  console.log('Price:', price, `${sellingAsset.code} per ${buyingAsset.code}`);

  const transaction = new StellarSdk.TransactionBuilder(sellerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.manageBuyOffer({
        selling: sellingAsset,
        buying: buyingAsset,
        buyAmount: buyAmount.toString(),
        price: price.toString(),
        offerId: 0 // 0 = create new offer
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sellerKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Offer placed!');
  console.log('Transaction hash:', result.hash);

  return result;
}

// Example: Buy 100 USD by selling XLM at 0.10 USD/XLM
const assetUSD = new StellarSdk.Asset('USD', 'ISSUER_PUBLIC_KEY');
placeBuyOffer(
  mySecret,
  StellarSdk.Asset.native(), // Selling XLM
  assetUSD,                   // Buying USD
  '100',                      // Buy 100 USD
  '0.10'                      // Price: 0.10 USD per XLM
);
```

### Manage Sell Offer

```javascript
async function placeSellOffer(
  sellerSecret,
  sellingAsset,
  buyingAsset,
  sellAmount,
  price
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  console.log('📉 Placing Sell Offer');
  console.log('Selling:', sellAmount, sellingAsset.code);
  console.log('Buying:', buyingAsset.code);
  console.log('Price:', price, `${buyingAsset.code} per ${sellingAsset.code}`);

  const transaction = new StellarSdk.TransactionBuilder(sellerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: sellingAsset,
        buying: buyingAsset,
        amount: sellAmount.toString(),
        price: price.toString(),
        offerId: 0
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sellerKeypair);
  return await server.submitTransaction(transaction);
}

// Example: Sell 1000 XLM for USD at 0.10 USD/XLM
placeSellOffer(
  mySecret,
  StellarSdk.Asset.native(),
  assetUSD,
  '1000',     // Sell 1000 XLM
  '0.10'      // Price: 0.10 USD per XLM
);
```

### Understanding Price

**Price = Amount of BUYING asset / Amount of SELLING asset**

Example:
- Selling XLM, buying USD
- Want 1 XLM = 0.10 USD
- Price = 0.10

```javascript
// If price = '0.10'
// You're saying: "I'll sell 1 XLM for 0.10 USD"
// Or: "I'll buy 1 USD for 10 XLM"
```

---

## Modifying and Canceling Offers

### Update Existing Offer

```javascript
async function updateOffer(
  sellerSecret,
  offerId,
  sellingAsset,
  buyingAsset,
  newAmount,
  newPrice
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(sellerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: sellingAsset,
        buying: buyingAsset,
        amount: newAmount.toString(),
        price: newPrice.toString(),
        offerId: offerId // Existing offer ID
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sellerKeypair);
  await server.submitTransaction(transaction);

  console.log('✅ Offer updated:', offerId);
}
```

### Cancel Offer

```javascript
async function cancelOffer(sellerSecret, offerId, sellingAsset, buyingAsset) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(sellerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling: sellingAsset,
        buying: buyingAsset,
        amount: '0', // Set amount to 0 to cancel
        price: '1',
        offerId: offerId
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sellerKeypair);
  await server.submitTransaction(transaction);

  console.log('✅ Offer canceled:', offerId);
}
```

---

## Querying the Order Book

### Get Offers for Trading Pair

```javascript
async function getOrderBook(sellingAsset, buyingAsset) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const orderbook = await server
    .orderbook(sellingAsset, buyingAsset)
    .call();

  console.log('📖 Order Book');
  console.log('Selling:', sellingAsset.code || 'XLM');
  console.log('Buying:', buyingAsset.code || 'XLM');
  console.log('');

  console.log('Bids (people buying', sellingAsset.code || 'XLM', '):');
  orderbook.bids.slice(0, 5).forEach(bid => {
    console.log(`  Price: ${bid.price} | Amount: ${bid.amount}`);
  });

  console.log('');
  console.log('Asks (people selling', sellingAsset.code || 'XLM', '):');
  orderbook.asks.slice(0, 5).forEach(ask => {
    console.log(`  Price: ${ask.price} | Amount: ${ask.amount}`);
  });

  return orderbook;
}

// Example
const assetUSD = new StellarSdk.Asset('USD', 'ISSUER_KEY');
getOrderBook(StellarSdk.Asset.native(), assetUSD);
```

### Get Your Active Offers

```javascript
async function getMyOffers(publicKey) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const offers = await server
    .offers()
    .forAccount(publicKey)
    .call();

  console.log('📋 Your Active Offers:', offers.records.length);

  offers.records.forEach((offer, index) => {
    console.log(`\nOffer ${index + 1}:`);
    console.log('  ID:', offer.id);
    console.log('  Selling:', offer.selling.asset_code || 'XLM');
    console.log('  Buying:', offer.buying.asset_code || 'XLM');
    console.log('  Amount:', offer.amount);
    console.log('  Price:', offer.price);
  });

  return offers.records;
}

// Usage
getMyOffers(process.env.TESTNET_PUBLIC_KEY);
```

---

## Path Payments: The Magic of Stellar

### What Are Path Payments?

Send **Asset A**, recipient receives **Asset B**, automatically finding the best exchange path.

**Example:**
- You have XLM
- Recipient wants USD
- Stellar automatically finds: XLM → BTC → USD

### Path Payment Strict Send

You specify **exact send amount**. Recipient gets at least minimum.

```javascript
async function pathPaymentStrictSend(
  senderSecret,
  destinationPublicKey,
  sendAsset,
  sendAmount,
  destAsset,
  destMin,
  path = []
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  console.log('💱 Path Payment Strict Send');
  console.log('Sending:', sendAmount, sendAsset.code || 'XLM');
  console.log('Recipient receives:', destAsset.code || 'XLM');
  console.log('Minimum destination:', destMin);
  if (path.length) {
    console.log('Path:', path.map(a => a.code).join(' → '));
  }

  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset: sendAsset,
        sendAmount: sendAmount.toString(),
        destination: destinationPublicKey,
        destAsset: destAsset,
        destMin: destMin.toString(),
        path: path // Optional intermediary assets
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(senderKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Path payment successful!');
  console.log('Hash:', result.hash);

  return result;
}

// Example: Send 100 XLM, recipient gets USD (at least 9 USD)
const assetUSD = new StellarSdk.Asset('USD', 'ISSUER_KEY');
pathPaymentStrictSend(
  mySecret,
  recipientPublicKey,
  StellarSdk.Asset.native(), // Send XLM
  '100',                      // Send exactly 100 XLM
  assetUSD,                   // Recipient gets USD
  '9',                        // At least 9 USD
  []                          // Auto-find path
);
```

### Path Payment Strict Receive

You specify **exact receive amount**. Sender spends at most maximum.

```javascript
async function pathPaymentStrictReceive(
  senderSecret,
  destinationPublicKey,
  sendAsset,
  sendMax,
  destAsset,
  destAmount,
  path = []
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  console.log('💱 Path Payment Strict Receive');
  console.log('Destination receives:', destAmount, destAsset.code || 'XLM');
  console.log('Sending at most:', sendMax, sendAsset.code || 'XLM');

  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: sendAsset,
        sendMax: sendMax.toString(),
        destination: destinationPublicKey,
        destAsset: destAsset,
        destAmount: destAmount.toString(),
        path: path
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(senderKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Path payment successful!');
  return result;
}

// Example: Recipient gets exactly 10 USD, send at most 110 XLM
pathPaymentStrictReceive(
  mySecret,
  recipientPublicKey,
  StellarSdk.Asset.native(),
  '110',     // Send at most 110 XLM
  assetUSD,
  '10',      // Recipient gets exactly 10 USD
  []
);
```

---

## Finding Payment Paths

### Automatic Path Finding

```javascript
async function findPaymentPaths(
  sourcePublicKey,
  destinationPublicKey,
  destAsset,
  destAmount
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  console.log('🔍 Finding payment paths...');
  console.log('Destination receives:', destAmount, destAsset.code);

  const paths = await server
    .strictReceivePaths(
      sourcePublicKey,
      destAsset,
      destAmount
    )
    .call();

  console.log(`\nFound ${paths.records.length} paths:`);

  paths.records.slice(0, 5).forEach((path, index) => {
    console.log(`\nPath ${index + 1}:`);
    console.log('  Source asset:', path.source_asset_type === 'native' ? 'XLM' : path.source_asset_code);
    console.log('  Source amount:', path.source_amount);
    console.log('  Destination amount:', path.destination_amount);
    console.log('  Path:', path.path.map(p => p.asset_code || 'XLM').join(' → '));
  });

  return paths.records;
}

// Example
const assetUSD = new StellarSdk.Asset('USD', 'ISSUER_KEY');
findPaymentPaths(
  myPublicKey,
  recipientPublicKey,
  assetUSD,
  '100'
);
```

### Finding Send Paths

```javascript
async function findSendPaths(
  sourceAsset,
  sourceAmount,
  destinationPublicKey
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const paths = await server
    .strictSendPaths(
      sourceAsset,
      sourceAmount,
      [destinationPublicKey]
    )
    .call();

  console.log('🔍 Send Paths Found:', paths.records.length);

  paths.records.forEach((path, index) => {
    console.log(`\nPath ${index + 1}:`);
    console.log('  Destination asset:', path.destination_asset_type === 'native' ? 'XLM' : path.destination_asset_code);
    console.log('  Destination amount:', path.destination_amount);
    console.log('  Source amount:', path.source_amount);
  });

  return paths.records;
}
```

---

## Real-World Example: Cross-Currency Remittance

### Scenario: USD → EUR Payment

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function sendCrossCurrencyPayment(
  senderSecret,
  recipientPublicKey,
  amountUSD
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Define assets
  const assetUSD = new StellarSdk.Asset('USD', 'USD_ISSUER_KEY');
  const assetEUR = new StellarSdk.Asset('EUR', 'EUR_ISSUER_KEY');

  console.log('💸 Cross-Currency Payment');
  console.log('Sending:', amountUSD, 'USD');
  console.log('Recipient receives: EUR');

  // 1. Find best path
  const paths = await server
    .strictSendPaths(assetUSD, amountUSD, [recipientPublicKey])
    .call();

  if (paths.records.length === 0) {
    console.error('❌ No payment path found');
    return;
  }

  const bestPath = paths.records[0];
  console.log('Best rate:', bestPath.destination_amount, 'EUR');
  console.log('Path:', bestPath.path.map(p => p.asset_code || 'XLM').join(' → '));

  // 2. Execute path payment
  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  const minEUR = (parseFloat(bestPath.destination_amount) * 0.99).toFixed(7); // 1% slippage

  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset: assetUSD,
        sendAmount: amountUSD,
        destination: recipientPublicKey,
        destAsset: assetEUR,
        destMin: minEUR,
        path: bestPath.path.map(p =>
          p.asset_type === 'native'
            ? StellarSdk.Asset.native()
            : new StellarSdk.Asset(p.asset_code, p.asset_issuer)
        )
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(senderKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Cross-currency payment complete!');
  console.log('Hash:', result.hash);
}

// Usage
sendCrossCurrencyPayment(mySecret, recipientKey, '100');
```

---

## Liquidity Pools (AMM on Stellar)

### Constant Product Pools

Stellar also supports **Automated Market Maker (AMM)** liquidity pools.

```javascript
async function depositToLiquidityPool(
  depositorSecret,
  assetA,
  assetB,
  maxAmountA,
  maxAmountB,
  minPrice,
  maxPrice
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const depositorKeypair = StellarSdk.Keypair.fromSecret(depositorSecret);
  const depositorAccount = await server.loadAccount(depositorKeypair.publicKey());

  // Get pool ID
  const poolId = StellarSdk.getLiquidityPoolId(
    'constant_product',
    {
      assetA: assetA,
      assetB: assetB,
      fee: 30 // 0.3% fee
    }
  ).toString('hex');

  console.log('💧 Depositing to Liquidity Pool');
  console.log('Pool ID:', poolId);

  const transaction = new StellarSdk.TransactionBuilder(depositorAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.liquidityPoolDeposit({
        liquidityPoolId: poolId,
        maxAmountA: maxAmountA.toString(),
        maxAmountB: maxAmountB.toString(),
        minPrice: minPrice.toString(),
        maxPrice: maxPrice.toString()
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(depositorKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Liquidity deposited!');
  return result;
}
```

---

## Trading Bot Example

### Simple Market Maker

```javascript
class SimpleMarketMaker {
  constructor(secretKey, sellingAsset, buyingAsset, spread = 0.01) {
    this.keypair = StellarSdk.Keypair.fromSecret(secretKey);
    this.sellingAsset = sellingAsset;
    this.buyingAsset = buyingAsset;
    this.spread = spread;
    this.server = new StellarSdk.Horizon.Server(
      'https://horizon-testnet.stellar.org'
    );
  }

  async getMarketPrice() {
    const orderbook = await this.server
      .orderbook(this.sellingAsset, this.buyingAsset)
      .call();

    if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      return null;
    }

    const bestBid = parseFloat(orderbook.bids[0].price);
    const bestAsk = parseFloat(orderbook.asks[0].price);
    const midPrice = (bestBid + bestAsk) / 2;

    return { midPrice, bestBid, bestAsk };
  }

  async placeOrders(amount) {
    const prices = await this.getMarketPrice();
    if (!prices) {
      console.log('No market data available');
      return;
    }

    const { midPrice } = prices;

    // Buy order (below mid price)
    const buyPrice = midPrice * (1 - this.spread);

    // Sell order (above mid price)
    const sellPrice = midPrice * (1 + this.spread);

    console.log(`📊 Mid price: ${midPrice}`);
    console.log(`📉 Placing buy at: ${buyPrice}`);
    console.log(`📈 Placing sell at: ${sellPrice}`);

    const account = await this.server.loadAccount(this.keypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      // Buy order
      .addOperation(
        StellarSdk.Operation.manageBuyOffer({
          selling: this.buyingAsset,
          buying: this.sellingAsset,
          buyAmount: amount.toString(),
          price: (1 / buyPrice).toString(),
          offerId: 0
        })
      )
      // Sell order
      .addOperation(
        StellarSdk.Operation.manageSellOffer({
          selling: this.sellingAsset,
          buying: this.buyingAsset,
          amount: amount.toString(),
          price: sellPrice.toString(),
          offerId: 0
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(this.keypair);
    await this.server.submitTransaction(transaction);

    console.log('✅ Orders placed!');
  }

  async run(amount, intervalSeconds = 60) {
    console.log('🤖 Market maker started');

    setInterval(async () => {
      try {
        await this.placeOrders(amount);
      } catch (error) {
        console.error('Error:', error.message);
      }
    }, intervalSeconds * 1000);
  }
}

// Usage
const assetUSD = new StellarSdk.Asset('USD', 'ISSUER_KEY');
const bot = new SimpleMarketMaker(
  process.env.TESTNET_SECRET_KEY,
  StellarSdk.Asset.native(),
  assetUSD,
  0.005 // 0.5% spread
);

// bot.run('100', 60); // Place orders every 60 seconds
```

---

## Key Takeaways

1. **Stellar DEX is built into the protocol** (no smart contracts needed)
2. **Order book model** provides better capital efficiency than AMM
3. **Path payments** enable automatic cross-currency exchanges
4. **Manage offers** to trade on the DEX
5. **Liquidity pools** (AMM) also available on Stellar
6. **Automatic path finding** makes cross-asset payments seamless

---

## Next Steps

Move to **Phase 7** where you'll:
- Explore Soroban smart contracts
- Write your first smart contract
- Deploy contracts to Stellar
- Integrate contracts with JavaScript

---

## Exercise Challenges

1. **Create Trading Pair**: Place buy and sell offers for XLM/USD
2. **Path Payment**: Send XLM, recipient receives EUR
3. **Order Book Monitor**: Build a tool to watch price changes
4. **Simple Arbitrage**: Find price differences between trading pairs
5. **Market Maker**: Implement a basic market-making strategy
