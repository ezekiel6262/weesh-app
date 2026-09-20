import { WEESH_FEE_BPS, WEESH_TREASURY } from "./catalog";

export function splitWeeshFee(amountIn: bigint) {
  if (!WEESH_TREASURY || WEESH_FEE_BPS <= 0 || amountIn <= BigInt(0)) {
    return { fee: BigInt(0), swapIn: amountIn };
  }
  const fee = (amountIn * BigInt(WEESH_FEE_BPS)) / BigInt(10_000);
  if (fee <= BigInt(0) || fee >= amountIn) return { fee: BigInt(0), swapIn: amountIn };
  return { fee, swapIn: amountIn - fee };
}
