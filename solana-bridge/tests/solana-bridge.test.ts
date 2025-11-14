/**
 * Solana Bridge Tests
 *
 * SAME PATTERN as your EVM bridge tests!
 * Tests lock, mint, burn, and unlock functionality
 */

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from '@solana/spl-token';
import { assert } from 'chai';

describe('Solana Bridge', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaBridge;

  let bridgeState: PublicKey;
  let bridgeAuthority: PublicKey;
  let mint: PublicKey;
  let wrappedMint: PublicKey;
  let userTokenAccount: PublicKey;
  let bridgeTokenAccount: PublicKey;
  let user: Keypair;

  before(async () => {
    // Similar to your EVM test setup!

    user = Keypair.generate();

    // Airdrop SOL to user
    const sig = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Find bridge state PDA
    [bridgeState] = await PublicKey.findProgramAddress(
      [Buffer.from('bridge_state')],
      program.programId
    );

    // Find bridge authority PDA
    [bridgeAuthority] = await PublicKey.findProgramAddress(
      [Buffer.from('bridge')],
      program.programId
    );

    // Create token mint
    mint = await createMint(
      provider.connection,
      user,
      user.publicKey,
      null,
      9
    );

    // Create wrapped token mint
    wrappedMint = await createMint(
      provider.connection,
      user,
      bridgeAuthority,
      null,
      9
    );

    // Create token accounts
    userTokenAccount = await createAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    bridgeTokenAccount = await createAccount(
      provider.connection,
      user,
      mint,
      bridgeAuthority
    );

    // Mint some tokens to user
    await mintTo(
      provider.connection,
      user,
      mint,
      userTokenAccount,
      user.publicKey,
      1000000000
    );

    console.log('✓ Test accounts setup complete');
  });

  it('Initializes the bridge', async () => {
    // Similar to deploying your EVM bridge!

    await program.methods
      .initialize()
      .accounts({
        bridgeState: bridgeState,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const state = await program.account.bridgeState.fetch(bridgeState);
    assert.equal(state.nonce.toString(), '0');
    assert.equal(state.paused, false);
    assert.equal(
      state.owner.toString(),
      provider.wallet.publicKey.toString()
    );

    console.log('✓ Bridge initialized');
  });

  it('Locks tokens (same as your EVM bridge lock!)', async () => {
    const amount = new anchor.BN(100000000); // 100 tokens
    const ethRecipient = '0x1234567890123456789012345678901234567890';

    // Call lock (SAME CONCEPT as calling lock() in your EVM bridge!)
    await program.methods
      .lock(amount, ethRecipient)
      .accounts({
        user: user.publicKey,
        bridgeState: bridgeState,
        userToken: userTokenAccount,
        bridgeToken: bridgeTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Verify bridge received tokens
    const bridgeAccount = await getAccount(
      provider.connection,
      bridgeTokenAccount
    );
    assert.equal(
      bridgeAccount.amount.toString(),
      amount.toString()
    );

    // Verify nonce incremented (SAME AS: checking nonce in your EVM bridge)
    const state = await program.account.bridgeState.fetch(bridgeState);
    assert.equal(state.nonce.toString(), '1');

    console.log('✓ Tokens locked successfully');
  });

  it('Mints wrapped tokens (same as your EVM bridge mint!)', async () => {
    const amount = new anchor.BN(100000000);
    const nonce = new anchor.BN(1);

    // Create wrapped token account for user
    const userWrappedAccount = await createAccount(
      provider.connection,
      user,
      wrappedMint,
      user.publicKey
    );

    // Call mint (SAME CONCEPT as calling mint() in your EVM bridge!)
    await program.methods
      .mint(amount, nonce)
      .accounts({
        user: user.publicKey,
        authority: provider.wallet.publicKey,
        bridgeState: bridgeState,
        wrappedMint: wrappedMint,
        userToken: userWrappedAccount,
        bridgeAuthority: bridgeAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Verify tokens minted
    const account = await getAccount(
      provider.connection,
      userWrappedAccount
    );
    assert.equal(account.amount.toString(), amount.toString());

    // Verify nonce marked as processed (SAME AS: processedNonces check)
    const state = await program.account.bridgeState.fetch(bridgeState);
    assert.ok(state.processedNonces.some(n => n.eq(nonce)));

    console.log('✓ Wrapped tokens minted successfully');
  });

  it('Prevents duplicate mints (same as your EVM bridge!)', async () => {
    const amount = new anchor.BN(100000000);
    const nonce = new anchor.BN(1); // Same nonce as before

    const userWrappedAccount = await createAccount(
      provider.connection,
      user,
      wrappedMint,
      user.publicKey
    );

    try {
      // Try to mint with same nonce
      await program.methods
        .mint(amount, nonce)
        .accounts({
          user: user.publicKey,
          authority: provider.wallet.publicKey,
          bridgeState: bridgeState,
          wrappedMint: wrappedMint,
          userToken: userWrappedAccount,
          bridgeAuthority: bridgeAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      assert.fail('Should have thrown error');
    } catch (error) {
      // Should fail with AlreadyProcessed error
      assert.ok(error.toString().includes('AlreadyProcessed'));
      console.log('✓ Duplicate mint prevented');
    }
  });

  it('Burns wrapped tokens (same as your EVM bridge burn!)', async () => {
    const amount = new anchor.BN(50000000); // 50 tokens
    const ethRecipient = '0x1234567890123456789012345678901234567890';

    // First mint some wrapped tokens
    const nonce = new anchor.BN(2);
    const userWrappedAccount = await createAccount(
      provider.connection,
      user,
      wrappedMint,
      user.publicKey
    );

    await program.methods
      .mint(amount, nonce)
      .accounts({
        user: user.publicKey,
        authority: provider.wallet.publicKey,
        bridgeState: bridgeState,
        wrappedMint: wrappedMint,
        userToken: userWrappedAccount,
        bridgeAuthority: bridgeAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Now burn them (SAME AS: calling burn() in your EVM bridge!)
    await program.methods
      .burn(amount, ethRecipient)
      .accounts({
        user: user.publicKey,
        bridgeState: bridgeState,
        wrappedMint: wrappedMint,
        userToken: userWrappedAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Verify tokens burned
    const account = await getAccount(
      provider.connection,
      userWrappedAccount
    );
    assert.equal(account.amount.toString(), '0');

    console.log('✓ Wrapped tokens burned successfully');
  });

  it('Can pause and unpause bridge', async () => {
    // Pause
    await program.methods
      .pause()
      .accounts({
        owner: provider.wallet.publicKey,
        bridgeState: bridgeState,
      })
      .rpc();

    let state = await program.account.bridgeState.fetch(bridgeState);
    assert.equal(state.paused, true);

    // Unpause
    await program.methods
      .unpause()
      .accounts({
        owner: provider.wallet.publicKey,
        bridgeState: bridgeState,
      })
      .rpc();

    state = await program.account.bridgeState.fetch(bridgeState);
    assert.equal(state.paused, false);

    console.log('✓ Pause/unpause working correctly');
  });
});
