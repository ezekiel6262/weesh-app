import { NextResponse } from "next/server";
import { issuerPrint, xchangeAsset, xchangeConfigured } from "@/lib/xchange";
import { getRow } from "@/lib/xstock";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const row = getRow(id);
  if (!row) return NextResponse.json({ error: "unknown" }, { status: 404 });
  const print = await issuerPrint(row.xSymbol);
  const configured = xchangeConfigured();
  let xchange: unknown = null;
  let xchangeOk = false;
  if (configured) {
    const r = await xchangeAsset(row.xSymbol);
    xchangeOk = r.ok;
    xchange = r.body;
  }
  return NextResponse.json({
    xSymbol: row.xSymbol,
    issuerPrint: print,
    configured,
    xchangeOk,
    xchange,
    minUsd: 5000,
    note: configured
      ? "Backed xChange key is set. Quotes still require a registered wallet and 24/5 hours."
      : "Primary mint/redeem needs a Backed API key (KYC). On X Layer, buy on Market or wrap an xStock you already hold.",
  });
}
