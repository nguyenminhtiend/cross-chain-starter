# Phase 7: Smart Contracts with Soroban

## Overview
Soroban is Stellar's smart contract platform, launched in 2024. This phase introduces Soroban, how it differs from Ethereum, and how to interact with contracts using JavaScript.

---

## What is Soroban?

**Soroban** is Stellar's smart contract platform built on **WebAssembly (Wasm)**.

### Key Features

1. **WebAssembly Runtime**
   - Write contracts in Rust, C++, or any language that compiles to Wasm
   - Near-native performance
   - Sandboxed execution

2. **Built-in Capabilities**
   - Low, predictable fees
   - State archival (reduces ledger bloat)
   - Native Stellar asset integration

3. **Security First**
   - Resource limits enforced
   - No reentrancy attacks (unlike Ethereum)
   - Formal verification friendly

---

## Soroban vs Ethereum Smart Contracts

| Feature | Soroban | Ethereum |
|---------|---------|----------|
| **Language** | Rust (compiles to Wasm) | Solidity (compiles to EVM bytecode) |
| **Runtime** | WebAssembly | Ethereum Virtual Machine |
| **Gas Model** | Resource fees (predictable) | Dynamic gas (unpredictable) |
| **State Storage** | Archivable (cheap) | Always on-chain (expensive) |
| **Execution** | Deterministic limits | Gas-based limits |
| **Reentrancy** | Not possible | Major attack vector |
| **Asset Support** | Native Stellar assets | Requires token contracts |

---

## Setting Up Soroban

### Install Soroban CLI

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add Wasm target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked stellar-cli --features opt

# Verify installation
stellar --version
```

### Configure for Testnet

```bash
# Add testnet network
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Create identity (keypair)
stellar keys generate alice --network testnet

# Fund account
stellar keys fund alice --network testnet

# Check balance
stellar keys address alice
```

---

## Your First Smart Contract: Hello World

### Create Rust Project

```bash
mkdir soroban-hello
cd soroban-hello
stellar contract init hello
cd hello
```

### Contract Code: `src/lib.rs`

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    // Simple hello function
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }

    // Counter example with state
    pub fn increment(env: Env) -> u32 {
        let key = symbol_short!("COUNTER");
        let mut count: u32 = env.storage().instance().get(&key).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&key, &count);
        count
    }

    pub fn get_count(env: Env) -> u32 {
        let key = symbol_short!("COUNTER");
        env.storage().instance().get(&key).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_hello() {
        let env = Env::default();
        let contract_id = env.register_contract(None, HelloContract);
        let client = HelloContractClient::new(&env, &contract_id);

        let words = client.hello(&symbol_short!("World"));
        assert_eq!(words, vec![&env, symbol_short!("Hello"), symbol_short!("World")]);
    }

    #[test]
    fn test_increment() {
        let env = Env::default();
        let contract_id = env.register_contract(None, HelloContract);
        let client = HelloContractClient::new(&env, &contract_id);

        assert_eq!(client.increment(), 1);
        assert_eq!(client.increment(), 2);
        assert_eq!(client.get_count(), 2);
    }
}
```

### Build the Contract

```bash
# Build optimized Wasm
stellar contract build

# Output: target/wasm32-unknown-unknown/release/hello.wasm
```

### Deploy to Testnet

```bash
# Deploy contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hello.wasm \
  --source alice \
  --network testnet

# Save contract ID
# Output: CONTRACT_ID_HERE (64-char hex)
```

### Invoke from CLI

```bash
# Call hello function
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  hello --to World

# Output: ["Hello", "World"]

# Increment counter
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  increment

# Output: 1
```

---

## Interacting with Soroban from JavaScript

### Install Soroban Client SDK

```bash
npm install @stellar/stellar-sdk
```

### JavaScript Integration

```javascript
const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.SorobanRpc.Server(
  'https://soroban-testnet.stellar.org'
);

async function invokeContract(
  contractId,
  method,
  args,
  signerSecret
) {
  const sourceKeypair = StellarSdk.Keypair.fromSecret(signerSecret);
  const sourceAccount = await server.getAccount(sourceKeypair.publicKey());

  // Build contract invocation
  const contract = new StellarSdk.Contract(contractId);

  let builtTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Prepare transaction (simulate)
  const preparedTransaction = await server.prepareTransaction(builtTransaction);

  // Sign
  preparedTransaction.sign(sourceKeypair);

  // Submit
  const response = await server.sendTransaction(preparedTransaction);

  console.log('Transaction hash:', response.hash);

  // Wait for confirmation
  let getResponse = await server.getTransaction(response.hash);
  while (getResponse.status === 'NOT_FOUND') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    getResponse = await server.getTransaction(response.hash);
  }

  if (getResponse.status === 'SUCCESS') {
    console.log('✅ Contract invoked successfully');
    // Decode result
    const result = getResponse.returnValue;
    return StellarSdk.scValToNative(result);
  } else {
    throw new Error('Transaction failed');
  }
}

// Usage: Call hello function
const contractId = 'CONTRACT_ID_HERE';
const args = [StellarSdk.nativeToScVal('World', { type: 'symbol' })];

invokeContract(
  contractId,
  'hello',
  args,
  process.env.TESTNET_SECRET_KEY
).then(result => {
  console.log('Result:', result);
});
```

---

## Practical Example: Token Contract

### ERC-20 Style Token in Soroban

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String};

#[derive(Clone)]
#[contracttype]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contract]
pub struct Token;

#[contractimpl]
impl Token {
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) {
        let metadata = TokenMetadata {
            name,
            symbol,
            decimals,
        };

        env.storage().instance().set(&symbol_short!("METADATA"), &metadata);
        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&symbol_short!("ADMIN")).unwrap();
        admin.require_auth();

        let balance = Self::balance(env.clone(), to.clone());
        env.storage().persistent().set(&to, &(balance + amount));
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage().persistent().get(&account).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let from_balance = Self::balance(env.clone(), from.clone());
        let to_balance = Self::balance(env.clone(), to.clone());

        if from_balance < amount {
            panic!("Insufficient balance");
        }

        env.storage().persistent().set(&from, &(from_balance - amount));
        env.storage().persistent().set(&to, &(to_balance + amount));
    }

    pub fn name(env: Env) -> String {
        let metadata: TokenMetadata = env
            .storage()
            .instance()
            .get(&symbol_short!("METADATA"))
            .unwrap();
        metadata.name
    }

    pub fn symbol(env: Env) -> String {
        let metadata: TokenMetadata = env
            .storage()
            .instance()
            .get(&symbol_short!("METADATA"))
            .unwrap();
        metadata.symbol
    }
}
```

### Deploy and Use Token

```bash
# Build
stellar contract build

# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/token.wasm \
  --source alice \
  --network testnet

# Initialize token
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --admin ALICE_PUBLIC_KEY \
  --name "My Token" \
  --symbol "MTK" \
  --decimals 7

# Mint tokens
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  mint \
  --to ALICE_PUBLIC_KEY \
  --amount 1000000

# Check balance
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  balance \
  --account ALICE_PUBLIC_KEY
```

---

## Soroban Storage Types

### 3 Storage Tiers

```rust
// 1. Instance Storage (lifetime tied to contract)
env.storage().instance().set(&key, &value);
let value = env.storage().instance().get(&key);

// 2. Persistent Storage (long-term, must be extended)
env.storage().persistent().set(&key, &value);
env.storage().persistent().extend_ttl(&key, 100, 200);

// 3. Temporary Storage (short-lived, cheap)
env.storage().temporary().set(&key, &value);
```

**When to use:**
- **Instance**: Contract metadata, admin address
- **Persistent**: User balances, critical data
- **Temporary**: Cache, session data

---

## State Archival and Restoration

### Why State Archival?

Soroban archives old state to keep ledger size manageable.

### Extending TTL (Time To Live)

```rust
pub fn extend_balance_ttl(env: Env, account: Address) {
    let key = account;
    env.storage().persistent().extend_ttl(&key, 100, 200);
    // Extends TTL to at least 100 ledgers, max 200
}
```

### From JavaScript

```javascript
async function extendContractTTL(contractId, signerSecret) {
  const sourceKeypair = StellarSdk.Keypair.fromSecret(signerSecret);
  const sourceAccount = await server.getAccount(sourceKeypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.extendFootprintTtl({
        extendTo: 200000 // Extend to 200k ledgers (~30 days)
      })
    )
    .setTimeout(30)
    .build();

  // Prepare, sign, submit...
}
```

---

## Contract Authorization

### Requiring Authorization

```rust
pub fn protected_function(env: Env, user: Address) {
    // Require user to sign transaction
    user.require_auth();

    // ... rest of logic
}
```

### From JavaScript

```javascript
// User must sign the transaction that invokes protected_function
const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET
})
  .addOperation(contract.call('protected_function', userAddress))
  .setTimeout(30)
  .build();

// User's signature proves authorization
transaction.sign(userKeypair);
```

---

## Cross-Contract Calls

### Calling Another Contract

```rust
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct CallerContract;

#[contractimpl]
impl CallerContract {
    pub fn call_other_contract(env: Env, other_contract: Address) -> i128 {
        // Import the other contract's client
        use other_contract::Client as OtherClient;

        let client = OtherClient::new(&env, &other_contract);
        let result = client.some_function();

        result
    }
}
```

---

## Fee Model

### Soroban Resource Fees

Soroban charges for:
1. **Instructions**: CPU usage
2. **Read/Write Bytes**: Storage access
3. **Transaction Size**: Network bandwidth
4. **Ledger Entry Changes**: State modifications

### Estimating Fees

```javascript
async function estimateContractFee(contractId, method, args) {
  const server = new StellarSdk.SorobanRpc.Server(
    'https://soroban-testnet.stellar.org'
  );

  // Build transaction
  const transaction = buildContractCall(contractId, method, args);

  // Simulate to get resource fees
  const simulation = await server.simulateTransaction(transaction);

  console.log('Estimated fee:', simulation.minResourceFee);
  console.log('CPU instructions:', simulation.cost.cpuInsns);
  console.log('Memory bytes:', simulation.cost.memBytes);

  return simulation;
}
```

**Typical fees**: 0.0001 - 0.01 XLM per contract call

---

## Testing Contracts

### Unit Tests in Rust

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{symbol_short, Env};

    #[test]
    fn test_increment() {
        let env = Env::default();
        let contract_id = env.register_contract(None, HelloContract);
        let client = HelloContractClient::new(&env, &contract_id);

        assert_eq!(client.increment(), 1);
        assert_eq!(client.increment(), 2);
    }
}
```

Run tests:
```bash
cargo test
```

### Integration Tests in JavaScript

```javascript
const StellarSdk = require('@stellar/stellar-sdk');
const assert = require('assert');

describe('Hello Contract', () => {
  let contractId;

  before(async () => {
    // Deploy contract
    contractId = await deployContract('hello.wasm');
  });

  it('should increment counter', async () => {
    const result1 = await invokeContract(contractId, 'increment', []);
    assert.equal(result1, 1);

    const result2 = await invokeContract(contractId, 'increment', []);
    assert.equal(result2, 2);
  });
});
```

---

## Real-World Contract: Escrow

### Escrow Contract

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[derive(Clone)]
#[contracttype]
pub struct Escrow {
    pub buyer: Address,
    pub seller: Address,
    pub amount: i128,
    pub released: bool,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn create(env: Env, buyer: Address, seller: Address, amount: i128) -> u32 {
        buyer.require_auth();

        let escrow = Escrow {
            buyer: buyer.clone(),
            seller,
            amount,
            released: false,
        };

        let id: u32 = env.storage().instance().get(&symbol_short!("COUNT")).unwrap_or(0);
        let new_id = id + 1;

        env.storage().persistent().set(&new_id, &escrow);
        env.storage().instance().set(&symbol_short!("COUNT"), &new_id);

        new_id
    }

    pub fn release(env: Env, escrow_id: u32) {
        let mut escrow: Escrow = env.storage().persistent().get(&escrow_id).unwrap();
        escrow.buyer.require_auth();

        if escrow.released {
            panic!("Already released");
        }

        // Transfer funds to seller (simplified)
        escrow.released = true;
        env.storage().persistent().set(&escrow_id, &escrow);
    }

    pub fn refund(env: Env, escrow_id: u32) {
        let mut escrow: Escrow = env.storage().persistent().get(&escrow_id).unwrap();
        escrow.seller.require_auth();

        if escrow.released {
            panic!("Already released");
        }

        // Refund to buyer (simplified)
        escrow.released = true;
        env.storage().persistent().set(&escrow_id, &escrow);
    }
}
```

---

## Key Takeaways

1. **Soroban uses WebAssembly** for near-native performance
2. **Written in Rust**, compiles to Wasm
3. **Three storage types**: Instance, Persistent, Temporary
4. **State archival** keeps ledger size manageable
5. **Predictable fees** based on resources used
6. **JavaScript integration** via @stellar/stellar-sdk
7. **No reentrancy attacks** by design

---

## Next Steps

Move to **Phase 8** where you'll:
- Build a complete cross-chain bridge
- Integrate Stellar with Ethereum
- Implement atomic swaps
- Create a production-ready bridge

---

## Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Soroban Examples](https://github.com/stellar/soroban-examples)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Soroban Discord](https://discord.gg/stellar)

---

## Exercise Challenges

1. **Counter Contract**: Build and deploy a simple counter
2. **Token Contract**: Create your own token with mint/transfer
3. **Voting Contract**: Implement a basic voting system
4. **NFT Contract**: Create a simple NFT contract
5. **Oracle Contract**: Fetch off-chain data into contract
