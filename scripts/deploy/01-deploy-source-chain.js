import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('DEPLOYING TO CHAIN 1 (Source Chain - Ethereum Simulation)');
  console.log('='.repeat(80) + '\n');

  // Connect to the local network
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const deployer = ethers.Wallet.fromPhrase(
    'test test test test test test test test test test test junk'
  ).connect(provider);
  console.log('Deploying with account:', deployer.address);

  const balance = await provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH\n');

  // Load contract artifacts
  const tokenArtifactPath = path.join(
    __dirname,
    '../../artifacts/contracts/tokens/SourceToken.sol/SourceToken.json'
  );
  const tokenArtifact = JSON.parse(fs.readFileSync(tokenArtifactPath, 'utf8'));

  const bridgeArtifactPath = path.join(
    __dirname,
    '../../artifacts/contracts/bridges/BridgeEthereum.sol/BridgeEthereum.json'
  );
  const bridgeArtifact = JSON.parse(fs.readFileSync(bridgeArtifactPath, 'utf8'));

  // Get the correct starting nonce (use pending to avoid stale nonce issues)
  const startingNonce = await provider.getTransactionCount(deployer.address, 'pending');
  console.log('Starting nonce:', startingNonce);

  // Deploy SourceToken
  console.log('\n1️⃣  Deploying SourceToken...');
  const initialSupply = 1_000_000; // 1 million tokens

  const SourceTokenFactory = new ethers.ContractFactory(
    tokenArtifact.abi,
    tokenArtifact.bytecode,
    deployer
  );
  const sourceToken = await SourceTokenFactory.deploy(initialSupply, { nonce: startingNonce });
  await sourceToken.waitForDeployment();
  const sourceTokenAddress = await sourceToken.getAddress();
  console.log('✅ SourceToken deployed:', sourceTokenAddress);

  // Verify token properties
  const name = await sourceToken.name();
  const symbol = await sourceToken.symbol();
  const decimals = await sourceToken.decimals();
  const totalSupply = await sourceToken.totalSupply();

  console.log('\n   Token Properties:');
  console.log('   - Name:', name);
  console.log('   - Symbol:', symbol);
  console.log('   - Decimals:', decimals);
  console.log('   - Total Supply:', ethers.formatUnits(totalSupply, decimals));

  // Get current nonce after first deployment
  const currentNonce = await provider.getTransactionCount(deployer.address);
  console.log('\n📝 Current nonce:', currentNonce);

  // Deploy BridgeEthereum
  console.log('\n2️⃣  Deploying BridgeEthereum...');
  const minAmount = ethers.parseEther('0.1'); // 0.1 tokens minimum
  const maxAmount = ethers.parseEther('10000'); // 10,000 tokens maximum

  const BridgeEthereumFactory = new ethers.ContractFactory(
    bridgeArtifact.abi,
    bridgeArtifact.bytecode,
    deployer
  );
  const bridgeEthereum = await BridgeEthereumFactory.deploy(
    sourceTokenAddress,
    minAmount,
    maxAmount,
    { nonce: startingNonce + 1 }
  );
  await bridgeEthereum.waitForDeployment();
  const bridgeEthereumAddress = await bridgeEthereum.getAddress();
  console.log('✅ BridgeEthereum deployed:', bridgeEthereumAddress);

  console.log('\n   Bridge Configuration:');
  console.log('   - Token:', sourceTokenAddress);
  console.log('   - Min Amount:', ethers.formatEther(minAmount), 'tokens');
  console.log('   - Max Amount:', ethers.formatEther(maxAmount), 'tokens');
  console.log('   - Initial Nonce:', await bridgeEthereum.nonce());

  // Save deployment info
  const deployment = {
    network: 'chain1',
    chainId: (await provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      SourceToken: {
        address: sourceTokenAddress,
        name,
        symbol,
        decimals: decimals.toString(),
        initialSupply: initialSupply.toString()
      },
      BridgeEthereum: {
        address: bridgeEthereumAddress,
        token: sourceTokenAddress,
        minAmount: minAmount.toString(),
        maxAmount: maxAmount.toString()
      }
    }
  };

  const deploymentsDir = path.join(__dirname, '../../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, 'chain1.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log('\n💾 Deployment info saved to:', deploymentPath);

  console.log('\n' + '='.repeat(80));
  console.log('✅ CHAIN 1 DEPLOYMENT COMPLETE');
  console.log('='.repeat(80) + '\n');

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
