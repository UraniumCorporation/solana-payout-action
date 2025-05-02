import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  getMint,
  getAssociatedTokenAddress,
  createTransferInstruction,
  Mint,
} from "@solana/spl-token";

import {
  NETWORK_URLS,
  TRANSACTION_FEE_BUFFER,
  TOKEN_ACCOUNT_CREATION_COST,
} from "../../constants";

/**
 * SolanaPayoutService - A class to handle Solana payments
 * Encapsulates all the business logic for sending SOL or SPL tokens
 * @constructor
 * @param senderWalletSecret - The sender's wallet private key in base58 format
 * @param recipientWalletAddress - The recipient's wallet address
 * @param amount - The amount to send
 * @param token - The token to send (SOL or SPL token address)
 * @param network - The Solana network to use
 */
export class SolanaPayoutService {
  private connection: Connection;
  private senderKeypair: Keypair;
  private senderPubKey: PublicKey;
  private recipientPubKey: PublicKey;
  private amount: number;
  private network: string;
  private token: string;
  private isTokenTransfer: boolean;
  private mint: Mint | null;

  /**
   * Constructor for SolanaPayoutService
   * @param senderWalletSecret - The sender's wallet private key in base58 format
   * @param recipientWalletAddress - The recipient's wallet address
   * @param amount - The amount to send
   * @param token - The token to send (SOL or SPL token address)
   * @param network - The Solana network to use
   */
  constructor(
    senderWalletSecret: string,
    recipientWalletAddress: string,
    amount: number,
    token: string | "SOL",
    network: string,
    timeout: number
  ) {
    // Validate inputs
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Amount must be a positive number`);
    }

    if (!NETWORK_URLS[network]) {
      throw new Error(
        `Invalid network specified. Must be one of: ${Object.keys(
          NETWORK_URLS
        ).join(", ")}`
      );
    }

    // Initialize properties
    this.amount = amount;
    this.token = token;
    this.network = network;
    this.isTokenTransfer = token.toUpperCase() !== "SOL";
    this.connection = new Connection(NETWORK_URLS[network], {
      confirmTransactionInitialTimeout: timeout,
    });
    this.mint = null; // Gets set in initialize()

    // Create sender keypair
    try {
      const privateKeyBytes = bs58.decode(senderWalletSecret);
      this.senderKeypair = Keypair.fromSecretKey(privateKeyBytes);
      this.senderPubKey = this.senderKeypair.publicKey;
    } catch (error: any) {
      throw new Error(
        "Invalid wallet secret format. Please provide a valid base58 encoded private key."
      );
    }

    // Initialize recipient public key (will be validated later)
    try {
      this.recipientPubKey = new PublicKey(recipientWalletAddress);
    } catch (error) {
      throw new Error(
        `Invalid recipient wallet address format: ${recipientWalletAddress}`
      );
    }
  }

  /**
   * Initializes the service by validating sender/recipient wallets and token address. Sets the mint information if a token is being transferred. - Call this method before calling executePayment()
   */
  public async initialize(): Promise<void> {
    console.log("Starting Solana payment process...");
    console.log(`Network: ${this.network}`);
    console.log(`Connecting to Solana ${this.network}...`);
    console.log("✓ Connected to network");

    // Log transaction type and amount
    if (this.isTokenTransfer) {
      console.log(`Token transfer: ${this.token}`);
      console.log(`Amount to send: ${this.amount} tokens`);
    } else {
      console.log(`SOL transfer`);
      console.log(`Amount to send: ${this.amount} SOL`);
    }

    console.log("Sender wallet address:", this.senderPubKey.toString());
    console.log("Recipient wallet address:", this.recipientPubKey.toString());

    // Validate sender wallet
    console.log("Validating sender wallet...");
    await this.validateWalletAddress(this.senderPubKey.toString());
    console.log("✓ Sender wallet validated");

    // Validate recipient address
    console.log("Validating recipient wallet...");
    await this.validateWalletAddress(this.recipientPubKey.toString());
    console.log("✓ Recipient wallet validated");

    // Validate token if it's a token transfer
    if (this.isTokenTransfer) {
      console.log("Validating token address...");
      this.mint = await this.validateTokenAddress(this.token);
      console.log("✓ Token address validated");
    }
  }

  /**
   * Validates a wallet address and checks balance
   * @param address - The wallet address to validate
   */
  private async validateWalletAddress(address: string): Promise<void> {
    try {
      const pubKey = new PublicKey(address);

      // Check if address is valid Solana public key format
      if (!PublicKey.isOnCurve(pubKey)) {
        throw new Error(`Invalid wallet address format: ${address}`);
      }

      // For basic SOL accounts, we should check balance instead of account info
      const balance = await this.connection.getBalance(pubKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      console.log(
        `Wallet balance: ${solBalance.toLocaleString()} SOL (${balance.toString()} lamports)`
      );

      // We don't throw if balance is 0, just log it
      if (balance === 0) {
        console.log(`Warning: Wallet has 0 balance on ${this.network} network`);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Invalid public key input")
      ) {
        throw new Error(`Invalid wallet address format: ${address}`);
      }
      throw error;
    }
  }

  /**
   * Validates a token address and logs token supply and decimals
   * @param tokenAddress - The token address to validate
   * @returns The token mint information
   */
  private async validateTokenAddress(tokenAddress: string): Promise<Mint> {
    try {
      // Validate token mint address
      console.log(`Token address: ${tokenAddress}`);
      const tokenMint = new PublicKey(tokenAddress);

      // Get token mint info
      const mintInfo = await getMint(this.connection, tokenMint);
      console.log(`Token supply: ${mintInfo.supply.toString()}`);
      console.log(`Token decimals: ${mintInfo.decimals}`);

      return mintInfo;
    } catch (error) {
      throw new Error(
        `Invalid SPL token: ${tokenAddress}. Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Executes the SOL/SPL token transfer and returns the transaction signature
   * @returns The transaction signature
   */
  public async executePayment(): Promise<string> {
    let signature: string;

    if (!this.isTokenTransfer) {
      // Execute SOL transfer
      signature = await this.executeSolTransfer();
    } else {
      // Execute token transfer
      signature = await this.executeTokenTransfer();
    }

    // Print transaction summary
    console.log("\n🎉 Transaction Summary:");
    console.log(
      `Type: ${
        this.isTokenTransfer ? `${this.token} Token Transfer` : "SOL Transfer"
      }`
    );
    console.log(
      `Amount: ${this.amount} ${this.isTokenTransfer ? this.token : "SOL"}`
    );
    console.log(`From: ${this.senderPubKey.toString()}`);
    console.log(`To: ${this.recipientPubKey.toString()}`);
    console.log(`Network: ${this.network}`);
    console.log(`Transaction signature: ${signature}`);
    console.log(
      `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=${this.network}`
    );
    console.log(
      `View on Solscan: https://solscan.io/tx/${signature}?cluster=${this.network}`
    );

    return signature;
  }

  /**
   * Executes a SOL transfer - Checks sender SOL balance to ensure it's enough to cover the transaction fees and token account creation costs and creates a transaction
   * @returns The transaction signature
   */
  private async executeSolTransfer(): Promise<string> {
    console.log("Executing SOL transfer...");

    // Check sender SOL balance
    console.log("Checking sender SOL balance...");
    await this.validateSenderBalance({
      requiredSolAmount: this.amount * LAMPORTS_PER_SOL,
      tokenAccountsToCreate: 0, // No token accounts needed for SOL transfer
    });
    console.log("✓ Sufficient SOL balance confirmed");

    // Create transaction
    console.log("Creating transaction...");
    const transaction = new Transaction();

    // Add transfer instruction
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: this.senderPubKey,
        toPubkey: this.recipientPubKey,
        lamports: this.amount * LAMPORTS_PER_SOL,
      })
    );

    // Set recent blockhash
    const recentBlockhash = await this.connection.getRecentBlockhash();
    transaction.recentBlockhash = recentBlockhash.blockhash;

    // Send transaction
    console.log("Sending transaction...");
    const signature = await this.connection.sendTransaction(transaction, [
      this.senderKeypair,
    ]);

    console.log("Transaction sent with signature:", signature);
    console.log(
      `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=${this.network}`
    );
    console.log(
      `View on Solscan: https://solscan.io/tx/${signature}?cluster=${this.network}`
    );

    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const confirmation = await this.connection.confirmTransaction(
      signature,
      "confirmed"
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
      );
    }

    console.log("✓ Transaction confirmed");
    return signature;
  }

  /**
   * Executes a token transfer - Checks sender/recipient token accounts, validates sender balance, creates token accounts if needed, and sends the transaction
   * @returns The transaction signature
   */
  private async executeTokenTransfer(): Promise<string> {
    if (!this.mint) throw new Error("Token mint information not initialized");

    console.log("Executing token transfer...");

    // Check if sender has a token account already
    console.log("Checking sender token account...");
    let tokenAccountsToCreate = 0;
    let senderHasTokenAccount: boolean;
    try {
      const senderTokenAccountAddress = await getAssociatedTokenAddress(
        this.mint.address,
        this.senderPubKey
      );
      const senderTokenAccountInfo = await this.connection.getAccountInfo(
        senderTokenAccountAddress
      );
      senderHasTokenAccount = senderTokenAccountInfo !== null;
      if (senderHasTokenAccount) {
        console.log("✓ Sender already has a token account");
      }
    } catch (error) {
      senderHasTokenAccount = false;
      tokenAccountsToCreate += 1;
      console.log(
        "⚠️ Sender doesn't have a token account yet. It will be created during transfer."
      );
    }

    // Check if recipient has a token account already
    console.log("Checking recipient token account...");
    let recipientHasTokenAccount: boolean;
    try {
      const recipientTokenAccountAddress = await getAssociatedTokenAddress(
        this.mint.address,
        this.recipientPubKey
      );
      const recipientTokenAccountInfo = await this.connection.getAccountInfo(
        recipientTokenAccountAddress
      );
      recipientHasTokenAccount = recipientTokenAccountInfo !== null;
      if (recipientHasTokenAccount) {
        console.log("✓ Recipient already has a token account");
      }
    } catch (error) {
      recipientHasTokenAccount = false;
      tokenAccountsToCreate += 1;
      console.log(
        "⚠️ Recipient doesn't have a token account yet. It will be created during transfer."
      );
    }

    // Check if sender has enough SOL to cover transaction fees and token account creation costs
    console.log(
      "Checking sender SOL balance to cover transaction fees and token account creation costs..."
    );
    await this.validateSenderBalance({
      requiredSolAmount: 0, // No SOL transfer, just need fees
      tokenAccountsToCreate,
    });
    console.log("✓ Sufficient SOL balance for fees confirmed");

    // Get sender token account - create token account for sender if needed
    if (!senderHasTokenAccount) {
      console.log("Creating token account for sender...");
    }
    const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.senderKeypair,
      this.mint.address,
      this.senderPubKey,
      true // Always create if it doesn't exist
    );
    console.log(
      `🪙 Sender token account: ${senderTokenAccount.address.toString()}`
    );
    console.log(`✓ Sender token account is ready for transfer`);

    // Get recipient token account - create token account for recipient if needed
    if (!recipientHasTokenAccount) {
      console.log("Creating token account for recipient...");
    }
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.senderKeypair,
      this.mint.address,
      this.recipientPubKey,
      true // Always create if it doesn't exist
    );
    console.log(
      `🪙 Recipient token account: ${recipientTokenAccount.address.toString()}`
    );
    console.log(`✓ Recipient token account is ready for transfer`);

    console.log("Checking if sender has enough token balance...");
    console.log(
      `Sender token balance: ${
        Number(senderTokenAccount.amount) / 10 ** this.mint.decimals
      } tokens`
    );
    console.log(`Required: ${this.amount.toString()} tokens`);

    // Convert both to the same format for comparison
    const amountInRawUnits = this.amount * 10 ** this.mint.decimals;
    if (senderTokenAccount.amount < amountInRawUnits) {
      throw new Error(
        `Insufficient token balance in sender wallet on ${this.network} network. ` +
          `Balance: ${
            Number(senderTokenAccount.amount) / 10 ** this.mint.decimals
          } tokens, ` +
          `Required: ${this.amount.toString()} tokens`
      );
    }
    console.log("✓ Sufficient token balance confirmed");

    // Create transaction
    console.log("Creating transaction...");
    const transaction = new Transaction();

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderTokenAccount.address,
        recipientTokenAccount.address,
        this.senderPubKey,
        BigInt(amountInRawUnits)
      )
    );

    // Set recent blockhash
    const recentBlockhash = await this.connection.getRecentBlockhash();
    transaction.recentBlockhash = recentBlockhash.blockhash;

    // Send transaction
    console.log("Sending transaction...");
    const signature = await this.connection.sendTransaction(transaction, [
      this.senderKeypair,
    ]);

    console.log("Transaction sent with signature:", signature);
    console.log(
      `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=${this.network}`
    );
    console.log(
      `View on Solscan: https://solscan.io/tx/${signature}?cluster=${this.network}`
    );

    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const confirmation = await this.connection.confirmTransaction(
      signature,
      "confirmed"
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
      );
    }

    console.log("✓ Transaction confirmed");
    return signature;
  }

  /**
   * Validates the sender's SOL balance to ensure it's enough to cover the transaction fees and token account creation costs
   * @param requiredAmount - The amount of SOL required
   * @param tokenAccountsToCreate - Number of token accounts that need to be created
   */
  private async validateSenderBalance({
    requiredSolAmount,
    tokenAccountsToCreate,
  }: {
    requiredSolAmount: number;
    tokenAccountsToCreate: number;
  }): Promise<void> {
    try {
      const balance = await this.connection.getBalance(this.senderPubKey);

      // Calculate total required with a conservative fee buffer
      let totalRequired = requiredSolAmount + TRANSACTION_FEE_BUFFER;

      // Add token account creation costs if needed
      let tokenAccountCost = 0;
      if (tokenAccountsToCreate > 0) {
        tokenAccountCost = TOKEN_ACCOUNT_CREATION_COST * tokenAccountsToCreate;
        totalRequired += tokenAccountCost;
      }

      // Format for human-readable display
      const solBalance = balance / LAMPORTS_PER_SOL;
      const solRequired = requiredSolAmount / LAMPORTS_PER_SOL;
      const feeBuffer = TRANSACTION_FEE_BUFFER / LAMPORTS_PER_SOL;
      const solTotalRequired = totalRequired / LAMPORTS_PER_SOL;

      console.log(
        `Current sender SOL balance: ${solBalance.toLocaleString()} SOL (${balance.toString()} lamports)`
      );

      console.log(
        `Transaction fee buffer: ${feeBuffer.toLocaleString()} SOL (${TRANSACTION_FEE_BUFFER.toString()} lamports)`
      );

      if (tokenAccountsToCreate > 0) {
        console.log(
          `${tokenAccountsToCreate} token account(s) need to be created (${
            TOKEN_ACCOUNT_CREATION_COST / LAMPORTS_PER_SOL
          } SOL (${TOKEN_ACCOUNT_CREATION_COST.toString()} lamports) each)`
        );
        console.log(
          `Total token account creation cost: ${(
            tokenAccountCost / LAMPORTS_PER_SOL
          ).toFixed(6)} SOL (${tokenAccountCost.toString()} lamports)`
        );
      }

      if (requiredSolAmount > 0) {
        console.log(
          `Required amount: ${solRequired.toLocaleString()} SOL (${requiredSolAmount.toString()} lamports)`
        );
      }

      console.log(
        `Total required: ${solTotalRequired.toLocaleString()} SOL (${totalRequired.toString()} lamports)`
      );

      if (balance < totalRequired) {
        throw new Error(
          `Insufficient funds in sender wallet on ${this.network} network. ` +
            `Balance: ${solBalance.toLocaleString()} SOL, ` +
            `Required: ${solTotalRequired.toLocaleString()} SOL ` +
            `(including ${feeBuffer.toLocaleString()} SOL buffer for transaction fees${
              tokenAccountsToCreate > 0
                ? ` and ${
                    tokenAccountCost / LAMPORTS_PER_SOL
                  } SOL for creating ${tokenAccountsToCreate} token account(s)`
                : ""
            })`
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Insufficient funds")
      ) {
        throw error;
      }
      throw new Error(
        `Failed to check sender wallet balance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
