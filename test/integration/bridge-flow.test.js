import { expect } from 'chai';
import hre from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployBridgeFixture } from '../fixtures/bridge-fixture.js';

const { ethers } = hre;

describe('Bridge Integration Tests', function () {
  describe('Complete Bridge Flow', function () {
    it('Should complete full cycle: Lock -> Mint -> Burn -> Unlock', async function () {
      const { sourceToken, bridgeEth, wrappedToken, bridgeBSC, deployer, user1 } =
        await loadFixture(deployBridgeFixture);

      const transferAmount = ethers.parseEther('100');
      const targetChain = ethers.id('CHAIN2');

      // Initial balances
      const initialSourceBalance = await sourceToken.balanceOf(user1.address);

      // STEP 1: LOCK ON CHAIN 1
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), transferAmount);
      const lockTx = await bridgeEth
        .connect(user1)
        .lock(user1.address, transferAmount, targetChain);
      const lockReceipt = await lockTx.wait();

      // Extract lock nonce
      const lockEvent = lockReceipt.logs.find((log) => {
        try {
          return bridgeEth.interface.parseLog(log).name === 'Lock';
        } catch {
          return false;
        }
      });
      const lockNonce = bridgeEth.interface.parseLog(lockEvent).args.nonce;

      // Verify tokens locked
      expect(await sourceToken.balanceOf(user1.address)).to.equal(
        initialSourceBalance - transferAmount
      );
      expect(await bridgeEth.getLockedBalance()).to.equal(transferAmount);

      // STEP 2: MINT ON CHAIN 2 (Simulating Relayer)
      const signature = '0x';
      await bridgeBSC.mint(user1.address, transferAmount, lockNonce, signature);

      // Verify wrapped tokens minted
      expect(await wrappedToken.balanceOf(user1.address)).to.equal(transferAmount);
      expect(await wrappedToken.totalSupply()).to.equal(transferAmount);

      // STEP 3: BURN ON CHAIN 2
      const burnAmount = ethers.parseEther('50');
      const sourceChain = ethers.id('CHAIN1');

      const burnTx = await bridgeBSC.connect(user1).burn(user1.address, burnAmount, sourceChain);
      const burnReceipt = await burnTx.wait();

      const burnEvent = burnReceipt.logs.find((log) => {
        try {
          return bridgeBSC.interface.parseLog(log).name === 'Burn';
        } catch {
          return false;
        }
      });
      const burnNonce = bridgeBSC.interface.parseLog(burnEvent).args.nonce;

      // STEP 4: UNLOCK ON CHAIN 1 (Simulating Relayer)
      await bridgeEth.unlock(user1.address, burnAmount, burnNonce, signature);

      // Verify final balances
      const finalSourceBalance = await sourceToken.balanceOf(user1.address);
      expect(finalSourceBalance).to.equal(initialSourceBalance - transferAmount + burnAmount);

      // VERIFY SUPPLY CONSERVATION
      const lockedInBridge = await bridgeEth.getLockedBalance();
      const wrappedSupply = await wrappedToken.totalSupply();
      expect(lockedInBridge).to.equal(wrappedSupply);
    });

    it('Should handle multiple concurrent transfers', async function () {
      const { sourceToken, bridgeEth, wrappedToken, bridgeBSC, user1, user2 } =
        await loadFixture(deployBridgeFixture);

      const amount1 = ethers.parseEther('100');
      const amount2 = ethers.parseEther('200');
      const targetChain = ethers.id('CHAIN2');

      // User 1 locks
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), amount1);
      const lock1Tx = await bridgeEth.connect(user1).lock(user1.address, amount1, targetChain);
      const lock1Receipt = await lock1Tx.wait();

      // User 2 locks
      await sourceToken.connect(user2).approve(await bridgeEth.getAddress(), amount2);
      const lock2Tx = await bridgeEth.connect(user2).lock(user2.address, amount2, targetChain);
      const lock2Receipt = await lock2Tx.wait();

      // Extract nonces
      const nonce1 = bridgeEth.interface.parseLog(
        lock1Receipt.logs.find((log) => {
          try {
            return bridgeEth.interface.parseLog(log).name === 'Lock';
          } catch {
            return false;
          }
        })
      ).args.nonce;

      const nonce2 = bridgeEth.interface.parseLog(
        lock2Receipt.logs.find((log) => {
          try {
            return bridgeEth.interface.parseLog(log).name === 'Lock';
          } catch {
            return false;
          }
        })
      ).args.nonce;

      // Relayer mints for both users
      const signature = '0x';
      await bridgeBSC.mint(user1.address, amount1, nonce1, signature);
      await bridgeBSC.mint(user2.address, amount2, nonce2, signature);

      // Verify balances
      expect(await wrappedToken.balanceOf(user1.address)).to.equal(amount1);
      expect(await wrappedToken.balanceOf(user2.address)).to.equal(amount2);
      expect(await wrappedToken.totalSupply()).to.equal(amount1 + amount2);

      // Verify supply conservation
      const locked = await bridgeEth.getLockedBalance();
      const wrapped = await wrappedToken.totalSupply();
      expect(locked).to.equal(wrapped);
    });
  });

  describe('Security Features', function () {
    it('Should prevent replay attacks', async function () {
      const { sourceToken, bridgeEth, bridgeBSC, user1 } = await loadFixture(deployBridgeFixture);

      const amount = ethers.parseEther('100');
      const targetChain = ethers.id('CHAIN2');

      // Lock tokens
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), amount);
      const lockTx = await bridgeEth.connect(user1).lock(user1.address, amount, targetChain);
      const lockReceipt = await lockTx.wait();

      const nonce = bridgeEth.interface.parseLog(
        lockReceipt.logs.find((log) => {
          try {
            return bridgeEth.interface.parseLog(log).name === 'Lock';
          } catch {
            return false;
          }
        })
      ).args.nonce;

      // Mint once
      const signature = '0x';
      await bridgeBSC.mint(user1.address, amount, nonce, signature);

      // Try to mint again - should fail
      await expect(bridgeBSC.mint(user1.address, amount, nonce, signature)).to.be.revertedWith(
        'Nonce already processed'
      );
    });

    it('Should enforce bridge limits', async function () {
      const { sourceToken, bridgeEth, user1 } = await loadFixture(deployBridgeFixture);

      const tooSmall = ethers.parseEther('0.05'); // Below minimum
      const tooLarge = ethers.parseEther('11000'); // Above maximum
      const targetChain = ethers.id('CHAIN2');

      // Too small
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), tooSmall);
      await expect(
        bridgeEth.connect(user1).lock(user1.address, tooSmall, targetChain)
      ).to.be.revertedWith('Amount below minimum');

      // Too large
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), tooLarge);
      await expect(
        bridgeEth.connect(user1).lock(user1.address, tooLarge, targetChain)
      ).to.be.revertedWith('Amount exceeds maximum');
    });

    it('Should handle pause mechanism', async function () {
      const { sourceToken, bridgeEth, deployer, user1 } = await loadFixture(deployBridgeFixture);

      const amount = ethers.parseEther('100');
      const targetChain = ethers.id('CHAIN2');

      // Pause bridge
      await bridgeEth.connect(deployer).pause();

      // Try to lock - should fail
      await sourceToken.connect(user1).approve(await bridgeEth.getAddress(), amount);
      await expect(
        bridgeEth.connect(user1).lock(user1.address, amount, targetChain)
      ).to.be.revertedWithCustomError(bridgeEth, 'EnforcedPause');

      // Unpause
      await bridgeEth.connect(deployer).unpause();

      // Should work now
      await expect(bridgeEth.connect(user1).lock(user1.address, amount, targetChain)).to.not.be
        .reverted;
    });
  });
});
