import { fr } from "@/lib/strings.fr";

/** Static checklist before a donation (prototype "Avant de venir"). */
export function BeforeYouCome() {
  return (
    <section aria-labelledby="blood-before" className="flex flex-col gap-3">
      <h2 id="blood-before" className="font-heading text-xl font-bold text-brand-blue">
        {fr.blood.donor.beforeTitle}
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {fr.blood.donor.before.map((item, index) => (
          <li key={item} className="flex gap-3 rounded-lg border bg-card p-3 text-sm">
            <span className="font-heading font-extrabold text-destructive">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item}
          </li>
        ))}
      </ol>
    </section>
  );
}
