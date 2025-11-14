/**
 * Solana Bridge Relayer Entry Point
 */

import dotenv from 'dotenv';
import SolanaRelayer from './solana-relayer.js';

dotenv.config();

const config = {
  // Solana configuration
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899',
  solanaProgramId: process.env.SOLANA_PROGRAM_ID,
  solanaKeypairPath: process.env.SOLANA_KEYPAIR_PATH ||
    `${process.env.HOME}/.config/solana/id.json`,

  // Ethereum configuration
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545',
  ethereumBridgeAddress: process.env.ETHEREUM_BRIDGE_ADDRESS,
  ethereumPrivateKey: process.env.ETHEREUM_PRIVATE_KEY,
};

// Validate configuration
if (!config.solanaProgramId) {
  console.error('Error: SOLANA_PROGRAM_ID is required');
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
  const relayer = new SolanaRelayer(config);

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await relayer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await relayer.stop();
    process.exit(0);
  });

  // Start the relayer
  await relayer.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
