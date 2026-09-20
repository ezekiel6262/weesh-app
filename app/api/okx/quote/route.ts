import { NextResponse } from "next/server";
import { dexNames, okxConfigured, okxQuote } from "@/lib/okxDex";

export async function GET(req: Request) {
  if (!okxConfigured()) {
    return NextResponse.json({ error: "OKX DEX keys not set" }, { status: 503 });
  }
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  const amount = u.searchParams.get("amount");
  const slip = u.searchParams.get("slippage") || "0.5";
  const mode = u.searchParams.get("mode") || "dex";
  if (!from || !to || !amount) {
    return NextResponse.json({ error: "from, to, amount required" }, { status: 400 });
  }
  try {
    const row = await okxQuote(from, to, amount, slip, mode);
    return NextResponse.json({
      amountOut: row.toTokenAmount,
      venue: "okx",
      via: dexNames(row),
      priceImpact: row.priceImpactPercentage ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "quote failed" }, { status: 502 });
  }
}
