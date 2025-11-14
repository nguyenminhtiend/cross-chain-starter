# Virtual Card: Crypto Debit Card

**Difficulty:** ⭐⭐⭐⭐⭐ (Hardest)
**Knowledge Reuse:** 40% from your bridge project
**Time Estimate:** 4-8 weeks

---

## Overview

Virtual card lets users spend crypto anywhere Visa/Mastercard is accepted. Card swipes trigger real-time crypto → fiat conversion.

**Example Flow:**
```
User has 1000 USDC in wallet
User swipes card at Starbucks ($5)
Backend: Burn 5 USDC → Convert to $5 fiat → Settle with Visa
```

**Why it's hardest:**
- Real-time performance (<500ms response)
- Complex state management (off-chain + on-chain)
- Multiple APIs (card processor, blockchain, compliance)
- Financial regulations

---

## Knowledge Mapping

### What You Can Reuse ✅

| Your Bridge Concept | Virtual Card Equivalent | Similarity |
|---------------------|------------------------|------------|
| **Event-driven architecture** | Card authorization = event | 70% |
| **State management** | Track card transactions | 60% |
| **Idempotency (nonce tracking)** | Don't charge twice | 90% |
| **Real-time processing** | Process events quickly | 50% |
| **Balance tracking** | Check user balance | 70% |

### What's Different 🎓

| Aspect | Your Bridge | Virtual Card |
|--------|-------------|--------------|
| **Response Time** | Minutes (block time) | <500ms (card authorization) |
| **State** | On-chain only | Off-chain + on-chain |
| **Finality** | Wait 12 blocks | Instant decision |
| **Reversibility** | Immutable | Can be reversed |

---

## Architecture

### Your Bridge Architecture
```
┌──────────────┐
│  Lock Event  │ Emitted on-chain
└──────┬───────┘
       │ ~30 seconds to process
       ↓
┌──────────────┐
│  Relayer     │ Processes asynchronously
└──────┬───────┘
       │ Can take time to verify
       ↓
┌──────────────┐
│  Mint        │ Execute when ready
└──────────────┘
```

### Virtual Card Architecture (Real-Time!)
```
┌──────────────┐
│  Card Swipe  │ User swipes at merchant
└──────┬───────┘
       │ MUST respond in <500ms!
       ↓
┌──────────────┐
│  Backend     │ Check balance (cached!)
│              │ Approve/Decline instantly
└──────┬───────┘
       │ After approval, process async
       ↓
┌──────────────┐
│  Blockchain  │ Settle on-chain later
└──────────────┘
```

**Key Difference:** Two-phase approach
1. **Phase 1 (Real-time):** Instant approve/decline using cached state
2. **Phase 2 (Async):** Settle on-chain in background

---

## Key Concepts

### 1. Real-Time Authorization (<500ms!)

**Your bridge can't help here** - blockchain is too slow for card auth.

**Solution:** Off-chain balance cache

```javascript
// YOUR BRIDGE: Always check on-chain (slow)
// File: relayer/balance-checker.js

async function checkBalance(address) {
    // This takes 200-500ms (too slow for cards!)
    const balance = await token.balanceOf(address);
    return balance;
}

// VIRTUAL CARD: Cache balance (fast!)
// File: backend/balance-manager.js

const redis = require('redis');
const client = redis.createClient();

class BalanceManager {
    /**
     * Get balance (MUST be <50ms!)
     *
     * Your Bridge: Check on-chain
     * Virtual Card: Check cache (instant!)
     */
    async getBalance(userId) {
        // Check cache first (<1ms!)
        const cached = await client.get(`balance:${userId}`);

        if (cached) {
            return parseFloat(cached);
        }

        // Fallback to on-chain (slow, only if cache miss)
        const onchainBalance = await token.balanceOf(userAddress);
        const balance = ethers.utils.formatUnits(onchainBalance, 18);

        // Cache for 60 seconds
        await client.setEx(`balance:${userId}`, 60, balance);

        return parseFloat(balance);
    }

    /**
     * Update balance (optimistic update)
     *
     * Similar to your nonce tracking,
     * but we update immediately, sync on-chain later
     */
    async updateBalance(userId, delta) {
        // Optimistic update in cache
        const current = await this.getBalance(userId);
        const newBalance = current + delta;

        await client.setEx(`balance:${userId}`, 300, newBalance.toString());

        // Queue on-chain sync (async)
        await this.syncQueue.add({
            userId,
            delta,
            timestamp: Date.now()
        });

        return newBalance;
    }

    /**
     * Sync cache with on-chain reality
     * (Background job, similar to your relayer processing)
     */
    async syncBalances() {
        const users = await database.users.find({});

        for (const user of users) {
            const onchainBalance = await token.balanceOf(user.walletAddress);
            const balance = ethers.utils.formatUnits(onchainBalance, 18);

            await client.setEx(`balance:${user.id}`, 300, balance);
        }
    }
}

module.exports = BalanceManager;
```

### 2. Card Authorization Handler

```javascript
// backend/card-authorization.js
// Similar to your webhook handler, but MUCH faster!

const express = require('express');
const app = express();

class CardAuthorizationHandler {
    constructor(balanceManager, kycService) {
        this.balances = balanceManager;
        this.kyc = kycService;
    }

    /**
     * Handle card authorization (LIKE webhook handler, but fast!)
     *
     * Your webhook handler (on-ramp):
     * - Can take several seconds
     * - Verifies with Stripe API
     * - Mints tokens
     *
     * Card authorization:
     * - MUST respond in <500ms
     * - Use cached data only
     * - Process settlement later
     */
    async handleAuthorization(req, res) {
        const startTime = Date.now();
        const auth = req.body;

        console.log('Card authorization:', {
            amount: auth.amount,
            merchant: auth.merchant,
            cardId: auth.card_id
        });

        try {
            // Get user from card ID (cached!)
            const user = await this.getUserByCard(auth.card_id);

            if (!user) {
                return res.json({
                    approved: false,
                    reason: 'Card not found'
                });
            }

            // Check KYC (cached!)
            if (user.kycLevel < 1) {
                return res.json({
                    approved: false,
                    reason: 'KYC required'
                });
            }

            // Check balance (cached! <10ms)
            const balance = await this.balances.getBalance(user.id);
            const amountUSD = auth.amount / 100; // cents to dollars

            if (balance < amountUSD) {
                return res.json({
                    approved: false,
                    reason: 'Insufficient funds'
                });
            }

            // Check spending limits (cached!)
            const canSpend = await this.checkLimits(user.id, amountUSD);

            if (!canSpend.allowed) {
                return res.json({
                    approved: false,
                    reason: canSpend.reason
                });
            }

            // APPROVE! (Optimistic - settle later)
            await this.balances.updateBalance(user.id, -amountUSD);

            // Queue settlement (async, like your relayer!)
            await this.queueSettlement({
                userId: user.id,
                amount: amountUSD,
                authId: auth.id,
                merchant: auth.merchant,
                timestamp: Date.now()
            });

            const duration = Date.now() - startTime;
            console.log(`Authorization approved in ${duration}ms`);

            // MUST respond quickly!
            return res.json({
                approved: true
            });

        } catch (error) {
            console.error('Authorization failed:', error);

            const duration = Date.now() - startTime;
            console.log(`Authorization failed in ${duration}ms`);

            return res.json({
                approved: false,
                reason: 'System error'
            });
        }
    }

    /**
     * Get user by card ID (cached)
     */
    async getUserByCard(cardId) {
        // Check cache
        const cached = await redis.get(`card:${cardId}`);
        if (cached) {
            return JSON.parse(cached);
        }

        // Fallback to database
        const user = await database.users.findOne({
            'cards.id': cardId
        });

        if (user) {
            await redis.setEx(`card:${cardId}`, 300, JSON.stringify(user));
        }

        return user;
    }

    /**
     * Check spending limits (like nonce validation)
     */
    async checkLimits(userId, amount) {
        // Per-transaction limit
        const LIMITS = {
            perTransaction: 1000,  // $1k
            daily: 5000,          // $5k
            monthly: 20000        // $20k
        };

        if (amount > LIMITS.perTransaction) {
            return {
                allowed: false,
                reason: 'Transaction limit exceeded'
            };
        }

        // Get today's spending (cached!)
        const todayKey = `spending:${userId}:${this.getTodayKey()}`;
        const todaySpending = parseFloat(await redis.get(todayKey) || '0');

        if (todaySpending + amount > LIMITS.daily) {
            return {
                allowed: false,
                reason: 'Daily limit exceeded'
            };
        }

        // Update today's spending
        await redis.incrByFloat(todayKey, amount);
        await redis.expire(todayKey, 86400); // Expire after 24h

        return { allowed: true };
    }

    getTodayKey() {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    }

    /**
     * Queue settlement (SAME PATTERN as your relayer queue!)
     */
    async queueSettlement(settlement) {
        await settlementQueue.add(settlement);
    }
}

// Setup webhook endpoint
app.post('/webhook/card-auth', express.json(), async (req, res) => {
    const handler = new CardAuthorizationHandler(balanceManager, kycService);
    await handler.handleAuthorization(req, res);
});

module.exports = CardAuthorizationHandler;
```

### 3. Settlement Worker (Like Your Relayer!)

```javascript
// backend/settlement-worker.js
// EXACTLY LIKE your relayer pattern!

const { ethers } = require('ethers');

class SettlementWorker {
    constructor(tokenContract) {
        this.token = tokenContract;
    }

    /**
     * Process settlements in batches
     * (SAME PATTERN as your relayer processing events!)
     *
     * Your Relayer:
     * 1. Listen for events
     * 2. Batch process
     * 3. Execute on-chain
     *
     * Settlement Worker:
     * 1. Listen for settlements
     * 2. Batch process (SAME!)
     * 3. Burn tokens on-chain (SAME!)
     */
    async start() {
        // Process queue (similar to event processing)
        settlementQueue.process(async (job) => {
            await this.processSettlement(job.data);
        });

        // Batch settle every hour
        setInterval(() => {
            this.batchSettle();
        }, 60 * 60 * 1000);
    }

    /**
     * Process single settlement
     * (Similar to processing single Lock event)
     */
    async processSettlement(settlement) {
        console.log('Processing settlement:', settlement);

        // Check if already processed (SAME AS YOUR NONCE CHECK!)
        const existing = await database.settlements.findOne({
            authId: settlement.authId
        });

        if (existing && existing.status === 'completed') {
            console.log('Settlement already processed:', settlement.authId);
            return;
        }

        // Store pending settlement
        await database.settlements.insertOne({
            authId: settlement.authId,
            userId: settlement.userId,
            amount: settlement.amount,
            status: 'pending',
            createdAt: new Date()
        });

        console.log('Settlement queued:', settlement.authId);
    }

    /**
     * Batch settle on-chain
     * (EXACTLY LIKE batching transactions in your relayer!)
     */
    async batchSettle() {
        console.log('Running batch settlement...');

        // Get pending settlements
        const pending = await database.settlements.find({
            status: 'pending'
        }).toArray();

        if (pending.length === 0) {
            console.log('No pending settlements');
            return;
        }

        // Group by user (optimize gas)
        const grouped = this.groupByUser(pending);

        for (const [userId, settlements] of grouped) {
            await this.settleForUser(userId, settlements);
        }
    }

    /**
     * Settle for one user
     * (SAME PATTERN as your mint/burn operations!)
     */
    async settleForUser(userId, settlements) {
        const user = await database.users.findOne({ id: userId });

        if (!user) {
            console.error('User not found:', userId);
            return;
        }

        // Calculate total to burn
        const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
        const burnAmount = ethers.utils.parseUnits(totalAmount.toString(), 18);

        console.log(`Burning ${totalAmount} USDC for user ${userId}`);

        try {
            // Burn tokens (SAME AS YOUR BRIDGE BURN!)
            const tx = await this.token.burn(
                user.walletAddress,
                burnAmount
            );

            console.log('Burn transaction:', tx.hash);
            const receipt = await tx.wait();

            console.log('Burn confirmed:', receipt.transactionHash);

            // Mark all settlements as completed (SAME AS YOUR NONCE TRACKING!)
            await database.settlements.updateMany(
                {
                    authId: { $in: settlements.map(s => s.authId) }
                },
                {
                    $set: {
                        status: 'completed',
                        txHash: receipt.transactionHash,
                        completedAt: new Date()
                    }
                }
            );

            // Sync balance cache
            const newBalance = await this.token.balanceOf(user.walletAddress);
            await redis.setEx(
                `balance:${userId}`,
                300,
                ethers.utils.formatUnits(newBalance, 18)
            );

        } catch (error) {
            console.error('Batch settlement failed:', error);

            // Mark as failed (can retry)
            await database.settlements.updateMany(
                {
                    authId: { $in: settlements.map(s => s.authId) }
                },
                {
                    $set: {
                        status: 'failed',
                        error: error.message,
                        failedAt: new Date()
                    }
                }
            );
        }
    }

    groupByUser(settlements) {
        const grouped = new Map();

        for (const settlement of settlements) {
            const userId = settlement.userId;

            if (!grouped.has(userId)) {
                grouped.set(userId, []);
            }

            grouped.get(userId).push(settlement);
        }

        return grouped;
    }
}

module.exports = SettlementWorker;
```

### 4. Smart Contract

```solidity
// contracts/CardToken.sol
// EXTENDS your token with card-specific features

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CardToken is ERC20, Ownable {
    // Track card settlements (like your nonce tracking!)
    mapping(bytes32 => bool) public processedSettlements;

    event CardDeposit(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    event CardSettlement(
        address indexed user,
        uint256 amount,
        bytes32 indexed settlementId,
        uint256 timestamp
    );

    constructor() ERC20("Card USDC", "cUSDC") {}

    /**
     * Deposit tokens for card spending
     * (Like locking in your bridge!)
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        // Transfer to contract
        _transfer(msg.sender, address(this), amount);

        emit CardDeposit(msg.sender, amount, block.timestamp);
    }

    /**
     * Settle card transactions
     * (Like burn in your off-ramp!)
     *
     * Called by backend after batch settlement
     */
    function settle(
        address user,
        uint256 amount,
        bytes32 settlementId
    ) external onlyOwner {
        // Check if already processed (SAME AS YOUR NONCE CHECK!)
        require(!processedSettlements[settlementId], "Already settled");

        // Burn tokens
        _burn(address(this), amount);

        // Mark as processed (SAME AS YOUR BRIDGE!)
        processedSettlements[settlementId] = true;

        emit CardSettlement(user, amount, settlementId, block.timestamp);
    }

    /**
     * Emergency withdrawal
     * User can withdraw unspent balance
     */
    function withdraw(uint256 amount) external {
        require(balanceOf(address(this)) >= amount, "Insufficient balance");

        _transfer(address(this), msg.sender, amount);
    }

    /**
     * Get user's card balance
     * (Similar to your balance checks)
     */
    function cardBalance(address user) external view returns (uint256) {
        return balanceOf(address(this));
    }
}
```

### 5. Card Issuing Integration

```javascript
// backend/card-issuing.js
// NEW - integrate with Stripe Issuing or Marqeta

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class CardIssuingService {
    /**
     * Create virtual card for user
     */
    async createCard(userId, walletAddress) {
        try {
            // Create cardholder
            const cardholder = await stripe.issuing.cardholders.create({
                name: userId,
                email: `${userId}@example.com`,
                phone_number: '+18888888888',
                status: 'active',
                type: 'individual',
                billing: {
                    address: {
                        line1: '123 Main Street',
                        city: 'San Francisco',
                        state: 'CA',
                        postal_code: '94111',
                        country: 'US',
                    },
                },
            });

            // Create virtual card
            const card = await stripe.issuing.cards.create({
                cardholder: cardholder.id,
                currency: 'usd',
                type: 'virtual',
                spending_controls: {
                    spending_limits: [
                        {
                            amount: 100000, // $1k per day
                            interval: 'daily',
                        },
                    ],
                },
                metadata: {
                    userId,
                    walletAddress
                }
            });

            // Store in database
            await database.users.updateOne(
                { id: userId },
                {
                    $push: {
                        cards: {
                            id: card.id,
                            last4: card.last4,
                            status: card.status,
                            createdAt: new Date()
                        }
                    }
                }
            );

            // Cache card -> user mapping
            await redis.setEx(
                `card:${card.id}`,
                86400,
                JSON.stringify({ id: userId, walletAddress })
            );

            return card;

        } catch (error) {
            console.error('Failed to create card:', error);
            throw error;
        }
    }

    /**
     * Get card details
     */
    async getCard(cardId) {
        try {
            const card = await stripe.issuing.cards.retrieve(cardId);
            return card;
        } catch (error) {
            console.error('Failed to get card:', error);
            throw error;
        }
    }
}

module.exports = CardIssuingService;
```

### 6. Frontend

```javascript
// frontend/src/components/VirtualCard.jsx

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function VirtualCard({ tokenContract, walletAddress }) {
    const [card, setCard] = useState(null);
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        loadCard();
        loadBalance();
        loadTransactions();

        // Real-time balance updates via WebSocket
        const ws = new WebSocket('wss://api.example.com/balance');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setBalance(data.balance);
        };

        return () => ws.close();
    }, [walletAddress]);

    async function loadCard() {
        const response = await fetch(`/api/card?wallet=${walletAddress}`);
        const data = await response.json();
        setCard(data);
    }

    async function loadBalance() {
        const response = await fetch(`/api/balance?wallet=${walletAddress}`);
        const data = await response.json();
        setBalance(data.balance);
    }

    async function loadTransactions() {
        const response = await fetch(`/api/transactions?wallet=${walletAddress}`);
        const data = await response.json();
        setTransactions(data.transactions);
    }

    async function depositTokens(amount) {
        try {
            const depositAmount = ethers.utils.parseUnits(amount, 18);

            // Deposit tokens (like locking in bridge!)
            const tx = await tokenContract.deposit(depositAmount);
            await tx.wait();

            alert('Tokens deposited! You can now spend with your card.');
            loadBalance();

        } catch (error) {
            console.error('Deposit failed:', error);
        }
    }

    if (!card) {
        return (
            <div>
                <h2>Create Virtual Card</h2>
                <button onClick={() => createCard()}>
                    Create Card
                </button>
            </div>
        );
    }

    return (
        <div>
            <h2>Virtual Card</h2>

            {/* Card Display */}
            <div className="card">
                <div className="card-number">**** **** **** {card.last4}</div>
                <div className="card-balance">${balance.toFixed(2)}</div>
            </div>

            {/* Deposit */}
            <div>
                <h3>Deposit</h3>
                <input id="deposit-amount" type="number" placeholder="Amount" />
                <button onClick={() => {
                    const amount = document.getElementById('deposit-amount').value;
                    depositTokens(amount);
                }}>
                    Deposit
                </button>
            </div>

            {/* Recent Transactions */}
            <div>
                <h3>Recent Transactions</h3>
                {transactions.map(tx => (
                    <div key={tx.id}>
                        <span>{tx.merchant}</span>
                        <span>${tx.amount}</span>
                        <span>{tx.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default VirtualCard;
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────┐
│ REAL-TIME LAYER (< 500ms)                       │
│                                                  │
│  Card Swipe → Authorization → Cache Check       │
│                              → Approve/Decline   │
└─────────────────────────────────────────────────┘
                     │
                     ↓ Queue settlement
┌─────────────────────────────────────────────────┐
│ ASYNC LAYER (like your relayer!)                │
│                                                  │
│  Settlement Worker → Batch transactions         │
│                   → Burn on-chain               │
│                   → Update cache                │
└─────────────────────────────────────────────────┘
```

---

## Testing

```javascript
// test/virtual-card.test.js

describe('Virtual Card', function() {
    it('Should approve card transaction if balance sufficient', async function() {
        const user = { id: 'user1', walletAddress: '0x123...' };

        // Deposit tokens
        await tokenContract.deposit(ethers.utils.parseUnits('100', 18));

        // Simulate card swipe
        const response = await request(app)
            .post('/webhook/card-auth')
            .send({
                card_id: user.cardId,
                amount: 500, // $5.00
                merchant: 'Starbucks'
            });

        expect(response.body.approved).to.be.true;
    });

    it('Should settle transactions on-chain', async function() {
        // Wait for settlement
        await new Promise(resolve => setTimeout(resolve, 5000));

        const balance = await tokenContract.balanceOf(user.walletAddress);
        expect(balance).to.equal(ethers.utils.parseUnits('95', 18));
    });
});
```

---

## Deployment Checklist

- [ ] Deploy CardToken contract
- [ ] Set up Stripe Issuing account
- [ ] Configure Redis for caching
- [ ] Set up WebSocket server for real-time updates
- [ ] Deploy authorization webhook
- [ ] Deploy settlement worker
- [ ] Test with test cards
- [ ] Set conservative spending limits
- [ ] Implement monitoring/alerts
- [ ] Go live with beta users

---

## Resources

- [Stripe Issuing Docs](https://stripe.com/docs/issuing)
- [Marqeta Developer Docs](https://www.marqeta.com/docs/developer-guides)
- [Redis Caching Guide](https://redis.io/docs/manual/patterns/)
- [Coinbase Card](https://www.coinbase.com/card) - Study their implementation
- [Your Bridge Code](../relayer/) - Settlement worker uses same patterns!

---

**Key Takeaway:** Virtual card combines all your bridge knowledge (event-driven, state management, batching) with real-time systems (caching, WebSockets). The settlement layer is identical to your relayer, but the authorization layer requires new real-time techniques!
