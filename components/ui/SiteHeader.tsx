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
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-3xl border border-line bg-surface px-4 py-2 shadow-lg shadow-ink/5 sm:rounded-full sm:pl-5 sm:pr-2">
        <div className="flex min-w-0 flex-col items-start gap-x-3 pb-1 sm:flex-row sm:pb-0 sm:items-center">
          <Wordmark />
          <PrototypePill />
        </div>
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
