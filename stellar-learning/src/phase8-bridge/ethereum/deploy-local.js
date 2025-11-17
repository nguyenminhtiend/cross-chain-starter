/**
 * Local Deployment Script for Testing
 *
 * This script deploys the BridgeLock contract to a local Hardhat network
 * for testing purposes without needing testnet ETH.
 *
 * Usage:
 *   1. In one terminal: npx hardhat node
 *   2. In another terminal: node ethereum/deploy-local.js
 *
 * OR use the inline network (no separate node needed):
 *   node ethereum/deploy-local.js
 */

const hre = require('hardhat');
const { ethers } = require('hardhat');
const path = require('path');

async function main() {
  console.log('🚀 Deploying Bridge Contract to Local Hardhat Network');
  console.log('═'.repeat(60));

  // Get the deployer account
  const [deployer, validator1, validator2, user1] = await ethers.getSigners();

  console.log('\n📊 Network Information:');
  console.log('   Network:', hre.network.name);
  console.log('   Chain ID:', (await ethers.provider.getNetwork()).chainId);

  console.log('\n👤 Account Information:');
  console.log('   Deployer:', deployer.address);
  console.log('   Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');
  console.log('   Validator 1:', validator1.address);
  console.log('   Validator 2:', validator2.address);
  console.log('   Test User:', user1.address);

  // Get the contract artifact
  const BridgeLock = await ethers.getContractFactory('BridgeLock');

  console.log('\n📤 Deploying contract...');

  // Deploy with 2 required approvals
  const requiredApprovals = 2;
  const bridge = await BridgeLock.deploy(requiredApprovals);

  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();

  console.log('\n✅ Contract Deployed Successfully!');
  console.log('═'.repeat(60));
  console.log('   Contract Address:', bridgeAddress);
  console.log('   Required Approvals:', requiredApprovals);

  // Add validators
  console.log('\n👥 Adding Validators...');

  const tx1 = await bridge.addValidator(validator1.address);
  await tx1.wait();
  console.log('   ✅ Added Validator 1:', validator1.address);

  const tx2 = await bridge.addValidator(validator2.address);
  await tx2.wait();
  console.log('   ✅ Added Validator 2:', validator2.address);

  // Fund the contract with some ETH
  console.log('\n💰 Funding Contract...');
  const fundTx = await deployer.sendTransaction({
    to: bridgeAddress,
    value: ethers.parseEther('10.0')
  });
  await fundTx.wait();
  console.log('   ✅ Funded with 10 ETH');
  console.log('   Contract Balance:',
    ethers.formatEther(await ethers.provider.getBalance(bridgeAddress)), 'ETH'
  );

  // Test the lock function
  console.log('\n🔒 Testing Lock Function...');
  const stellarAddress = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const lockAmount = ethers.parseEther('0.1');

  const lockTx = await bridge.connect(user1).lock(stellarAddress, {
    value: lockAmount
  });
  const receipt = await lockTx.wait();

  // Find the Locked event
  const lockedEvent = receipt.logs.find(
    log => log.fragment && log.fragment.name === 'Locked'
  );

  if (lockedEvent) {
    console.log('   ✅ Lock successful!');
    console.log('   Lock ID:', lockedEvent.args[0].toString());
    console.log('   Amount:', ethers.formatEther(lockedEvent.args[2]), 'ETH');
    console.log('   Stellar Address:', lockedEvent.args[3]);
  }

  // Save deployment info to a file
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contractAddress: bridgeAddress,
    deployer: deployer.address,
    validators: [validator1.address, validator2.address],
    testUser: user1.address,
    requiredApprovals: requiredApprovals,
    deployedAt: new Date().toISOString()
  };

  const fs = require('fs');
  const deploymentPath = path.join(__dirname, 'deployment-local.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Deployment info saved to:', deploymentPath);

  console.log('\n📝 Next Steps for Testing:');
  console.log('   1. Contract is ready to use at:', bridgeAddress);
  console.log('   2. Try locking more ETH:');
  console.log('      await bridge.lock("STELLAR_ADDRESS", { value: ethers.parseEther("0.5") })');
  console.log('   3. Test unlock approvals with validators');
  console.log('   4. Check contract balance: await bridge.getBalance()');

  console.log('\n🎉 Deployment Complete!');
  console.log('═'.repeat(60));

  return {
    bridge,
    deployer,
    validator1,
    validator2,
    user1
  };
}

// Run the deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Deployment Error:', error.message);
      process.exit(1);
    });
}

module.exports = { main };
