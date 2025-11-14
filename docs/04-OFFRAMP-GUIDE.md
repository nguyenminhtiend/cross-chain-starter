# Off-Ramp: Crypto to Fiat

**Difficulty:** ⭐⭐⭐⭐⭐ (Hardest)
**Knowledge Reuse:** 30% from your bridge project
**Time Estimate:** 4-6 weeks

---

## Overview

Off-ramp allows users to sell crypto and receive fiat in their bank account.

**Example Flow:**
```
User burns 100 USDC
  → Backend detects burn event
  → Initiate bank transfer
  → User receives $100 in bank account (1-5 days)
```

**Why it's harder than on-ramp:**
- Banks scrutinize crypto → fiat more than fiat → crypto
- Slower processing (banks take days, not minutes)
- More compliance requirements
- Liquidity management complexity

---

## Knowledge Mapping

### What You Can Reuse ✅

| Your Bridge Concept | Off-Ramp Equivalent | Similarity |
|---------------------|---------------------|------------|
| **Burn event → Unlock** | Burn event → Bank transfer | 85% |
| **Event listening** | Listen for Burn events | 100% |
| **Nonce tracking** | Track processed burns | 95% |
| **State management** | Track payout status | 90% |
| **Relayer pattern** | Backend service | 80% |

### Flow Comparison

```javascript
// YOUR BRIDGE FLOW
Burn on Chain2
  → Relayer listens
  → Verify burn
  → Unlock on Chain1

// OFF-RAMP FLOW (almost identical!)
Burn on blockchain
  → Backend listens
  → Verify burn
  → Send fiat to bank
```

---

## Architecture

### Your Bridge Architecture
```
┌──────────────┐
│  Chain 2     │ User burns wrapped tokens
└──────┬───────┘
       │ Burn event emitted
       ↓
┌──────────────┐
│  Relayer     │ Listens for Burn events
└──────┬───────┘
       │ Verifies on-chain
       ↓
┌──────────────┐
│  Chain 1     │ Unlocks original tokens
└──────────────┘
```

### Off-Ramp Architecture (Same Pattern!)
```
┌──────────────┐
│  Blockchain  │ User burns USDC
└──────┬───────┘
       │ Burn event emitted
       ↓
┌──────────────┐
│  Backend     │ Listens for Burn events (like your relayer!)
└──────┬───────┘
       │ Verifies on-chain + compliance
       ↓
┌──────────────┐
│  Bank API    │ Initiates transfer (like unlock!)
└──────────────┘
```

---

## Key Concepts

### 1. Burn Event Listening (SAME AS YOUR BRIDGE!)

```javascript
// YOUR BRIDGE: Listen for Burn events
// File: relayer/burn-handler.js

destBridge.on('Burn', async (from, amount, nonce) => {
    // Verify burn
    const verified = await verifyBurn(nonce);

    // Unlock tokens
    await sourceBridge.unlock(from, amount, nonce);
});

// OFF-RAMP: Listen for Burn events (IDENTICAL STRUCTURE!)
// File: backend/offramp-listener.js

const { ethers } = require('ethers');

class OffRampListener {
    constructor(tokenContract, offRampService) {
        this.token = tokenContract;
        this.offRampService = offRampService;
    }

    /**
     * Start listening (EXACTLY LIKE YOUR BRIDGE RELAYER!)
     */
    async start() {
        console.log('Starting off-ramp listener...');

        // Listen for Burn events (SAME AS YOUR BRIDGE!)
        this.token.on('Burn', async (from, amount, nonce, bankInfo) => {
            await this.handleBurnEvent(from, amount, nonce, bankInfo);
        });

        console.log('Listening for Burn events...');
    }

    /**
     * Handle burn event (SAME PATTERN as handleLockEvent!)
     *
     * Your Bridge:
     * 1. Check if processed
     * 2. Wait for finality
     * 3. Verify event
     * 4. Unlock tokens
     *
     * Off-Ramp:
     * 1. Check if processed (SAME)
     * 2. Wait for finality (SAME)
     * 3. Verify event + compliance (EXTENDED)
     * 4. Send fiat (SAME PATTERN)
     */
    async handleBurnEvent(from, amount, nonce, bankInfo) {
        console.log('Burn event detected:', { from, amount: amount.toString(), nonce });

        try {
            // SAME AS YOUR BRIDGE: Check if processed
            const processed = await this.offRampService.isProcessed(nonce);
            if (processed) {
                console.log('Nonce already processed:', nonce);
                return;
            }

            // SAME AS YOUR BRIDGE: Wait for finality
            const event = await this.token.queryFilter('Burn');
            const burnEvent = event.find(e => e.args.nonce.eq(nonce));

            if (!burnEvent) {
                console.log('Burn event not found');
                return;
            }

            const currentBlock = await this.token.provider.getBlockNumber();
            const confirmations = currentBlock - burnEvent.blockNumber;

            if (confirmations < 12) {
                console.log(`Waiting for finality: ${confirmations}/12 blocks`);
                return;
            }

            // NEW: Verify user is KYC'd
            const kycApproved = await this.offRampService.verifyKYC(from);
            if (!kycApproved) {
                console.log('User not KYC verified:', from);
                // Could refund crypto here
                return;
            }

            // NEW: Screen address for compliance
            const complianceCheck = await this.offRampService.screenAddress(from);
            if (!complianceCheck.approved) {
                console.log('Address failed compliance:', complianceCheck.reason);
                // DO NOT process - could be sanctioned!
                return;
            }

            // SAME PATTERN AS UNLOCK: Process off-ramp
            await this.offRampService.processBurn({
                from,
                amount,
                nonce,
                bankInfo,
                txHash: burnEvent.transactionHash
            });

        } catch (error) {
            console.error('Failed to handle burn event:', error);
        }
    }
}

module.exports = OffRampListener;
```

### 2. Off-Ramp Service (Like your Bridge Executor)

```javascript
// backend/offramp-service.js
// EXTENDS the pattern from your bridge unlock logic

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { ethers } = require('ethers');

class OffRampService {
    constructor(database, complianceService) {
        this.db = database;
        this.compliance = complianceService;
    }

    /**
     * Process burn and initiate payout
     * (SAME PATTERN as your unlock function!)
     *
     * Your Bridge unlock:
     * 1. Verify not processed
     * 2. Transfer tokens
     * 3. Mark processed
     *
     * Off-Ramp processBurn:
     * 1. Verify not processed (SAME)
     * 2. Create payout (SAME PATTERN)
     * 3. Mark processed (SAME)
     */
    async processBurn({ from, amount, nonce, bankInfo, txHash }) {
        console.log('Processing burn:', { from, amount: amount.toString(), nonce });

        // SAME AS YOUR BRIDGE: Check if processed
        const existing = await this.db.offramps.findOne({ nonce: nonce.toString() });
        if (existing && existing.status === 'completed') {
            console.log('Already processed:', nonce);
            return;
        }

        // Get user's bank details
        const user = await this.db.users.findOne({ walletAddress: from });
        if (!user || !user.stripeConnectedAccountId) {
            throw new Error('User bank details not found');
        }

        // Convert to USD (assuming 1:1 for USDC)
        const usdAmount = ethers.utils.formatUnits(amount, 18);
        const cents = Math.floor(parseFloat(usdAmount) * 100);

        try {
            // Check liquidity (NEW - ensure we have fiat available)
            const hasLiquidity = await this.checkLiquidity(cents);
            if (!hasLiquidity) {
                throw new Error('Insufficient liquidity');
            }

            // Create payout (SAME PATTERN as unlock!)
            console.log(`Creating payout: $${usdAmount} to ${user.stripeConnectedAccountId}`);

            const payout = await stripe.payouts.create({
                amount: cents,
                currency: 'usd',
                destination: user.stripeConnectedAccountId,
                metadata: {
                    nonce: nonce.toString(),
                    burnTxHash: txHash,
                    walletAddress: from
                }
            });

            console.log('Payout created:', payout.id);

            // SAME AS YOUR BRIDGE: Mark as processed
            await this.db.offramps.insertOne({
                nonce: nonce.toString(),
                walletAddress: from,
                amount: usdAmount,
                payoutId: payout.id,
                status: 'pending',
                burnTxHash: txHash,
                createdAt: new Date()
            });

            // Listen for payout completion
            await this.trackPayout(payout.id, nonce.toString());

        } catch (error) {
            console.error('Payout failed:', error);

            await this.db.offramps.updateOne(
                { nonce: nonce.toString() },
                {
                    $set: {
                        status: 'failed',
                        error: error.message,
                        failedAt: new Date()
                    }
                },
                { upsert: true }
            );

            throw error;
        }
    }

    /**
     * Track payout until complete
     * (NEW - banks are slow, need to poll)
     */
    async trackPayout(payoutId, nonce) {
        const maxAttempts = 100; // ~10 days
        let attempts = 0;

        const checkStatus = async () => {
            try {
                const payout = await stripe.payouts.retrieve(payoutId);

                console.log(`Payout ${payoutId} status: ${payout.status}`);

                if (payout.status === 'paid') {
                    // Mark as completed (SAME AS YOUR BRIDGE!)
                    await this.db.offramps.updateOne(
                        { nonce },
                        {
                            $set: {
                                status: 'completed',
                                completedAt: new Date()
                            }
                        }
                    );

                    console.log('Off-ramp completed:', nonce);
                    return;

                } else if (payout.status === 'failed' || payout.status === 'canceled') {
                    await this.db.offramps.updateOne(
                        { nonce },
                        {
                            $set: {
                                status: 'failed',
                                error: 'Payout failed',
                                failedAt: new Date()
                            }
                        }
                    );

                    console.error('Payout failed:', payoutId);
                    return;

                } else if (attempts < maxAttempts) {
                    // Still pending, check again in 1 hour
                    attempts++;
                    setTimeout(checkStatus, 60 * 60 * 1000);
                } else {
                    console.error('Payout tracking timeout:', payoutId);
                }

            } catch (error) {
                console.error('Failed to check payout status:', error);
            }
        };

        // Start tracking
        setTimeout(checkStatus, 60 * 1000); // Check after 1 minute
    }

    /**
     * Check if we have enough fiat liquidity
     * (NEW - prevent over-committing)
     */
    async checkLiquidity(amountCents) {
        // Get Stripe balance
        const balance = await stripe.balance.retrieve();
        const available = balance.available[0].amount; // USD cents

        // Get pending payouts
        const pending = await this.db.offramps.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const pendingTotal = pending.length > 0 ? pending[0].total * 100 : 0;

        // Ensure we have enough after pending
        const MIN_RESERVE = 10000 * 100; // Keep $10k reserve
        return available - pendingTotal - amountCents >= MIN_RESERVE;
    }

    /**
     * Verify user KYC status
     * (REQUIRED for off-ramp)
     */
    async verifyKYC(walletAddress) {
        const user = await this.db.users.findOne({ walletAddress });

        if (!user) {
            return false;
        }

        // Require higher KYC level for off-ramp
        return user.kycLevel >= 2;
    }

    /**
     * Screen address for sanctions/AML
     * (CRITICAL - more strict than on-ramp!)
     */
    async screenAddress(address) {
        try {
            // Use Chainalysis or similar service
            const response = await fetch('https://api.chainalysis.com/v1/screen', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.CHAINALYSIS_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ address })
            });

            const result = await response.json();

            // Check for sanctions
            if (result.isSanctioned) {
                return {
                    approved: false,
                    reason: 'Address is sanctioned'
                };
            }

            // Check risk score
            if (result.riskScore > 7) {
                return {
                    approved: false,
                    reason: 'High risk score'
                };
            }

            // Check transaction history
            const txHistory = await this.analyzeTransactions(address);
            if (txHistory.hasSuspiciousActivity) {
                return {
                    approved: false,
                    reason: 'Suspicious transaction history'
                };
            }

            return { approved: true };

        } catch (error) {
            console.error('Compliance screening failed:', error);
            // Fail closed - deny if screening fails
            return {
                approved: false,
                reason: 'Screening service unavailable'
            };
        }
    }

    /**
     * Analyze transaction history
     * (NEW - source of funds verification)
     */
    async analyzeTransactions(address) {
        // Get recent transactions
        const etherscan = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}`;
        const response = await fetch(etherscan);
        const data = await response.json();

        const transactions = data.result || [];

        // Check for mixer/tornado cash interactions
        const mixerAddresses = [
            '0x...', // Tornado Cash
            // Add known mixer addresses
        ];

        const hasMixerInteraction = transactions.some(tx =>
            mixerAddresses.includes(tx.to) || mixerAddresses.includes(tx.from)
        );

        // Check for large sudden deposits
        const recentLargeDeposits = transactions
            .filter(tx => tx.timeStamp > Date.now() / 1000 - 86400) // Last 24h
            .filter(tx => parseFloat(tx.value) > 1000 * 1e18); // > 1000 tokens

        return {
            hasSuspiciousActivity: hasMixerInteraction || recentLargeDeposits.length > 0,
            details: {
                mixerInteraction: hasMixerInteraction,
                recentLargeDeposits: recentLargeDeposits.length
            }
        };
    }

    /**
     * Check if nonce is processed (SAME AS YOUR BRIDGE!)
     */
    async isProcessed(nonce) {
        const existing = await this.db.offramps.findOne({
            nonce: nonce.toString(),
            status: { $in: ['completed', 'pending'] }
        });
        return !!existing;
    }
}

module.exports = OffRampService;
```

### 3. Smart Contract Enhancement

```solidity
// contracts/OffRampToken.sol
// EXTENDS your existing token with burn functionality

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OffRampToken is ERC20, Ownable {
    uint256 public burnNonce;

    // Track processed burns (SAME AS YOUR BRIDGE NONCES!)
    mapping(uint256 => bool) public processedBurns;

    event Burn(
        address indexed from,
        uint256 amount,
        uint256 indexed nonce,
        string bankInfo,
        uint256 timestamp
    );

    constructor() ERC20("USD Coin", "USDC") {}

    /**
     * Burn tokens for off-ramp
     * (Similar to your lock function!)
     *
     * Your Bridge lock:
     *   Lock tokens + emit event
     *
     * Off-Ramp burn:
     *   Burn tokens + emit event (SAME PATTERN!)
     */
    function burnForOffRamp(
        uint256 amount,
        string memory bankInfo  // Could be Stripe account ID
    ) external {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Burn tokens
        _burn(msg.sender, amount);

        // Increment nonce (SAME AS YOUR BRIDGE!)
        uint256 nonce = burnNonce++;

        // Emit event (SAME AS YOUR BRIDGE!)
        emit Burn(msg.sender, amount, nonce, bankInfo, block.timestamp);
    }

    /**
     * Mint tokens (for on-ramp)
     * (SAME AS YOUR BRIDGE MINT!)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * Emergency: Refund failed off-ramp
     * If bank transfer fails, refund the burned tokens
     */
    function refundFailedOffRamp(
        address to,
        uint256 amount,
        uint256 burnNonce
    ) external onlyOwner {
        require(!processedBurns[burnNonce], "Already refunded");

        // Mint tokens back to user
        _mint(to, amount);

        // Mark as processed
        processedBurns[burnNonce] = true;
    }
}
```

### 4. User Setup Flow

```javascript
// backend/user-setup.js
// NEW - users must link bank account before off-ramp

class UserSetupService {
    /**
     * Create Stripe connected account for user
     * (Required to receive payouts)
     */
    async createConnectedAccount(userId, walletAddress, bankDetails) {
        try {
            // Create Stripe connected account
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US',
                email: bankDetails.email,
                capabilities: {
                    transfers: { requested: true }
                },
                metadata: {
                    userId,
                    walletAddress
                }
            });

            // Create account link for user to complete setup
            const accountLink = await stripe.accountLinks.create({
                account: account.id,
                refresh_url: `${process.env.APP_URL}/reauth`,
                return_url: `${process.env.APP_URL}/return`,
                type: 'account_onboarding',
            });

            // Save to database
            await database.users.updateOne(
                { walletAddress },
                {
                    $set: {
                        stripeConnectedAccountId: account.id,
                        bankSetupUrl: accountLink.url,
                        bankSetupAt: new Date()
                    }
                },
                { upsert: true }
            );

            return {
                accountId: account.id,
                setupUrl: accountLink.url
            };

        } catch (error) {
            console.error('Failed to create connected account:', error);
            throw error;
        }
    }

    /**
     * Check if user can off-ramp
     */
    async canOffRamp(walletAddress) {
        const user = await database.users.findOne({ walletAddress });

        if (!user) {
            return {
                allowed: false,
                reason: 'User not found'
            };
        }

        if (!user.stripeConnectedAccountId) {
            return {
                allowed: false,
                reason: 'Bank account not linked'
            };
        }

        if (user.kycLevel < 2) {
            return {
                allowed: false,
                reason: 'KYC verification required'
            };
        }

        // Check account status
        const account = await stripe.accounts.retrieve(user.stripeConnectedAccountId);

        if (!account.payouts_enabled) {
            return {
                allowed: false,
                reason: 'Bank account setup incomplete'
            };
        }

        return { allowed: true };
    }
}

module.exports = UserSetupService;
```

### 5. Frontend

```javascript
// frontend/src/components/OffRamp.jsx

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function OffRamp({ tokenContract, walletAddress }) {
    const [amount, setAmount] = useState('');
    const [bankLinked, setBankLinked] = useState(false);
    const [setupUrl, setSetupUrl] = useState('');

    useEffect(() => {
        checkBankStatus();
    }, [walletAddress]);

    async function checkBankStatus() {
        const response = await fetch(`/api/user/bank-status?wallet=${walletAddress}`);
        const { linked, setupUrl } = await response.json();

        setBankLinked(linked);
        setSetupUrl(setupUrl);
    }

    async function handleBurn() {
        if (!bankLinked) {
            alert('Please link your bank account first');
            return;
        }

        try {
            // Burn tokens (SAME PATTERN as calling your bridge!)
            const burnAmount = ethers.utils.parseUnits(amount, 18);

            const tx = await tokenContract.burnForOffRamp(
                burnAmount,
                '' // Bank info already stored
            );

            console.log('Burn transaction:', tx.hash);
            await tx.wait();

            alert('Off-ramp initiated! Fiat will arrive in 1-5 business days.');

        } catch (error) {
            console.error('Burn failed:', error);
            alert('Failed to initiate off-ramp');
        }
    }

    if (!bankLinked) {
        return (
            <div>
                <h2>Link Bank Account</h2>
                <p>You need to link a bank account before selling crypto.</p>
                <a href={setupUrl} target="_blank">
                    <button>Link Bank Account</button>
                </a>
            </div>
        );
    }

    return (
        <div>
            <h2>Sell Crypto</h2>

            <input
                type="number"
                placeholder="Amount (USDC)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
            />

            <button onClick={handleBurn}>
                Sell {amount} USDC
            </button>

            <p>⚠️ Fiat will arrive in your bank account in 1-5 business days</p>
        </div>
    );
}

export default OffRamp;
```

---

## Testing

```javascript
// test/offramp.test.js

describe('Off-Ramp', function() {
    let offRampService, tokenContract, user;

    before(async function() {
        [user] = await ethers.getSigners();

        // Deploy token (SAME AS YOUR BRIDGE TESTS!)
        const Token = await ethers.getContractFactory('OffRampToken');
        tokenContract = await Token.deploy();

        // Mint tokens to user
        await tokenContract.mint(user.address, ethers.utils.parseUnits('1000', 18));

        // Setup user bank account
        await setupUserBankAccount(user.address);

        offRampService = new OffRampService(database, complianceService);
    });

    it('Should process off-ramp after burn', async function() {
        const amount = ethers.utils.parseUnits('100', 18);

        // Burn tokens (SAME AS YOUR BRIDGE TEST FLOW!)
        const tx = await tokenContract.connect(user).burnForOffRamp(amount, '');
        await tx.wait();

        // Wait for event processing
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify payout was created
        const offramp = await database.offramps.findOne({
            walletAddress: user.address
        });

        expect(offramp).to.exist;
        expect(offramp.status).to.equal('pending');
    });

    it('Should not process sanctioned address', async function() {
        // Mock sanctioned address
        const sanctionedUser = '0xSanctioned...';

        const canProcess = await offRampService.screenAddress(sanctionedUser);

        expect(canProcess.approved).to.be.false;
    });
});
```

---

## Key Challenges & Solutions

### Challenge 1: Banks Are Slow

**Problem:** Crypto burns instantly, but bank transfers take days

**Solution:** Async tracking

```javascript
// Don't wait for bank transfer to complete
// Track status separately and notify user when done

await processBurn(); // Initiates transfer
await trackPayout(); // Polls until complete (days later)
```

### Challenge 2: Liquidity Management

**Problem:** Need fiat reserves to pay users

**Solution:** Pre-fund and monitor

```javascript
// Maintain fiat buffer
const MIN_RESERVE = 100000; // $100k

async function ensureLiquidity() {
    const balance = await stripe.balance.retrieve();

    if (balance.available[0].amount < MIN_RESERVE) {
        await alert('Low liquidity! Need to top up');
    }
}
```

### Challenge 3: Compliance

**Problem:** Banks require source of funds verification

**Solution:** Address screening + tx analysis

```javascript
// Screen every address before processing
const screening = await chainalysis.screen(address);

if (screening.isSanctioned || screening.riskScore > 7) {
    // DO NOT process
}
```

---

## Deployment Checklist

- [ ] Deploy OffRampToken contract
- [ ] Set up Stripe Connected Accounts
- [ ] Integrate compliance screening (Chainalysis)
- [ ] Set up bank account for liquidity
- [ ] Configure webhook handlers
- [ ] Test with small amounts first
- [ ] Set up monitoring/alerts
- [ ] Implement refund mechanism for failed transfers

---

## Resources

- [Stripe Payouts](https://stripe.com/docs/payouts)
- [Stripe Connected Accounts](https://stripe.com/docs/connect)
- [Chainalysis Sanctions Screening](https://www.chainalysis.com/)
- [Circle USDC Redemption](https://developers.circle.com/docs/redeem-usdc) (study their flow)
- [Your Bridge Code](../relayer/) - Burn event handling is identical!

---

**Key Takeaway:** Off-ramp is your bridge's Burn → Unlock flow, but sending fiat instead of unlocking crypto. The core event-driven pattern is the same, but with added compliance and liquidity management!
