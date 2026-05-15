/**
 * @rise-rich/skill-helpers
 *
 * Helpers for agents interacting with the rise.rich protocol.
 * Companion to the rise-rich-protocol agent skill (see ../../SKILL.md).
 *
 * What's exported:
 *   - Constants:  program IDs, tenant addresses, USDC + WSOL mints
 *   - PDA:        every Rise + Mayflower PDA derived correctly
 *   - RiseApi:    typed HTTP client for all 12 integration-API endpoints
 *   - confirmAndCheckErr / TxLandedButRevertedError:  catches silent 6041 SlippageExceeded
 *   - quoteSellLocal:  fixed local sell quote (works around upstream SDK fee bug)
 *
 * What's NOT exported (deliberately — see README "What's NOT inside and why"):
 *   - leverageBuy / leverageSell ix builders
 *   - Multi-loop chunkers / planners
 *   - Auto-loop convergence math
 *   - Priority-fee / retry orchestration
 */

export * as Constants from "./constants";
export * as PDA from "./pda";

export {
  RiseApi,
  RiseApiError,
  type RiseApiOptions,
  type MarketRow,
  type ListMarketsParams,
  type QuoteBody,
  type QuoteResponse,
  type BuyBody,
  type SellBody,
  type TxResponse,
  type BorrowQuoteBody,
  type BorrowQuoteResponse,
  type PortfolioSummary,
  type PortfolioPosition,
} from "./api";

export {
  confirmAndCheckErr,
  isSlippageExceeded,
  TxLandedButRevertedError,
  SLIPPAGE_EXCEEDED_CODE,
} from "./confirm";

export { quoteSellLocal, type SellQuoteMarket, type SellQuoteResult } from "./quote-sell";

export type { Network } from "./constants";
