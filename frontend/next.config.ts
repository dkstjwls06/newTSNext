import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "./frontend",
  },
  reactStrictMode:true
};

export default nextConfig;
