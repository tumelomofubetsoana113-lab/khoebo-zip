import type { LucideIcon } from "lucide-react";

// A soft orange tile with an orange icon. `inverse` is for a dark background.
export function IconCircle({ icon: Icon, inverse = false }: { icon: LucideIcon; inverse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
        inverse ? "bg-surface text-brand" : "bg-brand-soft text-brand"
      }`}
    >
      <Icon size={22} />
    </span>
  );
}
