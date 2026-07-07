# Examples

Runnable scripts demonstrating the canonical flows for interacting with rise.rich via the integration API.

All examples assume:

```bash
export RISE_API_KEY="your-key-here"
export RPC_URL="https://api.mainnet-beta.solana.com"   # or your Helius endpoint
export WALLET_PATH="$HOME/.config/solana/id.json"      # standard solana-keygen layout
export RPC_WS_URL="wss://mainnet.helius-rpc.com/?api-key=..."  # only for 05-detect-launches
```

(`05-detect-launches.ts` needs only `RPC_WS_URL` — no API key, no wallet.)

Build the helpers package once before running:

```bash
cd ../packages/rise-skill-helpers
npm install
npm run build
cd ../../examples
npm install
```

Then run any example with `npx ts-node 01-list-markets.ts` (or compile first).

| Example | What it does |
|---|---|
| `01-list-markets.ts` | Lists top 10 markets sorted by 24h volume, prints them as a table |
| `02-quote-and-buy.ts` | Quotes a buy on a given market, builds + signs + sends the tx, checks `meta.err` |
| `03-portfolio.ts` | Fetches portfolio summary + per-position P&L for a wallet |
| `04-unwind.ts` | Repays debt + withdraws collateral + sells back to the curve (2 txs) |
| `05-detect-launches.ts` | Watches the Rise program over a websocket and prints new `InitMarket` launches in real time — no API polling |

None of these examples implement `leverageBuy`-based auto-looping or the atomic launcher — see [the main README](../README.md#whats-not-inside-and-why) for why. `05-detect-launches.ts` is the minimal happy path; production detection also needs reconnect + missed-slot gap-fill (covered in SKILL.md → "Real-time launch detection").

## Disclaimer

These are reference examples, not production code. They omit error recovery, retry logic, priority-fee plumbing, and observability that a real integration would have.
