import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";

export default function StructureLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell home="/structure">
      <RequireRole role="structure">{children}</RequireRole>
    </AppShell>
  );
}
