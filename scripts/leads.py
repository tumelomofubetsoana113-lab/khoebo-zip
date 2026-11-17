"""
Potential registrants: finding informal operators who aren't in the tax net yet.

Added on 17 November 2026, after RSL asked at the meet and greet how Khoebo would
find and identify informal operators, including runners, couriers, flea market and
online sellers. Today officers walk the streets to find them.

Every record is synthetic. No real data is used.

Each simulated operator is NOT registered with RSL as far as RSL's records show.
The rules only see signals RSL could hold or obtain through data agreements:

  einvoice     supplier e-invoices (Lekuka) issued to a buyer with no tax number
  momo         mobile money merchant or till payments, with the number of payers
  stall        a trading licence or a council market stall allocation with no tax number
  border       goods declared at a border post (runners bring goods in for clients)
  courier      parcels sent or delivered through a courier partner
  match        the phone number on a signal matches a registered taxpayer

Each operator also has a hidden_situation used only to score the rules afterwards.
The export never passes it to the app.

Every lead gets one of four actions, with reasons in plain language:
  FIELD VISIT          trading evidence, and no phone number to reach them, or an
                       earlier invitation went unanswered
  INVITE TO REGISTER   trading evidence and a phone number: a friendly message with a
                       Khoebo link that walks them through registering
  POSSIBLE MATCH       may already be registered; an officer checks before anyone is
                       contacted, so nobody is asked to register twice
  NOT ENOUGH EVIDENCE  one weak signal, or signals that fit personal money or a
                       business that has stopped. No contact.
"""
import random
import statistics

from worklist import WINDOW

DISTRICTS = ["Maseru", "Leribe", "Berea", "Mafeteng", "Mohale's Hoek", "Quthing",
             "Qacha's Nek", "Mokhotlong", "Thaba-Tseka", "Butha-Buthe"]
DISTRICT_WEIGHTS = [30, 14, 12, 9, 8, 5, 4, 5, 5, 8]

# Kind of business: which sources tend to see it, with the chance each one does.
KINDS = {
    "Runner (cross-border)": {"border": 0.85, "momo": 0.7},
    "Courier or delivery": {"courier": 0.85, "momo": 0.6},
    "Flea market stall": {"stall": 0.8, "einvoice": 0.5, "momo": 0.3},
    "Online seller": {"courier": 0.7, "momo": 0.8},
    "Street food": {"stall": 0.6, "einvoice": 0.6, "momo": 0.3},
    "Spaza / general dealer": {"einvoice": 0.85, "stall": 0.5, "momo": 0.4},
    "Hair or beauty": {"momo": 0.7, "stall": 0.4, "einvoice": 0.3},
}
KIND_WEIGHTS = [16, 10, 16, 12, 14, 18, 14]

# Hidden situations and their share of the leads.
SITUATIONS = {
    "active_unregistered": 0.55,  # trading regularly and not registered: the people to reach
    "registered_elsewhere": 0.12,  # already registered, under another name or number
    "personal": 0.18,             # not a business: family money, one shopping trip
    "stopped": 0.15,              # traded earlier in the window, then stopped
}

# Guardrails, the same spirit as the worklist's: weak signals on their own
# never lead to contact.
MOMO_MIN_PAYERS = 5   # fewer payers looks like family support, not customers
BORDER_MIN_TRIPS = 3  # one or two trips can be personal shopping
ACTIVE_MONTHS = 3     # months with a strong signal before anyone is contacted
RECENT = WINDOW[-2:]  # a strong signal in the last two months: still trading


def _pick(weights_dict, rng):
    keys = list(weights_dict)
    return rng.choices(keys, weights=[weights_dict[k] for k in keys])[0]


def _signal(source, rng):
    """One month's figures for a source, for an operator who is trading."""
    if source == "einvoice":
        return {"amount": round(rng.uniform(800, 6000), -1)}
    if source == "momo":
        return {"amount": round(rng.uniform(1500, 9000), -1), "payers": rng.randint(6, 40)}
    if source == "border":
        trips = rng.randint(2, 7)
        return {"trips": trips, "amount": round(trips * rng.uniform(1500, 6000), -1)}
    if source == "courier":
        return {"parcels": rng.randint(15, 160)}
    return {}  # stall: a listing, no monthly figure


def simulate_leads(n=200, seed=11):
    rng = random.Random(seed)
    leads = []
    for i in range(1, n + 1):
        situation = _pick(SITUATIONS, rng)
        kind = rng.choices(list(KINDS), weights=KIND_WEIGHTS)[0]
        district = rng.choices(DISTRICTS, weights=DISTRICT_WEIGHTS)[0]
        months = {m: {} for m in WINDOW}
        stall = False

        if situation in ("active_unregistered", "registered_elsewhere", "stopped"):
            seen = [s for s, p in KINDS[kind].items() if rng.random() < p]
            if not seen:
                seen = [rng.choice(list(KINDS[kind]))]
            stall = "stall" in seen
            if situation == "stopped":
                active = WINDOW[: rng.randint(1, 3)]
            else:
                # most trade every month; a few skip a month or two
                active = [m for m in WINDOW if rng.random() < 0.85] or WINDOW[-1:]
            for m in active:
                for s in seen:
                    if s != "stall":
                        months[m][s] = _signal(s, rng)
        else:  # personal: not a business
            shape = rng.choice(["family_money", "one_trip", "old_licence"])
            if shape == "family_money":
                for m in WINDOW:
                    if rng.random() < 0.8:
                        months[m]["momo"] = {"amount": round(rng.uniform(800, 3500), -1),
                                             "payers": rng.randint(1, 3)}
            elif shape == "one_trip":
                m = rng.choice(WINDOW)
                months[m]["border"] = {"trips": rng.randint(1, 2), "amount": round(rng.uniform(2000, 9000), -1)}
            else:
                stall = True

        phone = any(s in ("momo", "einvoice", "courier") for mm in months.values() for s in mm) \
            and rng.random() < 0.9
        if not phone and (stall or any("border" in mm for mm in months.values())):
            phone = rng.random() < 0.35  # licence lists and customs forms sometimes hold one
        invited_before = phone and rng.random() < 0.18
        match = situation == "registered_elsewhere" and phone and rng.random() < 0.8

        leads.append({
            "lead_id": f"LEAD-{i:04d}",
            "kind": kind,
            "district": district,
            "months": months,
            "stall": stall,
            "phone": phone,
            "invited_before": invited_before,
            "match": match,
            "hidden_situation": situation,
        })
    return leads


def _money(x):
    return f"M{x:,.0f}"


def _month_names(ms):
    names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [names[int(m[5:]) - 1] for m in ms]


def assess_lead(lead):
    """Action and reasons for one lead. Never reads hidden_* fields."""
    months = lead["months"]

    def total(source, field):
        return sum(m[source][field] for m in months.values() if source in m)

    def strong_in(m):
        mm = months[m]
        return ("einvoice" in mm
                or ("momo" in mm and mm["momo"]["payers"] >= MOMO_MIN_PAYERS)
                or "courier" in mm
                or ("border" in mm and total("border", "trips") >= BORDER_MIN_TRIPS))

    strong_months = [m for m in WINDOW if strong_in(m)]
    sources = []
    reasons = []

    einv = total("einvoice", "amount")
    if einv:
        sources.append("einvoice")
        n = sum(1 for m in months.values() if "einvoice" in m)
        reasons.append(f"Supplier e-invoices with no tax number: {_money(einv)} of stock bought in {n} of 6 months.")
    momo_months = [m for m in months.values() if "momo" in m]
    if momo_months:
        payers = max(m["momo"]["payers"] for m in momo_months)
        amount = total("momo", "amount")
        if payers >= MOMO_MIN_PAYERS:
            sources.append("momo")
            reasons.append(f"Mobile money merchant payments: {_money(amount)} from up to {payers} different payers a month.")
        else:
            reasons.append(f"Mobile money inflows of {_money(amount)}, but from only {payers} "
                           f"{'payer' if payers == 1 else 'payers'}: this looks like family support, not customers.")
    trips = total("border", "trips")
    if trips:
        value = total("border", "amount")
        if trips >= BORDER_MIN_TRIPS:
            sources.append("border")
            reasons.append(f"Goods declared at the border on {trips} trips, worth {_money(value)}. "
                           "For a runner most of this is clients' money; only the fee is turnover.")
        else:
            reasons.append(f"Goods declared at the border on {trips} {'trip' if trips == 1 else 'trips'}: "
                           "could be personal shopping.")
    parcels = total("courier", "parcels")
    if parcels:
        sources.append("courier")
        reasons.append(f"{parcels:,} parcels through a courier partner from May to Oct 2026.")
    if lead["stall"]:
        reasons.append("Listed on a trading licence or market stall register with no tax number.")

    recent = any(m in strong_months for m in RECENT)
    trading = len(strong_months) >= ACTIVE_MONTHS and recent

    if lead["match"]:
        action = "POSSIBLE MATCH"
        reasons.append("The phone number matches a registered taxpayer. An officer checks the record "
                       "before anyone is contacted, so nobody is asked to register twice.")
    elif not trading:
        action = "NOT ENOUGH EVIDENCE"
        if strong_months and not recent:
            last = _month_names(strong_months[-1:])[0]
            reasons.append(f"No trading signal since {last}: the business may have stopped. No contact.")
        elif strong_months:
            reasons.append(f"Trading signals in only {len(strong_months)} of 6 months. Not enough to contact them yet.")
        elif lead["stall"]:
            reasons.append("No signal that shows regular trading. A listing on its own is weak evidence, "
                           "since licences are often not cancelled when a business stops. No contact.")
        else:
            reasons.append("No signal that shows regular trading, so no contact.")
    elif not lead["phone"]:
        action = "FIELD VISIT"
        reasons.append(f"Trading signals in {len(strong_months)} of 6 months, and no phone number on record, "
                       "so an officer visits. Khoebo's field-visit link sets them up on the spot.")
    elif lead["invited_before"]:
        action = "FIELD VISIT"
        reasons.append(f"Trading signals in {len(strong_months)} of 6 months. An invitation sent earlier "
                       "had no answer, so an officer visits.")
    else:
        action = "INVITE TO REGISTER"
        reasons.append(f"Trading signals in {len(strong_months)} of 6 months. Send a friendly message with "
                       "a Khoebo link that explains registration and helps them start keeping records.")

    return {
        "action": action,
        "reasons": reasons,
        "sources": sources,
        "active_months": len(strong_months),
        "phone": lead["phone"],
    }


LEAD_ACTIONS = ["FIELD VISIT", "INVITE TO REGISTER", "POSSIBLE MATCH", "NOT ENOUGH EVIDENCE"]


def demo_leads():
    """Four named leads, one per action, with fixed figures. No hidden fields."""
    def months(per_month):
        return {m: per_month(i, m) for i, m in enumerate(WINDOW)}

    return [
        {
            "lead_id": "LEAD-RUNNER",
            "label": "Runner, Maseru (goods from Bloemfontein)",
            "expected": "INVITE TO REGISTER",
            "kind": "Runner (cross-border)",
            "district": "Maseru",
            "months": months(lambda i, m: {
                "border": {"trips": 3 + i % 3, "amount": 9000 + 1500 * (i % 3)},
                "momo": {"amount": 4200 + 300 * i, "payers": 14 + i},
            }),
            "stall": False, "phone": True, "invited_before": False, "match": False,
        },
        {
            "lead_id": "LEAD-FLEA",
            "label": "Flea market clothing stall, Leribe",
            "expected": "FIELD VISIT",
            "kind": "Flea market stall",
            "district": "Leribe",
            "months": months(lambda i, m: {"einvoice": {"amount": 2400 + 200 * (i % 2)}} if i != 1 else {}),
            "stall": True, "phone": False, "invited_before": False, "match": False,
        },
        {
            "lead_id": "LEAD-COURIER",
            "label": "Courier, Berea",
            "expected": "POSSIBLE MATCH",
            "kind": "Courier or delivery",
            "district": "Berea",
            "months": months(lambda i, m: {"courier": {"parcels": 60 + 5 * i}, "momo": {"amount": 3800, "payers": 22}}),
            "stall": False, "phone": True, "invited_before": False, "match": True,
        },
        {
            "lead_id": "LEAD-FAMILY",
            "label": "Mobile money only, Mafeteng",
            "expected": "NOT ENOUGH EVIDENCE",
            "kind": "Hair or beauty",
            "district": "Mafeteng",
            "months": months(lambda i, m: {"momo": {"amount": 2500, "payers": 2}}),
            "stall": False, "phone": True, "invited_before": False, "match": False,
        },
    ]


def score_leads(leads):
    """How well the rules do against the hidden truth, and against visiting every lead."""
    truth = {l["lead_id"]: l["hidden_situation"] for l in leads}
    acts = {l["lead_id"]: assess_lead(l)["action"] for l in leads}
    positives = {i for i, s in truth.items() if s == "active_unregistered"}
    contacted = {i for i, a in acts.items() if a in ("FIELD VISIT", "INVITE TO REGISTER")}
    visits = {i for i, a in acts.items() if a == "FIELD VISIT"}
    registered = {i for i, s in truth.items() if s == "registered_elsewhere"}

    def share(part, whole):
        return len(part) / len(whole) if whole else 0.0

    return {
        "leads": len(leads),
        "active_unregistered": len(positives),
        "visits": len(visits),
        "invites": len(contacted - visits),
        "visit_precision": share(visits & positives, visits),
        "contact_precision": share(contacted & positives, contacted),
        "reached": share(contacted & positives, positives),
        "registered_contacted": len(contacted & registered),
        # baseline: what a street sweep of every lead would take
        "baseline_visits": len(leads),
        "baseline_precision": share(positives, set(truth)),
    }


def thirty_lead_runs(seeds=range(1, 31)):
    runs = [score_leads(simulate_leads(seed=s)) for s in seeds]
    out = {}
    for key in runs[0]:
        vals = [r[key] for r in runs]
        out[key] = {"mean": round(statistics.mean(vals), 4), "min": round(min(vals), 4), "max": round(max(vals), 4)}
    return out
