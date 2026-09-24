"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { addrUrl } from "@/lib/tx";

export function Receive({ compact = false }: { compact?: boolean }) {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    await navigator.clipboard.writeText(address!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!address) return null;

  return (
    <div className={compact ? undefined : "card"} style={compact ? undefined : { marginTop: 16 }}>
      {compact ? null : (
        <>
          <p className="kicker">Receive</p>
          <h2>Receive on X Layer</h2>
        </>
      )}
      <div className="actions">
        <button className="btn primary" onClick={() => void copyAddress()}>
          {copied ? "Copied" : "Copy address"}
        </button>
        <a className="btn ghost" href={addrUrl(address)} target="_blank" rel="noreferrer">
          Explorer
        </a>
      </div>
    </div>
  );
}
