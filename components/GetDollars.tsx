"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { getPublicClient } from "wagmi/actions";
import { useAccount, useConfig, usePublicClient, useSendTransaction, useWriteContract } from "wagmi";
import { QuoteCard } from "@/components/QuoteCard";
import { Mark } from "@/components/Mark";
import { TxStatus } from "@/components/TxStatus";
import { QUOTE, USDC, USDT0, type Asset } from "@/lib/catalog";
import { recordAct } from "@/lib/activity";
import { xlayer } from "@/lib/chain";
import { splitWeeshFee } from "@/lib/fee";
import { executeRoutedSwap } from "@/lib/fill";
import { parseAmount, qty } from "@/lib/format";
import { routeQuote, type Quote } from "@/lib/quote";
import { bumpBook } from "@/lib/tx";
import { useBook } from "@/lib/useBook";
import { friendlyError } from "@/lib/errors";

const STABLES: Asset[] = [QUOTE, USDT0, USDC];

export function GetDollars() {
  const { address, isConnected, chainId } = useAccount();
  const config = useConfig();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTransactionAsync, isPending: sending } = useSendTransaction();
  const { lines } = useBook();
  const seq = useRef(0);
  const [fromId, setFromId] = useState(USDT0.id);
  const [toId, setToId] = useState(QUOTE.id);
  const [amount, setAmount] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "gas" | "fee" | "approve" | "sign">("idle");

  const pay = STABLES.find((a) => a.id === fromId) ?? USDT0;
  const get = STABLES.find((a) => a.id === toId) ?? QUOTE;
  const bal = lines.find((l) => l.asset.id === pay.id)?.wallet ?? BigInt(0);
  const parsed = useMemo(() => parseAmount(amount, pay), [amount, pay]);

  useEffect(() => {
    const amt = parseAmount(amount, pay);
    if (!amt) {
      seq.current += 1;
      setQuoting(false);
      setQ(null);
      return;
    }
    const id = ++seq.current;
    setQuoting(true);
    setErr(null);
    const t = window.setTimeout(() => {
      const rpc = getPublicClient(config, { chainId: xlayer.id });
      if (!rpc) return;
      void routeQuote(rpc, pay, get, splitWeeshFee(amt).swapIn)
        .then((next) => {
          if (seq.current !== id) return;
          setQ(next);
          setErr(next ? null : `No ${pay.symbol} to ${get.symbol} route is available right now.`);
        })
        .catch((e) => {
          if (seq.current !== id) return;
          setErr(e instanceof Error ? e.message : "Quote failed");
        })
        .finally(() => {
          if (seq.current === id) setQuoting(false);
        });
    }, 250);
    return () => window.clearTimeout(t);
  }, [amount, pay, get, config]);

  async function submit() {
    if (!address || !client || !q || !parsed) return;
    setErr(null);
    setTx(null);
    try {
      setStep("gas");
      const { hash } = await executeRoutedSwap({
        client,
        address,
        write: writeContractAsync as never,
        send: sendTransactionAsync,
        pay,
        get,
        amountIn: parsed,
        quote: q,
        onStep: setStep,
      });
      setTx(hash);
      recordAct("dollars", `Swap ${pay.symbol} → ${get.symbol}`, hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(friendlyError(e, { action: "stablecoin swap", asset: pay.symbol, available: qty(bal, pay.decimals) }));
    }
  }

  if (!isConnected || chainId !== xlayer.id) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <p className="kicker">Swap stablecoins</p>
      <h2>Use the dollars you already have</h2>
      <p className="muted">
        Swap between USDG, USDT, and USDC on X Layer. Weesh finds the route and covers gas. You approve every transaction.
      </p>
      <div className="stable-pair" aria-hidden><Mark asset={pay} size={42} /><span>→</span><Mark asset={get} size={42} /></div>
      <div className="stable-selects">
      <div><label>From</label>
      <select value={fromId} onChange={(e) => { const next = e.target.value; setFromId(next); if (next === toId) setToId(STABLES.find((a) => a.id !== next)?.id ?? QUOTE.id); }}>
        {STABLES.filter((a) => a.id !== toId).map((a) => (
          <option key={a.id} value={a.id}>
            {a.symbol}
          </option>
        ))}
      </select></div>
      <button className="swap-direction" type="button" aria-label="Reverse swap" onClick={() => { setFromId(toId); setToId(fromId); setAmount(""); }}>⇄</button>
      <div><label>To</label><select value={toId} onChange={(e) => setToId(e.target.value)}>{STABLES.filter((a) => a.id !== fromId).map((a) => <option key={a.id} value={a.id}>{a.symbol}</option>)}</select></div>
      </div>
      <label>Amount</label>
      <div className="amount">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
        <button className="btn ghost small" onClick={() => setAmount(formatUnits(bal, pay.decimals))}>
          Max
        </button>
      </div>
      <p className="muted">Wallet {qty(bal, pay.decimals)}</p>
      {quoting ? <p className="muted">Quoting…</p> : null}
      {parsed && parsed > bal ? <p className="blocked">Available: {qty(bal, pay.decimals)} {pay.symbol}.</p> : null}
      {q ? <QuoteCard q={q} pay={pay} get={get} fullIn={parsed ?? undefined} /> : null}
      <div className="actions">
        <button className="btn primary" disabled={!q || !parsed || parsed > bal || isPending || sending} onClick={submit}>
          Swap to {get.symbol}
        </button>
      </div>
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}
