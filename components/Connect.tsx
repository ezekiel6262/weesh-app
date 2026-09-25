"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnectWallet, useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { useAccount, useSwitchChain } from "wagmi";
import { xlayer } from "@/lib/chain";
import { privyAppId } from "@/lib/privy";
import { shortAddr } from "@/lib/format";

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openInOkx() {
  const dapp = encodeURIComponent(window.location.href);
  window.location.href = `https://www.okx.com/download?deeplink=${encodeURIComponent(
    `okx://wallet/dapp/url?dappUrl=${dapp}`
  )}`;
}

function SetupHint() {
  return (
    <p className="err">
      Live email wallet needs a Privy App ID. Create a free app at{" "}
      <a href="https://dashboard.privy.io" target="_blank" rel="noreferrer">
        dashboard.privy.io
      </a>
      , enable Email, allow http://127.0.0.1:3000, then set NEXT_PUBLIC_PRIVY_APP_ID in .env.local and
      restart.
    </p>
  );
}

export function ConnectBar({ compact = false, start = false }: { compact?: boolean; start?: boolean }) {
  if (!privyAppId) {
    return compact ? <span className="pill">No wallet ID</span> : <SetupHint />;
  }
  return <LiveConnect compact={compact} start={start} />;
}

function Opening({ compact, logout }: { compact: boolean; logout: () => void }) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setStuck(true), 12000);
    return () => window.clearTimeout(t);
  }, []);
  if (compact) return <span className="pill">…</span>;
  return (
    <div className="connect-stack">
      <p className="muted">{stuck ? "Wallet is taking too long." : "Opening wallet…"}</p>
      {stuck ? (
        <button className="btn ghost small" onClick={() => logout()}>
          Sign out and try again
        </button>
      ) : null}
    </div>
  );
}

function LiveConnect({ compact, start = false }: { compact: boolean; start?: boolean }) {
  const { ready, authenticated, logout } = usePrivy();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connectWallet } = useConnectWallet();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [mobileNoInjected, setMobileNoInjected] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onError: (e) => setLocalErr(String(e)),
  });

  const awaiting = state.status === "awaiting-code-input" || state.status === "submitting-code";
  const sending = state.status === "sending-code";
  const submitting = state.status === "submitting-code";
  const canSend = email.includes("@") && !sending;
  const canLogin = code.trim().length >= 4 && !submitting;

  useEffect(() => {
    setMobileNoInjected(isMobile() && !window.okxwallet);
  }, []);

  useEffect(() => {
    if (!compact || !open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [compact, open]);

  async function send() {
    setLocalErr(null);
    await sendCode({ email: email.trim() });
  }

  async function openWallet() {
    setLocalErr(null);
    await loginWithCode({ code: code.trim() });
    setOpen(false);
  }

  if (!ready) {
    return <Opening compact={compact} logout={logout} />;
  }

  if ((authenticated || isConnected) && address) {
    const wrong = chainId !== xlayer.id;
    if (compact) {
      return wrong ? (
        <button className="btn warn small" onClick={() => switchChain({ chainId: xlayer.id })}>
          Switch to X Layer
        </button>
      ) : (
        <Link href="/settings" className="pill addr" title="Wallet settings">
          {shortAddr(address)}
        </Link>
      );
    }
    return (
      <div className="connect-row">
        {wrong ? (
          <button className="btn warn small" onClick={() => switchChain({ chainId: xlayer.id })}>
            Switch to X Layer
          </button>
        ) : (
          <span className="pill">{shortAddr(address)}</span>
        )}
        <button className="btn ghost small" onClick={() => logout()}>
          Sign out
        </button>
      </div>
    );
  }

  if (authenticated && !isConnected) {
    return <Opening compact={compact} logout={logout} />;
  }

  const injected = (
    <div className="wallet-list">
      <button
        className="btn"
        onClick={() =>
          connectWallet({
            walletList: ["okx_wallet", "detected_wallets"],
            walletChainType: "ethereum-only",
          })
        }
      >
        OKX Wallet
      </button>
      {mobileNoInjected ? (
        <button className="btn" onClick={openInOkx}>
          Open in OKX app
        </button>
      ) : null}
    </div>
  );

  const form = (
    <div className={start ? "start-row" : "wallet-list"} style={start ? undefined : { maxWidth: compact ? 280 : 360 }}>
      <label>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        autoComplete="username"
        inputMode="email"
      />
      {awaiting ? (
        <>
          <label>Code from email</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            autoComplete="one-time-code"
            inputMode="numeric"
          />
        </>
      ) : null}
      <div className="actions">
        {awaiting ? (
          <>
            <button className="btn primary" disabled={!canLogin} onClick={() => void openWallet()}>
              {submitting ? "Opening…" : "Open wallet"}
            </button>
            <button className="btn ghost" disabled={sending} onClick={() => void send()}>
              Resend
            </button>
          </>
        ) : (
          <button className="btn primary" disabled={!canSend} onClick={() => void send()}>
            {sending ? "Sending…" : start ? "Get started" : "Email me a code"}
          </button>
        )}
      </div>
      <p className="hint">
        Same email, same wallet — on this phone or another. Keys sit in a hardware enclave, not on a
        Weesh server. There is no PIN to forget.
      </p>
      {localErr ? <p className="err">{localErr}</p> : null}
      {state.status === "error" && state.error ? <p className="err">{state.error.message}</p> : null}
    </div>
  );

  if (compact) {
    return (
      <div className="connect-wrap" ref={wrapRef}>
        <button className="btn primary" onClick={() => setOpen((v) => !v)}>
          Sign in
        </button>
        {open ? (
          <div className="connect-panel">
            <p className="kicker" style={{ marginBottom: 0 }}>
              Email wallet
            </p>
            {form}
            <button className="btn ghost small" onClick={() => setMore((v) => !v)}>
              I already have OKX Wallet
            </button>
            {more ? injected : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="connect-stack">
      <p className="kicker" style={{ marginBottom: 0 }}>
        Email wallet
      </p>
      {form}
      <button className="btn ghost" onClick={() => setMore((v) => !v)}>
        I already have OKX Wallet
      </button>
      {more ? injected : null}
    </div>
  );
}

export function Gate({ children }: { children: React.ReactNode }) {
  if (!privyAppId) {
    return (
      <section className="hero">
        <p className="kicker">Weesh</p>
        <h1>Stocks you can actually use.</h1>
        <SetupHint />
      </section>
    );
  }
  return <LiveGate>{children}</LiveGate>;
}

function LiveGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { isConnected, chainId } = useAccount();
  if (!ready) {
    return (
      <section className="hero">
        <p className="muted">Opening wallet…</p>
      </section>
    );
  }
  if (!authenticated && !isConnected) {
    return (
      <section className="hero">
        <p className="kicker">Weesh</p>
        <h1>Stocks you can actually use.</h1>
        <p className="lede">
          Buy, hold, and send tokenized stocks on X Layer. Your wallet signs every action.
        </p>
        <ConnectBar />
      </section>
    );
  }
  if (authenticated && !isConnected) {
    return (
      <section className="hero">
        <ConnectBar />
      </section>
    );
  }
  if (chainId !== xlayer.id) {
    return (
      <section className="hero">
        <h1>Switch to X Layer</h1>
        <p className="lede">Stocks and DeFi here live on X Layer. One tap.</p>
        <ConnectBar />
      </section>
    );
  }
  return <>{children}</>;
}
