import { formatUnits, parseUnits } from "viem";
import type { Asset } from "./catalog";

export function money(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const d = abs >= 1000 ? 0 : abs >= 1 ? digits : abs >= 0.01 ? 2 : 4;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function qty(raw: bigint, decimals: number, max = 6): string {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return "0";
  if (n === 0) return "0";
  const d = n >= 100 ? 2 : n >= 1 ? 4 : max;
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

export function toUnits(n: number, decimals: number): bigint {
  if (!Number.isFinite(n) || n <= 0) return BigInt(0);
  return parseUnits(n.toFixed(Math.min(decimals, 8)), decimals);
}

export function parseAmount(input: string, asset: Asset): bigint | null {
  const t = input.trim().replace(/,/g, "");
  if (!t || Number(t) < 0) return null;
  try {
    return parseUnits(t, asset.decimals);
  } catch {
    return null;
  }
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function usdFrom(raw: bigint, asset: Asset, px: number): number {
  return Number(formatUnits(raw, asset.decimals)) * px;
}

export function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const d = Math.abs(n) >= 10 ? 1 : 2;
  return `${n.toFixed(d)}%`;
}

export function poolFeePct(fee: number): string {
  return `${(fee / 10_000).toFixed(2)}%`;
}
