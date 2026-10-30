// Base URL of the Convex HTTP actions (`*.convex.site`), for the few calls that are plain HTTP
// (the signup receipt upload, convex/files.ts).

/**
 * NEXT_PUBLIC_CONVEX_SITE_URL when set (needed for a local backend), otherwise derived from
 * NEXT_PUBLIC_CONVEX_URL (`https://x.convex.cloud` → `https://x.convex.site`).
 */
export function convexSiteUrl(
  siteUrl: string | undefined = process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  cloudUrl: string | undefined = process.env.NEXT_PUBLIC_CONVEX_URL,
): string | null {
  if (siteUrl?.trim()) return siteUrl.trim().replace(/\/$/, "");
  const match = cloudUrl?.trim().match(/^(https:\/\/[^/]+)\.convex\.cloud\/?$/);
  return match ? `${match[1]}.convex.site` : null;
}
