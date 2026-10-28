// All UI text lives here, keyed, so Sesotho can be added later.
// English only for now.

export const strings = {
  brand: {
    name: "Khoebo",
    prototypePill: "Prototype · RSL Taxathon 2026",
    prototypeLabel: "Prototype for the RSL Taxathon 2026",
    description:
      "A prototype records and tax assistant for informal traders in Lesotho, with an officer worklist for RSL.",
  },
  footer: {
    text: "Prototype built for the RSL Taxathon 2026 by New Empire AI. Not an official RSL service. All data shown is simulated.",
  },
  actions: {
    followup: "Officer follow-up",
    review: "Human review",
    checkin: "Automated check-in",
    none: "No action",
  },
  common: {
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
  },
} as const;

export type ActionKey = keyof typeof strings.actions;
