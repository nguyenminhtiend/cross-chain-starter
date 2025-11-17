# Phase 3: Accounts and Keypairs Deep Dive

## Overview
This phase explores Stellar accounts in depth: cryptographic keypairs, account structure, reserves, fees, and advanced account management.

---

## Cryptographic Foundation

### Ed25519 Keypairs

Stellar uses **Ed25519** elliptic curve cryptography.

**Why Ed25519?**
- **Fast**: 20x faster than RSA-2048 for signing
- **Compact**: 32-byte keys (vs 256 bytes for RSA)
- **Secure**: Resistant to side-channel attacks
- **Deterministic**: No random number generation during signing

### Keypair Components

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

const pair = StellarSdk.Keypair.random();

console.log('Public Key:', pair.publicKey());   // Starts with 'G'
console.log('Secret Key:', pair.secret());      // Starts with 'S'
```

**Public Key (56 characters):**
- Address for receiving payments
- Safe to share publicly
- Encoded in **base32** format
- Example: `GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

**Secret Key (56 characters):**
- Signs transactions
- **NEVER share this**
- Grants full account control
- Example: `SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

---

## Key Encoding: StrKey Format

Stellar uses **StrKey** encoding (base32 with checksums).

### Prefix Meanings
- `G`: Public key (account address)
- `S`: Secret seed (private key)
- `T`: Pre-authorized transaction hash
- `X`: Signed payload
- `M`: Muxed account

### Why StrKey?
1. **Human-readable**: Easier than raw bytes
2. **Checksum protection**: Detects typos (last 6 chars)
3. **Type safety**: Prefix prevents mixing key types

### Code Example: Decode a Public Key

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

const publicKey = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// Decode to raw bytes
const decoded = StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);
console.log('Raw bytes:', decoded);
console.log('Hex:', Buffer.from(decoded).toString('hex'));

// Verify checksum
const isValid = StellarSdk.StrKey.isValidEd25519PublicKey(publicKey);
console.log('Valid:', isValid);
```

---

## Creating Keypairs: 4 Methods

### Method 1: Random Generation

```javascript
const pair = StellarSdk.Keypair.random();
console.log('Public:', pair.publicKey());
console.log('Secret:', pair.secret());
```

**When to use:** Creating new accounts

### Method 2: From Secret Key

```javascript
const secret = 'SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const pair = StellarSdk.Keypair.fromSecret(secret);
console.log('Restored public key:', pair.publicKey());
```

**When to use:** Loading existing accounts

### Method 3: From Mnemonic (BIP39)

```javascript
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');

// Generate mnemonic (12-24 words)
const mnemonic = bip39.generateMnemonic();
console.log('Mnemonic:', mnemonic);

// Derive seed
const seed = await bip39.mnemonicToSeed(mnemonic);

// Derive keypair using BIP44 path
const path = "m/44'/148'/0'"; // Stellar BIP44 path
const derived = derivePath(path, seed.toString('hex'));

const pair = StellarSdk.Keypair.fromRawEd25519Seed(
  Buffer.from(derived.key)
);

console.log('Derived public key:', pair.publicKey());
```

**When to use:** Wallet recovery phrases

### Method 4: From Raw Bytes

```javascript
const rawSeed = Buffer.from('your-32-byte-seed-here');
const pair = StellarSdk.Keypair.fromRawEd25519Seed(rawSeed);
```

**When to use:** Advanced cryptographic operations

---

## Account Structure

### Account Data Fields

```javascript
const StellarSdk = require('@stellar/stellar-sdk');
const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

async function inspectAccount(publicKey) {
  const account = await server.loadAccount(publicKey);

  console.log('Account Structure:');
  console.log('================');
  console.log('Account ID:', account.accountId());
  console.log('Sequence:', account.sequence);
  console.log('Subentry Count:', account.subentry_count);
  console.log('');

  console.log('Balances:');
  account.balances.forEach(b => {
    console.log(`  - ${b.asset_type === 'native' ? 'XLM' : b.asset_code}: ${b.balance}`);
  });
  console.log('');

  console.log('Signers:');
  account.signers.forEach(s => {
    console.log(`  - ${s.key} (weight: ${s.weight})`);
  });
  console.log('');

  console.log('Thresholds:');
  console.log('  Low:', account.thresholds.low_threshold);
  console.log('  Medium:', account.thresholds.med_threshold);
  console.log('  High:', account.thresholds.high_threshold);
  console.log('');

  console.log('Flags:');
  console.log('  Auth Required:', account.flags.auth_required);
  console.log('  Auth Revocable:', account.flags.auth_revocable);
  console.log('  Auth Immutable:', account.flags.auth_immutable);
}

// Test it
const myKey = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
inspectAccount(myKey);
```

---

## Account Reserves: Why You Can't Spend All Your XLM

### Base Reserve Calculation

```
Required Reserve = (2 + Subentry Count) × Base Reserve
```

- **Base Reserve**: Currently **0.5 XLM**
- **Minimum Account Balance**: 2 × 0.5 = **1 XLM**

### Subentries
Each subentry increases required reserve by 0.5 XLM:
- Trustline (asset)
- Offer (DEX order)
- Signer (additional signing key)
- Data entry
- Sponsorships

### Example Calculation

```javascript
async function calculateReserve(publicKey) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const account = await server.loadAccount(publicKey);
  const baseReserve = 0.5; // Current network value

  const requiredReserve = (2 + account.subentry_count) * baseReserve;
  const xlmBalance = account.balances.find(b => b.asset_type === 'native');
  const availableBalance = parseFloat(xlmBalance.balance) - requiredReserve;

  console.log('Reserve Calculation:');
  console.log('===================');
  console.log(`Base Reserve: ${baseReserve} XLM`);
  console.log(`Subentries: ${account.subentry_count}`);
  console.log(`Required Reserve: ${requiredReserve} XLM`);
  console.log(`Total XLM: ${xlmBalance.balance}`);
  console.log(`Available to Spend: ${availableBalance} XLM`);
}
```

**Why reserves?**
- Prevent spam accounts
- Ensure storage costs are covered
- Discourage ledger bloat

---

## Transaction Fees

### Fee Structure

**Base Fee**: 100 stroops per operation
- 1 stroop = 0.0000001 XLM
- 100 stroops = 0.00001 XLM ≈ $0.000001

**Total Fee** = Base Fee × Number of Operations

### Example: Multi-Operation Transaction

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

// Transaction with 3 operations
const fee = StellarSdk.BASE_FEE; // 100 stroops
const numOperations = 3;
const totalFee = fee * numOperations;

console.log('Fee per operation:', fee, 'stroops');
console.log('Total fee:', totalFee, 'stroops');
console.log('Total fee:', totalFee / 10000000, 'XLM');

// Output:
// Fee per operation: 100 stroops
// Total fee: 300 stroops
// Total fee: 0.00003 XLM
```

### Dynamic Fee Calculation

```javascript
async function calculateTransactionFee(operations) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Get current network fee stats
  const feeStats = await server.feeStats();

  console.log('Network Fee Stats:');
  console.log('  Min fee:', feeStats.min_accepted_fee, 'stroops');
  console.log('  Mode fee:', feeStats.mode_accepted_fee, 'stroops');
  console.log('  P50 fee:', feeStats.fee_charged.p50, 'stroops');

  // Calculate for your transaction
  const recommendedFee = parseInt(feeStats.fee_charged.max) || 100;
  const totalFee = recommendedFee * operations.length;

  console.log(`\nFor ${operations.length} operations:`);
  console.log(`  Recommended total: ${totalFee} stroops`);
  console.log(`  In XLM: ${totalFee / 10000000} XLM`);
}
```

**Why fees are so low:**
- No miners to pay
- Validators run on efficient SCP
- Goal is payment accessibility

---

## Account Creation: The Chicken-and-Egg Problem

### The Problem
You can't create an account without XLM, but you need an account to hold XLM.

### Solutions

#### 1. Friendbot (Testnet Only)
```javascript
async function fundWithFriendbot(publicKey) {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${publicKey}`
  );

  if (response.ok) {
    console.log('✅ Funded with 10,000 testnet XLM');
  }
}
```

#### 2. Create Account Operation (Mainnet)
Someone with XLM creates your account:

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function createNewAccount(fundingSecret, newPublicKey, startingBalance) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Load funding account
  const fundingKeypair = StellarSdk.Keypair.fromSecret(fundingSecret);
  const fundingAccount = await server.loadAccount(fundingKeypair.publicKey());

  // Build transaction
  const transaction = new StellarSdk.TransactionBuilder(fundingAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: newPublicKey,
        startingBalance: startingBalance.toString() // Must be >= 1 XLM
      })
    )
    .setTimeout(30)
    .build();

  // Sign and submit
  transaction.sign(fundingKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Account created!');
  console.log('Transaction hash:', result.hash);
}

// Usage
const mySecret = process.env.TESTNET_SECRET_KEY;
const newAccountPublicKey = 'GBXXXXXXXXXXXXXXXXXXXXX';
createNewAccount(mySecret, newAccountPublicKey, '2'); // 2 XLM
```

#### 3. Exchange Withdrawal (Mainnet)
Buy XLM on an exchange and withdraw to your address.

---

## Multi-Signature Accounts

### Why Multi-Sig?
- **Security**: Require multiple approvals
- **Business logic**: M-of-N signatures
- **Recovery**: Backup signers if key is lost

### Threshold Levels

**Low (0-255)**: Allow Trust, Bump Sequence
**Medium (0-255)**: Payments, Offers
**High (0-255)**: Account settings, Manage Data

### Example: 2-of-3 Multi-Sig

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function setupMultiSig(masterSecret) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecret);
  const masterAccount = await server.loadAccount(masterKeypair.publicKey());

  // Create two additional signers
  const signer1 = StellarSdk.Keypair.random();
  const signer2 = StellarSdk.Keypair.random();

  console.log('🔐 Setting up 2-of-3 multi-sig');
  console.log('Master:', masterKeypair.publicKey());
  console.log('Signer 1:', signer1.publicKey());
  console.log('Signer 2:', signer2.publicKey());

  // Build transaction to add signers
  const transaction = new StellarSdk.TransactionBuilder(masterAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    // Add signer 1 with weight 1
    .addOperation(
      StellarSdk.Operation.setOptions({
        signer: {
          ed25519PublicKey: signer1.publicKey(),
          weight: 1
        }
      })
    )
    // Add signer 2 with weight 1
    .addOperation(
      StellarSdk.Operation.setOptions({
        signer: {
          ed25519PublicKey: signer2.publicKey(),
          weight: 1
        }
      })
    )
    // Set master weight to 1
    .addOperation(
      StellarSdk.Operation.setOptions({
        masterWeight: 1,
        lowThreshold: 2,   // Require weight 2
        medThreshold: 2,   // Require weight 2
        highThreshold: 2   // Require weight 2
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(masterKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Multi-sig configured!');
  console.log('Now requires 2 signatures for any operation');

  return { master: masterKeypair, signer1, signer2 };
}
```

### Signing with Multiple Keys

```javascript
async function multiSigPayment(masterKeypair, signer1, recipientPublicKey, amount) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const sourceAccount = await server.loadAccount(masterKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString()
      })
    )
    .setTimeout(30)
    .build();

  // Sign with master and signer1 (2 of 3)
  transaction.sign(masterKeypair);
  transaction.sign(signer1);

  console.log('Signatures:', transaction.signatures.length);

  const result = await server.submitTransaction(transaction);
  console.log('✅ Multi-sig payment sent!');
}
```

---

## Account Flags

### Three Authorization Flags

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function setAccountFlags(secretKey) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.setOptions({
        setFlags: StellarSdk.AuthRequiredFlag | StellarSdk.AuthRevocableFlag
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(keypair);
  await server.submitTransaction(transaction);

  console.log('✅ Flags set!');
}
```

**Flag Meanings:**

1. **AUTH_REQUIRED_FLAG**
   - Users must be approved to hold your asset
   - Use case: Regulated securities, KYC compliance

2. **AUTH_REVOCABLE_FLAG**
   - You can revoke (freeze) asset holdings
   - Use case: Compliance, fraud prevention

3. **AUTH_IMMUTABLE_FLAG**
   - Locks the above flags permanently
   - Cannot change authorization settings

---

## Practical Exercise: Build a Key Management Tool

### File: `src/key-manager.js`

```javascript
const StellarSdk = require('@stellar/stellar-sdk');
const fs = require('fs');
const crypto = require('crypto');

class KeyManager {
  constructor() {
    this.keys = {};
  }

  // Generate new keypair
  generateKeypair(label) {
    const pair = StellarSdk.Keypair.random();
    this.keys[label] = {
      public: pair.publicKey(),
      secret: pair.secret(),
      created: new Date().toISOString()
    };
    console.log(`✅ Generated keypair: ${label}`);
    console.log(`   Public: ${pair.publicKey()}`);
    return pair;
  }

  // Save encrypted keys to file
  saveToFile(filename, password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(this.keys), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    fs.writeFileSync(filename, JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted
    }));

    console.log(`✅ Keys saved to ${filename}`);
  }

  // Load encrypted keys from file
  loadFromFile(filename, password) {
    const fileData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = Buffer.from(fileData.iv, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(fileData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    this.keys = JSON.parse(decrypted);
    console.log(`✅ Loaded ${Object.keys(this.keys).length} keypairs`);
  }

  // List all keys
  list() {
    console.log('\n🔑 Managed Keypairs:');
    Object.entries(this.keys).forEach(([label, data]) => {
      console.log(`\n  ${label}:`);
      console.log(`    Public: ${data.public}`);
      console.log(`    Created: ${data.created}`);
    });
  }

  // Get keypair by label
  getKeypair(label) {
    if (!this.keys[label]) {
      throw new Error(`Keypair ${label} not found`);
    }
    return StellarSdk.Keypair.fromSecret(this.keys[label].secret);
  }
}

// Usage example
async function main() {
  const manager = new KeyManager();

  // Generate keys
  manager.generateKeypair('main-account');
  manager.generateKeypair('backup-account');
  manager.generateKeypair('cold-storage');

  // Save encrypted
  manager.saveToFile('keys.enc', 'your-strong-password');

  // List
  manager.list();

  // Load later
  // const newManager = new KeyManager();
  // newManager.loadFromFile('keys.enc', 'your-strong-password');
}

main();
```

---

## Key Takeaways

1. **Ed25519 keypairs** are the foundation of Stellar accounts
2. **Account reserves** prevent spam (minimum 1 XLM)
3. **Fees are tiny** (~$0.000001 per operation)
4. **Multi-sig** enables shared account control
5. **StrKey encoding** provides checksums and type safety
6. **Never share secret keys** - they grant full account access

---

## Next Steps

Move to **Phase 4** where you'll:
- Build and submit transactions
- Understand sequence numbers
- Implement payment operations
- Handle transaction errors

---

## Security Checklist

- [ ] Never commit secret keys to git
- [ ] Use environment variables for secrets
- [ ] Enable 2FA on exchanges
- [ ] Test on testnet first
- [ ] Keep backups of secret keys (encrypted)
- [ ] Consider hardware wallets for mainnet
- [ ] Verify addresses character-by-character
- [ ] Use multi-sig for high-value accounts
