# Cross-Chain Bridge: Quick Reference

**Fast lookup for core concepts and commands**

---

## Architecture at a Glance

```
User → Chain1.lock() → emit Lock(nonce=5)
                           ↓
                    [Blockchain State]
                           ↓
                      [RPC Nodes]
                           ↓
                    Relayer polls
                           ↓
               Chain2.mint(nonce=5) ✅
               processedNonces[5] = true
```

---

## Core Security Pattern

```solidity
// The ONE line that prevents double-spending
require(!processedNonces[sourceNonce], "Nonce already processed");
processedNonces[sourceNonce] = true;  // Atomic on blockchain
```

---

## Key Invariant

```javascript
// MUST ALWAYS BE TRUE
await bridgeEth.getLockedBalance() === await wrappedToken.totalSupply()

// If broken = insolvency exploit
```

---

## Event Polling Flow

```javascript
// How relayer discovers events
const currentBlock = await provider.getBlockNumber();
const events = await contract.queryFilter(
    eventFilter,
    lastBlock + 1,
    currentBlock
);

// Process sequentially (no race within same relayer)
for (const event of events) {
    await handleEvent(event);  // await = sequential
}
```

---

## Multiple Relayers Behavior

| Time | Relayer A | Relayer B | Result |
|------|-----------|-----------|---------|
| T1 | Check nonce(5) → false | - | ✅ Pass |
| T2 | Send mint(5) | Check nonce(5) → false | ✅ Pass (state not updated yet) |
| T3 | - | Send mint(5) | - |
| T4 | TX mined ✅ | - | processedNonces[5] = true |
| T5 | - | TX reverts ❌ | "Already processed" |

**Result:** Safe but wastes gas

---

## Nonces vs Transaction Nonces

| Bridge Nonce | Transaction Nonce |
|--------------|-------------------|
| Tracks cross-chain transfers | Prevents transaction replay |
| `uint256 nonce` in contract | Account property |
| Increments per bridge operation | Increments per transaction |
| Used for replay protection | Used for ordering |

---

## RPC vs Blockchain Node

```
┌─────────────────┐
│ Blockchain Node │ = Stores blocks, validates, consensus
│  (e.g., Geth)   │
│                 │
│  ┌───────────┐  │
│  │ RPC Layer │  │ = HTTP API wrapper (optional)
│  └───────────┘  │
└─────────────────┘

Your code → RPC API → Blockchain Node → Blockchain Network
```

---

## Contract Storage Location

**Contracts are DATA in blockchain state, not processes:**

```
Blockchain State:
├── Account 0xAlice (EOA)
│   ├── balance: 10 ETH
│   └── code: null
│
├── Account 0xBridge (Contract)
│   ├── balance: 0 ETH
│   ├── code: 0x608060... (bytecode)
│   └── storage:
│       ├── nonce: 5
│       └── processedNonces[4]: true
│
└── Account 0xToken (Contract)
    ├── code: 0x608060... (bytecode)
    └── storage:
        └── balances[Alice]: 500
```

---

## Common Commands

### Development
```bash
# Compile contracts
pnpm run compile

# Deploy to both chains
pnpm run deploy:all

# Run tests
pnpm run test

# Start relayer
cd relayer && pnpm start
```

### Testing
```bash
# Test lock event
node scripts/relayer-tests/test-lock-event.js

# Test burn event
node scripts/relayer-tests/test-burn-event.js

# Test full cycle
node scripts/relayer-tests/test-full-cycle.js
```

### Check Status
```bash
# Check deployment
node scripts/management/verify-deployment.js

# Check relayer status
node scripts/relayer-tests/check-status.js
```

---

## Critical Code Locations

| Component | File | Key Lines |
|-----------|------|-----------|
| Replay protection | `contracts/bridges/BridgeEthereum.sol` | Line 143-146 |
| Nonce increment | `contracts/bridges/BridgeEthereum.sol` | Line 122-125 |
| Event emission | `contracts/bridges/BridgeEthereum.sol` | Line 113-120 |
| Event polling | `relayer/src/services/EventListener.js` | Line 34-85 |
| Double-check | `relayer/src/index.js` | Line 154-161 |
| Supply conservation test | `test/integration/bridge-flow.test.js` | Line 74-77 |

---

## Security Checklist

- ✅ ReentrancyGuard on all state-changing functions
- ✅ Pausable for emergency stops
- ✅ Nonce replay protection on both chains
- ✅ Min/max amount limits
- ✅ processedNonces check before execution
- ✅ Supply conservation tests
- ⚠️ Single owner (needs multi-sig for production)
- ⚠️ No signature verification (placeholder only)
- ⚠️ No reorg protection (add confirmation blocks)

---

## Production Gaps

**Need to add:**

1. Multi-sig governance (Gnosis Safe)
2. Fee mechanism (sustain operations)
3. Confirmation blocks (reorg protection)
4. Monitoring & alerts (Grafana/Prometheus)
5. Security audit (Trail of Bits, OpenZeppelin)
6. Insurance fund (cover bugs)
7. Upgrade mechanism (UUPS proxy)

---

## Interview Cheat Sheet

**Q: How do you prevent double-mint?**
> "Nonce-based replay protection stored on-chain. `processedNonces` mapping ensures each cross-chain transfer executes exactly once."

**Q: What if relayer crashes?**
> "Events are permanent in blockchain logs. Relayer tracks last processed block, resumes from there. State manager prevents reprocessing."

**Q: How do multiple relayers coordinate?**
> "They don't need to - blockchain state machine prevents double-execution. First relayer succeeds, others revert. For efficiency, add leader election."

**Q: What's your biggest security concern?**
> "Single owner private key compromise. Would migrate to multi-sig with threshold signatures or optimistic fraud proofs for higher TVL."

**Q: How do you ensure solvency?**
> "Supply conservation invariant: locked tokens on Chain1 must always equal wrapped supply on Chain2. Tested in every integration test."

---

## Debugging Tips

### Relayer not processing events?

```bash
# Check RPC connection
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check relayer logs
cd relayer && pnpm start
# Look for "Started listening" message

# Check if event was emitted
node scripts/relayer-tests/check-status.js
```

### Transaction reverting?

```javascript
// Check if nonce already processed
const isProcessed = await bridge.processedNonces(nonce);
console.log("Nonce processed:", isProcessed);

// Check bridge balance
const balance = await bridge.getLockedBalance();
console.log("Bridge balance:", ethers.formatEther(balance));

// Check if paused
const paused = await bridge.paused();
console.log("Bridge paused:", paused);
```

### Supply mismatch?

```javascript
// Verify invariant
const locked = await bridgeEth.getLockedBalance();
const wrapped = await wrappedToken.totalSupply();
console.log("Locked:", ethers.formatEther(locked));
console.log("Wrapped:", ethers.formatEther(wrapped));
console.log("Match:", locked === wrapped);
```

---

## Next Steps

1. ✅ **Completed 6 phases** - solid foundation
2. 📚 **Deepen knowledge** - study production bridges
3. 🔧 **Add features** - multi-sig, fees, monitoring
4. 🚀 **Deploy testnet** - Sepolia + BSC Testnet
5. 🎨 **Build frontend** - React + wagmi
6. 📝 **Write article** - share your learning
7. 💼 **Apply for jobs** - you're ready!

---

## Resources Quick Links

- [Ethereum JSON-RPC Spec](https://ethereum.org/en/developers/docs/apis/json-rpc/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/5.x/)
- [ethers.js v6 Docs](https://docs.ethers.org/v6/)
- [Hardhat Docs](https://hardhat.org/docs)
- [LayerZero](https://layerzero.network/)
- [Wormhole](https://wormhole.com/)
- [Axelar](https://axelar.network/)

---

**Created from conversation on November 12, 2025**

