# Relayer Testing Guide

This guide provides detailed instructions for testing the cross-chain bridge relayer service.

## Prerequisites

Before running these tests, ensure you have:

1. **Two blockchain nodes running**:
   ```bash
   # Terminal 1 - Chain 1 (Ethereum)
   pnpm run node:chain1

   # Terminal 2 - Chain 2 (BSC)
   pnpm run node:chain2
   ```

2. **Contracts deployed**:
   ```bash
   pnpm run deploy:all
   ```
   This should create a `.env` file with contract addresses.

3. **Relayer service running**:
   ```bash
   # Terminal 3 - Relayer
   pnpm run relayer:dev
   ```

   You should see:
   ```
   [INFO] Connected to Chain 1: Ethereum (Local)
   [INFO] Connected to Chain 2: BSC (Local)
   [INFO] Started listening to Lock events
   [INFO] Started listening to Burn events
   [INFO] Relayer is running and listening for events...
   ```

## Test Scripts

### 1. Test Lock Event (Chain 1 → Chain 2)

**What it tests**: Locking tokens on Chain 1 and automatic minting of wrapped tokens on Chain 2.

**Run**:
```bash
node scripts/relayer-tests/test-lock-event.js
```

**What happens**:
1. ✅ Approves bridge to spend tokens
2. ✅ Locks 100 tokens on Chain 1
3. ✅ Emits Lock event
4. ⏳ Relayer detects event
5. ✅ Relayer mints 100 wrapped tokens on Chain 2
6. ✅ Verifies balances and nonce processing

**Expected Output**:
```
================================================================================
🔒 TESTING LOCK EVENT: CHAIN 1 → CHAIN 2
================================================================================

📊 Initial State:
--------------------------------------------------------------------------------
User Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Chain 1 (Source Token): 10000.0 tokens
Chain 2 (Wrapped Token): 0.0 tokens
Bridge Reserve: 1000.0 tokens

🔄 Starting Lock Process:
--------------------------------------------------------------------------------
1️⃣  Approving bridge to spend tokens...
   ✅ Approved: 100.0 tokens

2️⃣  Locking tokens on Chain 1...
   ✅ Locked in block: 3
   📝 Lock Event Emitted:
      - From: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      - To: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      - Amount: 100.0 tokens
      - Nonce: 0

3️⃣  Waiting for relayer to process...
   ✅ Wrapped tokens detected on Chain 2!

📊 Final State:
--------------------------------------------------------------------------------
Chain 1 (Source Token): 9900.0 tokens (100.0 locked)
Chain 2 (Wrapped Token): 100.0 tokens (+100.0 minted)
Bridge Reserve: 1100.0 tokens (+100.0 received)

Nonce 0 processed on Chain 2: ✅ Yes

================================================================================
✅ LOCK EVENT TEST PASSED!
================================================================================
```

**Check Relayer Logs**: You should see in the relayer terminal:
```
[INFO] 🔒 LOCK EVENT DETECTED ON CHAIN 1
[INFO] Minting wrapped tokens on Chain 2...
[INFO] Transaction sent: 0x...
[INFO] Transaction confirmed in block 3
[INFO] ✅ Mint successful!
```

---

### 2. Test Burn Event (Chain 2 → Chain 1)

**What it tests**: Burning wrapped tokens on Chain 2 and automatic unlocking of original tokens on Chain 1.

**Prerequisites**: Must have wrapped tokens on Chain 2 (run test-lock-event.js first).

**Run**:
```bash
node scripts/relayer-tests/test-burn-event.js
```

**What happens**:
1. ✅ Checks for wrapped tokens
2. ✅ Approves bridge to burn wrapped tokens
3. ✅ Burns 50 wrapped tokens on Chain 2
4. ✅ Emits Burn event
5. ⏳ Relayer detects event
6. ✅ Relayer unlocks 50 original tokens on Chain 1
7. ✅ Verifies balances and nonce processing

**Expected Output**:
```
================================================================================
🔥 TESTING BURN EVENT: CHAIN 2 → CHAIN 1
================================================================================

📊 Initial State:
--------------------------------------------------------------------------------
User Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Chain 1 (Source Token): 9900.0 tokens
Chain 2 (Wrapped Token): 100.0 tokens
Bridge Reserve: 1100.0 tokens

🔄 Starting Burn Process:
--------------------------------------------------------------------------------
1️⃣  Approving bridge to burn wrapped tokens...
   ✅ Approved: 50.0 wrapped tokens

2️⃣  Burning wrapped tokens on Chain 2...
   ✅ Burned in block: 5
   📝 Burn Event Emitted:
      - From: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      - To: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      - Amount: 50.0 tokens
      - Nonce: 0

3️⃣  Waiting for relayer to process...
   ✅ Tokens unlocked on Chain 1!

📊 Final State:
--------------------------------------------------------------------------------
Chain 1 (Source Token): 9950.0 tokens (+50.0 unlocked)
Chain 2 (Wrapped Token): 50.0 tokens (50.0 burned)
Bridge Reserve: 1050.0 tokens (50.0 released)

Nonce 0 processed on Chain 1: ✅ Yes

================================================================================
✅ BURN EVENT TEST PASSED!
================================================================================
```

**Check Relayer Logs**: You should see in the relayer terminal:
```
[INFO] 🔥 BURN EVENT DETECTED ON CHAIN 2
[INFO] Unlocking tokens on Chain 1...
[INFO] Transaction sent: 0x...
[INFO] Transaction confirmed in block 5
[INFO] ✅ Unlock successful!
```

---

### 3. Full Cycle Test (Chain 1 → Chain 2 → Chain 1)

**What it tests**: Complete round-trip transfer to verify the entire bridge system.

**Run**:
```bash
node scripts/relayer-tests/test-full-cycle.js
```

**What happens**:
1. **Part 1: Lock on Chain 1**
   - Locks 150 tokens on Chain 1
   - Waits for 150 wrapped tokens on Chain 2

2. **Part 2: Burn on Chain 2**
   - Burns 100 wrapped tokens on Chain 2
   - Waits for 100 tokens unlocked on Chain 1

3. **Verification**
   - Verifies net change: -50 tokens on Chain 1 (150 out, 100 back)
   - Verifies 50 wrapped tokens remain on Chain 2
   - Verifies bridge reserve increased by 50 tokens
   - Verifies all nonces processed correctly

**Expected Output**:
```
================================================================================
🔄 FULL CYCLE TEST: CHAIN 1 → CHAIN 2 → CHAIN 1
================================================================================

📊 Initial State:
--------------------------------------------------------------------------------
User Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Chain 1 Balance: 10000.0 tokens
Chain 2 Balance: 0.0 wrapped tokens
Bridge Reserve: 1000.0 tokens

================================================================================
PART 1: LOCK TOKENS ON CHAIN 1
================================================================================

1️⃣  Approving 150.0 tokens for bridge...
   ✅ Approved

2️⃣  Locking 150.0 tokens on Chain 1...
   ✅ Locked in block 3
   📝 Lock Nonce: 0

3️⃣  Waiting for relayer to mint on Chain 2...
   ✅ Success! Minted 150.0 wrapped tokens on Chain 2

📊 State After Lock:
--------------------------------------------------------------------------------
Chain 1 Balance: 9850.0 tokens (150.0 locked)
Chain 2 Balance: 150.0 wrapped tokens (+150.0 minted)
Bridge Reserve: 1150.0 tokens (+150.0 received)

================================================================================
PART 2: BURN TOKENS ON CHAIN 2
================================================================================

4️⃣  Approving 100.0 wrapped tokens for bridge...
   ✅ Approved

5️⃣  Burning 100.0 wrapped tokens on Chain 2...
   ✅ Burned in block 5
   📝 Burn Nonce: 0

6️⃣  Waiting for relayer to unlock on Chain 1...
   ✅ Success! Unlocked 100.0 tokens on Chain 1

================================================================================
📊 FINAL STATE & VERIFICATION
================================================================================

Final Balances:
--------------------------------------------------------------------------------
Chain 1 Balance: 9950.0 tokens
Chain 2 Balance: 50.0 wrapped tokens
Bridge Reserve: 1050.0 tokens

Balance Changes:
--------------------------------------------------------------------------------
Chain 1: -50.0 tokens
Chain 2: +50.0 wrapped tokens
Bridge: +50.0 tokens locked

Nonce Verification:
--------------------------------------------------------------------------------
Lock Nonce 0 processed on Chain 2: ✅
Burn Nonce 0 processed on Chain 1: ✅

================================================================================
✅ FULL CYCLE TEST PASSED!
================================================================================
✅ Locked 150.0 → Minted 150.0 wrapped
✅ Burned 100.0 wrapped → Unlocked 100.0
✅ Net change: -50.0 tokens (150.0 out, 100.0 back)
✅ Bridge reserve increased by: 50.0 tokens
✅ All nonces processed correctly
================================================================================

🎉 Cross-chain bridge is working perfectly!
```

---

## Manual Testing Steps

### Step 1: Verify Relayer is Listening

Check the relayer terminal output:
```
[INFO] Relayer is running and listening for events...
```

### Step 2: Test Lock Event Manually

Open Hardhat console connected to Chain 1:
```bash
npx hardhat console --network chain1
```

Execute in console:
```javascript
const sourceToken = await ethers.getContractAt("SourceToken", process.env.CHAIN1_TOKEN_ADDRESS);
const bridge = await ethers.getContractAt("BridgeEthereum", process.env.CHAIN1_BRIDGE_ADDRESS);
const [user] = await ethers.getSigners();

// Approve and lock
await sourceToken.approve(bridge.target, ethers.parseEther("50"));
const tx = await bridge.lock(user.address, ethers.parseEther("50"), ethers.id("CHAIN2"));
await tx.wait();
console.log("Lock TX:", tx.hash);
```

**Watch the relayer terminal** - you should see the Lock event being processed.

### Step 3: Verify on Chain 2

Open another console for Chain 2:
```bash
npx hardhat console --network chain2
```

Check balance:
```javascript
const wrappedToken = await ethers.getContractAt("WrappedToken", process.env.CHAIN2_TOKEN_ADDRESS);
const [user] = await ethers.getSigners();
const balance = await wrappedToken.balanceOf(user.address);
console.log("Wrapped balance:", ethers.formatEther(balance));
```

### Step 4: Test Burn Event Manually

In the Chain 2 console:
```javascript
const wrappedToken = await ethers.getContractAt("WrappedToken", process.env.CHAIN2_TOKEN_ADDRESS);
const bridge = await ethers.getContractAt("BridgeBSC", process.env.CHAIN2_BRIDGE_ADDRESS);
const [user] = await ethers.getSigners();

// Approve and burn
await wrappedToken.approve(bridge.target, ethers.parseEther("25"));
const tx = await bridge.burn(user.address, ethers.parseEther("25"), ethers.id("CHAIN1"));
await tx.wait();
console.log("Burn TX:", tx.hash);
```

**Watch the relayer terminal** - you should see the Burn event being processed.

### Step 5: Verify on Chain 1

Back in Chain 1 console:
```javascript
const sourceToken = await ethers.getContractAt("SourceToken", process.env.CHAIN1_TOKEN_ADDRESS);
const [user] = await ethers.getSigners();
const balance = await sourceToken.balanceOf(user.address);
console.log("Source balance:", ethers.formatEther(balance));
```

---

## Troubleshooting

### Relayer Not Starting
- **Error**: "Bridge addresses not configured in .env file"
  - **Fix**: Run `pnpm run deploy:all` to deploy contracts

### No Tokens Minted/Unlocked
- **Check**: Is the relayer running and showing listening messages?
- **Check**: Are both blockchain nodes running?
- **Check**: Look for errors in relayer logs
- **Common issue**: Wrong RPC URLs in `.env`

### Test Hangs on "Waiting for relayer"
- **Check**: Relayer terminal for errors
- **Fix**: Restart relayer with `rs` in nodemon
- **Fix**: Increase wait time in test scripts

### "Insufficient wrapped tokens" Error
- **Fix**: Run `test-lock-event.js` first to get wrapped tokens
- **Or**: Reduce burn amount in the test script

### Signature Verification Failed
- **Check**: Relayer is using correct private key
- **Check**: `RELAYER_PRIVATE_KEY` in `.env` matches deployed contract configuration

---

## Success Criteria

✅ All three test scripts pass without errors
✅ Relayer logs show successful event processing
✅ Balances update correctly on both chains
✅ Nonces are marked as processed
✅ Bridge reserve increases/decreases correctly
✅ No errors or warnings in relayer logs

---

## Next Steps

After successful testing:
1. ✅ Phase 5 Complete!
2. 📊 Move to Phase 6: Monitoring & Production
3. 🚀 Consider deploying to testnets (Sepolia, BSC Testnet)

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `pnpm run node:chain1` | Start Chain 1 node |
| `pnpm run node:chain2` | Start Chain 2 node |
| `pnpm run deploy:all` | Deploy all contracts |
| `pnpm run relayer:dev` | Start relayer (development mode) |
| `pnpm run relayer:start` | Start relayer (production mode) |
| `node scripts/relayer-tests/test-lock-event.js` | Test Lock event |
| `node scripts/relayer-tests/test-burn-event.js` | Test Burn event |
| `node scripts/relayer-tests/test-full-cycle.js` | Test full cycle |

Happy testing! 🎉
