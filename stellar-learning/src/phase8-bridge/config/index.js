/**
 * Phase 8: Cross-Chain Bridge Configuration
 * Centralized configuration for bridge components
 */
require('dotenv').config();

const config = {
  // Ethereum Configuration
  ethereum: {
    rpcUrl: process.env.ETH_RPC_URL,
    bridgeAddress: process.env.ETH_BRIDGE_ADDRESS || '',
    privateKey: process.env.ETH_PRIVATE_KEY,
    userKey: process.env.ETH_USER_KEY || '',
    validatorKey: process.env.ETH_VALIDATOR_KEY || '',
    validators: [
      process.env.VALIDATOR_1 || '',
      process.env.VALIDATOR_2 || '',
      process.env.VALIDATOR_3 || ''
    ],
    requiredApprovals: parseInt(process.env.REQUIRED_APPROVALS || '2')
  },

  // Stellar Configuration
  stellar: {
    horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    networkPassphrase: process.env.STELLAR_NETWORK || 'Test SDF Network ; September 2015',
    issuerPublic: process.env.STELLAR_ISSUER_PUBLIC || '',
    issuerSecret: process.env.STELLAR_ISSUER_SECRET || '',
    publicKey: process.env.STELLAR_PUBLIC_KEY || '',
    secretKey: process.env.STELLAR_SECRET_KEY || ''
  },

  // Bridge Configuration
  bridge: {
    assetCode: 'wETH',
    pollInterval: 5000, // 5 seconds
    confirmations: 1, // Number of confirmations to wait
    maxLockAmount: '10', // Max ETH per transaction
    minLockAmount: '0.001' // Min ETH per transaction
  }
};

// Validation function
function validateConfig() {
  const errors = [];

  // Check Ethereum config
  if (!config.ethereum.rpcUrl || config.ethereum.rpcUrl.includes('YOUR_INFURA_KEY')) {
    errors.push('ETH_RPC_URL is not configured');
  }

  // Check Stellar config
  if (!config.stellar.issuerSecret) {
    errors.push('STELLAR_ISSUER_SECRET is not configured');
  }

  if (errors.length > 0) {
    console.warn('\n⚠️  Configuration warnings:');
    errors.forEach((err) => console.warn(`   - ${err}`));
    console.warn('   Some features may not work until configured\n');
  }

  return errors.length === 0;
}

module.exports = {
  config,
  validateConfig
};
