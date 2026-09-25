import Link from "next/link";
import { WEESH_DROP } from "@/lib/drop";
import { addrUrl } from "@/lib/tx";

export default function AboutPage() {
  return (
    <>
      <p className="kicker">Weesh</p>
      <h1>What’s an xStock?</h1>
      <p className="lede">
        An xStock is a token that tracks a stock or ETF, 1:1 backed by the issuer (Backed / xStocks). It is
        not a share. You don’t get a vote. US persons are excluded.
      </p>
      <div className="card">
        <h2>What you actually hold</h2>
        <p className="muted">
          On X Layer there are two tokens per name. The rebase xStock (NVDAx) is what the issuer mints.
          The wrapped token (wNVDAx) is what Uniswap and OKX DEX fill. Weesh buys the wrap so DeFi works.
        </p>
        <p className="muted">
          If you withdraw from OKX you may receive the rebase token. Wrap it on the stock page before you
          sell on Uniswap.
        </p>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>What Weesh does</h2>
        <p className="muted">
          Weesh is a website that builds transactions. You sign with an email wallet (same address
          on any device) or with OKX Wallet. Uniswap, OKX DEX, Aave, and Spark hold protocol
          positions — not Weesh. Trades take 0.05%. Weesh covers gas so you never hold OKB or
          convert stables for gas. There is no Weesh account and no Weesh custody.
        </p>
        <p className="muted">This is not investment advice. Tokens can trade above or below the cash-market print.</p>
      </div>
      <div className="card proof-card" style={{ marginTop: 16 }}>
        <p className="kicker">Built on X Layer</p>
        <h2>Verify, don’t trust.</h2>
        <div className="proof-grid">
          <div>
            <span>Network</span>
            <strong>X Layer · Chain 196</strong>
          </div>
          <div>
            <span>Stock gifts</span>
            <a href={addrUrl(WEESH_DROP)} target="_blank" rel="noreferrer">View contract</a>
          </div>
          <div>
            <span>Execution</span>
            <strong>Uniswap + OKX DEX</strong>
          </div>
          <div>
            <span>Custody</span>
            <strong>User-signed only</strong>
          </div>
        </div>
        <p className="muted">
          Successful trades and gifts link directly to their X Layer transaction from the confirmation screen.
        </p>
      </div>
      <p className="actions">
        <Link className="btn primary" href="/s/NVDA">
          Open NVIDIA
        </Link>
        <Link className="btn ghost" href="/">
          Back to dashboard
        </Link>
      </p>
    </>
  );
}
