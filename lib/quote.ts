import { type Address, type PublicClient } from "viem";
import { FEE_TIERS, QUOTE, QUOTES, UNISWAP, type Asset } from "./catalog";
import { quoterAbi } from "./abi";

export type Quote = {
  amountOut: bigint;
  fee: number;
  tokenIn: Asset;
  tokenOut: Asset;
  amountIn: bigint;
  /** Packed Uniswap path when the fill is more than one hop. */
  path?: `0x${string}`;
  via?: string;
  venue?: "uniswap" | "okx";
};

function encodePath(tokens: Address[], fees: number[]): `0x${string}` {
  let hex = "0x";
  for (let i = 0; i < fees.length; i++) {
    hex += tokens[i].slice(2);
    hex += fees[i].toString(16).padStart(6, "0");
  }
  hex += tokens[tokens.length - 1].slice(2);
  return hex as `0x${string}`;
}

async function quoteDirect(
  client: PublicClient,
  tokenIn: Asset,
  tokenOut: Asset,
  amountIn: bigint
): Promise<Quote | null> {
  if (amountIn === BigInt(0) || tokenIn.address === tokenOut.address) return null;
  const hits = await Promise.all(
    FEE_TIERS.map(async (fee) => {
      try {
        const { result } = await client.simulateContract({
          address: UNISWAP.quoter,
          abi: quoterAbi,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              amountIn,
              fee,
              sqrtPriceLimitX96: BigInt(0),
            },
          ],
        });
        return { amountOut: result[0], fee } as const;
      } catch {
        return null;
      }
    })
  );
  let best: Quote | null = null;
  for (const hit of hits) {
    if (!hit) continue;
    if (!best || hit.amountOut > best.amountOut) {
      best = { amountOut: hit.amountOut, fee: hit.fee, tokenIn, tokenOut, amountIn };
    }
  }
  return best;
}

export async function bestQuote(
  client: PublicClient,
  tokenIn: Asset,
  tokenOut: Asset,
  amountIn: bigint
): Promise<Quote | null> {
  const direct = await quoteDirect(client, tokenIn, tokenOut, amountIn);
  if (direct) return { ...direct, venue: "uniswap" };

  const hops = await Promise.all(
    QUOTES.map(async (mid) => {
      if (mid.address === tokenIn.address || mid.address === tokenOut.address) return null;
      const a = await quoteDirect(client, tokenIn, mid, amountIn);
      if (!a) return null;
      const b = await quoteDirect(client, mid, tokenOut, a.amountOut);
      if (!b) return null;
      return {
        amountOut: b.amountOut,
        fee: b.fee,
        tokenIn,
        tokenOut,
        amountIn,
        path: encodePath([tokenIn.address, mid.address, tokenOut.address], [a.fee, b.fee]),
        via: mid.symbol,
        venue: "uniswap" as const,
      };
    })
  );
  let best: Quote | null = null;
  for (const hop of hops) {
    if (hop && (!best || hop.amountOut > best.amountOut)) best = hop;
  }
  return best;
}

export async function okxDexQuote(
  tokenIn: Asset,
  tokenOut: Asset,
  amountIn: bigint,
  slippagePct = "0.5",
  mode = "dex"
): Promise<Quote | null> {
  try {
    const res = await fetch(
      `/api/okx/quote?from=${tokenIn.address}&to=${tokenOut.address}&amount=${amountIn.toString()}&slippage=${slippagePct}&mode=${mode}`
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { amountOut?: string; via?: string; error?: string };
    if (!body.amountOut) return null;
    return {
      amountOut: BigInt(body.amountOut),
      fee: 0,
      tokenIn,
      tokenOut,
      amountIn,
      via: body.via || "OKX DEX",
      venue: "okx",
    };
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch(() => {
      clearTimeout(t);
      resolve(null);
    });
  });
}

/** Uniswap first. OKX DEX (AMM + RFQ) if Uniswap has no pool or is slow. */
export async function routeQuote(
  client: PublicClient,
  tokenIn: Asset,
  tokenOut: Asset,
  amountIn: bigint,
  opts?: { preferOkx?: boolean; slippagePct?: string; mode?: string }
): Promise<Quote | null> {
  if (!opts?.preferOkx) {
    const uni = await withTimeout(bestQuote(client, tokenIn, tokenOut, amountIn), 4000);
    if (uni) return uni;
  }
  return okxDexQuote(tokenIn, tokenOut, amountIn, opts?.slippagePct ?? "0.5", opts?.mode ?? "dex");
}

const pxCache = new Map<string, { t: number; v: number }>();

/** Mid price of 1 token in dollars. */
export async function usdPrice(client: PublicClient, asset: Asset): Promise<number> {
  if (asset.kind === "stable") return 1;
  const hit = pxCache.get(asset.id);
  if (hit && Date.now() - hit.t < 15_000) return hit.v;
  const unit = BigInt(10) ** BigInt(asset.decimals);
  let v = 0;
  for (const q of QUOTES) {
    const quote = await quoteDirect(client, asset, q, unit);
    if (quote) {
      v = Number(quote.amountOut) / 10 ** q.decimals;
      break;
    }
  }
  if (!v) {
    const hop = await bestQuote(client, asset, QUOTE, unit);
    if (hop) v = Number(hop.amountOut) / 1e6;
  }
  pxCache.set(asset.id, { t: Date.now(), v });
  return v;
}
