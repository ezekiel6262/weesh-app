import type { PrivyClientConfig } from "@privy-io/react-auth";
import { xlayer } from "./chain";

export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["email"],
  appearance: {
    theme: "#f6f3ec",
    accentColor: "#d6452a",
    walletList: ["okx_wallet", "detected_wallets"],
    landingHeader: "Weesh",
  },
  defaultChain: xlayer,
  supportedChains: [xlayer],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "all-users",
    },
    showWalletUIs: false,
  },
};
