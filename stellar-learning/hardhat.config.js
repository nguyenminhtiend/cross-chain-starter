require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config({ path: './src/phase8-bridge/.env' });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./src/phase8-bridge/ethereum/contracts",
    tests: "./src/phase8-bridge/ethereum/test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    // Local Hardhat network for testing
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10
      }
    },
    // Localhost network (for manual local node)
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    // Sepolia testnet (optional - requires ETH)
    sepolia: {
      url: process.env.ETH_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: process.env.ETH_PRIVATE_KEY ? [process.env.ETH_PRIVATE_KEY] : [],
      chainId: 11155111
    }
  },
  // Gas reporter for optimization
  gasReporter: {
    enabled: true,
    currency: 'USD',
  }
};
