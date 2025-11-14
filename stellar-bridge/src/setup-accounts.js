/**
 * Stellar Account Setup Script
 *
 * Creates and funds Stellar test accounts for bridge testing
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const TESTNET_URL = 'https://horizon-testnet.stellar.org';
const server = new StellarSdk.Horizon.Server(TESTNET_URL);

/**
 * Fund account using Friendbot (testnet only)
 */
async function fundTestnetAccount(publicKey) {
  try {
    console.log(`Funding account ${publicKey}...`);
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
    );
    const responseJSON = await response.json();
    console.log('✓ Account funded successfully');
    return responseJSON;
  } catch (error) {
    console.error('Error funding account:', error);
    throw error;
  }
}

/**
 * Create trustline for USDC
 */
async function createTrustline(keypair, asset) {
  try {
    console.log(`Creating trustline for ${asset.code}...`);

    const account = await server.loadAccount(keypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: asset,
          limit: '1000000' // Max amount willing to hold
        })
      )
      .setTimeout(180)
      .build();

    transaction.sign(keypair);
    const result = await server.submitTransaction(transaction);
    console.log('✓ Trustline created successfully');
    return result;
  } catch (error) {
    console.error('Error creating trustline:', error);
    throw error;
  }
}

/**
 * Get account balances
 */
async function getBalances(publicKey) {
  try {
    const account = await server.loadAccount(publicKey);
    console.log(`\nBalances for ${publicKey}:`);
    account.balances.forEach((balance) => {
      if (balance.asset_type === 'native') {
        console.log(`  XLM: ${balance.balance}`);
      } else {
        console.log(`  ${balance.asset_code}: ${balance.balance}`);
      }
    });
  } catch (error) {
    console.error('Error getting balances:', error);
  }
}

async function main() {
  console.log('=== Stellar Bridge Account Setup ===\n');

  // Generate bridge keypair or use existing
  let bridgeKeypair;
  if (process.env.STELLAR_BRIDGE_SECRET) {
    bridgeKeypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_BRIDGE_SECRET);
    console.log('Using existing bridge account');
  } else {
    bridgeKeypair = StellarSdk.Keypair.random();
    console.log('Generated new bridge account');
  }

  console.log(`Bridge Public Key: ${bridgeKeypair.publicKey()}`);
  console.log(`Bridge Secret Key: ${bridgeKeypair.secret()}`);
  console.log('\n⚠️  Save these credentials securely!\n');

  // Fund the account
  try {
    await fundTestnetAccount(bridgeKeypair.publicKey());
  } catch (error) {
    console.log('Account may already be funded or Friendbot is down');
  }

  // Wait for account to be created
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Create USDC trustline
  const USDC = new StellarSdk.Asset(
    'USDC',
    process.env.STELLAR_USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  );

  try {
    await createTrustline(bridgeKeypair, USDC);
  } catch (error) {
    console.log('Error creating trustline. Make sure account is funded.');
  }

  // Show balances
  await getBalances(bridgeKeypair.publicKey());

  console.log('\n=== Setup Complete ===');
  console.log('\nAdd to your .env file:');
  console.log(`STELLAR_BRIDGE_SECRET=${bridgeKeypair.secret()}`);
  console.log(`STELLAR_USDC_ISSUER=${USDC.issuer}`);
}

main().catch(console.error);
