import { fr } from "@/lib/strings.fr";
import type { BloodAlertLevel, BloodType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Notice = { kind: "success" | "error"; text: string };

export function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg p-3 text-sm font-semibold",
        notice.kind === "success"
          ? "bg-success-soft text-brand-green-strong"
          : "bg-[var(--danger-soft)] text-destructive",
      )}
    >
      {notice.text}
    </p>
  );
}

const LEVEL_STYLES: Record<BloodAlertLevel, string> = {
  vitale: "bg-destructive text-white",
  urgente: "bg-accent text-[var(--brand-orange-strong)]",
  normale: "bg-primary-soft text-brand-blue",
};

export function LevelBadge({ level }: { level: BloodAlertLevel }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        LEVEL_STYLES[level],
      )}
    >
      {fr.bloodAlertLevels[level]}
    </span>
  );
}

/** The requested groups; the viewer's own group is solid so it stands out. */
export function GroupChips({
  groups,
  anyType,
  mine,
}: {
  groups: BloodType[];
  anyType: boolean;
  mine?: BloodType | null;
}) {
  const chip = "rounded-md px-2 py-0.5 text-xs font-bold";
  if (anyType) {
    return (
      <ul className="flex flex-wrap gap-1.5">
        <li className={cn(chip, "bg-[var(--danger-soft)] text-destructive")}>
          {fr.blood.allGroupsToggle}
        </li>
      </ul>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={fr.auth.blood.bloodType}>
      {groups.map((group) => (
        <li
          key={group}
          className={cn(
            chip,
            group === mine
              ? "bg-destructive text-white"
              : "bg-[var(--danger-soft)] text-destructive",
          )}
        >
          {fr.bloodTypes[group]}
        </li>
      ))}
    </ul>
  );
}

/** Collected / needed bags; red until the goal is met, then green. */
export function BloodProgress({ collected, needed }: { collected: number; needed: number }) {
  const percent = needed > 0 ? Math.min(100, Math.round((collected / needed) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{fr.blood.unitsLabel(collected, needed)}</span>
      <div
        role="progressbar"
        aria-label={fr.blood.unitsLabel(collected, needed)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none",
            collected >= needed ? "bg-brand-green" : "bg-destructive",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
