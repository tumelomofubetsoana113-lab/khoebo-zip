"""
Writes the two JSON files the app reads (run with `npm run data`):

  data/worklist.json     the officer worklist: 300 simulated traders (seed 7)
                         plus the three demo traders, with actions, reasons
                         and per-month figures
  data/test_results.json the landing page figures: the worklist against
                         following up every nil return, over 30 populations

Fails loudly if a demo trader lands on the wrong action, or if any hidden_*
field would reach the app. Uses only the Python standard library.
"""
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from demo_cases import DEMO_TRADERS, demo_records
from evaluate import thirty_runs
from simulate import simulate
from worklist import WINDOW, assess

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ACTIONS = ["OFFICER FOLLOW-UP", "HUMAN REVIEW", "AUTOMATED CHECK-IN", "NO ACTION"]


def fail(message):
    print(f"export_worklist: {message}", file=sys.stderr)
    sys.exit(1)


def trader_entry(trader_id, sector, district, label, rows):
    res = assess(rows)
    return {
        "id": trader_id,
        "label": label,
        "sector": sector,
        "district": district,
        "action": res["action"],
        "reasons": res["reasons"],
        "metrics": {
            "declared": res["declared_6m"],
            "evidenceMin": res["est_min_sales_6m"],
            "ratio": res["ratio"],
            "evidenceMonths": res["trading_evidence_months"],
            "nilReturns": res["nil_returns_6m"],
            "missingReturns": res["missing_returns_6m"],
            "licenceActive": res["licence_active"],
        },
        "months": [
            {
                "month": m["month"],
                "declared": m["declared"],
                "purchases": m["purchases"],
                "walletInflows": m["wallet_inflows"],
                "evidenceMin": m["evidence_min"],
                "filed": m["filed"],
                "onTime": m["on_time"],
            }
            for m in res["months"]
        ],
    }


def hidden_keys(value, path="$"):
    """Every key starting with hidden_, anywhere in the structure."""
    found = []
    if isinstance(value, dict):
        for k, v in value.items():
            if str(k).startswith("hidden_"):
                found.append(f"{path}.{k}")
            found += hidden_keys(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            found += hidden_keys(v, f"{path}[{i}]")
    return found


def build_worklist():
    traders, records = simulate(seed=7)
    by_trader = {}
    for r in records:
        by_trader.setdefault(r["trader_id"], []).append(r)

    out = [trader_entry(t["trader_id"], t["sector"], t["district"], None, by_trader[t["trader_id"]])
           for t in traders]

    demo_rows = demo_records()
    for d in DEMO_TRADERS:
        entry = trader_entry(d["trader_id"], d["sector"], d["district"], d["label"],
                             demo_rows[d["trader_id"]])
        if entry["action"] not in d["expected"]:
            fail(f"{d['trader_id']} landed on {entry['action']}, expected one of "
                 f"{sorted(d['expected'])}. Reasons: {entry['reasons']}")
        out.append(entry)

    order = {a: i for i, a in enumerate(ACTIONS)}
    out.sort(key=lambda t: (order[t["action"]],
                            -(t["metrics"]["evidenceMin"] - t["metrics"]["declared"]), t["id"]))

    counts = Counter(t["action"] for t in out)
    worklist = {
        "generatedAt": date.today().isoformat(),
        "window": WINDOW,
        "simulated": len(traders),
        "counts": {a: counts.get(a, 0) for a in ACTIONS},
        "pinned": [d["trader_id"] for d in DEMO_TRADERS],
        "traders": out,
    }
    return worklist


def build_test_results():
    def tidy(value):
        if isinstance(value, float):
            return round(value, 4)
        if isinstance(value, dict):
            return {k: tidy(v) for k, v in value.items()}
        return value

    traders, _ = simulate(seed=7)
    return {
        "generatedAt": date.today().isoformat(),
        "demo_population_seed_7": {"population": len(traders)},
        "thirty_runs": tidy(thirty_runs()),
    }


def write(path, data):
    leaks = hidden_keys(data)
    if leaks:
        fail(f"hidden fields would reach the app in {path.name}: {', '.join(leaks[:5])}")
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    DATA.mkdir(exist_ok=True)
    worklist = build_worklist()
    write(DATA / "worklist.json", worklist)
    results = build_test_results()
    write(DATA / "test_results.json", results)

    print(f"worklist.json: {len(worklist['traders'])} traders, {worklist['counts']}")
    for tid in worklist["pinned"]:
        t = next(t for t in worklist["traders"] if t["id"] == tid)
        print(f"  {tid}: {t['action']}")
    runs = results["thirty_runs"]
    print(f"test_results.json: officer cases {runs['worklist_officer']['visits']['mean']} "
          f"vs all-nil {runs['baseline_a_all_nil']['visits']['mean']}, "
          f"follow-up precision {runs['worklist_followup_only']['precision']['mean']}")
