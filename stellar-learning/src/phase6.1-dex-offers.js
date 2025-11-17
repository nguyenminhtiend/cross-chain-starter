/**
 * Phase 6.1: DEX Offers - Creating and Managing Orders
 *
 * Learn how to:
 * - Place buy and sell offers on Stellar DEX
 * - Update existing offers
 * - Cancel offers
 * - Query your active offers
 */

require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Place a buy offer on the DEX
 * @param {string} sellerSecret - Secret key of the seller
 * @param {Asset} sellingAsset - Asset you're selling
 * @param {Asset} buyingAsset - Asset you're buying
 * @param {string} buyAmount - Amount you want to buy
 * @param {string} price - Price (buyingAsset per sellingAsset)
 */
async function placeBuyOffer(
  sellerSecret,
  sellingAsset,
  buyingAsset,
  buyAmount,
  price
) {
  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  console.log('\n📈 Placing Buy Offer');
  console.log('═══════════════════════════════════════');
  console.log('Buying:', buyAmount, buyingAsset.code || 'XLM');
  console.log('Selling:', sellingAsset.code || 'XLM');
  console.log('Price:', price, `${buyingAsset.code || 'XLM'} per ${sellingAsset.code || 'XLM'}`);

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
        offerId: '0' // 0 = create new offer
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sellerKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Offer placed successfully!');
  console.log('Transaction hash:', result.hash);
  console.log('View on Stellar Expert:');
  console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);

  return result;
}

/**
 * Place a sell offer on the DEX
 * @param {string} sellerSecret - Secret key of the seller
 * @param {Asset} sellingAsset - Asset you're selling
 * @param {Asset} buyingAsset - Asset you're buying
 * @param {string} sellAmount - Amount you want to sell
 * @param {string} price - Price (buyingAsset per sellingAsset)
 */
async function placeSellOffer(
  sellerSecret,
  sellingAsset,
  buyingAsset,
  sellAmount,
  price
) {
  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  console.log('\n📉 Placing Sell Offer');
  console.log('═══════════════════════════════════════');
  console.log('Selling:', sellAmount, sellingAsset.code || 'XLM');
  console.log('Buying:', buyingAsset.code || 'XLM');
  console.log('Price:', price, `${buyingAsset.code || 'XLM'} per ${sellingAsset.code || 'XLM'}`);

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
        offerId: '0'
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sellerKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Offer placed successfully!');
  console.log('Transaction hash:', result.hash);
  console.log('View on Stellar Expert:');
  console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);

  return result;
}

/**
 * Update an existing offer
 * @param {string} sellerSecret - Secret key of the seller
 * @param {string} offerId - ID of the offer to update
 * @param {Asset} sellingAsset - Asset you're selling
 * @param {Asset} buyingAsset - Asset you're buying
 * @param {string} newAmount - New amount
 * @param {string} newPrice - New price
 */
async function updateOffer(
  sellerSecret,
  offerId,
  sellingAsset,
  buyingAsset,
  newAmount,
  newPrice
) {
  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  console.log('\n🔄 Updating Offer');
  console.log('═══════════════════════════════════════');
  console.log('Offer ID:', offerId);
  console.log('New amount:', newAmount);
  console.log('New price:', newPrice);

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
  const result = await server.submitTransaction(transaction);

  console.log('✅ Offer updated successfully!');
  console.log('Transaction hash:', result.hash);

  return result;
}

/**
 * Cancel an offer
 * @param {string} sellerSecret - Secret key of the seller
 * @param {string} offerId - ID of the offer to cancel
 * @param {Asset} sellingAsset - Asset you're selling
 * @param {Asset} buyingAsset - Asset you're buying
 */
async function cancelOffer(sellerSecret, offerId, sellingAsset, buyingAsset) {
  const sellerKeypair = StellarSdk.Keypair.fromSecret(sellerSecret);
  const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

  console.log('\n❌ Canceling Offer');
  console.log('═══════════════════════════════════════');
  console.log('Offer ID:', offerId);

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
  const result = await server.submitTransaction(transaction);

  console.log('✅ Offer canceled successfully!');
  console.log('Transaction hash:', result.hash);

  return result;
}

/**
 * Get all active offers for an account
 * @param {string} publicKey - Public key of the account
 */
async function getMyOffers(publicKey) {
  console.log('\n📋 Fetching Active Offers');
  console.log('═══════════════════════════════════════');

  const offers = await server
    .offers()
    .forAccount(publicKey)
    .call();

  console.log('Total active offers:', offers.records.length);

  offers.records.forEach((offer, index) => {
    console.log(`\n📌 Offer ${index + 1}:`);
    console.log('  ID:', offer.id);
    console.log('  Selling:', offer.amount, offer.selling.asset_code || 'XLM');
    console.log('  Buying:', offer.buying.asset_code || 'XLM');
    console.log('  Price:', offer.price, `${offer.buying.asset_code || 'XLM'} per ${offer.selling.asset_code || 'XLM'}`);
    console.log('  Last modified:', new Date(offer.last_modified_time).toLocaleString());
  });

  return offers.records;
}

// Example usage
async function demo() {
  try {
    const mySecret = process.env.TESTNET_SECRET_KEY;
    const myPublic = process.env.TESTNET_PUBLIC_KEY;

    if (!mySecret || !myPublic) {
      console.error('❌ Please set TESTNET_SECRET_KEY and TESTNET_PUBLIC_KEY in .env file');
      return;
    }

    console.log('\n🎯 Phase 6.1: DEX Offers Demo');
    console.log('═══════════════════════════════════════');
    console.log('Account:', myPublic);

    // For demo purposes, we'll use native XLM and a test asset
    // In real usage, you'd use actual issued assets with trustlines
    const nativeAsset = StellarSdk.Asset.native();

    // Example: Create a test asset (you'd need to replace with real issuer)
    // const testAsset = new StellarSdk.Asset('DEMO', 'ISSUER_PUBLIC_KEY');

    console.log('\n💡 Note: To trade custom assets, you need:');
    console.log('1. The asset must be issued (see Phase 5)');
    console.log('2. You must have a trustline to the asset');
    console.log('3. You must have balance of the asset you\'re selling');

    // Demo: Query existing offers
    await getMyOffers(myPublic);

    console.log('\n📖 Example: Placing a sell offer for 100 XLM');
    console.log('To actually place an offer, uncomment the code below and provide a valid asset:');
    console.log('');
    console.log('  const testAsset = new StellarSdk.Asset(\'USD\', \'ISSUER_KEY\');');
    console.log('  await placeSellOffer(');
    console.log('    mySecret,');
    console.log('    nativeAsset,    // Selling XLM');
    console.log('    testAsset,      // Buying USD');
    console.log('    \'100\',          // Sell 100 XLM');
    console.log('    \'0.10\'          // Price: 0.10 USD per XLM');
    console.log('  );');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data?.extras) {
      console.error('Details:', JSON.stringify(error.response.data.extras, null, 2));
    }
  }
}

// Export functions for use in other scripts
module.exports = {
  placeBuyOffer,
  placeSellOffer,
  updateOffer,
  cancelOffer,
  getMyOffers
};

// Run demo if executed directly
if (require.main === module) {
  demo();
}
