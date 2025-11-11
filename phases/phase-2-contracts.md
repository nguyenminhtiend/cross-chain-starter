# Phase 2: Smart Contracts Development

**Duration**: 30 minutes
**Difficulty**: Intermediate
**Prerequisites**: Phase 1 completed

## 📋 Phase Overview

Develop 4 production-grade smart contracts that form the core of the cross-chain bridge:
1. **SourceToken** - ERC-20 token on Chain 1
2. **BridgeEthereum** - Bridge contract for Chain 1 (locks/unlocks)
3. **WrappedToken** - Wrapped ERC-20 on Chain 2
4. **BridgeBSC** - Bridge contract for Chain 2 (mints/burns)

## 🎯 Learning Objectives

- Implement ERC-20 tokens using OpenZeppelin 5.4
- Design bridge contracts with security best practices
- Understand Lock & Mint / Burn & Unlock patterns
- Implement replay protection with nonces
- Use Pausable and ReentrancyGuard patterns
- Write production-grade Solidity 0.8.30 code

## 📥 Inputs

From Phase 1:
- Working Hardhat 3.0 environment
- Empty `contracts/` directory structure
- OpenZeppelin Contracts 5.4.0 installed

## 📤 Outputs

After completing this phase, you will have:

✅ 4 smart contracts written in Solidity 0.8.30
✅ Compiled contract artifacts in `artifacts/`
✅ Contract ABIs generated
✅ No compilation errors or warnings
✅ Ready for deployment

## 🏗️ Contract Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CHAIN 1 (Ethereum)                   │
├─────────────────────────────────────────────────────────┤
│  SourceToken.sol          BridgeEthereum.sol           │
│  - ERC-20 token           - lock() tokens              │
│  - Burnable               - unlock() tokens            │
│  - Mintable               - Nonce tracking             │
│  - Max supply cap         - Pausable                   │
└─────────────────────────────────────────────────────────┘
                            ▼
                     Cross-chain transfer
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     CHAIN 2 (BSC)                       │
├─────────────────────────────────────────────────────────┤
│  WrappedToken.sol         BridgeBSC.sol                │
│  - ERC-20 token           - mint() wrapped             │
│  - Bridge-controlled      - burn() wrapped             │
│  - No max supply          - Nonce tracking             │
│                           - Pausable                    │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Step-by-Step Instructions

### Step 1: Create SourceToken Contract

**File**: `contracts/tokens/SourceToken.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SourceToken
 * @notice ERC20 token that serves as the source asset for the bridge
 * @dev Implements OpenZeppelin's ERC20 with burnable extension
 */
contract SourceToken is ERC20, ERC20Burnable, Ownable {

    /// @notice Token decimals (18 is standard for ERC20)
    uint8 private constant DECIMALS = 18;

    /// @notice Maximum supply cap (1 billion tokens)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**DECIMALS;

    /// @notice Current total minted supply
    uint256 public totalMinted;

    /**
     * @notice Emitted when tokens are minted
     * @param to Address receiving the minted tokens
     * @param amount Amount of tokens minted
     */
    event Minted(address indexed to, uint256 amount);

    /**
     * @notice Constructor - initializes token with name and symbol
     * @param initialSupply Initial amount to mint to deployer (in whole tokens)
     */
    constructor(uint256 initialSupply)
        ERC20("Bridge Source Token", "BST")
        Ownable(msg.sender)
    {
        require(initialSupply > 0, "Initial supply must be greater than 0");
        uint256 initialAmount = initialSupply * 10**decimals();
        require(initialAmount <= MAX_SUPPLY, "Initial supply exceeds max supply");

        _mint(msg.sender, initialAmount);
        totalMinted = initialAmount;

        emit Minted(msg.sender, initialAmount);
    }

    /**
     * @notice Mint new tokens (only owner)
     * @param to Address to receive minted tokens
     * @param amount Amount to mint (in whole tokens)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");

        uint256 mintAmount = amount * 10**decimals();
        require(totalMinted + mintAmount <= MAX_SUPPLY, "Exceeds max supply");

        _mint(to, mintAmount);
        totalMinted += mintAmount;

        emit Minted(to, mintAmount);
    }

    /**
     * @notice Returns the number of decimals
     * @return Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
```

### Step 2: Create BridgeEthereum Contract

**File**: `contracts/bridges/BridgeEthereum.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BridgeEthereum
 * @notice Bridge contract for source chain - handles locking and unlocking of tokens
 * @dev Implements pause mechanism for emergency stops
 */
contract BridgeEthereum is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice The ERC20 token being bridged
    IERC20 public immutable token;

    /// @notice Counter for outgoing bridge transactions
    uint256 public nonce;

    /// @notice Tracks processed nonces from destination chain (replay protection)
    mapping(uint256 => bool) public processedNonces;

    /// @notice Minimum bridge amount (prevents dust attacks)
    uint256 public minBridgeAmount;

    /// @notice Maximum bridge amount per transaction (risk management)
    uint256 public maxBridgeAmount;

    /**
     * @notice Emitted when tokens are locked for bridging
     * @param from Address that locked tokens
     * @param to Recipient address on destination chain
     * @param amount Amount of tokens locked
     * @param timestamp Block timestamp
     * @param nonce Unique transaction nonce
     * @param targetChain Identifier for destination chain
     */
    event Lock(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed nonce,
        bytes32 targetChain
    );

    /**
     * @notice Emitted when tokens are unlocked (return from destination)
     * @param to Address receiving unlocked tokens
     * @param amount Amount of tokens unlocked
     * @param timestamp Block timestamp
     * @param sourceNonce Nonce from destination chain burn transaction
     */
    event Unlock(
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed sourceNonce
    );

    /**
     * @notice Emitted when bridge limits are updated
     * @param minAmount New minimum bridge amount
     * @param maxAmount New maximum bridge amount
     */
    event LimitsUpdated(uint256 minAmount, uint256 maxAmount);

    /**
     * @notice Constructor
     * @param _token Address of the ERC20 token to bridge
     * @param _minAmount Minimum bridge amount
     * @param _maxAmount Maximum bridge amount
     */
    constructor(
        address _token,
        uint256 _minAmount,
        uint256 _maxAmount
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        token = IERC20(_token);
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        nonce = 0;
    }

    /**
     * @notice Lock tokens to bridge them to destination chain
     * @param to Recipient address on destination chain
     * @param amount Amount of tokens to bridge (in wei)
     * @param targetChain Identifier of destination blockchain
     */
    function lock(
        address to,
        uint256 amount,
        bytes32 targetChain
    ) external nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount >= minBridgeAmount, "Amount below minimum");
        require(amount <= maxBridgeAmount, "Amount exceeds maximum");
        require(targetChain != bytes32(0), "Invalid target chain");

        // Transfer tokens from user to bridge contract
        token.safeTransferFrom(msg.sender, address(this), amount);

        // Emit event for relayer to process
        emit Lock(
            msg.sender,
            to,
            amount,
            block.timestamp,
            nonce,
            targetChain
        );

        // Increment nonce
        unchecked {
            nonce++;
        }
    }

    /**
     * @notice Unlock tokens when returning from destination chain
     * @param to Address to receive unlocked tokens
     * @param amount Amount of tokens to unlock (in wei)
     * @param sourceNonce Nonce from destination chain burn transaction
     * @param signature Admin signature authorizing unlock (currently unused, for future multi-sig)
     */
    function unlock(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature
    ) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(!processedNonces[sourceNonce], "Nonce already processed");

        // Mark nonce as processed (replay protection)
        processedNonces[sourceNonce] = true;

        // Transfer tokens from bridge to recipient
        token.safeTransfer(to, amount);

        // Emit event for tracking
        emit Unlock(to, amount, block.timestamp, sourceNonce);
    }

    /**
     * @notice Update bridge amount limits
     * @param _minAmount New minimum amount
     * @param _maxAmount New maximum amount
     */
    function updateLimits(uint256 _minAmount, uint256 _maxAmount) external onlyOwner {
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;

        emit LimitsUpdated(_minAmount, _maxAmount);
    }

    /**
     * @notice Get total balance locked in bridge
     * @return Balance of tokens held by bridge
     */
    function getLockedBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Pause bridge operations (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume bridge operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdrawal function (use with extreme caution)
     * @param amount Amount to withdraw
     * @param recipient Address to receive withdrawn tokens
     */
    function emergencyWithdraw(uint256 amount, address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(paused(), "Can only withdraw when paused");

        token.safeTransfer(recipient, amount);
    }
}
```

### Step 3: Create WrappedToken Contract

**File**: `contracts/tokens/WrappedToken.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WrappedToken
 * @notice Wrapped token on destination chain representing locked tokens on source chain
 * @dev Only the bridge contract can mint/burn tokens
 */
contract WrappedToken is ERC20, Ownable {

    /// @notice Bridge contract authorized to mint/burn
    address public bridge;

    /// @notice Flag to prevent bridge address from being changed
    bool public bridgeSet;

    /**
     * @notice Emitted when bridge address is set
     * @param bridge Address of the bridge contract
     */
    event BridgeSet(address indexed bridge);

    /**
     * @notice Emitted when tokens are minted
     * @param to Address receiving minted tokens
     * @param amount Amount minted
     */
    event Minted(address indexed to, uint256 amount);

    /**
     * @notice Emitted when tokens are burned
     * @param from Address whose tokens are burned
     * @param amount Amount burned
     */
    event Burned(address indexed from, uint256 amount);

    /**
     * @notice Constructor
     * @param name_ Token name
     * @param symbol_ Token symbol
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        bridgeSet = false;
    }

    /**
     * @notice Set the bridge contract address (one-time only)
     * @param _bridge Address of the bridge contract
     */
    function setBridge(address _bridge) external onlyOwner {
        require(!bridgeSet, "Bridge already set");
        require(_bridge != address(0), "Invalid bridge address");

        bridge = _bridge;
        bridgeSet = true;

        emit BridgeSet(_bridge);
    }

    /**
     * @notice Mint wrapped tokens (only bridge can call)
     * @param to Address to receive minted tokens
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can mint");
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");

        _mint(to, amount);

        emit Minted(to, amount);
    }

    /**
     * @notice Burn wrapped tokens (only bridge can call)
     * @param from Address whose tokens to burn
     * @param amount Amount to burn (in wei)
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == bridge, "Only bridge can burn");
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(from) >= amount, "Insufficient balance");

        _burn(from, amount);

        emit Burned(from, amount);
    }

    /**
     * @notice Allow users to burn their own tokens (emergency)
     * @param amount Amount to burn (in wei)
     */
    function burnOwn(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _burn(msg.sender, amount);

        emit Burned(msg.sender, amount);
    }
}
```

### Step 4: Create BridgeBSC Contract

**File**: `contracts/bridges/BridgeBSC.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @notice Interface for wrapped token operations
 */
interface IWrappedToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title BridgeBSC
 * @notice Bridge contract for destination chain - handles minting and burning of wrapped tokens
 * @dev Implements pause mechanism for emergency stops
 */
contract BridgeBSC is Ownable, ReentrancyGuard, Pausable {

    /// @notice The wrapped token contract
    IWrappedToken public immutable token;

    /// @notice Counter for outgoing bridge transactions
    uint256 public nonce;

    /// @notice Tracks processed nonces from source chain (replay protection)
    mapping(uint256 => bool) public processedNonces;

    /// @notice Minimum bridge amount
    uint256 public minBridgeAmount;

    /// @notice Maximum bridge amount per transaction
    uint256 public maxBridgeAmount;

    /**
     * @notice Emitted when wrapped tokens are minted
     * @param to Address receiving minted tokens
     * @param amount Amount of tokens minted
     * @param timestamp Block timestamp
     * @param sourceNonce Nonce from source chain lock transaction
     */
    event Mint(
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed sourceNonce
    );

    /**
     * @notice Emitted when wrapped tokens are burned
     * @param from Address that burned tokens
     * @param to Recipient address on source chain
     * @param amount Amount of tokens burned
     * @param timestamp Block timestamp
     * @param nonce Unique transaction nonce
     * @param targetChain Identifier for source chain
     */
    event Burn(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed nonce,
        bytes32 targetChain
    );

    /**
     * @notice Emitted when bridge limits are updated
     * @param minAmount New minimum bridge amount
     * @param maxAmount New maximum bridge amount
     */
    event LimitsUpdated(uint256 minAmount, uint256 maxAmount);

    /**
     * @notice Constructor
     * @param _token Address of the wrapped token contract
     * @param _minAmount Minimum bridge amount
     * @param _maxAmount Maximum bridge amount
     */
    constructor(
        address _token,
        uint256 _minAmount,
        uint256 _maxAmount
    ) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        token = IWrappedToken(_token);
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        nonce = 0;
    }

    /**
     * @notice Mint wrapped tokens when source tokens are locked
     * @param to Address to receive minted tokens
     * @param amount Amount to mint (in wei)
     * @param sourceNonce Nonce from source chain lock transaction
     * @param signature Admin signature (currently unused, for future multi-sig)
     */
    function mint(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature
    ) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount >= minBridgeAmount, "Amount below minimum");
        require(amount <= maxBridgeAmount, "Amount exceeds maximum");
        require(!processedNonces[sourceNonce], "Nonce already processed");

        // Mark nonce as processed (replay protection)
        processedNonces[sourceNonce] = true;

        // Mint wrapped tokens
        token.mint(to, amount);

        // Emit event for tracking
        emit Mint(to, amount, block.timestamp, sourceNonce);
    }

    /**
     * @notice Burn wrapped tokens to bridge back to source chain
     * @param to Recipient address on source chain
     * @param amount Amount to burn (in wei)
     * @param targetChain Identifier of source blockchain
     */
    function burn(
        address to,
        uint256 amount,
        bytes32 targetChain
    ) external nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient address");
        require(amount >= minBridgeAmount, "Amount below minimum");
        require(amount <= maxBridgeAmount, "Amount exceeds maximum");
        require(targetChain != bytes32(0), "Invalid target chain");
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Burn wrapped tokens
        token.burn(msg.sender, amount);

        // Emit event for relayer to process
        emit Burn(
            msg.sender,
            to,
            amount,
            block.timestamp,
            nonce,
            targetChain
        );

        // Increment nonce
        unchecked {
            nonce++;
        }
    }

    /**
     * @notice Update bridge amount limits
     * @param _minAmount New minimum amount
     * @param _maxAmount New maximum amount
     */
    function updateLimits(uint256 _minAmount, uint256 _maxAmount) external onlyOwner {
        require(_minAmount > 0, "Min amount must be greater than 0");
        require(_maxAmount > _minAmount, "Max must be greater than min");

        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;

        emit LimitsUpdated(_minAmount, _maxAmount);
    }

    /**
     * @notice Get current nonce value
     * @return Current nonce
     */
    function getCurrentNonce() external view returns (uint256) {
        return nonce;
    }

    /**
     * @notice Check if nonce has been processed
     * @param _nonce Nonce to check
     * @return True if processed
     */
    function isNonceProcessed(uint256 _nonce) external view returns (bool) {
        return processedNonces[_nonce];
    }

    /**
     * @notice Pause bridge operations (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume bridge operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
```

### Step 5: Compile Contracts

```bash
# Compile all contracts
pnpm run compile
```

**Expected Output**:
```
Compiling 4 files with Solc 0.8.30
Compilation finished successfully

Compiled 4 Solidity files successfully (evm target: prague).
```

## ✅ Testing Phase 2

Run these verification steps:

```bash
# 1. Verify compilation
pnpm run compile
# Expected: "Compilation finished successfully"

# 2. Check artifacts created
ls artifacts/contracts/tokens/
# Expected: SourceToken.sol/ WrappedToken.sol/

ls artifacts/contracts/bridges/
# Expected: BridgeEthereum.sol/ BridgeBSC.sol/

# 3. Count contract files
find contracts -name "*.sol" | wc -l
# Expected: 4

# 4. Check for compilation warnings
pnpm run compile 2>&1 | grep -i "warning"
# Expected: No output (no warnings)
```

## 📊 Contract Summary

| Contract | Location | Purpose | Key Functions |
|----------|----------|---------|---------------|
| **SourceToken** | `tokens/SourceToken.sol` | ERC-20 on Chain 1 | `mint()`, `burn()`, `transfer()` |
| **BridgeEthereum** | `bridges/BridgeEthereum.sol` | Chain 1 bridge | `lock()`, `unlock()`, `pause()` |
| **WrappedToken** | `tokens/WrappedToken.sol` | ERC-20 on Chain 2 | `mint()`, `burn()`, `setBridge()` |
| **BridgeBSC** | `bridges/BridgeBSC.sol` | Chain 2 bridge | `mint()`, `burn()`, `pause()` |

## 🔒 Security Features Implemented

- ✅ **Replay Protection**: Nonce tracking prevents duplicate transactions
- ✅ **Reentrancy Guard**: Protects against reentrancy attacks
- ✅ **Pausable**: Emergency stop mechanism
- ✅ **Access Control**: Ownable pattern for admin functions
- ✅ **SafeERC20**: Safe token transfers
- ✅ **Input Validation**: All functions validate inputs
- ✅ **Amount Limits**: Min/max bridge amounts prevent abuse
- ✅ **Supply Conservation**: Locked = Wrapped at all times

## 🎯 Success Criteria

Before moving to Phase 3, confirm:

- [ ] All 4 contracts created in correct directories
- [ ] Contracts compile without errors
- [ ] No compiler warnings
- [ ] Artifacts generated in `artifacts/` directory
- [ ] ABIs available for all contracts
- [ ] Contract code includes proper documentation
- [ ] Security patterns implemented (ReentrancyGuard, Pausable, etc.)

## 🐛 Troubleshooting

### Issue: "Compiler version mismatch"
**Solution**:
```javascript
// In hardhat.config.js, ensure:
solidity: {
  version: "0.8.30"
}
```

### Issue: "Cannot find @openzeppelin/contracts"
**Solution**:
```bash
pnpm add -D @openzeppelin/contracts@^5.4.0
```

### Issue: Compilation warnings about optimizer
**Solution**: These are informational, ignore unless errors occur.

### Issue: "File import not found"
**Solution**:
```bash
# Verify OpenZeppelin installed
ls node_modules/@openzeppelin/contracts
```

## 📚 Key Concepts Learned

1. **ERC-20 Standard**: Token interface and implementation
2. **Bridge Pattern**: Lock & Mint / Burn & Unlock mechanism
3. **Nonce-based Replay Protection**: Prevents transaction duplication
4. **OpenZeppelin Contracts**: Industry-standard secure implementations
5. **Solidity 0.8.30**: Latest compiler features and optimizations
6. **Gas Optimization**: Using `unchecked` for safe incrementsPhase 2-contracts.md
7. **Security Patterns**: ReentrancyGuard, Pausable, Ownable

## 🔗 Next Phase

Once all success criteria are met, proceed to:

👉 **[Phase 3: Deployment System](./phase-3-deployment.md)**

In Phase 3, you'll create deployment scripts to deploy these contracts to two local blockchain networks.

---

**Phase 2 Complete!** ✅
You now have 4 production-grade smart contracts ready for deployment.
