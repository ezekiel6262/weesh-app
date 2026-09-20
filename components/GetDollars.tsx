"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { getPublicClient } from "wagmi/actions";
import { useAccount, useConfig, usePublicClient, useSendTransaction, useWriteContract } from "wagmi";
import { QuoteCard } from "@/components/QuoteCard";
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

const FROM: Asset[] = [USDT0, USDC];

export function GetDollars() {
  const { address, isConnected, chainId } = useAccount();
  const config = useConfig();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTransactionAsync, isPending: sending } = useSendTransaction();
  const { lines } = useBook();
  const seq = useRef(0);
  const [fromId, setFromId] = useState(USDT0.id);
  const [amount, setAmount] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "gas" | "fee" | "approve" | "sign">("idle");

  const pay = FROM.find((a) => a.id === fromId) ?? USDT0;
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
      void routeQuote(rpc, pay, QUOTE, splitWeeshFee(amt).swapIn)
        .then((next) => {
          if (seq.current !== id) return;
          setQ(next);
          setErr(next ? null : "No USDG quote.");
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
  }, [amount, pay, config]);

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
        get: QUOTE,
        amountIn: parsed,
        quote: q,
        onStep: setStep,
      });
      setTx(hash);
      recordAct("dollars", `Swap ${pay.symbol} → USDG`, hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!isConnected || chainId !== xlayer.id) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <p className="kicker">Get dollars</p>
      <h2>Turn USDT or USDC into USDG</h2>
      <p className="muted">
        Buys spend USDG. Weesh covers gas. 0.05% on this swap. You sign — not a Weesh account.
      </p>
      <label>From</label>
      <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
        {FROM.map((a) => (
          <option key={a.id} value={a.id}>
            {a.symbol}
          </option>
        ))}
      </select>
      <label>Amount</label>
      <div className="amount">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
        <button className="btn ghost small" onClick={() => setAmount(formatUnits(bal, pay.decimals))}>
          Max
        </button>
      </div>
      <p className="muted">Wallet {qty(bal, pay.decimals)}</p>
      {quoting ? <p className="muted">Quoting…</p> : null}
      {q ? <QuoteCard q={q} pay={pay} get={QUOTE} fullIn={parsed ?? undefined} /> : null}
      <div className="actions">
        <button className="btn primary" disabled={!q || isPending || sending} onClick={submit}>
          Get USDG
        </button>
      </div>
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}
