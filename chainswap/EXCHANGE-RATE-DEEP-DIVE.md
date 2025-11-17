# ChainSwap Exchange Rate Deep Dive

**A comprehensive guide to understanding how exchange rates work in cross-chain token swaps**

---

## Table of Contents

1. [Exchange Rate Configuration](#exchange-rate-configuration)
2. [Two-Tier Rate System](#two-tier-rate-system)
3. [Complete Flow with Real Data](#complete-flow-with-real-data)
4. [Two-Chain Architecture](#two-chain-architecture)
5. [Uniswap Pool Mechanics](#uniswap-pool-mechanics)
6. [Reverse Journey (Bridging Back)](#reverse-journey-bridging-back)
7. [ChainSwap vs Basic Bridge](#chainswap-vs-basic-bridge)
8. [Key Takeaways](#key-takeaways)

---

## Exchange Rate Configuration

### 📍 Where Exchange Rates Are Configured

Exchange rates are pulled from **two main sources**:

#### 1. **Chainlink Price Feeds** (Reference/Monitoring)
```solidity
// contracts/PriceOracle.sol:28-34
function setPriceFeed(address token, address feed) external onlyOwner {
    priceFeeds[token] = AggregatorV3Interface(feed);
}
```

**Configuration:**
- Location: `PriceOracle.sol` line 28
- Purpose: Set Chainlink oracle addresses for each token
- Usage: Reference prices, validation, monitoring
- Update frequency: ~1 hour
- Deployed on: **Destination chain only**

**Real Example:**
```javascript
Token: USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
Chainlink Feed: 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6
├─ Price: $1.00 (8 decimals → 100000000)
├─ Updated: Every ~1 hour
└─ Staleness Check: Must be < 1 hour old
```

#### 2. **Uniswap Pool Reserves** (Actual Execution)
```solidity
// contracts/bridges/ChainSwapBridge.sol:210-221
function getExpectedOutput(
    uint256 amountIn,
    address tokenIn,
    address tokenOut
) external view returns (uint256) {
    address[] memory path = new address[](2);
    path[0] = tokenIn;
    path[1] = tokenOut;

    // Queries Uniswap Router for real-time pool data
    uint256[] memory amounts = uniswapRouter.getAmountsOut(amountIn, path);
    return amounts[1];
}
```

**Configuration:**
- Location: `ChainSwapBridge.sol` line 219
- Purpose: Get real-time exchange rates from live pools
- Usage: **Actual swap execution** (primary source)
- Update frequency: Every swap (real-time)
- Deployed on: **Destination chain only**

---

## Two-Tier Rate System

### 🔑 Critical Understanding

ChainSwap uses **two different rate sources** for different purposes:

| Source | Purpose | Location | Frequency | Usage |
|--------|---------|----------|-----------|-------|
| **Chainlink** | Reference/Validation | PriceOracle.sol | ~1 hour | Monitoring, optional validation |
| **Uniswap Pools** | Actual Swaps | ChainSwapBridge.sol | Real-time | **Primary rate for swaps** |

### Why Two Sources?

```
Chainlink (Reference):
├─ Pros: Reliable, decentralized, hard to manipulate
├─ Cons: Updates slowly (~1 hour), not used for actual swaps
└─ Use: Monitoring, safety checks, price validation

Uniswap Pools (Execution):
├─ Pros: Real-time, reflects actual market, executable
├─ Cons: Can be manipulated in small pools
└─ Use: ACTUAL SWAP EXECUTION ✅
```

**Important:** The actual exchange rate used for swaps comes from **Uniswap's live pool data**, NOT Chainlink!

---

## Complete Flow with Real Data

### 🌉 Phase-by-Phase Breakdown

#### **Phase 1: Initial Setup**

```javascript
// Deployment: scripts/deploy/02-deploy-destination-chain.js:58-62
PriceOracle deployed → 0xABC...123

// Configuration: setPriceFeed() calls
setPriceFeed(USDC, CHAINLINK_USDC_USD_FEED)
setPriceFeed(DAI, CHAINLINK_DAI_USD_FEED)

// Relayer config: relayer/.env
PRICE_ORACLE_ADDRESS=0xABC...123
SLIPPAGE_TOLERANCE=100  # 1%
UNISWAP_ROUTER=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
```

#### **Phase 2: User Initiates Swap**

```
User on Ethereum: Bridge 100 USDC to Arbitrum, swap to DAI

Lock Event:
{
  from: "0xUser...",
  amount: "100000000", // 100 USDC
  targetToken: "0xDAI_ON_ARBITRUM",
  targetChain: 42161,
  nonce: 42
}
```

#### **Phase 3: Relayer Pulls Exchange Rate**

```javascript
// relayer/src/services/ChainSwapHandler.js:127-128
const expectedOut = await this.getExpectedOutput(amount, targetToken);

// This calls: ChainSwapBridge.getExpectedOutput()
// Which queries Uniswap pool on Arbitrum:

Pool: wUSDC/DAI on Arbitrum
├─ Reserve0 (wUSDC): 1,000,000
├─ Reserve1 (DAI):   1,002,000
│
├─ Formula: out = (in × reserve1) / (reserve0 + in)
├─         = (100 × 1,002,000) / (1,000,000 + 100)
└─         = 100.0998 DAI

Expected Output: 100.0998 DAI
```

#### **Phase 4: Apply Slippage Protection**

```javascript
// relayer/src/services/ChainSwapHandler.js:131-133
const expectedOut = 100.0998 DAI
const slippageBps = 100 // 1%

minOut = expectedOut × (10000 - 100) / 10000
       = 100.0998 × 0.99
       = 99.0988 DAI

Protection: Will accept anything ≥ 99.0988 DAI
```

#### **Phase 5: Execute Mint & Swap**

```solidity
// contracts/bridges/ChainSwapBridge.sol:106-146
function mintAndSwap(...) {
    // 1. Mint wrapped tokens
    wrappedToken.mint(address(this), 100000000);

    // 2. Approve Uniswap
    wrappedUSDC.approve(uniswapRouter, 100000000);

    // 3. Execute swap
    amounts = uniswapRouter.swapExactTokensForTokens(
        amountIn:  100 wUSDC,
        amountOutMin: 99.0988 DAI,
        path: [wUSDC, DAI],
        to: "0xUser...",
        deadline: now + 300
    );

    // Actual result: 100.10 DAI ✅ (> minimum)
}
```

### 📊 Final Result

```
User's Journey:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source Chain (Ethereum):
  Locked: 100 USDC

↓ Cross-chain bridge ↓

Destination Chain (Arbitrum):
  Minted:   100 wrapped USDC
  Expected: 100.0998 DAI (from Uniswap.getAmountsOut)
  Minimum:  99.0988 DAI (1% slippage protection)
  Received: 100.10 DAI ✅

Status: SUCCESS ✅
```

---

## Two-Chain Architecture

### 🔑 **CRITICAL:** Pools Exist ONLY on Destination Chain

```
┌─────────────────────────────────────────────────────────────┐
│              SOURCE CHAIN (Ethereum)                        │
│                                                             │
│  ┌──────────────┐    ┌─────────────────────────┐          │
│  │ Source Token │◄───│ BridgeSourceExtended    │          │
│  │   (SRC)      │    │ - No Uniswap Pool       │          │
│  └──────────────┘    │ - No Price Oracle       │          │
│                      │ - Only locks tokens     │          │
│                      └─────────────────────────┘          │
│                                                             │
│  ❌ NO EXCHANGE RATES                                       │
│  ❌ NO POOLS                                                │
│  ✅ JUST LOCKS TOKENS                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Relayer transmits
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           DESTINATION CHAIN (Arbitrum)                      │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────────┐            │
│  │ Wrapped Token   │◄─│ ChainSwapBridge      │            │
│  │  (wSRC)         │  │ - Has Uniswap Router │            │
│  └─────────────────┘  │ - Has Price Oracle   │            │
│           │            └──────────────────────┘            │
│           ▼                                                 │
│  ┌─────────────────────────────────────────┐              │
│  │   Uniswap V2 Router (Arbitrum)          │              │
│  │                                         │              │
│  │  Pool: wSRC/DAI                         │              │
│  │  ├─ Reserve0: 1,000,000 wSRC            │              │
│  │  └─ Reserve1: 1,002,000 DAI             │              │
│  │                                         │              │
│  │  Pool: wSRC/USDC                        │              │
│  │  Pool: wSRC/WETH                        │              │
│  └─────────────────────────────────────────┘              │
│                                                             │
│  ✅ ALL EXCHANGE RATES HERE                                 │
│  ✅ ALL POOLS HERE                                          │
│  ✅ SWAPS HAPPEN HERE                                       │
└─────────────────────────────────────────────────────────────┘
```

### Asymmetric Design

| Feature | Source Chain | Destination Chain |
|---------|--------------|-------------------|
| **Uniswap Pool** | ❌ NO | ✅ YES |
| **Price Oracle** | ❌ NO | ✅ YES |
| **Exchange Rates** | ❌ N/A | ✅ Multiple pools |
| **Swap Capability** | ❌ NO | ✅ YES |
| **Gas Cost** | ~55k (lock only) | ~250k (mint+swap) |

### Why Different Rates Between Chains?

```
Same token pair, DIFFERENT pools, DIFFERENT rates:

Ethereum Mainnet:
  └─ USDC/DAI pool: 5M USDC / 5.01M DAI
  └─ Rate: 1 USDC = 1.002 DAI

Arbitrum:
  └─ wUSDC/DAI pool: 1M wUSDC / 1.002M DAI
  └─ Rate: 1 wUSDC = 1.000998 DAI

Difference: 0.001002 DAI (~0.1%)

Reasons:
├─ Different liquidity pools (separate contracts)
├─ Different supply/demand on each chain
├─ Arbitrage delays (12+ min bridge time)
└─ Different trading volumes
```

**Important:** ChainSwap uses **destination chain rate only** (what the user receives)!

---

## Uniswap Pool Mechanics

### ❌ Common Misconception

**WRONG:** "Reserve0 + Reserve1 = Constant"
**CORRECT:** "Reserve0 × Reserve1 = Constant (K)"

### Constant Product Formula

```
Uniswap V2 Invariant:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Reserve0 × Reserve1 = K (constant)
❌ Reserve0 + Reserve1 ≠ constant

Formula:
amountOut = (amountIn × Reserve1) / (Reserve0 + amountIn)

After swap:
Reserve0_new = Reserve0 + amountIn
Reserve1_new = Reserve1 - amountOut
K_new ≈ K_old (with 0.3% fee)
```

### Real Example: Reserve Changes

```
Initial State:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reserve0 (wUSDC): 1,000,000
Reserve1 (DAI):   1,000,000
SUM = 2,000,000
PRODUCT (K) = 1,000,000,000,000


After swapping 100 wUSDC → DAI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
amountOut = (100 × 1,000,000) / (1,000,100) = 99.99 DAI

Reserve0 (wUSDC): 1,000,100  (added 100)
Reserve1 (DAI):     999,900  (removed 99.99)
SUM = 2,000,000  ✅ (same for small swaps)
PRODUCT (K) = 999,999,990,000 ✅ (≈ K)


After swapping 100,000 wUSDC → DAI (huge swap):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
amountOut = (100,000 × 1,000,000) / (1,100,000) = 90,909 DAI

Reserve0 (wUSDC): 1,100,000  (added 100,000)
Reserve1 (DAI):     909,091  (removed 90,909)
SUM = 2,009,091  ⬆️ INCREASED! (was 2,000,000)
PRODUCT (K) = 999,999,990,000 ✅ (≈ K still constant)
```

### Key Points

- ✅ **PRODUCT (K) stays constant** across swaps
- ❌ **SUM changes** - increases with larger swaps
- 🔄 Reserves change **EVERY SINGLE SWAP**
- 📈 Price = Reserve1 / Reserve0 (updates every swap)

### Why This Matters for ChainSwap

```javascript
Time T1: Relayer queries pool
├─ Reserve0: 1,000,000 wUSDC
├─ Reserve1: 1,002,000 DAI
└─ Expected: 100.0998 DAI

Time T2: Someone else swaps 50k USDC → DAI!
├─ Reserve0: 1,050,000 wUSDC (increased!)
├─ Reserve1:   952,381 DAI (decreased!)
└─ New rate: 1 USDC = 0.907 DAI (worse!)

Time T3: User's transaction executes
├─ Calculate: (100 × 952,381) / (1,050,100) = 90.70 DAI
├─ Check: 90.70 < 99.0988 minimum ❌
└─ Result: TRANSACTION REVERTS!

Protection: Slippage tolerance prevents loss
Fallback: User gets 100 wUSDC instead
```

### Deployed Contracts vs Reserves

| Aspect | Frequency |
|--------|-----------|
| **Uniswap Router Contract** | Deployed ONCE (years ago) ✅ |
| **Pool Pair Contract** | Created once per token pair ✅ |
| **Reserve0 & Reserve1** | Changes EVERY SWAP ❌ |
| **Exchange Rate** | Recalculated EVERY BLOCK ❌ |
| **Constant Product K** | ~Constant (grows with fees) ✅ |

---

## Reverse Journey (Bridging Back)

### 🔄 Problem: User Has DAI on Arbitrum, Wants SRC on Ethereum

**Challenge:** Pools only exist on destination chain (Arbitrum), NOT on source chain (Ethereum)!

### Solution: Two-Step Process

#### **Step 1: Swap on Destination (Manual)**

```javascript
// User calls Uniswap directly on Arbitrum
uniswapRouter.swapExactTokensForTokens(
  amountIn: 100 DAI,
  amountOutMin: 99 wSRC,
  path: [DAI, wSRC],
  to: Alice,
  deadline: now + 300
)

Result: Alice receives 99.90 wSRC ✅
```

#### **Step 2: Burn on Destination**

```solidity
// contracts/bridges/ChainSwapBridge.sol:186-202
ChainSwapBridge.burn(
  amount: 99.90 wSRC,
  targetAddress: 0xAlice,
  targetChain: 1  // Ethereum
)

Execution:
├─ Transfer 99.90 wSRC from user → bridge
├─ Burn 99.90 wSRC (destroy tokens)
└─ Emit Burn event for relayer
```

#### **Step 3: Unlock on Source (Relayer)**

```solidity
// contracts/bridges/BridgeSourceExtended.sol:92-115
BridgeSourceExtended.unlock(
  to: 0xAlice,
  amount: 99.90 SRC,
  sourceNonce: 187456,
  signature: 0xABC...
)

Result: Alice receives 99.90 original SRC on Ethereum ✅
```

### Forward vs Reverse Comparison

| Direction | User Transactions | How It Works |
|-----------|------------------|--------------|
| **Forward** (Ethereum → Arbitrum) | **1 transaction** | Lock SRC with targetToken=DAI<br>Relayer handles mint+swap automatically |
| **Reverse** (Arbitrum → Ethereum) | **2 transactions** | 1. Swap DAI → wSRC manually<br>2. Burn wSRC<br>Relayer unlocks original tokens |

### Why This Asymmetry?

```
Source Chain (Ethereum):
├─ Has: Original tokens locked in bridge
├─ Has: NO pools ❌
└─ Cannot: Swap tokens (no liquidity!)

Destination Chain (Arbitrum):
├─ Has: Wrapped tokens + all pools ✅
├─ Can: Mint, burn, swap
└─ All operations happen here

Conclusion:
Forward: Easy (pools on destination, swap automatically)
Reverse: Manual (must swap first, then burn, no pools on source)
```

---

## ChainSwap vs Basic Bridge

### 🔑 The Real Distinction

**NOT about:** Exchange rate differences between chains ❌
**ACTUALLY about:** What token the user wants to receive ✅

### Decision Tree

```
Question: What token do you want on destination chain?

Answer 1: "Same token (wrapped version)"
  └─ Use: BASIC BRIDGE
     ├─ Example: USDC → wUSDC
     ├─ No swap needed
     ├─ Gas: ~80k
     ├─ Ratio: Always 1:1
     └─ No slippage risk

Answer 2: "Different token"
  └─ Use: CHAINSWAP
     ├─ Example: USDC → DAI/ETH/LINK
     ├─ Swap needed
     ├─ Gas: ~250k
     ├─ Ratio: Market rate (varies)
     └─ Slippage protection needed
```

### Side-by-Side Comparison

| Aspect | Basic Bridge | ChainSwap |
|--------|-------------|-----------|
| **User wants** | Same token (wrapped) | Different token |
| **Output** | 100 USDC → 100 wUSDC | 100 USDC → 100.10 DAI |
| **Swap needed?** | ❌ NO | ✅ YES |
| **Pools required?** | ❌ NO | ✅ YES (on destination) |
| **Exchange rate matters?** | ❌ NO (always 1:1) | ✅ YES |
| **Slippage risk?** | ❌ NO | ✅ YES |
| **Gas cost** | ~80k gas | ~250k gas |
| **User steps** | 1 transaction | 1 transaction (forward)<br>2 transactions (reverse) |

### Real-World Use Cases

#### **Use Basic Bridge When:**

```
✅ Moving funds to L2 for trading
   └─ Have USDC on Ethereum → Want wUSDC on Arbitrum for trading

✅ Yield farming with same token
   └─ Have USDC → Want wUSDC to deposit in farming protocol

✅ Simple cross-chain transfer
   └─ Just need the token on different chain, no conversion
```

#### **Use ChainSwap When:**

```
✅ Cross-chain payments in different token
   └─ Have USDC on Ethereum → Need ETH on Arbitrum to pay someone

✅ Portfolio rebalancing
   └─ Have DAI on Ethereum → Want USDC on Arbitrum for stablecoin yield

✅ Gas optimization
   └─ Have USDC → Want ETH (to pay for gas on destination)
   └─ Saves time: 1 transaction vs 2 (bridge then swap)

✅ One-step convenience
   └─ Bridge + swap in single transaction
   └─ Better UX than bridge first, then swap separately
```

### Common Misconception Debunked

**WRONG Statement:**
> "Use ChainSwap when rates differ between chains, use Basic Bridge when rates are the same"

**Why Wrong:**

```
Example 1: Rates identical, ChainSwap still needed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hypothetical: USDC/DAI = 1.0000 on BOTH chains

User has: 100 USDC on Ethereum
User wants: DAI on Arbitrum

Solution: MUST use ChainSwap!
Reason: Even with identical rates, user wants DIFFERENT TOKEN
Basic Bridge can't convert USDC → DAI (only wraps)


Example 2: Rates differ, Basic Bridge correct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reality: USDC price differs
├─ Ethereum: $1.0010
└─ Arbitrum: $1.0005

User has: 100 USDC on Ethereum
User wants: USDC on Arbitrum (for trading)

Solution: Use Basic Bridge!
Reason: User wants SAME TOKEN (USDC), rate difference irrelevant
User gets 100 wUSDC regardless of price
```

**CORRECT Principle:**
> Choose based on **WHAT TOKEN** user wants, not whether rates differ!

### Reality: Rates ALWAYS Differ

```
Same token pair at SAME TIME on different chains:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USDC/ETH Rate (snapshot 10:00 AM UTC):
┌────────────────────────────────────────┐
│ Ethereum:  1 USDC = 0.000420 ETH       │
│ Arbitrum:  1 USDC = 0.000421 ETH       │
│ Optimism:  1 USDC = 0.000419 ETH       │
│ Polygon:   1 USDC = 0.000418 ETH       │
│ Base:      1 USDC = 0.000420 ETH       │
└────────────────────────────────────────┘

Variance: ~0.7%

Causes:
├─ Different liquidity pools (separate contracts)
├─ Different trading volumes per chain
├─ Arbitrage delays (bridge takes 12+ minutes)
└─ Localized supply/demand differences
```

**This is normal and doesn't determine Basic Bridge vs ChainSwap choice!**

---

## Key Takeaways

### 🎯 **Top 10 Critical Concepts**

#### 1. **Exchange Rate Sources**
- **Chainlink**: Reference/monitoring (optional)
- **Uniswap Pools**: Actual swap execution ✅ (primary)

#### 2. **Configuration Location**
- `setPriceFeed()` in `PriceOracle.sol:28` → Sets Chainlink feeds
- `getAmountsOut()` in Uniswap Router → Real-time pool rates
- **ONLY deployed on destination chain**

#### 3. **Pool Location**
- **Source chain**: NO pools, NO swaps ❌
- **Destination chain**: ALL pools, ALL swaps ✅
- Asymmetric by design

#### 4. **Constant Product Formula**
- ✅ `Reserve0 × Reserve1 = K` (constant)
- ❌ `Reserve0 + Reserve1 ≠ constant`
- Product stays same, sum changes

#### 5. **Reserves Are Dynamic**
- Change on EVERY swap
- Never stay the same
- Price recalculated every block

#### 6. **Slippage Protection**
```javascript
Expected: 100.0998 DAI
Tolerance: 1%
Minimum: 99.0988 DAI
Result: Accept ≥ 99.0988, revert otherwise
```

#### 7. **Forward Journey (Easy)**
- 1 user transaction
- Lock → Relayer mints + swaps automatically
- Pools available on destination ✅

#### 8. **Reverse Journey (Manual)**
- 2 user transactions
- Must swap manually first, then burn
- No pools on source chain ❌

#### 9. **Basic Bridge vs ChainSwap**
- NOT about rate differences
- About WHAT TOKEN user wants
- Same token → Basic Bridge
- Different token → ChainSwap

#### 10. **Rates Always Differ Between Chains**
- Different pools = different rates
- Arbitrage delays cause divergence
- Normal and expected (~0.1-1% variance)

---

## Code Reference Map

| Feature | File | Line | Purpose |
|---------|------|------|---------|
| **setPriceFeed** | `PriceOracle.sol` | 28-34 | Configure Chainlink feeds |
| **getPrice** | `PriceOracle.sol` | 41-60 | Pull Chainlink price |
| **getExpectedOutput** | `ChainSwapBridge.sol` | 210-221 | Query Uniswap pool rate |
| **getAmountsOut** | Uniswap Router | - | Calculate swap output |
| **mintAndSwap** | `ChainSwapBridge.sol` | 106-146 | Mint + swap execution |
| **handleMintAndSwap** | `ChainSwapHandler.js` | 123-173 | Relayer swap handler |
| **burn** | `ChainSwapBridge.sol` | 186-202 | Burn wrapped tokens |
| **unlock** | `BridgeSourceExtended.sol` | 92-115 | Unlock original tokens |
| **SLIPPAGE_TOLERANCE** | `relayer/.env` | 51 | Slippage protection config |

---

## Quick Reference: Flow Summary

### Forward (Source → Destination with Swap)

```
1. User locks 100 USDC on Ethereum (targetToken=DAI)
2. Relayer detects Lock event
3. Relayer queries Uniswap pool on Arbitrum → 100.0998 DAI expected
4. Relayer sets minimum: 99.0988 DAI (1% slippage)
5. Relayer calls mintAndSwap() on Arbitrum:
   ├─ Mint 100 wUSDC
   ├─ Swap wUSDC → DAI using Arbitrum pool
   └─ User receives 100.10 DAI ✅
```

### Reverse (Destination → Source)

```
1. User swaps 100 DAI → 99.90 wSRC on Arbitrum (Uniswap directly)
2. User burns 99.90 wSRC on Arbitrum (ChainSwapBridge.burn)
3. Relayer detects Burn event
4. Relayer calls unlock() on Ethereum
5. User receives 99.90 original SRC on Ethereum ✅
```

---

## Visual: Complete Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              SOURCE CHAIN (Ethereum)                        │
│  ┌──────────────┐    ┌─────────────────────────┐          │
│  │ Source Token │◄───│ BridgeSourceExtended    │          │
│  │   (USDC)     │    │ - lock()                │          │
│  │              │    │ - unlock()              │          │
│  └──────────────┘    │ - NO pools              │          │
│                      │ - NO swaps              │          │
│                      └─────────────────────────┘          │
│                                                             │
│  Functions: lock(), unlock()                               │
│  Gas: ~55k (lock), ~80k (unlock)                           │
└─────────────────────────────────────────────────────────────┘
                          │
                Relayer (listens, transmits)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           DESTINATION CHAIN (Arbitrum)                      │
│  ┌─────────────────┐  ┌──────────────────────┐            │
│  │ Wrapped Token   │◄─│ ChainSwapBridge      │            │
│  │  (wUSDC)        │  │ - mintAndSwap()      │            │
│  │                 │  │ - burn()             │            │
│  │                 │  │ - getExpectedOutput()│            │
│  └─────────────────┘  └──────────────────────┘            │
│           │                     │                           │
│           │                     │                           │
│           ▼                     ▼                           │
│  ┌──────────────┐    ┌─────────────────────┐              │
│  │ PriceOracle  │    │ Uniswap Router      │              │
│  │ (Chainlink)  │    │ - swapExactTokens() │              │
│  │              │    │ - getAmountsOut()   │              │
│  │ Optional ⚠️  │    │ PRIMARY SOURCE ✅    │              │
│  └──────────────┘    └─────────────────────┘              │
│                               │                             │
│                               ▼                             │
│                      ┌─────────────────┐                   │
│                      │ Liquidity Pools │                   │
│                      │ - wUSDC/DAI     │                   │
│                      │ - wUSDC/WETH    │                   │
│                      │ - wUSDC/USDC    │                   │
│                      └─────────────────┘                   │
│                                                             │
│  Functions: mintAndSwap(), burn(), getExpectedOutput()     │
│  Gas: ~250k (mint+swap), ~100k (burn)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Reserve0/Reserve1** | Token balances in a Uniswap pool (change every swap) |
| **Constant Product (K)** | Reserve0 × Reserve1 (stays approximately constant) |
| **Slippage** | Difference between expected and actual swap output |
| **Wrapped Token** | Minted representation of locked token on destination chain |
| **Target Token** | The token user wants to receive after swap |
| **Price Feed** | Chainlink oracle providing reference prices |
| **Pool** | Uniswap liquidity pool containing two tokens for swapping |
| **AMM** | Automated Market Maker (Uniswap uses constant product formula) |

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Related Docs:**
- [README.md](./README.md)
- [PROJECT-SUMMARY.md](./PROJECT-SUMMARY.md)
- [WHATS-NEW.md](./WHATS-NEW.md)
