"""
Explainable officer worklist for the RSL Taxathon prototype (Challenge 1).

Uses only data RSL could hold or obtain (filed returns, supplier e-invoices that
carry the trader's TIN, mobile money merchant receipts, licence status). It never
reads the hidden_* columns; those exist only to score the results afterwards.

Every trader gets one of four actions, with reasons written in plain language:
  OFFICER FOLLOW-UP   strong, repeated evidence of trading well above what was declared
  HUMAN REVIEW        some evidence, but mixed or thin; an officer decides
  AUTOMATED CHECK-IN  nil returns and no trading evidence; send a friendly message
                      asking whether the business is still running (no visit)
  NO ACTION           declarations line up with the evidence, or a nil period is
                      explained by no activity (seasonal or closed)
"""
from collections import defaultdict

WINDOW = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
MOMO_PERSONAL_FLOOR = 1000   # ignore small wallet inflows, likely personal transfers
PURCHASE_FLOOR = 500


def money(x):
    return f"M{x:,.0f}"


def num(v):
    return float(v) if v not in ("", None) else 0.0


def assess(trader_rows):
    rows = sorted(trader_rows, key=lambda r: r["month"])
    win = [r for r in rows if r["month"] in WINDOW]

    declared = sum(num(r["declared_turnover"]) for r in win)
    filed = [r for r in win if r["filed"] in (1, "1")]
    nil_months = [r["month"] for r in filed if num(r["declared_turnover"]) == 0]
    missing = [r["month"] for r in win if r["filed"] in (0, "0")]

    purchases = sum(num(r["einvoice_purchases"]) for r in win)
    momo_trade = sum(num(r["momo_wallet_inflows"]) for r in win
                     if num(r["momo_wallet_inflows"]) > MOMO_PERSONAL_FLOOR)
    signal_months = [r["month"] for r in win
                     if num(r["einvoice_purchases"]) > PURCHASE_FLOOR
                     or num(r["momo_wallet_inflows"]) > MOMO_PERSONAL_FLOOR]
    # purchases are a conservative floor for sales (goods are sold above cost);
    # mobile money receipts are a floor too (part of sales arrive in cash)
    est_min_sales = max(purchases, momo_trade)
    ratio = declared / est_min_sales if est_min_sales else None

    purchase_months = [r["month"] for r in win if num(r["einvoice_purchases"]) > PURCHASE_FLOOR]
    nil_with_signal = [m for m in nil_months if m in signal_months]
    recent_nil = [r["month"] for r in filed[-3:] if num(r["declared_turnover"]) == 0]
    licence_active_now = win[-1]["licence_active"] in (1, "1")

    reasons = []
    if purchases:
        reasons.append(f"Supplier e-invoices show {money(purchases)} of stock bought May to Oct 2026.")
    if momo_trade:
        reasons.append(f"Mobile money wallet inflows above M1,000 total {money(momo_trade)} over the same months.")
    reasons.append(f"Declared turnover for the period: {money(declared)}"
                   + (f" ({len(nil_months)} nil returns)." if nil_months else "."))

    strong = (len(signal_months) >= 3 and est_min_sales >= 3000
              and ratio is not None and ratio < 0.5)
    if strong and len(purchase_months) >= 2:
        action = "OFFICER FOLLOW-UP"
        reasons.append(f"Trading evidence in {len(signal_months)} of 6 months; declared turnover is "
                       f"{ratio:.0%} of the minimum the evidence suggests.")
    elif strong:
        # guardrail: wallet inflows alone can be remittances or family support
        action = "HUMAN REVIEW"
        reasons.append("Declared turnover is well below the evidence, but most of the evidence is "
                       "mobile money, which can include remittances or family support. "
                       "An officer should check before any visit.")
    elif signal_months and est_min_sales >= 1500 and ratio is not None and ratio < 0.8:
        action = "HUMAN REVIEW"
        reasons.append("Some evidence of trading above what was declared, but it is thin or mixed. "
                       "Could be stock-building, personal transfers or a late filing.")
    elif len(recent_nil) >= 3 and not nil_with_signal:
        action = "AUTOMATED CHECK-IN"
        reasons.append("Last three returns were nil and there is no trading evidence in those months. "
                       "Likely closed or between seasons. Ask the trader to confirm; offer dormant status.")
        if licence_active_now:
            reasons.append("Trading licence is still active, which on its own is weak evidence "
                           "(licences are often not cancelled when a business stops).")
    else:
        action = "NO ACTION"
        if nil_months and not nil_with_signal:
            reasons.append("Nil months match months with no trading evidence: consistent with a "
                           "seasonal or temporary break, not hidden trading.")
        else:
            reasons.append("Declarations are in line with the available evidence.")

    if len(missing) >= 2:
        reasons.append(f"{len(missing)} returns missing in the period: send a filing reminder.")

    return {
        "action": action,
        "declared_6m": round(declared),
        "est_min_sales_6m": round(est_min_sales),
        "declared_vs_evidence": "" if ratio is None else f"{ratio:.0%}",
        "trading_evidence_months": len(signal_months),
        "nil_returns_6m": len(nil_months),
        "missing_returns_6m": len(missing),
        "reasons": " ".join(reasons),
    }


def build_worklist(traders, records):
    by_trader = defaultdict(list)
    for r in records:
        by_trader[r["trader_id"]].append(r)
    out = []
    for t in traders:
        res = assess(by_trader[t["trader_id"]])
        out.append({"trader_id": t["trader_id"], "sector": t["sector"],
                    "district": t["district"], **res})
    order = {"OFFICER FOLLOW-UP": 0, "HUMAN REVIEW": 1, "AUTOMATED CHECK-IN": 2, "NO ACTION": 3}
    out.sort(key=lambda r: (order[r["action"]], -(r["est_min_sales_6m"] - r["declared_6m"])))
    return out
