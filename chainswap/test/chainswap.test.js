const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainSwap", function () {
  let sourceToken, wrappedToken, bridgeSource, chainSwapBridge;
  let owner, user, relayer;
  let mockRouter;

  const INITIAL_SUPPLY = ethers.utils.parseEther("10000");
  const LOCK_AMOUNT = ethers.utils.parseEther("100");

  beforeEach(async function () {
    [owner, user, relayer] = await ethers.getSigners();

    // Deploy source token
    const SourceToken = await ethers.getContractFactory("WrappedToken");
    sourceToken = await SourceToken.deploy("Source Token", "SRC");
    await sourceToken.deployed();

    // Mint tokens to user
    await sourceToken.mint(user.address, INITIAL_SUPPLY);

    // Deploy bridge source
    const BridgeSource = await ethers.getContractFactory("BridgeSourceExtended");
    bridgeSource = await BridgeSource.deploy(sourceToken.address);
    await bridgeSource.deployed();

    // Deploy wrapped token
    const WrappedToken = await ethers.getContractFactory("WrappedToken");
    wrappedToken = await WrappedToken.deploy("Wrapped Source Token", "wSRC");
    await wrappedToken.deployed();

    // Deploy mock Uniswap router (simplified for testing)
    const MockRouter = await ethers.getContractFactory("MockUniswapRouter");
    mockRouter = await MockRouter.deploy();
    await mockRouter.deployed();

    // Deploy ChainSwap bridge
    const ChainSwapBridge = await ethers.getContractFactory("ChainSwapBridge");
    chainSwapBridge = await ChainSwapBridge.deploy(
      wrappedToken.address,
      mockRouter.address
    );
    await chainSwapBridge.deployed();

    // Transfer wrapped token ownership to bridge
    await wrappedToken.transferOwnership(chainSwapBridge.address);

    // Transfer bridge ownership to relayer
    await chainSwapBridge.transferOwnership(relayer.address);
  });

  describe("Basic Bridge (No Swap)", function () {
    it("Should lock tokens on source chain", async function () {
      // Approve bridge to spend user tokens
      await sourceToken.connect(user).approve(bridgeSource.address, LOCK_AMOUNT);

      // Lock tokens
      const tx = await bridgeSource.connect(user).lock(
        user.address,
        LOCK_AMOUNT,
        ethers.constants.AddressZero, // No swap
        2 // Target chain ID
      );

      // Check event
      const receipt = await tx.wait();
      const lockEvent = receipt.events.find(e => e.event === 'Lock');

      expect(lockEvent.args.from).to.equal(user.address);
      expect(lockEvent.args.to).to.equal(user.address);
      expect(lockEvent.args.amount).to.equal(LOCK_AMOUNT);
      expect(lockEvent.args.targetToken).to.equal(ethers.constants.AddressZero);

      // Check balances
      expect(await sourceToken.balanceOf(bridgeSource.address)).to.equal(LOCK_AMOUNT);
      expect(await bridgeSource.totalLocked()).to.equal(LOCK_AMOUNT);
    });

    it("Should mint wrapped tokens on destination", async function () {
      const nonce = 0;
      const signature = "0x00"; // Simplified signature for testing

      // Mint tokens (as relayer)
      await chainSwapBridge.connect(relayer).mint(
        user.address,
        LOCK_AMOUNT,
        nonce,
        signature
      );

      // Check balance
      expect(await wrappedToken.balanceOf(user.address)).to.equal(LOCK_AMOUNT);
      expect(await chainSwapBridge.isProcessed(nonce)).to.be.true;
    });

    it("Should prevent replay attacks", async function () {
      const nonce = 0;
      const signature = "0x00";

      // First mint
      await chainSwapBridge.connect(relayer).mint(
        user.address,
        LOCK_AMOUNT,
        nonce,
        signature
      );

      // Try to mint again with same nonce
      await expect(
        chainSwapBridge.connect(relayer).mint(
          user.address,
          LOCK_AMOUNT,
          nonce,
          signature
        )
      ).to.be.revertedWith("Already processed");
    });
  });

  describe("Bridge with Swap", function () {
    let mockTargetToken;

    beforeEach(async function () {
      // Deploy mock target token
      const MockToken = await ethers.getContractFactory("WrappedToken");
      mockTargetToken = await MockToken.deploy("Target Token", "TGT");
      await mockTargetToken.deployed();

      // Mint target tokens to mock router for swaps
      await mockTargetToken.mint(mockRouter.address, ethers.utils.parseEther("1000"));
    });

    it("Should lock tokens with target token parameter", async function () {
      await sourceToken.connect(user).approve(bridgeSource.address, LOCK_AMOUNT);

      const tx = await bridgeSource.connect(user).lock(
        user.address,
        LOCK_AMOUNT,
        mockTargetToken.address, // Swap to this token
        2
      );

      const receipt = await tx.wait();
      const lockEvent = receipt.events.find(e => e.event === 'Lock');

      expect(lockEvent.args.targetToken).to.equal(mockTargetToken.address);
    });

    it("Should mint and swap tokens on destination", async function () {
      const nonce = 1;
      const signature = "0x00";
      const minAmountOut = ethers.utils.parseEther("95"); // 5% slippage

      // Setup mock router to approve swaps
      await mockRouter.setSwapRate(wrappedToken.address, mockTargetToken.address, 100, 95);

      await chainSwapBridge.connect(relayer).mintAndSwap(
        user.address,
        LOCK_AMOUNT,
        nonce,
        signature,
        mockTargetToken.address,
        minAmountOut
      );

      // User should receive target tokens (not wrapped tokens)
      expect(await mockTargetToken.balanceOf(user.address)).to.be.gt(0);
      expect(await wrappedToken.balanceOf(user.address)).to.equal(0);
    });

    it("Should fallback to wrapped tokens if swap fails", async function () {
      const nonce = 2;
      const signature = "0x00";
      const minAmountOut = ethers.utils.parseEther("95");

      // Setup router to fail swap
      await mockRouter.setShouldFail(true);

      await chainSwapBridge.connect(relayer).mintAndSwap(
        user.address,
        LOCK_AMOUNT,
        nonce,
        signature,
        mockTargetToken.address,
        minAmountOut
      );

      // User should receive wrapped tokens as fallback
      expect(await wrappedToken.balanceOf(user.address)).to.equal(LOCK_AMOUNT);
    });
  });

  describe("Burn and Unlock", function () {
    beforeEach(async function () {
      // Lock tokens on source
      await sourceToken.connect(user).approve(bridgeSource.address, LOCK_AMOUNT);
      await bridgeSource.connect(user).lock(
        user.address,
        LOCK_AMOUNT,
        ethers.constants.AddressZero,
        2
      );

      // Mint wrapped tokens on destination
      await chainSwapBridge.connect(relayer).mint(
        user.address,
        LOCK_AMOUNT,
        0,
        "0x00"
      );
    });

    it("Should burn wrapped tokens", async function () {
      // Approve bridge to burn
      await wrappedToken.connect(user).approve(chainSwapBridge.address, LOCK_AMOUNT);

      // Burn
      const tx = await chainSwapBridge.connect(user).burn(
        LOCK_AMOUNT,
        user.address,
        1 // Source chain ID
      );

      const receipt = await tx.wait();
      const burnEvent = receipt.events.find(e => e.event === 'Burn');

      expect(burnEvent.args.from).to.equal(user.address);
      expect(burnEvent.args.amount).to.equal(LOCK_AMOUNT);

      // Wrapped tokens should be burned
      expect(await wrappedToken.balanceOf(user.address)).to.equal(0);
    });

    it("Should unlock tokens on source chain", async function () {
      const initialBalance = await sourceToken.balanceOf(user.address);

      const signature = "0x00";
      await bridgeSource.unlock(
        user.address,
        LOCK_AMOUNT,
        0, // Source nonce
        signature
      );

      // User should receive original tokens back
      expect(await sourceToken.balanceOf(user.address)).to.equal(
        initialBalance.add(LOCK_AMOUNT)
      );
    });
  });

  describe("Slippage Protection", function () {
    it("Should update slippage tolerance", async function () {
      const newTolerance = 200; // 2%

      await chainSwapBridge.connect(relayer).setSlippageTolerance(newTolerance);

      expect(await chainSwapBridge.slippageTolerance()).to.equal(newTolerance);
    });

    it("Should reject slippage > 10%", async function () {
      const invalidTolerance = 1100; // 11%

      await expect(
        chainSwapBridge.connect(relayer).setSlippageTolerance(invalidTolerance)
      ).to.be.revertedWith("Max 10% slippage");
    });
  });
});

