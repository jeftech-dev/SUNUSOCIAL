"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { fr } from "@/lib/strings.fr";

export type NavItem = { href: string; label: string; badge?: ReactNode };

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-ring";

/**
 * Primary navigation of the signed-in spaces, rendered once so each badge mounts once. With
 * `bottomOnMobile` it is a bar pinned to the bottom of the screen below the `sm` breakpoint and
 * a row of header links above it; otherwise it is always the header row. The bar's height is
 * `--bottom-nav-height` (globals.css), which the AppShell reserves under the content.
 */
export function MainNav({ items, bottomOnMobile }: { items: NavItem[]; bottomOnMobile: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={fr.nav.main}
      className={
        bottomOnMobile
          ? "fixed inset-x-0 bottom-0 z-40 flex h-[var(--bottom-nav-height)] border-t border-[var(--line-warm)] bg-[var(--cream)] pb-[env(safe-area-inset-bottom)] sm:static sm:z-auto sm:h-auto sm:items-center sm:gap-2 sm:border-t-0 sm:bg-transparent sm:pb-0"
          : "flex items-center gap-2"
      }
    >
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={
              bottomOnMobile
                ? `flex flex-1 items-center justify-center px-2 text-center text-sm leading-tight font-semibold ${FOCUS_RING} max-sm:-outline-offset-2 sm:block sm:flex-none sm:rounded-full sm:px-3 sm:py-1.5 sm:leading-normal sm:text-brand-blue sm:hover:bg-primary-soft sm:focus-visible:outline-offset-2 ${
                    current ? "text-brand-blue max-sm:bg-primary-soft" : "max-sm:text-brand-blue/80"
                  }`
                : `rounded-full px-3 py-1.5 text-sm font-semibold text-brand-blue hover:bg-primary-soft ${FOCUS_RING} focus-visible:outline-offset-2`
            }
          >
            {item.label}
            {item.badge}
          </Link>
        );
      })}
    </nav>
  );
}
