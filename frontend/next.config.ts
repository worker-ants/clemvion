import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local symlinked package — transpile required for bundler resolution.
  // Build uses --webpack flag because Turbopack cannot follow symlinked local packages.
  transpilePackages: ["@workflow/expression-engine"],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGIN
    ? [process.env.ALLOWED_DEV_ORIGIN]
    : [],
};

export default nextConfig;
