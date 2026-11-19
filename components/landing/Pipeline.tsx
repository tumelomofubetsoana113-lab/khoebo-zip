import { ArrowRight, ClipboardCheck, FileCheck2, MessageSquare, Search, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { strings } from "@/lib/strings";
import { IconCircle } from "./IconCircle";
import { SectionHeading } from "./SectionHeading";

const t = strings.landing.pipeline;
const icons = [Search, Send, UserPlus, MessageSquare, FileCheck2, ClipboardCheck];

// The whole compliance pipeline, from finding an operator to staying
// compliant, with who does each step.
export function Pipeline() {
  return (
    <section id="pipeline" className="bg-surface px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={t.eyebrow} heading={t.heading} lead={t.lead} />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.steps.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-line bg-page p-5 transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-ink/5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <IconCircle icon={icons[i]} />
              <div>
                <h3 className="text-lg font-semibold">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-sm font-semibold text-brand">{step.by}</p>
                <p className="mt-1">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl">{t.who}</p>
        <Link
          href="/officer/leads"
          className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg font-semibold text-brand hover:underline"
        >
          {t.link}
          <ArrowRight size={18} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
