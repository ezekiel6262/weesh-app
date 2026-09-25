import { NextResponse } from "next/server";
import { runListedAgent } from "@/lib/agentCall";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: string;
      params?: Record<string, string>;
      payer?: string;
      payment?: string;
    };
    if (!body.id) return NextResponse.json({ error: "Missing agent" }, { status: 400 });
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.params || {})) {
      if (typeof v === "string") params[k] = v;
    }
    const result = await runListedAgent(body.id, params, body.payer, body.payment);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent call failed";
    const unavailable = /unreachable|unavailable|too long/i.test(message);
    return NextResponse.json({ error: message }, { status: unavailable ? 503 : 400 });
  }
}
