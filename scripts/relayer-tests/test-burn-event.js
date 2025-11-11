import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";
dotenv.config();

/**
 * Test Burn Event: Chain 2 → Chain 1
 *
 * This script:
 * 1. Burns wrapped tokens on Chain 2 (BSC)
 * 2. Relayer detects the Burn event
 * 3. Relayer unlocks original tokens on Chain 1 (Ethereum)
 * 4. Verifies the tokens appear in user's wallet on Chain 1
 */

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔥 TESTING BURN EVENT: CHAIN 2 → CHAIN 1");
  console.log("=".repeat(80) + "\n");

  // Setup providers and wallets
  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
  const [user] = await ethers.getSigners();
  const wallet1 = user.connect(chain1Provider);
  const wallet2 = user.connect(chain2Provider);

  // Get contract instances
  const sourceToken = await ethers.getContractAt(
    "SourceToken",
    process.env.CHAIN1_TOKEN_ADDRESS,
    wallet1
  );

  const bridgeEth = await ethers.getContractAt(
    "BridgeEthereum",
    process.env.CHAIN1_BRIDGE_ADDRESS,
    wallet1
  );

  const wrappedToken = await ethers.getContractAt(
    "WrappedToken",
    process.env.CHAIN2_TOKEN_ADDRESS,
    wallet2
  );

  const bridgeBSC = await ethers.getContractAt(
    "BridgeBSC",
    process.env.CHAIN2_BRIDGE_ADDRESS,
    wallet2
  );

  // Display initial state
  console.log("📊 Initial State:");
  console.log("-".repeat(80));
  console.log(`User Address: ${wallet1.address}`);

  const initialBalanceChain1 = await sourceToken.balanceOf(wallet1.address);
  const initialBalanceChain2 = await wrappedToken.balanceOf(wallet2.address);

  console.log(`Chain 1 (Source Token): ${ethers.formatEther(initialBalanceChain1)} tokens`);
  console.log(`Chain 2 (Wrapped Token): ${ethers.formatEther(initialBalanceChain2)} tokens`);

  const bridgeBalance = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);
  console.log(`Bridge Reserve: ${ethers.formatEther(bridgeBalance)} tokens`);
  console.log();

  // Check if user has wrapped tokens to burn
  if (initialBalanceChain2 === 0n) {
    console.log("⚠️  Warning: No wrapped tokens to burn!");
    console.log("   Please run test-lock-event.js first to get some wrapped tokens.");
    console.log();
    process.exit(1);
  }

  // Define burn amount (burn 50 tokens)
  const burnAmount = ethers.parseEther("50");
  const targetChain = ethers.id("CHAIN1");

  // Verify user has enough tokens
  if (initialBalanceChain2 < burnAmount) {
    console.log(`⚠️  Warning: Insufficient wrapped tokens!`);
    console.log(`   Required: ${ethers.formatEther(burnAmount)} tokens`);
    console.log(`   Available: ${ethers.formatEther(initialBalanceChain2)} tokens`);
    console.log();
    process.exit(1);
  }

  console.log("🔄 Starting Burn Process:");
  console.log("-".repeat(80));

  // Step 1: Approve bridge
  console.log("1️⃣  Approving bridge to burn wrapped tokens...");
  const approveTx = await wrappedToken.approve(process.env.CHAIN2_BRIDGE_ADDRESS, burnAmount);
  await approveTx.wait();
  console.log(`   ✅ Approved: ${ethers.formatEther(burnAmount)} wrapped tokens`);
  console.log(`   TX: ${approveTx.hash}`);
  console.log();

  // Step 2: Burn tokens
  console.log("2️⃣  Burning wrapped tokens on Chain 2...");
  const burnTx = await bridgeBSC.burn(wallet1.address, burnAmount, targetChain);
  console.log(`   ⏳ Transaction sent: ${burnTx.hash}`);

  const burnReceipt = await burnTx.wait();
  console.log(`   ✅ Burned in block: ${burnReceipt.blockNumber}`);

  // Parse Burn event
  const burnEvent = burnReceipt.logs
    .map(log => {
      try {
        return bridgeBSC.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .find(log => log && log.name === "Burn");

  if (burnEvent) {
    console.log(`   📝 Burn Event Emitted:`);
    console.log(`      - From: ${burnEvent.args.from}`);
    console.log(`      - To: ${burnEvent.args.to}`);
    console.log(`      - Amount: ${ethers.formatEther(burnEvent.args.amount)} tokens`);
    console.log(`      - Nonce: ${burnEvent.args.nonce.toString()}`);
  }
  console.log();

  // Step 3: Wait for relayer
  console.log("3️⃣  Waiting for relayer to process...");
  console.log("   ⏳ Relayer should detect Burn event and unlock on Chain 1...");

  // Poll for balance change on Chain 1
  let retries = 0;
  const maxRetries = 20;
  let finalBalance;

  while (retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    finalBalance = await sourceToken.balanceOf(wallet1.address);

    if (finalBalance > initialBalanceChain1) {
      console.log(`   ✅ Tokens unlocked on Chain 1!`);
      break;
    }

    retries++;
    process.stdout.write(`   ⏳ Waiting... (${retries}/${maxRetries})\r`);
  }
  console.log("\n");

  // Step 4: Verify final state
  console.log("📊 Final State:");
  console.log("-".repeat(80));

  const finalBalanceChain1 = await sourceToken.balanceOf(wallet1.address);
  const finalBalanceChain2 = await wrappedToken.balanceOf(wallet2.address);
  const finalBridgeBalance = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);

  console.log(`Chain 1 (Source Token): ${ethers.formatEther(finalBalanceChain1)} tokens (+${ethers.formatEther(finalBalanceChain1 - initialBalanceChain1)} unlocked)`);
  console.log(`Chain 2 (Wrapped Token): ${ethers.formatEther(finalBalanceChain2)} tokens (${ethers.formatEther(initialBalanceChain2 - finalBalanceChain2)} burned)`);
  console.log(`Bridge Reserve: ${ethers.formatEther(finalBridgeBalance)} tokens (${ethers.formatEther(bridgeBalance - finalBridgeBalance)} released)`);
  console.log();

  // Verify nonce was processed
  const nonce = burnEvent.args.nonce;
  const isProcessed = await bridgeEth.processedNonces(nonce);
  console.log(`Nonce ${nonce} processed on Chain 1: ${isProcessed ? "✅ Yes" : "❌ No"}`);
  console.log();

  // Final verification
  const expectedIncrease = burnAmount;
  const actualIncrease = finalBalanceChain1 - initialBalanceChain1;
  const expectedBurned = burnAmount;
  const actualBurned = initialBalanceChain2 - finalBalanceChain2;

  if (actualIncrease === expectedIncrease && actualBurned === expectedBurned) {
    console.log("=".repeat(80));
    console.log("✅ BURN EVENT TEST PASSED!");
    console.log("=".repeat(80));
    console.log(`Successfully burned ${ethers.formatEther(burnAmount)} wrapped tokens on Chain 2`);
    console.log(`Relayer successfully unlocked ${ethers.formatEther(actualIncrease)} tokens on Chain 1`);
    console.log("=".repeat(80) + "\n");
  } else {
    console.log("=".repeat(80));
    console.log("❌ BURN EVENT TEST FAILED!");
    console.log("=".repeat(80));
    console.log(`Expected unlock: ${ethers.formatEther(expectedIncrease)} tokens`);
    console.log(`Actual unlock: ${ethers.formatEther(actualIncrease)} tokens`);
    console.log(`Expected burn: ${ethers.formatEther(expectedBurned)} tokens`);
    console.log(`Actual burn: ${ethers.formatEther(actualBurned)} tokens`);
    console.log("=".repeat(80) + "\n");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
