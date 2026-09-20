import { NextResponse } from "next/server";
import { dexNames, okxConfigured, okxSwap } from "@/lib/okxDex";

export async function POST(req: Request) {
  if (!okxConfigured()) {
    return NextResponse.json({ error: "OKX DEX keys not set" }, { status: 503 });
  }
  const body = (await req.json()) as {
    from?: string;
    to?: string;
    amount?: string;
    user?: string;
    slippage?: string;
  };
  if (!body.from || !body.to || !body.amount || !body.user) {
    return NextResponse.json({ error: "from, to, amount, user required" }, { status: 400 });
  }
  try {
    const row = await okxSwap(body.from, body.to, body.amount, body.user, body.slippage || "0.5");
    return NextResponse.json({
      amountOut: row.toTokenAmount,
      via: dexNames(row),
      router: (row.tx?.to || row.router || "").toLowerCase(),
      tx: {
        to: row.tx?.to,
        data: row.tx?.data,
        value: row.tx?.value ?? "0",
        gas: row.tx?.gas,
        minReceiveAmount: row.tx?.minReceiveAmount,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "swap failed" }, { status: 502 });
  }
}
