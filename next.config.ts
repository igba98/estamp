import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needs a Node server (the /api/v1 routes), so no static export.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
