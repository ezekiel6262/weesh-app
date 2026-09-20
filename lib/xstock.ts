import type { Asset } from "./catalog";
import raw from "./xstocks.json";

export type XStockRow = {
  id: string;
  name: string;
  symbol: string;
  xSymbol: string;
  address: string;
  underlying: string | null;
  logo: string | null;
  kind: "equity" | "etf";
  halted: boolean;
};

export type Market = XStockRow & {
  available: boolean;
  px: number | null;
  usdLiquidity: number | null;
  reason: "live" | "okx" | "no-pool" | "halted";
  change24?: number | null;
};

const TINTS = [
  "#76B900",
  "#E31937",
  "#1B4F8A",
  "#5B4B8A",
  "#111111",
  "#F7931A",
  "#627EEA",
  "#9945FF",
  "#0F766E",
  "#B45309",
  "#BE185D",
  "#365314",
];

export function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export const XSTOCKS: XStockRow[] = raw as XStockRow[];

const assetCache = new Map<string, Asset>();

export function toAsset(row: XStockRow): Asset {
  const hit = assetCache.get(row.id);
  if (hit) return hit;
  const asset: Asset = {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    address: row.address as `0x${string}`,
    decimals: 18,
    kind: row.kind === "etf" ? "etf" : "equity",
    tradable: !row.halted,
    tint: tintFor(row.id),
    underlying: row.underlying ? (row.underlying as `0x${string}`) : undefined,
  };
  assetCache.set(row.id, asset);
  return asset;
}

export function getRow(id: string): XStockRow | undefined {
  const q = id.toLowerCase();
  return XSTOCKS.find(
    (r) => r.id.toLowerCase() === q || r.symbol.toLowerCase() === q || r.xSymbol.toLowerCase() === q
  );
}

export function getStock(id: string): Asset | undefined {
  const row = getRow(id);
  return row ? toAsset(row) : undefined;
}

export function stockPath(id: string) {
  return `/s/${encodeURIComponent(id)}`;
}

export const byXAddress = new Map(XSTOCKS.map((r) => [r.address.toLowerCase(), r]));
