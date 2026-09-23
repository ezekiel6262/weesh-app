import { agentById, type ListedAgent } from "./strategyAgents";

const USDT0 = "0x779ded0c9e1022225f8e0630b35a9b54be713736";

export type PaymentTerms = {
  scheme: "exact";
  network: "eip155:196";
  amount: string;
  asset: `0x${string}`;
  payTo: `0x${string}`;
  tokenName: string;
  tokenVersion: string;
  maxTimeoutSeconds: number;
  resourceUrl: string;
  description: string;
};

export type AgentAnswer = {
  mode: "answer";
  summary: string;
  detail: string;
};

export type AgentPayment = {
  mode: "payment";
  summary: string;
  terms: PaymentTerms;
};

export function humanUsdt(amount: string): string {
  const n = Number(amount) / 1e6;
  if (!Number.isFinite(n)) return amount;
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function isAddress(v: string): v is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export function buildAgentRequest(
  agent: ListedAgent,
  params: Record<string, string>,
  payer?: string
): { url: string; method: "GET" | "POST"; body?: Record<string, string | number> } {
  const clean: Record<string, string> = {};
  for (const field of agent.fields) {
    const raw = (params[field.key] ?? field.defaultValue ?? "").trim();
    if (!raw) throw new Error(`Enter ${field.label}`);
    if (raw.length > 64) throw new Error(`${field.label} is too long`);
    clean[field.key] = raw;
  }

  if (agent.id === "chaconne-verify") {
    if (!payer || !isAddress(payer)) throw new Error("Connect a wallet before this check");
    const symbol = clean.symbol.toUpperCase().replace(/X$/, "");
    const amountUsd = Number(clean.amountUsd);
    if (!symbol || !Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("Enter a stock and a spend");
    return {
      url: agent.endpoint,
      method: "POST",
      body: { ownerAddress: payer, symbol, side: "buy", amountUsd },
    };
  }

  if (agent.id === "sterling-yield") {
    const amount = Number(clean.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount");
    return {
      url: agent.endpoint,
      method: "POST",
      body: { stablecoin: clean.stablecoin.toUpperCase(), amount },
    };
  }

  if (agent.id === "sterling-dividend") {
    const asset = clean.asset.toUpperCase();
    return { url: agent.endpoint, method: "POST", body: { asset: asset.endsWith("X") ? asset : `${asset}x` } };
  }

  if (agent.id === "usdg-loop") {
    const principal = Number(clean.principal);
    const leverage = Number(clean.leverage);
    if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(leverage) || leverage <= 0) {
      throw new Error("Enter a principal and a leverage");
    }
    if (leverage > 10) throw new Error("Leverage above 10 is refused here");
    const url = new URL(agent.endpoint);
    url.searchParams.set("principal", String(principal));
    url.searchParams.set("leverage", String(leverage));
    return { url: url.toString(), method: "GET" };
  }

  if (agent.id === "barker-pools") {
    return { url: agent.endpoint, method: "GET" };
  }

  throw new Error("Unknown agent");
}

function decodePaymentRequired(header: string): PaymentTerms | null {
  try {
    const pad = header.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(pad, "base64").toString("utf8");
    const body = JSON.parse(json) as {
      resource?: { url?: string; description?: string };
      accepts?: {
        scheme?: string;
        network?: string;
        amount?: string;
        asset?: string;
        payTo?: string;
        maxTimeoutSeconds?: number;
        extra?: { name?: string; version?: string };
      }[];
    };
    const hit = body.accepts?.find((a) => a.scheme === "exact" && a.network === "eip155:196");
    if (!hit?.amount || !hit.asset || !hit.payTo || !isAddress(hit.asset) || !isAddress(hit.payTo)) return null;
    if (hit.asset.toLowerCase() !== USDT0) return null;
    return {
      scheme: "exact",
      network: "eip155:196",
      amount: hit.amount,
      asset: hit.asset,
      payTo: hit.payTo,
      tokenName: hit.extra?.name || "USD₮0",
      tokenVersion: hit.extra?.version || "1",
      maxTimeoutSeconds: hit.maxTimeoutSeconds || 300,
      resourceUrl: body.resource?.url || "",
      description: body.resource?.description || "",
    };
  } catch {
    return null;
  }
}

function summarize(agent: ListedAgent, parsed: unknown, raw: string): { summary: string; detail: string } {
  const data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const inner = data && typeof data.data === "object" && data.data ? (data.data as Record<string, unknown>) : data;

  if (agent.id === "sterling-yield" && inner) {
    const apy = inner.working_yield_annual_pct;
    const reason = typeof inner.no_action_reason === "string" ? inner.no_action_reason : "";
    const streams = Array.isArray(inner.streams) ? inner.streams : [];
    const rows = streams.slice(0, 4).map((s) => {
      const row = s as Record<string, unknown>;
      return {
        label: String(row.label || row.key || "Stream"),
        apy: row.apy_annual_pct ? Number(row.apy_annual_pct) : null,
      };
    });
    const lines = rows.map((row) => `${row.label}: ${row.apy == null ? "n/a" : `${row.apy.toFixed(2)}%`}`).join("\n");
    const first = rows.find((row) => row.apy != null);
    const summary = apy
      ? `Working yield about ${Number(apy).toFixed(2)}% a year on ${inner.asset}.`
      : first
        ? `${first.label}: ${first.apy!.toFixed(2)}% a year on ${inner.asset}.`
        : "Sterling returned a yield note.";
    return {
      summary,
      detail: [lines, reason, typeof inner.disclaimer === "string" ? inner.disclaimer : ""].filter(Boolean).join("\n\n"),
    };
  }

  if (agent.id === "chaconne-verify" && data && typeof data.summary === "string") {
    return { summary: data.summary, detail: "" };
  }

  if (agent.id === "sterling-dividend" && inner) {
    const asset = String(inner.asset || "Stock");
    return { summary: `Dividend note for ${asset}.`, detail: raw.slice(0, 700) };
  }

  if (agent.id === "usdg-loop" && data) {
    const bits = ["principal", "leverage", "netApy", "apy", "carry", "failReason", "expiry"]
      .map((k) => (data[k] != null && typeof data[k] !== "object" ? `${k}: ${String(data[k])}` : ""))
      .filter(Boolean);
    return {
      summary: "Loop snapshot. This is not an open position.",
      detail: bits.join("\n") || raw.slice(0, 700),
    };
  }

  return { summary: "The agent answered.", detail: raw.slice(0, 700) };
}

export async function runListedAgent(
  id: string,
  params: Record<string, string>,
  payer?: string,
  paymentHeader?: string
): Promise<AgentAnswer | AgentPayment> {
  const agent = agentById(id);
  if (!agent) throw new Error("That agent is not on the Weesh list");
  const req = buildAgentRequest(agent, params, payer);
  const headers: Record<string, string> = { accept: "application/json" };
  if (req.body) headers["content-type"] = "application/json";
  if (paymentHeader) {
    if (paymentHeader.length > 8000) throw new Error("Payment is too large");
    headers["PAYMENT-SIGNATURE"] = paymentHeader;
  }
  const res = await fetch(req.url, {
    method: req.method,
    headers,
    body: req.body ? JSON.stringify(req.body) : undefined,
    redirect: "manual",
    cache: "no-store",
  });
  const pay = res.headers.get("payment-required");
  if (res.status === 402 && pay && !paymentHeader) {
    const terms = decodePaymentRequired(pay);
    if (!terms) throw new Error("This agent asked for a payment Weesh cannot sign");
    return {
      mode: "payment",
      summary: `${agent.name} charges ${humanUsdt(terms.amount)} ${terms.tokenName} for this call. You pay them, not Weesh.`,
      terms,
    };
  }
  const raw = (await res.text()).slice(0, 8000);
  if (!res.ok) throw new Error(raw.slice(0, 240) || `Agent returned ${res.status}`);
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const view = summarize(agent, parsed, raw);
  return { mode: "answer", summary: view.summary, detail: view.detail };
}
