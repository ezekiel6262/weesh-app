import { NextResponse } from "next/server";
import { verifyTypedData } from "viem";
import { addOrder, listOrders, removeOrder } from "@/lib/orderStore";
import { CANCEL_TYPES, ORDER_DOMAIN, ORDER_TYPES, orderMessage, type RestingOrder } from "@/lib/orderTypes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const stockId = new URL(req.url).searchParams.get("stockId") || undefined;
  return NextResponse.json({ orders: listOrders(stockId) });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<RestingOrder>;
  if (
    !body.stockId ||
    (body.side !== "buy" && body.side !== "sell") ||
    !body.priceUsd ||
    !body.amount ||
    !body.maker ||
    !body.expiry ||
    !body.nonce ||
    !body.signature
  ) {
    return NextResponse.json({ error: "incomplete order" }, { status: 400 });
  }
  const price = Number(body.priceUsd);
  const amt = Number(body.amount);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "bad size or price" }, { status: 400 });
  }
  if (Number(body.expiry) < Math.floor(Date.now() / 1000) + 60) {
    return NextResponse.json({ error: "expiry too soon" }, { status: 400 });
  }
  const draft = {
    stockId: body.stockId,
    side: body.side,
    priceUsd: String(body.priceUsd),
    amount: String(body.amount),
    maker: body.maker,
    expiry: Number(body.expiry),
    nonce: body.nonce,
  };
  const ok = await verifyTypedData({
    address: body.maker,
    domain: ORDER_DOMAIN,
    types: ORDER_TYPES,
    primaryType: "Order",
    message: orderMessage(draft),
    signature: body.signature,
  });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const row: RestingOrder = {
    ...draft,
    id: `${body.maker.slice(2, 8)}-${body.nonce}`,
    signature: body.signature,
    createdAt: Date.now(),
  };
  addOrder(row);
  return NextResponse.json({ order: row });
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as { id?: string; maker?: `0x${string}`; signature?: `0x${string}` };
  if (!body.id || !body.maker || !body.signature) {
    return NextResponse.json({ error: "id, maker, signature required" }, { status: 400 });
  }
  const ok = await verifyTypedData({
    address: body.maker,
    domain: ORDER_DOMAIN,
    types: CANCEL_TYPES,
    primaryType: "Cancel",
    message: { id: body.id },
    signature: body.signature,
  });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const gone = removeOrder(body.id, body.maker);
  if (!gone) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
