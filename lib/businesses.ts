// A trader can run more than one business: branches of the same shop, or
// different kinds of business (added 19 November 2026). The first business is
// the profile's own type and district, with the id "main". Records for it carry
// no businessId, so a trader with one business is stored exactly as before.
// Each business keeps its own records and files its own return.

import type { Entry, FiledReturn, TraderState } from "./state";
import { strings } from "./strings";

export const MAIN_BUSINESS = "main";

export type BusinessInfo = { id: string; name: string; type?: string; district?: string };

export function businessList(state: TraderState): BusinessInfo[] {
  const p = state.profile;
  const main: BusinessInfo = {
    id: MAIN_BUSINESS,
    name: p.businessName ?? p.businessType ?? strings.businesses.mainFallback,
    ...(p.businessType ? { type: p.businessType } : {}),
    ...(p.district ? { district: p.district } : {}),
  };
  return [main, ...(state.businesses ?? [])];
}

export function hasSeveralBusinesses(state: TraderState): boolean {
  return (state.businesses?.length ?? 0) > 0;
}

export function businessIdOf(item: Pick<Entry | FiledReturn, "businessId">): string {
  return item.businessId ?? MAIN_BUSINESS;
}

// The id as it is saved on an entry or return: none for the first business.
export function storedBusinessId(id: string): { businessId?: string } {
  return id === MAIN_BUSINESS ? {} : { businessId: id };
}

export function entriesFor(entries: Entry[], businessId: string): Entry[] {
  return entries.filter((e) => businessIdOf(e) === businessId);
}

export function findBusinessReturn(state: TraderState, period: string, businessId: string): FiledReturn | undefined {
  return state.returns.find((r) => r.period === period && businessIdOf(r) === businessId);
}

export type BusinessCheck =
  | { ok: true; business: BusinessInfo }
  | { ok: false; error: "needs_business" | "business_not_found" };

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Finds the business the model named, by id or by name. With one business,
// leaving it out means that one. With several, it has to be given.
export function resolveBusiness(state: TraderState, value?: string): BusinessCheck {
  const list = businessList(state);
  // One business: whatever was named, it's that one, so nothing changes for most traders.
  if (list.length === 1) return { ok: true, business: list[0] };
  if (!value?.trim()) return { ok: false, error: "needs_business" };
  const match =
    list.find((b) => b.id === value.trim()) ??
    list.find((b) => same(b.name, value)) ??
    // A business type works only when one business has it.
    (list.filter((b) => b.type && same(b.type, value)).length === 1
      ? list.find((b) => b.type && same(b.type, value))
      : undefined);
  return match ? { ok: true, business: match } : { ok: false, error: "business_not_found" };
}

// Names that are already taken, for a new or renamed business.
export function nameTaken(state: TraderState, name: string, exceptId?: string): boolean {
  return businessList(state).some((b) => b.id !== exceptId && same(b.name, name));
}
