import type { NextConfig } from "next";

// Cause banners are served from Convex file storage: allow the deployment's storage URLs.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexOrigin = convexUrl ? new URL(convexUrl) : null;
const isLocalBackend =
  convexOrigin !== null && ["127.0.0.1", "localhost"].includes(convexOrigin.hostname);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://*.convex.cloud/api/storage/**"),
      ...(convexOrigin ? [new URL(`${convexOrigin.origin}/api/storage/**`)] : []),
    ],
    // A local Convex backend (`npx convex dev --local`) serves files from 127.0.0.1.
    dangerouslyAllowLocalIP: isLocalBackend && process.env.NODE_ENV !== "production",
  },
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
