import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.localhost"],
  transpilePackages: ["three"],
  generateBuildId: () => packageJson.version,
};

export default nextConfig;
