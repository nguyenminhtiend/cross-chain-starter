# Phase 6: Monitoring & Production

**Duration**: 30 minutes
**Difficulty**: Intermediate
**Prerequisites**: Phase 5 completed (relayer running)

## 📋 Phase Overview

Add monitoring, health checks, and production readiness features to ensure the bridge operates reliably and can be monitored in real-time.

## 🎯 Learning Objectives

- Implement balance monitoring
- Create health check systems
- Verify supply conservation
- Understand production considerations
- Learn operational best practices

## 📥 Inputs

From Phase 5:
- Running relayer service
- Deployed contracts on both chains
- Working cross-chain transfers

## 📤 Outputs

✅ Balance monitor script
✅ Health check system
✅ Supply conservation verification
✅ Production deployment checklist
✅ Operational runbook

## 🚀 Implementation

### Balance Monitor

**File**: `monitoring/scripts/balance-monitor.js`

```javascript
const { ethers } = require("hardhat");
require("dotenv").config();

async function monitor() {
  console.log("\n" + "=".repeat(80));
  console.log("BRIDGE BALANCE MONITOR");
  console.log("=".repeat(80) + "\n");

  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);

  const sourceToken = await ethers.getContractAt(
    "SourceToken",
    process.env.CHAIN1_TOKEN_ADDRESS,
    chain1Provider
  );

  const bridgeEth = await ethers.getContractAt(
    "BridgeEthereum",
    process.env.CHAIN1_BRIDGE_ADDRESS,
    chain1Provider
  );

  const wrappedToken = await ethers.getContractAt(
    "WrappedToken",
    process.env.CHAIN2_TOKEN_ADDRESS,
    chain2Provider
  );

  const bridgeBSC = await ethers.getContractAt(
    "BridgeBSC",
    process.env.CHAIN2_BRIDGE_ADDRESS,
    chain2Provider
  );

  const [deployer] = await ethers.getSigners();

  // Chain 1 Data
  console.log("📍 CHAIN 1 (Ethereum)");
  console.log("-".repeat(80));

  const totalSupply = await sourceToken.totalSupply();
  const lockedInBridge = await bridgeEth.getLockedBalance();
  const circulating = totalSupply - lockedInBridge;
  const userBalance1 = await sourceToken.balanceOf(deployer.address);
  const nonce1 = await bridgeEth.nonce();
  const paused1 = await bridgeEth.paused();

  console.log(`Total Supply:           ${ethers.formatEther(totalSupply)} BST`);
  console.log(`Locked in Bridge:       ${ethers.formatEther(lockedInBridge)} BST`);
  console.log(`Circulating:            ${ethers.formatEther(circulating)} BST`);
  console.log(`Your Balance:           ${ethers.formatEther(userBalance1)} BST`);
  console.log(`Bridge Nonce:           ${nonce1}`);
  console.log(`Bridge Paused:          ${paused1}`);

  // Chain 2 Data
  console.log("\n📍 CHAIN 2 (BSC)");
  console.log("-".repeat(80));

  const wrappedSupply = await wrappedToken.totalSupply();
  const userBalance2 = await wrappedToken.balanceOf(deployer.address);
  const nonce2 = await bridgeBSC.nonce();
  const paused2 = await bridgeBSC.paused();

  console.log(`Total Wrapped Supply:   ${ethers.formatEther(wrappedSupply)} wBST`);
  console.log(`Your Balance:           ${ethers.formatEther(userBalance2)} wBST`);
  console.log(`Bridge Nonce:           ${nonce2}`);
  console.log(`Bridge Paused:          ${paused2}`);

  // Supply Conservation Check
  console.log("\n📊 SUPPLY CONSERVATION CHECK");
  console.log("-".repeat(80));

  const difference = wrappedSupply - lockedInBridge;
  const percentDiff =
    lockedInBridge > 0n
      ? Number((difference * 10000n) / lockedInBridge) / 100
      : 0;

  console.log(`Expected Wrapped:       ${ethers.formatEther(lockedInBridge)} wBST`);
  console.log(`Actual Wrapped:         ${ethers.formatEther(wrappedSupply)} wBST`);
  console.log(`Difference:             ${ethers.formatEther(difference)} wBST`);

  if (difference === 0n) {
    console.log(`\n✅ PERFECT! Supply is conserved.`);
    console.log(`   Locked on Chain 1 = Wrapped on Chain 2`);
  } else {
    console.log(`\n⚠️  MISMATCH DETECTED! (${percentDiff}%)`);
    if (Math.abs(percentDiff) < 0.01) {
      console.log(`   Likely due to rounding or pending transactions`);
    } else {
      console.log(`   This may indicate a problem - investigate immediately!`);
    }
  }

  // Bridge Health
  console.log("\n💚 BRIDGE HEALTH");
  console.log("-".repeat(80));

  console.log(`Supply Conserved:       ${difference === 0n ? "✅" : "❌"}`);
  console.log(`Chain 1 Operating:      ${!paused1 ? "✅" : "⚠️ "}`);
  console.log(`Chain 2 Operating:      ${!paused2 ? "✅" : "⚠️ "}`);

  console.log(
    `\nOverall Status:         ${
      difference === 0n && !paused1 && !paused2 ? "🟢 HEALTHY" : "🟡 CHECK ISSUES"
    }`
  );

  console.log("\n" + "=".repeat(80) + "\n");
}

monitor()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Health Check

**File**: `monitoring/scripts/health-check.js`

```javascript
const { ethers } = require("hardhat");
require("dotenv").config();

async function healthCheck() {
  console.log("\n" + "=".repeat(80));
  console.log("BRIDGE HEALTH CHECK");
  console.log("=".repeat(80) + "\n");

  const checks = [];

  // Check 1: Environment variables
  console.log("1️⃣  Checking environment variables...");
  const requiredEnvVars = [
    "CHAIN1_RPC",
    "CHAIN2_RPC",
    "CHAIN1_TOKEN_ADDRESS",
    "CHAIN1_BRIDGE_ADDRESS",
    "CHAIN2_TOKEN_ADDRESS",
    "CHAIN2_BRIDGE_ADDRESS"
  ];

  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    console.log(`   ❌ Missing: ${missingVars.join(", ")}`);
    checks.push(false);
  } else {
    console.log(`   ✅ All environment variables present`);
    checks.push(true);
  }

  // Check 2: Chain 1 connectivity
  console.log("\n2️⃣  Checking Chain 1 connectivity...");
  try {
    const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
    const blockNumber = await chain1Provider.getBlockNumber();
    console.log(`   ✅ Connected (block: ${blockNumber})`);
    checks.push(true);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Check 3: Chain 2 connectivity
  console.log("\n3️⃣  Checking Chain 2 connectivity...");
  try {
    const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
    const blockNumber = await chain2Provider.getBlockNumber();
    console.log(`   ✅ Connected (block: ${blockNumber})`);
    checks.push(true);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Check 4: Contract deployments
  console.log("\n4️⃣  Checking contract deployments...");
  try {
    const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
    const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);

    const code1 = await chain1Provider.getCode(process.env.CHAIN1_BRIDGE_ADDRESS);
    const code2 = await chain2Provider.getCode(process.env.CHAIN2_BRIDGE_ADDRESS);

    if (code1 === "0x" || code2 === "0x") {
      console.log(`   ❌ Contracts not deployed`);
      checks.push(false);
    } else {
      console.log(`   ✅ All contracts deployed`);
      checks.push(true);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Check 5: Bridge configuration
  console.log("\n5️⃣  Checking bridge configuration...");
  try {
    const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
    const wrappedToken = await ethers.getContractAt(
      "WrappedToken",
      process.env.CHAIN2_TOKEN_ADDRESS,
      chain2Provider
    );

    const bridgeSet = await wrappedToken.bridgeSet();
    const bridgeAddress = await wrappedToken.bridge();

    if (!bridgeSet || bridgeAddress !== process.env.CHAIN2_BRIDGE_ADDRESS) {
      console.log(`   ❌ Bridge not properly configured`);
      checks.push(false);
    } else {
      console.log(`   ✅ Bridge properly configured`);
      checks.push(true);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    checks.push(false);
  }

  // Summary
  const passed = checks.filter((c) => c).length;
  const total = checks.length;

  console.log("\n" + "=".repeat(80));
  console.log(`RESULTS: ${passed}/${total} checks passed`);
  console.log("=".repeat(80));

  if (passed === total) {
    console.log("\n✅ All health checks passed! System is operational.\n");
    process.exit(0);
  } else {
    console.log("\n❌ Some health checks failed. Review errors above.\n");
    process.exit(1);
  }
}

healthCheck().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

## ✅ Testing Phase 6

```bash
# Monitor bridge state
pnpm run monitor

# Check system health
pnpm run health
```

## 📊 Production Considerations

### Security Enhancements Needed

1. **Multi-Signature Validation**
   - Replace single owner with multi-sig wallet
   - Require multiple relayers to sign off on operations

2. **Rate Limiting**
   - Implement hourly/daily transaction limits
   - Prevent abuse and limit exposure

3. **Oracle Integration**
   - Add Chainlink price feeds for USD limits
   - External validation of transactions

4. **Audit**
   - Professional security audit required
   - Bug bounty program
   - Formal verification

### Deployment Checklist

**Pre-Production:**
- [ ] Security audit completed
- [ ] Penetration testing done
- [ ] Bug bounty program launched
- [ ] Insurance coverage secured
- [ ] Multi-sig setup (3/5 or 4/7)
- [ ] Emergency procedures documented
- [ ] Monitoring and alerting configured

**Production Deployment:**
- [ ] Deploy to testnet first
- [ ] Run 2+ weeks on testnet
- [ ] Gradual mainnet deployment
- [ ] Start with low limits
- [ ] 24/7 monitoring active
- [ ] On-call rotation established

### Operational Costs

| Service | Monthly Cost |
|---------|--------------|
| RPC Nodes (2x) | $500-2000 |
| Relayer Server | $100-300 |
| Monitoring | $50-200 |
| **Total** | **$650-2500/mo** |

**One-time:** Security audit $50k-200k

## 🎯 Success Criteria

- [ ] Balance monitor working
- [ ] Health checks passing
- [ ] Supply conservation verified
- [ ] Production checklist reviewed
- [ ] System fully operational

## 🎓 What You've Built

Congratulations! You now have:

1. ✅ **4 Production-Grade Smart Contracts**
2. ✅ **Automated Deployment System**
3. ✅ **Comprehensive Test Suite**
4. ✅ **Live Relayer Service**
5. ✅ **Monitoring & Health Checks**
6. ✅ **Cross-Chain Token Bridge**

## 📚 Next Steps

1. **Experiment**: Modify parameters, add features
2. **Learn**: Study each component in depth
3. **Extend**: Add more chains, token types
4. **Deploy**: Move to testnets (Sepolia, BSC Testnet)
5. **Build**: Create a frontend UI

## 🔗 Resources

- [Hardhat Docs](https://hardhat.org)
- [OpenZeppelin](https://docs.openzeppelin.com)
- [ethers.js v6](https://docs.ethers.org/v6/)
- [Bridge Security Best Practices](https://www.immunebytes.com/blog/bridge-security/)

---

**Phase 6 Complete!** ✅

**🎉 Congratulations!** You've successfully built a production-ready cross-chain token bridge!

This is a portfolio-worthy project demonstrating:
- Smart contract development
- Cross-chain architecture
- Security best practices
- Off-chain service development
- Production operations

**Time to completion**: 2-3 hours
**What you've learned**: Bridge fundamentals, Solidity, ethers.js, testing, deployment, operations

---

**Ready to go further?**
- Deploy to testnet
- Add frontend UI
- Support multiple tokens
- Implement multi-sig
- Launch on mainnet (with proper security)
