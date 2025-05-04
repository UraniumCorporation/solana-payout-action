import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface NetworkUrls {
  [key: string]: string;
}

export const NETWORK_URLS: NetworkUrls = {
  "mainnet-beta":
    "https://attentive-misty-fire.solana-mainnet.quiknode.pro/0b36d5bc75f1cdb3d1a872cf5a66945bf0b412a4/",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

/**
 * Solana's minimum transaction fee is 0.000005 SOL (5,000 lamports) per signature
 * Set a conservative buffer (0.05 SOL) to ensure transaction success
 * This covers potential fee increases due to:
 * - Network congestion
 * - Number of instructions in the transaction
 * - Additional signatures if required
 * - Compute units consumed
 */
export const TRANSACTION_FEE_BUFFER = 0.05 * LAMPORTS_PER_SOL;

/**
 * Solana's cost to create a token account (rent exemption + transaction fee) is ~0.00203928 SOL
 * Set a conservative buffer of 0.003 SOL to provide a small buffer
 */
export const TOKEN_ACCOUNT_CREATION_COST = 0.003 * LAMPORTS_PER_SOL;
