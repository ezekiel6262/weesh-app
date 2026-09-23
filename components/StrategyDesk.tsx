"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useSignTypedData } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { humanUsdt, type PaymentTerms } from "@/lib/agentCall";
import { xlayer } from "@/lib/chain";
import { money } from "@/lib/format";
import {
  AGENTS_CHECKED_AT,
  STRATEGY_JOBS,
  agentById,
  type ListedAgent,
  type StrategyJob,
} from "@/lib/strategyAgents";

const MIX = [
  { id: "NVDA", name: "NVIDIA" },
  { id: "TSLA", name: "Tesla" },
  { id: "AAPL", name: "Apple" },
  { id: "SPY", name: "S&P 500" },
  { id: "QQQ", name: "Nasdaq-100" },
] as const;

const PRESETS: Record<string, number[]> = {
  "60/40 NVDA SPY": [60, 0, 0, 40, 0],
  Equal: [20, 20, 20, 20, 20],
};

type RunState = {
  summary: string;
  detail: string;
  terms: PaymentTerms | null;
};

export function StrategyDesk() {
  const [jobId, setJobId] = useState(STRATEGY_JOBS[0].id);
  const job = STRATEGY_JOBS.find((j) => j.id === jobId) ?? STRATEGY_JOBS[0];

  return (
    <>
      <p className="kicker">Strategy</p>
      <h2>Do the job, or hire someone who already does it</h2>
      <p className="muted">
        A strategy is a DeFi task. You can sign it yourself, or ask an agent already listed on OKX AI.
        You pay that agent from your wallet. Weesh does not hold the dollars or the keys.
      </p>
      <div className="strategy">
        <div className="job-list">
          {STRATEGY_JOBS.map((j) => (
            <button key={j.id} className={j.id === job.id ? "on" : ""} onClick={() => setJobId(j.id)}>
              <strong>{j.title}</strong>
              <span>{j.blurb}</span>
            </button>
          ))}
        </div>
        <JobDetail job={job} />
      </div>
      <p className="muted" style={{ marginTop: 18 }}>
        Agent names, prices, and services were read from OKX AI on {AGENTS_CHECKED_AT}. A payment you
        sign uses the charge the agent asks for at that moment, not a number Weesh invented.
      </p>
    </>
  );
}

function JobDetail({ job }: { job: StrategyJob }) {
  return (
    <div>
      <div className="card">
        <p className="kicker">You sign</p>
        <h2 style={{ marginTop: 0 }}>{job.title}</h2>
        <p className="muted">{job.yourself.detail}</p>
        {job.id === "mix" ? <MixPlanner /> : null}
        <div className="actions">
          <Link className="btn primary" href={job.yourself.href}>
            {job.yourself.label}
          </Link>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <p className="kicker">OKX AI</p>
        {job.agentIds.length === 0 ? (
          <p className="muted">No listed agent on OKX AI does this on X Layer. The button above is the path.</p>
        ) : (
          job.agentIds.map((id) => {
            const agent = agentById(id);
            return agent ? <AgentCard key={id} agent={agent} /> : null;
          })
        )}
      </div>
    </div>
  );
}

function MixPlanner() {
  const [preset, setPreset] = useState("60/40 NVDA SPY");
  const [weights, setWeights] = useState<number[]>(PRESETS["60/40 NVDA SPY"]);
  const [spend, setSpend] = useState("100");
  const total = weights.reduce((s, n) => s + n, 0);
  const usd = Number(spend) || 0;

  function apply(name: string) {
    setPreset(name);
    setWeights(PRESETS[name]);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="seg">
        {Object.keys(PRESETS).map((name) => (
          <button key={name} className={preset === name ? "on" : ""} onClick={() => apply(name)}>
            {name}
          </button>
        ))}
      </div>
      <label>Spend ({"USDG"})</label>
      <input value={spend} onChange={(e) => setSpend(e.target.value)} inputMode="decimal" />
      {MIX.map((leg, i) => (
        <div className="kv" key={leg.id}>
          <span>
            {leg.name}
            <input
              style={{ width: 72, marginLeft: 8, padding: "6px 8px" }}
              value={String(weights[i])}
              inputMode="numeric"
              onChange={(e) => {
                const next = weights.slice();
                next[i] = Number(e.target.value) || 0;
                setWeights(next);
                setPreset("");
              }}
            />
            %
          </span>
          <span>
            {money((usd * weights[i]) / 100)}{" "}
            <Link href={`/trade?asset=${leg.id}&side=buy`}>Buy</Link>
          </span>
        </div>
      ))}
      <p className={total === 100 ? "muted" : "err"}>{total === 100 ? "Weights add to 100%." : `Weights add to ${total}%. They need to add to 100.`}</p>
    </div>
  );
}

function AgentCard({ agent }: { agent: ListedAgent }) {
  const { address, isConnected, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const defaults = useMemo(() => {
    const seed: Record<string, string> = {};
    for (const field of agent.fields) seed[field.key] = field.defaultValue || "";
    return seed;
  }, [agent]);
  const [params, setParams] = useState(defaults);
  const [run, setRun] = useState<RunState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(payment?: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: agent.id, params, payer: address, payment }),
      });
      const body = (await res.json()) as {
        error?: string;
        mode?: "answer" | "payment";
        summary?: string;
        detail?: string;
        terms?: PaymentTerms;
      };
      if (!res.ok || body.error) throw new Error(body.error || "The agent did not answer");
      setRun({
        summary: body.summary || "",
        detail: body.detail || "",
        terms: body.mode === "payment" ? body.terms || null : null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The agent did not answer");
    } finally {
      setBusy(false);
    }
  }

  async function pay(terms: PaymentTerms) {
    if (!address) return;
    setBusy(true);
    setErr(null);
    try {
      const nonce = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}` as `0x${string}`;
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + terms.maxTimeoutSeconds);
      const signature = await signTypedDataAsync({
        domain: {
          name: terms.tokenName,
          version: terms.tokenVersion,
          chainId: xlayer.id,
          verifyingContract: terms.asset,
        },
        types: {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from: address,
          to: terms.payTo,
          value: BigInt(terms.amount),
          validAfter: BigInt(0),
          validBefore,
          nonce,
        },
      });
      const payload = {
        x402Version: 2,
        resource: {
          url: terms.resourceUrl,
          description: terms.description,
          mimeType: "application/json",
        },
        accepted: {
          scheme: terms.scheme,
          network: terms.network,
          amount: terms.amount,
          asset: terms.asset,
          payTo: terms.payTo,
          maxTimeoutSeconds: terms.maxTimeoutSeconds,
          extra: { name: terms.tokenName, version: terms.tokenVersion },
        },
        payload: {
          signature,
          authorization: {
            from: address,
            to: terms.payTo,
            value: terms.amount,
            validAfter: "0",
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      };
      const payment = btoa(JSON.stringify(payload));
      await ask(payment);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment was not signed");
      setBusy(false);
    }
  }

  return (
    <article className="card agent-card">
      <div className="agent-head">
        {agent.picture ? <img src={agent.picture} alt="" width={40} height={40} /> : <span className="brand-mark">A</span>}
        <div>
          <strong>
            {agent.name} <span className="muted">#{agent.agentId}</span>
          </strong>
          <div className="muted">
            {agent.serviceName} · {agent.rating === "No rating yet" ? agent.rating : `Rating ${agent.rating}`} · {agent.listedFee}
          </div>
        </div>
      </div>
      <p>{agent.does}</p>
      <p className="muted">{agent.doesNot}</p>
      {agent.fields.map((field) => (
        <div key={field.key}>
          <label>{field.label}</label>
          <input
            value={params[field.key] ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => setParams({ ...params, [field.key]: e.target.value })}
          />
        </div>
      ))}
      {!isConnected || chainId !== xlayer.id ? (
        <ConnectBar />
      ) : (
        <div className="actions">
          <button className="btn primary" disabled={busy} onClick={() => ask()}>
            {busy ? "Working" : agent.listedFee.startsWith("About") ? "See the charge" : "Ask this agent"}
          </button>
        </div>
      )}
      {run ? (
        <div className="answer">
          <p>{run.summary}</p>
          {run.detail ? <pre>{run.detail}</pre> : null}
          {run.terms ? (
            <>
              <p className="muted">
                Pay {humanUsdt(run.terms.amount)} {run.terms.tokenName} to {run.terms.payTo.slice(0, 6)}…
                {run.terms.payTo.slice(-4)}. One signature. Weesh does not receive it.
              </p>
              <button className="btn accent" disabled={busy} onClick={() => pay(run.terms!)}>
                Pay and run
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {err ? <p className="err">{err}</p> : null}
    </article>
  );
}
