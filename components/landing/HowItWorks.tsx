import { BarChart3, BellRing, CheckCircle2, MessageSquare } from "lucide-react";
import { strings } from "@/lib/strings";
import { IconCircle } from "./IconCircle";

const t = strings.landing.howItWorks;
const icons = [MessageSquare, BarChart3, BellRing, CheckCircle2];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold md:text-3xl">{t.heading}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((step, i) => (
            <li key={step.title}>
              {/* Not <Card>: its white background would override the blue */}
              <div className="h-full rounded-card bg-flag-blue p-5 text-surface transition duration-200 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-flag-blue/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <IconCircle icon={icons[i]} inverse />
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-surface/85">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
