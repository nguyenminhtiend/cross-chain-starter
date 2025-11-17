# Phase 2: Local Development Setup

## Overview
In this phase, you'll set up a complete Stellar development environment on macOS, install necessary tools, and run your first Stellar code.

---

## Prerequisites

### 1. **Node.js** (v16 or higher)
Check if you have Node.js installed:
```bash
node --version
```

If not installed, install via Homebrew:
```bash
brew install node
```

### 2. **Package Manager**
We'll use pnpm (faster and more efficient than npm):
```bash
pnpm --version
```

If not installed, install via npm:
```bash
pnpm install --global pnpm
```

---

## Installation Steps

### Step 1: Create Your Project Directory

```bash
cd ~/Projects
mkdir stellar-practice
cd stellar-practice
pnpm init
```

### Step 2: Install Stellar SDK

The official Stellar SDK for JavaScript:

```bash
ppnpm install @stellar/stellar-sdk
```

**Why this SDK?**
- Official Stellar Development Foundation library
- Handles keypair generation, transactions, signing
- Connects to Horizon API servers
- Supports both testnet and mainnet

### Step 3: Install Development Tools

```bash
ppnpm install -D nodemon dotenv
```

- **nodemon**: Auto-restart scripts when files change
- **dotenv**: Manage environment variables (for secrets)

### Step 4: Create Project Structure

```bash
mkdir src
touch src/01-create-account.js
touch src/02-check-balance.js
touch src/03-send-payment.js
touch .env
touch .env.example
```

---

## Understanding Stellar Networks

Stellar has three networks:

### 1. **Testnet** (Development)
- Free XLM via friendbot
- Safe for testing
- Horizon URL: `https://horizon-testnet.stellar.org`
- Network passphrase: `Test SDF Network ; September 2015`

### 2. **Mainnet** (Production)
- Real XLM required
- Horizon URL: `https://horizon.stellar.org`
- Network passphrase: `Public Global Stellar Network ; September 2015`

### 3. **Local/Standalone** (Advanced)
- Run your own Stellar node
- Full control, no internet needed
- We'll stick to Testnet for learning

**Why use Testnet?**
- No real money at risk
- Free XLM tokens
- Identical to mainnet functionality

---

## Your First Stellar Code

### File: `src/01-create-account.js`

Create this file:

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

// Configure for Testnet
const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

async function createAccount() {
  try {
    // Step 1: Generate a random keypair
    const pair = StellarSdk.Keypair.random();

    console.log('🔑 New Keypair Generated!');
    console.log('Public Key (Address):', pair.publicKey());
    console.log('Secret Key (SAVE THIS!):', pair.secret());
    console.log('');

    // Step 2: Fund account using Friendbot (testnet only)
    console.log('💰 Funding account via Friendbot...');
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(pair.publicKey())}`
    );

    if (!response.ok) {
      throw new Error('Friendbot funding failed');
    }

    console.log('✅ Account funded successfully!');
    console.log('');

    // Step 3: Load account from Horizon
    const account = await server.loadAccount(pair.publicKey());

    console.log('📊 Account Details:');
    console.log('Account ID:', account.accountId());
    console.log('Sequence Number:', account.sequenceNumber());
    console.log('');

    // Step 4: Display balances
    console.log('💵 Balances:');
    account.balances.forEach((balance) => {
      console.log(`  ${balance.asset_type === 'native' ? 'XLM' : balance.asset_code}: ${balance.balance}`);
    });

    return pair;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the function
createAccount()
  .then(() => console.log('\n✨ Account creation complete!'))
  .catch(err => console.error('Fatal error:', err));
```

### Run It!

```bash
node src/01-create-account.js
```

**Expected Output:**
```
🔑 New Keypair Generated!
Public Key (Address): GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Secret Key (SAVE THIS!): SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

💰 Funding account via Friendbot...
✅ Account funded successfully!

📊 Account Details:
Account ID: GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Sequence Number: 123456789

💵 Balances:
  XLM: 10000.0000000

✨ Account creation complete!
```

---

## Code Explanation: Line by Line

### 1. Import Stellar SDK
```javascript
const StellarSdk = require('@stellar/stellar-sdk');
```
Loads the Stellar SDK library.

### 2. Create Horizon Server Connection
```javascript
const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);
```
**Why Horizon?**
- Horizon is Stellar's API server
- Provides REST API to query blockchain data
- Submits transactions to the network

### 3. Generate Keypair
```javascript
const pair = StellarSdk.Keypair.random();
```
Creates a new Ed25519 keypair (public + secret key).

**Why Ed25519?**
- Faster than RSA
- Shorter keys (32 bytes)
- More secure against quantum attacks

### 4. Fund Account via Friendbot
```javascript
await fetch(`https://friendbot.stellar.org?addr=${pair.publicKey()}`);
```
**Why Friendbot?**
- Testnet-only service
- Gives free 10,000 XLM
- Creates and funds account in one step

**Important:** On mainnet, you must:
1. Get XLM from an exchange
2. Have someone send you XLM to create the account

### 5. Load Account Data
```javascript
const account = await server.loadAccount(pair.publicKey());
```
Fetches current account state from Horizon.

**What you get:**
- Current balances
- Sequence number (for transactions)
- Signers, flags, data entries

### 6. Display Balances
```javascript
account.balances.forEach((balance) => {
  console.log(`${balance.asset_type}: ${balance.balance}`);
});
```
Shows all assets held by the account.

---

## Next Script: Check Balance

### File: `src/02-check-balance.js`

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

async function checkBalance(publicKey) {
  try {
    console.log(`🔍 Checking balance for: ${publicKey}\n`);

    const account = await server.loadAccount(publicKey);

    console.log('💵 Balances:');
    account.balances.forEach((balance) => {
      if (balance.asset_type === 'native') {
        console.log(`  XLM (native): ${balance.balance}`);
      } else {
        console.log(`  ${balance.asset_code} (${balance.asset_issuer}): ${balance.balance}`);
      }
    });

    console.log('\n📈 Account Stats:');
    console.log(`  Sequence: ${account.sequence}`);
    console.log(`  Subentry Count: ${account.subentry_count}`);
    console.log(`  Num Signers: ${account.signers.length}`);

  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('❌ Account not found. Has it been funded?');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Replace with your public key from step 1
const myPublicKey = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
checkBalance(myPublicKey);
```

**Run it:**
```bash
# Replace GXXX with your actual public key
node src/02-check-balance.js
```

---

## Environment Variables (Security Best Practice)

### File: `.env`
```bash
# NEVER COMMIT THIS FILE TO GIT!
TESTNET_SECRET_KEY=SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TESTNET_PUBLIC_KEY=GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### File: `.env.example`
```bash
# Copy this to .env and fill in your keys
TESTNET_SECRET_KEY=your_secret_key_here
TESTNET_PUBLIC_KEY=your_public_key_here
```

### Update `.gitignore`
```bash
echo ".env" >> .gitignore
```

### Usage in Code
```javascript
require('dotenv').config();

const secretKey = process.env.TESTNET_SECRET_KEY;
const keypair = StellarSdk.Keypair.fromSecret(secretKey);
```

**Why environment variables?**
- Never hardcode secret keys
- Prevents accidental commits to GitHub
- Different keys for dev/prod environments

---

## Testing Your Setup

Create a test file: `src/test-setup.js`

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

console.log('✅ Stellar SDK version:', StellarSdk.version);
console.log('✅ Node version:', process.version);

// Test network connection
const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

server.ledgers()
  .limit(1)
  .call()
  .then((response) => {
    console.log('✅ Connected to Horizon testnet');
    console.log('Latest ledger:', response.records[0].sequence);
  })
  .catch((error) => {
    console.error('❌ Connection failed:', error.message);
  });
```

```bash
node src/test-setup.js
```

---

## Troubleshooting

### Issue: "Cannot find module '@stellar/stellar-sdk'"
**Solution:**
```bash
ppnpm install @stellar/stellar-sdk
```

### Issue: "Account not found"
**Solution:**
- Account hasn't been funded yet
- Run friendbot again
- Check public key is correct

### Issue: "Network error"
**Solution:**
- Check internet connection
- Horizon testnet might be down (rare)
- Try: `curl https://horizon-testnet.stellar.org`

### Issue: "Module not found: dotenv"
**Solution:**
```bash
pnpm install dotenv
```

---

## Useful Development Commands

### Watch mode (auto-reload on changes)
```bash
npx nodemon src/01-create-account.js
```

### Check Stellar SDK version
```bash
pnpm list @stellar/stellar-sdk
```

### Update Stellar SDK
```bash
pnpm update @stellar/stellar-sdk
```

---

## Key Takeaways

1. **Stellar SDK** handles all blockchain interactions
2. **Horizon** is the API gateway to Stellar network
3. **Testnet** is safe for learning (free XLM via Friendbot)
4. **Keypairs** consist of public key (address) and secret key (private)
5. **Environment variables** protect your secret keys
6. **Accounts must be funded** before they exist on-chain

---

## Next Steps

Move to **Phase 3** where you'll:
- Deep dive into keypairs and cryptography
- Understand account structure
- Learn about base reserves and fees
- Implement account recovery

---

## Quick Reference

### Essential Commands
```bash
# Create account
node src/01-create-account.js

# Check balance
node src/02-check-balance.js

# Fund account (testnet)
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

### Useful Links
- [Horizon Testnet Explorer](https://stellar.expert/explorer/testnet)
- [Stellar Laboratory](https://laboratory.stellar.org/)
- [SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
