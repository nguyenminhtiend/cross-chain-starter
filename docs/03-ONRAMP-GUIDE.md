# On-Ramp: Fiat to Crypto

**Difficulty:** ⭐⭐⭐⭐ (Medium-Hard)
**Knowledge Reuse:** 30% from your bridge project
**Time Estimate:** 3-4 weeks

---

## Overview

On-ramp allows users to buy crypto with fiat payment methods (credit card, bank transfer).

**Example Flow:**
```
User pays $100 via Stripe
  → Your backend verifies payment
  → Smart contract mints tokens
  → User receives 100 USDC
```

---

## Knowledge Mapping

### What You Can Reuse ✅

| Your Bridge Concept | On-Ramp Equivalent | Similarity |
|---------------------|-------------------|------------|
| **Event-driven architecture** | Webhook = Event | 90% |
| **Lock event → Mint** | Payment webhook → Mint | 85% |
| **Nonce tracking (replay protection)** | Payment ID tracking | 90% |
| **State management** | Track processed payments | 95% |
| **Transaction execution** | Mint tokens to user | 100% |
| **Relayer pattern** | Backend service | 80% |

### Flow Comparison

```javascript
// YOUR BRIDGE FLOW
Lock event on Chain1
  → Relayer listens for event
  → Verify on-chain
  → Mint on Chain2

// ON-RAMP FLOW (almost identical!)
Payment on Stripe
  → Backend listens for webhook
  → Verify with Stripe API
  → Mint on blockchain
```

---

## Architecture

### Your Bridge Architecture
```
┌──────────────┐
│  Chain 1     │ User locks tokens
└──────┬───────┘
       │ Event emitted
       ↓
┌──────────────┐
│  Relayer     │ Listens for events
└──────┬───────┘
       │ Verifies on-chain
       ↓
┌──────────────┐
│  Chain 2     │ Mints tokens
└──────────────┘
```

### On-Ramp Architecture (Same Pattern!)
```
┌──────────────┐
│  Stripe      │ User pays with card
└──────┬───────┘
       │ Webhook sent
       ↓
┌──────────────┐
│  Backend     │ Listens for webhooks (like your relayer!)
└──────┬───────┘
       │ Verifies with Stripe API (like on-chain verification!)
       ↓
┌──────────────┐
│  Blockchain  │ Mints tokens (same as your bridge!)
└──────────────┘
```

**Key Insight:** Your relayer becomes a webhook handler. That's the main change!

---

## Key Concepts

### 1. Payment Processor Integration

**Mapping to your relayer:**

```javascript
// YOUR BRIDGE RELAYER
// File: relayer/event-listener.js

sourceBridge.on('Lock', async (from, to, amount, timestamp, nonce) => {
    // Verify event is real
    const event = await sourceBridge.queryFilter('Lock', blockNumber);

    // Check if processed
    if (await isProcessed(nonce)) return;

    // Execute mint
    await mint(to, amount, nonce);
});

// ON-RAMP WEBHOOK HANDLER (same structure!)
// File: backend/webhook-handler.js

app.post('/webhook/stripe', async (req, res) => {
    const event = req.body;

    // Verify webhook is real (like verifying event on-chain!)
    const signature = req.headers['stripe-signature'];
    const verified = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
    );

    if (event.type === 'payment_intent.succeeded') {
        // Check if processed (SAME AS YOUR BRIDGE!)
        if (await isPaymentProcessed(event.id)) {
            return res.json({ received: true });
        }

        // Execute mint (SAME AS YOUR BRIDGE!)
        await processOnRamp(event.data.object);
    }

    res.json({ received: true });
});
```

### Complete On-Ramp Implementation

```javascript
// backend/onramp-service.js
// EXTENDS your relayer pattern!

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { ethers } = require('ethers');

class OnRampService {
    constructor(tokenContract, database) {
        this.tokenContract = tokenContract;
        this.db = database;
    }

    /**
     * Process on-ramp (EXACTLY LIKE handleLockEvent!)
     *
     * Your Bridge handleLockEvent:
     * 1. Check if processed (nonce)
     * 2. Verify event
     * 3. Mint tokens
     * 4. Mark processed
     *
     * On-Ramp processOnRamp:
     * 1. Check if processed (payment ID) ← SAME PATTERN!
     * 2. Verify payment ← SAME PATTERN!
     * 3. Mint tokens ← IDENTICAL!
     * 4. Mark processed ← SAME PATTERN!
     */
    async processOnRamp(payment) {
        console.log('Processing payment:', payment.id);

        // SAME AS YOUR BRIDGE: Check if already processed
        const existing = await this.db.payments.findOne({
            paymentId: payment.id
        });

        if (existing && existing.status === 'completed') {
            console.log('Payment already processed:', payment.id);
            return;
        }

        // Extract user info from payment metadata
        const walletAddress = payment.metadata.wallet_address;
        const amount = payment.amount / 100; // Stripe uses cents

        // SAME AS YOUR BRIDGE: Mint tokens
        try {
            console.log(`Minting ${amount} USDC to ${walletAddress}`);

            const mintAmount = ethers.utils.parseUnits(amount.toString(), 18);

            // This is EXACTLY like your bridge mint call!
            const tx = await this.tokenContract.mint(
                walletAddress,
                mintAmount
            );

            console.log('Mint transaction:', tx.hash);
            const receipt = await tx.wait();

            // SAME AS YOUR BRIDGE: Mark as processed
            await this.db.payments.updateOne(
                { paymentId: payment.id },
                {
                    $set: {
                        paymentId: payment.id,
                        walletAddress: walletAddress,
                        amount: amount,
                        txHash: tx.hash,
                        status: 'completed',
                        completedAt: new Date()
                    }
                },
                { upsert: true }
            );

            console.log('On-ramp completed:', tx.hash);

        } catch (error) {
            console.error('Mint failed:', error);

            // Mark as failed (can retry later)
            await this.db.payments.updateOne(
                { paymentId: payment.id },
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
     * Verify payment with Stripe (like verifying event on-chain)
     *
     * Your Bridge: Verify event exists on-chain
     * On-Ramp: Verify payment exists with Stripe
     */
    async verifyPayment(paymentId) {
        try {
            const payment = await stripe.paymentIntents.retrieve(paymentId);
            return payment.status === 'succeeded';
        } catch (error) {
            console.error('Payment verification failed:', error);
            return false;
        }
    }

    /**
     * Create payment intent (NEW - no bridge equivalent)
     * This is how user initiates on-ramp
     */
    async createPaymentIntent(amount, walletAddress) {
        // Validate wallet address
        if (!ethers.utils.isAddress(walletAddress)) {
            throw new Error('Invalid wallet address');
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, // Stripe uses cents
            currency: 'usd',
            metadata: {
                wallet_address: walletAddress
            },
            // Stripe handles the payment UI
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Store in database
        await this.db.payments.insertOne({
            paymentId: paymentIntent.id,
            walletAddress: walletAddress,
            amount: amount,
            status: 'pending',
            createdAt: new Date()
        });

        return paymentIntent;
    }
}

module.exports = OnRampService;
```

### 2. Webhook Handler (Like Event Listener)

```javascript
// backend/server.js
// SAME STRUCTURE as your relayer!

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const OnRampService = require('./onramp-service');

const app = express();

// Initialize service (like initializing relayer)
const onrampService = new OnRampService(tokenContract, database);

/**
 * Webhook endpoint (EXACTLY LIKE event listener!)
 *
 * Your Bridge:
 *   sourceBridge.on('Lock', handleLockEvent)
 *
 * On-Ramp:
 *   app.post('/webhook', handleWebhook)
 */
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // SAME AS YOUR BRIDGE: Verify event is authentic
        // (Your bridge verifies event exists on-chain)
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle payment success event
    // (Like handling Lock event in your bridge!)
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        // Process on-ramp (SAME AS handleLockEvent!)
        try {
            await onrampService.processOnRamp(paymentIntent);
        } catch (error) {
            console.error('Failed to process on-ramp:', error);
            // Could implement retry logic here
        }
    }

    // IMPORTANT: Respond quickly (within 5 seconds)
    // Similar to how your relayer processes events asynchronously
    res.json({ received: true });
});

/**
 * API endpoint to create payment
 * (NEW - user-facing API)
 */
app.post('/api/onramp/create', express.json(), async (req, res) => {
    try {
        const { amount, walletAddress } = req.body;

        // Validate input
        if (!amount || !walletAddress) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create payment intent
        const paymentIntent = await onrampService.createPaymentIntent(
            amount,
            walletAddress
        );

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentId: paymentIntent.id
        });

    } catch (error) {
        console.error('Failed to create payment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * API endpoint to check payment status
 * (Similar to checking if nonce is processed in your bridge)
 */
app.get('/api/onramp/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;

        const payment = await database.payments.findOne({ paymentId });

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json({
            status: payment.status,
            txHash: payment.txHash,
            amount: payment.amount
        });

    } catch (error) {
        console.error('Failed to get payment status:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('On-ramp service running on port 3000');
});
```

### 3. KYC/AML Compliance (NEW Concept)

**Why you need it:** Legal requirement for fiat → crypto conversion

```javascript
// backend/kyc-service.js
// NEW file, no bridge equivalent

const Sumsub = require('@sumsub/api-client');

class KYCService {
    constructor() {
        this.sumsub = new Sumsub({
            apiKey: process.env.SUMSUB_API_KEY,
            secretKey: process.env.SUMSUB_SECRET_KEY
        });
    }

    /**
     * Verify user identity
     * REQUIRED before allowing on-ramp
     */
    async verifyUser(userId, documents) {
        try {
            // Create applicant
            const applicant = await this.sumsub.createApplicant({
                externalUserId: userId,
                email: documents.email,
                phone: documents.phone
            });

            // Upload documents
            await this.sumsub.addDocument(applicant.id, {
                type: 'ID_CARD',
                file: documents.idPhoto
            });

            await this.sumsub.addDocument(applicant.id, {
                type: 'SELFIE',
                file: documents.selfie
            });

            // Get verification result
            const result = await this.sumsub.getApplicantStatus(applicant.id);

            // Store KYC level
            await database.users.updateOne(
                { userId },
                {
                    $set: {
                        kycLevel: this.mapKycLevel(result.reviewStatus),
                        kycCompletedAt: new Date(),
                        sumsubApplicantId: applicant.id
                    }
                }
            );

            return {
                approved: result.reviewStatus === 'completed',
                level: this.mapKycLevel(result.reviewStatus)
            };

        } catch (error) {
            console.error('KYC verification failed:', error);
            throw error;
        }
    }

    /**
     * Map KYC verification status to limits
     */
    mapKycLevel(status) {
        switch (status) {
            case 'completed':
                return 2; // Can on-ramp up to $10k/day
            case 'pending':
                return 1; // Can on-ramp up to $1k/day
            default:
                return 0; // No on-ramp allowed
        }
    }

    /**
     * Check if user can on-ramp given amount
     */
    async canOnRamp(userId, amount) {
        const user = await database.users.findOne({ userId });

        if (!user || user.kycLevel === 0) {
            return {
                allowed: false,
                reason: 'KYC verification required'
            };
        }

        // Check daily limits based on KYC level
        const dailyLimit = this.getDailyLimit(user.kycLevel);

        const todayTotal = await this.getTodayTotal(userId);

        if (todayTotal + amount > dailyLimit) {
            return {
                allowed: false,
                reason: `Daily limit exceeded (${dailyLimit} USD/day)`
            };
        }

        return { allowed: true };
    }

    getDailyLimit(kycLevel) {
        const limits = {
            0: 0,
            1: 1000,   // Level 1: $1k/day
            2: 10000,  // Level 2: $10k/day
            3: 50000   // Level 3: $50k/day
        };
        return limits[kycLevel] || 0;
    }

    async getTodayTotal(userId) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const result = await database.payments.aggregate([
            {
                $match: {
                    userId: userId,
                    status: 'completed',
                    completedAt: { $gte: startOfDay }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        return result.length > 0 ? result[0].total : 0;
    }
}

module.exports = KYCService;
```

### 4. Frontend Integration

```javascript
// frontend/src/components/OnRamp.jsx
// Similar to your bridge UI!

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function OnRampForm() {
    const [amount, setAmount] = useState('');
    const [walletAddress, setWalletAddress] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const stripe = useStripe();
    const elements = useElements();

    /**
     * Create payment intent
     * (Like initiating bridge in your UI)
     */
    async function handleSubmit(e) {
        e.preventDefault();

        if (!stripe || !elements) return;

        // Create payment intent
        const response = await fetch('/api/onramp/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: parseFloat(amount),
                walletAddress: walletAddress
            })
        });

        const { clientSecret } = await response.json();

        // Confirm payment
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            clientSecret,
            confirmParams: {
                return_url: `${window.location.origin}/onramp/complete`,
            },
        });

        if (error) {
            console.error('Payment failed:', error);
        } else if (paymentIntent.status === 'succeeded') {
            console.log('Payment succeeded!');
            // Tokens will be minted via webhook
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <h2>Buy Crypto</h2>

            <input
                type="number"
                placeholder="Amount (USD)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
            />

            <input
                type="text"
                placeholder="Your Wallet Address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                required
            />

            <PaymentElement />

            <button type="submit" disabled={!stripe}>
                Buy {amount} USDC
            </button>

            <p>Your tokens will arrive in ~1 minute after payment confirmation</p>
        </form>
    );
}

function OnRamp() {
    return (
        <Elements stripe={stripePromise}>
            <OnRampForm />
        </Elements>
    );
}

export default OnRamp;
```

---

## Smart Contract (Optional Enhancement)

Your existing token contract works! But you can add on-ramp specific features:

```solidity
// contracts/OnRampToken.sol
// EXTENDS your existing WrappedToken.sol

pragma solidity ^0.8.0;

import "./WrappedToken.sol";

contract OnRampToken is WrappedToken {
    // Track on-ramp mints separately
    mapping(string => bool) public processedPayments; // payment ID => processed

    event OnRampMint(
        address indexed to,
        uint256 amount,
        string paymentId,
        uint256 timestamp
    );

    /**
     * Mint from on-ramp (SAME AS your mint, with extra tracking)
     */
    function mintFromOnRamp(
        address to,
        uint256 amount,
        string memory paymentId
    ) external onlyOwner {
        // Check if payment already processed
        require(!processedPayments[paymentId], "Payment already processed");

        // Mint tokens (SAME AS YOUR BRIDGE!)
        _mint(to, amount);

        // Mark payment as processed
        processedPayments[paymentId] = true;

        emit OnRampMint(to, amount, paymentId, block.timestamp);
    }

    /**
     * Check if payment was processed
     */
    function isPaymentProcessed(string memory paymentId) external view returns (bool) {
        return processedPayments[paymentId];
    }
}
```

---

## Testing

```javascript
// test/onramp.test.js
// Similar to your bridge tests!

const { expect } = require('chai');
const stripe = require('stripe')(process.env.STRIPE_TEST_KEY);

describe('On-Ramp', function() {
    let onrampService, tokenContract;

    before(async function() {
        // Deploy token contract (SAME AS YOUR BRIDGE TESTS!)
        const Token = await ethers.getContractFactory('OnRampToken');
        tokenContract = await Token.deploy();

        // Initialize service
        onrampService = new OnRampService(tokenContract, database);
    });

    it('Should mint tokens after successful payment', async function() {
        const walletAddress = '0x1234...';
        const amount = 100;

        // Create test payment
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: 'usd',
            metadata: { wallet_address: walletAddress },
            payment_method: 'pm_card_visa', // Test card
            confirm: true
        });

        // Process on-ramp
        await onrampService.processOnRamp(paymentIntent);

        // Verify tokens minted (SAME AS YOUR BRIDGE TESTS!)
        const balance = await tokenContract.balanceOf(walletAddress);
        expect(balance).to.equal(ethers.utils.parseUnits('100', 18));
    });

    it('Should not process same payment twice', async function() {
        // Attempt to process again
        await expect(
            onrampService.processOnRamp(paymentIntent)
        ).to.be.reverted;
    });
});
```

---

## Deployment Checklist

- [ ] Deploy OnRampToken contract
- [ ] Set up Stripe account
- [ ] Configure webhook endpoint
- [ ] Set up KYC provider (Sumsub/Onfido)
- [ ] Deploy backend service
- [ ] Test with Stripe test mode
- [ ] Implement monitoring/alerts
- [ ] Go live with small limits

---

## Common Issues

### Issue 1: Webhook Replay

**Problem:** Stripe retries failed webhooks

**Solution:** Use idempotency (like your nonce tracking!)

```javascript
// Already handled in processOnRamp with payment ID check!
if (await isPaymentProcessed(payment.id)) return;
```

### Issue 2: Payment Success But Mint Fails

**Problem:** User paid but didn't receive tokens

**Solution:** Implement retry mechanism

```javascript
// Retry failed mints
async function retryFailedMints() {
    const failed = await database.payments.find({ status: 'failed' });

    for (const payment of failed) {
        try {
            await onrampService.processOnRamp(payment);
        } catch (error) {
            console.error('Retry failed:', error);
        }
    }
}

// Run every 5 minutes
setInterval(retryFailedMints, 5 * 60 * 1000);
```

---

## Resources

- [Stripe Payments Guide](https://stripe.com/docs/payments)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Sumsub KYC Integration](https://developers.sumsub.com/)
- [Your Bridge Code](../relayer/) - Event handling logic is reusable!

---

**Key Takeaway:** On-ramp is your bridge relayer, but listening to Stripe webhooks instead of blockchain events. The core pattern (event → verify → mint) is identical!
