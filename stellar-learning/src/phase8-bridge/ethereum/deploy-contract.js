/**
 * Deploy Bridge Contract Script
 *
 * NOTE: This script requires the contract to be compiled first.
 *
 * To compile the Solidity contract, you have two options:
 *
 * Option 1: Use Hardhat (Recommended)
 * 1. npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
 * 2. npx hardhat init
 * 3. Move BridgeLock.sol to contracts/ directory
 * 4. npx hardhat compile
 * 5. The ABI and bytecode will be in artifacts/
 *
 * Option 2: Use Remix IDE (Easiest for beginners)
 * 1. Go to https://remix.ethereum.org
 * 2. Create new file and paste BridgeLock.sol
 * 3. Install OpenZeppelin contracts in Remix
 * 4. Compile the contract
 * 5. Copy ABI and bytecode
 * 6. Paste them below
 */

const { ethers } = require('ethers');
const { config } = require('../config');

/**
 * Deploy the bridge contract
 *
 * Before running this script:
 * 1. Compile the BridgeLock.sol contract
 * 2. Get the ABI and bytecode
 * 3. Update the CONTRACT_ABI and CONTRACT_BYTECODE constants below
 * 4. Set ETH_PRIVATE_KEY in .env
 * 5. Make sure you have testnet ETH (get from Sepolia faucet)
 */
async function deployBridgeContract() {
  console.log('🚀 Deploying Bridge Contract to Ethereum');
  console.log('═'.repeat(50));

  try {
    // Check configuration
    if (!config.ethereum.privateKey) {
      throw new Error('ETH_PRIVATE_KEY not configured in .env');
    }

    if (config.ethereum.rpcUrl.includes('YOUR_INFURA_KEY')) {
      throw new Error('ETH_RPC_URL not configured. Get an Infura key from https://infura.io');
    }

    // Connect to Ethereum
    console.log('\n🔗 Connecting to Ethereum...');
    const provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    const wallet = new ethers.Wallet(config.ethereum.privateKey, provider);

    console.log('   Network:', (await provider.getNetwork()).name);
    console.log('   Deployer:', wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('   Balance:', ethers.formatEther(balance), 'ETH');

    if (balance === 0n) {
      throw new Error('Deployer has no ETH. Get testnet ETH from https://sepoliafaucet.com');
    }

    console.log('\n📄 Contract Configuration:');
    console.log('   Required Approvals:', config.ethereum.requiredApprovals);

    // CONTRACT PLACEHOLDER
    // Replace these with actual ABI and bytecode after compiling BridgeLock.sol
    const CONTRACT_ABI = [
      // Paste contract ABI here after compilation
    ];

    const CONTRACT_BYTECODE = '0x'; // Paste bytecode here after compilation

    if (CONTRACT_BYTECODE === '0x' || CONTRACT_ABI.length === 0) {
      console.error('\n❌ Contract not compiled yet!');
      console.log('\n📝 To compile and deploy the contract:');
      console.log('\n1. Install Hardhat:');
      console.log('   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts');
      console.log('\n2. Initialize Hardhat:');
      console.log('   npx hardhat init');
      console.log('\n3. Copy contract to hardhat project:');
      console.log('   cp src/phase8-bridge/ethereum/contracts/BridgeLock.sol contracts/');
      console.log('\n4. Compile:');
      console.log('   npx hardhat compile');
      console.log('\n5. Update this script with ABI and bytecode from:');
      console.log('   artifacts/contracts/BridgeLock.sol/BridgeLock.json');
      console.log('\n6. Run deployment again');
      console.log('\n📖 Alternative: Use Remix IDE');
      console.log('   1. Visit: https://remix.ethereum.org');
      console.log('   2. Paste BridgeLock.sol');
      console.log('   3. Compile and deploy directly from Remix');
      return;
    }

    // Deploy contract
    console.log('\n📤 Deploying contract...');

    const ContractFactory = new ethers.ContractFactory(
      CONTRACT_ABI,
      CONTRACT_BYTECODE,
      wallet
    );

    const contract = await ContractFactory.deploy(config.ethereum.requiredApprovals, {
      gasLimit: 3000000,
    });

    console.log('   TX Hash:', contract.deploymentTransaction().hash);
    console.log('   Waiting for confirmations...');

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log('\n✅ Contract Deployed Successfully!');
    console.log('═'.repeat(50));
    console.log('   Contract Address:', address);
    console.log('   Block Explorer:', `https://sepolia.etherscan.io/address/${address}`);

    // Add validators
    if (config.ethereum.validators.some(v => v && v !== '')) {
      console.log('\n👥 Adding Validators...');

      for (let i = 0; i < config.ethereum.validators.length; i++) {
        const validator = config.ethereum.validators[i];
        if (!validator || validator === '') continue;

        console.log(`   Adding validator ${i + 1}:`, validator);
        const tx = await contract.addValidator(validator, {
          gasLimit: 100000,
        });
        await tx.wait();
        console.log('   ✅ Added');
      }
    }

    console.log('\n📝 Next Steps:');
    console.log('   1. Add this to your .env file:');
    console.log(`      ETH_BRIDGE_ADDRESS=${address}`);
    console.log('   2. Fund the contract with some ETH for initial testing');
    console.log('   3. Create the Stellar wrapped asset');
    console.log('   4. Start the relayer service');

    return address;

  } catch (error) {
    console.error('\n❌ Deployment Error:', error.message);
    if (error.reason) {
      console.error('   Reason:', error.reason);
    }
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  deployBridgeContract().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { deployBridgeContract };
