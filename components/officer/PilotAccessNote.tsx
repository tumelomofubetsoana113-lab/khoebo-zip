import { Lock } from "lucide-react";
import { strings } from "@/lib/strings";

// Since 19 November 2026 the officer pages need an officer account
// (components/auth/RequireRole.tsx), and this says so.
export function PilotAccessNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-sm text-muted ${className}`}>
      <Lock size={16} aria-hidden className="mt-0.5 shrink-0" />
      {strings.officer.pilotAccess}
    </p>
  );
}
