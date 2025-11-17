require('dotenv').config();
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

console.log('='.repeat(70));
console.log('PHASE 3: Account Structure Deep Dive');
console.log('='.repeat(70));

// ============================================================
// INSPECT ACCOUNT STRUCTURE
// ============================================================
async function inspectAccount(publicKey) {
  console.log('\n' + '═'.repeat(70));
  console.log('ACCOUNT OVERVIEW');
  console.log('═'.repeat(70));

  try {
    const account = await server.loadAccount(publicKey);

    console.log('\nBasic Information:');
    console.log('-'.repeat(70));
    console.log('  Account ID:     ', account.accountId());
    console.log('  Sequence Number:', account.sequence);
    console.log('  Subentry Count: ', account.subentry_count);
    console.log('  Last Modified:  ', account.last_modified_ledger);
    console.log('  Ledger Seq:     ', account.sequence_ledger);

    // ============================================================
    // BALANCES
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('BALANCES');
    console.log('═'.repeat(70));

    account.balances.forEach((balance, index) => {
      console.log(`\nBalance ${index + 1}:`);
      if (balance.asset_type === 'native') {
        console.log('  Asset:          XLM (native)');
        console.log('  Balance:        ' + balance.balance + ' XLM');
      } else {
        console.log('  Asset:          ' + balance.asset_code);
        console.log('  Issuer:         ' + balance.asset_issuer);
        console.log('  Balance:        ' + balance.balance);
        console.log('  Limit:          ' + balance.limit);
      }

      if (balance.buying_liabilities) {
        console.log('  Buying Liabs:   ' + balance.buying_liabilities);
      }
      if (balance.selling_liabilities) {
        console.log('  Selling Liabs:  ' + balance.selling_liabilities);
      }
    });

    // ============================================================
    // SIGNERS
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('SIGNERS (Authorization)');
    console.log('═'.repeat(70));

    account.signers.forEach((signer, index) => {
      console.log(`\nSigner ${index + 1}:`);
      console.log('  Key:            ' + signer.key);
      console.log('  Weight:         ' + signer.weight);
      console.log('  Type:           ' + signer.type);
      if (signer.key === account.accountId()) {
        console.log('  → This is the master key');
      }
    });

    // ============================================================
    // THRESHOLDS
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('THRESHOLDS (Required Signature Weights)');
    console.log('═'.repeat(70));

    console.log('\n  Low Threshold:    ' + account.thresholds.low_threshold);
    console.log('    → Operations: Allow Trust, Bump Sequence');
    console.log('\n  Medium Threshold: ' + account.thresholds.med_threshold);
    console.log('    → Operations: Payments, Path Payments, Offers, Passive Offers');
    console.log('\n  High Threshold:   ' + account.thresholds.high_threshold);
    console.log('    → Operations: Set Options, Account Merge, Manage Data');

    // ============================================================
    // FLAGS
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('ACCOUNT FLAGS');
    console.log('═'.repeat(70));

    console.log('\n  Auth Required:    ' + (account.flags.auth_required ? '✅ YES' : '❌ NO'));
    console.log("    → Users must be approved to hold this account's assets");

    console.log('\n  Auth Revocable:   ' + (account.flags.auth_revocable ? '✅ YES' : '❌ NO'));
    console.log('    → Can revoke/freeze user asset holdings');

    console.log('\n  Auth Immutable:   ' + (account.flags.auth_immutable ? '✅ YES' : '❌ NO'));
    console.log('    → Authorization flags locked permanently');

    console.log(
      '\n  Auth Clawback:    ' + (account.flags.auth_clawback_enabled ? '✅ YES' : '❌ NO')
    );
    console.log('    → Can clawback (reclaim) assets from holders');

    // ============================================================
    // DATA ENTRIES
    // ============================================================
    if (Object.keys(account.data_attr).length > 0) {
      console.log('\n' + '═'.repeat(70));
      console.log('DATA ENTRIES (Key-Value Storage)');
      console.log('═'.repeat(70));

      Object.entries(account.data_attr).forEach(([key, value]) => {
        console.log(`\n  Key:   ${key}`);
        console.log(`  Value: ${Buffer.from(value, 'base64').toString('utf8')}`);
      });
    }

    // ============================================================
    // RESERVES CALCULATION
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('RESERVE CALCULATION');
    console.log('═'.repeat(70));

    const baseReserve = 0.5; // Current network base reserve
    const requiredReserve = (2 + account.subentry_count) * baseReserve;
    const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
    const totalXLM = parseFloat(xlmBalance.balance);
    const availableBalance = totalXLM - requiredReserve;

    console.log('\n  Formula: (2 + Subentry Count) × Base Reserve');
    console.log('  Calculation: (2 + ' + account.subentry_count + ') × ' + baseReserve + ' XLM');
    console.log('\n  Base Reserve:      ' + baseReserve + ' XLM');
    console.log('  Subentries:        ' + account.subentry_count);
    console.log('  Required Reserve:  ' + requiredReserve + ' XLM');
    console.log('  Total XLM:         ' + totalXLM + ' XLM');
    console.log('  Available to Spend: ' + availableBalance.toFixed(7) + ' XLM');

    if (account.subentry_count > 0) {
      console.log('\n  Subentries breakdown:');
      const trustlines = account.balances.filter((b) => b.asset_type !== 'native').length;
      if (trustlines > 0) {
        console.log('    - Trustlines: ' + trustlines);
      }
      const additionalSigners = account.signers.length - 1; // Exclude master
      if (additionalSigners > 0) {
        console.log('    - Additional Signers: ' + additionalSigners);
      }
      const dataEntries = Object.keys(account.data_attr).length;
      if (dataEntries > 0) {
        console.log('    - Data Entries: ' + dataEntries);
      }
    }

    // ============================================================
    // SPONSORSHIPS
    // ============================================================
    if (account.num_sponsoring > 0 || account.num_sponsored > 0) {
      console.log('\n' + '═'.repeat(70));
      console.log('SPONSORSHIPS');
      console.log('═'.repeat(70));

      console.log('\n  Sponsoring:  ' + account.num_sponsoring + ' entries');
      console.log('  Sponsored:   ' + account.num_sponsored + ' entries');
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n' + '═'.repeat(70));
    console.log('SUMMARY');
    console.log('═'.repeat(70));

    console.log('\n  Account Age:       Ledger ' + account.last_modified_ledger);
    console.log('  Total Assets:      ' + account.balances.length);
    console.log('  Signers:           ' + account.signers.length);
    console.log('  Multi-sig:         ' + (account.signers.length > 1 ? '✅ YES' : '❌ NO'));
    console.log('  Complexity:        ' + account.subentry_count + ' subentries');

    return account;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('\n❌ ERROR: Account not found!');
      console.log('   This account does not exist on the network.');
      console.log('   To create it, someone must send XLM to:', publicKey);
    } else {
      console.log('\n❌ ERROR:', error.message);
    }
    throw error;
  }
}

// ============================================================
// COMPARE TWO ACCOUNTS
// ============================================================
async function compareAccounts(publicKey1, publicKey2) {
  console.log('\n' + '═'.repeat(70));
  console.log('COMPARING TWO ACCOUNTS');
  console.log('═'.repeat(70));

  const account1 = await server.loadAccount(publicKey1);
  const account2 = await server.loadAccount(publicKey2);

  const getXLMBalance = (account) => {
    const xlm = account.balances.find((b) => b.asset_type === 'native');
    return parseFloat(xlm.balance);
  };

  console.log('\nMetric                  Account 1          Account 2');
  console.log('-'.repeat(70));
  console.log(
    'XLM Balance            ',
    getXLMBalance(account1).toFixed(2).padEnd(18),
    getXLMBalance(account2).toFixed(2)
  );
  console.log(
    'Subentries             ',
    account1.subentry_count.toString().padEnd(18),
    account2.subentry_count
  );
  console.log(
    'Signers                ',
    account1.signers.length.toString().padEnd(18),
    account2.signers.length
  );
  console.log('Sequence               ', account1.sequence.padEnd(18), account2.sequence);
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
  process.env.TESTNET_PUBLIC_KEY = 'GB6PZTMZQ3OK57434NDGYSF47STNOALB6VKI7MB6OHQNAIZZV5LUEA2M';
  // Check for testnet account in .env
  if (!process.env.TESTNET_PUBLIC_KEY) {
    console.log('\n⚠️  No TESTNET_PUBLIC_KEY found in .env file');
    console.log('\nTo get started:');
    console.log('1. Run: node src/phase3-keypairs-basics.js');
    console.log('2. Copy a public key');
    console.log('3. Fund it at: https://friendbot.stellar.org');
    console.log('4. Add to .env: TESTNET_PUBLIC_KEY=G...');
    return;
  }

  const publicKey = process.env.TESTNET_PUBLIC_KEY;
  console.log('\nInspecting account: ' + publicKey);

  await inspectAccount(publicKey);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Account Structure Inspection Complete!');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('\nFatal error:', error.message);
  process.exit(1);
});
