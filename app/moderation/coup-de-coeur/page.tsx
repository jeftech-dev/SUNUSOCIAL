import type { Metadata } from "next";

import { RequireRole } from "@/components/auth/RequireRole";
import { FeaturedPicker } from "@/components/moderation/FeaturedPicker";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.featuredPicker.title} — ${fr.moderation.title}` };

/** S15 Choisir le Coup de cœur de la semaine. */
export default function FeaturedPage() {
  return (
    <RequireRole role="moderator" loginPath="/">
      <FeaturedPicker />
    </RequireRole>
  );
}
