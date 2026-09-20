"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, usePublicClient, useSendTransaction, useWriteContract } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { QuoteCard } from "@/components/QuoteCard";
import { TxStatus } from "@/components/TxStatus";
import { recordAct } from "@/lib/activity";
import type { Asset } from "@/lib/catalog";
import { QUOTE } from "@/lib/catalog";
import { xlayer } from "@/lib/chain";
import { executeRoutedSwap, impliedPx } from "@/lib/fill";
import { splitWeeshFee } from "@/lib/fee";
import { money } from "@/lib/format";
import { routeQuote, type Quote } from "@/lib/quote";
import { bumpBook } from "@/lib/tx";

export function SizeRfq({ stock }: { stock: Asset }) {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTransactionAsync, isPending: sending } = useSendTransaction();
  const seq = useRef(0);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [usd, setUsd] = useState("1000");
  const [q, setQ] = useState<Quote | null>(null);
  const [fullIn, setFullIn] = useState<bigint | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "gas" | "fee" | "approve" | "sign">("idle");

  const pay = side === "buy" ? QUOTE : stock;
  const get = side === "buy" ? stock : QUOTE;
  const usdN = Number(usd) || 0;

  const amountIn = useMemo(() => {
    if (usdN <= 0) return null;
    if (side === "buy") return parseUnits(usdN.toFixed(6), 6);
    return null;
  }, [usdN, side]);

  useEffect(() => {
    if (!client || usdN <= 0) {
      setQ(null);
      return;
    }
    const id = ++seq.current;
    setQuoting(true);
    setErr(null);
    const t = window.setTimeout(async () => {
      try {
        let amt = amountIn;
        if (side === "sell") {
          const probe = await routeQuote(client, stock, QUOTE, parseUnits("1", stock.decimals), {
            preferOkx: true,
            mode: "auto",
          });
          const px = probe ? impliedPx(probe) : 0;
          if (!px) throw new Error("No size quote");
          amt = parseUnits((usdN / px).toFixed(8), stock.decimals);
        }
        if (!amt) return;
        setFullIn(amt);
        const next = await routeQuote(client, pay, get, splitWeeshFee(amt).swapIn, {
          preferOkx: true,
          mode: "auto",
          slippagePct: "0.8",
        });
        if (seq.current !== id) return;
        setQ(next);
        if (!next) setErr("OKX DEX / Uniswap had no size quote.");
      } catch (e) {
        if (seq.current === id) setErr(e instanceof Error ? e.message : "Quote failed");
      } finally {
        if (seq.current === id) setQuoting(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [client, usdN, side, stock, pay, get, amountIn]);

  async function submit() {
    if (!address || !client || !q || !fullIn) return;
    setStep("gas");
    setErr(null);
    try {
      const { hash } = await executeRoutedSwap({
        client,
        address,
        write: writeContractAsync as never,
        send: sendTransactionAsync,
        pay,
        get,
        amountIn: fullIn,
        slipPct: 0.8,
        preferOkx: true,
        mode: "auto",
        quote: q,
        onStep: setStep,
      });
      setTx(hash);
      setStep("idle");
      recordAct(side, `Size ${side} ${stock.symbol} ~${money(usdN)}`, hash);
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!isConnected || chainId !== xlayer.id) {
    return (
      <div className="card">
        <p className="kicker">Size</p>
        <h2>RFQ for a block</h2>
        <p className="muted">Ask OKX DEX (intent / aggregator) for a fill Uniswap may not have. Connect to quote.</p>
        <ConnectBar />
      </div>
    );
  }

  return (
    <div className="card">
      <p className="kicker">Size</p>
      <h2>RFQ · {stock.symbol}</h2>
      <p className="muted">
        For size the AMM is thin. Weesh asks OKX DEX in auto/intent mode (solvers + RFQ), then Uniswap.
        You still sign. Weesh does not custody.
      </p>
      <div className="seg">
        <button className={side === "buy" ? "on" : ""} onClick={() => setSide("buy")}>
          Buy
        </button>
        <button className={side === "sell" ? "on" : ""} onClick={() => setSide("sell")}>
          Sell
        </button>
      </div>
      <label>Notional (USD)</label>
      <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" />
      {quoting ? <p className="muted">Asking OKX DEX…</p> : null}
      {q ? (
        <QuoteCard
          q={q}
          pay={pay}
          get={get}
          slippagePct={0.8}
          fullIn={fullIn ?? undefined}
          extra={
            <div className="kv">
              <span>Implied</span>
              <strong>{money(impliedPx(q))} / share</strong>
            </div>
          }
        />
      ) : null}
      <div className="actions">
        <button className="btn primary" disabled={!q || isPending || sending} onClick={submit}>
          Sign {side}
        </button>
      </div>
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}
