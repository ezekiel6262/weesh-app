"use client";

import { useCallback, useEffect, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, usePublicClient, useSendTransaction, useSignTypedData, useWriteContract } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { TxStatus } from "@/components/TxStatus";
import { recordAct } from "@/lib/activity";
import { QUOTE } from "@/lib/catalog";
import { xlayer } from "@/lib/chain";
import { executeRoutedSwap, impliedPx } from "@/lib/fill";
import { routeQuote } from "@/lib/quote";
import { money, shortAddr } from "@/lib/format";
import { CANCEL_TYPES, ORDER_DOMAIN, ORDER_TYPES, type RestingOrder } from "@/lib/orderTypes";
import { bumpBook } from "@/lib/tx";
import type { Asset } from "@/lib/catalog";

export function MarketBook({ stock, last }: { stock: Asset; last: number | null }) {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const [orders, setOrders] = useState<RestingOrder[]>([]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState(last ? last.toFixed(2) : "");
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "gas" | "fee" | "approve" | "sign">("idle");

  const load = useCallback(() => {
    fetch(`/api/orders?stockId=${encodeURIComponent(stock.id)}`)
      .then((r) => r.json())
      .then((j) => setOrders(j.orders ?? []))
      .catch(() => setOrders([]));
  }, [stock.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const bids = orders.filter((o) => o.side === "buy").sort((a, b) => Number(b.priceUsd) - Number(a.priceUsd));
  const asks = orders.filter((o) => o.side === "sell").sort((a, b) => Number(a.priceUsd) - Number(b.priceUsd));

  async function place() {
    if (!address) return;
    const p = Number(price);
    const a = Number(amount);
    if (!p || !a) {
      setErr("Enter a price and size");
      return;
    }
    setErr(null);
    const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const nonce = `${Date.now()}`;
    const message = {
      stockId: stock.id,
      side,
      priceUsd: String(p),
      amount: String(a),
      maker: address,
      expiry: BigInt(expiry),
      nonce,
    };
    const signature = await signTypedDataAsync({
      domain: ORDER_DOMAIN,
      types: ORDER_TYPES,
      primaryType: "Order",
      message,
    });
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stockId: stock.id,
        side,
        priceUsd: String(p),
        amount: String(a),
        maker: address,
        expiry,
        nonce,
        signature,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error || "Could not post");
      return;
    }
    setAmount("");
    load();
  }

  async function cancel(o: RestingOrder) {
    if (!address) return;
    setErr(null);
    const signature = await signTypedDataAsync({
      domain: ORDER_DOMAIN,
      types: CANCEL_TYPES,
      primaryType: "Cancel",
      message: { id: o.id },
    });
    const res = await fetch("/api/orders", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: o.id, maker: address, signature }),
    });
    if (!res.ok) {
      const j = await res.json();
      setErr(j.error || "Cancel failed");
      return;
    }
    load();
  }

  async function hit(o: RestingOrder, mine: boolean) {
    if (!address || !client) return;
    const takerBuy = o.side === "sell";
    const pay = takerBuy ? QUOTE : stock;
    const get = takerBuy ? stock : QUOTE;
    const limit = Number(o.priceUsd);
    const size = Number(o.amount);
    const amountIn = takerBuy
      ? parseUnits((size * limit).toFixed(6), 6)
      : parseUnits(size.toFixed(8), stock.decimals);
    setErr(null);
    setTx(null);
    setStep("approve");
    try {
      const preview = await routeQuote(client, pay, get, amountIn, { preferOkx: true, slippagePct: "0.5" });
      if (!preview) throw new Error("No Uniswap or OKX quote");
      const px = impliedPx(preview);
      const ok = takerBuy ? px <= limit * 1.005 : px >= limit * 0.995;
      if (!ok) {
        setStep("idle");
        setErr(
          `Venue prints ${money(px)} / share. Limit is ${money(limit)}. Weesh will not fill worse than the book.`
        );
        return;
      }
      const { hash } = await executeRoutedSwap({
        client,
        address,
        write: writeContractAsync as never,
        send: sendTransactionAsync,
        pay,
        get,
        amountIn,
        slipPct: 0.5,
        preferOkx: true,
        quote: preview,
        onStep: setStep,
      });
      setTx(hash);
      setStep("idle");
      recordAct(takerBuy ? "buy" : "sell", `${mine ? "Fill mine" : "Hit"} ${stock.symbol} @ ${money(limit)}`, hash);
      bumpBook();
      if (mine) await cancel(o);
      else load();
    } catch (e) {
      setStep("idle");
      setErr(e instanceof Error ? e.message : "Fill failed");
    }
  }

  function Row({ o }: { o: RestingOrder }) {
    const mine = address && o.maker.toLowerCase() === address.toLowerCase();
    return (
      <div className="book-row">
        <span className={o.side === "buy" ? "ok" : "err"}>{money(Number(o.priceUsd))}</span>
        <span>
          {o.amount} {o.side === "buy" ? "USDG" : stock.symbol}
        </span>
        <span className="muted">{shortAddr(o.maker)}</span>
        {isConnected && chainId === xlayer.id ? (
          <span className="actions" style={{ margin: 0 }}>
            <button className="btn small" onClick={() => hit(o, Boolean(mine))}>
              {mine ? "Fill mine" : o.side === "sell" ? "Buy" : "Sell"}
            </button>
            {mine ? (
              <button className="btn ghost small" onClick={() => cancel(o)}>
                Cancel
              </button>
            ) : null}
          </span>
        ) : (
          <span />
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <p className="kicker">Weesh book</p>
      <h2>Limits on {stock.symbol}</h2>
      <p className="muted">
        Signed resting interest. Not escrowed. A hit fills <em>you</em> through Uniswap or OKX DEX only if
        the venue is at this price or better. The poster is not locked. Expires in 7 days.
      </p>
      <div className="book-cols">
        <div>
          <p className="section-title">Bids</p>
          {bids.length ? bids.map((o) => <Row key={o.id} o={o} />) : <p className="muted">No bids</p>}
        </div>
        <div>
          <p className="section-title">Asks</p>
          {asks.length ? asks.map((o) => <Row key={o.id} o={o} />) : <p className="muted">No asks</p>}
        </div>
      </div>
      {!isConnected || chainId !== xlayer.id ? (
        <ConnectBar />
      ) : (
        <>
          <div className="seg">
            <button className={side === "buy" ? "on" : ""} onClick={() => setSide("buy")}>
              Bid
            </button>
            <button className={side === "sell" ? "on" : ""} onClick={() => setSide("sell")}>
              Ask
            </button>
          </div>
          <label>Limit price (USD / share)</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder={last ? String(last) : "0"} />
          <label>{side === "buy" ? "Size (USDG)" : `Size (${stock.symbol})`}</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
          <div className="actions">
            <button className="btn primary" onClick={place}>
              Post {side === "buy" ? "bid" : "ask"}
            </button>
          </div>
        </>
      )}
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}
