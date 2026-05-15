import { apiBase, Network } from "./constants";

export interface RiseApiOptions {
  apiKey: string;
  network: Network;
  /** Override base URL (e.g. for staging). */
  baseUrl?: string;
  /** Max retries on 429. Default 5. */
  maxRetries?: number;
  /** Initial backoff in ms. Doubles per retry. Default 1000. */
  initialBackoffMs?: number;
}

export interface MarketRow {
  rise_market_address: string;
  mint_token: string;
  mint_main: string;
  token_name: string;
  token_symbol: string;
  token_image: string;
  token_decimals: number;
  creator: string;
  price: string;
  starting_price?: string;
  mayflower_floor: string;
  mayflower_token_supply: string;
  mayflower_total_cash_liquidity: string;
  mayflower_total_debt: string;
  mayflower_total_collateral: string;
  volume_h24_usd: string;
  volume_all_time_usd: string;
  market_cap_usd: string;
  holders_count: number;
  creator_fee_percent: number;
  gov_buy_fee_micro_basis_points: number;
  gov_sell_fee_micro_basis_points: number;
  disableSell: boolean;
  twitter?: string;
  discord?: string;
  telegram?: string;
  created_at: string;
  delta_to_floor_percentage?: string;
  locked_supply_percentage?: string;
}

export interface ListMarketsParams {
  page?: number;
  limit?: number;
  sort?:
    | "created"
    | "marketcap"
    | "volume24h"
    | "holders"
    | "floor"
    | "price"
    | "variation"
    | "near_floor"
    | "liquidity";
  order?: "asc" | "desc";
  is_verified?: boolean;
  creator_fee_min?: number;
  creator_fee_max?: number;
  mcap_min?: number;
  mcap_max?: number;
  vol24h_min?: number;
  vol24h_max?: number;
  locked_min?: number;
  locked_max?: number;
  created_period?: "today" | "yesterday" | "week" | "month";
}

export interface QuoteBody {
  amount: bigint | number;
  direction: "buy" | "sell";
}

export interface QuoteResponse {
  ok: true;
  quote: {
    direction: "buy" | "sell";
    amountIn: number;
    amountInHuman: number;
    amountOut: number;
    amountOutHuman: number;
    feeRate: number;
    feeAmount: number;
    feeAmountUsd: number;
    amountInUsd: number;
    amountOutUsd: number;
    mintRate: number;
    tokenRate: number;
    currentPrice: number;
    newPrice: number;
    averageFillPrice: number;
    priceImpact: number;
    currentSupply: number;
    newSupply: number;
  };
}

export interface BuyBody {
  wallet: string;
  cashIn: bigint | number;
  minTokenOut: bigint | number;
}

export interface SellBody {
  wallet: string;
  tokenIn: bigint | number;
  minCashOut: bigint | number;
}

export interface TxResponse {
  ok: true;
  transaction: string; // base64 VersionedTransaction
  addresses?: Record<string, string>;
  [k: string]: unknown;
}

export interface BorrowQuoteBody {
  wallet: string;
  amountToBorrow?: bigint | number;
}

export interface BorrowQuoteResponse {
  ok: true;
  depositedTokens: string;
  walletBalance: string;
  debt: string;
  maxBorrowable: string;
  maxBorrowableUsd: string;
  maxBorrowableIfDepositAll: string;
  maxBorrowableIfDepositAllUsd: string;
  floorPrice: string;
  borrowFeePercent: number;
  requiredDeposit?: string;
  grossBorrow?: string;
}

export interface PortfolioSummary {
  ok: true;
  summary: {
    total_value_usd: string;
    total_pnl_usd: string;
    total_transactions: number;
    tokens_held: number;
    tokens_created_count: number;
  };
}

export interface PortfolioPosition {
  rise_market_address: string;
  token_name: string;
  token_symbol: string;
  token_image: string;
  mint_token: string;
  mint_main: string;
  net_tokens: string;
  position_value: string;
  position_value_usd: string;
  cost_basis: string;
  pnl: string;
  pnl_usd: string;
  pnl_percentage: string;
  market_price: string;
  collateral_price_usd: string;
}

export interface ApiErrorBody {
  ok: false;
  error: string;
}

export class RiseApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyError: string,
    public readonly endpoint: string,
  ) {
    super(`rise.rich API ${status} on ${endpoint}: ${bodyError}`);
    this.name = "RiseApiError";
  }
}

/**
 * Typed, rate-limit-aware client for the rise.rich integration API.
 *
 * Handles 429 with exponential backoff. All amounts are RAW units (lamports / smallest unit).
 * `bigint` and `number` are both accepted at the call site; serialized as JSON numbers.
 *
 * For request bodies the API accepts only JSON numbers, not strings — but JS numbers lose
 * precision above 2^53. If you have amounts that big, multiply down before passing.
 */
export class RiseApi {
  private readonly base: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor(opts: RiseApiOptions) {
    this.base = opts.baseUrl ?? apiBase(opts.network);
    this.apiKey = opts.apiKey;
    this.maxRetries = opts.maxRetries ?? 5;
    this.initialBackoffMs = opts.initialBackoffMs ?? 1000;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(this.base + path);
    if (queryParams) {
      for (const [k, v] of Object.entries(queryParams)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    let attempt = 0;
    let backoff = this.initialBackoffMs;
    while (true) {
      const res = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: body !== undefined ? JSON.stringify(body, bigintReplacer) : undefined,
      });

      if (res.status === 429 && attempt < this.maxRetries) {
        await sleep(backoff);
        backoff *= 2;
        attempt++;
        continue;
      }

      const json = (await res.json().catch(() => ({}))) as T | ApiErrorBody;

      if (!res.ok || (json as ApiErrorBody).ok === false) {
        const err = (json as ApiErrorBody).error ?? `HTTP ${res.status}`;
        throw new RiseApiError(res.status, err, path);
      }

      return json as T;
    }
  }

  // --- markets ---

  listMarkets(params: ListMarketsParams = {}) {
    return this.request<{
      ok: true;
      count: number;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      markets: MarketRow[];
    }>("GET", "/markets", undefined, params as Record<string, string | number | boolean>);
  }

  getMarket(addressOrMint: string) {
    return this.request<{ ok: true; market: MarketRow }>("GET", `/markets/${addressOrMint}`);
  }

  getTransactions(addressOrMint: string, page = 1, limit = 50) {
    return this.request<{
      ok: true;
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      count: number;
      transactions: Array<Record<string, unknown>>;
    }>("GET", `/markets/${addressOrMint}/transactions`, undefined, { page, limit });
  }

  getOhlc(
    addressOrMint: string,
    timeframe: "1m" | "5m" | "1h" | "1d",
    limit?: number,
  ) {
    return this.request<{
      ok: true;
      timeframe: string;
      count: number;
      data: Array<{
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        floorPrice: number;
        transactionCount: number;
        volume: number;
      }>;
    }>("GET", `/markets/${addressOrMint}/ohlc/${timeframe}`, undefined, { limit });
  }

  quoteTrade(addressOrMint: string, body: QuoteBody) {
    return this.request<QuoteResponse>("POST", `/markets/${addressOrMint}/quote`, body);
  }

  quoteBorrow(addressOrMint: string, body: BorrowQuoteBody) {
    return this.request<BorrowQuoteResponse>("POST", `/markets/${addressOrMint}/borrow/quote`, body);
  }

  // --- program (returns base64 VersionedTransaction strings) ---

  buy(addressOrMint: string, body: BuyBody) {
    return this.request<TxResponse>("POST", "/program/buyToken", {
      ...body,
      market: addressOrMint,
    });
  }

  sell(addressOrMint: string, body: SellBody) {
    return this.request<TxResponse>("POST", "/program/sellToken", {
      ...body,
      market: addressOrMint,
    });
  }

  depositAndBorrow(addressOrMint: string, body: { wallet: string; borrowAmount: bigint | number }) {
    return this.request<
      TxResponse & {
        depositAmount: string;
        borrowAmount: string;
        borrowAmountAfterFee: number;
        includedDeposit: boolean;
      }
    >("POST", "/program/deposit-and-borrow", { ...body, market: addressOrMint });
  }

  repayAndWithdraw(
    addressOrMint: string,
    body: { wallet: string; withdrawAmount: bigint | number },
  ) {
    return this.request<
      TxResponse & {
        repayAmount: string;
        withdrawAmount: string;
        includedRepay: boolean;
      }
    >("POST", "/program/repay-and-withdraw", { ...body, market: addressOrMint });
  }

  // --- users ---

  portfolioSummary(wallet: string) {
    return this.request<PortfolioSummary>("GET", `/users/${wallet}/portfolio/summary`);
  }

  portfolioPositions(wallet: string, page = 1, limit = 20) {
    return this.request<{
      ok: true;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      results: PortfolioPosition[];
    }>("GET", `/users/${wallet}/portfolio/positions`, undefined, { page, limit });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function bigintReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(
        `rise.rich API expects JSON numbers but value ${value} exceeds Number.MAX_SAFE_INTEGER. ` +
          `Scale your inputs or split the operation.`,
      );
    }
    return Number(value);
  }
  return value;
}
