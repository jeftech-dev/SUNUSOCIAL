import { StructureStatus } from "@/components/layout/StructureStatus";
import { PayoutAccountForm } from "@/components/structure/PayoutAccountForm";
import { StructureCauses } from "@/components/structure/StructureCauses";
import { fr } from "@/lib/strings.fr";

export default function StructurePage() {
  return (
    <div className="flex flex-col gap-8">
      <StructureStatus title={fr.spaces.structureTitle} />
      <StructureCauses />
      <PayoutAccountForm />
    </div>
  );
}
