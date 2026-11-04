import { HospitalDashboard } from "@/components/blood/HospitalDashboard";
import { StructureStatus } from "@/components/layout/StructureStatus";
import { fr } from "@/lib/strings.fr";

export default function HospitalPage() {
  return (
    <div className="flex flex-col gap-8">
      <StructureStatus title={fr.spaces.hospitalTitle} />
      <HospitalDashboard />
    </div>
  );
}
