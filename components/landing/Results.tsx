import testResults from "@/data/test_results.json";
import { headlineFigures, type TestResults } from "@/lib/results";
import { strings } from "@/lib/strings";
import { SectionHeading } from "./SectionHeading";

const t = strings.landing.results;

// Every figure comes from data/test_results.json.
export function Results() {
  const results: TestResults = testResults;
  const f = headlineFigures(results);
  const figures = [
    { value: t.fewerCases(f.fewerCasesPct), label: t.fewerCasesLabel },
    { value: t.precision(f.followupPrecisionPct), label: t.precisionLabel },
    { value: t.found(f.found), label: t.foundLabel(f.population, f.foundByAllNil) },
  ];

  return (
    <section id="results" className="bg-page px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow={t.eyebrow} heading={t.heading} />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {figures.map((fig) => (
            <li key={fig.value} className="rounded-2xl border border-line border-l-4 border-l-brand-bright bg-surface p-5">
              <p className="text-3xl font-extrabold tracking-tight text-brand md:text-4xl">{fig.value}</p>
              <p className="mt-2 text-muted">{fig.label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-sm text-muted">{t.note(f.population)}</p>
        {results.stub === true && (
          <p className="mt-2 text-center text-sm font-semibold text-status-followup">{t.stubNote}</p>
        )}
      </div>
    </section>
  );
}
