import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server actions are on by default in Next 14+; nothing to toggle here.
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.wikia.nocookie.net" }, // Leaguepedia logos
      { protocol: "https", hostname: "ddragon.leagueoflegends.com" } // Data Dragon
    ]
  }
};

export default nextConfig;
