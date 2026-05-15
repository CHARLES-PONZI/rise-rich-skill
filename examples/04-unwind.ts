/**
 * 04-unwind — close a leveraged position cleanly.
 *
 * Demonstrates the canonical two-step unwind without atomic `leverageSell`:
 *   1. POST /program/repay-and-withdraw  — repays debt + withdraws collateral
 *   2. POST /program/sellToken           — sells freed tokens back to the curve
 *
 * For atomic deleverage in a single tx, you'd use `leverageSell` from the IDL.
 * This skill intentionally does not ship that builder; see README.
 *
 * Run:
 *   RISE_API_KEY=... RPC_URL=... WALLET_PATH=... MARKET=<addr> \
 *     WITHDRAW_AMOUNT=<raw-tokens> npx ts-node 04-unwind.ts
 *
 * WITHDRAW_AMOUNT is how much collateral to pull. The API decides the repay amount
 * automatically based on the LTV that must remain after withdrawal.
 */

import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { RiseApi, confirmAndCheckErr } from "@rise-rich/skill-helpers";
import * as fs from "node:fs";

async function signAndSend(
  connection: Connection,
  wallet: Keypair,
  txBase64: string,
  label: string,
): Promise<string> {
  const tx = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  console.log(`  ${label} sent: ${sig}`);
  await confirmAndCheckErr(connection, sig);
  console.log(`  ${label} confirmed: https://solscan.io/tx/${sig}`);
  return sig;
}

async function main() {
  const apiKey = process.env.RISE_API_KEY!;
  const rpcUrl = process.env.RPC_URL!;
  const walletPath = process.env.WALLET_PATH!;
  const market = process.env.MARKET!;
  const withdrawAmount = BigInt(process.env.WITHDRAW_AMOUNT!);
  const slippageBps = Number(process.env.SLIPPAGE_BPS ?? "300"); // 3% — unwinds can move price

  if (!apiKey || !rpcUrl || !walletPath || !market || !withdrawAmount) {
    throw new Error("set RISE_API_KEY, RPC_URL, WALLET_PATH, MARKET, WITHDRAW_AMOUNT");
  }

  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))),
  );
  const connection = new Connection(rpcUrl, "confirmed");
  const api = new RiseApi({ apiKey, network: "mainnet" });

  // step 1 — atomic repay + withdraw
  console.log(`step 1: repay-and-withdraw (${withdrawAmount} tokens)`);
  const step1 = await api.repayAndWithdraw(market, {
    wallet: wallet.publicKey.toBase58(),
    withdrawAmount,
  });
  console.log(`  repay amount: ${step1.repayAmount} (includedRepay=${step1.includedRepay})`);
  await signAndSend(connection, wallet, step1.transaction, "step1");

  // step 2 — sell the freed tokens
  console.log(`\nstep 2: sellToken (${withdrawAmount} tokens)`);
  const { quote } = await api.quoteTrade(market, { amount: withdrawAmount, direction: "sell" });
  console.log(`  sell quote: ${quote.amountInHuman} tokens -> ${quote.amountOutHuman} ${quote.priceImpact >= 0 ? "(impact " + (quote.priceImpact * 100).toFixed(2) + "%)" : ""}`);

  const minCashOut = Math.floor(Number(quote.amountOut) * (1 - slippageBps / 10_000));
  const step2 = await api.sell(market, {
    wallet: wallet.publicKey.toBase58(),
    tokenIn: withdrawAmount,
    minCashOut: BigInt(minCashOut),
  });
  await signAndSend(connection, wallet, step2.transaction, "step2");

  console.log("\nunwind complete.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
