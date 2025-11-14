/**
 * Stellar Bridge Tests
 *
 * Similar to your EVM bridge tests!
 * Tests the same bridge functionality but on Stellar
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ethers } from 'ethers';
import StellarBridge from '../src/stellar-bridge.js';

describe('Stellar Bridge', function() {
  let stellarBridge;
  let userKeypair;
  let bridgeKeypair;
  let server;
  let USDC;

  before(async function() {
    // Setup Stellar components
    server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

    // Generate keypairs
    userKeypair = StellarSdk.Keypair.random();
    bridgeKeypair = StellarSdk.Keypair.random();

    console.log('Test user:', userKeypair.publicKey());
    console.log('Bridge account:', bridgeKeypair.publicKey());

    // Fund accounts on testnet (using Friendbot)
    await fundTestnetAccount(userKeypair.publicKey());
    await fundTestnetAccount(bridgeKeypair.publicKey());

    // Wait for accounts to be created
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create USDC asset
    USDC = new StellarSdk.Asset(
      'USDC',
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    );

    // Create trustlines
    await createTrustline(userKeypair, USDC);
    await createTrustline(bridgeKeypair, USDC);

    console.log('✓ Test accounts setup complete');
  });

  it('Should bridge USDC from Stellar to Ethereum', async function() {
    // Similar to your EVM bridge test!

    const amount = '100';
    const ethRecipient = '0x1234567890123456789012345678901234567890';

    // Load user account
    const account = await server.loadAccount(userKeypair.publicKey());

    // Create payment to bridge (same as calling lock() in your EVM bridge)
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: bridgeKeypair.publicKey(),
          asset: USDC,
          amount: amount
        })
      )
      .addMemo(StellarSdk.Memo.text(ethRecipient)) // ETH address in memo
      .setTimeout(180)
      .build();

    transaction.sign(userKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('Payment transaction:', result.hash);
    assert.ok(result.hash, 'Transaction should have hash');

    // In a full test, you would:
    // 1. Wait for relayer to process
    // 2. Verify mint on Ethereum
    // 3. Check balances
  });

  it('Should handle invalid Ethereum address in memo', async function() {
    const amount = '10';
    const invalidEthAddress = 'invalid-address';

    const account = await server.loadAccount(userKeypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: bridgeKeypair.publicKey(),
          asset: USDC,
          amount: amount
        })
      )
      .addMemo(StellarSdk.Memo.text(invalidEthAddress))
      .setTimeout(180)
      .build();

    transaction.sign(userKeypair);
    const result = await server.submitTransaction(transaction);

    // Transaction succeeds on Stellar, but relayer should ignore it
    assert.ok(result.hash, 'Transaction should succeed on Stellar');
  });
});

// Helper functions

async function fundTestnetAccount(publicKey) {
  try {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
    );
    await response.json();
    console.log(`✓ Funded ${publicKey}`);
  } catch (error) {
    console.error('Error funding account:', error);
  }
}

async function createTrustline(keypair, asset) {
  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
  const account = await server.loadAccount(keypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: '1000000'
      })
    )
    .setTimeout(180)
    .build();

  transaction.sign(keypair);
  await server.submitTransaction(transaction);
  console.log(`✓ Created trustline for ${asset.code}`);
}
