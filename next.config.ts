import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the E2E dev server run alongside a normal `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
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
