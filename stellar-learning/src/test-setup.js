const StellarSdk = require('@stellar/stellar-sdk');

console.log(' Stellar SDK version:', StellarSdk.version);
console.log(' Node version:', process.version);

// Test network connection
const server = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

server.ledgers()
  .limit(1)
  .call()
  .then((response) => {
    console.log(' Connected to Horizon testnet');
    console.log('Latest ledger:', response.records[0].sequence);
  })
  .catch((error) => {
    console.error('L Connection failed:', error.message);
  });
