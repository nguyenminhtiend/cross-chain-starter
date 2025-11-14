/**
 * Stellar Bridge Entry Point
 *
 * Start the Stellar <-> Ethereum bridge service
 */

import dotenv from 'dotenv';
import StellarBridge from './stellar-bridge.js';

dotenv.config();

const config = {
  // Stellar configuration
  stellarNetwork: process.env.STELLAR_NETWORK || 'testnet',
  stellarBridgeSecret: process.env.STELLAR_BRIDGE_SECRET,
  stellarHorizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  stellarUsdcCode: process.env.STELLAR_USDC_CODE || 'USDC',
  stellarUsdcIssuer: process.env.STELLAR_USDC_ISSUER,

  // Ethereum configuration
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545',
  ethereumBridgeAddress: process.env.ETHEREUM_BRIDGE_ADDRESS,
  ethereumPrivateKey: process.env.ETHEREUM_PRIVATE_KEY,
};

// Validate configuration
if (!config.stellarBridgeSecret) {
  console.error('Error: STELLAR_BRIDGE_SECRET is required');
  process.exit(1);
}

if (!config.stellarUsdcIssuer) {
  console.error('Error: STELLAR_USDC_ISSUER is required');
  process.exit(1);
}

if (!config.ethereumBridgeAddress) {
  console.error('Error: ETHEREUM_BRIDGE_ADDRESS is required');
  process.exit(1);
}

if (!config.ethereumPrivateKey) {
  console.error('Error: ETHEREUM_PRIVATE_KEY is required');
  process.exit(1);
}

async function main() {
  const bridge = new StellarBridge(config);

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await bridge.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await bridge.stop();
    process.exit(0);
  });

  // Start the bridge
  await bridge.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
