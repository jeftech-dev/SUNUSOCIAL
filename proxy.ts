// Request proxy (Next.js 16 `proxy`, formerly middleware).
// - Convex Auth: proxies /api/auth and keeps the session in httpOnly, host-only cookies.
// - Moderation subdomain (DT-9): `moderation.<domain>/x` is served from app/moderation/x;
//   the main host answers 404 for /moderation/*. Cookies are per host, so sessions never cross.
// - Visitors without a session are sent to the login page from protected spaces.

import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

import { isModerationHost, PROTECTED_PREFIXES } from "./lib/authz";

const SESSION_COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60; // DB-8

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const { pathname, search } = request.nextUrl;

    if (isModerationHost(request.headers.get("host"))) {
      if (pathname.startsWith("/moderation")) {
        // Canonical moderation URLs have no /moderation prefix.
        const url = request.nextUrl.clone();
        url.pathname = pathname.slice("/moderation".length) || "/";
        return NextResponse.redirect(url);
      }
      const isPublic = pathname === "/" || pathname.startsWith("/mot-de-passe");
      if (!isPublic && !(await convexAuth.isAuthenticated())) {
        return nextjsMiddlewareRedirect(request, "/");
      }
      const url = request.nextUrl.clone();
      url.pathname = `/moderation${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }

    if (pathname === "/moderation" || pathname.startsWith("/moderation/")) {
      return new NextResponse(null, { status: 404 });
    }
    const isProtected = PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (isProtected && !(await convexAuth.isAuthenticated())) {
      const url = request.nextUrl.clone();
      url.pathname = "/connexion";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  },
  { cookieConfig: { maxAge: SESSION_COOKIE_MAX_AGE_S } },
);

export const config = {
  // Everything except Next internals and files with an extension (images, fonts, icons).
  matcher: ["/((?!_next/|.*\\.[\\w]+$).*)", "/", "/(api)(.*)"],
};
