import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel handles Next.js output natively — standalone is for self-hosting only */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
