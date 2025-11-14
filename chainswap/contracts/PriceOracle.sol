// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @notice Price oracle using Chainlink data feeds
 * @dev Used for calculating swap amounts and slippage protection
 */
contract PriceOracle is Ownable {
    // Token address => Chainlink price feed
    mapping(address => AggregatorV3Interface) public priceFeeds;

    // Maximum age of price data (1 hour)
    uint256 public constant MAX_PRICE_AGE = 1 hours;

    event PriceFeedUpdated(address indexed token, address indexed feed);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set price feed for a token
     * @param token Token address
     * @param feed Chainlink price feed address
     */
    function setPriceFeed(address token, address feed) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(feed != address(0), "Invalid feed");

        priceFeeds[token] = AggregatorV3Interface(feed);
        emit PriceFeedUpdated(token, feed);
    }

    /**
     * @notice Get latest price for a token in USD
     * @param token Token address
     * @return price Price in USD (8 decimals)
     */
    function getPrice(address token) public view returns (int256 price) {
        AggregatorV3Interface priceFeed = priceFeeds[token];
        require(address(priceFeed) != address(0), "Price feed not found");

        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        // Validate price data
        require(answer > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price");
        require(block.timestamp - updatedAt < MAX_PRICE_AGE, "Price too old");

        return answer;
    }

    /**
     * @notice Calculate expected swap output
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @return expectedOut Expected output amount
     * @return minOut Minimum output with 1% slippage
     */
    function calculateSwapOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 expectedOut, uint256 minOut) {
        int256 priceIn = getPrice(tokenIn);
        int256 priceOut = getPrice(tokenOut);

        require(priceIn > 0 && priceOut > 0, "Invalid prices");

        // Calculate expected output
        // expectedOut = amountIn * priceIn / priceOut
        expectedOut = (amountIn * uint256(priceIn)) / uint256(priceOut);

        // Apply 1% slippage tolerance
        minOut = (expectedOut * 99) / 100;
    }

    /**
     * @notice Get price with decimals info
     * @param token Token address
     * @return price Price value
     * @return decimals Number of decimals
     */
    function getPriceWithDecimals(address token) external view returns (int256 price, uint8 decimals) {
        AggregatorV3Interface priceFeed = priceFeeds[token];
        require(address(priceFeed) != address(0), "Price feed not found");

        price = getPrice(token);
        decimals = priceFeed.decimals();
    }

    /**
     * @notice Check if price feed exists for token
     */
    function hasPriceFeed(address token) external view returns (bool) {
        return address(priceFeeds[token]) != address(0);
    }
}

