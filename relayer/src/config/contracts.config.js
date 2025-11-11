const BRIDGE_ABI = [
  "event Lock(address indexed from, address indexed to, uint256 amount, uint256 timestamp, uint256 indexed nonce, bytes32 targetChain)",
  "event Unlock(address indexed to, uint256 amount, uint256 timestamp, uint256 indexed sourceNonce)",
  "event Mint(address indexed to, uint256 amount, uint256 timestamp, uint256 indexed sourceNonce)",
  "event Burn(address indexed from, address indexed to, uint256 amount, uint256 timestamp, uint256 indexed nonce, bytes32 targetChain)",
  "function unlock(address to, uint256 amount, uint256 sourceNonce, bytes memory signature) external",
  "function mint(address to, uint256 amount, uint256 sourceNonce, bytes memory signature) external",
  "function processedNonces(uint256) view returns (bool)",
  "function nonce() view returns (uint256)",
  "function paused() view returns (bool)"
];

module.exports = {
  chain1: {
    bridgeAddress: process.env.CHAIN1_BRIDGE_ADDRESS,
    tokenAddress: process.env.CHAIN1_TOKEN_ADDRESS,
    bridgeABI: BRIDGE_ABI
  },
  chain2: {
    bridgeAddress: process.env.CHAIN2_BRIDGE_ADDRESS,
    tokenAddress: process.env.CHAIN2_TOKEN_ADDRESS,
    bridgeABI: BRIDGE_ABI
  }
};
