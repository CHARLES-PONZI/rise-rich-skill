---
name: rise-rich-protocol
description: Use when integrating with the rise.rich protocol on Solana — querying markets, buying/selling, borrowing/repaying, unwinding positions, indexing events, launching new tokens (including atomic Jito-bundled creator leverage), composing rise flows via CPI in your own program, detecting new launches in real time, or reasoning about its floor-backed lending model. The canonical agent-facing reference for the protocol; covers both the public integration API (easy lane) and direct Anchor/IDL program calls (advanced lane).
---

# rise.rich Protocol

## Sources

This skill is distilled from the official rise.rich sources. When facts in this skill disagree with these sources, the sources win:

- **Protocol docs:** https://docs.rise.rich/introduction
- **Canonical repo (IDLs, PROGRAM.md, API.md, INDEXING.md):** https://github.com/riserich/rise-docs
- **Official SDK:** https://github.com/riserich/SDK (`@riserich/sdk`)

## What rise.rich is, in one paragraph

rise.rich is a **bonding-curve token launchpad with built-in floor-backed lending** on Solana. Every market has a token mint + a linear bonding curve + a monotonically rising floor price. Users can deposit tokens as collateral and borrow `mint_main` (SOL or USDC) against that collateral, valued at floor. Because the floor never decreases, `collateral_value ≥ debt` is invariant by construction — so the protocol has **no oracles and no liquidations**, ever. The "interest-free non-recourse borrowing" model falls out of this directly.

## Mental model

Three principles drive every decision:

1. **The IDL is truth, not the docs.** The published `docs/PROGRAM.md` covers 8 of 22 instructions. The bundled IDL exposes the rest. When in doubt, derive account lists from the IDL.
2. **Two programs, not one.** **Rise** (`RiseZSHaLdj7pfn1tisUoSdG2i3QcVz9sQKuaRG9rar`) is a thin orchestration wrapper that CPI's into **Mayflower** (`AVMmmRzwc2kETQNhPiFVnyu62HrgsQXTD6D7SnSfEz7v`). Mayflower is the real engine — bonding curves, collateral, debt accounting, the global `LogAccount`. Both programs have PDAs you'll touch.
3. **Pick the easy lane unless you have a reason not to.** The integration API exposes most user-facing flows as one HTTP call returning a signed-ready VersionedTransaction. Drop to direct IDL only for things the API doesn't expose (notably atomic loops via `leverageBuy` / `leverageSell`) or when rate limits matter for your workload.

## When to use this skill

- Integrating a frontend, bot, or backend with rise.rich markets
- Building trading interfaces, portfolio dashboards, or market scanners
- Quoting buys/sells or computing borrow capacity
- Borrowing against deposited collateral and unwinding positions
- Launching a new token (`initMarket`) or wrapping creator-side operations
- Indexing rise/Mayflower events
- Reasoning about the protocol model for product/UX decisions

## When NOT to use this skill

- Generic Solana program design (framework choice, Token-2022 rules, IDL codegen) → use a Solana smart-contract dev skill
- Auditing a non-rise program (Sealevel attack classes) → use a Solana security audit skill
- Pure off-chain math without protocol coupling

If your task touches user funds with chained transactions, audit the flow before shipping. Mayflower's `LogAccount` is a global mutable PDA, all accounts are caller-supplied, and Solana has no implicit safety — the eight Sealevel attack classes (signer / owner / data-matching / duplicate-mutable / reinit / revival / arbitrary-CPI / type-cosplay / PDA-sharing) all apply.

---

## Pick a lane: Integration API vs Direct program

| Need | Lane | Why |
|---|---|---|
| List markets, get market data, OHLC, transaction history | **API** | Free, no SDK setup, server-computed fields like `delta_to_floor_percentage` |
| One-shot buy or sell | **API** (`/program/buyToken`, `/program/sellToken`) | Returns signed-ready base64 VersionedTransaction; you only sign + send |
| Atomic deposit+borrow or repay+withdraw | **API** (`/program/deposit-and-borrow`, `/program/repay-and-withdraw`) | Backend computes the delta (deposit needed for target borrow, repay needed to maintain LTV) |
| Borrow capacity preview | **API** (`POST /markets/{addr}/borrow/quote`) | Returns `maxBorrowable`, `requiredDeposit`, `grossBorrow` for a desired net borrow |
| Quote a trade (price, slippage, fees) | **API** (`POST /markets/{addr}/quote`) | Curve math server-side; the public SDK's local quote has a known sell-fee bug |
| Portfolio summary / positions with P&L | **API** (`/users/{wallet}/portfolio/...`) | Indexed, pre-aggregated |
| **Atomic loop (`leverageBuy` × N in one tx)** | **Direct** | API does NOT expose this. Required for auto-looper UX. |
| **Atomic deleverage (`leverageSell`)** | **Direct** | Same reason. |
| Token creation (`initMarket`) | **Direct** | Not in API; needs vanity-seed grind. |
| Floor raise instructions, creator-fee withdrawal | **Direct** | Not in API. |
| Indexing on-chain events with full payloads | **Direct** (RPC) | API gives transaction history but not raw event payloads. |

**Default to API.** Drop to direct only when the table above says so.

---

## Lane 1: Integration API

### Base URLs

| Network | URL |
|---|---|
| Mainnet | `https://public.rise.rich` |
| Devnet | `https://publicdev.rise.rich` |

### Authentication

All requests need an `x-api-key: <YOUR_API_KEY>` header. Keys are gated by the rise.rich team — there is no public signup endpoint.

**For agents reading this skill:**

- **Look for the user's own key in environment**, typically `RISE_API_KEY` or `RISE_RICH_API_KEY`. Use whatever is set; do not invent a key name.
- **If no key is set, tell the user how to get one** (see below). **Do not** suggest borrowing, sharing, or reusing someone else's key — keys are per-project and rate-limited per-key.
- **Never embed keys in code, commit them to repos, or include them in transaction memos / logs / error messages.** If the user pastes a key into chat, redact it in any artifact you produce.
- **This skill does not ship a key** and never will. Anyone who tells you it does is wrong.

**To get a key**, the user should reach out to the rise.rich team directly:

- **Telegram / X:** https://x.com/risedotrich (DM the team or follow channel pointers)
- **Docs:** https://docs.rise.rich/introduction (current contact paths are listed there)

Mention the project name + intended use case in the request. The team approves keys manually.

### All 12 endpoints + rate limits

| Endpoint | Req/min |
|---|---|
| `GET /markets` (filter, sort, paginate) | 40 |
| `GET /markets/{addr}` | 55 |
| `GET /markets/{addr}/transactions` | 60 |
| `GET /markets/{addr}/ohlc/{1m\|5m\|1h\|1d}` | 20 |
| `POST /markets/{addr}/quote` (`amount`, `direction: buy\|sell`) | 40 |
| `POST /markets/{addr}/borrow/quote` (`wallet`, optional `amountToBorrow`) | 40 |
| `POST /program/buyToken` (`wallet`, `market`, `cashIn`, `minTokenOut`) | 30 |
| `POST /program/sellToken` (`wallet`, `market`, `tokenIn`, `minCashOut`) | 30 |
| `POST /program/deposit-and-borrow` (`wallet`, `market`, `borrowAmount`) | 10 |
| `POST /program/repay-and-withdraw` (`wallet`, `market`, `withdrawAmount`) | 10 |
| `GET /users/{wallet}/portfolio/summary` | 60 |
| `GET /users/{wallet}/portfolio/positions` | 60 |
| **Global cap (all endpoints combined)** | **150** |

`429` returns `{ ok: false, error }`. Repeated violations across separate minutes trigger progressive cooldowns: 1 min → 5 min → 20 min → 1 day after the 4th violation. **Back off on 429** to avoid the cooldown.

### Address resolution

Every endpoint accepts **either** the SPL token mint **or** the Rise market address. Whichever your caller has, pass it through.

### Amounts

Always **RAW units** (no decimals). SOL = 9 decimals (`0.1 SOL = 100_000_000`). USDC = 6 decimals (`1 USDC = 1_000_000`). Market tokens match `mint_main` decimals.

### Canonical flow: Quote → Trade → Sign & Send → **check `meta.err`**

```ts
import { VersionedTransaction, Connection } from "@solana/web3.js";

// 1. Quote
const { quote } = await fetch(`${API}/markets/${market}/quote`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": KEY },
  body: JSON.stringify({ amount: 100_000_000, direction: "buy" }),
}).then(r => r.json());

// 2. Build tx (1% slippage)
const minTokenOut = Math.floor(quote.amountOut * (1 - 0.01));
const { transaction } = await fetch(`${API}/program/buyToken`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": KEY },
  body: JSON.stringify({ wallet: wallet.publicKey.toBase58(), market, cashIn: 100_000_000, minTokenOut }),
}).then(r => r.json());

// 3. Sign + send
const tx = VersionedTransaction.deserialize(Buffer.from(transaction, "base64"));
tx.sign([wallet]);
const sig = await connection.sendRawTransaction(tx.serialize());
await connection.confirmTransaction(sig, "confirmed");

// 4. CRITICAL — check meta.err. Confirmed != succeeded.
const result = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
if (result?.meta?.err) {
  // Common: { Custom: 6041 } = SlippageExceeded. Tx landed and consumed fees, but reverted.
  throw new Error(`tx ${sig} landed but reverted: ${JSON.stringify(result.meta.err)}`);
}
```

### Borrow capacity preview

```ts
POST /markets/{addr}/borrow/quote
body: { wallet, amountToBorrow?: number }
```
Returns:
```
{
  depositedTokens, walletBalance, debt,
  maxBorrowable, maxBorrowableIfDepositAll, maxBorrowableUsd, maxBorrowableIfDepositAllUsd,
  floorPrice, borrowFeePercent,
  requiredDeposit?, grossBorrow?    // only set when amountToBorrow is provided
}
```

### Unwind recipe (without atomic `leverageSell`)

Two calls. Both rate-limited to 10/min — fine for unwinds.

```ts
// 1. Repay debt + pull collateral out of position (single atomic tx)
POST /program/repay-and-withdraw  body: { wallet, market, withdrawAmount }
// → { transaction, repayAmount, withdrawAmount, includedRepay }

// 2. Sell the freed tokens back to the curve
POST /program/sellToken           body: { wallet, market, tokenIn, minCashOut }
```

For **atomic** deleverage in a single tx, use Lane 2's `leverageSell` IDL call. The API does not expose it.

### Market list filtering + response schema (`GET /markets`, verified live 2026-07-02)

Sortable by: `created` (default), `marketcap`, `volume24h`, `holders`, `floor`, `price`, `variation`, `near_floor`, `liquidity`. Filterable by: `is_verified`, `creator_fee_min/max`, `mcap_min/max`, `vol24h_min/max`, `locked_min/max`, `created_period: today|yesterday|week|month`. Responses cached server-side for 10s per unique param combination.

Response shape: `{ ok, count, total, page, limit, totalPages, markets[] }` — the full catalog is paginated (>1,100 markets at probe time), and each row carries `created_at`, so **full protocol history is walkable**. Per-market fields go well beyond the two computed ones the docs advertise:

- **Identity / curation:** `token_name`, `token_symbol`, `token_uri`, `token_image`, `website`, `twitter`, `telegram`, `discord`, `is_verified`
- **Trust / filter signals:** `creator`, `creator_fee_percent`, `disableSell`, `flags` (the `MarketPermissions` bitfield), `holders_count`, `created_at`, `updated_at`, `total_fees_creator`, `total_fees_creator_withdrawn`
- **Market data:** `price`, `mayflower_floor`, curve params (`mayflower_m1/m2/b1/b2/x2`), `volume_h24_usd`, `volume_all_time_usd`, `market_cap_usd`, `mayflower_total_debt`, `mayflower_total_collateral`, `mayflower_token_supply`, `next_floor_trigger_price`, `next_raise_available_at`
- **Computed:** `delta_to_floor_percentage` = `((price − floor) / floor) × 100`; `locked_supply_percentage` = `(mayflower_total_collateral / mayflower_token_supply) × 100`

**NOT in the payload: dutch-auction params (`dutchConfig*`).** Read those on-chain when entry-timing against a boosted launch.

---

## Lane 2: Direct program integration

### Lane choice (compatibility — this is locked)

**Use `@solana/web3.js@^1.x` + `@coral-xyz/anchor@^0.29`.** The published rise SDK pins these. `@solana/kit` (web3.js v2) is a migration — you'd bypass the SDK and regenerate clients via Codama. Don't mix the two; their `TransactionInstruction` vs `IInstruction` types are incompatible.

### Constants

```
RISE_PROGRAM_ID         = "RiseZSHaLdj7pfn1tisUoSdG2i3QcVz9sQKuaRG9rar"
MAYFLOWER_PROGRAM_ID    = "AVMmmRzwc2kETQNhPiFVnyu62HrgsQXTD6D7SnSfEz7v"
RISE_TENANT (mainnet)   = "5scY2JGWLnBubCMbWrn1gi8FQEP8SPjvQ1hfjW4ktYUb"
RISE_TENANT_SEED        = "Eg4Akr8HRv3gy4MaSp3zgKgC5qnN1V5ZTqAjhT54xJ9L"
MAYFLOWER_TENANT        = "HeBDu9g5EN6qdDJWijHHpxYuMBE6aWvy1BmzFyEa7Q7C"
TEAM_WALLET             = "7p9Wd66uwCdZdAm7EPMooXdghSB9yG4iKpT69ipmms8D"
TOKEN_METADATA_PROGRAM  = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
USDC_MAINNET            = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
NATIVE_MINT (WSOL)      = "So11111111111111111111111111111111111111112"

API_BASE_MAINNET        = "https://public.rise.rich"
API_BASE_DEVNET         = "https://publicdev.rise.rich"

// Devnet:
RISE_DEVNET             = "7gDn1L2Bmg53royeUgvZtWujfvxS9TmpchtBToP9zDhB"
MAYFLOWER_DEVNET        = "MD2pPJCjpUT5ttJFUVeP2Xka1ZSvCJMZUoX4XTdPdet"
```

### PDAs you must derive

**Rise:**

| PDA | Seeds |
|---|---|
| Tenant | `["tenant", seed_pubkey]` |
| Market | `["market", rise_tenant, market_meta]` |
| PersonalAccount | `["personal_account", market, owner]` |
| CashEscrow | `["cash_escrow", rise_market]` |
| CreatorEscrow | `["creator_escrow", rise_market]` |
| TeamEscrow | `["team_escrow", mint_main]` ← **per `mint_main`, NOT per market** |
| TeamConfig | `["team_config"]` (global) |
| MintToken | `[vanity_seed.to_le_bytes()]` — must hash to address ending in "rise" |

**Mayflower:**

| PDA | Seeds |
|---|---|
| Tenant | `["tenant", seed_address]` |
| MarketGroup | `["market_group", seed_address]` |
| Market | `["market", seed_address]` |
| MarketMeta | `["market_meta", seed_address]` |
| MintOptions | `["mint_options", market_meta_address]` |
| MarketLinear | `["market_linear", market_meta_address]` |
| LiqVaultMain | `["liq_vault_main", market_meta_address]` |
| RevEscrowGroup | `["rev_escrow_group", market_meta_address]` |
| RevEscrowTenant | `["rev_escrow_tenant", market_meta_address]` |
| **PersonalPosition** | `["personal_position", market_meta_address, owner]` |
| **PersonalPositionEscrow** | `["personal_position_escrow", personal_position_address]` |
| LogAccount | `["log"]` ← **global, mut on every Mayflower op** |

`@rise-rich/skill-helpers` exports a `PDA` module for all of these — prefer the helper over hand-rolling seeds.

### The 22 Rise instructions

The IDL exposes exactly 22 instructions. Listed below in **thematic grouping** for skim-reading — **this is NOT the IDL discriminator order** (the IDL orders them differently; e.g. `buyWithExactCashIn` is #6 and `leverageBuy` is #19 in the IDL, not #7 and #13). For dispatch / discriminator computation, always read the IDL's `instructions[]` array in order — never use these numbers as positions.

```
admin / setup           trading & lending          loop primitives & admin ops
─────────────────       ─────────────────────      ──────────────────────────
version                 buyWithExactCashIn         leverageBuy        ← single-tx loop
initTenant              sellWithExactTokenIn       leverageSell       ← single-tx deleverage
initMarketGroup         deposit                    raiseFloorPreserveArea
initMarket              withdraw                   raiseFloorExcessLiquidity
initPersonalAccount     borrow                     withdrawCreatorFees
initTeamEscrow          repay                      withdrawTeamFees
                                                   updateTeamWallet
                                                   updateTenantAdmin
                                                   revDistribute
                                                   updateMarket
```

The published SDK wraps `buy` and `sell`. The other 20 are direct IDL calls — derive account lists from the bundled IDL (`@riserich/sdk/dist/idl/rise.json`) or read the inline `# Accounts` docs there. Each IDL instruction has account-by-account doc comments explaining its role.

### Account-list patterns by instruction

**Anchor event-CPI trailer.** All Rise instructions emit events via Anchor's `event_cpi` macro, which appends two trailing accounts to every event-emitting instruction: `eventAuthority` (PDA `["__event_authority"]` under the program) and `program` (the program ID itself, used as a sentinel). When you build instructions through Anchor's `program.methods.X().accounts({...})` builder, these trailers are filled automatically — you don't pass them. But the IDL counts them, and if you're constructing raw `TransactionInstruction`s by hand you **must** include them. The counts below are **IDL-true** (functional accounts **plus** event-CPI trailers).

Single-ix operations follow consistent account-list patterns once you know them:

- **`buyWithExactCashIn`** — **24 accounts** (22 functional + 2 event-CPI): buyer (signer), tenant, market, cashEscrow, mayTenant, mayMarketGroup, marketMeta, mayMarket, tenantSeed, mintToken, mintMain, tokenDst, mainSrc, liqVaultMain, revEscrowGroup, revEscrowTenant, tokenProgramMain, tokenProgram, mayflowerProgram, mayLogAccount, creatorEscrow, teamEscrow, **eventAuthority**, **program**. **7 args** (the floor-raise parameters are required even when not raising the floor — pass zeros to skip): `cashIn: u64`, `minTokenOut: u64`, `newShoulderEnd: u64` (0 to skip floor raise), `floorIncreaseRatio: DecimalSerialized`, `maxNewFloor: DecimalSerialized`, `maxAreaShrinkageToleranceUnits: u64`, `minLiqRatio: DecimalSerialized`. Always read the IDL for the canonical signature.
- **`sellWithExactTokenIn`** — **23 accounts** (mirror of buy minus `tenantSeed`, plus event-CPI trailers). `tokenSrc` / `mainDst` swap roles vs buy. Seller is the signer. **2 args**: `tokenIn: u64`, `minCashOut: u64`.
- **`deposit`** / **`withdraw`** — **14 accounts each** (12 functional + 2 event-CPI): owner (signer), personalAccount, market, marketMeta, mayMarket, corePersonalPosition, mayEscrow, mintToken, tokenSrc-or-tokenDst, tokenProgram, mayflowerProgram, mayLogAccount, **eventAuthority**, **program**. Arg: `amount`.
- **`borrow`** — **22 accounts** (20 functional + 2 event-CPI): owner (signer), tenant, market, cashEscrow, personalAccount, mayTenant, mayMarketGroup, marketMeta, liqVaultMain, revEscrowGroup, revEscrowTenant, mayMarket, mintMain, corePersonalPosition, mainDst, tokenProgramMain, mayLogAccount, mayflowerProgram, creatorEscrow, teamEscrow, **eventAuthority**, **program**. Arg: `amount` (gross — user receives `amount × (1 − borrowFee)`).
- **`repay`** — **12 accounts** (10 functional + 2 event-CPI; permissionless — `repayer` need not be the debtor): repayer (signer), marketMeta, mayMarket, corePersonalPosition, mintMain, mainSrc, liqVaultMain, tokenProgramMain, mayflowerProgram, mayLogAccount, **eventAuthority**, **program**. Arg: `amount`.
- **`leverageBuy`** / **`leverageSell`** — see "Loop primitives" section below.

The IDL's per-account docstrings (in `# Accounts` sections of each instruction) are the ground truth. Read them.

### Personal-position layout (Mayflower)

```rust
PersonalPosition {
    market_meta: Pubkey,
    owner: Pubkey,
    escrow: Pubkey,                  // per-position SPL vault for collateral
    deposited_token_balance: u64,    // collateral
    debt: u64,                       // outstanding mint_main debt (GROSS principal)
}
```

### `initPersonalAccount` — does NOT lazy-init

Fresh wallets return `AccountNotFound` on sim. **Prepend `initPersonalAccount`** on the first interaction per `(market, owner)` for any of `deposit`/`borrow`/`leverageBuy`. Idempotent after that.

### Loop primitives (informational — no working code in this skill)

The Rise IDL exposes two single-instruction loop primitives:

```
leverageBuy(exactCashIn: u64, increaseDebtBy: u64, minIncreaseCollateralBy: u64)
leverageSell(...)
```

`leverageBuy` atomically: takes user `exactCashIn` + protocol-borrowed `increaseDebtBy`, buys tokens along the curve, deposits them as collateral, increments user debt. `leverageSell` mirrors it.

**Building a robust multi-loop on top of `leverageBuy` is non-trivial.** You're managing:

- CU budgeting (production measurement, 2026-05: a single `leverageBuy` is ~190k warm / ~220k cold CU on USDC mainnet; per-tx ceiling is 1.4M — so ~3 stacked iters per tx max. Benchmark your target market before locking the chunking strategy; numbers drift with Anchor / Solana / Rise program upgrades.)
- Multi-tx chunking with state re-fetch and slippage re-plan between chunks
- "Auto / Max" convergence math (the geometric series of cash → borrow → cash → borrow with safe LTV cap)
- Priority-fee floor (Helius p50 vs recent-slot p75 vs configured floor)
- Retry on blockhash expiry with re-plan, not blind resend
- Resume reconciliation when chunk N lands but chunk N+1 hasn't
- SOL-market WSOL wrap setup ixs on cold path (3 ixs) vs USDC-market setup (1 ix)

**This skill intentionally does not include working code for the above.** The IDL exposes the primitive; teams building products on rise.rich (auto-loopers, leverage UIs, structured products) treat the orchestration layer as their differentiator. If you need to build one, read the IDL, plan the chunker carefully, and validate predicted-vs-on-chain state against `personal_position.deposited_token_balance` + `personal_position.debt` at every chunk boundary.

### Quote math (off-chain, for previews without an API call)

Linear bonding curve, three regions:

```
x ≤ x1:   p(x) = floor              (floor region)
x ≤ x2:   p(x) = m1·x + b1          (shoulder region)
x  > x2:  p(x) = m2·x + b2          (main region)

b1 = (m2 − m1)·x2 + b2
x1 = (floor − b1) / m1
```

Buy quote: `effectiveCashHuman = amountHuman · (1 − feeRate)`, then binary-search the curve integral.

**Known SDK bug**: the bundled `@riserich/sdk` sell quote uses `market.buyFee` instead of `sellFee`. Use the API's `POST /markets/{addr}/quote` endpoint, or use `@rise-rich/skill-helpers`' `quoteSellLocal()` which fixes the fee.

### Max-borrow formula

```
maxBorrowable_net = (deposited_tokens × floor_price − current_debt) × (1 − borrowFee)
grossBorrow       = the on-chain `amount` argument
netReceived       = grossBorrow × (1 − borrowFee)
```

The 3% origination fee is **not hardcoded** on-chain. It's `Gov.borrowFeeMicroBasisPoints` on the Rise `Market`, parameterized as a `GlobalBallotItem` with `{value, min, max, stepMicroBasisPoints}`. Today the value is fixed by the launch params — voting fields are reserved for future use and no current Rise instruction tallies votes — but the structure is in place. Since the field exists and will be governance-mutable, **read live** via `MarketData.borrowFee` or the API's `borrowFeePercent`; don't hardcode 3%.

---

## Atomic launch ceiling (initMarket + creator buy + leverage)

`initMarket` is too heavy for one transaction. rise.rich's UI splits a launch into **TX1 (legacy — ALT create + extend) + TX2 (V0 — uses the ALT, carries initMarket + creator buy)**: two wallet popups, ~400ms gap for ALT next-slot warmup. If you build a launcher on top, the binding constraint is **not** CU:

| Constraint | Limit | Notes |
|---|---:|---|
| Tx size | 1232 B | Solana packet limit. An ALT compresses each repeated pubkey to a 1-byte index. |
| CU per tx | 1,400,000 | Rarely the binding limit for launch txs. |
| **Instruction trace** | **64** | `MAX_INSTRUCTION_TRACE_LENGTH` — the real bottleneck. Counts top-level ixs **plus** every recursive inner CPI. |

`initMarket` alone emits **24 inner CPIs** (measured 2026-07-02: Mayflower + token program + Metaplex metadata + system). A full launch TX2 runs 53–64 trace depending on path, so a single tx with `initMarket` + 2 `leverageBuy` layers sits *exactly* at the cap; a 3rd busts it.

**Atomic ceiling per path** (empirical):

| Path | Atomic loops | Mechanism | Notes |
|---|---:|---|---|
| Native spot (SOL or USDC) | 0 | single TX2 | `buyWithExactCashIn` deposits to the **wallet ATA**, not a personal_position (gotcha 16). |
| Native SOL | 1 | TX2 at trace 64; WSOL prestaged in a small extra legacy tx | No Jito tip. 3 popups. No USDC equivalent — the WSOL wrap ixs don't exist for USDC markets. |
| Jito bundle | **2** | split initMarket (one tx) from creator-buy + 2×leverage (next tx), bundle both via Jito | TX at loops=3 = 1267 B — over the 1232 packet limit, build-fails pre-broadcast. Ceiling is 2, not 3. |
| Deeper (loops 3+) | 2 atomic + chunks | bundle + post-bundle chunks | Extra chunks land after the bundle and are **sniper-vulnerable — disclose in UI.** |

Building the launcher itself (ALT juggling, WSOL prestage, bundle assembly, trace budgeting) is orchestration this skill does not ship as working code — same stance as the loop primitives above. What you need to *design* it is here; validate any launcher by decoding a known-good rise.rich launch pair with `getTransaction(sig, { maxSupportedTransactionVersion: 0 })` and diffing top-level ixs, ALT contents, tx size, and `meta.innerInstructions` counts against yours.

---

## Jito bundle integration

Jito's block engine submits 1–5 transactions as one atomic bundle that lands in a single slot, in order. Required for atomic creator launches with loops ≥ 2 (any depth for USDC creator leverage) and for any MEV-resistant multi-tx flow.

**Endpoints**

| Cluster | Block engine URL |
|---|---|
| Mainnet | `https://mainnet.block-engine.jito.wtf` |
| Testnet | `https://testnet.block-engine.jito.wtf` |
| Devnet | **not supported** — validate plumbing on testnet, integrate end-to-end on mainnet |

**JSON-RPC** (`POST {url}/api/v1/bundles`, direct fetch — no SDK):
- `sendBundle` — `params: [[base64_tx, ...], { encoding: "base64" }]` → `{ result: "<bundle UUID>" }`
- `getBundleStatuses` — `params: [["<uuid>"]]` → per-tx sigs, slot, confirmation_status, err
- `getInflightBundleStatuses` — → `status: Pending | Landed | Failed | Invalid`, `landed_slot`
- `getTipAccounts` — → live tip-account list (use it; hardcoded lists drift)

**Rules**
- Max 5 txs per bundle. All land in the same slot or none land.
- **Tip is per-bundle, not per-tx.** Append `SystemProgram.transfer(tip → tipAccount)` to the **last** tx. Zero-tip bundles are rejected before a UUID is even issued (`must write lock at least one tip account`).
- Randomize the tip account per bundle from the live `getTipAccounts` list. **Never** put the tip account in an ALT — Jito warns ALT-loaded tip accounts are ineffective.
- Duplicate transaction message hashes are rejected — vary payload bytes (e.g. a memo) across otherwise-identical txs.
- Preflight exact signed mainnet bundles through Helius `simulateBundle` when available; public Jito endpoints don't expose bundle simulation.

**Tip floor:** testnet has no auction — 1,000 lamports lands reliably (21/21 across bundle sizes in one measured run). Mainnet clears a real auction; expect a rough **0.001–0.01 SOL** baseline under contention, measure your own floor, then default to ≥ measured × 2.

**Landing latency** (testnet; mainnet similar once the tip clears the auction): p50 ~4s, p95 ~8s, p99 ~10s.

**Polling:** after `sendBundle`, poll all three truth sources — `getBundleStatuses`, `getInflightBundleStatuses`, and `getSignatureStatuses(sigs, { searchTransactionHistory: true })`. Cadence: 2s ×3, then 5s ×6, then declare `unknown_status` (~36s) and surface snapshots for recovery. `getInflightBundleStatuses: Invalid` is **not terminal on its own** — a bundle can show `Invalid` then finalize cleanly; treat it as terminal only after the blockhash expires with no signature landed. Confirm atomicity by checking all bundle txs share the same `landed_slot`.

---

## Composing rise via CPI (third-party programs)

Verified live 2026-07-02. You can wrap rise flows inside your own Anchor program (escrow-executed launches, pooled buys, fee routing) because CPI stack headroom exists — measured from a live launch TX2 via `meta.innerInstructions[].instructions[].stackHeight`:

| Flow | Inner CPIs | Max stackHeight | Wrapped in your program |
|---|---:|---:|---|
| `initMarket` | 24 | 3 | max 4 — fits (runtime cap = 5) |
| `buyWithExactCashIn` | 14 | 3 | max 4 — fits |

Re-measure before designing a wrapper — your wrap adds +1 to every height.

**PDA-as-creator fee routing.** `initMarket` signers are `payer` + `seed` only; there is no separate creator account, and `Market.creator` is set to the payer (verified by decoding a live market account). A PDA can be the payer via `invoke_signed` (it must hold rent lamports) — so **your program's PDA becomes the market's creator and owns its `creatorFeePercent` stream**. Expose `withdrawCreatorFees` (signer = `creator`) as an access-gated passthrough CPI to route fees trustlessly, no custody. CPI callers of `buyWithExactCashIn` must pass the full arg set (the API computes these server-side): `cashIn`, `minTokenOut`, `newShoulderEnd`, `floorIncreaseRatio`, `maxNewFloor`, `maxAreaShrinkageToleranceUnits`, `minLiqRatio`.

---

## Real-time launch detection (no API polling)

Rise emits Anchor instruction-name logs at top-level invoke:

```
Program RiseZSHaLdj7pfn1tisUoSdG2i3QcVz9sQKuaRG9rar invoke [1]
Program log: Instruction: InitMarket
```

Recipe: a websocket `logsSubscribe` (Helius or any RPC) with `{ mentions: [RISE_PROGRAM_ID] }`, `commitment: "confirmed"`; match `Instruction: InitMarket` in `logs[]`; then fetch the tx / market account for detail. Reconnect with jittered backoff and gap-fill missed slots via `getSignaturesForAddress(RISE_PROGRAM_ID, { until: lastSeenSig })`. The same log-name match works for any rise ix. This costs none of the API's 150/min budget — keep a ≤6/min `/markets` poll only as fallback + metadata enrichment.

---

## Critical gotchas (the ones that bite)

1. **`Custom: 6041 SlippageExceeded` can land but revert silently.** A confirmed tx with `meta.err = { Custom: 6041 }` is finalized but failed. **Always check `meta.err` after `confirmTransaction`** — don't trust signature confirmation alone. This is the #1 source of "wait, my tx succeeded but nothing happened" bugs. Use `confirmAndCheckErr()` from `@rise-rich/skill-helpers`.

2. **Mint must end with `"rise"` (case-insensitive).** `initMarket` errors `6008 InvalidMintTokenAddress` otherwise. Requires off-chain vanity-grind on `vanity_seed` (~2¹⁹ tries expected, seconds on CPU).

3. **Token decimals must match `mint_main` decimals.** USDC markets → 6-decimal tokens. SOL markets → 9-decimal tokens. Mismatch returns `6009 InvalidMintDecimals`.

4. **Freeze authority must be `None`.** Mayflower errors `6010 TokenFreezeAuthorityNotNone` otherwise. Don't confuse with Rise's separate error `6010 InvalidMintAuthority`, which is a mint-authority check on a different code path — same number, different program, different meaning.

5. **Token metadata is admin-mutable, creator-immutable.** The tenant admin (currently the rise.rich team) can update metadata via `updateMarket` (CPI to Metaplex `update_metadata_account_v2`). The creator cannot. Warn users before `initMarket`: once minted, **you** cannot fix the name / ticker / logo — only the rise team can. For practical purposes treat metadata as locked for your project. The docs site currently says "immutable"; the IDL exposes `updateMarket` with the admin path — **IDL is truth**.

6. **`teamEscrow` is per-`mint_main`, NOT per-market.** All USDC-collateral markets share one `teamEscrow`; same for SOL. Hand-deriving with `["team_escrow", market_address]` instead of `["team_escrow", mint_main]` silently uses the wrong escrow.

7. **`mayLogAccount` is a global mut PDA.** Single-account write contention is theoretical at low TPS but caps per-block throughput at scale. Flag for high-frequency designs.

8. **`personal_account` does NOT lazy-init.** Prepend `initPersonalAccount` on first interaction per `(market, owner)`. Idempotent after.

9. **Token-2022 supported (not assumed by default).** Use `token_interface::*` + `transfer_checked` on the program side; on the client, validate per-mint via the mint account's `owner` field — don't trust caller-supplied `token_program`. Both legacy SPL Token and Token-2022 are supported by the IDL; the docs confirm support but don't claim Token-2022 is the default. Check each mint's `owner` before picking which token program to pass.

10. **`disableSell: bool` in `initMarket` is a PERMANENT kill switch.** Set `false` unless you genuinely want a no-sell token. No way to flip later.

11. **`MarketPermissions: u16` is a bitfield of admin kill-switches.** Tenant admin can disable buys/sells/borrows/etc per market (errors `6052..6060`). Reflect this in UX disclaimers — admin retains kill power.

12. **Floor is monotonic but stair-stepped, not continuous.** Initial phase: raises immediately on liquidity. After $100k cumulative net inflows: 30s cooldown. Cooldown grows with cumulative inflows, capped at 120s. Sells burn supply → tightens reserves-per-token ratio → next ratchet comes faster, so floor **can grow during downturns**.

13. **Cross-tx slippage drift.** Slippage is static within a tx (sim covers atomicity) but dynamic between chained txs. **Re-fetch on-chain state and re-plan** between chunks; don't carry stale quotes.

14. **SDK quirks worth knowing.** Public `@riserich/sdk` has no shipped tests or examples. Sell quote uses buy fee (bug above). `leverageBuy` / `leverageSell` are missing from `docs/PROGRAM.md` but exist in the IDL with full account lists and inline docs. **The IDL is truth.**

15. **`MAX_INSTRUCTION_TRACE_LENGTH = 64` is the atomic-launch bottleneck, not CU.** `initMarket` alone eats 24 inner trace (measured 2026-07-02); each `leverageBuy` adds ~13–18. Plan launches around trace, not CU (which has headroom). See "Atomic launch ceiling".

16. **`buyWithExactCashIn` (loops=0 creator buy) deposits to the wallet ATA, NOT a personal_position.** Verifying a spot launch by reading `personalPosition.depositedTokenBalance` reports 0 — correct, not a bug; the position account itself returns `AccountNotFound` for a pure spot buy. Check the wallet token ATA instead, and branch verification on plan kind. `leverageBuy` (loops ≥ 1) deposits to personal_position as expected.

17. **A USDC native-baseline ALT can exceed 1232 B.** rise.rich's UI fits the USDC launch ALT in a single TX1; a naive pubkey set can spill to ~1250 B and get rejected (`base64 encoded too large`). Match their canonical ALT pubkey set rather than splitting into an extra tx — decode a rise.rich USDC launch's ALT and diff.

18. **rise.rich devnet has no real USDC.** SPL stand-in mints fail `InvalidAccountData` at launch even when packet sizes look fine. Validate USDC paths on mainnet (byte-for-byte against a known USDC launch), not devnet.

19. **Atomic creator leverage without Jito is loops=1 SOL / loops=0 USDC.** Anything deeper needs a Jito bundle (ceiling 2) or splits into post-launch chunks that are sniper-vulnerable. Don't market "atomic creator leverage" without disclosing this constraint.

---

## Test → ship path

1. **Devnet** (`https://publicdev.rise.rich` + devnet program IDs) — full integration test against the devnet deployment, free SOL/USDC from devnet faucets.
2. **Mainnet smoke** — single-purpose keypair, small dollar cap (e.g. $5–$20) until hardened. Verify:
   - Predicted vs on-chain `deposited_token_balance` and `debt` match exactly (they will, to the lamport — the math is closed-form).
   - `meta.err` is null after confirmation.
   - CU consumption matches your budget (use `unitsConsumed` from `meta`).
3. **Public ship.**

---

## What `@rise-rich/skill-helpers` provides (and doesn't)

**Provides** (see `packages/rise-skill-helpers/src/`):

- `PDA.*` — every Rise + Mayflower PDA listed above, derived correctly
- `RiseApi` — typed HTTP client for all 12 endpoints with 429-aware exponential backoff
- `confirmAndCheckErr(sig, conn)` — `confirmTransaction` + `meta.err` check in one call
- `quoteSellLocal(market, tokenIn)` — fixed local sell quote (works around SDK fee bug)
- `Constants.*` — program IDs, tenant addresses, USDC mints, WSOL mint

**Does NOT provide:**

- `leverageBuy` / `leverageSell` ix builders
- Multi-loop chunker / planner
- Convergence math, retry-on-expiry, priority-fee floor logic
- Indexer (write your own; the per-event payload shape is in `rise-docs/INDEXING.md`)

The omissions are deliberate — see README "What's NOT inside (and why)".

---

## Resources

| Resource | Where |
|---|---|
| Docs hub | https://docs.rise.rich |
| Website | https://www.rise.rich/ |
| Twitter / X | https://x.com/risedotrich |
| API base (mainnet) | `https://public.rise.rich` |
| API base (devnet) | `https://publicdev.rise.rich` |
| Rise IDL | bundled in `@riserich/sdk` JSON |
| Audit | Sherlock (see x.com/sherlockdefi/status/2023440979601367514) |
| This skill (issues/PRs) | https://github.com/CHARLES-PONZI/rise-rich-skill |

## Quirks summary cheat-sheet

```
Mint suffix         "rise" (case-insensitive)         vanity-grind
Token decimals       == mint_main decimals             6 (USDC) or 9 (SOL)
Freeze authority     None                              else 6010
LogAccount           global, mut every Mayflower op    throughput bottleneck
TeamEscrow seed      ["team_escrow", mint_main]        NOT per-market
PersonalAccount      not lazy-init                     prepend initPersonalAccount
SDK sell quote       uses buy fee (bug)                use API or skill-helpers
Slippage 6041        confirmed-but-reverted            check meta.err
disableSell          permanent kill switch             set false unless intentional
Borrow fee           Gov ballot item (voting reserved) read live, don't hardcode 3%
Floor                monotonic stair-step              never drops → no liquidations
Lane choice          web3.js v1 + anchor 0.29          kit/v2 needs Codama regen
leverageBuy CU       ~190k warm / ~220k cold           ≤ 3 per tx safely
Cross-tx slippage    static in-tx, dynamic cross-tx    re-fetch state between chunks
Instruction trace    64 = MAX_TRACE                    atomic-launch bottleneck, not CU
Atomic launch        1 loop SOL / 0 USDC (no Jito)     deeper needs Jito bundle (ceiling 2)
Jito bundle          1-5 tx, 1 tip on last tx, 1 slot  poll 3 sources; Invalid not terminal
```
