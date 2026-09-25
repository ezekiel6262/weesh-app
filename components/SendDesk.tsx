"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { parseEventLogs, parseUnits, type Address, type Hex } from "viem";
import { erc20Abi } from "@/lib/abi";
import { xlayer } from "@/lib/chain";
import { friendlyError } from "@/lib/errors";
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
} from "@/lib/drop";
import { qty } from "@/lib/format";
import { approveIfNeeded, txUrl } from "@/lib/tx";
import { ConnectBar } from "./Connect";

type LinkRow = { label: string; href?: string; detail: string; kind: "wallet" | "claim" };

const LIST_KEY = "weesh-send-lists-v1";

export function SendDesk() {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient({ chainId: xlayer.id });
  const { writeContractAsync } = useWriteContract();
  const [name, setName] = useState("");
  const [stockId, setStockId] = useState(SEND_STOCKS[0].id);
  const [mode, setMode] = useState<"each" | "split">("each");
  const [amount, setAmount] = useState("");
  const [lines, setLines] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [every, setEvery] = useState<7 | 30>(30);
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const stock = SEND_STOCKS.find((s) => s.id === stockId) ?? SEND_STOCKS[0];
  const people = useMemo(() => parseRecipients(lines), [lines]);
  const onChain = isConnected && chainId === xlayer.id;
  const claims = people.filter((p) => !p.to).length;
  const repeatBlocked = repeat && claims > 0;
  const preview = useMemo(
    () => previewSend(amount, mode, people.length, stock.decimals, repeat, every, days),
    [amount, mode, people.length, stock.decimals, repeat, every, days],
  );

  const balance = useReadContract({
    address: stock.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && onChain) },
  });
  const held = balance.data;
  const short = preview.total != null && held != null && held < preview.need;

  async function send() {
    if (!address || !client || !DROP_READY || !preview.each) return;
    setBusy(true);
    setErr(null);
    setLinks(null);
    setTx(null);
    try {
      if (!name.trim() || name.trim().length > 64) throw new Error("Name this send");
      if (!people.length || people.length > 40) throw new Error("Add between 1 and 40 people");
      if (repeatBlocked) throw new Error("A repeating send needs wallet addresses");
      const each = preview.each;
      const secrets = people.map((p) => (p.to ? null : newSecret()));
      await approveIfNeeded(client, writeContractAsync as never, address, stock, WEESH_DROP, preview.need);

      if (repeat && !repeatBlocked) {
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
        setLinks(
          people.map((p) => ({
            label: p.label,
            kind: "wallet",
            detail: `${qty(each, stock.decimals)} ${stock.symbol} today, then every ${every} days`,
          })),
        );
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
      const rows: LinkRow[] = people.map((p, i) => {
        const secret = secrets[i];
        if (!secret) {
          return { label: p.label, kind: "wallet", detail: `Paid ${qty(each, stock.decimals)} ${stock.symbol}` };
        }
        return {
          label: p.label,
          kind: "claim",
          href: claimUrl(origin, dropId, i, secret),
          detail: `${qty(each, stock.decimals)} ${stock.symbol} waiting on a link`,
        };
      });
      rememberClaims(dropId, name.trim(), rows);
      saveList({ name: name.trim(), stockId, mode, amount, lines });
      setTx(hash);
      setLinks(rows);
    } catch (e) {
      setErr(friendlyError(e, { action: "send", asset: stock.symbol }));
    } finally {
      setBusy(false);
    }
  }

  const canSend = Boolean(name.trim() && people.length && preview.each && !repeatBlocked && !short && DROP_READY);
  const sendLabel = !preview.each
    ? "Enter an amount"
    : repeat
      ? `Send today, then every ${every} days`
      : claims
        ? `Send and make ${claims} link${claims === 1 ? "" : "s"}`
        : `Send to ${people.length}`;

  return (
    <>
      <section className="hero">
        <p className="kicker">Stock gifts</p>
        <h1>{name.trim() || "Send shares, not cash."}</h1>
        <p className="lede">
          Choose a stock you hold and who gets it. Wallets receive shares immediately; everyone else gets a private
          claim link. Unclaimed gifts return after 14 days.
        </p>
        <ol className="flow-steps" aria-label="How stock gifts work">
          <li><span>1</span>Choose shares</li>
          <li><span>2</span>Add people</li>
          <li><span>3</span>Sign once</li>
        </ol>
      </section>

      {links ? (
        <section className="card accent-edge send-result">
          <p className="kicker">Sent</p>
          <h2>{name.trim()}</h2>
          <p className="muted">
            {claims ? "Copy each claim link now. It is the only key to those shares." : "Everyone with a wallet was paid."}
          </p>
          <ul className="send-links">
            {links.map((row) => (
              <li key={row.label + row.detail}>
                <div className="send-person">
                  <strong>{row.label}</strong>
                  <span className={row.kind === "claim" ? "tag" : "tag wallet"}>{row.kind === "claim" ? "Link" : "Paid"}</span>
                </div>
                <div className="muted">{row.detail}</div>
                {row.href ? (
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(row.href!);
                      setCopied(row.href!);
                    }}
                  >
                    {copied === row.href ? "Copied" : "Copy link"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {tx ? (
            <p className="muted">
              <a href={txUrl(tx)} target="_blank" rel="noreferrer">
                View the transaction
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid">
        <section className="card">
          {!DROP_READY ? <p className="err">The send contract is not on X Layer yet.</p> : null}
          <label>Name this send</label>
          <input value={name} placeholder="Ada's class" onChange={(e) => setName(e.target.value)} maxLength={64} />
          <label>Stock</label>
          <select value={stockId} onChange={(e) => setStockId(e.target.value)}>
            {SEND_STOCKS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label>{mode === "each" ? "Shares for each person" : "Total shares to split"}</label>
          <input value={amount} placeholder="1" onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <div className="seg">
            <button type="button" className={mode === "each" ? "on" : ""} onClick={() => setMode("each")}>
              Same each
            </button>
            <button type="button" className={mode === "split" ? "on" : ""} onClick={() => setMode("split")}>
              Split a total
            </button>
          </div>
          <label>People, one per line</label>
          <textarea
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            placeholder={"0xabc…  wallet, paid now\nada@school  claim link"}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
            />
            Repeat this to wallets
          </label>
          {repeat ? (
            <>
              <div className="seg">
                <button type="button" className={every === 7 ? "on" : ""} onClick={() => setEvery(7)}>
                  Every 7 days
                </button>
                <button type="button" className={every === 30 ? "on" : ""} onClick={() => setEvery(30)}>
                  Every 30 days
                </button>
              </div>
              <label>Keep going</label>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
              </select>
              <p className="muted">
                {repeatBlocked
                  ? "Take the names off the list, or turn repeat off. A link can only be claimed once."
                  : `Today goes out now. Later rounds stay approved. Open Send again and press Send the next round.`}
              </p>
            </>
          ) : null}
          {!onChain ? (
            <div className="actions">
              <ConnectBar />
            </div>
          ) : (
            <div className="actions">
              <button className="btn accent" disabled={busy || !canSend} onClick={send}>
                {busy ? "Waiting for your signature" : sendLabel}
              </button>
            </div>
          )}
          {err ? <p className="err">{err}</p> : null}
          <SavedLists
            onPick={(saved) => {
              setName(saved.name);
              setStockId(saved.stockId);
              setMode(saved.mode);
              setAmount(saved.amount);
              setLines(saved.lines);
              setLinks(null);
            }}
          />
          <DueRound />
        </section>

        <aside className="card">
          <p className="kicker">Before you sign</p>
          <h2>{people.length ? `${people.length} ${people.length === 1 ? "person" : "people"}` : "No one yet"}</h2>
          {held != null ? (
            <p className="kv">
              <span>You hold</span>
              <strong>
                {qty(held, stock.decimals)} {stock.symbol}
              </strong>
            </p>
          ) : null}
          {preview.each ? (
            <>
              <p className="kv">
                <span>Each person</span>
                <strong>
                  {qty(preview.each, stock.decimals)} {stock.symbol}
                </strong>
              </p>
              <p className="kv">
                <span>{repeat ? `Approval, ${preview.rounds} rounds` : "Leaves your wallet"}</span>
                <strong>
                  {qty(preview.need, stock.decimals)} {stock.symbol}
                </strong>
              </p>
              {preview.dust ? <p className="muted">A split leaves a remainder in your wallet. Each person gets a whole unit.</p> : null}
            </>
          ) : (
            <p className="muted">{amount.trim() ? preview.error : "Enter how many shares, then the people."}</p>
          )}
          {short ? <p className="err">This is more {stock.symbol} than the connected wallet holds.</p> : null}
          <ul className="send-links">
            {people.map((person) => (
              <li key={person.label + (person.to ?? "claim")}>
                <div className="send-person">
                  <strong>{person.label}</strong>
                  <span className={person.to ? "tag wallet" : "tag"}>{person.to ? "Wallet" : "Link"}</span>
                </div>
                <div className="muted">
                  {preview.each ? `${qty(preview.each, stock.decimals)} ${stock.symbol}` : "Amount not set"}
                  {person.to ? "" : " · they claim into their own wallet"}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

function previewSend(
  amount: string,
  mode: "each" | "split",
  count: number,
  decimals: number,
  repeat: boolean,
  every: number,
  days: number,
) {
  if (!amount.trim() || count < 1) return { each: null as bigint | null, total: null as bigint | null, need: BigInt(0), rounds: 1, dust: false, error: null as string | null };
  try {
    const each = sharesEach(amount, mode, count, decimals);
    const total = each * BigInt(count);
    const rounds = repeat ? Math.floor(days / every) + 1 : 1;
    const entered = parseUnits(amount.trim(), decimals);
    const dust = mode === "split" && entered > total;
    return { each, total, need: total * BigInt(rounds), rounds, dust, error: null };
  } catch (e) {
    return { each: null, total: null, need: BigInt(0), rounds: 1, dust: false, error: e instanceof Error ? e.message : "Enter a share amount" };
  }
}

function sharesEach(amount: string, mode: "each" | "split", count: number, decimals: number) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a share amount");
  if (mode === "each") return parseUnits(amount.trim(), decimals);
  const total = parseUnits(amount.trim(), decimals);
  if (total < BigInt(count)) throw new Error("That total is smaller than one unit per person");
  return total / BigInt(count);
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
  localStorage.setItem(`weesh-drop-${dropId}`, JSON.stringify({ name, rows }));
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
    <div className="actions">
      <button
        className="btn"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await onRun();
          } catch (e) {
            setErr(friendlyError(e, { action: "scheduled send" }));
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
      <p className="section-title">Saved in this browser</p>
      <div className="chips">
        {rows.map((row) => (
          <button key={row.name} className="chip" type="button" onClick={() => onPick(row)}>
            {row.name}
          </button>
        ))}
      </div>
    </div>
  );
}
