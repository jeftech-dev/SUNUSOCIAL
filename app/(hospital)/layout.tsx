import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";

export default function HospitalLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell home="/hopital">
      <RequireRole role="hospital">{children}</RequireRole>
    </AppShell>
  );
}
