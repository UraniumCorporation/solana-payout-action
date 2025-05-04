import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

export async function checkAccountExists(
  connection: Connection,
  address: PublicKey
): Promise<boolean> {
  try {
    const account = await connection.getAccountInfo(address);
    return account !== null;
  } catch (error) {
    console.error("Error checking account existence:", error);
    return false;
  }
}

async function getAssociatedTokenAccount(
  connection: Connection,
  address: PublicKey,
  mint: PublicKey
) {
  try {
    const account = await connection.getAccountInfo(address);
    if (!account) {
      throw new Error(`Account not found: ${address.toBase58()}`);
    }

    const associatedTokenAccount = getAssociatedTokenAddressSync(
      mint,
      address,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  } catch (error) {}
}
