"use client";

import { useEffect, useState } from "react";
import { zeroAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { WrapPanel } from "@/components/WrapPanel";
import { TxStatus } from "@/components/TxStatus";
import { recordAct } from "@/lib/activity";
import type { Asset } from "@/lib/catalog";
import { xlayer } from "@/lib/chain";
import { money } from "@/lib/format";
import { cashSession } from "@/lib/hours";
import { coverGas } from "@/lib/gas";
import { approveIfNeeded, bumpBook } from "@/lib/tx";
import { ATOMIC_SWAP_ABI } from "@/lib/xchange";
import type { XStockRow } from "@/lib/xstock";

type Status = {
  issuerPrint: number | null;
  configured: boolean;
  xchangeOk: boolean;
  minUsd: number;
  note: string;
};

type Rfq = {
  id?: string;
  price?: number;
  quantity?: string | number;
  signature?: `0x${string}`;
  contract?: { address?: `0x${string}`; network?: string };
  signaturePayload?: {
    message?: {
      quoteId: `0x${string}`;
      expiration: string | number;
      incomingTransfer: { from: `0x${string}`; to: `0x${string}`; token: `0x${string}`; amount: string };
      outgoingTransfer: { from: `0x${string}`; to: `0x${string}`; token: `0x${string}`; amount: string };
    };
  };
};

export function IssueRedeem({
  stock,
  row,
  onchain,
}: {
  stock: Asset;
  row: XStockRow;
  onchain: number | null;
}) {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const session = cashSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [qty, setQty] = useState("1");
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "approve" | "sign">("idle");

  useEffect(() => {
    fetch(`/api/xchange/status?id=${encodeURIComponent(stock.id)}`)
      .then((r) => r.json())
      .then((j) => setStatus(j))
      .catch(() => setStatus(null));
  }, [stock.id]);

  const print = status?.issuerPrint ?? null;
  const prem = onchain && print ? ((onchain - print) / print) * 100 : null;

  async function quote() {
    if (!address) return;
    setErr(null);
    setRfq(null);
    const res = await fetch("/api/xchange/rfq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: stock.id, side, quantity: qty, wallet: address, network: "XLayer" }),
    });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error || "Issuer rejected the quote. Wallet may need KYC, or xChange is not live on X Layer.");
      return;
    }
    setRfq(j);
  }

  async function execute() {
    if (!address || !client || !rfq?.signature || !rfq.signaturePayload?.message || !rfq.contract?.address) {
      setErr("Quote is not executable onchain.");
      return;
    }
    const msg = rfq.signaturePayload.message;
    const payToken = msg.incomingTransfer.token;
    const payAmt = BigInt(msg.incomingTransfer.amount);
    const payAsset: Asset = {
      ...stock,
      address: payToken,
      decimals: 6,
      id: "pay",
      symbol: "PAY",
      kind: "stable",
      tradable: true,
    };
    setErr(null);
    setStep("approve");
    try {
      await coverGas(client, address);
      await approveIfNeeded(client, writeContractAsync as never, address, payAsset, rfq.contract.address, payAmt);
      setStep("sign");
      const hash = await writeContractAsync({
        address: rfq.contract.address,
        abi: ATOMIC_SWAP_ABI,
        functionName: "executeSwap",
        args: [
          {
            quoteId: msg.quoteId,
            expiration: BigInt(msg.expiration),
            incomingTransfer: { ...msg.incomingTransfer, amount: payAmt },
            outgoingTransfer: { ...msg.outgoingTransfer, amount: BigInt(msg.outgoingTransfer.amount) },
          },
          rfq.signature,
          {
            owner: zeroAddress,
            deadline: BigInt(0),
            v: 0,
            r: "0x0000000000000000000000000000000000000000000000000000000000000000",
            s: "0x0000000000000000000000000000000000000000000000000000000000000000",
          },
        ],
      });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      recordAct(side === "Buy" ? "issue" : "redeem", `${side} ${row.xSymbol} via issuer`, hash);
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(e instanceof Error ? e.message : "Execute failed");
    }
  }

  return (
    <div className="card">
      <p className="kicker">Primary</p>
      <h2>Issue / redeem {row.xSymbol}</h2>
      <p className="muted">
        Direct mint/redeem is the issuer’s primary market (KYC, ~$5k, 24/5). Weesh does not apply for that
        in this build. You buy on Market; wrap if you already hold the rebase token.
      </p>
      <div className="kv">
        <span>Issuer print</span>
        <strong>{print ? money(print) : "—"}</strong>
      </div>
      <div className="kv">
        <span>Onchain</span>
        <span>{onchain ? money(onchain) : "—"}</span>
      </div>
      <div className="kv">
        <span>Premium vs issuer</span>
        <strong className={prem == null ? "" : prem > 0.15 ? "err" : prem < -0.15 ? "ok" : ""}>
          {prem == null ? "—" : `${prem > 0 ? "+" : ""}${prem.toFixed(2)}%`}
        </strong>
      </div>
      <p className={session.open ? "ok" : "muted"}>{session.label}. Primary follows US hours more tightly than the AMM.</p>
      <p className="muted">{status?.note}</p>
      {!status?.configured ? (
        <p className="blocked">
          Primary RFQ is gated. This entry uses the public issuer print and secondary venues only — Uniswap,
          OKX DEX, and wrap. No fake mint.
        </p>
      ) : !isConnected || chainId !== xlayer.id ? (
        <ConnectBar />
      ) : (
        <>
          <div className="seg">
            <button className={side === "Buy" ? "on" : ""} onClick={() => setSide("Buy")}>
              Issue
            </button>
            <button className={side === "Sell" ? "on" : ""} onClick={() => setSide("Sell")}>
              Redeem
            </button>
          </div>
          <label>Shares</label>
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
          <div className="actions">
            <button className="btn primary" onClick={quote}>
              Ask issuer
            </button>
            <a className="btn ghost" href="https://xstocks.fi" target="_blank" rel="noreferrer">
              Issuer platform
            </a>
          </div>
          {rfq?.price ? (
            <div className="card accent-edge" style={{ marginTop: 12 }}>
              <div className="kv">
                <span>Issuer quote</span>
                <strong>{money(rfq.price)} / share</strong>
              </div>
              <div className="kv">
                <span>Qty</span>
                <span>{String(rfq.quantity)}</span>
              </div>
              <button className="btn primary" disabled={isPending} onClick={execute}>
                Sign atomic swap
              </button>
            </div>
          ) : null}
        </>
      )}
      <TxStatus err={err} hash={tx} step={step} />
      <div style={{ marginTop: 16 }}>
        <WrapPanel stock={stock} row={row} />
      </div>
    </div>
  );
}
