/**
 * 01-list-markets — fetch top markets sorted by 24h volume.
 *
 * Demonstrates: `GET /markets` with sort/filter params, response shape.
 *
 * Run:  RISE_API_KEY=... npx ts-node 01-list-markets.ts
 */

import { RiseApi } from "@rise-rich/skill-helpers";

async function main() {
  const apiKey = process.env.RISE_API_KEY;
  if (!apiKey) throw new Error("set RISE_API_KEY");

  const api = new RiseApi({ apiKey, network: "mainnet" });

  const { markets, total } = await api.listMarkets({
    sort: "volume24h",
    order: "desc",
    limit: 10,
    vol24h_min: 100, // skip dead markets
  });

  console.log(`top ${markets.length} markets by 24h volume (of ${total} total):\n`);

  for (const m of markets) {
    const collateral = m.mint_main === "So11111111111111111111111111111111111111112" ? "SOL" : "USDC";
    const price = Number(m.price).toFixed(6);
    const floor = Number(m.mayflower_floor).toFixed(6);
    const vol = Number(m.volume_h24_usd).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const deltaPct = m.delta_to_floor_percentage ?? "?";

    console.log(
      `${m.token_symbol.padEnd(10)} ${m.token_name.padEnd(20)} ${collateral.padEnd(4)} ` +
        `px=${price.padStart(10)} floor=${floor.padStart(10)} ` +
        `Δ↑floor=${deltaPct.padStart(6)}%  vol24h=$${vol.padStart(10)}  ` +
        `holders=${String(m.holders_count).padStart(5)}`,
    );
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
