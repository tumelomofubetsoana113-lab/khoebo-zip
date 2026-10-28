import { BarChart3, BellRing, CheckCircle2, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/Card";
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
              <Card className="h-full">
                <IconCircle icon={icons[i]} />
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
