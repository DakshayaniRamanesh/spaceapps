import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  // Let development QA run alongside the user's normal dev server.
  distDir:
    process.env.SKYTRACE_ISOLATED_TEST_BUILD === "1" ? ".next-test" : ".next",
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  async rewrites() {
    const backend = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/health", destination: `${backend}/health` },
    ];
  },
};
export default config;
