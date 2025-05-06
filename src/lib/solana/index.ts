import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptAccount,
  getMint,
  Mint,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from "@solana/web3.js";
import bs58 from "bs58";

import { NETWORK_URLS } from "../../constants";
import logger from "../logger";

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
  private timeout: number;
  private isTokenTransfer: boolean;
  private mint: Mint | null;

  private get logger() {
    return logger.child({
      scope: "solana-payout-service"
    });
  }

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
      this.logger.error("Amount must be a positive number");
      throw new Error(`Amount must be a positive number`);
    }

    if (timeout <= 0) {
      this.logger.error("Timeout must be a positive number");
      throw new Error(`Timeout must be a positive number`);
    }

    if (!NETWORK_URLS[network]) {
      this.logger.error(
        `Invalid network specified. Must be one of: ${Object.keys(
          NETWORK_URLS
        ).join(", ")}`
      );
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
    this.timeout = timeout;

    this.isTokenTransfer = token.toUpperCase() !== "SOL";

    this.connection = new Connection(NETWORK_URLS[network], {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: timeout
    });
    this.mint = null; // Gets set in initialize()

    // Create sender keypair
    try {
      const privateKeyBytes = bs58.decode(senderWalletSecret);
      this.senderKeypair = Keypair.fromSecretKey(privateKeyBytes);
      this.senderPubKey = this.senderKeypair.publicKey;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(error.message, {
        name: error.name,
        stack: error.stack
      });
      throw new Error(
        "Invalid wallet secret format. Please provide a valid base58 encoded private key."
      );
    }

    // Initialize recipient public key (will be validated later)
    try {
      this.recipientPubKey = new PublicKey(recipientWalletAddress);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(error.message, {
        name: error.name,
        stack: error.stack
      });
      throw new Error(
        `Invalid recipient wallet address format: ${recipientWalletAddress}`
      );
    }
  }

  /**
   * Initializes the service by validating sender/recipient wallets and token address. Sets the mint information if a token is being transferred. - Call this method before calling executePayment()
   */
  public async initialize(): Promise<void> {
    this.logger.info("Starting Solana payment process...");
    this.logger.info("✓ Connected to Solana Network", {
      network: this.network,
      url: NETWORK_URLS[this.network]
    });

    if (this.isTokenTransfer) {
      this.logger.info(`Initiating token transfer...`);
      this.logger.info(`Token transfer: ${this.token}`, { token: this.token });
      this.logger.info(`Amount to send: ${this.amount} tokens`, {
        amount: this.amount,
        currency: this.token
      });
    }

    if (!this.isTokenTransfer) {
      this.logger.info(`Initiating SOL transfer...`);
      this.logger.info(`Amount to send: ${this.amount} SOL`, {
        amount: this.amount,
        currency: "SOL"
      });
    }

    this.logger.info(`Sender wallet address: ${this.senderPubKey.toString()}`, {
      senderWalletAddress: this.senderPubKey.toString()
    });
    this.logger.info(
      `Recipient wallet address: ${this.recipientPubKey.toString()}`,
      {
        recipientWalletAddress: this.recipientPubKey.toString()
      }
    );

    // Validate sender wallet
    this.logger.info("Validating sender wallet...");
    await this.validateWalletAddress(this.senderPubKey.toString());
    this.logger.info("✓ Sender wallet validated", {
      senderWalletAddress: this.senderPubKey.toString()
    });

    // Validate recipient address
    this.logger.info("Validating recipient wallet...");
    await this.validateWalletAddress(this.recipientPubKey.toString());
    this.logger.info("✓ Recipient wallet validated", {
      recipientWalletAddress: this.recipientPubKey.toString()
    });

    // Validate token if it's a token transfer
    if (this.isTokenTransfer) {
      this.logger.info("Validating token address...");
      this.mint = await this.validateTokenAddress(this.token);
      this.logger.info("✓ Token address validated");
    }
  }

  /**
   * Validates a wallet address is a valid Solana public key format, is on curve, and checks the balance
   * @param address - The wallet address to validate
   */
  private async validateWalletAddress(address: string): Promise<void> {
    try {
      const pubKey = new PublicKey(address);
      const isOnCurve = PublicKey.isOnCurve(pubKey);

      // Check if address is valid Solana public key format
      if (!isOnCurve) {
        this.logger.error(`Invalid wallet address format: ${address}`, {
          walletAddress: address,
          isOnCurve
        });
        throw new Error(`Invalid wallet address format: ${address}`);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes("Invalid public key input")) {
        this.logger.error(`Invalid wallet address format: ${address}`, {
          walletAddress: address,
          name: error.name,
          stack: error.stack
        });
        throw new Error(`Invalid wallet address format: ${address}`);
      }

      this.logger.error(`Failed to validate wallet address: ${address}`, {
        walletAddress: address,
        name: error.name,
        stack: error.stack
      });
      throw err;
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
      this.logger.info(`Token address: ${tokenAddress}`, { tokenAddress });
      const tokenMint = new PublicKey(tokenAddress);

      // Get token mint info
      const mintInfo = await getMint(this.connection, tokenMint, "confirmed");
      this.logger.info(`Token supply: ${mintInfo.supply / 1_000_000_000n}`, {
        tokenAddress,
        supply: mintInfo.supply / 1_000_000_000n
      });
      this.logger.info(`Token decimals: ${mintInfo.decimals}`, {
        tokenAddress,
        decimals: mintInfo.decimals
      });

      return mintInfo;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(error.message, {
        name: error.name,
        stack: error.stack
      });

      throw new Error(
        `Invalid SPL token: ${tokenAddress}. Please provide a valid SPL token address.`
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
    this.logger.info("🎉 Transaction Summary");
    this.logger.info(
      `Type: ${
        this.isTokenTransfer ? `${this.token} Token Transfer` : "SOL Transfer"
      }`
    );
    this.logger.info(
      `Amount: ${this.amount} ${this.isTokenTransfer ? this.token : "SOL"}`
    );
    this.logger.info(`From: ${this.senderPubKey.toString()}`);
    this.logger.info(`To: ${this.recipientPubKey.toString()}`);
    this.logger.info(`Network: ${this.network}`);
    this.logger.info(`Transaction signature: ${signature}`);
    this.logger.info(
      `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=${this.network}`
    );
    this.logger.info(
      `View on Solscan: https://solscan.io/tx/${signature}?cluster=${this.network}`
    );

    return signature;
  }

  /**
   * Executes a SOL transfer - Checks sender SOL balance to ensure it's enough to cover the transaction fees and token account creation costs and creates a transaction
   * @returns The transaction signature
   */
  private async executeSolTransfer(): Promise<string> {
    this.logger.info("Executing SOL transfer...");
    const instructions = [];

    // Add transfer instruction
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: this.senderPubKey,
        toPubkey: this.recipientPubKey,
        lamports: this.amount * LAMPORTS_PER_SOL
      })
    );

    // Create versioned transaction
    this.logger.info("Creating versioned transaction...");
    const transaction = await this.createVersionedTransaction(
      instructions,
      this.senderKeypair
    );
    this.logger.info("✓ Versioned transaction created successfully", {
      instructions
    });

    // Validate sender SOL balance
    this.logger.info("Validating sender SOL balance...");
    await this.validateSenderSolBalance(transaction);
    this.logger.info(
      `✓ Sender balance validated. Sufficient funds available for transaction.`
    );

    // Send transaction
    const signature = await this.sendTransaction(transaction);

    // Wait for confirmation
    this.logger.info("Waiting for confirmation...");
    await this.confirmTransaction(signature);

    return signature;
  }

  /**
   * Executes a token transfer - Checks sender/recipient token accounts, validates sender balance, creates token accounts if needed, and sends the transaction
   * @returns The transaction signature
   */
  private async executeTokenTransfer() {
    if (!this.mint) {
      this.logger.error("Token mint information not initialized");
      throw new Error("Token mint information not initialized");
    }
    const instructions = [];
    const transferAmount = Math.floor(
      this.amount * Math.pow(10, this.mint.decimals)
    );

    // Get the sender associated token account
    const senderAssociatedTokenAccount = getAssociatedTokenAddressSync(
      this.mint.address,
      this.senderPubKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    this.logger.info(
      `Sender associated token account: ${senderAssociatedTokenAccount}`,
      {
        senderAssociatedTokenAccount
      }
    );
    const senderAccountExists = await this.checkAccountExists(
      senderAssociatedTokenAccount
    );

    if (!senderAccountExists) {
      this.logger.error(
        `Sender address does not have an associated token account to complete the transfer`,
        {
          senderAssociatedTokenAccount
        }
      );
      throw new Error(
        "Sender address does not have an associated token account to complete the transfer"
      );
    }

    const recipientAccountExists = await this.checkAccountExists(
      this.recipientPubKey
    );

    // Check the recipients solana account is created and owned by the system program
    if (!recipientAccountExists) {
      this.logger.info(
        `Recipient account does not exist. Creating account for ${this.recipientPubKey.toString()}...`
      );
      const minRent = await getMinimumBalanceForRentExemptAccount(
        this.connection,
        "confirmed"
      );

      this.logger.info(
        `Minimum rent for account creation: ${minRent.toString()} lamports`,
        {
          rent: minRent,
          rentSOL: minRent / LAMPORTS_PER_SOL
        }
      );

      // SystemProgram.createAccount requires a signature from both the sender and recipient
      // since we don't have the recipient's keypair, we need to fund the account with SOL
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: this.senderPubKey,
          toPubkey: this.recipientPubKey,
          lamports: minRent,
          programId: SystemProgram.programId
        })
      );
    }

    // Get the associated account (this is deterministic (no remote call))
    const recipientAssociatedTokenAccount = getAssociatedTokenAddressSync(
      this.mint.address,
      this.recipientPubKey,
      false
    );

    this.logger.info(
      `Recipient associated token account: ${recipientAssociatedTokenAccount}`,
      {
        recipientAssociatedTokenAccount
      }
    );
    const checkRecipientTokenAccountExists = await this.checkAccountExists(
      recipientAssociatedTokenAccount
    );

    if (!checkRecipientTokenAccountExists) {
      this.logger.info(
        `Recipient address does not have an associated token account. Creating account for ${this.recipientPubKey.toString()}...`
      );
      instructions.push(
        createAssociatedTokenAccountInstruction(
          this.senderKeypair.publicKey,
          recipientAssociatedTokenAccount,
          this.recipientPubKey,
          this.mint.address
        )
      );
    }

    this.logger.info(
      `Adding transfer instruction to send ${transferAmount / Math.pow(10, this.mint.decimals)} tokens`,
      {
        senderAssociatedTokenAccount,
        recipientAssociatedTokenAccount,
        tokenAddress: this.mint.address,
        transferAmount: transferAmount / Math.pow(10, this.mint.decimals)
      }
    );
    instructions.push(
      createTransferInstruction(
        senderAssociatedTokenAccount,
        recipientAssociatedTokenAccount,
        this.senderKeypair.publicKey,
        transferAmount
      )
    );

    // Create versioned transaction
    this.logger.info("Creating versioned transaction...");
    const transaction = await this.createVersionedTransaction(
      instructions,
      this.senderKeypair
    );
    this.logger.info("✓ Versioned transaction created successfully", {
      instructions
    });

    // Validate sender SOL balance
    this.logger.info("Validating sender SOL balance...");
    await this.validateSenderSolBalance(transaction);
    this.logger.info(
      `✓ Sender balance validated. Sufficient funds available for transaction.`
    );

    // Validate sender token balance
    this.logger.info(
      `Validating sender token balance for ${this.mint.address}...`
    );
    await this.validateSenderTokenBalance(senderAssociatedTokenAccount);
    this.logger.info(
      `✓ Sender token balance validated. Sufficient funds available for transaction.`
    );

    // Send transaction
    const signature = await this.sendTransaction(transaction);

    // Wait for confirmation
    this.logger.info("Waiting for confirmation...");
    await this.confirmTransaction(signature);
    return signature;
  }

  /**
   * Checks if an account exists on the Solana blockchain
   * @param address - The address to check
   * @returns {Promise<boolean>} - True if the account exists, false otherwise
   */
  private async checkAccountExists(address: PublicKey): Promise<boolean> {
    try {
      const account = await this.connection.getAccountInfo(address);
      return account !== null;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(error.message, {
        name: error.name,
        stack: error.stack
      });
      throw new Error(`Failed to check account existence: ${address}`);
    }
  }

  /**
   * Creates a versioned transaction with the given instructions and payer.
   * @param payer - The Keypair of the payer.
   * @param instructions - An array of TransactionInstruction objects.
   * @returns A promise that resolves to the created VersionedTransaction.
   */
  private async createVersionedTransaction(
    instructions: TransactionInstruction[],
    payer: Keypair
  ) {
    const latestBlockhash = await this.connection.getLatestBlockhash({
      commitment: "confirmed"
    });

    this.logger.info(`Latest Blockhash: ${latestBlockhash.blockhash}`, {
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });
    const transactionMessage = new TransactionMessage({
      payerKey: payer.publicKey,
      instructions: instructions,
      recentBlockhash: latestBlockhash.blockhash
    }).compileToV0Message();

    const transaction = new VersionedTransaction(transactionMessage);
    transaction.sign([payer]);

    return transaction;
  }

  /**
   * Validates the sender's SOL balance to ensure it has enough funds to cover the transaction fees and the amount being sent.
   * @param transaction - The transaction to validate
   * @throws {Error} - Throws an error if the sender's balance is insufficient.
   * @returns {Promise<void>}
   */
  private async validateSenderSolBalance(
    transaction: VersionedTransaction
  ): Promise<void> {
    const txFee = await this.connection.getFeeForMessage(transaction.message);
    if (!txFee.value) {
      this.logger.error("Failed to get transaction fee", {
        rpcResponseAndContext: txFee
      });
      throw new Error("Failed to get transaction fee");
    }

    const txFeeSol = txFee.value / LAMPORTS_PER_SOL;
    this.logger.info(`Transaction fee: ${txFeeSol} SOL`, {
      SOL: txFeeSol,
      lamports: txFee.value
    });

    const lamports = await this.connection.getBalance(this.senderPubKey);
    const sol = lamports / LAMPORTS_PER_SOL;
    this.logger.info(
      `Sender wallet balance: ${sol.toLocaleString()} SOL (${lamports.toString()} lamports)`,
      {
        senderWalletAddress: this.senderPubKey.toString(),
        SOL: sol,
        lamports
      }
    );

    // For token transfers, total cost includes only the tx fee - i.e. 1 signature on the transaction, (if needed) rent-exempt lamports for creating the recipient account, and (if needed) lamports for creating the recipient associated token account.
    // For SOL transfers, total cost includes the tx fee - i.e. 1 signature on the transaction plus the amount of SOL being sent.
    const totalCost = txFeeSol + (this.isTokenTransfer ? 0 : this.amount);
    this.logger.info(`Total cost: ${totalCost} SOL`, {
      SOL: totalCost,
      lamports: totalCost * LAMPORTS_PER_SOL
    });
    if (sol < totalCost) {
      this.logger.error(
        `Insufficient funds in sender wallet on ${this.network} network. Balance: ${sol.toLocaleString()} SOL, Required: ${totalCost.toLocaleString()} SOL (including transaction fee of ${txFeeSol.toLocaleString()} SOL)`,
        {
          network: this.network,
          senderWalletAddress: this.senderPubKey.toString(),
          balance: sol,
          required: totalCost
        }
      );
      throw new Error(
        `Insufficient funds in sender wallet on ${this.network} network. Balance: ${sol.toLocaleString()} SOL, Required: ${totalCost.toLocaleString()} SOL (including transaction fee of ${txFeeSol.toLocaleString()} SOL)`
      );
    }
  }

  /**
   * Validates the sender's token balance to ensure it has enough funds to cover the amount being sent.
   * @param sendersAssociatedTokenAccount - The sender's associated token account to validate
   */
  private async validateSenderTokenBalance(
    senderAssociatedTokenAccount: PublicKey
  ): Promise<void> {
    if (!this.mint) {
      this.logger.error("Token mint information not initialized");
      throw new Error("Token mint information not initialized");
    }

    let senderTokenAccount;
    try {
      senderTokenAccount = await this.connection.getTokenAccountBalance(
        senderAssociatedTokenAccount
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Failed to get sender token account balance for ${this.mint.address}`,
        {
          senderAssociatedTokenAccount,
          token: this.mint.address
        }
      );
      this.logger.error(error.message, {
        name: error.name,
        stack: error.stack
      });
      throw err;
    }

    const senderTokenBalance = senderTokenAccount.value.uiAmount;
    this.logger.info(
      `Required tokens to send: ${this.amount} ${this.mint.address}`,
      {
        required: this.amount,
        token: this.mint.address
      }
    );
    this.logger.info(
      `Sender token balance: ${senderTokenBalance} ${this.mint.address}`,
      {
        senderAssociatedTokenAccount,
        senderTokenBalance
      }
    );

    if (!senderTokenBalance || senderTokenBalance < this.amount) {
      this.logger.error(
        `Insufficient funds in sender token account on ${this.network} network. Balance: ${senderTokenBalance} ${this.mint.address}, Required: ${this.amount} ${this.mint.address}`,
        {
          network: this.network,
          senderAssociatedTokenAccount,
          senderTokenBalance,
          required: this.amount
        }
      );
      throw new Error(
        `Insufficient funds in sender token account on ${this.network} network. Balance: ${senderTokenBalance} ${this.mint.address}, Required: ${this.amount} ${this.mint.address}`
      );
    }
  }

  /**
   * Sends the transaction to the Solana network and returns the transaction signature.
   * @param transaction - The transaction to send
   * @throws {Error} - Throws an error if the transaction fails to send.
   * @returns {Promise<string>} - The transaction signature.
   */
  private async sendTransaction(
    transaction: VersionedTransaction
  ): Promise<string> {
    this.logger.info("Sending transaction...");
    try {
      const signature = await this.connection.sendTransaction(transaction);

      this.logger.info("Transaction sent with signature:", signature, {
        signature
      });
      this.logger.info(
        `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=${this.network}`
      );
      this.logger.info(
        `View on Solscan: https://solscan.io/tx/${signature}?cluster=${this.network}`
      );

      return signature;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error instanceof SendTransactionError) {
        const txLogs = await error.getLogs(this.connection);
        this.logger.error("Transaction logs", { txLogs });
      }
      this.logger.error("Transaction failed to send", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      throw new Error(
        `Transaction failed to send. Please check the logs for more details.`
      );
    }
  }

  /**
   * Confirms the transaction by checking its status on the Solana network.
   * @param signature - The transaction signature to confirm
   * @throws {Error} - Throws an error if the transaction confirmation fails after the timeout.
   * @returns {Promise<void>}
   */
  private async confirmTransaction(signature: string): Promise<void> {
    let commitment: string | undefined;
    let attempts = 0;
    const maxAttempts = Math.ceil(this.timeout / 1000); // Convert timeout to seconds
    while (attempts < maxAttempts) {
      const status = await this.connection.getSignatureStatus(signature);
      if (status.value?.err) {
        this.logger.error("Transaction failed", {
          error: JSON.stringify(status.value.err)
        });
        throw new Error(
          `Transaction failed: ${JSON.stringify(status.value.err)}`
        );
      }
      commitment = status.value?.confirmationStatus;
      this.logger.info(`Confirmation Status: ${commitment}`, {
        status: commitment
      });
      if (commitment === "confirmed") break;
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before checking again
    }

    if (commitment !== "confirmed") {
      this.logger.error(
        `Transaction not confirmed within ${this.timeout} ms. Confirmation status unknown. Check signature: ${signature}`,
        {
          commitment,
          signature,
          timeout: this.timeout
        }
      );
      throw new Error(
        `Transaction not confirmed within ${this.timeout} ms. Confirmation status unknown. Check signature: ${signature}. Last confirmation status: ${commitment}`
      );
    }

    this.logger.info("✓ Transaction confirmed");
  }
}
