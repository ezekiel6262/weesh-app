import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "xstocks-metadata.backed.fi", pathname: "/logos/tokens/**" }],
  },
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["@privy-io/react-auth", "@privy-io/wagmi"],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@walletconnect/ethereum-provider": false,
      "@walletconnect/universal-provider": false,
      "pino-pretty": false,
      "@coinbase/wallet-sdk": false,
      "@coinbase/cdp-sdk": false,
      "@safe-global/safe-apps-sdk": false,
      "@safe-global/safe-apps-provider": false,
      "@metamask/connect-evm": false,
      "@base-org/account": false,
      "@react-native-async-storage/async-storage": false,
      "@farcaster/mini-app-solana": false,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
