import type { LucideIcon } from "lucide-react";

// `inverse` is for use on a blue background: white circle, blue icon.
export function IconCircle({ icon: Icon, inverse = false }: { icon: LucideIcon; inverse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
        inverse ? "bg-surface text-flag-blue" : "bg-flag-blue text-surface"
      }`}
    >
      <Icon size={22} />
    </span>
  );
}
