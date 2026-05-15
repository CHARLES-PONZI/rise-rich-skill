# @rise-rich/skill-helpers

Helpers for agents working with the rise.rich protocol. Companion to the [rise-rich-protocol agent skill](../../SKILL.md).

## What's in the box

| Module | Purpose |
|---|---|
| `Constants` | Program IDs, tenant addresses, USDC mints, WSOL mint |
| `PDA` | Every Rise + Mayflower PDA derived correctly |
| `RiseApi` | Typed HTTP client for all 12 integration-API endpoints with 429-aware backoff |
| `confirmAndCheckErr` | `confirmTransaction` + `meta.err` safety check (catches silent `6041 SlippageExceeded`) |
| `quoteSellLocal` | Local sell quote that works around the upstream SDK's fee bug |

## What's NOT here

No `leverageBuy` / `leverageSell` ix builders, no chunker, no loop-orchestration glue. See [the main README](../../README.md#whats-not-inside-and-why).

## Install

Not yet published to npm. Vendor `src/` directly into your project, or clone the repo and link:

```bash
git clone https://github.com/CHARLES-PONZI/rise-rich-skill.git
cd rise-rich-skill/packages/rise-skill-helpers
npm install
npm run build
npm link
# then in your project:
npm link @rise-rich/skill-helpers
```

## Quick start

```ts
import { RiseApi, confirmAndCheckErr, PDA, Constants } from "@rise-rich/skill-helpers";
import { Connection, VersionedTransaction, Keypair } from "@solana/web3.js";

const api = new RiseApi({ apiKey: process.env.RISE_API_KEY!, network: "mainnet" });
const connection = new Connection(process.env.RPC_URL!, "confirmed");

const { quote } = await api.quoteTrade(market, { amount: 100_000_000n, direction: "buy" });
const minTokenOut = Math.floor(Number(quote.amountOut) * 0.99);
const { transaction } = await api.buy(market, { wallet: wallet.publicKey.toBase58(), cashIn: 100_000_000n, minTokenOut: BigInt(minTokenOut) });

const tx = VersionedTransaction.deserialize(Buffer.from(transaction, "base64"));
tx.sign([wallet]);
const sig = await connection.sendRawTransaction(tx.serialize());
await confirmAndCheckErr(connection, sig);  // throws on silent 6041
```

## License

MIT.
