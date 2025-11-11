# Phase 3: Deployment System

**Duration**: 20 minutes
**Difficulty**: Intermediate
**Prerequisites**: Phase 2 completed (compiled contracts)

## 📋 Phase Overview

Create deployment scripts to deploy the bridge system to two local Hardhat networks simulating Ethereum (Chain 1) and BSC (Chain 2). Set up configuration management for contract addresses.

## 🎯 Learning Objectives

- Write deployment scripts using ethers.js v6
- Deploy contracts to multiple networks
- Manage deployment state and configuration
- Link contracts together (set bridge addresses)
- Verify deployments programmatically

## 📥 Inputs

From Phase 2:
- Compiled contracts in `artifacts/`
- 4 smart contracts ready to deploy
- Hardhat configured with 2 networks (chain1, chain2)

## 📤 Outputs

After completing this phase, you will have:

✅ 3 deployment scripts in `scripts/deploy/`
✅ 1 verification script in `scripts/management/`
✅ Deployed contracts on both chains
✅ Contract addresses saved in `deployments/`
✅ `.env` file updated with addresses
✅ Verifiable deployment state

## 🏗️ Deployment Flow

```
Step 1: Deploy to Chain 1
├── Deploy SourceToken
└── Deploy BridgeEthereum
    └── Save addresses to deployments/chain1.json

Step 2: Deploy to Chain 2
├── Deploy WrappedToken
├── Deploy BridgeBSC
└── Configure WrappedToken.setBridge()
    └── Save addresses to deployments/chain2.json

Step 3: Configure System
└── Update .env with all contract addresses
```

## 🚀 Step-by-Step Instructions

### Step 1: Create Chain 1 Deployment Script

**File**: `scripts/deploy/01-deploy-source-chain.js`

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYING TO CHAIN 1 (Source Chain - Ethereum Simulation)");
  console.log("=".repeat(80) + "\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy SourceToken
  console.log("1️⃣  Deploying SourceToken...");
  const SourceToken = await hre.ethers.getContractFactory("SourceToken");
  const initialSupply = 1_000_000; // 1 million tokens
  const sourceToken = await SourceToken.deploy(initialSupply);
  await sourceToken.waitForDeployment();
  const sourceTokenAddress = await sourceToken.getAddress();
  console.log("✅ SourceToken deployed:", sourceTokenAddress);

  // Verify token properties
  const name = await sourceToken.name();
  const symbol = await sourceToken.symbol();
  const decimals = await sourceToken.decimals();
  const totalSupply = await sourceToken.totalSupply();

  console.log("\n   Token Properties:");
  console.log("   - Name:", name);
  console.log("   - Symbol:", symbol);
  console.log("   - Decimals:", decimals);
  console.log("   - Total Supply:", hre.ethers.formatUnits(totalSupply, decimals));

  // Deploy BridgeEthereum
  console.log("\n2️⃣  Deploying BridgeEthereum...");
  const minAmount = hre.ethers.parseEther("0.1"); // 0.1 tokens minimum
  const maxAmount = hre.ethers.parseEther("10000"); // 10,000 tokens maximum

  const BridgeEthereum = await hre.ethers.getContractFactory("BridgeEthereum");
  const bridgeEthereum = await BridgeEthereum.deploy(
    sourceTokenAddress,
    minAmount,
    maxAmount
  );
  await bridgeEthereum.waitForDeployment();
  const bridgeEthereumAddress = await bridgeEthereum.getAddress();
  console.log("✅ BridgeEthereum deployed:", bridgeEthereumAddress);

  console.log("\n   Bridge Configuration:");
  console.log("   - Token:", sourceTokenAddress);
  console.log("   - Min Amount:", hre.ethers.formatEther(minAmount), "tokens");
  console.log("   - Max Amount:", hre.ethers.formatEther(maxAmount), "tokens");
  console.log("   - Initial Nonce:", await bridgeEthereum.nonce());

  // Save deployment info
  const deployment = {
    network: "chain1",
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      SourceToken: {
        address: sourceTokenAddress,
        name,
        symbol,
        decimals: decimals.toString(),
        initialSupply: initialSupply.toString()
      },
      BridgeEthereum: {
        address: bridgeEthereumAddress,
        token: sourceTokenAddress,
        minAmount: minAmount.toString(),
        maxAmount: maxAmount.toString()
      }
    }
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, "chain1.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log("\n💾 Deployment info saved to:", deploymentPath);

  console.log("\n" + "=".repeat(80));
  console.log("✅ CHAIN 1 DEPLOYMENT COMPLETE");
  console.log("=".repeat(80) + "\n");

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Step 2: Create Chain 2 Deployment Script

**File**: `scripts/deploy/02-deploy-destination-chain.js`

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYING TO CHAIN 2 (Destination Chain - BSC Simulation)");
  console.log("=".repeat(80) + "\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "BNB\n");

  // Deploy WrappedToken
  console.log("1️⃣  Deploying WrappedToken...");
  const WrappedToken = await hre.ethers.getContractFactory("WrappedToken");
  const wrappedToken = await WrappedToken.deploy(
    "Wrapped Bridge Source Token",
    "wBST"
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
  const minAmount = hre.ethers.parseEther("0.1");
  const maxAmount = hre.ethers.parseEther("10000");

  const BridgeBSC = await hre.ethers.getContractFactory("BridgeBSC");
  const bridgeBSC = await BridgeBSC.deploy(
    wrappedTokenAddress,
    minAmount,
    maxAmount
  );
  await bridgeBSC.waitForDeployment();
  const bridgeBSCAddress = await bridgeBSC.getAddress();
  console.log("✅ BridgeBSC deployed:", bridgeBSCAddress);

  console.log("\n   Bridge Configuration:");
  console.log("   - Token:", wrappedTokenAddress);
  console.log("   - Min Amount:", hre.ethers.formatEther(minAmount), "tokens");
  console.log("   - Max Amount:", hre.ethers.formatEther(maxAmount), "tokens");
  console.log("   - Initial Nonce:", await bridgeBSC.nonce());

  // Configure: Set bridge in wrapped token
  console.log("\n3️⃣  Configuring WrappedToken...");
  const setBridgeTx = await wrappedToken.setBridge(bridgeBSCAddress);
  await setBridgeTx.wait();
  console.log("✅ Bridge address set in WrappedToken");
  console.log("   Bridge Set:", await wrappedToken.bridgeSet());
  console.log("   Bridge Address:", await wrappedToken.bridge());

  // Save deployment info
  const deployment = {
    network: "chain2",
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
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
```

### Step 3: Create Configuration Script

**File**: `scripts/deploy/03-configure-bridge.js`

```javascript
const fs = require("fs");
const path = require("path");
require("dotenv").config();

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
```

### Step 4: Create Verification Script

**File**: `scripts/management/verify-deployment.js`

```javascript
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("VERIFYING DEPLOYMENT");
  console.log("=".repeat(80) + "\n");

  // Load deployment files
  const chain1Path = path.join(__dirname, "../../deployments/chain1.json");
  const chain2Path = path.join(__dirname, "../../deployments/chain2.json");

  if (!fs.existsSync(chain1Path)) {
    console.log("❌ Chain 1 deployment file not found");
    process.exit(1);
  }

  if (!fs.existsSync(chain2Path)) {
    console.log("❌ Chain 2 deployment file not found");
    process.exit(1);
  }

  const chain1 = JSON.parse(fs.readFileSync(chain1Path, "utf8"));
  const chain2 = JSON.parse(fs.readFileSync(chain2Path, "utf8"));

  console.log("✅ Deployment files found");
  console.log("\n📊 Chain 1 (Ethereum):");
  console.log("   Network:", chain1.network);
  console.log("   Chain ID:", chain1.chainId);
  console.log("   Deployer:", chain1.deployer);
  console.log("   Timestamp:", chain1.timestamp);
  console.log("\n   Contracts:");
  console.log("   - SourceToken:    ", chain1.contracts.SourceToken.address);
  console.log("   - BridgeEthereum: ", chain1.contracts.BridgeEthereum.address);

  console.log("\n📊 Chain 2 (BSC):");
  console.log("   Network:", chain2.network);
  console.log("   Chain ID:", chain2.chainId);
  console.log("   Deployer:", chain2.deployer);
  console.log("   Timestamp:", chain2.timestamp);
  console.log("\n   Contracts:");
  console.log("   - WrappedToken:   ", chain2.contracts.WrappedToken.address);
  console.log("   - BridgeBSC:      ", chain2.contracts.BridgeBSC.address);

  console.log("\n" + "=".repeat(80));
  console.log("✅ VERIFICATION COMPLETE");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Step 5: Start Local Blockchains

Open **2 terminal windows**:

**Terminal 1 - Chain 1:**
```bash
cd cross-chain-starter
pnpm run node:chain1
```

**Terminal 2 - Chain 2:**
```bash
cd cross-chain-starter
pnpm run node:chain2
```

**Keep both terminals running!**

### Step 6: Deploy Contracts

Open **Terminal 3:**

```bash
# Deploy to both chains
pnpm run deploy:all

# This runs:
# 1. pnpm run deploy:chain1
# 2. pnpm run deploy:chain2
# 3. pnpm run configure
```

**Expected Output**: Success messages from all 3 scripts, contract addresses displayed.

### Step 7: Verify Deployment

```bash
pnpm run verify:deployment
```

## ✅ Testing Phase 3

Run these verification steps:

```bash
# 1. Check deployment files created
ls deployments/
# Expected: chain1.json  chain2.json

# 2. Verify contract addresses in files
cat deployments/chain1.json
cat deployments/chain2.json

# 3. Check .env updated
cat .env | grep ADDRESS
# Expected: See all 4 contract addresses

# 4. Run verification
pnpm run verify:deployment
# Expected: Show all contract info

# 5. Test that blockchains are running
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
# Expected: JSON response with block number
```

## 📊 Deployment Summary

After successful deployment:

| Chain | Contract | Purpose | Address Location |
|-------|----------|---------|------------------|
| Chain 1 | SourceToken | ERC-20 source token | `deployments/chain1.json` |
| Chain 1 | BridgeEthereum | Lock/Unlock bridge | `deployments/chain1.json` |
| Chain 2 | WrappedToken | Wrapped ERC-20 | `deployments/chain2.json` |
| Chain 2 | BridgeBSC | Mint/Burn bridge | `deployments/chain2.json` |

## 🎯 Success Criteria

Before moving to Phase 4, confirm:

- [ ] Both local blockchain nodes running
- [ ] All 4 contracts deployed successfully
- [ ] Deployment files created in `deployments/`
- [ ] `.env` file updated with addresses
- [ ] WrappedToken bridge address set correctly
- [ ] Verification script runs without errors
- [ ] Contract addresses are non-zero

## 🐛 Troubleshooting

### Issue: "Cannot connect to chain"
**Solution**:
```bash
# Make sure both nodes are running
pnpm run node:chain1  # Terminal 1
pnpm run node:chain2  # Terminal 2
```

### Issue: "Insufficient funds"
**Solution**: Local Hardhat nodes come with funded accounts, this shouldn't happen. Restart nodes if it does.

### Issue: "Contract already deployed"
**Solution**:
```bash
# Restart blockchain nodes (data is ephemeral)
# Stop (Ctrl+C) and restart both chain1 and chain2
```

### Issue: ".env not updated"
**Solution**:
```bash
# Manually run configure script
pnpm run configure
```

## 📚 Key Concepts Learned

1. **Multi-chain deployment**: Deploying to multiple networks sequentially
2. **State management**: Saving deployment addresses to files
3. **Contract linking**: Setting bridge address in WrappedToken
4. **Environment configuration**: Automated .env updates
5. **Deployment verification**: Programmatic checking of deployments

## 🔗 Next Phase

Once all success criteria are met, proceed to:

👉 **[Phase 4: Testing Suite](./phase-4-testing.md)**

In Phase 4, you'll create comprehensive tests to verify the bridge works correctly.

---

**Phase 3 Complete!** ✅
You now have a fully deployed cross-chain bridge system running on two local networks.
