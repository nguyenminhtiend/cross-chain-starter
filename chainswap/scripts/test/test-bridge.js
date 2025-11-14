const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  console.log('\n========== Testing ChainSwap Bridge ==========\n');

  // Load deployment info
  const deploymentsDir = path.join(__dirname, '../../deployments');
  const sourceDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, 'source-chain.json'))
  );

  // Setup provider and signer
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.SOURCE_CHAIN_RPC || 'http://localhost:8545'
  );

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Testing with account: ${signer.address}\n`);

  // Contract ABIs (simplified)
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

  const BRIDGE_ABI = [
    "event Lock(address indexed from, address indexed to, uint256 amount, uint256 timestamp, uint256 indexed nonce, address targetToken, uint256 targetChain)",
    "function lock(address to, uint256 amount, address targetToken, uint256 targetChain) external",
    "function currentNonce() view returns (uint256)",
    "function totalLocked() view returns (uint256)"
  ];

  // Get contracts
  const token = new ethers.Contract(
    sourceDeployment.contracts.sourceToken.address,
    ERC20_ABI,
    signer
  );

  const bridge = new ethers.Contract(
    sourceDeployment.contracts.bridgeSource.address,
    BRIDGE_ABI,
    signer
  );

  // Check balance
  const balance = await token.balanceOf(signer.address);
  console.log(`Token Balance: ${ethers.utils.formatEther(balance)} SRC`);

  if (balance.eq(0)) {
    console.log('❌ No tokens to bridge. Please mint some tokens first.');
    return;
  }

  // Test parameters
  const lockAmount = ethers.utils.parseEther("10");
  const targetToken = ethers.constants.AddressZero; // No swap
  const targetChain = 2;

  console.log(`\nLocking ${ethers.utils.formatEther(lockAmount)} SRC...\n`);

  // Approve bridge
  console.log('1. Approving bridge...');
  const approveTx = await token.approve(bridge.address, lockAmount);
  await approveTx.wait();
  console.log('✓ Approved\n');

  // Lock tokens
  console.log('2. Locking tokens...');
  const lockTx = await bridge.lock(
    signer.address,
    lockAmount,
    targetToken,
    targetChain
  );
  console.log(`Transaction hash: ${lockTx.hash}`);

  const receipt = await lockTx.wait();
  console.log(`✓ Locked in block ${receipt.blockNumber}\n`);

  // Parse event
  const lockEvent = receipt.events.find(e => e.event === 'Lock');
  if (lockEvent) {
    console.log('Lock Event:');
    console.log(`  From: ${lockEvent.args.from}`);
    console.log(`  To: ${lockEvent.args.to}`);
    console.log(`  Amount: ${ethers.utils.formatEther(lockEvent.args.amount)} SRC`);
    console.log(`  Nonce: ${lockEvent.args.nonce.toString()}`);
    console.log(`  Target Token: ${lockEvent.args.targetToken}`);
    console.log(`  Target Chain: ${lockEvent.args.targetChain.toString()}\n`);
  }

  // Check total locked
  const totalLocked = await bridge.totalLocked();
  console.log(`Total Locked: ${ethers.utils.formatEther(totalLocked)} SRC`);

  console.log('\n✓ Bridge test completed!');
  console.log('The relayer should pick up this event and mint tokens on destination chain.\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

