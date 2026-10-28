import { ButtonLink } from "@/components/ui/Button";
import { strings } from "@/lib/strings";

const t = strings.landing.closing;

export function ClosingBand() {
  return (
    <section className="bg-flag-blue px-4 py-16 text-surface sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center">
        <h2 className="text-2xl font-bold md:text-3xl">{t.heading}</h2>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/trader" variant="inverse">
            {t.chat}
          </ButtonLink>
          <ButtonLink href="/officer" variant="inverse-outline">
            {t.officer}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
