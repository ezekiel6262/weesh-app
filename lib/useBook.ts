"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { aaveDataAbi, erc20Abi, erc4626Abi } from "./abi";
import { AAVE, AAVE_CRYPTO, ASSETS, QUOTE, SPARK, STOCKS, USDC, USDG, USDT0, type Asset } from "./catalog";
import { usdFrom } from "./format";
import { listPositions, type LpPosition } from "./lp";
import { usdPrice } from "./quote";

export type Line = {
  asset: Asset;
  wallet: bigint;
  aave: bigint;
  spark: bigint;
  debt: bigint;
  px: number;
  usd: number;
};

export function useBook() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [lp, setLp] = useState<LpPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener("weesh-book", on);
    return () => window.removeEventListener("weesh-book", on);
  }, []);

  useEffect(() => {
    if (!address || !client) {
      setLines([]);
      setLp([]);
      return;
    }
    let dead = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const extras: Asset[] = STOCKS.filter((s) => s.underlying).map((s) => ({
          ...s,
          id: `${s.id}-x`,
          symbol: `${s.symbol}x`,
          name: `${s.name} (xStock)`,
          address: s.underlying as `0x${string}`,
          tradable: false,
        }));
        const watch: Asset[] = [USDG, USDT0, USDC, ...STOCKS, ...extras, ...AAVE_CRYPTO];
        const rows = await Promise.all(
          watch.map(async (a) => {
            const priced =
              a.kind === "stable"
                ? a
                : STOCKS.find((s) => s.underlying?.toLowerCase() === a.address.toLowerCase()) ?? a;
            const px = a.kind === "stable" ? 1 : await usdPrice(client, priced);
            const wallet = (await client.readContract({
              address: a.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            })) as bigint;
            let aave = BigInt(0);
            let debt = BigInt(0);
            if (a.aave) {
              try {
                const user = (await client.readContract({
                  address: AAVE.dataProvider,
                  abi: aaveDataAbi,
                  functionName: "getUserReserveData",
                  args: [a.address, address],
                })) as readonly [bigint, bigint, bigint, ...unknown[]];
                aave = user[0];
                debt = user[1] + user[2];
              } catch {
                aave = (await client.readContract({
                  address: a.aave.aToken,
                  abi: erc20Abi,
                  functionName: "balanceOf",
                  args: [address],
                })) as bigint;
              }
            }
            let spark = BigInt(0);
            if (a.spark) {
              const shares = (await client.readContract({
                address: SPARK.vault,
                abi: erc4626Abi,
                functionName: "balanceOf",
                args: [address],
              })) as bigint;
              spark = (await client.readContract({
                address: SPARK.vault,
                abi: erc4626Abi,
                functionName: "convertToAssets",
                args: [shares],
              })) as bigint;
            }
            const usd =
              usdFrom(wallet, a, px) + usdFrom(aave, a, px) + usdFrom(spark, a, px) - usdFrom(debt, a, px);
            return { asset: a, wallet, aave, spark, debt, px, usd } satisfies Line;
          })
        );
        const positions = await listPositions(client, address);
        if (!dead) {
          setLines(rows);
          setLp(positions);
        }
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "Could not load book");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [address, client, tick]);

  const holdings = lines.filter(
    (l) => l.wallet + l.aave + l.spark + l.debt > BigInt(0)
  );
  const nav = holdings.reduce((s, l) => s + l.usd, 0);
  const cash = holdings.filter((l) => l.asset.kind === "stable").reduce((s, l) => s + l.usd, 0);
  const stocksUsd = holdings
    .filter((l) => l.asset.kind === "equity" || l.asset.kind === "etf")
    .reduce((s, l) => s + l.usd, 0);
  const defiUsd = holdings.reduce((s, l) => s + usdFrom(l.aave + l.spark, l.asset, l.px), 0);
  const stocks = holdings.filter((l) => l.asset.kind === "equity" || l.asset.kind === "etf");
  const empty = !loading && holdings.length === 0 && lp.length === 0;

  return {
    lines,
    holdings,
    lp,
    loading,
    error,
    nav,
    cash,
    stocksUsd,
    defiUsd,
    stocks,
    quote: QUOTE,
    empty,
    reload,
    catalog: ASSETS,
  };
}

export function usePrices() {
  const client = usePublicClient();
  const [px, setPx] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    let dead = false;
    (async () => {
      setLoading(true);
      try {
        const entries = await Promise.all(
          STOCKS.map(async (a) => [a.id, await usdPrice(client, a)] as const)
        );
        if (!dead) setPx(Object.fromEntries(entries));
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [client]);

  return { px, loading };
}
