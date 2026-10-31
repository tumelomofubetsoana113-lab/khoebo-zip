import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { strings } from "@/lib/strings";
import { PhoneFrame } from "./PhoneFrame";
import maloti from "@/public/landing/maloti.jpg";

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
        {/* Maloti photo in a rounded panel, with the phone standing on it */}
        <div className="relative overflow-hidden rounded-[32px] px-4 py-8 sm:py-10">
          <Image
            src={maloti}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="(min-width: 768px) 560px, 100vw"
            className="object-cover"
          />
          <div className="relative">
            <PhoneFrame />
          </div>
        </div>
      </div>
    </section>
  );
}
