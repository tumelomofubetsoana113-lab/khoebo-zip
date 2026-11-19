import { ClipboardCheck, MessageSquare, Search, Send, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { PipelineFigures } from "@/lib/leads";
import { strings } from "@/lib/strings";

const t = strings.officer.pipeline;

// The whole compliance pipeline in one row, from finding an operator outside
// the tax net to following up a registered trader. Figures come from the two
// simulated lists; nothing is typed in.
export function PipelineStrip({ figures: f }: { figures: PipelineFigures }) {
  const stages: { icon: LucideIcon; title: string; value: string; detail: string; href?: string }[] = [
    { icon: Search, title: t.find.title, value: t.find.value(f.found), detail: t.find.detail(f.leads), href: "/officer/leads" },
    {
      icon: Send,
      title: t.reach.title,
      value: t.reach.value(f.invites, f.visits),
      detail: t.reach.detail,
      href: "/officer/leads?action=visit,invite",
    },
    { icon: UserPlus, title: t.register.title, value: t.register.value, detail: t.register.detail },
    { icon: MessageSquare, title: t.record.title, value: t.record.value(f.registered), detail: t.record.detail, href: "/trader" },
    {
      icon: ClipboardCheck,
      title: t.check.title,
      value: t.check.value(f.followUp),
      detail: t.check.detail(f.inLine),
      href: "/officer?action=followup,review,checkin",
    },
  ];

  return (
    <section aria-labelledby="pipeline-heading" className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="pipeline-heading" className="text-lg font-bold">
          {t.heading}
        </h2>
        <p className="text-sm text-muted">{t.note}</p>
      </div>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((s, i) => {
          const body = (
            <>
              <span className="flex items-center gap-2 text-sm font-semibold text-muted">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-surface">
                  <s.icon size={16} aria-hidden />
                </span>
                {i + 1}. {s.title}
              </span>
              <span className="mt-2 block font-bold">{s.value}</span>
              <span className="mt-1 block text-sm text-muted">{s.detail}</span>
            </>
          );
          return (
            <li key={s.title}>
              {s.href ? (
                <Link href={s.href} className="block h-full rounded-card border border-line bg-page p-3 hover:border-brand">
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-card border border-line bg-page p-3">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
