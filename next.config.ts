import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // playwright-core lit ses fichiers (browsers.json…) dynamiquement : le traçage ne les voit pas.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/playwright-core/**/*"],
  },
};

export default nextConfig;
