import hre from "hardhat";
const { ethers } = hre;

export async function deployBridgeFixture() {
  // Get signers
  const [deployer, user1, user2] = await ethers.getSigners();

  // Deploy SourceToken
  const SourceToken = await ethers.getContractFactory("SourceToken");
  const sourceToken = await SourceToken.deploy(1000000);
  await sourceToken.waitForDeployment();

  // Deploy BridgeEthereum
  const minAmount = ethers.parseEther("0.1");
  const maxAmount = ethers.parseEther("10000");
  const BridgeEthereum = await ethers.getContractFactory("BridgeEthereum");
  const bridgeEth = await BridgeEthereum.deploy(
    await sourceToken.getAddress(),
    minAmount,
    maxAmount
  );
  await bridgeEth.waitForDeployment();

  // Deploy WrappedToken
  const WrappedToken = await ethers.getContractFactory("WrappedToken");
  const wrappedToken = await WrappedToken.deploy("Wrapped BST", "wBST");
  await wrappedToken.waitForDeployment();

  // Deploy BridgeBSC
  const BridgeBSC = await ethers.getContractFactory("BridgeBSC");
  const bridgeBSC = await BridgeBSC.deploy(
    await wrappedToken.getAddress(),
    minAmount,
    maxAmount
  );
  await bridgeBSC.waitForDeployment();

  // Configure wrapped token
  await wrappedToken.setBridge(await bridgeBSC.getAddress());

  // Transfer tokens to test users
  await sourceToken.transfer(user1.address, ethers.parseEther("10000"));
  await sourceToken.transfer(user2.address, ethers.parseEther("10000"));

  return {
    sourceToken,
    bridgeEth,
    wrappedToken,
    bridgeBSC,
    deployer,
    user1,
    user2
  };
}
