// Hashing and randomness helpers (Web Crypto, available in the Convex runtime).
// Generate secrets in actions only: queries and mutations run with seeded randomness.

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A uniformly random 6-digit code ("000000"–"999999"). */
export function randomOtpCode(): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return String(buffer[0] % 1_000_000).padStart(6, "0");
}

/** A random URL-safe token with `bytes` bytes of entropy, hex-encoded. */
export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash of a one-time code, bound to its purpose and phone so a code can't be replayed elsewhere. */
export function hashOtp(purpose: string, phone: string, code: string): Promise<string> {
  return sha256Hex(`otp:${purpose}:${phone}:${code}`);
}
