import type { Metadata } from "next";

import { DonorProfile } from "@/components/donor/DonorProfile";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.profile.title} — ${fr.app.name}` };

export default function ProfilePage() {
  return <DonorProfile />;
}
