import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { homeFor, type Role } from "@/lib/accounts";
import { currentAccount } from "@/lib/server/session";
import { strings } from "@/lib/strings";
import { AccountProvider } from "./AccountProvider";

// Wraps a whole trader or officer page (added 19 Nov 2026). The page is only
// rendered for a signed-in account with the right role: anyone else goes to
// the log-in page, and the other kind of user goes to their own side. It sits
// in each page rather than a layout, so no part of a page can be fetched
// without the check.
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <Suspense fallback={<Checking />}>
      <Gate role={role}>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ role, children }: { role: Role; children: ReactNode }) {
  const account = await currentAccount();
  if (!account) redirect("/login");
  if (account.role !== role) redirect(homeFor(account.role));
  return <AccountProvider account={account}>{children}</AccountProvider>;
}

function Checking() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-muted" role="status">
      {strings.auth.checking}
    </div>
  );
}
