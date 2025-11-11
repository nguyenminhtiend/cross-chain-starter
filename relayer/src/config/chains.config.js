module.exports = {
  chain1: {
    name: "Ethereum (Local)",
    rpcUrl: process.env.CHAIN1_RPC || "http://127.0.0.1:8545",
    chainId: 31337,
    confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS) || 1,
    pollingInterval: parseInt(process.env.RELAYER_POLL_INTERVAL) || 2000
  },
  chain2: {
    name: "BSC (Local)",
    rpcUrl: process.env.CHAIN2_RPC || "http://127.0.0.1:8546",
    chainId: 31338,
    confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS) || 1,
    pollingInterval: parseInt(process.env.RELAYER_POLL_INTERVAL) || 2000
  },
  relayer: {
    privateKey: process.env.RELAYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  }
};
