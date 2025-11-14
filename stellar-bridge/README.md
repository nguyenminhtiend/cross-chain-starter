# Stellar Bridge

Cross-chain bridge between Stellar and Ethereum networks.

## Overview

This bridge enables trustless asset transfers between Stellar and Ethereum using a **lock/mint and burn/unlock** pattern - the **exact same architecture** as your EVM bridge!

### Architecture

```
Stellar Network                 Relayer                 Ethereum Network
┌──────────────┐              ┌────────┐              ┌──────────────┐
│              │              │        │              │              │
│  User pays   │──────────────>│ Listen │──────────────>│  Mint        │
│  to bridge   │   Payment    │ & Sign │  Transaction │  wrapped     │
│  account     │              │        │              │  tokens      │
│              │              │        │              │              │
└──────────────┘              └────────┘              └──────────────┘

Ethereum Network                Relayer                 Stellar Network
┌──────────────┐              ┌────────┐              ┌──────────────┐
│              │              │        │              │              │
│  User burns  │──────────────>│ Listen │──────────────>│  Send        │
│  wrapped     │   Burn event │ & Sign │  Transaction │  original    │
│  tokens      │              │        │              │  tokens      │
│              │              │        │              │              │
└──────────────┘              └────────┘              └──────────────┘
```

### Key Differences from EVM Bridges

| Feature | Your EVM Bridge | Stellar Bridge |
|---------|----------------|----------------|
| **Smart Contracts** | Solidity contracts | Built-in protocol operations |
| **Lock Function** | `contract.lock()` | `Operation.payment()` |
| **Event Listening** | `contract.on('Lock')` | `server.payments().stream()` |
| **Nonce Tracking** | `mapping(uint => bool)` | Transaction hash as nonce |
| **Finality** | 12 blocks (~3 min) | ~5 seconds |

## Prerequisites

- Node.js 22+
- pnpm 10+
- Existing Ethereum bridge contract (from your Phase 1-6)

## Installation

```bash
cd stellar-bridge
pnpm install
```

## Configuration

1. Copy environment example:
```bash
cp .env.example .env
```

2. Set up Stellar account:
```bash
pnpm run setup
```

This will:
- Generate a new Stellar keypair (or use existing)
- Fund the account on testnet
- Create USDC trustline
- Display credentials

3. Update `.env` with the credentials:
```env
# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_BRIDGE_SECRET=S...  # From setup script
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Ethereum Configuration (from your existing bridge)
ETHEREUM_RPC_URL=http://127.0.0.1:8545
ETHEREUM_BRIDGE_ADDRESS=0x...  # Your deployed bridge
ETHEREUM_PRIVATE_KEY=0x...     # Relayer private key

# Asset Configuration
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
STELLAR_USDC_CODE=USDC
```

## Usage

### Start the Bridge

```bash
pnpm start
```

The bridge will:
1. Listen for USDC payments on Stellar
2. Verify and process payments
3. Mint wrapped tokens on Ethereum
4. Listen for burn events on Ethereum
5. Unlock original tokens on Stellar

### Testing the Bridge

#### Stellar → Ethereum

1. Send USDC to the bridge account with your Ethereum address in the memo:

```javascript
// Using Stellar SDK
const transaction = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET
})
  .addOperation(
    StellarSdk.Operation.payment({
      destination: BRIDGE_PUBLIC_KEY,
      asset: USDC,
      amount: '100'
    })
  )
  .addMemo(StellarSdk.Memo.text('0xYourEthereumAddress'))
  .setTimeout(180)
  .build();

transaction.sign(keypair);
await server.submitTransaction(transaction);
```

2. Wait for processing (~5 seconds + Ethereum confirmation)
3. Check wrapped USDC balance on Ethereum

#### Ethereum → Stellar

1. Burn wrapped tokens on Ethereum with your Stellar address:

```javascript
// Your existing EVM bridge
await wrappedToken.approve(bridge.address, amount);
await bridge.burn(amount, 'YOUR_STELLAR_PUBLIC_KEY');
```

2. Wait for processing
3. Receive original USDC on Stellar

## How It Maps to Your EVM Bridge

### Your EVM Bridge Code
```javascript
// Lock tokens
await sourceToken.approve(bridge.address, amount);
await sourceBridge.lock(recipient, amount);

// Listen for events
sourceBridge.on('Lock', (from, to, amount, nonce) => {
  // Process...
});

// Mint on destination
await destBridge.mint(to, amount, nonce, signature);
```

### Stellar Bridge Equivalent
```javascript
// Lock tokens (send payment)
await server.submitTransaction(paymentTransaction);

// Listen for events
server.payments().stream({
  onmessage: (payment) => {
    // Process... (SAME LOGIC!)
  }
});

// Mint on Ethereum (EXACT SAME!)
await ethereumBridge.mint(to, amount, nonce, signature);
```

## Testing

Run tests:
```bash
pnpm test
```

Tests cover:
- Payment bridging from Stellar to Ethereum
- Invalid address handling
- Event processing
- Signature verification

## Important Notes

### Trustlines

Unlike Ethereum where anyone can receive any token, Stellar requires **trustlines**:

```javascript
// Users must create trustline before receiving USDC
await changeTrust(USDC, '1000000');
```

This is similar to approvals in EVM, but for receiving tokens!

### Memo Field

- Always include Ethereum address in payment memo
- Format: `0x` + 40 hex characters
- Bridge ignores payments without valid memo

### Finality

- **Stellar**: ~5 seconds (1-2 ledgers)
- **Ethereum**: Your existing finality settings

### Asset Codes

Stellar uses asset codes (like `USDC`) instead of contract addresses.
Each asset is identified by: `(code, issuer)` pair.

## Project Structure

```
stellar-bridge/
├── src/
│   ├── stellar-bridge.js    # Main bridge service
│   ├── index.js             # Entry point
│   └── setup-accounts.js    # Account setup script
├── test/
│   └── stellar-bridge.test.js
├── config/
├── package.json
└── .env.example
```

## Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Stellar Laboratory](https://laboratory.stellar.org/) - Test operations
- [Stellar Quest](https://quest.stellar.org/) - Learning tutorials
- [Horizon API](https://horizon.stellar.org/) - Stellar API

## Troubleshooting

### Account not found
- Run `pnpm run setup` to fund account on testnet
- Check account on [Stellar Explorer](https://stellar.expert/)

### Trustline errors
- Ensure bridge account has USDC trustline
- Run setup script again

### Payment not processed
- Verify Ethereum address format in memo
- Check relayer logs for errors
- Ensure sufficient USDC balance

## Next Steps

1. Test on Stellar testnet
2. Integrate with your existing Ethereum bridge
3. Add monitoring and alerting
4. Deploy to mainnet (use MAINNET network passphrase)

## Security Considerations

- Private keys stored in `.env` (gitignored)
- Signature verification on Ethereum side
- Nonce tracking prevents replay attacks
- Bridge can be paused on Ethereum side
- Production: Use hardware wallets/HSM for keys
