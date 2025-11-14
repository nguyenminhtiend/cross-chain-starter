# Stellar & Solana: Multi-Chain Development

**Difficulty:** ⭐⭐⭐ (Medium)
**Knowledge Reuse:** 80% concepts transfer, new syntax
**Time Estimate:** 2-3 weeks

---

## Overview

Build cross-chain bridges and services on **Stellar** (no smart contracts) and **Solana** (Rust-based).

**Good news:** All your blockchain concepts transfer 100%. You just need to learn new syntax and platform-specific features.

---

## Knowledge Transfer Map

### What Transfers Perfectly ✅

| Concept | Your Bridge | Stellar | Solana |
|---------|-------------|---------|--------|
| **Cryptographic signatures** | ✅ ECDSA | ✅ Ed25519 | ✅ Ed25519 |
| **Transaction finality** | ✅ 12 blocks | ✅ ~5 seconds | ✅ ~400ms |
| **State management** | ✅ Contract storage | ✅ Account data | ✅ Account data |
| **Replay protection** | ✅ Nonces | ✅ Sequence numbers | ✅ Recent blockhashes |
| **Event listening** | ✅ Event logs | ✅ Horizon streaming | ✅ WebSocket subscriptions |
| **RPC interaction** | ✅ ethers.js | ✅ stellar-sdk | ✅ @solana/web3.js |
| **Token standards** | ✅ ERC-20 | ✅ Native assets | ✅ SPL tokens |

### What's Different 🎓

| Feature | Ethereum (Your Bridge) | Stellar | Solana |
|---------|------------------------|---------|--------|
| **Smart Contracts** | Solidity (custom logic) | None (protocol operations) | Rust (Anchor framework) |
| **Programming Model** | Contract-based | Operation-based | Account-based |
| **State Storage** | In contract | In account ledger | In separate accounts |
| **Execution** | EVM bytecode | Built-in operations | BPF programs |
| **Transaction Structure** | Call functions | Submit operations | Send instructions |

---

## Part 1: Stellar Development

### Why Stellar Is Different

**No smart contracts!** Everything uses built-in protocol operations.

```javascript
// Ethereum: You write custom logic
contract Bridge {
    function lock(address to, uint256 amount) external {
        // Custom logic here
        token.transferFrom(msg.sender, address(this), amount);
        emit Lock(to, amount);
    }
}

// Stellar: Use protocol operations
const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
    .addOperation(StellarSdk.Operation.payment({
        destination: recipientId,
        asset: customToken,
        amount: '100'
    }))
    .build();
```

### Key Stellar Concepts

#### 1. Accounts (Similar to Ethereum)

```javascript
// Your Bridge: Create wallet
const wallet = ethers.Wallet.createRandom();
console.log(wallet.address);     // 0x1234...
console.log(wallet.privateKey);  // 0xabcd...

// Stellar: Create keypair (SAME CONCEPT!)
const pair = StellarSdk.Keypair.random();
console.log(pair.publicKey());   // GCZJ...
console.log(pair.secret());      // SBTX...

// Your Bridge: Get balance
const balance = await token.balanceOf(wallet.address);

// Stellar: Get balance (SAME CONCEPT!)
const account = await server.loadAccount(pair.publicKey());
console.log(account.balances);
```

#### 2. Assets (Similar to ERC-20)

```javascript
// Your Bridge: ERC-20 token
const token = new ethers.Contract(
    tokenAddress,
    ['function transfer(address to, uint256 amount)'],
    signer
);

// Stellar: Asset (SAME CONCEPT!)
const USDC = new StellarSdk.Asset(
    'USDC',
    'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
);
```

#### 3. Trustlines (NEW CONCEPT!)

**In Ethereum:** Anyone can send you any token
**In Stellar:** You must explicitly trust a token before receiving it

```javascript
// NEW: Establish trustline before receiving USDC
const trustOp = StellarSdk.Operation.changeTrust({
    asset: USDC,
    limit: '1000000'  // Max amount willing to hold
});

const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
})
    .addOperation(trustOp)
    .setTimeout(180)
    .build();

transaction.sign(keypair);
await server.submitTransaction(transaction);
```

**Mapping to your knowledge:**
```javascript
// Similar to your token approval pattern
// Ethereum: approve before transferFrom
await token.approve(spender, amount);

// Stellar: trustline before receiving
await changeTrust(asset, limit);
```

#### 4. Payments (Like your token transfers)

```javascript
// Your Bridge: Transfer tokens
await token.transfer(recipient, amount);

// Stellar: Send payment (EXACT SAME CONCEPT!)
const paymentOp = StellarSdk.Operation.payment({
    destination: recipientId,
    asset: USDC,
    amount: '100'
});

const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
})
    .addOperation(paymentOp)
    .setTimeout(180)
    .build();

transaction.sign(keypair);
const result = await server.submitTransaction(transaction);
```

### Building a Stellar Bridge

**Map to your Phase 1-6 bridge:**

```javascript
// stellar-bridge/index.js

const StellarSdk = require('stellar-sdk');

class StellarBridge {
    constructor(bridgeKeypair, ethereumBridge) {
        this.keypair = bridgeKeypair;
        this.ethereumBridge = ethereumBridge;
        this.server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
    }

    /**
     * Listen for payments (Like your Lock event listener!)
     *
     * Your Bridge:
     *   sourceBridge.on('Lock', handleLockEvent)
     *
     * Stellar Bridge:
     *   server.payments().stream({ onmessage: handlePayment })
     */
    async startListening() {
        const account = await this.server.loadAccount(this.keypair.publicKey());

        // Stream payments to bridge account (SAME AS YOUR EVENT LISTENER!)
        this.server
            .payments()
            .forAccount(this.keypair.publicKey())
            .cursor('now')
            .stream({
                onmessage: async (payment) => {
                    await this.handlePayment(payment);
                },
                onerror: (error) => {
                    console.error('Stream error:', error);
                }
            });

        console.log('Listening for Stellar payments...');
    }

    /**
     * Handle incoming payment (Like your handleLockEvent!)
     *
     * Your Bridge handleLockEvent:
     * 1. Verify event
     * 2. Check not processed (nonce)
     * 3. Mint on destination
     *
     * Stellar Bridge handlePayment:
     * 1. Verify payment (SAME)
     * 2. Check not processed (tx hash as nonce) (SAME)
     * 3. Mint on Ethereum (SAME)
     */
    async handlePayment(payment) {
        console.log('Payment received:', payment);

        // Only process USDC payments
        if (payment.asset_code !== 'USDC') {
            return;
        }

        // SAME AS YOUR BRIDGE: Check if already processed
        const txHash = payment.transaction_hash;
        const processed = await this.ethereumBridge.processedNonces(
            ethers.utils.id(txHash)  // Use tx hash as nonce!
        );

        if (processed) {
            console.log('Payment already processed:', txHash);
            return;
        }

        // Get transaction details to find sender
        const tx = await this.server.transactions().transaction(txHash).call();

        // SAME AS YOUR BRIDGE: Extract parameters
        const from = tx.source_account;
        const amount = ethers.utils.parseUnits(payment.amount, 18);

        // Check memo for Ethereum recipient address
        // (User includes their ETH address in transaction memo)
        const ethRecipient = tx.memo ? tx.memo : from;

        console.log(`Bridging ${payment.amount} USDC from Stellar to Ethereum`);
        console.log(`From: ${from}, To: ${ethRecipient}`);

        // SAME AS YOUR BRIDGE: Mint on destination chain
        try {
            const nonce = ethers.utils.id(txHash);
            const signature = await this.signMintRequest(ethRecipient, amount, nonce);

            const mintTx = await this.ethereumBridge.mint(
                ethRecipient,
                amount,
                nonce,
                signature
            );

            await mintTx.wait();
            console.log('Minted on Ethereum:', mintTx.hash);

        } catch (error) {
            console.error('Mint failed:', error);
            // Could refund on Stellar here
        }
    }

    /**
     * Send tokens back to Stellar (Like your unlock!)
     *
     * Your Bridge:
     *   Listen for Burn → Unlock on source chain
     *
     * Stellar Bridge:
     *   Listen for Burn → Send payment on Stellar
     */
    async handleBurnEvent(event) {
        const { from, amount, nonce } = event.args;

        // SAME: Check if already processed
        const processed = await this.isProcessed(nonce);
        if (processed) return;

        // Parse Stellar address from event data
        const stellarAddress = this.parseStellarAddress(event);

        // SAME CONCEPT AS UNLOCK: Send tokens back
        const account = await this.server.loadAccount(this.keypair.publicKey());

        const paymentOp = StellarSdk.Operation.payment({
            destination: stellarAddress,
            asset: this.USDC,  // Stellar USDC
            amount: ethers.utils.formatUnits(amount, 18)
        });

        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET
        })
            .addOperation(paymentOp)
            .setTimeout(180)
            .build();

        transaction.sign(this.keypair);

        try {
            const result = await this.server.submitTransaction(transaction);
            console.log('Sent on Stellar:', result.hash);

            // Mark as processed
            await this.markProcessed(nonce);

        } catch (error) {
            console.error('Stellar payment failed:', error);
        }
    }

    // Helper: Sign mint request (SAME AS YOUR BRIDGE!)
    async signMintRequest(to, amount, nonce) {
        const messageHash = ethers.utils.solidityKeccak256(
            ['address', 'uint256', 'bytes32'],
            [to, amount, nonce]
        );

        return await this.ethereumSigner.signMessage(
            ethers.utils.arrayify(messageHash)
        );
    }

    // NEW: Stellar-specific - create asset
    initializeAsset() {
        this.USDC = new StellarSdk.Asset(
            'USDC',
            'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
        );
    }
}

module.exports = StellarBridge;
```

### Testing Stellar Bridge

```javascript
// test/stellar-bridge.test.js
// Similar to your bridge tests!

const StellarSdk = require('stellar-sdk');
const { expect } = require('chai');

describe('Stellar Bridge', function() {
    let stellarBridge, userKeypair, bridgeKeypair;

    before(async function() {
        // Setup (similar to your test setup)
        userKeypair = StellarSdk.Keypair.random();
        bridgeKeypair = StellarSdk.Keypair.random();

        stellarBridge = new StellarBridge(bridgeKeypair, ethereumBridge);

        // Fund accounts on testnet
        await fundTestnetAccount(userKeypair.publicKey());
        await fundTestnetAccount(bridgeKeypair.publicKey());
    });

    it('Should bridge USDC from Stellar to Ethereum', async function() {
        // SAME AS YOUR TESTS: Send tokens to bridge
        const amount = '100';
        const ethRecipient = '0x1234...';

        const account = await server.loadAccount(userKeypair.publicKey());

        const paymentOp = StellarSdk.Operation.payment({
            destination: bridgeKeypair.publicKey(),
            asset: USDC,
            amount: amount
        });

        const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET
        })
            .addOperation(paymentOp)
            .addMemo(StellarSdk.Memo.text(ethRecipient))  // ETH address in memo
            .setTimeout(180)
            .build();

        transaction.sign(userKeypair);
        await server.submitTransaction(transaction);

        // SAME AS YOUR TESTS: Wait for processing
        await new Promise(resolve => setTimeout(resolve, 5000));

        // SAME AS YOUR TESTS: Verify mint on Ethereum
        const balance = await wrappedUSDC.balanceOf(ethRecipient);
        expect(balance).to.equal(ethers.utils.parseUnits(amount, 18));
    });
});
```

---

## Part 2: Solana Development

### Why Solana Is Different

**Rust-based smart contracts** with a unique account model.

**Key difference:**
- **Ethereum:** State stored in contract
- **Solana:** State stored in separate accounts

```rust
// Ethereum: State in contract
contract Bridge {
    mapping(uint256 => bool) public processedNonces;  // Stored in contract
}

// Solana: State in separate account
#[account]
pub struct BridgeState {
    pub processed_nonces: Vec<u64>,  // Stored in dedicated account
    pub owner: Pubkey,
}
```

### Key Solana Concepts

#### 1. Programs (Smart Contracts)

```rust
// programs/bridge/src/lib.rs
// Similar to your Solidity contract!

use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod solana_bridge {
    use super::*;

    /**
     * Lock tokens (Like your Solidity lock function!)
     *
     * Your Solidity:
     *   function lock(address to, uint256 amount) external
     *
     * Solana (same concept, different syntax):
     *   pub fn lock(ctx: Context<Lock>, amount: u64) -> Result<()>
     */
    pub fn lock(ctx: Context<Lock>, amount: u64, eth_recipient: String) -> Result<()> {
        // SAME AS YOUR SOLIDITY: Transfer tokens to bridge
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token.to_account_info(),
                to: ctx.accounts.bridge_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        // SAME AS YOUR SOLIDITY: Increment nonce
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.nonce += 1;

        // SAME AS YOUR SOLIDITY: Emit event
        emit!(LockEvent {
            from: *ctx.accounts.user.key,
            amount,
            nonce: bridge_state.nonce,
            eth_recipient,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /**
     * Mint wrapped tokens (Like your Solidity mint function!)
     *
     * Your Solidity:
     *   function mint(address to, uint256 amount, uint256 nonce, bytes sig)
     *
     * Solana (same concept!):
     *   pub fn mint(ctx: Context<Mint>, amount: u64, nonce: u64)
     */
    pub fn mint(
        ctx: Context<Mint>,
        amount: u64,
        nonce: u64,
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // SAME AS YOUR SOLIDITY: Check not processed
        require!(
            !bridge_state.processed_nonces.contains(&nonce),
            ErrorCode::AlreadyProcessed
        );

        // SAME AS YOUR SOLIDITY: Mint tokens
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.wrapped_token.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.bridge_authority.to_account_info(),
            },
        );
        token::mint_to(cpi_ctx, amount)?;

        // SAME AS YOUR SOLIDITY: Mark as processed
        bridge_state.processed_nonces.push(nonce);

        // SAME AS YOUR SOLIDITY: Emit event
        emit!(MintEvent {
            to: *ctx.accounts.user.key,
            amount,
            nonce,
        });

        Ok(())
    }
}

// Define accounts structure (NEW for Solana)
// In Ethereum, accounts are implicit. In Solana, you declare them.
#[derive(Accounts)]
pub struct Lock<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub bridge_state: Account<'info, BridgeState>,

    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub bridge_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Mint<'info> {
    #[account(mut)]
    pub user: AccountInfo<'info>,

    #[account(mut)]
    pub bridge_state: Account<'info, BridgeState>,

    #[account(mut)]
    pub wrapped_token: Account<'info, token::Mint>,

    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,

    pub bridge_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// State account (like your contract storage)
#[account]
pub struct BridgeState {
    pub nonce: u64,
    pub owner: Pubkey,
    pub processed_nonces: Vec<u64>,
}

// Events (SAME CONCEPT as Solidity!)
#[event]
pub struct LockEvent {
    pub from: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub eth_recipient: String,
    pub timestamp: i64,
}

#[event]
pub struct MintEvent {
    pub to: Pubkey,
    pub amount: u64,
    pub nonce: u64,
}

// Errors (SAME CONCEPT as Solidity require!)
#[error_code]
pub enum ErrorCode {
    #[msg("Transaction already processed")]
    AlreadyProcessed,
}
```

#### 2. Relayer (TypeScript)

```typescript
// relayer/solana-relayer.ts
// EXACT SAME PATTERN as your Ethereum relayer!

import * as anchor from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';

class SolanaRelayer {
    constructor(
        private program: Program,
        private connection: Connection,
        private ethereumBridge: any
    ) {}

    /**
     * Listen for Lock events (SAME AS YOUR ETHEREUM RELAYER!)
     *
     * Your Ethereum relayer:
     *   sourceBridge.on('Lock', handleLockEvent)
     *
     * Solana relayer:
     *   program.addEventListener('LockEvent', handleLockEvent)
     */
    async start() {
        // Subscribe to Lock events (SAME PATTERN!)
        const eventListener = this.program.addEventListener(
            'LockEvent',
            async (event, slot) => {
                await this.handleLockEvent(event, slot);
            }
        );

        console.log('Listening for Solana Lock events...');
    }

    /**
     * Handle Lock event (IDENTICAL LOGIC to your Ethereum relayer!)
     *
     * Your Ethereum flow:
     * 1. Verify event
     * 2. Check not processed
     * 3. Wait for finality
     * 4. Mint on destination
     *
     * Solana flow:
     * 1. Verify event (SAME)
     * 2. Check not processed (SAME)
     * 3. Wait for finality (SAME)
     * 4. Mint on Ethereum (SAME)
     */
    async handleLockEvent(event: any, slot: number) {
        console.log('Lock event received:', event);

        // SAME: Check if processed
        const processed = await this.ethereumBridge.processedNonces(
            event.nonce
        );

        if (processed) {
            console.log('Nonce already processed:', event.nonce);
            return;
        }

        // SAME: Wait for finality
        const currentSlot = await this.connection.getSlot();
        const confirmations = currentSlot - slot;

        if (confirmations < 32) {  // Solana finality: ~32 slots
            console.log(`Waiting for finality: ${confirmations}/32 slots`);
            return;
        }

        // SAME: Mint on Ethereum
        try {
            const amount = ethers.utils.parseUnits(event.amount.toString(), 18);
            const signature = await this.signMintRequest(
                event.ethRecipient,
                amount,
                event.nonce
            );

            const tx = await this.ethereumBridge.mint(
                event.ethRecipient,
                amount,
                event.nonce,
                signature
            );

            await tx.wait();
            console.log('Minted on Ethereum:', tx.hash);

        } catch (error) {
            console.error('Mint failed:', error);
        }
    }

    // SAME AS YOUR ETHEREUM RELAYER!
    async signMintRequest(to: string, amount: any, nonce: number) {
        const messageHash = ethers.utils.solidityKeccak256(
            ['address', 'uint256', 'uint256'],
            [to, amount, nonce]
        );

        return await this.signer.signMessage(
            ethers.utils.arrayify(messageHash)
        );
    }
}

export default SolanaRelayer;
```

#### 3. Client (Frontend)

```typescript
// frontend/solana-bridge.ts
// Similar to your Ethereum frontend!

import * as anchor from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';

function SolanaBridge() {
    const wallet = useWallet();

    async function lockTokens(amount: number, ethRecipient: string) {
        // SAME CONCEPT as calling your Ethereum bridge!

        const program = new anchor.Program(idl, programId, provider);

        // Call lock (same as your Ethereum contract call)
        const tx = await program.methods
            .lock(
                new anchor.BN(amount),
                ethRecipient
            )
            .accounts({
                user: wallet.publicKey,
                bridgeState: bridgeStateAddress,
                userToken: userTokenAccount,
                bridgeToken: bridgeTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        console.log('Lock transaction:', tx);
    }

    // Rest of component is similar to your Ethereum UI!
}
```

---

## Comparison Table

| Feature | Your Ethereum Bridge | Stellar | Solana |
|---------|---------------------|---------|--------|
| **Lock tokens** | `contract.lock()` | `Operation.payment()` | `program.methods.lock()` |
| **Event listening** | `contract.on('Lock')` | `server.payments().stream()` | `program.addEventListener()` |
| **Mint tokens** | `contract.mint()` | `Operation.payment()` | `program.methods.mint()` |
| **Nonce tracking** | `mapping(uint => bool)` | Tx hash | `Vec<u64>` in state |
| **Finality** | 12 blocks (~3 min) | ~5 seconds | ~400ms (32 slots) |
| **Language** | Solidity | JavaScript | Rust |

---

## Learning Path

### Week 1-2: Stellar
1. Complete [Stellar Quest](https://quest.stellar.org/) tutorials
2. Build payment streaming service
3. Integrate Stellar → Ethereum bridge

### Week 2-3: Solana
1. Learn Rust basics (Rust Book chapters 1-10)
2. Complete [Anchor tutorial](https://book.anchor-lang.com/)
3. Port your bridge to Solana

---

## Resources

**Stellar:**
- [Stellar SDK Docs](https://stellar.github.io/js-stellar-sdk/)
- [Stellar Laboratory](https://laboratory.stellar.org/) (test operations)
- [Stellar Quest](https://quest.stellar.org/)

**Solana:**
- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [The Rust Book](https://doc.rust-lang.org/book/)

---

**Key Takeaway:** 80% of your bridge logic transfers directly. You're just learning new syntax to express the same concepts you already know!
