// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockUniswapRouter
 * @notice Mock Uniswap router for testing
 */
contract MockUniswapRouter {
    bool public shouldFail;
    mapping(address => mapping(address => uint256)) public swapRates;

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function setSwapRate(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) external {
        swapRates[tokenIn][tokenOut] = (amountOut * 1e18) / amountIn;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        require(!shouldFail, "Swap failed");
        require(path.length == 2, "Invalid path");

        address tokenIn = path[0];
        address tokenOut = path[1];

        // Transfer tokenIn from sender
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Calculate output amount
        uint256 rate = swapRates[tokenIn][tokenOut];
        uint256 amountOut = rate > 0 ? (amountIn * rate) / 1e18 : (amountIn * 95) / 100; // Default 5% fee

        require(amountOut >= amountOutMin, "Insufficient output amount");

        // Transfer tokenOut to recipient
        IERC20(tokenOut).transfer(to, amountOut);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;

        return amounts;
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        require(path.length == 2, "Invalid path");

        address tokenIn = path[0];
        address tokenOut = path[1];

        uint256 rate = swapRates[tokenIn][tokenOut];
        uint256 amountOut = rate > 0 ? (amountIn * rate) / 1e18 : (amountIn * 95) / 100;

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;

        return amounts;
    }
}

