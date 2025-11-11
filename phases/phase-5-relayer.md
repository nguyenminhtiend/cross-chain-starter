# Phase 5: Relayer Service

**Duration**: 45 minutes
**Difficulty**: Advanced
**Prerequisites**: Phase 4 completed (passing tests)

## 📋 Phase Overview

Build an off-chain relayer service that listens for bridge events on both chains and automatically processes cross-chain transfers by minting/unlocking tokens.

## 🎯 Learning Objectives

- Build event-driven Node.js services
- Listen to blockchain events with ethers.js v6
- Implement transaction execution with retry logic
- Manage application state
- Handle errors gracefully

## 📥 Inputs

From Phase 4:
- Deployed and tested contracts
- Contract addresses in `.env`
- Working blockchain nodes

## 📤 Outputs

✅ Relayer service in `relayer/` directory
✅ Event listeners for Lock and Burn events
✅ Transaction executor with retry logic
✅ State manager for tracking processed transactions
✅ Live relayer processing cross-chain transfers

## 🏗️ Relayer Architecture

```
┌─────────────────────────────────────────────┐
│         RELAYER SERVICE                     │
├─────────────────────────────────────────────┤
│                                             │
│  EventListener (Chain 1)                    │
│  ├── Listen for "Lock" events               │
│  └── Trigger: mint() on Chain 2             │
│                                             │
│  EventListener (Chain 2)                    │
│  ├── Listen for "Burn" events               │
│  └── Trigger: unlock() on Chain 1           │
│                                             │
│  TransactionExecutor                        │
│  ├── Execute transactions                   │
│  ├── Retry on failure                       │
│  └── Create signatures                      │
│                                             │
│  StateManager                               │
│  ├── Track processed transactions           │
│  ├── Prevent duplicates                     │
│  └── Store failed transactions              │
│                                             │
└─────────────────────────────────────────────┘
```

## 🚀 Implementation

### Step 1: Relayer Package Setup

**File**: `relayer/package.json`

```json
{
  "name": "bridge-relayer",
  "version": "1.0.0",
  "description": "Off-chain relayer service for cross-chain bridge",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "ethers": "^6.15.0",
    "dotenv": "^16.4.0",
    "pino": "^9.5.0",
    "pino-pretty": "^11.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### Step 2: Install Relayer Dependencies

```bash
cd relayer
pnpm install
cd ..
```

### Step 3: Configuration Files

**File**: `relayer/src/config/chains.config.js`

```javascript
require("dotenv").config({ path: "../../.env" });

module.exports = {
  chain1: {
    name: "Ethereum (Local)",
    rpcUrl: process.env.CHAIN1_RPC || "http://127.0.0.1:8545",
    chainId: 31337,
    confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS) || 1,
    pollingInterval: parseInt(process.env.RELAYER_POLL_INTERVAL) || 2000
  },
  chain2: {
    name: "BSC (Local)",
    rpcUrl: process.env.CHAIN2_RPC || "http://127.0.0.1:8546",
    chainId: 31338,
    confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS) || 1,
    pollingInterval: parseInt(process.env.RELAYER_POLL_INTERVAL) || 2000
  },
  relayer: {
    privateKey: process.env.RELAYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  }
};
```

**File**: `relayer/src/config/contracts.config.js`

```javascript
require("dotenv").config({ path: "../../.env" });

const BRIDGE_ABI = [
  "event Lock(address indexed from, address indexed to, uint256 amount, uint256 timestamp, uint256 indexed nonce, bytes32 targetChain)",
  "event Unlock(address indexed to, uint256 amount, uint256 timestamp, uint256 indexed sourceNonce)",
  "event Mint(address indexed to, uint256 amount, uint256 timestamp, uint256 indexed sourceNonce)",
  "event Burn(address indexed from, address indexed to, uint256 amount, uint256 timestamp, uint256 indexed nonce, bytes32 targetChain)",
  "function unlock(address to, uint256 amount, uint256 sourceNonce, bytes memory signature) external",
  "function mint(address to, uint256 amount, uint256 sourceNonce, bytes memory signature) external",
  "function processedNonces(uint256) view returns (bool)",
  "function nonce() view returns (uint256)",
  "function paused() view returns (bool)"
];

module.exports = {
  chain1: {
    bridgeAddress: process.env.CHAIN1_BRIDGE_ADDRESS,
    tokenAddress: process.env.CHAIN1_TOKEN_ADDRESS,
    bridgeABI: BRIDGE_ABI
  },
  chain2: {
    bridgeAddress: process.env.CHAIN2_BRIDGE_ADDRESS,
    tokenAddress: process.env.CHAIN2_TOKEN_ADDRESS,
    bridgeABI: BRIDGE_ABI
  }
};
```

### Step 4: Utility Files

**File**: `relayer/src/utils/logger.js`

```javascript
const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname"
    }
  }
});

module.exports = logger;
```

**File**: `relayer/src/utils/retry.js`

```javascript
const logger = require("./logger");

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        { error: error.message }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = { retryWithBackoff };
```

### Step 5: Service Classes

(See original plan.md lines 1610-1828 for full EventListener, TransactionExecutor, and StateManager code)

### Step 6: Main Relayer Index

**File**: `relayer/src/index.js` - See original plan.md lines 1835-2161 for complete implementation.

The relayer:
1. Connects to both chains
2. Listens for Lock events on Chain 1 → mints on Chain 2
3. Listens for Burn events on Chain 2 → unlocks on Chain 1
4. Manages state to prevent replay attacks
5. Includes retry logic and error handling

## ✅ Testing Phase 5

### Start the Relayer

```bash
# Make sure Chain 1 and Chain 2 nodes are still running from Phase 3

# Terminal 3 - Start relayer
pnpm run relayer:start
```

**Expected Output**:
```
[INFO] Connected to Chain 1: Ethereum (Local)
[INFO] Connected to Chain 2: BSC (Local)
[INFO] Started listening to Lock events
[INFO] Started listening to Burn events
[INFO] Relayer is running and listening for events...
```

### Test Manual Bridge Transfer

Create **File**: `scripts/test-bridge.js`

```javascript
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("\n🧪 Testing Bridge Transfer\n");

  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
  const [user] = await ethers.getSigners();
  const wallet1 = user.connect(chain1Provider);

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

  const amount = ethers.parseEther("100");
  const targetChain = ethers.id("CHAIN2");

  console.log("1. Approving bridge...");
  await sourceToken.approve(process.env.CHAIN1_BRIDGE_ADDRESS, amount);

  console.log("2. Locking tokens...");
  const tx = await bridgeEth.lock(wallet1.address, amount, targetChain);
  console.log(`   TX: ${tx.hash}`);
  await tx.wait();

  console.log("3. Waiting for relayer to process...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
  const wrappedToken = await ethers.getContractAt(
    "WrappedToken",
    process.env.CHAIN2_TOKEN_ADDRESS,
    chain2Provider
  );

  const balance = await wrappedToken.balanceOf(wallet1.address);
  console.log(`\n✅ Success! Balance on Chain 2: ${ethers.formatEther(balance)} wBST\n`);
}

main().catch(console.error);
```

Run test:
```bash
node scripts/test-bridge.js
```

## 🎯 Success Criteria

- [ ] Relayer service starts without errors
- [ ] Connects to both blockchains
- [ ] Listens for Lock and Burn events
- [ ] Automatically processes cross-chain transfers
- [ ] Test transfer completes successfully
- [ ] Logs show event processing

## 🔗 Next Phase

👉 **[Phase 6: Monitoring & Production](./phase-6-monitoring.md)**

**Phase 5 Complete!** ✅
