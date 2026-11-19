import { Card } from "@/components/ui/Card";
import { ActionPill } from "@/components/ui/Pill";
import { strings, type ActionKey } from "@/lib/strings";
import { SectionHeading } from "./SectionHeading";

const t = strings.landing.officers;
const ex = t.example;
const order: ActionKey[] = ["followup", "review", "checkin", "none"];

export function ForOfficers() {
  return (
    <section id="for-officers" className="bg-page px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <SectionHeading eyebrow={t.eyebrow} heading={t.heading} lead={t.lead} />
          <ul className="mt-8 space-y-5">
            {order.map((action) => (
              <li key={action} className="space-y-1.5">
                <ActionPill action={action} />
                <p>{t.actions[action]}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* A mock reason card, styled like the officer detail page. */}
        <figure>
          <figcaption className="mb-2 text-sm text-muted">{ex.caption}</figcaption>
          <Card className="rounded-2xl shadow-lg shadow-ink/5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{ex.id}</p>
                <p className="text-sm text-muted">{ex.meta}</p>
              </div>
              <ActionPill action="followup" />
            </div>
            <h3 className="mt-5 font-semibold">{ex.whyHeading}</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {ex.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
              {ex.figures.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd className="mt-0.5 font-bold">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </figure>
      </div>
    </section>
  );
}
