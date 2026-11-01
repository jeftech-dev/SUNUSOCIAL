import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";
import { fr } from "@/lib/strings.fr";

export default function StructureLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell home="/structure" nav={[{ href: "/structure", label: fr.structureCauses.heading }]}>
      <RequireRole role="structure">{children}</RequireRole>
    </AppShell>
  );
}
