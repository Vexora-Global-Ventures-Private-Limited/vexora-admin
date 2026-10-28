import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel handles Next.js output natively — standalone is for self-hosting only */
  // Baseline security headers. No framing (stops clickjacking on one-click
  // actions); no full Content-Security-Policy yet — it needs browser testing
  // against Next.js inline scripts first.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HTTPS-only once deployed (browsers ignore this header over plain http://localhost).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ]
  },
  // Local-dev proxy. vex-dev's admin CORS list only allows the deployed
  // console (https://vxa.vercel.app), so a browser on localhost can't call
  // the admin API directly. With API_PROXY_TARGET set (see .env.example) and
  // NEXT_PUBLIC_API_BASE_URL left empty, the browser calls this app's own
  // /api/v1/* and Next forwards it server-side — no CORS involved, and the
  // console can run on any port next to vexora-web. Unset in production,
  // where the console calls the API directly.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, "")
    return target ? [{ source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` }] : []
  },
  reactStrictMode: false,
};

export default nextConfig;
