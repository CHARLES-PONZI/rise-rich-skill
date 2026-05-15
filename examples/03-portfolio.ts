/**
 * 03-portfolio — fetch portfolio summary + positions with P&L.
 *
 * Demonstrates: GET /users/{wallet}/portfolio/{summary,positions}.
 *
 * Run:  RISE_API_KEY=... WALLET=<pubkey> npx ts-node 03-portfolio.ts
 */

import { RiseApi } from "@rise-rich/skill-helpers";

async function main() {
  const apiKey = process.env.RISE_API_KEY!;
  const wallet = process.env.WALLET!;
  if (!apiKey || !wallet) throw new Error("set RISE_API_KEY, WALLET");

  const api = new RiseApi({ apiKey, network: "mainnet" });

  const { summary } = await api.portfolioSummary(wallet);
  console.log(`portfolio summary for ${wallet}:`);
  console.log(`  total value:    $${summary.total_value_usd}`);
  console.log(`  total P&L:      $${summary.total_pnl_usd}`);
  console.log(`  transactions:    ${summary.total_transactions}`);
  console.log(`  tokens held:     ${summary.tokens_held}`);
  console.log(`  tokens created:  ${summary.tokens_created_count}`);

  const { results, total } = await api.portfolioPositions(wallet, 1, 20);
  console.log(`\npositions (${total} total):\n`);

  for (const p of results) {
    const pnlSign = Number(p.pnl_usd) >= 0 ? "+" : "";
    console.log(
      `${p.token_symbol.padEnd(10)} ${p.token_name.padEnd(20)} ` +
        `qty=${Number(p.net_tokens).toFixed(2).padStart(12)} ` +
        `value=$${Number(p.position_value_usd).toFixed(2).padStart(10)} ` +
        `P&L=${pnlSign}$${Number(p.pnl_usd).toFixed(2)} (${pnlSign}${Number(p.pnl_percentage).toFixed(2)}%)`,
    );
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
