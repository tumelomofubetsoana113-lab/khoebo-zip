import Link from "next/link";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";
import { Logo } from "./Logo";
import { PrototypePill } from "./Pill";

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
// On phones the prototype pill drops to its own row, so the wordmark and the
// buttons share the first row; from 640px up it sits beside the wordmark.
export function SiteHeader({ children, nav }: { children?: ReactNode; nav?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 px-2 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 rounded-3xl bg-charcoal px-3 py-2 text-surface shadow-lg shadow-ink/15 sm:flex-nowrap sm:gap-x-3 sm:rounded-full sm:pl-5 sm:pr-2">
        <Wordmark />
        <div className="order-last basis-full pb-1 sm:order-none sm:basis-auto sm:pb-0">
          <PrototypePill />
        </div>
        {nav && <div className="mx-auto hidden lg:block">{nav}</div>}
        {children && (
          <div className={`ml-auto flex shrink-0 items-center gap-1 sm:gap-2 ${nav ? "lg:ml-0" : ""}`}>{children}</div>
        )}
      </div>
    </header>
  );
}
