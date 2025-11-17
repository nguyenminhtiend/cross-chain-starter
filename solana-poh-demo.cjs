#!/usr/bin/env node

/**
 * SOLANA PROOF OF HISTORY (PoH) + PROOF OF STAKE (PoS) DEMO
 *
 * This demonstrates how Solana achieves high speed by using:
 * 1. PoH = Cryptographic Clock (proves time & order)
 * 2. PoS = Security & Leader Selection
 *
 * Run: node solana-poh-demo.js
 */

const crypto = require('crypto');

// ============================================================================
// PART 1: PROOF OF HISTORY - The Cryptographic Clock
// ============================================================================

class ProofOfHistory {
  constructor() {
    this.currentHash = 'GENESIS_HASH'; // Starting point
    this.sequence = []; // The "clock ticks"
    this.tickCount = 0;
  }

  /**
   * CORE CONCEPT: Each "tick" is a hash that PROVES time passed
   * You CANNOT skip ahead or fake this - hashing takes real time!
   */
  tick() {
    // Hash the previous hash (this takes actual computation time)
    this.currentHash = crypto
      .createHash('sha256')
      .update(this.currentHash)
      .digest('hex');

    this.tickCount++;

    // Store this tick in the sequence
    this.sequence.push({
      index: this.tickCount,
      hash: this.currentHash.substring(0, 8) + '...', // Short version for display
      fullHash: this.currentHash
    });

    return this.currentHash;
  }

  /**
   * Record a transaction/event in the PoH stream
   * This "stamps" the transaction with a cryptographic timestamp
   */
  recordTransaction(transaction) {
    const beforeTick = this.tickCount;
    const beforeHash = this.currentHash;

    // Do some ticks (simulating time passing)
    this.tick();

    // Mix the transaction data into the hash
    const txHash = crypto
      .createHash('sha256')
      .update(this.currentHash + JSON.stringify(transaction))
      .digest('hex');

    this.currentHash = txHash;

    this.tick();

    const afterTick = this.tickCount;
    const afterHash = this.currentHash;

    // Create a verifiable record with FULL hashes (needed for verification)
    const record = {
      transaction,
      pohIndexBefore: beforeTick,
      pohIndexAfter: afterTick,
      hashBefore: beforeHash,
      hashBeforeShort: beforeHash.substring(0, 8) + '...',
      hashAfter: afterHash,
      hashAfterShort: afterHash.substring(0, 8) + '...',
      transactionHash: txHash,
      timestamp: Date.now()
    };

    return record;
  }

  /**
   * VERIFICATION: Anyone can verify the PoH sequence
   * They just re-hash and check if they get the same result
   */
  verify(record, options = { verbose: false }) {
    const { verbose } = options;

    if (verbose) {
      console.log(`\n      🔍 VERIFYING PoH Proof for transaction: ${record.transaction.type}`);
      console.log(`      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }

    // STEP 1: Verify we can reproduce the hash sequence
    // Start with the "before" hash
    let currentHash = record.hashBefore;

    if (verbose) {
      console.log(`      Step 1: Starting hash`);
      console.log(`         ${currentHash.substring(0, 16)}...`);
    }

    // STEP 2: Do one tick (one hash)
    currentHash = crypto
      .createHash('sha256')
      .update(currentHash)
      .digest('hex');

    if (verbose) {
      console.log(`      Step 2: After 1 tick`);
      console.log(`         ${currentHash.substring(0, 16)}...`);
    }

    // STEP 3: Mix in the transaction data (this is what makes it unique!)
    const transactionData = JSON.stringify(record.transaction);
    const txHash = crypto
      .createHash('sha256')
      .update(currentHash + transactionData)
      .digest('hex');

    if (verbose) {
      console.log(`      Step 3: Mix transaction data`);
      console.log(`         TX Data: ${transactionData.substring(0, 30)}...`);
      console.log(`         Result:  ${txHash.substring(0, 16)}...`);
    }

    // Verify the transaction hash matches
    if (txHash !== record.transactionHash) {
      if (verbose) {
        console.log(`      ❌ FAILED: Transaction hash mismatch!`);
      }
      return false;
    }

    currentHash = txHash;

    // STEP 4: Do another tick
    currentHash = crypto
      .createHash('sha256')
      .update(currentHash)
      .digest('hex');

    if (verbose) {
      console.log(`      Step 4: After 1 more tick`);
      console.log(`         ${currentHash.substring(0, 16)}...`);
    }

    // STEP 5: Verify we got the expected "after" hash
    if (currentHash === record.hashAfter) {
      if (verbose) {
        console.log(`      ✅ VERIFICATION PASSED!`);
        console.log(`         Expected: ${record.hashAfter.substring(0, 16)}...`);
        console.log(`         Got:      ${currentHash.substring(0, 16)}...`);
        console.log(`      `);
        console.log(`      What this proves:`);
        console.log(`         1. Time actually passed (hashing takes real time)`);
        console.log(`         2. The order is correct (hashes are sequential)`);
        console.log(`         3. Nothing was inserted/removed (hashes match)`);
        console.log(`      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }
      return true;
    } else {
      if (verbose) {
        console.log(`      ❌ VERIFICATION FAILED!`);
        console.log(`         Expected: ${record.hashAfter.substring(0, 16)}...`);
        console.log(`         Got:      ${currentHash.substring(0, 16)}...`);
      }
      return false;
    }
  }

  getSequenceLength() {
    return this.tickCount;
  }
}

// ============================================================================
// PART 2: VALIDATORS (Proof of Stake)
// ============================================================================

class Validator {
  constructor(name, stake) {
    this.name = name;
    this.stake = stake; // Amount of SOL staked
    this.blocksProduced = 0;
    this.blocksVerified = 0;
  }

  /**
   * LEADER ROLE: Produce a block using PoH
   * Key insight: Leader doesn't need to wait for others to agree on time!
   * PoH already proves the order!
   */
  produceBlock(transactions, poh) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🏆 ${this.name} is the LEADER for this slot`);
    console.log(`${'='.repeat(70)}`);

    const blockStart = Date.now();
    const pohStart = poh.getSequenceLength();

    console.log(`\n📋 Processing ${transactions.length} transactions...\n`);

    const processedTransactions = [];

    // Process each transaction and stamp it with PoH
    transactions.forEach((tx, index) => {
      const record = poh.recordTransaction(tx);
      processedTransactions.push(record);

      console.log(`  ${index + 1}. Transaction: ${tx.type}`);
      console.log(`     From: ${tx.from} → To: ${tx.to}`);
      console.log(`     Amount: ${tx.amount} SOL`);
      console.log(`     ⏱️  PoH Index: ${record.pohIndexBefore} → ${record.pohIndexAfter}`);
      console.log(`     🔒 Hash Proof: ${record.hashBeforeShort} → ${record.hashAfterShort}`);
      console.log();
    });

    const pohEnd = poh.getSequenceLength();
    const blockTime = Date.now() - blockStart;

    const block = {
      leader: this.name,
      transactions: processedTransactions,
      pohStartIndex: pohStart,
      pohEndIndex: pohEnd,
      productionTime: blockTime,
      timestamp: Date.now()
    };

    this.blocksProduced++;

    console.log(`✅ Block produced by ${this.name} in ${blockTime}ms`);
    console.log(`   PoH Sequence: ${pohStart} → ${pohEnd} (${pohEnd - pohStart} ticks)`);

    return block;
  }

  /**
   * VALIDATOR ROLE: Verify a block
   * Key insight: Verification is FAST because PoH already proves order!
   * No need to wait and vote!
   */
  verifyBlock(block, poh, options = { showDetailedVerification: false }) {
    const verifyStart = Date.now();
    const { showDetailedVerification } = options;

    // Verify each transaction's PoH proof
    let allValid = true;
    for (let i = 0; i < block.transactions.length; i++) {
      const record = block.transactions[i];

      // Show detailed verification for the first transaction (educational!)
      const verbose = showDetailedVerification && i === 0;

      if (!poh.verify(record, { verbose })) {
        allValid = false;
        break;
      }
    }

    const verifyTime = Date.now() - verifyStart;

    if (allValid) {
      this.blocksVerified++;
      console.log(`   ✅ ${this.name}: Verified in ${verifyTime}ms`);
      return true;
    } else {
      console.log(`   ❌ ${this.name}: INVALID BLOCK!`);
      return false;
    }
  }
}

// ============================================================================
// PART 3: LEADER SCHEDULE (Leader Rotation)
// ============================================================================

class LeaderSchedule {
  constructor(validators) {
    this.validators = validators;
    this.currentSlot = 0;
    this.slotsPerLeader = 4; // Each leader gets 4 slots (~1.6 seconds)
  }

  /**
   * Determine who is the leader for current slot
   * Based on stake weight (more stake = more likely to be chosen)
   */
  getLeader() {
    // Simplified: rotate through validators
    // Real Solana uses stake-weighted randomness
    const leaderIndex = Math.floor(this.currentSlot / this.slotsPerLeader) % this.validators.length;
    return this.validators[leaderIndex];
  }

  nextSlot() {
    this.currentSlot++;
  }

  getCurrentSlot() {
    return this.currentSlot;
  }
}

// ============================================================================
// PART 4: TRANSACTION MEMPOOL
// ============================================================================

class TransactionMempool {
  constructor() {
    this.pending = [];
  }

  addTransaction(tx) {
    this.pending.push(tx);
  }

  getTransactions(count) {
    return this.pending.splice(0, count);
  }

  size() {
    return this.pending.length;
  }
}

// ============================================================================
// PART 5: THE NETWORK (Putting it all together)
// ============================================================================

class SolanaNetwork {
  constructor() {
    this.poh = new ProofOfHistory();
    this.validators = [];
    this.leaderSchedule = null;
    this.mempool = new TransactionMempool();
    this.blocks = [];
  }

  addValidator(validator) {
    this.validators.push(validator);
  }

  initializeLeaderSchedule() {
    this.leaderSchedule = new LeaderSchedule(this.validators);
  }

  /**
   * Process one slot (400ms in real Solana)
   */
  processSlot() {
    const slotNumber = this.leaderSchedule.getCurrentSlot();

    console.log(`\n\n`);
    console.log(`${'█'.repeat(70)}`);
    console.log(`   SLOT ${slotNumber} - ${new Date().toLocaleTimeString()}`);
    console.log(`${'█'.repeat(70)}`);

    // Get the current leader
    const leader = this.leaderSchedule.getLeader();

    // Get transactions from mempool
    const transactions = this.mempool.getTransactions(3);

    if (transactions.length === 0) {
      console.log('\n⏭️  No transactions in mempool, skipping...');
      this.leaderSchedule.nextSlot();
      return;
    }

    // Leader produces block
    const block = leader.produceBlock(transactions, this.poh);

    // Other validators verify in parallel
    console.log(`\n🔍 Other validators verifying in parallel...\n`);

    const otherValidators = this.validators.filter(v => v !== leader);
    const verificationResults = [];

    for (let i = 0; i < otherValidators.length; i++) {
      const validator = otherValidators[i];

      // Show detailed verification for the FIRST validator in the FIRST slot
      // This helps beginners understand HOW PoH verification works!
      const showDetail = slotNumber === 0 && i === 0;

      const result = validator.verifyBlock(block, this.poh, {
        showDetailedVerification: showDetail
      });

      verificationResults.push(result);
    }

    // Check consensus
    const approvals = verificationResults.filter(r => r === true).length;
    const totalValidators = otherValidators.length;

    console.log(`\n📊 Consensus: ${approvals}/${totalValidators} validators approved`);

    if (approvals >= totalValidators * 0.66) {
      console.log(`✅ BLOCK ACCEPTED! (2/3+ consensus)`);
      this.blocks.push(block);
    } else {
      console.log(`❌ BLOCK REJECTED! (Not enough consensus)`);
    }

    // Move to next slot
    this.leaderSchedule.nextSlot();
  }

  /**
   * Show network statistics
   */
  showStats() {
    console.log(`\n\n`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`   📊 NETWORK STATISTICS`);
    console.log(`${'═'.repeat(70)}`);

    console.log(`\n🔗 Blockchain:`);
    console.log(`   Total blocks: ${this.blocks.length}`);
    console.log(`   PoH sequence length: ${this.poh.getSequenceLength()} ticks`);

    console.log(`\n👥 Validators:`);
    this.validators.forEach(v => {
      console.log(`   ${v.name}:`);
      console.log(`     Stake: ${v.stake} SOL`);
      console.log(`     Blocks produced: ${v.blocksProduced}`);
      console.log(`     Blocks verified: ${v.blocksVerified}`);
    });

    console.log(`\n⏱️  PoH Insight:`);
    console.log(`   PoH creates a cryptographic clock that PROVES time passed`);
    console.log(`   Validators don't need to vote on "what time is it?"`);
    console.log(`   They just verify the PoH sequence (very fast!)`);
    console.log(`   This is why Solana is so fast! 🚀`);

    console.log(`\n${'═'.repeat(70)}\n`);
  }
}

// ============================================================================
// PART 6: DEMO / SIMULATION
// ============================================================================

function createRandomTransaction(index) {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const types = ['Transfer', 'Swap', 'Stake', 'NFT Mint'];

  return {
    id: `tx_${index}`,
    type: types[Math.floor(Math.random() * types.length)],
    from: names[Math.floor(Math.random() * names.length)],
    to: names[Math.floor(Math.random() * names.length)],
    amount: Math.floor(Math.random() * 100) + 1,
    timestamp: Date.now()
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('\n');
  console.log(`${'█'.repeat(70)}`);
  console.log(`   🌟 SOLANA PoH + PoS DEMONSTRATION 🌟`);
  console.log(`${'█'.repeat(70)}`);

  console.log(`\n📚 KEY CONCEPTS:`);
  console.log(`   1. PoH (Proof of History) = Cryptographic Clock`);
  console.log(`      - Each hash PROVES time actually passed`);
  console.log(`      - Cannot be faked or skipped`);
  console.log(`      - Provides ordering of transactions`);
  console.log(`   `);
  console.log(`   2. PoS (Proof of Stake) = Security & Leader Selection`);
  console.log(`      - Validators stake SOL tokens`);
  console.log(`      - Leaders rotate based on stake weight`);
  console.log(`      - Economic incentive to be honest`);
  console.log(`   `);
  console.log(`   3. THE MAGIC: PoH eliminates "time consensus"`);
  console.log(`      - Ethereum: "What time is it?" (must vote, slow)`);
  console.log(`      - Solana: "Check the PoH clock!" (fast!)`);

  // Initialize network
  const network = new SolanaNetwork();

  // Add validators with different stakes
  network.addValidator(new Validator('Alice', 1000));
  network.addValidator(new Validator('Bob', 800));
  network.addValidator(new Validator('Charlie', 600));
  network.addValidator(new Validator('Diana', 500));

  network.initializeLeaderSchedule();

  console.log(`\n✅ Network initialized with ${network.validators.length} validators`);

  // Add some transactions to mempool
  console.log(`\n📝 Adding transactions to mempool...`);
  for (let i = 0; i < 12; i++) {
    const tx = createRandomTransaction(i + 1);
    network.mempool.addTransaction(tx);
    console.log(`   Added: ${tx.type} - ${tx.from} → ${tx.to} (${tx.amount} SOL)`);
  }

  console.log(`\n🎬 Starting block production...\n`);
  await sleep(2000);

  // Process 4 slots (each leader gets a turn)
  for (let i = 0; i < 4; i++) {
    network.processSlot();
    await sleep(3000); // Slow down for readability
  }

  // Show final statistics
  network.showStats();

  // Show the key insight
  console.log(`\n💡 THE KEY INSIGHT:\n`);
  console.log(`   Ethereum PoS:`);
  console.log(`   ┌─────────────────────────────────────────┐`);
  console.log(`   │ 1. Propose block           (12s)        │`);
  console.log(`   │ 2. Wait for votes          (4-8s)       │`);
  console.log(`   │ 3. Count votes             (2-4s)       │`);
  console.log(`   │ 4. Wait for finality       (12-15 min)  │`);
  console.log(`   └─────────────────────────────────────────┘`);
  console.log(`   ⏱️  Time to finality: 12-15 MINUTES\n`);

  console.log(`   Solana PoH + PoS:`);
  console.log(`   ┌─────────────────────────────────────────┐`);
  console.log(`   │ 1. PoH already proves time & order      │`);
  console.log(`   │ 2. Leader produces block   (400ms)      │`);
  console.log(`   │ 3. Validators verify PoH   (fast!)      │`);
  console.log(`   │ 4. Finality after 32 slots (13s)        │`);
  console.log(`   └─────────────────────────────────────────┘`);
  console.log(`   ⚡ Time to finality: 13 SECONDS\n`);

  console.log(`   Why is Solana faster?`);
  console.log(`   → PoH eliminates the need to "vote on time"`);
  console.log(`   → The cryptographic clock proves what happened and when`);
  console.log(`   → Validators just verify the PoH sequence (very fast!)`);
  console.log(`   → No waiting for everyone to agree on timestamps\n`);

  console.log(`${'═'.repeat(70)}\n`);
}

// ============================================================================
// RUN THE DEMO
// ============================================================================

if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { ProofOfHistory, Validator, SolanaNetwork };
