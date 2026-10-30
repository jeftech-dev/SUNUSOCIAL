// Input normalisation and validation shared by the forms and the Convex functions.
// The server always re-validates: client checks are for feedback only.

/** Minimum password lengths (SECURITY.md §2). */
export const PASSWORD_MIN_LENGTH = {
  donor: 8,
  organization: 12,
} as const;

export type PasswordPolicy = keyof typeof PASSWORD_MIN_LENGTH;

/** Password longer than this is refused, so hashing cost stays bounded. */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Normalises a Senegalese mobile number to E.164 (`+2217XXXXXXXX`), or returns null.
 * Accepts spaces, dots, dashes and the `+221` / `00221` / `221` prefixes.
 * Only mobile numbers (7X) are accepted: every account phone receives SMS codes (DB-7).
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 9) digits = `221${digits}`;
  if (!/^2217\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

/** "+221771234567" → "+221 77 ••• 45 67", for "code sent to …" messages. */
export function maskPhone(phone: string): string {
  const m = /^\+221(\d{2})\d{3}(\d{2})(\d{2})$/.exec(phone);
  if (!m) return "•••";
  return `+221 ${m[1]} ••• ${m[2]} ${m[3]}`;
}

/** Lower-cased, trimmed email, or null when it is not a plausible address. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Login identifier: a donor's phone or an organisation's email. */
export function normalizeIdentifier(input: string): string | null {
  return input.includes("@") ? normalizeEmail(input) : normalizePhone(input);
}

export function isValidPassword(password: string, policy: PasswordPolicy): boolean {
  return password.length >= PASSWORD_MIN_LENGTH[policy] && password.length <= PASSWORD_MAX_LENGTH;
}

/** 6-digit one-time code. */
export function isOtpFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** A person's or organisation's name: 2 to 120 visible characters. */
export function normalizeName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 120 ? name : null;
}

/** Signup receipts (récépissé / agrément): PDF, JPG or PNG, 5 MB max. */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/**
 * The receipt type read from the file's first bytes, or null when it is none of RECEIPT_TYPES.
 * The declared Content-Type alone can't be trusted.
 */
export function sniffReceiptType(bytes: Uint8Array): (typeof RECEIPT_TYPES)[number] | null {
  const startsWith = (signature: number[]) =>
    bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}
