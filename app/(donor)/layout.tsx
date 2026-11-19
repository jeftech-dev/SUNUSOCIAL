import { BloodNavBadge } from "@/components/blood/BloodNavBadge";
import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";
import { fr } from "@/lib/strings.fr";

export default function DonorLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      home="/causes"
      nav={[
        { href: "/causes", label: fr.nav.causes },
        { href: "/sang", label: fr.nav.blood, badge: <BloodNavBadge /> },
        { href: "/profil", label: fr.nav.profile },
      ]}
    >
      <RequireRole role="donor">{children}</RequireRole>
    </AppShell>
  );
}
