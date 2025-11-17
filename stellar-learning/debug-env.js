console.log('Current directory:', process.cwd());
console.log('Script location:', __dirname);
console.log('');

// Try loading dotenv
console.log('Loading dotenv...');
const result = require('dotenv').config();

console.log('');
console.log('Dotenv result:');
console.log('  Error:', result.error);
console.log('  Parsed keys:', result.parsed ? Object.keys(result.parsed) : 'null');
console.log('');

console.log('Environment variables:');
console.log('  TESTNET_PUBLIC_KEY:', process.env.TESTNET_PUBLIC_KEY);
console.log('  TESTNET_SECRET_KEY:', process.env.TESTNET_SECRET_KEY ? '(exists)' : 'undefined');
console.log('');

// Try loading with explicit path
console.log('Trying explicit path...');
const path = require('path');
const envPath = path.join(__dirname, '.env');
console.log('  .env path:', envPath);

const fs = require('fs');
console.log('  .env exists:', fs.existsSync(envPath));

const result2 = require('dotenv').config({ path: envPath });
console.log('  Result:', result2.error ? result2.error.message : 'Success');
console.log('  TESTNET_PUBLIC_KEY:', process.env.TESTNET_PUBLIC_KEY);
