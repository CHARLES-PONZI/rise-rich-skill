/**
 * 05-detect-launches — watch for new rise.rich token launches in real time.
 *
 * Demonstrates the no-polling detection recipe from SKILL.md
 * ("Real-time launch detection"): subscribe to the Rise program's logs over a
 * websocket (`logsSubscribe` under the hood) and match the `Instruction: InitMarket`
 * Anchor log line. Costs none of the API's 150/min budget.
 *
 * Run:  RPC_WS_URL=wss://... npx ts-node 05-detect-launches.ts
 *   Helius: wss://mainnet.helius-rpc.com/?api-key=<key>  — any RPC with WS works.
 *
 * NOTE: this is the minimal happy path. Production detection also needs
 * reconnect-with-jittered-backoff and gap-fill of missed slots via
 * getSignaturesForAddress(RISE_PROGRAM_ID, { until: lastSeenSig }) — see SKILL.md.
 */

import { Connection } from "@solana/web3.js";
import { Constants } from "@rise-rich/skill-helpers";

async function main() {
  const wsUrl = process.env.RPC_WS_URL;
  if (!wsUrl) throw new Error("set RPC_WS_URL (a websocket RPC endpoint)");

  // Connection needs an HTTP url too; derive it from the ws url (or pass RPC_URL).
  const httpUrl = process.env.RPC_URL ?? wsUrl.replace(/^ws/, "http");
  const connection = new Connection(httpUrl, { wsEndpoint: wsUrl, commitment: "confirmed" });
  const riseProgram = Constants.RISE_PROGRAM_ID;

  console.log(`watching ${riseProgram.toBase58()} for InitMarket...`);

  const subId = connection.onLogs(
    riseProgram,
    (log) => {
      if (log.err) return; // skip failed txs
      const isLaunch = log.logs.some((l) => l.includes("Instruction: InitMarket"));
      if (!isLaunch) return;

      console.log(`\n🚀 new launch  sig=${log.signature}`);
      console.log(`   solscan: https://solscan.io/tx/${log.signature}`);
      // Enrich from here: connection.getTransaction(sig) for the market/mint,
      // or GET /markets/{addr} once it's indexed, for name/ticker/curve params.
    },
    "confirmed",
  );

  console.log(`subscribed (id=${subId}). Ctrl-C to stop.`);
  await new Promise(() => {}); // keep the process alive
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
