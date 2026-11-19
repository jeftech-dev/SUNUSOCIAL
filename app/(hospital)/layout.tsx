import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";
import { fr } from "@/lib/strings.fr";

export default function HospitalLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      home="/hopital"
      nav={[
        { href: "/hopital", label: fr.nav.hospitalDashboard },
        { href: "/hopital/alerte", label: fr.nav.hospitalAlert },
      ]}
    >
      <RequireRole role="hospital">{children}</RequireRole>
    </AppShell>
  );
}
