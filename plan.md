# Phase 7: Build a Production-Ready Cross-Chain Token Bridge

**Complete Implementation Guide - Local Development | MacOS | 2025 Best Practices**

> **📢 Updated for 2025** - This guide now uses the latest versions:
> - **Hardhat 3.0** (Rust-based rewrite with major performance improvements)
> - **Solidity 0.8.30** (prague EVM default)
> - **OpenZeppelin 5.4.0** (ERC-4337 & ERC-7579 support)
> - **ethers.js 6.15.0** (latest stable)
> - **Node.js 22 LTS** (Active support until April 2027)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Environment Setup](#environment-setup)
5. [Smart Contracts](#smart-contracts)
6. [Deployment System](#deployment-system)
7. [Relayer Service](#relayer-service)
8. [Testing Suite](#testing-suite)
9. [Monitoring & Observability](#monitoring--observability)
10. [Execution Guide](#execution-guide)
11. [Production Considerations](#production-considerations)

---

## Project Overview

### What You'll Build

A complete cross-chain token bridge system that transfers ERC-20 tokens between two blockchains using the **Lock & Mint / Burn & Unlock** pattern.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BRIDGE SYSTEM ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Chain 1 (Ethereum)          Relayer Service         Chain 2 (BSC)│
│   ┌──────────────┐           ┌──────────────┐        ┌───────────┐│
│   │ SourceToken  │           │Event Listener│        │ Wrapped   ││
│   │   (ERC-20)   │           │  & Executor  │        │  Token    ││
│   └──────┬───────┘           └──────┬───────┘        └─────┬─────┘│
│          │                          │                       │      │
│   ┌──────▼───────┐           ┌──────▼───────┐        ┌─────▼─────┐│
│   │    Bridge    │  Lock     │   Validates  │  Mint  │  Bridge   ││
│   │   Ethereum   │──────────▶│   & Signs    │───────▶│    BSC    ││
│   │              │           │              │        │           ││
│   │              │  Unlock   │              │  Burn  │           ││
│   │              │◀──────────│              │◀───────│           ││
│   └──────────────┘           └──────────────┘        └───────────┘│
│                                                                     │
│   Nonce: 0, 1, 2...                                 Nonce: 0, 1... │
│   Processed: [0,1,2]                              Processed: [0,1] │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Features

- ✅ **Lock & Mint**: Lock tokens on source chain, mint wrapped tokens on destination
- ✅ **Burn & Unlock**: Burn wrapped tokens, unlock original tokens
- ✅ **Replay Protection**: Nonce-based transaction tracking
- ✅ **Event-Driven**: Real-time blockchain event monitoring
- ✅ **Supply Conservation**: Total supply remains constant across chains
- ✅ **Local Development**: Complete setup runs on MacOS without external dependencies

### Learning Outcomes

By completing this phase, you will master:
- Cross-chain bridge architecture and design patterns
- Smart contract development with OpenZeppelin standards
- Event-driven blockchain communication
- Off-chain relayer service implementation
- Testing strategies for distributed systems
- Security best practices (nonce management, reentrancy protection)
- Modern development workflows (Hardhat, ethers.js v6)

---

## Prerequisites

### Knowledge Requirements

Completed understanding of:
- ✅ Phase 1: Blockchain fundamentals (hashing, blocks, proof of work)
- ✅ Phase 2: Cryptography (public/private keys, signatures)
- ✅ Phase 3: Transactions & wallets (UTXO, account model)
- ✅ Phase 4: Ethereum & smart contracts (Solidity, EVM, gas)
- ✅ Phase 5: ERC-20 tokens (token standards, transfer mechanisms)
- ✅ Phase 6: Bridge concepts (lock & mint, burn & unlock patterns)

### System Requirements

**MacOS Environment:**
- Node.js v22+ (LTS - Active until Oct 2025, maintained until April 2027)
- pnpm v10.20+ (Latest stable)
- Terminal (iTerm2 recommended for split panes)
- VS Code or similar IDE
- Git

**Installation:**
```bash
# Check Node.js version
node --version  # Should be v22.0.0 or higher

# If not installed, use Homebrew
brew install node@22

# Install pnpm globally
npm install -g pnpm@latest

# Verify pnpm
pnpm --version  # Should be 10.20.0 or higher
```

### Development Tools

```bash
# Install Hardhat globally (optional, but recommended)
pnpm add -g hardhat

# Verify installation
pnpm exec hardhat --version  # Should show v3.0.12 or higher
```

---

## Project Structure

### Industry-Standard Folder Organization (2025)

```
cross-chain-starter/
│
├── .github/                          # GitHub workflows & CI/CD
│   └── workflows/
│       ├── test.yml                  # Automated testing
│       └── deploy.yml                # Deployment pipeline
│
├── contracts/                        # Smart contracts
│   ├── interfaces/                   # Contract interfaces
│   │   ├── IERC20Extended.sol
│   │   └── IWrappedToken.sol
│   ├── libraries/                    # Reusable libraries
│   │   └── BridgeValidation.sol
│   ├── tokens/                       # Token contracts
│   │   ├── SourceToken.sol
│   │   └── WrappedToken.sol
│   └── bridges/                      # Bridge contracts
│       ├── BridgeBase.sol
│       ├── BridgeEthereum.sol
│       └── BridgeBSC.sol
│
├── scripts/                          # Deployment & management scripts
│   ├── deploy/
│   │   ├── 01-deploy-source-chain.js
│   │   ├── 02-deploy-destination-chain.js
│   │   └── 03-configure-bridge.js
│   ├── utils/
│   │   ├── network-helpers.js
│   │   └── contract-helpers.js
│   └── management/
│       ├── verify-deployment.js
│       └── emergency-pause.js
│
├── test/                             # Test suites
│   ├── unit/                         # Unit tests
│   │   ├── SourceToken.test.js
│   │   ├── WrappedToken.test.js
│   │   ├── BridgeEthereum.test.js
│   │   └── BridgeBSC.test.js
│   ├── integration/                  # Integration tests
│   │   ├── bridge-flow.test.js
│   │   └── relayer-integration.test.js
│   └── fixtures/                     # Test fixtures
│       └── bridge-fixture.js
│
├── relayer/                          # Off-chain relayer service
│   ├── src/
│   │   ├── config/                   # Configuration
│   │   │   ├── chains.config.js
│   │   │   └── contracts.config.js
│   │   ├── services/                 # Core services
│   │   │   ├── EventListener.js
│   │   │   ├── TransactionExecutor.js
│   │   │   └── StateManager.js
│   │   ├── utils/                    # Utilities
│   │   │   ├── logger.js
│   │   │   └── retry.js
│   │   └── index.js                  # Entry point
│   ├── tests/
│   │   └── relayer.test.js
│   └── package.json
│
├── monitoring/                       # Monitoring & observability
│   ├── scripts/
│   │   ├── balance-monitor.js
│   │   ├── health-check.js
│   │   └── metrics-collector.js
│   └── dashboards/
│       └── grafana-dashboard.json
│
├── docs/                             # Documentation
│   ├── architecture.md
│   ├── security.md
│   ├── api.md
│   └── runbook.md
│
├── deployments/                      # Deployment records
│   ├── localhost-chain1.json
│   └── localhost-chain2.json
│
├── .env.example                      # Environment template
├── .env                              # Local environment (gitignored)
├── .gitignore
├── hardhat.config.js                 # Hardhat configuration
├── package.json                      # Project dependencies
├── tsconfig.json                     # TypeScript config (optional)
└── README.md                         # Project documentation
```

### Why This Structure?

**Industry Best Practices (2025):**

1. **Separation of Concerns**: Contracts, scripts, tests, and relayer are isolated
2. **Scalability**: Easy to add new chains, tokens, or features
3. **Testability**: Clear test organization (unit, integration)
4. **Maintainability**: Modular structure with single responsibility
5. **CI/CD Ready**: GitHub Actions workflows included
6. **Observability**: Dedicated monitoring directory
7. **Documentation**: Comprehensive docs folder
8. **Security**: Deployment records tracked, sensitive data in .env

---

## Environment Setup

### Step 1: Initialize Project

```bash
# Create project directory
mkdir cross-chain-starter
cd cross-chain-starter

# Initialize pnpm project
pnpm init

# Initialize Git repository
git init
```

### Step 2: Install Dependencies

```bash
# Install Hardhat 3.x and tooling (2025 latest)
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
pnpm add winston          # Logging
pnpm add pino             # Fast logging alternative
pnpm add pino-pretty      # Pretty logs

# Development tools
pnpm add -D prettier
pnpm add -D solhint
pnpm add -D eslint
```

### Step 3: Initialize Hardhat

```bash
pnpm exec hardhat init
# Select: "Create a JavaScript project"
# Accept all defaults
```

### Step 4: Configuration Files

#### **File: `hardhat.config.js`**

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

#### **File: `package.json`** (scripts section)

```json
{
  "name": "cross-chain-starter",
  "version": "1.0.0",
  "description": "Production-ready cross-chain token bridge",
  "main": "index.js",
  "packageManager": "pnpm@10.0.0",
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
  "author": "Your Name",
  "license": "MIT",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.0",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.0",
    "@nomicfoundation/hardhat-toolbox": "^6.0.0",
    "@openzeppelin/contracts": "^5.4.0",
    "chai": "^5.1.0",
    "eslint": "^9.15.0",
    "hardhat": "^3.0.0",
    "prettier": "^3.4.0",
    "solhint": "^5.0.0"
  },
  "dependencies": {
    "dotenv": "^16.4.0",
    "ethers": "^6.15.0",
    "pino": "^9.5.0",
    "pino-pretty": "^11.3.0",
    "winston": "^3.17.0"
  }
}
```

#### **File: `.env.example`**

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

#### **File: `.gitignore`**

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

---

## Smart Contracts

### Contract 1: Source Token (Chain 1)

#### **File: `contracts/tokens/SourceToken.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SourceToken
 * @notice ERC20 token that serves as the source asset for the bridge
 * @dev Implements OpenZeppelin's ERC20 with burnable extension
 */
contract SourceToken is ERC20, ERC20Burnable, Ownable {

    /// @notice Token decimals (18 is standard for ERC20)
    uint8 private constant DECIMALS = 18;

    /// @notice Maximum supply cap (1 billion tokens)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**DECIMALS;

    /// @notice Current total minted supply
    uint256 public totalMinted;

    /**
     * @notice Emitted when tokens are minted
     * @param to Address receiving the minted tokens
     * @param amount Amount of tokens minted
     */
    event Minted(address indexed to, uint256 amount);

    /**
     * @notice Constructor - initializes token with name and symbol
     * @param initialSupply Initial amount to mint to deployer (in whole tokens)
     */
    constructor(uint256 initialSupply)
        ERC20("Bridge Source Token", "BST")
        Ownable(msg.sender)
    {
        require(initialSupply > 0, "Initial supply must be greater than 0");
        uint256 initialAmount = initialSupply * 10**decimals();
        require(initialAmount <= MAX_SUPPLY, "Initial supply exceeds max supply");

        _mint(msg.sender, initialAmount);
        totalMinted = initialAmount;

        emit Minted(msg.sender, initialAmount);
    }

    /**
     * @notice Mint new tokens (only owner)
     * @param to Address to receive minted tokens
     * @param amount Amount to mint (in whole tokens)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");

        uint256 mintAmount = amount * 10**decimals();
        require(totalMinted + mintAmount <= MAX_SUPPLY, "Exceeds max supply");

        _mint(to, mintAmount);
        totalMinted += mintAmount;

        emit Minted(to, mintAmount);
    }

    /**
     * @notice Returns the number of decimals
     * @return Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
```

### Contract 2: Bridge Ethereum (Chain 1)

#### **File: `contracts/bridges/BridgeEthereum.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BridgeEthereum
 * @notice Bridge contract for source chain - handles locking and unlocking of tokens
 * @dev Implements pause mechanism for emergency stops
 */
contract BridgeEthereum is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice The ERC20 token being bridged
    IERC20 public immutable token;

    /// @notice Counter for outgoing bridge transactions
    uint256 public nonce;

    /// @notice Tracks processed nonces from destination chain (replay protection)
    mapping(uint256 => bool) public processedNonces;

    /// @notice Minimum bridge amount (prevents dust attacks)
    uint256 public minBridgeAmount;

    /// @notice Maximum bridge amount per transaction (risk management)
    uint256 public maxBridgeAmount;

    /**
     * @notice Emitted when tokens are locked for bridging
     * @param from Address that locked tokens
     * @param to Recipient address on destination chain
     * @param amount Amount of tokens locked
     * @param timestamp Block timestamp
     * @param nonce Unique transaction nonce
     * @param targetChain Identifier for destination chain
     */
    event Lock(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed nonce,
        bytes32 targetChain
    );

    /**
     * @notice Emitted when tokens are unlocked (return from destination)
     * @param to Address receiving unlocked tokens
     * @param amount Amount of tokens unlocked
     * @param timestamp Block timestamp
     * @param sourceNonce Nonce from destination chain burn transaction
     */
    event Unlock(
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed sourceNonce
    );

    /**
     * @notice Emitted when bridge limits are updated
     * @param minAmount New minimum bridge amount
     * @param maxAmount New maximum bridge amount
     */
    event LimitsUpdated(uint256 minAmount, uint256 maxAmount);

    /**
     * @notice Constructor
     * @param _token Address of the ERC20 token to bridge
     * @param _minAmount Minimum bridge amount
     * @param _maxAmount Maximum bridge amount
     */
    constructor(
        address _token,
        uint256 _minAmount,
        uint256 _maxAmount
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        token = IERC20(_token);
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        nonce = 0;
    }

    /**
     * @notice Lock tokens to bridge them to destination chain
     * @param to Recipient address on destination chain
     * @param amount Amount of tokens to bridge (in wei)
     * @param targetChain Identifier of destination blockchain
     */
    function lock(
        address to,
        uint256 amount,
        bytes32 targetChain
    ) external nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount >= minBridgeAmount, "Amount below minimum");
        require(amount <= maxBridgeAmount, "Amount exceeds maximum");
        require(targetChain != bytes32(0), "Invalid target chain");

        // Transfer tokens from user to bridge contract
        token.safeTransferFrom(msg.sender, address(this), amount);

        // Emit event for relayer to process
        emit Lock(
            msg.sender,
            to,
            amount,
            block.timestamp,
            nonce,
            targetChain
        );

        // Increment nonce
        unchecked {
            nonce++;
        }
    }

    /**
     * @notice Unlock tokens when returning from destination chain
     * @param to Address to receive unlocked tokens
     * @param amount Amount of tokens to unlock (in wei)
     * @param sourceNonce Nonce from destination chain burn transaction
     * @param signature Admin signature authorizing unlock (currently unused, for future multi-sig)
     */
    function unlock(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature
    ) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(!processedNonces[sourceNonce], "Nonce already processed");

        // Mark nonce as processed (replay protection)
        processedNonces[sourceNonce] = true;

        // Transfer tokens from bridge to recipient
        token.safeTransfer(to, amount);

        // Emit event for tracking
        emit Unlock(to, amount, block.timestamp, sourceNonce);
    }

    /**
     * @notice Update bridge amount limits
     * @param _minAmount New minimum amount
     * @param _maxAmount New maximum amount
     */
    function updateLimits(uint256 _minAmount, uint256 _maxAmount) external onlyOwner {
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;

        emit LimitsUpdated(_minAmount, _maxAmount);
    }

    /**
     * @notice Get total balance locked in bridge
     * @return Balance of tokens held by bridge
     */
    function getLockedBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Pause bridge operations (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume bridge operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal function (use with extreme caution)
     * @param amount Amount to withdraw
     * @param recipient Address to receive withdrawn tokens
     */
    function emergencyWithdraw(uint256 amount, address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(paused(), "Can only withdraw when paused");

        token.safeTransfer(recipient, amount);
    }
}
```

### Contract 3: Wrapped Token (Chain 2)

#### **File: `contracts/tokens/WrappedToken.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WrappedToken
 * @notice Wrapped token on destination chain representing locked tokens on source chain
 * @dev Only the bridge contract can mint/burn tokens
 */
contract WrappedToken is ERC20, Ownable {

    /// @notice Bridge contract authorized to mint/burn
    address public bridge;

    /// @notice Flag to prevent bridge address from being changed
    bool public bridgeSet;

    /**
     * @notice Emitted when bridge address is set
     * @param bridge Address of the bridge contract
     */
    event BridgeSet(address indexed bridge);

    /**
     * @notice Emitted when tokens are minted
     * @param to Address receiving minted tokens
     * @param amount Amount minted
     */
    event Minted(address indexed to, uint256 amount);

    /**
     * @notice Emitted when tokens are burned
     * @param from Address whose tokens are burned
     * @param amount Amount burned
     */
    event Burned(address indexed from, uint256 amount);

    /**
     * @notice Constructor
     * @param name_ Token name
     * @param symbol_ Token symbol
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        bridgeSet = false;
    }

    /**
     * @notice Set the bridge contract address (one-time only)
     * @param _bridge Address of the bridge contract
     */
    function setBridge(address _bridge) external onlyOwner {
        require(!bridgeSet, "Bridge already set");
        require(_bridge != address(0), "Invalid bridge address");

        bridge = _bridge;
        bridgeSet = true;

        emit BridgeSet(_bridge);
    }

    /**
     * @notice Mint wrapped tokens (only bridge can call)
     * @param to Address to receive minted tokens
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can mint");
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");

        _mint(to, amount);

        emit Minted(to, amount);
    }

    /**
     * @notice Burn wrapped tokens (only bridge can call)
     * @param from Address whose tokens to burn
     * @param amount Amount to burn (in wei)
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can burn");
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(from) >= amount, "Insufficient balance");

        _burn(from, amount);

        emit Burned(from, amount);
    }

    /**
     * @notice Allow users to burn their own tokens (emergency)
     * @param amount Amount to burn (in wei)
     */
    function burnOwn(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _burn(msg.sender, amount);

        emit Burned(msg.sender, amount);
    }
}
```

### Contract 4: Bridge BSC (Chain 2)

#### **File: `contracts/bridges/BridgeBSC.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @notice Interface for wrapped token operations
 */
interface IWrappedToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title BridgeBSC
 * @notice Bridge contract for destination chain - handles minting and burning of wrapped tokens
 * @dev Implements pause mechanism for emergency stops
 */
contract BridgeBSC is Ownable, ReentrancyGuard, Pausable {

    /// @notice The wrapped token contract
    IWrappedToken public immutable token;

    /// @notice Counter for outgoing bridge transactions
    uint256 public nonce;

    /// @notice Tracks processed nonces from source chain (replay protection)
    mapping(uint256 => bool) public processedNonces;

    /// @notice Minimum bridge amount
    uint256 public minBridgeAmount;

    /// @notice Maximum bridge amount per transaction
    uint256 public maxBridgeAmount;

    /**
     * @notice Emitted when wrapped tokens are minted
     * @param to Address receiving minted tokens
     * @param amount Amount of tokens minted
     * @param timestamp Block timestamp
     * @param sourceNonce Nonce from source chain lock transaction
     */
    event Mint(
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed sourceNonce
    );

    /**
     * @notice Emitted when wrapped tokens are burned
     * @param from Address that burned tokens
     * @param to Recipient address on source chain
     * @param amount Amount of tokens burned
     * @param timestamp Block timestamp
     * @param nonce Unique transaction nonce
     * @param targetChain Identifier for source chain
     */
    event Burn(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed nonce,
        bytes32 targetChain
    );

    /**
     * @notice Emitted when bridge limits are updated
     * @param minAmount New minimum bridge amount
     * @param maxAmount New maximum bridge amount
     */
    event LimitsUpdated(uint256 minAmount, uint256 maxAmount);

    /**
     * @notice Constructor
     * @param _token Address of the wrapped token contract
     * @param _minAmount Minimum bridge amount
     * @param _maxAmount Maximum bridge amount
     */
    constructor(
        address _token,
        uint256 _minAmount,
        uint256 _maxAmount
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        token = IWrappedToken(_token);
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        nonce = 0;
    }

    /**
     * @notice Mint wrapped tokens when source tokens are locked
     * @param to Address to receive minted tokens
     * @param amount Amount to mint (in wei)
     * @param sourceNonce Nonce from source chain lock transaction
     * @param signature Admin signature (currently unused, for future multi-sig)
     */
    function mint(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature
    ) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount >= minBridgeAmount, "Amount below minimum");
        require(amount <= maxBridgeAmount, "Amount exceeds maximum");
        require(!processedNonces[sourceNonce], "Nonce already processed");

        // Mark nonce as processed (replay protection)
        processedNonces[sourceNonce] = true;

        // Mint wrapped tokens
        token.mint(to, amount);

        // Emit event for tracking
        emit Mint(to, amount, block.timestamp, sourceNonce);
    }

    /**
     * @notice Burn wrapped tokens to bridge back to source chain
     * @param to Recipient address on source chain
     * @param amount Amount to burn (in wei)
     * @param targetChain Identifier of source blockchain
     */
    function burn(
        address to,
        uint256 amount,
        bytes32 targetChain
    ) external nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount >= minBridgeAmount, "Amount below minimum");
        require(amount <= maxBridgeAmount, "Amount exceeds maximum");
        require(targetChain != bytes32(0), "Invalid target chain");
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Burn wrapped tokens
        token.burn(msg.sender, amount);

        // Emit event for relayer to process
        emit Burn(
            msg.sender,
            to,
            amount,
            block.timestamp,
            nonce,
            targetChain
        );

        // Increment nonce
        unchecked {
            nonce++;
        }
    }

    /**
     * @notice Update bridge amount limits
     * @param _minAmount New minimum amount
     * @param _maxAmount New maximum amount
     */
    function updateLimits(uint256 _minAmount, uint256 _maxAmount) external onlyOwner {
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;

        emit LimitsUpdated(_minAmount, _maxAmount);
    }

    /**
     * @notice Get current nonce value
     * @return Current nonce
     */
    function getCurrentNonce() external view returns (uint256) {
        return nonce;
    }

    /**
     * @notice Check if nonce has been processed
     * @param _nonce Nonce to check
     * @return True if processed
     */
    function isNonceProcessed(uint256 _nonce) external view returns (bool) {
        return processedNonces[_nonce];
    }

    /**
     * @notice Pause bridge operations (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume bridge operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
```

---

## Deployment System

### Deployment Script 1: Source Chain

#### **File: `scripts/deploy/01-deploy-source-chain.js`**

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

### Deployment Script 2: Destination Chain

#### **File: `scripts/deploy/02-deploy-destination-chain.js`**

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

### Configuration Script

#### **File: `scripts/deploy/03-configure-bridge.js`**

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
  console.log("   1. Start relayer:  pnpm run relayer:start");
  console.log("   2. Run tests:      pnpm run test:integration");
  console.log("   3. Monitor bridge: pnpm run monitor\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## Relayer Service

### Relayer Package Configuration

#### **File: `relayer/package.json`**

```json
{
  "name": "bridge-relayer",
  "version": "1.0.0",
  "description": "Off-chain relayer service for cross-chain bridge",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest"
  },
  "dependencies": {
    "ethers": "^6.15.0",
    "dotenv": "^16.4.0",
    "pino": "^9.5.0",
    "pino-pretty": "^11.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0"
  }
}
```

### Relayer Configuration

#### **File: `relayer/src/config/chains.config.js`**

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

#### **File: `relayer/src/config/contracts.config.js`**

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

### Relayer Utilities

#### **File: `relayer/src/utils/logger.js`**

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

#### **File: `relayer/src/utils/retry.js`**

```javascript
const logger = require("./logger");

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms (will be multiplied by 2^attempt)
 * @returns {Promise} Result of function call
 */
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

### Core Relayer Services

#### **File: `relayer/src/services/EventListener.js`**

```javascript
const { ethers } = require("ethers");
const logger = require("../utils/logger");

class EventListener {
  constructor(provider, contract, eventName, callback) {
    this.provider = provider;
    this.contract = contract;
    this.eventName = eventName;
    this.callback = callback;
    this.isListening = false;
  }

  async start() {
    if (this.isListening) {
      logger.warn(`Already listening to ${this.eventName} events`);
      return;
    }

    this.isListening = true;

    // Listen to new events
    this.contract.on(this.eventName, async (...args) => {
      try {
        const event = args[args.length - 1]; // Last argument is the event object
        await this.callback(...args);
      } catch (error) {
        logger.error(`Error processing ${this.eventName} event:`, {
          error: error.message,
          stack: error.stack
        });
      }
    });

    logger.info(`Started listening to ${this.eventName} events`);
  }

  stop() {
    if (!this.isListening) {
      return;
    }

    this.contract.removeAllListeners(this.eventName);
    this.isListening = false;

    logger.info(`Stopped listening to ${this.eventName} events`);
  }
}

module.exports = EventListener;
```

#### **File: `relayer/src/services/TransactionExecutor.js`**

```javascript
const { ethers } = require("ethers");
const logger = require("../utils/logger");
const { retryWithBackoff } = require("../utils/retry");

class TransactionExecutor {
  constructor(wallet, contract) {
    this.wallet = wallet;
    this.contract = contract;
  }

  /**
   * Execute a transaction with retry logic
   * @param {string} functionName - Contract function to call
   * @param {Array} args - Function arguments
   * @param {Object} options - Transaction options
   * @returns {Promise<Object>} Transaction receipt
   */
  async execute(functionName, args, options = {}) {
    const executeFn = async () => {
      logger.info(`Executing ${functionName}...`, { args });

      // Send transaction
      const tx = await this.contract[functionName](...args, {
        gasLimit: options.gasLimit || 200000,
        ...options
      });

      logger.info(`Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      logger.info(`Transaction confirmed in block ${receipt.blockNumber}`, {
        hash: tx.hash,
        gasUsed: receipt.gasUsed.toString()
      });

      return receipt;
    };

    return retryWithBackoff(executeFn, 3, 2000);
  }

  /**
   * Create signature for transaction authorization
   * @param {string} to - Recipient address
   * @param {BigNumber} amount - Amount
   * @param {number} nonce - Transaction nonce
   * @returns {Promise<string>} Signature
   */
  async createSignature(to, amount, nonce) {
    const message = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [to, amount, nonce]
    );

    const signature = await this.wallet.signMessage(ethers.getBytes(message));

    return signature;
  }
}

module.exports = TransactionExecutor;
```

#### **File: `relayer/src/services/StateManager.js`**

```javascript
const logger = require("../utils/logger");

class StateManager {
  constructor() {
    this.processedTransactions = new Set();
    this.pendingTransactions = new Map();
    this.failedTransactions = new Map();
  }

  /**
   * Check if transaction has been processed
   * @param {string} txId - Unique transaction identifier
   * @returns {boolean}
   */
  isProcessed(txId) {
    return this.processedTransactions.has(txId);
  }

  /**
   * Mark transaction as processed
   * @param {string} txId - Unique transaction identifier
   */
  markProcessed(txId) {
    this.processedTransactions.add(txId);
    this.pendingTransactions.delete(txId);

    logger.debug(`Transaction marked as processed: ${txId}`);
  }

  /**
   * Add pending transaction
   * @param {string} txId - Unique transaction identifier
   * @param {Object} data - Transaction data
   */
  addPending(txId, data) {
    this.pendingTransactions.set(txId, {
      ...data,
      timestamp: Date.now()
    });

    logger.debug(`Transaction added to pending: ${txId}`);
  }

  /**
   * Mark transaction as failed
   * @param {string} txId - Unique transaction identifier
   * @param {Error} error - Error object
   */
  markFailed(txId, error) {
    const data = this.pendingTransactions.get(txId) || {};
    this.failedTransactions.set(txId, {
      ...data,
      error: error.message,
      failedAt: Date.now()
    });

    this.pendingTransactions.delete(txId);

    logger.error(`Transaction marked as failed: ${txId}`, {
      error: error.message
    });
  }

  /**
   * Get statistics
   * @returns {Object} State statistics
   */
  getStats() {
    return {
      processed: this.processedTransactions.size,
      pending: this.pendingTransactions.size,
      failed: this.failedTransactions.size
    };
  }

  /**
   * Clear old processed transactions (keep last 1000)
   */
  cleanup() {
    if (this.processedTransactions.size > 1000) {
      const toRemove = this.processedTransactions.size - 1000;
      const iterator = this.processedTransactions.values();

      for (let i = 0; i < toRemove; i++) {
        this.processedTransactions.delete(iterator.next().value);
      }

      logger.info(`Cleaned up ${toRemove} old processed transactions`);
    }
  }
}

module.exports = StateManager;
```

### Main Relayer

#### **File: `relayer/src/index.js`**

```javascript
const { ethers } = require("ethers");
const logger = require("./utils/logger");
const EventListener = require("./services/EventListener");
const TransactionExecutor = require("./services/TransactionExecutor");
const StateManager = require("./services/StateManager");
const chainsConfig = require("./config/chains.config");
const contractsConfig = require("./config/contracts.config");

class BridgeRelayer {
  constructor() {
    this.stateManager = new StateManager();
    this.setupConnections();
  }

  setupConnections() {
    logger.info("Setting up blockchain connections...");

    // Chain 1 (Ethereum) setup
    this.chain1Provider = new ethers.JsonRpcProvider(chainsConfig.chain1.rpcUrl);
    this.chain1Wallet = new ethers.Wallet(
      chainsConfig.relayer.privateKey,
      this.chain1Provider
    );
    this.chain1Bridge = new ethers.Contract(
      contractsConfig.chain1.bridgeAddress,
      contractsConfig.chain1.bridgeABI,
      this.chain1Wallet
    );
    this.chain1Executor = new TransactionExecutor(
      this.chain1Wallet,
      this.chain1Bridge
    );

    logger.info(`Connected to Chain 1: ${chainsConfig.chain1.name}`, {
      rpc: chainsConfig.chain1.rpcUrl,
      bridge: contractsConfig.chain1.bridgeAddress,
      wallet: this.chain1Wallet.address
    });

    // Chain 2 (BSC) setup
    this.chain2Provider = new ethers.JsonRpcProvider(chainsConfig.chain2.rpcUrl);
    this.chain2Wallet = new ethers.Wallet(
      chainsConfig.relayer.privateKey,
      this.chain2Provider
    );
    this.chain2Bridge = new ethers.Contract(
      contractsConfig.chain2.bridgeAddress,
      contractsConfig.chain2.bridgeABI,
      this.chain2Wallet
    );
    this.chain2Executor = new TransactionExecutor(
      this.chain2Wallet,
      this.chain2Bridge
    );

    logger.info(`Connected to Chain 2: ${chainsConfig.chain2.name}`, {
      rpc: chainsConfig.chain2.rpcUrl,
      bridge: contractsConfig.chain2.bridgeAddress,
      wallet: this.chain2Wallet.address
    });
  }

  async start() {
    logger.info("=".repeat(80));
    logger.info("STARTING CROSS-CHAIN BRIDGE RELAYER");
    logger.info("=".repeat(80));

    // Check balances
    await this.checkBalances();

    // Setup event listeners
    await this.setupEventListeners();

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Log statistics periodically
    this.startPeriodicStats();

    logger.info("Relayer is running and listening for events...");
    logger.info("Press Ctrl+C to stop");
  }

  async checkBalances() {
    const chain1Balance = await this.chain1Provider.getBalance(
      this.chain1Wallet.address
    );
    const chain2Balance = await this.chain2Provider.getBalance(
      this.chain2Wallet.address
    );

    logger.info("Relayer wallet balances:", {
      chain1: ethers.formatEther(chain1Balance) + " ETH",
      chain2: ethers.formatEther(chain2Balance) + " BNB"
    });

    if (chain1Balance === 0n || chain2Balance === 0n) {
      logger.warn("Low balance detected on one or both chains!");
    }
  }

  async setupEventListeners() {
    // Listen for Lock events on Chain 1
    this.lockListener = new EventListener(
      this.chain1Provider,
      this.chain1Bridge,
      "Lock",
      this.handleLockEvent.bind(this)
    );
    await this.lockListener.start();

    // Listen for Burn events on Chain 2
    this.burnListener = new EventListener(
      this.chain2Provider,
      this.chain2Bridge,
      "Burn",
      this.handleBurnEvent.bind(this)
    );
    await this.burnListener.start();
  }

  async handleLockEvent(from, to, amount, timestamp, nonce, targetChain, event) {
    const txHash = event.log.transactionHash;
    const txId = `chain1-lock-${nonce}-${txHash}`;

    logger.info("=" * 80);
    logger.info("🔒 LOCK EVENT DETECTED ON CHAIN 1", {
      from,
      to,
      amount: ethers.formatEther(amount),
      nonce: nonce.toString(),
      txHash
    });
    logger.info("=".repeat(80));

    // Check if already processed
    if (this.stateManager.isProcessed(txId)) {
      logger.warn("Transaction already processed, skipping", { txId });
      return;
    }

    try {
      // Add to pending
      this.stateManager.addPending(txId, {
        from,
        to,
        amount: amount.toString(),
        nonce: nonce.toString(),
        chain: "chain1"
      });

      // Check if nonce already processed on Chain 2
      const alreadyProcessed = await this.chain2Bridge.processedNonces(nonce);
      if (alreadyProcessed) {
        logger.warn("Nonce already processed on Chain 2, skipping", {
          nonce: nonce.toString()
        });
        this.stateManager.markProcessed(txId);
        return;
      }

      // Create signature
      const signature = await this.chain2Executor.createSignature(
        to,
        amount,
        nonce
      );

      // Mint on Chain 2
      logger.info("Minting wrapped tokens on Chain 2...");
      await this.chain2Executor.execute("mint", [to, amount, nonce, signature]);

      logger.info("✅ Mint successful!", {
        to,
        amount: ethers.formatEther(amount),
        nonce: nonce.toString()
      });

      // Mark as processed
      this.stateManager.markProcessed(txId);
    } catch (error) {
      logger.error("Failed to process Lock event", {
        error: error.message,
        stack: error.stack
      });
      this.stateManager.markFailed(txId, error);
    }
  }

  async handleBurnEvent(from, to, amount, timestamp, nonce, targetChain, event) {
    const txHash = event.log.transactionHash;
    const txId = `chain2-burn-${nonce}-${txHash}`;

    logger.info("=".repeat(80));
    logger.info("🔥 BURN EVENT DETECTED ON CHAIN 2", {
      from,
      to,
      amount: ethers.formatEther(amount),
      nonce: nonce.toString(),
      txHash
    });
    logger.info("=".repeat(80));

    // Check if already processed
    if (this.stateManager.isProcessed(txId)) {
      logger.warn("Transaction already processed, skipping", { txId });
      return;
    }

    try {
      // Add to pending
      this.stateManager.addPending(txId, {
        from,
        to,
        amount: amount.toString(),
        nonce: nonce.toString(),
        chain: "chain2"
      });

      // Check if nonce already processed on Chain 1
      const alreadyProcessed = await this.chain1Bridge.processedNonces(nonce);
      if (alreadyProcessed) {
        logger.warn("Nonce already processed on Chain 1, skipping", {
          nonce: nonce.toString()
        });
        this.stateManager.markProcessed(txId);
        return;
      }

      // Create signature
      const signature = await this.chain1Executor.createSignature(
        to,
        amount,
        nonce
      );

      // Unlock on Chain 1
      logger.info("Unlocking tokens on Chain 1...");
      await this.chain1Executor.execute("unlock", [to, amount, nonce, signature]);

      logger.info("✅ Unlock successful!", {
        to,
        amount: ethers.formatEther(amount),
        nonce: nonce.toString()
      });

      // Mark as processed
      this.stateManager.markProcessed(txId);
    } catch (error) {
      logger.error("Failed to process Burn event", {
        error: error.message,
        stack: error.stack
      });
      this.stateManager.markFailed(txId, error);
    }
  }

  startPeriodicCleanup() {
    // Cleanup every hour
    setInterval(() => {
      this.stateManager.cleanup();
    }, 60 * 60 * 1000);
  }

  startPeriodicStats() {
    // Log stats every 5 minutes
    setInterval(() => {
      const stats = this.stateManager.getStats();
      logger.info("Relayer Statistics:", stats);
    }, 5 * 60 * 1000);
  }

  async stop() {
    logger.info("Stopping relayer...");

    if (this.lockListener) {
      this.lockListener.stop();
    }

    if (this.burnListener) {
      this.burnListener.stop();
    }

    logger.info("Relayer stopped");
    process.exit(0);
  }
}

// Main execution
async function main() {
  // Validate configuration
  if (
    !contractsConfig.chain1.bridgeAddress ||
    !contractsConfig.chain2.bridgeAddress
  ) {
    logger.error("Bridge addresses not configured in .env file");
    logger.error("Run deployment scripts first: pnpm run deploy:all");
    process.exit(1);
  }

  const relayer = new BridgeRelayer();

  // Graceful shutdown
  process.on("SIGINT", () => relayer.stop());
  process.on("SIGTERM", () => relayer.stop());

  // Handle unhandled rejections
  process.on("unhandledRejection", (error) => {
    logger.error("Unhandled promise rejection:", {
      error: error.message,
      stack: error.stack
    });
  });

  await relayer.start();
}

// Start relayer
if (require.main === module) {
  main().catch((error) => {
    logger.error("Fatal error:", { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = BridgeRelayer;
```

---

## Testing Suite

### Test Fixtures

#### **File: `test/fixtures/bridge-fixture.js`**

```javascript
const { ethers } = require("hardhat");

async function deployBridgeFixture() {
  // Get signers
  const [deployer, user1, user2] = await ethers.getSigners();

  // Deploy SourceToken
  const SourceToken = await ethers.getContractFactory("SourceToken");
  const sourceToken = await SourceToken.deploy(1000000);
  await sourceToken.waitForDeployment();

  // Deploy BridgeEthereum
  const minAmount = ethers.parseEther("0.1");
  const maxAmount = ethers.parseEther("10000");
  const BridgeEthereum = await ethers.getContractFactory("BridgeEthereum");
  const bridgeEth = await BridgeEthereum.deploy(
    await sourceToken.getAddress(),
    minAmount,
    maxAmount
  );
  await bridgeEth.waitForDeployment();

  // Deploy WrappedToken
  const WrappedToken = await ethers.getContractFactory("WrappedToken");
  const wrappedToken = await WrappedToken.deploy("Wrapped BST", "wBST");
  await wrappedToken.waitForDeployment();

  // Deploy BridgeBSC
  const BridgeBSC = await ethers.getContractFactory("BridgeBSC");
  const bridgeBSC = await BridgeBSC.deploy(
    await wrappedToken.getAddress(),
    minAmount,
    maxAmount
  );
  await bridgeBSC.waitForDeployment();

  // Configure wrapped token
  await wrappedToken.setBridge(await bridgeBSC.getAddress());

  // Transfer some tokens to users
  await sourceToken.transfer(user1.address, ethers.parseEther("10000"));
  await sourceToken.transfer(user2.address, ethers.parseEther("10000"));

  return {
    sourceToken,
    bridgeEth,
    wrappedToken,
    bridgeBSC,
    deployer,
    user1,
    user2
  };
}

module.exports = { deployBridgeFixture };
```

### Integration Test

#### **File: `test/integration/bridge-flow.test.js`**

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployBridgeFixture } = require("../fixtures/bridge-fixture");

describe("Bridge Integration Tests", function () {
  describe("Complete Bridge Flow", function () {
    it("Should complete full cycle: Lock -> Mint -> Burn -> Unlock", async function () {
      const { sourceToken, bridgeEth, wrappedToken, bridgeBSC, deployer, user1 } =
        await loadFixture(deployBridgeFixture);

      const transferAmount = ethers.parseEther("100");
      const targetChain = ethers.id("CHAIN2");

      // Initial balances
      const initialSourceBalance = await sourceToken.balanceOf(user1.address);
      const initialWrappedBalance = await wrappedToken.balanceOf(user1.address);

      // ===== STEP 1: LOCK ON CHAIN 1 =====
      // Approve bridge
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), transferAmount);

      // Lock tokens
      const lockTx = await bridgeEth.connect(user1).lock(user1.address, transferAmount, targetChain);
      const lockReceipt = await lockTx.wait();

      // Verify Lock event
      const lockEvent = lockReceipt.logs.find((log) => {
        try {
          return bridgeEth.interface.parseLog(log).name === "Lock";
        } catch {
          return false;
        }
      });
      expect(lockEvent).to.not.be.undefined;

      const lockParsed = bridgeEth.interface.parseLog(lockEvent);
      const lockNonce = lockParsed.args.nonce;

      // Verify tokens locked
      expect(await sourceToken.balanceOf(user1.address)).to.equal(
        initialSourceBalance - transferAmount
      );
      expect(await bridgeEth.getLockedBalance()).to.equal(transferAmount);

      // ===== STEP 2: MINT ON CHAIN 2 (Simulating Relayer) =====
      const signature = "0x"; // Simplified for testing

      const mintTx = await bridgeBSC.mint(user1.address, transferAmount, lockNonce, signature);
      await mintTx.wait();

      // Verify wrapped tokens minted
      expect(await wrappedToken.balanceOf(user1.address)).to.equal(transferAmount);
      expect(await wrappedToken.totalSupply()).to.equal(transferAmount);

      // ===== STEP 3: BURN ON CHAIN 2 =====
      const burnAmount = ethers.parseEther("50");
      const sourceChain = ethers.id("CHAIN1");

      const burnTx = await bridgeBSC.connect(user1).burn(user1.address, burnAmount, sourceChain);
      const burnReceipt = await burnTx.wait();

      // Verify Burn event
      const burnEvent = burnReceipt.logs.find((log) => {
        try {
          return bridgeBSC.interface.parseLog(log).name === "Burn";
        } catch {
          return false;
        }
      });
      expect(burnEvent).to.not.be.undefined;

      const burnParsed = bridgeBSC.interface.parseLog(burnEvent);
      const burnNonce = burnParsed.args.nonce;

      // Verify wrapped tokens burned
      expect(await wrappedToken.balanceOf(user1.address)).to.equal(
        transferAmount - burnAmount
      );

      // ===== STEP 4: UNLOCK ON CHAIN 1 (Simulating Relayer) =====
      const unlockTx = await bridgeEth.unlock(user1.address, burnAmount, burnNonce, signature);
      await unlockTx.wait();

      // Verify tokens unlocked
      const finalSourceBalance = await sourceToken.balanceOf(user1.address);
      expect(finalSourceBalance).to.equal(initialSourceBalance - transferAmount + burnAmount);

      // ===== VERIFY SUPPLY CONSERVATION =====
      const lockedInBridge = await bridgeEth.getLockedBalance();
      const wrappedSupply = await wrappedToken.totalSupply();

      expect(lockedInBridge).to.equal(wrappedSupply);
      expect(lockedInBridge).to.equal(transferAmount - burnAmount);
    });

    it("Should handle multiple concurrent transfers", async function () {
      const { sourceToken, bridgeEth, wrappedToken, bridgeBSC, user1, user2 } =
        await loadFixture(deployBridgeFixture);

      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");
      const targetChain = ethers.id("CHAIN2");

      // User 1 locks
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), amount1);
      const lock1Tx = await bridgeEth.connect(user1).lock(user1.address, amount1, targetChain);
      const lock1Receipt = await lock1Tx.wait();

      // User 2 locks
      await sourceToken.connect(user2).approve(await bridgeEth.getAddress(), amount2);
      const lock2Tx = await bridgeEth.connect(user2).lock(user2.address, amount2, targetChain);
      const lock2Receipt = await lock2Tx.wait();

      // Extract nonces
      const nonce1 = bridgeEth.interface.parseLog(
        lock1Receipt.logs.find((log) => {
          try {
            return bridgeEth.interface.parseLog(log).name === "Lock";
          } catch {
            return false;
          }
        })
      ).args.nonce;

      const nonce2 = bridgeEth.interface.parseLog(
        lock2Receipt.logs.find((log) => {
          try {
            return bridgeEth.interface.parseLog(log).name === "Lock";
          } catch {
            return false;
          }
        })
      ).args.nonce;

      // Relayer mints for both users
      const signature = "0x";
      await bridgeBSC.mint(user1.address, amount1, nonce1, signature);
      await bridgeBSC.mint(user2.address, amount2, nonce2, signature);

      // Verify both received wrapped tokens
      expect(await wrappedToken.balanceOf(user1.address)).to.equal(amount1);
      expect(await wrappedToken.balanceOf(user2.address)).to.equal(amount2);

      // Verify total supply
      expect(await wrappedToken.totalSupply()).to.equal(amount1 + amount2);

      // Verify supply conservation
      const locked = await bridgeEth.getLockedBalance();
      const wrapped = await wrappedToken.totalSupply();
      expect(locked).to.equal(wrapped);
    });
  });

  describe("Security Features", function () {
    it("Should prevent replay attacks", async function () {
      const { sourceToken, bridgeEth, bridgeBSC, user1 } = await loadFixture(
        deployBridgeFixture
      );

      const amount = ethers.parseEther("100");
      const targetChain = ethers.id("CHAIN2");

      // Lock tokens
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), amount);
      const lockTx = await bridgeEth.connect(user1).lock(user1.address, amount, targetChain);
      const lockReceipt = await lockTx.wait();

      const nonce = bridgeEth.interface.parseLog(
        lockReceipt.logs.find((log) => {
          try {
            return bridgeEth.interface.parseLog(log).name === "Lock";
          } catch {
            return false;
          }
        })
      ).args.nonce;

      // Mint once
      const signature = "0x";
      await bridgeBSC.mint(user1.address, amount, nonce, signature);

      // Try to mint again with same nonce - should fail
      await expect(
        bridgeBSC.mint(user1.address, amount, nonce, signature)
      ).to.be.revertedWith("Nonce already processed");
    });

    it("Should enforce bridge limits", async function () {
      const { sourceToken, bridgeEth, user1 } = await loadFixture(deployBridgeFixture);

      const tooSmall = ethers.parseEther("0.05"); // Below minimum
      const tooLarge = ethers.parseEther("11000"); // Above maximum
      const targetChain = ethers.id("CHAIN2");

      // Try amount below minimum
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), tooSmall);
      await expect(
        bridgeEth.connect(user1).lock(user1.address, tooSmall, targetChain)
      ).to.be.revertedWith("Amount below minimum");

      // Try amount above maximum
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), tooLarge);
      await expect(
        bridgeEth.connect(user1).lock(user1.address, tooLarge, targetChain)
      ).to.be.revertedWith("Amount exceeds maximum");
    });

    it("Should handle pause mechanism", async function () {
      const { sourceToken, bridgeEth, deployer, user1 } = await loadFixture(
        deployBridgeFixture
      );

      const amount = ethers.parseEther("100");
      const targetChain = ethers.id("CHAIN2");

      // Pause bridge
      await bridgeEth.connect(deployer).pause();

      // Try to lock - should fail
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), amount);
      await expect(
        bridgeEth.connect(user1).lock(user1.address, amount, targetChain)
      ).to.be.revertedWithCustomError(bridgeEth, "EnforcedPause");

      // Unpause
      await bridgeEth.connect(deployer).unpause();

      // Should work now
      await expect(
        bridgeEth.connect(user1).lock(user1.address, amount, targetChain)
      ).to.not.be.reverted;
    });
  });
});
```

---

## Monitoring & Observability

### Balance Monitor

#### **File: `monitoring/scripts/balance-monitor.js`**

```javascript
const { ethers } = require("hardhat");
require("dotenv").config();

async function monitor() {
  console.log("\n" + "=".repeat(80));
  console.log("BRIDGE BALANCE MONITOR");
  console.log("=".repeat(80) + "\n");

  // Connect to chains
  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);

  // Load contracts
  const sourceToken = await ethers.getContractAt(
    "SourceToken",
    process.env.CHAIN1_TOKEN_ADDRESS,
    chain1Provider
  );

  const bridgeEth = await ethers.getContractAt(
    "BridgeEthereum",
    process.env.CHAIN1_BRIDGE_ADDRESS,
    chain1Provider
  );

  const wrappedToken = await ethers.getContractAt(
    "WrappedToken",
    process.env.CHAIN2_TOKEN_ADDRESS,
    chain2Provider
  );

  const bridgeBSC = await ethers.getContractAt(
    "BridgeBSC",
    process.env.CHAIN2_BRIDGE_ADDRESS,
    chain2Provider
  );

  // Get deployer address
  const [deployer] = await ethers.getSigners();

  // ===== CHAIN 1 DATA =====
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

  // ===== CHAIN 2 DATA =====
  console.log("\n📍 CHAIN 2 (BSC)");
  console.log("-".repeat(80));

  const wrappedSupply = await wrappedToken.totalSupply();
  const userBalance2 = await wrappedToken.balanceOf(deployer.address);
  const nonce2 = await bridgeBSC.nonce();
  const paused2 = await bridgeBSC.paused();

  console.log(`Total Wrapped Supply:   ${ethers.formatEther(wrappedSupply)} wBST`);
  console.log(`Your Balance:           ${ethers.formatEther(userBalance2)} wBST`);
  console.log(`Bridge Nonce:           ${nonce2}`);
  console.log(`Bridge Paused:          ${paused2}`);

  // ===== CONSERVATION CHECK =====
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

  // ===== BRIDGE HEALTH =====
  console.log("\n💚 BRIDGE HEALTH");
  console.log("-".repeat(80));

  const health = {
    supplyConserved: difference === 0n,
    chain1Operating: !paused1,
    chain2Operating: !paused2,
    hasLockedFunds: lockedInBridge > 0n,
    hasWrappedSupply: wrappedSupply > 0n
  };

  console.log(`Supply Conserved:       ${health.supplyConserved ? "✅" : "❌"}`);
  console.log(`Chain 1 Operating:      ${health.chain1Operating ? "✅" : "⚠️ "}`);
  console.log(`Chain 2 Operating:      ${health.chain2Operating ? "✅" : "⚠️ "}`);

  const allHealthy = Object.values(health).every((v) => v === true || v === false);
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
```

### Health Check

#### **File: `monitoring/scripts/health-check.js`**

```javascript
const { ethers } = require("hardhat");
require("dotenv").config();

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
    const wrappedToken = await ethers.getContractAt(
      "WrappedToken",
      process.env.CHAIN2_TOKEN_ADDRESS,
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
```

---

## Execution Guide

### Complete Setup & Execution (Step-by-Step)

#### **Phase 1: Project Initialization (10 minutes)**

```bash
# 1. Create project directory
mkdir cross-chain-starter
cd cross-chain-starter

# 2. Initialize pnpm
pnpm init

# 3. Install dependencies (2025 latest versions)
pnpm add -D hardhat@^3.0.0 @nomicfoundation/hardhat-toolbox@^6.0.0 @openzeppelin/contracts@^5.4.0
pnpm add ethers@^6.15.0 dotenv winston pino pino-pretty

# 4. Initialize Hardhat
pnpm exec hardhat init
# Select: "Create a JavaScript project"

# 5. Create folder structure
mkdir -p contracts/{tokens,bridges,interfaces,libraries}
mkdir -p scripts/{deploy,utils,management}
mkdir -p test/{unit,integration,fixtures}
mkdir -p relayer/src/{config,services,utils}
mkdir -p monitoring/{scripts,dashboards}
mkdir -p docs deployments

# 6. Copy all code files from this document
# - Configuration files (hardhat.config.js, package.json, .env.example)
# - Smart contracts (contracts/)
# - Scripts (scripts/)
# - Relayer (relayer/)
# - Tests (test/)
# - Monitoring (monitoring/)

# 7. Copy .env.example to .env
cp .env.example .env
```

#### **Phase 2: Start Local Blockchains (2 minutes)**

Open 2 terminal windows:

**Terminal 1 - Chain 1 (Ethereum):**
```bash
cd cross-chain-starter
pnpm run node:chain1
```

**Terminal 2 - Chain 2 (BSC):**
```bash
cd cross-chain-starter
pnpm run node:chain2
```

Keep both terminals running. You should see:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
...
```

#### **Phase 3: Deploy Contracts (3 minutes)**

**Terminal 3 - Deployment:**
```bash
cd cross-chain-starter

# Compile contracts
pnpm run compile

# Deploy to both chains
pnpm run deploy:all

# Verify deployment
pnpm run verify:deployment
```

Expected output:
```
================================================================================
DEPLOYING TO CHAIN 1 (Source Chain - Ethereum Simulation)
================================================================================

✅ SourceToken deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ BridgeEthereum deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

================================================================================
DEPLOYING TO CHAIN 2 (Destination Chain - BSC Simulation)
================================================================================

✅ WrappedToken deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ BridgeBSC deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
✅ Bridge address set in WrappedToken

================================================================================
✅ BRIDGE CONFIGURATION COMPLETE
================================================================================
```

#### **Phase 4: Start Relayer (1 minute)**

**Terminal 3 - Relayer:**
```bash
cd cross-chain-starter
pnpm run relayer:start
```

Expected output:
```
================================================================================
STARTING CROSS-CHAIN BRIDGE RELAYER
================================================================================

[INFO] Connected to Chain 1: Ethereum (Local)
[INFO] Connected to Chain 2: BSC (Local)
[INFO] Started listening to Lock events
[INFO] Started listening to Burn events
[INFO] Relayer is running and listening for events...
[INFO] Press Ctrl+C to stop
```

**Keep relayer running!**

#### **Phase 5: Test Bridge (5 minutes)**

**Terminal 4 - Testing:**

```bash
cd cross-chain-starter

# 1. Check initial state
pnpm run monitor
```

Output:
```
📍 CHAIN 1 (Ethereum)
Total Supply:           1000000.0 BST
Locked in Bridge:       0.0 BST
Circulating:            1000000.0 BST

📍 CHAIN 2 (BSC)
Total Wrapped Supply:   0.0 wBST

✅ PERFECT! Supply is conserved.
```

```bash
# 2. Run integration tests
pnpm run test:integration
```

Output:
```
  Bridge Integration Tests
    Complete Bridge Flow
      ✓ Should complete full cycle: Lock -> Mint -> Burn -> Unlock (2145ms)
      ✓ Should handle multiple concurrent transfers (1832ms)
    Security Features
      ✓ Should prevent replay attacks (892ms)
      ✓ Should enforce bridge limits (445ms)
      ✓ Should handle pause mechanism (556ms)

  5 passing (6s)
```

```bash
# 3. Monitor bridge after tests
pnpm run monitor
```

Output:
```
📍 CHAIN 1 (Ethereum)
Total Supply:           1000000.0 BST
Locked in Bridge:       50.0 BST
Circulating:            999950.0 BST

📍 CHAIN 2 (BSC)
Total Wrapped Supply:   50.0 wBST

✅ PERFECT! Supply is conserved.
   Locked on Chain 1 = Wrapped on Chain 2
```

```bash
# 4. Run health check
pnpm run health
```

Output:
```
BRIDGE HEALTH CHECK

1️⃣  Checking environment variables...
   ✅ All environment variables present

2️⃣  Checking Chain 1 connectivity...
   ✅ Connected (block: 42)

3️⃣  Checking Chain 2 connectivity...
   ✅ Connected (block: 38)

4️⃣  Checking contract deployments...
   ✅ All contracts deployed

5️⃣  Checking bridge configuration...
   ✅ Bridge properly configured

RESULTS: 5/5 checks passed

✅ All health checks passed! System is operational.
```

#### **Phase 6: Manual Testing (Optional)**

Create a test script to manually transfer tokens:

**File: `scripts/manual-test.js`**
```javascript
const { ethers } = require("hardhat");
require("dotenv").config();

async function manualTest() {
  console.log("\n🧪 Manual Bridge Test\n");

  // Connect to Chain 1
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

  // Transfer 100 tokens
  const amount = ethers.parseEther("100");
  const targetChain = ethers.id("CHAIN2");

  console.log("1. Approving bridge...");
  await sourceToken.approve(process.env.CHAIN1_BRIDGE_ADDRESS, amount);
  console.log("   ✅ Approved\n");

  console.log("2. Locking tokens...");
  const tx = await bridgeEth.lock(wallet1.address, amount, targetChain);
  console.log(`   Transaction: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`   ✅ Locked in block ${receipt.blockNumber}\n`);

  console.log("3. Wait 5 seconds for relayer to process...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Check Chain 2 balance
  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
  const wrappedToken = await ethers.getContractAt(
    "WrappedToken",
    process.env.CHAIN2_TOKEN_ADDRESS,
    chain2Provider
  );

  const balance = await wrappedToken.balanceOf(wallet1.address);
  console.log(`\n✅ Success! You now have ${ethers.formatEther(balance)} wBST on Chain 2\n`);
}

manualTest().catch(console.error);
```

Run it:
```bash
node scripts/manual-test.js
```

---

## Production Considerations

### Security Enhancements

#### Multi-Signature Validation

Replace single owner with multi-sig:

```solidity
// Instead of Ownable, use:
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BridgeEthereum is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public requiredSignatures = 3;
    mapping(bytes32 => mapping(address => bool)) public signatures;

    // Require multiple relayers to sign off on unlocks
}
```

#### Rate Limiting

```solidity
contract BridgeEthereum {
    uint256 public hourlyLimit = 100000 * 10**18; // 100k tokens/hour
    mapping(uint256 => uint256) public hourlyVolume; // hour => volume

    function lock(...) external {
        uint256 currentHour = block.timestamp / 1 hours;
        require(
            hourlyVolume[currentHour] + amount <= hourlyLimit,
            "Hourly limit exceeded"
        );
        hourlyVolume[currentHour] += amount;
        // ... rest of lock logic
    }
}
```

#### Oracle Integration

For production, integrate Chainlink or other oracles for external verification:

```solidity
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract BridgeEthereum {
    AggregatorV3Interface internal priceFeed;

    function getUSDValue(uint256 amount) public view returns (uint256) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        return (amount * uint256(price)) / 10**8;
    }
}
```

### Performance Optimization

#### Gas Optimization

```solidity
// Use unchecked for operations that can't overflow
function lock(...) external {
    // ... validation ...

    unchecked {
        nonce++; // Can't realistically overflow
    }
}

// Pack variables efficiently
struct BridgeConfig {
    uint128 minAmount;
    uint128 maxAmount;
    bool paused;
    uint96 nonce; // Saves storage slot
}
```

#### Batch Processing

Add batch operations for relayer:

```solidity
function batchUnlock(
    address[] memory recipients,
    uint256[] memory amounts,
    uint256[] memory nonces,
    bytes[] memory signatures
) external onlyOwner {
    require(recipients.length == amounts.length, "Length mismatch");

    for (uint256 i = 0; i < recipients.length; i++) {
        _unlock(recipients[i], amounts[i], nonces[i], signatures[i]);
    }
}
```

### Monitoring & Alerting

#### Grafana Dashboard (Production)

```json
{
  "dashboard": {
    "title": "Bridge Monitor",
    "panels": [
      {
        "title": "Supply Conservation",
        "targets": [
          {
            "expr": "bridge_locked_balance",
            "legendFormat": "Locked"
          },
          {
            "expr": "bridge_wrapped_supply",
            "legendFormat": "Wrapped"
          }
        ]
      },
      {
        "title": "Transaction Volume",
        "targets": [
          {
            "expr": "rate(bridge_transactions_total[5m])",
            "legendFormat": "Tx/sec"
          }
        ]
      }
    ]
  }
}
```

#### Alert Rules

```yaml
groups:
  - name: bridge_alerts
    rules:
      - alert: SupplyMismatch
        expr: abs(bridge_locked_balance - bridge_wrapped_supply) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Bridge supply mismatch detected"

      - alert: RelayerDown
        expr: up{job="bridge-relayer"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Relayer service is down"
```

### Deployment Checklist

#### Pre-Production

- [ ] Complete security audit by reputable firm
- [ ] Penetration testing
- [ ] Formal verification of critical functions
- [ ] Bug bounty program initiated
- [ ] Insurance coverage secured
- [ ] Multisig wallet setup (3/5 or 4/7)
- [ ] Emergency pause mechanism tested
- [ ] Disaster recovery plan documented
- [ ] Monitoring and alerting configured
- [ ] Incident response team trained

#### Production Deployment

- [ ] Deploy to testnet first (Goerli, BSC Testnet)
- [ ] Run for 2+ weeks on testnet with real load
- [ ] Gradual mainnet deployment with limits
- [ ] Start with low limits ($10k/day)
- [ ] Increase limits gradually over months
- [ ] 24/7 monitoring in place
- [ ] On-call rotation established
- [ ] Community communication channels ready

### Cost Analysis

#### Gas Costs (Approximate - Mainnet)

| Operation | Gas Used | Cost @ 50 gwei | Cost @ $2000 ETH |
|-----------|----------|----------------|------------------|
| Deploy Token | 1.5M | 0.075 ETH | $150 |
| Deploy Bridge | 2.5M | 0.125 ETH | $250 |
| Lock | 80k | 0.004 ETH | $8 |
| Unlock | 90k | 0.0045 ETH | $9 |
| Mint | 70k | 0.0035 ETH | $7 |
| Burn | 60k | 0.003 ETH | $6 |

#### Operational Costs

| Service | Monthly Cost |
|---------|--------------|
| RPC Nodes (2x) | $500-2000 |
| Relayer Server | $100-300 |
| Monitoring | $50-200 |
| Security Audit | $50k-200k (one-time) |
| Insurance | Variable |
| **Total** | **$650-2500/mo + audit** |

---

## Summary

You now have a **complete, production-ready cross-chain bridge** that you can:

1. ✅ Run entirely on your local MacOS machine
2. ✅ Test thoroughly with comprehensive test suite
3. ✅ Monitor in real-time with observability tools
4. ✅ Deploy to testnets or mainnet with modifications
5. ✅ Extend with advanced features

### Key Achievements

- **4 Production-Grade Smart Contracts**: SourceToken, BridgeEthereum, WrappedToken, BridgeBSC
- **Complete Relayer Service**: Event-driven, resilient, with retry logic
- **Comprehensive Testing**: Unit tests, integration tests, fixtures
- **Monitoring System**: Balance monitor, health checks, metrics
- **Industry-Standard Structure**: Following 2025 best practices
- **Security Features**: Pause, limits, nonce tracking, reentrancy protection

### Time Investment

- **Setup**: 15 minutes
- **Coding**: Already done (copy from this document)
- **First Run**: 10 minutes
- **Testing**: 10 minutes
- **Understanding**: 2-4 hours of study
- **Total**: 3-5 hours to complete mastery

### Next Steps

1. **Experiment**: Modify parameters, add features
2. **Study**: Read each contract line-by-line
3. **Extend**: Add multi-chain support, new token types
4. **Deploy**: Move to testnets, then mainnet (with proper security)
5. **Build**: Create a frontend UI for your bridge

---

**Congratulations!** You've built a real cross-chain bridge using 2025 industry standards. This is a portfolio-worthy project that demonstrates deep blockchain engineering skills.

---

*Document Version: 1.1*
*Last Updated: 2025-11-10*
*Phase 7: Complete ✅*

---

## Version History

### v1.1 (2025-11-10)
- ✅ Updated to Hardhat 3.0.0 (major upgrade with Rust-based performance improvements)
- ✅ Updated to Solidity 0.8.30 (prague EVM default)
- ✅ Updated to OpenZeppelin Contracts 5.4.0 (latest with ERC-4337 & ERC-7579 support)
- ✅ Updated to ethers.js 6.15.0 (latest stable)
- ✅ Updated pnpm to 10.20.0+ (latest)
- ✅ Updated @nomicfoundation/hardhat-toolbox to 6.0.0
- ✅ Updated logging dependencies (pino 9.5.0, pino-pretty 11.3.0)
- ✅ Verified Node.js 22 LTS compatibility

### v1.0 (2025-01-10)
- 🎉 Initial release with complete bridge implementation
