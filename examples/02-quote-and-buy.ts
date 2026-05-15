/**
 * 02-quote-and-buy — full canonical buy flow.
 *
 * Demonstrates:
 *   - POST /markets/{addr}/quote to preview the trade
 *   - POST /program/buyToken to get a signed-ready VersionedTransaction
 *   - sign + send + confirm
 *   - confirmAndCheckErr to catch silent 6041 SlippageExceeded
 *
 * Run:
 *   RISE_API_KEY=... RPC_URL=... WALLET_PATH=... MARKET=<mint-or-rise-addr> CASH_IN=1000000 \
 *     npx ts-node 02-quote-and-buy.ts
 *
 * CASH_IN is in raw units (1_000_000 = 1 USDC for USDC markets, 0.001 SOL for SOL markets).
 */

import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { RiseApi, confirmAndCheckErr, TxLandedButRevertedError } from "@rise-rich/skill-helpers";
import * as fs from "node:fs";

async function main() {
  const apiKey = process.env.RISE_API_KEY!;
  const rpcUrl = process.env.RPC_URL!;
  const walletPath = process.env.WALLET_PATH!;
  const market = process.env.MARKET!;
  const cashIn = BigInt(process.env.CASH_IN ?? "1000000");
  const slippageBps = Number(process.env.SLIPPAGE_BPS ?? "100"); // 1%

  if (!apiKey || !rpcUrl || !walletPath || !market) {
    throw new Error("set RISE_API_KEY, RPC_URL, WALLET_PATH, MARKET");
  }

  const walletJson = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletJson));
  const connection = new Connection(rpcUrl, "confirmed");

  const api = new RiseApi({ apiKey, network: "mainnet" });

  // 1. Quote
  const { quote } = await api.quoteTrade(market, { amount: cashIn, direction: "buy" });
  console.log(`quote: ${quote.amountInHuman} in -> ${quote.amountOutHuman} out`);
  console.log(`  price impact: ${(quote.priceImpact * 100).toFixed(3)}%`);
  console.log(`  fee: $${quote.feeAmountUsd.toFixed(4)} (${(quote.feeRate * 100).toFixed(2)}%)`);

  // 2. Build tx with slippage cushion.
  // BigInt math preserves precision for raw amounts above Number.MAX_SAFE_INTEGER (2^53-1).
  const amountOut = BigInt(quote.amountOut);
  const minTokenOut = (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  const { transaction } = await api.buy(market, {
    wallet: wallet.publicKey.toBase58(),
    cashIn,
    minTokenOut,
  });

  // 3. Sign + send
  const tx = VersionedTransaction.deserialize(Buffer.from(transaction, "base64"));
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  console.log(`sent: ${sig}`);

  // 4. Confirm AND check meta.err (critical — see SKILL.md gotcha #1)
  try {
    await confirmAndCheckErr(connection, sig);
    console.log(`confirmed: https://solscan.io/tx/${sig}`);
  } catch (e) {
    if (e instanceof TxLandedButRevertedError) {
      console.error(`tx landed but reverted: ${e.message}`);
      console.error(`solscan: https://solscan.io/tx/${sig}`);
      process.exit(2);
    }
    throw e;
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
