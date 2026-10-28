import type { LucideIcon } from "lucide-react";

export function IconCircle({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-flag-blue text-surface"
    >
      <Icon size={22} />
    </span>
  );
}
