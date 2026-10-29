// Placeholder Simplified Business Tax settings (SPEC.md section 7).
// The Call for Innovation leaves the SBT threshold and rates blank, so every
// value here is a placeholder until RSL confirms them. Changing this file must
// be the only change needed once the real rules are known.

export type TaxConfig = {
  placeholder: boolean; // shows the placeholder note everywhere
  rateOnTurnover: number;
  filingPeriod: "monthly" | "quarterly";
  dueDayAfterPeriodEnd: number; // due on this day of the month after the period ends
  reminderDaysBefore: number;
  note: string;
};

export const TAX: TaxConfig = {
  placeholder: true,
  rateOnTurnover: 0.02, // PLACEHOLDER, confirm with RSL
  filingPeriod: "quarterly", // PLACEHOLDER
  dueDayAfterPeriodEnd: 20, // PLACEHOLDER: due on the 20th of the following month
  reminderDaysBefore: 3,
  note: "This estimate uses a placeholder rate until RSL confirms the Simplified Business Tax rates.",
};
