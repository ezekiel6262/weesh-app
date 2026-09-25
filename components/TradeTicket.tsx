"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { getPublicClient } from "wagmi/actions";
import { useAccount, useConfig, usePublicClient, useSendTransaction, useWriteContract } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { Mark } from "@/components/Mark";
import { QuoteCard } from "@/components/QuoteCard";
import { Receive } from "@/components/Receive";
import { TxStatus } from "@/components/TxStatus";
import { recordAct } from "@/lib/activity";
import { QUOTE, STOCKS, USDC, USDT0 } from "@/lib/catalog";
import { xlayer } from "@/lib/chain";
import { splitWeeshFee } from "@/lib/fee";
import { friendlyError } from "@/lib/errors";
import { executeRoutedSwap } from "@/lib/fill";
import { money, parseAmount, qty } from "@/lib/format";
import { routeQuote, type Quote } from "@/lib/quote";
import { prepareStable } from "@/lib/stables";
import { bumpBook } from "@/lib/tx";
import { useBook } from "@/lib/useBook";
import { useMarkets } from "@/lib/useMarkets";
import { getStock } from "@/lib/xstock";

export function TradeTicket({
  stockId,
  onStockId,
  showPicker = false,
  initialSide = "buy",
}: {
  stockId: string;
  onStockId?: (id: string) => void;
  showPicker?: boolean;
  initialSide?: "buy" | "sell";
}) {
  const { address, isConnected, chainId } = useAccount();
  const config = useConfig();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTransactionAsync, isPending: sending } = useSendTransaction();
  const { lines } = useBook();
  const { available, unavailable, loading: marketsLoading } = useMarkets();
  const quoteSeq = useRef(0);
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [amount, setAmount] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "gas" | "fee" | "approve" | "sign">("idle");
  const [preparing, setPreparing] = useState("");
  const [slip, setSlip] = useState(0.5);

  const stock = useMemo(
    () => getStock(stockId) ?? STOCKS.find((s) => s.id === stockId) ?? STOCKS[0],
    [stockId]
  );
  const listed = useMemo(
    () => [...available, ...unavailable].find((m) => m.id === stock.id),
    [available, unavailable, stock.id]
  );
  const halted = Boolean(listed && listed.reason === "halted");
  const preferOkx = listed?.reason === "okx" || listed?.reason === "no-pool";
  const chipSource = useMemo(() => {
    const n = query.trim().toLowerCase();
    const pool = n
      ? [...available, ...unavailable].filter(
          (m) =>
            m.name.toLowerCase().includes(n) ||
            m.symbol.toLowerCase().includes(n) ||
            m.xSymbol.toLowerCase().includes(n)
        )
      : available;
    return pool.slice(0, 24);
  }, [available, unavailable, query]);
  const pay = side === "buy" ? QUOTE : stock;
  const get = side === "buy" ? stock : QUOTE;
  const bal = lines.find((l) => l.asset.id === pay.id)?.wallet ?? BigInt(0);
  const stableBalances = {
    [QUOTE.id]: lines.find((l) => l.asset.id === QUOTE.id)?.wallet ?? BigInt(0),
    [USDT0.id]: lines.find((l) => l.asset.id === USDT0.id)?.wallet ?? BigInt(0),
    [USDC.id]: lines.find((l) => l.asset.id === USDC.id)?.wallet ?? BigInt(0),
  };
  const spendable = side === "buy"
    ? stableBalances[QUOTE.id] + stableBalances[USDT0.id] + stableBalances[USDC.id]
    : bal;
  const pos = lines.find((l) => l.asset.id === stock.id);
  const parsed = useMemo(() => parseAmount(amount, pay), [amount, pay]);
  const insufficient = Boolean(parsed && parsed > spendable);

  useEffect(() => {
    const payAsset = side === "buy" ? QUOTE : stock;
    const getAsset = side === "buy" ? stock : QUOTE;
    const amt = parseAmount(amount, payAsset);
    if (!amt || halted) {
      quoteSeq.current += 1;
      setQuoting(false);
      if (!amt) setQ(null);
      return;
    }
    if (marketsLoading) {
      setQuoting(true);
      return;
    }
    const id = ++quoteSeq.current;
    setQuoting(true);
    setErr(null);
    const t = window.setTimeout(() => {
      const rpc = getPublicClient(config, { chainId: xlayer.id });
      if (!rpc) {
        if (quoteSeq.current === id) {
          setQuoting(false);
          setErr("No RPC client");
        }
        return;
      }
      void routeQuote(rpc, payAsset, getAsset, splitWeeshFee(amt).swapIn, {
            preferOkx,
            slippagePct: String(slip),
          })
        .then((next) => {
          if (quoteSeq.current !== id) return;
          setQ(next);
          setErr(next ? null : "No Uniswap pool and OKX DEX did not return a quote.");
        })
        .catch((e) => {
          if (quoteSeq.current !== id) return;
          setQ(null);
          setErr(e instanceof Error ? e.message : "Quote failed");
        })
        .finally(() => {
          if (quoteSeq.current === id) setQuoting(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(t);
    };
  }, [amount, stockId, side, halted, preferOkx, marketsLoading, config, stock, slip]);

  async function submit() {
    if (!address || !client || !q || !parsed || halted) return;
    if (parsed > spendable) {
      setErr(`Not enough ${side === "buy" ? "digital dollars" : pay.symbol}. Available: ${qty(spendable, pay.decimals)}.`);
      return;
    }
    setErr(null);
    setTx(null);
    try {
      if (side === "buy" && bal < parsed) {
        await prepareStable({
          client,
          address,
          write: writeContractAsync as never,
          send: sendTransactionAsync,
          target: QUOTE,
          amount: parsed,
          balances: stableBalances,
          onStep: setPreparing,
        });
        bumpBook();
      }
      setPreparing("");
      setStep("gas");
      const { hash } = await executeRoutedSwap({
        client,
        address,
        write: writeContractAsync as never,
        send: sendTransactionAsync,
        pay,
        get,
        amountIn: parsed,
        slipPct: slip,
        preferOkx,
        quote: q,
        onStep: setStep,
      });
      setTx(hash);
      recordAct(side, `${side === "buy" ? "Buy" : "Sell"} ${stock.symbol}`, hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setPreparing("");
      setErr(friendlyError(e, { action: side === "buy" ? "purchase" : "sale", asset: side === "buy" ? "digital dollars" : pay.symbol, available: qty(spendable, pay.decimals) }));
    }
  }

  const about =
    q && get.kind === "stable"
      ? Number(q.amountOut) / 1e6
      : q && pay.kind === "stable"
        ? Number(parsed ?? BigInt(0)) / 1e6
        : 0;

  if (!isConnected || chainId !== xlayer.id) {
    return (
      <div className="card">
        <p className="kicker">Trade</p>
        <h2>{side === "buy" ? `Buy ${stock.name}` : `Sell ${stock.name}`}</h2>
        <p className="muted">Create a wallet with email on this page. Weesh never holds the keys.</p>
        <ConnectBar />
      </div>
    );
  }

  return (
    <div className="card">
      <p className="kicker">Trade</p>
      <h2>{showPicker ? "Buy or sell a stock" : `${side === "buy" ? "Buy" : "Sell"} ${stock.symbol}`}</h2>
      <div className="seg">
        <button className={side === "buy" ? "on" : ""} onClick={() => setSide("buy")}>
          Buy
        </button>
        <button className={side === "sell" ? "on" : ""} onClick={() => setSide("sell")}>
          Sell
        </button>
      </div>
      {showPicker ? (
        <>
          <label>Stock</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any xStock on X Layer"
          />
          <div className="chips">
            {chipSource.map((s) => (
              <button
                key={s.id}
                className={stockId === s.id ? "chip on" : "chip"}
                style={s.available === false ? { opacity: 0.55 } : undefined}
                onClick={() => onStockId?.(s.id)}
              >
                <Mark asset={getStock(s.id) ?? stock} size={22} />
                {s.symbol}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {side === "buy" && spendable === BigInt(0) ? (
        <>
          <p className="blocked">No dollars in this wallet yet. Send USDG on X Layer — Weesh covers gas.</p>
          <Receive compact />
        </>
      ) : null}
      {halted ? <p className="blocked">{stock.name} trading is halted by the issuer.</p> : null}
      {listed?.reason === "okx" ? (
        <p className="muted">No Uniswap pool. Quote from OKX DEX (aggregator + RFQ).</p>
      ) : null}
      {pos && pos.wallet + pos.aave + pos.spark > BigInt(0) ? (
        <p className="muted">
          You have {qty(pos.wallet + pos.aave + pos.spark, stock.decimals)} {stock.symbol}
          {pos.usd ? ` · ${money(pos.usd)}` : ""}
        </p>
      ) : null}
      <label>{side === "buy" ? `Spend (${QUOTE.symbol})` : `Sell (${stock.symbol})`}</label>
      <div className="amount">
        <input
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {side === "sell" && pos && pos.wallet > BigInt(0) ? (
          <button
            className="btn ghost small"
            onClick={() => setAmount(formatUnits(pos.wallet / BigInt(4), stock.decimals))}
          >
            25%
          </button>
        ) : null}
        <button className="btn ghost small" onClick={() => setAmount(formatUnits(spendable, pay.decimals))}>
          Max
        </button>
      </div>
      <label>Slippage</label>
      <div className="seg">
        {[0.3, 0.5, 1].map((n) => (
          <button key={n} className={slip === n ? "on" : ""} onClick={() => setSlip(n)}>
            {n}%
          </button>
        ))}
      </div>
      <p className="muted">Available {qty(spendable, pay.decimals)}{side === "buy" ? " across USDG, USDT, and USDC" : ""}</p>
      {insufficient ? <p className="blocked">This amount is higher than your available {side === "buy" ? "digital-dollar" : pay.symbol} balance.</p> : null}
      {!parsed && !halted ? <p className="muted">Enter an amount to load a live quote.</p> : null}
      {quoting ? <p className="muted">Quoting Uniswap / OKX DEX…</p> : null}
      {preparing ? <p className="muted" role="status">{preparing}</p> : null}
      {q ? (
        <QuoteCard
          q={q}
          pay={pay}
          get={get}
          slippagePct={slip}
          fullIn={parsed ?? undefined}
          extra={
            about ? (
              <div className="kv">
                <span>About</span>
                <span>{money(about)}</span>
              </div>
            ) : null
          }
        />
      ) : null}
      <div className="actions">
        <button
          className="btn primary"
          disabled={!q || isPending || sending || halted || insufficient || (side === "buy" && spendable === BigInt(0))}
          onClick={submit}
        >
          {isPending || sending
            ? "Confirm in wallet…"
            : side === "buy"
              ? `Buy ${stock.name}`
              : `Sell ${stock.name}`}
        </button>
      </div>
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}
