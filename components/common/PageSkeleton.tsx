import { fr } from "@/lib/strings.fr";

/** Generic route-level loading placeholder (title, intro and a few content blocks). */
export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{fr.states.loading}</span>
      <div className="flex flex-col gap-3">
        <div className="h-8 w-2/3 max-w-sm animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
