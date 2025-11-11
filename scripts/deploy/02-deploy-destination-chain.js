import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYING TO CHAIN 2 (Destination Chain - BSC Simulation)");
  console.log("=".repeat(80) + "\n");

  // Connect to the local network (Chain 2)
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8546");
  const deployer = ethers.Wallet.fromPhrase(
    "test test test test test test test test test test test junk"
  ).connect(provider);
  console.log("Deploying with account:", deployer.address);

  const balance = await provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB\n");

  // Load contract artifacts
  const wrappedTokenArtifactPath = path.join(__dirname, "../../artifacts/contracts/tokens/WrappedToken.sol/WrappedToken.json");
  const wrappedTokenArtifact = JSON.parse(fs.readFileSync(wrappedTokenArtifactPath, "utf8"));

  const bridgeArtifactPath = path.join(__dirname, "../../artifacts/contracts/bridges/BridgeBSC.sol/BridgeBSC.json");
  const bridgeArtifact = JSON.parse(fs.readFileSync(bridgeArtifactPath, "utf8"));

  // Get the correct starting nonce (use pending to avoid stale nonce issues)
  const startingNonce = await provider.getTransactionCount(deployer.address, "pending");
  console.log("Starting nonce:", startingNonce);

  // Deploy WrappedToken
  console.log("\n1️⃣  Deploying WrappedToken...");
  const WrappedTokenFactory = new ethers.ContractFactory(wrappedTokenArtifact.abi, wrappedTokenArtifact.bytecode, deployer);

  const wrappedToken = await WrappedTokenFactory.deploy(
    "Wrapped Bridge Source Token",
    "wBST",
    { nonce: startingNonce }
  );
  await wrappedToken.waitForDeployment();
  const wrappedTokenAddress = await wrappedToken.getAddress();
  console.log("✅ WrappedToken deployed:", wrappedTokenAddress);

  const name = await wrappedToken.name();
  const symbol = await wrappedToken.symbol();
  const decimals = await wrappedToken.decimals();

  console.log("\n   Token Properties:");
  console.log("   - Name:", name);
  console.log("   - Symbol:", symbol);
  console.log("   - Decimals:", decimals);
  console.log("   - Bridge Set:", await wrappedToken.bridgeSet());

  // Deploy BridgeBSC
  console.log("\n2️⃣  Deploying BridgeBSC...");
  const minAmount = ethers.parseEther("0.1");
  const maxAmount = ethers.parseEther("10000");

  const BridgeBSCFactory = new ethers.ContractFactory(bridgeArtifact.abi, bridgeArtifact.bytecode, deployer);

  const bridgeBSC = await BridgeBSCFactory.deploy(
    wrappedTokenAddress,
    minAmount,
    maxAmount,
    { nonce: startingNonce + 1 }
  );
  await bridgeBSC.waitForDeployment();
  const bridgeBSCAddress = await bridgeBSC.getAddress();
  console.log("✅ BridgeBSC deployed:", bridgeBSCAddress);

  console.log("\n   Bridge Configuration:");
  console.log("   - Token:", wrappedTokenAddress);
  console.log("   - Min Amount:", ethers.formatEther(minAmount), "tokens");
  console.log("   - Max Amount:", ethers.formatEther(maxAmount), "tokens");
  console.log("   - Initial Nonce:", await bridgeBSC.nonce());

  // Configure: Set bridge in wrapped token
  console.log("\n3️⃣  Configuring WrappedToken...");
  const setBridgeTx = await wrappedToken.setBridge(bridgeBSCAddress, { nonce: startingNonce + 2 });
  await setBridgeTx.wait();
  console.log("✅ Bridge address set in WrappedToken");
  console.log("   Bridge Set:", await wrappedToken.bridgeSet());
  console.log("   Bridge Address:", await wrappedToken.bridge());

  // Save deployment info
  const deployment = {
    network: "chain2",
    chainId: (await provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      WrappedToken: {
        address: wrappedTokenAddress,
        name,
        symbol,
        decimals: decimals.toString()
      },
      BridgeBSC: {
        address: bridgeBSCAddress,
        token: wrappedTokenAddress,
        minAmount: minAmount.toString(),
        maxAmount: maxAmount.toString()
      }
    }
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, "chain2.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log("\n💾 Deployment info saved to:", deploymentPath);

  console.log("\n" + "=".repeat(80));
  console.log("✅ CHAIN 2 DEPLOYMENT COMPLETE");
  console.log("=".repeat(80) + "\n");

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
