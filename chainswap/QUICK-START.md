# ChainSwap Quick Start

Get ChainSwap running in 5 minutes.

## Prerequisites

- Node.js v16+
- npm or yarn
- Two blockchain networks (testnets or local forks)
- Wallet with gas tokens on both chains

## 1. Install Dependencies

```bash
cd chainswap
npm install
cd relayer && npm install && cd ..
```

## 2. Configure Networks

Edit `hardhat.config.js` and add your RPC URLs:

```javascript
networks: {
  sepolia: {
    url: "YOUR_SEPOLIA_RPC",
    accounts: ["YOUR_PRIVATE_KEY"]
  },
  arbitrumSepolia: {
    url: "YOUR_ARBITRUM_RPC",
    accounts: ["YOUR_PRIVATE_KEY"]
  }
}
```

## 3. Deploy Contracts

```bash
# Deploy on source chain
npx hardhat run scripts/deploy/01-deploy-source-chain.js --network sepolia

# Deploy on destination chain
npx hardhat run scripts/deploy/02-deploy-destination-chain.js --network arbitrumSepolia

# Configure system
npx hardhat run scripts/deploy/03-configure-chainswap.js
```

## 4. Configure Relayer

Edit `relayer/.env` (auto-generated from step 3):

```env
RELAYER_PRIVATE_KEY=your_private_key_here
SOURCE_CHAIN_RPC=https://eth-sepolia...
DEST_CHAIN_RPC=https://arbitrum-sepolia...
# Contract addresses auto-filled
```

**Important:** Fund your relayer account with gas on the destination chain!

## 5. Start Relayer

```bash
cd relayer
npm start
```

You should see:
```
[INFO]: Source Chain ID: 11155111
[INFO]: Destination Chain ID: 421614
[INFO]: Relayer Address: 0x...
[INFO]: ✓ Relayer initialized successfully
[INFO]: ✓ Relayer is now listening for events
```

## 6. Test Bridge

In a new terminal:

```bash
# Test regular bridge (no swap)
node scripts/test/test-bridge.js
```

Expected output:
```
Token Balance: 10000.0 SRC
Locking 10.0 SRC...
✓ Approved
✓ Locked in block 12345
Lock Event:
  From: 0x...
  Amount: 10.0 SRC
  Nonce: 0
```

Check relayer logs:
```
[INFO]: Processing Lock Event
[INFO]: Nonce: 0
[INFO]: Amount: 10.0
[INFO]: Executing mint (no swap)...
[INFO]: Mint tx confirmed in block 67890
[INFO]: ✓ Event processed successfully
```

## 7. Test Bridge + Swap

```bash
# Set target token (e.g., WETH on destination chain)
export TARGET_TOKEN_ADDRESS=0x... # WETH address

# Test bridge with swap
node scripts/test/test-swap.js
```

Expected output:
```
Target Token for Swap: 0x...
Locking 10.0 SRC for swap...
✓ Locked in block 12346
Lock Event:
  Target Token: 0x... (WETH)
```

Relayer logs:
```
[INFO]: Processing Lock Event
[INFO]: Executing mint and swap...
[INFO]: Expected output: 0.0042 ETH
[INFO]: Min output (1% slippage): 0.00416 ETH
[INFO]: MintAndSwap tx confirmed in block 67891
[INFO]: Actual output: 0.0041 ETH
[INFO]: ✓ Event processed successfully
```

## Common Issues

### "Insufficient funds"
Fund your accounts:
- User account on source chain (for locking tokens)
- Relayer account on destination chain (for gas)

### "Price feed not found"
Add Chainlink price feeds to PriceOracle:
```javascript
await priceOracle.setPriceFeed(tokenAddress, feedAddress);
```

### "No liquidity pool"
Ensure Uniswap pool exists for the token pair. Create one if needed or use different tokens.

### "Already processed"
Normal - means event was already handled. Check destination chain to verify tokens were minted.

## Next Steps

1. ✅ Bridge is working!
2. Add more tokens to swap between
3. Configure price oracles for better swap calculations
4. Adjust slippage tolerance: `chainSwapBridge.setSlippageTolerance(200)` (2%)
5. Deploy to mainnet (carefully!)

## Architecture Summary

```
Source Chain          Relayer           Destination Chain
     │                   │                      │
Lock │────────────────>│ Listen                │
     │                   │                      │
     │                   │─────────────────>Mint & Swap
     │                   │                      │
     │                   │<─────────────────Receipt
     │                   │                      │
     │                   │ ✓ Done               │
```

## Useful Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Check relayer status
cd relayer && npm start

# Deploy to specific network
npx hardhat run scripts/deploy/01-deploy-source-chain.js --network sepolia

# Verify contract on Etherscan
npx hardhat verify --network sepolia CONTRACT_ADDRESS CONSTRUCTOR_ARGS
```

## Support

- 📖 Full docs: [README.md](./README.md)
- 🧪 Test examples: `test/chainswap.test.js`
- 🔧 Scripts: `scripts/test/`

Happy bridging! 🌉✨

