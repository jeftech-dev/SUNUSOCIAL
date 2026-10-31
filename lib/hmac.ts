// HMAC-SHA256 and constant-time comparison over Web Crypto, available in Node 20, the browser and
// the Convex runtime. Used for SMS code hashes and payment webhook signatures.

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Lowercase hex HMAC-SHA256 of `text` (UTF-8) keyed with `key`. */
export async function hmacSha256Hex(key: string, text: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(text)));
}

/**
 * Compares two strings in time that depends only on their length, so a signature can't be
 * guessed byte by byte from response times.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
