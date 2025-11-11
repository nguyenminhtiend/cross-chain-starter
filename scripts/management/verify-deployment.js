import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("VERIFYING DEPLOYMENT");
  console.log("=".repeat(80) + "\n");

  // Load deployment files
  const chain1Path = path.join(__dirname, "../../deployments/chain1.json");
  const chain2Path = path.join(__dirname, "../../deployments/chain2.json");

  if (!fs.existsSync(chain1Path)) {
    console.log("❌ Chain 1 deployment file not found");
    process.exit(1);
  }

  if (!fs.existsSync(chain2Path)) {
    console.log("❌ Chain 2 deployment file not found");
    process.exit(1);
  }

  const chain1 = JSON.parse(fs.readFileSync(chain1Path, "utf8"));
  const chain2 = JSON.parse(fs.readFileSync(chain2Path, "utf8"));

  console.log("✅ Deployment files found");
  console.log("\n📊 Chain 1 (Ethereum):");
  console.log("   Network:", chain1.network);
  console.log("   Chain ID:", chain1.chainId);
  console.log("   Deployer:", chain1.deployer);
  console.log("   Timestamp:", chain1.timestamp);
  console.log("\n   Contracts:");
  console.log("   - SourceToken:    ", chain1.contracts.SourceToken.address);
  console.log("   - BridgeEthereum: ", chain1.contracts.BridgeEthereum.address);

  console.log("\n📊 Chain 2 (BSC):");
  console.log("   Network:", chain2.network);
  console.log("   Chain ID:", chain2.chainId);
  console.log("   Deployer:", chain2.deployer);
  console.log("   Timestamp:", chain2.timestamp);
  console.log("\n   Contracts:");
  console.log("   - WrappedToken:   ", chain2.contracts.WrappedToken.address);
  console.log("   - BridgeBSC:      ", chain2.contracts.BridgeBSC.address);

  console.log("\n" + "=".repeat(80));
  console.log("✅ VERIFICATION COMPLETE");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
