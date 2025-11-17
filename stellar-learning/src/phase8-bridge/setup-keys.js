/**
 * Setup Keys Generator
 * Generates all the keys needed for the bridge setup
 */

const { ethers } = require('ethers');
const StellarSdk = require('@stellar/stellar-sdk');

console.log('🔐 Cross-Chain Bridge - Key Generator\n');
console.log('═'.repeat(60));

// Generate Ethereum Wallets
console.log('\n📍 ETHEREUM KEYS:\n');

const mainWallet = ethers.Wallet.createRandom();
console.log('Main Wallet (for deployment & transactions):');
console.log('  Address:', mainWallet.address);
console.log('  Private Key:', mainWallet.privateKey);
console.log('  → Use for: ETH_PRIVATE_KEY, ETH_USER_KEY');
console.log('  → Get testnet ETH: https://sepoliafaucet.com');

console.log('\nValidator Wallets:');
for (let i = 1; i <= 3; i++) {
  const validator = ethers.Wallet.createRandom();
  console.log(`\n  Validator ${i}:`);
  console.log('    Address:', validator.address);
  console.log('    Private Key:', validator.privateKey);
  if (i === 1) {
    console.log('    → Use for: ETH_VALIDATOR_KEY, VALIDATOR_1');
  } else {
    console.log(`    → Use for: VALIDATOR_${i}`);
  }
}

// Generate Stellar Keypairs
console.log('\n\n📍 STELLAR KEYS:\n');

const issuerPair = StellarSdk.Keypair.random();
console.log('Issuer Account (for wETH asset):');
console.log('  Public Key:', issuerPair.publicKey());
console.log('  Secret Key:', issuerPair.secret());
console.log('  → Use for: STELLAR_ISSUER_PUBLIC, STELLAR_ISSUER_SECRET');
console.log('  → Fund account: https://laboratory.stellar.org/#account-creator?network=test');

const userPair = StellarSdk.Keypair.random();
console.log('\nUser Account (your Stellar wallet):');
console.log('  Public Key:', userPair.publicKey());
console.log('  Secret Key:', userPair.secret());
console.log('  → Use for: STELLAR_PUBLIC_KEY, STELLAR_SECRET_KEY');
console.log('  → Fund account: https://laboratory.stellar.org/#account-creator?network=test');

// Generate .env template
console.log('\n\n📝 COPY THIS TO YOUR .env FILE:\n');
console.log('═'.repeat(60));
console.log(`
# Ethereum Configuration
ETH_RPC_URL=https://sepolia.infura.io/v3/36a0f1d925444884bd17c86f738af2ff
ETH_BRIDGE_ADDRESS=                    # Fill after deploying contract
ETH_PRIVATE_KEY=${mainWallet.privateKey}
ETH_USER_KEY=${mainWallet.privateKey}
ETH_VALIDATOR_KEY=${ethers.Wallet.createRandom().privateKey}

# Validators (addresses only)
VALIDATOR_1=${ethers.Wallet.createRandom().address}
VALIDATOR_2=${ethers.Wallet.createRandom().address}
VALIDATOR_3=${ethers.Wallet.createRandom().address}
REQUIRED_APPROVALS=2

# Stellar Configuration
STELLAR_ISSUER_PUBLIC=${issuerPair.publicKey()}
STELLAR_ISSUER_SECRET=${issuerPair.secret()}
STELLAR_PUBLIC_KEY=${userPair.publicKey()}
STELLAR_SECRET_KEY=${userPair.secret()}
`);

console.log('═'.repeat(60));
console.log('\n✅ Keys Generated Successfully!\n');
console.log('📋 NEXT STEPS:\n');
console.log('1. Copy the .env content above to your .env file');
console.log('2. Get testnet ETH for main wallet:');
console.log(`   → Visit: https://sepoliafaucet.com`);
console.log(`   → Paste address: ${mainWallet.address}`);
console.log('\n3. Fund Stellar accounts:');
console.log(`   → Visit: https://laboratory.stellar.org/#account-creator?network=test`);
console.log(`   → Paste issuer public key and click "Fund with friendbot"`);
console.log(`   → Repeat for user public key`);
console.log('\n4. Deploy the bridge contract:');
console.log('   → node ethereum/deploy-contract.js');
console.log('\n5. Create wrapped asset:');
console.log('   → node stellar/create-wrapped-asset.js');
console.log('\n6. Start relayer:');
console.log('   → node relayer/index.js');
console.log('\n⚠️  IMPORTANT: Never commit your .env file to git!\n');
