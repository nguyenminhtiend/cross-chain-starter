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
