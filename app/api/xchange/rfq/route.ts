import { NextResponse } from "next/server";
import { xchangeConfigured, xchangeRfq } from "@/lib/xchange";
import { getRow } from "@/lib/xstock";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!xchangeConfigured()) {
    return NextResponse.json({ error: "XSTOCKS_API_KEY not set" }, { status: 503 });
  }
  const body = (await req.json()) as {
    id?: string;
    side?: "Buy" | "Sell";
    quantity?: string;
    wallet?: string;
    network?: string;
  };
  const row = body.id ? getRow(body.id) : undefined;
  if (!row || !body.side || !body.quantity || !body.wallet) {
    return NextResponse.json({ error: "id, side, quantity, wallet required" }, { status: 400 });
  }
  const r = await xchangeRfq({
    identifier: row.xSymbol,
    side: body.side,
    quantity: body.quantity,
    network: body.network || "XLayer",
    paymentWallet: body.wallet,
    receivingWallet: body.wallet,
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: (r.body as { message?: string })?.message || "xChange rejected the quote", detail: r.body },
      { status: r.status }
    );
  }
  return NextResponse.json(r.body);
}
