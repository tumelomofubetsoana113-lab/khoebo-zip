import testResults from "@/data/test_results.json";
import { headlineFigures } from "@/lib/results";
import { strings } from "@/lib/strings";

const t = strings.landing.results;

// Every figure comes from data/test_results.json.
export function Results() {
  const f = headlineFigures(testResults);
  const figures = [
    { value: t.fewerCases(f.fewerCasesPct), label: t.fewerCasesLabel },
    { value: t.precision(f.followupPrecisionPct), label: t.precisionLabel },
    { value: t.found(f.found), label: t.foundLabel(f.population, f.foundByAllNil) },
  ];

  return (
    <section id="results" className="bg-surface px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold md:text-3xl">{t.heading}</h2>
        <ul className="mt-8 grid gap-8 md:grid-cols-3">
          {figures.map((fig) => (
            <li key={fig.value} className="border-l-4 border-flag-green pl-4">
              <p className="text-3xl font-bold text-flag-blue md:text-4xl">{fig.value}</p>
              <p className="mt-2 text-muted">{fig.label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted">{t.note(f.population)}</p>
      </div>
    </section>
  );
}
