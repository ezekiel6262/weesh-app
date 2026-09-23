import type { Address } from "viem";

export const ORDER_DOMAIN = {
  name: "Weesh",
  version: "1",
  chainId: 196,
  verifyingContract: "0x0000000000000000000000000000000000001960" as Address,
} as const;

export const ORDER_TYPES = {
  Order: [
    { name: "stockId", type: "string" },
    { name: "side", type: "string" },
    { name: "priceUsd", type: "string" },
    { name: "amount", type: "string" },
    { name: "maker", type: "address" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "string" },
  ],
} as const;

export const CANCEL_TYPES = {
  Cancel: [{ name: "id", type: "string" }],
} as const;

export type RestingOrder = {
  id: string;
  stockId: string;
  side: "buy" | "sell";
  /** USD per share */
  priceUsd: string;
  /** Buy: USDG human amount. Sell: shares human amount. */
  amount: string;
  maker: Address;
  expiry: number;
  nonce: string;
  signature: `0x${string}`;
  createdAt: number;
};

export function orderMessage(o: Omit<RestingOrder, "id" | "signature" | "createdAt">) {
  return {
    stockId: o.stockId,
    side: o.side,
    priceUsd: o.priceUsd,
    amount: o.amount,
    maker: o.maker,
    expiry: BigInt(o.expiry),
    nonce: o.nonce,
  };
}

/** Human amount the taker sends to fill this order at its limit. Bids are USDG; asks are shares. */
export function takerPayHuman(
  o: Pick<RestingOrder, "side" | "priceUsd" | "amount">,
  stockDecimals: number
): string {
  const limit = Number(o.priceUsd);
  const size = Number(o.amount);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(size) || size <= 0) {
    throw new Error("bad order size");
  }
  if (o.side === "sell") return (size * limit).toFixed(6);
  return (size / limit).toFixed(stockDecimals);
}
