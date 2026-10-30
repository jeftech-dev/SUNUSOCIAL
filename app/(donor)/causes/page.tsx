import { fr } from "@/lib/strings.fr";

export default function CausesPage() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold text-brand-blue">{fr.spaces.donorTitle}</h1>
      <p className="text-muted-foreground">{fr.spaces.donorSoon}</p>
    </section>
  );
}
