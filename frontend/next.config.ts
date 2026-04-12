import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: false,
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
