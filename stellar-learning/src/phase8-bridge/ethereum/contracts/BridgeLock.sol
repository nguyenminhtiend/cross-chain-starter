// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * BridgeLock Contract
 * Locks ETH on Ethereum to mint wETH on Stellar
 * Unlocks ETH when wETH is burned on Stellar
 *
 * Security Features:
 * - Multi-sig validator approval system
 * - Reentrancy protection
 * - Rate limiting
 * - Maximum transaction limits
 * - Request ID uniqueness
 */

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BridgeLock is ReentrancyGuard, AccessControl {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // Lock event structure
    struct LockEvent {
        address sender;
        uint256 amount;
        string stellarAddress;
        uint256 timestamp;
        bool processed;
    }

    // Unlock request structure
    struct UnlockRequest {
        address recipient;
        uint256 amount;
        bytes32 stellarTxHash;
        uint256 approvals;
        bool executed;
        mapping(address => bool) hasApproved;
    }

    // State variables
    mapping(uint256 => LockEvent) public locks;
    mapping(bytes32 => UnlockRequest) public unlocks;
    mapping(address => uint256) public lastLockTime;

    uint256 public lockNonce;
    uint256 public requiredApprovals;
    uint256 public constant MAX_LOCK_AMOUNT = 10 ether;
    uint256 public constant MIN_LOCK_AMOUNT = 0.001 ether;
    uint256 public constant LOCK_COOLDOWN = 10; // 10 seconds between locks

    // Events
    event Locked(
        uint256 indexed lockId,
        address indexed sender,
        uint256 amount,
        string stellarAddress,
        uint256 timestamp
    );

    event Unlocked(
        bytes32 indexed requestId,
        address indexed recipient,
        uint256 amount,
        bytes32 stellarTxHash
    );

    event UnlockApproved(
        bytes32 indexed requestId,
        address indexed validator,
        uint256 currentApprovals,
        uint256 requiredApprovals
    );

    constructor(uint256 _requiredApprovals) {
        require(_requiredApprovals > 0, "Invalid approval count");
        requiredApprovals = _requiredApprovals;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * Lock ETH to bridge to Stellar
     * User sends ETH with their Stellar address
     * Bridge will mint wETH on Stellar
     */
    function lock(string memory stellarAddress) external payable nonReentrant {
        require(msg.value >= MIN_LOCK_AMOUNT, "Amount too small");
        require(msg.value <= MAX_LOCK_AMOUNT, "Amount exceeds limit");
        require(bytes(stellarAddress).length > 0, "Invalid Stellar address");
        require(
            block.timestamp >= lastLockTime[msg.sender] + LOCK_COOLDOWN,
            "Cooldown not elapsed"
        );

        uint256 lockId = lockNonce++;
        locks[lockId] = LockEvent({
            sender: msg.sender,
            amount: msg.value,
            stellarAddress: stellarAddress,
            timestamp: block.timestamp,
            processed: false
        });

        lastLockTime[msg.sender] = block.timestamp;

        emit Locked(lockId, msg.sender, msg.value, stellarAddress, block.timestamp);
    }

    /**
     * Validators approve unlock requests
     * Multiple validators must approve before execution
     */
    function approveUnlock(
        bytes32 requestId,
        address recipient,
        uint256 amount,
        bytes32 stellarTxHash
    ) external onlyRole(VALIDATOR_ROLE) nonReentrant {
        UnlockRequest storage request = unlocks[requestId];

        // Initialize request on first approval
        if (request.recipient == address(0)) {
            require(recipient != address(0), "Invalid recipient");
            require(amount > 0, "Invalid amount");

            request.recipient = recipient;
            request.amount = amount;
            request.stellarTxHash = stellarTxHash;
        } else {
            // Verify consistency across validators
            require(request.recipient == recipient, "Recipient mismatch");
            require(request.amount == amount, "Amount mismatch");
            require(request.stellarTxHash == stellarTxHash, "Tx hash mismatch");
        }

        require(!request.hasApproved[msg.sender], "Already approved");
        require(!request.executed, "Already executed");

        request.hasApproved[msg.sender] = true;
        request.approvals++;

        emit UnlockApproved(requestId, msg.sender, request.approvals, requiredApprovals);

        // Execute if threshold reached
        if (request.approvals >= requiredApprovals) {
            _executeUnlock(requestId);
        }
    }

    /**
     * Internal function to execute unlock
     * Sends ETH to recipient
     */
    function _executeUnlock(bytes32 requestId) private {
        UnlockRequest storage request = unlocks[requestId];
        require(!request.executed, "Already executed");
        require(address(this).balance >= request.amount, "Insufficient balance");

        request.executed = true;

        (bool success, ) = request.recipient.call{value: request.amount}("");
        require(success, "Transfer failed");

        emit Unlocked(requestId, request.recipient, request.amount, request.stellarTxHash);
    }

    /**
     * Admin function to add validator
     */
    function addValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(validator != address(0), "Invalid validator");
        grantRole(VALIDATOR_ROLE, validator);
    }

    /**
     * Admin function to remove validator
     */
    function removeValidator(address validator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(VALIDATOR_ROLE, validator);
    }

    /**
     * Admin function to update required approvals
     */
    function updateRequiredApprovals(uint256 _requiredApprovals)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_requiredApprovals > 0, "Invalid approval count");
        requiredApprovals = _requiredApprovals;
    }

    /**
     * Get unlock request details
     */
    function getUnlockRequest(bytes32 requestId)
        external
        view
        returns (
            address recipient,
            uint256 amount,
            bytes32 stellarTxHash,
            uint256 approvals,
            bool executed
        )
    {
        UnlockRequest storage request = unlocks[requestId];
        return (
            request.recipient,
            request.amount,
            request.stellarTxHash,
            request.approvals,
            request.executed
        );
    }

    /**
     * Check if validator has approved a request
     */
    function hasValidatorApproved(bytes32 requestId, address validator)
        external
        view
        returns (bool)
    {
        return unlocks[requestId].hasApproved[validator];
    }

    /**
     * Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * Receive function to accept ETH
     */
    receive() external payable {}
}
