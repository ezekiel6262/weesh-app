"use client";

import { useEffect, useRef } from "react";
import { useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount } from "wagmi";

/** After email OTP, Privy is authenticated but wagmi stays disconnected until
 * the embedded wallet exists and is set active. Production often skips
 * create-on-login; this creates it and hands it to wagmi. */
export function WalletSync() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { setActiveWallet } = useSetActiveWallet();
  const { isConnected } = useAccount();
  const creating = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !walletsReady) return;
    const embedded = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    if (embedded) {
      if (!isConnected) void setActiveWallet(embedded);
      creating.current = false;
      return;
    }
    if (creating.current) return;
    creating.current = true;
    void createWallet().catch(() => {
      creating.current = false;
    });
  }, [ready, authenticated, walletsReady, wallets, isConnected, createWallet, setActiveWallet]);

  return null;
}
