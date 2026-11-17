import { ArrowRight, ClipboardCheck, FileCheck2, MessageSquare, Search, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { strings } from "@/lib/strings";
import { IconCircle } from "./IconCircle";

const t = strings.landing.pipeline;
const icons = [Search, Send, UserPlus, MessageSquare, FileCheck2, ClipboardCheck];

// The whole compliance pipeline, from finding an operator to staying
// compliant, with who does each step.
export function Pipeline() {
  return (
    <section id="pipeline" className="border-b border-line bg-surface px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold md:text-3xl">{t.heading}</h2>
        <p className="mt-3 max-w-3xl text-lg text-muted">{t.lead}</p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.steps.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-card border border-line bg-page p-5 transition duration-200 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-flag-blue/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <IconCircle icon={icons[i]} />
              <div>
                <h3 className="text-lg font-semibold">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-sm font-semibold text-green-text">{step.by}</p>
                <p className="mt-1">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl">{t.who}</p>
        <Link
          href="/officer/leads"
          className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-full font-semibold text-flag-blue hover:underline"
        >
          {t.link}
          <ArrowRight size={18} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
