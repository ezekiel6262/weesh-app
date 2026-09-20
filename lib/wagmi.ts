import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { xlayer } from "./chain";

declare global {
  interface Window {
    okxwallet?: { isOkxWallet?: boolean; request: (...args: unknown[]) => Promise<unknown> };
  }
}

export const config = createConfig({
  chains: [xlayer],
  transports: {
    [xlayer.id]: http("https://rpc.xlayer.tech"),
  },
});
