import type { NextConfig } from "next";

// CSP diterapkan hanya di production — dev (HMR) butuh 'unsafe-eval'/inline yang dilarang CSP.
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/lesson/:level/:goal", destination: "/lesson/:goal", permanent: false },
      { source: "/quiz/:level/:goal", destination: "/quiz/:goal", permanent: false },
      { source: "/chat/:level/:goal", destination: "/chat/:goal", permanent: false },
      { source: "/voice-chat/:level/:goal", destination: "/voice-chat/:goal", permanent: false },
      { source: "/practice/:level/:goal", destination: "/practice/:goal", permanent: false },
      { source: "/admin", destination: "/admin/konfigurasi", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
