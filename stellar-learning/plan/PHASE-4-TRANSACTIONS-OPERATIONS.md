# Phase 4: Transactions and Operations

## Overview
This phase covers the core of Stellar interactions: building, signing, and submitting transactions. You'll learn about sequence numbers, operation types, and error handling.

---

## Transaction Anatomy

A Stellar transaction is like a **container** that holds 1-100 operations.

### Transaction Structure

```javascript
{
  source_account: "GBXXXXX...",     // Who is sending
  fee: 100,                          // Fee in stroops
  sequence_number: "123456789",      // Nonce
  operations: [...],                 // 1-100 operations
  memo: null,                        // Optional memo
  time_bounds: {...},                // Optional validity window
  signatures: [...]                  // Ed25519 signatures
}
```

### Key Components

1. **Source Account**: Pays fees, increments sequence
2. **Fee**: Total fee for all operations
3. **Sequence Number**: Prevents replay attacks
4. **Operations**: Actions to perform
5. **Memo**: Optional metadata
6. **Time Bounds**: Optional validity period
7. **Signatures**: Cryptographic proofs

---

## Sequence Numbers: The Nonce System

### Why Sequence Numbers?

Prevent **replay attacks**: Without sequence numbers, someone could rebroadcast your transaction.

### How It Works

- Every account has a sequence number (starts at 0)
- Each transaction must use: `current_sequence + 1`
- After successful transaction, account sequence increments
- Old transactions become invalid

### Example: Sequence Number Flow

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function demonstrateSequence() {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const keypair = StellarSdk.Keypair.fromSecret(process.env.TESTNET_SECRET_KEY);
  const account = await server.loadAccount(keypair.publicKey());

  console.log('Current sequence:', account.sequence);
  console.log('Next transaction will use:', account.sequenceNumber());

  // After transaction, sequence becomes: current + 1
}
```

### Manual Sequence Management

```javascript
// Load account
const account = await server.loadAccount(publicKey);
console.log('Current sequence:', account.sequence);

// Manually increment for testing
account.incrementSequenceNumber();
console.log('After increment:', account.sequence);
```

**Warning**: Only increment manually for testing. TransactionBuilder handles this automatically.

---

## Building Your First Transaction

### Step-by-Step Payment Transaction

```javascript
const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

async function sendPayment(recipientPublicKey, amount) {
  // 1. Configure network
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );
  const networkPassphrase = StellarSdk.Networks.TESTNET;

  // 2. Load source account
  const sourceKeypair = StellarSdk.Keypair.fromSecret(
    process.env.TESTNET_SECRET_KEY
  );
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  console.log('Source account loaded');
  console.log('Current sequence:', sourceAccount.sequence);

  // 3. Build transaction
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,          // 100 stroops
    networkPassphrase: networkPassphrase
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: StellarSdk.Asset.native(), // XLM
        amount: amount.toString()
      })
    )
    .setTimeout(30) // Transaction valid for 30 seconds
    .build();

  console.log('Transaction built');
  console.log('Hash:', transaction.hash().toString('hex'));

  // 4. Sign transaction
  transaction.sign(sourceKeypair);
  console.log('Transaction signed');

  // 5. Submit to network
  try {
    const result = await server.submitTransaction(transaction);
    console.log('✅ Payment successful!');
    console.log('Transaction hash:', result.hash);
    console.log('Ledger:', result.ledger);
    return result;
  } catch (error) {
    console.error('❌ Transaction failed');
    console.error('Error:', error.response?.data?.extras?.result_codes);
    throw error;
  }
}

// Usage
const recipient = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
sendPayment(recipient, '10.5');
```

### Code Breakdown

#### 1. TransactionBuilder
```javascript
new StellarSdk.TransactionBuilder(sourceAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET
})
```

**Parameters:**
- `sourceAccount`: AccountResponse object (from loadAccount)
- `fee`: Fee per operation (100 stroops = 0.00001 XLM)
- `networkPassphrase`: Prevents cross-network replay attacks

#### 2. Add Operations
```javascript
.addOperation(
  StellarSdk.Operation.payment({
    destination: recipientPublicKey,
    asset: StellarSdk.Asset.native(),
    amount: '10.5'
  })
)
```

Can add up to 100 operations!

#### 3. Set Timeout
```javascript
.setTimeout(30)
```

Transaction expires after 30 seconds. Prevents old transactions from being submitted.

#### 4. Build
```javascript
.build()
```

Finalizes the transaction. After this, you can't add more operations.

#### 5. Sign
```javascript
transaction.sign(keypair)
```

Signs with source account's secret key. Multi-sig accounts need multiple signatures.

#### 6. Submit
```javascript
await server.submitTransaction(transaction)
```

Sends to Horizon, which forwards to Stellar Core validators.

---

## Operation Types

Stellar supports **13 operation types**. Here are the most important:

### 1. Payment
Send asset from one account to another.

```javascript
StellarSdk.Operation.payment({
  destination: 'GBXXXXX...',
  asset: StellarSdk.Asset.native(), // or custom asset
  amount: '100.5'
})
```

### 2. Create Account
Create and fund a new account.

```javascript
StellarSdk.Operation.createAccount({
  destination: 'GBXXXXX...',
  startingBalance: '2' // Minimum 1 XLM
})
```

### 3. Path Payment Strict Send
Send one asset, recipient receives different asset.

```javascript
StellarSdk.Operation.pathPaymentStrictSend({
  sendAsset: assetUSD,
  sendAmount: '100',
  destination: 'GBXXXXX...',
  destAsset: assetEUR,
  destMin: '85', // Minimum to receive (slippage protection)
  path: [assetBTC] // Intermediate assets
})
```

### 4. Manage Buy Offer
Place order on Stellar DEX.

```javascript
StellarSdk.Operation.manageBuyOffer({
  selling: assetUSD,
  buying: assetEUR,
  buyAmount: '1000',
  price: '1.18', // 1 EUR = 1.18 USD
  offerId: 0 // 0 = new offer
})
```

### 5. Change Trust
Add trustline to accept custom asset.

```javascript
StellarSdk.Operation.changeTrust({
  asset: new StellarSdk.Asset('USD', issuerPublicKey),
  limit: '10000' // Maximum willing to hold
})
```

### 6. Set Options
Modify account settings (signers, thresholds, flags).

```javascript
StellarSdk.Operation.setOptions({
  homeDomain: 'example.com',
  masterWeight: 1,
  lowThreshold: 2,
  medThreshold: 2,
  highThreshold: 2,
  signer: {
    ed25519PublicKey: newSignerPublicKey,
    weight: 1
  }
})
```

### 7. Manage Data
Store key-value data on account.

```javascript
StellarSdk.Operation.manageData({
  name: 'user_id',
  value: '12345'
})
```

---

## Multi-Operation Transactions

### Example: Create Account + Multiple Payments

```javascript
async function batchOperations() {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const sourceKeypair = StellarSdk.Keypair.fromSecret(
    process.env.TESTNET_SECRET_KEY
  );
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  // Create new account keypair
  const newAccountKeypair = StellarSdk.Keypair.random();
  console.log('New account:', newAccountKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    // Operation 1: Create new account
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: newAccountKeypair.publicKey(),
        startingBalance: '2'
      })
    )
    // Operation 2: Send to recipient A
    .addOperation(
      StellarSdk.Operation.payment({
        destination: 'GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        asset: StellarSdk.Asset.native(),
        amount: '10'
      })
    )
    // Operation 3: Send to recipient B
    .addOperation(
      StellarSdk.Operation.payment({
        destination: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        asset: StellarSdk.Asset.native(),
        amount: '5'
      })
    )
    .setTimeout(30)
    .build();

  // Total fee: 100 * 3 = 300 stroops
  console.log('Total fee:', transaction.fee, 'stroops');

  transaction.sign(sourceKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Batch transaction successful!');
  console.log('3 operations executed atomically');
}
```

**Key insight**: All operations succeed or all fail (atomic execution).

---

## Memos: Adding Metadata

Memos attach metadata to transactions. Useful for:
- Exchange deposit identification
- Invoice numbers
- Notes

### Memo Types

```javascript
// 1. Text memo (up to 28 bytes)
.addMemo(StellarSdk.Memo.text('Invoice #12345'))

// 2. ID memo (64-bit unsigned integer)
.addMemo(StellarSdk.Memo.id('12345678'))

// 3. Hash memo (32-byte hash)
.addMemo(StellarSdk.Memo.hash(Buffer.from('hash-data-here')))

// 4. Return memo (32-byte hash for refunds)
.addMemo(StellarSdk.Memo.return(Buffer.from('return-hash')))
```

### Example: Exchange Deposit

```javascript
const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET
})
  .addOperation(
    StellarSdk.Operation.payment({
      destination: 'EXCHANGE_ADDRESS',
      asset: StellarSdk.Asset.native(),
      amount: '100'
    })
  )
  .addMemo(StellarSdk.Memo.id('987654321')) // User ID
  .setTimeout(30)
  .build();
```

**Warning**: Always include memo when sending to exchanges!

---

## Time Bounds: Transaction Expiry

### Why Time Bounds?

- Prevent old transactions from being submitted
- Create time-locked transactions
- Improve security

### Setting Time Bounds

```javascript
const minTime = Math.floor(Date.now() / 1000); // Now
const maxTime = minTime + 300; // Valid for 5 minutes

const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
  timebounds: {
    minTime: minTime,
    maxTime: maxTime
  }
})
  .addOperation(...)
  .build();
```

### Shortcut: setTimeout

```javascript
.setTimeout(30) // Valid for 30 seconds from now
```

Equivalent to:
```javascript
timebounds: {
  minTime: 0,
  maxTime: now + 30
}
```

---

## Error Handling

### Common Transaction Errors

```javascript
async function handleTransactionErrors() {
  try {
    await server.submitTransaction(transaction);
  } catch (error) {
    const resultCodes = error.response?.data?.extras?.result_codes;

    if (resultCodes) {
      console.log('Transaction result:', resultCodes.transaction);
      console.log('Operation results:', resultCodes.operations);

      // Handle specific errors
      switch (resultCodes.transaction) {
        case 'tx_insufficient_balance':
          console.error('Not enough XLM for transaction + fees');
          break;
        case 'tx_bad_seq':
          console.error('Sequence number mismatch - reload account');
          break;
        case 'tx_insufficient_fee':
          console.error('Fee too low - increase fee');
          break;
        case 'tx_too_late':
          console.error('Transaction expired (time bounds)');
          break;
        default:
          console.error('Unknown transaction error:', resultCodes.transaction);
      }

      // Check operation-specific errors
      resultCodes.operations?.forEach((opResult, index) => {
        if (opResult !== 'op_success') {
          console.error(`Operation ${index} failed:`, opResult);
        }
      });
    }
  }
}
```

### Common Operation Errors

**Payment Errors:**
- `op_underfunded`: Insufficient balance
- `op_no_destination`: Destination account doesn't exist
- `op_line_full`: Destination trustline limit exceeded

**Create Account Errors:**
- `op_already_exists`: Account already exists
- `op_underfunded`: Starting balance too low

**Change Trust Errors:**
- `op_invalid_limit`: Trustline limit invalid
- `op_no_issuer`: Asset issuer doesn't exist

### Retry Logic

```javascript
async function submitWithRetry(transaction, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await server.submitTransaction(transaction);
      return result;
    } catch (error) {
      const code = error.response?.data?.extras?.result_codes?.transaction;

      if (code === 'tx_bad_seq') {
        console.log('Sequence error, reloading account...');
        // Reload account and rebuild transaction
        throw new Error('Rebuild transaction with new sequence');
      }

      if (i === maxRetries - 1) throw error;

      console.log(`Retry ${i + 1}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

---

## Transaction Signatures

### Single Signature

```javascript
transaction.sign(keypair);
```

### Multiple Signatures (Multi-Sig)

```javascript
transaction.sign(keypair1);
transaction.sign(keypair2);
transaction.sign(keypair3);

console.log('Signatures:', transaction.signatures.length);
```

### Signature XDR (for offline signing)

```javascript
// Export unsigned transaction
const xdr = transaction.toEnvelope().toXDR('base64');
console.log('Unsigned XDR:', xdr);

// ... Send to offline machine ...

// On offline machine: sign
const signedTx = new StellarSdk.Transaction(xdr, networkPassphrase);
signedTx.sign(coldWalletKeypair);

// Export signed XDR
const signedXdr = signedTx.toEnvelope().toXDR('base64');

// ... Send back to online machine ...

// Submit signed transaction
const finalTx = new StellarSdk.Transaction(signedXdr, networkPassphrase);
await server.submitTransaction(finalTx);
```

---

## Practical Example: Payment Script

### File: `src/send-payment.js`

```javascript
const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

async function sendPayment(destination, amount, memo = null) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Load source account
  const sourceKeypair = StellarSdk.Keypair.fromSecret(
    process.env.TESTNET_SECRET_KEY
  );
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  console.log('💸 Sending Payment');
  console.log('From:', sourceKeypair.publicKey());
  console.log('To:', destination);
  console.log('Amount:', amount, 'XLM');
  if (memo) console.log('Memo:', memo);
  console.log('');

  // Build transaction
  let txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destination,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString()
      })
    )
    .setTimeout(30);

  // Add memo if provided
  if (memo) {
    txBuilder = txBuilder.addMemo(StellarSdk.Memo.text(memo));
  }

  const transaction = txBuilder.build();

  // Sign and submit
  transaction.sign(sourceKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('✅ Payment successful!');
    console.log('Hash:', result.hash);
    console.log('Ledger:', result.ledger);
    console.log(`\nView on StellarExpert:`);
    console.log(`https://stellar.expert/explorer/testnet/tx/${result.hash}`);
  } catch (error) {
    console.error('❌ Payment failed');
    const codes = error.response?.data?.extras?.result_codes;
    if (codes) {
      console.error('Transaction:', codes.transaction);
      console.error('Operations:', codes.operations);
    } else {
      console.error(error.message);
    }
  }
}

// Command line usage
const [destination, amount, memo] = process.argv.slice(2);

if (!destination || !amount) {
  console.log('Usage: node send-payment.js <destination> <amount> [memo]');
  console.log('Example: node send-payment.js GBXXX... 10 "test payment"');
  process.exit(1);
}

sendPayment(destination, amount, memo);
```

**Run it:**
```bash
node src/send-payment.js GBXXXXXXXX... 10 "Test payment"
```

---

## Key Takeaways

1. **Transactions contain 1-100 operations** executed atomically
2. **Sequence numbers prevent replay attacks**
3. **TransactionBuilder** handles complexity
4. **All operations must succeed** or all fail
5. **Memos** identify transactions (critical for exchanges)
6. **Time bounds** prevent old transactions
7. **Error handling** is crucial for production

---

## Next Steps

Move to **Phase 5** where you'll:
- Work with custom assets
- Create trustlines
- Issue your own token
- Handle multi-currency payments

---

## Exercise Challenges

1. **Send Payment**: Send 5 XLM to a friend with a memo
2. **Batch Operations**: Create 3 payments in one transaction
3. **Multi-Sig**: Create a 2-of-2 multi-sig account and send payment
4. **Error Handling**: Implement retry logic with exponential backoff
5. **Atomic Swap**: Use manage data + payment in one transaction
