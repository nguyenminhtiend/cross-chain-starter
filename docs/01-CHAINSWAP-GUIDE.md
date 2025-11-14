# ChainSwap: Cross-Chain Token Swap

**Difficulty:** ⭐⭐⭐ (Easiest)
**Knowledge Reuse:** 90% from your bridge project
**Time Estimate:** 1-2 weeks

---

## Overview

ChainSwap allows users to swap Token A on Chain1 for Token B on Chain2 in a single transaction.

**Example Flow:**
```
User has 100 USDC on Ethereum
User wants 0.04 ETH on Arbitrum
ChainSwap: USDC → Bridge → Arbitrum → DEX swap → ETH
```

---

## Why This Is Easy For You

### Knowledge You Already Have ✅

You've already built the **hardest part** - the cross-chain message passing infrastructure!

```javascript
// Your Bridge (Phase 1-6)
lock(to, amount)
  → emit Lock
  → relayer listens
  → mint(to, amount)

// ChainSwap (extends your bridge!)
lock(to, amount, targetToken)
  → emit Lock
  → relayer listens
  → mint(to, amount)
  → swap on DEX
  → send targetToken
```

**What's the same:**
- ✅ Event-driven architecture (90% identical)
- ✅ Relayer pattern (no changes needed)
- ✅ State management (nonces, replay protection)
- ✅ Multi-chain deployment
- ✅ Security patterns (reentrancy, access control)

**What's new:**
- 🎓 DEX integration (Uniswap)
- 🎓 Price oracles (Chainlink)
- 🎓 Slippage protection

---

## Architecture Comparison

### Your Bridge Architecture
```
┌──────────────┐
│   Chain 1    │  User locks tokens
│              │  ↓
│  Lock Event  │  Emitted
└──────┬───────┘
       │ Your relayer (already built!)
       ↓
┌──────────────┐
│   Chain 2    │  Mint wrapped tokens
│              │  ↓
│  User Gets   │  Wrapped tokens
└──────────────┘
```

### ChainSwap Architecture (Extended)
```
┌──────────────┐
│   Chain 1    │  User locks 100 USDC
│              │  ↓
│  Lock Event  │  Emitted with targetToken=WETH
└──────┬───────┘
       │ Your relayer (same code!)
       ↓
┌──────────────┐
│   Chain 2    │  Mint 100 wrappedUSDC
│              │  ↓
│  Uniswap     │  Swap wrappedUSDC → WETH
│              │  ↓
│  User Gets   │  0.04 WETH
└──────────────┘
```

---

## Key Concepts

### 1. DEX Integration (Uniswap V2)

**Mapping to your knowledge:**

| Your Bridge Concept | ChainSwap Equivalent |
|---------------------|----------------------|
| `token.transfer()` | `uniswapRouter.swapExactTokensForTokens()` |
| Validate recipient | Validate slippage tolerance |
| Check balance | Check liquidity pool |
| Emit event | Emit swap event |

**Code Example:**

```solidity
// File: contracts/ChainSwapBridge.sol
// EXTENDS your existing BridgeDestination.sol

pragma solidity ^0.8.0;

import "./BridgeDestination.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract ChainSwapBridge is BridgeDestination {
    IUniswapV2Router02 public uniswapRouter;

    // NEW: Event for swap tracking
    event MintAndSwap(
        address indexed to,
        uint256 amountIn,
        uint256 amountOut,
        address tokenOut,
        uint256 sourceNonce
    );

    constructor(
        address _wrappedToken,
        address _uniswapRouter
    ) BridgeDestination(_wrappedToken) {
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    /**
     * NEW FUNCTION: Mint and swap in one transaction
     *
     * Mapping to your bridge:
     * - mint() → Exactly like your Phase 2 mint function
     * - swap logic → NEW, but similar to your token transfers
     */
    function mintAndSwap(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature,
        address targetToken,      // NEW: What token to swap to
        uint256 minAmountOut      // NEW: Slippage protection
    ) external onlyOwner {
        // SAME AS YOUR BRIDGE: Check if already processed
        require(!processedNonces[sourceNonce], "Already processed");

        // SAME AS YOUR BRIDGE: Verify signature
        bytes32 message = keccak256(
            abi.encodePacked(to, amount, sourceNonce, targetToken, minAmountOut)
        );
        require(verifySignature(message, signature), "Invalid signature");

        // SAME AS YOUR BRIDGE: Mint wrapped tokens
        // But mint to THIS contract, not user (we'll swap first)
        wrappedToken.mint(address(this), amount);

        // SAME AS YOUR BRIDGE: Mark as processed
        processedNonces[sourceNonce] = true;

        // NEW: If targetToken specified, swap
        if (targetToken != address(0)) {
            // Approve Uniswap to spend our tokens
            // (Similar to how users approve your bridge!)
            wrappedToken.approve(address(uniswapRouter), amount);

            // Define swap path: wrappedToken → targetToken
            address[] memory path = new address[](2);
            path[0] = address(wrappedToken);
            path[1] = targetToken;

            // Execute swap
            uint[] memory amounts = uniswapRouter.swapExactTokensForTokens(
                amount,              // Exact amount to swap
                minAmountOut,        // Minimum amount to receive (slippage protection)
                path,                // Swap route
                to,                  // Send result to user
                block.timestamp + 300 // Deadline: 5 minutes
            );

            emit MintAndSwap(to, amount, amounts[1], targetToken, sourceNonce);
        } else {
            // No swap needed, just transfer wrapped tokens
            // (Same as your original mint function)
            wrappedToken.transfer(to, amount);
            emit Mint(to, amount, sourceNonce);
        }
    }

    /**
     * HELPER: Get expected output amount
     * Similar to your bridge's getLockedBalance - just reading data
     */
    function getExpectedOutput(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint[] memory amounts = uniswapRouter.getAmountsOut(amountIn, path);
        return amounts[1];
    }
}
```

### 2. Price Oracles (Chainlink)

**Mapping to your knowledge:**

Your bridge trusts the relayer to verify events. Similarly, ChainSwap trusts Chainlink to provide accurate prices.

| Your Bridge | ChainSwap |
|-------------|-----------|
| Verify lock event on-chain | Verify price from oracle |
| Trust relayer signature | Trust Chainlink aggregator |
| Prevent replay with nonces | Prevent stale prices with timestamp |

**Code Example:**

```solidity
// File: contracts/PriceOracle.sol
// NEW file, but similar to how you verify signatures

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PriceOracle {
    mapping(address => AggregatorV3Interface) public priceFeeds;

    // Maximum age of price data (similar to your block finality checks)
    uint256 public constant MAX_PRICE_AGE = 1 hours;

    constructor() {
        // Example: ETH/USD on Ethereum mainnet
        priceFeeds[0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE] =
            AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    }

    /**
     * Get token price in USD
     * Similar to your verifySignature - external data validation
     */
    function getPrice(address token) public view returns (int256) {
        AggregatorV3Interface priceFeed = priceFeeds[token];
        require(address(priceFeed) != address(0), "Price feed not found");

        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        // Validation (similar to your signature checks!)
        require(price > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price");
        require(block.timestamp - updatedAt < MAX_PRICE_AGE, "Price too old");

        return price;
    }

    /**
     * Calculate expected swap output
     * Similar to calculating token amounts in your bridge
     */
    function calculateSwapOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 expectedOut, uint256 minOut) {
        int256 priceIn = getPrice(tokenIn);
        int256 priceOut = getPrice(tokenOut);

        // Calculate expected output
        expectedOut = (amountIn * uint256(priceIn)) / uint256(priceOut);

        // Apply 1% slippage tolerance
        minOut = expectedOut * 99 / 100;
    }
}
```

### 3. Slippage Protection

**Mapping to your knowledge:**

Similar to how your bridge prevents replay attacks with nonces, ChainSwap prevents bad trades with slippage limits.

| Security Concept | Your Bridge | ChainSwap |
|------------------|-------------|-----------|
| **Attack Vector** | Double-spend (process same event twice) | Sandwich attack (manipulate price) |
| **Protection** | Nonce tracking | Minimum output amount |
| **Validation** | `require(!processedNonces[nonce])` | `require(amountOut >= minOut)` |
| **User Control** | User can't control nonce | User sets acceptable slippage |

**Code Example:**

```javascript
// File: relayer/chainswap-handler.js
// EXTENDS your existing handleLockEvent

const { ethers } = require('ethers');

class ChainSwapHandler {
    constructor(sourceChain, destChain, bridgeContracts) {
        // Same setup as your existing relayer
        this.sourceChain = sourceChain;
        this.destChain = destChain;
        this.bridgeContracts = bridgeContracts;
    }

    /**
     * EXTENDS your handleLockEvent from Phase 4
     *
     * Your original flow:
     * 1. Listen for Lock event
     * 2. Verify event
     * 3. Call mint()
     *
     * New flow:
     * 1. Listen for Lock event (SAME)
     * 2. Verify event (SAME)
     * 3. Calculate slippage (NEW)
     * 4. Call mintAndSwap() (EXTENDED)
     */
    async handleLockEvent(event) {
        const { from, to, amount, timestamp, nonce, targetChain } = event.args;

        // SAME AS YOUR BRIDGE: Verify not processed
        const processed = await this.destChain.bridge.processedNonces(nonce);
        if (processed) {
            console.log(`Nonce ${nonce} already processed`);
            return;
        }

        // SAME AS YOUR BRIDGE: Wait for finality
        const currentBlock = await this.sourceChain.provider.getBlockNumber();
        const confirmations = currentBlock - event.blockNumber;
        if (confirmations < 12) {
            console.log(`Waiting for finality: ${confirmations}/12 blocks`);
            return;
        }

        // NEW: Parse swap parameters from event data
        const swapParams = this.parseSwapData(event);

        if (swapParams.targetToken) {
            // NEW: Calculate minimum output with slippage protection
            const expectedOut = await this.getExpectedOutput(
                amount,
                swapParams.targetToken
            );

            // Apply 1% slippage tolerance
            const minOut = expectedOut.mul(99).div(100);

            console.log(`Swap: ${amount} → expected ${expectedOut} (min ${minOut})`);

            // EXTENDED: Sign mintAndSwap parameters
            const messageHash = ethers.utils.solidityKeccak256(
                ['address', 'uint256', 'uint256', 'address', 'uint256'],
                [to, amount, nonce, swapParams.targetToken, minOut]
            );

            const signature = await this.destChain.signer.signMessage(
                ethers.utils.arrayify(messageHash)
            );

            // EXTENDED: Call mintAndSwap instead of mint
            const tx = await this.destChain.bridge.mintAndSwap(
                to,
                amount,
                nonce,
                signature,
                swapParams.targetToken,
                minOut
            );

            console.log(`MintAndSwap tx: ${tx.hash}`);
            await tx.wait();

        } else {
            // SAME AS YOUR BRIDGE: Regular mint (no swap)
            const messageHash = ethers.utils.solidityKeccak256(
                ['address', 'uint256', 'uint256'],
                [to, amount, nonce]
            );

            const signature = await this.destChain.signer.signMessage(
                ethers.utils.arrayify(messageHash)
            );

            const tx = await this.destChain.bridge.mint(to, amount, nonce, signature);
            console.log(`Mint tx: ${tx.hash}`);
            await tx.wait();
        }
    }

    /**
     * NEW: Get expected swap output from Uniswap
     * Similar to your getLockedBalance - just reading chain state
     */
    async getExpectedOutput(amountIn, targetToken) {
        const wrappedToken = await this.destChain.bridge.wrappedToken();
        const path = [wrappedToken, targetToken];

        const amounts = await this.destChain.uniswapRouter.getAmountsOut(
            amountIn,
            path
        );

        return amounts[1];
    }

    /**
     * NEW: Parse swap parameters from event
     * Similar to how you parse Lock events
     */
    parseSwapData(event) {
        // You can encode this in the Lock event's data field
        // For example: event.data contains targetToken address
        try {
            const decoded = ethers.utils.defaultAbiCoder.decode(
                ['address'],
                event.data
            );
            return { targetToken: decoded[0] };
        } catch (e) {
            // No swap data, return null
            return { targetToken: null };
        }
    }
}

module.exports = ChainSwapHandler;
```

---

## Implementation Steps

### Step 1: Extend Lock Event (Source Chain)

**Modify your BridgeSource.sol:**

```solidity
// Add targetToken parameter to Lock event
event Lock(
    address indexed from,
    address indexed to,
    uint256 amount,
    uint256 timestamp,
    uint256 indexed nonce,
    address targetToken  // NEW: What to swap to on destination
);

// Update lock function
function lock(
    address to,
    uint256 amount,
    address targetToken  // NEW parameter
) external {
    // Same validation as before
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

    uint256 nonce = currentNonce++;

    // Emit with new parameter
    emit Lock(msg.sender, to, amount, block.timestamp, nonce, targetToken);
}
```

### Step 2: Deploy ChainSwapBridge (Destination Chain)

```javascript
// scripts/deploy-chainswap.js
// Similar to your deploy scripts from Phase 2

const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying ChainSwap with:", deployer.address);

    // Uniswap V2 Router addresses
    const UNISWAP_ROUTER = {
        ethereum: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        arbitrum: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        // Add other chains...
    };

    // Deploy ChainSwapBridge
    const ChainSwapBridge = await ethers.getContractFactory("ChainSwapBridge");
    const bridge = await ChainSwapBridge.deploy(
        wrappedTokenAddress,  // From your Phase 2 deployment
        UNISWAP_ROUTER.arbitrum
    );

    await bridge.deployed();
    console.log("ChainSwapBridge deployed to:", bridge.address);
}

main();
```

### Step 3: Update Relayer

```javascript
// relayer/index.js
// MINIMAL changes to your existing relayer!

const ChainSwapHandler = require('./chainswap-handler');

// Replace your existing handler
const handler = new ChainSwapHandler(
    sourceChain,
    destChain,
    bridges
);

// Same event listener as before!
sourceBridge.on('Lock', async (...args) => {
    await handler.handleLockEvent(args);
});
```

### Step 4: Update Frontend

```javascript
// frontend/src/components/Bridge.jsx
// Minimal changes to your UI

function BridgeForm() {
    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [targetToken, setTargetToken] = useState(''); // NEW

    async function handleBridge() {
        // Call lock with new parameter
        const tx = await bridgeContract.lock(
            recipient,
            ethers.utils.parseUnits(amount, 18),
            targetToken || ethers.constants.AddressZero  // NEW
        );

        await tx.wait();
    }

    return (
        <div>
            <input
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
            />
            <input
                placeholder="Recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
            />

            {/* NEW: Optional swap */}
            <select value={targetToken} onChange={(e) => setTargetToken(e.target.value)}>
                <option value="">No swap (receive wrapped tokens)</option>
                <option value="0x...">Swap to WETH</option>
                <option value="0x...">Swap to USDC</option>
            </select>

            <button onClick={handleBridge}>Bridge</button>
        </div>
    );
}
```

---

## Testing Strategy

### Test 1: Regular Bridge (No Swap)
```bash
# Should work exactly like your Phase 6 tests
npm run test -- --grep "bridge without swap"
```

### Test 2: Bridge + Swap
```bash
# NEW test case
npm run test -- --grep "bridge with swap"
```

**Test code:**
```javascript
// test/chainswap.test.js
// Similar structure to your bridge tests!

describe("ChainSwap", function() {
    it("Should bridge and swap tokens", async function() {
        const [user] = await ethers.getSigners();

        // SAME: Lock on source chain
        await sourceToken.approve(sourceBridge.address, amount);
        await sourceBridge.lock(user.address, amount, wethAddress);

        // SAME: Wait for event
        const lockEvent = await getLastLockEvent();

        // SAME: Relayer processes event
        await relayer.handleLockEvent(lockEvent);

        // NEW: Verify user received WETH (not wrapped tokens!)
        const wethBalance = await weth.balanceOf(user.address);
        expect(wethBalance).to.be.gt(0);
    });
});
```

---

## Common Issues & Solutions

### Issue 1: Insufficient Liquidity

**Error:**
```
Error: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT
```

**Solution:**
```javascript
// Check liquidity before swap
async function checkLiquidity(tokenA, tokenB, amount) {
    const pair = await uniswapFactory.getPair(tokenA, tokenB);
    if (pair === ethers.constants.AddressZero) {
        throw new Error("No liquidity pool exists");
    }

    const reserves = await IUniswapV2Pair(pair).getReserves();
    // Verify reserves are sufficient...
}
```

### Issue 2: Slippage Too High

**Error:**
```
Error: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT
```

**Solution:**
```javascript
// Increase slippage tolerance or get fresh price
const expectedOut = await getExpectedOutput(amount, targetToken);
const minOut = expectedOut.mul(95).div(100); // 5% slippage instead of 1%
```

### Issue 3: Swap Fails, Tokens Stuck

**Solution - Add fallback:**
```solidity
// In mintAndSwap function
try uniswapRouter.swapExactTokensForTokens(...) returns (uint[] memory amounts) {
    emit MintAndSwap(to, amount, amounts[1], targetToken, sourceNonce);
} catch {
    // Fallback: send wrapped tokens instead
    wrappedToken.transfer(to, amount);
    emit SwapFailed(to, amount, sourceNonce);
}
```

---

## Next Steps

1. **Week 1:**
   - Extend Lock event with targetToken
   - Deploy ChainSwapBridge on testnet
   - Update relayer logic

2. **Week 2:**
   - Integrate Chainlink price feeds
   - Add slippage protection
   - Test on mainnet fork

3. **Bonus:**
   - Support multi-hop swaps (USDC → WETH → LINK)
   - Integrate multiple DEXes (Uniswap, SushiSwap, Curve)
   - Add price impact warnings

---

## Resources

- [Uniswap V2 Documentation](https://docs.uniswap.org/contracts/v2/overview)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds)
- [Your Bridge Code](../contracts/) - You already have 90% of this!

---

**You're ready to build ChainSwap! It's literally your bridge + 3 new concepts (DEX, oracles, slippage). Start with the minimal example above and iterate.**
