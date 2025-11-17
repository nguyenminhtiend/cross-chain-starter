const StellarSdk = require('@stellar/stellar-sdk');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

async function checkBalance(publicKey) {
  try {
    console.log(`=
 Checking balance for: ${publicKey}\n`);

    const account = await server.loadAccount(publicKey);

    console.log('=� Balances:');
    account.balances.forEach((balance) => {
      if (balance.asset_type === 'native') {
        console.log(`  XLM (native): ${balance.balance}`);
      } else {
        console.log(`  ${balance.asset_code} (${balance.asset_issuer}): ${balance.balance}`);
      }
    });

    console.log('\n=� Account Stats:');
    console.log(`  Sequence: ${account.sequence}`);
    console.log(`  Subentry Count: ${account.subentry_count}`);
    console.log(`  Num Signers: ${account.signers.length}`);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('L Account not found. Has it been funded?');
    } else {
      console.error('L Error:', error.message);
    }
  }
}

// Replace with your public key from step 1
const myPublicKey = 'GB6PZTMZQ3OK57434NDGYSF47STNOALB6VKI7MB6OHQNAIZZV5LUEA2M';
checkBalance(myPublicKey);
