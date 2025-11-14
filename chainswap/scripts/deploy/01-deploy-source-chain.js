const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n========== Deploying Source Chain Contracts ==========\n');

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

  // Deploy Source Token (ERC20 for testing)
  console.log('1. Deploying Source Token...');
  const SourceToken = await ethers.getContractFactory("WrappedToken"); // Reuse WrappedToken as source
  const sourceToken = await SourceToken.deploy(
    "Source Token",
    "SRC"
  );
  await sourceToken.deployed();
  console.log(`✓ Source Token deployed to: ${sourceToken.address}`);

  // Mint some tokens to deployer for testing
  const mintTx = await sourceToken.mint(deployer.address, ethers.utils.parseEther("10000"));
  await mintTx.wait();
  console.log(`✓ Minted 10,000 SRC tokens to deployer\n`);

  // Deploy Bridge Source
  console.log('2. Deploying Bridge Source...');
  const BridgeSource = await ethers.getContractFactory("BridgeSourceExtended");
  const bridgeSource = await BridgeSource.deploy(sourceToken.address);
  await bridgeSource.deployed();
  console.log(`✓ Bridge Source deployed to: ${bridgeSource.address}\n`);

  // Save deployment info
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      sourceToken: {
        address: sourceToken.address,
        name: "Source Token",
        symbol: "SRC"
      },
      bridgeSource: {
        address: bridgeSource.address
      }
    },
    deployedAt: new Date().toISOString()
  };

  const deploymentsDir = path.join(__dirname, '../../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, 'source-chain.json'),
    JSON.stringify(deployment, null, 2)
  );

  console.log('========== Deployment Summary ==========');
  console.log(`Source Token: ${sourceToken.address}`);
  console.log(`Bridge Source: ${bridgeSource.address}`);
  console.log(`\nDeployment info saved to: deployments/source-chain.json\n`);

  // Verification commands
  console.log('========== Verification Commands ==========');
  console.log(`npx hardhat verify --network ${deployment.network} ${sourceToken.address} "Source Token" "SRC"`);
  console.log(`npx hardhat verify --network ${deployment.network} ${bridgeSource.address} ${sourceToken.address}`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

