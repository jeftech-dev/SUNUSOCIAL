"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { FEED_PAGE_SIZE, useCauses } from "@/hooks/useCauses";
import { useMe } from "@/hooks/useMe";
import { feedSearch, type FeedParams } from "@/lib/feedParams";
import { fr } from "@/lib/strings.fr";

import { CauseCard } from "./CauseCard";
import { CauseFilters } from "./CauseFilters";
import { FeaturedCause } from "./FeaturedCause";

const SEARCH_DEBOUNCE_MS = 300;

/** 03 Accueil donateur: greeting, Coup de cœur, filters and the live list of causes. */
export function CausesFeed({ initial }: { initial: FeedParams }) {
  const me = useMe();
  const [params, setParams] = useState<FeedParams>(initial);
  const [search, setSearch] = useState(initial.query);

  // Debounce the search box into the query params.
  useEffect(() => {
    if (search === params.query) return;
    const timer = setTimeout(
      () => setParams((current) => ({ ...current, query: search })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search, params.query]);

  // Keep the URL in step, without a navigation (Next.js syncs useSearchParams with it).
  useEffect(() => {
    const url = `${window.location.pathname}${feedSearch(params)}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", url);
    }
  }, [params]);

  const query = params.query.trim();
  const filtered = Boolean(params.category || params.filter || query);
  const featured = useQuery(api.causes.featured, filtered ? "skip" : {});
  const { results, status, loadMore } = useCauses({
    category: params.category,
    filter: params.filter,
    query: query || undefined,
  });

  const reset = () => {
    setSearch("");
    setParams({ query: "" });
  };
  const firstName = me?.user.name.split(" ")[0] ?? "";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-extrabold text-brand-blue sm:text-3xl">
          {fr.feed.hello(firstName)}
        </h1>
        <p className="text-muted-foreground">{fr.feed.intro}</p>
      </div>

      {featured && <FeaturedCause cause={featured} />}

      <CauseFilters
        value={params}
        search={search}
        onSearchChange={setSearch}
        onChange={(next) => setParams((current) => ({ ...current, ...next }))}
      />

      {status === "LoadingFirstPage" ? (
        <FeedSkeleton />
      ) : results.length === 0 && status === "Exhausted" ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-input bg-card px-6 py-12 text-center">
          <p className="text-muted-foreground">{filtered ? fr.feed.empty : fr.feed.noCauses}</p>
          {filtered && (
            <Button variant="outline" size="sm" onClick={reset}>
              {fr.feed.resetFilters}
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy={status === "LoadingMore"}
          >
            {results.map((cause) => (
              <li key={cause.id} className="flex">
                <CauseCard cause={cause} />
              </li>
            ))}
          </ul>
          {status !== "Exhausted" && (
            <Button
              variant="outline"
              className="self-center"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(FEED_PAGE_SIZE)}
            >
              {status === "LoadingMore" ? fr.common.loading : fr.feed.loadMore}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function FeedSkeleton() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label={fr.common.loading}>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-[var(--line-warm)] bg-card">
          <div className="aspect-[16/10] animate-pulse bg-muted" />
          <div className="flex flex-col gap-3 p-4">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-2 w-full animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-full bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
