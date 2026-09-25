import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createPublicClient, createWalletClient, isAddress, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xlayer, xlayerTransport } from "@/lib/chain";

const STIPEND = parseEther("0.002");
const MIN = parseEther("0.0003");
const DAY = 24 * 60 * 60 * 1000;
const FILE = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), "data", "gas-stipends.json");

type Book = Record<string, number>;

async function load(): Promise<Book> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Book;
  } catch {
    return {};
  }
}

async function save(book: Book) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(book));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { address?: string } | null;
  const address = body?.address;
  if (!address || !isAddress(address)) {
    return Response.json({ error: "bad address" }, { status: 400 });
  }
  const key = process.env.WEESH_GAS_KEY as Hex | undefined;
  if (!key) return Response.json({ skipped: true });

  const account = privateKeyToAccount(key);
  const pub = createPublicClient({ chain: xlayer, transport: xlayerTransport() });
  const userBal = await pub.getBalance({ address: address as Address });
  if (userBal >= MIN) return Response.json({ skipped: true, reason: "funded" });

  const book = await load();
  const last = book[address.toLowerCase()] ?? 0;
  if (Date.now() - last < DAY) return Response.json({ skipped: true, reason: "recent" });

  const tank = await pub.getBalance({ address: account.address });
  if (tank < STIPEND + parseEther("0.0002")) {
    return Response.json({ error: "tank empty" }, { status: 503 });
  }

  const wallet = createWalletClient({ account, chain: xlayer, transport: xlayerTransport() });
  const hash = await wallet.sendTransaction({ to: address as Address, value: STIPEND });
  book[address.toLowerCase()] = Date.now();
  await save(book);
  return Response.json({ hash });
}
