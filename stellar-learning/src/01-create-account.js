const StellarSdk = require('@stellar/stellar-sdk');

// Configure for Testnet
const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

async function createAccount() {
  try {
    // Step 1: Generate a random keypair
    const pair = StellarSdk.Keypair.random();

    console.log('= New Keypair Generated!');
    console.log('Public Key (Address):', pair.publicKey());
    console.log('Secret Key (SAVE THIS!):', pair.secret());
    console.log('');

    // Step 2: Fund account using Friendbot (testnet only)
    console.log('=° Funding account via Friendbot...');
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(pair.publicKey())}`
    );

    if (!response.ok) {
      throw new Error('Friendbot funding failed');
    }

    console.log(' Account funded successfully!');
    console.log('');

    // Step 3: Load account from Horizon
    const account = await server.loadAccount(pair.publicKey());

    console.log('=Ê Account Details:');
    console.log('Account ID:', account.accountId());
    console.log('Sequence Number:', account.sequenceNumber());
    console.log('');

    // Step 4: Display balances
    console.log('=µ Balances:');
    account.balances.forEach((balance) => {
      console.log(`  ${balance.asset_type === 'native' ? 'XLM' : balance.asset_code}: ${balance.balance}`);
    });

    return pair;
  } catch (error) {
    console.error('L Error:', error.message);
    throw error;
  }
}

// Run the function
createAccount()
  .then(() => console.log('\n( Account creation complete!'))
  .catch(err => console.error('Fatal error:', err));
