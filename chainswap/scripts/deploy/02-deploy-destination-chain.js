const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Uniswap V2 Router addresses by network
const UNISWAP_ROUTERS = {
  mainnet: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  sepolia: "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008", // Uniswap V2 on Sepolia
  arbitrum: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
  arbitrumSepolia: "0x101F443B4d1b059569D643917553c771E1b9663E", // Example
  bscTestnet: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", // PancakeSwap testnet
  localhost: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" // Use mainnet address for fork
};

async function main() {
  console.log('\n========== Deploying Destination Chain Contracts ==========\n');

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === 'unknown' ? 'localhost' : network.name;
  console.log(`Network: ${networkName} (Chain ID: ${network.chainId})\n`);

  // Get Uniswap router address
  const uniswapRouter = UNISWAP_ROUTERS[networkName] || UNISWAP_ROUTERS.localhost;
  console.log(`Using Uniswap Router: ${uniswapRouter}\n`);

  // Deploy Wrapped Token
  console.log('1. Deploying Wrapped Token...');
  const WrappedToken = await ethers.getContractFactory("WrappedToken");
  const wrappedToken = await WrappedToken.deploy(
    "Wrapped Source Token",
    "wSRC"
  );
  await wrappedToken.deployed();
  console.log(`✓ Wrapped Token deployed to: ${wrappedToken.address}\n`);

  // Deploy ChainSwap Bridge
  console.log('2. Deploying ChainSwap Bridge...');
  const ChainSwapBridge = await ethers.getContractFactory("ChainSwapBridge");
  const bridge = await ChainSwapBridge.deploy(
    wrappedToken.address,
    uniswapRouter
  );
  await bridge.deployed();
  console.log(`✓ ChainSwap Bridge deployed to: ${bridge.address}\n`);

  // Transfer wrapped token ownership to bridge
  console.log('3. Configuring contracts...');
  const transferTx = await wrappedToken.transferOwnership(bridge.address);
  await transferTx.wait();
  console.log(`✓ Wrapped Token ownership transferred to Bridge\n`);

  // Deploy Price Oracle (optional)
  console.log('4. Deploying Price Oracle...');
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.deployed();
  console.log(`✓ Price Oracle deployed to: ${priceOracle.address}\n`);

  // Save deployment info
  const deployment = {
    network: networkName,
    chainId: network.chainId,
    deployer: deployer.address,
    contracts: {
      wrappedToken: {
        address: wrappedToken.address,
        name: "Wrapped Source Token",
        symbol: "wSRC"
      },
      chainSwapBridge: {
        address: bridge.address
      },
      priceOracle: {
        address: priceOracle.address
      },
      uniswapRouter: {
        address: uniswapRouter
      }
    },
    deployedAt: new Date().toISOString()
  };

  const deploymentsDir = path.join(__dirname, '../../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, 'destination-chain.json'),
    JSON.stringify(deployment, null, 2)
  );

  console.log('========== Deployment Summary ==========');
  console.log(`Wrapped Token: ${wrappedToken.address}`);
  console.log(`ChainSwap Bridge: ${bridge.address}`);
  console.log(`Price Oracle: ${priceOracle.address}`);
  console.log(`Uniswap Router: ${uniswapRouter}`);
  console.log(`\nDeployment info saved to: deployments/destination-chain.json\n`);

  // Verification commands
  console.log('========== Verification Commands ==========');
  console.log(`npx hardhat verify --network ${networkName} ${wrappedToken.address} "Wrapped Source Token" "wSRC"`);
  console.log(`npx hardhat verify --network ${networkName} ${bridge.address} ${wrappedToken.address} ${uniswapRouter}`);
  console.log(`npx hardhat verify --network ${networkName} ${priceOracle.address}`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

