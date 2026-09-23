"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, isAddress, type Hex } from "viem";
import { ConnectBar } from "@/components/Connect";
import { xlayer } from "@/lib/chain";
import { byAddress } from "@/lib/catalog";
import { DROP_READY, WEESH_DROP, dropAbi } from "@/lib/drop";
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
    if (secretOk) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("k")) {
        url.searchParams.delete("k");
        window.history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString());
      }
    }
  }, [secretOk]);

  const tokenAddr = info.data?.[1];
  const stock = tokenAddr && isAddress(tokenAddr) ? byAddress.get(tokenAddr.toLowerCase()) : undefined;
  const amount = slot.data?.[1];
  const paid = slot.data?.[2];
  const claimable = slot.data?.[3];
  const ready = isConnected && chainId === xlayer.id;

  async function claim() {
    if (!secretOk || !idOk || !indexOk) return;
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
    <section className="card">
      <h1 className="display">{info.data?.[3] || "A stock is waiting"}</h1>
      {!DROP_READY || !idOk || !indexOk || !secretOk ? (
        <p className="err">This claim link is incomplete. Ask the sender for a new one.</p>
      ) : (
        <>
          <p>
            {amount != null ? formatUnits(amount, stock?.decimals ?? 18) : "…"} {stock?.name || "shares"}
            {paid ? " · already claimed" : claimable ? " · ready to claim" : ""}
          </p>
          <p className="muted">The shares move into the wallet you connect. Weesh does not hold them.</p>
          {hash ? (
            <p>
              <a href={txUrl(hash)} target="_blank" rel="noreferrer">
                Claim sent
              </a>
            </p>
          ) : null}
          {!ready ? (
            <ConnectBar />
          ) : (
            <button className="btn accent" disabled={busy || paid || !claimable} onClick={claim}>
              {busy ? "Claiming" : paid ? "Already claimed" : "Claim"}
            </button>
          )}
          {address ? <p className="muted">Claiming to {address}</p> : null}
          {err ? <p className="err">{err}</p> : null}
        </>
      )}
    </section>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<section className="card">Opening the claim…</section>}>
      <ClaimInner />
    </Suspense>
  );
}
