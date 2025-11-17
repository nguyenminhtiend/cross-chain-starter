# Phase 5: Assets and Payments

## Overview
This phase covers Stellar's powerful multi-currency system: creating custom assets, trustlines, issuing tokens, and handling cross-asset payments.

---

## Understanding Stellar Assets

### Two Asset Types

1. **Native Asset (XLM)**
   - Built into the protocol
   - No issuer needed
   - Used for fees and reserves
   - Created: `StellarSdk.Asset.native()`

2. **Custom Assets (Issued Assets)**
   - Represent any value (USD, EUR, BTC, stocks, etc.)
   - Require an **issuer account**
   - Users must **trust** the issuer
   - Identified by: `code` + `issuer`

### Asset Identity

An asset is uniquely identified by:
```javascript
{
  code: "USD",                    // Asset code (1-12 chars)
  issuer: "GBXXXX..."            // Issuer public key
}
```

**Important**: Same code, different issuer = different asset
- Bank A's USD ≠ Bank B's USD
- You choose which USD to trust

---

## The Trust Model

### Why Trustlines?

**Problem**: Without permission, anyone could issue "fake" USD and credit your account.

**Solution**: You must explicitly **trust** an issuer before holding their asset.

### Trustline Lifecycle

```
1. Issuer creates account
2. User creates trustline to issuer's asset
3. Issuer can now send asset to user
4. User holds asset in balance
```

### Creating a Trustline

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function createTrustline(userSecret, assetCode, issuerPublicKey, limit = '10000') {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Load user account
  const userKeypair = StellarSdk.Keypair.fromSecret(userSecret);
  const userAccount = await server.loadAccount(userKeypair.publicKey());

  // Create asset object
  const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

  console.log('🤝 Creating trustline');
  console.log('Asset:', assetCode);
  console.log('Issuer:', issuerPublicKey);
  console.log('Limit:', limit);

  // Build transaction
  const transaction = new StellarSdk.TransactionBuilder(userAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: limit // Maximum willing to hold
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(userKeypair);

  try {
    const result = await server.submitTransaction(transaction);
    console.log('✅ Trustline created!');
    console.log('Hash:', result.hash);

    // Verify trustline
    const updatedAccount = await server.loadAccount(userKeypair.publicKey());
    const trustline = updatedAccount.balances.find(
      b => b.asset_code === assetCode && b.asset_issuer === issuerPublicKey
    );

    if (trustline) {
      console.log('Balance:', trustline.balance);
      console.log('Limit:', trustline.limit);
    }

  } catch (error) {
    console.error('❌ Failed to create trustline');
    console.error(error.response?.data?.extras?.result_codes);
  }
}

// Usage
const mySecret = process.env.TESTNET_SECRET_KEY;
const issuer = 'ISSUER_PUBLIC_KEY';
createTrustline(mySecret, 'USD', issuer, '100000');
```

### Trustline Limits

**Why limits?**
- Protect against unwanted credits
- Compliance requirements
- Risk management

**Setting limits:**
```javascript
// Accept up to 10,000 USD
limit: '10000'

// Accept unlimited (not recommended)
limit: '922337203685.4775807' // Max int64 / 10^7

// Remove trustline (must have 0 balance)
limit: '0'
```

---

## Issuing Your Own Asset

### Complete Example: USD Stablecoin

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function issueAsset() {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Step 1: Create issuer account
  console.log('Step 1: Creating issuer account...');
  const issuerKeypair = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
  console.log('Issuer:', issuerKeypair.publicKey());
  console.log('Secret:', issuerKeypair.secret());

  // Step 2: Create distribution account
  console.log('\nStep 2: Creating distribution account...');
  const distributorKeypair = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${distributorKeypair.publicKey()}`);
  console.log('Distributor:', distributorKeypair.publicKey());

  // Step 3: Distribution account trusts issuer's USD
  console.log('\nStep 3: Creating trustline...');
  const distributorAccount = await server.loadAccount(distributorKeypair.publicKey());
  const assetUSD = new StellarSdk.Asset('USD', issuerKeypair.publicKey());

  const trustTransaction = new StellarSdk.TransactionBuilder(distributorAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: assetUSD,
        limit: '1000000'
      })
    )
    .setTimeout(30)
    .build();

  trustTransaction.sign(distributorKeypair);
  await server.submitTransaction(trustTransaction);
  console.log('✅ Trustline created');

  // Step 4: Issuer sends USD to distributor
  console.log('\nStep 4: Issuing USD tokens...');
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  const issueTransaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: distributorKeypair.publicKey(),
        asset: assetUSD,
        amount: '100000' // Issue 100,000 USD
      })
    )
    .setTimeout(30)
    .build();

  issueTransaction.sign(issuerKeypair);
  const result = await server.submitTransaction(issueTransaction);
  console.log('✅ Issued 100,000 USD');
  console.log('Hash:', result.hash);

  // Step 5: Verify balances
  console.log('\nStep 5: Verifying balances...');
  const updatedDistributor = await server.loadAccount(distributorKeypair.publicKey());
  const usdBalance = updatedDistributor.balances.find(
    b => b.asset_code === 'USD'
  );

  console.log('Distributor USD balance:', usdBalance.balance);

  return {
    issuer: issuerKeypair,
    distributor: distributorKeypair,
    asset: assetUSD
  };
}

// Run it
issueAsset()
  .then(({ issuer, distributor, asset }) => {
    console.log('\n🎉 Asset issuance complete!');
    console.log('\nSave these keys:');
    console.log('Issuer secret:', issuer.secret());
    console.log('Distributor secret:', distributor.secret());
  });
```

### Why Two Accounts?

**Issuer Account:**
- Creates the asset
- Should be secured (cold storage)
- Low activity

**Distribution Account:**
- Holds issued tokens
- Sends to users
- Active account

**Best practice**: Lock issuer account after issuance (see below).

---

## Asset Authorization Flags

### Three Authorization Levels

```javascript
async function setAuthorizationFlags(issuerSecret) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.setOptions({
        // Require approval to hold this asset
        setFlags: StellarSdk.AuthRequiredFlag |
                  // Can revoke trustlines
                  StellarSdk.AuthRevocableFlag
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuerKeypair);
  await server.submitTransaction(transaction);

  console.log('✅ Authorization flags set');
}
```

### Flag Meanings

1. **AUTH_REQUIRED_FLAG**
   - Users need approval to hold asset
   - Use case: KYC/AML compliance
   ```javascript
   // Approve a trustline
   StellarSdk.Operation.setTrustLineFlags({
     trustor: userPublicKey,
     asset: myAsset,
     flags: {
       authorized: true
     }
   })
   ```

2. **AUTH_REVOCABLE_FLAG**
   - Issuer can freeze assets
   - Use case: Compliance, fraud prevention
   ```javascript
   // Revoke authorization
   StellarSdk.Operation.setTrustLineFlags({
     trustor: userPublicKey,
     asset: myAsset,
     flags: {
       authorized: false
     }
   })
   ```

3. **AUTH_IMMUTABLE_FLAG**
   - Lock authorization settings permanently
   - Cannot be undone!

---

## Locking the Issuer Account

### Why Lock?

- Limits total supply
- Proves no more tokens can be minted
- Increases trust

### How to Lock

```javascript
async function lockIssuerAccount(issuerSecret) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  console.log('⚠️  WARNING: This will permanently lock the issuer account!');
  console.log('No more tokens can be issued after this.');

  const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.setOptions({
        masterWeight: 0,    // Remove signing power
        lowThreshold: 1,
        medThreshold: 1,
        highThreshold: 1
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuerKeypair);
  await server.submitTransaction(transaction);

  console.log('🔒 Issuer account locked');
  console.log('Total supply is now fixed');
}
```

**Warning**: This is irreversible! Test thoroughly first.

---

## Multi-Currency Payments

### Sending Custom Assets

```javascript
async function sendCustomAsset(senderSecret, recipientPublicKey, asset, amount) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const senderAccount = await server.loadAccount(senderKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: asset,
        amount: amount.toString()
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(senderKeypair);
  const result = await server.submitTransaction(transaction);

  console.log('✅ Payment sent');
  console.log('Asset:', asset.code);
  console.log('Amount:', amount);
}

// Usage
const assetUSD = new StellarSdk.Asset('USD', 'ISSUER_PUBLIC_KEY');
sendCustomAsset(mySecret, recipientKey, assetUSD, '50');
```

### Prerequisites for Custom Asset Payments

**Before sending, verify:**
1. Sender has trustline to asset ✓
2. Sender has sufficient balance ✓
3. Recipient has trustline to asset ✓
4. Asset is not frozen ✓

```javascript
async function canSendAsset(senderPubKey, recipientPubKey, asset, amount) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  // Check sender
  const senderAccount = await server.loadAccount(senderPubKey);
  const senderBalance = senderAccount.balances.find(
    b => b.asset_code === asset.code && b.asset_issuer === asset.issuer
  );

  if (!senderBalance) {
    console.log('❌ Sender does not have trustline');
    return false;
  }

  if (parseFloat(senderBalance.balance) < parseFloat(amount)) {
    console.log('❌ Sender has insufficient balance');
    return false;
  }

  // Check recipient
  const recipientAccount = await server.loadAccount(recipientPubKey);
  const recipientTrustline = recipientAccount.balances.find(
    b => b.asset_code === asset.code && b.asset_issuer === asset.issuer
  );

  if (!recipientTrustline) {
    console.log('❌ Recipient does not have trustline');
    return false;
  }

  console.log('✅ Payment can proceed');
  return true;
}
```

---

## Asset Metadata (SEP-1)

### stellar.toml File

Issuers publish asset metadata via `stellar.toml`:

```toml
# .well-known/stellar.toml on your domain

ACCOUNTS = [
  "ISSUER_PUBLIC_KEY_HERE"
]

VERSION = "2.0.0"

[DOCUMENTATION]
ORG_NAME = "My Bank"
ORG_URL = "https://mybank.com"
ORG_LOGO = "https://mybank.com/logo.png"

[[CURRENCIES]]
code = "USD"
issuer = "ISSUER_PUBLIC_KEY_HERE"
display_decimals = 2
name = "US Dollar"
desc = "USD backed 1:1 by bank deposits"
conditions = "https://mybank.com/terms"
image = "https://mybank.com/usd.png"
```

### Setting Home Domain

```javascript
async function setHomeDomain(issuerSecret, domain) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.setOptions({
        homeDomain: domain // e.g., 'mybank.com'
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuerKeypair);
  await server.submitTransaction(transaction);

  console.log('✅ Home domain set:', domain);
}
```

### Fetching Asset Info

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function fetchAssetInfo(domain) {
  const toml = await StellarSdk.StellarTomlResolver.resolve(domain);

  console.log('Organization:', toml.DOCUMENTATION.ORG_NAME);
  console.log('Currencies:');

  toml.CURRENCIES.forEach(currency => {
    console.log(`  ${currency.code}:`, currency.desc);
  });
}

// Example
fetchAssetInfo('centre.io'); // USDC issuer
```

---

## Practical Example: Complete Asset Workflow

### File: `src/create-token.js`

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

async function createAndDistributeToken(
  assetCode,
  totalSupply,
  recipientPublicKey,
  recipientAmount
) {
  const server = new StellarSdk.Horizon.Server(
    'https://horizon-testnet.stellar.org'
  );

  console.log(`🪙 Creating ${assetCode} token\n`);

  // 1. Create issuer
  const issuer = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${issuer.publicKey()}`);
  console.log('✅ Issuer created:', issuer.publicKey());

  // 2. Create distributor
  const distributor = StellarSdk.Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${distributor.publicKey()}`);
  console.log('✅ Distributor created:', distributor.publicKey());

  const asset = new StellarSdk.Asset(assetCode, issuer.publicKey());

  // 3. Distributor trusts issuer
  let distributorAccount = await server.loadAccount(distributor.publicKey());
  let tx = new StellarSdk.TransactionBuilder(distributorAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: totalSupply
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(distributor);
  await server.submitTransaction(tx);
  console.log('✅ Distributor trustline created');

  // 4. Recipient trusts issuer
  const recipientAccount = await server.loadAccount(recipientPublicKey);
  tx = new StellarSdk.TransactionBuilder(recipientAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset
      })
    )
    .setTimeout(30)
    .build();

  // Note: You'd need recipient's secret to sign this
  console.log('⚠️  Recipient must create trustline manually');

  // 5. Issue tokens to distributor
  const issuerAccount = await server.loadAccount(issuer.publicKey());
  tx = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: distributor.publicKey(),
        asset: asset,
        amount: totalSupply
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(issuer);
  await server.submitTransaction(tx);
  console.log(`✅ Issued ${totalSupply} ${assetCode}`);

  // 6. Distributor sends to recipient
  distributorAccount = await server.loadAccount(distributor.publicKey());
  tx = new StellarSdk.TransactionBuilder(distributorAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: asset,
        amount: recipientAmount
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(distributor);
  const result = await server.submitTransaction(tx);
  console.log(`✅ Sent ${recipientAmount} ${assetCode} to recipient`);

  console.log('\n📊 Summary:');
  console.log('Asset Code:', assetCode);
  console.log('Total Supply:', totalSupply);
  console.log('Issuer:', issuer.publicKey());
  console.log('Distributor:', distributor.publicKey());
  console.log('\n🔐 Save these keys:');
  console.log('Issuer secret:', issuer.secret());
  console.log('Distributor secret:', distributor.secret());
}

// Usage
const recipientKey = process.env.TESTNET_PUBLIC_KEY;
createAndDistributeToken('GOLD', '1000000', recipientKey, '100');
```

---

## Real-World Assets on Stellar

### Popular Assets

```javascript
// USDC (Circle)
const USDC = new StellarSdk.Asset(
  'USDC',
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
);

// yXLM (Ultra Stellar)
const yXLM = new StellarSdk.Asset(
  'yXLM',
  'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55'
);

// AQUA (AquariusMarket)
const AQUA = new StellarSdk.Asset(
  'AQUA',
  'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA'
);
```

---

## Key Takeaways

1. **Custom assets** are uniquely identified by `code + issuer`
2. **Trustlines** are required before receiving assets
3. **Asset issuance** requires issuer + distributor accounts
4. **Authorization flags** enable compliance and control
5. **Locking issuer** creates fixed supply
6. **stellar.toml** provides asset metadata
7. **Always verify** recipient has trustline before sending

---

## Next Steps

Move to **Phase 6** where you'll:
- Use the Stellar DEX
- Create buy/sell offers
- Implement path payments
- Build cross-currency swaps

---

## Security Checklist

- [ ] Secure issuer account (cold storage)
- [ ] Set proper trustline limits
- [ ] Verify asset issuer before trusting
- [ ] Check stellar.toml for asset verification
- [ ] Test on testnet before mainnet
- [ ] Consider authorization flags for compliance
- [ ] Document total supply clearly
