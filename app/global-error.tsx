"use client";

import { ErrorState } from "@/components/common/ErrorState";

import "./globals.css";

// Replaces the root layout, so it renders its own <html>/<body>.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-4 py-16">
        <ErrorState reset={reset} />
      </body>
    </html>
  );
}
