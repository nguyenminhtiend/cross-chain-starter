require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

console.log('='.repeat(70));
console.log('PHASE 3: Transaction Fees Deep Dive');
console.log('='.repeat(70));

// ============================================================
// FEE BASICS
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('FEE BASICS');
console.log('═'.repeat(70));

const BASE_FEE = StellarSdk.BASE_FEE; // 100 stroops
const STROOPS_PER_XLM = 10000000;

console.log('\n  Base Fee:         ' + BASE_FEE + ' stroops');
console.log('  In XLM:           ' + (BASE_FEE / STROOPS_PER_XLM) + ' XLM');
console.log('  Stroops per XLM:  ' + STROOPS_PER_XLM);
console.log('\n  1 stroop = 0.0000001 XLM');
console.log('  100 stroops = 0.00001 XLM ≈ $0.000001 USD');

// ============================================================
// FEE CALCULATION EXAMPLES
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('FEE CALCULATION BY OPERATION COUNT');
console.log('═'.repeat(70));

function calculateFee(numOperations, feePerOp = BASE_FEE) {
  const totalStroops = feePerOp * numOperations;
  const totalXLM = totalStroops / STROOPS_PER_XLM;
  return { stroops: totalStroops, xlm: totalXLM };
}

const scenarios = [
  { operations: 1, description: 'Simple payment' },
  { operations: 2, description: 'Payment + trust' },
  { operations: 3, description: 'Multi-sig payment' },
  { operations: 5, description: 'Batch transfer' },
  { operations: 10, description: 'Complex transaction' },
  { operations: 100, description: 'Maximum operations' },
];

console.log('\nOperations | Fee (stroops) | Fee (XLM)     | Use Case');
console.log('-'.repeat(70));

scenarios.forEach(({ operations, description }) => {
  const fee = calculateFee(operations);
  console.log(
    operations.toString().padEnd(10) + ' | ' +
    fee.stroops.toString().padEnd(13) + ' | ' +
    fee.xlm.toFixed(7).padEnd(13) + ' | ' +
    description
  );
});

// ============================================================
// NETWORK FEE STATS
// ============================================================
async function displayNetworkFeeStats() {
  console.log('\n' + '═'.repeat(70));
  console.log('LIVE NETWORK FEE STATISTICS');
  console.log('═'.repeat(70));

  try {
    const feeStats = await server.feeStats();

    console.log('\nLast Ledger Fees:');
    console.log('  Min:              ' + feeStats.last_ledger_base_fee + ' stroops');
    console.log('  Mode (most common): ' + feeStats.last_ledger + ' stroops');

    console.log('\nAcceptance Stats:');
    console.log('  Min Accepted:     ' + feeStats.min_accepted_fee + ' stroops');
    console.log('  Mode Accepted:    ' + feeStats.mode_accepted_fee + ' stroops');

    console.log('\nFee Charged Percentiles (stroops):');
    console.log('  P10 (10th):       ' + feeStats.fee_charged.p10);
    console.log('  P20 (20th):       ' + feeStats.fee_charged.p20);
    console.log('  P30 (30th):       ' + feeStats.fee_charged.p30);
    console.log('  P40 (40th):       ' + feeStats.fee_charged.p40);
    console.log('  P50 (median):     ' + feeStats.fee_charged.p50);
    console.log('  P60 (60th):       ' + feeStats.fee_charged.p60);
    console.log('  P70 (70th):       ' + feeStats.fee_charged.p70);
    console.log('  P80 (80th):       ' + feeStats.fee_charged.p80);
    console.log('  P90 (90th):       ' + feeStats.fee_charged.p90);
    console.log('  P95 (95th):       ' + feeStats.fee_charged.p95);
    console.log('  P99 (99th):       ' + feeStats.fee_charged.p99);
    console.log('  Max:              ' + feeStats.fee_charged.max);

    console.log('\nCapacity:');
    console.log('  Max Fee (1 op):   ' + feeStats.max_fee.max + ' stroops');
    console.log('  Min Fee (1 op):   ' + feeStats.max_fee.min + ' stroops');
    console.log('  Mode Fee (1 op):  ' + feeStats.max_fee.mode + ' stroops');

    // Recommendation
    const recommendedFee = parseInt(feeStats.fee_charged.p50) || BASE_FEE;
    console.log('\n' + '═'.repeat(70));
    console.log('RECOMMENDATION');
    console.log('═'.repeat(70));
    console.log('\n  For normal priority:  ' + BASE_FEE + ' stroops/op');
    console.log('  For high priority:    ' + (BASE_FEE * 2) + ' stroops/op');
    console.log('  Network median:       ' + recommendedFee + ' stroops/op');

  } catch (error) {
    console.log('\n❌ Could not fetch fee stats:', error.message);
  }
}

// ============================================================
// FEE STRATEGIES
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('FEE STRATEGIES');
console.log('═'.repeat(70));

console.log('\n1. MINIMUM FEE (Normal Priority)');
console.log('   Use: StellarSdk.BASE_FEE (100 stroops)');
console.log('   When: Regular transactions, no rush');
console.log('   Code: fee: StellarSdk.BASE_FEE');

console.log('\n2. DYNAMIC FEE (Network-Based)');
console.log('   Use: Fetch from feeStats() API');
console.log('   When: High network congestion');
console.log('   Code: const stats = await server.feeStats()');

console.log('\n3. PREMIUM FEE (High Priority)');
console.log('   Use: 2-10x BASE_FEE');
console.log('   When: Time-sensitive operations');
console.log('   Code: fee: StellarSdk.BASE_FEE * 2');

console.log('\n4. CUSTOM FEE');
console.log('   Use: Any value >= BASE_FEE');
console.log('   When: Special requirements');
console.log('   Code: fee: \'1000\' // 1000 stroops');

// ============================================================
// PRACTICAL EXAMPLES
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('PRACTICAL CODE EXAMPLES');
console.log('═'.repeat(70));

console.log('\n// Example 1: Fixed minimum fee');
console.log('const transaction = new StellarSdk.TransactionBuilder(account, {');
console.log('  fee: StellarSdk.BASE_FEE,  // 100 stroops per operation');
console.log('  networkPassphrase: StellarSdk.Networks.TESTNET');
console.log('})');

console.log('\n// Example 2: Dynamic fee based on network');
console.log('const feeStats = await server.feeStats();');
console.log('const recommendedFee = parseInt(feeStats.fee_charged.p70);');
console.log('const transaction = new StellarSdk.TransactionBuilder(account, {');
console.log('  fee: recommendedFee.toString(),');
console.log('  networkPassphrase: StellarSdk.Networks.TESTNET');
console.log('})');

console.log('\n// Example 3: Premium fee for urgent transaction');
console.log('const transaction = new StellarSdk.TransactionBuilder(account, {');
console.log('  fee: (StellarSdk.BASE_FEE * 5).toString(), // 5x priority');
console.log('  networkPassphrase: StellarSdk.Networks.TESTNET');
console.log('})');

// ============================================================
// COST COMPARISON
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('COST COMPARISON: Stellar vs Other Networks');
console.log('═'.repeat(70));

const txCost = calculateFee(1);
console.log('\nStellar Transaction (1 operation):');
console.log('  Fee:              ' + txCost.xlm + ' XLM');
console.log('  USD (≈ $0.10/XLM):  $' + (txCost.xlm * 0.10).toFixed(6));

console.log('\nComparison (approximate):');
console.log('  Ethereum:          $1 - $50+ (depends on gas)');
console.log('  Bitcoin:           $1 - $20+ (depends on congestion)');
console.log('  Stellar:           $0.000001 (fixed, predictable)');
console.log('  → Stellar is ~1,000,000x cheaper! ⚡');

// ============================================================
// FEE BUMP EXPLANATION
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('FEE BUMP (Advanced)');
console.log('═'.repeat(70));

console.log('\nWhat is Fee Bump?');
console.log('  - Increases fee of a submitted transaction');
console.log('  - Useful if original fee was too low');
console.log('  - Can be done by a different account');
console.log('  - Original transaction remains valid');

console.log('\nWhen to use:');
console.log('  ✓ Transaction is stuck (low fee)');
console.log('  ✓ Network became congested after submission');
console.log('  ✓ Sponsored transactions');

console.log('\nExample:');
console.log('  const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(');
console.log('    bumpingAccount,');
console.log('    StellarSdk.BASE_FEE * 10, // New higher fee');
console.log('    originalTx,');
console.log('    StellarSdk.Networks.TESTNET');
console.log('  );');

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
  await displayNetworkFeeStats();

  console.log('\n' + '='.repeat(70));
  console.log('✅ Transaction Fees Complete!');
  console.log('='.repeat(70));

  console.log('\nKey Takeaways:');
  console.log('  1. Base fee: 100 stroops (0.00001 XLM)');
  console.log('  2. Total fee = base fee × number of operations');
  console.log('  3. Fees are incredibly low (~$0.000001)');
  console.log('  4. Use BASE_FEE for normal transactions');
  console.log('  5. Check feeStats() for network conditions');
  console.log('  6. Fee bumps available if needed');
}

main().catch(console.error);
