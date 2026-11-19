import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

/** Opens a WhatsApp chat with SUNUSOCIAL. Renders nothing until the number is configured. */
export function WhatsAppButton({
  message = fr.whatsapp.message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  const href = whatsappLink(message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 self-start rounded-full bg-success-soft px-4 py-2.5 text-sm font-semibold text-brand-green-strong transition-colors hover:bg-brand-green-strong hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
      {fr.whatsapp.contact}
    </a>
  );
}
