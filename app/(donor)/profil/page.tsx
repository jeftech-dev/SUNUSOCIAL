import type { Metadata } from "next";

import { DonorProfile } from "@/components/donor/DonorProfile";
import { MessageList } from "@/components/notifications/MessageList";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.profile.title} — ${fr.app.name}` };

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-8">
      <DonorProfile />
      <MessageList />
    </div>
  );
}
