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
     * @dev Signature parameter reserved for future multi-sig implementation
     */
    function mint(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory /* signature */
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
