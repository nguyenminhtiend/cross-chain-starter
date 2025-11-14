# Quick Start Guide: Stellar & Solana Bridges

## TL;DR

You now have **2 new bridges** that work exactly like your EVM bridge but for Stellar and Solana!

## 🚀 Quick Commands

### Stellar Bridge (Easier - Start Here!)

```bash
# 1. Setup
cd stellar-bridge
pnpm install
pnpm run setup              # Creates accounts, shows credentials

# 2. Configure
nano .env                   # Add credentials from setup

# 3. Start
pnpm start                  # Runs bridge

# 4. Test
pnpm test                   # Runs tests
```

**Time:** 1-2 hours to first test
**Difficulty:** ⭐⭐ (Medium)

### Solana Bridge (After Stellar)

```bash
# 1. Install Tools (one-time)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest && avm use latest

# 2. Setup Wallet
solana-keygen new           # Creates wallet
solana airdrop 2            # Funds wallet

# 3. Build & Deploy
cd solana-bridge
anchor build
anchor deploy

# 4. Start Relayer
cd relayer
pnpm install
nano .env                   # Configure
pnpm start

# 5. Test
cd ..
anchor test
```

**Time:** 3-4 hours to first test (including Rust learning)
**Difficulty:** ⭐⭐⭐ (Medium-Hard)

## 📖 Documentation Quick Links

| What You Need | Where to Find It |
|---------------|------------------|
| **Overview & Use Cases** | `NON-EVM-BRIDGES.md` |
| **Implementation Summary** | `STELLAR-SOLANA-SUMMARY.md` |
| **Learning Guide** | `docs/02-STELLAR-SOLANA-GUIDE.md` |
| **Stellar Setup** | `stellar-bridge/README.md` |
| **Solana Setup** | `solana-bridge/README.md` |
| **This Guide** | `QUICK-START-GUIDE.md` |

## 🔍 How It Maps to Your Knowledge

### Pattern Comparison

```javascript
// YOUR EVM BRIDGE (What you know)
await token.approve(bridge.address, amount);
await bridge.lock(recipient, amount);

// STELLAR (Same concept!)
await server.submitTransaction(paymentTx);  // Lock by payment

// SOLANA (Same concept!)
await program.methods.lock(amount, recipient).rpc();
```

### Event Listening

```javascript
// YOUR EVM BRIDGE
sourceBridge.on('Lock', async (from, to, amount, nonce) => {
  await destBridge.mint(to, amount, nonce, signature);
});

// STELLAR
server.payments().stream({
  onmessage: async (payment) => {
    await ethereumBridge.mint(to, amount, nonce, signature);  // SAME!
  }
});

// SOLANA
program.addEventListener('LockEvent', async (event) => {
  await ethereumBridge.mint(to, amount, nonce, signature);  // SAME!
});
```

## 🎯 What Works Out of the Box

### Stellar Bridge ✅
- Payment streaming from Stellar
- Auto-minting on Ethereum
- Burn handling back to Stellar
- Trustline management
- Account setup scripts
- Comprehensive logging
- Error handling

### Solana Bridge ✅
- Lock/mint/burn/unlock functions
- Event emission and listening
- Nonce tracking (replay protection)
- Pause/unpause controls
- Relayer with signature verification
- Full test suite
- Error handling

## 🔧 Configuration Checklist

### Stellar `.env`
```bash
✓ STELLAR_BRIDGE_SECRET        # From setup script
✓ STELLAR_HORIZON_URL          # Testnet: horizon-testnet.stellar.org
✓ ETHEREUM_BRIDGE_ADDRESS      # Your deployed bridge
✓ ETHEREUM_PRIVATE_KEY         # Relayer key
✓ STELLAR_USDC_ISSUER          # From setup or use default
```

### Solana `.env`
```bash
✓ SOLANA_PROGRAM_ID            # From anchor deploy
✓ SOLANA_KEYPAIR_PATH          # ~/.config/solana/id.json
✓ ETHEREUM_BRIDGE_ADDRESS      # Your deployed bridge
✓ ETHEREUM_PRIVATE_KEY         # Relayer key
```

## 📊 Feature Comparison

| Feature | Your EVM | Stellar | Solana |
|---------|----------|---------|--------|
| Finality | ~3 min | ~5 sec | ~400ms |
| Tx Cost | $2-50 | $0.00001 | $0.00025 |
| Smart Contracts | ✅ | ❌ | ✅ |
| Language | Solidity | JS | Rust |
| Setup Time | 1 day | 1 hour | 3 hours |

## 🐛 Common Issues & Fixes

### Stellar

**"Account not found"**
```bash
pnpm run setup  # Re-run setup script
```

**"No trustline"**
- Setup script creates it automatically
- Check on stellar.expert to verify

**"Payment not processed"**
- Verify memo contains valid Ethereum address (0x...)
- Check relayer logs

### Solana

**"Program not found"**
```bash
anchor build
anchor deploy
# Update program ID in lib.rs
```

**"Insufficient SOL"**
```bash
solana airdrop 2
```

**"Transaction simulation failed"**
- Check account has SOL for fees
- Verify program is deployed
- Check logs for specific error

## 📈 Testing Flow

### Test Stellar → Ethereum

1. Start bridge: `pnpm start`
2. Send USDC payment with ETH address in memo
3. Wait ~5 seconds for finality
4. Check Ethereum balance (should have wrapped USDC)

### Test Ethereum → Stellar

1. Burn wrapped tokens on Ethereum
2. Include Stellar address in burn call
3. Wait for processing
4. Check Stellar balance (should receive original USDC)

### Test Solana ↔ Ethereum

Similar flow but using `anchor test` for automated testing.

## 💡 Pro Tips

1. **Start with Stellar** - No new language, easier concepts
2. **Use Testnet** - Free tokens, safe to experiment
3. **Check Logs** - Both bridges have detailed logging
4. **Read Comments** - Every function mapped to your EVM bridge
5. **Use Explorers**:
   - Stellar: https://stellar.expert/
   - Solana: https://explorer.solana.com/

## 🎓 Learning Path

### Day 1: Stellar (Easy)
- [ ] Read `stellar-bridge/README.md`
- [ ] Run setup script
- [ ] Test payment → mint flow
- [ ] Test burn → unlock flow

### Day 2-3: Stellar Integration
- [ ] Connect to your EVM bridge
- [ ] Test end-to-end
- [ ] Add monitoring

### Day 4-5: Solana Basics
- [ ] Rust Book chapters 1-10
- [ ] Anchor tutorial (first 5 sections)
- [ ] Read `solana-bridge/README.md`

### Day 6-7: Solana Implementation
- [ ] Build and deploy program
- [ ] Test locally
- [ ] Connect relayer to Ethereum
- [ ] Test end-to-end

## 🔗 Essential Resources

### Stellar
- **SDK**: https://stellar.github.io/js-stellar-sdk/
- **Tutorial**: https://quest.stellar.org/
- **Explorer**: https://stellar.expert/

### Solana
- **Anchor**: https://book.anchor-lang.com/
- **Cookbook**: https://solanacookbook.com/
- **Rust**: https://doc.rust-lang.org/book/

## ✅ Verification Checklist

Before going to production:

### Stellar
- [ ] Bridge account funded
- [ ] Trustlines created
- [ ] Relayer running
- [ ] Events processing correctly
- [ ] Ethereum bridge connected
- [ ] Tests passing

### Solana
- [ ] Program deployed
- [ ] Bridge initialized
- [ ] Relayer connected
- [ ] Tests passing
- [ ] Ethereum bridge connected
- [ ] PDAs working correctly

## 🚨 Security Notes

Both bridges implement:
- ✅ Signature verification
- ✅ Nonce tracking (replay protection)
- ✅ Finality checks
- ✅ Error handling
- ✅ Logging and monitoring

**For Production:**
- Use hardware wallets/HSM for keys
- Implement rate limiting
- Add circuit breakers
- Set up monitoring alerts
- Audit smart contracts
- Test extensively on testnet

## 🎉 What's Next?

1. **Get Both Working** - Stellar first, then Solana
2. **Integrate with ChainSwap** - Multi-hop swaps
3. **Add Monitoring** - Track volume, errors, performance
4. **Deploy to Mainnet** - After thorough testing
5. **Add More Chains** - Use same pattern!

## 📞 Need Help?

1. Check the specific bridge README
2. Read the detailed guide in `docs/02-STELLAR-SOLANA-GUIDE.md`
3. Review code comments (every function mapped!)
4. Check official documentation (links above)

---

**Remember:** You're not learning new bridge concepts - just new syntax for the same patterns you already know! 🚀
