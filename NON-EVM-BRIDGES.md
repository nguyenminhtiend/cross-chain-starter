# Non-EVM Bridges: Stellar & Solana

This directory contains implementations of cross-chain bridges to **non-EVM chains**, specifically Stellar and Solana.

## Why Non-EVM Bridges?

Your existing bridge connects **EVM chains** (Ethereum, BSC, Polygon, etc.). These new bridges extend your reach to:

1. **Stellar** - Specialized for payments and fiat integration
2. **Solana** - High-performance DeFi ecosystem

### Use Cases

#### 1. Fiat On/Off Ramps via Stellar
```
User wants to buy ETH with local currency
    ↓
Local Exchange → USDC on Stellar (cheap, fast)
    ↓
Stellar Bridge → USDC on Ethereum
    ↓
Uniswap → ETH
```

#### 2. Cross-Ecosystem DeFi
```
Arbitrage between Solana and Ethereum DEXs
High-frequency trading with Solana's 400ms finality
Access to Solana NFT/gaming ecosystems
```

#### 3. Enhanced ChainSwap
```
Current: Ethereum ↔ BSC ↔ Polygon (EVM only)
New: Stellar ↔ Ethereum ↔ Solana (multi-ecosystem)
```

## Architecture Overview

Both bridges use the **same lock/mint and burn/unlock pattern** as your EVM bridge!

```
┌─────────────────────────────────────────────────────────┐
│                  Your Bridge Ecosystem                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  EVM Chains (Existing)                                  │
│  ├── Ethereum ──┐                                       │
│  ├── Sepolia    ├── Lock/Mint, Burn/Unlock             │
│  └── BSC ───────┘     (Solidity contracts)             │
│                                                          │
│  Stellar (NEW)                                          │
│  └── Built-in operations (no contracts needed!)        │
│      - Fast: ~5 second finality                        │
│      - Cheap: $0.00001 fees                            │
│      - Fiat-friendly: Circle, MoneyGram partnerships   │
│                                                          │
│  Solana (NEW)                                           │
│  └── Rust programs (Anchor framework)                  │
│      - Ultra-fast: ~400ms finality                     │
│      - High-performance: thousands of TPS              │
│      - Large DeFi ecosystem                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
cross-chain-starter/
├── stellar-bridge/           # Stellar ↔ Ethereum bridge
│   ├── src/
│   │   ├── stellar-bridge.js    # Bridge service (like your relayer)
│   │   ├── index.js             # Entry point
│   │   └── setup-accounts.js    # Account setup
│   ├── test/
│   │   └── stellar-bridge.test.js
│   ├── package.json
│   └── README.md
│
├── solana-bridge/            # Solana ↔ Ethereum bridge
│   ├── programs/
│   │   └── solana-bridge/
│   │       └── src/
│   │           └── lib.rs       # Rust program (like your Solidity contract)
│   ├── relayer/
│   │   └── src/
│   │       └── solana-relayer.js  # Relayer (like your EVM relayer)
│   ├── tests/
│   │   └── solana-bridge.test.ts  # Tests (like your Hardhat tests)
│   ├── Anchor.toml
│   └── README.md
│
└── docs/
    └── 02-STELLAR-SOLANA-GUIDE.md  # Detailed learning guide
```

## Knowledge Transfer Map

### What's the SAME ✅ (80% of concepts)

| Concept | Your EVM Bridge | Stellar | Solana |
|---------|----------------|---------|--------|
| **Pattern** | Lock/Mint, Burn/Unlock | ✅ Same | ✅ Same |
| **Nonce tracking** | `mapping(uint => bool)` | ✅ Tx hash | ✅ `Vec<u64>` |
| **Events** | `emit Lock(...)` | ✅ Logs | ✅ `emit!(...)` |
| **Signatures** | ECDSA | ✅ Ed25519 | ✅ Ed25519 |
| **Finality** | 12 blocks | ✅ ~5 sec | ✅ ~400ms |
| **Relayer logic** | Listen → Sign → Mint | ✅ Same | ✅ Same |

### What's DIFFERENT 🎓

| Feature | EVM (Your Bridge) | Stellar | Solana |
|---------|------------------|---------|--------|
| **Smart Contracts** | Solidity | None (protocol ops) | Rust (Anchor) |
| **State Storage** | In contract | In account ledger | Separate accounts |
| **Lock Function** | `contract.lock()` | `Operation.payment()` | `program.methods.lock()` |
| **Language** | JavaScript/Solidity | JavaScript SDK | Rust + TypeScript |

## Quick Start

### 1. Stellar Bridge

```bash
cd stellar-bridge
pnpm install
pnpm run setup        # Create and fund accounts
pnpm start            # Start bridge
```

**Time to implement**: ~1 week
**Difficulty**: ⭐⭐ (Medium - no smart contracts!)
**New concepts**: Trustlines, memo fields, protocol operations

### 2. Solana Bridge

```bash
cd solana-bridge
anchor build          # Build Rust program
anchor test           # Run tests
anchor deploy         # Deploy program

cd relayer
pnpm install
pnpm start           # Start relayer
```

**Time to implement**: ~2-3 weeks
**Difficulty**: ⭐⭐⭐ (Medium-Hard - need to learn Rust)
**New concepts**: Account model, Rust syntax, Anchor framework

## Code Comparison

### Your EVM Bridge

```javascript
// Lock tokens
await token.approve(bridge.address, amount);
await bridge.lock(recipient, amount);

// Relayer listens
sourceBridge.on('Lock', async (from, to, amount, nonce) => {
  const sig = await sign(to, amount, nonce);
  await destBridge.mint(to, amount, nonce, sig);
});
```

### Stellar Bridge (SAME PATTERN!)

```javascript
// Lock tokens (send payment with memo)
await server.submitTransaction(paymentTx);

// Relayer listens (SAME LOGIC!)
server.payments().stream({
  onmessage: async (payment) => {
    const sig = await sign(to, amount, nonce);
    await ethereumBridge.mint(to, amount, nonce, sig);  // SAME!
  }
});
```

### Solana Bridge (SAME PATTERN!)

```javascript
// Lock tokens
await program.methods.lock(amount, recipient).rpc();

// Relayer listens (SAME LOGIC!)
program.addEventListener('LockEvent', async (event) => {
  const sig = await sign(to, amount, nonce);
  await ethereumBridge.mint(to, amount, nonce, sig);  // SAME!
});
```

## Testing

Both bridges include comprehensive tests that mirror your EVM bridge tests:

```bash
# Stellar tests
cd stellar-bridge
pnpm test

# Solana tests
cd solana-bridge
anchor test
```

## Integration with Existing Bridge

These bridges are designed to work **alongside** your existing EVM bridge:

```javascript
// Your chainswap can now route through multiple chains!

// Before (EVM only):
Ethereum USDC → Polygon MATIC

// After (multi-chain):
Stellar XLM → Ethereum USDC → Solana SOL
```

## Learning Path

### Week 1: Stellar
1. ✅ Read `docs/02-STELLAR-SOLANA-GUIDE.md` (Part 1)
2. ✅ Complete `stellar-bridge/` setup
3. ✅ Test Stellar → Ethereum flow
4. ✅ Test Ethereum → Stellar flow

### Week 2-3: Solana
1. ✅ Learn Rust basics (chapters 1-10 of Rust Book)
2. ✅ Read Anchor tutorial
3. ✅ Read `docs/02-STELLAR-SOLANA-GUIDE.md` (Part 2)
4. ✅ Complete `solana-bridge/` implementation
5. ✅ Test end-to-end

## Resources

### Stellar
- 📚 [Stellar SDK Docs](https://stellar.github.io/js-stellar-sdk/)
- 🎮 [Stellar Quest](https://quest.stellar.org/) (interactive tutorials)
- 🔬 [Laboratory](https://laboratory.stellar.org/) (test operations)

### Solana
- 📚 [Anchor Book](https://book.anchor-lang.com/)
- 🍳 [Solana Cookbook](https://solanacookbook.com/)
- 🦀 [The Rust Book](https://doc.rust-lang.org/book/)

### General
- 📖 [Stellar-Solana Guide](docs/02-STELLAR-SOLANA-GUIDE.md) - Detailed guide with code examples

## FAQs

### Q: Do I need to modify my existing EVM bridge?
**A**: No! These bridges work independently and can be integrated later.

### Q: Which bridge should I build first?
**A**: Start with Stellar (easier - no smart contracts). Then Solana.

### Q: Can I use the same relayer for all chains?
**A**: You can, but it's cleaner to have separate relayers per chain pair.

### Q: Do I need to learn Rust for Stellar?
**A**: No! Stellar uses JavaScript SDK only.

### Q: Is the security model the same?
**A**: Yes! Same signature verification, nonce tracking, and finality checks.

### Q: How do fees compare?

| Chain | Average Fee | Finality Time |
|-------|-------------|---------------|
| Ethereum | $2-50 | ~3 minutes |
| Stellar | $0.00001 | ~5 seconds |
| Solana | $0.00025 | ~400ms |

## Next Steps

1. ✅ Review `docs/02-STELLAR-SOLANA-GUIDE.md` for detailed explanations
2. ✅ Start with Stellar bridge (easier)
3. ✅ Test on testnets
4. ✅ Move to Solana bridge
5. ✅ Integrate with your chainswap
6. ✅ Deploy to mainnets

## Support

- Issues: Check individual bridge READMEs
- Questions: Refer to `docs/02-STELLAR-SOLANA-GUIDE.md`
- Examples: All code includes extensive comments mapping to your EVM bridge

---

**Key Takeaway**: You're not learning new bridge concepts - you're learning how to implement the **same patterns** you already know on different chains! 🚀
