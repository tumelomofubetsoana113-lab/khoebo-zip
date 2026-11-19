import type { ReactNode } from "react";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";

// The log-in and sign-up pages: the floating header, one white card, the footer.
export function AuthShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <SiteHeader />
      <main className="flex flex-1 justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-muted">{intro}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
