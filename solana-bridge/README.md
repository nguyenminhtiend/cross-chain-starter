# Solana Bridge

Cross-chain bridge between Solana and Ethereum networks.

## Overview

This bridge implements the **exact same lock/mint and burn/unlock pattern** as your EVM bridge, but using Rust and the Anchor framework on Solana!

### Architecture

```
Solana Program              Relayer                 Ethereum Contract
┌──────────────┐          ┌────────┐              ┌──────────────┐
│              │          │        │              │              │
│  lock()      │──────────>│ Listen │──────────────>│  mint()      │
│  Transfer to │  Event   │ & Sign │  Transaction │  Mint tokens │
│  bridge      │          │        │              │              │
│              │          │        │              │              │
└──────────────┘          └────────┘              └──────────────┘

Ethereum Contract           Relayer                 Solana Program
┌──────────────┐          ┌────────┐              ┌──────────────┐
│              │          │        │              │              │
│  burn()      │──────────>│ Listen │──────────────>│  unlock()    │
│  Burn tokens │  Event   │ & Sign │  Transaction │  Transfer    │
│              │          │        │              │  back        │
│              │          │        │              │              │
└──────────────┘          └────────┘              └──────────────┘
```

## Key Concepts

### Your EVM Bridge vs Solana Bridge

| Feature | Your EVM Bridge | Solana Bridge |
|---------|----------------|---------------|
| **Language** | Solidity | Rust (Anchor) |
| **Lock Function** | `function lock(...)` | `pub fn lock(...)` |
| **State Storage** | In contract | In separate account |
| **Events** | `emit Lock(...)` | `emit!(LockEvent{...})` |
| **Nonce Check** | `processedNonces[nonce]` | `processed_nonces.contains(&nonce)` |
| **Finality** | 12 blocks (~3 min) | 32 slots (~400ms) |

### The Logic is IDENTICAL!

```rust
// Your Solidity code:
function lock(address to, uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    emit Lock(msg.sender, to, amount, nonce);
}

// Solana equivalent (SAME CONCEPT!):
pub fn lock(ctx: Context<Lock>, amount: u64, eth_recipient: String) -> Result<()> {
    token::transfer(cpi_ctx, amount)?;
    emit!(LockEvent { from, amount, nonce, eth_recipient });
    Ok(())
}
```

## Prerequisites

- **Rust** 1.75+
- **Solana CLI** 1.18+
- **Anchor** 0.30+
- **Node.js** 22+
- **pnpm** 10+

## Installation

### 1. Install Solana Tools

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### 2. Install Project Dependencies

```bash
# Install Anchor dependencies
anchor build

# Install relayer dependencies
cd relayer
pnpm install
```

### 3. Setup Solana Wallet

```bash
# Generate new keypair
solana-keygen new

# Or use existing
solana config set --keypair ~/.config/solana/id.json

# Get public key
solana address

# Fund on devnet
solana airdrop 2
```

## Project Structure

```
solana-bridge/
├── programs/
│   └── solana-bridge/
│       ├── src/
│       │   └── lib.rs          # Bridge program (like your Solidity contract!)
│       └── Cargo.toml
├── relayer/
│   ├── src/
│   │   ├── solana-relayer.js   # Relayer (like your EVM relayer!)
│   │   └── index.js
│   └── package.json
├── tests/
│   └── solana-bridge.test.ts   # Tests (like your Hardhat tests!)
├── Anchor.toml
└── Cargo.toml
```

## Build and Deploy

### 1. Build the Program

```bash
anchor build
```

This compiles your Rust program to BPF bytecode (similar to Solidity → EVM bytecode).

### 2. Deploy to Localnet

```bash
# Start local validator
solana-test-validator

# Deploy program
anchor deploy

# Get program ID
solana address -k target/deploy/solana_bridge-keypair.json
```

### 3. Update Program ID

Update `programs/solana-bridge/src/lib.rs`:
```rust
declare_id!("YourProgramIdHere");
```

Rebuild:
```bash
anchor build
anchor deploy
```

## Configuration

### Relayer Setup

1. Copy environment example:
```bash
cd relayer
cp .env.example .env
```

2. Update `.env`:
```env
# Solana
SOLANA_RPC_URL=http://127.0.0.1:8899
SOLANA_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
SOLANA_KEYPAIR_PATH=~/.config/solana/id.json

# Ethereum (from your existing bridge)
ETHEREUM_RPC_URL=http://127.0.0.1:8545
ETHEREUM_BRIDGE_ADDRESS=0x...
ETHEREUM_PRIVATE_KEY=0x...
```

## Usage

### 1. Initialize the Bridge

```bash
# Run initialization script
anchor run initialize
```

This sets up the bridge state account (similar to deploying your EVM contract).

### 2. Start the Relayer

```bash
cd relayer
pnpm start
```

The relayer:
- Listens for `LockEvent` on Solana
- Verifies and signs transactions
- Mints on Ethereum

### 3. Bridge Assets

#### Solana → Ethereum

```typescript
// Lock tokens on Solana (SAME CONCEPT as your EVM lock!)
const tx = await program.methods
  .lock(
    new anchor.BN(amount),
    "0xYourEthereumAddress"
  )
  .accounts({
    user: wallet.publicKey,
    bridgeState: bridgeStateAddress,
    userToken: userTokenAccount,
    bridgeToken: bridgeTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

#### Ethereum → Solana

```javascript
// Burn on Ethereum (SAME as your existing bridge!)
await wrappedToken.approve(bridge.address, amount);
await bridge.burn(amount, 'YourSolanaPublicKey');
```

## Testing

### Run Anchor Tests

```bash
anchor test
```

Tests include:
- ✅ Initialize bridge
- ✅ Lock tokens (same as your EVM lock test!)
- ✅ Mint wrapped tokens (same as your EVM mint test!)
- ✅ Prevent duplicate mints (same nonce check!)
- ✅ Burn tokens
- ✅ Pause/unpause

### Test Structure Comparison

```javascript
// Your EVM test
it("Should lock tokens", async () => {
  await token.approve(bridge.address, amount);
  await bridge.lock(recipient, amount);
  expect(await bridge.nonce()).to.equal(1);
});

// Solana test (IDENTICAL LOGIC!)
it('Locks tokens', async () => {
  await program.methods.lock(amount, recipient).accounts({...}).rpc();
  const state = await program.account.bridgeState.fetch(bridgeState);
  assert.equal(state.nonce.toString(), '1');
});
```

## Code Mapping Guide

### State Management

```solidity
// Your Solidity contract
contract Bridge {
    uint256 public nonce;
    address public owner;
    mapping(uint256 => bool) public processedNonces;
}
```

```rust
// Solana equivalent (in separate account)
#[account]
pub struct BridgeState {
    pub nonce: u64,
    pub owner: Pubkey,
    pub processed_nonces: Vec<u64>,
}
```

### Lock Function

```solidity
// Your Solidity
function lock(address to, uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    nonce++;
    emit Lock(msg.sender, to, amount, nonce);
}
```

```rust
// Solana (SAME LOGIC!)
pub fn lock(ctx: Context<Lock>, amount: u64, eth_recipient: String) -> Result<()> {
    token::transfer(cpi_ctx, amount)?;
    bridge_state.nonce += 1;
    emit!(LockEvent { from, amount, nonce: bridge_state.nonce, eth_recipient });
    Ok(())
}
```

### Mint Function

```solidity
// Your Solidity
function mint(address to, uint256 amount, uint256 nonce, bytes sig) external {
    require(!processedNonces[nonce]);
    wrappedToken.mint(to, amount);
    processedNonces[nonce] = true;
}
```

```rust
// Solana (SAME LOGIC!)
pub fn mint(ctx: Context<Mint>, amount: u64, nonce: u64) -> Result<()> {
    require!(!bridge_state.processed_nonces.contains(&nonce));
    token::mint_to(cpi_ctx, amount)?;
    bridge_state.processed_nonces.push(nonce);
    Ok(())
}
```

## Relayer Comparison

### Your EVM Relayer
```javascript
sourceBridge.on('Lock', async (from, to, amount, nonce) => {
  const signature = await signMintRequest(to, amount, nonce);
  await destBridge.mint(to, amount, nonce, signature);
});
```

### Solana Relayer (IDENTICAL PATTERN!)
```javascript
program.addEventListener('LockEvent', async (event) => {
  const signature = await signMintRequest(event.ethRecipient, event.amount, event.nonce);
  await ethereumBridge.mint(event.ethRecipient, event.amount, event.nonce, signature);
});
```

## Development Workflow

1. **Edit Rust program** (`programs/solana-bridge/src/lib.rs`)
2. **Build**: `anchor build`
3. **Test**: `anchor test`
4. **Deploy**: `anchor deploy`
5. **Update relayer** if needed
6. **Test end-to-end**

## Resources

### Learning Rust
- [The Rust Book](https://doc.rust-lang.org/book/) (chapters 1-10 sufficient)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)

### Solana Development
- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Documentation](https://docs.solana.com/)

### Tools
- [Solana Explorer](https://explorer.solana.com/)
- [Anchor Playground](https://beta.solpg.io/)

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
anchor clean
anchor build
```

### Deployment Fails

```bash
# Check wallet balance
solana balance

# Fund wallet
solana airdrop 2

# Check program keypair
ls -la target/deploy/
```

### Tests Fail

```bash
# Ensure local validator is running
solana-test-validator

# Run with verbose logs
anchor test --skip-local-validator
```

### Relayer Issues

- Check program ID matches deployed program
- Verify Ethereum bridge address is correct
- Ensure wallet has SOL for transaction fees

## Key Takeaways

1. **80% of logic transfers directly** from your EVM bridge
2. **Same patterns**: lock/mint, burn/unlock, nonce tracking, events
3. **Different syntax**: Rust instead of Solidity
4. **State in accounts**: Not in program itself
5. **Much faster finality**: 400ms vs 3 minutes!

## Next Steps

1. Complete Anchor tutorial: https://book.anchor-lang.com/
2. Learn Rust basics: https://doc.rust-lang.org/book/
3. Test on devnet
4. Integrate with existing Ethereum bridge
5. Deploy to mainnet

## Security Notes

- Private keys in `.env` (gitignored)
- Signature verification on Ethereum
- Nonce tracking prevents replay
- Program can be paused
- Production: Use multisig and upgraded authority
