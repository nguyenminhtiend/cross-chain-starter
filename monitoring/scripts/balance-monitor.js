import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (override existing env vars)
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

async function monitor() {
  console.log("\n" + "=".repeat(80));
  console.log("BRIDGE BALANCE MONITOR");
  console.log("=".repeat(80) + "\n");

  // Connect to both chains
  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);

  // Create wallet for reading
  const deployer = ethers.Wallet.fromPhrase(
    'test test test test test test test test test test test junk'
  ).connect(chain1Provider);

  // Load contract artifacts
  const sourceTokenArtifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../../artifacts/contracts/tokens/SourceToken.sol/SourceToken.json'),
    'utf8'
  ));

  const bridgeEthArtifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../../artifacts/contracts/bridges/BridgeEthereum.sol/BridgeEthereum.json'),
    'utf8'
  ));

  const wrappedTokenArtifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../../artifacts/contracts/tokens/WrappedToken.sol/WrappedToken.json'),
    'utf8'
  ));

  const bridgeBSCArtifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../../artifacts/contracts/bridges/BridgeBSC.sol/BridgeBSC.json'),
    'utf8'
  ));

  // Create contract instances
  const sourceToken = new ethers.Contract(
    process.env.CHAIN1_TOKEN_ADDRESS,
    sourceTokenArtifact.abi,
    chain1Provider
  );

  const bridgeEth = new ethers.Contract(
    process.env.CHAIN1_BRIDGE_ADDRESS,
    bridgeEthArtifact.abi,
    chain1Provider
  );

  const wrappedToken = new ethers.Contract(
    process.env.CHAIN2_TOKEN_ADDRESS,
    wrappedTokenArtifact.abi,
    chain2Provider
  );

  const bridgeBSC = new ethers.Contract(
    process.env.CHAIN2_BRIDGE_ADDRESS,
    bridgeBSCArtifact.abi,
    chain2Provider
  );

  // Chain 1 Data
  console.log("📍 CHAIN 1 (Ethereum)");
  console.log("-".repeat(80));

  const totalSupply = await sourceToken.totalSupply();
  const lockedInBridge = await bridgeEth.getLockedBalance();
  const circulating = totalSupply - lockedInBridge;
  const userBalance1 = await sourceToken.balanceOf(deployer.address);
  const nonce1 = await bridgeEth.nonce();
  const paused1 = await bridgeEth.paused();

  console.log(`Total Supply:           ${ethers.formatEther(totalSupply)} BST`);
  console.log(`Locked in Bridge:       ${ethers.formatEther(lockedInBridge)} BST`);
  console.log(`Circulating:            ${ethers.formatEther(circulating)} BST`);
  console.log(`Your Balance:           ${ethers.formatEther(userBalance1)} BST`);
  console.log(`Bridge Nonce:           ${nonce1}`);
  console.log(`Bridge Paused:          ${paused1}`);

  // Chain 2 Data
  console.log("\n📍 CHAIN 2 (BSC)");
  console.log("-".repeat(80));

  const wrappedSupply = await wrappedToken.totalSupply();
  const deployer2 = deployer.connect(chain2Provider);
  const userBalance2 = await wrappedToken.balanceOf(deployer2.address);
  const nonce2 = await bridgeBSC.nonce();
  const paused2 = await bridgeBSC.paused();

  console.log(`Total Wrapped Supply:   ${ethers.formatEther(wrappedSupply)} wBST`);
  console.log(`Your Balance:           ${ethers.formatEther(userBalance2)} wBST`);
  console.log(`Bridge Nonce:           ${nonce2}`);
  console.log(`Bridge Paused:          ${paused2}`);

  // Supply Conservation Check
  console.log("\n📊 SUPPLY CONSERVATION CHECK");
  console.log("-".repeat(80));

  const difference = wrappedSupply - lockedInBridge;
  const percentDiff =
    lockedInBridge > 0n
      ? Number((difference * 10000n) / lockedInBridge) / 100
      : 0;

  console.log(`Expected Wrapped:       ${ethers.formatEther(lockedInBridge)} wBST`);
  console.log(`Actual Wrapped:         ${ethers.formatEther(wrappedSupply)} wBST`);
  console.log(`Difference:             ${ethers.formatEther(difference)} wBST`);

  if (difference === 0n) {
    console.log(`\n✅ PERFECT! Supply is conserved.`);
    console.log(`   Locked on Chain 1 = Wrapped on Chain 2`);
  } else {
    console.log(`\n⚠️  MISMATCH DETECTED! (${percentDiff}%)`);
    if (Math.abs(percentDiff) < 0.01) {
      console.log(`   Likely due to rounding or pending transactions`);
    } else {
      console.log(`   This may indicate a problem - investigate immediately!`);
    }
  }

  // Bridge Health
  console.log("\n💚 BRIDGE HEALTH");
  console.log("-".repeat(80));

  console.log(`Supply Conserved:       ${difference === 0n ? "✅" : "❌"}`);
  console.log(`Chain 1 Operating:      ${!paused1 ? "✅" : "⚠️ "}`);
  console.log(`Chain 2 Operating:      ${!paused2 ? "✅" : "⚠️ "}`);

  console.log(
    `\nOverall Status:         ${
      difference === 0n && !paused1 && !paused2 ? "🟢 HEALTHY" : "🟡 CHECK ISSUES"
    }`
  );

  console.log("\n" + "=".repeat(80) + "\n");
}

monitor()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
