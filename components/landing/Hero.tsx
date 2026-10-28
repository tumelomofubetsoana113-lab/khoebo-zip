import { ButtonLink } from "@/components/ui/Button";
import { strings } from "@/lib/strings";
import { PhoneFrame } from "./PhoneFrame";

const t = strings.landing.hero;

export function Hero() {
  return (
    <section className="bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.eyebrow}</p>
          <h1 className="mt-3 text-[30px] font-bold leading-tight tracking-tight md:text-[40px]">
            {t.headline}
          </h1>
          <p className="mt-4 text-lg text-muted">{t.subline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/trader">{t.primary}</ButtonLink>
            <ButtonLink href="/officer" variant="secondary">
              {t.secondary}
            </ButtonLink>
          </div>
        </div>
        <PhoneFrame />
      </div>
    </section>
  );
}
