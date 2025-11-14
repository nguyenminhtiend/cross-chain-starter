# Bridge Data Flow Summary (Without Code)

Quick reference guide showing how data flows through the cross-chain bridge system.

---

## **Complete Flow: Chain 1 → Chain 2**

### **Phase 1: User Initiates Lock (Chain 1)**

```
User Action → Mempool → Block Mined → State Changed
```

**Data Flow:**
```
Input:  { to: Bob, amount: 100, targetChain: BSC }
        ↓
Transaction Submitted
        ↓
Block 15234567 Mined
        ↓
State Changes:
├─ BridgeEthereum.nonce: 49 → 50
├─ Alice balance: 500 → 400 tokens
├─ Bridge balance: 5000 → 5100 tokens
└─ Lock event emitted → stored in transaction receipt (NOT state)
```

**Lock Event Contains:**
- from: Alice
- to: Bob
- amount: 100
- timestamp: 1731582600
- nonce: 49
- targetChain: BSC

---

### **Phase 2: Relayer Detects Event (Pull Model)**

```
Poll (T+0s) → Poll (T+5s) → Poll (T+10s) → Event Found!
```

**Data Flow:**
```
Relayer polls every 5 seconds
        ↓
eth_getLogs RPC call
        ↓
Node searches blockchain logs
├─ Check bloom filter (fast)
├─ Load transaction receipts
└─ Filter matching events
        ↓
Returns: Lock event data
        ↓
Relayer decodes:
├─ from: 0xAliceAddress
├─ to: 0xBobAddress
├─ amount: 100000000000000000000n
└─ nonce: 49n
        ↓
Handler processes event
```

**Relayer Memory Changes:**
```
StateManager.pendingTransactions.set("chain1-lock-49-...", {
  from: Alice,
  to: Bob,
  amount: 100,
  nonce: 49,
  chain: "chain1",
  timestamp: 1731582650000
})
```

---

### **Phase 3: Relayer Checks Chain 2**

```
Query State → Check Nonce → Prepare Transaction
```

**Data Flow:**
```
eth_call: processedNonces(49)
        ↓
Chain 2 executes view function
        ↓
SLOAD(processedNonces[49]) → false
        ↓
Returns: not processed yet
        ↓
Create signature (currently empty: 0x00)
```

---

### **Phase 4: Relayer Submits to Chain 2**

```
Build Tx → Sign → Broadcast → Mined → State Changed
```

**Data Flow:**
```
Input:  mint(Bob, 100, sourceNonce=49, signature)
        ↓
Transaction signed by relayer
        ↓
Broadcast to BSC network
        ↓
Block 42345678 mined
        ↓
State Changes:
├─ BridgeBSC.processedNonces[49]: false → true
├─ WrappedToken.totalSupply: 5000 → 5100
├─ Bob balance: 200 → 300 wrapped tokens
└─ Mint event emitted → stored in receipt
        ↓
Relayer receives confirmation
        ↓
StateManager updates:
├─ processedTransactions.add("chain1-lock-49-...")
└─ pendingTransactions.delete("chain1-lock-49-...")
```

---

## **Complete Timeline**

| Time | Layer | Action | Data State |
|------|-------|--------|------------|
| T+0s | User | Click "Bridge 100" | Intent only |
| T+1s | User Wallet | Sign & broadcast | Tx hash: 0xabc... |
| T+12s | Chain 1 EVM | Execute lock() | nonce=50, Alice-100, Bridge+100 |
| T+12s | Chain 1 Receipt | Store logs | Lock event in receipt |
| T+17s | Relayer | Poll & detect | Event decoded |
| T+18s | Relayer | Add to pending | In-memory state updated |
| T+19s | Relayer | Query Chain 2 | processedNonces[49]=false |
| T+20s | Relayer | Submit mint tx | Tx hash: 0xdef... |
| T+23s | Chain 2 EVM | Execute mint() | processedNonces[49]=true, Bob+100 |
| T+23s | Chain 2 Receipt | Store logs | Mint event in receipt |
| T+24s | Relayer | Confirmation | Mark as processed |

**Total Time:** ~24 seconds

---

## **Data Storage Architecture**

### **On-Chain (Permanent)**

**Chain 1 Contract State:**
```
├─ nonce: 50
├─ processedNonces mapping: { /* replay protection for unlocks */ }
├─ minBridgeAmount: 1e18
└─ maxBridgeAmount: 1000e18
```

**Chain 1 Transaction Receipts (Logs):**
```
Lock events:
├─ Event signature + indexed params in topics
├─ Non-indexed params in data
└─ Queryable via eth_getLogs forever
```

**Chain 2 Contract State:**
```
├─ nonce: 0 (only burns increment)
├─ processedNonces[49]: true  ← CRITICAL for replay protection
├─ minBridgeAmount: 1e18
└─ maxBridgeAmount: 1000e18
```

**Chain 2 Transaction Receipts (Logs):**
```
Mint events:
├─ sourceNonce: 49
├─ to: Bob
└─ amount: 100
```

### **Off-Chain (Volatile)**

**Relayer Memory:**
```
├─ lastBlock: 15234567 (NOT PERSISTED - BUG!)
├─ processedTransactions: Set("chain1-lock-49-...", ...)
├─ pendingTransactions: Map(...)
└─ failedTransactions: Map(...)
```

**What gets lost on restart:**
- lastBlock → starts from current, misses old events
- processedTransactions → can cause duplicate work attempts
- pendingTransactions → in-flight operations lost
- failedTransactions → error history lost

---

## **Event Data Structure**

### **Lock Event (Chain 1)**
```
Event Signature: Lock(address indexed from, address indexed to, uint256 amount, ...)

Storage in Receipt:
├─ topics[0]: event signature hash
├─ topics[1]: from (indexed)
├─ topics[2]: to (indexed)
├─ topics[3]: nonce (indexed)
└─ data: [amount, timestamp, targetChain] (non-indexed, packed)

Size: ~300 bytes per event
Cost: ~375 gas per topic, ~8 gas per byte of data
```

### **Mint Event (Chain 2)**
```
Event Signature: Mint(address indexed to, uint256 amount, uint256 timestamp, uint256 indexed sourceNonce)

Storage in Receipt:
├─ topics[0]: event signature hash
├─ topics[1]: to (indexed)
├─ topics[2]: sourceNonce (indexed)
└─ data: [amount, timestamp] (non-indexed)
```

---

## **Data Transformation Journey**

### **User Input → Chain 1 Storage**
```
User: "Bridge 100 to Bob on BSC"
↓
Wallet: { to: Bob, amount: 100e18, targetChain: "BSC" }
↓
EVM: Token transfer + nonce increment + event emission
↓
Storage: nonce=50, balances updated
Receipt: Lock event with all details
```

### **Chain 1 Logs → Relayer Memory**
```
Receipt Logs: Raw bytes (topics + data)
↓
eth_getLogs: Returns log objects
↓
ethers.js: Decodes to JavaScript objects
↓
Relayer: { from, to, amount, nonce, timestamp }
↓
StateManager: In-memory Set/Map tracking
```

### **Relayer Memory → Chain 2 Storage**
```
Relayer Memory: { to: Bob, amount: 100, nonce: 49 }
↓
Build Tx: mint(Bob, 100e18, 49, 0x00)
↓
Sign & Broadcast: RLP-encoded transaction
↓
EVM Execution: processedNonces[49]=true, mint tokens
↓
Storage: Nonce marked, Bob balance +100
Receipt: Mint event confirming action
```

---

## **Critical Data Dependencies**

### **Nonce System**
```
Chain 1 nonce (50):
├─ Incremented after each Lock
├─ Used for outgoing transactions
└─ Never reused

sourceNonce (49):
├─ Copied from Chain 1's previous nonce
├─ Transferred to Chain 2 as identifier
├─ Marked in Chain 2's processedNonces
└─ Prevents replay attacks
```

### **Three-Layer Tracking**
```
1. Chain 2 State (authoritative):
   processedNonces[49] = true
   └─ Permanent, prevents actual replays

2. Relayer Memory (optimization):
   processedTransactions.has("chain1-lock-49-...")
   └─ Volatile, prevents duplicate work

3. Blockchain Logs (audit trail):
   Lock + Mint events forever queryable
   └─ Permanent, source of truth for recovery
```

---

## **Key Insights**

### **1. Pull Model, Not Push**
- Relayer polls every 5 seconds
- No websockets or push notifications
- eth_getLogs queries historical data
- Always at least 5-10 second delay

### **2. Events ≠ State**
- Events stored in transaction receipts
- NOT in contract storage slots
- Cheaper than storage (logs vs SSTORE)
- Queryable but not accessible from contracts

### **3. Data Never Moves**
- Lock event stays on Chain 1 forever
- Mint event stays on Chain 2 forever
- Data is copied and transformed
- No deletion, only addition

### **4. Two Nonce Counters**
- Each bridge has its own nonce
- Chain 1 tracks outgoing Locks
- Chain 2 tracks outgoing Burns
- sourceNonce links cross-chain operations

### **5. Relayer is Orchestrator**
- Only active component
- Contracts are passive
- Reads from Chain 1, writes to Chain 2
- Single point of failure

### **6. State vs Logs Tradeoff**
```
Contract Storage (State):
✅ Accessible from contracts
✅ Permanent, part of state root
❌ Expensive (20k gas for new slot)
❌ Not easily queryable off-chain

Transaction Logs (Events):
✅ Cheap (~375 gas per topic)
✅ Easily queryable off-chain
✅ Good for historical data
❌ NOT accessible from contracts
❌ Not part of state root
```

---

## **Critical Bug: Relayer Restart**

### **Current Behavior**
```
Block 100: Relayer running (lastBlock = 100)
Block 101: Lock event emitted
Block 102: Lock event emitted
Block 103: RELAYER CRASHES 💥
Blocks 104-200: Relayer down
Block 201: Relayer RESTARTS
          └─ lastBlock = 201 (current block)
          └─ Events 101-200 LOST FOREVER
```

### **Why On-Chain Protection Doesn't Help**
```
processedNonces[49] = false (was never processed)
processedNonces[50] = false (was never processed)
↓
Nonces marked as "not processed" ✓
Events exist in blockchain logs ✓
BUT relayer never queries those blocks ✗
↓
User funds STUCK on Chain 1
```

### **Required Fix**
```
Persist lastBlock to disk/database:
├─ On startup: Load from persistent storage
├─ Fallback: Use contract deployment block
└─ After processing: Save checkpoint

This enables:
├─ Safe restarts (continue from last position)
├─ Recovery from crashes
└─ No missed events
```

---

## **Architecture Summary**

```
┌─────────────────────────────────────────────────┐
│           CHAIN 1 (Source Chain)                │
│                                                 │
│  [User] → [Bridge] → [Token Contract]          │
│                ↓                                │
│          Lock Event → Transaction Receipt       │
│                       (stored in logs)          │
└──────────────────────┬──────────────────────────┘
                       │
                 Polls via RPC
              (every 5 seconds)
                       │
┌──────────────────────┴──────────────────────────┐
│              RELAYER (Off-chain)                │
│                                                 │
│  [EventListener] → [BridgeRelayer] → [StateManager]
│   - Polls logs      - Orchestrates    - Tracks state
│   - Decodes events  - Validates       - In-memory
│                     - Submits txs                │
│                                                 │
└──────────────────────┬──────────────────────────┘
                       │
                Submits transaction
              (eth_sendRawTransaction)
                       │
┌──────────────────────┴──────────────────────────┐
│           CHAIN 2 (Destination Chain)           │
│                                                 │
│  [Relayer] → [Bridge] → [Wrapped Token]        │
│                   ↓                             │
│             Mint Event → Transaction Receipt    │
│                          (stored in logs)       │
└─────────────────────────────────────────────────┘
```

### **Data Flow Direction**
```
User → Chain 1 → Logs → Relayer → Chain 2 → User
     (lock)    (emit)  (poll)   (mint)    (receive)
```

### **Active vs Passive Components**
```
Active (pulls/pushes):
└─ Relayer (only component that initiates actions)

Passive (waits for calls):
├─ BridgeEthereum (waits for user lock)
├─ BridgeBSC (waits for relayer mint)
├─ SourceToken (waits for transfers)
└─ WrappedToken (waits for mint/burn)
```

---

## **Storage Location Summary**

| What | Where | Why | Persistent? |
|------|-------|-----|-------------|
| Token balances | Contract state | Needs on-chain consensus | ✅ Yes |
| Nonces | Contract state | Replay protection | ✅ Yes |
| processedNonces | Contract state | Authoritative check | ✅ Yes |
| Lock events | Transaction logs | Cheap, queryable | ✅ Yes |
| Mint events | Transaction logs | Cheap, queryable | ✅ Yes |
| Relayer lastBlock | **Nowhere (BUG)** | Should be in DB/file | ❌ No |
| Relayer state | Memory | Optimization only | ❌ No |

---

## **Recovery Mechanisms**

### **Blockchain is Source of Truth**
```
If relayer loses state:
1. Query Lock events from deployment block
2. Query Mint events to find processed nonces
3. Reconcile: which Locks don't have corresponding Mints
4. Reprocess missing events
5. Continue normal operation
```

### **Manual Recovery Process**
```
1. Identify gap: blocks X to Y
2. Query eth_getLogs for Lock events in range
3. For each Lock event:
   ├─ Check processedNonces on Chain 2
   ├─ If false: Submit mint transaction
   └─ If true: Skip (already processed)
4. Update relayer checkpoint to block Y
```

### **Automatic Recovery (Requires Implementation)**
```
On startup:
1. Load lastProcessedBlock from persistent storage
2. If not found: Start from deployment block
3. Query all Lock events from lastBlock to current
4. Filter out already processed (check on-chain)
5. Process remaining events
6. Resume normal polling
```

---

## **Production Readiness Checklist**

**Storage:**
- ❌ Persist relayer lastBlock checkpoint
- ❌ Persist processed transaction history
- ❌ Database for audit trail

**Reliability:**
- ❌ Automatic recovery on restart
- ❌ Handle chain reorganizations
- ❌ Retry failed transactions

**Monitoring:**
- ✅ Log all events (basic)
- ❌ Alert on stuck transactions
- ❌ Track bridge balance mismatches
- ❌ Monitor relayer wallet balance

**Security:**
- ❌ Multi-sig for bridge operations (currently single owner)
- ❌ Rate limiting
- ❌ Signature verification (placeholder only)

---

This is a starter implementation. The core flow works but needs significant hardening for production use.

