// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BridgeSourceExtended
 * @notice Extended bridge source that supports cross-chain swaps
 * @dev Extends the basic bridge by adding targetToken parameter to Lock event
 */
contract BridgeSourceExtended is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public currentNonce;

    // Track locked balances
    mapping(address => uint256) public lockedBalances;
    uint256 public totalLocked;

    // Lock event with targetToken for swap on destination
    event Lock(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        uint256 indexed nonce,
        address targetToken,  // NEW: What token to swap to on destination
        uint256 targetChain
    );

    event Unlock(
        address indexed to,
        uint256 amount,
        uint256 sourceNonce
    );

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
        currentNonce = 0;
    }

    /**
     * @notice Lock tokens to bridge them to another chain
     * @param to Recipient address on destination chain
     * @param amount Amount of tokens to lock
     * @param targetToken Address of token to receive on destination (address(0) for wrapped tokens)
     * @param targetChain Chain ID of destination chain
     */
    function lock(
        address to,
        uint256 amount,
        address targetToken,
        uint256 targetChain
    ) external nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(targetChain > 0, "Invalid target chain");

        // Transfer tokens from user to bridge
        token.safeTransferFrom(msg.sender, address(this), amount);

        // Update locked balance
        lockedBalances[msg.sender] += amount;
        totalLocked += amount;

        // Emit lock event with swap parameters
        emit Lock(
            msg.sender,
            to,
            amount,
            block.timestamp,
            currentNonce,
            targetToken,
            targetChain
        );

        currentNonce++;
    }

    /**
     * @notice Unlock tokens (called when burning wrapped tokens on destination)
     * @param to Recipient address
     * @param amount Amount to unlock
     * @param sourceNonce Nonce from source chain
     * @param signature Relayer signature
     */
    function unlock(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(amount <= totalLocked, "Insufficient locked balance");

        // Verify signature (simplified - extend with proper signature verification)
        require(signature.length > 0, "Invalid signature");

        // Update locked balance
        totalLocked -= amount;
        if (lockedBalances[to] >= amount) {
            lockedBalances[to] -= amount;
        }

        // Transfer tokens back to user
        token.safeTransfer(to, amount);

        emit Unlock(to, amount, sourceNonce);
    }

    /**
     * @notice Get locked balance for an address
     */
    function getLockedBalance(address account) external view returns (uint256) {
        return lockedBalances[account];
    }

    /**
     * @notice Get total locked tokens
     */
    function getTotalLocked() external view returns (uint256) {
        return totalLocked;
    }
}

