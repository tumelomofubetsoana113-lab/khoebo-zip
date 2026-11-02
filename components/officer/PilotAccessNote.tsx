import { Lock } from "lucide-react";
import { strings } from "@/lib/strings";

// The officer pages are open in the prototype because all data is simulated.
// This says plainly that a pilot would put them behind RSL sign-in.
export function PilotAccessNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-sm text-muted ${className}`}>
      <Lock size={16} aria-hidden className="mt-0.5 shrink-0" />
      {strings.officer.pilotAccess}
    </p>
  );
}
