import { Check, Search } from "lucide-react";
import { useId } from "react";
import { strings } from "@/lib/strings";
import { ACTION_ORDER, toggleAction, type WorklistQuery } from "@/lib/worklist";

const t = strings.officer.filters;

const fieldClasses =
  "min-h-11 w-full rounded-card border border-line bg-surface px-3 text-base text-ink";

// Action chips (multi-select), district and sector dropdowns, and an ID search.
export function Filters({
  query,
  districts,
  sectors,
  onChange,
}: {
  query: WorklistQuery;
  districts: string[];
  sectors: string[];
  onChange?: (q: WorklistQuery) => void;
}) {
  const id = useId();
  const active = query.actions.length > 0 || query.district || query.sector || query.search;

  return (
    <section aria-label={t.heading} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t.action}</legend>
        <div className="flex flex-wrap gap-2">
          {ACTION_ORDER.map((action) => {
            const on = query.actions.includes(action);
            return (
              <button
                key={action}
                type="button"
                aria-pressed={on}
                onClick={() => onChange?.(toggleAction(query, action))}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                  on ? "border-flag-blue bg-flag-blue text-surface" : "border-line bg-surface text-ink hover:bg-page"
                }`}
              >
                {on && <Check size={16} aria-hidden />}
                {strings.actions[action]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-district`} className="mb-1 block text-sm font-semibold">
            {t.district}
          </label>
          <select
            id={`${id}-district`}
            className={fieldClasses}
            value={query.district}
            onChange={(e) => onChange?.({ ...query, district: e.target.value })}
          >
            <option value="">{t.allDistricts}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-sector`} className="mb-1 block text-sm font-semibold">
            {t.sector}
          </label>
          <select
            id={`${id}-sector`}
            className={fieldClasses}
            value={query.sector}
            onChange={(e) => onChange?.({ ...query, sector: e.target.value })}
          >
            <option value="">{t.allSectors}</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-search`} className="mb-1 block text-sm font-semibold">
            {t.search}
          </label>
          <div className="relative">
            <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              id={`${id}-search`}
              type="search"
              inputMode="search"
              autoComplete="off"
              maxLength={40}
              placeholder={t.searchPlaceholder}
              className={`${fieldClasses} pl-9`}
              value={query.search}
              onChange={(e) => onChange?.({ ...query, search: e.target.value })}
            />
          </div>
        </div>
      </div>

      {active && (
        <button
          type="button"
          onClick={() => onChange?.({ actions: [], district: "", sector: "", search: "" })}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-flag-blue hover:bg-page"
        >
          {t.clear}
        </button>
      )}
    </section>
  );
}
