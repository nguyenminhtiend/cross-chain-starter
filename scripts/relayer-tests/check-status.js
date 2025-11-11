import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";
dotenv.config();

/**
 * Status Checker
 *
 * Verifies that everything is ready for testing:
 * - Blockchain nodes are running
 * - Contracts are deployed
 * - Relayer account has gas
 * - Initial token balances are correct
 */

async function checkNodeConnection(rpcUrl, chainName) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`   ✅ ${chainName} is running`);
    console.log(`      - RPC: ${rpcUrl}`);
    console.log(`      - Chain ID: ${network.chainId}`);
    console.log(`      - Block: ${blockNumber}`);
    return { connected: true, provider };
  } catch (error) {
    console.log(`   ❌ ${chainName} is NOT running`);
    console.log(`      - RPC: ${rpcUrl}`);
    console.log(`      - Error: ${error.message}`);
    return { connected: false, provider: null };
  }
}

async function checkContractDeployed(provider, address, name) {
  try {
    const code = await provider.getCode(address);
    if (code === "0x") {
      console.log(`   ❌ ${name} NOT deployed at ${address}`);
      return false;
    }
    console.log(`   ✅ ${name} deployed at ${address}`);
    return true;
  } catch (error) {
    console.log(`   ❌ ${name} check failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 RELAYER SYSTEM STATUS CHECK");
  console.log("=".repeat(80) + "\n");

  let allGood = true;

  // ========================================================================
  // 1. Check Environment Variables
  // ========================================================================
  console.log("1️⃣  Checking Environment Variables");
  console.log("-".repeat(80));

  const requiredEnvVars = [
    "CHAIN1_RPC",
    "CHAIN2_RPC",
    "CHAIN1_TOKEN_ADDRESS",
    "CHAIN1_BRIDGE_ADDRESS",
    "CHAIN2_TOKEN_ADDRESS",
    "CHAIN2_BRIDGE_ADDRESS",
    "RELAYER_PRIVATE_KEY",
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.log(`   ❌ Missing environment variables: ${missingVars.join(", ")}`);
    console.log(`   Fix: Run 'pnpm run deploy:all' to deploy contracts`);
    allGood = false;
  } else {
    console.log(`   ✅ All environment variables configured`);
  }
  console.log();

  // ========================================================================
  // 2. Check Blockchain Nodes
  // ========================================================================
  console.log("2️⃣  Checking Blockchain Nodes");
  console.log("-".repeat(80));

  const chain1Status = await checkNodeConnection(
    process.env.CHAIN1_RPC || "http://127.0.0.1:8545",
    "Chain 1 (Ethereum)"
  );
  console.log();

  const chain2Status = await checkNodeConnection(
    process.env.CHAIN2_RPC || "http://127.0.0.1:8546",
    "Chain 2 (BSC)"
  );
  console.log();

  if (!chain1Status.connected || !chain2Status.connected) {
    console.log(`   ❌ One or both nodes not running`);
    console.log(`   Fix: Start nodes with 'pnpm run node:chain1' and 'pnpm run node:chain2'`);
    allGood = false;
  }

  // ========================================================================
  // 3. Check Contract Deployments
  // ========================================================================
  if (chain1Status.connected && chain2Status.connected && missingVars.length === 0) {
    console.log("3️⃣  Checking Contract Deployments");
    console.log("-".repeat(80));

    const chain1TokenOk = await checkContractDeployed(
      chain1Status.provider,
      process.env.CHAIN1_TOKEN_ADDRESS,
      "Chain 1 Source Token"
    );

    const chain1BridgeOk = await checkContractDeployed(
      chain1Status.provider,
      process.env.CHAIN1_BRIDGE_ADDRESS,
      "Chain 1 Bridge"
    );

    const chain2TokenOk = await checkContractDeployed(
      chain2Status.provider,
      process.env.CHAIN2_TOKEN_ADDRESS,
      "Chain 2 Wrapped Token"
    );

    const chain2BridgeOk = await checkContractDeployed(
      chain2Status.provider,
      process.env.CHAIN2_BRIDGE_ADDRESS,
      "Chain 2 Bridge"
    );
    console.log();

    if (!chain1TokenOk || !chain1BridgeOk || !chain2TokenOk || !chain2BridgeOk) {
      console.log(`   ❌ Some contracts not deployed`);
      console.log(`   Fix: Run 'pnpm run deploy:all'`);
      allGood = false;
    }

    // ========================================================================
    // 4. Check Relayer Account
    // ========================================================================
    console.log("4️⃣  Checking Relayer Account");
    console.log("-".repeat(80));

    try {
      const relayerWallet1 = new ethers.Wallet(
        process.env.RELAYER_PRIVATE_KEY,
        chain1Status.provider
      );
      const relayerWallet2 = new ethers.Wallet(
        process.env.RELAYER_PRIVATE_KEY,
        chain2Status.provider
      );

      console.log(`   Address: ${relayerWallet1.address}`);

      const balance1 = await chain1Status.provider.getBalance(relayerWallet1.address);
      const balance2 = await chain2Status.provider.getBalance(relayerWallet2.address);

      console.log(`   Chain 1 Balance: ${ethers.formatEther(balance1)} ETH`);
      console.log(`   Chain 2 Balance: ${ethers.formatEther(balance2)} BNB`);

      if (balance1 === 0n || balance2 === 0n) {
        console.log(`   ⚠️  Low balance on one or both chains`);
        allGood = false;
      } else {
        console.log(`   ✅ Relayer has sufficient gas on both chains`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking relayer account: ${error.message}`);
      allGood = false;
    }
    console.log();

    // ========================================================================
    // 5. Check Test Account Balances
    // ========================================================================
    console.log("5️⃣  Checking Test Account Balances");
    console.log("-".repeat(80));

    try {
      const [testUser] = await ethers.getSigners();
      const wallet1 = testUser.connect(chain1Status.provider);
      const wallet2 = testUser.connect(chain2Status.provider);

      console.log(`   Test Account: ${testUser.address}`);

      // Check native balances
      const nativeBalance1 = await chain1Status.provider.getBalance(wallet1.address);
      const nativeBalance2 = await chain2Status.provider.getBalance(wallet2.address);

      console.log(`   Chain 1 Native: ${ethers.formatEther(nativeBalance1)} ETH`);
      console.log(`   Chain 2 Native: ${ethers.formatEther(nativeBalance2)} BNB`);

      // Check token balances
      const sourceToken = await ethers.getContractAt(
        "SourceToken",
        process.env.CHAIN1_TOKEN_ADDRESS,
        wallet1
      );
      const wrappedToken = await ethers.getContractAt(
        "WrappedToken",
        process.env.CHAIN2_TOKEN_ADDRESS,
        wallet2
      );

      const tokenBalance1 = await sourceToken.balanceOf(wallet1.address);
      const tokenBalance2 = await wrappedToken.balanceOf(wallet2.address);

      console.log(`   Chain 1 Tokens: ${ethers.formatEther(tokenBalance1)} tokens`);
      console.log(`   Chain 2 Tokens: ${ethers.formatEther(tokenBalance2)} wrapped tokens`);

      if (tokenBalance1 === 0n) {
        console.log(`   ⚠️  No tokens on Chain 1 for testing`);
        console.log(`   Note: You may need to mint tokens first`);
      } else {
        console.log(`   ✅ Test account has tokens for testing`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking test account: ${error.message}`);
      allGood = false;
    }
    console.log();

    // ========================================================================
    // 6. Check Bridge Configuration
    // ========================================================================
    console.log("6️⃣  Checking Bridge Configuration");
    console.log("-".repeat(80));

    try {
      const bridgeEth = await ethers.getContractAt(
        "BridgeEthereum",
        process.env.CHAIN1_BRIDGE_ADDRESS,
        chain1Status.provider
      );
      const bridgeBSC = await ethers.getContractAt(
        "BridgeBSC",
        process.env.CHAIN2_BRIDGE_ADDRESS,
        chain2Status.provider
      );

      const paused1 = await bridgeEth.paused();
      const paused2 = await bridgeBSC.paused();

      console.log(`   Chain 1 Bridge Paused: ${paused1 ? "❌ Yes" : "✅ No"}`);
      console.log(`   Chain 2 Bridge Paused: ${paused2 ? "❌ Yes" : "✅ No"}`);

      if (paused1 || paused2) {
        console.log(`   ⚠️  One or both bridges are paused`);
        allGood = false;
      } else {
        console.log(`   ✅ Both bridges are operational`);
      }

      // Check bridge has tokens
      const sourceToken = await ethers.getContractAt(
        "SourceToken",
        process.env.CHAIN1_TOKEN_ADDRESS,
        chain1Status.provider
      );
      const bridgeBalance = await sourceToken.balanceOf(process.env.CHAIN1_BRIDGE_ADDRESS);
      console.log(`   Bridge Reserve: ${ethers.formatEther(bridgeBalance)} tokens`);

      if (bridgeBalance === 0n) {
        console.log(`   ⚠️  Bridge has no reserve tokens`);
        console.log(`   Note: Bridge needs tokens to unlock. May need to fund it.`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking bridge configuration: ${error.message}`);
      allGood = false;
    }
    console.log();
  }

  // ========================================================================
  // Final Summary
  // ========================================================================
  console.log("=".repeat(80));
  if (allGood) {
    console.log("✅ ALL SYSTEMS READY FOR TESTING!");
    console.log("=".repeat(80));
    console.log("\n🚀 You can now run the test scripts:");
    console.log("   - node scripts/relayer-tests/test-lock-event.js");
    console.log("   - node scripts/relayer-tests/test-burn-event.js");
    console.log("   - node scripts/relayer-tests/test-full-cycle.js");
    console.log("\n📖 See RELAYER-TESTING-QUICK-START.md for more info\n");
  } else {
    console.log("❌ SYSTEM NOT READY");
    console.log("=".repeat(80));
    console.log("\nPlease fix the issues above before running tests.\n");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
