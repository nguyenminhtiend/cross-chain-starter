const StellarSdk = require('@stellar/stellar-sdk');
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');

console.log('='.repeat(70));
console.log('PHASE 3: All 4 Keypair Creation Methods');
console.log('='.repeat(70));

// ============================================================
// METHOD 1: RANDOM GENERATION
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('METHOD 1: RANDOM GENERATION');
console.log('═'.repeat(70));
console.log('Use case: Creating new accounts from scratch\n');

const randomPair = StellarSdk.Keypair.random();
console.log('Generated random keypair:');
console.log('  Public:  ' + randomPair.publicKey());
console.log('  Secret:  ' + randomPair.secret());
console.log('\n✅ Pros:');
console.log('  - Simple and fast');
console.log('  - Cryptographically secure (uses secure random source)');
console.log('❌ Cons:');
console.log('  - No recovery mechanism');
console.log('  - Must backup secret key manually');

// ============================================================
// METHOD 2: FROM SECRET KEY
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('METHOD 2: FROM SECRET KEY');
console.log('═'.repeat(70));
console.log('Use case: Loading existing accounts, restoring from backup\n');

const existingSecret = randomPair.secret(); // Using the one we just created
console.log('Restoring from secret key:');
console.log('  Input secret: ' + existingSecret);

const restoredPair = StellarSdk.Keypair.fromSecret(existingSecret);
console.log('  Restored public: ' + restoredPair.publicKey());
console.log('  Match: ' + (restoredPair.publicKey() === randomPair.publicKey() ? '✅' : '❌'));

console.log('\n✅ Pros:');
console.log('  - Simple restoration');
console.log('  - Works with any Stellar secret key');
console.log('❌ Cons:');
console.log('  - Must securely store/transmit 56-character secret');
console.log('  - Easy to make typos');

// ============================================================
// METHOD 3: FROM MNEMONIC (BIP39)
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('METHOD 3: FROM MNEMONIC (BIP39)');
console.log('═'.repeat(70));
console.log('Use case: Wallet recovery phrases, HD wallets, user-friendly backups\n');

// Generate mnemonic (12 words by default, can be 24)
const mnemonic12 = bip39.generateMnemonic(); // 128 bits = 12 words
const mnemonic24 = bip39.generateMnemonic(256); // 256 bits = 24 words

console.log('12-word mnemonic:');
console.log('  ' + mnemonic12);
console.log('\n24-word mnemonic (more secure):');
console.log('  ' + mnemonic24);

// Derive keypair from mnemonic
async function deriveKeypairFromMnemonic(mnemonic, accountIndex = 0) {
  // Validate mnemonic
  const isValid = bip39.validateMnemonic(mnemonic);
  console.log('\nMnemonic validation: ' + (isValid ? '✅' : '❌'));

  if (!isValid) {
    throw new Error('Invalid mnemonic');
  }

  // Convert mnemonic to seed
  const seed = await bip39.mnemonicToSeed(mnemonic);
  console.log('Seed (hex): ' + seed.toString('hex').substring(0, 32) + '...');

  // Derive keypair using BIP44 path for Stellar
  // Path format: m/44'/148'/accountIndex'
  // 44' = BIP44
  // 148' = Stellar coin type
  const path = `m/44'/148'/${accountIndex}'`;
  console.log('Derivation path: ' + path);

  const derived = derivePath(path, seed.toString('hex'));
  const keypair = StellarSdk.Keypair.fromRawEd25519Seed(derived.key);

  return keypair;
}

// Derive multiple accounts from same mnemonic
async function demonstrateBIP39() {
  console.log('\n' + '-'.repeat(70));
  console.log('Deriving multiple accounts from single mnemonic:');
  console.log('-'.repeat(70));

  // Generate a valid mnemonic for demonstration
  const demoMnemonic = bip39.generateMnemonic();
  console.log('Demo mnemonic (12 words):\n  ' + demoMnemonic);

  // Derive accounts 0, 1, 2
  for (let i = 0; i < 3; i++) {
    const keypair = await deriveKeypairFromMnemonic(demoMnemonic, i);
    console.log(`\nAccount ${i}:`);
    console.log('  Public: ' + keypair.publicKey());
    console.log('  Secret: ' + keypair.secret().substring(0, 10) + '...');
  }

  console.log('\n✅ Pros:');
  console.log('  - User-friendly recovery (12-24 words)');
  console.log('  - Can derive multiple accounts from one phrase');
  console.log('  - Industry standard (compatible with many wallets)');
  console.log('  - Hierarchical deterministic (HD) wallet support');
  console.log('❌ Cons:');
  console.log('  - More complex implementation');
  console.log('  - Need to remember account index');
  console.log('  - Must keep mnemonic phrase secure');
}

// ============================================================
// METHOD 4: FROM RAW ED25519 SEED
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('METHOD 4: FROM RAW ED25519 SEED');
console.log('═'.repeat(70));
console.log('Use case: Advanced cryptographic operations, custom key derivation\n');

// Create a deterministic 32-byte seed
const customSeed = Buffer.from(
  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  'hex'
);

console.log('Raw seed (hex): ' + customSeed.toString('hex'));
console.log('Seed length: ' + customSeed.length + ' bytes (must be exactly 32)');

const rawPair = StellarSdk.Keypair.fromRawEd25519Seed(customSeed);
console.log('\nDerived keypair:');
console.log('  Public: ' + rawPair.publicKey());
console.log('  Secret: ' + rawPair.secret());

// Demonstrate determinism
console.log('\nDeterminism test (same seed = same keys):');
const rawPair2 = StellarSdk.Keypair.fromRawEd25519Seed(customSeed);
console.log('  Second derivation matches: ' +
  (rawPair.publicKey() === rawPair2.publicKey() ? '✅' : '❌'));

console.log('\n✅ Pros:');
console.log('  - Maximum control over key generation');
console.log('  - Deterministic (same seed = same key)');
console.log('  - Useful for testing and custom derivation schemes');
console.log('❌ Cons:');
console.log('  - Must handle raw bytes carefully');
console.log('  - Easy to make mistakes');
console.log('  - Not user-friendly');

// ============================================================
// COMPARISON TABLE
// ============================================================
console.log('\n' + '═'.repeat(70));
console.log('COMPARISON TABLE');
console.log('═'.repeat(70));
console.log(`
Method              Ease of Use   Security   Recovery   Use Case
─────────────────────────────────────────────────────────────────────
1. Random           ⭐⭐⭐⭐⭐      ⭐⭐⭐⭐⭐    ❌         New accounts
2. From Secret      ⭐⭐⭐⭐        ⭐⭐⭐⭐⭐    ⭐          Loading existing
3. BIP39 Mnemonic   ⭐⭐⭐         ⭐⭐⭐⭐     ⭐⭐⭐⭐⭐     Wallets, recovery
4. Raw Seed         ⭐            ⭐⭐⭐⭐⭐    ⭐          Advanced/testing
`);

// ============================================================
// PRACTICAL RECOMMENDATIONS
// ============================================================
console.log('═'.repeat(70));
console.log('PRACTICAL RECOMMENDATIONS');
console.log('═'.repeat(70));
console.log(`
For Development/Testing:
  → Use Method 1 (Random) with .env storage
  → Use Method 4 (Raw Seed) for deterministic tests

For Production/Wallets:
  → Use Method 3 (BIP39) for user wallets
  → Store mnemonic encrypted
  → Support multiple derivation paths

For Existing Accounts:
  → Use Method 2 (From Secret) to load accounts
  → Store in secure key management system (AWS KMS, HashiCorp Vault, etc.)

For Maximum Security:
  → Use hardware wallets (Ledger/Trezor with BIP39)
  → Implement multi-signature (covered later)
  → Never store secrets in plain text
`);

// Run the async BIP39 demonstration
(async () => {
  await demonstrateBIP39();

  console.log('\n' + '='.repeat(70));
  console.log('✅ All 4 Keypair Creation Methods Demonstrated!');
  console.log('='.repeat(70));
})();
