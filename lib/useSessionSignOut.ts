"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useDisconnect } from "wagmi";

/** Clear both Privy's login session and wagmi's connector state. */
export function useSessionSignOut() {
  const router = useRouter();
  const { logout } = usePrivy();
  const { disconnectAsync } = useDisconnect();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await Promise.allSettled([disconnectAsync(), logout()]);
      router.replace("/app");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [disconnectAsync, logout, router, signingOut]);

  return { signOut, signingOut };
}
