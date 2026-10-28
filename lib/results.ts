// Headline figures for the landing page, worked out from data/test_results.json
// (written by the Python evaluation). Never type these numbers into a page.

type Stat = { mean: number; min: number; max: number };
type RunStats = { visits: Stat; caught: Stat; precision: Stat; recall: Stat };

export type TestResults = {
  demo_population_seed_7: { population: number };
  thirty_runs: {
    worklist_officer: RunStats;
    worklist_followup_only: RunStats;
    baseline_a_all_nil: RunStats;
  };
};

export type HeadlineFigures = {
  fewerCasesPct: number; // officer cases saved against following up every nil return
  followupPrecisionPct: number; // field visits that reached a real under-declarer
  found: number; // undeclared traders found per population
  foundByAllNil: number; // the same, following up every nil return
  population: number;
};

export function headlineFigures(results: TestResults): HeadlineFigures {
  const runs = results.thirty_runs;
  return {
    fewerCasesPct: Math.round(
      (1 - runs.worklist_officer.visits.mean / runs.baseline_a_all_nil.visits.mean) * 100,
    ),
    followupPrecisionPct: Math.round(runs.worklist_followup_only.precision.mean * 100),
    found: Math.round(runs.worklist_officer.caught.mean),
    foundByAllNil: Math.round(runs.baseline_a_all_nil.caught.mean),
    population: results.demo_population_seed_7.population,
  };
}
