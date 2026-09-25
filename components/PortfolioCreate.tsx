"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { Mark } from "@/components/Mark";
import { ASSETS } from "@/lib/catalog";
import { PORTFOLIO_REGISTRY, assetFor, portfolioRegistryAbi, readPrivatePortfolios, savePrivatePortfolio, type PortfolioVisibility } from "@/lib/portfolio";

type Leg = { id: string; weight: number };

export function PortfolioCreate() {
  const router = useRouter();
  const search = useSearchParams();
  const forkId = search.get("fork");
  const forkNumeric = forkId && !forkId.startsWith("local-") ? BigInt(forkId) : 0n;
  const forkApplied = useRef(false);
  const client = usePublicClient();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { data: nextId } = useReadContract({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "nextPortfolioId" });
  const { data: forkRaw } = useReadContract({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "portfolio", args: [forkNumeric], query: { enabled: forkNumeric > 0n } });
  const [name, setName] = useState("AI infrastructure");
  const [thesis, setThesis] = useState("A focused basket of the companies supplying compute and broad-market exposure to balance concentration risk.");
  const [visibility, setVisibility] = useState<PortfolioVisibility>("public");
  const [showHoldings, setShowHoldings] = useState(true);
  const [legs, setLegs] = useState<Leg[]>([{ id: "NVDA", weight: 60 }, { id: "SPY", weight: 40 }]);
  const [err, setErr] = useState<string | null>(null);
  const total = legs.reduce((sum, leg) => sum + leg.weight, 0);
  const choices = useMemo(() => ASSETS.filter((a) => a.tradable), []);

  useEffect(() => {
    if (!forkId || forkApplied.current) return;
    let source: { name: string; thesis: string; assets: readonly `0x${string}`[]; weights: readonly number[] } | undefined;
    if (forkId.startsWith("local-")) source = readPrivatePortfolios().find((p) => p.id === forkId);
    else if (forkRaw) source = forkRaw as typeof source;
    if (!source) return;
    const nextLegs = source.assets.flatMap((address, i) => {
      const asset = assetFor(address);
      return asset ? [{ id: asset.id, weight: Number(source!.weights[i]) / 100 }] : [];
    });
    if (!nextLegs.length) return;
    forkApplied.current = true;
    setName(`${source.name} — fork`);
    setThesis(source.thesis);
    setLegs(nextLegs);
  }, [forkId, forkRaw]);

  function update(i: number, patch: Partial<Leg>) { setLegs(legs.map((leg, index) => index === i ? { ...leg, ...patch } : leg)); }

  async function publish() {
    if (!address || !client || total !== 100 || !name.trim()) return;
    setErr(null);
    const assets = legs.map((leg) => choices.find((a) => a.id === leg.id)!).filter(Boolean);
    if (new Set(assets.map((a) => a.id)).size !== assets.length) { setErr("Each asset can appear only once."); return; }
    if (visibility === "private") {
      const id = `local-${Date.now()}`;
      savePrivatePortfolio({ id, creator: address, createdAt: Math.floor(Date.now() / 1000), visibility, showHoldings, name: name.trim(), thesis: thesis.trim(), assets: assets.map((a) => a.address), weights: legs.map((leg) => leg.weight * 100), followers: 0 });
      router.push(`/p/${id}`);
      return;
    }
    try {
      const id = nextId ?? 1n;
      const hash = await writeContractAsync({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "create", args: [name.trim(), thesis.trim(), assets.map((a) => a.address), legs.map((leg) => leg.weight * 100), visibility === "public" ? 0 : 1, showHoldings] });
      await client.waitForTransactionReceipt({ hash });
      router.push(`/p/${id.toString()}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Portfolio could not be published"); }
  }

  if (!isConnected) return <section className="hero"><p className="kicker">Create portfolio</p><h1>Start with your wallet.</h1><p className="lede">The creator address becomes the strategy’s public author. Weesh never controls it.</p><ConnectBar /></section>;

  return <div className="portfolio-editor"><div><p className="kicker">Create a strategy</p><h1>Turn your view into a portfolio.</h1><p className="lede">Choose the allocation people can inspect, follow, fork, and replicate.</p></div><div className="card">
    <label>Portfolio name</label><input maxLength={64} value={name} onChange={(e) => setName(e.target.value)} />
    <label>Investment thesis</label><textarea maxLength={600} rows={5} value={thesis} onChange={(e) => setThesis(e.target.value)} />
    <div className="section-head"><h2>Allocation</h2><strong className={total === 100 ? "ok" : "err"}>{total}%</strong></div>
    <div className="allocation-editor">{legs.map((leg, i) => { const asset = choices.find((a) => a.id === leg.id) ?? choices[0]; return <div key={i}><Mark asset={asset} size={30} /><select value={leg.id} onChange={(e) => update(i, { id: e.target.value })}>{choices.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.symbol})</option>)}</select><input aria-label={`${asset.symbol} weight`} inputMode="numeric" value={leg.weight} onChange={(e) => update(i, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /><span>%</span><button className="btn ghost small" disabled={legs.length === 1} onClick={() => setLegs(legs.filter((_, index) => index !== i))}>Remove</button></div>; })}</div>
    <button className="btn ghost small" disabled={legs.length >= 12} onClick={() => setLegs([...legs, { id: choices.find((a) => !legs.some((leg) => leg.id === a.id))?.id ?? choices[0].id, weight: 0 }])}>+ Add asset</button>
    <label>Visibility</label><div className="visibility-grid">{(["public", "unlisted", "private"] as const).map((v) => <button key={v} className={visibility === v ? "on" : ""} onClick={() => setVisibility(v)}><strong>{v[0].toUpperCase() + v.slice(1)}</strong><span>{v === "public" ? "Listed in discovery" : v === "unlisted" ? "Shareable link, off the feed" : "Only on this device"}</span></button>)}</div>
    <label className="check-row"><input type="checkbox" checked={showHoldings} onChange={(e) => setShowHoldings(e.target.checked)} />Show my live holdings for these assets as proof</label>
    <p className="hint">Public and unlisted definitions are permanent on X Layer. Private portfolios stay in this browser and cannot be shared.</p>
    {err ? <p className="err">{err}</p> : null}<div className="actions"><button className="btn primary" disabled={isPending || total !== 100 || !name.trim()} onClick={() => void publish()}>{isPending ? "Confirm in wallet…" : visibility === "private" ? "Save privately" : "Publish on X Layer"}</button></div>
  </div></div>;
}
