import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { ChatShell } from "@/components/chat/ChatShell";

export const metadata: Metadata = {
  title: "Trader chat",
};

export default function TraderPage() {
  return (
    <RequireRole role="trader">
      <TraderPageContent />
    </RequireRole>
  );
}

function TraderPageContent() {
  return <ChatShell />;
}
