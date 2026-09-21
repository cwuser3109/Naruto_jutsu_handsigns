import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Pin the project root so a stray package-lock.json in a parent folder can't confuse detection
  turbopack: { root: process.cwd() },
};

export default nextConfig;
