# Complete Flow Visualization: User Transfer from Chain 1 → Chain 2

## **FULL LAYER-BY-LAYER BREAKDOWN**

This document provides a complete visualization of how data flows through each layer of the cross-chain bridge system, from user initiation to final confirmation.

---

## **PHASE 1: User Initiates Transfer (Chain 1)**

### **Layer 1: User Application**

```javascript
// Frontend/Wallet - User clicks "Bridge 100 tokens"
const tx = await sourceToken.approve(bridgeAddress, ethers.parseEther('100'));
await tx.wait();

const bridgeTx = await bridgeEthereum.lock(
  '0xBobAddress', // recipient on Chain 2
  ethers.parseEther('100'), // 100 tokens
  ethers.encodeBytes32String('BSC') // target chain
);

// Returns immediately with tx hash
console.log(bridgeTx.hash); // "0xabc123..."
```

**Data at this point:**

```javascript
{
  from: "0xAliceAddress",
  to: "0xBridgeEthereumAddress",
  data: "0x4f37...3200",  // Encoded function call
  value: "0",
  nonce: 42,  // Alice's nonce
  gasLimit: 100000
}
```

---

### **Layer 2: Ethereum Node - Transaction Pool**

```
User's wallet → JSON-RPC → eth_sendRawTransaction
                              ↓
                    ┌─────────────────────┐
                    │  Mempool (Pending)  │
                    │                     │
                    │ Tx: 0xabc123...     │
                    │ From: Alice         │
                    │ Status: Unconfirmed │
                    └─────────────────────┘
                              ↓
                    Miner picks up transaction
```

---

### **Layer 3: EVM Execution (Block 15234567)**

```solidity
// BridgeEthereum.lock() execution starts

Step 1: External call begins
├─ msg.sender = 0xAliceAddress
├─ msg.value = 0
└─ calldata decoded:
   ├─ to = 0xBobAddress
   ├─ amount = 100000000000000000000 (100e18)
   └─ targetChain = 0x4253430000... (bytes32 "BSC")

Step 2: Require checks
require(to != address(0));           // ✓ Pass
require(amount >= minBridgeAmount);  // ✓ Pass (min = 1e18)
require(amount <= maxBridgeAmount);  // ✓ Pass (max = 1000e18)
require(targetChain != bytes32(0));  // ✓ Pass

Step 3: State read (current nonce)
SLOAD(nonce) → 49  // Current value before increment

Step 4: Token transfer (ERC20 call)
token.safeTransferFrom(
  0xAliceAddress,
  0xBridgeEthereumAddress,
  100e18
)
  ├─ ERC20 state changes:
  │  ├─ balanceOf[0xAliceAddress] -= 100e18
  │  │   Before: 500e18 → After: 400e18
  │  └─ balanceOf[0xBridgeEthereumAddress] += 100e18
  │      Before: 5000e18 → After: 5100e18
  └─ Returns: success

Step 5: Event emission (IMPORTANT: This is a LOG operation)
emit Lock(
  0xAliceAddress,      // from (indexed)
  0xBobAddress,        // to (indexed)
  100e18,              // amount
  1731582600,          // timestamp
  49,                  // nonce (indexed)
  0x4253430000...      // targetChain
)
  ↓
LOG3 opcode executed:
├─ topic0: keccak256("Lock(address,address,uint256,uint256,uint256,bytes32)")
│          = 0x7d8d...4a2f
├─ topic1: 0x000...AliceAddress (indexed from)
├─ topic2: 0x000...BobAddress (indexed to)
├─ topic3: 49 (indexed nonce)
└─ data: [100e18, 1731582600, 0x4253430000...]
          (non-indexed params)

Step 6: State write (increment nonce)
SSTORE(nonce, 50)  // 49 + 1
└─ Gas cost: 20000 (cold SSTORE)

Step 7: Return
Function completes successfully
```

---

### **Layer 4: Block Creation & State Changes**

```
Block 15234567 is mined:
┌─────────────────────────────────────────────────────────┐
│ Block Header                                            │
├─────────────────────────────────────────────────────────┤
│ Number: 15234567                                        │
│ Timestamp: 1731582600                                   │
│ State Root: 0xdef456... (Merkle root of all state)     │
│ Receipts Root: 0x789abc... (Merkle root of receipts)   │
│ Logs Bloom: 0x0000...1000... (bloom filter for logs)   │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ Transaction 0xabc123...                                 │
├─────────────────────────────────────────────────────────┤
│ From: 0xAliceAddress                                    │
│ To: 0xBridgeEthereumAddress                            │
│ Status: Success (1)                                     │
│ Gas Used: 85432                                         │
│ Block: 15234567                                         │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ Transaction Receipt (stored in blockchain)              │
├─────────────────────────────────────────────────────────┤
│ transactionHash: 0xabc123...                           │
│ blockNumber: 15234567                                   │
│ status: 1 (success)                                     │
│ logs: [                                                 │
│   {                                                     │
│     address: "0xBridgeEthereumAddress",                │
│     topics: [                                           │
│       "0x7d8d...4a2f",  // Lock event signature        │
│       "0x000...Alice",   // indexed: from              │
│       "0x000...Bob",     // indexed: to                │
│       "0x000...0031"     // indexed: nonce=49          │
│     ],                                                  │
│     data: "0x0000...0064..." // [100e18, ts, target]   │
│   }                                                     │
│ ]                                                       │
└─────────────────────────────────────────────────────────┘
```

**Contract State After Block:**

```javascript
// BridgeEthereum contract storage
Storage Slot 0: nonce = 50
Storage Slot 1: minBridgeAmount = 1e18
Storage Slot 2: maxBridgeAmount = 1000e18
Storage Slot 3+: processedNonces mapping
  ├─ keccak256(49, 3) → false (not used yet)
  └─ keccak256(50, 3) → false

// SourceToken contract storage
Storage mapping (balances):
  ├─ keccak256(AliceAddress, slot) → 400e18
  └─ keccak256(BridgeAddress, slot) → 5100e18
```

**KEY POINT:** The Lock event data is **NOT in contract storage**. It's in the **transaction receipt's logs** which are stored separately in the blockchain but queryable via RPC.

---

## **PHASE 2: Relayer Detects Event (Pull Mechanism)**

### **Layer 5: Relayer Polling Loop**

```javascript
// EventListener.js - Running continuously every 5 seconds

// Time: T+0s (block 15234566 just mined)
async poll() {
  const currentBlock = await provider.getBlockNumber();
  // Returns: 15234566

  if (currentBlock > this.lastBlock) {  // 15234566 > 15234565
    // Query blockchain for events
    const eventFilter = contract.filters.Lock();
    const events = await contract.queryFilter(
      eventFilter,
      15234566,  // fromBlock (lastBlock + 1)
      15234566   // toBlock (currentBlock)
    );

    // Returns: [] (no Lock events in this block)
  }

  this.lastBlock = 15234566;
}

// Time: T+5s
poll() // Runs again
// currentBlock = 15234566, lastBlock = 15234566
// Nothing to process

// Time: T+10s (block 15234567 just mined - contains our Lock event!)
async poll() {
  const currentBlock = await provider.getBlockNumber();
  // Returns: 15234567

  if (15234567 > 15234566) {  // TRUE
    const events = await contract.queryFilter(
      Lock,
      15234567,  // fromBlock
      15234567   // toBlock
    );
```

---

### **Layer 6: RPC Query - eth_getLogs**

```javascript
// Under the hood, queryFilter() makes this RPC call:
{
  method: "eth_getLogs",
  params: [{
    fromBlock: "0xE8D0A7",  // 15234567 in hex
    toBlock: "0xE8D0A7",
    address: "0xBridgeEthereumAddress",
    topics: [
      "0x7d8d...4a2f",  // Lock event signature
      null,             // any 'from'
      null,             // any 'to'
      null              // any 'nonce'
    ]
  }]
}

// Ethereum node searches:
┌──────────────────────────────────────────────┐
│ 1. Bloom filter check (fast)                │
│    Does block 15234567 contain this event?  │
│    Bloom filter says: YES                    │
├──────────────────────────────────────────────┤
│ 2. Load transaction receipts                │
│    Read from disk: receipts for block        │
├──────────────────────────────────────────────┤
│ 3. Filter logs matching criteria            │
│    Found 1 matching log                      │
└──────────────────────────────────────────────┘

// Response returned to relayer:
[
  {
    address: "0xBridgeEthereumAddress",
    topics: [
      "0x7d8d...4a2f",
      "0x000000000000000000000000AliceAddress",
      "0x000000000000000000000000BobAddress",
      "0x0000000000000000000000000000000000000000000000000000000000000031"
    ],
    data: "0x0000000000000000000000000000000000000000000000056bc75e2d63100000000000000000000000000000000000000000000000000000000000006735f6c84253430000000000000000000000000000000000000000000000000000000000",
    blockNumber: "0xE8D0A7",
    transactionHash: "0xabc123...",
    transactionIndex: "0x5",
    blockHash: "0xblock123...",
    logIndex: "0x2",
    removed: false
  }
]
```

---

### **Layer 7: Relayer Decodes Event**

```javascript
// EventListener.js processes the response
const events = await contract.queryFilter(...);
// ethers.js automatically decodes the log data

console.log(events[0]);
// {
//   args: {
//     from: "0xAliceAddress",
//     to: "0xBobAddress",
//     amount: 100000000000000000000n,  // BigInt
//     timestamp: 1731582600n,
//     nonce: 49n,
//     targetChain: "0x4253430000000000000000000000000000000000000000000000000000000000"
//   },
//   address: "0xBridgeEthereumAddress",
//   blockNumber: 15234567,
//   transactionHash: "0xabc123...",
//   ...
// }

// Pass to callback
for (const event of events) {
  const args = [];
  for (let i = 0; i < event.args.length; i++) {
    args.push(event.args[i]);
  }
  args.push(event);  // Add full event object

  await this.callback(...args);
  // Calls: handleLockEvent(from, to, amount, timestamp, nonce, targetChain, event)
}
```

---

### **Layer 8: Relayer Event Handler**

```javascript
// index.js - handleLockEvent()
async handleLockEvent(from, to, amount, timestamp, nonce, targetChain, event) {
  // from = "0xAliceAddress"
  // to = "0xBobAddress"
  // amount = 100000000000000000000n
  // nonce = 49n
  // event.transactionHash = "0xabc123..."

  const txHash = event.transactionHash;
  const txId = `chain1-lock-${nonce}-${txHash}`;
  // txId = "chain1-lock-49-0xabc123..."

  logger.info("🔒 LOCK EVENT DETECTED", {
    from: "0xAliceAddress",
    to: "0xBobAddress",
    amount: "100.0",  // formatted
    nonce: "49",
    txHash: "0xabc123..."
  });

  // Check relayer's in-memory state
  if (this.stateManager.isProcessed(txId)) {
    // Checks: this.processedTransactions.has("chain1-lock-49-0xabc123...")
    // Returns: false (first time seeing this)
    return;
  }

  try {
    // Add to in-memory pending state
    this.stateManager.addPending(txId, {
      from: "0xAliceAddress",
      to: "0xBobAddress",
      amount: "100000000000000000000",
      nonce: "49",
      chain: "chain1"
    });

    // StateManager now has:
    // this.pendingTransactions.set("chain1-lock-49-0xabc123...", {
    //   from: "0xAliceAddress",
    //   to: "0xBobAddress",
    //   amount: "100000000000000000000",
    //   nonce: "49",
    //   chain: "chain1",
    //   timestamp: 1731582650000  // Current time in ms
    // });
```

---

## **PHASE 3: Relayer Checks Chain 2 State**

### **Layer 9: Query Chain 2 Contract State**

```javascript
// Check if nonce already processed on destination
const alreadyProcessed = await this.chain2Bridge.processedNonces(49);

// This makes RPC call:
// {
//   method: "eth_call",
//   params: [{
//     to: "0xBridgeBSCAddress",
//     data: "0x2f6..." // processedNonces(uint256) function signature + 49
//   }, "latest"]
// }

// BSC node executes:
// 1. Load contract code at 0xBridgeBSCAddress
// 2. Execute processedNonces(49) view function
// 3. SLOAD(keccak256(49, storageSlot)) → 0 (false)
// 4. Return: 0x0000...0000 (false)

// Returns: false (not processed yet)

if (alreadyProcessed) {
  // Skip if already processed
  return;
}

// Create signature (placeholder for now)
const signature = await this.chain2Executor.createSignature(
  '0xBobAddress',
  100000000000000000000n,
  49n
);
// Returns: "0x00" (empty bytes for now)
```

---

## **PHASE 4: Relayer Submits to Chain 2**

### **Layer 10: Build & Sign Transaction**

```javascript
    // Mint on Chain 2
    logger.info("Minting wrapped tokens on Chain 2...");
    await this.chain2Executor.execute("mint", [
      "0xBobAddress",
      100000000000000000000n,
      49n,
      "0x00"
    ]);

    // Inside TransactionExecutor.execute():
    async execute(method, params) {
      // Build transaction
      const tx = await this.contract[method].populateTransaction(...params);
      // {
      //   to: "0xBridgeBSCAddress",
      //   data: "0x40c10f19..." // mint(address,uint256,uint256,bytes) encoded
      //   from: "0xRelayerAddress"
      // }

      // Estimate gas
      const gasLimit = await this.wallet.estimateGas(tx);
      // Returns: 120000

      // Get gas price
      const feeData = await this.wallet.provider.getFeeData();
      // Returns: { gasPrice: 5000000000n } // 5 gwei

      // Add gas params
      tx.gasLimit = gasLimit;
      tx.gasPrice = feeData.gasPrice;
      tx.nonce = await this.wallet.getNonce();  // Relayer's nonce on BSC
      // Returns: 125

      // Sign transaction
      const signedTx = await this.wallet.signTransaction(tx);
      // Uses relayer's private key to sign
      // Returns: "0xf86c7d8502..." (RLP-encoded signed tx)

      // Send to network
      const response = await this.wallet.provider.broadcastTransaction(signedTx);
      // RPC: eth_sendRawTransaction("0xf86c7d8502...")

      // Wait for confirmation
      const receipt = await response.wait();
      return receipt;
    }
```

---

### **Layer 11: Chain 2 (BSC) Execution**

```
BSC Mempool receives transaction
          ↓
Block 42345678 is mined
          ↓
EVM executes BridgeBSC.mint()
```

```solidity
// BridgeBSC.mint() execution

Step 1: Call starts
├─ msg.sender = 0xRelayerAddress
└─ params:
   ├─ to = 0xBobAddress
   ├─ amount = 100e18
   ├─ sourceNonce = 49
   └─ signature = 0x00

Step 2: Require checks
require(to != address(0));                    // ✓ Pass
require(amount >= minBridgeAmount);           // ✓ Pass
require(amount <= maxBridgeAmount);           // ✓ Pass
require(!processedNonces[sourceNonce]);       // ✓ Pass (49 not processed)
require(msg.sender == owner);                 // ✓ Pass (relayer is owner)

Step 3: State write - Mark nonce as processed
SSTORE(processedNonces[49], true)
├─ Storage location: keccak256(49, 1) = 0xabc...def
├─ Before: 0 (false)
├─ After: 1 (true)
└─ Gas: 20000 (cold SSTORE)

Step 4: External call - Mint wrapped tokens
token.mint(0xBobAddress, 100e18)
  ├─ Calls WrappedToken contract
  ├─ WrappedToken.mint() executes:
  │  ├─ require(msg.sender == bridge)  // ✓ Pass
  │  ├─ _mint(0xBobAddress, 100e18)
  │  │  ├─ totalSupply += 100e18
  │  │  │   Before: 5000e18 → After: 5100e18
  │  │  └─ balanceOf[0xBobAddress] += 100e18
  │  │      Before: 200e18 → After: 300e18
  │  └─ emit Transfer(address(0), 0xBobAddress, 100e18)
  └─ Returns: success

Step 5: Emit event
emit Mint(
  0xBobAddress,     // to (indexed)
  100e18,           // amount
  1731582660,       // timestamp
  49                // sourceNonce (indexed)
)
  ↓
LOG2 opcode:
├─ topic0: keccak256("Mint(address,uint256,uint256,uint256)")
├─ topic1: 0x000...BobAddress (indexed to)
├─ topic2: 49 (indexed sourceNonce)
└─ data: [100e18, 1731582660]

Step 6: Return
Function completes successfully
```

---

### **Layer 12: Chain 2 Block & Receipt**

```
┌─────────────────────────────────────────────────────────┐
│ BSC Block 42345678                                      │
├─────────────────────────────────────────────────────────┤
│ State Root: 0xnew456...                                 │
│ Receipts Root: 0xnew789...                              │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ Transaction Receipt                                     │
├─────────────────────────────────────────────────────────┤
│ transactionHash: 0xdef456...                           │
│ blockNumber: 42345678                                   │
│ from: 0xRelayerAddress                                  │
│ to: 0xBridgeBSCAddress                                  │
│ status: 1 (success)                                     │
│ logs: [                                                 │
│   {                                                     │
│     address: "0xWrappedTokenAddress",                  │
│     topics: ["0xddf...252", "0x000", "0x000...Bob"],  │
│     data: "0x...100e18..." // Transfer event           │
│   },                                                    │
│   {                                                     │
│     address: "0xBridgeBSCAddress",                     │
│     topics: [                                           │
│       "0x123...abc",  // Mint event signature          │
│       "0x000...Bob",  // indexed: to                   │
│       "0x000...0031"  // indexed: sourceNonce=49       │
│     ],                                                  │
│     data: "0x...100e18...timestamp..."                 │
│   }                                                     │
│ ]                                                       │
└─────────────────────────────────────────────────────────┘
```

**BridgeBSC State After:**

```javascript
Storage Slot 0: nonce = 0 (not incremented, only burns increment)
Storage Slot 1: processedNonces mapping
  └─ keccak256(49, 1) → true  // ← CRITICAL: Prevents replay

// WrappedToken State:
totalSupply: 5100e18
balanceOf[0xBobAddress]: 300e18
```

---

### **Layer 13: Relayer Receives Confirmation**

```javascript
    // Back in handleLockEvent()
    const receipt = await this.chain2Executor.execute(...);

    // Receipt returned:
    // {
    //   transactionHash: "0xdef456...",
    //   blockNumber: 42345678,
    //   status: 1,
    //   gasUsed: 118234,
    //   logs: [...]
    // }

    logger.info("✅ Mint successful!", {
      to: "0xBobAddress",
      amount: "100.0",
      nonce: "49"
    });

    // Mark as processed in relayer's memory
    this.stateManager.markProcessed(txId);

    // StateManager changes:
    // this.processedTransactions.add("chain1-lock-49-0xabc123...")
    // this.pendingTransactions.delete("chain1-lock-49-0xabc123...")

  } catch (error) {
    logger.error("Failed to process Lock event", { error });
    this.stateManager.markFailed(txId, error);
  }
}
```

---

## **COMPLETE DATA TRANSFORMATION TIMELINE**

```
T+0s: User clicks "Bridge"
├─ Input: { to: "Bob", amount: "100" }
└─ Output: Unsigned transaction object

T+1s: Wallet signs & broadcasts
├─ Input: Transaction object
└─ Output: Transaction hash "0xabc123..."

T+12s: Block 15234567 mined on Chain 1
├─ Input: Transaction in mempool
└─ Output: Receipt with Lock event log
   └─ Storage: nonce = 50, Alice balance = 400, Bridge balance = 5100

T+17s: Relayer polls Chain 1
├─ Input: RPC query eth_getLogs(15234567)
└─ Output: Array of log objects

T+18s: Relayer decodes event
├─ Input: Raw log data (topics + data)
└─ Output: Decoded event args

T+19s: Relayer queries Chain 2 state
├─ Input: eth_call(processedNonces(49))
└─ Output: false

T+20s: Relayer builds Chain 2 transaction
├─ Input: mint(Bob, 100e18, 49, 0x00)
└─ Output: Signed transaction "0xdef456..."

T+23s: Block 42345678 mined on Chain 2
├─ Input: Mint transaction
└─ Output: Receipt with Mint event
   └─ Storage: processedNonces[49] = true, Bob balance = 300

T+24s: Relayer receives confirmation
├─ Input: Transaction receipt
└─ Output: StateManager updated

Final State:
Chain 1: Alice has 400 tokens, Bridge has 5100 tokens, nonce = 50
Chain 2: Bob has 300 wrapped tokens, processedNonces[49] = true
Relayer: "chain1-lock-49-0xabc123..." in processedTransactions Set
```

---

## **KEY INSIGHTS**

### **1. Events are NOT pushed**

The relayer actively polls every 5 seconds using `queryFilter()`. There's no websocket or push mechanism.

### **2. Events live in receipts, not contract storage**

Lock/Burn/Mint events are stored in transaction receipts as logs, accessible via `eth_getLogs` RPC calls. They don't consume contract storage slots.

### **3. Two nonces exist**

- **Chain 1 nonce**: Incremented after each Lock (50 after this transaction)
- **sourceNonce**: The nonce value transferred to Chain 2 (49 in this example)

### **4. Three places track processing**

- **Chain 2 contract**: `processedNonces[49] = true` (permanent, prevents replay)
- **Relayer memory**: `processedTransactions.has(...)` (volatile, prevents duplicate work)
- **Blockchain logs**: Lock & Mint events (queryable forever)

### **5. Data never "moves"**

Data is copied and transformed at each layer. The original Lock event remains queryable on Chain 1 forever.

### **6. Relayer is the only active component**

Contracts are passive, waiting for calls. The relayer is the active orchestrator pulling events and pushing transactions.

---

## **CRITICAL LIMITATIONS**

### **Relayer State Loss on Restart**

The current implementation has a critical bug: `EventListener.lastBlock` is not persisted. On restart, the relayer starts from the current block, missing all events that occurred while it was down.

**Current behavior:**

```javascript
async start() {
  // PROBLEM: Always starts from current block
  this.lastBlock = await this.provider.getBlockNumber();
}
```

**Required fix:**

```javascript
async start() {
  // Load from persistent storage or use deployment block
  this.lastBlock = await this.loadCheckpoint() || config.deploymentBlock;
}
```

See `BRIDGE-DATA-FLOW-VISUALIZATION.md` for detailed restart scenarios and fixes.

---

## **STORAGE LOCATIONS SUMMARY**

| Data                      | Location             | Type                 | Persistent?  |
| ------------------------- | -------------------- | -------------------- | ------------ |
| `nonce` counter           | Contract state       | Storage slot         | ✅ Yes       |
| `processedNonces` mapping | Contract state       | Storage mapping      | ✅ Yes       |
| Token balances            | Token contract state | ERC20 balanceOf      | ✅ Yes       |
| `Lock/Burn` events        | Blockchain logs      | Transaction receipts | ✅ Yes       |
| `Mint/Unlock` events      | Blockchain logs      | Transaction receipts | ✅ Yes       |
| Relayer `lastBlock`       | Off-chain memory     | Variable             | ❌ No (BUG!) |
| Relayer processed txs     | Off-chain memory     | In-memory Set        | ❌ No        |
| Event parameters          | Not stored           | Passed via logs      | N/A          |

---

## **ARCHITECTURE DIAGRAM**

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHAIN 1 (Ethereum)                      │
│  ┌──────────┐        ┌─────────────────┐      ┌──────────────┐ │
│  │   User   │───────▶│ BridgeEthereum  │─────▶│ SourceToken  │ │
│  │  (Alice) │  lock()│   Contract      │transfer│  Contract   │ │
│  └──────────┘        └─────────────────┘      └──────────────┘ │
│                              │                                   │
│                              │ Emits Lock event                  │
│                              ▼                                   │
│                      ┌───────────────┐                          │
│                      │ Transaction   │                          │
│                      │   Receipt     │◀─ Queryable via RPC      │
│                      └───────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Polls via eth_getLogs
                               │ (every 5 seconds)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RELAYER (Off-chain)                      │
│  ┌────────────────┐   ┌─────────────────┐   ┌───────────────┐ │
│  │ EventListener  │──▶│ BridgeRelayer   │──▶│ StateManager  │ │
│  │   (polling)    │   │  (orchestrator) │   │  (in-memory)  │ │
│  └────────────────┘   └─────────────────┘   └───────────────┘ │
│                              │                                   │
│                              │ Submits mint() transaction        │
│                              ▼                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ eth_sendRawTransaction
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CHAIN 2 (BSC)                           │
│  ┌──────────┐        ┌─────────────────┐      ┌──────────────┐ │
│  │ Relayer  │───────▶│   BridgeBSC     │─────▶│ WrappedToken │ │
│  │ (owner)  │  mint()│   Contract      │ mint()│  Contract   │ │
│  └──────────┘        └─────────────────┘      └──────────────┘ │
│                              │                        │          │
│                              │                        ▼          │
│                              │              Bob receives tokens  │
│                              ▼                                   │
│                      ┌───────────────┐                          │
│                      │ Transaction   │                          │
│                      │   Receipt     │                          │
│                      └───────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

This architecture is **event-driven** and uses blockchain as the **source of truth** via logs. The relayer queries historical data and can theoretically recover from any state by replaying events from blockchain logs.
