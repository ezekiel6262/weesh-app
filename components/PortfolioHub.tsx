"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { Mark } from "@/components/Mark";
import {
  PORTFOLIO_REGISTRY,
  assetFor,
  portfolioRegistryAbi,
  readPrivatePortfolios,
  shortCreator,
  type Portfolio,
} from "@/lib/portfolio";

function decode(id: bigint, raw: unknown, followers = 0): Portfolio | null {
  if (!raw) return null;
  const p = raw as { creator: `0x${string}`; createdAt: bigint; visibility: number; showHoldings: boolean; name: string; thesis: string; assets: readonly `0x${string}`[]; weights: readonly number[] };
  return { id: id.toString(), creator: p.creator, createdAt: Number(p.createdAt), visibility: p.visibility === 0 ? "public" : "unlisted", showHoldings: p.showHoldings, name: p.name, thesis: p.thesis, assets: [...p.assets], weights: p.weights.map(Number), followers };
}

export function PortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  return (
    <Link href={`/p/${portfolio.id}`} className="portfolio-card">
      <div className="portfolio-card-top">
        <span className="pill">{portfolio.visibility === "private" ? "Private" : portfolio.visibility === "unlisted" ? "Unlisted" : "Public"}</span>
        <span className="muted">{portfolio.followers ?? 0} followers</span>
      </div>
      <h2>{portfolio.name}</h2>
      <p>{portfolio.thesis || "A tokenized-asset portfolio on X Layer."}</p>
      <div className="portfolio-stack">
        {portfolio.assets.slice(0, 5).map((address, i) => {
          const asset = assetFor(address);
          return asset ? <span key={address}><Mark asset={asset} size={24} />{asset.symbol} {portfolio.weights[i] / 100}%</span> : null;
        })}
      </div>
      <small>By {shortCreator(portfolio.creator)} · View strategy →</small>
    </Link>
  );
}

export function PortfolioHub() {
  const [privateRows, setPrivateRows] = useState<Portfolio[]>([]);
  const { data: nextId, isLoading } = useReadContract({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "nextPortfolioId" });
  const ids = useMemo(() => {
    const end = Number(nextId ?? 1n);
    return Array.from({ length: Math.min(Math.max(0, end - 1), 30) }, (_, i) => BigInt(end - i - 1));
  }, [nextId]);
  const contracts = useMemo(() => ids.flatMap((id) => [
    { address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "portfolio" as const, args: [id] },
    { address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "followerCount" as const, args: [id] },
  ]), [ids]);
  const { data } = useReadContracts({ contracts });
  const publicRows = useMemo(() => ids.flatMap((id, i) => {
    const row = data?.[i * 2];
    const followers = data?.[i * 2 + 1]?.result as bigint | undefined;
    const decoded = row?.status === "success" ? decode(id, row.result, Number(followers ?? 0n)) : null;
    return decoded?.visibility === "public" ? [decoded] : [];
  }), [data, ids]);

  useEffect(() => setPrivateRows(readPrivatePortfolios()), []);

  return (
    <>
      <section className="portfolio-hero">
        <div><p className="kicker">Public portfolios</p><h1>Publish the thesis.<br />Keep every wallet independent.</h1><p className="lede">Discover tokenized-asset portfolios on X Layer, follow their updates, or replicate the allocation with assets held in your own wallet.</p></div>
        <div className="actions"><Link className="btn primary" href="/portfolios/new">Create portfolio</Link><Link className="btn ghost" href="/strategy">Ask an AI specialist</Link></div>
      </section>
      <section className="portfolio-explain"><div><strong>Follow</strong><span>Track a strategy without moving money.</span></div><div><strong>Replicate</strong><span>Weesh prepares each trade; you approve every signature.</span></div><div><strong>Fork</strong><span>Use an allocation as a starting point for your own view.</span></div></section>
      {privateRows.length ? <section><div className="section-head"><div><p className="kicker">Only on this device</p><h2>Your private portfolios</h2></div></div><div className="portfolio-grid">{privateRows.map((p) => <PortfolioCard key={p.id} portfolio={p} />)}</div></section> : null}
      <section style={{ marginTop: 34 }}><div className="section-head"><div><p className="kicker">Onchain discovery</p><h2>Public strategies</h2></div><span className="muted">Definitions and social proof are recorded on X Layer.</span></div>
        {isLoading ? <p className="muted">Reading the registry…</p> : publicRows.length ? <div className="portfolio-grid">{publicRows.map((p) => <PortfolioCard key={p.id} portfolio={p} />)}</div> : <div className="empty"><h2>Be the first strategist.</h2><p>Publish an allocation and share the link before anyone else does.</p><Link className="btn primary" href="/portfolios/new">Create portfolio</Link></div>}
      </section>
    </>
  );
}
