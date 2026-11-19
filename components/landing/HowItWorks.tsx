import { BarChart3, BellRing, CheckCircle2, Mic } from "lucide-react";
import { strings } from "@/lib/strings";
import { SectionHeading } from "./SectionHeading";

const t = strings.landing.howItWorks;
const icons = [Mic, BarChart3, BellRing, CheckCircle2];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-page px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={t.eyebrow} heading={t.heading} lead={t.lead} side />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((step, i) => {
            const Icon = icons[i];
            return (
              <li
                key={step.title}
                className="flex flex-col rounded-2xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-ink/5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-lg bg-brand-soft font-bold text-brand"
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 flex-1 text-muted">{step.body}</p>
                <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-sm font-medium text-brand">
                  <Icon size={16} aria-hidden="true" />
                  {step.footer}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
