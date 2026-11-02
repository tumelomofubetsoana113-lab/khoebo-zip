"""
The three named demo traders from the concept note, built month by month.

Each one has the same columns as the simulated monthly records, so it goes
through exactly the same rules (worklist.assess). None of them has hidden_*
columns: they are written to show a case, not to be scored.

  DEMO-ORDINARY  fruit and vegetable seller, Maseru. Declares honestly and buys
                 from a formal supplier. Expected: NO ACTION.
  DEMO-SEASONAL  blanket seller, Mokhotlong. Trades May to August only and files
                 nil returns otherwise, with no purchases or wallet inflows in the
                 off months. Expected: NO ACTION, or AUTOMATED CHECK-IN if the last
                 three returns are nil.
  DEMO-REVIEW    general dealer, Berea. Nil returns, about M3,000 a month of
                 wallet inflows, no supplier invoices. Expected: HUMAN REVIEW.
"""
import random

from simulate import MONTHS

SEASON = ["2026-05", "2026-06", "2026-07", "2026-08"]


def _r10(x):
    return round(x, -1)


def _row(tid, month, declared, purchases, momo, filed=True, on_time=True, licence=True):
    return {
        "trader_id": tid,
        "month": month,
        "filed": int(filed),
        "filed_on_time": int(filed and on_time),
        "declared_turnover": _r10(declared) if filed else "",
        "einvoice_purchases": _r10(purchases),
        "momo_wallet_inflows": _r10(momo),
        "licence_active": int(licence),
    }


def ordinary(rng):
    tid = "DEMO-ORDINARY"
    rows = []
    for m in MONTHS:
        sales = 5600 * rng.uniform(0.9, 1.1)
        rows.append(_row(tid, m,
                         declared=sales * rng.uniform(0.95, 1.0),
                         purchases=sales * 0.68 * rng.uniform(0.95, 1.05),
                         momo=sales * 0.3 * rng.uniform(0.9, 1.1)))
    return rows


def seasonal(rng):
    tid = "DEMO-SEASONAL"
    rows = []
    for m in MONTHS:
        if m in SEASON:
            sales = 12500 * rng.uniform(0.9, 1.15)
            rows.append(_row(tid, m,
                             declared=sales * rng.uniform(0.95, 1.0),
                             purchases=sales * 0.62 * rng.uniform(0.95, 1.05),
                             momo=sales * 0.35 * rng.uniform(0.9, 1.1)))
        else:
            # nil return, and nothing coming in or going out
            rows.append(_row(tid, m, declared=0, purchases=0, momo=0))
    return rows


def review(rng):
    tid = "DEMO-REVIEW"
    rows = []
    for m in MONTHS:
        rows.append(_row(tid, m, declared=0, purchases=0,
                         momo=3000 * rng.uniform(0.9, 1.1)))
    return rows


DEMO_TRADERS = [
    {"trader_id": "DEMO-ORDINARY", "sector": "Fruit and vegetable stall", "district": "Maseru",
     "label": "Fruit and vegetable seller, Maseru",
     "expected": {"NO ACTION"}, "build": ordinary},
    {"trader_id": "DEMO-SEASONAL", "sector": "Clothing reseller", "district": "Mokhotlong",
     "label": "Blanket seller, Mokhotlong (trades in winter)",
     "expected": {"NO ACTION", "AUTOMATED CHECK-IN"}, "build": seasonal},
    {"trader_id": "DEMO-REVIEW", "sector": "General dealer / spaza", "district": "Berea",
     "label": "General dealer, Berea",
     "expected": {"HUMAN REVIEW"}, "build": review},
]


def demo_records(seed=2026):
    """Monthly records for the three demo traders, the same on every run."""
    rng = random.Random(seed)
    return {d["trader_id"]: d["build"](rng) for d in DEMO_TRADERS}
