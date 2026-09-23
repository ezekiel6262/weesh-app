"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, parseEventLogs, parseUnits, type Address, type Hex } from "viem";
import { erc20Abi } from "@/lib/abi";
import { xlayer } from "@/lib/chain";
import {
  DROP_READY,
  SEND_STOCKS,
  WEESH_DROP,
  claimUrl,
  dropAbi,
  newSecret,
  parseRecipients,
  secretHash,
  zeroAddress,
  type Recipient,
} from "@/lib/drop";
import { approveIfNeeded, txUrl } from "@/lib/tx";
import { ConnectBar } from "./Connect";

type LinkRow = { label: string; href?: string; detail: string };

const LIST_KEY = "weesh-send-lists-v1";

export function SendDesk() {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient({ chainId: xlayer.id });
  const { writeContractAsync } = useWriteContract();
  const [name, setName] = useState("Class gift");
  const [stockId, setStockId] = useState(SEND_STOCKS[0].id);
  const [mode, setMode] = useState<"each" | "split">("each");
  const [amount, setAmount] = useState("1");
  const [lines, setLines] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [every, setEvery] = useState<7 | 30>(30);
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkRow[] | null>(null);

  const stock = SEND_STOCKS.find((s) => s.id === stockId) ?? SEND_STOCKS[0];
  const people = useMemo(() => parseRecipients(lines), [lines]);
  const onChain = isConnected && chainId === xlayer.id;
  const claims = people.filter((p) => !p.to).length;
  const repeatOk = repeat && claims === 0 && people.length > 0;

  async function send() {
    if (!address || !client || !DROP_READY) return;
    setBusy(true);
    setErr(null);
    setLinks(null);
    setTx(null);
    try {
      if (!name.trim() || name.trim().length > 64) throw new Error("Name the send in 64 characters or less");
      if (!people.length || people.length > 40) throw new Error("Add between 1 and 40 people");
      const each = sharesEach(amount, mode, people.length, stock.decimals);
      const total = each * BigInt(people.length);
      const secrets = people.map((p) => (p.to ? null : newSecret()));
      await approveIfNeeded(client, writeContractAsync as never, address, stock, WEESH_DROP, approvalNeed(each, people, repeat, every, days));

      if (repeatOk) {
        const until = BigInt(Math.floor(Date.now() / 1000) + days * 86400);
        const hash = await writeContractAsync({
          address: WEESH_DROP,
          abi: dropAbi,
          functionName: "startPlan",
          args: [stock.address, BigInt(every * 86400), until, each, people.map((p) => p.to as Address)],
        });
        const receipt = await client.waitForTransactionReceipt({ hash });
        const started = parseEventLogs({ abi: dropAbi, logs: receipt.logs, eventName: "PlanStarted" })[0];
        saveList({ name: name.trim(), stockId, mode, amount, lines, planId: started?.args.id?.toString() });
        setTx(hash);
        setLinks(people.map((p) => ({ label: p.label, detail: `${formatUnits(each, stock.decimals)} ${stock.symbol} each round` })));
        return;
      }

      const reclaimAfter = BigInt(Math.floor(Date.now() / 1000) + 14 * 86400);
      const hash = await writeContractAsync({
        address: WEESH_DROP,
        abi: dropAbi,
        functionName: "create",
        args: [
          stock.address,
          name.trim(),
          reclaimAfter,
          people.map((p) => p.to ?? zeroAddress()),
          people.map(() => each),
          secrets.map((s) => (s ? secretHash(s) : zeroHash())),
        ],
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      const created = parseEventLogs({ abi: dropAbi, logs: receipt.logs, eventName: "DropCreated" })[0];
      const dropId = created?.args.id?.toString() ?? "";
      const origin = window.location.origin;
      const rows = people.map((p, i) => {
        const secret = secrets[i];
        if (!secret) return { label: p.label, detail: `Paid ${formatUnits(each, stock.decimals)} ${stock.symbol}` };
        return {
          label: p.label,
          href: claimUrl(origin, dropId, i, secret),
          detail: `${formatUnits(each, stock.decimals)} ${stock.symbol} · claim link`,
        };
      });
      rememberClaims(dropId, name.trim(), rows);
      saveList({ name: name.trim(), stockId, mode, amount, lines });
      setTx(hash);
      setLinks(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The send did not go through");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1 className="display">Send a stock</h1>
      <p className="muted">
        Send {stock.name} you already hold to a list. Wallet addresses are paid now. A name or email gets a claim
        link, and unclaimed shares return to you after 14 days. Weesh does not mint a new stock and does not hold it.
      </p>
      {!DROP_READY ? <p className="err">The send contract is not on X Layer yet.</p> : null}
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
      <label>Stock</label>
      <select value={stockId} onChange={(e) => setStockId(e.target.value)}>
        {SEND_STOCKS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <label>{mode === "each" ? "Shares each" : "Shares to split"}</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      <div className="actions">
        <button className={mode === "each" ? "btn primary small" : "btn small"} type="button" onClick={() => setMode("each")}>
          Same amount each
        </button>
        <button className={mode === "split" ? "btn primary small" : "btn small"} type="button" onClick={() => setMode("split")}>
          Split a total
        </button>
      </div>
      <label>People, one per line</label>
      <textarea
        value={lines}
        onChange={(e) => setLines(e.target.value)}
        placeholder={"0xabc…\nada@school"}
      />
      <p className="muted">
        {people.length} people{claims ? ` · ${claims} claim link${claims === 1 ? "" : "s"}` : ""}. A line that is a
        wallet is paid directly.
      </p>
      <label className="check">
        <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> Repeat to wallets
      </label>
      {repeat ? (
        <div className="actions">
          <button className={every === 7 ? "btn primary small" : "btn small"} type="button" onClick={() => setEvery(7)}>
            Every 7 days
          </button>
          <button className={every === 30 ? "btn primary small" : "btn small"} type="button" onClick={() => setEvery(30)}>
            Every 30 days
          </button>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={30}>For 30 days</option>
            <option value={90}>For 90 days</option>
            <option value={180}>For 180 days</option>
          </select>
        </div>
      ) : null}
      {repeat && claims > 0 ? <p className="err">A repeating send needs wallet addresses. Claim links are one time.</p> : null}
      {repeat && claims === 0 ? (
        <p className="muted">
          Today goes out now. Later rounds stay approved until the end date. Come back and press Send the next round.
          Weesh does not pull the stock by itself.
        </p>
      ) : null}
      {!onChain ? (
        <ConnectBar />
      ) : (
        <button className="btn accent" disabled={busy || !DROP_READY || (repeat && !repeatOk)} onClick={send}>
          {busy ? "Sending" : repeat ? "Allow and send today" : "Send"}
        </button>
      )}
      {tx ? (
        <p className="muted">
          <a href={txUrl(tx)} target="_blank" rel="noreferrer">
            Transaction
          </a>
        </p>
      ) : null}
      {links ? (
        <ul className="send-links">
          {links.map((row) => (
            <li key={row.label + row.detail}>
              <strong>{row.label}</strong>
              <div className="muted">{row.detail}</div>
              {row.href ? (
                <a href={row.href} className="mono">
                  {row.href}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {err ? <p className="err">{err}</p> : null}
      <SavedLists
        onPick={(saved) => {
          setName(saved.name);
          setStockId(saved.stockId);
          setMode(saved.mode);
          setAmount(saved.amount);
          setLines(saved.lines);
        }}
      />
      <DueRound />
    </section>
  );
}

function sharesEach(amount: string, mode: "each" | "split", count: number, decimals: number) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a share amount");
  if (mode === "each") return parseUnits(amount.trim(), decimals);
  const total = parseUnits(amount.trim(), decimals);
  if (total < BigInt(count)) throw new Error("The total is smaller than one unit per person");
  return total / BigInt(count);
}

function approvalNeed(each: bigint, people: Recipient[], repeat: boolean, every: number, days: number) {
  if (!repeat) return each * BigInt(people.length);
  const rounds = BigInt(Math.floor(days / every) + 1);
  return each * BigInt(people.length) * rounds;
}

function zeroHash(): Hex {
  return "0x0000000000000000000000000000000000000000000000000000000000000000";
}

type Saved = { name: string; stockId: string; mode: "each" | "split"; amount: string; lines: string; planId?: string };

function saveList(row: Saved) {
  const prev = loadLists().filter((r) => r.name !== row.name);
  localStorage.setItem(LIST_KEY, JSON.stringify([row, ...prev].slice(0, 8)));
}

function loadLists(): Saved[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as Saved[]) : [];
  } catch {
    return [];
  }
}

function rememberClaims(dropId: string, name: string, rows: LinkRow[]) {
  if (!dropId) return;
  const key = `weesh-drop-${dropId}`;
  localStorage.setItem(key, JSON.stringify({ name, rows }));
}

function DueRound() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [plans, setPlans] = useState<Saved[]>([]);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setPlans(loadLists().filter((row) => row.planId));
  }, []);
  if (!plans.length || !DROP_READY) return null;
  return (
    <div>
      {plans.map((row) => (
        <DueButton
          key={row.planId}
          planId={BigInt(row.planId!)}
          label={row.name}
          sender={address}
          onRun={async () => {
            setNote(null);
            const hash = await writeContractAsync({
              address: WEESH_DROP,
              abi: dropAbi,
              functionName: "poke",
              args: [BigInt(row.planId!)],
            });
            setNote(hash);
          }}
        />
      ))}
      {note ? (
        <p className="muted">
          <a href={txUrl(note)} target="_blank" rel="noreferrer">
            Next round sent
          </a>
        </p>
      ) : null}
    </div>
  );
}

function DueButton({
  planId,
  label,
  sender,
  onRun,
}: {
  planId: bigint;
  label: string;
  sender?: Address;
  onRun: () => Promise<void>;
}) {
  const info = useReadContract({
    address: WEESH_DROP,
    abi: dropAbi,
    functionName: "planInfo",
    args: [planId],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nextAt = info.data?.[3];
  const active = info.data?.[7];
  const owner = info.data?.[0];
  const due = active && nextAt != null && BigInt(Math.floor(Date.now() / 1000)) >= nextAt;
  if (!due || (sender && owner && owner.toLowerCase() !== sender.toLowerCase())) return null;
  return (
    <div>
      <button
        className="btn small"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await onRun();
          } catch (e) {
            setErr(e instanceof Error ? e.message : "The next round did not send");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending" : `Send the next round · ${label}`}
      </button>
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}

function SavedLists({ onPick }: { onPick: (row: Saved) => void }) {
  const [rows, setRows] = useState<Saved[]>([]);
  useEffect(() => {
    setRows(loadLists());
  }, []);
  if (!rows.length) return null;
  return (
    <div>
      <p className="muted">Lists saved in this browser</p>
      <div className="actions">
        {rows.map((row) => (
          <button key={row.name} className="btn small" type="button" onClick={() => onPick(row)}>
            {row.name}
          </button>
        ))}
      </div>
    </div>
  );
}
