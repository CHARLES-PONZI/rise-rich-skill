# rise.rich agent skill

> The canonical agent-facing resource for interacting with the [rise.rich](https://www.rise.rich/) protocol on Solana.

Drop this into any agent project — Claude Code, **OpenAI Codex CLI**, Cursor, Cody, Aider, Continue.dev, OpenAI Custom GPTs, ChatGPT, local LLMs (Ollama / LM Studio), or any harness that can read markdown — and your agent gains the literacy to:

- Query markets, OHLC, transactions, portfolios via the public integration API
- Quote and execute buys / sells with proper slippage handling
- Borrow against deposited collateral (atomic deposit+borrow) and unwind cleanly (atomic repay+withdraw → sell)
- Derive the right Rise and Mayflower PDAs for direct-IDL work
- Avoid the 14 production traps the docs don't warn about (silent `6041 SlippageExceeded`, creator-immutable/admin-mutable metadata, `teamEscrow` per-`mint_main`, etc.)
- Reason about the two-program (Rise + Mayflower) architecture and the floor-backed lending invariant that eliminates oracles and liquidations

**Unaffiliated, public good, MIT licensed.** Not endorsed by the rise.rich team.

## Built on / sources

This skill distills the official rise.rich documentation. Every factual claim cross-references one of:

- 📘 **[docs.rise.rich](https://docs.rise.rich/introduction)** — protocol docs hub (intro, API, integration guides)
- 🧬 **[riserich/rise-docs](https://github.com/riserich/rise-docs)** — canonical source: Rise + Mayflower IDLs, `PROGRAM.md`, `API.md`, `INDEXING.md`, `BACKEND_INTEGRATION.md`
- 📦 **[riserich/SDK](https://github.com/riserich/SDK)** — official TypeScript SDK (`@riserich/sdk`)

If you spot drift between this skill and the upstream sources, the upstream wins — open an issue and we'll update.

## What's inside

```
rise-rich-skill/
├── SKILL.md                              ← THE agent-facing skill (the main deliverable)
├── README.md                             ← this file
├── LICENSE                               ← MIT
├── packages/rise-skill-helpers/          ← @rise-rich/skill-helpers npm package
│   └── src/
│       ├── constants.ts                  ← program IDs, tenant addresses, USDC mints
│       ├── pda.ts                        ← Rise + Mayflower PDA derivers
│       ├── api.ts                        ← typed HTTP client w/ 429-aware backoff
│       ├── confirm.ts                    ← confirmTransaction + meta.err safety check
│       └── quote-sell.ts                 ← local sell-quote (fixes upstream SDK fee bug)
└── examples/
    ├── 01-list-markets.ts                ← filter/sort markets via API
    ├── 02-quote-and-buy.ts               ← full buy flow with slippage
    ├── 03-portfolio.ts                   ← positions + P&L
    └── 04-unwind.ts                      ← repay-and-withdraw → sellToken
```

## What's NOT inside (and why)

This skill **intentionally does not ship** working glue for:

- `leverageBuy` / `leverageSell` instruction builders
- Multi-loop chunkers (N borrow layers → N transactions with state reconciliation)
- "Auto / Max" loop convergence math
- Priority-fee floor logic or retry-on-blockhash-expiry plumbing

Those are non-trivial engineering — and they're how products built **on top of** rise.rich differentiate themselves. The skill teaches the protocol thoroughly enough that an agent or developer can build them, but doesn't hand them over as a copy-paste recipe. See SKILL.md → "Building loops" for what you'd need to figure out.

## Install — Claude Code (skill discovery via frontmatter)

### Per-user (all your projects)

```bash
# macOS / Linux
git clone https://github.com/CHARLES-PONZI/rise-rich-skill.git
mkdir -p ~/.claude/skills/rise-rich-protocol
cp rise-rich-skill/SKILL.md ~/.claude/skills/rise-rich-protocol/SKILL.md

# Windows (PowerShell)
git clone https://github.com/CHARLES-PONZI/rise-rich-skill.git
New-Item -ItemType Directory -Force $HOME\.claude\skills\rise-rich-protocol
Copy-Item rise-rich-skill\SKILL.md $HOME\.claude\skills\rise-rich-protocol\SKILL.md
```

### Per-project

```bash
mkdir -p .claude/skills/rise-rich-protocol
cp /path/to/rise-rich-skill/SKILL.md .claude/skills/rise-rich-protocol/SKILL.md
```

Project skills override user skills with the same name and ship with your repo.

## Install — other agent platforms

`SKILL.md` is plain markdown with a YAML frontmatter block. How to integrate depends on your harness:

| Platform | How to load |
|---|---|
| **Claude Code** (Anthropic CLI) | Drop in `~/.claude/skills/rise-rich-protocol/SKILL.md`. Frontmatter `description` triggers auto-discovery. |
| **OpenAI Codex CLI** | Place `SKILL.md` as `AGENTS.md` in your project root (or copy to `.codex/AGENTS.md`). Codex auto-loads `AGENTS.md` as project context. Or pipe via `codex < SKILL.md` for one-shot use. |
| **Cursor** | Add as a doc reference (`@docs`) or paste into `.cursorrules`. |
| **Cody** (Sourcegraph) | Add as a context file; reference with `@-mention`. |
| **Aider** | Pass via `--read SKILL.md` to load into context. |
| **Continue.dev** | Add as a context provider or as a custom doc in `~/.continue/`. |
| **OpenAI Custom GPTs / Assistants API** | Upload as a knowledge file; the GPT will retrieve relevant sections. |
| **ChatGPT (web/app)** | Paste contents into Custom Instructions, or upload as a file in a project. |
| **Local LLMs** (Ollama, LM Studio, llama.cpp) | Include in the system prompt, or use a retrieval setup (RAG) over the document. |
| **Anything else** | Treat as a system-prompt addendum; agents that can read markdown can use it. |

Strip the YAML frontmatter block (lines `---` to `---` at the top) for platforms that don't recognize it — the body is the actual skill content.

## Install — the helpers package

```bash
npm install @rise-rich/skill-helpers @solana/web3.js@^1 @coral-xyz/anchor@^0.29 @solana/spl-token
```

(Package not yet published to npm — for now, vendor `packages/rise-skill-helpers/src/` directly into your project.)

### API key

The integration API (`https://public.rise.rich`) requires an `x-api-key` header. **This skill does not ship a key.** Each project gets its own from the rise.rich team — DM https://x.com/risedotrich or follow the contact paths at https://docs.rise.rich. Agents reading this skill are told never to ask you to share another project's key. See [SKILL.md → Authentication](./SKILL.md#authentication) for the full guidance.

## When does the agent invoke this skill?

The frontmatter description in `SKILL.md` triggers on language like:

- "How do I integrate with rise.rich?"
- "Quote a buy on `<token>`"
- "Borrow against my deposited tokens"
- "Build me a portfolio tracker for rise.rich"
- "What does `leverageBuy` do?"
- "Launch a token on rise"
- "Index rise events"

It does **not** trigger on generic Solana / Anchor / Token-2022 questions — those belong to a Solana smart-contract dev skill.

## Contributing

The protocol evolves (new endpoints, IDL revisions, governance ballot changes, CU regressions). PRs welcome:

- **Fact corrections** — cite the source: docs page, IDL field, on-chain tx signature.
- **New gotchas** — explain the trigger condition, the failure mode, and the fix. Production-witnessed > theoretical.
- **New examples** — keep the API-vs-direct lane structure. If something fits the API lane, don't bloat the direct lane.

Issues and PRs at https://github.com/CHARLES-PONZI/rise-rich-skill.

## Disclaimer

This is a third-party documentation distillation. Not endorsed, blessed, or maintained by the rise.rich team.

Always verify against:
- The official IDL (bundled in `@riserich/sdk`)
- The live API at `https://public.rise.rich` and `https://publicdev.rise.rich`
- The protocol docs at `https://docs.rise.rich`

If a discrepancy appears, the protocol wins. Open an issue and we'll update the skill.

## License

MIT. See [LICENSE](./LICENSE).
