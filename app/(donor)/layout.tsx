import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";

export default function DonorLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell home="/causes">
      <RequireRole role="donor">{children}</RequireRole>
    </AppShell>
  );
}
