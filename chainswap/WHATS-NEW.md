# What's New in ChainSwap

This document highlights the key differences and additions compared to your existing cross-chain bridge.

## Overview

ChainSwap **extends** your bridge by adding DEX integration. It's 90% the same architecture with these additions:

## New Features

### 1. Extended Lock Event

**Before (Basic Bridge):**
```solidity
event Lock(
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 timestamp,
    uint256 indexed nonce
);
```

**After (ChainSwap):**
```solidity
event Lock(
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 timestamp,
    uint256 indexed nonce,
    address targetToken,    // NEW: What to swap to
    uint256 targetChain     // NEW: Target chain ID
);
```

### 2. Mint and Swap

**New Function in ChainSwapBridge:**
```solidity
function mintAndSwap(
    address to,
    uint256 amount,
    uint256 sourceNonce,
    bytes memory signature,
    address targetToken,      // NEW
    uint256 minAmountOut      // NEW: Slippage protection
) external onlyOwner
```

This:
1. Mints wrapped tokens to the bridge
2. Swaps them on Uniswap for targetToken
3. Sends targetToken to recipient
4. Falls back to wrapped tokens if swap fails

### 3. Uniswap V2 Integration

**New Interface:**
- `IUniswapV2Router02` for swaps
- `getAmountsOut` for price estimation
- Multi-hop swap support (easily extendable)

### 4. Price Oracle

**New Contract: PriceOracle.sol**
- Chainlink integration
- Price validation (staleness checks)
- USD-denominated pricing
- Slippage calculation helper

### 5. Enhanced Relayer

**ChainSwapHandler extends basic bridge handler:**
- Detects swap requirements from events
- Queries Uniswap for expected output
- Calculates slippage protection
- Handles both mint and mintAndSwap calls
- Automatic fallback on swap failure

## Reused Components

These work exactly the same as your existing bridge:

✅ Lock/unlock mechanism
✅ Mint/burn mechanism
✅ Nonce-based replay protection
✅ Signature verification
✅ Event-driven architecture
✅ Relayer pattern
✅ State management

## Code Comparison

### Basic Bridge Flow
```
User calls lock()
  → Bridge locks tokens
  → Emit Lock event
  → Relayer listens
  → Relayer calls mint()
  → User receives wrapped tokens
```

### ChainSwap Flow
```
User calls lock(targetToken)
  → Bridge locks tokens
  → Emit Lock event with targetToken
  → Relayer listens
  → Relayer detects targetToken
  → Relayer calls mintAndSwap()
    → Bridge mints wrapped tokens
    → Bridge swaps for targetToken
    → User receives targetToken
```

## New Dependencies

```json
{
  "@uniswap/v2-periphery": "^1.1.0-beta.0",
  "@uniswap/v2-core": "^1.0.1",
  "@chainlink/contracts": "^0.8.0"
}
```

## Files Added

```
chainswap/
├── contracts/
│   ├── bridges/
│   │   ├── BridgeSourceExtended.sol     ✨ NEW
│   │   └── ChainSwapBridge.sol          ✨ NEW (vs basic BridgeDestination)
│   ├── interfaces/
│   │   ├── IUniswapV2Router02.sol       ✨ NEW
│   │   └── AggregatorV3Interface.sol    ✨ NEW
│   └── PriceOracle.sol                  ✨ NEW
├── relayer/
│   └── src/
│       └── services/
│           └── ChainSwapHandler.js       ✨ NEW (extends basic handler)
└── test/
    ├── chainswap.test.js                ✨ NEW
    └── MockUniswapRouter.sol            ✨ NEW
```

## Key Differences by Component

### Smart Contracts

| Component | Basic Bridge | ChainSwap |
|-----------|-------------|-----------|
| Lock function params | 2 (to, amount) | 4 (to, amount, targetToken, targetChain) |
| Destination functions | mint, burn | mint, mintAndSwap, burn |
| External integrations | None | Uniswap, Chainlink |
| Fallback logic | N/A | Swap fails → send wrapped tokens |

### Relayer

| Feature | Basic Bridge | ChainSwap |
|---------|-------------|-----------|
| Event parsing | Basic params | Parse targetToken |
| Swap detection | N/A | Check if targetToken != 0 |
| Price calculation | N/A | Query Uniswap |
| Slippage handling | N/A | Apply tolerance |
| Fallback handling | N/A | Detect SwapFailed events |

### Tests

| Test Type | Basic Bridge | ChainSwap |
|-----------|-------------|-----------|
| Lock/mint | ✅ | ✅ |
| Replay protection | ✅ | ✅ |
| Swap execution | ❌ | ✅ |
| Slippage protection | ❌ | ✅ |
| Swap failure fallback | ❌ | ✅ |

## Learning Path

If you understand your existing bridge, you need to learn:

1. **Uniswap V2 Router** (1 day)
   - `swapExactTokensForTokens`
   - `getAmountsOut`
   - Swap paths

2. **Chainlink Price Feeds** (1 day)
   - `latestRoundData`
   - Price validation
   - Staleness checks

3. **Slippage Calculation** (2 hours)
   - Expected output
   - Minimum output
   - Basis points

That's it! The rest is your bridge code.

## Gas Costs

| Operation | Basic Bridge | ChainSwap |
|-----------|--------------|-----------|
| Lock | ~50k gas | ~55k gas (+10% for extra params) |
| Mint | ~80k gas | ~80k gas (same) |
| MintAndSwap | N/A | ~250k gas (mint + Uniswap swap) |

## Security Considerations

**Same as Basic Bridge:**
- ✅ Replay protection
- ✅ Signature verification
- ✅ Access control
- ✅ Reentrancy guards

**New in ChainSwap:**
- ✅ Slippage protection (prevent sandwich attacks)
- ✅ Swap fallback (prevent fund loss if swap fails)
- ✅ Price staleness checks (prevent using old prices)
- ✅ Maximum slippage cap (10% hard limit)

## Usage Example

**Basic Bridge:**
```javascript
// User locks 100 USDC
await bridge.lock(recipient, parseEther("100"));

// Relayer mints 100 wUSDC
await bridge.mint(recipient, parseEther("100"), nonce, sig);

// User has: 100 wUSDC
```

**ChainSwap:**
```javascript
// User locks 100 USDC, wants ETH
await bridge.lock(recipient, parseEther("100"), WETH_ADDRESS, 2);

// Relayer mints and swaps
await bridge.mintAndSwap(
  recipient,
  parseEther("100"),
  nonce,
  sig,
  WETH_ADDRESS,
  minOut  // Slippage-protected
);

// User has: 0.042 ETH (not wUSDC!)
```

## When to Use Each

**Use Basic Bridge when:**
- You just want to move tokens across chains
- You'll manually swap later
- Lower gas costs preferred
- Simpler architecture

**Use ChainSwap when:**
- You want specific token on destination
- One-transaction UX is important
- Willing to pay extra gas for convenience
- Need liquidity in different token

## Migration Path

If you have an existing bridge and want to add ChainSwap:

1. Deploy ChainSwapBridge on destination (doesn't affect existing bridge)
2. Keep existing BridgeSource on source, or deploy BridgeSourceExtended
3. Update relayer to handle both contract types
4. Users can choose which bridge to use

**They're compatible!** Old bridge keeps working.

## Summary

ChainSwap = Your Bridge + 3 New Concepts:
1. **DEX Integration** (Uniswap)
2. **Price Oracles** (Chainlink)
3. **Slippage Protection** (min output amounts)

Everything else (90% of the code) is identical to your existing bridge.

---

**You already know how to build cross-chain bridges. ChainSwap just adds DEX swaps on top! 🚀**

