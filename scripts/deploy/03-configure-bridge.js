import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("CONFIGURING BRIDGE SYSTEM");
  console.log("=".repeat(80) + "\n");

  // Load deployment files
  const chain1Path = path.join(__dirname, "../../deployments/chain1.json");
  const chain2Path = path.join(__dirname, "../../deployments/chain2.json");

  if (!fs.existsSync(chain1Path) || !fs.existsSync(chain2Path)) {
    throw new Error("Deployment files not found. Run deployment scripts first.");
  }

  const chain1 = JSON.parse(fs.readFileSync(chain1Path, "utf8"));
  const chain2 = JSON.parse(fs.readFileSync(chain2Path, "utf8"));

  console.log("📄 Loaded deployment information:");
  console.log("   Chain 1:", chain1Path);
  console.log("   Chain 2:", chain2Path);

  // Update .env file with contract addresses
  console.log("\n💾 Updating .env file with contract addresses...");

  const envPath = path.join(__dirname, "../../.env");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  } else {
    // Create from .env.example
    const examplePath = path.join(__dirname, "../../.env.example");
    if (fs.existsSync(examplePath)) {
      envContent = fs.readFileSync(examplePath, "utf8");
    }
  }

  // Update or add contract addresses
  const updateEnvVar = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    } else {
      return content + `\n${key}=${value}`;
    }
  };

  envContent = updateEnvVar(
    envContent,
    "CHAIN1_TOKEN_ADDRESS",
    chain1.contracts.SourceToken.address
  );
  envContent = updateEnvVar(
    envContent,
    "CHAIN1_BRIDGE_ADDRESS",
    chain1.contracts.BridgeEthereum.address
  );
  envContent = updateEnvVar(
    envContent,
    "CHAIN2_TOKEN_ADDRESS",
    chain2.contracts.WrappedToken.address
  );
  envContent = updateEnvVar(
    envContent,
    "CHAIN2_BRIDGE_ADDRESS",
    chain2.contracts.BridgeBSC.address
  );

  fs.writeFileSync(envPath, envContent);

  console.log("✅ Environment file updated");

  console.log("\n📊 Contract Addresses:");
  console.log("\n   Chain 1 (Ethereum):");
  console.log("   - SourceToken:    ", chain1.contracts.SourceToken.address);
  console.log("   - BridgeEthereum: ", chain1.contracts.BridgeEthereum.address);

  console.log("\n   Chain 2 (BSC):");
  console.log("   - WrappedToken:   ", chain2.contracts.WrappedToken.address);
  console.log("   - BridgeBSC:      ", chain2.contracts.BridgeBSC.address);

  // Transfer ownership to relayer
  console.log("\n🔐 Transferring ownership to relayer...");

  // Get relayer address from private key
  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    throw new Error("RELAYER_PRIVATE_KEY not found in .env");
  }

  const relayerWallet = new ethers.Wallet(relayerPrivateKey);
  const relayerAddress = relayerWallet.address;
  console.log("   Relayer Address:", relayerAddress);

  // Connect to chains
  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC || "http://127.0.0.1:8545");
  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC || "http://127.0.0.1:8546");

  // Get deployer wallet (current owner)
  const deployerWallet = ethers.Wallet.fromPhrase(
    "test test test test test test test test test test test junk"
  );
  const chain1Deployer = deployerWallet.connect(chain1Provider);
  const chain2Deployer = deployerWallet.connect(chain2Provider);

  // Load ABIs
  const bridgeEthereumABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../artifacts/contracts/bridges/BridgeEthereum.sol/BridgeEthereum.json"), "utf8")
  ).abi;
  const bridgeBSCABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../artifacts/contracts/bridges/BridgeBSC.sol/BridgeBSC.json"), "utf8")
  ).abi;

  // Transfer Chain 1 Bridge ownership
  console.log("\n   Transferring Chain 1 Bridge ownership...");
  const bridgeEthereum = new ethers.Contract(
    chain1.contracts.BridgeEthereum.address,
    bridgeEthereumABI,
    chain1Deployer
  );
  const tx1 = await bridgeEthereum.transferOwnership(relayerAddress);
  await tx1.wait();
  console.log("   ✅ Chain 1 Bridge ownership transferred");

  // Transfer Chain 2 Bridge ownership
  console.log("\n   Transferring Chain 2 Bridge ownership...");
  const bridgeBSC = new ethers.Contract(
    chain2.contracts.BridgeBSC.address,
    bridgeBSCABI,
    chain2Deployer
  );
  const tx2 = await bridgeBSC.transferOwnership(relayerAddress);
  await tx2.wait();
  console.log("   ✅ Chain 2 Bridge ownership transferred");

  // Verify ownership
  const chain1Owner = await bridgeEthereum.owner();
  const chain2Owner = await bridgeBSC.owner();
  console.log("\n   Verified ownership:");
  console.log("   - Chain 1 Bridge Owner:", chain1Owner);
  console.log("   - Chain 2 Bridge Owner:", chain2Owner);

  console.log("\n" + "=".repeat(80));
  console.log("✅ BRIDGE CONFIGURATION COMPLETE");
  console.log("=".repeat(80));

  console.log("\n🎯 Next Steps:");
  console.log("   1. Run tests:      pnpm run test");
  console.log("   2. Start relayer:  pnpm run relayer:start");
  console.log("   3. Monitor bridge: pnpm run monitor\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
