# Phase 5: Assets and Payments - Summary

## Overview

Phase 5 covered Stellar's powerful multi-currency system, including custom assets, trustlines, and asset issuance. You now understand how to create and manage tokens on the Stellar network.

---

## What You Learned

### 1. Trustlines (phase5.1-trustlines.js)

**Key Concepts:**
- Trustlines are required before receiving custom assets
- Protection against unwanted asset spam
- Setting limits on how much you're willing to hold
- Each trustline increases minimum balance requirement

**Functions:**
- `createTrustline(userSecret, assetCode, issuerPubKey, limit)` - Create a trustline
- `checkTrustlines(publicKey)` - View all trusted assets
- `removeTrustline(userSecret, assetCode, issuerPubKey)` - Remove a trustline (requires 0 balance)

**Example:**
```javascript
const { createTrustline } = require('./phase5.1-trustlines');

// Trust up to 100,000 USD from a specific issuer
await createTrustline(
  mySecret,
  'USD',
  'ISSUER_PUBLIC_KEY',
  '100000'
);
```

---

### 2. Issuing Custom Assets (phase5.2-issue-asset.js)

**Key Concepts:**
- Issuer account creates the asset
- Distribution account holds and distributes tokens
- Tokens are created when issuer sends payment
- Best practice: separate issuer (cold storage) from distributor (hot wallet)

**Functions:**
- `issueCustomAsset(assetCode, initialSupply)` - Complete asset issuance workflow
- `sendCustomAsset(senderSecret, recipientPubKey, asset, amount)` - Send custom assets

**Workflow:**
1. Create issuer account
2. Create distribution account
3. Distribution account trusts issuer's asset
4. Issuer sends tokens to distributor (creates tokens!)
5. Distributor can now send to users

**Example:**
```javascript
const { issueCustomAsset } = require('./phase5.2-issue-asset');

// Issue 1,000,000 GOLD tokens
const { issuer, distributor, asset } = await issueCustomAsset('GOLD', '1000000');

// Save these keys!
console.log('Issuer secret:', issuer.secret());
console.log('Distributor secret:', distributor.secret());
```

---

### 3. Working with Real Assets (phase5.3-work-with-real-assets.js)

**Key Concepts:**
- Popular assets: USDC, yXLM, AQUA
- Asset verification via stellar.toml
- Multiple issuers can create same asset code
- Always verify issuer before trusting

**Functions:**
- `getAssetInfo(domain)` - Fetch stellar.toml information
- `exploreAsset(assetCode, issuer)` - Get asset statistics
- `getAllBalances(publicKey)` - View all balances
- `searchAssets(assetCode)` - Find all issuers of an asset
- `trustWellKnownAsset(userSecret, assetCode, issuer)` - Trust popular assets

**Popular Mainnet Assets:**
```javascript
// USDC - Circle USD Coin
const USDC = new StellarSdk.Asset(
  'USDC',
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
);

// yXLM - Ultra Stellar (Yield XLM)
const yXLM = new StellarSdk.Asset(
  'yXLM',
  'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55'
);
```

---

### 4. Asset Authorization & Control (phase5.4-asset-control.js)

**Key Concepts:**
- Authorization flags control asset behavior
- Locking issuer creates fixed supply
- Authorization is for compliance (KYC/AML)

**Authorization Flags:**

1. **AUTH_REQUIRED** - Users need approval to hold asset
   - Use case: KYC/AML compliance

2. **AUTH_REVOCABLE** - Issuer can freeze assets
   - Use case: Fraud prevention, compliance

3. **AUTH_IMMUTABLE** - Flags cannot be changed (permanent!)
   - Use case: Prove asset rules won't change

**Functions:**
- `setAuthorizationFlags(issuerSecret, flags)` - Set authorization flags
- `authorizeTrustline(issuerSecret, trustorPubKey, assetCode, authorize)` - Approve/revoke
- `lockIssuerAccount(issuerSecret)` - Permanently lock (IRREVERSIBLE!)
- `checkIfLocked(publicKey)` - Check lock status
- `getAccountFlags(publicKey)` - View authorization flags

**Example:**
```javascript
const { setAuthorizationFlags } = require('./phase5.4-asset-control');

// Require approval and allow revocation
await setAuthorizationFlags(issuerSecret, {
  authRequired: true,
  authRevocable: true
});
```

---

## Asset Identity

**Critical:** An asset is uniquely identified by **code + issuer**

```javascript
{
  code: "USD",              // 1-12 characters
  issuer: "GBXXXX..."       // Issuer's public key
}
```

**Same code, different issuer = different asset!**
- Bank A's USD ≠ Bank B's USD
- Always verify the issuer

---

## Payment Prerequisites

Before sending a custom asset payment, verify:

✅ Sender has trustline to asset
✅ Sender has sufficient balance
✅ Recipient has trustline to asset
✅ Asset is not frozen

---

## Best Practices

### Security
- [ ] Store issuer keys in cold storage
- [ ] Use distribution account for daily operations
- [ ] Verify asset issuers before trusting
- [ ] Check stellar.toml for official assets
- [ ] Test on testnet before mainnet

### Asset Issuance
- [ ] Document total supply clearly
- [ ] Consider locking issuer for fixed supply
- [ ] Set appropriate authorization flags
- [ ] Publish stellar.toml with asset info
- [ ] Set home domain on issuer account

### Compliance
- [ ] Use AUTH_REQUIRED for KYC requirements
- [ ] Use AUTH_REVOCABLE for fraud prevention
- [ ] Never set AUTH_IMMUTABLE without thorough testing
- [ ] Document all authorization policies

---

## Common Patterns

### Pattern 1: Simple Token Issuance
```javascript
// 1. Create issuer + distributor
// 2. Distributor trusts issuer
// 3. Issuer sends tokens to distributor
// 4. Distributor sends to users (who must have trustlines)
```

### Pattern 2: Regulated Asset
```javascript
// 1. Set AUTH_REQUIRED on issuer
// 2. Users create trustline
// 3. Issuer approves trustline (after KYC)
// 4. User can now receive asset
```

### Pattern 3: Fixed Supply Token
```javascript
// 1. Issue all tokens to distributor
// 2. Lock issuer account (masterWeight = 0)
// 3. Total supply now permanently fixed
```

---

## Common Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `op_no_trust` | Recipient has no trustline | Recipient must create trustline first |
| `op_line_full` | Would exceed trustline limit | Increase limit or send smaller amount |
| `op_underfunded` | Insufficient balance | Check balance before sending |
| `op_not_authorized` | Trustline not approved | Issuer must authorize trustline |

---

## Exercise Files Summary

1. **phase5.1-trustlines.js**
   - Creating and managing trustlines
   - Checking balances
   - Removing trustlines

2. **phase5.2-issue-asset.js**
   - Complete asset issuance workflow
   - Sending custom assets
   - Multi-account token distribution

3. **phase5.3-work-with-real-assets.js**
   - Exploring popular assets
   - Fetching asset metadata
   - Searching for assets
   - Trusting well-known assets

4. **phase5.4-asset-control.js**
   - Authorization flags
   - Approving/revoking trustlines
   - Locking issuer accounts
   - Checking account status

---

## Quick Reference

### Create a Trustline
```javascript
const asset = new StellarSdk.Asset('USD', 'ISSUER_PUBLIC_KEY');

const transaction = new StellarSdk.TransactionBuilder(userAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET
})
  .addOperation(
    StellarSdk.Operation.changeTrust({
      asset: asset,
      limit: '100000'
    })
  )
  .setTimeout(30)
  .build();
```

### Send Custom Asset
```javascript
const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET
})
  .addOperation(
    StellarSdk.Operation.payment({
      destination: recipientPublicKey,
      asset: asset,
      amount: '100'
    })
  )
  .setTimeout(30)
  .build();
```

### Set Authorization Flags
```javascript
const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
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
```

---

## Next Steps

Move to **Phase 6: DEX and Path Payments** to learn:
- Trading on Stellar's built-in DEX
- Creating buy/sell offers
- Path payments for cross-currency transfers
- Liquidity pools

---

## Resources

- [Stellar Assets Documentation](https://developers.stellar.org/docs/issuing-assets)
- [SEP-1: stellar.toml](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md)
- [Asset Explorer](https://stellar.expert/explorer/public/assets)
- [Circle USDC](https://www.centre.io/usdc-on-stellar)

---

**Phase 5 Complete! 🎉**

You now understand Stellar's multi-currency system and can create, issue, and manage custom assets!
