import { strings } from "@/lib/strings";

export function Problem() {
  return (
    <section className="bg-page px-4 py-14 sm:px-6">
      <p className="mx-auto max-w-[640px] text-center text-xl leading-relaxed">
        {strings.landing.problem}
      </p>
    </section>
  );
}
