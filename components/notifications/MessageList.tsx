"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@/lib/dates";
import { fr } from "@/lib/strings.fr";
import type { NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The caller's latest in-app notifications (PARCOURS S06), optionally restricted to some kinds.
 * "Voir" opens the related screen and marks that message read; "Tout marquer comme lu" clears them all.
 */
export function MessageList({
  kinds,
  limit = 8,
}: {
  kinds?: readonly NotificationKind[];
  limit?: number;
}) {
  const headingId = useId();
  const pathname = usePathname();
  const messages = useQuery(api.notifications.listMine, kinds ? { kinds: [...kinds] } : {});
  const markRead = useMutation(api.notifications.markRead);
  const shown = messages?.slice(0, limit);

  if (shown === undefined) return null;
  const unread = shown.filter((m) => !m.read);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="font-heading text-xl font-bold text-brand-blue">
          {fr.messages.title}
        </h2>
        {unread.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markRead({ ids: unread.map((m) => m._id as Id<"notifications">) })}
          >
            {fr.messages.markAllRead}
          </Button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.messages.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((message) => (
            <li
              key={message._id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm",
                message.read ? "bg-card" : "bg-primary-soft",
              )}
            >
              <div className="min-w-0 flex-1">
                <strong className="block">{message.title}</strong>
                <span className="block break-words text-muted-foreground">{message.body}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(message.createdAt)}
                </span>
              </div>
              {message.link && message.link !== pathname && (
                <Link
                  href={message.link}
                  onClick={() => {
                    if (!message.read) void markRead({ ids: [message._id as Id<"notifications">] });
                  }}
                  className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {fr.messages.view}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
