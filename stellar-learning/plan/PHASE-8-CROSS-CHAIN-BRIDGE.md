# Phase 8: Building a Cross-Chain Bridge

## Overview
This final phase brings everything together: building a production-ready cross-chain bridge between Stellar and Ethereum. You'll learn bridge architecture, security considerations, and implementation.

---

## Cross-Chain Bridge Architecture

### What is a Cross-Chain Bridge?

A bridge allows assets to move between different blockchains.

**Example Flow:**
1. User locks 1 ETH on Ethereum
2. Bridge mints 1 wETH on Stellar
3. User can trade wETH on Stellar DEX
4. User burns 1 wETH on Stellar
5. Bridge releases 1 ETH on Ethereum

### Bridge Components

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Ethereum   │◄───────►│   Bridge    │◄───────►│   Stellar   │
│  Contract   │         │  Relayer    │         │  Contract   │
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                       │
       │                       │                       │
    Lock ETH            Monitor Events           Mint wETH
```

**Components:**
1. **Ethereum Lock Contract**: Holds original assets
2. **Stellar Mint Contract**: Issues wrapped assets
3. **Relayer Service**: Monitors and relays events
4. **Validator Network**: Signs cross-chain messages

---

## Bridge Security Models

### 1. Centralized Bridge (Simplest)

**Architecture:**
- Single operator controls bridge
- Fastest, cheapest
- **Risk**: Single point of failure

**Use case**: MVP, testing, low-value transfers

### 2. Multi-Sig Bridge (Better)

**Architecture:**
- M-of-N validators must approve
- More decentralized
- **Risk**: Validator collusion

**Use case**: Medium-value production bridges

### 3. Light Client Bridge (Most Secure)

**Architecture:**
- Verifies source chain's consensus
- Fully trustless
- **Cost**: Complex, expensive

**Use case**: High-value, critical bridges

**For this tutorial**, we'll build a **multi-sig bridge** (option 2).

---

## Project Setup

### Directory Structure

```bash
mkdir stellar-eth-bridge
cd stellar-eth-bridge
npm init -y

# Install dependencies
npm install @stellar/stellar-sdk ethers dotenv
npm install --save-dev nodemon
```

### File Structure

```
stellar-eth-bridge/
├── src/
│   ├── ethereum/
│   │   ├── contracts/
│   │   │   └── BridgeLock.sol
│   │   └── ethereum-monitor.js
│   ├── stellar/
│   │   ├── contracts/
│   │   │   └── bridge/
│   │   └── stellar-monitor.js
│   ├── relayer/
│   │   ├── index.js
│   │   └── validator.js
│   └── config.js
├── .env
└── package.json
```

---

## Ethereum Side: Lock Contract

### BridgeLock.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BridgeLock is ReentrancyGuard, AccessControl {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    struct LockEvent {
        address sender;
        uint256 amount;
        string stellarAddress;
        uint256 timestamp;
        bool processed;
    }

    struct UnlockRequest {
        address recipient;
        uint256 amount;
        bytes32 stellarTxHash;
        uint256 approvals;
        bool executed;
        mapping(address => bool) hasApproved;
    }

    mapping(uint256 => LockEvent) public locks;
    mapping(bytes32 => UnlockRequest) public unlocks;
    uint256 public lockNonce;
    uint256 public requiredApprovals;

    event Locked(
        uint256 indexed lockId,
        address indexed sender,
        uint256 amount,
        string stellarAddress
    );

    event Unlocked(
        bytes32 indexed requestId,
        address indexed recipient,
        uint256 amount
    );

    constructor(uint256 _requiredApprovals) {
        requiredApprovals = _requiredApprovals;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Lock ETH to bridge to Stellar
    function lock(string memory stellarAddress) external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");
        require(bytes(stellarAddress).length > 0, "Invalid Stellar address");

        uint256 lockId = lockNonce++;
        locks[lockId] = LockEvent({
            sender: msg.sender,
            amount: msg.value,
            stellarAddress: stellarAddress,
            timestamp: block.timestamp,
            processed: false
        });

        emit Locked(lockId, msg.sender, msg.value, stellarAddress);
    }

    // Validators approve unlock requests
    function approveUnlock(
        bytes32 requestId,
        address recipient,
        uint256 amount,
        bytes32 stellarTxHash
    ) external onlyRole(VALIDATOR_ROLE) {
        UnlockRequest storage request = unlocks[requestId];

        if (request.recipient == address(0)) {
            // First approval - initialize request
            request.recipient = recipient;
            request.amount = amount;
            request.stellarTxHash = stellarTxHash;
        } else {
            // Verify consistency
            require(request.recipient == recipient, "Recipient mismatch");
            require(request.amount == amount, "Amount mismatch");
            require(request.stellarTxHash == stellarTxHash, "Tx hash mismatch");
        }

        require(!request.hasApproved[msg.sender], "Already approved");
        require(!request.executed, "Already executed");

        request.hasApproved[msg.sender] = true;
        request.approvals++;

        // Execute if threshold reached
        if (request.approvals >= requiredApprovals) {
            _executeUnlock(requestId);
        }
    }

    function _executeUnlock(bytes32 requestId) private nonReentrant {
        UnlockRequest storage request = unlocks[requestId];
        require(!request.executed, "Already executed");
        require(address(this).balance >= request.amount, "Insufficient balance");

        request.executed = true;

        (bool success, ) = request.recipient.call{value: request.amount}("");
        require(success, "Transfer failed");

        emit Unlocked(requestId, request.recipient, request.amount);
    }

    // Admin functions
    function addValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VALIDATOR_ROLE, validator);
    }

    function removeValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(VALIDATOR_ROLE, validator);
    }

    receive() external payable {}
}
```

### Deploy Ethereum Contract

```javascript
// ethereum/deploy.js
const { ethers } = require('ethers');
require('dotenv').config();

async function deployBridgeContract() {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

  console.log('Deploying from:', wallet.address);

  // Contract bytecode and ABI (compile with hardhat/foundry)
  const BridgeLock = await ethers.getContractFactory('BridgeLock', wallet);

  const requiredApprovals = 2; // 2-of-3 multi-sig
  const bridge = await BridgeLock.deploy(requiredApprovals);
  await bridge.waitForDeployment();

  const address = await bridge.getAddress();
  console.log('✅ Bridge deployed to:', address);

  // Add validators
  const validators = [
    process.env.VALIDATOR_1,
    process.env.VALIDATOR_2,
    process.env.VALIDATOR_3
  ];

  for (const validator of validators) {
    const tx = await bridge.addValidator(validator);
    await tx.wait();
    console.log('Added validator:', validator);
  }

  return address;
}

deployBridgeContract();
```

---

## Stellar Side: Wrapped Asset

### Create Wrapped ETH Asset

```javascript
// stellar/create-wrapped-asset.js
const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

async function createWrappedETH() {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Create issuer account
  const issuerKeypair = StellarSdk.Keypair.fromSecret(
    process.env.STELLAR_ISSUER_SECRET
  );

  // Create wETH asset
  const wETH = new StellarSdk.Asset('wETH', issuerKeypair.publicKey());

  console.log('✅ Wrapped ETH asset created');
  console.log('Asset code: wETH');
  console.log('Issuer:', issuerKeypair.publicKey());

  return wETH;
}

module.exports = { createWrappedETH };
```

---

## Relayer Service

### Ethereum Event Monitor

```javascript
// ethereum/ethereum-monitor.js
const { ethers } = require('ethers');
const StellarSdk = require('@stellar/stellar-sdk');

class EthereumMonitor {
  constructor(bridgeAddress, bridgeABI, stellarIssuer) {
    this.provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
    this.bridge = new ethers.Contract(bridgeAddress, bridgeABI, this.provider);
    this.stellarServer = new StellarSdk.Horizon.Server(
      'https://horizon-testnet.stellar.org'
    );
    this.stellarIssuer = StellarSdk.Keypair.fromSecret(stellarIssuer);
    this.wETH = new StellarSdk.Asset('wETH', this.stellarIssuer.publicKey());
  }

  async start() {
    console.log('🔍 Monitoring Ethereum for Lock events...');

    // Listen for Lock events
    this.bridge.on('Locked', async (lockId, sender, amount, stellarAddress) => {
      console.log('\n🔒 Lock detected!');
      console.log('Lock ID:', lockId.toString());
      console.log('ETH Amount:', ethers.formatEther(amount));
      console.log('Stellar Address:', stellarAddress);

      try {
        await this.mintOnStellar(stellarAddress, amount);
      } catch (error) {
        console.error('❌ Failed to mint on Stellar:', error.message);
      }
    });

    // Keep process alive
    process.stdin.resume();
  }

  async mintOnStellar(destinationAddress, ethAmount) {
    // Convert Wei to wETH (1:1 with 7 decimal places on Stellar)
    const wethAmount = (parseFloat(ethers.formatEther(ethAmount))).toFixed(7);

    console.log(`💫 Minting ${wethAmount} wETH on Stellar...`);

    const issuerAccount = await this.stellarServer.loadAccount(
      this.stellarIssuer.publicKey()
    );

    const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationAddress,
          asset: this.wETH,
          amount: wethAmount
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(this.stellarIssuer);
    const result = await this.stellarServer.submitTransaction(transaction);

    console.log('✅ wETH minted on Stellar!');
    console.log('TX Hash:', result.hash);
  }
}

module.exports = EthereumMonitor;
```

### Stellar Event Monitor

```javascript
// stellar/stellar-monitor.js
const StellarSdk = require('@stellar/stellar-sdk');
const { ethers } = require('ethers');

class StellarMonitor {
  constructor(issuerPublicKey, bridgeContract, validatorWallet) {
    this.server = new StellarSdk.Horizon.Server(
      'https://horizon-testnet.stellar.org'
    );
    this.issuerPublicKey = issuerPublicKey;
    this.bridge = bridgeContract;
    this.validator = validatorWallet;
  }

  async start() {
    console.log('🔍 Monitoring Stellar for burn events...');

    // Listen for payments TO the issuer (burns)
    const paymentsStream = this.server
      .payments()
      .forAccount(this.issuerPublicKey)
      .cursor('now')
      .stream({
        onmessage: async (payment) => {
          if (payment.type === 'payment' && payment.to === this.issuerPublicKey) {
            await this.handleBurn(payment);
          }
        },
        onerror: (error) => {
          console.error('Stream error:', error);
        }
      });
  }

  async handleBurn(payment) {
    console.log('\n🔥 Burn detected!');
    console.log('From:', payment.from);
    console.log('Amount:', payment.amount, 'wETH');

    // Extract ETH address from memo
    const transaction = await this.server.transactions()
      .transaction(payment.transaction_hash)
      .call();

    const memo = transaction.memo;
    if (!memo || memo === '') {
      console.error('❌ No ETH address in memo');
      return;
    }

    const ethAddress = memo;
    const amount = ethers.parseEther(payment.amount);

    console.log('Unlocking to ETH address:', ethAddress);

    // Create unlock request ID
    const requestId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256'],
        [payment.transaction_hash, ethAddress, amount]
      )
    );

    // Validator approves unlock
    try {
      const tx = await this.bridge.approveUnlock(
        requestId,
        ethAddress,
        amount,
        ethers.encodeBytes32String(payment.transaction_hash.slice(0, 32))
      );

      await tx.wait();
      console.log('✅ Unlock approved by validator');
      console.log('TX Hash:', tx.hash);
    } catch (error) {
      console.error('❌ Approval failed:', error.message);
    }
  }
}

module.exports = StellarMonitor;
```

### Main Relayer

```javascript
// relayer/index.js
const EthereumMonitor = require('../ethereum/ethereum-monitor');
const StellarMonitor = require('../stellar/stellar-monitor');
const { ethers } = require('ethers');
require('dotenv').config();

async function startRelayer() {
  console.log('🌉 Starting Cross-Chain Bridge Relayer\n');

  // Load contract ABI
  const bridgeABI = require('../ethereum/contracts/BridgeLock.json').abi;
  const bridgeAddress = process.env.ETH_BRIDGE_ADDRESS;

  // Initialize Ethereum monitor
  const ethMonitor = new EthereumMonitor(
    bridgeAddress,
    bridgeABI,
    process.env.STELLAR_ISSUER_SECRET
  );

  // Initialize Stellar monitor
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  const validatorWallet = new ethers.Wallet(
    process.env.ETH_VALIDATOR_KEY,
    provider
  );
  const bridgeContract = new ethers.Contract(
    bridgeAddress,
    bridgeABI,
    validatorWallet
  );

  const stellarMonitor = new StellarMonitor(
    process.env.STELLAR_ISSUER_PUBLIC,
    bridgeContract,
    validatorWallet
  );

  // Start both monitors
  await ethMonitor.start();
  await stellarMonitor.start();

  console.log('✅ Relayer running!\n');
}

startRelayer().catch(console.error);
```

---

## User Interface: Bridge Client

### Lock ETH → Mint wETH on Stellar

```javascript
// client/lock-eth.js
const { ethers } = require('ethers');
require('dotenv').config();

async function lockETH(amountInEth, stellarAddress) {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ETH_USER_KEY, provider);

  const bridgeABI = require('../ethereum/contracts/BridgeLock.json').abi;
  const bridge = new ethers.Contract(
    process.env.ETH_BRIDGE_ADDRESS,
    bridgeABI,
    wallet
  );

  console.log('🔒 Locking ETH on Ethereum...');
  console.log('Amount:', amountInEth, 'ETH');
  console.log('Stellar Address:', stellarAddress);

  const tx = await bridge.lock(stellarAddress, {
    value: ethers.parseEther(amountInEth)
  });

  console.log('Transaction sent:', tx.hash);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log('✅ ETH locked!');
  console.log('Block:', receipt.blockNumber);
  console.log('\n⏳ Waiting for wETH to be minted on Stellar...');
  console.log('This may take 10-30 seconds');
}

// Usage
const stellarAddress = process.env.STELLAR_PUBLIC_KEY;
lockETH('0.01', stellarAddress);
```

### Burn wETH → Unlock ETH on Ethereum

```javascript
// client/burn-weth.js
const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

async function burnWETH(amount, ethAddress) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const userKeypair = StellarSdk.Keypair.fromSecret(
    process.env.STELLAR_SECRET_KEY
  );

  const wETH = new StellarSdk.Asset(
    'wETH',
    process.env.STELLAR_ISSUER_PUBLIC
  );

  console.log('🔥 Burning wETH on Stellar...');
  console.log('Amount:', amount, 'wETH');
  console.log('ETH Address:', ethAddress);

  const userAccount = await server.loadAccount(userKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: process.env.STELLAR_ISSUER_PUBLIC, // Burn by sending to issuer
        asset: wETH,
        amount: amount.toString()
      })
    )
    .addMemo(StellarSdk.Memo.text(ethAddress)) // ETH address in memo
    .setTimeout(30)
    .build();

  transaction.sign(userKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ wETH burned!');
  console.log('TX Hash:', result.hash);
  console.log('\n⏳ Waiting for ETH to be unlocked...');
  console.log('Requires', process.env.REQUIRED_APPROVALS, 'validator approvals');
}

// Usage
burnWETH('0.01', '0xYourEthereumAddress');
```

---

## Configuration

### .env File

```bash
# Ethereum
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETH_BRIDGE_ADDRESS=0x...
ETH_PRIVATE_KEY=0x...
ETH_USER_KEY=0x...

# Validators
ETH_VALIDATOR_KEY=0x...
VALIDATOR_1=0x...
VALIDATOR_2=0x...
VALIDATOR_3=0x...
REQUIRED_APPROVALS=2

# Stellar
STELLAR_ISSUER_PUBLIC=GBXXXXX...
STELLAR_ISSUER_SECRET=SBXXXXX...
STELLAR_PUBLIC_KEY=GBXXXXX...
STELLAR_SECRET_KEY=SBXXXXX...
```

---

## Security Considerations

### 1. Validator Security

**Best Practices:**
- Run validators on separate infrastructure
- Use hardware security modules (HSMs)
- Implement rate limiting
- Monitor for unusual activity

### 2. Replay Attack Prevention

```javascript
// Use nonces and unique request IDs
const requestId = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'address', 'uint256', 'uint256'],
    [txHash, recipient, amount, nonce]
  )
);
```

### 3. Amount Verification

```javascript
// Validators must agree on exact amounts
require(request.amount == amount, "Amount mismatch");
```

### 4. Rate Limiting

```solidity
mapping(address => uint256) public lastLockTime;
uint256 public constant LOCK_COOLDOWN = 60; // 1 minute

function lock(string memory stellarAddress) external payable {
    require(
        block.timestamp >= lastLockTime[msg.sender] + LOCK_COOLDOWN,
        "Cooldown not elapsed"
    );
    lastLockTime[msg.sender] = block.timestamp;
    // ... rest of lock logic
}
```

### 5. Maximum Transaction Limits

```solidity
uint256 public constant MAX_LOCK_AMOUNT = 10 ether;

function lock(string memory stellarAddress) external payable {
    require(msg.value <= MAX_LOCK_AMOUNT, "Amount exceeds limit");
    // ... rest of lock logic
}
```

---

## Testing the Bridge

### End-to-End Test

```javascript
// test/e2e-test.js
const { lockETH } = require('../client/lock-eth');
const { burnWETH } = require('../client/burn-weth');
const { ethers } = require('ethers');
const StellarSdk = require('@stellar/stellar-sdk');

async function testBridge() {
  console.log('🧪 Testing Cross-Chain Bridge\n');

  // 1. Lock ETH
  console.log('Step 1: Lock 0.01 ETH on Ethereum');
  await lockETH('0.01', process.env.STELLAR_PUBLIC_KEY);

  // 2. Wait for wETH
  console.log('\nStep 2: Waiting 30s for wETH to appear...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  // 3. Verify wETH balance
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );
  const account = await server.loadAccount(process.env.STELLAR_PUBLIC_KEY);
  const wethBalance = account.balances.find(b => b.asset_code === 'wETH');

  console.log('wETH Balance:', wethBalance?.balance || '0');

  // 4. Burn wETH
  console.log('\nStep 3: Burn 0.01 wETH on Stellar');
  await burnWETH('0.01', process.env.ETH_ADDRESS);

  // 5. Wait for unlock
  console.log('\nStep 4: Waiting for ETH unlock...');
  console.log('Check your Ethereum address for received ETH');

  console.log('\n✅ Bridge test complete!');
}

testBridge();
```

---

## Production Checklist

- [ ] Multi-sig validator network (minimum 3-of-5)
- [ ] Rate limiting on both chains
- [ ] Maximum transaction limits
- [ ] Monitoring and alerting system
- [ ] Emergency pause mechanism
- [ ] Insurance fund for bridge security
- [ ] Regular security audits
- [ ] Disaster recovery procedures
- [ ] Transaction fee optimization
- [ ] Comprehensive logging

---

## Monitoring Dashboard

```javascript
// monitoring/dashboard.js
async function getBridgeStats() {
  // Ethereum side
  const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  const bridge = new ethers.Contract(
    process.env.ETH_BRIDGE_ADDRESS,
    bridgeABI,
    ethProvider
  );

  const ethBalance = await ethProvider.getBalance(process.env.ETH_BRIDGE_ADDRESS);
  const lockNonce = await bridge.lockNonce();

  // Stellar side
  const stellarServer = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );
  const issuer = await stellarServer.loadAccount(
    process.env.STELLAR_ISSUER_PUBLIC
  );

  console.log('📊 Bridge Statistics');
  console.log('===================');
  console.log('ETH Locked:', ethers.formatEther(ethBalance), 'ETH');
  console.log('Total Locks:', lockNonce.toString());
  console.log('wETH Issued:', issuer.balances[0]?.balance || '0');
}

setInterval(getBridgeStats, 60000); // Every minute
```

---

## Key Takeaways

1. **Bridges enable cross-chain asset movement**
2. **Multi-sig validators** provide decentralized security
3. **Event monitoring** is critical for relayers
4. **Security is paramount**: rate limits, max amounts, multi-sig
5. **Test thoroughly** before production
6. **Monitor continuously** with alerting

---

## Congratulations!

You've completed the Stellar deep dive! You now know:

- ✅ Stellar fundamentals and architecture
- ✅ Accounts, keypairs, and cryptography
- ✅ Transactions and operations
- ✅ Custom assets and trustlines
- ✅ DEX and path payments
- ✅ Soroban smart contracts
- ✅ Building production cross-chain bridges

---

## Next Steps

### Build Real Projects

1. **Remittance App**: Cross-border payments with path payments
2. **DEX Aggregator**: Find best prices across Stellar DEX
3. **Stablecoin**: Issue your own asset with compliance
4. **NFT Marketplace**: Using Soroban contracts
5. **DeFi Protocol**: Lending/borrowing on Stellar

### Join the Community

- [Stellar Discord](https://discord.gg/stellar)
- [Stellar Developers Google Group](https://groups.google.com/g/stellar-dev)
- [SDF Twitter](https://twitter.com/StellarOrg)

### Keep Learning

- [Stellar Quest](https://quest.stellar.org/) - Interactive challenges
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Build with Stellar](https://stellar.org/developers)

---

## Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Horizon API Reference](https://developers.stellar.org/api/)
- [Soroban Docs](https://soroban.stellar.org/)
- [Stellar Laboratory](https://laboratory.stellar.org/)
- [Stellar Expert](https://stellar.expert/) - Block explorer

---

**Happy Building! 🚀**
