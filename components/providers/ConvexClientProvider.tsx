"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

// One client for the whole app. Sprint 2 swaps this for the Convex Auth provider.
const convex = url ? new ConvexReactClient(url) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    // No deployment configured (run `npx convex dev`): static pages still render, and any
    // Convex hook fails loudly with "Could not find Convex client".
    return children;
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
