import Link from "next/link";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";
import { Logo } from "./Logo";

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg text-surface">
      <Logo size={34} />
      <span className="leading-tight">
        <span className="block text-lg font-bold">{strings.brand.name}</span>
        <span className="hidden text-xs text-surface/70 sm:block">{strings.chat.subtitle}</span>
      </span>
    </Link>
  );
}

// Floating rounded header shared by the landing and officer pages, inset from
// the page edges, in charcoal since the RSL colours (19 Nov 2026).
// Page-specific links and buttons go in `children` on the right.
export function SiteHeader({ children, nav }: { children?: ReactNode; nav?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 px-2 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-x-2 rounded-full bg-charcoal py-2 pl-4 pr-2 text-surface shadow-lg shadow-ink/15 sm:gap-x-3 sm:pl-5">
        <Wordmark />
        {nav && <div className="mx-auto hidden lg:block">{nav}</div>}
        {children && (
          <div className={`ml-auto flex shrink-0 items-center gap-1 sm:gap-2 ${nav ? "lg:ml-0" : ""}`}>{children}</div>
        )}
      </div>
    </header>
  );
}
