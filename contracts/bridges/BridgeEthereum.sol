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
     * @dev Signature parameter reserved for future multi-sig implementation
     */
    function unlock(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory /* signature */
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
