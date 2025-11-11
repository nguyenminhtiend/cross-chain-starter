import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";
dotenv.config();

/**
 * Full Cycle Test: Chain 1 → Chain 2 → Chain 1
 *
 * This script tests the complete bridge cycle:
 * 1. Lock tokens on Chain 1 → Mint wrapped tokens on Chain 2
 * 2. Burn wrapped tokens on Chain 2 → Unlock tokens on Chain 1
 * 3. Verify complete round trip
 */

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBalanceChange(tokenContract, address, initialBalance, maxWaitTime = 20000) {
  const startTime = Date.now();
  let currentBalance = initialBalance;

  while (Date.now() - startTime < maxWaitTime) {
    await sleep(1000);
    currentBalance = await tokenContract.balanceOf(address);

    if (currentBalance !== initialBalance) {
      return currentBalance;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`   ⏳ Waiting... (${elapsed}s)\r`);
  }

  return currentBalance;
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔄 FULL CYCLE TEST: CHAIN 1 → CHAIN 2 → CHAIN 1");
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

  const targetChainId1 = ethers.id("CHAIN1");
  const targetChainId2 = ethers.id("CHAIN2");

  // ========================================================================
  // INITIAL STATE
  // ========================================================================
  console.log("📊 Initial State:");
  console.log("-".repeat(80));
  console.log(`User Address: ${wallet1.address}`);

  const startBalanceChain1 = await sourceToken.balanceOf(wallet1.address);
  const startBalanceChain2 = await wrappedToken.balanceOf(wallet2.address);
  const startBridgeBalance = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);

  console.log(`Chain 1 Balance: ${ethers.formatEther(startBalanceChain1)} tokens`);
  console.log(`Chain 2 Balance: ${ethers.formatEther(startBalanceChain2)} wrapped tokens`);
  console.log(`Bridge Reserve: ${ethers.formatEther(startBridgeBalance)} tokens`);
  console.log();

  // ========================================================================
  // PART 1: LOCK ON CHAIN 1 → MINT ON CHAIN 2
  // ========================================================================
  console.log("=" .repeat(80));
  console.log("PART 1: LOCK TOKENS ON CHAIN 1");
  console.log("=".repeat(80) + "\n");

  const lockAmount = ethers.parseEther("150");

  console.log(`1️⃣  Approving ${ethers.formatEther(lockAmount)} tokens for bridge...`);
  const approveTx1 = await sourceToken.approve(process.env.CHAIN1_BRIDGE_ADDRESS, lockAmount);
  await approveTx1.wait();
  console.log(`   ✅ Approved (TX: ${approveTx1.hash})`);
  console.log();

  console.log(`2️⃣  Locking ${ethers.formatEther(lockAmount)} tokens on Chain 1...`);
  const lockTx = await bridgeEth.lock(wallet1.address, lockAmount, targetChainId2);
  const lockReceipt = await lockTx.wait();
  console.log(`   ✅ Locked in block ${lockReceipt.blockNumber} (TX: ${lockTx.hash})`);

  const lockEvent = lockReceipt.logs
    .map(log => {
      try { return bridgeEth.interface.parseLog(log); } catch (e) { return null; }
    })
    .find(log => log && log.name === "Lock");

  const lockNonce = lockEvent.args.nonce;
  console.log(`   📝 Lock Nonce: ${lockNonce}`);
  console.log();

  console.log("3️⃣  Waiting for relayer to mint on Chain 2...");
  const balanceAfterLock = await waitForBalanceChange(
    wrappedToken,
    wallet2.address,
    startBalanceChain2,
    20000
  );
  console.log();

  if (balanceAfterLock > startBalanceChain2) {
    const minted = balanceAfterLock - startBalanceChain2;
    console.log(`   ✅ Success! Minted ${ethers.formatEther(minted)} wrapped tokens on Chain 2`);
  } else {
    console.log(`   ❌ Failed! No tokens minted on Chain 2`);
    console.log(`   Relayer may not be running or processing failed`);
    process.exit(1);
  }
  console.log();

  // Verify lock state
  const balanceAfterLockChain1 = await sourceToken.balanceOf(wallet1.address);
  const bridgeBalanceAfterLock = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);

  console.log("📊 State After Lock:");
  console.log("-".repeat(80));
  console.log(`Chain 1 Balance: ${ethers.formatEther(balanceAfterLockChain1)} tokens (${ethers.formatEther(startBalanceChain1 - balanceAfterLockChain1)} locked)`);
  console.log(`Chain 2 Balance: ${ethers.formatEther(balanceAfterLock)} wrapped tokens (+${ethers.formatEther(balanceAfterLock - startBalanceChain2)} minted)`);
  console.log(`Bridge Reserve: ${ethers.formatEther(bridgeBalanceAfterLock)} tokens (+${ethers.formatEther(bridgeBalanceAfterLock - startBridgeBalance)} received)`);
  console.log();

  // Wait a bit before burning
  console.log("⏳ Waiting 3 seconds before starting burn...\n");
  await sleep(3000);

  // ========================================================================
  // PART 2: BURN ON CHAIN 2 → UNLOCK ON CHAIN 1
  // ========================================================================
  console.log("=".repeat(80));
  console.log("PART 2: BURN TOKENS ON CHAIN 2");
  console.log("=".repeat(80) + "\n");

  const burnAmount = ethers.parseEther("100");

  console.log(`4️⃣  Approving ${ethers.formatEther(burnAmount)} wrapped tokens for bridge...`);
  const approveTx2 = await wrappedToken.approve(process.env.CHAIN2_BRIDGE_ADDRESS, burnAmount);
  await approveTx2.wait();
  console.log(`   ✅ Approved (TX: ${approveTx2.hash})`);
  console.log();

  console.log(`5️⃣  Burning ${ethers.formatEther(burnAmount)} wrapped tokens on Chain 2...`);
  const burnTx = await bridgeBSC.burn(wallet1.address, burnAmount, targetChainId1);
  const burnReceipt = await burnTx.wait();
  console.log(`   ✅ Burned in block ${burnReceipt.blockNumber} (TX: ${burnTx.hash})`);

  const burnEvent = burnReceipt.logs
    .map(log => {
      try { return bridgeBSC.interface.parseLog(log); } catch (e) { return null; }
    })
    .find(log => log && log.name === "Burn");

  const burnNonce = burnEvent.args.nonce;
  console.log(`   📝 Burn Nonce: ${burnNonce}`);
  console.log();

  console.log("6️⃣  Waiting for relayer to unlock on Chain 1...");
  const finalBalanceChain1 = await waitForBalanceChange(
    sourceToken,
    wallet1.address,
    balanceAfterLockChain1,
    20000
  );
  console.log();

  if (finalBalanceChain1 > balanceAfterLockChain1) {
    const unlocked = finalBalanceChain1 - balanceAfterLockChain1;
    console.log(`   ✅ Success! Unlocked ${ethers.formatEther(unlocked)} tokens on Chain 1`);
  } else {
    console.log(`   ❌ Failed! No tokens unlocked on Chain 1`);
    console.log(`   Relayer may not be processing burn events`);
    process.exit(1);
  }
  console.log();

  // ========================================================================
  // FINAL VERIFICATION
  // ========================================================================
  console.log("=".repeat(80));
  console.log("📊 FINAL STATE & VERIFICATION");
  console.log("=".repeat(80) + "\n");

  const finalBalanceChain2 = await wrappedToken.balanceOf(wallet2.address);
  const finalBridgeBalance = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);

  console.log("Final Balances:");
  console.log("-".repeat(80));
  console.log(`Chain 1 Balance: ${ethers.formatEther(finalBalanceChain1)} tokens`);
  console.log(`Chain 2 Balance: ${ethers.formatEther(finalBalanceChain2)} wrapped tokens`);
  console.log(`Bridge Reserve: ${ethers.formatEther(finalBridgeBalance)} tokens`);
  console.log();

  console.log("Balance Changes:");
  console.log("-".repeat(80));
  const totalChange = finalBalanceChain1 - startBalanceChain1;
  console.log(`Chain 1: ${totalChange >= 0 ? "+" : ""}${ethers.formatEther(totalChange)} tokens`);
  console.log(`Chain 2: +${ethers.formatEther(finalBalanceChain2 - startBalanceChain2)} wrapped tokens`);
  console.log(`Bridge: +${ethers.formatEther(finalBridgeBalance - startBridgeBalance)} tokens locked`);
  console.log();

  // Verify nonces
  const lockNonceProcessed = await bridgeBSC.processedNonces(lockNonce);
  const burnNonceProcessed = await bridgeEth.processedNonces(burnNonce);

  console.log("Nonce Verification:");
  console.log("-".repeat(80));
  console.log(`Lock Nonce ${lockNonce} processed on Chain 2: ${lockNonceProcessed ? "✅" : "❌"}`);
  console.log(`Burn Nonce ${burnNonce} processed on Chain 1: ${burnNonceProcessed ? "✅" : "❌"}`);
  console.log();

  // Calculate expected vs actual
  const expectedNetChange = burnAmount - lockAmount; // -50 tokens
  const actualNetChange = finalBalanceChain1 - startBalanceChain1;
  const expectedWrappedBalance = startBalanceChain2 + lockAmount - burnAmount; // +50 wrapped
  const actualWrappedBalance = finalBalanceChain2;
  const expectedBridgeBalance = startBridgeBalance + lockAmount - burnAmount; // +50 locked
  const actualBridgeBalance = finalBridgeBalance;

  // Success criteria
  const netChangeCorrect = actualNetChange === expectedNetChange;
  const wrappedBalanceCorrect = actualWrappedBalance === expectedWrappedBalance;
  const bridgeBalanceCorrect = actualBridgeBalance === expectedBridgeBalance;
  const noncesCorrect = lockNonceProcessed && burnNonceProcessed;

  console.log("=".repeat(80));
  if (netChangeCorrect && wrappedBalanceCorrect && bridgeBalanceCorrect && noncesCorrect) {
    console.log("✅ FULL CYCLE TEST PASSED!");
    console.log("=".repeat(80));
    console.log(`✅ Locked ${ethers.formatEther(lockAmount)} → Minted ${ethers.formatEther(lockAmount)} wrapped`);
    console.log(`✅ Burned ${ethers.formatEther(burnAmount)} wrapped → Unlocked ${ethers.formatEther(burnAmount)}`);
    console.log(`✅ Net change: ${ethers.formatEther(expectedNetChange)} tokens (${ethers.formatEther(lockAmount)} out, ${ethers.formatEther(burnAmount)} back)`);
    console.log(`✅ Bridge reserve increased by: ${ethers.formatEther(expectedBridgeBalance - startBridgeBalance)} tokens`);
    console.log(`✅ All nonces processed correctly`);
    console.log("=".repeat(80));
    console.log("\n🎉 Cross-chain bridge is working perfectly!\n");
  } else {
    console.log("❌ FULL CYCLE TEST FAILED!");
    console.log("=".repeat(80));
    if (!netChangeCorrect) {
      console.log(`❌ Chain 1 net change: Expected ${ethers.formatEther(expectedNetChange)}, got ${ethers.formatEther(actualNetChange)}`);
    }
    if (!wrappedBalanceCorrect) {
      console.log(`❌ Chain 2 balance: Expected ${ethers.formatEther(expectedWrappedBalance)}, got ${ethers.formatEther(actualWrappedBalance)}`);
    }
    if (!bridgeBalanceCorrect) {
      console.log(`❌ Bridge balance: Expected ${ethers.formatEther(expectedBridgeBalance)}, got ${ethers.formatEther(actualBridgeBalance)}`);
    }
    if (!noncesCorrect) {
      console.log(`❌ Nonces not processed correctly`);
    }
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
