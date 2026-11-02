"""
Scores the worklist against two baselines on simulated data.

Baseline A: "follow up every trader with a nil return" (treats every nil return
            as suspect, which the Call for Innovation asks teams to avoid).
Baseline B: random follow-up, same number of officer visits as the worklist.

A trader "needs follow-up" if their hidden situation is undeclared trading.
Results are averaged over 30 simulated populations so one lucky draw cannot
flatter the method.
"""
import csv
import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from simulate import simulate, write_csv
from worklist import build_worklist, WINDOW, num

OFFICER = {"OFFICER FOLLOW-UP", "HUMAN REVIEW"}


def score(traders, records):
    truth = {t["trader_id"]: t["hidden_situation"] for t in traders}
    positives = {k for k, v in truth.items() if v == "undeclared"}
    wl = build_worklist(traders, records)

    officer = {r["trader_id"] for r in wl if r["action"] in OFFICER}
    followup = {r["trader_id"] for r in wl if r["action"] == "OFFICER FOLLOW-UP"}

    nil_any = defaultdict(bool)
    for r in records:
        if r["month"] in WINDOW and r["filed"] == 1 and num(r["declared_turnover"]) == 0:
            nil_any[r["trader_id"]] = True
    baseline_a = {k for k, v in nil_any.items() if v}

    def stats(selected):
        tp = len(selected & positives)
        return {
            "visits": len(selected),
            "caught": tp,
            "precision": tp / len(selected) if selected else 0,
            "recall": tp / len(positives) if positives else 0,
            "wasted_on": dict(Counter(truth[k] for k in selected - positives)),
        }

    prevalence = len(positives) / len(truth)
    res = {
        "population": len(truth),
        "undeclared": len(positives),
        "worklist_officer": stats(officer),
        "worklist_followup_only": stats(followup),
        "baseline_a_all_nil": stats(baseline_a),
        "baseline_b_random": {
            "visits": len(officer),
            "caught": round(len(officer) * prevalence, 1),
            "precision": prevalence,
            "recall": len(officer) / len(truth),
        },
        "missed_undeclared_by_action": dict(Counter(
            r["action"] for r in wl if r["trader_id"] in positives and r["trader_id"] not in officer)),
        "actions_by_situation": {
            s: dict(Counter(r["action"] for r in wl if truth[r["trader_id"]] == s))
            for s in sorted(set(truth.values()))
        },
    }
    return wl, res


APPROACHES = ["worklist_officer", "worklist_followup_only", "baseline_a_all_nil", "baseline_b_random"]


def thirty_runs(seeds=range(1, 31)):
    """Mean, min and max of each approach's results over 30 simulated populations."""
    runs = [score(*simulate(seed=s))[1] for s in seeds]

    def agg(get):
        vals = [get(r) for r in runs]
        return {"mean": statistics.mean(vals), "min": min(vals), "max": max(vals)}

    out = {name: {m: agg(lambda r, n=name, m=m: r[n][m])
                  for m in ["visits", "caught", "precision", "recall"]}
           for name in APPROACHES}
    out["undeclared_per_population"] = agg(lambda r: r["undeclared"])
    return out


if __name__ == "__main__":
    base = Path(__file__).parent

    # one population, saved in full for the demo
    traders, records = simulate(seed=7)
    write_csv(base / "data" / "traders.csv", traders)
    write_csv(base / "data" / "monthly_records.csv", records)
    wl, demo = score(traders, records)
    # reasons are a list and months a nested list; flatten them for the CSV
    write_csv(base / "outputs" / "worklist.csv",
              [{**{k: v for k, v in r.items() if k != "months"}, "reasons": " ".join(r["reasons"])}
               for r in wl])

    # 30 populations for the headline numbers
    summary = {"demo_population_seed_7": demo, "thirty_runs": thirty_runs()}

    (base / "outputs").mkdir(exist_ok=True)
    with open(base / "outputs" / "test_results.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))
