"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectBar } from "./Connect";
import { GasCover } from "./GasCover";

const NAV = [
  { href: "/app", label: "Dashboard", mobile: "Home" },
  { href: "/markets", label: "Markets", mobile: "Markets" },
  { href: "/trade", label: "Trade", mobile: "Trade" },
  { href: "/strategy", label: "Strategy", mobile: "Strategy" },
  { href: "/earn", label: "Earn", mobile: "Earn" },
  { href: "/portfolios", label: "Portfolios", mobile: "Portfolios" },
  { href: "/send", label: "Send", mobile: "Send" },
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
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={on(path, n.href) ? "on" : ""}>
                {n.label}
              </Link>
            ))}
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
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={on(path, n.href) ? "on" : ""}>
            {n.mobile}
          </Link>
        ))}
      </nav>
    </div>
  );
}
