# Quick Start Guide - Cross-Chain Bridge

Get your Stellar↔Ethereum bridge up and running in 15 minutes!

## Prerequisites Checklist

- [ ] Node.js 16+ installed
- [ ] Stellar testnet account with XLM
- [ ] Ethereum wallet with Sepolia ETH
- [ ] Infura API key (get free at https://infura.io)

---

## Step-by-Step Setup

### 1. Get Test Funds (5 minutes)

**Stellar Testnet XLM:**
```
1. Visit: https://laboratory.stellar.org/#account-creator?network=test
2. Click "Generate keypair"
3. Save your keys securely
4. Click "Get test network lumens"
```

**Ethereum Sepolia ETH:**
```
1. Visit: https://sepoliafaucet.com
2. Enter your Ethereum address
3. Complete captcha
4. Receive 0.5 Sepolia ETH
```

### 2. Configure Environment (3 minutes)

Edit `.env` in project root:

```bash
# Ethereum
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY_HERE
ETH_PRIVATE_KEY=0x...  # Your deployer private key
ETH_USER_KEY=0x...     # Your user wallet key

# Stellar
STELLAR_PUBLIC_KEY=GB...    # From step 1
STELLAR_SECRET_KEY=SB...    # From step 1
```

### 3. Deploy Ethereum Contract (2 minutes)

**Using Remix (Easiest):**

```
1. Go to: https://remix.ethereum.org
2. Create file: BridgeLock.sol
3. Copy content from: src/phase8-bridge/ethereum/contracts/BridgeLock.sol
4. Compile (Solidity 0.8.20)
5. Deploy tab:
   - Select "Injected Provider - MetaMask"
   - Constructor: requiredApprovals = 1 (for testing)
   - Click "Deploy"
6. Copy deployed address
```

Add to `.env`:
```bash
ETH_BRIDGE_ADDRESS=0x...YOUR_DEPLOYED_ADDRESS...
REQUIRED_APPROVALS=1
VALIDATOR_1=0x...YOUR_WALLET_ADDRESS...
ETH_VALIDATOR_KEY=0x...YOUR_PRIVATE_KEY...
```

### 4. Create Stellar Asset (1 minute)

```bash
cd src/phase8-bridge
node stellar/create-wrapped-asset.js
```

Copy the issuer key to `.env`:
```bash
STELLAR_ISSUER_PUBLIC=GB...
STELLAR_ISSUER_SECRET=SB...
```

### 5. Setup Trustline (1 minute)

```bash
node client/burn-weth.js trustline
```

### 6. Start Relayer (1 second)

```bash
node relayer/index.js
```

Keep this terminal open!

---

## Test the Bridge (2 minutes)

### Test 1: Lock ETH → Get wETH

**Terminal 2:**
```bash
cd src/phase8-bridge
node client/lock-eth.js 0.01 YOUR_STELLAR_PUBLIC_KEY
```

Wait 10-30 seconds, then check:
```bash
node client/burn-weth.js balance
```

You should see 0.01 wETH!

### Test 2: Burn wETH → Get ETH

```bash
node client/burn-weth.js 0.01 YOUR_ETH_ADDRESS
```

Wait for validator approval (~10-30 seconds).

Check your Ethereum wallet - you should have received 0.01 ETH back!

---

## Verification

### Check Bridge Stats

```bash
# Ethereum side
node client/lock-eth.js stats

# Stellar side
node client/burn-weth.js balance
```

### View on Block Explorers

**Ethereum:**
```
https://sepolia.etherscan.io/address/YOUR_BRIDGE_ADDRESS
```

**Stellar:**
```
https://stellar.expert/explorer/testnet/asset/wETH-YOUR_ISSUER_ADDRESS
```

---

## Common First-Time Issues

### "Cannot read properties of null"
- **Fix**: Make sure you set all required variables in `.env`
- **Check**: Run `node -e "require('./config').validateConfig()"`

### "No trustline found"
- **Fix**: Run `node client/burn-weth.js trustline`

### "Insufficient balance"
- **Ethereum**: Get more Sepolia ETH from faucet
- **Stellar**: Fund account at Stellar Laboratory

### "Transaction failed"
- **Check**: Make sure relayer is running
- **Check**: Verify bridge address in `.env`
- **Check**: Look at relayer logs for errors

---

## What's Next?

Now that your bridge is running:

1. **Read the Full README**: Check `README.md` for advanced features
2. **Security**: Review security considerations before mainnet
3. **Customize**: Adjust limits, fees, validators
4. **Monitor**: Set up proper monitoring and alerting
5. **Scale**: Add more validators for production

---

## Quick Reference

### Key Commands

```bash
# Setup
node stellar/create-wrapped-asset.js
node client/burn-weth.js trustline

# Bridge Operations
node client/lock-eth.js 0.01 STELLAR_ADDRESS
node client/burn-weth.js 0.01 ETH_ADDRESS

# Monitoring
node client/lock-eth.js stats
node client/burn-weth.js balance

# Relayer
node relayer/index.js
```

### Important Files

- `.env` - Configuration
- `README.md` - Full documentation
- `relayer/index.js` - Bridge service
- `client/lock-eth.js` - Lock ETH
- `client/burn-weth.js` - Burn wETH

---

## Need Help?

1. Check relayer logs
2. Verify `.env` configuration
3. Review `README.md` troubleshooting section
4. Test individual components

---

**You're all set! Happy bridging! 🌉**
