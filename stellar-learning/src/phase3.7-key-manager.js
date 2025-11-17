const StellarSdk = require('@stellar/stellar-sdk');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

/**
 * KeyManager - Secure Stellar keypair management
 *
 * Features:
 * - Generate and store keypairs
 * - Encrypted storage with AES-256-CBC
 * - Label-based key retrieval
 * - Import/export functionality
 * - Audit trail
 */
class KeyManager {
  constructor() {
    this.keys = {};
    this.auditLog = [];
  }

  /**
   * Generate a new random keypair
   */
  generateKeypair(label) {
    if (this.keys[label]) {
      throw new Error(`Keypair with label "${label}" already exists`);
    }

    const pair = StellarSdk.Keypair.random();
    this.keys[label] = {
      public: pair.publicKey(),
      secret: pair.secret(),
      created: new Date().toISOString(),
      type: 'random'
    };

    this.logAudit('generate', label);
    console.log(`✅ Generated keypair: ${label}`);
    console.log(`   Public: ${pair.publicKey()}`);

    return pair;
  }

  /**
   * Import existing keypair from secret key
   */
  importFromSecret(label, secret) {
    if (this.keys[label]) {
      throw new Error(`Keypair with label "${label}" already exists`);
    }

    // Validate secret key
    if (!StellarSdk.StrKey.isValidEd25519SecretSeed(secret)) {
      throw new Error('Invalid secret key format');
    }

    const pair = StellarSdk.Keypair.fromSecret(secret);
    this.keys[label] = {
      public: pair.publicKey(),
      secret: secret,
      created: new Date().toISOString(),
      type: 'imported'
    };

    this.logAudit('import', label);
    console.log(`✅ Imported keypair: ${label}`);
    console.log(`   Public: ${pair.publicKey()}`);

    return pair;
  }

  /**
   * Save encrypted keys to file
   */
  saveToFile(filename, password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const algorithm = 'aes-256-cbc';
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const data = JSON.stringify({
      keys: this.keys,
      auditLog: this.auditLog
    });

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const fileData = {
      version: '1.0',
      algorithm: algorithm,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      data: encrypted,
      savedAt: new Date().toISOString()
    };

    fs.writeFileSync(filename, JSON.stringify(fileData, null, 2));

    this.logAudit('save', filename);
    console.log(`✅ Keys saved to ${filename}`);
    console.log(`   Keypairs: ${Object.keys(this.keys).length}`);
    console.log(`   Encrypted with: ${algorithm}`);
  }

  /**
   * Load encrypted keys from file
   */
  loadFromFile(filename, password) {
    if (!fs.existsSync(filename)) {
      throw new Error(`File not found: ${filename}`);
    }

    const fileData = JSON.parse(fs.readFileSync(filename, 'utf8'));

    const algorithm = fileData.algorithm;
    const salt = Buffer.from(fileData.salt, 'hex');
    const key = crypto.scryptSync(password, salt, 32);
    const iv = Buffer.from(fileData.iv, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    try {
      let decrypted = decipher.update(fileData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const parsed = JSON.parse(decrypted);
      this.keys = parsed.keys;
      this.auditLog = parsed.auditLog || [];

      this.logAudit('load', filename);
      console.log(`✅ Loaded ${Object.keys(this.keys).length} keypairs from ${filename}`);

    } catch (error) {
      throw new Error('Failed to decrypt - incorrect password or corrupted file');
    }
  }

  /**
   * List all managed keypairs
   */
  list() {
    console.log('\n🔑 Managed Keypairs:');
    console.log('='.repeat(70));

    if (Object.keys(this.keys).length === 0) {
      console.log('  No keypairs stored');
      return;
    }

    Object.entries(this.keys).forEach(([label, data]) => {
      console.log(`\n  ${label}:`);
      console.log(`    Public:  ${data.public}`);
      console.log(`    Type:    ${data.type}`);
      console.log(`    Created: ${data.created}`);
      if (data.memo) {
        console.log(`    Memo:    ${data.memo}`);
      }
    });
  }

  /**
   * Get keypair by label
   */
  getKeypair(label) {
    if (!this.keys[label]) {
      throw new Error(`Keypair "${label}" not found`);
    }

    this.logAudit('access', label);
    return StellarSdk.Keypair.fromSecret(this.keys[label].secret);
  }

  /**
   * Get public key by label
   */
  getPublicKey(label) {
    if (!this.keys[label]) {
      throw new Error(`Keypair "${label}" not found`);
    }
    return this.keys[label].public;
  }

  /**
   * Delete a keypair
   */
  delete(label) {
    if (!this.keys[label]) {
      throw new Error(`Keypair "${label}" not found`);
    }

    delete this.keys[label];
    this.logAudit('delete', label);
    console.log(`✅ Deleted keypair: ${label}`);
  }

  /**
   * Add memo to a keypair
   */
  addMemo(label, memo) {
    if (!this.keys[label]) {
      throw new Error(`Keypair "${label}" not found`);
    }

    this.keys[label].memo = memo;
    this.logAudit('memo', label);
    console.log(`✅ Added memo to: ${label}`);
  }

  /**
   * Export public keys to JSON
   */
  exportPublicKeys(filename) {
    const publicKeys = {};
    Object.entries(this.keys).forEach(([label, data]) => {
      publicKeys[label] = {
        public: data.public,
        created: data.created,
        type: data.type
      };
    });

    fs.writeFileSync(filename, JSON.stringify(publicKeys, null, 2));
    console.log(`✅ Exported ${Object.keys(publicKeys).length} public keys to ${filename}`);
  }

  /**
   * Display audit log
   */
  showAuditLog() {
    console.log('\n📋 Audit Log:');
    console.log('='.repeat(70));

    if (this.auditLog.length === 0) {
      console.log('  No audit entries');
      return;
    }

    this.auditLog.slice(-20).forEach(entry => {
      console.log(`  [${entry.timestamp}] ${entry.action.toUpperCase()}: ${entry.target}`);
    });
  }

  /**
   * Internal: Log audit entry
   */
  logAudit(action, target) {
    this.auditLog.push({
      action,
      target,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      total: Object.keys(this.keys).length,
      random: 0,
      imported: 0,
      auditEntries: this.auditLog.length
    };

    Object.values(this.keys).forEach(data => {
      stats[data.type]++;
    });

    return stats;
  }

  /**
   * Display statistics
   */
  showStats() {
    const stats = this.getStats();

    console.log('\n📊 Statistics:');
    console.log('='.repeat(70));
    console.log(`  Total Keypairs:     ${stats.total}`);
    console.log(`  Random Generated:   ${stats.random}`);
    console.log(`  Imported:           ${stats.imported}`);
    console.log(`  Audit Log Entries:  ${stats.auditEntries}`);
  }
}

// ============================================================
// DEMO / USAGE EXAMPLE
// ============================================================
async function demo() {
  console.log('='.repeat(70));
  console.log('STELLAR KEY MANAGER - DEMO');
  console.log('='.repeat(70));

  const manager = new KeyManager();

  console.log('\n1. GENERATING KEYPAIRS');
  console.log('-'.repeat(70));
  manager.generateKeypair('main-account');
  manager.generateKeypair('backup-account');
  manager.generateKeypair('cold-storage');

  console.log('\n2. ADDING MEMOS');
  console.log('-'.repeat(70));
  manager.addMemo('main-account', 'Primary trading account');
  manager.addMemo('backup-account', 'Emergency backup');

  console.log('\n3. LISTING ALL KEYS');
  console.log('-'.repeat(70));
  manager.list();

  console.log('\n4. SAVING TO ENCRYPTED FILE');
  console.log('-'.repeat(70));
  const filename = 'demo-keys.enc';
  const password = 'super-secret-password-123';
  manager.saveToFile(filename, password);

  console.log('\n5. STATISTICS');
  console.log('-'.repeat(70));
  manager.showStats();

  console.log('\n6. AUDIT LOG');
  console.log('-'.repeat(70));
  manager.showAuditLog();

  console.log('\n7. EXPORTING PUBLIC KEYS');
  console.log('-'.repeat(70));
  manager.exportPublicKeys('demo-public-keys.json');

  console.log('\n8. LOADING FROM FILE (SIMULATING NEW SESSION)');
  console.log('-'.repeat(70));
  const newManager = new KeyManager();
  newManager.loadFromFile(filename, password);
  newManager.list();

  console.log('\n9. GETTING A KEYPAIR FOR USE');
  console.log('-'.repeat(70));
  const mainKeypair = newManager.getKeypair('main-account');
  console.log('Retrieved keypair:');
  console.log('  Public:', mainKeypair.publicKey());

  // Clean up demo files
  console.log('\n10. CLEANUP');
  console.log('-'.repeat(70));
  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
    console.log(`✅ Deleted ${filename}`);
  }
  if (fs.existsSync('demo-public-keys.json')) {
    fs.unlinkSync('demo-public-keys.json');
    console.log('✅ Deleted demo-public-keys.json');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Key Manager Demo Complete!');
  console.log('='.repeat(70));

  console.log('\nKey Features:');
  console.log('  ✓ Encrypted storage with AES-256-CBC');
  console.log('  ✓ Label-based key management');
  console.log('  ✓ Audit trail');
  console.log('  ✓ Import/export functionality');
  console.log('  ✓ Memo support');
  console.log('  ✓ Statistics');
}

// Run demo if executed directly
if (require.main === module) {
  demo().catch(error => {
    console.error('\nError:', error.message);
    process.exit(1);
  });
}

// Export for use in other modules
module.exports = KeyManager;
