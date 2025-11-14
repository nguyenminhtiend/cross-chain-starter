# Ethereum Fundamentals: A Deep Dive

**Complete Guide to Understanding Blockchain Internals**

This document covers the fundamental concepts of how Ethereum works, from DEXes to transaction execution to validator consensus.

---

## Table of Contents

1. [DEX & Uniswap Explained](#dex--uniswap-explained)
2. [State vs Blocks](#state-vs-blocks)
3. [Transaction Lifecycle](#transaction-lifecycle)
4. [Validator Communication & Consensus](#validator-communication--consensus)

---

# DEX & Uniswap Explained

## What is a DEX?

**DEX = Decentralized Exchange**

A currency exchange booth running on smart contracts with:
- ❌ No company running it
- ❌ No human traders
- ✅ Just automated smart contracts

### CEX vs DEX Comparison

**Centralized Exchange (Coinbase, Binance):**
```
You → Give money to Coinbase → Coinbase holds it → You trust them
```
- They control your funds
- Requires account creation & identity verification
- Can freeze your account
- Vulnerable to hacks (Mt. Gox, FTX)

**Decentralized Exchange (Uniswap):**
```
You → Keep control of money → Smart contract swaps directly → Done
```
- You always control your funds
- No account needed
- No one can freeze anything
- Just code, no company

## Why ChainSwap Needs a DEX

### Without DEX Integration:
```
Bridge creates wrappedUSDC
↓
User stuck with wrappedUSDC
↓
User must manually:
1. Find an exchange
2. Connect wallet / Create account
3. Swap wrappedUSDC → ETH
4. Pay gas fees again
5. Wait for another transaction
```

### With DEX Integration:
```
Bridge creates wrappedUSDC
↓
Smart contract automatically swaps wrappedUSDC → ETH
↓
User receives ETH
↓
All in ONE transaction!
```

## How Uniswap Works

### 1. Liquidity Pools (Token Vaults)

```
Pool = Container with two tokens

Example: ETH/USDC Pool
┌─────────────────┐
│  100 ETH        │
│  200,000 USDC   │
└─────────────────┘

Anyone can add tokens → Earn fees
```

### 2. Automatic Pricing

Uniswap uses a simple formula:
```
Price = Amount of Token B / Amount of Token A

If pool has:
- 100 ETH
- 200,000 USDC

Then: 1 ETH = 2,000 USDC
```

### 3. Trading Example

```
You want to swap 1 ETH for USDC

Pool BEFORE:
┌─────────────────┐
│  100 ETH        │
│  200,000 USDC   │
└─────────────────┘

You add: 1 ETH
You take: ~1,980 USDC (slightly less due to slippage)

Pool AFTER:
┌─────────────────┐
│  101 ETH        │
│  198,020 USDC   │
└─────────────────┘
```

## Where Are Pools Stored?

### Smart Contracts on the Blockchain

Each trading pair has its own contract:

```
ETH/USDC Pool = One Smart Contract
┌─────────────────────────────┐
│ Contract Address:           │
│ 0xb4e16d0168e52d35...       │
│                             │
│ Holds:                      │
│ - 50,000 ETH                │
│ - 100,000,000 USDC          │
└─────────────────────────────┘
```

**Real Example - Ethereum Mainnet:**
```
Contract Address: 0xB4e16d0168e52d35CaeCd2a687f0a9F3e4f2e4B2
Location: Ethereum blockchain
Storage: ~$150 million worth of tokens
```

### Different Chains = Different Pools

```
Ethereum Mainnet:
├── Uniswap Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
├── ETH/USDC Pool: 0xB4e16d0168e52d35...
│   └── Holds: 50,000 ETH + 100M USDC
└── DAI/USDC Pool: 0xAE461cA67B15dc8d...
    └── Holds: 20M DAI + 20M USDC

Arbitrum:
├── Uniswap Router: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506
├── ETH/USDC Pool: 0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443
│   └── Holds: 5,000 ETH + 10M USDC
└── Different pools, different amounts!
```

## ChainSwap Integration Example

```solidity
// Your bridge contract calls Uniswap
uniswapRouter.swapExactTokensForTokens(
    1000,              // 1000 USDC
    [USDC, WETH],      // Path
    userAddress,
    deadline
);

// Behind the scenes:
// 1. Router finds USDC/WETH pool contract
// 2. Transfers 1000 USDC TO pool
// 3. Pool calculates: "You get 0.5 WETH"
// 4. Pool transfers 0.5 WETH to user
// 5. Pool updates reserves
```

## Why Uniswap Specifically?

1. **Universal Presence** - Exists on all major EVM chains
2. **No Permission Needed** - Anyone can call it
3. **Battle-Tested** - $1+ trillion traded since 2018
4. **Deep Liquidity** - Can handle large trades efficiently

---

# State vs Blocks

## The Critical Distinction

Smart contracts live in **STATE**, not in blocks!

```
┌─────────────────────────────────────┐
│         BLOCKCHAIN                  │
│                                     │
│  ┌───────────────────────────────┐ │
│  │     BLOCKS (History)          │ │  ← Immutable transaction log
│  │  - What happened              │ │
│  │  - When it happened           │ │
│  │  - Who did it                 │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │     STATE (Current)           │ │  ← Smart contracts live HERE
│  │  - Current balances           │ │
│  │  - Current storage            │ │
│  │  - Current code               │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## BLOCKS = The Ledger (History)

Think of blocks as a **diary** or **transaction log**:

```
Block #18,000,000:
├── Transaction 1: Alice sent 1 ETH to Bob
├── Transaction 2: Bob called swap() on Uniswap
├── Transaction 3: Charlie deployed a contract
└── Transaction 4: Dave minted an NFT

Block #18,000,001:
├── Transaction 1: Eve locked tokens on bridge
├── Transaction 2: Frank approved USDC
└── ...
```

**Blocks contain:**
- ✅ Transactions (what people DID)
- ✅ Timestamps (when they did it)
- ✅ Signatures (proof they authorized it)
- ❌ NO current balances
- ❌ NO current contract storage
- ❌ NO smart contract code

## STATE = The Database (Current Reality)

```
Current State (Block #18,000,001):
├── Alice's balance: 10.5 ETH
├── Bob's balance: 3.2 ETH
├── Uniswap Pool Contract (0xB4e16...):
│   ├── reserve0: 50,000 ETH
│   ├── reserve1: 100,000,000 USDC
│   └── Code: [bytecode of swap function]
└── Your Bridge Contract (0x742d...):
    ├── lockedAmount: 1,000,000 tokens
    ├── processedNonces: {123: true, 124: true}
    └── Code: [bytecode of lock/mint functions]
```

**State contains:**
- ✅ All account balances RIGHT NOW
- ✅ All contract storage RIGHT NOW
- ✅ All smart contract code
- ❌ NO history of how we got here

## Analogy: Bank Account

```
BLOCKS = Bank Statement (History)
Jan 1: Deposit $1,000
Jan 5: Withdraw $200
Jan 10: Deposit $500
Jan 15: Withdraw $100

STATE = Current Balance
Balance: $1,200
```

You can throw away the statement and still know you have $1,200.
But you can't recreate the statement from just the balance.

## The State Trie (Merkle Patricia Trie)

Ethereum uses a tree structure:

```
World State Root
├── Account 0x1234... (Alice)
│   ├── Balance: 10.5 ETH
│   ├── Nonce: 42
│   ├── Code Hash: 0x000... (no code)
│   └── Storage Root: 0x000... (no storage)
│
├── Account 0xB4e16... (Uniswap Pool)
│   ├── Balance: 0 ETH
│   ├── Nonce: 1
│   ├── Code Hash: 0xabc123...
│   └── Storage Root: 0xdef456...
│       ├── Slot 0: reserve0 = 50000 ETH
│       ├── Slot 1: reserve1 = 100000000 USDC
│       └── ...
│
└── Account 0x742d... (Your Bridge)
    ├── Balance: 0 ETH
    ├── Nonce: 1
    ├── Code Hash: 0x789xyz...
    └── Storage Root: 0x321abc...
        ├── Slot 0: owner = 0x...
        ├── Slot 1: wrappedToken = 0x...
        ├── Slot 2: lockedAmount = 1000000
        └── Mapping slots:
            ├── processedNonces[123] = true
            └── processedNonces[124] = true
```

## How Blocks Update State

```
1. Transaction submitted (in memory pool)
   ↓
2. Miner/Validator includes tx in block
   ↓
3. EVM executes transaction
   - Read state: lockedAmount = 900
   - Update state: lockedAmount = 1000
   ↓
4. State changes committed
   - New state: lockedAmount = 1000
   ↓
5. New state root calculated
   - State Root: 0xnew_hash...
   ↓
6. State root stored in block header
   - Block Header links to new state
```

## Physical Storage

```
Ethereum Node Storage:
/ethereum/
├── blocks/
│   ├── 00000001.blk  ← Block data (transactions)
│   ├── 00000002.blk
│   └── ... (~600 GB)
│
├── state/
│   └── leveldb/  ← STATE TRIE stored here
│       ├── Account states
│       ├── Contract storage
│       └── Contract code (~200 GB)
│
└── Total: ~800 GB (full node)
```

## State Pruning

```
Problem: State history grows forever

Full Node (Pruned):
- Keeps: Current state only (200 GB)
- Keeps: All blocks (600 GB)
- Can: Verify all history
- Cannot: Query old state

Archive Node (Unpruned):
- Keeps: All historical states (Terabytes)
- Keeps: All blocks (600 GB)
- Can: Query "What was balance at block 1M?"
- Cost: Much more storage
```

## Summary

| Aspect | BLOCKS | STATE |
|--------|--------|-------|
| **Contains** | Transaction history | Current balances & storage |
| **Smart Contracts** | No | Yes (code + storage) |
| **Mutable** | No (immutable) | Yes (changes each block) |
| **Size** | ~600 GB | ~200 GB |
| **Query** | "What did Alice do?" | "What does Alice have?" |
| **Example** | "Alice locked 100 tokens" | "Bridge has 1M locked" |

**Key Insight:** Blocks record what happened. State records what exists now.

---

# Transaction Lifecycle

## 1. Transaction Submission - Outside Blockchain

When you submit a transaction, it's **completely outside** the blockchain:

```
Your Wallet (MetaMask)
├── You click "Confirm"
├── Transaction signed locally
├── Still in your computer's RAM
└── Not on blockchain yet!

Status:
❌ Not in any block
❌ Not in state
❌ Not validated
✅ Just signed data
```

## 2. Send to Mempool via RPC

```javascript
// Your code
await bridgeContract.lock(recipient, 100);

// Under the hood:
1. Create transaction object:
{
    from: "0xYourAddress",
    to: "0xBridgeContract",
    data: "0x..." (encoded function call),
    nonce: 42,
    gasLimit: 100000,
    signature: "0x..."
}

2. Send to RPC endpoint:
POST https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
Body: { method: "eth_sendRawTransaction", params: [signedTx] }

3. Node receives transaction
4. Node puts it in mempool (waiting area)
```

**Mempool = Waiting Room:**
```
Node's Mempool:
┌─────────────────────────────┐
│ Pending Transactions        │
├─────────────────────────────┤
│ Tx1: Alice locks 100 tokens │
│ Tx2: Bob swaps on Uniswap   │
│ Tx3: Charlie mints NFT      │
│ Tx4: Your bridge tx         │
└─────────────────────────────┘
        ↓
    Waiting for validator
```

## 3. Validator Selection (Proof of Stake)

**Not random! Predetermined queue system:**

```
Validators (Stakers):
├── 1 million+ validators
├── Each staked 32 ETH
└── Take turns in predetermined order

Every 12 seconds (1 slot):
├── 1 validator chosen (pseudo-random from epoch schedule)
├── This validator proposes block
└── Other validators attest (vote) to confirm
```

**Selection is deterministic:**
```python
current_slot = get_current_slot()  # Changes every 12 seconds
epoch = current_slot // 32         # 32 slots = 1 epoch

proposer = select_proposer(epoch, current_slot, validator_list)
# Everyone knows who proposer is ahead of time!
```

**Key Points:**
- ✅ Validator chosen BEFORE slot starts
- ✅ One validator proposes block
- ✅ ~350 other validators attest (verify)
- ❌ NOT first node to see transaction
- ❌ NOT only one node executing

## 4. Validator Validates Transaction

**Multiple validation checks:**

```javascript
function validateTransaction(tx) {
    // 1. Signature validation
    recoveredAddress = ecrecover(tx.hash, tx.signature);
    require(recoveredAddress === tx.from, "Invalid signature");

    // 2. Nonce check (prevent replay)
    currentNonce = state.getNonce(tx.from);
    require(tx.nonce === currentNonce, "Invalid nonce");

    // 3. Balance check
    balance = state.getBalance(tx.from);
    require(balance >= tx.value + gas_cost, "Insufficient funds");

    // 4. Gas limit check
    require(tx.gasLimit <= BLOCK_GAS_LIMIT, "Gas too high");

    return true;
}
```

**Validation happens twice:**
```
Stage 1: When entering mempool
├── Node does basic validation
├── Rejects obviously invalid transactions
└── Only valid transactions enter mempool

Stage 2: When including in block
├── Validator re-validates everything
├── Executes transaction in EVM
└── Updates state
```

## 5. Block Creation

```javascript
// Validator builds block
newBlock = {
    number: 18000001,
    timestamp: 1699900000,
    parentHash: "0xabc123...",  // Hash of previous block

    // These come AFTER execution:
    stateRoot: "0x...",          // Hash of NEW state
    transactionsRoot: "0x...",   // Hash of all transactions
    receiptsRoot: "0x...",       // Hash of all receipts

    transactions: [tx1, tx2, tx3, yourTx]
}

// Calculate block hash
blockHash = keccak256(rlp.encode([
    parentHash,
    stateRoot,
    transactionsRoot,
    // ... all header fields
]));
```

## 6. Execution Order: State Then Block

**The exact sequence:**

```
Step 1: Validator selects transactions from mempool
        ↓
Step 2: Validator executes transactions in EVM
        ↓
Step 3: EVM updates STATE (in memory, not committed)
        ↓
Step 4: Calculate state root hash (hash of NEW state)
        ↓
Step 5: Create block header (includes state root)
        ↓
Step 6: Broadcast block to network
        ↓
Step 7: Other validators verify and attest
        ↓
Step 8: If 2/3+ validators attest → Block finalized
        ↓
Step 9: State changes COMMITTED to disk
        ↓
Step 10: Block added to blockchain permanently
```

**Visual timeline:**

```
T=0: Validator starts building block
├── Reads current state (block 18M)
│   State: lockedAmount = 1000
│
T=1: Executes transaction #1 (your lock())
├── EVM reads: lockedAmount = 1000
├── EVM updates (memory): lockedAmount = 1100
├── State not committed yet!
│
T=2: Executes transaction #2
├── EVM reads: lockedAmount = 1100
├── EVM updates (memory): lockedAmount = 1200
│
T=3: All transactions executed
├── Calculate state root: hash(new_state)
├── Create block header with state root
│
T=4: Broadcast block
├── Other validators re-execute
├── They verify state root matches
│
T=5: Block finalized (2/3+ attestations)
├── NOW state committed to disk
├── NOW block added to chain
```

**Critical: State is calculated BEFORE block creation, but committed AFTER finalization.**

## 7. How EVM Knows What to Execute

**Transaction data breakdown:**

```javascript
// Your call
await bridgeContract.lock(recipient, 100);

// Becomes:
{
    from: "0xYourAddress",
    to: "0xBridgeContract",
    value: 0,
    data: "0xe2bbb158" +              // Function selector
          "000...0000recipient" +     // Recipient address
          "000...00000064",           // Amount (100)
    gas: 100000,
    nonce: 42,
    signature: "0x..."
}
```

**Function selector calculation:**

```javascript
functionSignature = "lock(address,uint256)";
hash = keccak256(functionSignature);
// "0xe2bbb1580000000000000000..."

selector = hash.slice(0, 10); // First 4 bytes
// "0xe2bbb158"

// This is how EVM knows which function to call!
```

**EVM execution process:**

```python
def execute_transaction(tx, state):
    # Is it a contract?
    contract_code = state.get_code(tx.to)

    if contract_code == empty:
        # Regular ETH transfer
        state.transfer(tx.from, tx.to, tx.value)
    else:
        # Smart contract call
        execute_contract(tx, contract_code, state)

def execute_contract(tx, code, state):
    # Extract function selector (first 4 bytes)
    selector = tx.data[0:4]  # "0xe2bbb158"

    # Setup EVM
    evm = EVM(
        contract_address=tx.to,
        caller=tx.from,
        calldata=tx.data,
        state=state
    )

    # Execute bytecode
    evm.run(bytecode)
```

**Inside the contract:**

```solidity
function lock(address recipient, uint256 amount) external {
    // 1. EVM loads this function via selector

    // 2. Decodes parameters from calldata
    //    recipient = calldata[4:36]
    //    amount = calldata[36:68]

    // 3. Executes instructions
    require(token.transferFrom(msg.sender, address(this), amount));

    // 4. Updates storage (state)
    lockedAmount += amount;  // SSTORE opcode

    // 5. Emits event
    emit Lock(msg.sender, recipient, amount, block.timestamp, currentNonce++);
}
```

**EVM opcodes:**

```
Compiled bytecode:
├── JUMPI (check function selector)
├── CALLDATALOAD (load recipient)
├── CALLDATALOAD (load amount)
├── CALL (call token.transferFrom)
├── SLOAD (read lockedAmount)
├── ADD (add amount)
├── SSTORE (write lockedAmount) ← Updates state!
├── LOG1 (emit event)
└── RETURN
```

## Complete Example

```
1. You Submit
├── MetaMask creates & signs transaction
├── Data: 0xe2bbb158 + params
└── Send to RPC endpoint

2. Mempool
├── Node validates signature
├── Adds to mempool
└── Broadcasts to other nodes

3. Validator's Turn
├── Validator #7854 chosen
├── Selects your tx + 149 others
└── Starts execution

4. EVM Executes
├── Loads BridgeEthereum bytecode
├── Finds selector: 0xe2bbb158
├── Jumps to lock() code
├── Executes opcodes:
│   ├── CALLDATALOAD: recipient
│   ├── CALLDATALOAD: amount
│   ├── CALL: token.transferFrom
│   ├── SLOAD: lockedAmount (read)
│   ├── ADD: lockedAmount + 100
│   ├── SSTORE: lockedAmount (write) ← STATE UPDATED
│   ├── LOG1: emit Lock event
│   └── RETURN: success
└── State updated (in memory)

5. Block Creation
├── All 150 txs executed
├── Calculate state root: hash(new_state)
├── Create block header
└── Block hash calculated

6. Broadcast
├── Validator broadcasts to network
├── 350+ validators verify
└── Re-execute all transactions

7. Attestations
├── Validators vote "valid"
├── 2/3+ agree
└── Block finalized

8. Commitment
├── State committed to disk
├── Block added to chain
└── Transaction confirmed ✅
```

---

# Validator Communication & Consensus

## The Communication Flow

```
Slot 123456 (12 seconds):

T=0s: Node 1 (Proposer) creates block
      ↓
T=1s: Node 1 broadcasts to network
      ↓
T=2-4s: Nodes 2,3,4...: Receive & verify
      ↓
T=4-8s: Validators create attestations
      ↓
T=8-10s: Attestations broadcasted
      ↓
T=10s: Aggregators collect attestations
      ↓
T=11s: Node 1 sees aggregated result
      ↓
T=12s: Slot ends, next begins
```

## 1. Node 1 Broadcasts Block

**Node 1 doesn't wait! It broadcasts and moves on:**

```python
# Node 1 (Proposer)
def propose_block():
    # Create block
    block = create_block(transactions)

    # Broadcast via gossipsub
    gossipsub.publish(
        topic="beacon_block",
        message=block
    )

    # DON'T WAIT!
    # Job done for this slot
    print(f"Block {block.number} broadcasted!")
```

## 2. Other Validators Receive & Verify

**Each validator independently verifies:**

```python
# Node 2, 3, 4... (Attesters)
def on_block_received(block):
    # 1. Verify structure
    if not verify_block_structure(block):
        return reject()

    # 2. Re-execute ALL transactions
    working_state = copy(current_state)
    for tx in block.transactions:
        result = evm.execute(tx, working_state)
        if result.failed:
            return reject()

    # 3. Verify state root matches
    calculated_state_root = merkle_hash(working_state)
    if calculated_state_root != block.state_root:
        return reject()

    # 4. Create attestation
    attestation = create_attestation(block)

    # 5. Broadcast attestation
    gossipsub.publish(
        topic="beacon_attestation",
        message=attestation
    )
```

## 3. Attestation Structure

```python
attestation = {
    # Which slot/block voting for
    "slot": 123456,
    "block_root": "0xabc123...",

    # Who is attesting
    "validator_index": 7854,

    # What confirming
    "source": checkpoint_n,
    "target": checkpoint_n+1,

    # Proof
    "signature": "0x...",  # BLS signature

    # Committee info
    "committee_index": 5,
    "aggregation_bits": "0b11010..."
}
```

## 4. Attestation Aggregation

**Special "aggregator" nodes collect attestations:**

```python
class AttestationAggregator:
    def __init__(self):
        self.attestations_pool = {}

    def on_attestation_received(self, attestation):
        slot = attestation.slot
        block_root = attestation.block_root

        # Group by slot and block
        key = (slot, block_root)
        if key not in self.attestations_pool:
            self.attestations_pool[key] = []

        self.attestations_pool[key].append(attestation)

        # Check if enough attestations
        total_stake = sum(
            get_stake(att.validator_index)
            for att in self.attestations_pool[key]
        )

        if total_stake >= TOTAL_STAKE * 2/3:
            # Supermajority!
            aggregated = aggregate_attestations(
                self.attestations_pool[key]
            )

            # Broadcast aggregated attestation
            gossipsub.publish(
                topic="aggregated_attestation",
                message=aggregated
            )
```

**Aggregated attestation:**

```python
aggregated_attestation = {
    "slot": 123456,
    "block_root": "0xabc123...",

    # Bitmap: which validators attested
    "aggregation_bits": "0b111011101110...",  # 350+ validators

    # Single aggregated BLS signature
    "signature": "0x...",
}
```

## 5. How Everyone Knows

**All validators subscribe to aggregated attestations:**

```python
# Node 1 (and all other nodes)
def on_aggregated_attestation_received(agg_att):
    slot = agg_att.slot
    block_root = agg_att.block_root

    # 1. Verify aggregated signature
    if not verify_bls_aggregate_signature(agg_att):
        return

    # 2. Count validators
    attesting_validators = []
    for i, bit in enumerate(agg_att.aggregation_bits):
        if bit == 1:
            attesting_validators.append(i)

    # 3. Calculate total stake
    total_stake = sum(
        get_stake(v)
        for v in attesting_validators
    )

    # 4. Check supermajority (2/3+)
    if total_stake >= TOTAL_STAKE * 2/3:
        print(f"Block {block_root} has supermajority!")

        # 5. Update fork choice
        update_fork_choice(block_root)

        # 6. Check if can finalize
        if can_finalize(agg_att):
            finalize_block(block_root)
            commit_state_to_disk()
            print(f"Block FINALIZED!")
```

## Visual Timeline

```
Slot 123456 Timeline:

0s    Node 1: "Here's my block!"
      │
      ├─────► Network (gossipsub)
      │
1-2s  │      Nodes 2,3,4...999: "Verifying..."
      │      [Execute all transactions]
      │      [Verify state root]
      │
4s    │      Node 2: "I agree!" ─┐
      │      Node 3: "I agree!" ─┤
      │      Node 4: "I agree!" ─┤ Individual
      │      ... (350+ nodes)    ─┘ attestations
      │                          │
      │                          ├─► Aggregators
      │
6-8s  │                          "Collecting..."
      │                          [Combine signatures]
      │
9s    │      ◄──────────────────┘
      │      Aggregated Attestation:
      │      "350 validators (68% stake) agreed!"
      │
10s   Node 1: "Supermajority reached!"
      All nodes: "Block is canonical!"

12s   Next slot begins...
```

## Network Layer: Gossipsub

**Ethereum uses libp2p gossipsub:**

```
Node 1's Connections:
├── Direct peers: ~50-80 nodes
├── Gossip mesh: Subscribes to topics
│   ├── /eth2/beacon_block
│   ├── /eth2/beacon_attestation
│   └── /eth2/beacon_aggregate_and_proof
└── Messages propagate exponentially

Node 1 publishes block:
├── Sends to 50 direct peers
├── Each peer forwards to their 50 peers
├── Exponential propagation
└── Entire network reaches in <2 seconds
```

## Finalization Stages

```python
# Three stages of confirmation

# Stage 1: Proposed
block = propose_block()
# Block exists, not confirmed

# Stage 2: Justified (1/3+ attestations)
if attestations.total_stake >= TOTAL_STAKE * 1/3:
    block.justified = True
    # Likely canonical, could be reverted

# Stage 3: Finalized (2/3+, 2 epochs later)
if attestations.total_stake >= TOTAL_STAKE * 2/3 and epochs >= 2:
    block.finalized = True
    # PERMANENT! Cannot be reverted
    commit_state_to_disk()
```

**Timeline:**

```
Slot 0:   Block proposed
Slot 1:   Attestations received (justified)
Slot 32:  Checkpoint 1 (justified)
Slot 64:  Checkpoint 2 (finalized!)

Finalization: ~12-15 minutes
```

## How Node 1 Actually Knows

**Node 1 knows by:**

### 1. Listening to gossipsub topics
```python
node1.subscribe("beacon_attestation")
node1.subscribe("aggregated_attestation")

def on_message(topic, message):
    if topic == "aggregated_attestation":
        process_aggregation(message)
```

### 2. Tracking stake locally
```python
attestation_tracker = {
    "slot_123456": {
        "block_0xabc": {
            "validators": [12, 45, 78, ...],
            "total_stake": 21000000  # ETH
        }
    }
}

if tracker[slot][block]["total_stake"] >= THRESHOLD:
    print("Supermajority!")
```

### 3. Fork choice rule (LMD-GHOST)
```python
def get_canonical_block(slot):
    # Choose block with most stake
    blocks = get_blocks_at_slot(slot)

    best_block = None
    max_stake = 0

    for block in blocks:
        stake = get_attesting_stake(block)
        if stake > max_stake:
            max_stake = stake
            best_block = block

    return best_block
```

## Key Insight: No Direct "Wait"

**Node 1 NEVER directly waits!**

```python
# WRONG (blocking):
def propose_block():
    block = create_block()
    broadcast(block)

    # ❌ Doesn't work like this
    while attestations < 2/3:
        time.sleep(1)

# CORRECT (event-driven):
def propose_block():
    block = create_block()
    broadcast(block)
    # Done! Move on

# Separate async handler:
async def on_attestation_received(att):
    pool.add(att)

    if pool.has_supermajority(att.block_root):
        emit("block_finalized", att.block_root)
```

## Summary Table

| Question | Answer |
|----------|--------|
| **How does Node 1 broadcast?** | Gossipsub P2P (sends to ~50 peers) |
| **How do others respond?** | Create & broadcast attestations |
| **How does Node 1 wait?** | It doesn't! Async event listeners |
| **How does Node 1 know consensus?** | Receives aggregated attestations |
| **What if <2/3 agree?** | Block orphaned, not canonical |
| **When is state committed?** | After finalization (~13 mins) |

---

## Final Summary

### Key Concepts

1. **DEX/Uniswap**: Decentralized token swapping via liquidity pools stored in smart contracts
2. **State vs Blocks**: Smart contracts live in state (current), blocks store history (past)
3. **Transaction Lifecycle**: Submit → Mempool → Validator → Execute → State Update → Block → Consensus
4. **Consensus**: Asynchronous message passing with cryptographic proofs (BLS signatures)

### The Big Picture

```
User Transaction
      ↓
   Mempool
      ↓
Validator Executes
      ↓
State Updated (memory)
      ↓
Block Created (includes state root)
      ↓
Broadcast to Network
      ↓
Other Validators Attest
      ↓
Aggregated Attestations
      ↓
Consensus Reached (2/3+)
      ↓
State Committed (disk)
      ↓
Block Finalized
```

### Important Principles

- **Asynchronous**: No direct request/response, all pub/sub
- **Deterministic**: Everyone executes the same transactions, gets same state
- **Cryptographic**: BLS signatures prove validators agreed
- **Decentralized**: No single point of control or failure
- **Immutable**: Once finalized, cannot be changed

---

**This guide provides a comprehensive understanding of Ethereum's internal mechanics, from DEX integration to consensus mechanisms.**

