// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IWrappedToken.sol";
import "../interfaces/IUniswapV2Router02.sol";

/**
 * @title ChainSwapBridge
 * @notice Destination bridge that mints wrapped tokens and optionally swaps them
 * @dev Integrates with Uniswap V2 for token swaps
 */
contract ChainSwapBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWrappedToken public immutable wrappedToken;
    IUniswapV2Router02 public immutable uniswapRouter;

    // Track processed nonces to prevent replay attacks
    mapping(uint256 => bool) public processedNonces;

    // Slippage tolerance (in basis points, 100 = 1%)
    uint256 public slippageTolerance = 100; // 1% default

    event Mint(
        address indexed to,
        uint256 amount,
        uint256 sourceNonce
    );

    event MintAndSwap(
        address indexed to,
        uint256 amountIn,
        uint256 amountOut,
        address indexed tokenOut,
        uint256 sourceNonce
    );

    event Burn(
        address indexed from,
        uint256 amount,
        uint256 nonce,
        address indexed targetAddress,
        uint256 targetChain
    );

    event SwapFailed(
        address indexed to,
        uint256 amount,
        uint256 sourceNonce,
        string reason
    );

    constructor(
        address _wrappedToken,
        address _uniswapRouter
    ) Ownable(msg.sender) {
        require(_wrappedToken != address(0), "Invalid wrapped token");
        require(_uniswapRouter != address(0), "Invalid router");

        wrappedToken = IWrappedToken(_wrappedToken);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    /**
     * @notice Mint wrapped tokens (no swap)
     * @param to Recipient address
     * @param amount Amount to mint
     * @param sourceNonce Nonce from source chain
     * @param signature Relayer signature
     */
    function mint(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature
    ) external onlyOwner nonReentrant {
        require(!processedNonces[sourceNonce], "Already processed");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        // Verify signature (simplified - extend with proper verification)
        require(signature.length > 0, "Invalid signature");

        // Mark as processed
        processedNonces[sourceNonce] = true;

        // Mint wrapped tokens to recipient
        wrappedToken.mint(to, amount);

        emit Mint(to, amount, sourceNonce);
    }

    /**
     * @notice Mint wrapped tokens and swap them
     * @param to Recipient address
     * @param amount Amount to mint
     * @param sourceNonce Nonce from source chain
     * @param signature Relayer signature
     * @param targetToken Token to receive after swap
     * @param minAmountOut Minimum amount to receive (slippage protection)
     */
    function mintAndSwap(
        address to,
        uint256 amount,
        uint256 sourceNonce,
        bytes memory signature,
        address targetToken,
        uint256 minAmountOut
    ) external onlyOwner nonReentrant {
        require(!processedNonces[sourceNonce], "Already processed");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(targetToken != address(0), "Invalid target token");

        // Verify signature (simplified - extend with proper verification)
        require(signature.length > 0, "Invalid signature");

        // Mark as processed
        processedNonces[sourceNonce] = true;

        // Mint wrapped tokens to this contract (not to user yet)
        wrappedToken.mint(address(this), amount);

        // Try to swap
        if (targetToken != address(0)) {
            try this._executeSwap(amount, targetToken, minAmountOut, to) returns (uint256 amountOut) {
                emit MintAndSwap(to, amount, amountOut, targetToken, sourceNonce);
            } catch Error(string memory reason) {
                // Swap failed, send wrapped tokens instead
                IERC20(address(wrappedToken)).safeTransfer(to, amount);
                emit SwapFailed(to, amount, sourceNonce, reason);
            } catch {
                // Unknown error, send wrapped tokens instead
                IERC20(address(wrappedToken)).safeTransfer(to, amount);
                emit SwapFailed(to, amount, sourceNonce, "Unknown error");
            }
        } else {
            // No swap needed
            IERC20(address(wrappedToken)).safeTransfer(to, amount);
            emit Mint(to, amount, sourceNonce);
        }
    }

    /**
     * @notice Execute swap on Uniswap (internal function for try-catch)
     * @dev Must be external to use try-catch
     */
    function _executeSwap(
        uint256 amountIn,
        address tokenOut,
        uint256 minAmountOut,
        address recipient
    ) external onlyOwner returns (uint256) {
        require(msg.sender == address(this), "Internal only");

        // Approve Uniswap router
        IERC20(address(wrappedToken)).safeIncreaseAllowance(address(uniswapRouter), amountIn);

        // Define swap path
        address[] memory path = new address[](2);
        path[0] = address(wrappedToken);
        path[1] = tokenOut;

        // Execute swap
        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            block.timestamp + 300 // 5 minute deadline
        );

        return amounts[1]; // Return amount out
    }

    /**
     * @notice Burn wrapped tokens to bridge back
     * @param amount Amount to burn
     * @param targetAddress Address on target chain
     * @param targetChain Target chain ID
     */
    function burn(
        uint256 amount,
        address targetAddress,
        uint256 targetChain
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(targetAddress != address(0), "Invalid target address");
        require(targetChain > 0, "Invalid target chain");

        // Transfer wrapped tokens from user to this contract
        IERC20(address(wrappedToken)).safeTransferFrom(msg.sender, address(this), amount);

        // Burn the wrapped tokens
        wrappedToken.burn(amount);

        emit Burn(msg.sender, amount, block.number, targetAddress, targetChain);
    }

    /**
     * @notice Get expected output amount for a swap
     * @param amountIn Input amount
     * @param tokenIn Input token
     * @param tokenOut Output token
     */
    function getExpectedOutput(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = uniswapRouter.getAmountsOut(amountIn, path);
        return amounts[1];
    }

    /**
     * @notice Update slippage tolerance
     * @param newTolerance New tolerance in basis points
     */
    function setSlippageTolerance(uint256 newTolerance) external onlyOwner {
        require(newTolerance <= 1000, "Max 10% slippage"); // Max 10%
        slippageTolerance = newTolerance;
    }

    /**
     * @notice Check if nonce is processed
     */
    function isProcessed(uint256 nonce) external view returns (bool) {
        return processedNonces[nonce];
    }
}

