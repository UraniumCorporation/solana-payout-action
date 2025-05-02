import "dotenv/config";
import { getInput, setOutput, setFailed } from "@actions/core";

import { SolanaPayoutService } from "./lib/solana";

/**
 * Main function to execute the Solana Payout GitHub Action
 */
async function main(): Promise<void> {
  try {
    // Get sender wallet secret from environment variables
    const senderWalletSecret = process.env.SENDER_WALLET_SECRET;
    if (!senderWalletSecret) {
      throw new Error(
        "Environment variable SENDER_WALLET_SECRET is not set, please set it in the repository secrets"
      );
    }

    // Get inputs from the GitHub Action
    const recipientWalletAddress = getInput("recipient-wallet-address", {
      required: true,
      trimWhitespace: true,
    });
    const amount = parseFloat(
      getInput("amount", { required: true, trimWhitespace: true })
    );
    const network =
      getInput("network", { required: false, trimWhitespace: true }) ||
      "mainnet-beta";
    const token = getInput("token", { required: true, trimWhitespace: true });
    const timeout = parseInt(
      getInput("timeout", { required: false, trimWhitespace: true })
    );

    // Create, initialize, and execute the payment service
    const payoutService = new SolanaPayoutService(
      senderWalletSecret,
      recipientWalletAddress,
      amount,
      token,
      network,
      timeout
    );

    await payoutService.initialize();
    const signature = await payoutService.executePayment();

    // Set outputs for GitHub Actions
    setOutput("success", "true");
    setOutput("error", "");
    setOutput("transaction", signature);
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error)
    );

    // Set outputs for GitHub Actions
    setOutput("success", "false");
    setOutput("error", error instanceof Error ? error.message : String(error));
    setOutput("transaction", "");

    setFailed(error instanceof Error ? error.message : String(error));
  }
}

// Run the main function
main();
