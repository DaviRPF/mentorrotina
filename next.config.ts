import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external connections (Tailscale)
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
    },
  },
};

export default nextConfig;
