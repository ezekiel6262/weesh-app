"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { getPublicClient } from "wagmi/actions";
import { useAccount, useConfig, usePublicClient, useReadContract, useReadContracts, useSendTransaction, useWriteContract } from "wagmi";
import { ConnectBar } from "@/components/Connect";
import { Mark } from "@/components/Mark";
import { TxStatus } from "@/components/TxStatus";
import { erc20Abi } from "@/lib/abi";
import { QUOTE } from "@/lib/catalog";
import { xlayer } from "@/lib/chain";
import { executeRoutedSwap } from "@/lib/fill";
import { money, qty } from "@/lib/format";
import { PORTFOLIO_REGISTRY, assetFor, portfolioRegistryAbi, readPrivatePortfolios, shortCreator, type Portfolio, type PortfolioComment } from "@/lib/portfolio";
import { bumpBook } from "@/lib/tx";

function decode(id: string, raw: unknown, followers = 0): Portfolio | null {
  if (!raw) return null;
  const p = raw as { creator: `0x${string}`; createdAt: bigint; visibility: number; showHoldings: boolean; name: string; thesis: string; assets: readonly `0x${string}`[]; weights: readonly number[] };
  return { id, creator: p.creator, createdAt: Number(p.createdAt), visibility: p.visibility === 0 ? "public" : "unlisted", showHoldings: p.showHoldings, name: p.name, thesis: p.thesis, assets: [...p.assets], weights: p.weights.map(Number), followers };
}

export function PortfolioDetail({ id }: { id: string }) {
  const local = id.startsWith("local-");
  const numericId = local ? 0n : BigInt(id || 0);
  const [privatePortfolio, setPrivatePortfolio] = useState<Portfolio | null>(null);
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { data: raw, refetch } = useReadContract({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "portfolio", args: [numericId], query: { enabled: !local && numericId > 0n } });
  const { data: followers, refetch: refetchFollowers } = useReadContract({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "followerCount", args: [numericId], query: { enabled: !local && numericId > 0n } });
  const { data: following, refetch: refetchFollowing } = useReadContract({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "following", args: [numericId, address!], query: { enabled: !local && Boolean(address) } });
  const portfolio = local ? privatePortfolio : decode(id, raw, Number(followers ?? 0n));
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (local) setPrivatePortfolio(readPrivatePortfolios().find((p) => p.id === id) ?? null); }, [id, local]);

  async function toggleFollow() {
    if (!client || local) return;
    const hash = await writeContractAsync({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: following ? "unfollow" : "follow", args: [numericId] });
    await client.waitForTransactionReceipt({ hash });
    await Promise.all([refetch(), refetchFollowing(), refetchFollowers()]);
  }
  async function share() { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1400); }

  if (!portfolio) return <section className="hero"><p className="kicker">Portfolio</p><h1>{local ? "Private portfolio not found on this device." : "Reading strategy from X Layer…"}</h1><Link className="btn ghost" href="/portfolios">Browse portfolios</Link></section>;

  return <>
    <section className="portfolio-detail-head"><div><div className="actions"><span className="pill">{portfolio.visibility}</span><span className="muted">Created {new Date(portfolio.createdAt * 1000).toLocaleDateString()}</span></div><h1>{portfolio.name}</h1><p className="lede">{portfolio.thesis}</p><p className="muted">By <a href={`https://www.oklink.com/x-layer/address/${portfolio.creator}`} target="_blank" rel="noreferrer">{shortCreator(portfolio.creator)} ↗</a></p></div><div className="portfolio-actions"><button className="btn ghost" onClick={() => void share()}>{copied ? "Link copied" : "Share"}</button>{!local && isConnected ? <button className="btn ghost" disabled={isPending} onClick={() => void toggleFollow()}>{following ? "Following ✓" : "Follow"}</button> : null}<Link className="btn ghost" href={`/portfolios/new?fork=${id}`}>Fork</Link></div></section>
    <div className="portfolio-detail-grid"><section><div className="card"><div className="section-head"><h2>Target allocation</h2><span>{portfolio.followers ?? 0} followers</span></div><div className="allocation-list">{portfolio.assets.map((address, i) => { const asset = assetFor(address); return asset ? <div key={address}><Mark asset={asset} size={38} /><span><strong>{asset.name}</strong><small>{asset.symbol} · X Layer</small></span><strong>{portfolio.weights[i] / 100}%</strong><span className="allocation-bar"><i style={{ width: `${portfolio.weights[i] / 100}%`, background: asset.tint }} /></span></div> : null; })}</div></div>{portfolio.showHoldings ? <HoldingsProof portfolio={portfolio} /> : <div className="card" style={{ marginTop: 16 }}><p className="muted">The creator chose not to publish live holding balances.</p></div>} {!local ? <Discussion id={numericId} /> : null}</section><aside><Replicate portfolio={portfolio} /></aside></div>
  </>;
}

function HoldingsProof({ portfolio }: { portfolio: Portfolio }) {
  const contracts = portfolio.assets.map((address) => ({ address, abi: erc20Abi, functionName: "balanceOf" as const, args: [portfolio.creator] as const }));
  const { data, isLoading } = useReadContracts({ contracts });
  return <div className="card holdings-proof" style={{ marginTop: 16 }}><p className="kicker">Onchain proof</p><h2>Creator holdings</h2><p className="muted">Read directly from {shortCreator(portfolio.creator)} on X Layer—not self-reported.</p>{isLoading ? <p>Reading balances…</p> : portfolio.assets.map((address, i) => { const asset = assetFor(address); const balance = data?.[i]?.result as bigint | undefined; return asset ? <div className="kv" key={address}><span>{asset.symbol}</span><strong>{qty(balance ?? 0n, asset.decimals)}</strong></div> : null; })}</div>;
}

function Discussion({ id }: { id: bigint }) {
  const { isConnected } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [body, setBody] = useState("");
  const { data: count, refetch: refetchCount } = useReadContract({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "commentCount", args: [id] });
  const indexes = useMemo(() => Array.from({ length: Number(count ?? 0n) }, (_, i) => BigInt(i)), [count]);
  const { data, refetch } = useReadContracts({ contracts: indexes.map((index) => ({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "commentAt" as const, args: [id, index] as const })) });
  const comments = data?.flatMap((row) => row.status === "success" ? [row.result as { author: `0x${string}`; createdAt: bigint; body: string }] : []) ?? [];
  async function post() { if (!client || !body.trim()) return; const hash = await writeContractAsync({ address: PORTFOLIO_REGISTRY, abi: portfolioRegistryAbi, functionName: "comment", args: [id, body.trim()] }); await client.waitForTransactionReceipt({ hash }); setBody(""); await Promise.all([refetchCount(), refetch()]); }
  return <section className="card discussion" style={{ marginTop: 16 }}><div className="section-head"><h2>Discussion</h2><span>{comments.length}</span></div>{comments.length ? comments.map((c, i) => { const item: PortfolioComment = { author: c.author, createdAt: Number(c.createdAt), body: c.body }; return <article key={i}><strong>{shortCreator(item.author)}</strong><small>{new Date(item.createdAt * 1000).toLocaleDateString()}</small><p>{item.body}</p></article>; }) : <p className="muted">No comments yet. Add the first onchain note.</p>}{isConnected ? <><textarea maxLength={280} rows={3} placeholder="Add your view on this portfolio…" value={body} onChange={(e) => setBody(e.target.value)} /><div className="actions"><button className="btn primary" disabled={isPending || !body.trim()} onClick={() => void post()}>{isPending ? "Confirm…" : "Post on X Layer"}</button></div></> : <ConnectBar />}</section>;
}

function Replicate({ portfolio }: { portfolio: Portfolio }) {
  const { address, isConnected, chainId } = useAccount();
  const config = useConfig();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const [amount, setAmount] = useState("100");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const spend = Number(amount) || 0;
  const legs = portfolio.assets.map((address, i) => ({ asset: assetFor(address), weight: portfolio.weights[i] / 100 })).filter((leg) => leg.asset);
  async function replicate() {
    if (!address || !client || spend <= 0) return;
    setRunning(true); setErr(null); setHash(null); setProgress(0);
    try {
      const rpc = getPublicClient(config, { chainId: xlayer.id });
      if (!rpc) throw new Error("X Layer connection unavailable");
      const trades = legs.filter((leg) => leg.asset!.address !== QUOTE.address && leg.asset!.tradable);
      for (let i = 0; i < trades.length; i++) {
        const leg = trades[i];
        const amountIn = parseUnits(((spend * leg.weight) / 100).toFixed(6), QUOTE.decimals);
        const result = await executeRoutedSwap({ client: rpc, address, write: writeContractAsync as never, send: sendTransactionAsync, pay: QUOTE, get: leg.asset!, amountIn, slipPct: 0.5 });
        setHash(result.hash); setProgress(i + 1);
      }
      bumpBook();
    } catch (e) { setErr(e instanceof Error ? e.message : "Replication stopped"); } finally { setRunning(false); }
  }
  return <div className="card replicate-card"><p className="kicker">Replicate</p><h2>Build this in your wallet</h2><p className="muted">One guided flow. Each routed trade remains visible and requires your wallet approval.</p><label>Invest (USDG)</label><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /><div className="replicate-legs">{legs.map((leg) => <p key={leg.asset!.id}><span>{leg.asset!.symbol} · {leg.weight}%</span><strong>{money((spend * leg.weight) / 100)}</strong></p>)}</div><p className="hint">0.05% Weesh fee per swap. Uniswap first, OKX DEX fallback. Any USDG allocation stays in your wallet.</p>{!isConnected || chainId !== xlayer.id ? <ConnectBar /> : <button className="btn primary wide" disabled={running || spend <= 0} onClick={() => void replicate()}>{running ? `Signing trade ${progress + 1}…` : "Replicate portfolio"}</button>}{progress > 0 ? <p className="ok">Completed {progress} routed trade{progress === 1 ? "" : "s"}.</p> : null}<TxStatus err={err} hash={hash} /></div>;
}
