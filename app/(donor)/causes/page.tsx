import type { Metadata } from "next";

import { CausesFeed } from "@/components/cause/CausesFeed";
import { parseFeedParams } from "@/lib/feedParams";
import { firstParam } from "@/lib/searchParams";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.spaces.donorTitle} — ${fr.app.name}` };

export default async function CausesPage({ searchParams }: PageProps<"/causes">) {
  const params = await searchParams;
  return (
    <CausesFeed
      initial={parseFeedParams({
        categorie: firstParam(params.categorie),
        filtre: firstParam(params.filtre),
        q: firstParam(params.q),
      })}
    />
  );
}
