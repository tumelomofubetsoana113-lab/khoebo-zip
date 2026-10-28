import { Languages, Lock, Smartphone, Wifi } from "lucide-react";
import { strings } from "@/lib/strings";
import { IconCircle } from "./IconCircle";

const t = strings.landing.lesotho;
const icons = [Smartphone, Wifi, Languages, Lock];

export function BuiltForLesotho() {
  return (
    <section className="bg-page px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold md:text-3xl">{t.heading}</h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2">
          {t.items.map((item, i) => (
            <li key={item.title} className="flex gap-4">
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
