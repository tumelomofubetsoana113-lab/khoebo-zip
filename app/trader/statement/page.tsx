import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { StatementShell } from "@/components/statement/StatementView";

export const metadata: Metadata = {
  title: "Statement",
};

export default function StatementPage() {
  return (
    <RequireRole role="trader">
      <StatementPageContent />
    </RequireRole>
  );
}

function StatementPageContent() {
  return <StatementShell />;
}
