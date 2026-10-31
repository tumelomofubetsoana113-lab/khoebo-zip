import Link from "next/link";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";
import { Logo } from "./Logo";
import { PrototypePill } from "./Pill";

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded text-xl font-bold text-flag-blue">
      <Logo size={28} />
      {strings.brand.name}
    </Link>
  );
}

// Floating rounded header shared by the landing and officer pages.
// Page-specific links and buttons go in `children` on the right.
// On phones the prototype pill drops to its own row, so the wordmark and the
// buttons share the first row; from 640px up it sits beside the wordmark.
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 px-2 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 rounded-3xl border border-line bg-surface px-3 py-2 shadow-lg shadow-ink/5 sm:flex-nowrap sm:gap-x-3 sm:rounded-full sm:pl-5 sm:pr-2">
        <Wordmark />
        <div className="order-last basis-full pb-1 sm:order-none sm:basis-auto sm:pb-0">
          <PrototypePill />
        </div>
        {children && <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">{children}</div>}
      </div>
    </header>
  );
}
