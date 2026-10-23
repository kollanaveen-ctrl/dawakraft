import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate local verification from a running or OneDrive-locked build directory.
  distDir: process.env.DAWAKRAFT_BUILD_DIR || ".next",
  cacheComponents: true,
  // Basic security headers for every page. (A full Content-Security-Policy is on the roadmap.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    // This folder is the project root (a stray package-lock.json higher up would confuse Next.js).
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
