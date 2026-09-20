"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmi } from "@privy-io/wagmi";
import { useState, type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { xlayer } from "@/lib/chain";
import { privyAppId, privyConfig } from "@/lib/privy";
import { config } from "@/lib/wagmi";

const fallback = createConfig({
  chains: [xlayer],
  transports: { [xlayer.id]: http("https://rpc.xlayer.tech") },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [query] = useState(() => new QueryClient());
  if (!privyAppId) {
    return (
      <WagmiProvider config={fallback}>
        <QueryClientProvider client={query}>{children}</QueryClientProvider>
      </WagmiProvider>
    );
  }
  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <QueryClientProvider client={query}>
        <PrivyWagmi config={config}>{children}</PrivyWagmi>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
