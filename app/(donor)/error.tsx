"use client";

import { ErrorState } from "@/components/common/ErrorState";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState reset={reset} />;
}
