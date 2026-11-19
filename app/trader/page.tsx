import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { TraderHome } from "@/components/home/TraderHome";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.home.metaTitle,
};

// Where a trader lands after logging in (since 19 November 2026). The chat is
// at /trader/chat, one tap away.
export default function TraderHomePage() {
  return (
    <RequireRole role="trader">
      <TraderHomeContent />
    </RequireRole>
  );
}

function TraderHomeContent() {
  return <TraderHome />;
}
