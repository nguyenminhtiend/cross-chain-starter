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
