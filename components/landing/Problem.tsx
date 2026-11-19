import { Lightbulb } from "lucide-react";
import { strings } from "@/lib/strings";

const t = strings.landing.quote;

// The quote band under the hero: why Khoebo exists, in Khoebo's own words.
export function Problem() {
  return (
    <section className="bg-page px-4 pb-14 sm:px-6">
      <figure className="mx-auto flex max-w-6xl items-start gap-4 rounded-2xl border border-highlight/60 bg-highlight-soft p-6 sm:items-center sm:p-8">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-highlight/30 text-charcoal"
        >
          <Lightbulb size={24} />
        </span>
        <div>
          <blockquote className="text-lg italic leading-relaxed md:text-xl">&ldquo;{t.text}&rdquo;</blockquote>
          <figcaption className="mt-2 text-xs font-bold uppercase tracking-wide text-brand">{t.source}</figcaption>
        </div>
      </figure>
    </section>
  );
}
