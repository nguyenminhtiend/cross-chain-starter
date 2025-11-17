const StellarSdk = require('@stellar/stellar-sdk');

console.log('='.repeat(60));
console.log('PHASE 3: Keypairs and Accounts - Basic Examples');
console.log('='.repeat(60));

// ============================================================
// 1. RANDOM KEYPAIR GENERATION
// ============================================================
console.log('\n1. RANDOM KEYPAIR GENERATION');
console.log('-'.repeat(60));

const pair1 = StellarSdk.Keypair.random();
console.log('Generated Keypair:');
console.log('  Public Key (G...):', pair1.publicKey());
console.log('  Secret Key (S...):', pair1.secret());
console.log('  Public key length:', pair1.publicKey().length, 'characters');
console.log('  Secret key length:', pair1.secret().length, 'characters');

// ============================================================
// 2. KEYPAIR FROM SECRET KEY
// ============================================================
console.log('\n2. RESTORE KEYPAIR FROM SECRET KEY');
console.log('-'.repeat(60));

// Save the secret from pair1
const savedSecret = pair1.secret();
console.log('Saved secret:', savedSecret);

// Restore it later
const restoredPair = StellarSdk.Keypair.fromSecret(savedSecret);
console.log('Restored public key:', restoredPair.publicKey());
console.log('Keys match:', restoredPair.publicKey() === pair1.publicKey() ? '✅' : '❌');

// ============================================================
// 3. STRKEY ENCODING - Understanding the Format
// ============================================================
console.log('\n3. STRKEY ENCODING & VALIDATION');
console.log('-'.repeat(60));

const testPublicKey = pair1.publicKey();
console.log('Public key:', testPublicKey);
console.log('  Starts with:', testPublicKey[0], '(G = Public Key)');
console.log('  Length:', testPublicKey.length, 'chars');

// Decode to raw bytes
const decoded = StellarSdk.StrKey.decodeEd25519PublicKey(testPublicKey);
console.log('  Raw bytes (length):', decoded.length, 'bytes');
console.log('  Hex representation:', Buffer.from(decoded).toString('hex').substring(0, 32) + '...');

// Validation
const isValid = StellarSdk.StrKey.isValidEd25519PublicKey(testPublicKey);
console.log('  Valid public key:', isValid ? '✅' : '❌');

// Test invalid key
const invalidKey = 'GINVALIDKEY';
const isInvalid = StellarSdk.StrKey.isValidEd25519PublicKey(invalidKey);
console.log('  Invalid key check:', !isInvalid ? '✅ Correctly rejected' : '❌');

// ============================================================
// 4. KEYPAIR PREFIXES
// ============================================================
console.log('\n4. STELLAR KEY PREFIXES');
console.log('-'.repeat(60));
console.log('  G = Public key (account address)');
console.log('  S = Secret seed (private key)');
console.log('  T = Pre-authorized transaction hash');
console.log('  X = Signed payload');
console.log('  M = Muxed account');

// ============================================================
// 5. GENERATE MULTIPLE KEYPAIRS
// ============================================================
console.log('\n5. GENERATING MULTIPLE KEYPAIRS FOR DIFFERENT PURPOSES');
console.log('-'.repeat(60));

const accounts = {
  main: StellarSdk.Keypair.random(),
  backup: StellarSdk.Keypair.random(),
  distribution: StellarSdk.Keypair.random()
};

Object.entries(accounts).forEach(([name, keypair]) => {
  console.log(`\n${name.toUpperCase()} Account:`);
  console.log(`  Public: ${keypair.publicKey()}`);
  console.log(`  Secret: ${keypair.secret().substring(0, 10)}... (hidden)`);
});

// ============================================================
// 6. RAW ED25519 OPERATIONS
// ============================================================
console.log('\n6. RAW ED25519 OPERATIONS');
console.log('-'.repeat(60));

const rawSeed = Buffer.from('0'.repeat(64), 'hex'); // Example 32-byte seed
const pairFromRaw = StellarSdk.Keypair.fromRawEd25519Seed(rawSeed);
console.log('Keypair from raw seed:');
console.log('  Public:', pairFromRaw.publicKey());
console.log('  This is deterministic - same seed = same keypair');

// ============================================================
// 7. SIGNING AND VERIFICATION
// ============================================================
console.log('\n7. DIGITAL SIGNATURES');
console.log('-'.repeat(60));

const message = Buffer.from('Hello Stellar!');
const signature = pair1.sign(message);
console.log('Message:', message.toString());
console.log('Signature (hex):', signature.toString('hex').substring(0, 32) + '...');
console.log('Signature length:', signature.length, 'bytes (64 bytes for Ed25519)');

// Verify signature
const isSignatureValid = pair1.verify(message, signature);
console.log('Signature valid:', isSignatureValid ? '✅' : '❌');

// Try to verify with wrong message
const wrongMessage = Buffer.from('Wrong message');
const isWrongValid = pair1.verify(wrongMessage, signature);
console.log('Wrong message verification:', !isWrongValid ? '✅ Correctly rejected' : '❌');

// ============================================================
// 8. SECURITY BEST PRACTICES
// ============================================================
console.log('\n8. SECURITY BEST PRACTICES');
console.log('-'.repeat(60));
console.log('✅ DO:');
console.log('  - Store secret keys in environment variables');
console.log('  - Use encrypted key storage for production');
console.log('  - Test on testnet first');
console.log('  - Keep backups of secret keys (encrypted)');
console.log('  - Verify addresses character-by-character');
console.log('\n❌ DON\'T:');
console.log('  - Commit secret keys to git');
console.log('  - Share secret keys');
console.log('  - Store secrets in plain text');
console.log('  - Skip validation');

console.log('\n' + '='.repeat(60));
console.log('✅ Phase 3 - Basics Complete!');
console.log('='.repeat(60));
