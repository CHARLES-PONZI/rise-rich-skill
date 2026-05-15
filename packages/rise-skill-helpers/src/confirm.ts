import { Connection, Commitment, TransactionError } from "@solana/web3.js";

/**
 * Custom error code 6041 — `SlippageExceeded` (Mayflower).
 *
 * A tx hitting this lands on-chain AND consumes fees, but its meta.err is set —
 * meaning the transaction reverted. Signature confirmation alone says nothing
 * about whether your buy/sell/borrow actually executed.
 */
export const SLIPPAGE_EXCEEDED_CODE = 6041;

export class TxLandedButRevertedError extends Error {
  constructor(
    public readonly signature: string,
    public readonly txError: TransactionError,
  ) {
    super(
      `tx ${signature} confirmed on-chain but reverted: ${JSON.stringify(txError)}` +
        (isSlippageExceeded(txError)
          ? " (Mayflower SlippageExceeded — re-quote and retry with wider slippage)"
          : ""),
    );
    this.name = "TxLandedButRevertedError";
  }
}

/**
 * `confirmTransaction` + `meta.err` check in one call.
 *
 * Solana's `confirmTransaction` resolves once the tx lands and reaches the requested
 * commitment, but it does NOT distinguish "succeeded" from "reverted-after-landing".
 * Many failure modes (slippage, insufficient liquidity, admin kill-switches) cause
 * exactly that pattern. Use this wrapper everywhere instead of bare `confirmTransaction`.
 *
 * Throws `TxLandedButRevertedError` if the tx confirmed but `meta.err` is set.
 */
export async function confirmAndCheckErr(
  connection: Connection,
  signature: string,
  commitment: Commitment = "confirmed",
): Promise<void> {
  const latest = await connection.getLatestBlockhash(commitment);
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    commitment,
  );

  const result = await connection.getTransaction(signature, {
    commitment: commitment as "confirmed" | "finalized",
    maxSupportedTransactionVersion: 0,
  });

  if (result?.meta?.err) {
    throw new TxLandedButRevertedError(signature, result.meta.err);
  }
}

export function isSlippageExceeded(err: TransactionError | null | undefined): boolean {
  if (!err || typeof err !== "object") return false;
  const obj = err as { InstructionError?: [number, { Custom?: number }] };
  return obj.InstructionError?.[1]?.Custom === SLIPPAGE_EXCEEDED_CODE;
}
