"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { TxStatus } from "@/components/TxStatus";
import { erc4626Abi } from "@/lib/abi";
import { recordAct } from "@/lib/activity";
import type { Asset } from "@/lib/catalog";
import { parseAmount, qty } from "@/lib/format";
import { coverGas } from "@/lib/gas";
import { approveIfNeeded, bumpBook } from "@/lib/tx";
import { useBook } from "@/lib/useBook";
import type { XStockRow } from "@/lib/xstock";

export function WrapPanel({ stock, row }: { stock: Asset; row: XStockRow }) {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { lines } = useBook();
  const [amt, setAmt] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "approve" | "sign">("idle");

  const wrapLine = lines.find((l) => l.asset.id === stock.id);
  const rawLine = lines.find((l) => l.asset.id === `${stock.id}-x`);
  const wrapBal = wrapLine?.wallet ?? BigInt(0);
  const rawBal = rawLine?.wallet ?? BigInt(0);
  const parsed = useMemo(() => parseAmount(amt, stock), [amt, stock]);

  if (!row.underlying) return null;

  const rawAsset: Asset = {
    ...stock,
    id: `${stock.id}-x`,
    address: row.underlying as `0x${string}`,
    symbol: row.xSymbol,
    name: `${stock.name} (xStock)`,
  };

  async function wrap() {
    if (!address || !client || !parsed) return;
    setErr(null);
    try {
      await coverGas(client, address);
      setStep("approve");
      await approveIfNeeded(client, writeContractAsync as never, address, rawAsset, stock.address, parsed);
      setStep("sign");
      const hash = await writeContractAsync({
        address: stock.address,
        abi: erc4626Abi,
        functionName: "deposit",
        args: [parsed, address],
      });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      recordAct("wrap", `Wrap ${stock.symbol}`, hash);
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(e instanceof Error ? e.message : "Wrap failed");
    }
  }

  async function unwrap() {
    if (!address || !client || !parsed) return;
    setErr(null);
    try {
      await coverGas(client, address);
      setStep("sign");
      const hash = await writeContractAsync({
        address: stock.address,
        abi: erc4626Abi,
        functionName: "redeem",
        args: [parsed, address, address],
      });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      recordAct("unwrap", `Unwrap ${stock.symbol}`, hash);
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(e instanceof Error ? e.message : "Unwrap failed");
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <p className="kicker">Wrap</p>
      <h2>Two tokens, one stock</h2>
      <p className="muted">
        Weesh trades the wrapped token ({stock.symbol}). If you withdrew from OKX you may hold{" "}
        {row.xSymbol}. Wrap it to sell on Uniswap. Unwrap to hold the rebase xStock.
      </p>
      <p className="muted">
        Wrapped {qty(wrapBal, 18)} · xStock {qty(rawBal, 18)}
      </p>
      <label>Amount</label>
      <div className="amount">
        <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="0" />
        <button className="btn ghost small" onClick={() => setAmt(formatUnits(rawBal > wrapBal ? rawBal : wrapBal, 18))}>
          Max
        </button>
      </div>
      <div className="actions">
        <button className="btn primary" disabled={!parsed || isPending} onClick={wrap}>
          Wrap {row.xSymbol}
        </button>
        <button className="btn" disabled={!parsed || isPending} onClick={unwrap}>
          Unwrap
        </button>
      </div>
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}
