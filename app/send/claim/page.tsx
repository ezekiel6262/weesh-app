"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, isAddress, type Hex } from "viem";
import { ConnectBar } from "@/components/Connect";
import { xlayer } from "@/lib/chain";
import { byAddress } from "@/lib/catalog";
import { DROP_READY, WEESH_DROP, dropAbi } from "@/lib/drop";
import { qty, shortAddr } from "@/lib/format";
import { txUrl } from "@/lib/tx";

function ClaimInner() {
  const params = useSearchParams();
  const drop = params.get("drop") || "";
  const index = params.get("i") || "";
  const [secret] = useState(() => (params.get("k") || "") as Hex);
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [err, setErr] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const idOk = /^\d+$/.test(drop);
  const indexOk = /^\d+$/.test(index);
  const secretOk = /^0x[0-9a-fA-F]{64}$/.test(secret);
  const linkOk = DROP_READY && idOk && indexOk && secretOk;

  const info = useReadContract({
    address: DROP_READY ? WEESH_DROP : undefined,
    abi: dropAbi,
    functionName: "dropInfo",
    args: idOk ? [BigInt(drop)] : undefined,
    query: { enabled: DROP_READY && idOk },
  });
  const slot = useReadContract({
    address: DROP_READY ? WEESH_DROP : undefined,
    abi: dropAbi,
    functionName: "slot",
    args: idOk && indexOk ? [BigInt(drop), BigInt(index)] : undefined,
    query: { enabled: DROP_READY && idOk && indexOk },
  });

  useEffect(() => {
    if (!secretOk) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("k")) return;
    url.searchParams.delete("k");
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [secretOk]);

  const tokenAddr = info.data?.[1];
  const sender = info.data?.[0];
  const gift = info.data?.[3] || "A stock is waiting";
  const stock = tokenAddr && isAddress(tokenAddr) ? byAddress.get(tokenAddr.toLowerCase()) : undefined;
  const amount = slot.data?.[1];
  const paid = Boolean(slot.data?.[2]);
  const claimable = Boolean(slot.data?.[3]);
  const ready = isConnected && chainId === xlayer.id;
  const done = Boolean(hash) || (paid && !claimable);

  async function claim() {
    if (!linkOk) return;
    setBusy(true);
    setErr(null);
    try {
      const tx = await writeContractAsync({
        address: WEESH_DROP,
        abi: dropAbi,
        functionName: "claim",
        args: [BigInt(drop), BigInt(index), secret],
      });
      setHash(tx);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The claim did not go through");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hero">
      <p className="kicker">{done ? "In your wallet" : "A gift"}</p>
      <h1>{gift}</h1>
      {!linkOk ? (
        <p className="lede">This link is incomplete. Ask the sender for a new one.</p>
      ) : (
        <>
          <p className="nav-usd">{amount != null ? qty(amount, stock?.decimals ?? 18) : "…"}</p>
          <p className="lede">
            {stock?.name || "Shares"}
            {sender ? ` from ${shortAddr(sender)}` : ""}. They move into the wallet you connect.
          </p>
          {done ? (
            <p className="ok">{hash ? "Claimed." : "These shares were already claimed."}</p>
          ) : null}
          {hash ? (
            <p>
              <a href={txUrl(hash)} target="_blank" rel="noreferrer">
                View the transaction
              </a>
            </p>
          ) : null}
          {!done && !ready ? <ConnectBar /> : null}
          {!done && ready ? (
            <button className="btn accent" disabled={busy || !claimable} onClick={claim}>
              {busy ? "Waiting for your signature" : `Claim ${stock?.name || "shares"}`}
            </button>
          ) : null}
          {address && !done ? <p className="muted">Into {shortAddr(address)}</p> : null}
          {err ? <p className="err">{err}</p> : null}
        </>
      )}
    </section>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<section className="hero">Opening the gift…</section>}>
      <ClaimInner />
    </Suspense>
  );
}
