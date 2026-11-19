import { ArrowRight, CheckCircle2, LayoutList } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { strings } from "@/lib/strings";

const t = strings.landing.hero;
const c = t.card;

// A static example of the chat, beside the headline. Not tool output.
function ExampleChat() {
  return (
    <figure
      aria-label={t.phoneLabel}
      className="mx-auto w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-ink/10"
    >
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand"
        >
          {c.initials}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-semibold">{c.title}</p>
          <p className="text-sm text-muted">{c.subtitle}</p>
        </div>
        <span className="rounded-md bg-page px-2 py-0.5 text-xs font-semibold text-muted">{c.status}</span>
      </div>

      <div className="space-y-3 py-4">
        <div className="max-w-[85%] rounded-xl bg-page px-4 py-3">
          <p lang="st">&ldquo;{c.trader}&rdquo;</p>
          <p className="mt-0.5 text-xs text-muted">
            {c.translation} · {c.time}
          </p>
        </div>
        <div className="ml-auto max-w-[85%] rounded-xl border border-brand-bright/30 bg-brand-soft px-4 py-3">
          <p className="font-semibold text-brand">{c.replyTitle}</p>
          <p className="mt-0.5 text-sm text-muted">{c.replyBody}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="font-medium">{c.footer}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-brand">
          {c.review}
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </figure>
  );
}

export function Hero() {
  return (
    <section className="bg-page">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium">
            <span aria-hidden="true" className="size-2 rounded-full bg-brand-bright" />
            {t.eyebrow}
          </p>
          <h1 className="mt-5 text-[34px] font-extrabold leading-[1.08] tracking-tight md:text-[52px]">
            {t.headlineStart} <span className="text-brand">{t.headlineAccent}</span>
          </h1>
          <p className="mt-5 text-lg text-muted">{t.subline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/trader">
              {t.primary}
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/officer" variant="outline">
              {t.secondary}
              <LayoutList size={18} aria-hidden="true" />
            </ButtonLink>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {t.checks.map((check) => (
              <li key={check} className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={16} aria-hidden="true" className="text-brand" />
                {check}
              </li>
            ))}
          </ul>
        </div>
        <ExampleChat />
      </div>
    </section>
  );
}
