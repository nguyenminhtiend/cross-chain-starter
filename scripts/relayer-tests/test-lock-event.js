import pkg from 'hardhat';
const { ethers } = pkg;
import dotenv from 'dotenv';
dotenv.config();

/**
 * Test Lock Event: Chain 1 → Chain 2
 *
 * This script:
 * 1. Locks tokens on Chain 1 (Ethereum)
 * 2. Relayer detects the Lock event
 * 3. Relayer mints wrapped tokens on Chain 2 (BSC)
 * 4. Verifies the wrapped tokens appear in user's wallet
 */

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔒 TESTING LOCK EVENT: CHAIN 1 → CHAIN 2');
  console.log('='.repeat(80) + '\n');

  // Setup providers and wallets
  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
  const [user] = await ethers.getSigners();
  const wallet1 = user.connect(chain1Provider);
  const wallet2 = user.connect(chain2Provider);

  // Get contract instances
  const sourceToken = await ethers.getContractAt(
    'SourceToken',
    process.env.CHAIN1_TOKEN_ADDRESS,
    wallet1
  );

  const bridgeEth = await ethers.getContractAt(
    'BridgeEthereum',
    process.env.CHAIN1_BRIDGE_ADDRESS,
    wallet1
  );

  const wrappedToken = await ethers.getContractAt(
    'WrappedToken',
    process.env.CHAIN2_TOKEN_ADDRESS,
    wallet2
  );

  const bridgeBSC = await ethers.getContractAt(
    'BridgeBSC',
    process.env.CHAIN2_BRIDGE_ADDRESS,
    wallet2
  );

  // Display initial state
  console.log('📊 Initial State:');
  console.log('-'.repeat(80));
  console.log(`User Address: ${wallet1.address}`);

  const initialBalanceChain1 = await sourceToken.balanceOf(wallet1.address);
  const initialBalanceChain2 = await wrappedToken.balanceOf(wallet1.address);

  console.log(`Chain 1 (Source Token): ${ethers.formatEther(initialBalanceChain1)} tokens`);
  console.log(`Chain 2 (Wrapped Token): ${ethers.formatEther(initialBalanceChain2)} tokens`);

  const bridgeBalance = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);
  console.log(`Bridge Reserve: ${ethers.formatEther(bridgeBalance)} tokens`);
  console.log();

  // Define transfer amount
  const amount = ethers.parseEther('100');
  const targetChain = ethers.id('CHAIN2');

  console.log('🔄 Starting Lock Process:');
  console.log('-'.repeat(80));

  // Step 1: Approve bridge
  console.log('1️⃣  Approving bridge to spend tokens...');
  const approveTx = await sourceToken.approve(process.env.CHAIN1_BRIDGE_ADDRESS, amount);
  await approveTx.wait();
  console.log(`   ✅ Approved: ${ethers.formatEther(amount)} tokens`);
  console.log(`   TX: ${approveTx.hash}`);
  console.log();

  // Step 2: Lock tokens
  console.log('2️⃣  Locking tokens on Chain 1...');
  const lockTx = await bridgeEth.lock(wallet1.address, amount, targetChain);
  console.log(`   ⏳ Transaction sent: ${lockTx.hash}`);

  const lockReceipt = await lockTx.wait();
  console.log(`   ✅ Locked in block: ${lockReceipt.blockNumber}`);

  // Parse Lock event
  const lockEvent = lockReceipt.logs
    .map((log) => {
      try {
        return bridgeEth.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .find((log) => log && log.name === 'Lock');

  if (lockEvent) {
    console.log(`   📝 Lock Event Emitted:`);
    console.log(`      - From: ${lockEvent.args.from}`);
    console.log(`      - To: ${lockEvent.args.to}`);
    console.log(`      - Amount: ${ethers.formatEther(lockEvent.args.amount)} tokens`);
    console.log(`      - Nonce: ${lockEvent.args.nonce.toString()}`);
  }
  console.log();

  // Step 3: Wait for relayer
  console.log('3️⃣  Waiting for relayer to process...');
  console.log('   ⏳ Relayer should detect Lock event and mint on Chain 2...');

  // Poll for balance change on Chain 2
  let retries = 0;
  const maxRetries = 20;
  let finalBalance;

  while (retries < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    finalBalance = await wrappedToken.balanceOf(wallet1.address);

    if (finalBalance > initialBalanceChain2) {
      console.log(`   ✅ Wrapped tokens detected on Chain 2!`);
      break;
    }

    retries++;
    process.stdout.write(`   ⏳ Waiting... (${retries}/${maxRetries})\r`);
  }
  console.log('\n');

  // Step 4: Verify final state
  console.log('📊 Final State:');
  console.log('-'.repeat(80));

  const finalBalanceChain1 = await sourceToken.balanceOf(wallet1.address);
  const finalBalanceChain2 = await wrappedToken.balanceOf(wallet1.address);
  const finalBridgeBalance = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);

  console.log(
    `Chain 1 (Source Token): ${ethers.formatEther(finalBalanceChain1)} tokens (${ethers.formatEther(initialBalanceChain1 - finalBalanceChain1)} locked)`
  );
  console.log(
    `Chain 2 (Wrapped Token): ${ethers.formatEther(finalBalanceChain2)} tokens (+${ethers.formatEther(finalBalanceChain2 - initialBalanceChain2)} minted)`
  );
  console.log(
    `Bridge Reserve: ${ethers.formatEther(finalBridgeBalance)} tokens (+${ethers.formatEther(finalBridgeBalance - bridgeBalance)} received)`
  );
  console.log();

  // Verify nonce was processed
  const nonce = lockEvent.args.nonce;
  const isProcessed = await bridgeBSC.processedNonces(nonce);
  console.log(`Nonce ${nonce} processed on Chain 2: ${isProcessed ? '✅ Yes' : '❌ No'}`);
  console.log();

  // Final verification
  const expectedIncrease = amount;
  const actualIncrease = finalBalanceChain2 - initialBalanceChain2;

  if (actualIncrease === expectedIncrease) {
    console.log('='.repeat(80));
    console.log('✅ LOCK EVENT TEST PASSED!');
    console.log('='.repeat(80));
    console.log(`Successfully locked ${ethers.formatEther(amount)} tokens on Chain 1`);
    console.log(
      `Relayer successfully minted ${ethers.formatEther(actualIncrease)} wrapped tokens on Chain 2`
    );
    console.log('='.repeat(80) + '\n');
  } else {
    console.log('='.repeat(80));
    console.log('❌ LOCK EVENT TEST FAILED!');
    console.log('='.repeat(80));
    console.log(`Expected: ${ethers.formatEther(expectedIncrease)} tokens`);
    console.log(`Actual: ${ethers.formatEther(actualIncrease)} tokens`);
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
