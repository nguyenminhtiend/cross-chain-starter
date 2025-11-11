import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("\n🧪 Testing Bridge Transfer\n");

  const chain1Provider = new ethers.JsonRpcProvider(process.env.CHAIN1_RPC);
  const [user] = await ethers.getSigners();
  const wallet1 = user.connect(chain1Provider);

  const sourceToken = await ethers.getContractAt(
    "SourceToken",
    process.env.CHAIN1_TOKEN_ADDRESS,
    wallet1
  );

  const bridgeEth = await ethers.getContractAt(
    "BridgeEthereum",
    process.env.CHAIN1_BRIDGE_ADDRESS,
    wallet1
  );

  const amount = ethers.parseEther("100");
  const targetChain = ethers.id("CHAIN2");

  console.log("1. Approving bridge...");
  await sourceToken.approve(process.env.CHAIN1_BRIDGE_ADDRESS, amount);

  console.log("2. Locking tokens...");
  const tx = await bridgeEth.lock(wallet1.address, amount, targetChain);
  console.log(`   TX: ${tx.hash}`);
  await tx.wait();

  console.log("3. Waiting for relayer to process...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const chain2Provider = new ethers.JsonRpcProvider(process.env.CHAIN2_RPC);
  const wrappedToken = await ethers.getContractAt(
    "WrappedToken",
    process.env.CHAIN2_TOKEN_ADDRESS,
    chain2Provider
  );

  const balance = await wrappedToken.balanceOf(wallet1.address);
  console.log(`\n✅ Success! Balance on Chain 2: ${ethers.formatEther(balance)} wBST\n`);
}

main().catch(console.error);
