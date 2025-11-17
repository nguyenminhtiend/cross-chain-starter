/**
 * Phase 6.2: Path Payments
 *
 * Learn how to:
 * - Send cross-currency payments using pathfinding
 * - Use pathPaymentStrictSend (exact send amount)
 * - Use pathPaymentStrictReceive (exact receive amount)
 * - Find available payment paths
 */

require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

/**
 * Path Payment Strict Send
 * You specify exact send amount, recipient gets at least minimum
 *
 * @param {string} senderSecret - Secret key of sender
 * @param {string} destinationPublicKey - Public key of recipient
 * @param {Asset} sendAsset - Asset you're sending
 * @param {string} sendAmount - Exact amount to send
 * @param {Asset} destAsset - Asset recipient will receive
 * @param {string} destMin - Minimum destination will receive
 * @param {Array<Asset>} path - Optional intermediary assets
 */
async function pathPaymentStrictSend(
  senderSecret,
  destinationPublicKey,
  sendAsset,
  sendAmount,
  destAsset,
  destMin,
  path = []
) {
  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  console.log('\n💱 Path Payment Strict Send');
  console.log('═══════════════════════════════════════');
  console.log('From:', senderKeypair.publicKey());
  console.log('To:', destinationPublicKey);
  console.log('Sending:', sendAmount, sendAsset.code || 'XLM');
  console.log('Recipient receives:', destAsset.code || 'XLM');
  console.log('Minimum destination:', destMin);

  if (path.length) {
    console.log('Path:', path.map((a) => a.code || 'XLM').join(' → '));
  } else {
    console.log('Path: Automatic pathfinding');
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
  console.log('Transaction hash:', result.hash);
  console.log('View on Stellar Expert:');
  console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);

  return result;
}

/**
 * Path Payment Strict Receive
 * You specify exact receive amount, sender spends at most maximum
 *
 * @param {string} senderSecret - Secret key of sender
 * @param {string} destinationPublicKey - Public key of recipient
 * @param {Asset} sendAsset - Asset you're sending
 * @param {string} sendMax - Maximum amount to send
 * @param {Asset} destAsset - Asset recipient will receive
 * @param {string} destAmount - Exact amount recipient receives
 * @param {Array<Asset>} path - Optional intermediary assets
 */
async function pathPaymentStrictReceive(
  senderSecret,
  destinationPublicKey,
  sendAsset,
  sendMax,
  destAsset,
  destAmount,
  path = []
) {
  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  console.log('\n💱 Path Payment Strict Receive');
  console.log('═══════════════════════════════════════');
  console.log('From:', senderKeypair.publicKey());
  console.log('To:', destinationPublicKey);
  console.log('Destination receives:', destAmount, destAsset.code || 'XLM');
  console.log('Sending at most:', sendMax, sendAsset.code || 'XLM');

  if (path.length) {
    console.log('Path:', path.map((a) => a.code || 'XLM').join(' → '));
  } else {
    console.log('Path: Automatic pathfinding');
  }

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
  console.log('Transaction hash:', result.hash);
  console.log('View on Stellar Expert:');
  console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);

  return result;
}

/**
 * Find payment paths for strict receive
 * @param {string} sourcePublicKey - Source account
 * @param {string} destinationPublicKey - Destination account
 * @param {Asset} destAsset - Destination asset
 * @param {string} destAmount - Amount destination receives
 */
async function findPaymentPaths(sourcePublicKey, destinationPublicKey, destAsset, destAmount) {
  console.log('\n🔍 Finding Payment Paths (Strict Receive)');
  console.log('═══════════════════════════════════════');
  console.log('Source:', sourcePublicKey);
  console.log('Destination:', destinationPublicKey);
  console.log('Destination receives:', destAmount, destAsset.code || 'XLM');

  const paths = await server.strictReceivePaths(sourcePublicKey, destAsset, destAmount).call();

  console.log(`\n✅ Found ${paths.records.length} paths:`);

  paths.records.slice(0, 5).forEach((path, index) => {
    console.log(`\n📍 Path ${index + 1}:`);
    console.log(
      '  Source asset:',
      path.source_asset_type === 'native' ? 'XLM' : path.source_asset_code
    );
    console.log('  Source amount:', path.source_amount);
    console.log('  Destination amount:', path.destination_amount);

    if (path.path.length > 0) {
      const pathAssets = path.path.map((p) => p.asset_code || 'XLM').join(' → ');
      console.log('  Path:', pathAssets);
    } else {
      console.log('  Path: Direct');
    }
  });

  return paths.records;
}

/**
 * Find send paths for strict send
 * @param {Asset} sourceAsset - Asset you're sending
 * @param {string} sourceAmount - Amount you're sending
 * @param {string} destinationPublicKey - Destination account
 */
async function findSendPaths(sourceAsset, sourceAmount, destinationPublicKey) {
  console.log('\n🔍 Finding Send Paths (Strict Send)');
  console.log('═══════════════════════════════════════');
  console.log('Source asset:', sourceAsset.code || 'XLM');
  console.log('Source amount:', sourceAmount);
  console.log('Destination:', destinationPublicKey);

  const paths = await server
    .strictSendPaths(sourceAsset, sourceAmount, [destinationPublicKey])
    .call();

  console.log(`\n✅ Found ${paths.records.length} paths:`);

  paths.records.slice(0, 5).forEach((path, index) => {
    console.log(`\n📍 Path ${index + 1}:`);
    console.log(
      '  Destination asset:',
      path.destination_asset_type === 'native' ? 'XLM' : path.destination_asset_code
    );
    console.log('  Destination amount:', path.destination_amount);
    console.log('  Source amount:', path.source_amount);

    if (path.path.length > 0) {
      const pathAssets = path.path.map((p) => p.asset_code || 'XLM').join(' → ');
      console.log('  Path:', pathAssets);
    } else {
      console.log('  Path: Direct');
    }
  });

  return paths.records;
}

/**
 * Cross-currency remittance example
 * Simulates sending from one currency to another
 */
async function crossCurrencyPayment(
  senderSecret,
  recipientPublicKey,
  sendAsset,
  sendAmount,
  destAsset
) {
  console.log('\n💸 Cross-Currency Payment');
  console.log('═══════════════════════════════════════');
  console.log('Sending:', sendAmount, sendAsset.code || 'XLM');
  console.log('Recipient receives:', destAsset.code || 'XLM');

  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);

  // 1. Find best path
  console.log('\n1️⃣ Finding best exchange path...');
  const paths = await server.strictSendPaths(sendAsset, sendAmount, [recipientPublicKey]).call();

  if (paths.records.length === 0) {
    console.error('❌ No payment path found');
    return;
  }

  const bestPath = paths.records[0];
  console.log('   Best path found!');
  console.log('   Recipient will receive:', bestPath.destination_amount, destAsset.code || 'XLM');

  if (bestPath.path.length > 0) {
    const pathStr = bestPath.path.map((p) => p.asset_code || 'XLM').join(' → ');
    console.log('   Path:', sendAsset.code || 'XLM', '→', pathStr, '→', destAsset.code || 'XLM');
  }

  // 2. Calculate minimum with slippage tolerance (1%)
  const minDest = (parseFloat(bestPath.destination_amount) * 0.99).toFixed(7);
  console.log('\n2️⃣ Setting 1% slippage tolerance');
  console.log('   Minimum destination:', minDest, destAsset.code || 'XLM');

  // 3. Execute path payment
  console.log('\n3️⃣ Executing path payment...');
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset: sendAsset,
        sendAmount: sendAmount,
        destination: recipientPublicKey,
        destAsset: destAsset,
        destMin: minDest,
        path: bestPath.path.map((p) =>
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
  console.log('Transaction hash:', result.hash);
  console.log('View on Stellar Expert:');
  console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);

  return result;
}

// Demo
async function demo() {
  try {
    const mySecret = process.env.TESTNET_SECRET_KEY;
    const myPublic = process.env.TESTNET_PUBLIC_KEY;

    if (!mySecret || !myPublic) {
      console.error('❌ Please set TESTNET_SECRET_KEY and TESTNET_PUBLIC_KEY in .env file');
      return;
    }

    console.log('\n🎯 Phase 6.2: Path Payments Demo');
    console.log('═══════════════════════════════════════');
    console.log('Account:', myPublic);

    console.log('\n📖 Understanding Path Payments:');
    console.log('');
    console.log('Path payments allow you to send one asset and have the');
    console.log('recipient receive a different asset. Stellar automatically');
    console.log('finds the best exchange path through the DEX.');
    console.log('');
    console.log('Two types:');
    console.log('  • Strict Send: You specify exact send amount');
    console.log('  • Strict Receive: You specify exact receive amount');

    // Example: Find paths for a common asset like USDC
    console.log('\n💡 Example: Finding paths from XLM to USDC');
    console.log('');
    console.log('To test path payments, you need:');
    console.log('1. Both accounts funded');
    console.log('2. Destination has trustline to receiving asset');
    console.log('3. Liquidity exists in the DEX for the path');
    console.log('');
    console.log('Try finding paths to well-known testnet assets like:');
    console.log('  • USDC: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
    console.log('  • Native (XLM) is always available');

    // Demonstrate finding paths (this will work even without actual trades)
    const nativeAsset = StellarSdk.Asset.native();

    // Example with a well-known testnet asset (USDC)
    const usdcIssuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const assetUSDC = new StellarSdk.Asset('USDC', usdcIssuer);

    // Try finding some paths
    try {
      await findSendPaths(nativeAsset, '100', myPublic);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('\nℹ️  No payment paths found - this is normal if there\'s no DEX liquidity');
      } else {
        console.log('\n⚠️  Error finding paths:', error.message);
        console.log('   This might be due to:');
        console.log('   - No active liquidity in the DEX');
        console.log('   - Asset trustlines not established');
        console.log('   - Network connectivity issues');
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data?.extras) {
      console.error('Details:', JSON.stringify(error.response.data.extras, null, 2));
    }
  }
}

// Export functions
module.exports = {
  pathPaymentStrictSend,
  pathPaymentStrictReceive,
  findPaymentPaths,
  findSendPaths,
  crossCurrencyPayment
};

// Run demo if executed directly
if (require.main === module) {
  demo();
}
