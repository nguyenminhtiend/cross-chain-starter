const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n========== Configuring ChainSwap ==========\n');

  const [deployer] = await ethers.getSigners();
  console.log(`Configuring with account: ${deployer.address}\n`);

  // Load deployment info
  const deploymentsDir = path.join(__dirname, '../../deployments');

  const sourceDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, 'source-chain.json'))
  );

  const destDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, 'destination-chain.json'))
  );

  console.log('Source Chain:');
  console.log(`  - Bridge: ${sourceDeployment.contracts.bridgeSource.address}`);
  console.log(`  - Token: ${sourceDeployment.contracts.sourceToken.address}\n`);

  console.log('Destination Chain:');
  console.log(`  - Bridge: ${destDeployment.contracts.chainSwapBridge.address}`);
  console.log(`  - Wrapped Token: ${destDeployment.contracts.wrappedToken.address}\n`);

  // Create .env file for relayer
  console.log('1. Creating relayer .env file...');

  const envContent = `# ChainSwap Relayer Configuration
# Generated: ${new Date().toISOString()}

# Relayer Private Key
RELAYER_PRIVATE_KEY=${process.env.PRIVATE_KEY || "your_relayer_private_key_here"}

# Source Chain (where tokens are locked)
SOURCE_CHAIN_RPC=${process.env.SOURCE_CHAIN_RPC || "http://localhost:8545"}
SOURCE_BRIDGE_ADDRESS=${sourceDeployment.contracts.bridgeSource.address}
SOURCE_TOKEN_ADDRESS=${sourceDeployment.contracts.sourceToken.address}

# Destination Chain (where tokens are minted and swapped)
DEST_CHAIN_RPC=${process.env.DEST_CHAIN_RPC || "http://localhost:9545"}
DEST_BRIDGE_ADDRESS=${destDeployment.contracts.chainSwapBridge.address}
WRAPPED_TOKEN_ADDRESS=${destDeployment.contracts.wrappedToken.address}

# Relayer Settings
REQUIRED_CONFIRMATIONS=12
SLIPPAGE_TOLERANCE=100  # 1% in basis points

# Uniswap Router
UNISWAP_ROUTER=${destDeployment.contracts.uniswapRouter.address}

# Price Oracle
PRICE_ORACLE_ADDRESS=${destDeployment.contracts.priceOracle.address}
`;

  const relayerEnvPath = path.join(__dirname, '../../relayer/.env');
  fs.writeFileSync(relayerEnvPath, envContent);
  console.log(`✓ Relayer .env created at: relayer/.env\n`);

  // Create configuration summary
  const config = {
    sourceChain: {
      chainId: sourceDeployment.chainId,
      network: sourceDeployment.network,
      contracts: sourceDeployment.contracts
    },
    destinationChain: {
      chainId: destDeployment.chainId,
      network: destDeployment.network,
      contracts: destDeployment.contracts
    },
    relayer: {
      address: deployer.address,
      requiredConfirmations: 12,
      slippageTolerance: 100
    },
    configuredAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(deploymentsDir, 'chainswap-config.json'),
    JSON.stringify(config, null, 2)
  );

  console.log('========== Configuration Complete ==========');
  console.log('Configuration saved to: deployments/chainswap-config.json');
  console.log('\nNext Steps:');
  console.log('1. Review relayer/.env and update with your private key');
  console.log('2. Fund the relayer account with gas on destination chain');
  console.log('3. Start the relayer: cd relayer && npm start');
  console.log('4. Test the bridge with scripts/test/test-bridge.js\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

