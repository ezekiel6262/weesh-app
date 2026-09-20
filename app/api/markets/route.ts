import { NextResponse } from "next/server";
import { okxAllTokens, okxConfigured } from "@/lib/okxDex";
import { XSTOCKS, type Market } from "@/lib/xstock";

export const revalidate = 60;

type GeckoPool = {
  attributes?: {
    reserve_in_usd?: string;
    base_token_price_usd?: string;
    quote_token_price_usd?: string;
    price_change_percentage_h24?: string;
    name?: string;
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
  };
};

function addrFromGeckoId(id?: string): string | null {
  if (!id) return null;
  const parts = id.split("_");
  const a = parts[parts.length - 1];
  return a?.startsWith("0x") ? a.toLowerCase() : null;
}

async function geckoPools(): Promise<GeckoPool[]> {
  const out: GeckoPool[] = [];
  for (let page = 1; page <= 12; page++) {
    const url = `https://api.geckoterminal.com/api/v2/networks/x-layer/dexes/uniswap-v3-x-layer/pools?page=${page}`;
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { accept: "application/json", "user-agent": "Weesh/0.1" },
    });
    if (!res.ok) break;
    const body = (await res.json()) as { data?: GeckoPool[] };
    const rows = body.data ?? [];
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < 20) break;
  }
  return out;
}

export async function GET() {
  const wrap = new Map(XSTOCKS.map((r) => [r.address.toLowerCase(), r]));
  const live = new Map<string, { px: number; usdLiquidity: number; change24: number | null }>();

  try {
    const pools = await geckoPools();
    for (const p of pools) {
      const base = addrFromGeckoId(p.relationships?.base_token?.data?.id);
      const quote = addrFromGeckoId(p.relationships?.quote_token?.data?.id);
      const liq = Number(p.attributes?.reserve_in_usd ?? 0);
      const chRaw = Number(p.attributes?.price_change_percentage_h24 ?? NaN);
      const change24 = Number.isFinite(chRaw) ? chRaw : null;
      if (!Number.isFinite(liq) || liq < 50) continue;
      const match = (base && wrap.get(base)) || (quote && wrap.get(quote));
      if (!match) continue;
      const pxRaw =
        base && wrap.has(base)
          ? Number(p.attributes?.base_token_price_usd ?? 0)
          : Number(p.attributes?.quote_token_price_usd ?? 0);
      const prev = live.get(match.id);
      if (!prev || liq > prev.usdLiquidity) {
        live.set(match.id, {
          px: Number.isFinite(pxRaw) && pxRaw > 0 ? pxRaw : prev?.px ?? 0,
          usdLiquidity: liq + (prev?.usdLiquidity ?? 0),
          change24: change24 ?? prev?.change24 ?? null,
        });
      } else {
        live.set(match.id, { ...prev, usdLiquidity: prev.usdLiquidity + liq });
      }
    }
  } catch {
    /* gecko down — still return the full catalog as unavailable */
  }

  const okx = new Set<string>();
  if (okxConfigured()) {
    try {
      const tokens = await okxAllTokens();
      for (const t of tokens) {
        if (t.tokenContractAddress) okx.add(t.tokenContractAddress.toLowerCase());
      }
    } catch {
      /* quote-on-demand still works at trade time */
    }
  }

  const available: Market[] = [];
  const unavailable: Market[] = [];
  for (const row of XSTOCKS) {
    const hit = live.get(row.id);
    const onOkx = okx.has(row.address.toLowerCase()) || (row.underlying ? okx.has(row.underlying.toLowerCase()) : false);
    if (row.halted) {
      unavailable.push({ ...row, available: false, px: hit?.px ?? null, usdLiquidity: hit?.usdLiquidity ?? null, change24: hit?.change24 ?? null, reason: "halted" });
    } else if (hit) {
      available.push({ ...row, available: true, px: hit.px || null, usdLiquidity: hit.usdLiquidity, change24: hit.change24 ?? null, reason: "live" });
    } else if (onOkx) {
      available.push({ ...row, available: true, px: null, usdLiquidity: null, change24: null, reason: "okx" });
    } else {
      unavailable.push({ ...row, available: false, px: null, usdLiquidity: null, change24: null, reason: "no-pool" });
    }
  }
  available.sort((a, b) => (b.usdLiquidity ?? 0) - (a.usdLiquidity ?? 0));
  unavailable.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    updatedAt: Date.now(),
    available,
    unavailable,
    total: XSTOCKS.length,
  });
}
