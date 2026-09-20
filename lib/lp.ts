import { type PublicClient, zeroAddress } from "viem";
import { factoryAbi, npmAbi, poolAbi } from "./abi";
import { byAddress, FEE_TIERS, QUOTES, STOCKS, UNISWAP, type Asset } from "./catalog";

const MIN_TICK = -887272;
const MAX_TICK = 887272;
const SPACING: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };

export type PoolInfo = {
  pool: `0x${string}`;
  fee: number;
  liquidity: bigint;
  tokenA: Asset;
  tokenB: Asset;
  token0: Asset;
  token1: Asset;
};

export type LpPosition = {
  tokenId: bigint;
  token0: Asset;
  token1: Asset;
  fee: number;
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
};

export function sortAssets(a: Asset, b: Asset): [Asset, Asset] {
  return a.address.toLowerCase() < b.address.toLowerCase() ? [a, b] : [b, a];
}

export function fullRangeTicks(fee: number): { tickLower: number; tickUpper: number } {
  const s = SPACING[fee] ?? 60;
  return {
    tickLower: Math.ceil(MIN_TICK / s) * s,
    tickUpper: Math.floor(MAX_TICK / s) * s,
  };
}

export async function bestPool(
  client: PublicClient,
  tokenA: Asset,
  tokenB: Asset
): Promise<PoolInfo | null> {
  let best: PoolInfo | null = null;
  for (const fee of FEE_TIERS) {
    try {
      const pool = (await client.readContract({
        address: UNISWAP.factory,
        abi: factoryAbi,
        functionName: "getPool",
        args: [tokenA.address, tokenB.address, fee],
      })) as `0x${string}`;
      if (!pool || pool === zeroAddress) continue;
      const liquidity = (await client.readContract({
        address: pool,
        abi: poolAbi,
        functionName: "liquidity",
      })) as bigint;
      const [token0, token1] = sortAssets(tokenA, tokenB);
      if (liquidity === BigInt(0)) continue;
      if (!best || liquidity > best.liquidity) {
        best = { pool, fee, liquidity, tokenA, tokenB, token0, token1 };
      }
    } catch {
      /* no pool */
    }
  }
  return best;
}

export async function listedStockPools(client: PublicClient): Promise<PoolInfo[]> {
  const out: PoolInfo[] = [];
  for (const s of STOCKS) {
    let best: PoolInfo | null = null;
    for (const q of QUOTES) {
      const p = await bestPool(client, s, q);
      if (p && (!best || p.liquidity > best.liquidity)) best = p;
    }
    if (best) out.push(best);
  }
  return out;
}

/** Human token1 per token0 from slot0. Fine for sizing a mint. */
export async function poolHumanPrice(client: PublicClient, info: PoolInfo): Promise<number> {
  const slot = (await client.readContract({
    address: info.pool,
    abi: poolAbi,
    functionName: "slot0",
  })) as readonly [bigint, ...unknown[]];
  const sqrt = Number(slot[0]) / 2 ** 96;
  if (!Number.isFinite(sqrt) || sqrt === 0) return 0;
  return sqrt * sqrt * 10 ** (info.token0.decimals - info.token1.decimals);
}

export function pairAmounts(
  info: PoolInfo,
  quoteHuman: number,
  priceToken1PerToken0: number
): { amount0: number; amount1: number } {
  if (!priceToken1PerToken0) return { amount0: 0, amount1: 0 };
  const quoteIs0 = info.token0.kind === "stable";
  if (quoteIs0) {
    return { amount0: quoteHuman, amount1: quoteHuman * priceToken1PerToken0 };
  }
  return { amount0: quoteHuman / priceToken1PerToken0, amount1: quoteHuman };
}

export async function listPositions(client: PublicClient, owner: `0x${string}`): Promise<LpPosition[]> {
  let n = BigInt(0);
  try {
    n = (await client.readContract({
      address: UNISWAP.npm,
      abi: npmAbi,
      functionName: "balanceOf",
      args: [owner],
    })) as bigint;
  } catch {
    return [];
  }
  const cap = n > BigInt(20) ? 20 : Number(n);
  const out: LpPosition[] = [];
  for (let i = 0; i < cap; i++) {
    try {
      const tokenId = (await client.readContract({
        address: UNISWAP.npm,
        abi: npmAbi,
        functionName: "tokenOfOwnerByIndex",
        args: [owner, BigInt(i)],
      })) as bigint;
      const pos = (await client.readContract({
        address: UNISWAP.npm,
        abi: npmAbi,
        functionName: "positions",
        args: [tokenId],
      })) as readonly [
        bigint,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        number,
        number,
        number,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
      ];
      const token0 = byAddress.get(pos[2].toLowerCase());
      const token1 = byAddress.get(pos[3].toLowerCase());
      if (!token0 || !token1) continue;
      if (pos[7] === BigInt(0)) continue;
      out.push({
        tokenId,
        token0,
        token1,
        fee: Number(pos[4]),
        liquidity: pos[7],
        tickLower: Number(pos[5]),
        tickUpper: Number(pos[6]),
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function deadline() {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

export const MAX_UINT128 = (BigInt(1) << BigInt(128)) - BigInt(1);
