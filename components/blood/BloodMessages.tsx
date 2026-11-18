import { MessageList } from "@/components/notifications/MessageList";

const KINDS = ["blood_alert", "blood_reminder", "blood_alert_closed", "blood_thanks"] as const;

/** The donor's blood messages (alerts, reminders, thanks). Opening the page marks them read. */
export function BloodMessages() {
  return <MessageList kinds={KINDS} limit={5} />;
}
