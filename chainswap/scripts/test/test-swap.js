const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  console.log('\n========== Testing ChainSwap with Swap ==========\n');

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

  // Contract ABIs
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
  ];

  const BRIDGE_ABI = [
    "event Lock(address indexed from, address indexed to, uint256 amount, uint256 timestamp, uint256 indexed nonce, address targetToken, uint256 targetChain)",
    "function lock(address to, uint256 amount, address targetToken, uint256 targetChain) external"
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

  // Test parameters
  const lockAmount = ethers.utils.parseEther("10");

  // Target token address - replace with actual token you want to swap to
  // For example: WETH, USDC, etc. on destination chain
  const targetToken = process.env.TARGET_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";

  if (targetToken === "0x0000000000000000000000000000000000000000") {
    console.log('⚠️  No target token specified. Set TARGET_TOKEN_ADDRESS in .env');
    console.log('Falling back to regular bridge (no swap)\n');
  } else {
    console.log(`Target Token for Swap: ${targetToken}\n`);
  }

  const targetChain = 2;

  console.log(`Locking ${ethers.utils.formatEther(lockAmount)} SRC for swap...\n`);

  // Approve and lock
  console.log('1. Approving bridge...');
  const approveTx = await token.approve(bridge.address, lockAmount);
  await approveTx.wait();
  console.log('✓ Approved\n');

  console.log('2. Locking tokens with swap parameters...');
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

  console.log('✓ Bridge + Swap test completed!');
  console.log('The relayer will:');
  console.log('  1. Mint wrapped SRC on destination');
  console.log('  2. Swap wrapped SRC for target token');
  console.log('  3. Send target token to recipient\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

