import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (override existing env vars)
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

async function healthCheck() {
  console.log("\n" + "=".repeat(80));
  console.log("BRIDGE HEALTH CHECK");
  console.log("=".repeat(80) + "\n");

  const checks = [];

  // Check 1: Environment variables
  console.log("1️⃣  Checking environment variables...");
  const requiredEnvVars = [
    "CHAIN1_RPC",
    "CHAIN2_RPC",
    "CHAIN1_TOKEN_ADDRESS",
    "CHAIN1_BRIDGE_ADDRESS",
    "CHAIN2_TOKEN_ADDRESS",
    "CHAIN2_BRIDGE_ADDRESS"
  ];

  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    console.log(`   ❌ Missing: ${missingVars.join(", ")}`);
    checks.push(false);
  } else {
    console.log(`   ✅ All environment variables present`);
    checks.push(true);
  }

  // Check 2: Chain 1 connectivity
  console.log("\n2️⃣  Checking Chain 1 connectivity...");
  try {
    const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
    const blockNumber = await chain1Provider.getBlockNumber();
    console.log(`   ✅ Connected (block: ${blockNumber})`);
    checks.push(true);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Check 3: Chain 2 connectivity
  console.log("\n3️⃣  Checking Chain 2 connectivity...");
  try {
    const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
    const blockNumber = await chain2Provider.getBlockNumber();
    console.log(`   ✅ Connected (block: ${blockNumber})`);
    checks.push(true);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Check 4: Contract deployments
  console.log("\n4️⃣  Checking contract deployments...");
  try {
    const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
    const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);

    const code1 = await chain1Provider.getCode(process.env.CHAIN1_BRIDGE_ADDRESS);
    const code2 = await chain2Provider.getCode(process.env.CHAIN2_BRIDGE_ADDRESS);

    if (code1 === "0x" || code2 === "0x") {
      console.log(`   ❌ Contracts not deployed`);
      checks.push(false);
    } else {
      console.log(`   ✅ All contracts deployed`);
      checks.push(true);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Check 5: Bridge configuration
  console.log("\n5️⃣  Checking bridge configuration...");
  try {
    const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);

    const wrappedTokenArtifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../../artifacts/contracts/tokens/WrappedToken.sol/WrappedToken.json'),
      'utf8'
    ));

    const wrappedToken = new ethers.Contract(
      process.env.CHAIN2_TOKEN_ADDRESS,
      wrappedTokenArtifact.abi,
      chain2Provider
    );

    const bridgeSet = await wrappedToken.bridgeSet();
    const bridgeAddress = await wrappedToken.bridge();

    if (!bridgeSet || bridgeAddress !== process.env.CHAIN2_BRIDGE_ADDRESS) {
      console.log(`   ❌ Bridge not properly configured`);
      checks.push(false);
    } else {
      console.log(`   ✅ Bridge properly configured`);
      checks.push(true);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Summary
  const passed = checks.filter((c) => c).length;
  const total = checks.length;

  console.log("\n" + "=".repeat(80));
  console.log(`RESULTS: ${passed}/${total} checks passed`);
  console.log("=".repeat(80));

  if (passed === total) {
    console.log("\n✅ All health checks passed! System is operational.\n");
    process.exit(0);
  } else {
    console.log("\n❌ Some health checks failed. Review errors above.\n");
    process.exit(1);
  }
}

healthCheck().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
