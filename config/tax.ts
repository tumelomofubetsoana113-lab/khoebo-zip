// Placeholder Simplified Business Tax settings (SPEC.md section 7).
// The Call for Innovation leaves the SBT threshold and rates blank, so every
// value here is a placeholder until RSL confirms them. Changing this file must
// be the only change needed once the real rules are known.

// One row of the tax table. Bands are listed from the lowest turnover up.
export type TaxBand = {
  upTo: number | null; // top of the band in maloti, inclusive; null on the last band
  rate: number; // share of turnover, e.g. 0.02 for 2%
  fixed: number; // fixed amount in maloti for a trader in this band; 0 for none
};

export type TaxConfig = {
  placeholder: boolean; // shows the placeholder note everywhere
  // Turnover at or below this pays no tax; above it the bands apply to all of
  // it. 0 for no threshold. (For "only the part above is taxed", use a first
  // band with rate 0 and bandMethod "marginal" instead.)
  threshold: number;
  bands: TaxBand[];
  // "whole": the band the turnover falls in sets the rate for all of it, plus
  //   that band's fixed amount.
  // "marginal": each slice of turnover is taxed at its own band's rate, like
  //   income tax, plus the fixed amount of the band the turnover reaches.
  bandMethod: "whole" | "marginal";
  // Whether the threshold, band limits and fixed amounts are yearly figures
  // (shared out evenly over the filing periods) or per filing period.
  amountsPer: "year" | "period";
  filingPeriod: "monthly" | "quarterly";
  dueDayAfterPeriodEnd: number; // due on this day of the month after the period ends
  reminderDaysBefore: number;
  note: string;
};

export const TAX: TaxConfig = {
  placeholder: true,
  threshold: 0, // PLACEHOLDER
  bands: [{ upTo: null, rate: 0.02, fixed: 0 }], // PLACEHOLDER: a flat 2% on all sales
  bandMethod: "whole", // PLACEHOLDER
  amountsPer: "year", // PLACEHOLDER
  filingPeriod: "quarterly", // PLACEHOLDER
  dueDayAfterPeriodEnd: 20, // PLACEHOLDER: due on the 20th of the following month
  reminderDaysBefore: 3,
  note: "This estimate uses a placeholder rate until RSL confirms the Simplified Business Tax rates.",
};
