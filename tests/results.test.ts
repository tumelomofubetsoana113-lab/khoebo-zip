import { describe, expect, it } from "vitest";
import testResults from "@/data/test_results.json";
import { headlineFigures, type TestResults } from "@/lib/results";

const stat = (mean: number) => ({ mean, min: mean, max: mean });
const run = (visits: number, caught: number, precision: number) => ({
  visits: stat(visits),
  caught: stat(caught),
  precision: stat(precision),
  recall: stat(0),
});

describe("headlineFigures", () => {
  it("works out the three landing figures", () => {
    const results: TestResults = {
      demo_population_seed_7: { population: 300 },
      thirty_runs: {
        worklist_officer: run(75, 47.9, 0.64),
        worklist_followup_only: run(33.5, 32.3, 0.956),
        baseline_a_all_nil: run(120, 49.2, 0.4),
      },
    };
    expect(headlineFigures(results)).toEqual({
      fewerCasesPct: 38, // 1 - 75/120 = 37.5%, rounded
      followupPrecisionPct: 96,
      found: 48,
      foundByAllNil: 49,
      population: 300,
    });
  });

  it("reads the committed results file", () => {
    const figures = headlineFigures(testResults);
    expect(figures.population).toBe(300);
    expect(figures.fewerCasesPct).toBeGreaterThan(0);
    expect(figures.followupPrecisionPct).toBeLessThanOrEqual(100);
  });
});
