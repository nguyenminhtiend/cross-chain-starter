# Phase 8: Cross-Chain Bridge (Stellar ↔ Ethereum)

A production-ready cross-chain bridge that allows ETH to move between Ethereum and Stellar networks.

## Overview

This bridge enables users to:
- **Lock ETH on Ethereum** → Receive **wETH on Stellar**
- **Burn wETH on Stellar** → Receive **ETH on Ethereum**

### Architecture

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
1. **Ethereum Lock Contract**: Holds locked ETH
2. **Stellar Wrapped Asset**: wETH represents locked ETH
3. **Relayer Service**: Monitors events and coordinates transfers
4. **Multi-sig Validators**: Approve unlock requests (2-of-3)

---

## Prerequisites

- Node.js 16+
- Ethereum testnet wallet with Sepolia ETH
- Stellar testnet account with XLM
- Infura API key (or other Ethereum RPC provider)

---

## Quick Start

### 1. Install Dependencies

Already installed in the main project. If needed:
```bash
cd stellar-learning
npm install ethers @stellar/stellar-sdk dotenv
```

### 2. Configure Environment

Edit `.env` file in project root:

```bash
# Ethereum Configuration
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETH_BRIDGE_ADDRESS=                    # After deployment
ETH_PRIVATE_KEY=                       # Deployer/admin key
ETH_USER_KEY=                          # User wallet key
ETH_VALIDATOR_KEY=                     # Validator key

# Validators (for multi-sig)
VALIDATOR_1=                           # Validator 1 address
VALIDATOR_2=                           # Validator 2 address
VALIDATOR_3=                           # Validator 3 address
REQUIRED_APPROVALS=2                   # 2-of-3 multi-sig

# Stellar Configuration
STELLAR_ISSUER_PUBLIC=                 # wETH issuer public key
STELLAR_ISSUER_SECRET=                 # wETH issuer secret key
STELLAR_PUBLIC_KEY=                    # Your Stellar public key
STELLAR_SECRET_KEY=                    # Your Stellar secret key
```

### 3. Get Test Tokens

**Ethereum (Sepolia):**
- Visit: https://sepoliafaucet.com
- Get testnet ETH for your wallet

**Stellar (Testnet):**
- Visit: https://laboratory.stellar.org/#account-creator?network=test
- Create and fund account

---

## Deployment Guide

### Step 1: Compile Ethereum Contract

**Option A: Using Hardhat (Recommended)**

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts

# Initialize Hardhat
npx hardhat init

# Copy contract
cp src/phase8-bridge/ethereum/contracts/BridgeLock.sol contracts/

# Compile
npx hardhat compile

# ABI and bytecode will be in: artifacts/contracts/BridgeLock.sol/BridgeLock.json
```

**Option B: Using Remix IDE (Easiest)**

1. Visit: https://remix.ethereum.org
2. Create new file: `BridgeLock.sol`
3. Paste content from `src/phase8-bridge/ethereum/contracts/BridgeLock.sol`
4. Install OpenZeppelin via Remix package manager
5. Compile the contract
6. Deploy directly from Remix or copy ABI/bytecode

### Step 2: Deploy Contract

```bash
cd src/phase8-bridge

# Update deploy-contract.js with ABI and bytecode from compilation
# Then deploy:
node ethereum/deploy-contract.js
```

Save the deployed contract address to `.env`:
```bash
ETH_BRIDGE_ADDRESS=0x...
```

### Step 3: Create Stellar Wrapped Asset

```bash
# Create issuer account first (or use existing)
node stellar/create-wrapped-asset.js
```

This creates the wETH asset. Save the issuer keys to `.env`:
```bash
STELLAR_ISSUER_PUBLIC=GB...
STELLAR_ISSUER_SECRET=SB...
```

### Step 4: Start Relayer Service

```bash
node relayer/index.js
```

The relayer will monitor both chains and handle cross-chain transfers.

---

## Usage

### Lock ETH → Get wETH on Stellar

```bash
cd src/phase8-bridge

# Setup trustline first (one-time)
node client/burn-weth.js trustline

# Lock ETH
node client/lock-eth.js 0.01 GBXXXXX...YOUR_STELLAR_ADDRESS...
```

**Flow:**
1. ETH locked in Ethereum contract
2. Relayer detects Lock event
3. wETH minted on Stellar
4. Check balance: `node client/burn-weth.js balance`

### Burn wETH → Get ETH back

```bash
cd src/phase8-bridge

# Burn wETH
node client/burn-weth.js 0.01 0x...YOUR_ETH_ADDRESS...
```

**Flow:**
1. wETH burned on Stellar (sent to issuer)
2. Relayer detects burn event
3. Validators approve unlock
4. ETH released to your address

---

## Project Structure

```
phase8-bridge/
├── config/
│   └── index.js              # Configuration management
├── ethereum/
│   ├── contracts/
│   │   └── BridgeLock.sol    # Ethereum bridge contract
│   ├── ethereum-monitor.js   # Monitors Lock events
│   └── deploy-contract.js    # Deployment script
├── stellar/
│   ├── create-wrapped-asset.js # Creates wETH asset
│   └── stellar-monitor.js      # Monitors burn events
├── relayer/
│   └── index.js              # Main relayer service
├── client/
│   ├── lock-eth.js           # User: Lock ETH
│   └── burn-weth.js          # User: Burn wETH
└── README.md                 # This file
```

---

## Security Features

### Multi-sig Validation
- 2-of-3 validator approval required for unlocks
- Prevents single point of failure
- Validators run independently

### Rate Limiting
- 10-second cooldown between locks
- Prevents spam attacks
- Configurable per-user limits

### Amount Limits
- Minimum: 0.001 ETH
- Maximum: 10 ETH per transaction
- Protects against large unexpected transfers

### Replay Protection
- Unique request IDs for each unlock
- Prevents double-spending
- Nonce-based tracking

---

## Monitoring & Debugging

### Check Bridge Status

```bash
# Ethereum side
node client/lock-eth.js stats

# Stellar side
node client/burn-weth.js balance
```

### View Transactions

**Ethereum (Sepolia):**
- https://sepolia.etherscan.io/address/YOUR_BRIDGE_ADDRESS

**Stellar (Testnet):**
- https://stellar.expert/explorer/testnet/asset/wETH-ISSUER_ADDRESS

### Relayer Logs

The relayer outputs detailed logs:
- 🔒 Lock events detected
- 💫 wETH mint operations
- 🔥 Burn events detected
- 🔓 Unlock approvals
- ✅ Successful operations
- ❌ Errors and failures

---

## Testing

### End-to-End Test

```bash
# Terminal 1: Start relayer
node relayer/index.js

# Terminal 2: Lock ETH
node client/lock-eth.js 0.01 YOUR_STELLAR_ADDRESS

# Wait 10-30 seconds for wETH to appear

# Check Stellar balance
node client/burn-weth.js balance

# Burn wETH
node client/burn-weth.js 0.01 YOUR_ETH_ADDRESS

# Wait for validators to approve and unlock ETH
```

---

## Troubleshooting

### "Insufficient balance"
- **Ethereum**: Get Sepolia ETH from faucet
- **Stellar**: Fund account at Stellar Laboratory

### "No trustline found"
Run: `node client/burn-weth.js trustline`

### "Cooldown not elapsed"
Wait 10 seconds between lock operations

### "Invalid Stellar address in memo"
Ensure ETH address in memo is valid when burning wETH

### Relayer not processing events
- Check RPC URLs in `.env`
- Verify bridge address is correct
- Ensure validator keys are properly configured

---

## Production Considerations

Before going to mainnet:

- [ ] **Security Audit**: Get contract audited by professionals
- [ ] **Validator Network**: Setup 3-5 independent validators
- [ ] **Monitoring**: Implement 24/7 monitoring and alerting
- [ ] **Insurance Fund**: Set aside funds for emergencies
- [ ] **Rate Limits**: Adjust based on expected volume
- [ ] **Testing**: Extensive testnet testing with real users
- [ ] **Documentation**: Complete API and integration docs
- [ ] **Emergency Pause**: Test pause mechanism
- [ ] **Disaster Recovery**: Document recovery procedures
- [ ] **Legal Review**: Ensure regulatory compliance

---

## Cost Estimates

### Ethereum (Sepolia/Mainnet)
- Contract deployment: ~$50-100 (mainnet)
- Lock transaction: ~$5-15
- Unlock approval: ~$3-10 per validator

### Stellar (Testnet/Mainnet)
- Create trustline: ~$0.0001
- Payment (mint/burn): ~$0.0001
- Extremely low fees

---

## Advanced Features

### Custom Validator Setup

```javascript
// Run your own validator
const { ethers } = require('ethers');
const validatorWallet = new ethers.Wallet(VALIDATOR_KEY, provider);
const bridge = new ethers.Contract(BRIDGE_ADDRESS, ABI, validatorWallet);

// Approve unlocks
await bridge.approveUnlock(requestId, recipient, amount, stellarTxHash);
```

### Batch Operations

Lock multiple amounts or implement batched unlocks to save on gas fees.

---

## Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Bridge Security Best Practices](https://github.com/0xbok/awesome-bridge-security)

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review relayer logs
3. Verify configuration in `.env`
4. Test individual components

---

## License

MIT

---

**Built with Phase 8 of Stellar Learning Path**

Happy bridging! 🌉
