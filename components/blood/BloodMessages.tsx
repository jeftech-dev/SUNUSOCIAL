"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

const KINDS = ["blood_alert", "blood_reminder", "blood_alert_closed", "blood_thanks"] as const;

/** The donor's blood messages (alerts, reminders, thanks). Opening the page marks them read. */
export function BloodMessages() {
  const messages = useQuery(api.notifications.listMine, { kinds: [...KINDS] });
  const markRead = useMutation(api.notifications.markRead);
  const unreadKey =
    messages
      ?.filter((m) => !m.read)
      .map((m) => m._id)
      .join(",") ?? "";

  useEffect(() => {
    if (unreadKey) void markRead({ ids: unreadKey.split(",") as Id<"notifications">[] });
  }, [unreadKey, markRead]);

  if (messages === undefined) return null;
  return (
    <section aria-labelledby="blood-messages" className="flex flex-col gap-2">
      <h2 id="blood-messages" className="font-heading text-xl font-bold text-brand-blue">
        {fr.blood.donor.messagesTitle}
      </h2>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.blood.donor.messagesEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.slice(0, 5).map((message) => (
            <li
              key={message._id}
              className={cn(
                "rounded-lg border p-3 text-sm",
                message.read ? "bg-card" : "bg-primary-soft",
              )}
            >
              <strong className="block">{message.title}</strong>
              <span className="text-muted-foreground">{message.body}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
