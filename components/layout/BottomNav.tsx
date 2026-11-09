"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { fr } from "@/lib/strings.fr";

export type NavItem = { href: string; label: string; badge?: ReactNode };

/** Mobile primary navigation, pinned to the bottom of the screen below the `sm` breakpoint. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={fr.nav.main}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--line-warm)] bg-[var(--cream)] pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-14 flex-1 items-center justify-center px-2 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
              current ? "bg-primary-soft text-brand-blue" : "text-brand-blue/80"
            }`}
          >
            {item.label}
            {item.badge}
          </Link>
        );
      })}
    </nav>
  );
}
