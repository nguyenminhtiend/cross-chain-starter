# ChainSwap - Navigation Guide

Welcome to ChainSwap! This file helps you navigate the project.

## 🚀 Getting Started

**New to ChainSwap?** Start here:

1. 📖 **[README.md](./README.md)** - Complete documentation
   - Architecture overview
   - Features and security
   - Full API reference
   - Troubleshooting

2. ⚡ **[QUICK-START.md](./QUICK-START.md)** - Get running in 5 minutes
   - Installation steps
   - Deployment commands
   - Testing instructions
   - Common issues

3. 🆕 **[WHATS-NEW.md](./WHATS-NEW.md)** - What's different from basic bridge
   - Feature comparison
   - Code differences
   - Learning path
   - When to use each

4. 📊 **[PROJECT-SUMMARY.md](./PROJECT-SUMMARY.md)** - Build summary
   - Project structure
   - Technologies used
   - What was implemented
   - Statistics

## 📂 Project Structure

### Smart Contracts
```
contracts/
├── bridges/
│   ├── BridgeSourceExtended.sol    ← Lock tokens on source chain
│   └── ChainSwapBridge.sol          ← Mint & swap on destination
├── tokens/
│   └── WrappedToken.sol             ← Wrapped token (mintable/burnable)
├── interfaces/
│   ├── IWrappedToken.sol
│   ├── IUniswapV2Router02.sol      ← Uniswap interface
│   └── AggregatorV3Interface.sol   ← Chainlink interface
└── PriceOracle.sol                  ← Price feeds
```

### Relayer Service
```
relayer/
└── src/
    ├── index.js                     ← Main entry point
    ├── services/
    │   └── ChainSwapHandler.js      ← Event handler
    └── utils/
        ├── logger.js                ← Winston logging
        └── retry.js                 ← Retry logic
```

### Deployment & Testing
```
scripts/
├── deploy/
│   ├── 01-deploy-source-chain.js   ← Step 1
│   ├── 02-deploy-destination-chain.js ← Step 2
│   └── 03-configure-chainswap.js   ← Step 3
└── test/
    ├── test-bridge.js               ← Test regular bridge
    └── test-swap.js                 ← Test with swap

test/
├── chainswap.test.js                ← Hardhat tests
└── MockUniswapRouter.sol            ← Mock for testing
```

## 🎯 Quick Actions

### Installation
```bash
npm install
cd relayer && npm install && cd ..
```

### Compile
```bash
npm run compile
```

### Test
```bash
npm test
```

### Deploy
```bash
# Source chain
npx hardhat run scripts/deploy/01-deploy-source-chain.js --network sepolia

# Destination chain
npx hardhat run scripts/deploy/02-deploy-destination-chain.js --network arbitrumSepolia

# Configure
npx hardhat run scripts/deploy/03-configure-chainswap.js
```

### Run Relayer
```bash
cd relayer
npm start
```

### Test Bridge
```bash
node scripts/test/test-bridge.js      # Regular bridge
node scripts/test/test-swap.js        # Bridge + swap
```

## 📚 Documentation by Use Case

### I want to...

**...understand how ChainSwap works**
→ Read [README.md](./README.md) Architecture section

**...deploy ChainSwap**
→ Follow [QUICK-START.md](./QUICK-START.md)

**...understand what's new vs basic bridge**
→ Read [WHATS-NEW.md](./WHATS-NEW.md)

**...see what was built**
→ Check [PROJECT-SUMMARY.md](./PROJECT-SUMMARY.md)

**...test on local network**
→ See [QUICK-START.md](./QUICK-START.md) "Test on Local Network"

**...add new features**
→ See [README.md](./README.md) "Extending ChainSwap"

**...understand the code**
→ Start with `contracts/bridges/ChainSwapBridge.sol`
→ Then `relayer/src/services/ChainSwapHandler.js`

**...troubleshoot issues**
→ See [README.md](./README.md) "Troubleshooting"
→ Or [QUICK-START.md](./QUICK-START.md) "Common Issues"

## 🔍 Key Files

| File | Description | When to Read |
|------|-------------|--------------|
| `BridgeSourceExtended.sol` | Source chain bridge | Understand locking |
| `ChainSwapBridge.sol` | Destination bridge | Understand swaps |
| `ChainSwapHandler.js` | Relayer logic | Understand event processing |
| `PriceOracle.sol` | Chainlink integration | Understand pricing |
| `chainswap.test.js` | Test suite | See usage examples |

## 🎓 Learning Path

1. **Day 1: Setup**
   - Read QUICK-START.md
   - Install dependencies
   - Compile contracts
   - Run tests

2. **Day 2: Deployment**
   - Deploy to testnet
   - Configure relayer
   - Test bridge

3. **Day 3: Understanding**
   - Read README.md thoroughly
   - Understand smart contracts
   - Understand relayer logic

4. **Week 2: Customization**
   - Add custom features
   - Integrate other DEXes
   - Deploy to mainnet

## 🔗 External Resources

- [Uniswap V2 Docs](https://docs.uniswap.org/contracts/v2/overview)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js v5 Docs](https://docs.ethers.io/v5/)

## 🤝 Support

**Need help?**
- Check the [Troubleshooting section](./README.md#troubleshooting) in README
- Review [Common Issues](./QUICK-START.md#common-issues) in QUICK-START
- Check the test files for code examples
- Review the guide that inspired this: `../docs/01-CHAINSWAP-GUIDE.md`

## 📊 Project Stats

- **Smart Contracts**: 7 files, ~1,200 LOC
- **Relayer**: 5 files, ~600 LOC
- **Tests**: 2 files, ~400 LOC
- **Scripts**: 5 files, ~300 LOC
- **Documentation**: 5 files, ~1,500 lines

**Total**: 24 files, ~4,000 lines

## ✅ Checklist

Before deploying to mainnet:

- [ ] All tests passing
- [ ] Contracts audited (recommended)
- [ ] Relayer tested on testnet
- [ ] Gas costs acceptable
- [ ] Slippage tolerance configured
- [ ] Price oracles set up
- [ ] Backup relayer ready
- [ ] Monitoring in place
- [ ] Emergency pause mechanism tested
- [ ] Documentation updated

## 🎉 You're Ready!

Pick your next step:
- 🏃 **Quick start**: [QUICK-START.md](./QUICK-START.md)
- 📖 **Learn more**: [README.md](./README.md)
- 🆕 **See what's new**: [WHATS-NEW.md](./WHATS-NEW.md)
- 📊 **View summary**: [PROJECT-SUMMARY.md](./PROJECT-SUMMARY.md)

Happy bridging! 🌉✨

