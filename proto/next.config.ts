import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "exifr"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
