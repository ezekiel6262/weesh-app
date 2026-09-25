"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, usePublicClient, useSendTransaction, useWriteContract } from "wagmi";
import { Gate } from "@/components/Connect";
import { Mark } from "@/components/Mark";
import { TxStatus } from "@/components/TxStatus";
import { aaveDataAbi, aavePoolAbi, erc4626Abi, npmAbi } from "@/lib/abi";
import {
  AAVE,
  QUOTE,
  SLIPPAGE_BPS,
  SPARK,
  STOCKS,
  UNISWAP,
  USDT0,
  USDG,
  USDC,
} from "@/lib/catalog";
import { coverGas } from "@/lib/gas";
import { friendlyError } from "@/lib/errors";
import { parseAmount, pct, poolFeePct, qty, toUnits } from "@/lib/format";
import {
  bestPool,
  deadline,
  fullRangeTicks,
  listPositions,
  listedStockPools,
  MAX_UINT128,
  pairAmounts,
  poolHumanPrice,
  type LpPosition,
  type PoolInfo,
} from "@/lib/lp";
import { approveIfNeeded, bumpBook } from "@/lib/tx";
import { prepareStable } from "@/lib/stables";
import { useBook } from "@/lib/useBook";

export default function EarnPage() {
  return (
    <Gate>
      <Earn />
    </Gate>
  );
}

function Earn() {
  return (
    <>
      <p className="kicker">Earn</p>
      <h2>Put cash to work</h2>
      <p className="muted">
        Same wallet. Aave, Spark, and Uniswap hold the position — Weesh only builds the transaction.
        Tokenized stocks are not Aave collateral on X Layer yet.
      </p>
      <div className="grid" style={{ marginTop: 28 }}>
        <SparkCard />
        <AaveCard />
      </div>
      <div style={{ marginTop: 28 }}>
        <LpCard />
      </div>
    </>
  );
}

function SparkCard() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTransactionAsync, isPending: sending } = useSendTransaction();
  const { lines } = useBook();
  const [amt, setAmt] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "approve" | "sign">("idle");
  const [preparing, setPreparing] = useState("");
  const cash = lines.find((l) => l.asset.id === "USDT0");
  const parsed = parseAmount(amt, USDT0);
  const walletBalance = cash?.wallet ?? BigInt(0);
  const stableBalances = {
    [USDG.id]: lines.find((l) => l.asset.id === USDG.id)?.wallet ?? BigInt(0),
    [USDT0.id]: walletBalance,
    [USDC.id]: lines.find((l) => l.asset.id === USDC.id)?.wallet ?? BigInt(0),
  };
  const availableDollars = stableBalances[USDG.id] + stableBalances[USDT0.id] + stableBalances[USDC.id];
  const parkedBalance = cash?.spark ?? BigInt(0);
  const cannotPark = Boolean(parsed && parsed > availableDollars);
  const cannotUnpark = Boolean(parsed && parsed > parkedBalance);

  async function park() {
    if (!address || !client || !parsed) return;
    if (parsed > availableDollars) {
      setErr(`Not enough digital dollars for this deposit. You currently have ${qty(availableDollars, 6)} across USDG, USDT, and USDC.`);
      return;
    }
    setErr(null);
    setTx(null);
    try {
      if (walletBalance < parsed) {
        await prepareStable({
          client,
          address,
          write: writeContractAsync as never,
          send: sendTransactionAsync,
          target: USDT0,
          amount: parsed,
          balances: stableBalances,
          onStep: setPreparing,
        });
        bumpBook();
      }
      setPreparing("");
      await coverGas(client, address);
      setStep("approve");
      await approveIfNeeded(client, writeContractAsync as never, address, USDT0, SPARK.vault, parsed);
      setStep("sign");
      const hash = await writeContractAsync({
        address: SPARK.vault,
        abi: erc4626Abi,
        functionName: "deposit",
        args: [parsed, address],
      });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setPreparing("");
      setErr(friendlyError(e, { action: "deposit", asset: "digital dollars", available: qty(availableDollars, 6) }));
    }
  }

  async function unpark() {
    if (!address || !client || !parsed) return;
    if (parsed > parkedBalance) {
      setErr(`You only have ${qty(parkedBalance, 6)} USDT parked in Spark.`);
      return;
    }
    setErr(null);
    try {
      await coverGas(client, address);
      setStep("sign");
      const hash = await writeContractAsync({
        address: SPARK.vault,
        abi: erc4626Abi,
        functionName: "withdraw",
        args: [parsed, address, address],
      });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(friendlyError(e, { action: "withdrawal", asset: "parked USDT", available: qty(parkedBalance, 6) }));
    }
  }

  return (
    <div className="card" id="spark">
      <p className="kicker">Spark</p>
      <h2>Park cash</h2>
      <p className="muted">Spark Savings on X Layer. Deposit is USDT. You keep the vault shares.</p>
      <p className="muted">
        Available dollars {qty(availableDollars, 6)} · USDT parked {qty(cash?.spark ?? BigInt(0), 6)}
      </p>
      <label>Amount (USDT)</label>
      <div className="amount">
        <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="0" />
        <button
          className="btn ghost small"
          onClick={() => setAmt(formatUnits(availableDollars, 6))}
        >
          Max
        </button>
      </div>
      <div className="kv">
        <span>Gas</span>
        <span>covered</span>
      </div>
      <div className="actions">
        <button className="btn primary" disabled={!parsed || isPending || sending || cannotPark} onClick={park}>
          Park
        </button>
        <button className="btn" disabled={!parsed || isPending || cannotUnpark} onClick={unpark}>
          Unpark
        </button>
      </div>
      {cannotPark ? <p className="blocked">You need {qty(parsed ?? 0n, 6)} digital dollars, but this wallet has {qty(availableDollars, 6)}.</p> : null}
      {cannotUnpark ? <p className="blocked">Only {qty(parkedBalance, 6)} USDT is currently parked.</p> : null}
      {preparing ? <p className="muted" role="status">{preparing}</p> : null}
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}

function AaveCard() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { lines } = useBook();
  const [assetId, setAssetId] = useState("USDG");
  const [amt, setAmt] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "approve" | "sign">("idle");
  const [supplyApr, setSupplyApr] = useState<number | null>(null);
  const [borrowApr, setBorrowApr] = useState<number | null>(null);

  const listed = [USDG, USDT0].filter((a) => a.aave);
  const asset = listed.find((a) => a.id === assetId) ?? listed[0];
  const line = lines.find((l) => l.asset.id === asset.id);
  const parsed = parseAmount(amt, asset);

  useEffect(() => {
    if (!client) return;
    let dead = false;
    (async () => {
      try {
        const data = (await client.readContract({
          address: AAVE.dataProvider,
          abi: aaveDataAbi,
          functionName: "getReserveData",
          args: [asset.address],
        })) as readonly bigint[];
        if (dead) return;
        setSupplyApr(Number(data[5]) / 1e25);
        setBorrowApr(Number(data[6]) / 1e25);
      } catch {
        if (!dead) {
          setSupplyApr(null);
          setBorrowApr(null);
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [client, asset.address]);

  async function go(kind: "supply" | "withdraw" | "borrow" | "repay") {
    if (!address || !client || !parsed || !asset.aave) return;
    const available = kind === "withdraw" ? (line?.aave ?? 0n) : (line?.wallet ?? 0n);
    if ((kind === "supply" || kind === "repay" || kind === "withdraw") && parsed > available) {
      setErr(`Not enough ${asset.symbol}. Available: ${qty(available, asset.decimals)} ${asset.symbol}.`);
      return;
    }
    setErr(null);
    setTx(null);
    try {
      await coverGas(client, address);
      if (kind === "supply" || kind === "repay") {
        setStep("approve");
        await approveIfNeeded(client, writeContractAsync as never, address, asset, AAVE.pool, parsed);
      }
      setStep("sign");
      const hash =
        kind === "supply"
          ? await writeContractAsync({
              address: AAVE.pool,
              abi: aavePoolAbi,
              functionName: "supply",
              args: [asset.address, parsed, address, 0],
            })
          : kind === "withdraw"
            ? await writeContractAsync({
                address: AAVE.pool,
                abi: aavePoolAbi,
                functionName: "withdraw",
                args: [asset.address, parsed, address],
              })
            : kind === "borrow"
              ? await writeContractAsync({
                  address: AAVE.pool,
                  abi: aavePoolAbi,
                  functionName: "borrow",
                  args: [asset.address, parsed, BigInt(2), 0, address],
                })
              : await writeContractAsync({
                  address: AAVE.pool,
                  abi: aavePoolAbi,
                  functionName: "repay",
                  args: [asset.address, parsed, BigInt(2), address],
                });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(friendlyError(e, { action: kind, asset: asset.symbol, available: qty(available, asset.decimals) }));
    }
  }

  return (
    <div className="card" id="aave">
      <p className="kicker">Aave</p>
      <h2>Lend and borrow</h2>
      <p className="muted">Aave V3 on X Layer. Listed stables only.</p>
      <label>Asset</label>
      <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
        {listed.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <p className="muted">
        Wallet {qty(line?.wallet ?? BigInt(0), asset.decimals)} · Lent{" "}
        {qty(line?.aave ?? BigInt(0), asset.decimals)}
        {line?.debt ? ` · Borrowed ${qty(line.debt, asset.decimals)}` : ""}
      </p>
      {supplyApr !== null ? (
        <div className="kv">
          <span>Supply rate</span>
          <span>{pct(supplyApr)}</span>
        </div>
      ) : null}
      {borrowApr !== null ? (
        <div className="kv">
          <span>Borrow rate</span>
          <span>{pct(borrowApr)}</span>
        </div>
      ) : null}
      <p className="blocked">Stocks cannot be used as collateral here yet.</p>
      <label>Amount</label>
      <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="0" />
      <div className="kv">
        <span>Gas</span>
        <span>covered</span>
      </div>
      <div className="actions">
        <button className="btn primary" disabled={!parsed || isPending} onClick={() => go("supply")}>
          Lend
        </button>
        <button className="btn" disabled={!parsed || isPending} onClick={() => go("withdraw")}>
          Withdraw
        </button>
        <button className="btn" disabled={!parsed || isPending} onClick={() => go("borrow")}>
          Borrow
        </button>
        <button className="btn" disabled={!parsed || isPending} onClick={() => go("repay")}>
          Repay
        </button>
      </div>
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}

function LpCard() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { lines } = useBook();
  const [stockId, setStockId] = useState(STOCKS[0].id);
  const [amt, setAmt] = useState("");
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [price, setPrice] = useState(0);
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [listed, setListed] = useState<PoolInfo[]>([]);
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "approve" | "sign">("idle");
  const [loading, setLoading] = useState(true);

  const stock = STOCKS.find((s) => s.id === stockId) ?? STOCKS[0];
  const quoteHuman = Number(amt) || 0;

  useEffect(() => {
    if (!client) return;
    let dead = false;
    (async () => {
      setLoading(true);
      const pairs = await listedStockPools(client);
      if (dead) return;
      setListed(pairs);
      const first = pairs[0];
      if (first) setStockId(first.tokenA.id === QUOTE.id ? first.tokenB.id : first.tokenA.id);
      setLoading(false);
    })();
    return () => {
      dead = true;
    };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let dead = false;
    (async () => {
      const info = await bestPool(client, QUOTE, stock);
      if (dead) return;
      setPool(info);
      if (info) setPrice(await poolHumanPrice(client, info));
      else setPrice(0);
    })();
    return () => {
      dead = true;
    };
  }, [client, stock]);

  useEffect(() => {
    if (!client || !address) return;
    let dead = false;
    (async () => {
      const pos = await listPositions(client, address);
      if (!dead) setPositions(pos);
    })();
    return () => {
      dead = true;
    };
  }, [client, address, tx]);

  const sized = useMemo(() => {
    if (!pool || !price || !quoteHuman) return null;
    return pairAmounts(pool, quoteHuman, price);
  }, [pool, price, quoteHuman]);

  async function add() {
    if (!address || !client || !pool || !sized) return;
    setErr(null);
    setTx(null);
    try {
      await coverGas(client, address);
      const amount0 = toUnits(sized.amount0, pool.token0.decimals);
      const amount1 = toUnits(sized.amount1, pool.token1.decimals);
      const min0 = (amount0 * BigInt(10_000 - SLIPPAGE_BPS * 2)) / BigInt(10_000);
      const min1 = (amount1 * BigInt(10_000 - SLIPPAGE_BPS * 2)) / BigInt(10_000);
      setStep("approve");
      await approveIfNeeded(client, writeContractAsync as never, address, pool.token0, UNISWAP.npm, amount0);
      await approveIfNeeded(client, writeContractAsync as never, address, pool.token1, UNISWAP.npm, amount1);
      const { tickLower, tickUpper } = fullRangeTicks(pool.fee);
      setStep("sign");
      const hash = await writeContractAsync({
        address: UNISWAP.npm,
        abi: npmAbi,
        functionName: "mint",
        args: [
          {
            token0: pool.token0.address,
            token1: pool.token1.address,
            fee: pool.fee,
            tickLower,
            tickUpper,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: min0,
            amount1Min: min1,
            recipient: address,
            deadline: deadline(),
          },
        ],
      });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(friendlyError(e, { action: "liquidity deposit" }));
    }
  }

  async function remove(pos: LpPosition) {
    if (!address || !client) return;
    setErr(null);
    try {
      await coverGas(client, address);
      setStep("sign");
      const dec = await writeContractAsync({
        address: UNISWAP.npm,
        abi: npmAbi,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId: pos.tokenId,
            liquidity: pos.liquidity,
            amount0Min: BigInt(0),
            amount1Min: BigInt(0),
            deadline: deadline(),
          },
        ],
      });
      await client.waitForTransactionReceipt({ hash: dec });
      const hash = await writeContractAsync({
        address: UNISWAP.npm,
        abi: npmAbi,
        functionName: "collect",
        args: [
          {
            tokenId: pos.tokenId,
            recipient: address,
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128,
          },
        ],
      });
      await client.waitForTransactionReceipt({ hash });
      setTx(hash);
      setStep("idle");
      bumpBook();
    } catch (e) {
      setStep("idle");
      setErr(friendlyError(e, { action: "liquidity withdrawal" }));
    }
  }

  const stable = pool ? (pool.token0.kind === "stable" ? pool.token0 : pool.token1) : QUOTE;
  const usdBal = lines.find((l) => l.asset.id === stable.id)?.wallet ?? BigInt(0);
  const stockBal = lines.find((l) => l.asset.id === stock.id)?.wallet ?? BigInt(0);

  return (
    <div className="card" id="lp">
      <p className="kicker">Uniswap</p>
      <h2>Provide liquidity</h2>
      <p className="muted">
        Earn the pool fee on a stock / dollar pair. You keep the position NFT. Full-range, so both
        sides stay in the market.
      </p>
      <label>Pair</label>
      <div className="chips">
        {STOCKS.map((s) => {
          const live = listed.some((p) => p.tokenA.id === s.id || p.tokenB.id === s.id);
          return (
            <button
              key={s.id}
              className={stockId === s.id ? "chip on" : "chip"}
              style={live ? undefined : { opacity: 0.55 }}
              onClick={() => setStockId(s.id)}
            >
              <Mark asset={s} size={22} />
              {s.symbol}
            </button>
          );
        })}
      </div>
      {loading ? <p className="muted">Finding pools…</p> : null}
      {!loading && !pool ? (
        <p className="blocked">No Uniswap pool for {stock.name} / dollars yet.</p>
      ) : null}
      {pool ? (
        <>
          <label>Dollars to add ({stable.symbol})</label>
          <div className="amount">
            <input
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
            <button className="btn ghost small" onClick={() => setAmt(formatUnits(usdBal, stable.decimals))}>
              Max
            </button>
          </div>
          {sized ? (
            <div className="card accent-edge" style={{ marginTop: 12 }}>
              <div className="kv">
                <span>You also add</span>
                <strong>
                  {pool.token0.kind !== "stable"
                    ? `${sized.amount0.toPrecision(5)} ${pool.token0.symbol}`
                    : `${sized.amount1.toPrecision(5)} ${pool.token1.symbol}`}
                </strong>
              </div>
              <div className="kv">
                <span>Pool fee</span>
                <span>{poolFeePct(pool.fee)}</span>
              </div>
              <div className="kv">
                <span>Gas</span>
                <span>covered</span>
              </div>
              <div className="kv">
                <span>Wallet</span>
                <span>
                  {qty(usdBal, stable.decimals)} {stable.symbol} · {qty(stockBal, stock.decimals)}{" "}
                  {stock.symbol}
                </span>
              </div>
            </div>
          ) : null}
          <div className="actions">
            <button className="btn primary" disabled={!sized || isPending} onClick={add}>
              Add liquidity
            </button>
          </div>
        </>
      ) : null}

      {positions.length ? <p className="section-title">Your positions</p> : null}
      <div className="rows">
        {positions.map((p) => (
          <div key={p.tokenId.toString()} className="holding">
            <Mark asset={p.token0.kind === "stable" ? p.token1 : p.token0} />
            <div>
              <div className="name">
                {p.token0.symbol} / {p.token1.symbol}
              </div>
              <div className="sym">
                {poolFeePct(p.fee)} · #{p.tokenId.toString()}
              </div>
            </div>
            <div />
            <button className="btn small" disabled={isPending} onClick={() => remove(p)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <TxStatus err={err} hash={tx} step={step} />
    </div>
  );
}
