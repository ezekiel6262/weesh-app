"use client";

import { useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { coverGas } from "@/lib/gas";

/** Silent OKB top-up so a new email wallet can sign without holding gas. */
export function GasCover() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();

  useEffect(() => {
    if (!isConnected || !address || !client) return;
    void coverGas(client, address).catch(() => {
      /* first login may race the tank; the next sign retries */
    });
  }, [address, isConnected, client]);

  return null;
}
