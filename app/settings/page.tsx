"use client";

import { useState } from "react";
import { useExportWallet, usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Gate } from "@/components/Connect";
import { OKX_BACKUP } from "@/lib/chain";
import { addrUrl } from "@/lib/tx";
import { useSessionSignOut } from "@/lib/useSessionSignOut";

export default function SettingsPage() {
  return (
    <Gate>
      <Settings />
    </Gate>
  );
}

function Settings() {
  const { address } = useAccount();
  const { user } = usePrivy();
  const { signOut, signingOut } = useSessionSignOut();
  const { exportWallet } = useExportWallet();
  const [copied, setCopied] = useState(false);
  const email = user?.email?.address;
  const embedded = Boolean(
    user?.linkedAccounts?.find(
      (a) => a.type === "wallet" && "walletClientType" in a && a.walletClientType === "privy"
    )
  );

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Settings</h1>
      <div className="card" style={{ margin: "20px 0" }}>
        <label>Address</label>
        <p className="mono">{address}</p>
        {email ? (
          <>
            <label>Email</label>
            <p className="mono">{email}</p>
          </>
        ) : null}
        <div className="actions">
          <button className="btn" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          {email ? <span className="muted">Signed in with {email}</span> : null}
          <button className="btn ghost" style={{ color: "var(--accent)" }} disabled={signingOut} onClick={() => void signOut()}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <a className="btn ghost" href={addrUrl(address ?? "")} target="_blank" rel="noreferrer">
            View on X Layer explorer ↗
          </a>
        </div>
      </div>
      <h2>Backup</h2>
      {embedded ? (
        <>
          <p className="muted">
            Sign in with this email anywhere to get the same wallet. Export the private key only if
            you want to import it into another client. The key is shown in a secure window — Weesh
            never sees it.
          </p>
          <div className="actions">
            <button className="btn primary" onClick={() => void exportWallet()}>
              Export private key
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            If you signed in with email on OKX Wallet, export the recovery phrase on OKX Wallet Web.
            Google and Apple export is not live yet — prefer email if you want a phrase you can
            import elsewhere.
          </p>
          <p className="actions">
            <a className="btn primary" href={OKX_BACKUP} target="_blank" rel="noreferrer">
              Open OKX Wallet backup
            </a>
            <button className="btn ghost" disabled={signingOut} onClick={() => void signOut()}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </p>
        </>
      )}
      <h2 style={{ marginTop: 36 }}>What Weesh can see</h2>
      <p className="muted">
        Nothing private. Weesh is a website that builds transactions for Uniswap, Aave, and Spark.
        Your key stays in the email wallet enclave or in OKX Wallet. Positions live on X Layer, not
        in a Weesh account.
      </p>
      <p className="muted" style={{ marginTop: 24 }}>
        Tokenized stocks are not available to US persons. This is not investment advice. Contracts
        Weesh talks to (Uniswap, Aave, Spark, OKX DEX) are third-party protocols. Trades take a 0.05%
        Weesh fee. Weesh covers gas so you do not hold OKB.{" "}
        <a href="/about">What’s an xStock?</a>
      </p>
    </div>
  );
}
