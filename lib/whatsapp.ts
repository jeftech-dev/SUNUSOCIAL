// "Nous contacter sur WhatsApp" links (PRD 5.9). The number is SUNUSOCIAL's official one, set in
// NEXT_PUBLIC_WHATSAPP_NUMBER once the board provides it; until then there is no link.

/** A wa.me link with a prefilled message, or null when no number is configured. */
export function whatsappLink(
  text: string,
  number: string | undefined = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
