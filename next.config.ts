import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Tableo app domain for API calls
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.TABLEO_APP_URL || "https://app.tableo.com" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Tableo-Signature" },
        ],
      },
    ];
  },
};

export default nextConfig;
