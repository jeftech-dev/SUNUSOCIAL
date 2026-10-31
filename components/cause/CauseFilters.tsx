"use client";

import type { FeedParams } from "@/lib/feedParams";
import { fr } from "@/lib/strings.fr";
import { CATEGORIES, CAUSE_FILTERS, type Category, type CauseFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTER_LABELS: Record<CauseFilter, string> = {
  urgent: fr.common.urgent,
  almost: fr.common.almostThere,
  recent: fr.common.recent,
};

const FILTER_ON: Record<CauseFilter, string> = {
  urgent: "border-brand-orange-strong bg-accent text-brand-orange-strong",
  almost: "border-brand-green-strong bg-success-soft text-brand-green-strong",
  recent: "border-brand-blue bg-primary-soft text-brand-blue",
};

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Search, category tabs and the Urgent / Presque atteint / Récent chips (one at a time). */
export function CauseFilters({
  value,
  search,
  onSearchChange,
  onChange,
}: {
  value: FeedParams;
  /** The search box text, which may be ahead of `value.query` while typing. */
  search: string;
  onSearchChange: (search: string) => void;
  onChange: (next: { category?: Category; filter?: CauseFilter }) => void;
}) {
  const categories: Array<{ key?: Category; label: string }> = [
    { label: fr.feed.all },
    ...CATEGORIES.map((key) => ({ key, label: fr.categories[key] })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <label className="relative block">
        <span className="sr-only">{fr.feed.searchLabel}</span>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={search}
          maxLength={100}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={fr.feed.searchPlaceholder}
          className={cn(
            "h-12 w-full rounded-full border border-input bg-card pr-4 pl-11 text-base placeholder:text-muted-foreground",
            focusRing,
          )}
        />
      </label>

      <div
        role="group"
        aria-label={fr.feed.categoriesLabel}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {categories.map(({ key, label }) => {
          const on = value.category === key;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ category: key, filter: value.filter })}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 font-heading text-sm font-semibold transition-colors",
                on
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-input bg-card text-foreground hover:bg-primary-soft",
                focusRing,
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{fr.feed.refine}</span>
        {CAUSE_FILTERS.map((key) => {
          const on = value.filter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ category: value.category, filter: on ? undefined : key })}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                on ? FILTER_ON[key] : "border-input bg-card text-foreground hover:bg-muted",
                focusRing,
              )}
            >
              {on && <span aria-hidden="true">✓ </span>}
              {FILTER_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
