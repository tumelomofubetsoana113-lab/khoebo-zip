"""
Mock data generator for the RSL Taxathon 2026 entry (Challenge 1: informal sector).

Every record is synthetic. No real taxpayer data is used.

Each simulated trader has a hidden "true" situation that the officer never sees.
The officer-facing tool only sees what RSL could realistically hold or obtain:
  - filed returns (declared turnover, nil or not, on time or not)
  - wholesale purchases where the trader's TIN appears on a supplier's e-invoice
  - mobile money merchant receipts (needs an agreement with providers)
  - trading licence status (needs a data link with the licensing authority)
Noise is deliberate: personal transfers land in mobile money wallets, licences
are not cancelled when a business closes, some honest traders deal only in cash,
and some undeclared traders leave no third-party trace at all.
"""
import csv
import random
from pathlib import Path

MONTHS = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
          "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]

DISTRICTS = ["Maseru", "Leribe", "Berea", "Mafeteng", "Mohale's Hoek", "Quthing",
             "Qacha's Nek", "Mokhotlong", "Thaba-Tseka", "Butha-Buthe"]
DISTRICT_WEIGHTS = [30, 14, 12, 9, 8, 5, 4, 5, 5, 8]

# sector: (median monthly sales in maloti, cost-of-goods ratio range)
SECTORS = {
    "Fruit and vegetable stall": (5500, (0.60, 0.78)),
    "General dealer / spaza": (14000, (0.68, 0.82)),
    "Street food": (6000, (0.45, 0.60)),
    "Hair salon": (7000, (0.25, 0.40)),
    "Clothing reseller": (9000, (0.55, 0.70)),
    "Phone accessories and repair": (8000, (0.40, 0.60)),
}

# hidden situations and their share of the population
SITUATIONS = {
    "compliant": 0.36,        # trades all year, declares honestly
    "cash_only_honest": 0.10, # trades and declares honestly, leaves no digital trace
    "struggling": 0.08,       # honest, but sales falling sharply
    "seasonal": 0.12,         # trades only part of the year, nil returns otherwise
    "inactive": 0.12,         # stopped trading during the year
    "undeclared": 0.22,       # trades, but files nil or heavily under-declares
}

SEASONS = {
    "festive": ["2025-11", "2025-12", "2026-01"],
    "winter": ["2026-05", "2026-06", "2026-07", "2026-08"],
    "back_to_school": ["2026-01", "2026-02", "2026-03"],
}


def pick(weights_dict, rng):
    keys = list(weights_dict)
    return rng.choices(keys, weights=[weights_dict[k] for k in keys])[0]


def simulate(n_traders=300, seed=7):
    rng = random.Random(seed)
    traders, records = [], []

    for i in range(1, n_traders + 1):
        tid = f"TRD-{i:04d}"
        sector = rng.choice(list(SECTORS))
        median, (cogs_lo, cogs_hi) = SECTORS[sector]
        situation = pick(SITUATIONS, rng)
        base_sales = median * rng.lognormvariate(0, 0.45)
        cogs = rng.uniform(cogs_lo, cogs_hi)

        cash_only = situation == "cash_only_honest"
        # undeclared traders split: some visible to third parties, some not
        if situation == "undeclared" and rng.random() < 0.25:
            cash_only = True
        has_wallet = (not cash_only) and rng.random() < 0.70
        formal_supplier = (not cash_only) and rng.random() < 0.75
        momo_share = rng.uniform(0.20, 0.60)

        season_name = rng.choice(list(SEASONS)) if situation == "seasonal" else ""
        stop_month = rng.randint(1, 7) if situation == "inactive" else None
        licence_lag = rng.choice([0, 0, 3, 6, 12]) if situation == "inactive" else 0
        undeclared_mode = rng.choice(["nil", "nil", "nil", "under"]) if situation == "undeclared" else ""
        under_ratio = rng.uniform(0.15, 0.45)
        on_time_rate = rng.uniform(0.70, 0.98)
        filing_rate = rng.uniform(0.75, 0.99)
        # honest traders still round down or forget small sales
        honest_low, honest_high = (0.75, 1.03)
        # family remittances (often from South Africa) arrive in the same wallet
        gets_remittances = rng.random() < 0.25
        remittance_size = rng.uniform(800, 3500)
        # household shopping put through the business account inflates purchases
        household_on_business = rng.random() < 0.30
        household_factor = rng.uniform(1.15, 1.5)

        traders.append({
            "trader_id": tid,
            "mock_tin": f"MOCK-{rng.randint(100000, 999999)}",
            "sector": sector,
            "district": rng.choices(DISTRICTS, weights=DISTRICT_WEIGHTS)[0],
            "hidden_situation": situation,
            "hidden_season": season_name,
        })

        for m_idx, month in enumerate(MONTHS):
            seasonal_bump = 1.25 if month in ("2025-12",) else 1.0

            # ---- hidden truth ----
            if situation == "seasonal":
                trading = month in SEASONS[season_name]
            elif situation == "inactive":
                trading = m_idx < stop_month
            else:
                trading = True

            if not trading:
                true_sales = 0.0
            else:
                true_sales = base_sales * seasonal_bump * rng.uniform(0.8, 1.2)
                if situation == "struggling":
                    true_sales *= max(0.15, 1 - 0.07 * m_idx)

            # ---- what the trader declares ----
            if situation == "undeclared":
                declared = 0.0 if undeclared_mode == "nil" else true_sales * under_ratio
            else:
                declared = true_sales * rng.uniform(honest_low, honest_high)
            declared = round(declared, -1)
            filed = rng.random() < filing_rate
            on_time = filed and rng.random() < on_time_rate

            # ---- third-party signals RSL could see ----
            purchases = 0.0
            if formal_supplier:
                buy = true_sales * cogs * rng.uniform(0.85, 1.15)
                # seasonal traders stock up the month before their season starts
                if situation == "seasonal" and m_idx + 1 < len(MONTHS) \
                        and MONTHS[m_idx + 1] in SEASONS[season_name] and not trading:
                    buy = base_sales * cogs * 0.6
                if household_on_business and buy:
                    buy *= household_factor
                purchases = buy if rng.random() < 0.85 else 0.0  # TIN not always captured

            momo = 0.0
            if has_wallet:
                momo = true_sales * momo_share * rng.uniform(0.8, 1.2)
            if rng.random() < 0.35:  # small personal transfers: family, stokvel, etc.
                momo += rng.uniform(100, 900)
            if gets_remittances and rng.random() < 0.7:
                momo += remittance_size * rng.uniform(0.8, 1.2)

            licence_active = trading or (situation == "inactive" and m_idx < stop_month + licence_lag) \
                or (situation == "seasonal")

            records.append({
                "trader_id": tid,
                "month": month,
                "filed": int(filed),
                "filed_on_time": int(on_time),
                "declared_turnover": declared if filed else "",
                "einvoice_purchases": round(purchases, -1),
                "momo_wallet_inflows": round(momo, -1),
                "licence_active": int(licence_active),
                "hidden_true_sales": round(true_sales, -1),
            })

    return traders, records


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    traders, records = simulate()
    out = Path(__file__).parent / "data"
    write_csv(out / "traders.csv", traders)
    write_csv(out / "monthly_records.csv", records)
    print(f"{len(traders)} traders, {len(records)} monthly records written to {out}")
