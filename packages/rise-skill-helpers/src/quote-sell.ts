/**
 * Local off-chain sell quote that fixes the upstream `@riserich/sdk` fee bug.
 *
 * The published SDK's `quote()` sell branch uses `market.buyFee` instead of `sellFee`,
 * so its sell-side previews are wrong (typically by ~0.25-0.5% in absolute fee terms).
 *
 * This helper applies the correct `sellFee` and returns the same shape so callers can
 * substitute it. If you need a server-side quote with the SDK's curve traversal, use the
 * API's `POST /markets/{addr}/quote` endpoint instead — that one is correct.
 *
 * # Inputs
 *
 * - `market`: object exposing the curve params + fees. The fields used are
 *   `floor` / `m1` / `m2` / `x2` / `b2` / `sellFee` (all decimal numbers in human units).
 *   These match what `RiseSDK.getMarket()` returns; pluck what you need.
 * - `tokenInHuman`: amount of market token to sell (human units).
 *
 * # Returns
 *
 * `{ amountOutHuman, feeRate, currentPrice, newPrice, averageFillPrice }`
 *
 * Use `amountOut = Math.floor(amountOutHuman * 10 ** mainDecimals)` as raw `minCashOut`,
 * minus your slippage cushion.
 *
 * # Math
 *
 * Linear bonding curve in 3 regions:
 *   x ≤ x1:   p(x) = floor
 *   x ≤ x2:   p(x) = m1·x + b1   (b1 = (m2 - m1)·x2 + b2; x1 = (floor - b1) / m1)
 *   x  > x2:  p(x) = m2·x + b2
 *
 * Selling from supply S burns `tokenInHuman` tokens; cash returned is the integral
 * from (S - tokenInHuman) to S along the curve, less the sell fee.
 *
 * Note: this is a faithful replication of the curve math from the bundled SDK,
 * with the fee-source fix applied. We do NOT independently audit the curve formula —
 * we trust it matches what the on-chain program implements. If the SDK and program
 * ever diverge, this helper drifts with the SDK, not the program.
 */
export interface SellQuoteMarket {
  /** Current circulating supply, in human units. */
  supplyHuman: number;
  /** Floor price (human units). */
  floor: number;
  /** Shoulder-end position (token units, human). */
  x2: number;
  /** Slope below shoulder. */
  m1: number;
  /** Slope above shoulder. */
  m2: number;
  /** Y-intercept above shoulder. */
  b2: number;
  /** Sell fee as decimal (0.0125 = 1.25%). */
  sellFee: number;
}

export interface SellQuoteResult {
  amountOutHuman: number;
  feeRate: number;
  currentPrice: number;
  newPrice: number;
  averageFillPrice: number;
  priceImpact: number;
}

export function quoteSellLocal(market: SellQuoteMarket, tokenInHuman: number): SellQuoteResult {
  if (tokenInHuman <= 0) throw new Error("tokenInHuman must be positive");
  if (tokenInHuman > market.supplyHuman) {
    throw new Error(`cannot sell ${tokenInHuman} — supply is only ${market.supplyHuman}`);
  }

  const { floor, m1, m2, x2, b2, supplyHuman, sellFee } = market;
  const b1 = (m2 - m1) * x2 + b2;
  const x1 = m1 === 0 ? 0 : (floor - b1) / m1;

  const sStart = supplyHuman;
  const sEnd = supplyHuman - tokenInHuman;

  const currentPrice = priceAt(sStart, { floor, m1, m2, x2, b1, x1, b2 });
  const newPrice = priceAt(sEnd, { floor, m1, m2, x2, b1, x1, b2 });

  // Gross cash = ∫ p(x) dx from sEnd to sStart
  const gross = integrate(sEnd, sStart, { floor, m1, m2, x2, b1, x1, b2 });

  const fee = gross * sellFee;
  const amountOutHuman = gross - fee;
  const averageFillPrice = gross / tokenInHuman;
  const priceImpact = currentPrice === 0 ? 0 : (currentPrice - newPrice) / currentPrice;

  return {
    amountOutHuman,
    feeRate: sellFee,
    currentPrice,
    newPrice,
    averageFillPrice,
    priceImpact,
  };
}

interface CurveParams {
  floor: number;
  m1: number;
  m2: number;
  x2: number;
  b1: number;
  x1: number;
  b2: number;
}

function priceAt(x: number, c: CurveParams): number {
  if (x <= c.x1) return c.floor;
  if (x <= c.x2) return c.m1 * x + c.b1;
  return c.m2 * x + c.b2;
}

function integrate(a: number, b: number, c: CurveParams): number {
  if (a > b) throw new Error("integrate: a must be ≤ b");
  return regionIntegral(b, c) - regionIntegral(a, c);
}

/** Antiderivative of p(x) evaluated at x — piecewise: F(x) = ∫₀ˣ p(u) du. */
function regionIntegral(x: number, c: CurveParams): number {
  const { floor, m1, m2, x2, b1, x1, b2 } = c;
  if (x <= 0) return 0;
  if (x <= x1) {
    return floor * x;
  }
  if (x <= x2) {
    const tillX1 = floor * x1;
    const shoulder = (m1 / 2) * (x * x - x1 * x1) + b1 * (x - x1);
    return tillX1 + shoulder;
  }
  const tillX1 = floor * x1;
  const tillX2 = (m1 / 2) * (x2 * x2 - x1 * x1) + b1 * (x2 - x1);
  const main = (m2 / 2) * (x * x - x2 * x2) + b2 * (x - x2);
  return tillX1 + tillX2 + main;
}
