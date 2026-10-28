import Link from "next/link";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";
import { PrototypePill } from "./Pill";

export function Wordmark() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center rounded text-xl font-bold text-flag-blue">
      {strings.brand.name}
    </Link>
  );
}

// Sticky white header shared by the landing and officer pages.
// Page-specific links and buttons go in `children` on the right.
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 flex-col items-start gap-x-3 pb-1 sm:flex-row sm:pb-0 sm:items-center">
          <Wordmark />
          <PrototypePill />
        </div>
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
