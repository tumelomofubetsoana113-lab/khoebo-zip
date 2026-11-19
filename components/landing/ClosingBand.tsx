import { ArrowRight, LayoutList } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { strings } from "@/lib/strings";

const t = strings.landing.closing;

export function ClosingBand() {
  return (
    <section className="bg-page px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl bg-charcoal px-6 py-12 text-surface shadow-xl shadow-ink/10 md:flex-row md:items-center md:justify-between md:px-12">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">{t.heading}</h2>
          <p className="mt-2 max-w-lg text-surface/70">{t.body}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/trader">
            {t.chat}
            <ArrowRight size={18} aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="/officer" variant="inverse-outline">
            {t.officer}
            <LayoutList size={18} aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
