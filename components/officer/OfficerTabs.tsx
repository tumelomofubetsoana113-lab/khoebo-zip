import Link from "next/link";
import { strings } from "@/lib/strings";

const t = strings.officer.tabs;

// Switches between the two officer lists: registered traders (the worklist)
// and potential registrants (operators outside the tax net).
export function OfficerTabs({ current }: { current: "traders" | "leads" }) {
  const tabs = [
    { id: "traders", href: "/officer", label: t.traders },
    { id: "leads", href: "/officer/leads", label: t.leads },
  ] as const;
  return (
    <nav aria-label={t.label} className="flex gap-1 rounded-full border border-line bg-surface p-1 sm:inline-flex">
      {tabs.map((tab) => {
        const on = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-center text-sm font-semibold sm:flex-none ${
              on ? "bg-flag-blue text-surface" : "text-flag-blue hover:bg-page"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
