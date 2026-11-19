import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The in-memory accounts database for local development (lib/server/db.ts)
  // loads its own WebAssembly, so it isn't bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
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
