/**
 * Lock ETH Client
 * User interface for locking ETH on Ethereum to receive wETH on Stellar
 */

const { ethers } = require('ethers');
const { config } = require('../config');

// Bridge ABI
const BRIDGE_ABI = [
  'function lock(string memory stellarAddress) external payable',
  'function getBalance() external view returns (uint256)',
  'function lockNonce() external view returns (uint256)',
];

/**
 * Lock ETH to bridge to Stellar
 */
async function lockETH(amountInEth, stellarAddress, userPrivateKey = null) {
  console.log('🔒 Locking ETH on Ethereum');
  console.log('═'.repeat(50));

  try {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    const privateKey = userPrivateKey || config.ethereum.userKey;

    if (!privateKey) {
      throw new Error('No user private key provided. Set ETH_USER_KEY in .env or pass as parameter');
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    // Validate inputs
    const amount = parseFloat(amountInEth);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (amount < parseFloat(config.bridge.minLockAmount)) {
      throw new Error(`Amount must be at least ${config.bridge.minLockAmount} ETH`);
    }

    if (amount > parseFloat(config.bridge.maxLockAmount)) {
      throw new Error(`Amount must not exceed ${config.bridge.maxLockAmount} ETH`);
    }

    console.log('\n📋 Transaction Details:');
    console.log('   From:', wallet.address);
    console.log('   Amount:', amountInEth, 'ETH');
    console.log('   Stellar Address:', stellarAddress);
    console.log('   Bridge:', config.ethereum.bridgeAddress);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    const requiredAmount = ethers.parseEther(amountInEth);

    console.log('\n💰 Wallet Balance:', ethers.formatEther(balance), 'ETH');

    if (balance < requiredAmount) {
      throw new Error('Insufficient ETH balance');
    }

    // Connect to bridge contract
    const bridge = new ethers.Contract(
      config.ethereum.bridgeAddress,
      BRIDGE_ABI,
      wallet
    );

    // Estimate gas
    console.log('\n⛽ Estimating gas...');
    const gasEstimate = await bridge.lock.estimateGas(stellarAddress, {
      value: requiredAmount,
    });

    const feeData = await provider.getFeeData();
    const estimatedFee = gasEstimate * feeData.gasPrice;

    console.log('   Gas Estimate:', gasEstimate.toString());
    console.log('   Estimated Fee:', ethers.formatEther(estimatedFee), 'ETH');

    // Send transaction
    console.log('\n📤 Sending transaction...');

    const tx = await bridge.lock(stellarAddress, {
      value: requiredAmount,
      gasLimit: gasEstimate * 120n / 100n, // 20% buffer
    });

    console.log('✅ Transaction sent!');
    console.log('   TX Hash:', tx.hash);
    console.log('   Block Explorer: https://sepolia.etherscan.io/tx/' + tx.hash);

    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    console.log('\n✅ Transaction Confirmed!');
    console.log('   Block Number:', receipt.blockNumber);
    console.log('   Gas Used:', receipt.gasUsed.toString());
    console.log('   Effective Gas Price:', ethers.formatUnits(receipt.gasPrice, 'gwei'), 'gwei');

    // Parse events
    const lockEvent = receipt.logs.find(log => {
      try {
        const parsed = bridge.interface.parseLog(log);
        return parsed.name === 'Locked';
      } catch {
        return false;
      }
    });

    if (lockEvent) {
      const parsed = bridge.interface.parseLog(lockEvent);
      console.log('\n🔒 Lock Event:');
      console.log('   Lock ID:', parsed.args.lockId.toString());
      console.log('   Amount:', ethers.formatEther(parsed.args.amount), 'ETH');
    }

    console.log('\n💫 Next Steps:');
    console.log('   1. Wait for relayer to process the lock event (~10-30 seconds)');
    console.log('   2. wETH will be minted to your Stellar address');
    console.log('   3. Check your Stellar balance for wETH');
    console.log(`\n🔍 Monitor on Stellar Expert:`);
    console.log(`   https://stellar.expert/explorer/testnet/account/${stellarAddress}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      lockId: lockEvent ? parsed.args.lockId.toString() : null,
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.reason) {
      console.error('   Reason:', error.reason);
    }
    if (error.code) {
      console.error('   Code:', error.code);
    }
    throw error;
  }
}

/**
 * Check bridge balance
 */
async function checkBridgeBalance() {
  try {
    const provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    const bridge = new ethers.Contract(
      config.ethereum.bridgeAddress,
      BRIDGE_ABI,
      provider
    );

    const balance = await bridge.getBalance();
    const lockCount = await bridge.lockNonce();

    console.log('📊 Bridge Statistics:');
    console.log('   Total Locked:', ethers.formatEther(balance), 'ETH');
    console.log('   Lock Count:', lockCount.toString());

    return {
      balance: ethers.formatEther(balance),
      lockCount: lockCount.toString(),
    };
  } catch (error) {
    console.error('❌ Error fetching bridge stats:', error.message);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'stats') {
    checkBridgeBalance().catch(console.error);
  } else if (args.length >= 2) {
    const [amount, stellarAddress] = args;
    lockETH(amount, stellarAddress).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  Lock ETH:    node lock-eth.js <amount> <stellar-address>');
    console.log('  Check stats: node lock-eth.js stats');
    console.log('\nExample:');
    console.log('  node lock-eth.js 0.01 GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  }
}

module.exports = {
  lockETH,
  checkBridgeBalance,
};
