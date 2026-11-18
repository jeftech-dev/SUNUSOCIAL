"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useId } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/dates";
import { fr } from "@/lib/strings.fr";
import type { NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The caller's latest in-app notifications (PARCOURS S06), optionally restricted to some kinds.
 * Showing them marks them read.
 */
export function MessageList({
  kinds,
  limit = 8,
}: {
  kinds?: readonly NotificationKind[];
  limit?: number;
}) {
  const headingId = useId();
  const messages = useQuery(api.notifications.listMine, kinds ? { kinds: [...kinds] } : {});
  const markRead = useMutation(api.notifications.markRead);
  const shown = messages?.slice(0, limit);
  const unreadKey =
    shown
      ?.filter((m) => !m.read)
      .map((m) => m._id)
      .join(",") ?? "";

  useEffect(() => {
    if (unreadKey) void markRead({ ids: unreadKey.split(",") as Id<"notifications">[] });
  }, [unreadKey, markRead]);

  if (shown === undefined) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="font-heading text-xl font-bold text-brand-blue">
        {fr.messages.title}
      </h2>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.messages.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((message) => (
            <li
              key={message._id}
              className={cn(
                "rounded-lg border p-3 text-sm",
                message.read ? "bg-card" : "bg-primary-soft",
              )}
            >
              <strong className="block">{message.title}</strong>
              <span className="block break-words text-muted-foreground">{message.body}</span>
              <span className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
