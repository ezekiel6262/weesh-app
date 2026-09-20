import { NextResponse } from "next/server";
import { getRow } from "@/lib/xstock";

export const revalidate = 60;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const row = getRow(id);
  if (!row) return NextResponse.json({ error: "unknown" }, { status: 404 });
  const symbol = row.symbol.replace(/\./g, "-");
  try {
    const xs = await fetch(
      `https://api.xstocks.fi/api/v2/public/assets/${encodeURIComponent(row.xSymbol)}/price-data`,
      { headers: { accept: "application/json", "user-agent": "Weesh/0.1" }, next: { revalidate: 30 } }
    );
    if (xs.ok) {
      const j = (await xs.json()) as { quote?: number };
      if (typeof j.quote === "number" && j.quote > 0) {
        return NextResponse.json({ ref: j.quote, symbol: row.xSymbol, source: "xstocks" });
      }
    }
  } catch {
    /* fall through to yahoo */
  }
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "Weesh/0.1" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ ref: null, symbol });
    const body = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string } }[] };
    };
    const px = body.chart?.result?.[0]?.meta?.regularMarketPrice;
    return NextResponse.json({
      ref: typeof px === "number" && px > 0 ? px : null,
      symbol,
      source: "yahoo",
    });
  } catch {
    return NextResponse.json({ ref: null, symbol });
  }
}
