import { NextResponse } from "next/server";
import { getRow } from "@/lib/xstock";

export const revalidate = 60;

type Point = { t: number; o: number; h: number; l: number; c: number; v: number };

async function geckoJson(url: string) {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Weesh/0.1" },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

function parseOhlcv(body: Record<string, unknown> | null): Point[] {
  const data = body?.data as { attributes?: { ohlcv_list?: unknown[] } } | undefined;
  const list = data?.attributes?.ohlcv_list;
  if (!Array.isArray(list)) return [];
  const out: Point[] = [];
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const t = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    const v = Number(row[5] ?? 0);
    if (![t, o, h, l, c].every(Number.isFinite)) continue;
    out.push({ t: t * (t < 1e12 ? 1000 : 1), o, h, l, c, v });
  }
  return out.sort((a, b) => a.t - b.t);
}

async function tokenOhlcv(address: string, tf: string, limit: number) {
  const url = `https://api.geckoterminal.com/api/v2/networks/x-layer/tokens/${address}/ohlcv/${tf}?aggregate=1&limit=${limit}&currency=usd`;
  return parseOhlcv(await geckoJson(url));
}

async function poolOhlcv(address: string, tf: string, limit: number) {
  const search = await geckoJson(
    `https://api.geckoterminal.com/api/v2/search/pools?query=${address}&network=x-layer`
  );
  const pools = (search?.data as { id?: string; attributes?: { address?: string } }[]) ?? [];
  const pool = pools[0]?.attributes?.address || pools[0]?.id?.split("_").pop();
  if (!pool) return [];
  const url = `https://api.geckoterminal.com/api/v2/networks/x-layer/pools/${pool}/ohlcv/${tf}?aggregate=1&limit=${limit}&currency=usd`;
  return parseOhlcv(await geckoJson(url));
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "";
  const range = u.searchParams.get("range") || "1W";
  const row = getRow(id);
  if (!row) return NextResponse.json({ error: "unknown stock" }, { status: 404 });

  const tf = range === "1D" ? "minute" : range === "1M" ? "day" : "hour";
  const limit = range === "1D" ? 96 : range === "1M" ? 60 : 168;

  let points: Point[] = [];
  try {
    points = await tokenOhlcv(row.address, tf, limit);
    if (!points.length && row.underlying) points = await tokenOhlcv(row.underlying, tf, limit);
    if (!points.length) points = await poolOhlcv(row.address, tf === "minute" ? "hour" : tf, limit);
  } catch {
    points = [];
  }

  const first = points[0]?.c ?? 0;
  const last = points[points.length - 1]?.c ?? 0;
  const change = first ? ((last - first) / first) * 100 : 0;

  return NextResponse.json({
    id: row.id,
    range,
    points,
    last: last || null,
    change,
    source: points.length ? "geckoterminal" : null,
  });
}
