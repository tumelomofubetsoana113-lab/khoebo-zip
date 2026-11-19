"""
Writes the two JSON files the app reads (run with `npm run data`):

  data/worklist.json     the officer worklist: 300 simulated traders (seed 7)
                         plus the three demo traders, with actions, reasons
                         and per-month figures
  data/test_results.json the landing page figures: the worklist against
                         following up every nil return, over 30 populations
  data/leads.json        potential registrants: 200 simulated operators outside
                         the tax net (seed 11) plus four demo leads, with
                         actions, reasons, and the rules scored over 30
                         populations (added 17 November 2026)

Fails loudly if a demo trader or demo lead lands on the wrong action, or if any hidden_*
field would reach the app. Uses only the Python standard library.
"""
import hashlib
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from demo_cases import DEMO_TRADERS, demo_records
from evaluate import thirty_runs
from leads import LEAD_ACTIONS, assess_lead, demo_leads, simulate_leads, thirty_lead_runs
from simulate import simulate
from worklist import WINDOW, assess

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ACTIONS = ["OFFICER FOLLOW-UP", "HUMAN REVIEW", "AUTOMATED CHECK-IN", "NO ACTION"]


def fail(message):
    print(f"export_worklist: {message}", file=sys.stderr)
    sys.exit(1)


def national_id(trader_id):
    """The trader's 12-digit national ID, as RSL's records would show it
    (owner's decision, 19 November 2026). Made up, and worked out from the
    simulation's own ID with a hash, so the simulation and its random numbers
    are untouched and every export gives the same IDs."""
    digest = hashlib.sha256(f"khoebo-national-id:{trader_id}".encode()).hexdigest()
    return f"{int(digest, 16) % 10**12:012d}"


def trader_entry(trader_id, sector, district, label, rows):
    res = assess(rows)
    return {
        "id": national_id(trader_id),
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

    if len({t["id"] for t in out}) != len(out):
        fail("two traders got the same national ID")

    counts = Counter(t["action"] for t in out)
    worklist = {
        "generatedAt": date.today().isoformat(),
        "window": WINDOW,
        "simulated": len(traders),
        "counts": {a: counts.get(a, 0) for a in ACTIONS},
        "pinned": [national_id(d["trader_id"]) for d in DEMO_TRADERS],
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


def lead_entry(lead, label=None):
    res = assess_lead(lead)
    return {
        "id": lead["lead_id"],
        "label": label,
        "kind": lead["kind"],
        "district": lead["district"],
        "action": res["action"],
        "reasons": res["reasons"],
        "sources": res["sources"],
        "activeMonths": res["active_months"],
        "phone": res["phone"],
    }


def build_leads():
    simulated = simulate_leads(seed=11)
    out = [lead_entry(l) for l in simulated]
    for d in demo_leads():
        entry = lead_entry(d, d["label"])
        if entry["action"] != d["expected"]:
            fail(f"{d['lead_id']} landed on {entry['action']}, expected {d['expected']}. "
                 f"Reasons: {entry['reasons']}")
        out.append(entry)

    order = {a: i for i, a in enumerate(LEAD_ACTIONS)}
    out.sort(key=lambda l: (order[l["action"]], -l["activeMonths"], l["id"]))
    counts = Counter(l["action"] for l in out)
    runs = thirty_lead_runs()
    keep = ["leads", "active_unregistered", "visits", "invites", "visit_precision", "contact_precision",
            "reached", "registered_contacted", "baseline_visits", "baseline_precision"]
    return {
        "generatedAt": date.today().isoformat(),
        "window": WINDOW,
        "simulated": len(simulated),
        "counts": {a: counts.get(a, 0) for a in LEAD_ACTIONS},
        "pinned": [d["lead_id"] for d in demo_leads()],
        "leads": out,
        "thirtyRuns": {k: runs[k] for k in keep},
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
    leads = build_leads()
    write(DATA / "leads.json", leads)

    print(f"worklist.json: {len(worklist['traders'])} traders, {worklist['counts']}")
    for tid in worklist["pinned"]:
        t = next(t for t in worklist["traders"] if t["id"] == tid)
        print(f"  {tid}: {t['action']}")
    runs = results["thirty_runs"]
    print(f"test_results.json: officer cases {runs['worklist_officer']['visits']['mean']} "
          f"vs all-nil {runs['baseline_a_all_nil']['visits']['mean']}, "
          f"follow-up precision {runs['worklist_followup_only']['precision']['mean']}")
    lr = leads["thirtyRuns"]
    print(f"leads.json: {len(leads['leads'])} leads, {leads['counts']}")
    print(f"  field visits {lr['visits']['mean']} vs {lr['baseline_visits']['mean']}, "
          f"visit precision {lr['visit_precision']['mean']}, reached {lr['reached']['mean']}")
