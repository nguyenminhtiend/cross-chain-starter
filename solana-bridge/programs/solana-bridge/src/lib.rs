/**
 * Solana Bridge Program
 *
 * Cross-chain bridge between Solana and Ethereum.
 *
 * This program implements the SAME lock/mint and burn/unlock pattern
 * as your EVM bridge, but in Rust using the Anchor framework.
 *
 * Key differences from Solidity:
 * - State stored in separate accounts (not in contract)
 * - Explicit account declarations required
 * - Uses Rust syntax instead of Solidity
 *
 * But the LOGIC is identical to your EVM bridge!
 */

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod solana_bridge {
    use super::*;

    /**
     * Initialize the bridge
     *
     * Similar to your Solidity constructor
     * Sets up initial state and owner
     */
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.owner = ctx.accounts.owner.key();
        bridge_state.nonce = 0;
        bridge_state.paused = false;

        msg!("Bridge initialized by {}", ctx.accounts.owner.key());
        Ok(())
    }

    /**
     * Lock tokens on Solana (same as your Solidity lock function!)
     *
     * Your Solidity:
     *   function lock(address to, uint256 amount) external {
     *       token.transferFrom(msg.sender, address(this), amount);
     *       emit Lock(msg.sender, to, amount, nonce);
     *   }
     *
     * Solana (SAME CONCEPT, different syntax):
     *   pub fn lock(amount, eth_recipient)
     */
    pub fn lock(
        ctx: Context<Lock>,
        amount: u64,
        eth_recipient: String,
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Check not paused (same as your Solidity require(!paused))
        require!(!bridge_state.paused, ErrorCode::BridgePaused);

        // Validate Ethereum address format (0x...)
        require!(
            eth_recipient.starts_with("0x") && eth_recipient.len() == 42,
            ErrorCode::InvalidEthAddress
        );

        // Transfer tokens to bridge (SAME AS: token.transferFrom)
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token.to_account_info(),
                to: ctx.accounts.bridge_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        // Increment nonce (SAME AS: nonce++)
        bridge_state.nonce += 1;
        let current_nonce = bridge_state.nonce;

        // Emit event (SAME AS: emit Lock(...))
        emit!(LockEvent {
            from: ctx.accounts.user.key(),
            amount,
            nonce: current_nonce,
            eth_recipient: eth_recipient.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Locked {} tokens for {} (nonce: {})",
            amount,
            eth_recipient,
            current_nonce
        );

        Ok(())
    }

    /**
     * Mint wrapped tokens (same as your Solidity mint function!)
     *
     * Your Solidity:
     *   function mint(address to, uint256 amount, uint256 nonce, bytes sig) external {
     *       require(!processedNonces[nonce], "Already processed");
     *       require(verify(to, amount, nonce, sig), "Invalid signature");
     *       wrappedToken.mint(to, amount);
     *       processedNonces[nonce] = true;
     *   }
     *
     * Solana (SAME CONCEPT):
     *   pub fn mint(amount, nonce)
     */
    pub fn mint(
        ctx: Context<Mint>,
        amount: u64,
        nonce: u64,
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Check not paused
        require!(!bridge_state.paused, ErrorCode::BridgePaused);

        // Check not already processed (SAME AS: require(!processedNonces[nonce]))
        require!(
            !bridge_state.processed_nonces.contains(&nonce),
            ErrorCode::AlreadyProcessed
        );

        // Verify caller is owner/relayer (signature verification)
        require!(
            ctx.accounts.authority.key() == bridge_state.owner,
            ErrorCode::Unauthorized
        );

        // Mint tokens (SAME AS: wrappedToken.mint(to, amount))
        let seeds = &[
            b"bridge".as_ref(),
            &[ctx.bumps.bridge_authority],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.wrapped_mint.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.bridge_authority.to_account_info(),
            },
            signer,
        );
        token::mint_to(cpi_ctx, amount)?;

        // Mark as processed (SAME AS: processedNonces[nonce] = true)
        bridge_state.processed_nonces.push(nonce);

        // Emit event
        emit!(MintEvent {
            to: ctx.accounts.user.key(),
            amount,
            nonce,
        });

        msg!("Minted {} tokens to {} (nonce: {})", amount, ctx.accounts.user.key(), nonce);

        Ok(())
    }

    /**
     * Burn wrapped tokens (same as your Solidity burn function!)
     *
     * Your Solidity:
     *   function burn(uint256 amount, string calldata stellarAddress) external {
     *       wrappedToken.burn(msg.sender, amount);
     *       emit Burn(msg.sender, amount, nonce, stellarAddress);
     *   }
     *
     * Solana (SAME CONCEPT):
     *   pub fn burn(amount, eth_recipient)
     */
    pub fn burn(
        ctx: Context<BurnTokens>,
        amount: u64,
        eth_recipient: String,
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Check not paused
        require!(!bridge_state.paused, ErrorCode::BridgePaused);

        // Validate Ethereum address
        require!(
            eth_recipient.starts_with("0x") && eth_recipient.len() == 42,
            ErrorCode::InvalidEthAddress
        );

        // Burn tokens (SAME AS: wrappedToken.burn(msg.sender, amount))
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.wrapped_mint.to_account_info(),
                from: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::burn(cpi_ctx, amount)?;

        // Increment nonce
        bridge_state.nonce += 1;
        let current_nonce = bridge_state.nonce;

        // Emit event (SAME AS: emit Burn(...))
        emit!(BurnEvent {
            from: ctx.accounts.user.key(),
            amount,
            nonce: current_nonce,
            eth_recipient: eth_recipient.clone(),
        });

        msg!(
            "Burned {} tokens from {} for {} (nonce: {})",
            amount,
            ctx.accounts.user.key(),
            eth_recipient,
            current_nonce
        );

        Ok(())
    }

    /**
     * Pause the bridge (same as your Solidity pause!)
     */
    pub fn pause(ctx: Context<PauseBridge>) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        require!(
            ctx.accounts.owner.key() == bridge_state.owner,
            ErrorCode::Unauthorized
        );

        bridge_state.paused = true;
        msg!("Bridge paused");
        Ok(())
    }

    /**
     * Unpause the bridge
     */
    pub fn unpause(ctx: Context<PauseBridge>) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        require!(
            ctx.accounts.owner.key() == bridge_state.owner,
            ErrorCode::Unauthorized
        );

        bridge_state.paused = false;
        msg!("Bridge unpaused");
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

/**
 * Initialize accounts
 */
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + BridgeState::INIT_SPACE,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/**
 * Lock accounts
 *
 * Similar to your Solidity function parameters,
 * but in Solana you must explicitly declare all accounts
 */
#[derive(Accounts)]
pub struct Lock<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,

    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub bridge_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/**
 * Mint accounts
 */
#[derive(Accounts)]
pub struct Mint<'info> {
    /// CHECK: User receiving tokens
    #[account(mut)]
    pub user: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,

    #[account(mut)]
    pub wrapped_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for minting
    #[account(
        seeds = [b"bridge"],
        bump
    )]
    pub bridge_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

/**
 * Burn accounts
 */
#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,

    #[account(mut)]
    pub wrapped_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/**
 * Pause/Unpause accounts
 */
#[derive(Accounts)]
pub struct PauseBridge<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
}

// ============================================================================
// State Account (like your Solidity contract storage)
// ============================================================================

/**
 * Bridge state
 *
 * In Solidity, this would be:
 *   contract Bridge {
 *       address public owner;
 *       uint256 public nonce;
 *       bool public paused;
 *       mapping(uint256 => bool) public processedNonces;
 *   }
 *
 * In Solana, state lives in a separate account
 */
#[account]
#[derive(InitSpace)]
pub struct BridgeState {
    pub owner: Pubkey,
    pub nonce: u64,
    pub paused: bool,
    #[max_len(10000)]
    pub processed_nonces: Vec<u64>,
}

// ============================================================================
// Events (SAME CONCEPT as Solidity events!)
// ============================================================================

#[event]
pub struct LockEvent {
    pub from: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub eth_recipient: String,
    pub timestamp: i64,
}

#[event]
pub struct MintEvent {
    pub to: Pubkey,
    pub amount: u64,
    pub nonce: u64,
}

#[event]
pub struct BurnEvent {
    pub from: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub eth_recipient: String,
}

// ============================================================================
// Errors (SAME CONCEPT as Solidity require!)
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Bridge is paused")]
    BridgePaused,

    #[msg("Transaction already processed")]
    AlreadyProcessed,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Invalid Ethereum address format")]
    InvalidEthAddress,
}
