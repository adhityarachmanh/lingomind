import type { NextConfig } from "next";

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
};

export default nextConfig;
