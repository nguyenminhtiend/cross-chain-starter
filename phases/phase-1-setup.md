# Phase 1: Project Setup & Environment

**Duration**: 15 minutes
**Difficulty**: Beginner
**Prerequisites**: Node.js 22+, pnpm 10+

## 📋 Phase Overview

Set up the complete project structure, install dependencies, and configure the development environment for building a cross-chain token bridge.

## 🎯 Learning Objectives

- Configure Hardhat 3.0 for multi-chain development
- Understand modern JavaScript tooling (pnpm, Node.js 22 LTS)
- Set up industry-standard project structure
- Configure environment variables for local development

## 📥 Inputs

- Empty project directory
- macOS environment with Node.js 22+ and pnpm 10+ installed

## 📤 Outputs

After completing this phase, you will have:

✅ Complete folder structure
✅ `package.json` with all dependencies installed
✅ `hardhat.config.js` configured for 2 local chains
✅ `.env` file with development settings
✅ `.gitignore` configured
✅ Working Hardhat installation (verifiable)

## 🚀 Step-by-Step Instructions

### Step 1: Verify Prerequisites

```bash
# Check Node.js version (should be 22.x or higher)
node --version

# Check pnpm version (should be 10.x or higher)
pnpm --version

# If pnpm not installed:
npm install -g pnpm@latest
```

### Step 2: Create Project Directory

```bash
# Create and navigate to project directory
mkdir cross-chain-starter
cd cross-chain-starter

# Initialize Git repository
git init

# Initialize pnpm project
pnpm init
```

### Step 3: Install Core Dependencies

```bash
# Install Hardhat 3.x and tooling (2025 latest versions)
pnpm add -D hardhat@^3.0.0
pnpm add -D @nomicfoundation/hardhat-toolbox@^6.0.0
pnpm add -D @nomicfoundation/hardhat-chai-matchers@^2.0.0
pnpm add -D @nomicfoundation/hardhat-network-helpers@^1.0.0

# Install OpenZeppelin contracts (latest 5.x)
pnpm add -D @openzeppelin/contracts@^5.4.0

# Install ethers.js v6 (latest)
pnpm add ethers@^6.15.0

# Install utilities
pnpm add dotenv

# Install logging libraries
pnpm add winston pino@^9.5.0 pino-pretty@^11.3.0

# Install development tools
pnpm add -D prettier solhint eslint
```

**Expected Output**: Dependencies installed in `node_modules/`, `package.json` updated

### Step 4: Initialize Hardhat

```bash
pnpm exec hardhat init
```

**Interactive Prompts**:
- ✓ Select: "Create a JavaScript project"
- ✓ Accept all defaults

**Expected Output**:
```
✨ Project created ✨
```

### Step 5: Create Folder Structure

```bash
# Create contract directories
mkdir -p contracts/tokens
mkdir -p contracts/bridges
mkdir -p contracts/interfaces
mkdir -p contracts/libraries

# Create script directories
mkdir -p scripts/deploy
mkdir -p scripts/utils
mkdir -p scripts/management

# Create test directories
mkdir -p test/unit
mkdir -p test/integration
mkdir -p test/fixtures

# Create relayer directories
mkdir -p relayer/src/config
mkdir -p relayer/src/services
mkdir -p relayer/src/utils

# Create monitoring directories
mkdir -p monitoring/scripts
mkdir -p monitoring/dashboards

# Create other directories
mkdir -p docs
mkdir -p deployments
mkdir -p phases
```

**Expected Output**: All directories created successfully

### Step 6: Create Configuration Files

#### File: `hardhat.config.js`

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.30",  // Latest stable (May 2025) - prague EVM default
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      viaIR: true  // Use IR-based code generator (2025 standard)
    }
  },
  networks: {
    // Local network for Chain 1 (Ethereum simulation)
    chain1: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20
      },
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1
    },
    // Local network for Chain 2 (BSC simulation)
    chain2: {
      url: "http://127.0.0.1:8546",
      chainId: 31338,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20
      },
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true
  }
};
```

#### File: `package.json` (Update scripts section)

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "node:chain1": "hardhat node --port 8545 --hostname 127.0.0.1",
    "node:chain2": "hardhat node --port 8546 --hostname 127.0.0.1",
    "compile": "hardhat compile",
    "test": "hardhat test",
    "test:unit": "hardhat test test/unit/**/*.test.js",
    "test:integration": "hardhat test test/integration/**/*.test.js",
    "test:coverage": "hardhat coverage",
    "deploy:chain1": "hardhat run scripts/deploy/01-deploy-source-chain.js --network chain1",
    "deploy:chain2": "hardhat run scripts/deploy/02-deploy-destination-chain.js --network chain2",
    "deploy:all": "pnpm run deploy:chain1 && pnpm run deploy:chain2 && pnpm run configure",
    "configure": "hardhat run scripts/deploy/03-configure-bridge.js",
    "verify:deployment": "node scripts/management/verify-deployment.js",
    "relayer:dev": "cd relayer && pnpm run dev",
    "relayer:start": "cd relayer && pnpm start",
    "monitor": "node monitoring/scripts/balance-monitor.js",
    "health": "node monitoring/scripts/health-check.js",
    "lint": "solhint 'contracts/**/*.sol' && eslint '**/*.js'",
    "format": "prettier --write 'contracts/**/*.sol' 'scripts/**/*.js' 'test/**/*.js'",
    "clean": "hardhat clean && rm -rf cache artifacts deployments/*.json"
  },
  "keywords": ["blockchain", "bridge", "cross-chain", "defi"],
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  }
}
```

#### File: `.env.example`

```env
# Network RPC URLs
CHAIN1_RPC=http://127.0.0.1:8545
CHAIN2_RPC=http://127.0.0.1:8546

# Deployer Account (Hardhat default account #0)
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Relayer Account (Hardhat default account #1)
RELAYER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Contract Addresses (populated after deployment)
CHAIN1_TOKEN_ADDRESS=
CHAIN1_BRIDGE_ADDRESS=
CHAIN2_TOKEN_ADDRESS=
CHAIN2_BRIDGE_ADDRESS=

# Configuration
LOG_LEVEL=info
RELAYER_POLL_INTERVAL=2000
CONFIRMATION_BLOCKS=1
ENABLE_MONITORING=true
```

#### File: `.env`

```bash
# Copy .env.example to .env
cp .env.example .env
```

#### File: `.gitignore`

```
# Dependencies
node_modules/
.pnpm-store/
pnpm-lock.yaml

# Hardhat
cache/
artifacts/
typechain-types/

# Environment
.env
.env.local

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Build
dist/
build/

# Coverage
coverage/
coverage.json

# Deployment records (uncomment if you don't want to track)
# deployments/*.json
```

### Step 7: Remove Default Files

```bash
# Remove default Lock.sol contract
rm contracts/Lock.sol

# Remove default test file
rm test/Lock.js
```

## ✅ Testing Phase 1

Run these commands to verify everything is set up correctly:

```bash
# 1. Verify Hardhat installation
pnpm exec hardhat --version
# Expected: "Hardhat version 3.x.x"

# 2. Try running Hardhat
pnpm exec hardhat
# Expected: Display Hardhat help menu

# 3. Verify folder structure
ls -la
# Expected: See all created directories

# 4. Check dependencies
pnpm list --depth=0
# Expected: See all installed packages

# 5. Test compilation (should succeed with no contracts)
pnpm run compile
# Expected: "Nothing to compile"
```

**All commands should succeed without errors.**

## 📊 Project Structure

After Phase 1, your directory should look like this:

```
cross-chain-starter/
├── .env                          ✅ Created
├── .env.example                  ✅ Created
├── .gitignore                    ✅ Created
├── hardhat.config.js             ✅ Created
├── package.json                  ✅ Created & updated
├── contracts/                    ✅ Created
│   ├── bridges/
│   ├── interfaces/
│   ├── libraries/
│   └── tokens/
├── scripts/                      ✅ Created
│   ├── deploy/
│   ├── management/
│   └── utils/
├── test/                         ✅ Created
│   ├── fixtures/
│   ├── integration/
│   └── unit/
├── relayer/                      ✅ Created
│   └── src/
│       ├── config/
│       ├── services/
│       └── utils/
├── monitoring/                   ✅ Created
│   ├── dashboards/
│   └── scripts/
├── deployments/                  ✅ Created
├── docs/                         ✅ Created
├── phases/                       ✅ Created
└── node_modules/                 ✅ Created by pnpm
```

## 🎯 Success Criteria

Before moving to Phase 2, confirm:

- [ ] Hardhat version 3.x installed and working
- [ ] All dependencies installed (check `pnpm list`)
- [ ] Folder structure created (15+ directories)
- [ ] Configuration files created (hardhat.config.js, .env, .gitignore)
- [ ] Scripts added to package.json
- [ ] `pnpm exec hardhat` shows help menu
- [ ] Git repository initialized

## 🐛 Troubleshooting

### Issue: "pnpm: command not found"
**Solution**:
```bash
npm install -g pnpm@latest
```

### Issue: "Node version too old"
**Solution**:
```bash
# Install Node.js 22 via Homebrew
brew install node@22
brew link --force node@22
```

### Issue: "Permission denied" during pnpm install
**Solution**:
```bash
# Use sudo (macOS)
sudo pnpm install -g pnpm
```

### Issue: Hardhat init fails
**Solution**:
```bash
# Clear cache and retry
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
pnpm exec hardhat init
```

## 📚 Key Concepts Learned

1. **Hardhat 3.0**: Rust-based rewrite with major performance improvements
2. **pnpm**: Fast, efficient package manager (saves disk space)
3. **Multi-chain config**: Two separate networks (chain1, chain2) for bridge testing
4. **Environment variables**: Separation of config from code
5. **Project structure**: Industry-standard organization for scalability

## 🔗 Next Phase

Once all success criteria are met, proceed to:

👉 **[Phase 2: Smart Contracts Development](./phase-2-contracts.md)**

In Phase 2, you'll create 4 production-grade smart contracts for the bridge system.

---

**Phase 1 Complete!** ✅
You now have a fully configured development environment ready for smart contract development.
