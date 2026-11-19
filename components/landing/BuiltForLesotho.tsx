import { Languages, Lock, Smartphone, Wifi } from "lucide-react";
import { strings } from "@/lib/strings";
import { IconCircle } from "./IconCircle";
import { SectionHeading } from "./SectionHeading";

const t = strings.landing.lesotho;
const icons = [Smartphone, Wifi, Languages, Lock];

export function BuiltForLesotho() {
  return (
    <section className="bg-surface px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={t.eyebrow} heading={t.heading} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {t.items.map((item, i) => (
            <li key={item.title} className="flex gap-4 rounded-2xl border border-line bg-page p-5">
              <IconCircle icon={icons[i]} />
              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
