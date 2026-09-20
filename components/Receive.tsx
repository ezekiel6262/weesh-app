"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { QUOTE, USDC, USDT0 } from "@/lib/catalog";
import { shortAddr } from "@/lib/format";
import { addrUrl } from "@/lib/tx";

const TOKENS = [
  { asset: QUOTE, use: "Buy stocks" },
  { asset: USDT0, use: "Park in Spark" },
  { asset: USDC, use: "Swap to dollars here" },
];

export function Receive({ compact = false }: { compact?: boolean }) {
  const { address } = useAccount();
  const [copied, setCopied] = useState<"addr" | string | null>(null);

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!address) return null;

  return (
    <div className={compact ? undefined : "card"} style={compact ? undefined : { marginTop: 16 }}>
      {compact ? null : (
        <>
          <p className="kicker">Receive</p>
          <h2>Send dollars on X Layer</h2>
        </>
      )}
      <p className="muted">
        Weesh covers gas — do not send OKB. Buys spend {QUOTE.symbol}. Only tokens on X Layer (chain
        196).
      </p>
      <label>Your address</label>
      <p className="mono">{address}</p>
      <div className="actions">
        <button className="btn primary" onClick={() => void copy("addr", address)}>
          {copied === "addr" ? "Copied" : "Copy address"}
        </button>
        <a className="btn ghost" href={addrUrl(address)} target="_blank" rel="noreferrer">
          Explorer
        </a>
      </div>
      <p className="section-title">Send these</p>
      {TOKENS.map((t) => (
        <div className="kv" key={t.asset.id}>
          <span>
            {t.asset.symbol}
            <span className="hint"> · {t.use}</span>
          </span>
          <button className="btn ghost small" onClick={() => void copy(t.asset.id, t.asset.address)}>
            {copied === t.asset.id ? "Copied" : shortAddr(t.asset.address)}
          </button>
        </div>
      ))}
      <p className="hint" style={{ marginTop: 12 }}>
        {shortAddr(address)} · Weesh never sees the key
      </p>
    </div>
  );
}
