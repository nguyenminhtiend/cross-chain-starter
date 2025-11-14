# ChainSwap: Cross-Chain Token Swap

Bridge and swap tokens across chains in a single transaction. Built as an extension of the cross-chain bridge project with integrated DEX functionality.

## Features

- 🌉 **Cross-Chain Bridge** - Lock tokens on source chain, mint on destination
- 💱 **Automatic Swaps** - Swap minted tokens via Uniswap V2
- 🔒 **Replay Protection** - Nonce-based security
- 📊 **Price Oracles** - Chainlink integration for accurate pricing
- 🛡️ **Slippage Protection** - Configurable tolerance to prevent bad trades
- 🔄 **Fallback Safety** - Receive wrapped tokens if swap fails

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Source Chain (e.g., Ethereum)           │
│                                                              │
│  User locks 100 USDC → BridgeSourceExtended                │
│          ↓                                                   │
│  Emit Lock(targetToken=WETH)                               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                   ┌───────┴────────┐
                   │    Relayer      │
                   │  (Off-chain)    │
                   └───────┬────────┘
                           │
┌──────────────────────────┴────────────────────────────────────┐
│                 Destination Chain (e.g., Arbitrum)           │
│                                                               │
│  1. ChainSwapBridge.mintAndSwap()                           │
│     ↓                                                         │
│  2. Mint 100 wUSDC                                           │
│     ↓                                                         │
│  3. Swap wUSDC → WETH via Uniswap                           │
│     ↓                                                         │
│  4. User receives 0.04 WETH                                  │
└───────────────────────────────────────────────────────────────┘
```

## Project Structure

```
chainswap/
├── contracts/
│   ├── bridges/
│   │   ├── BridgeSourceExtended.sol    # Source chain bridge
│   │   └── ChainSwapBridge.sol          # Destination bridge with swap
│   ├── tokens/
│   │   └── WrappedToken.sol             # Wrapped token contract
│   ├── interfaces/
│   │   ├── IWrappedToken.sol
│   │   ├── IUniswapV2Router02.sol
│   │   └── AggregatorV3Interface.sol
│   └── PriceOracle.sol                  # Chainlink price feeds
├── relayer/
│   └── src/
│       ├── index.js                     # Main relayer service
│       ├── services/
│       │   └── ChainSwapHandler.js      # Event handler with swap logic
│       └── utils/
│           ├── logger.js
│           └── retry.js
├── scripts/
│   ├── deploy/
│   │   ├── 01-deploy-source-chain.js
│   │   ├── 02-deploy-destination-chain.js
│   │   └── 03-configure-chainswap.js
│   └── test/
│       ├── test-bridge.js               # Test regular bridge
│       └── test-swap.js                 # Test bridge + swap
├── test/
│   ├── chainswap.test.js                # Full test suite
│   └── MockUniswapRouter.sol            # Mock for testing
├── hardhat.config.js
└── package.json
```

## Installation

```bash
# Install dependencies
cd chainswap
npm install

# Install relayer dependencies
cd relayer
npm install
cd ..

# Compile contracts
npm run compile
```

## Deployment

### Step 1: Deploy Source Chain Contracts

```bash
# Deploy on source chain (e.g., Ethereum Sepolia)
npx hardhat run scripts/deploy/01-deploy-source-chain.js --network sepolia
```

This deploys:
- Source Token (ERC20)
- BridgeSourceExtended

### Step 2: Deploy Destination Chain Contracts

```bash
# Deploy on destination chain (e.g., Arbitrum Sepolia)
npx hardhat run scripts/deploy/02-deploy-destination-chain.js --network arbitrumSepolia
```

This deploys:
- Wrapped Token
- ChainSwapBridge (with Uniswap integration)
- PriceOracle

### Step 3: Configure ChainSwap

```bash
# Configure the system and generate relayer .env
npx hardhat run scripts/deploy/03-configure-chainswap.js
```

This creates:
- `relayer/.env` with all contract addresses
- `deployments/chainswap-config.json` with full configuration

### Step 4: Start Relayer

```bash
cd relayer
npm start
```

The relayer will:
- Listen for Lock events on source chain
- Wait for block finality (configurable confirmations)
- Execute mint or mintAndSwap on destination
- Handle retries and failures gracefully

## Usage

### Regular Bridge (No Swap)

Lock tokens and receive wrapped tokens on destination:

```bash
node scripts/test/test-bridge.js
```

Or using ethers.js:

```javascript
const { ethers } = require("ethers");

// Approve bridge
await sourceToken.approve(bridgeAddress, amount);

// Lock tokens (targetToken = zero address means no swap)
await bridge.lock(
  recipientAddress,
  amount,
  ethers.constants.AddressZero,  // No swap
  2  // Target chain ID
);
```

### Bridge + Swap

Lock tokens and receive different token on destination:

```bash
# Set target token in .env
export TARGET_TOKEN_ADDRESS=0x... # WETH, USDC, etc.

# Run test
node scripts/test/test-swap.js
```

Or using ethers.js:

```javascript
// Lock tokens with target token for swap
await bridge.lock(
  recipientAddress,
  amount,
  targetTokenAddress,  // e.g., WETH address
  2  // Target chain ID
);
```

The relayer automatically:
1. Mints wrapped tokens
2. Calculates expected swap output
3. Applies slippage protection
4. Executes swap on Uniswap
5. Sends target token to recipient

### Burn and Bridge Back

Bridge tokens back to source chain:

```javascript
// Approve bridge to spend wrapped tokens
await wrappedToken.approve(bridgeAddress, amount);

// Burn wrapped tokens
await chainSwapBridge.burn(
  amount,
  recipientAddress,  // Address on source chain
  1  // Source chain ID
);
```

## Configuration

### Relayer Configuration

Edit `relayer/.env`:

```env
# Required confirmations before processing (security vs. speed)
REQUIRED_CONFIRMATIONS=12

# Slippage tolerance in basis points (100 = 1%)
SLIPPAGE_TOLERANCE=100

# RPC endpoints
SOURCE_CHAIN_RPC=https://eth-sepolia.g.alchemy.com/v2/...
DEST_CHAIN_RPC=https://arbitrum-sepolia.g.alchemy.com/v2/...

# Contract addresses (auto-generated by deployment scripts)
SOURCE_BRIDGE_ADDRESS=0x...
DEST_BRIDGE_ADDRESS=0x...
```

### Bridge Configuration

Update slippage tolerance (only owner):

```javascript
await chainSwapBridge.setSlippageTolerance(200); // 2%
```

### Price Oracles

Set Chainlink price feeds (only owner):

```javascript
await priceOracle.setPriceFeed(
  tokenAddress,
  chainlinkFeedAddress
);
```

## Testing

### Run Full Test Suite

```bash
npm test
```

Tests include:
- Basic bridge functionality (lock/mint)
- Bridge with swap
- Replay attack prevention
- Slippage protection
- Burn and unlock
- Swap failure fallbacks

### Test on Local Network

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy:source
npm run deploy:dest
npm run deploy:configure

# Terminal 3: Start relayer
cd relayer && npm start

# Terminal 4: Run tests
node scripts/test/test-bridge.js
node scripts/test/test-swap.js
```

## Security Features

### Replay Protection
- Nonce-based tracking
- Events processed only once
- Duplicate detection

### Slippage Protection
- Minimum output amount enforcement
- Configurable tolerance (max 10%)
- Price impact warnings

### Block Finality
- Configurable confirmation requirements
- Prevents chain reorganization attacks

### Swap Fallbacks
- Try-catch on swap execution
- Wrapped tokens sent if swap fails
- User never loses funds

### Access Control
- Owner-only mint/mintAndSwap
- Relayer-only bridge operations
- Upgradeable configurations

## Extending ChainSwap

### Add Multi-Hop Swaps

Modify swap path in `ChainSwapBridge.sol`:

```solidity
address[] memory path = new address[](3);
path[0] = address(wrappedToken);
path[1] = intermediateToken;  // e.g., WETH
path[2] = targetToken;         // e.g., LINK
```

### Integrate Multiple DEXes

Add DEX aggregator (1inch, ParaSwap):

```solidity
interface IDEXAggregator {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapData
    ) external returns (uint256 amountOut);
}
```

### Add Fee Collection

Implement fees in `mintAndSwap`:

```solidity
uint256 fee = amount * feeRate / 10000;
uint256 amountAfterFee = amount - fee;
// Proceed with amountAfterFee for swap
```

### Support Gas Tokens

Allow paying gas on destination with bridged tokens:

```solidity
function mintAndSwapWithGas(
    address to,
    uint256 amount,
    uint256 sourceNonce,
    bytes memory signature,
    address targetToken,
    uint256 minAmountOut,
    uint256 gasAmount  // Amount to swap for gas token
) external onlyOwner {
    // Mint and swap logic
    // Reserve gasAmount for gas payment
    // Swap remaining for targetToken
}
```

## Comparison with Basic Bridge

| Feature | Basic Bridge | ChainSwap |
|---------|-------------|-----------|
| Lock/Mint | ✅ | ✅ |
| Burn/Unlock | ✅ | ✅ |
| Wrapped tokens | ✅ | ✅ |
| DEX integration | ❌ | ✅ |
| Auto swaps | ❌ | ✅ |
| Price oracles | ❌ | ✅ |
| Slippage protection | ❌ | ✅ |
| Target token selection | ❌ | ✅ |

## Troubleshooting

### Swap Fails: Insufficient Liquidity

**Error:** `UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT`

**Solution:** Check liquidity pool exists and has sufficient reserves

```javascript
const pair = await uniswapFactory.getPair(tokenA, tokenB);
console.log(`Pair address: ${pair}`);
```

### Swap Fails: High Slippage

**Error:** `UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT`

**Solution:** Increase slippage tolerance or wait for better price

```javascript
await chainSwapBridge.setSlippageTolerance(300); // 3%
```

### Event Not Processed

**Check:**
1. Relayer is running: `cd relayer && npm start`
2. Block confirmations met: Check `REQUIRED_CONFIRMATIONS`
3. Gas available: Fund relayer account on destination
4. Not already processed: Check `isProcessed(nonce)`

### Gas Estimation Failed

**Solution:** Increase gas limit manually

```javascript
await chainSwapBridge.mintAndSwap(..., {
  gasLimit: 500000
});
```

## Resources

- [Uniswap V2 Docs](https://docs.uniswap.org/contracts/v2/overview)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)

## License

MIT

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review test cases for examples

---

**Built with ❤️ extending the cross-chain bridge project**

