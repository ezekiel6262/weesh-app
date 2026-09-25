"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectBar } from "./Connect";
import { GasCover } from "./GasCover";

const PRIMARY = [
  { href: "/app", label: "Dashboard", mobile: "Home" },
  { href: "/trade", label: "Trade", mobile: "Trade" },
  { href: "/strategy", label: "Strategy", mobile: "Strategy" },
  { href: "/earn", label: "Earn", mobile: "Earn" },
];

const MORE = [
  { href: "/markets", label: "Markets", note: "Explore tokenized stocks" },
  { href: "/portfolios", label: "Portfolios", note: "Follow public strategies" },
  { href: "/send", label: "Send", note: "Send shares or dollars" },
  { href: "/settings", label: "Settings", note: "Wallet and preferences" },
  { href: "/about", label: "About", note: "How Weesh works" },
];

function on(path: string, href: string) {
  if (href === "/app") return path === "/app";
  if (href === "/markets") return path === "/markets" || path.startsWith("/s/");
  if (href === "/send") return path.startsWith("/send");
  if (href === "/portfolios") return path.startsWith("/portfolios") || path.startsWith("/p/");
  return path === href || path.startsWith(`${href}/`);
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="brand-mark" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#D6452A" />
      <polyline points="5.5,16.5 9.5,22 16,10.5" fill="none" stroke="#F6F3EC" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="13,16.5 17,22 26.5,8.5" fill="none" stroke="#F6F3EC" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((item) => on(path, item.href));
  if (path === "/") return <>{children}</>;
  return (
    <div className="shell">
      <GasCover />
      <header className="top">
        <div className="top-inner">
          <Link href="/app" className="brand">
            <Logo />
            Weesh
          </Link>
          <nav className="top-nav">
            {PRIMARY.map((n) => (
              <Link key={n.href} href={n.href} className={on(path, n.href) ? "on" : ""}>
                {n.label}
              </Link>
            ))}
            <details className="nav-more">
              <summary className={moreActive ? "on" : ""}>More <span aria-hidden>⌄</span></summary>
              <div className="nav-menu">
                {MORE.map((item) => (
                  <Link key={item.href} href={item.href} className={on(path, item.href) ? "on" : ""}>
                    <strong>{item.label}</strong><small>{item.note}</small>
                  </Link>
                ))}
              </div>
            </details>
          </nav>
          <ConnectBar compact />
        </div>
      </header>
      <main>{children}</main>
      <footer className="foot">
        <span>
          Non-custodial. Weesh covers gas. 0.05% on trades. <Link href="/about">What’s an xStock?</Link>
        </span>
        <span>X Layer · xStocks</span>
      </footer>
      <nav className="tabbar">
        {PRIMARY.map((n) => (
          <Link key={n.href} href={n.href} className={on(path, n.href) ? "on" : ""}>
            {n.mobile}
          </Link>
        ))}
        <button type="button" className={moreActive || moreOpen ? "on" : ""} onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>
          More
        </button>
      </nav>
      {moreOpen ? (
        <div className="mobile-nav-backdrop" onClick={() => setMoreOpen(false)}>
          <section className="mobile-nav-sheet" aria-label="More navigation" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-nav-head"><strong>More</strong><button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu">×</button></div>
            <div className="mobile-nav-links">
              {MORE.map((item) => (
                <Link key={item.href} href={item.href} className={on(path, item.href) ? "on" : ""} onClick={() => setMoreOpen(false)}>
                  <span><strong>{item.label}</strong><small>{item.note}</small></span><span aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
