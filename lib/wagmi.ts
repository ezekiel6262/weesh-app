import { createConfig } from "@privy-io/wagmi";
import { xlayer, xlayerTransport } from "./chain";

declare global {
  interface Window {
    okxwallet?: { isOkxWallet?: boolean; request: (...args: unknown[]) => Promise<unknown> };
  }
}

export const config = createConfig({
  chains: [xlayer],
  transports: {
    [xlayer.id]: xlayerTransport(),
  },
});
