import {
  Connection,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

export async function makeVersionedTransaction(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[]
) {
  const latestBlockhash = await connection.getLatestBlockhash({
    commitment: "confirmed",
  });

  console.log("Latest Blockhash:", latestBlockhash.blockhash);
  const transactionMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    instructions: instructions,
    recentBlockhash: latestBlockhash.blockhash,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(transactionMessage);
  transaction.sign([payer]);

  console.log("Transaction created successfully.");
  return transaction;
}
